# Progress Report Skripsi

**Judul:** Mitigasi Serangan Reentrancy pada Smart Contract Rantai Pasok Berbasis Pola Checks-Effects-Interactions  
**Peneliti:** Nurcahya Priantoro (G6401221049)

---

## Status Terkini (7 Mei 2026)

### ✅ Telah Selesai

| Komponen | Status | Detail |
|---|---|---|
| Kontrak Rentan (`InsecureVault`) | ✅ | Selesai |
| Kontrak CEI (`SecureVault`) | ✅ | Selesai |
| Kontrak Mutex (`MutexVault`) | ✅ | Selesai |
| Kontrak Penyerang (`Attacker`) | ✅ | Selesai |
| Deploy ke Sepolia Testnet | ✅ | 4 kontrak aktif |
| Eksekusi Serangan di Testnet | ✅ | **Berhasil** - 16 reentrancy loops, vault terkuras 100% |
| Analisis Gas (lokal) | ✅ | Benchmark CEI vs Mutex |
| Analisis Opcode (lokal) | ✅ | SSTORE/SLOAD count |
| Statistikal (lokal) | ✅ | t-test, Mann-Whitney, Cohen's d |

### 🔄 Dalam Proses

- Pengumpulan data gas di testnet (perlu faucet)

### 📋 Rencana Selanjutnya

- Run benchmark 30 iterasi di testnet
- Analisis perbandingan biaya transaksi nyata
- Finalisasi laporan analisis

---

## Hasil Serangan Testnet (7 Mei 2026)

**Network:** Sepolia Testnet (chainId: 11155111)  
**Wallet:** `0xa9938572bf81d7d1791FE761B5601Cdb169b6848`

### Kontrak yang Dideploy

| Kontrak | Alamat |
|---|---|
| InsecureVault | `0xA9f9D28167A4Ca45554544f43905De2B6D2f37bc` |
| SecureVault | `0xdf829d9E6527b219Bf17D6578039445cf12fC811` |
| MutexVault | `0xBcCce7626FDfB800f319aAdFFEBDc644dc5ef795` |
| Attacker | `0xc44109595b6d25c49f33521326f4d291e292A50f` |

### Skenario Honeypot

| Transaksi | Nilai | Status |
|---|---|---|
| Buyer A deposit | 0.0001 ETH | ✅ |
| Buyer B deposit | 0.00005 ETH | ✅ |
| Attacker entry | 0.00001 ETH | ✅ |
| **Total Vault** | **0.00016 ETH** | ✅ |

### Eksekusi Serangan

| Metrik | Hasil |
|---|---|
| Reentrancy loops | 16 kali |
| Vault sebelum serangan | 0.00016 ETH |
| Vault setelah serangan | 0.0 ETH |
| Attacker contract sebelum | 0.0 ETH |
| Attacker contract setelah | 0.00016 ETH |
| Illegal profit | 0.00015 ETH |
| Exfiltrasi ke wallet | ✅ |
| **Kesimpulan** | **Serangan Berhasil** |

### Validasi Judul Skripsi

- ✅ **InsecureVault (tanpa mitigasi):** Reentrancy berhasil → vault terkuras
- ⏳ **SecureVault (CEI):** Perlu validasi ulang di testnet
- ⏳ **MutexVault (ReentrancyGuard):** Perlu validasi ulang di testnet

---

## Rekomendasi untuk Memperkuat Skripsi

### 1. Visualisasi Aliran Serangan
Buat diagram sequence yang menunjukkan aliran panggilan reentrancy:
```
Attacker.withdrawFunds()
  └─ InsecureVault.withdrawFunds()  [call ke Attacker]
       └─ Attacker.receive()
            ├─ reentrancyCount++
            └─ InsecureVault.withdrawFunds()  [re-entered!]
                 └─ Attacker.receive() [loop...]
```

### 2. Perbandingan Biaya Gas Nyata (Testnet)
Jalankan benchmark 30 iterasi di testnet untuk CEI vs Mutex dengan biaya gas real (bukan estimasi lokal). Ini menunjukkan efisiensi CEI secara konkret.

### 3. Analisis Depth Reentrancy
Uji berapa maksimal reentrancy loops yang bisa terjadi sebelum `blockGasLimit` habis. Di testnet sudah terbukti 16 kali berhasil.

### 4. Tambah Metrik di Report
- **Attack Success Rate** dari multiple runs
- **Gas Cost per Reentrancy Loop**
- **Block Confirmation Time** per transaksi

### 5. Expert Recommendations
Analisis berdasarkan standar keamanan:
- **SWC-107** (Reentrancy) compliance
- Perbandingan dengan OWASP Smart Contract Top 10
- Rekomendasi dari OpenZeppelin, Trail of Bits

### 6. Case Study Nyata
Hubungkan dengan insiden reentrancy terkenal:
- **The DAO Hack (2016)** — $60M, reentrancy klasik
- **Uniswap/Lendf.Me (2020)** — $25M, ERC777 reentrancy
- Tunjukkan bagaimana pola CEI mencegah pola serangan yang sama

### 7. Visual Data
Gunakan box plot dari data gas untuk menunjukkan perbedaan CEI vs Mutex secara statistik (Cohen's d, p-value).

---

## Cara Mengulangi Langkah

### Prasyarat
```bash
# 1. Isi .env
PRIVATE_KEY=your_private_key
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
INsecure_Vault_ADDR=
ATTACKER_ADDR=
```

### 2. Dapatkan Testnet ETH
- https://sepoliafaucet.com (Alchemy)
- https://faucet.quicknode.com/ethereum/sepolia
- https://www.infura.io/faucet/sepolia

### 3. Deploy Ulang
```bash
npm run deploy:testnet
```
Copy alamat InsecureVault dan Attacker ke `.env`.

### 4. Jalankan Serangan
```bash
npm run attack:testnet
```

### 5. Jalankan Benchmark (setelah faucet)
```bash
npx hardhat run analysis/collect_gas_data.js --network sepolia
npx hardhat run analysis/opcode_trace.js --network sepolia
python analysis/statistical_analysis.py
```
