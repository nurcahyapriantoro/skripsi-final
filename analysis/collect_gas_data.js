/**
 * @file collect_gas_data.js
 * @description Collects 30-iteration gas data for withdrawFunds() on SecureVault and MutexVault.
 *              Resets Hardhat Network state between each iteration for isolation.
 *              Outputs: analysis/results/gas_data_cei.csv, gas_data_mutex.csv
 */

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const ITERATIONS = 30;
const DEPOSIT_AMOUNT = ethers.parseEther("0.5");

async function measureGas(contractName) {
  const [, buyer, seller] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory(contractName);
  const vault = await Factory.deploy();
  await vault.waitForDeployment();

  await vault.connect(buyer).createOrder(seller.address);
  await vault.connect(buyer).depositFunds(0, { value: DEPOSIT_AMOUNT });
  await vault.connect(buyer).confirmDelivery(0);

  // Measure gas for withdrawFunds()
  const tx = await vault.connect(seller).withdrawFunds();
  const receipt = await tx.wait();

  return {
    gasUsed: receipt.gasUsed.toString(),
    blockNumber: receipt.blockNumber,
    txHash: receipt.hash,
  };
}

async function runBenchmark() {
  const resultsDir = path.join(__dirname, "results");
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

  const contracts = [
    { name: "SecureVault", csvFile: "gas_data_cei.csv" },
    { name: "MutexVault", csvFile: "gas_data_mutex.csv" },
  ];

  for (const { name, csvFile } of contracts) {
    console.log(`\n=== Benchmarking ${name} (${ITERATIONS} iterations) ===`);
    const rows = ["iteration,gas_used,block_number,tx_hash"];

    for (let i = 1; i <= ITERATIONS; i++) {
      // Reset Hardhat Network to ensure clean state for every iteration
      await network.provider.send("hardhat_reset");

      const result = await measureGas(name);
      rows.push(`${i},${result.gasUsed},${result.blockNumber},${result.txHash}`);

      process.stdout.write(`\r  Iteration ${i}/${ITERATIONS}: ${result.gasUsed} gas`);
    }

    const csvPath = path.join(resultsDir, csvFile);
    fs.writeFileSync(csvPath, rows.join("\n"), "utf8");
    console.log(`\n  ✅ Saved to ${csvPath}`);
  }

  console.log("\n=== Benchmark complete. Run statistical_analysis.py next. ===");
}

runBenchmark().catch(console.error);
