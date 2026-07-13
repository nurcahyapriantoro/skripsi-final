// Direct ethers.js test on Sepolia — no Hardhat wrapper
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  // Load .env
  require("dotenv").config();
  const PRIVATE_KEY = process.env.PRIVATE_KEY.startsWith("0x")
    ? process.env.PRIVATE_KEY
    : "0x" + process.env.PRIVATE_KEY;
  const RPC_URL = process.env.SEPOLIA_RPC_URL;

  const provider = new ethers.JsonRpcProvider(RPC_URL, 11155111, {
    staticNetwork: true,
    polling: true,
    pollingInterval: 4000,
  });
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log(`Wallet: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(await provider.getBalance(wallet.address))} ETH\n`);

  // Compile contracts
  const solc = require("solc");

  function findImports(p) {
    try {
      return { contents: fs.readFileSync(path.resolve(__dirname, "..", p), "utf8") };
    } catch {
      return { error: "File not found: " + p };
    }
  }

  const files = {
    "contracts/vulnerable/InsecureVault.sol": fs.readFileSync(
      path.resolve(__dirname, "../contracts/vulnerable/InsecureVault.sol"),
      "utf8"
    ),
    "contracts/secure/SecureVault.sol": fs.readFileSync(
      path.resolve(__dirname, "../contracts/secure/SecureVault.sol"),
      "utf8"
    ),
    "contracts/secure/MutexVault.sol": fs.readFileSync(
      path.resolve(__dirname, "../contracts/secure/MutexVault.sol"),
      "utf8"
    ),
    "contracts/attacker/Attacker.sol": fs.readFileSync(
      path.resolve(__dirname, "../contracts/attacker/Attacker.sol"),
      "utf8"
    ),
  };

  const input = {
    language: "Solidity",
    sources: {},
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
    },
  };

  // We need to compile each separately since they have no imports
  // Actually let's compile all at once - they're independent
  Object.keys(files).forEach((k) => {
    input.sources[k] = { content: files[k] };
  });

  // Add OpenZeppelin import for MutexVault
  // MutexVault has: import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
  // We need to resolve this
  const ozPath = path.resolve(__dirname, "../node_modules/@openzeppelin/contracts/security/ReentrancyGuard.sol");
  try {
    input.sources["@openzeppelin/contracts/security/ReentrancyGuard.sol"] = {
      content: fs.readFileSync(ozPath, "utf8"),
    };
    // Also need the Context.sol that ReentrancyGuard imports
    const ctxPath = path.resolve(__dirname, "../node_modules/@openzeppelin/contracts/utils/Context.sol");
    input.sources["@openzeppelin/contracts/utils/Context.sol"] = {
      content: fs.readFileSync(ctxPath, "utf8"),
    };
  } catch (e) {
    console.log("Warning: OpenZeppelin import resolution:", e.message);
  }

  console.log("Compiling Solidity contracts...");
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

  if (output.errors) {
    const errors = output.errors.filter((e) => e.severity === "error");
    if (errors.length > 0) {
      console.error("Compilation errors:", errors.map((e) => e.formattedMessage).join("\n"));
      process.exit(1);
    }
  }

  function getContract(name) {
    for (const [file, data] of Object.entries(output.contracts)) {
      if (data[name]) return data[name];
    }
    return null;
  }

  const insecureArtifact = getContract("InsecureVault");
  const secureArtifact = getContract("SecureVault");
  const mutexArtifact = getContract("MutexVault");
  const attackerArtifact = getContract("Attacker");

  if (!insecureArtifact || !secureArtifact || !mutexArtifact || !attackerArtifact) {
    console.error("Could not find compiled contracts");
    process.exit(1);
  }

  // Deploy
  async function deploy(artifact, ...args) {
    const factory = new ethers.ContractFactory(artifact.abi, artifact.evm.bytecode, wallet);
    const contract = await factory.deploy(...args);
    const receipt = await contract.deploymentTransaction().wait();
    console.log(`  ${artifact.contractName || "Contract"}: ${await contract.getAddress()} (${receipt.gasUsed} gas)`);
    return contract;
  }

  console.log("\n=== 1. DEPLOY ===");
  const insecure = await deploy(insecureArtifact);
  const secure = await deploy(secureArtifact);
  const mutex = await deploy(mutexArtifact);
  const attacker = await deploy(attackerArtifact, await insecure.getAddress());

  const insecureAddr = await insecure.getAddress();
  const secureAddr = await secure.getAddress();
  const attackerAddr = await attacker.getAddress();
  const fakeSeller = ethers.Wallet.createRandom().address;

  console.log("\n=== 2. HONEYPOT (InsecureVault) ===");

  let tx = await insecure.createOrder(fakeSeller);
  let r = await tx.wait();
  console.log(`  Order-0 create: ${r.gasUsed} gas`);

  tx = await insecure.depositFunds(0, { value: ethers.parseEther("0.0001") });
  r = await tx.wait();
  console.log(`  Buyer A deposit 0.0001 ETH: ${r.gasUsed} gas`);

  tx = await insecure.confirmDelivery(0);
  r = await tx.wait();
  console.log(`  Buyer A confirm: ${r.gasUsed} gas`);

  tx = await insecure.createOrder(fakeSeller);
  r = await tx.wait();
  console.log(`  Order-1 create: ${r.gasUsed} gas`);

  tx = await insecure.depositFunds(1, { value: ethers.parseEther("0.00005") });
  r = await tx.wait();
  console.log(`  Buyer B deposit 0.00005 ETH: ${r.gasUsed} gas`);

  tx = await insecure.confirmDelivery(1);
  r = await tx.wait();
  console.log(`  Buyer B confirm: ${r.gasUsed} gas`);

  tx = await insecure.createOrder(attackerAddr);
  r = await tx.wait();
  console.log(`  Order-2 create (attacker): ${r.gasUsed} gas`);

  tx = await insecure.depositFunds(2, { value: ethers.parseEther("0.00001") });
  r = await tx.wait();
  console.log(`  Attacker deposit 0.00001 ETH: ${r.gasUsed} gas`);

  tx = await insecure.confirmDelivery(2);
  r = await tx.wait();
  console.log(`  Attacker confirm: ${r.gasUsed} gas`);

  const vBal = await insecure.getContractBalance();
  const aBal = await insecure.getBalance(attackerAddr);
  console.log(`\n  Vault: ${ethers.formatEther(vBal)} ETH`);
  console.log(`  Attacker vault balance: ${ethers.formatEther(aBal)} ETH`);

  console.log("\n=== 3. REENTRANCY ATTACK ===");
  const vBefore = await insecure.getContractBalance();
  const aBefore = await provider.getBalance(attackerAddr);

  tx = await attacker.attack({ gasLimit: 300000 });
  r = await tx.wait();
  console.log(`  Attack gas: ${r.gasUsed} | price: ${ethers.formatUnits(r.gasPrice, "gwei")} gwei`);

  const reentry = await attacker.getReentrancyCount();
  const vAfter = await insecure.getContractBalance();
  const aAfter = await provider.getBalance(attackerAddr);

  console.log(`  Reentrancy loops: ${reentry}`);
  console.log(`  Vault: ${ethers.formatEther(vBefore)} → ${ethers.formatEther(vAfter)} ETH`);
  console.log(`  Attacker ETH: ${ethers.formatEther(aBefore)} → ${ethers.formatEther(aAfter)} ETH`);
  console.log(`  Drained: ${ethers.formatEther(vBefore - vAfter)} ETH`);

  if (aAfter > aBefore) {
    console.log("\n  🔴 ATTACK BERHASIL!");
    tx = await attacker.collectFunds();
    await tx.wait();
    console.log("  Funds exfiltrated to wallet ✅");
  } else {
    console.log("\n  🟢 Attack FAILED");
  }

  console.log("\n=== 4. CEI PREVENTION ===");
  const AttackerFactory = new ethers.ContractFactory(attackerArtifact.abi, attackerArtifact.evm.bytecode, wallet);
  const attacker2 = await AttackerFactory.deploy(secureAddr);
  await attacker2.waitForDeployment();
  const attacker2Addr = await attacker2.getAddress();
  console.log(`  Attacker2 (→SecureVault): ${attacker2Addr}`);

  tx = await secure.createOrder(attacker2Addr);
  await tx.wait();
  tx = await secure.depositFunds(0, { value: ethers.parseEther("0.0001") });
  await tx.wait();
  tx = await secure.confirmDelivery(0);
  await tx.wait();
  console.log("  Setup: 0.0001 ETH deposited for attacker");

  try {
    const tx2 = await attacker2.attack({ gasLimit: 300000 });
    const r2 = await tx2.wait();
    console.log(`  ⚠️ Attack used ${r2.gasUsed} gas (unexpected)`);
  } catch (e) {
    console.log("  ✅ CEI Pattern MENCEGAH reentrancy! SecureVault aman.");
  }

  console.log("\n═══════════════════════════════════════");
  console.log("  SEPOLIA TESTNET RESULTS");
  console.log("═══════════════════════════════════════");
  console.log(`  InsecureVault: ${insecureAddr}`);
  console.log(`  SecureVault:   ${secureAddr}`);
  console.log(`  MutexVault:    ${await mutex.getAddress()}`);
  console.log(`  Attacker:      ${attackerAddr}`);
  console.log("═══════════════════════════════════════\n");
}

main().catch((e) => {
  console.error("FATAL:", e.message || e);
  process.exit(1);
});
