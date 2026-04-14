/**
 * @file 05_legitimate_users.test.js
 * @description Verifies that CEI and Mutex do not create false positives —
 *              legitimate sellers can still withdraw their earned funds normally.
 *              Tests the "liveness" criterion from the research evaluation.
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("=== LIVENESS TEST: Legitimate Withdrawals Work on Secure Contracts ===", function () {
  const DEPOSIT = ethers.parseEther("1.0");

  async function setupAndWithdraw(contractName) {
    const [, buyer, seller] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory(contractName);
    const vault = await Factory.deploy();
    await vault.waitForDeployment();

    await vault.connect(buyer).createOrder(seller.address);
    await vault.connect(buyer).depositFunds(0, { value: DEPOSIT });
    await vault.connect(buyer).confirmDelivery(0);

    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
    const tx = await vault.connect(seller).withdrawFunds();
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);

    // Net gain = received ETH - gas spent
    const netGain = sellerBalanceAfter - sellerBalanceBefore + gasUsed;
    return { vault, netGain };
  }

  it("SecureVault: legitimate seller successfully withdraws 1 ETH", async function () {
    const { netGain } = await setupAndWithdraw("SecureVault");
    expect(netGain).to.be.closeTo(DEPOSIT, ethers.parseEther("0.001")); // ~1 ETH net
    console.log("\n[LIVENESS] SecureVault: legitimate withdrawal succeeded ✅");
  });

  it("MutexVault: legitimate seller successfully withdraws 1 ETH", async function () {
    const { netGain } = await setupAndWithdraw("MutexVault");
    expect(netGain).to.be.closeTo(DEPOSIT, ethers.parseEther("0.001"));
    console.log("[LIVENESS] MutexVault: legitimate withdrawal succeeded ✅");
  });

  it("SecureVault: second withdrawal attempt correctly reverts (no double-withdraw)", async function () {
    const [, buyer, seller] = await ethers.getSigners();
    const SecureVault = await ethers.getContractFactory("SecureVault");
    const vault = await SecureVault.deploy();
    await vault.waitForDeployment();

    await vault.connect(buyer).createOrder(seller.address);
    await vault.connect(buyer).depositFunds(0, { value: DEPOSIT });
    await vault.connect(buyer).confirmDelivery(0);

    // First withdrawal: succeeds
    await vault.connect(seller).withdrawFunds();
    // Second withdrawal: must revert
    await expect(vault.connect(seller).withdrawFunds())
      .to.be.revertedWith("SecureVault: no funds to withdraw");

    console.log("[LIVENESS] Double-withdrawal correctly prevented ✅");
  });
});
