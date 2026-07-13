const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [wallet] = await ethers.getSigners();
  console.log(`Wallet: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(wallet.address))} ETH\n`);

  console.log("=== DEPLOYING MUTEX VAULT ===");
  const MutexVault = await ethers.getContractFactory("MutexVault");
  const mutexVault = await MutexVault.deploy();
  await mutexVault.waitForDeployment();
  const mutexVaultAddr = await mutexVault.getAddress();
  
  const deployTx = await mutexVault.deploymentTransaction();
  await deployTx.wait();
  console.log(`MutexVault deployed to: ${mutexVaultAddr}`);

  console.log("\n=== DEPLOYING ATTACKER ===");
  const Attacker = await ethers.getContractFactory("Attacker");
  const attacker = await Attacker.deploy(mutexVaultAddr);
  await attacker.waitForDeployment();
  const attackerAddr = await attacker.getAddress();
  
  const attDeployTx = await attacker.deploymentTransaction();
  await attDeployTx.wait();
  console.log(`Attacker deployed to: ${attackerAddr}`);

  console.log("\n=== SETTING UP ESCROW (HONEYPOT 2.4 ETH) ===");
  const fakeSeller = ethers.Wallet.createRandom().address;

  // Buyer A (1.5 ETH)
  let tx = await mutexVault.createOrder(fakeSeller);
  await tx.wait();
  tx = await mutexVault.depositFunds(0, { value: ethers.parseEther("1.5") });
  await tx.wait();
  tx = await mutexVault.confirmDelivery(0);
  await tx.wait();
  console.log(`Buyer A deposited 1.5 ETH`);

  // Buyer B (0.8 ETH)
  tx = await mutexVault.createOrder(fakeSeller);
  await tx.wait();
  tx = await mutexVault.depositFunds(1, { value: ethers.parseEther("0.8") });
  await tx.wait();
  tx = await mutexVault.confirmDelivery(1);
  await tx.wait();
  console.log(`Buyer B deposited 0.8 ETH`);

  // Attacker (0.1 ETH)
  tx = await mutexVault.createOrder(attackerAddr);
  await tx.wait();
  tx = await mutexVault.depositFunds(2, { value: ethers.parseEther("0.1") });
  await tx.wait();
  tx = await mutexVault.confirmDelivery(2);
  await tx.wait();
  console.log(`Attacker deposited 0.1 ETH`);

  const vBal = await mutexVault.getContractBalance();
  console.log(`\nVault balance before attack: ${ethers.formatEther(vBal)} ETH`);
  const attBal = await mutexVault.getBalance(attackerAddr);
  console.log(`Attacker vault balance before attack: ${ethers.formatEther(attBal)} ETH`);

  console.log("\n=== EXECUTING ATTACK ===");
  let attackTxHash = "";
  try {
    const attackTx = await attacker.attack({ gasLimit: 500000 });
    attackTxHash = attackTx.hash;
    console.log(`Attack Tx Hash: ${attackTxHash}`);
    await attackTx.wait();
    console.log(`⚠️ ATTACK TRANSACTION SUCCEEDED (This should not happen for MutexVault!)`);
  } catch (error) {
    console.log(`\n✅ ATTACK REVERTED (As expected, ReentrancyGuard works!)`);
    if (error.receipt) {
      console.log(`Failed attack gas used: ${error.receipt.gasUsed}`);
    } else if (error.transaction) {
      console.log(`Failed attack (Transaction Hash from error): ${error.transaction.hash}`);
    } else {
      console.log(`Error: ${error.message.slice(0, 150)}...`);
    }
  }

  const vBalAfter = await mutexVault.getContractBalance();
  console.log(`\nVault balance after attack: ${ethers.formatEther(vBalAfter)} ETH`);
  
  console.log("\nDone.");
}

main().catch(console.error);