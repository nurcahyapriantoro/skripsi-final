/**
 * @file 03_mitigate_mutex.test.js
 * @description Proves MutexVault (ReentrancyGuard) also blocks the attack.
 *              Used to confirm both mitigations are security-equivalent.
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("=== EXPERIMENT 3: Mutex Mitigation on MutexVault ===", function () {
  let mutexVault, attacker;
  let buyerA, buyerB, attackerEOA, legitSeller;

  const BUYER_A_DEPOSIT = ethers.parseEther("1.5");
  const BUYER_B_DEPOSIT = ethers.parseEther("0.8");
  const ATTACKER_DEPOSIT = ethers.parseEther("0.1");
  const TOTAL_HONEYPOT = BUYER_A_DEPOSIT + BUYER_B_DEPOSIT;

  beforeEach(async function () {
    [, buyerA, buyerB, attackerEOA, legitSeller] = await ethers.getSigners();

    const MutexVault = await ethers.getContractFactory("MutexVault");
    mutexVault = await MutexVault.deploy();
    await mutexVault.waitForDeployment();

    // Deploy Attacker pointing at MutexVault
    const AttackerFactory = await ethers.getContractFactory("Attacker");
    attacker = await AttackerFactory.connect(attackerEOA).deploy(
      await mutexVault.getAddress()
    );
    await attacker.waitForDeployment();

    // Setup identical honeypot
    await mutexVault.connect(buyerA).createOrder(legitSeller.address);
    await mutexVault.connect(buyerA).depositFunds(0, { value: BUYER_A_DEPOSIT });
    await mutexVault.connect(buyerA).confirmDelivery(0);

    await mutexVault.connect(buyerB).createOrder(legitSeller.address);
    await mutexVault.connect(buyerB).depositFunds(1, { value: BUYER_B_DEPOSIT });
    await mutexVault.connect(buyerB).confirmDelivery(1);

    await mutexVault.connect(buyerA).createOrder(await attacker.getAddress());
    await mutexVault.connect(buyerA).depositFunds(2, { value: ATTACKER_DEPOSIT });
    await mutexVault.connect(buyerA).confirmDelivery(2);
  });

  it("Attack on MutexVault reverts (nonReentrant blocks re-entry)", async function () {
    await expect(
      attacker.connect(attackerEOA).attack()
    ).to.be.reverted;

    console.log("\n[MUTEX] Attack transaction correctly reverted.");
  });

  it("Victim funds preserved in MutexVault after attack attempt", async function () {
    try { await attacker.connect(attackerEOA).attack(); } catch (_) {}

    const contractBalance = await mutexVault.getContractBalance();
    expect(contractBalance).to.be.greaterThanOrEqual(TOTAL_HONEYPOT);
    console.log(`[MUTEX] Contract balance preserved: ${ethers.formatEther(contractBalance)} ETH`);
  });

  it("MutexVault: profit ≤ 0 (equivalent security to CEI)", async function () {
    try { await attacker.connect(attackerEOA).attack(); } catch (_) {}
    const attackerBalance = await attacker.getAttackerBalance();
    expect(attackerBalance).to.equal(0n);
  });
});
