import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1) Deploy template DAO (not initialized)
  const DAO = await ethers.getContractFactory("DAO");
  const template = await DAO.deploy();
  await template.deployed();
  console.log("DAO template:", template.address);

  // 2) Deploy DAOFactory with template
  const DAOFactory = await ethers.getContractFactory("DAOFactory");
  const factory = await DAOFactory.deploy(template.address);
  await factory.deployed();
  console.log("DAOFactory:", factory.address);

  // 3) Create a DAO clone (initialize inside factory)
  const tx = await factory.createDAO();
  const receipt = await tx.wait();
  const cloneEvt = receipt.events?.find((e) => e.event === "NewClone");
  if (!cloneEvt || !cloneEvt.args) throw new Error("No NewClone event");
  const daoAddr = cloneEvt.args[0];
  console.log("DAO clone:", daoAddr);

  // 4) Attach DAO clone instance
  const dao = await ethers.getContractAt("DAO", daoAddr);

  // 5) Propose (1h expiration, 0 ETH)
  const now = Math.floor(Date.now() / 1000);
  const expiration = now + 3600;
  const moneyAmount = ethers.constants.Zero;
  const txP = await dao.propose("Prueba rapida", expiration, moneyAmount);
  const rcP = await txP.wait();
  const total = await dao.totalProposals();
  const proposalId = total.toNumber();
  console.log("Proposal created:", proposalId);

  // 6) Vote YES
  const txV = await dao.vote(proposalId, true);
  await txV.wait();
  const p = await dao.getProposal(proposalId);
  console.log("After vote: yes=", p.positiveCount.toString(), "no=", p.negativeCount.toString());

  // 7) Persist frontend config
  const frontendDir = path.resolve(__dirname, "..", "frontend");
  const envPath = path.join(frontendDir, ".env");
  const rpcUrl = "http://127.0.0.1:8545";
  const envContent = `VITE_RPC_URL=${rpcUrl}\nVITE_CONTRACT_ADDRESS=${daoAddr}\n`;
  fs.writeFileSync(envPath, envContent, { encoding: "utf8" });
  fs.writeFileSync(path.join(frontendDir, "dao-local.json"), JSON.stringify({ dao: daoAddr }, null, 2));
  console.log("Frontend .env written:", envPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

