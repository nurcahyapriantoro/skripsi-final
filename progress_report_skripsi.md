# PROGRESS REPORT SKRIPSI
# Mitigasi Serangan Reentrancy pada Smart Contract Rantai Pasok Berbasis Pola Checks-Effects-Interactions

**Peneliti:** Nurcahya Priantoro (G6401221049)
**Program Studi:** S1 Ilmu Komputer — Institut Pertanian Bogor
**Dosen Pembimbing:** Dr. Shelvie Nidya Neyman, S.Kom, M.Si
**Tanggal:** 25 April 2026

---

## SLIDE 1: JUDUL & IDENTITAS

- Judul: "Mitigasi Serangan Reentrancy pada Smart Contract Rantai Pasok Berbasis Pola Checks-Effects-Interactions"
- Peneliti: Nurcahya Priantoro (G6401221049)
- Dosen Pembimbing: Dr. Shelvie Nidya Neyman, S.Kom, M.Si
- Departemen Ilmu Komputer, FMIPA, IPB University

---

## SLIDE 2: LATAR BELAKANG (BAB 1)

### Permasalahan:
- Smart contract di Ethereum bersifat **immutable** — sekali di-deploy tidak bisa diubah
- Serangan reentrancy adalah kerentanan paling berbahaya (contoh: **The DAO Hack 2016**, kerugian $60 juta)
- Supply chain semakin banyak mengadopsi smart contract untuk escrow/pembayaran otomatis
- Jika smart contract rantai pasok rentan → **dana seluruh participant bisa terdrain**

### Gap Penelitian:
- Studi existing fokus pada DeFi (Uniswap, Aave), belum ada yang spesifik meneliti **reentrancy di konteks supply chain escrow**
- Belum ada studi komparatif **efisiensi gas** antara CEI pattern vs mutex lock pada konteks supply chain

---

## SLIDE 3: RUMUSAN MASALAH & TUJUAN

### Research Questions:
1. **RQ1:** Bagaimana mekanisme serangan reentrancy mengeksploitasi smart contract rantai pasok yang menggunakan pola Interactions-before-Effects?
2. **RQ2:** Apakah pola Checks-Effects-Interactions (CEI) efektif memitigasi serangan reentrancy?
3. **RQ3:** Bagaimana perbandingan efisiensi gas antara mitigasi CEI dengan ReentrancyGuard (mutex lock)?

### Tujuan:
1. Mensimulasikan dan membuktikan serangan reentrancy pada kontrak rantai pasok
2. Mengimplementasikan dan memvalidasi mitigasi CEI
3. Membandingkan efisiensi gas CEI vs mutex lock secara statistik

### Hipotesis:
- H₀: μ_CEI ≥ μ_Mutex (tidak ada perbedaan signifikan)
- H₁: μ_CEI < μ_Mutex (CEI lebih hemat gas)
- α = 0.05, one-tailed test

---

## SLIDE 4: TINJAUAN PUSTAKA (BAB 2)

### Konsep Kunci:
1. **Ethereum & EVM** — Platform smart contract terbesar, menggunakan gas sebagai biaya komputasi
2. **Smart Contract** — Program self-executing yang immutable di blockchain
3. **Reentrancy Attack** — Eksploitasi dimana external call memungkinkan recursive re-entry sebelum state update
4. **Supply Chain Smart Contract** — Escrow otomatis untuk transaksi buyer-seller
5. **Checks-Effects-Interactions (CEI)** — Pola pengurutan: validasi → update state → external call
6. **ReentrancyGuard (Mutex Lock)** — Library OpenZeppelin dengan _status variable untuk mencegah re-entry
7. **Gas & Opcode** — Biaya komputasi EVM: SSTORE (~5000-20000 gas), SLOAD (~100-2100 gas)

### Penelitian Terdahulu:
- Atzei et al. (2017): Survey serangan pada Ethereum smart contract
- OpenZeppelin: Standar industri untuk security libraries
- Solidity Documentation: Rekomendasi resmi pola CEI

---

## SLIDE 5: METODOLOGI PENELITIAN (BAB 3)

### Desain Eksperimen:
- **Tipe:** Eksperimen kuantitatif komparatif
- **Variabel Independen:** Teknik mitigasi (CEI vs Mutex Lock)
- **Variabel Dependen:** Gas consumption, SSTORE count, SLOAD count
- **Kontrol:** InsecureVault (baseline rentan)
- **Iterasi:** 30 kali per teknik mitigasi
- **Environment:** Hardhat Network (deterministic EVM simulation)

### Tools & Teknologi:
| Komponen | Teknologi |
|----------|-----------|
| Smart Contract | Solidity 0.8.28 |
| Framework | Hardhat 2.28.6 |
| Testing | Chai + Mocha + Ethers.js v6 |
| Security Library | OpenZeppelin Contracts 5.6.1 |
| Static Analysis | Slither |
| Statistik | Python (scipy, pandas, matplotlib) |
| Gas Profiling | hardhat-gas-reporter, debug_traceTransaction |

### Pipeline Analisis Statistik:
1. Shapiro-Wilk normality test (α = 0.05)
2. Levene's test (homogeneity of variance)
3. Independent t-test / Mann-Whitney U (one-tailed)
4. Cohen's d effect size

---

## SLIDE 6: ARSITEKTUR SMART CONTRACT (BAB 4 — Implementasi)

### 4 Smart Contract Dikembangkan:

**1. InsecureVault.sol (194 baris)** — Kontrak Rentan:
- Escrow supply chain: createOrder → depositFunds → confirmDelivery → withdrawFunds
- SENGAJA menggunakan Interactions-before-Effects di withdrawFunds()
- External call (.call{value}) SEBELUM update state (balances = 0)

**2. SecureVault.sol (180 baris)** — Mitigasi CEI:
- Struktur identik dengan InsecureVault
- withdrawFunds() mengikuti urutan CEI: CHECK → EFFECT → INTERACT
- balances[msg.sender] = 0 SEBELUM external call
- TANPA library eksternal — purely architectural

**3. MutexVault.sol (161 baris)** — Mitigasi Mutex Lock:
- Extends OpenZeppelin ReentrancyGuard
- withdrawFunds() menggunakan modifier nonReentrant
- SENGAJA tetap menggunakan Interactions-before-Effects untuk isolasi efek mutex

**4. Attacker.sol (158 baris)** — Kontrak Penyerang:
- receive() fallback melakukan recursive re-entry
- MAX_REENTRIES = 30 (safety cap)
- attack() → withdrawFunds() → receive() → withdrawFunds() → ... (drain loop)

---

## SLIDE 7: SKENARIO EKSPERIMEN (BAB 4 — Detail)

### Skenario Honeypot:
- Buyer A deposit: 1.5 ETH (simulasi pembayaran 1 ton komoditas)
- Buyer B deposit: 0.8 ETH (simulasi pembayaran parsial)
- Total dana victim (honeypot): 2.3 ETH
- Deposit attacker (legitimate entry): 0.1 ETH
- Total dalam vault: 2.4 ETH

### Flow Eksperimen:
1. Deploy InsecureVault + Attacker contract
2. Setup honeypot (3 orders, 3 deposits, 3 confirmations)
3. Attacker.attack() → recursive drainage
4. Validasi: vault balance = 0, attacker balance = 2.4 ETH
5. Ulangi dengan SecureVault → attack REVERTS
6. Ulangi dengan MutexVault → attack REVERTS
7. Benchmark gas: 30 iterasi per kontrak (CEI vs Mutex)

---

## SLIDE 8: HASIL EKSPERIMEN 1 — EKSPLOITASI BERHASIL (BAB 4)

### InsecureVault — Serangan Reentrancy Berhasil:

| Metrik | Nilai |
|--------|-------|
| Iterasi reentrancy | 24 kali (recursive) |
| Deposit awal attacker | 0.1 ETH |
| Saldo akhir attacker | 2.4 ETH |
| **Keuntungan ilegal** | **2.3 ETH (2,300% ROI)** |
| **Saldo akhir vault** | **0 ETH (fully drained)** |
| Kerugian Buyer A | 1.5 ETH |
| Kerugian Buyer B | 0.8 ETH |
| Legitimate seller | Tidak bisa withdraw (dana habis) |

### RQ1 Terjawab:
Mekanisme serangan: attacker memanfaatkan external call di withdrawFunds() yang terjadi SEBELUM update state balances[msg.sender] = 0. Fungsi receive() attacker memanggil kembali withdrawFunds() secara rekursif, dan karena balance belum di-update, pengecekan require(amount > 0) terus lolos.

---

## SLIDE 9: HASIL EKSPERIMEN 2 & 3 — MITIGASI BERHASIL (BAB 4)

### SecureVault (CEI) — Serangan GAGAL:
- Transaksi serangan **REVERT**
- Dana victim **tetap aman** (2.4 ETH preserved)
- Keuntungan ilegal attacker: **0 ETH**
- Legitimate withdrawal: **BERHASIL**
- Double-withdrawal: **DICEGAH**

### MutexVault (Mutex) — Serangan GAGAL:
- Transaksi serangan **REVERT**
- Dana victim **tetap aman** (2.4 ETH preserved)
- Keuntungan ilegal attacker: **0 ETH**

### RQ2 Terjawab:
CEI efektif memitigasi reentrancy. Dengan memindahkan balances[msg.sender] = 0 SEBELUM external call, re-entrant call langsung gagal di require(amount > 0).

---

## SLIDE 10: HASIL PERBANDINGAN GAS (BAB 4 — Data Kuantitatif)

### Data Gas Consumption (30 Iterasi):

| Metrik | CEI (SecureVault) | Mutex (MutexVault) | Selisih |
|--------|:-----------------:|:------------------:|--------:|
| **Gas Used** | 29,950 | 32,363 | **-2,413 (-7.46%)** |
| **SSTORE Count** | 1 | 3 | **-2 (-66.67%)** |
| **SLOAD Count** | 1 | 2 | **-1 (-50.00%)** |
| **Total Opcodes** | 132 | 165 | **-33 (-20.00%)** |

### Penjelasan Teknis:
- CEI hanya perlu 1 SSTORE (zero balance) — operasi yang SUDAH ADA, hanya dipindah urutannya
- Mutex perlu 3 SSTORE: (1) _status = ENTERED, (2) balances = 0, (3) _status = NOT_ENTERED
- Mutex perlu 2 SLOAD: (1) check _status, (2) read balances
- Overhead mutex: +2 SSTORE + 1 SLOAD per withdrawal = +2,413 gas

---

## SLIDE 11: HASIL ANALISIS STATISTIK (BAB 4)

### Pengujian Hipotesis:

| Parameter | Nilai |
|-----------|-------|
| Sample size | 30 iterasi per grup |
| Signifikansi (α) | 0.05 |
| Arah test | One-tailed (H₁: μ_CEI < μ_Mutex) |
| Std Dev (CEI) | 0.00 |
| Std Dev (Mutex) | 0.00 |
| Metode | Deterministic comparison (zero variance) |
| **p-value** | **0.000000** |
| **Cohen's d** | **∞ (efek deterministik)** |
| **Keputusan** | **H₀ DITOLAK — H₁ DIDUKUNG** |

### Semua 3 Metrik: H₀ DITOLAK
1. ✅ Total Gas Used: CEI < Mutex (p = 0.000)
2. ✅ SSTORE Count: CEI < Mutex (p = 0.000)
3. ✅ SLOAD Count: CEI < Mutex (p = 0.000)

### Catatan Zero Variance:
Hardhat Network me-reset ke state identik setiap iterasi → gas consumption identik per iterasi. Ini menunjukkan perbedaan bersifat **struktural di level EVM opcode**, bukan stokastik.

---

## SLIDE 12: PEMBAHASAN (BAB 5)

### Temuan Utama:
1. **Serangan reentrancy pada supply chain escrow berhasil dibuktikan** — 24 recursive re-entry menghasilkan drainage total 2.4 ETH dari kontrak yang memiliki dana 3 buyer
2. **CEI efektif sebagai mitigasi tanpa dependensi eksternal** — cukup mengubah URUTAN operasi yang sudah ada
3. **CEI 7.46% lebih hemat gas dibandingkan mutex lock** — karena tidak menambah state variable baru
4. **Kedua teknik setara dari sisi keamanan** — keduanya memblokir serangan 100%

### Implikasi Praktis:
- Untuk supply chain smart contract, **CEI adalah rekomendasi utama** karena:
  - Tidak memerlukan library eksternal (reduce attack surface)
  - Lebih hemat gas (reduce transaction cost)
  - Lebih sederhana (reduce complexity)
- Mutex lock tetap berguna untuk fungsi **yang tidak bisa di-refactor** ke CEI

### Kontribusi Ilmiah:
1. Bukti empiris pertama reentrancy di konteks supply chain escrow
2. Data kuantitatif perbandingan gas CEI vs mutex pada Solidity 0.8.28
3. Analisis opcode-level (SSTORE/SLOAD) yang menjelaskan sumber perbedaan gas

---

## SLIDE 13: KESIMPULAN (BAB 5)

1. **RQ1:** Serangan reentrancy mengeksploitasi anti-pattern Interactions-before-Effects, dimana external call terjadi sebelum state update, memungkinkan attacker melakukan recursive withdrawal melalui fallback function (24 re-entries, 2.3 ETH kerugian)

2. **RQ2:** Pola CEI terbukti efektif memitigasi reentrancy dengan memindahkan state update (balances = 0) sebelum external call. Serangan terblokir 100%, dana victim terpreservasi, dan legitimate users tetap dapat bertransaksi normal

3. **RQ3:** CEI secara deterministik lebih efisien gas dibandingkan mutex lock: 29,950 vs 32,363 gas (-7.46%), 1 vs 3 SSTORE (-66.67%), 1 vs 2 SLOAD (-50.00%). H₁ didukung dengan p = 0.000000

---

## SLIDE 14: SARAN & FUTURE WORK

1. Menguji pada **testnet publik** (Sepolia/Goerli) untuk variasi gas di real network
2. Menambahkan analisis **cross-function reentrancy** dan **read-only reentrancy**
3. Integrasi dengan **real supply chain use case** (multi-party escrow, dispute resolution)
4. Perbandingan dengan **mitigasi lain** (pull-payment pattern, gas limit)
5. Analisis pada **Solidity versi lebih baru** yang mungkin memiliki gas schedule berbeda

---

## SLIDE 15: EVIDENCE — TEST RESULTS

### 22 Tests Passing:
```
=== EXPERIMENT 1: Reentrancy Exploit on InsecureVault ===  (11 tests ✅)
=== EXPERIMENT 2: CEI Mitigation on SecureVault ===        (4 tests ✅)
=== EXPERIMENT 3: Mutex Mitigation on MutexVault ===       (3 tests ✅)
=== GAS BENCHMARK: CEI vs Mutex ===                        (1 test ✅)
=== LIVENESS TEST: Legitimate Withdrawals ===              (3 tests ✅)
```

### Static Analysis (Slither):
- InsecureVault: reentrancy-eth vulnerability **DETECTED** ✅
- SecureVault: reentrancy-eth vulnerability **NOT DETECTED** ✅
- MutexVault: reentrancy-eth vulnerability **NOT DETECTED** ✅

---

## SLIDE 16: REPOSITORY STRUCTURE

```
reentrancy-research/
├── contracts/
│   ├── vulnerable/InsecureVault.sol   (194 lines)
│   ├── secure/SecureVault.sol         (180 lines)
│   ├── secure/MutexVault.sol          (161 lines)
│   └── attacker/Attacker.sol          (158 lines)
├── test/                              (5 test files, 22 tests)
├── analysis/
│   ├── collect_gas_data.js            (30-iter gas benchmark)
│   ├── opcode_trace.js                (SSTORE/SLOAD analysis)
│   ├── statistical_analysis.py        (Full statistical pipeline)
│   └── results/                       (CSV, TXT, PNG outputs)
├── slither/                           (Static analysis reports)
├── scripts/deploy_local.js            (Deployment script)
└── hardhat.config.js                  (Solidity 0.8.28, optimizer)
```

---

## PERTANYAAN UNTUK DOSEN PEMBIMBING

1. **Mengenai Zero Variance:** Karena data gas konsisten (zero variance) di Hardhat Network, apakah perlu ditambahkan eksperimen di testnet publik (Sepolia) untuk mendapatkan variasi gas yang lebih realistis, meskipun hal tersebut akan membutuhkan ETH testnet dan waktu tambahan?

2. **Mengenai Scope Supply Chain:** Apakah perlu diperluas skenario supply chain-nya (multi-hop, dispute resolution) atau cukup dengan escrow sederhana buyer-seller sebagai PoC?

3. **Mengenai Jenis Reentrancy:** Penelitian saat ini fokus pada single-function reentrancy. Apakah perlu menambahkan cross-function reentrancy atau read-only reentrancy sebagai eksperimen tambahan?

4. **Mengenai Metode Statistik:** Karena data deterministik (zero variance), uji statistik klasik (t-test) tidak applicable. Apakah pendekatan "deterministic comparison" yang digunakan sudah cukup diterima, atau perlu metode alternatif?

5. **Mengenai Pembanding Tambahan:** Apakah perlu menambah teknik mitigasi lain (pull-payment, gas stipend) sebagai pembanding, atau cukup CEI vs mutex lock?

6. **Mengenai Kelengkapan BAB 4-5:** Apakah data yang sudah ada (22 test, 30 iterasi gas, analisis opcode, statistical report, box plot) sudah cukup sebagai evidence untuk BAB Hasil & Pembahasan?

7. **Mengenai Deployment Cost:** Data deployment cost sudah tersedia (InsecureVault: 604,737 gas, SecureVault: 597,229 gas, MutexVault: 652,666 gas). Apakah ini perlu dimasukkan sebagai metrik tambahan dalam perbandingan?

---

## DATA RINGKASAN UNTUK REFERENSI CEPAT

### Angka-Angka Kunci:
- **2.3 ETH** kerugian victim dari serangan reentrancy
- **24** recursive re-entries dalam satu transaksi
- **0%** success rate serangan pada SecureVault dan MutexVault
- **7.46%** penghematan gas CEI dibanding mutex
- **29,950 vs 32,363** gas per withdrawal (CEI vs Mutex)
- **1 vs 3** SSTORE operations (CEI vs Mutex)
- **22** test cases, semua passing
- **30** iterasi benchmark per teknik
- **p = 0.000** — H₁ didukung (signifikan)
