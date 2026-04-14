require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      // Ephemeral local network — resets between test runs
      allowUnlimitedContractSize: false,
      blockGasLimit: 30000000,
    },
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    outputFile: "analysis/results/gas_report.txt",
    noColors: true,
    // Report gas for every function call
    excludeContracts: [],
    src: "./contracts",
  },
  mocha: {
    timeout: 120000, // 2 minutes for long-running benchmark tests
  },
};
