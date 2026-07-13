const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("=== EXPERIMENT 2: CEI Mitigation on SecureVault ===", function () {
  let secureVault, attacker;
  let buyerA, buyerB, attackerEOA, legitSeller;

  const BUYER_A_DEPOSIT = ethers.parseEther("1.5");
  const BUYER_B_DEPOSIT = ethers.parseEther("0.8");
  const ATTACKER_DEPOSIT = ethers.parseEther("0.1");
  const TOTAL_HONEYPOT = BUYER_A_DEPOSIT + BUYER_B_DEPOSIT;

  beforeEach(async function () {
    [, buyerA, buyerB, attackerEOA, legitSeller] = await ethers.getSigners();

    const SecureVault = await ethers.getContractFactory("SecureVault");
    secureVault = await SecureVault.deploy();
    await secureVault.waitForDeployment();

    const AttackerFactory = await ethers.getContractFactory("Attacker");
    attacker = await AttackerFactory.connect(attackerEOA).deploy(
      await secureVault.getAddress()
    );
    await attacker.waitForDeployment();

    await secureVault.connect(buyerA).createOrder(legitSeller.address);
    await secureVault.connect(buyerA).depositFunds(0, { value: BUYER_A_DEPOSIT });
    await secureVault.connect(buyerA).confirmDelivery(0);

    await secureVault.connect(buyerB).createOrder(legitSeller.address);
    await secureVault.connect(buyerB).depositFunds(1, { value: BUYER_B_DEPOSIT });
    await secureVault.connect(buyerB).confirmDelivery(1);

    await secureVault.connect(buyerA).createOrder(await attacker.getAddress());
    await secureVault.connect(buyerA).depositFunds(2, { value: ATTACKER_DEPOSIT });
    await secureVault.connect(buyerA).confirmDelivery(2);
  });

  describe("Attack Resistance Validation", function () {

    it("Attack transaction REVERTS on SecureVault (reentrancy blocked)", async function () {
      await expect(
        attacker.connect(attackerEOA).attack()
      ).to.be.reverted;

      console.log("\n[CEI] Attack transaction correctly reverted.");
    });

    it("Attacker receives only their own deposit (0.1 ETH), no illegal profit", async function () {
      try {
        await attacker.connect(attackerEOA).attack();
      } catch (_) {
      }

      const attackerContractEth = await attacker.getAttackerBalance();
      expect(attackerContractEth).to.equal(0n);

      const attackerVaultBalance = await secureVault.getBalance(await attacker.getAddress());
      expect(attackerVaultBalance).to.equal(ATTACKER_DEPOSIT);
      console.log("[CEI] Attack reverted. Attacker contract ETH: 0. Vault balance unchanged at 0.1 ETH. No illegal gain.");
    });

    it("Contract balance remains 2.3 ETH (victim funds fully preserved)", async function () {
      try { await attacker.connect(attackerEOA).attack(); } catch (_) {}

      const contractBalance = await secureVault.getContractBalance();
      expect(contractBalance).to.be.greaterThanOrEqual(TOTAL_HONEYPOT);

      console.log(`[CEI] Contract balance preserved: ${ethers.formatEther(contractBalance)} ETH`);
    });

    it("SecureVault: profit ≤ 0 (research success criterion met)", async function () {
      try { await attacker.connect(attackerEOA).attack(); } catch (_) {}

      const attackerContractEth = await attacker.getAttackerBalance();
      const illegalProfit = attackerContractEth;

      expect(illegalProfit).to.equal(0n);
      console.log(`[CEI] Illegal profit: ${ethers.formatEther(illegalProfit)} ETH (≤ 0 ✅)`);
    });
  });
});
