/**
 * @file 04_gas_benchmark.test.js
 * @description In-test gas comparison — quick sanity check that CEI uses ≤ gas than Mutex.
 *              The full 30-iteration analysis is in collect_gas_data.js.
 *              This test checks a single measurement to confirm directionality.
 */
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("=== GAS BENCHMARK: CEI vs Mutex (Single-Iteration Sanity Check) ===", function () {
  const DEPOSIT = ethers.parseEther("0.5");

  async function deployAndWithdraw(contractName) {
    const [, buyer, seller] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory(contractName);
    const vault = await Factory.deploy();
    await vault.waitForDeployment();
    await vault.connect(buyer).createOrder(seller.address);
    await vault.connect(buyer).depositFunds(0, { value: DEPOSIT });
    await vault.connect(buyer).confirmDelivery(0);
    const tx = await vault.connect(seller).withdrawFunds();
    const receipt = await tx.wait();
    return Number(receipt.gasUsed);
  }

  it("CEI (SecureVault) uses less or equal gas than Mutex (MutexVault)", async function () {
    const gasCEI = await deployAndWithdraw("SecureVault");
    await network.provider.send("hardhat_reset");
    const gasMutex = await deployAndWithdraw("MutexVault");

    console.log(`\n[GAS] SecureVault (CEI):  ${gasCEI} gas`);
    console.log(`[GAS] MutexVault (Mutex): ${gasMutex} gas`);
    console.log(`[GAS] Difference:         ${gasMutex - gasCEI} gas (${(((gasMutex - gasCEI) / gasMutex) * 100).toFixed(2)}%)`);

    expect(gasCEI).to.be.lessThanOrEqual(gasMutex,
      "CEI should use less or equal gas than Mutex — check contract implementations"
    );
  });
});
