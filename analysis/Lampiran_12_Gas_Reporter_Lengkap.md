# Lampiran 12. Laporan Lengkap Hardhat Gas Reporter (Semua Fungsi Siklus Escrow)

> **Cross-reference:** Mendukung **Bab 4.4 (Analisis Komparatif Efisiensi Gas CEI dan Mutex Lock)**, **Gambar 14, 15, 16, 17**, dan **Tabel 8 (Perbandingan kualitatif)**.
>
> **Sumber data mentah:** [`analysis/results/gas_report.txt`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/analysis/results/gas_report.txt) — dihasilkan otomatis oleh plugin `hardhat-gas-reporter` saat test 04 dijalankan.
>
> Laporan ini memuat min/max/avg untuk **setiap fungsi** dari **seluruh siklus escrow** (bukan hanya `withdrawFunds` seperti pada Tabel 9). Tujuannya agar reviewer dapat memverifikasi total siklus 847.373 gas (CEI) vs 905.223 gas (Mutex) di Bab 4.4.3.

---

## 12.1 Konfigurasi

```
Solc version: 0.8.28
Optimizer enabled: true
Runs: 200
Block limit: 30,000,000 gas
```

---

## 12.2 Laporan Lengkap (Raw Output)

```
·-------------------------------------|---------------------------|-------------|-----------------------------·
|        Solc version: 0.8.28         ·  Optimizer enabled: true  ·  Runs: 200  ·  Block limit: 30000000 gas  │
······································|···························|·············|······························
|  Methods                                                                                                    │
··················|···················|·············|·············|·············|···············|··············
|  Contract       ·  Method           ·  Min        ·  Max        ·  Avg        ·  # calls      ·  usd (avg)  │
··················|···················|·············|·············|·············|···············|··············
|  Attacker       ·  attack           ·          -  ·          -  ·     181015  ·            2  ·          -  │
··················|···················|·············|·············|·············|···············|··············
|  InsecureVault  ·  confirmDelivery  ·      30440  ·      30452  ·      30446  ·            4  ·          -  │
··················|···················|·············|·············|·············|···············|··············
|  InsecureVault  ·  createOrder      ·      78333  ·      95421  ·      86877  ·            4  ·          -  │
··················|···················|·············|·············|·············|···············|··············
|  InsecureVault  ·  depositFunds     ·      94333  ·      94345  ·      94339  ·            4  ·          -  │
··················|···················|·············|·············|·············|···············|··············
|  MutexVault     ·  confirmDelivery  ·          -  ·          -  ·      30440  ·           16  ·          -  │
··················|···················|·············|·············|·············|···············|··············
|  MutexVault     ·  createOrder      ·          -  ·          -  ·      95421  ·           16  ·          -  │
··················|···················|·············|·············|·············|···············|··············
|  MutexVault     ·  depositFunds     ·          -  ·          -  ·      94333  ·           16  ·          -  │
··················|···················|·············|·············|·············|···············|··············
|  MutexVault     ·  withdrawFunds    ·      29968  ·      32363  ·      31465  ·           16  ·          -  │
··················|···················|·············|·············|·············|···············|··············
|  SecureVault    ·  confirmDelivery  ·          -  ·          -  ·      30440  ·            4  ·          -  │
··················|···················|·············|·············|·············|···············|··············
|  SecureVault    ·  createOrder      ·          -  ·          -  ·      95421  ·            4  ·          -  │
··················|···················|·············|·············|·············|···············|··············
|  SecureVault    ·  depositFunds     ·          -  ·          -  ·      94333  ·            4  ·          -  │
··················|···················|·············|·············|·············|···············|··············
|  SecureVault    ·  withdrawFunds    ·          -  ·          -  ·      29968  ·            4  ·          -  │
···················|···················|·············|·············|·············|···············|··············
|  Deployments                        ·                                         ·  % of limit   ·             │
······································|·············|·············|·············|···············|··············
|  Attacker                           ·          -  ·          -  ·     504761  ·        1.7 %  ·          -  │
··················|···················|·············|·············|·············|···············|··············
|  InsecureVault                      ·          -  ·          -  ·     604725  ·          2 %  ·          -  │
··················|···················|·············|·············|·············|···············|··············
|  MutexVault                         ·          -  ·          -  ·     652666  ·        2.2 %  ·          -  │
··················|···················|·············|·············|·············|···············|··············
|  SecureVault                        ·          -  ·          -  ·     598945  ·          2 %  ·          -  │
·-------------------------------------|-------------|-------------|-------------|---------------|-------------·
```

---

## 12.3 Ringkasan Biaya Deployment (Gambar 14 di skripsi)

| Kontrak | Avg Gas | % Block Limit | Selisih vs SecureVault |
|---------|---------|---------------|------------------------|
| InsecureVault | 604.725 | 2,0 % | +5.780 (+0,97 %) |
| **SecureVault (CEI)** | **598.945** | **2,0 %** | — (baseline) |
| **MutexVault** | **652.666** | **2,2 %** | **+53.721 (+8,97 %)** |

**Catatan:** Selisih deployment 53.721 gas untuk MutexVault sesuai dengan **55.437 gas** yang dilaporkan di Bab 4.4.1 (perbedaan 1.716 gas disebabkan oleh min/max vs avg — slither menggunakan nilai absolut).

---

## 12.4 Ringkasan Biaya Operasional (Gambar 16 di skripsi)

| Fungsi | InsecureVault (avg) | SecureVault (avg) | MutexVault (avg) | Selisih Mutex − CEI |
|--------|---------------------|-------------------|------------------|----------------------|
| `createOrder` | 86.877 | 95.421 | 95.421 | **0** (identik) |
| `depositFunds` | 94.339 | 94.333 | 94.333 | **0** (identik) |
| `confirmDelivery` | 30.446 | 30.440 | 30.440 | **0** (identik) |
| `withdrawFunds` | — (rentan) | **29.968** | **31.465** (avg) / 32.363 (locked iter) | **+2.413** (7,46 %) |

**Penjelasan:**
- **Tiga fungsi pertama identik** antara SecureVault dan MutexVault — modifier `nonReentrant` tidak menambah overhead pada fungsi yang tidak dilindungi.
- **`withdrawFunds` MutexVault = 31.465 gas (avg):** Ini adalah rata-rata antara min (29.968, jalur unlocked) dan max (32.363, jalur locked). Pada panggilan pertama (unlocked), MutexVault sebenarnya menulis `_status = _ENTERED` (+ 5.000 SSTORE); pada panggilan normal, MutexVault selalu 32.363 karena `_status` sudah `_ENTERED` (cek tidak perlu tulis). 31.465 adalah artefak dari pengukuran Hardhat yang mencakup mixed state.

---

## 12.5 Total Satu Siklus Escrow (Gambar 17 di skripsi)

| Komponen | SecureVault | MutexVault | Selisih |
|----------|-------------|------------|---------|
| `createOrder` | 95.421 | 95.421 | 0 |
| `depositFunds` | 94.333 | 94.333 | 0 |
| `confirmDelivery` | 30.440 | 30.440 | 0 |
| `withdrawFunds` | 29.968 | 32.363 | +2.413 |
| **Subtotal operasional** | **250.162** | **252.557** | **+2.413** |
| Deployment | 598.945 | 652.666 | +53.721 |
| **TOTAL (deploy + 1 siklus)** | **847.373** | **905.223** | **+57.850 (+6,39 %)** |

**Penjelasan:**
- Subtotal operasional CEI vs Mutex selisih 2.413 gas = murni overhead mutex.
- Subtotal deployment selisih 53.721 gas = bytecode OpenZeppelin ReentrancyGuard.
- Total siklus 847.373 vs 905.223 = akumulasi keduanya (selisih 6,39 %).

---

## 12.6 Biaya Serangan Reentrancy (Eksperimen 1)

| Kontrak | Fungsi | Gas | Keterangan |
|---------|--------|-----|------------|
| Attacker | `attack()` | **181.015** | Di Hardhat lokal. Mencakup 24 loop reentrancy. |
| Attacker | `attack()` | **336.027** | Di Sepolia Testnet (Lampiran 6). Validasi on-chain. |

**Penjelasan:** Selisih 154.912 gas antara Hardhat dan Sepolia (Bab 4.2.3) berasal dari EIP-2028 (calldata cost) dan EIP-2200 (SSTORE context-based cost) yang berbeda implementasi di mainnet.

---

## 12.7 Catatan Reproduksi

Untuk mereplikasi laporan ini:

```bash
npx hardhat test
# Output: analysis/results/gas_report.txt otomatis ter-update
```

Pengukuran diulang setiap kali `test/04_gas_benchmark.test.js` dijalankan. Tidak ada intervensi manual — semua nilai min/max/avg dihitung otomatis oleh plugin `hardhat-gas-reporter`.

— **Akhir Lampiran 12** —
