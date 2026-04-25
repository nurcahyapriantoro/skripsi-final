# Mitigasi Serangan Reentrancy pada Smart Contract Rantai Pasok Berbasis Pola Checks-Effects-Interactions

> **Mitigation of Reentrancy Attacks on Supply Chain Smart Contracts Based on the Checks-Effects-Interactions Pattern**

[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-blue)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.28.6-yellow)](https://hardhat.org/)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-5.6.1-green)](https://www.openzeppelin.com/)
[![Tests](https://img.shields.io/badge/Tests-22%20passing-brightgreen)]()
[![License](https://img.shields.io/badge/License-MIT-lightgrey)]()

---

## 📋 Informasi Penelitian

| Atribut | Detail |
|---------|--------|
| **Peneliti** | Nurcahya Priantoro |
| **NIM** | G6401221049 |
| **Program Studi** | S1 Ilmu Komputer |
| **Institusi** | Institut Pertanian Bogor (IPB University) |
| **Dosen Pembimbing** | Dr. Shelvie Nidya Neyman, S.Kom, M.Si |
| **Judul Skripsi** | Mitigasi Serangan Reentrancy pada Smart Contract Rantai Pasok Berbasis Pola Checks-Effects-Interactions |

---

## 📖 Abstrak

Penelitian ini mengimplementasikan Proof-of-Concept (PoC) untuk menganalisis dan memitigasi serangan reentrancy pada smart contract escrow rantai pasok di jaringan Ethereum. Tiga varian smart contract dikembangkan:

1. **InsecureVault** — Kontrak baseline yang sengaja rentan terhadap reentrancy (Interactions-before-Effects anti-pattern)
2. **SecureVault** — Kontrak yang diamankan menggunakan pola **Checks-Effects-Interactions (CEI)** secara manual
3. **MutexVault** — Kontrak yang diamankan menggunakan **ReentrancyGuard mutex lock** dari OpenZeppelin

Eksperimen membuktikan bahwa:
- Serangan reentrancy berhasil mengeksploitasi InsecureVault → **2.3 ETH kerugian** (100% dana victim terdrain)
- Pola CEI **berhasil memblokir serangan** tanpa dependensi library eksternal
- CEI **7.46% lebih hemat gas** dibandingkan mutex lock (29,950 vs 32,363 gas per withdrawal)
- Perbedaan gas bersifat **deterministik dan struktural** — dibuktikan dengan analisis opcode level EVM

---

## 🎯 Research Questions (RQ)

| # | Research Question | Status |
|---|-------------------|--------|
| **RQ1** | Bagaimana mekanisme serangan reentrancy mengeksploitasi smart contract rantai pasok yang menggunakan pola Interactions-before-Effects? | ✅ **Terjawab** |
| **RQ2** | Apakah pola Checks-Effects-Interactions (CEI) efektif memitigasi serangan reentrancy pada smart contract rantai pasok? | ✅ **Terjawab** |
| **RQ3** | Bagaimana perbandingan efisiensi gas antara mitigasi CEI dengan ReentrancyGuard (mutex lock)? | ✅ **Terjawab** |

---

## 🔬 Hipotesis Penelitian

```
H₀: μ_CEI ≥ μ_Mutex  (Tidak ada perbedaan signifikan, atau CEI lebih tinggi)
H₁: μ_CEI < μ_Mutex  (CEI memiliki gas consumption yang signifikan lebih rendah)
α = 0.05 (one-tailed test)
```

**Hasil:** H₀ **DITOLAK** — H₁ **DIDUKUNG** dengan p = 0.000000 dan Cohen's d = ∞ (efek deterministik).

---

## 🏗️ Arsitektur Proyek

```
reentrancy-research/
├── contracts/                          # Smart Contracts (Solidity 0.8.28)
│   ├── vulnerable/
│   │   └── InsecureVault.sol           # Kontrak rentan (kontrol baseline)
│   ├── secure/
│   │   ├── SecureVault.sol             # Mitigasi CEI (variabel independen utama)
│   │   └── MutexVault.sol             # Mitigasi Mutex Lock (pembanding)
│   └── attacker/
│       └── Attacker.sol                # Kontrak penyerang (simulasi threat model)
│
├── test/                               # Test Suite (JavaScript, Chai + Ethers.js)
│   ├── 01_exploit_insecure.test.js     # Eksperimen 1: Eksploitasi InsecureVault (11 tests)
│   ├── 02_mitigate_secure.test.js      # Eksperimen 2: Validasi CEI SecureVault (4 tests)
│   ├── 03_mitigate_mutex.test.js       # Eksperimen 3: Validasi Mutex MutexVault (3 tests)
│   ├── 04_gas_benchmark.test.js        # Gas Benchmark: Sanity check CEI ≤ Mutex (1 test)
│   └── 05_legitimate_users.test.js     # Liveness Test: Withdrawal legitimate (3 tests)
│
├── analysis/                           # Analisis Data & Statistik
│   ├── collect_gas_data.js             # Pengumpul data gas (30 iterasi per kontrak)
│   ├── opcode_trace.js                 # Trace SSTORE/SLOAD via debug_traceTransaction
│   ├── statistical_analysis.py         # Pipeline statistik (Shapiro-Wilk → t-test/Mann-Whitney)
│   └── results/                        # Hasil Analisis
│       ├── gas_data_cei.csv            # Data gas 30 iterasi SecureVault
│       ├── gas_data_mutex.csv          # Data gas 30 iterasi MutexVault
│       ├── opcode_data_cei.csv         # Data opcode 30 iterasi SecureVault
│       ├── opcode_data_mutex.csv       # Data opcode 30 iterasi MutexVault
│       ├── statistical_report.txt      # Laporan statistik lengkap
│       ├── gas_report.txt              # Hardhat Gas Reporter output
│       ├── gas_comparison_plot.png     # Visualisasi box plot perbandingan
│       └── walkthrough.md             # Walkthrough eksekusi penelitian
│
├── scripts/
│   └── deploy_local.js                 # Script deployment lokal (opsional)
│
├── slither/                            # Static Analysis (Slither)
│   ├── run_slither.sh                  # Script runner Slither
│   ├── insecure_vault_report.json      # Report Slither InsecureVault
│   ├── secure_vault_report.json        # Report Slither SecureVault
│   └── mutex_vault_report.json         # Report Slither MutexVault
│
├── hardhat.config.js                   # Konfigurasi Hardhat (Solidity 0.8.28, optimizer 200 runs)
├── package.json                        # Dependencies proyek
├── .solhint.json                       # Solhint linting rules
└── .gitignore                          # Git ignore rules
```

---

## ⚙️ Technology Stack

| Komponen | Teknologi | Versi | Keterangan |
|----------|-----------|-------|------------|
| **Bahasa Smart Contract** | Solidity | 0.8.28 | Dengan optimizer enabled (200 runs) |
| **Framework Development** | Hardhat | ^2.28.6 | Ethereum development environment |
| **Testing Framework** | Chai + Mocha | (via Hardhat Toolbox) | Assertion library & test runner |
| **Ethereum Library** | Ethers.js | v6 (via Hardhat Toolbox) | Interaksi blockchain |
| **Security Library** | OpenZeppelin Contracts | ^5.6.1 | ReentrancyGuard (MutexVault) |
| **Static Analysis** | Slither | Latest | Deteksi kerentanan otomatis |
| **Linting** | Solhint | ^4.5.4 | Code quality enforcement |
| **Gas Reporter** | hardhat-gas-reporter | ^1.0.10 | Gas consumption tracking |
| **Statistik** | Python (scipy, pandas, matplotlib) | 3.11+ | Analisis statistik & visualisasi |
| **Runtime** | Node.js | 22.10.0 | JavaScript runtime |

---

## 🚀 Quick Start

### Prerequisites

```bash
# Required
Node.js >= 18.0.0
Python >= 3.10 (untuk statistical analysis)
Git
```

### Installation

```bash
# Clone repository
git clone <repository-url>
cd reentrancy-research

# Install Node.js dependencies
npm install

# Compile smart contracts
npm run compile
```

### Running Tests

```bash
# Run all 22 tests (5 test suites)
npm test

# Run specific test suite
npx hardhat test test/01_exploit_insecure.test.js
npx hardhat test test/02_mitigate_secure.test.js
npx hardhat test test/03_mitigate_mutex.test.js
npx hardhat test test/04_gas_benchmark.test.js
npx hardhat test test/05_legitimate_users.test.js
```

### Running Gas Benchmark (30 Iterations)

```bash
# Step 1: Collect gas data
npx hardhat run analysis/collect_gas_data.js

# Step 2: Collect opcode trace data
npx hardhat run analysis/opcode_trace.js

# Step 3: Run statistical analysis
pip install pandas scipy matplotlib
python analysis/statistical_analysis.py
```

### Running Static Analysis (Slither)

```bash
# Requires Slither installed: pip install slither-analyzer
cd slither && ./run_slither.sh
```

### Linting

```bash
npm run lint
```

---

## 📊 Hasil Eksperimen

### Eksperimen 1: Eksploitasi Reentrancy (InsecureVault)

| Metrik | Nilai |
|--------|-------|
| **Iterasi reentrancy** | 24 kali (recursive re-entry) |
| **Deposit awal attacker** | 0.1 ETH (legitimate entry) |
| **Saldo akhir attacker** | 2.4 ETH |
| **Keuntungan ilegal** | **2.3 ETH** (2,300% ROI) |
| **Saldo akhir kontrak** | **0 ETH** (fully drained) |
| **Kerugian Buyer A** | 1.5 ETH |
| **Kerugian Buyer B** | 0.8 ETH |
| **Total kerugian victim** | **2.3 ETH** |

> **Kesimpulan RQ1:** Pola Interactions-before-Effects memungkinkan attacker mengeksploitasi fungsi `withdrawFunds()` secara rekursif melalui fallback function `receive()`, mengakibatkan drainage total dana escrow.

### Eksperimen 2: Validasi Mitigasi CEI (SecureVault)

| Metrik | Hasil |
|--------|-------|
| **Serangan berhasil?** | ❌ **TIDAK** — Transaksi serangan **REVERT** |
| **Dana victim terpreservasi?** | ✅ **YA** — 2.4 ETH tetap aman |
| **Keuntungan ilegal attacker** | **0 ETH** |
| **Legitimate withdrawal bekerja?** | ✅ **YA** — Seller berhasil withdraw |
| **Double-withdrawal dicegah?** | ✅ **YA** — Transaksi kedua revert |

> **Kesimpulan RQ2:** Pola CEI efektif memitigasi serangan reentrancy dengan me-zero-kan `balances[msg.sender]` sebelum external call. Re-entrant call gagal di `require(amount > 0)`.

### Eksperimen 3: Validasi Mitigasi Mutex (MutexVault)

| Metrik | Hasil |
|--------|-------|
| **Serangan berhasil?** | ❌ **TIDAK** — Transaksi serangan **REVERT** |
| **Dana victim terpreservasi?** | ✅ **YA** — 2.4 ETH tetap aman |
| **Keuntungan ilegal attacker** | **0 ETH** |

> **Kesimpulan:** MutexVault juga efektif memblokir reentrancy, memvalidasi bahwa kedua teknik mitigasi setara dari sisi keamanan.

### Eksperimen 4: Perbandingan Efisiensi Gas (30 Iterasi)

| Metrik | CEI (SecureVault) | Mutex (MutexVault) | Selisih |
|--------|:-----------------:|:------------------:|--------:|
| **Gas Used** | 29,950 | 32,363 | **-2,413 (-7.46%)** |
| **SSTORE Count** | 1 | 3 | **-2 (-66.67%)** |
| **SLOAD Count** | 1 | 2 | **-1 (-50.00%)** |
| **Total Opcodes** | 132 | 165 | **-33 (-20.00%)** |

### Analisis Statistik

| Parameter | Nilai |
|-----------|-------|
| **Sample size** | 30 iterasi per grup |
| **Signifikansi (α)** | 0.05 |
| **Arah test** | One-tailed (H₁: μ_CEI < μ_Mutex) |
| **Varians** | 0 (deterministik, zero variance) |
| **Metode** | Deterministic comparison (karena zero variance) |
| **p-value** | 0.000000 |
| **Cohen's d** | ∞ (efek deterministik) |
| **Keputusan** | **H₀ DITOLAK** — H₁ DIDUKUNG |

> **Kesimpulan RQ3:** CEI secara deterministik lebih efisien gas dibandingkan mutex lock karena tidak memerlukan state variable tambahan (`_status`). Mutex lock membutuhkan 2 SSTORE + 1 SLOAD tambahan per pemanggilan `withdrawFunds()`.

### Penjelasan Zero Variance

Data menunjukkan zero variance (std = 0) pada semua 30 iterasi karena Hardhat Network di-reset ke state identik setiap iterasi. Ini **bukan kelemahan** — justru memperkuat temuan bahwa perbedaan gas bersifat **struktural di level EVM opcode**, bukan stokastik. Setiap execution path menghasilkan opcode sequence yang identik karena:

1. Contract bytecode identik (optimizer settings tetap)
2. State layout identik (reset antar iterasi)
3. Gas schedule EVM deterministik (fixed cost per opcode)

---

## 🔒 Detail Keamanan Smart Contract

### Mekanisme Serangan (Threat Model)

```
┌──────────────────────────────────────────────────────────────────┐
│                    REENTRANCY ATTACK FLOW                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Attacker registers as legitimate seller (0.1 ETH)            │
│  2. Buyer confirms delivery → balance becomes withdrawable       │
│  3. Attacker calls attack()                                      │
│     └→ InsecureVault.withdrawFunds()                             │
│        ├─ CHECK:  balances[attacker] > 0 → ✅ PASS (0.1 ETH)    │
│        ├─ INTERACT: .call{value: 0.1 ETH}("") → Attacker        │
│        │  └→ receive() triggered                                 │
│        │     └→ InsecureVault.withdrawFunds() [RE-ENTRY]         │
│        │        ├─ CHECK: balances[attacker] > 0 → ✅ STILL 0.1  │
│        │        ├─ INTERACT: .call{value: 0.1}("") → Attacker   │
│        │        │  └→ receive() → ... (recursive until drained)  │
│        │        └─ EFFECT: balances[attacker] = 0 (TOO LATE)     │
│        └─ EFFECT: balances[attacker] = 0 (TOO LATE)              │
│                                                                  │
│  Result: 24 recursive withdrawals → 2.4 ETH drained             │
└──────────────────────────────────────────────────────────────────┘
```

### Mekanisme Pertahanan CEI (SecureVault)

```
withdrawFunds() {
    // 1. CHECKS — Validasi
    uint256 amount = balances[msg.sender];
    require(amount > 0);

    // 2. EFFECTS — Update state SEBELUM external call
    balances[msg.sender] = 0;  // ← State sudah di-update

    // 3. INTERACTIONS — External call SETELAH state update
    msg.sender.call{value: amount}("");
    // ↑ Jika receive() re-enter, CHECK di atas akan FAIL
    //   karena balances[msg.sender] sudah = 0
}
```

### Mekanisme Pertahanan Mutex (MutexVault)

```
withdrawFunds() nonReentrant {  // ← modifier sets _status = ENTERED
    // Function body executes normally
    // If receive() tries to re-enter → _status == ENTERED → REVERT
}
// After function: _status = NOT_ENTERED (costs 2 SSTORE + 1 SLOAD)
```

---

## 📈 Visualisasi Hasil

Visualisasi perbandingan gas tersedia di:
- `analysis/results/gas_comparison_plot.png` — Box plot CEI vs Mutex (3 metrik)

---

## 🧪 Test Suite Detail

| # | File | Deskripsi | Jumlah Test |
|---|------|-----------|:-----------:|
| 1 | `01_exploit_insecure.test.js` | Membuktikan InsecureVault rentan terhadap reentrancy: setup honeypot 2.4 ETH, eksekusi serangan, validasi drainage, eksfiltrasi dana | **11** |
| 2 | `02_mitigate_secure.test.js` | Membuktikan SecureVault (CEI) memblokir serangan: attack revert, no illegal profit, victim funds preserved | **4** |
| 3 | `03_mitigate_mutex.test.js` | Membuktikan MutexVault juga memblokir serangan: attack revert, victim funds preserved | **3** |
| 4 | `04_gas_benchmark.test.js` | Sanity check: single-iteration gas comparison CEI ≤ Mutex | **1** |
| 5 | `05_legitimate_users.test.js` | Liveness test: legitimate sellers dapat withdraw, double-withdraw dicegah | **3** |
| | **Total** | | **22** |

---

## 📂 Data Output Files

| File | Isi | Format |
|------|-----|--------|
| `gas_data_cei.csv` | Gas consumption SecureVault (30 iterasi) | CSV |
| `gas_data_mutex.csv` | Gas consumption MutexVault (30 iterasi) | CSV |
| `opcode_data_cei.csv` | SSTORE/SLOAD counts SecureVault (30 iterasi) | CSV |
| `opcode_data_mutex.csv` | SSTORE/SLOAD counts MutexVault (30 iterasi) | CSV |
| `statistical_report.txt` | Laporan statistik lengkap (Shapiro-Wilk, effect size) | TXT |
| `gas_report.txt` | Hardhat Gas Reporter output | TXT |
| `gas_comparison_plot.png` | Visualisasi box plot perbandingan | PNG |
| `insecure_vault_report.json` | Slither static analysis InsecureVault | JSON |
| `secure_vault_report.json` | Slither static analysis SecureVault | JSON |
| `mutex_vault_report.json` | Slither static analysis MutexVault | JSON |

---

## 🔄 Reproduksi Lengkap (End-to-End)

```bash
# 1. Setup environment
npm install
npm run compile

# 2. Jalankan semua test (verifikasi 22 passing)
npm test

# 3. Kumpulkan data gas (30 iterasi)
npx hardhat run analysis/collect_gas_data.js

# 4. Kumpulkan data opcode (30 iterasi)
npx hardhat run analysis/opcode_trace.js

# 5. Jalankan analisis statistik
python analysis/statistical_analysis.py

# 6. (Opsional) Static analysis
cd slither && ./run_slither.sh

# 7. Verifikasi output
# - analysis/results/statistical_report.txt → H₀ REJECTED
# - analysis/results/gas_comparison_plot.png → Box plot generated
# - 22 tests passing, CEI gas < Mutex gas
```

---

## 📝 Referensi Utama

1. Atzei, N., Bartoletti, M., & Cimoli, T. (2017). "A Survey of Attacks on Ethereum Smart Contracts"
2. OpenZeppelin. (2024). ReentrancyGuard — OpenZeppelin Contracts v5
3. Solidity Documentation. (2024). Security Considerations — Common Patterns
4. Ethereum Yellow Paper. Appendix G — Fee Schedule

---

## 📄 Lisensi

Penelitian ini dikembangkan untuk kepentingan akademik sebagai bagian dari tugas akhir (skripsi) di Institut Pertanian Bogor. Kode sumber dilisensikan di bawah MIT License.

---

**© 2026 Nurcahya Priantoro — Institut Pertanian Bogor**
