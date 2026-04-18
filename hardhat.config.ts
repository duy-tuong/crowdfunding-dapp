import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      type: "http",
      url: process.env.SEPOLIA_URL!,
      accounts: [process.env.PRIVATE_KEY!],
    },
  },
};

export default config;
