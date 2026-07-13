require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;

const networks = {
  hardhat: {
    allowUnlimitedContractSize: false,
    blockGasLimit: 30000000,
  },
};

if (PRIVATE_KEY && SEPOLIA_RPC_URL && PRIVATE_KEY.length === 64) {
  networks.sepolia = {
    url: SEPOLIA_RPC_URL,
    accounts: [`0x${PRIVATE_KEY}`],
    chainId: 11155111,
  };
} else if (PRIVATE_KEY && SEPOLIA_RPC_URL && PRIVATE_KEY.startsWith("0x") && PRIVATE_KEY.length === 66) {
  networks.sepolia = {
    url: SEPOLIA_RPC_URL,
    accounts: [PRIVATE_KEY],
    chainId: 11155111,
    timeout: 120000,
    httpHeaders: { 'Content-Type': 'application/json' },
  };
}

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
  networks,
  gasReporter: {
    enabled: true,
    currency: "USD",
    outputFile: "analysis/results/gas_report.txt",
    noColors: true,
    excludeContracts: [],
    src: "./contracts",
  },
  mocha: {
    timeout: 120000,
  },
};
