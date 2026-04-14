/**
 * @file opcode_trace.js
 * @description Extracts SSTORE and SLOAD opcode execution counts for each contract
 *              using Hardhat's debug_traceTransaction.
 *              Outputs: analysis/results/opcode_data_cei.csv, opcode_data_mutex.csv
 */

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const ITERATIONS = 30;
const DEPOSIT_AMOUNT = ethers.parseEther("0.5");

async function getOpcodeTrace(txHash) {
  // Use debug_traceTransaction to get EVM-level execution trace
  const trace = await network.provider.send("debug_traceTransaction", [
    txHash,
    { disableStorage: false, disableMemory: true, disableStack: false },
  ]);

  let sstoreCount = 0;
  let sloadCount = 0;

  if (trace && trace.structLogs) {
    for (const log of trace.structLogs) {
      if (log.op === "SSTORE") sstoreCount++;
      if (log.op === "SLOAD") sloadCount++;
    }
  }

  return { sstoreCount, sloadCount, totalOpcodes: trace.structLogs?.length || 0 };
}

async function measureWithTrace(contractName) {
  const [, buyer, seller] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory(contractName);
  const vault = await Factory.deploy();
  await vault.waitForDeployment();

  await vault.connect(buyer).createOrder(seller.address);
  await vault.connect(buyer).depositFunds(0, { value: DEPOSIT_AMOUNT });
  await vault.connect(buyer).confirmDelivery(0);

  const tx = await vault.connect(seller).withdrawFunds();
  const receipt = await tx.wait();

  const opcodeData = await getOpcodeTrace(receipt.hash);
  return {
    gasUsed: receipt.gasUsed.toString(),
    ...opcodeData,
  };
}

async function runOpcodeAnalysis() {
  const resultsDir = path.join(__dirname, "results");
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

  const contracts = [
    { name: "SecureVault", csvFile: "opcode_data_cei.csv" },
    { name: "MutexVault", csvFile: "opcode_data_mutex.csv" },
  ];

  for (const { name, csvFile } of contracts) {
    console.log(`\n=== Opcode Analysis: ${name} (${ITERATIONS} iterations) ===`);
    const rows = ["iteration,gas_used,sstore_count,sload_count,total_opcodes"];

    for (let i = 1; i <= ITERATIONS; i++) {
      await network.provider.send("hardhat_reset");
      const result = await measureWithTrace(name);
      rows.push(`${i},${result.gasUsed},${result.sstoreCount},${result.sloadCount},${result.totalOpcodes}`);
      process.stdout.write(`\r  Iteration ${i}/${ITERATIONS}: SSTORE=${result.sstoreCount}, SLOAD=${result.sloadCount}`);
    }

    const csvPath = path.join(resultsDir, csvFile);
    fs.writeFileSync(csvPath, rows.join("\n"), "utf8");
    console.log(`\n  ✅ Saved to ${csvPath}`);
  }
}

runOpcodeAnalysis().catch(console.error);
