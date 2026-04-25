# Analisis Mendalam Skripsi — Reentrancy Research

## 1. KESESUAIAN PROPOSAL (BAB 1-3) vs IMPLEMENTASI (BAB 4-5)

### ✅ Yang Sudah Sesuai & Lengkap

| Aspek Proposal | Status Implementasi | Catatan |
|----------------|:-------------------:|---------|
| RQ1: Mekanisme serangan reentrancy | ✅ **Lengkap** | 11 test cases, 24 re-entries, 2.3 ETH drained |
| RQ2: Efektivitas CEI | ✅ **Lengkap** | Attack reverts, funds preserved, liveness tested |
| RQ3: Perbandingan gas CEI vs Mutex | ✅ **Lengkap** | 30 iterasi, statistik lengkap, H₁ didukung |
| Konteks supply chain | ✅ **Sesuai** | Escrow buyer-seller dengan order lifecycle |
| Threat model | ✅ **Sesuai** | Attacker sebagai seller legitimate |
| Hipotesis H₀/H₁ | ✅ **Terjawab** | H₀ ditolak, p = 0.000 |
| Metode statistik | ✅ **Sesuai** | Shapiro-Wilk → t-test/Mann-Whitney pipeline |
| Tools & teknologi | ✅ **Sesuai** | Hardhat, Solidity 0.8.28, OpenZeppelin 5.x |

### ⚠️ Area yang Perlu Perhatian

| Aspek | Status | Rekomendasi |
|-------|--------|-------------|
| Validasi external (testnet) | ⚠️ **Belum ada** | Pertimbangkan 1 eksperimen di Sepolia testnet |
| Cross-function reentrancy | ⚠️ **Out of scope** | Jelaskan sebagai limitation di BAB 5 |
| Literature review depth | ⚠️ **Perlu dicek** | Pastikan 15+ referensi jurnal terakreditasi |
| Deployment cost comparison | ⚠️ **Data ada, belum dibahas** | Masukkan ke pembahasan (597K vs 652K gas) |

---

## 2. PENILAIAN: AMAN UNTUK PROGRESS REPORT?

### 🟢 VERDICT: **YA, AMAN** untuk di-report ke dosen pembimbing

**Alasan:**
1. **Semua RQ terjawab** — Tiga research questions dijawab dengan data kuantitatif
2. **22 test passing** — Full automated test suite memvalidasi semua klaim
3. **Data kuantitatif kuat** — Gas data 30 iterasi, opcode trace, statistical report
4. **Metodologi konsisten** — Mengikuti proposal BAB 3 dengan faithful
5. **Reprodusibel** — `npm install → npm test` reproduksi seluruh eksperimen
6. **Static analysis** — Slither report tersedia sebagai validasi tambahan

---

## 3. CELAH & KELEMAHAN POTENSIAL (AI Critical Review)

### 🔴 Kelemahan Signifikan

**1. Zero Variance Problem (PALING KRITIS)**
- Semua 30 iterasi menghasilkan gas identik (std = 0)
- Uji statistik klasik (t-test, Mann-Whitney) **tidak applicable** pada data tanpa varians
- Pendekatan "deterministic comparison" valid secara logika, tapi **dosen bisa mempertanyakan** mengapa pakai 30 iterasi jika hasilnya selalu sama
- **Rekomendasi:** Jelaskan bahwa 30 iterasi membuktikan **konsistensi** dan **reproducibility**. Perbedaan gas bersifat structural (EVM opcode level), bukan stochastic. Pertimbangkan tambah 1 eksperimen di testnet publik sebagai robustness check.

**2. Simplisitas Skenario Supply Chain**
- Hanya 1 tipe kontrak escrow (buyer-seller sederhana)
- Real supply chain melibatkan multi-hop (manufacturer → distributor → retailer)
- **Rekomendasi:** Jelaskan sebagai **limitation** dan **future work** di BAB 5

**3. Single-Function Reentrancy Only**
- Hanya menguji reentrancy pada 1 fungsi (withdrawFunds)
- Tidak menguji cross-function reentrancy atau read-only reentrancy
- **Rekomendasi:** Scope sudah sesuai untuk skripsi S1, jelaskan sebagai limitation

### 🟡 Kelemahan Minor

**4. Tidak ada Cost Analysis dalam USD/IDR**
- Gas consumption ditampilkan dalam unit gas, belum di-convert ke biaya real (USD/ETH)
- **Rekomendasi:** Tambahkan 1 paragraf konversi: "Pada gas price 20 Gwei, penghematan 2,413 gas = ~0.00004826 ETH ≈ $0.17 per transaksi. Pada 1000 transaksi/hari = $170/hari saving."

**5. Tidak ada Perbandingan dengan pull-payment pattern**
- CEI dan mutex bukan satu-satunya mitigasi (ada pull-payment, gas limit)
- **Rekomendasi:** Jelaskan di limitation, bukan keharusan untuk S1

**6. Tidak ada analisis formal verification**
- Verifikasi hanya melalui testing, bukan formal proof (Certora, K Framework)
- **Rekomendasi:** Normal untuk level S1, sebutkan di future work

**7. Box Plot Kurang Informatif**
- Karena zero variance, box plot menunjukkan garis horizontal (bukan distribusi)
- **Rekomendasi:** Tambahkan bar chart/comparison chart sebagai alternatif yang lebih visual

---

## 4. SARAN PENGUATAN SKRIPSI

### Prioritas Tinggi (Lakukan Sebelum Sidang):

1. **Tulis justifikasi zero variance di BAB 4/5** — Ini PASTI akan ditanyakan penguji. Siapkan argumen: "Perbedaan gas bersifat structural di EVM opcode level (1 SSTORE vs 3 SSTORE), sehingga zero variance adalah expected behavior, bukan bug metodologi."

2. **Tambahkan tabel deployment cost comparison:**
   | Contract | Deployment Gas | % of Block Limit |
   |----------|:-----------:|:---:|
   | InsecureVault | 604,737 | 2.0% |
   | SecureVault (CEI) | 597,229 | 2.0% |
   | MutexVault (Mutex) | 652,666 | 2.2% |
   
   CEI bahkan lebih kecil deployment cost-nya karena tidak import library.

3. **Tambahkan paragraf konversi gas ke biaya USD** — Membuat hasil lebih tangible untuk pembaca non-teknis.

4. **Buat tabel ringkasan di akhir BAB 4** yang menjawab setiap RQ secara eksplisit dengan nomor data.

### Prioritas Sedang (Nice to Have):

5. **Tambah bar chart** sebagai alternatif box plot (lebih informatif untuk data deterministik)
6. **Tambah 1 eksperimen di Sepolia testnet** — Jika ada waktu, ini akan memperkuat validitas
7. **Pastikan referensi jurnal ≥ 15** dari sumber terakreditasi (IEEE, ACM, Springer)

### Prioritas Rendah (Future Work):

8. Cross-function reentrancy testing
9. Formal verification dengan Certora/SMTChecker
10. Multi-party escrow scenario

---

## 5. PERTANYAAN YANG MUNGKIN DITANYAKAN DOSEN

| # | Pertanyaan Potensial | Jawaban yang Disiapkan |
|---|---------------------|----------------------|
| 1 | "Kenapa data gas-nya zero variance?" | Hardhat Network deterministik. Reset state setiap iterasi → bytecode, storage layout, gas schedule identik. Zero variance membuktikan perbedaan STRUCTURAL, bukan RANDOM. |
| 2 | "Kenapa pakai 30 iterasi kalau hasilnya sama?" | Mengikuti standar statistik (n ≥ 30). Juga membuktikan REPRODUCIBILITY — 30 kali konsisten = bukan kebetulan. |
| 3 | "Apakah hasil ini berlaku di mainnet?" | Gas schedule EVM identik di mainnet. Perbedaan mungkin ada pada gas price (bukan gas used). Testnet experiment bisa jadi future work. |
| 4 | "Kenapa tidak pakai Sepolia testnet?" | Hardhat Network memberikan kontrol penuh (deterministic). Testnet menambah variabel eksogen (network congestion, gas price fluctuation) yang bukan fokus penelitian. |
| 5 | "Apa limitasi utama penelitian?" | (1) Single-function reentrancy only, (2) Simplified supply chain scenario, (3) Deterministic environment only, (4) Tidak mencakup formal verification. |
| 6 | "Kenapa MutexVault tetap pakai anti-pattern?" | Deliberate design choice untuk ISOLASI efek mutex. Jika MutexVault juga pakai CEI ordering, kita tidak bisa membedakan mana yang mencegah reentrancy — CEI atau mutex. |
| 7 | "Apa kontribusi baru penelitian ini?" | (1) Bukti empiris reentrancy di supply chain, (2) Data kuantitatif CEI vs mutex di Solidity 0.8.28, (3) Analisis opcode-level yang menjelaskan MENGAPA CEI lebih efisien. |

---

## 6. CHECKLIST KESIAPAN SIDANG

- [x] Semua RQ terjawab dengan data
- [x] Hipotesis diuji secara statistik
- [x] 22 test cases passing
- [x] Data 30 iterasi tersedia (CSV)
- [x] Statistical report lengkap
- [x] Visualisasi (box plot) tersedia
- [x] Static analysis (Slither) dilakukan
- [x] Source code terdokumentasi (NatSpec comments)
- [x] README.md lengkap
- [ ] Justifikasi zero variance ditulis di naskah
- [ ] Konversi gas ke USD ditulis di naskah
- [ ] Deployment cost comparison dibahas
- [ ] Referensi minimal 15 jurnal terakreditasi
- [ ] PPT progress report selesai
