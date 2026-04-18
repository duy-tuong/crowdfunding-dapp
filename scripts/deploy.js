import { ethers } from "ethers";
import hre from "hardhat";

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const artifact = await hre.artifacts.readArtifact("Crowdfunding");

  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  );

  const contract = await factory.deploy();

  await contract.waitForDeployment();

  console.log("Deployed to:", await contract.getAddress());
}

main();