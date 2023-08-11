import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "ethereum-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@nomiclabs/hardhat-ethers";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000000,
      },
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: process.env.GOERLI_TESTNET_RPC_URL || "",
      }
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || "",
      from: process.env.WALLET || "",
      accounts: [ process.env.PRIVATE_KEY || "" ],
    },
    goerli: {
      url: process.env.GOERLI_TESTNET_RPC_URL || "",
      from: process.env.WALLET || "",
      accounts: [ process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000" ],
    },
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || ""
  },
};

export default config;
