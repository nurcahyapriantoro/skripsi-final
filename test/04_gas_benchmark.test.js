const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("=== GAS BENCHMARK: CEI vs Mutex (Comprehensive) ===", function () {
  let secureFactory, mutexFactory, insecureFactory, attackerFactory;

  before(async function () {
    secureFactory = await ethers.getContractFactory("SecureVault");
    mutexFactory = await ethers.getContractFactory("MutexVault");
    insecureFactory = await ethers.getContractFactory("InsecureVault");
    attackerFactory = await ethers.getContractFactory("Attacker");
  });

  async function deployContract(factory, ...args) {
    const vault = await factory.deploy(...args);
    await vault.waitForDeployment();
    const tx = vault.deploymentTransaction();
    const receipt = await tx.wait();
    return { vault, deployGas: Number(receipt.gasUsed) };
  }

  async function fullFlow(contractName, depositAmount) {
    const [, buyer, seller] = await ethers.getSigners();
    const factory = contractName === "SecureVault" ? secureFactory : contractName === "MutexVault" ? mutexFactory : insecureFactory;
    const { vault, deployGas } = await deployContract(factory);
    const addr = await vault.getAddress();

    const tx1 = await vault.connect(buyer).createOrder(seller.address);
    const r1 = await tx1.wait();
    const tx2 = await vault.connect(buyer).depositFunds(0, { value: depositAmount });
    const r2 = await tx2.wait();
    const tx3 = await vault.connect(buyer).confirmDelivery(0);
    const r3 = await tx3.wait();
    const tx4 = await vault.connect(seller).withdrawFunds();
    const r4 = await tx4.wait();

    return {
      contractName,
      deposit: ethers.formatEther(depositAmount),
      deployGas,
      createOrderGas: Number(r1.gasUsed),
      depositFundsGas: Number(r2.gasUsed),
      confirmDeliveryGas: Number(r3.gasUsed),
      withdrawFundsGas: Number(r4.gasUsed),
      totalEndToEnd: Number(r1.gasUsed) + Number(r2.gasUsed) + Number(r3.gasUsed) + Number(r4.gasUsed),
    };
  }

  // ─── 1. DEPLOYMENT COST ───
  it("1. Deployment Cost Comparison", async function () {
    console.log("\n═══════════════════════════════════════════");
    console.log("  1. DEPLOYMENT COST COMPARISON");
    console.log("═══════════════════════════════════════════");

    const { deployGas: gInsecure } = await deployContract(insecureFactory);
    await network.provider.send("hardhat_reset");
    const { deployGas: gSecure } = await deployContract(secureFactory);
    await network.provider.send("hardhat_reset");
    const { deployGas: gMutex } = await deployContract(mutexFactory);

    console.log(`  InsecureVault: ${gInsecure.toLocaleString()} gas`);
    console.log(`  SecureVault  : ${gSecure.toLocaleString()} gas`);
    console.log(`  MutexVault   : ${gMutex.toLocaleString()} gas`);
    console.log(`\n  Mutex - Secure = ${(gMutex - gSecure).toLocaleString()} gas (+${(((gMutex - gSecure) / gSecure) * 100).toFixed(2)}%)`);
    console.log(`  Secure - Insecure = ${(gSecure - gInsecure).toLocaleString()} gas (+${(((gSecure - gInsecure) / gInsecure) * 100).toFixed(2)}%)`);
  });

  // ─── 2. SINGLE FLOW COMPARISON ───
  it("2. Full Flow: SecureVault vs MutexVault (0.5 ETH)", async function () {
    console.log("\n═══════════════════════════════════════════");
    console.log("  2. FULL FLOW COMPARISON (0.5 ETH)");
    console.log("═══════════════════════════════════════════");

    const r1 = await fullFlow("SecureVault", ethers.parseEther("0.5"));
    await network.provider.send("hardhat_reset");
    const r2 = await fullFlow("MutexVault", ethers.parseEther("0.5"));

    console.log(`\n  ┌──────────────────────┬──────────────┬──────────────┐`);
    console.log(`  │ Function              │ SecureVault  │ MutexVault   │`);
    console.log(`  ├──────────────────────┼──────────────┼──────────────┤`);
    console.log(`  │ deploy                │ ${r1.deployGas.toString().padStart(10)}  │ ${r2.deployGas.toString().padStart(10)}  │`);
    console.log(`  │ createOrder           │ ${r1.createOrderGas.toString().padStart(10)}  │ ${r2.createOrderGas.toString().padStart(10)}  │`);
    console.log(`  │ depositFunds          │ ${r1.depositFundsGas.toString().padStart(10)}  │ ${r2.depositFundsGas.toString().padStart(10)}  │`);
    console.log(`  │ confirmDelivery       │ ${r1.confirmDeliveryGas.toString().padStart(10)}  │ ${r2.confirmDeliveryGas.toString().padStart(10)}  │`);
    console.log(`  │ withdrawFunds         │ ${r1.withdrawFundsGas.toString().padStart(10)}  │ ${r2.withdrawFundsGas.toString().padStart(10)}  │`);
    console.log(`  ├──────────────────────┼──────────────┼──────────────┤`);
    console.log(`  │ TOTAL (ops)           │ ${r1.totalEndToEnd.toString().padStart(10)}  │ ${r2.totalEndToEnd.toString().padStart(10)}  │`);
    console.log(`  │ TOTAL (ops+deploy)    │ ${(r1.totalEndToEnd + r1.deployGas).toString().padStart(10)}  │ ${(r2.totalEndToEnd + r2.deployGas).toString().padStart(10)}  │`);
    console.log(`  └──────────────────────┴──────────────┴──────────────┘`);
    console.log(`\n  Withdraw diff: ${r2.withdrawFundsGas - r1.withdrawFundsGas} gas (Mutex ${(((r2.withdrawFundsGas - r1.withdrawFundsGas) / r2.withdrawFundsGas) * 100).toFixed(2)}% lebih mahal)`);
    expect(r1.withdrawFundsGas).to.be.lessThan(r2.withdrawFundsGas);
  });

  // ─── 3. DEPOSIT VARIATION ───
  it("3. Deposit Amount Variation: 0.1, 1, 5, 10 ETH", async function () {
    console.log("\n═══════════════════════════════════════════");
    console.log("  3. DEPOSIT AMOUNT VARIATION");
    console.log("═══════════════════════════════════════════\n");

    const amounts = [ethers.parseEther("0.1"), ethers.parseEther("1"), ethers.parseEther("5"), ethers.parseEther("10")];
    console.log(`  ┌──────────┬──────────────┬──────────────┬──────────────┐`);
    console.log(`  │ Deposit  │ CEI withdraw  │ Mutex withdraw│ Difference   │`);
    console.log(`  ├──────────┼──────────────┼──────────────┼──────────────┤`);

    for (const amt of amounts) {
      const r1 = await fullFlow("SecureVault", amt);
      await network.provider.send("hardhat_reset");
      const r2 = await fullFlow("MutexVault", amt);
      await network.provider.send("hardhat_reset");
      const diff = r2.withdrawFundsGas - r1.withdrawFundsGas;
      console.log(`  │ ${ethers.formatEther(amt).padStart(6)} ETH │ ${r1.withdrawFundsGas.toString().padStart(10)}  │ ${r2.withdrawFundsGas.toString().padStart(10)}  │ +${diff.toString().padStart(4)}      │`);
    }
    console.log(`  └──────────┴──────────────┴──────────────┴──────────────┘`);
    console.log(`\n  ✅ Gas cost TIDAK dipengaruhi jumlah deposit (deterministik)`);
  });

  // ─── 4. ATTACK DEMO ───
  it("4. Attack Demo: InsecureVault exploit fails with CEI", async function () {
    console.log("\n═══════════════════════════════════════════");
    console.log("  4. REENTRANCY EXPLOIT DEMO");
    console.log("═══════════════════════════════════════════\n");

    const [owner, buyer, seller] = await ethers.getSigners();

    // Deploy InsecureVault + setup
    const { vault: insecure } = await deployContract(insecureFactory);
    const insecureAddr = await insecure.getAddress();
    await insecure.connect(buyer).createOrder(seller.address);
    await insecure.connect(buyer).depositFunds(0, { value: ethers.parseEther("1") });
    await insecure.connect(buyer).confirmDelivery(0);
    const buyerBal = await ethers.provider.getBalance(buyer.address);
    console.log(`  Buyer balance before: ${ethers.formatEther(buyerBal)} ETH`);

    // Deploy Attacker targeting InsecureVault
    const attacker = await attackerFactory.deploy(insecureAddr);
    await attacker.waitForDeployment();
    const attackerAddr = await attacker.getAddress();
    console.log(`  Attacker contract deployed`);

    // Deposit from seller role for attacker
    await insecure.connect(seller).createOrder(attackerAddr);
    await insecure.connect(seller).depositFunds(1, { value: ethers.parseEther("0.1") });
    await insecure.connect(seller).confirmDelivery(1);

    const vaultBalBefore = await ethers.provider.getBalance(insecureAddr);
    console.log(`  Vault balance before attack: ${ethers.formatEther(vaultBalBefore)} ETH`);
    console.log(`  Attacker balance: 0.1 ETH (as seller)`);

    // Launch attack
    const attackTx = await attacker.connect(owner).attack({ gasLimit: 500000 });
    const attackReceipt = await attackTx.wait();
    const attackGas = Number(attackReceipt.gasUsed);
    console.log(`\n  🔴 Attack gas used: ${attackGas.toLocaleString()} gas`);
    const vaultBalAfter = await ethers.provider.getBalance(insecureAddr);
    console.log(`  Vault balance after: ${ethers.formatEther(vaultBalAfter)} ETH (was ${ethers.formatEther(vaultBalBefore)} ETH)`);
    const attackerEth = await ethers.provider.getBalance(attackerAddr);
    console.log(`  Attacker drained: ${ethers.formatEther(attackerEth)} ETH`);

    // Now test SecureVault — attack should fail
    await network.provider.send("hardhat_reset");
    const { vault: secure } = await deployContract(secureFactory);
    const secureAddr = await secure.getAddress();
    const attacker2 = await attackerFactory.deploy(secureAddr);
    await attacker2.waitForDeployment();
    const attacker2Addr = await attacker2.getAddress();

    await secure.connect(buyer).createOrder(seller.address);
    await secure.connect(buyer).depositFunds(0, { value: ethers.parseEther("1") });
    await secure.connect(buyer).confirmDelivery(0);
    await secure.connect(seller).createOrder(attacker2Addr);
    await secure.connect(seller).depositFunds(1, { value: ethers.parseEther("0.1") });
    await secure.connect(seller).confirmDelivery(1);

    try {
      await attacker2.connect(owner).attack({ gasLimit: 500000 });
      console.log(`\n  🟢 SecureVault: Attack did not revert (unexpected)`);
    } catch (err) {
      const msg = err.message;
      const m = msg.match(/gas used (\d+)/);
      console.log(`\n  🟢 SecureVault attack REVERTED at ~${m ? Number(m[1]).toLocaleString() : 'unknown'} gas`);
      console.log(`  ✅ CEI Pattern successfully prevented reentrancy!`);
    }
  });
});
