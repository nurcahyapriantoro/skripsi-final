/**
 * @file deploy_local.js
 * @description Optional local deployment script for manual testing.
 *              Deploys all three vault contracts and the attacker to the Hardhat network.
 */

const { ethers } = require("hardhat");

async function main() {
  const [deployer, buyer, seller, attackerEOA] = await ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Deploy InsecureVault
  const InsecureVault = await ethers.getContractFactory("InsecureVault");
  const insecureVault = await InsecureVault.deploy();
  await insecureVault.waitForDeployment();
  console.log("InsecureVault deployed to:", await insecureVault.getAddress());

  // Deploy SecureVault
  const SecureVault = await ethers.getContractFactory("SecureVault");
  const secureVault = await SecureVault.deploy();
  await secureVault.waitForDeployment();
  console.log("SecureVault deployed to:", await secureVault.getAddress());

  // Deploy MutexVault
  const MutexVault = await ethers.getContractFactory("MutexVault");
  const mutexVault = await MutexVault.deploy();
  await mutexVault.waitForDeployment();
  console.log("MutexVault deployed to:", await mutexVault.getAddress());

  // Deploy Attacker (targeting InsecureVault)
  const Attacker = await ethers.getContractFactory("Attacker");
  const attacker = await Attacker.connect(attackerEOA).deploy(await insecureVault.getAddress());
  await attacker.waitForDeployment();
  console.log("Attacker deployed to:", await attacker.getAddress());

  console.log("\n--- All contracts deployed successfully ---");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
