# Lampiran 11. Konfigurasi Lingkungan dan Dependensi

> **Cross-reference:** Mendukung **Tabel 2 (Rincian perangkat lunak dan lingkungan pengujian)** di **Bab 3.2** dan bagian metodologi di **Bab 3**.
>
> **Repositori:** [github.com/nurcahyapriantoro/skripsi-final](https://github.com/nurcahyapriantoro/skripsi-final)
>
> Lampiran ini memberikan reproducibility checklist untuk reviewer yang ingin mereplikasi eksperimen.

---

## 11.1 Versi Perangkat Lunak

| Komponen | Versi |
|----------|-------|
| Node.js | v22.10.0 |
| Python | 3.11.5 |
| Solidity (solc) | 0.8.28 |
| Hardhat | 2.28.6 |
| @nomicfoundation/hardhat-toolbox | 5.0.0 |
| @openzeppelin/contracts | 5.6.1 |
| hardhat-gas-reporter | 1.0.10 |
| solhint | 4.5.4 |
| dotenv | 17.4.2 |
| ethers.js | 6.x (dari hardhat-toolbox) |
| Chai/Mocha | via hardhat-toolbox |
| Slither | 0.11.5 |

---

## 11.2 `package.json` — Dependensi Proyek

**Lokasi:** [`package.json`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/package.json)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/package.json

```json
{
  "name": "reentrancy-research",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "test": "hardhat test",
    "lint": "solhint 'contracts/**/*.sol'",
    "compile": "hardhat compile",
    "deploy:testnet": "hardhat run scripts/deploy_testnet.js --network sepolia",
    "attack:testnet": "hardhat run scripts/run_attack_testnet.js --network sepolia",
    "dashboard": "node presentation/server.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": "",
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "dotenv": "^17.4.2",
    "hardhat": "^2.28.6",
    "hardhat-gas-reporter": "^1.0.10",
    "solhint": "^4.5.4"
  },
  "dependencies": {
    "@openzeppelin/contracts": "^5.6.1"
  }
}
```

**Penjelasan blok:**
- **`scripts.test`:** Menjalankan seluruh test Hardhat (5 file, 22 test passing).
- **`scripts.compile`:** Kompilasi kontrak; setara `npx hardhat compile`.
- **`scripts.deploy:testnet` / `attack:testnet`:** Deploy dan jalankan serangan di Sepolia.
- **`devDependencies`:** Tooling pengembangan (Hardhat, linter, gas reporter).
- **`dependencies`:** Hanya `@openzeppelin/contracts` — digunakan oleh MutexVault untuk ReentrancyGuard. SecureVault tidak punya dependensi runtime.

---

## 11.3 `hardhat.config.js` — Konfigurasi Hardhat

**Lokasi:** [`hardhat.config.js`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/hardhat.config.js)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/hardhat.config.js

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;

const networks = {
  hardhat: {
    allowUnlimitedContractSize: false,
    blockGasLimit: 30000000,
  },
};

if (PRIVATE_KEY && SEPOLIA_RPC_URL && PRIVATE_KEY.length === 64) {
  networks.sepolia = {
    url: SEPOLIA_RPC_URL,
    accounts: [`0x${PRIVATE_KEY}`],
    chainId: 11155111,
  };
} else if (PRIVATE_KEY && SEPOLIA_RPC_URL && PRIVATE_KEY.startsWith("0x") && PRIVATE_KEY.length === 66) {
  networks.sepolia = {
    url: SEPOLIA_RPC_URL,
    accounts: [PRIVATE_KEY],
    chainId: 11155111,
    timeout: 120000,
    httpHeaders: { 'Content-Type': 'application/json' },
  };
}

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks,
  gasReporter: {
    enabled: true,
    currency: "USD",
    outputFile: "analysis/results/gas_report.txt",
    noColors: true,
    excludeContracts: [],
    src: "./contracts",
  },
  mocha: {
    timeout: 120000,
  },
};
```

**Penjelasan blok:**
- **`solidity.version: 0.8.28`:** Versi kompiler yang digunakan di semua kontrak dan skrip deployment. Konsisten dengan versi OpenZeppelin 5.6.1 (`^0.8.20`).
- **`optimizer.enabled: true, runs: 200`:** Standar industri untuk deployment produksi. Runs = 200 menyeimbangkan biaya deployment vs runtime.
- **`networks.hardhat.blockGasLimit: 30000000`:** Default Ethereum mainnet. Penting untuk eksperimen agar loop reentrancy 24× tidak terputus.
- **`networks.sepolia`:** Hanya diaktifkan jika `.env` menyediakan `PRIVATE_KEY` (64 atau 66 hex chars) dan `SEPOLIA_RPC_URL` (Infura). Tidak ada nilai yang di-hardcode.
- **`gasReporter.outputFile`:** Output gas reporter disimpan di `analysis/results/gas_report.txt` (lihat Lampiran 12).
- **`mocha.timeout: 120000`:** 120 detik per test, cukup untuk operasi yang melibatkan banyak TX (deploy 4 kontrak + 3 order + deposit + confirmDelivery + attack).

---

## 11.4 Struktur Direktori Proyek

```
reentrancy-research/
├── README.md
├── package.json
├── package-lock.json
├── hardhat.config.js
├── .env                                # PRIVATE_KEY & SEPOLIA_RPC_URL (git-ignored)
├── .env.example                        # template
├── .solhint.json                       # Solidity linter config
├── contracts/
│   ├── vulnerable/
│   │   └── InsecureVault.sol           # Kontrak rentan (Lampiran 9.1)
│   ├── secure/
│   │   ├── SecureVault.sol             # Kontrak CEI (Lampiran 9.2)
│   │   └── MutexVault.sol              # Kontrak mutex (Lampiran 9.3)
│   └── attacker/
│       └── Attacker.sol                # Kontrak penyerang (Lampiran 9.4)
├── test/
│   ├── 01_exploit_insecure.test.js     # Eksperimen 1 (Lampiran 10.1)
│   ├── 02_mitigate_secure.test.js      # Eksperimen 2 (Lampiran 10.2)
│   ├── 03_mitigate_mutex.test.js       # Eksperimen 3 (Lampiran 10.3)
│   ├── 04_gas_benchmark.test.js        # Eksperimen 4 (Lampiran 10.4)
│   └── 05_legitimate_users.test.js     # Eksperimen 5 (Lampiran 10.5)
├── scripts/
│   ├── deploy_local.js                 # Deploy ke Hardhat Network
│   ├── deploy_testnet.js               # Deploy ke Sepolia (Lampiran 16)
│   ├── run_attack_testnet.js           # Jalankan serangan di Sepolia (Lampiran 16)
│   ├── sepolia_skripsi_scenario.js     # Skenario persis Bab 3.6 (Lampiran 16)
│   ├── sepolia_proposal.js
│   ├── sepolia_attack_only.js
│   ├── sepolia_attack_mutex.js
│   ├── sepolia_full_test.js
│   ├── sepolia_minimal.js
│   ├── sepolia_direct.js
│   └── cei_test_sepolia.js
├── slither/
│   ├── run_slither.sh                  # Skrip Slither (Lampiran 5)
│   ├── insecure_vault_report.json
│   ├── secure_vault_report.json
│   └── mutex_vault_report.json
├── analysis/
│   ├── results/
│   │   ├── gas_report.txt              # Hardhat Gas Reporter (Lampiran 12)
│   │   ├── gas_data_cei.csv            # 30 iterasi (Lampiran 7)
│   │   ├── gas_data_mutex.csv          # 30 iterasi (Lampiran 7)
│   │   ├── opcode_data_cei.csv         # Opcode (Lampiran 14)
│   │   ├── opcode_data_mutex.csv       # Opcode (Lampiran 14)
│   │   ├── statistical_report.txt      # Statistik (Lampiran 13)
│   │   ├── gas_comparison_plot.png     # Box plot
│   │   └── walkthrough.md              # Walkthrough eksekusi
│   ├── collect_gas_data.js             # Skrip pengumpul data
│   ├── opcode_trace.js                 # Skrip trace opcode
│   ├── statistical_analysis.py         # Skrip analisis statistik
│   ├── sequence_diagram.puml           # Source diagram (Lampiran 15)
│   ├── activity_diagram.md             # Source activity diagram
│   ├── Lampiran_5_Slither_Output.md
│   ├── Lampiran_9_Source_Kontrak_Lengkap.md   # file ini juga
│   ├── Lampiran_10_Test_Hardhat.md            # file ini juga
│   └── Lampiran_11_Konfigurasi_Lingkungan.md  # file ini
├── cei-analyzer/                       # Prototipe AI (Lampiran 17)
│   ├── src/
│   │   └── App.jsx
│   ├── public/
│   ├── functions/                      # Firebase Cloud Functions (arsitektur awal)
│   ├── firebase.json
│   └── ...
├── cei-analyzer-api/                   # Serverless proxy DeepSeek (Lampiran 17)
│   ├── api/
│   │   └── analyze.js
│   └── vercel.json
├── grafik_atau_diagram/                # PNG grafik Bab 4
└── presentation/                       # Dasbor presentasi
```

---

## 11.5 `.env` — Variabel Sensitif (Tidak di-commit)

**Template `.env.example`:**
```
# Sepolia Testnet
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
PRIVATE_KEY=your_private_key_without_0x_prefix
```

**Lokasi:** [`.env.example`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/.env.example) (jika ada di root, lihat juga `cei-analyzer-api/.env.example`).

**Catatan keamanan:**
- File `.env` asli **tidak pernah** di-commit (`.gitignore` berisi `.env`).
- Kunci DeepSeek untuk AI Analyzer disimpan di Vercel dashboard sebagai env var terenkripsi.
- Kunci lama pernah terekspos ke commit history (lihat commit `5b4544c` dan `0dbc57e`); kunci tersebut sudah di-revoke dan diganti.

---

## 11.6 Konfigurasi Slither

**Lokasi:** [`slither/run_slither.sh`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/slither/run_slither.sh)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/slither/run_slither.sh

```bash
#!/bin/bash
echo "=== Running Slither on InsecureVault ==="
slither ../contracts/vulnerable/InsecureVault.sol \
  --solc-remaps "@openzeppelin=../node_modules/@openzeppelin" \
  --detect reentrancy-eth,reentrancy-no-eth,reentrancy-benign,reentrancy-events \
  --json insecure_vault_report.json --print human-summary

echo ""
echo "=== Running Slither on SecureVault ==="
slither ../contracts/secure/SecureVault.sol \
  --solc-remaps "@openzeppelin=../node_modules/@openzeppelin" \
  --detect reentrancy-eth,reentrancy-no-eth,reentrancy-benign,reentrancy-events \
  --json secure_vault_report.json --print human-summary

echo ""
echo "=== Running Slither on MutexVault ==="
slither ../contracts/secure/MutexVault.sol \
  --solc-remaps "@openzeppelin=../node_modules/@openzeppelin" \
  --detect reentrancy-eth,reentrancy-no-eth \
  --json mutex_vault_report.json --print human-summary

echo ""
echo "=== Slither analysis complete. See JSON reports in slither/ directory ==="
```

**Penjelasan:**
- **`--solc-remaps`:** Mengarahkan Slither ke instalasi OpenZeppelin lokal.
- **`--detect`:** Hanya mengaktifkan detektor reentrancy (default-nya Slither menjalankan semua >90 detektor; opsi ini mempersempit output).
- **`--json`:** Simpan laporan terstruktur untuk Lampiran 5.
- **`--print human-summary`:** Cetak ringkasan ke terminal untuk debugging.

---

## 11.7 Perintah Reproduksi Eksperimen

Untuk mereplikasi hasil dari awal:

```bash
# 1. Clone repositori
git clone https://github.com/nurcahyapriantoro/skripsi-final.git
cd skripsi-final

# 2. Install dependensi
npm install

# 3. Compile kontrak
npx hardhat compile

# 4. Jalankan seluruh test (22 test, 5 file)
npx hardhat test

# 5. Hasilkan laporan gas
# (otomatis dari test 04) → analysis/results/gas_report.txt

# 6. Jalankan Slither
cd slither
./run_slither.sh
cd ..

# 7. (Opsional) Deploy ke Sepolia
# Edit .env dengan PRIVATE_KEY dan SEPOLIA_RPC_URL
npx hardhat run scripts/sepolia_skripsi_scenario.js --network sepolia
```

— **Akhir Lampiran 11** —
