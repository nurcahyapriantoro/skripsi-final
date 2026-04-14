/**
 * @file 02_mitigate_secure.test.js
 * @description Proves SecureVault (CEI) successfully blocks the reentrancy attack.
 *              Validates RQ2: CEI effectiveness against reentrancy.
 */
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

    // Deploy Attacker pointing at SecureVault
    const AttackerFactory = await ethers.getContractFactory("Attacker");
    attacker = await AttackerFactory.connect(attackerEOA).deploy(
      await secureVault.getAddress()
    );
    await attacker.waitForDeployment();

    // Setup honeypot — identical to exploit test
    // Buyer A order
    await secureVault.connect(buyerA).createOrder(legitSeller.address);
    await secureVault.connect(buyerA).depositFunds(0, { value: BUYER_A_DEPOSIT });
    await secureVault.connect(buyerA).confirmDelivery(0);

    // Buyer B order
    await secureVault.connect(buyerB).createOrder(legitSeller.address);
    await secureVault.connect(buyerB).depositFunds(1, { value: BUYER_B_DEPOSIT });
    await secureVault.connect(buyerB).confirmDelivery(1);

    // Attacker's order (legitimate entry)
    await secureVault.connect(buyerA).createOrder(await attacker.getAddress());
    await secureVault.connect(buyerA).depositFunds(2, { value: ATTACKER_DEPOSIT });
    await secureVault.connect(buyerA).confirmDelivery(2);
  });

  describe("Attack Resistance Validation", function () {

    it("Attack transaction REVERTS on SecureVault (reentrancy blocked)", async function () {
      // The attack should revert because CEI zeros the balance before the external call
      await expect(
        attacker.connect(attackerEOA).attack()
      ).to.be.reverted;

      console.log("\n[CEI] Attack transaction correctly reverted.");
    });

    it("Attacker receives only their own deposit (0.1 ETH), no illegal profit", async function () {
      // Attack attempt — will revert, meaning all state changes (including the first withdraw) are rolled back
      try {
        await attacker.connect(attackerEOA).attack();
      } catch (_) {
        // Expected revert
      }

      // After a reverted attack, the attacker contract's vault balance is unchanged (still 0.1 ETH)
      // The attacker contract itself holds 0 ETH (revert undid the transfer)
      const attackerContractEth = await attacker.getAttackerBalance();
      expect(attackerContractEth).to.equal(0n);

      // The attacker's vault balance is still 0.1 ETH — no extra funds gained
      const attackerVaultBalance = await secureVault.getBalance(await attacker.getAddress());
      expect(attackerVaultBalance).to.equal(ATTACKER_DEPOSIT);
      console.log("[CEI] Attack reverted. Attacker contract ETH: 0. Vault balance unchanged at 0.1 ETH. No illegal gain.");
    });

    it("Contract balance remains 2.3 ETH (victim funds fully preserved)", async function () {
      // Attack attempt
      try { await attacker.connect(attackerEOA).attack(); } catch (_) {}

      // After the failed attack, the attacker's 0.1 ETH was legitimately withdrawn (CEI allows the first call)
      // So contract should have 2.3 ETH (victim funds) remaining
      const contractBalance = await secureVault.getContractBalance();
      expect(contractBalance).to.be.greaterThanOrEqual(TOTAL_HONEYPOT);

      console.log(`[CEI] Contract balance preserved: ${ethers.formatEther(contractBalance)} ETH`);
    });

    it("SecureVault: profit ≤ 0 (research success criterion met)", async function () {
      // Try attack — reverts
      try { await attacker.connect(attackerEOA).attack(); } catch (_) {}

      const attackerContractEth = await attacker.getAttackerBalance();
      const illegalProfit = attackerContractEth; // Attacker started with 0 ETH in attacker contract

      expect(illegalProfit).to.equal(0n);
      console.log(`[CEI] Illegal profit: ${ethers.formatEther(illegalProfit)} ETH (≤ 0 ✅)`);
    });
  });
});
