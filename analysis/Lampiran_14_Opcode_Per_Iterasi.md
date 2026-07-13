# Lampiran 14. Data Opcode SSTORE/SLOAD per Iterasi (30 Iterasi)

> **Cross-reference:** Mendukung **Bab 4.4.4 (Analisis Instruksi Tingkat Mesin)**, **Gambar 18 (SSTORE/SLOAD)**, dan **Gambar 20 (Total instruksi)**.
>
> **Sumber data mentah:** [`analysis/results/opcode_data_cei.csv`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/analysis/results/opcode_data_cei.csv) dan [`analysis/results/opcode_data_mutex.csv`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/analysis/results/opcode_data_mutex.csv).
>
> Data dikumpulkan via [`analysis/opcode_trace.js`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/analysis/opcode_trace.js) yang menggunakan RPC method `debug_traceTransaction` dari Hardhat Node untuk menghitung jumlah opcode per transaksi.

---

## 14.1 Opcode SecureVault (CEI) — 30 Iterasi

**File sumber:** `analysis/results/opcode_data_cei.csv`

| Iterasi | Gas | SSTORE | SLOAD | Total Opcodes |
|--------:|----:|-------:|------:|--------------:|
| 1  | 29.968 | 1 | 1 | 137 |
| 2  | 29.968 | 1 | 1 | 137 |
| 3  | 29.968 | 1 | 1 | 137 |
| 4  | 29.968 | 1 | 1 | 137 |
| 5  | 29.968 | 1 | 1 | 137 |
| 6  | 29.968 | 1 | 1 | 137 |
| 7  | 29.968 | 1 | 1 | 137 |
| 8  | 29.968 | 1 | 1 | 137 |
| 9  | 29.968 | 1 | 1 | 137 |
| 10 | 29.968 | 1 | 1 | 137 |
| 11 | 29.968 | 1 | 1 | 137 |
| 12 | 29.968 | 1 | 1 | 137 |
| 13 | 29.968 | 1 | 1 | 137 |
| 14 | 29.968 | 1 | 1 | 137 |
| 15 | 29.968 | 1 | 1 | 137 |
| 16 | 29.968 | 1 | 1 | 137 |
| 17 | 29.968 | 1 | 1 | 137 |
| 18 | 29.968 | 1 | 1 | 137 |
| 19 | 29.968 | 1 | 1 | 137 |
| 20 | 29.968 | 1 | 1 | 137 |
| 21 | 29.968 | 1 | 1 | 137 |
| 22 | 29.968 | 1 | 1 | 137 |
| 23 | 29.968 | 1 | 1 | 137 |
| 24 | 29.968 | 1 | 1 | 137 |
| 25 | 29.968 | 1 | 1 | 137 |
| 26 | 29.968 | 1 | 1 | 137 |
| 27 | 29.968 | 1 | 1 | 137 |
| 28 | 29.968 | 1 | 1 | 137 |
| 29 | 29.968 | 1 | 1 | 137 |
| 30 | 29.968 | 1 | 1 | 137 |

**Ringkasan CEI:** Gas 29.968 (konstan), SSTORE 1 (konstan), SLOAD 1 (konstan), Total Opcodes 137 (konstan).

**Penjelasan 137 opcode di SecureVault:**
- **1 SSTORE:** `balances[msg.sender] = 0` (menyimpan 0 ke slot balances).
- **1 SLOAD:** `balances[msg.sender]` (membaca saldo untuk dicek).
- **135 opcode lainnya:** PUSH, MLOAD, MSTORE, CALL, RETURN, JUMPI, JUMPDEST, LOG3 (event), DUP, SWAP, dll.

---

## 14.2 Opcode MutexVault (Mutex Lock) — 30 Iterasi

**File sumber:** `analysis/results/opcode_data_mutex.csv`

| Iterasi | Gas | SSTORE | SLOAD | Total Opcodes |
|--------:|----:|-------:|------:|--------------:|
| 1  | 32.363 | 3 | 2 | 165 |
| 2  | 32.363 | 3 | 2 | 165 |
| 3  | 32.363 | 3 | 2 | 165 |
| 4  | 32.363 | 3 | 2 | 165 |
| 5  | 32.363 | 3 | 2 | 165 |
| 6  | 32.363 | 3 | 2 | 165 |
| 7  | 32.363 | 3 | 2 | 165 |
| 8  | 32.363 | 3 | 2 | 165 |
| 9  | 32.363 | 3 | 2 | 165 |
| 10 | 32.363 | 3 | 2 | 165 |
| 11 | 32.363 | 3 | 2 | 165 |
| 12 | 32.363 | 3 | 2 | 165 |
| 13 | 32.363 | 3 | 2 | 165 |
| 14 | 32.363 | 3 | 2 | 165 |
| 15 | 32.363 | 3 | 2 | 165 |
| 16 | 32.363 | 3 | 2 | 165 |
| 17 | 32.363 | 3 | 2 | 165 |
| 18 | 32.363 | 3 | 2 | 165 |
| 19 | 32.363 | 3 | 2 | 165 |
| 20 | 32.363 | 3 | 2 | 165 |
| 21 | 32.363 | 3 | 2 | 165 |
| 22 | 32.363 | 3 | 2 | 165 |
| 23 | 32.363 | 3 | 2 | 165 |
| 24 | 32.363 | 3 | 2 | 165 |
| 25 | 32.363 | 3 | 2 | 165 |
| 26 | 32.363 | 3 | 2 | 165 |
| 27 | 32.363 | 3 | 2 | 165 |
| 28 | 32.363 | 3 | 2 | 165 |
| 29 | 32.363 | 3 | 2 | 165 |
| 30 | 32.363 | 3 | 2 | 165 |

**Ringkasan Mutex:** Gas 32.363 (konstan), SSTORE 3 (konstan), SLOAD 2 (konstan), Total Opcodes 165 (konstan).

**Penjelasan 3 SSTORE + 2 SLOAD di MutexVault:**
- **1 SSTORE:** `balances[msg.sender] = 0` (sama dengan CEI).
- **2 SSTORE tambahan:** `_status = _ENTERED` di awal + `_status = _NOT_ENTERED` di akhir (modifier `nonReentrant`).
- **1 SLOAD:** `balances[msg.sender]` (sama dengan CEI).
- **1 SLOAD tambahan:** Baca `_status` untuk dicek.

---

## 14.3 Perbandingan Selisih (Gambar 18 dan 20 di skripsi)

| Metrik | CEI | Mutex | Selisih | % Lebih Banyak |
|--------|----:|-------|--------:|---------------:|
| Gas | 29.968 | 32.363 | **+2.395** | **+7,40 %** |
| SSTORE | 1 | 3 | **+2** | **+66,67 %** |
| SLOAD | 1 | 2 | **+1** | **+50,00 %** |
| Total Opcodes | 137 | 165 | **+28** | **+17,07 %** |

**Penjelasan selisih (Bab 4.4.4):**
- **2 SSTORE tambahan** dari `_status` lock/unlock. Setiap SSTORE warm ≈ 2.900 gas → kontribusi ~5.800 gas.
- **1 SLOAD tambahan** dari cek `_status` ≈ 100 gas → kontribusi ~100 gas.
- **Total kontribusi opcode-level: ~5.900 gas.** Selisih aktual hanya 2.395 gas karena sebagian SSTORE memanfaatkan EIP-2200 (warm storage) yang lebih murah, dan beberapa opcode lain (CALL, LOG) yang muncul di CEI juga muncul di Mutex sehingga biaya digabung.

— **Akhir Lampiran 14** —
