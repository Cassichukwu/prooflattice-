// Hardhat configuration for ProofLattice deployment to Mantle Sepolia
// We use Hardhat instead of Foundry because the user is on Windows PowerShell
// and Hardhat works with just Node.js (no Rust/bash needed).
//
// Usage:
//   1. npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @nomicfoundation/hardhat-ethers ethers dotenv
//   2. npx hardhat run scripts/deploy-mantle.js --network mantleSepolia
//
// Make sure .env is in this folder with PRIVATE_KEY set!

require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const MANTLE_SEPOLIA_RPC = process.env.MANTLE_SEPOLIA_RPC_URL || "https://rpc.sepolia.mantle.xyz";

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    // Localhost (Anvil) — for testing
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Mantle Sepolia (testnet) — for the actual hackathon
    mantleSepolia: {
      url: MANTLE_SEPOLIA_RPC,
      chainId: 5003,
      accounts: [PRIVATE_KEY],
    },
    // Mantle Mainnet — for production
    mantle: {
      url: process.env.MANTLE_MAINNET_RPC_URL || "https://rpc.mantle.xyz",
      chainId: 5000,
      accounts: [PRIVATE_KEY],
    },
  },
  etherscan: {
    customChains: [
      {
        network: "mantleSepolia",
        chainId: 5003,
        urls: {
          apiURL: "https://api-sepolia.mantlescan.xyz/api",
          browserURL: "https://sepolia.mantlescan.xyz",
        },
      },
    ],
  },
};
