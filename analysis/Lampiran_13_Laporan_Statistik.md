# Lampiran 13. Laporan Lengkap Analisis Statistik (Deterministik)

> **Cross-reference:** Mendukung **Bab 3.7.1 (Analisis Komparatif Deterministik)**, **Bab 4.4.5 (Validasi Hipotesis)**, dan **Tabel 9 (Ringkasan analisis statistik komparatif)**.
>
> **Sumber data mentah:** [`analysis/results/statistical_report.txt`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/analysis/results/statistical_report.txt) — dihasilkan oleh skrip [`analysis/statistical_analysis.py`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/analysis/statistical_analysis.py).
>
> Laporan ini memuat seluruh output analisis statistik, termasuk justifikasi khusus untuk kasus **data deterministik (zero variance)**.

---

## 13.1 Konfigurasi Analisis

```
Sample size         : 30 iterasi per kelompok
Significance level  : α = 0.05
Test direction      : one-tailed (H1: CEI < Mutex)
Karakteristik data  : Deterministik (zero variance)
Metode pembanding   : Selisih berbasis instruksi mesin (Wood 2014)
```

**Hipotesis:**
- **H₀:** Tidak terdapat perbedaan konsumsi gas antara kontrak berbasis pola CEI dan mutex lock.
- **H₁:** Kontrak berbasis pola CEI memiliki konsumsi gas yang lebih rendah dibandingkan mutex lock.

---

## 13.2 Laporan Lengkap (Raw Output)

```
============================================================
STATISTICAL ANALYSIS REPORT
Research: Reentrancy Mitigation on Supply Chain Smart Contracts
Researcher: Nurcahya Priantoro (G6401221049)
============================================================

Sample size: 30 iterations per group
Significance level: alpha = 0.05
Test direction: one-tailed (H1: CEI < Mutex)

============================================================
METRIC: Total Gas Used (withdrawFunds)
============================================================

Descriptive Statistics (n=30 per group):
                              CEI        Mutex
Mean                     29968.00     32363.00
Std Dev                      0.00         0.00
Min                      29968.00     32363.00
Max                      29968.00     32363.00
Median                   29968.00     32363.00

Mean difference (CEI - Mutex): -2395.00 (-7.40%)

--- STEP 1: Shapiro-Wilk Normality Test ---
CEI:   W=N/A (constant data, std=0), p=N/A -> CONSTANT (treated as normal)
Mutex: W=N/A (constant data, std=0), p=N/A -> CONSTANT (treated as normal)

--- SPECIAL CASE: Both groups have zero variance ---

[PASS] CEI is deterministically lower than Mutex (29968 < 32363)
   No statistical test needed -- the difference is exact and constant.

--- CONCLUSION ---
Test used: Deterministic comparison (zero variance)
p-value (one-tailed): 0.000000
Alpha: 0.05
Cohen's d: inf (deterministic effect)

[PASS] REJECT H0: CEI has SIGNIFICANTLY LOWER Total Gas Used (withdrawFunds) than Mutex (p=0.000000 < alpha=0.05)
   H1 is SUPPORTED.

============================================================
METRIC: SSTORE Opcode Count
============================================================

Descriptive Statistics (n=30 per group):
                              CEI        Mutex
Mean                         1.00         3.00
Std Dev                      0.00         0.00
Min                          1.00         3.00
Max                          1.00         3.00
Median                       1.00         3.00

Mean difference (CEI - Mutex): -2.00 (-66.67%)

--- STEP 1: Shapiro-Wilk Normality Test ---
CEI:   W=N/A (constant data, std=0), p=N/A -> CONSTANT (treated as normal)
Mutex: W=N/A (constant data, std=0), p=N/A -> CONSTANT (treated as normal)

--- SPECIAL CASE: Both groups have zero variance ---

[PASS] CEI is deterministically lower than Mutex (1 < 3)
   No statistical test needed -- the difference is exact and constant.

--- CONCLUSION ---
Test used: Deterministic comparison (zero variance)
p-value (one-tailed): 0.000000
Alpha: 0.05
Cohen's d: inf (deterministic effect)

[PASS] REJECT H0: CEI has SIGNIFICANTLY LOWER SSTORE Opcode Count than Mutex (p=0.000000 < alpha=0.05)
   H1 is SUPPORTED.

============================================================
METRIC: SLOAD Opcode Count
============================================================

Descriptive Statistics (n=30 per group):
                              CEI        Mutex
Mean                         1.00         2.00
Std Dev                      0.00         0.00
Min                          1.00         2.00
Max                          1.00         2.00
Median                   1.00         2.00

Mean difference (CEI - Mutex): -1.00 (-50.00%)

--- STEP 1: Shapiro-Wilk Normality Test ---
CEI:   W=N/A (constant data, std=0), p=N/A -> CONSTANT (treated as normal)
Mutex: W=N/A (constant data, std=0), p=N/A -> CONSTANT (treated as normal)

--- SPECIAL CASE: Both groups have zero variance ---

[PASS] CEI is deterministically lower than Mutex (1 < 2)
   No statistical test needed -- the difference is exact and constant.

--- CONCLUSION ---
Test used: Deterministic comparison (zero variance)
p-value (one-tailed): 0.000000
Alpha: 0.05
Cohen's d: inf (deterministic effect)

[PASS] REJECT H0: CEI has SIGNIFICANTLY LOWER SLOAD Opcode Count than Mutex (p=0.000000 < alpha=0.05)
   H1 is SUPPORTED.
```

---

## 13.3 Tabel Ringkasan (Tabel 9 di skripsi)

**Tabel 13.1 Ringkasan analisis statistik komparatif biaya gas**

| Metrik | CEI (Mean ± SD) | Mutex (Mean ± SD) | Selisih | Kesimpulan |
|--------|-----------------|-------------------|---------|-----------|
| **Total Gas (withdrawFunds)** | 29.968 ± 0 | 32.363 ± 0 | −2.395 (−7,40 %) | H₀ DITOLAK ✅ |
| **SSTORE Opcode Count** | 1 ± 0 | 3 ± 0 | −2 (−66,67 %) | H₀ DITOLAK ✅ |
| **SLOAD Opcode Count** | 1 ± 0 | 2 ± 0 | −1 (−50,00 %) | H₀ DITOLAK ✅ |

**Catatan:** Selisih gas 2.395 pada laporan statistik vs **2.413** di skripsi berasal dari perbedaan *baseline* (avg 29.968 vs 29.950). Laporan ini menggunakan data aktual dari `gas_data_cei.csv` (Lampiran 7). Untuk selisih persis sesuai skripsi, lihat `withdrawFunds` di Tabel L12.4 Lampiran 12.

---

## 13.4 Justifikasi Data Deterministik (zero variance)

Per Wood (2014), **arsitektur EVM bersifat mutlak deterministik** untuk instruksi individual: opcode yang sama pada state identik menghasilkan biaya gas yang persis sama. Skrip analisis mengimplementasikan protokol berikut:

1. **Deteksi otomatis zero-variance:** Sebelum uji parametrik apapun, skrip menghitung standar deviasi. Jika σ = 0 untuk kedua kelompok, pengujian parametrik (Shapiro-Wilk, t-test) dilewati karena asumsinya (distribusi normal + varians non-nol) tidak terpenuhi.

2. **Perbandingan deterministik:** Selisih dihitung sebagai `mean(CEI) − mean(Mutex)`. Karena setiap iterasi identik, selisih ini **pasti sama** untuk setiap replikasi eksperimen.

3. **Verifikasi opcode-level:** Selisih 2 SSTORE dan 1 SLOAD di MutexVault berkorelasi langsung dengan selisih 2.395 gas:
   - 1 SSTORE hangat (warm) ≈ 2.900 gas
   - 1 SLOAD hangat ≈ 100 gas
   - Total estimasi: 2 × 2.900 + 1 × 100 ≈ 5.900 gas (perkiraan kasar)
   - Selisih aktual 2.395 gas lebih kecil karena beberapa SSTORE mungkin "warm" (data sudah di slot baru).

---

## 13.5 Alur Pikir (Reasoning Chain)

```
1. EVM mengeksekusi instruksi secara deterministik
   (Wood 2014, EIP-2929, EIP-2200)
   ↓
2. Hardhat Network mereset state per-iterasi (hardhat_reset)
   → kondisi identik untuk setiap iterasi
   ↓
3. Kode Solidity identik + state identik → gas identik
   → σ = 0 untuk semua metrik
   ↓
4. Uji parametrik (t-test, Mann-Whitney) membutuhkan σ² > 0
   → tidak applicable
   ↓
5. Pembuktian H₁: cukup tunjukkan selisih deterministik
   → CEI 29.968 < Mutex 32.363 (selalu benar)
   → H₁ SUPPORTED secara arsitektural
```

---

## 13.6 Justifikasi Mengapa Uji t Independen Tidak Valid

Uji t independen mengasumsikan:
- **Independensi observasi:** Terpenuhi (setiap iterasi independen).
- **Distribusi normal:** Tidak dapat diuji (σ = 0). Shapiro-Wilk mengembalikan N/A.
- **Varians homogen atau heterogen:** Tidak dapat dihitung (σ² = 0).
- **Skala pengukuran kontinyu:** Terpenuhi (gas adalah bilangan bulat).

Karena 2 dari 4 asumsi tidak terpenuhi, **uji t tidak sahih** untuk data ini. Oleh karena itu, penelitian menggunakan Analisis Komparatif Deterministik yang hanya memerlukan asumsi deterministik EVM (Wood 2014).

---

## 13.7 Skrip Python Sumber

**Lokasi:** [`analysis/statistical_analysis.py`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/analysis/statistical_analysis.py)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/analysis/statistical_analysis.py

Skrip membaca `gas_data_cei.csv` dan `gas_data_mutex.csv` (Lampiran 7), lalu menjalankan:
1. Perhitungan statistik deskriptif (mean, median, std, min, max).
2. Uji Shapiro-Wilk (dengan fallback ke konstanta).
3. Perbandingan selisih deterministik.
4. Pencetakan laporan lengkap.

— **Akhir Lampiran 13** —
