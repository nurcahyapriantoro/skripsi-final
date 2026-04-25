# Reentrancy Research — Execution Walkthrough

## Project Summary

Complete implementation of the academic thesis PoC: **"Mitigation of Reentrancy Attacks on Supply Chain Smart Contracts Based on the Checks-Effects-Interactions Pattern"**

**Location:** `e:\Cahyo\SkripsiFinal\reentrancy-research\`

---

## Phase 1: Environment Setup ✅

- Node.js v22.10.0, Python 3.11.5, Git 2.41.0 verified
- Hardhat ^2.22.0 + toolbox, OpenZeppelin ^5.0.0, gas reporter, solhint installed
- Full directory structure created per MasterMind.md spec
- `hardhat.config.js` configured with Solidity 0.8.28, optimizer enabled (200 runs)

---

## Phase 2: Vulnerable Contract ✅

[InsecureVault.sol](file:///e:/Cahyo/SkripsiFinal/reentrancy-research/contracts/vulnerable/InsecureVault.sol) — Deliberately follows **Interactions-before-Effects** anti-pattern in `withdrawFunds()`.

---

## Phase 3: Attacker Simulation ✅

[Attacker.sol](file:///e:/Cahyo/SkripsiFinal/reentrancy-research/contracts/attacker/Attacker.sol) — Exploits InsecureVault via recursive `receive()` calls.

> [!NOTE]
> Fix applied: Solidity doesn't allow nested `interface` declarations inside contracts.
> Moved `IVault` interface to file-level scope. Also increased `MAX_REENTRIES` from 10 to 30 to ensure full drainage of the 2.4 ETH vault.

### Attack Results (11 tests passing)

| Metric | Value |
|--------|-------|
| Reentrancy iterations | 24 |
| Attacker initial deposit | 0.1 ETH |
| Attacker final balance | 2.4 ETH |
| Illegal profit | **2.3 ETH** |
| Contract final balance | **0 ETH** (fully drained) |
| Buyer A loss | 1.5 ETH |
| Buyer B loss | 0.8 ETH |

---

## Phase 4: CEI Mitigation ✅

### SecureVault (CEI Pattern)
[SecureVault.sol](file:///e:/Cahyo/SkripsiFinal/reentrancy-research/contracts/secure/SecureVault.sol) — Zeroes `balances[msg.sender]` **before** the external `.call{value}()`. No external libraries.

### MutexVault (ReentrancyGuard)
[MutexVault.sol](file:///e:/Cahyo/SkripsiFinal/reentrancy-research/contracts/secure/MutexVault.sol) — Uses OpenZeppelin's `nonReentrant` modifier. Deliberately keeps Interactions-before-Effects order to isolate the mutex overhead.

---

## Phase 5: Testing & Validation ✅

### Full Test Suite: **22 passing**

| Test File | Tests | Status |
|-----------|-------|--------|
| 01_exploit_insecure.test.js | 11 | ✅ All pass |
| 02_mitigate_secure.test.js | 4 | ✅ All pass |
| 03_mitigate_mutex.test.js | 3 | ✅ All pass |
| 04_gas_benchmark.test.js | 1 | ✅ Pass |
| 05_legitimate_users.test.js | 3 | ✅ All pass |

### Gas Benchmark Results (30 iterations each)

| Metric | CEI (SecureVault) | Mutex (MutexVault) | Difference |
|--------|-------------------|--------------------|-----------:|
| **Gas Used** | 29,950 | 32,363 | **-2,413 (-7.46%)** |
| **SSTORE count** | 1 | 3 | **-2 (-66.67%)** |
| **SLOAD count** | 1 | 2 | **-1 (-50.00%)** |

### Statistical Analysis

All three metrics: **H0 REJECTED** — CEI is deterministically more gas-efficient than Mutex.

The results are deterministic (zero variance across 30 iterations) because Hardhat resets to identical state each time. This is expected and actually strengthens the finding — the gas difference is structural, not stochastic.

---

## Generated Data Files

| File | Purpose |
|------|---------|
| [gas_data_cei.csv](file:///e:/Cahyo/SkripsiFinal/reentrancy-research/analysis/results/gas_data_cei.csv) | 30-iteration gas data for SecureVault |
| [gas_data_mutex.csv](file:///e:/Cahyo/SkripsiFinal/reentrancy-research/analysis/results/gas_data_mutex.csv) | 30-iteration gas data for MutexVault |
| [opcode_data_cei.csv](file:///e:/Cahyo/SkripsiFinal/reentrancy-research/analysis/results/opcode_data_cei.csv) | SSTORE/SLOAD counts for SecureVault |
| [opcode_data_mutex.csv](file:///e:/Cahyo/SkripsiFinal/reentrancy-research/analysis/results/opcode_data_mutex.csv) | SSTORE/SLOAD counts for MutexVault |
| [statistical_report.txt](file:///e:/Cahyo/SkripsiFinal/reentrancy-research/analysis/results/statistical_report.txt) | Full statistical analysis report |
| [gas_comparison_plot.png](file:///e:/Cahyo/SkripsiFinal/reentrancy-research/analysis/results/gas_comparison_plot.png) | Box plot visualization |
| [gas_report.txt](file:///e:/Cahyo/SkripsiFinal/reentrancy-research/analysis/results/gas_report.txt) | Hardhat gas reporter output |

---

## Bugs Fixed During Execution

1. **Nested interface in Attacker.sol** — Solidity doesn't support `interface` inside `contract`. Moved `IVault` to file-level scope.
2. **MAX_REENTRIES too low** — Original value of 10 only drained 1.0/2.4 ETH. Increased to 30 to ensure full drainage.
3. **Test assertion in 02_mitigate_secure** — After a reverted attack, the attacker's vault balance stays at 0.1 ETH (revert undoes everything). Fixed assertion to check attacker contract ETH == 0 and vault balance == 0.1 ETH.
4. **Unicode encoding on Windows** — Python's `print()` and `open()` failed with CP-1252 on Windows. Fixed by using ASCII-safe characters and UTF-8 encoding for file writes.

---

## Research Success Criteria (from MasterMind.md §1.4)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| InsecureVault is successfully exploited | ✅ MET | 2.4 ETH drained via 24 recursive re-entries |
| SecureVault (CEI) rejects exploit & preserves integrity | ✅ MET | Attack reverts, 2.4 ETH preserved, legitimate withdrawals work |
| CEI is significantly more gas-efficient than mutex | ✅ MET | 29,950 vs 32,363 gas (-7.46%), 1 vs 3 SSTORE, 1 vs 2 SLOAD |
