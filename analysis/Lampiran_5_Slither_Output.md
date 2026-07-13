# Lampiran 5. Ringkasan Keluaran Uji Kerentanan dengan Slither

## L5.1 Perangkat dan Konfigurasi

Uji kerentanan statis dilakukan menggunakan **Slither versi 0.11.5** dengan kompiler **Solidity 0.8.28** terhadap tiga kontrak utama penelitian. Slither dijalankan melalui skrip `slither/run_slither.sh` yang memanggil tiap kontrak secara individual dengan *solc-remap* terhadap pustaka OpenZeppelin serta detektor khusus reentrancy.

**Tabel L5.1 Spesifikasi lingkungan uji Slither**

| Komponen | Versi / Nilai |
|----------|---------------|
| Slither | 0.11.5 |
| Solidity (solc) | 0.8.28 |
| Python | 3.11.5 |
| OpenZeppelin Contracts | `ReentrancyGuard` (untuk MutexVault) |
| OS | Windows 11 (PowerShell 7) |
| Direktori kerja | `slither/` |
| Format keluaran | JSON terstruktur per kontrak |

## L5.2 Perintah Eksekusi

Perintah yang dijalankan (diadaptasi dari `slither/run_slither.sh`):

```bash
slither ../contracts/vulnerable/InsecureVault.sol \
  --solc-remaps "@openzeppelin=../node_modules/@openzeppelin" \
  --detect reentrancy-eth,reentrancy-no-eth,reentrancy-benign,reentrancy-events \
  --json insecure_vault_report.json --print human-summary

slither ../contracts/secure/SecureVault.sol \
  --solc-remaps "@openzeppelin=../node_modules/@openzeppelin" \
  --detect reentrancy-eth,reentrancy-no-eth,reentrancy-benign,reentrancy-events \
  --json secure_vault_report.json --print human-summary

slither ../contracts/secure/MutexVault.sol \
  --solc-remaps "@openzeppelin=../node_modules/@openzeppelin" \
  --detect reentrancy-eth,reentrancy-no-eth \
  --json mutex_vault_report.json --print human-summary
```

Penggunaan detektor spesifik (bukan mode default seluruh detektor) ditujukan agar keluaran Slither terfokus pada keluarga *reentrancy* sesuai ruang lingkup pengujian.

## L5.3 Hasil Deteksi per Kontrak

### L5.3.1 InsecureVault.sol (vulnerable)

Slither mendeteksi **dua temuan** pada fungsi `withdrawFunds()`:

**(a) Reentrancy dengan transfer ETH — High impact**

```
Reentrancy in InsecureVault.withdrawFunds() (contracts/vulnerable/InsecureVault.sol#70-80)
    External calls:
    - (success,None) = msg.sender.call{value: amount}() (contracts/vulnerable/InsecureVault.sol#74)
    State variables written after the call(s):
    - balances[msg.sender] = 0 (contracts/vulnerable/InsecureVault.sol#77)
    InsecureVault.balances (contracts/vulnerable/InsecureVault.sol#19) can be used in cross function reentrancies:
    - InsecureVault.depositFunds(uint256) (#44-57)
    - InsecureVault.getBalance(address) (#86-88)
    - InsecureVault.withdrawFunds() (#70-80)
```

- **Check**: `reentrancy-eth`
- **Impact**: High | **Confidence**: Medium
- **Akar masalah**: `balances[msg.sender]` baru di-nol-kan *setelah* low-level `call` berhasil, sehingga panggilan reentrant dari `fallback`/`receive()` penyerang akan membaca `balances` yang masih bernilai awal dan dapat melakukan penarikan berulang.

**(b) Event emitted setelah external call — Low impact**

```
Reentrancy in InsecureVault.withdrawFunds() (contracts/vulnerable/InsecureVault.sol#70-80)
    External calls:
    - (success,None) = msg.sender.call{value: amount}() (contracts/vulnerable/InsecureVault.sol#74)
    Event emitted after the call(s):
    - FundsWithdrawn(msg.sender,amount) (contracts/vulnerable/InsecureVault.sol#79)
```

- **Check**: `reentrancy-events`
- **Impact**: Low | **Confidence**: Medium

Selain itu, Slither juga mengeluarkan temuan *low-level-calls* (Informational) dan lima temuan *naming-convention* (Informational, parameter underscore-prefix) yang tidak relevan dengan keamanan.

### L5.3.2 SecureVault.sol (CEI pattern)

Slither **tidak mendeteksi** isu High pada `SecureVault.sol`. Satu-satunya temuan relevan adalah `low-level-calls` (Informational) yang menandai keberadaan `msg.sender.call{value: amount}` pada baris 76 — bukan kerentanan karena efek *state* sudah dilakukan sebelum panggilan eksternal.

Urutan eksekusi `withdrawFunds()` telah memenuhi pola **CEI (Checks–Effects–Interactions)**:

```
[CHECKS]       require(amount > 0, "SecureVault: no funds to withdraw")   // baris 71
[EFFECTS]      balances[msg.sender] = 0;                                   // baris 73
               emit FundsWithdrawn(msg.sender, amount);                     // baris 74
[INTERACTIONS] (success, ) = msg.sender.call{value: amount}("");           // baris 76
               require(success, "SecureVault: ETH transfer failed");       // baris 77
```

Karena `balances[msg.sender]` di-nol-kan *sebelum* `call`, serangan reentrancy tidak dapat melewati pengecekan saldo pada pemanggilan berikutnya.

### L5.3.3 MutexVault.sol (ReentrancyGuard)

Slither tetap menandai `MutexVault.withdrawFunds()` sebagai **reentrancy-eth (High)**:

```
Reentrancy in MutexVault.withdrawFunds() (contracts/secure/MutexVault.sol#70-80)
    External calls:
    - (success,None) = msg.sender.call{value: amount}() (contracts/secure/MutexVault.sol#74)
    State variables written after the call(s):
    - balances[msg.sender] = 0 (contracts/secure/MutexVault.sol#77)
    MutexVault.balances (contracts/secure/MutexVault.sol#21) can be used in cross function reentrancies:
    - MutexVault.depositFunds(uint256) (#45-57)
    - MutexVault.getBalance(address) (#86-88)
```

Namun temuan ini merupakan **positif palsu (false positive)**. MutexVault `meng-`inherit `ReentrancyGuard` dari OpenZeppelin (`import "@openzeppelin/contracts/utils/ReentrancyGuard.sol"`) dan fungsi `withdrawFunds()` diberi modifier `nonReentrant`. Slither versi 0.11.5 belum secara otomatis mengenali bahwa *storage variable* `_status` yang dimanipulasi oleh `nonReentrant()` (`_NOT_ENTERED` ↔ `_ENTERED`) merupakan pelindung reentrancy, sehingga ia tetap menandai pola "external call lalu tulis state" sebagai risiko.

Temuan-temuan lain pada MutexVault seluruhnya bersifat **Informational** dan bukan merupakan kerentanan:

| Check | Impact | Sumber |
|-------|--------|--------|
| `reentrancy-eth` | High (false positive) | `withdrawFunds()` baris 70–80 — ditutup `nonReentrant` |
| `assembly` (×9) | Informational | `node_modules/@openzeppelin/contracts/utils/StorageSlot.sol` — dependensi OpenZeppelin |
| `low-level-calls` | Informational | `msg.sender.call` baris 74 |
| `naming-convention` (×5) | Informational | Parameter underscore-prefix |
| `pragma` | Informational | Perbedaan versi solidity 0.8.28 vs `^0.8.20` (OZ) |
| `solc-version` | Informational | Informasi rilis minor OpenZeppelin |

## L5.4 Ringkasan Kuantitatif

**Tabel L5.2 Distribusi dampak temuan Slither per kontrak**

| Kontrak | High | Medium | Low | Informational | Total Temuan | Status Keamanan |
|---------|:----:|:------:|:---:|:-------------:|:------------:|-----------------|
| InsecureVault.sol | 1 | 0 | 1 | 6 | 8 | RENTAN |
| SecureVault.sol | 0 | 0 | 0 | 6 | 6 | AMAN |
| MutexVault.sol | 1* | 0 | 0 | 17 | 18 | AMAN *(false positive)* |

\* Positif palsu — dilindungi `nonReentrant` dari OpenZeppelin ReentrancyGuard.

## L5.5 Korelasi dengan Uji Dinamis (Hardhat)

Validasi hasil Slither di atas disajikan secara terstruktur pada **Tabel 2 di halaman 23** yang merangkum tiga dimensi uji: (i) keberhasilan eksploitasi reentrancy pada InsecureVault, (ii) kegagalan eksploitasi pada SecureVault (pola CEI), dan (iii) kegagalan eksploitasi pada MutexVault (modifier `nonReentrant`). Konsistensi ketiga pendekatan tersebut ditunjukkan pada Tabel L5.3.

**Tabel L5.3 Korelasi hasil Slither dengan Hardhat attack test**

| Kontrak | Slither (Statis) | Hardhat (Dinamis) | Kesimpulan |
|---------|------------------|-------------------|------------|
| InsecureVault | High (reentrancy-eth terdeteksi) | Eksploitasi BERHASIL — saldo terkuras | Konsisten: rentan |
| SecureVault | Tidak ada High | Eksploitasi GAGAL — *InvalidReentrancyGuard* revert (pola CEI menahan re-entry) | Konsisten: aman |
| MutexVault | High (false positive) | Eksploitasi GAGAL — *ReentrancyGuard: Reentrant call* revert | Konsisten: aman (Slither tidak mengenali proteksi) |

## L5.6 Diskusi Singkat

Temuan pada Lampiran 5 ini memperlihatkan karakteristik Slither sebagai *static analyzer rule-based*:

1. Slither berhasil mengidentifikasi kerentanan pada InsecureVault dengan presisi tinggi (confidence Medium, impact High), sehingga layak dijadikan validator pertama.
2. Slither menghasilkan positif palsu pada MutexVault karena tidak melacak semantik *storage slot* yang digunakan oleh OpenZeppelin `ReentrancyGuard`. Pada penelitian ini, verifikasi manual dan uji dinamis (Lampiran 6) digunakan untuk mengonfirmasi bahwa `nonReentrant` efektif menutup celah.
3. Slither tidak menemukan High apapun pada SecureVault karena kontrak ini telah mengimplementasikan pola CEI secara disiplin — Efek (`balances[msg.sender] = 0`) terjadi sebelum Interaksi (`call`).

Ketiga kontrak tidak dapat dipisahkan status keamanannya hanya dari Slither; uji dinamis tetap diperlukan untuk memvalidasi positif palsu dan memastikan *exploitability*. Ringkasan keseluruhan verifikasi tiga-dimensi disajikan pada **Tabel 2 halaman 23**.

---

**File lampiran terkait** (tersimpan di repositori):

- `slither/run_slither.sh` — skrip eksekusi
- `slither/insecure_vault_report.json` — JSON temuan InsecureVault
- `slither/secure_vault_report.json` — JSON temuan SecureVault
- `slither/mutex_vault_report.json` — JSON temuan MutexVault