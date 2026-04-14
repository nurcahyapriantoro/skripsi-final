"""
statistical_analysis.py
========================
Performs the complete statistical analysis pipeline for the research:
  1. Shapiro-Wilk normality test (α = 0.05)
  2. If both normal: Levene's test for homogeneity of variance
  3. If both normal + equal variance: one-tailed independent t-test
     If not normal: one-tailed Mann-Whitney U test
  4. Calculates Cohen's d effect size
  5. Generates summary report → analysis/results/statistical_report.txt
  6. Generates box plot → analysis/results/gas_comparison_plot.png

Research hypotheses:
  H₀: μ_CEI ≥ μ_Mutex (no significant difference, or CEI is higher)
  H₁: μ_CEI < μ_Mutex (CEI has significantly lower gas than Mutex)
  α = 0.05, one-tailed test
"""

import pandas as pd
import numpy as np
from scipy import stats
import matplotlib.pyplot as plt
import os

# ============================================================
# CONFIGURATION
# ============================================================
RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")
GAS_CEI_PATH = os.path.join(RESULTS_DIR, "gas_data_cei.csv")
GAS_MUTEX_PATH = os.path.join(RESULTS_DIR, "gas_data_mutex.csv")
OPCODE_CEI_PATH = os.path.join(RESULTS_DIR, "opcode_data_cei.csv")
OPCODE_MUTEX_PATH = os.path.join(RESULTS_DIR, "opcode_data_mutex.csv")
REPORT_PATH = os.path.join(RESULTS_DIR, "statistical_report.txt")
ALPHA = 0.05

# ============================================================
# HELPER FUNCTIONS
# ============================================================

def cohens_d(group1, group2):
    """Calculate Cohen's d effect size."""
    n1, n2 = len(group1), len(group2)
    pooled_std = np.sqrt(
        ((n1 - 1) * np.std(group1, ddof=1)**2 + (n2 - 1) * np.std(group2, ddof=1)**2)
        / (n1 + n2 - 2)
    )
    return (np.mean(group1) - np.mean(group2)) / pooled_std if pooled_std > 0 else 0.0

def interpret_effect(d):
    """Interpret Cohen's d effect size magnitude."""
    d = abs(d)
    if d < 0.2: return "negligible"
    elif d < 0.5: return "small"
    elif d < 0.8: return "medium"
    else: return "large"

def run_analysis(data_cei, data_mutex, metric_name):
    """Run the full statistical pipeline for a given metric."""
    lines = [f"\n{'='*60}"]
    lines.append(f"METRIC: {metric_name}")
    lines.append('='*60)

    # Descriptive statistics
    lines.append(f"\nDescriptive Statistics (n={len(data_cei)} per group):")
    lines.append(f"{'':20s} {'CEI':>12s} {'Mutex':>12s}")
    lines.append(f"{'Mean':20s} {np.mean(data_cei):>12.2f} {np.mean(data_mutex):>12.2f}")
    lines.append(f"{'Std Dev':20s} {np.std(data_cei, ddof=1):>12.2f} {np.std(data_mutex, ddof=1):>12.2f}")
    lines.append(f"{'Min':20s} {np.min(data_cei):>12.2f} {np.min(data_mutex):>12.2f}")
    lines.append(f"{'Max':20s} {np.max(data_cei):>12.2f} {np.max(data_mutex):>12.2f}")
    lines.append(f"{'Median':20s} {np.median(data_cei):>12.2f} {np.median(data_mutex):>12.2f}")

    mean_diff = np.mean(data_cei) - np.mean(data_mutex)
    pct_diff = (mean_diff / np.mean(data_mutex)) * 100
    lines.append(f"\nMean difference (CEI - Mutex): {mean_diff:.2f} ({pct_diff:.2f}%)")

    # Step 1: Shapiro-Wilk normality test
    lines.append("\n--- STEP 1: Shapiro-Wilk Normality Test ---")
    
    # Handle constant data (std = 0) — Shapiro-Wilk can't run on constant data
    std_cei = np.std(data_cei, ddof=1)
    std_mutex = np.std(data_mutex, ddof=1)
    
    if std_cei == 0:
        sw_stat_cei, sw_p_cei = 1.0, 1.0
        normal_cei = True
        lines.append(f"CEI:   W=N/A (constant data, std=0), p=N/A -> CONSTANT (treated as normal)")
    else:
        sw_stat_cei, sw_p_cei = stats.shapiro(data_cei)
        normal_cei = sw_p_cei > ALPHA
        lines.append(f"CEI:   W={sw_stat_cei:.4f}, p={sw_p_cei:.4f} -> {'NORMAL' if normal_cei else 'NOT NORMAL'}")
    
    if std_mutex == 0:
        sw_stat_mutex, sw_p_mutex = 1.0, 1.0
        normal_mutex = True
        lines.append(f"Mutex: W=N/A (constant data, std=0), p=N/A -> CONSTANT (treated as normal)")
    else:
        sw_stat_mutex, sw_p_mutex = stats.shapiro(data_mutex)
        normal_mutex = sw_p_mutex > ALPHA
        lines.append(f"Mutex: W={sw_stat_mutex:.4f}, p={sw_p_mutex:.4f} -> {'NORMAL' if normal_mutex else 'NOT NORMAL'}")

    both_normal = normal_cei and normal_mutex
    
    # Handle case where both groups have zero variance
    if std_cei == 0 and std_mutex == 0:
        lines.append("\n--- SPECIAL CASE: Both groups have zero variance ---")
        if np.mean(data_cei) < np.mean(data_mutex):
            lines.append(f"\n[PASS] CEI is deterministically lower than Mutex ({np.mean(data_cei):.0f} < {np.mean(data_mutex):.0f})")
            lines.append(f"   No statistical test needed -- the difference is exact and constant.")
            p_value = 0.0
            d = float('inf')
            test_used = "Deterministic comparison (zero variance)"
        elif np.mean(data_cei) == np.mean(data_mutex):
            lines.append(f"\n[FAIL] Both groups are identical ({np.mean(data_cei):.0f} = {np.mean(data_mutex):.0f})")
            p_value = 1.0
            d = 0.0
            test_used = "Deterministic comparison (zero variance)"
        else:
            lines.append(f"\n[FAIL] CEI is deterministically higher than Mutex ({np.mean(data_cei):.0f} > {np.mean(data_mutex):.0f})")
            p_value = 1.0
            d = float('-inf')
            test_used = "Deterministic comparison (zero variance)"
        effect_interpretation = "deterministic"
    elif both_normal:
        # Step 2: Levene's test for homogeneity of variance
        lines.append("\n--- STEP 2: Levene's Test (Homogeneity of Variance) ---")
        lev_stat, lev_p = stats.levene(data_cei, data_mutex)
        equal_variance = lev_p > ALPHA
        lines.append(f"Levene: F={lev_stat:.4f}, p={lev_p:.4f} -> {'EQUAL VARIANCE' if equal_variance else 'UNEQUAL VARIANCE'}")

        # Step 3a: Independent t-test (one-tailed: CEI < Mutex)
        lines.append("\n--- STEP 3: Independent Samples t-test (one-tailed: CEI < Mutex) ---")
        t_stat, t_p_twotailed = stats.ttest_ind(data_cei, data_mutex, equal_var=equal_variance)
        # Convert to one-tailed p-value (testing if CEI mean < Mutex mean)
        t_p_onetailed = t_p_twotailed / 2 if t_stat < 0 else 1 - t_p_twotailed / 2
        test_used = "Independent t-test" + (" (equal var)" if equal_variance else " (Welch's)")
        lines.append(f"t-statistic: {t_stat:.4f}")
        lines.append(f"Two-tailed p: {t_p_twotailed:.6f}")
        lines.append(f"One-tailed p (CEI < Mutex): {t_p_onetailed:.6f}")
        p_value = t_p_onetailed
        d = cohens_d(data_cei, data_mutex)
        effect_interpretation = interpret_effect(d)
    else:
        # Step 3b: Mann-Whitney U test (non-parametric, one-tailed)
        lines.append("\n--- STEP 3: Mann-Whitney U Test (one-tailed: CEI < Mutex) ---")
        mw_stat, mw_p_twotailed = stats.mannwhitneyu(data_cei, data_mutex, alternative='less')
        test_used = "Mann-Whitney U"
        lines.append(f"U-statistic: {mw_stat:.4f}")
        lines.append(f"One-tailed p (CEI < Mutex): {mw_p_twotailed:.6f}")
        p_value = mw_p_twotailed
        d = cohens_d(data_cei, data_mutex)
        effect_interpretation = interpret_effect(d)

    # Conclusion
    lines.append(f"\n--- CONCLUSION ---")
    lines.append(f"Test used: {test_used}")
    lines.append(f"p-value (one-tailed): {p_value:.6f}")
    lines.append(f"Alpha: {ALPHA}")
    if isinstance(d, float) and (d == float('inf') or d == float('-inf')):
        lines.append(f"Cohen's d: {d} ({effect_interpretation} effect)")
    else:
        lines.append(f"Cohen's d: {d:.4f} ({effect_interpretation} effect)")

    if p_value < ALPHA:
        lines.append(f"\n[PASS] REJECT H0: CEI has SIGNIFICANTLY LOWER {metric_name} than Mutex (p={p_value:.6f} < alpha={ALPHA})")
        lines.append(f"   H1 is SUPPORTED.")
    else:
        lines.append(f"\n[FAIL] FAIL TO REJECT H0: No significant difference in {metric_name} (p={p_value:.6f} >= alpha={ALPHA})")
        lines.append(f"   H1 is NOT SUPPORTED for this metric.")

    return "\n".join(lines), (data_cei, data_mutex, metric_name, p_value, d)

# ============================================================
# MAIN
# ============================================================

def main():
    print("Loading gas data...")
    df_cei = pd.read_csv(GAS_CEI_PATH)
    df_mutex = pd.read_csv(GAS_MUTEX_PATH)
    df_opcode_cei = pd.read_csv(OPCODE_CEI_PATH)
    df_opcode_mutex = pd.read_csv(OPCODE_MUTEX_PATH)

    report_lines = [
        "=" * 60,
        "STATISTICAL ANALYSIS REPORT",
        "Research: Reentrancy Mitigation on Supply Chain Smart Contracts",
        "Researcher: Nurcahya Priantoro (G6401221049)",
        "=" * 60,
        f"\nSample size: {len(df_cei)} iterations per group",
        f"Significance level: alpha = {ALPHA}",
        f"Test direction: one-tailed (H1: CEI < Mutex)",
    ]

    datasets_for_plot = []

    # Analysis 1: Total Gas Used
    report, plot_data = run_analysis(
        df_cei["gas_used"].values.astype(float),
        df_mutex["gas_used"].values.astype(float),
        "Total Gas Used (withdrawFunds)"
    )
    report_lines.append(report)
    datasets_for_plot.append(plot_data)

    # Analysis 2: SSTORE Count
    report, plot_data = run_analysis(
        df_opcode_cei["sstore_count"].values.astype(float),
        df_opcode_mutex["sstore_count"].values.astype(float),
        "SSTORE Opcode Count"
    )
    report_lines.append(report)
    datasets_for_plot.append(plot_data)

    # Analysis 3: SLOAD Count
    report, plot_data = run_analysis(
        df_opcode_cei["sload_count"].values.astype(float),
        df_opcode_mutex["sload_count"].values.astype(float),
        "SLOAD Opcode Count"
    )
    report_lines.append(report)
    datasets_for_plot.append(plot_data)

    # Write report
    full_report = "\n".join(report_lines)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write(full_report)
    print(full_report.encode('ascii', 'replace').decode('ascii'))
    print(f"\n[OK] Report saved to {REPORT_PATH}")

    # Generate comparison box plot
    fig, axes = plt.subplots(1, 3, figsize=(15, 6))
    fig.suptitle("CEI vs Mutex Lock: Gas Consumption Comparison\n(30 Iterations Each)", fontsize=14)

    for ax, (cei_data, mutex_data, metric, p_val, d) in zip(axes, datasets_for_plot):
        ax.boxplot([cei_data, mutex_data], labels=["CEI (SecureVault)", "Mutex (MutexVault)"])
        d_str = f"{d:.3f}" if isinstance(d, (int, float)) and d != float('inf') and d != float('-inf') else str(d)
        ax.set_title(f"{metric}\np={p_val:.4f}, d={d_str}")
        ax.set_ylabel("Count / Gas Units")
        ax.grid(True, alpha=0.3)

    plt.tight_layout()
    plot_path = os.path.join(RESULTS_DIR, "gas_comparison_plot.png")
    plt.savefig(plot_path, dpi=150, bbox_inches="tight")
    print(f"[OK] Box plot saved to {plot_path}")

if __name__ == "__main__":
    main()
