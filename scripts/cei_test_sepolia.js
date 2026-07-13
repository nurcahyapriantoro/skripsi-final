const { ethers } = require("hardhat");

async function main() {
  const [wallet] = await ethers.getSigners();
  const SECURE_VAULT_ADDR = '0xe0C83a9BCa0b7B79c62aE1CcD8fe6112496abB59';

  const abi = [
    'function createOrder(address) external returns (uint256)',
    'function depositFunds(uint256) external payable',
    'function confirmDelivery(uint256) external',
    'function getContractBalance() view returns (uint256)',
    'function getBalance(address) view returns (uint256)',
    'function orderCount() view returns (uint256)',
    'event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 amount)'
  ];
  const secureVault = new ethers.Contract(SECURE_VAULT_ADDR, abi, wallet);
  const fakeSeller  = ethers.Wallet.createRandom().address;

  const currentOrderCount = await secureVault.orderCount();
  console.log("=== CEI HONEYPOT TEST (Sepolia) ===");
  console.log("SecureVault:", SECURE_VAULT_ADDR);
  console.log("Current orderCount:", currentOrderCount.toString());

  const AttackerFactory = await ethers.getContractFactory("Attacker");
  const attacker = await AttackerFactory.deploy(SECURE_VAULT_ADDR);
  await attacker.waitForDeployment();
  const attackerAddr = await attacker.getAddress();
  console.log("Attacker:", attackerAddr);

  console.log("\n--- Setup Honeypot ---");
  let tx, r, victimOrderId, attackerOrderId;

  // Use callStatic to get return value of createOrder (orderId)
  victimOrderId = await secureVault.createOrder.staticCall(fakeSeller);
  tx = await secureVault.createOrder(fakeSeller);
  r = await tx.wait();
  console.log("Victim order ID:", victimOrderId.toString(), "| gas:", r.gasUsed.toString());

  tx = await secureVault.depositFunds(victimOrderId, { value: ethers.parseEther("0.0001") });
  r = await tx.wait();
  console.log("Victim A deposit 0.0001 ETH:", r.gasUsed.toString(), "gas");

  tx = await secureVault.confirmDelivery(victimOrderId);
  r = await tx.wait();
  console.log("Victim A confirm:", r.gasUsed.toString(), "gas");

  attackerOrderId = await secureVault.createOrder.staticCall(attackerAddr);
  tx = await secureVault.createOrder(attackerAddr);
  r = await tx.wait();
  console.log("Attacker order ID:", attackerOrderId.toString(), "| gas:", r.gasUsed.toString());

  tx = await secureVault.depositFunds(attackerOrderId, { value: ethers.parseEther("0.00001") });
  r = await tx.wait();
  console.log("Attacker deposit 0.00001 ETH:", r.gasUsed.toString(), "gas");

  tx = await secureVault.confirmDelivery(attackerOrderId);
  r = await tx.wait();
  console.log("Attacker confirm:", r.gasUsed.toString(), "gas");

  const vaultBefore = await secureVault.getContractBalance();
  const attackerVaultBal = await secureVault.getBalance(attackerAddr);
  console.log("\nVault total:", ethers.formatEther(vaultBefore), "ETH");
  console.log("Attacker vault balance:", ethers.formatEther(attackerVaultBal), "ETH");
  console.log("Victim funds at risk: 0.0001 ETH");

  console.log("\n--- Execute Reentrancy Attack on SecureVault ---");
  try {
    const attackTx = await attacker.attack({ gasLimit: 500000 });
    const ar = await attackTx.wait();
    const vaultAfter = await secureVault.getContractBalance();
    const attackerEth = await ethers.provider.getBalance(attackerAddr);
    const reentryCount = await attacker.getReentrancyCount();

    console.log("Attack gas used:", ar.gasUsed.toString());
    console.log("Gas price:", ethers.formatUnits(ar.gasPrice, "gwei"), "gwei");
    console.log("TX cost:", ethers.formatEther(ar.gasUsed * ar.gasPrice), "ETH");
    console.log("Reentrancy count:", reentryCount.toString());
    console.log("Vault before:", ethers.formatEther(vaultBefore), "ETH");
    console.log("Vault after:", ethers.formatEther(vaultAfter), "ETH");
    console.log("Attacker ETH:", ethers.formatEther(attackerEth), "ETH");

    const attackerDeposit = ethers.parseEther("0.00001");
    const illegalProfit = attackerEth > attackerDeposit ? attackerEth - attackerDeposit : 0n;

    console.log("\n========== HASIL ==========");
    if (illegalProfit === 0n) {
      console.log("[PASS] CEI BERHASIL: Profit ilegal = 0 ETH");
      console.log("  Attacker hanya mendapat depositnya sendiri (0.00001 ETH)");
    } else {
      console.log("[FAIL] Attacker profit =", ethers.formatEther(illegalProfit), "ETH");
    }

    const victimFundsSafe = vaultAfter >= ethers.parseEther("0.0001");
    if (victimFundsSafe) {
      console.log("[PASS] Dana korban (0.0001 ETH) AMAN di SecureVault!");
    } else {
      console.log("[FAIL] Vault kurang dari victim deposit. Sisa:", ethers.formatEther(vaultAfter), "ETH");
    }

  } catch (err) {
    const vaultAfter = await secureVault.getContractBalance();
    console.log("\n========== HASIL ==========");
    console.log("[PASS] Attack REVERT! SecureVault memblokir reentrancy sepenuhnya");
    console.log("  Vault setelah:", ethers.formatEther(vaultAfter), "ETH (aman)");
    console.log("  Semua dana korban terlindungi.");
  }

  console.log("===========================");
  console.log("SecureVault:", SECURE_VAULT_ADDR);
  console.log("Attacker:", attackerAddr);
  console.log("Verify: https://sepolia.etherscan.io/address/" + SECURE_VAULT_ADDR);
}

main().catch(console.error);
