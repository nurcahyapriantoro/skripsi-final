const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  const InsecureVault = await ethers.getContractFactory("InsecureVault");
  const insecureVault = await InsecureVault.deploy();
  await insecureVault.waitForDeployment();
  console.log("InsecureVault deployed to:", await insecureVault.getAddress());

  const SecureVault = await ethers.getContractFactory("SecureVault");
  const secureVault = await SecureVault.deploy();
  await secureVault.waitForDeployment();
  console.log("SecureVault deployed to:", await secureVault.getAddress());

  const MutexVault = await ethers.getContractFactory("MutexVault");
  const mutexVault = await MutexVault.deploy();
  await mutexVault.waitForDeployment();
  console.log("MutexVault deployed to:", await mutexVault.getAddress());

  const Attacker = await ethers.getContractFactory("Attacker");
  const attacker = await Attacker.deploy(await insecureVault.getAddress());
  await attacker.waitForDeployment();
  console.log("Attacker deployed to:", await attacker.getAddress());

  console.log("\n=== All contracts deployed successfully ===");
  console.log("\nSave these addresses for the attack script:");
  console.log(`INsecure_Vault=${await insecureVault.getAddress()}`);
  console.log(`SECURE_VAULT=${await secureVault.getAddress()}`);
  console.log(`MUTEX_VAULT=${await mutexVault.getAddress()}`);
  console.log(`ATTACKER=${await attacker.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
