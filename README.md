# Mitigasi Serangan Reentrancy pada Smart Contract Rantai Pasok Berbasis Pola Checks-Effects-Interactions

> **Mitigation of Reentrancy Attacks on Supply Chain Smart Contracts Based on the Checks-Effects-Interactions Pattern**

[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-blue)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.28.6-yellow)](https://hardhat.org/)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-5.6.1-green)](https://www.openzeppelin.com/)
[![Tests](https://img.shields.io/badge/Tests-25%20passing-brightgreen)]()
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

### 🇮🇩 Bahasa Indonesia

Smart contract bersifat *immutable* sehingga celah keamanan tidak dapat diperbaiki setelah *deployment*. Penelitian ini menganalisis serangan reentrancy pada fungsi escrow rantai pasok dan mengevaluasi pola *checks-effects-interactions* (CEI) sebagai mitigasinya. Tiga varian kontrak, yaitu InsecureVault, SecureVault berbasis CEI, dan MutexVault berbasis *mutex lock*, diuji pada Hardhat Network dan Sepolia Testnet melalui 30 iterasi dengan analisis statis Slither. InsecureVault dikuras dari 2,4 ETH menjadi 0 ETH melalui 24 pemanggilan rekursif dengan keuntungan ilegal 2,3 ETH. SecureVault menggagalkan seluruh serangan tanpa pustaka eksternal dan mempertahankan *liveness* bagi pengguna sah. Pola CEI mengonsumsi 29.950 gas per transaksi, lebih hemat 2.413 gas (7,46%) dibanding *mutex lock* sebesar 32.363 gas akibat dua operasi tulis dan satu operasi baca tambahan yang dijalankan mekanisme *mutex* setiap transaksi. Penelitian ini juga mengembangkan prototipe *AI-Assisted CEI Pattern Analyzer Tools* sebagai pelengkap analisis statis berbasis semantik LLM.

**Kata kunci:** blockchain, escrow rantai pasok, pola *checks-effects-interactions*, serangan reentrancy, smart contract

### 🇬🇧 English Abstract

Smart contracts are *immutable* once deployed, making security flaws impossible to patch after going live. This research analyzes reentrancy attacks in supply chain escrow functions and evaluates the *checks-effects-interactions* (CEI) pattern as a mitigation method. Three variants — InsecureVault, SecureVault (CEI), and MutexVault (*mutex lock*) — were tested on Hardhat Network and Sepolia Testnet through 30 iterations using Slither. InsecureVault was fully drained from 2.4 ETH to 0 ETH through 24 recursive calls, yielding 2.3 ETH in illegal profit. SecureVault blocked all attacks without external libraries while preserving *liveness* for legitimate users. The CEI pattern consumed 29,950 gas per withdrawal, saving 2,413 gas (7.46%) over the *mutex lock* at 32,363 gas due to two additional write and one read storage operations per transaction. An *AI-Assisted CEI Pattern Analyzer Tools* prototype was also developed as a semantic LLM-based complement to static analysis.

**Keywords:** blockchain, *checks-effects-interactions* pattern, reentrancy attack, smart contract, supply chain escrow

---

## 🎯 Research Questions (RQ)

| # | Research Question | Status |
|---|-------------------|--------|
| **RQ1** | Bagaimana mekanisme serangan reentrancy mengeksploitasi smart contract rantai pasok yang menggunakan pola Interactions-before-Effects? | ✅ **Terjawab** |
| **RQ2** | Apakah pola Checks-Effects-Interactions (CEI) efektif memitigasi serangan reentrancy pada smart contract rantai pasok? | ✅ **Terjawab** |
| **RQ3** | Bagaimana perbandingan efisiensi gas antara mitigasi CEI dengan ReentrancyGuard (mutex lock)? | ✅ **Terjawab** |

---

## 🔬 Hipotesis Penelitian

Berdasarkan kajian literatur dan tujuan penelitian, hipotesis yang diajukan adalah sebagai berikut.

> **H₀:** Tidak terdapat perbedaan konsumsi gas antara smart contract yang menerapkan pola *checks-effects-interactions* (CEI) dan smart contract yang menggunakan mekanisme *mutex lock*.
>
> **H₁:** Smart contract yang menerapkan pola *checks-effects-interactions* (CEI) memiliki konsumsi gas yang lebih rendah dibandingkan smart contract yang menggunakan mekanisme *mutex lock*.

**Metode Pengujian:** Analisis Komparatif Deterministik — pengukuran selisih efisiensi secara struktural berdasarkan selisih gas antar-algoritma pengamanan (Azimi et al. 2025). Sifat deterministik Hardhat Network (varians = 0) membuat uji statistik inferensial tidak relevan.

**Hasil:** H₀ **DITOLAK** — H₁ **DIDUKUNG** dengan selisih deterministik sebesar **2.413 gas (7,46%)** per transaksi penarikan dana.

---

## 🏗️ Arsitektur Proyek

```
reentrancy-research/
├── contracts/                          # Smart Contracts (Solidity 0.8.28)
│   ├── vulnerable/
│   │   └── InsecureVault.sol           # Kontrak rentan (kontrol baseline)
│   ├── secure/
│   │   ├── SecureVault.sol             # Mitigasi CEI (variabel independen utama)
│   │   └── MutexVault.sol              # Mitigasi Mutex Lock (pembanding)
│   └── attacker/
│       └── Attacker.sol                # Kontrak penyerang (simulasi threat model)
│
├── test/                               # Test Suite (JavaScript, Chai + Ethers.js)
│   ├── 01_exploit_insecure.test.js     # Eksperimen 1: Eksploitasi InsecureVault (11 tests)
│   ├── 02_mitigate_secure.test.js      # Eksperimen 2: Validasi CEI SecureVault (4 tests)
│   ├── 03_mitigate_mutex.test.js       # Eksperimen 3: Validasi Mutex MutexVault (3 tests)
│   ├── 04_gas_benchmark.test.js        # Gas Benchmark Komprehensif (4 tests)
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
│       └── gas_comparison_plot.png     # Visualisasi box plot perbandingan
│
├── scripts/                            # Skrip deployment & eksploitasi
│   ├── deploy_local.js                 # Deployment Hardhat local
│   ├── deploy_testnet.js               # Deployment ke Sepolia
│   ├── run_attack_testnet.js           # Eksekusi serangan di Sepolia
│   ├── cei_test_sepolia.js             # Test CEI di Sepolia
│   └── sepolia_*.js                    # 8 skrip skenario Sepolia (full_test, attack_only, dll.)
│
├── grafik_atau_diagram/                # Visualisasi pendukung bab 4
│   ├── *.py                            # 6 skrip matplotlib (deployment, escrow cycle, stabilitas)
│   └── *.png                           # 8 grafik hasil render
│
├── image-progress/                     # Bukti dokumentasi deployment
│   └── sepolia.jpg                     # Screenshot deployment Sepolia testnet
│
├── cei-analyzer/                       # Frontend CEI Pattern Analyzer (AI Tool)
│   ├── src/                            # App.jsx, main.jsx, translations.js (i18n)
│   ├── functions/                      # (Legacy) Firebase Cloud Functions proxy DeepSeek
│   ├── output_analisis/                # JSON hasil analisis 3 vault
│   ├── public/, dist/                  # Build assets
│   ├── Dockerfile, nginx.conf          # Container config
│   └── firebase.json                   # Hosting & deploy config
│
├── cei-analyzer-api/                   # Vercel Serverless proxy (pengganti Firebase Functions)
│   └── api/analyze.js                  # Endpoint POST /api/analyze (DeepSeek API key aman)
│
├── slither/                            # Static Analysis (Slither)
│   ├── run_slither.sh                  # Runner Slither (Linux/macOS)
│   ├── run_slither.ps1                 # Runner Slither (Windows PowerShell)
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
| **Frontend Framework** | React + Vite | 19.2.6 / 8.x | UI CEI Pattern Analyzer (HMR, ESLint) |
| **CSS Framework** | Tailwind CSS | ^3.4.19 | Utility-first styling |
| **Charting Library** | Recharts | ^3.8.1 | Visualisasi hasil analisis AI |
| **Hosting (Frontend)** | Firebase Hosting | (latest) | Static hosting untuk CEI Analyzer |
| **Serverless API** | Vercel Functions | Node 24 / ESM | Secure proxy DeepSeek API |
| **LLM Provider** | DeepSeek API | (latest) | Klasifikasi otomatis CEI lines |

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
cd slither && ./run_slither.sh          # Linux/macOS
cd slither && ./run_slither.ps1         # Windows PowerShell
```

### Linting

```bash
npm run lint
```

### Menjalankan CEI Pattern Analyzer (AI Tool)

CEI Analyzer adalah aplikasi web terpisah yang menggunakan LLM untuk mengklasifikasikan baris kode Solidity ke dalam kategori CHECKS / EFFECTS / INTERACTIONS secara otomatis.

```bash
# Terminal 1 — Frontend (React + Vite)
cd cei-analyzer
npm install
npm run dev                            # http://localhost:5173

# Terminal 2 — Backend API (Vercel Functions, secure proxy DeepSeek)
cd cei-analyzer-api
npm install -g vercel                  # jika belum terpasang
vercel dev                             # http://localhost:3000/api/analyze

# Set environment variable untuk backend:
# DEEPSEEK_API_KEY=sk-xxx  (di Vercel dashboard atau .env lokal)
```

**Alur request:**
```
React App (Firebase) ──POST /api/analyze──► Vercel Function ──► DeepSeek API
                                          (key aman di server-side)
```

> **Catatan keamanan**: API key DeepSeek **tidak pernah** terekspos di browser bundle karena request diproxy melalui Vercel Function server-side.

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

### 📊 Visualisasi Pendukung (Bab 4)

Folder [`grafik_atau_diagram/`](grafik_atau_diagram/) memuat grafik tambahan yang dihasilkan dari 6 skrip Python (matplotlib) untuk memperkaya pembahasan di bab 4 skripsi:

| File PNG | Keterangan | Cross-ref Skripsi |
|----------|------------|-------------------|
| `grafik_deployment_bab4.png` | Perbandingan biaya deployment 3 vault | Bab 4.4.1 |
| `grafik_biaya_deployment_skripsi.png` | Biaya deployment dalam USD | Bab 4.4.1 |
| `grafik_siklus_escrow_lengkap_rapi.png` | Siklus escrow lengkap (create → deposit → confirm → withdraw) | Bab 4.2 |
| `grafik_siklus_escrow_lengkap.png` | Versi awal siklus escrow | Bab 4.2 |
| `grafik_stabilitas_30_iterasi.png` | Stabilitas gas selama 30 iterasi (variance check) | Bab 4.4.3 |
| `grafik_stabilitas_dengan_selisih.png` | Stabilitas dengan garis selisih CEI vs Mutex | Bab 4.4.3 |
| `grafik_gas_skripsi_revisi.png` | Revisi grafik gas per fungsi | Bab 4.4.2 |
| `perbandingan_gas_skripsi.png` | Perbandingan gas komprehensif | Bab 4.4.2 |

| File Python | Fungsi |
|-------------|--------|
| `grafik_gas_deployment.py` | Render grafik biaya deployment |
| `gambar5grafik_perbandingan_gas_cost.py` | Render perbandingan gas cost |
| `grafik_gas_cost_siklus_escrow_lengkap.py` | Render grafik siklus escrow |
| `grafik_perbandingan_biaya_gas_operasional.py` | Render biaya operasional |

> Untuk regenerasi grafik, jalankan skrip Python dari folder `grafik_atau_diagram/`. Setiap skrip bersifat self-contained dan menghasilkan PNG dengan nama file tertentu.

---

## 🧪 Test Suite Detail

| # | File | Deskripsi | Jumlah Test |
|---|------|-----------|:-----------:|
| 1 | `01_exploit_insecure.test.js` | Membuktikan InsecureVault rentan terhadap reentrancy: setup honeypot 2.4 ETH, eksekusi serangan, validasi drainage, eksfiltrasi dana | **11** |
| 2 | `02_mitigate_secure.test.js` | Membuktikan SecureVault (CEI) memblokir serangan: attack revert, no illegal profit, victim funds preserved | **4** |
| 3 | `03_mitigate_mutex.test.js` | Membuktikan MutexVault juga memblokir serangan: attack revert, victim funds preserved | **3** |
| 4 | `04_gas_benchmark.test.js` | Gas benchmark komprehensif: deployment cost, full flow, deposit variation (0.1/1/5/10 ETH), attack demo | **4** |
| 5 | `05_legitimate_users.test.js` | Liveness test: legitimate sellers dapat withdraw, double-withdraw dicegah | **3** |
| | **Total** | | **25** |

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

## 📑 Daftar Lampiran Skripsi (Lampiran 1–17)

Lampiran 1–17 (kode program, output Slither, konfigurasi, data gas, dan diagram) **terdistribusi bersama naskah skripsi fisik**. Lampiran 1–8 berupa cuplikan kode yang disisipkan di bab 3.3; Lampiran 9–17 berupa tabel, listing, dan bukti dokumentasi yang dicetak di akhir naskah.

> ℹ️ Lampiran 9–17 versi Markdown tidak disertakan dalam repository ini untuk menjaga ukuran repo. Lampiran lengkap tersedia dalam naskah skripsi cetakan yang diserahkan ke panitia.

---

## 📚 Temuan Kunci Skripsi (Hasil Eksperimen)

Ringkasan data kuantitatif dari bab 4 skripsi. Semua angka di bawah ini adalah hasil pengukuran aktual, bukan estimasi.

### Tabel 1 — Posisi Penelitian terhadap Literatur Terkait

Penelitian ini adalah satu-satunya yang menggabungkan ketujuh aspek berikut secara bersamaan:

| Penelitian | CEI vs Mutex | Gas Cost Analysis | Analisis Opcode | Domain Rantai Pasok | Validasi On-chain | Analisis Statistik | Dampak Ekonomi Lokal |
|---|---|---|---|---|---|---|---|
| Rodler et al. 2019 | | | | ✓ | | | |
| Alkhalifah et al. 2021 | ✓ | | | ✓ | | | |
| He et al. 2023 | ✓ | | ✓ | | | | |
| Callens et al. 2024 | ✓ | ✓ | | | | | |
| Feng et al. 2024 | | ✓ | ✓ | | | | |
| Azimi et al. 2025 | ✓ | | | | | | |
| Ghiyami Pour et al. 2025 | ✓ | | | | | | |
| Mallick dan Chebolu 2026 | | | | | | | ✓ |
| **Hasil Penelitian Ini** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** |

### Tabel 3 — Ringkasan Hasil Uji Kerentanan Slither

| Kontrak | Isu High | Isu Medium | Isu Low | Reentrancy Terdeteksi |
|---|---|---|---|---|
| **InsecureVault** | 1 | 0 | 1 | Ya (`reentrancy-eth`, high) |
| **SecureVault (CEI)** | 0 | 0 | 0 | Tidak terdeteksi |
| **MutexVault** | 1* | 0 | 0 | Positif palsu (OpenZeppelin) |

*Peringatan high pada MutexVault adalah **false positive** — diamankan `modifier nonReentrant` sehingga tidak dapat dieksploitasi.

### Tabel 5 — Eksploitasi InsecureVault: Hardhat Lokal vs Sepolia Testnet

| Metrik | Hardhat Lokal | Sepolia Testnet | Status |
|---|---|---|---|
| Saldo kontrak awal | 2,4 ETH | 2,4 ETH | Identik |
| Saldo kontrak akhir | 0,0 ETH | 0,0 ETH | Identik |
| Saldo akhir penyerang | 2,4 ETH | 2,4 ETH | Identik |
| Jumlah iterasi reentrancy | 24 | 24 | Identik |
| Keuntungan ilegal penyerang | 2,3 ETH | 2,3 ETH | Identik |
| **Gas dikonsumsi** | **181.015 gas** | **336.027 gas** | Berbeda |
| Biaya transaksi on-chain | — | 0,000383 ETH (1,14 gwei) | — |
| Dana Pembeli A | Hilang 1,5 ETH | Hilang 1,5 ETH | Identik |
| Dana Pembeli B | Hilang 0,8 ETH | Hilang 0,8 ETH | Identik |

### Tabel 8 — Perbandingan Kualitatif CEI vs Mutex Lock

| Aspek | Pola CEI (SecureVault) | Mutex Lock (MutexVault) |
|---|---|---|
| Mekanisme utama | Perubahan urutan logika | Penanda status mutex (`nonReentrant`) |
| Dependensi eksternal | Tidak ada (*zero dependency*) | Pustaka OpenZeppelin |
| Perlindungan cross-function | Ya (saldo diperbarui terlebih dahulu) | Hanya fungsi ber-modifier |
| Kemudahan audit | Mudah (urutan terlihat langsung) | Perlu periksa seluruh fungsi |
| Deteksi oleh Slither | 0 isu flag high | 1 isu flag high (positif palsu) |
| Efektivitas pencegahan | 100% serangan dicegah | 100% serangan dicegah |
| Liveness pengguna sah | Tidak terganggu | Tidak terganggu |

### Tabel 9 — Ringkasan Analisis Statistik Komparatif Biaya Gas

| Parameter | Nilai |
|---|---|
| Karakteristik komputasi | Deterministik (varians = 0) |
| Metode komparasi | Selisih berbasis instruksi mesin |
| Selisih efisiensi | **2.413 gas** per transaksi (7,46%) |
| Keputusan | **H₀ ditolak** berdasarkan analisis deterministik terhadap arsitektur kode |
| Kesimpulan | Pola CEI lebih efisien secara deterministik |

### Tabel 10 — Estimasi Penghematan Gas pada Skenario Rantai Pasok Indonesia

Asumsi: harga gas 20 gwei, ETH = US$2.126 (CoinMarketCap 22 Mei 2026), kurs Rp17.700/USD (BI 22 Mei 2026).

| Skenario | Sektor | Est. Tx/Tahun | Penghematan Gas/Tahun | Est. Penghematan/Tahun |
|---|---|---|---|---|
| E-Commerce (1% adopsi) | Ritel | 128.893.000 | 311 miliar | **Rp234 miliar** |
| Ekspor Kelapa Sawit (CPO) | Agrikultur | 1.149.000 | 2,77 miliar | Rp2,08 miliar |
| Ekspor Kopi | Pertanian | 316.721 | 764,5 juta | Rp575 juta |

### Tabel 11 — Perbandingan Slither vs AI-Assisted CEI Pattern Analyzer

| Aspek | Slither (Analisis Statis) | AI Analyzer (Semantik LLM) |
|---|---|---|
| Jenis analisis | *Rule-based*, pencocokan pola AST | Semantik berbasis large language model |
| **InsecureVault** | Terdeteksi (`reentrancy-eth`) | Skor: 20/100, CEI dilanggar |
| **SecureVault** | Bersih (0 isu flag high) | Skor: 100/100, CEI terpenuhi |
| **MutexVault** | False positive (dependensi OpenZeppelin) | CEI dilanggar, namun dilindungi `nonReentrant` |
| Penjelasan per baris | Tidak tersedia | Tersedia beserta rekomendasi perbaikan |
| Kecepatan analisis | <1 detik | 2–5 detik (pemanggilan API) |
| Keterbatasan false positive | Ada (dependensi eksternal) | Tidak ada (analisis semantik kontekstual) |
| Peran dalam penelitian | Verifikasi awal (*pre-deployment*) | Validasi semantik lanjutan |

### Rincian Gas Deployment & Total Siklus Escrow

| Fase | SecureVault (CEI) | MutexVault (Mutex) | Selisih |
|---|---|---|---|
| **Deployment** | 597.229 gas | 652.666 gas | **+55.437 gas** |
| **withdrawFunds (rata-rata 30 iterasi)** | 29.950 gas | 32.363 gas | **+2.413 gas** |
| **Total siklus escrow lengkap** | 847.373 gas | 905.223 gas | **+57.850 gas (+6,39%)** |

### Konfirmasi On-Chain Sepolia

- **Tanggal deploy:** 23 Mei 2026
- **Network:** Sepolia Testnet (Chain ID: 11155111)
- **Faucet:** https://faucets.pk910.de/ (Proof-of-Work)
- **Saldo uji total:** 3,57 Sepolia ETH
- **Seluruh alamat dan transaksi dapat diverifikasi publik via Sepolia Etherscan**

---

## 🤖 Appendix A: CEI Pattern Analyzer (AI Tool)

Selain eksperimen mitigasi utama, penelitian ini mengembangkan **CEI Pattern Analyzer** — aplikasi web berbasis LLM untuk mengklasifikasikan baris kode Solidity ke dalam kategori **CHECKS / EFFECTS / INTERACTIONS** secara otomatis, guna membantu auditor mendeteksi pelanggaran pola CEI.

### Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────────┐
│                CEI PATTERN ANALYZER — ARSITEKTUR                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────────────────┐         ┌──────────────────────────┐     │
│   │  React Frontend      │  HTTPS  │  Vercel Serverless       │     │
│   │  (Firebase Hosting)  │ ──────► │  /api/analyze            │     │
│   │  - App.jsx           │  POST   │  - Secure proxy          │     │
│   │  - Recharts          │         │  - API key di server     │     │
│   │  - i18n (ID/EN)      │         │  - DeepSeek integration  │     │
│   └──────────────────────┘         └────────────┬─────────────┘     │
│                                                 │                   │
│                                                 ▼                   │
│                                    ┌─────────────────────────┐       │
│                                    │  DeepSeek API           │       │
│                                    │  (LLM provider)         │       │
│                                    └─────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

### Stack Teknologi

| Komponen | Versi | Keterangan |
|----------|-------|------------|
| **Frontend** | React 19.2.6 + Vite 8 | HMR-enabled, ESLint, Tailwind CSS 3.4 |
| **Visualisasi** | Recharts 3.8.1 | Chart hasil analisis (bar/radar) |
| **i18n** | `translations.js` | Dukungan multi-bahasa (ID/EN) |
| **Hosting** | Firebase Hosting | Static SPA hosting |
| **Backend** | Vercel Serverless Functions | Node 24, ES Modules |
| **LLM** | DeepSeek API | JSON-formatted output |

### Alur Kerja Analisis

1. **Input**: Kode fungsi Solidity (di-paste di UI atau di-load dari file)
2. **POST request**: Frontend mengirim `{ code }` ke `/api/analyze`
3. **Server-side**: Vercel function menambahkan `DEEPSEEK_API_KEY` (env var), memanggil DeepSeek dengan **system prompt** khusus CEI auditor
4. **Output**: JSON terstruktur dengan field:

```json
{
  "function_name": "withdrawFunds",
  "is_vulnerable": true,
  "vulnerability_type": "reentrancy-eth",
  "security_score": 35,
  "cei_order_detected": ["CHECKS", "INTERACTIONS", "EFFECTS"],
  "expected_order": ["CHECKS", "EFFECTS", "INTERACTIONS"],
  "classified_lines": [
    { "line_number": 70, "code_snippet": "uint256 amount = balances[msg.sender];", "category": "CHECKS" },
    { "line_number": 74, "code_snippet": "msg.sender.call{value: amount}(\"\");", "category": "INTERACTIONS", "risk_note": "External call before state update" },
    { "line_number": 77, "code_snippet": "balances[msg.sender] = 0;", "category": "EFFECTS" }
  ],
  "violation_summary": "INTERACTIONS detected before EFFECTS — reentrancy vulnerability",
  "recommendation": "Reorder: set balances[msg.sender] = 0 BEFORE msg.sender.call(...)",
  "is_cei_compliant": false
}
```

5. **Visualisasi**: Frontend render Recharts chart (sequence bar, risk gauge) berdasarkan JSON

### Alamat Kontrak Sepolia (Bukti Deployment On-Chain)

Alamat berikut sesuai dengan **Lampiran 7** naskah skripsi (deploy tanggal 23 Mei 2026). Seluruh kontrak dan transaksi dapat diverifikasi publik via Sepolia Etherscan.

| Kontrak | Alamat | Explorer |
|---------|--------|----------|
| **InsecureVault** | `0xeC53E293f4072b57E8261C22EA53E26c54E51727` | [etherscan.io](https://sepolia.etherscan.io/address/0xeC53E293f4072b57E8261C22EA53E26c54E51727) |
| **SecureVault** | `0x4423bb421c8F482dAD0B73cf32D1f6F880F81680` | [etherscan.io](https://sepolia.etherscan.io/address/0x4423bb421c8F482dAD0B73cf32D1f6F880F81680) |
| **MutexVault** | `0xa5cf0e3f478d0e08b03702cafc4e36a1e8548788` | [etherscan.io](https://sepolia.etherscan.io/address/0xa5cf0e3f478d0e08b03702cafc4e36a1e8548788) |

**Bukti transaksi serangan on-chain:**

| Target Serangan | Tx Hash Etherscan |
|---|---|
| Attacker → InsecureVault | [0xc1ec44cb…b7a9bb3](https://sepolia.etherscan.io/tx/0xc1ec44cbbba0575331b7fae2db9204d05afa8563e874771cd934121dbb7a9bb3) |
| Attacker → SecureVault | [0x1ab563f1…dcfcaa065](https://sepolia.etherscan.io/tx/0x1ab563f1744219f7ca071d90b9867ce074ad05279039dc253236114dcfcaa065) |
| Attacker → MutexVault | [0xffd49250…f027fb20](https://sepolia.etherscan.io/tx/0xffd492504ade457ab9841eafce9663d6141846241f05d50846ddfbaaf027fb20) |

### Catatan Keamanan

- API key DeepSeek **tidak pernah** terekspos di browser bundle (frontend hanya mengirim kode Solidity)
- Proxy di Vercel menyembunyikan `DEEPSEEK_API_KEY` sepenuhnya di server-side environment variable
- Endpoint CORS dibatasi via header `Access-Control-Allow-Origin` di Vercel function

---

## 📝 Daftar Pustaka

Daftar pustaka berikut mengikuti format Vancouver, identik dengan **Daftar Pustaka** pada naskah skripsi (hal. 46–48).

### Bagian 1 — Referensi Inti Eksperimen (22 entri)

Literatur yang dikutip langsung dalam bab 3 (Metode) dan bab 4 (Hasil & Pembahasan):

1. Azimi S, Golzari A, Ivaki N, Laranjeiro N. 2025. A systematic review on smart contracts security design patterns. *Empir Softw Eng.* 30:95. doi:10.1007/s10664-025-10646-w.
2. Buterin V. 2014. A next-generation smart contract and decentralized application platform. [diakses 2026 Jan 10]. https://ethereum.org/en/whitepaper/.
3. Callens V, Meghji Z, Gorzny J. 2024. Temporarily restricting Solidity smart contract interactions. *Proceedings of the 2024 IEEE International Conference on Decentralized Applications and Infrastructures (DAPPS)*; 2024 Jul 15−18; Shanghai, Cina. New York (NY): IEEE. hlm 1−11. doi:10.48550/arXiv.2405.09084.
4. David I, Zhou L, Qin K, Song D, Cavallaro L, Gervais A. 2023. Do you still need a manual smart contract audit? arXiv:2306.12338. doi:10.48550/arXiv.2306.12338.
5. Deng W, Huang T, Wang H. 2023. A review of the key technology in a blockchain building decentralized trust platform. *Mathematics.* 11(1):101. doi:10.3390/math11010101.
6. Feist J, Grieco G, Groce A. 2019. Slither: a static analysis framework for smart contracts. *Proceedings of the 2nd International Workshop on Emerging Trends in Software Engineering for Blockchain (WETSEB)*; 2019 Mei 27; Montreal, Kanada. New York (NY): IEEE. hlm 8−15. doi:10.1109/WETSEB.2019.00008.
7. Feng Z, Feng Y, He H, Zhang W, Zhang Y. 2024. A bytecode-based integrated detection and repair method for reentrancy vulnerabilities in smart contracts. *IET Blockchain.* 4(3):235−251. doi:10.1049/blc2.12043.
8. Ghiyami Pour F, Costa G, Galletta L. 2025. Welcome back: a systematic literature review of smart contract reentrancy and countermeasures. *Blockchain Res Appl.* doi:10.1016/j.bcra.2025.100347.
9. Haouari W, Hafid AS, Fokaefs M. 2024. Vulnerabilities of smart contracts and mitigation schemes: a comprehensive survey. arXiv:2403.19805. doi:10.48550/arXiv.2403.19805.
10. He Y, Dong H, Wu H, Duan Q. 2023. Formal analysis of reentrancy vulnerabilities in smart contract based on CPN. *Electronics.* 12(10):2152. doi:10.3390/electronics12102152.
11. Hu S, Huang T, İlhan F, Tekin SF, Liu L. 2023. Large language model-powered smart contract vulnerability detection: new perspectives. *Proceedings of 2023 IEEE 5th International Conference on Trust, Privacy and Security in Intelligent Systems and Applications (TPS-ISA)*; 2023 Nov 1−3; Atlanta, GA, USA. New York (NY): IEEE. hlm 297−306. doi:10.1109/TPS-ISA58951.2023.00044.
12. Luu L, Chu DH, Olickel H, Saxena P, Hobor A. 2016. Making smart contracts smarter. *Proceedings of the 2016 ACM SIGSAC Conference on Computer and Communications Security (CCS '16)*; 2016 Okt 24−28; Vienna, Austria. New York (NY): ACM. hlm 254−269. doi:10.1145/2976749.2978309.
13. Mallick A, Chebolu I. 2026. Modeling and mitigating reentrancy attacks: a decision-theoretic framework for smart contract security. *IEEE Access.* 14:29853−29873. doi:10.1109/ACCESS.2025.3650603.
14. Mehar MI, Shier CL, Giambattista A, Gong E, Fletcher G, Sanayhie R, Kim HM, Laskowski M. 2019. Understanding a revolutionary and flawed grand experiment in blockchain: the DAO attack. *J Cases Inf Technol.* 21(1):19−32. doi:10.4018/JCIT.2019010102.
15. Nakamoto S. 2008. Bitcoin: a peer-to-peer electronic cash system. [diakses 2026 Jan 10]. https://bitcoin.org/bitcoin.pdf.
16. Nomic Foundation. 2024. Hardhat: Ethereum development environment for professionals. [diakses 2025 Jan 18]. https://hardhat.org/docs/.
17. [OWASP Foundation]. 2026. OWASP Smart Contract Security Top 10: SC08: 2026 reentrancy attacks. [diakses 2026 Mei 22]. https://scs.owasp.org/sctop10/SC08-ReentrancyAttacks/.
18. Rodler M, Li W, Karame GO, Davi L. 2019. Sereum: protecting existing smart contracts against re-entrancy attacks. *Proceedings of the 26th Network and Distributed System Security Symposium (NDSS 2019)*; 2019 Feb 24−27; San Diego, CA, USA. Reston (VA): Internet Society. hlm 1−15. doi:10.14722/ndss.2019.23413.
19. Sun Y, Wu D, Xue Y, Liu H, Wang H, Xu Z, Xie X, Liu Y. 2024. GPTScan: detecting logic vulnerabilities in smart contracts by combining GPT with program analysis. *Proceedings of the 46th IEEE/ACM International Conference on Software Engineering (ICSE 2024)*; 2024 Apr 14−20; Lisbon, Portugal. New York (NY): ACM. hlm 2048−2060. doi:10.1145/3597503.3639117.
20. Szabo N. 1996. Smart contracts: building blocks for digital markets. [diakses 2025 Jan 12]. https://www.fon.hum.uva.nl/rob/Courses/InformationInSpeech/CDROM/Literature/LOTwinterschool2006/szabo.best.vwh.net/smart_contracts_2.html.
21. Vacca A, Di Sorbo A, Visaggio CA, Canfora G. 2021. A systematic literature review of blockchain and smart contract development: techniques, tools, and open challenges. *J Syst Softw.* 174:110891. doi:10.1016/j.jss.2020.110891.
22. Wood G. 2014. Ethereum: a secure decentralised generalised transaction ledger. [diakses 2026 Jan 10]. https://ethereum.github.io/yellowpaper/paper.pdf.
23. Zheng Z, Xie S, Dai H, Chen X, Wang H. 2017. An overview of blockchain technology: architecture, consensus, and future trends. *Proceedings of the IEEE International Congress on Big Data*; 2017 Jun 25−30; Honolulu, HI, USA. New York (NY): IEEE. hlm 557−564. doi:10.1109/BigDataCongress.2017.85.

### Bagian 2 — Referensi Pendukung Konteks (18 entri)

Literatur konteks: rantai pasok, data statistik Indonesia, standar keamanan, dan referensi terkait:

24. Afrianto I, Djatna T, Arkeman Y, Hermadi I. 2022. Transformation model of smallholder oil palm supply chain ecosystem using blockchain-smart contract. *Int J Adv Comput Sci Appl.* 13(11):563−574. doi:10.14569/IJACSA.2022.0131165.
25. Alamsyah A, Widiyanesti S, Wulansari P, Nurhazizah E, Dewi AS, Rahadian D, Ramadhani DP, Hakim MN, Tyasamesi P. 2023. Blockchain traceability model in the coffee industry. *J Open Innov Technol Mark Complex.* 9(1):100008. doi:10.1016/j.joitmc.2023.100008.
26. Alkhalifah A, Ng A, Watters PA, Kayes ASM. 2021. A mechanism to detect and prevent Ethereum blockchain smart contract reentrancy attacks. *Front Comput Sci.* 3:598780. doi:10.3389/fcomp.2021.598780.
27. AlShorman A, Shannaq F, Shehab M. 2024. Machine learning approaches for enhancing smart contracts security: a systematic literature review. *Int J Data Netw Sci.* 8(3):1349−1368. doi:10.5267/j.ijdns.2024.4.007.
28. Asgaonkar A, Krishnamachari B. 2018. Solving the buyer and seller's dilemma: a dual-deposit escrow smart contract for provably cheat-proof delivery and payment for a digital good without a trusted mediator. arXiv:1806.08379. doi:10.48550/arXiv.1806.08379.
29. [BI] Bank Indonesia. 2026. Jakarta Interbank Spot Dollar Rate (JISDOR). [diakses 2026 Mei 22]. https://www.bi.go.id/id/statistik/informasi-kurs/jisdor/default.aspx.
30. [BPS] Badan Pusat Statistik. 2025a. Statistik E-Commerce 2024. Jakarta (ID): Badan Pusat Statistik. [diakses 2026 Mei 22]. https://www.bps.go.id/id/publication/2025/11/28/647323224ecc656c2933571b/statistik-e-commerce-2024.html.
31. [BPS] Badan Pusat Statistik. 2025b. Statistik Tanaman Perkebunan Tahunan Indonesia 2024 (Kelapa Sawit, Kopi, Kakao, Karet, Teh, dan Komoditas Perkebunan Unggulan). Jakarta (ID): Badan Pusat Statistik. [diakses 2026 Mei 22]. https://www.bps.go.id/id/publication/2025/08/29/8d2a6ab3510f9828daf73191/statistik-tanaman-perkebunan-tahunan-indonesia-2024--kelapa-sawit--kopi--kakao--karet--teh--dan-komoditas-perkebunan-unggulan-.html.
32. Chainalysis. 2025. Crypto Crime Report 2025: hacking. [diakses 2026 Feb 15]. https://www.chainalysis.com/blog/crypto-hacking-stolen-funds-2025/.
33. CoinMarketCap. 2026. Ethereum (ETH) price today, ETH to USD live price, marketcap and chart. [diakses 2026 Mei 22]. https://coinmarketcap.com/currencies/ethereum/.
34. Dutta P, Choi TM, Somani S, Butala R. 2020. Blockchain technology in supply chain operations: applications, challenges and research opportunities. *Transp Res Part E Logist Transp Rev.* 142:102067. doi:10.1016/j.tre.2020.102067.
35. Falgenti K, Arkeman Y, Hambali E, Syamsu K. 2022. The design of blockchain network of palm oil FFB supply from certified farms and traceability system of CPO from independent smallholders. *IOP Conf Ser Earth Environ Sci.* 1034:012001. doi:10.1088/1755-1315/1034/1/012001.
36. Fernández-Iglesias MJ, Delgado von Eitzen C, Anido-Rifón L. 2024. Efficient traceability systems with smart contracts: balancing on-chain and off-chain data storage for enhanced scalability and privacy. *Appl Sci.* 14(23):11078. doi:10.3390/app142311078.
37. Pradana IGMT, Djatna T, Hermadi I, Yuliasih I. 2023. Blockchain-based traceability system for Indonesian coffee digital business ecosystem. *Int J Eng.* 36(5):879−893. doi:10.5829/ije.2023.36.05b.05.
38. [SmartContractSecurity]. 2020. SWC-107: Smart Contract Weakness Classification Registry. [diakses 2026 Mei 22]. http://swcregistry.io/docs/SWC-107/.
39. Wu Y. 2022. Evolution process and supply chain adaptation of smart contracts in blockchain. *J Math.* 2022:2839566. doi:10.1155/2022/2839566.

> **Total: 39 entri** (sesuai daftar pustaka skripsi, dengan tambahan 1 entri Nomic Foundation yang diperjelas versinya).

### Format Sitasi

Mengikuti *Vancouver Style* yang dipakai oleh Program Studi Ilmu Komputer IPB University. Tiap entri memuat: penulis. tahun. judul. *sumber*. (jika prosiding): lokasi & tanggal konferensi; kota: penerbit; halaman; doi/URL.

---

## 📄 Lisensi

Penelitian ini dikembangkan untuk kepentingan akademik sebagai bagian dari tugas akhir (skripsi) di Institut Pertanian Bogor. Kode sumber dilisensikan di bawah MIT License.

---

## 🔐 Catatan Keamanan & Secrets

Repository ini memiliki file `.env` di root yang memuat:

- `PRIVATE_KEY` — Private key akun Sepolia (untuk deployment & serangan di testnet)
- `SEPOLIA_RPC_URL` — Endpoint RPC Infura Sepolia
- `DEEPSEEK_API_KEY` — API key DeepSeek untuk CEI Analyzer

File `.env` **sudah masuk `.gitignore`** sehingga **tidak akan ter-commit** ke Git. Namun, jika repository ini akan dibagikan kepada pihak lain (dosen, penguji, repo publik):

1. **Rotasi** private key Sepolia setelah sidang selesai
2. **Rotasi** API key DeepSeek setelah sidang selesai
3. Pertimbangkan membuat `.env.example` (tanpa nilai asli) untuk dokumentasi

> ⚠️ **Jangan pernah** commit `.env` ke Git publik. Gunakan environment variable di CI/CD atau platform deployment (Vercel dashboard, GitHub Secrets).

---

**© 2026 Nurcahya Priantoro — Institut Pertanian Bogor**
