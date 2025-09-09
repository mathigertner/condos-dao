const { expect, use } = require("chai");
const { deployMockContract } = require("ethereum-waffle");
const { waffle } = require("hardhat");
const { deployContract, provider, solidity } = waffle;
const DAO = require("../artifacts/contracts/DAO.sol/DAO.json");
const DAOFactory = require("../artifacts/contracts/DAOFactory.sol/DAOFactory.json");
const { Contract, ethers } = require("ethers");

let daoTemplate;
let daoFactory;
let dao;
let currentTimestamp;

const [wallet, walletTo, thirdWallet] = provider.getWallets();

describe("DAO", () => {
  beforeEach(async () => {
    daoTemplate = await deployContract(wallet, DAO);
    await daoTemplate.initialize(wallet.address);

    daoFactory = await deployContract(wallet, DAOFactory, [
      daoTemplate.address,
    ]);

    await daoFactory.createDAO();
    dao = await daoFactory.daosCreated(0);
    dao = new Contract(dao, DAO.abi, wallet);
    currentTimestamp = (await provider.getBlock("latest")).timestamp;
  });

  describe("addMemberDAO", () => {
    it("Should be able to add a new admin if you are admin/owner or not allowed if not", async () => {
      await dao.addMemberDAO(walletTo.address, 3);
      expect(await dao.members(walletTo.address)).to.equal(3);

      const daoFromAdminAccount = dao.connect(walletTo);
      await daoFromAdminAccount.addMemberDAO(thirdWallet.address, 1);
      expect(await dao.members(thirdWallet.address)).to.equal(1);

      const daoFromNotAdminAccount = dao.connect(thirdWallet);
      await expect(
        daoFromNotAdminAccount.addMemberDAO(ethers.constants.AddressZero, 1)
      ).to.be.reverted;
    });
  });

  describe("propose", () => {
    it("Should be able to propose", async () => {
      const oneWeek = 7 * 24 * 60 * 60;
      const newTimestamp = currentTimestamp + oneWeek;
      const description = "New proposal";

      // test
      await dao.propose(description, newTimestamp, 100);

      const proposal = await dao.proposals(1);
      expect(proposal.description).to.eq(description);
    });

    it("Should not be able to propose", async () => {
      const oneWeek = 7 * 24 * 60 * 60;
      const newTimestamp = currentTimestamp + oneWeek;
      const description = "New proposal";
      await dao.addMemberDAO(walletTo.address, 1);
      const daoFromNotAdminAccount = dao.connect(walletTo);

      // test
      await expect(
        daoFromNotAdminAccount.propose(description, newTimestamp, 100)
      ).to.be.reverted;
    });
  });

  describe("vote", () => {
    it("Should revert because propose does not exist", async () => {
      await expect(dao.vote(1, true)).to.be.reverted;
    });

    it("Should be able to vote", async () => {
      // valid proposal (already tested)
      const oneWeek = 7 * 24 * 60 * 60;
      const newTimestamp = currentTimestamp + oneWeek;
      const description = "New proposal";
      await dao.propose(description, newTimestamp, 100);

      // add new member
      await dao.addMemberDAO(walletTo.address, 1);

      // vote
      const daoFromMemberAccount = dao.connect(walletTo);
      await daoFromMemberAccount.vote(1, true);

      // vote (ignored)
      await daoFromMemberAccount.vote(1, false);

      const proposal = await dao.proposals(1);

      expect(proposal.positiveCount).to.eq(1);
      expect(proposal.negativeCount).to.eq(0);
      expect(await dao.votes(1, walletTo.address)).to.be.true;
    });

    it("Should not be able to vote an expired proposal but expire it", async () => {
      // valid proposal (already tested)
      const oneWeek = 7 * 24 * 60 * 60;
      const newTimestamp = currentTimestamp + oneWeek;
      const description = "New proposal";
      const moneyAmount = 1000;
      await dao.propose(description, newTimestamp, moneyAmount);

      // add new member
      await dao.addMemberDAO(walletTo.address, 1);

      // vote
      const daoFromMemberAccount = dao.connect(walletTo);
      await daoFromMemberAccount.vote(1, true);

      // emulate time
      const twoWeeks = 14 * 24 * 60 * 60;
      await waffle.provider.send("evm_setNextBlockTimestamp", [
        currentTimestamp + twoWeeks,
      ]);

      // expire proposal by voting
      await daoFromMemberAccount.vote(1, true);

      const proposal = await dao.proposals(1);
      const memberDebt = await dao.debts(walletTo.address, 0);
      const proposerAllowance = await dao.allowances(wallet.address);
      const memberDebtNumber = await dao.debtsCounter(walletTo.address);

      expect(proposal.expired).to.be.true;
      expect(memberDebt.proposalId).to.eq(1);
      expect(memberDebt.amount).to.eq(moneyAmount / 2);
      expect(memberDebtNumber).to.eq(moneyAmount / 2);
      expect(proposerAllowance).to.eq(moneyAmount);

      // vote expired proposal
      await expect(dao.vote(1, true)).to.be.reverted;
    });
  });

  describe("payDebt", () => {
    it("Should be able to pay a debt", async () => {
      // pre
      const oneWeek = 7 * 24 * 60 * 60;
      const newTimestamp = currentTimestamp + oneWeek;
      const description = "New proposal";
      const moneyAmount = 1000;
      await dao.propose(description, newTimestamp, moneyAmount);
      await dao.addMemberDAO(walletTo.address, 1);
      const daoFromMemberAccount = dao.connect(walletTo);
      await daoFromMemberAccount.vote(1, true);
      const twoWeeks = 14 * 24 * 60 * 60;
      await waffle.provider.send("evm_setNextBlockTimestamp", [
        currentTimestamp + twoWeeks,
      ]);
      await daoFromMemberAccount.vote(1, true);
      const proposal = await dao.proposals(1);
      const memberDebt = await dao.debts(walletTo.address, 0);
      const proposerAllowance = await dao.allowances(wallet.address);
      const memberDebtNumber = await dao.debtsCounter(walletTo.address);
      expect(proposal.expired).to.be.true;
      expect(memberDebt.proposalId).to.eq(1);
      expect(memberDebt.amount).to.eq(moneyAmount / 2);
      expect(memberDebtNumber).to.eq(moneyAmount / 2);
      expect(proposerAllowance).to.eq(moneyAmount);
      await expect(dao.vote(1, true)).to.be.reverted;

      // test
      await expect(daoFromMemberAccount.payDebt(2)).to.be.reverted;
      await expect(daoFromMemberAccount.payDebt(1, { value: 1 })).to.be
        .reverted;
      await daoFromMemberAccount.payDebt(1, {
        value: moneyAmount,
      });
      await expect(daoFromMemberAccount.payDebt(1, { value: moneyAmount })).to
        .be.reverted;

      const memberDebtUpdated = await dao.debts(walletTo.address, 0);
      const memberDebtNumberUpdated = await dao.debtsCounter(walletTo.address);

      // asserts
      expect(memberDebtUpdated.paid).to.be.true;
      expect(memberDebtNumberUpdated).to.eq(0);
    });

    describe("withdraw", () => {
      it("Should not be able to withdraw", async () => {
        await expect(dao.withdraw()).to.be.reverted;
      });

      // it("Should be able to withdraw", async () => {
      //   // pre
      //   const oneWeek = 7 * 24 * 60 * 60;
      //   const newTimestamp = currentTimestamp + oneWeek;
      //   const description = "New proposal";
      //   const moneyAmount = 1000;
      //   await dao.propose(description, newTimestamp, moneyAmount);
      //   await dao.addMemberDAO(walletTo.address, 1);
      //   const daoFromMemberAccount = dao.connect(walletTo);
      //   await daoFromMemberAccount.vote(1, true);
      //   const twoWeeks = 14 * 24 * 60 * 60;
      //   await waffle.provider.send("evm_setNextBlockTimestamp", [
      //     currentTimestamp + twoWeeks,
      //   ]);
      //   await daoFromMemberAccount.vote(1, true);
      //   const proposal = await dao.proposals(1);
      //   const memberDebt = await dao.debts(walletTo.address, 0);
      //   const proposerAllowance = await dao.allowances(wallet.address);
      //   const memberDebtNumber = await dao.debtsCounter(walletTo.address);
      //   expect(proposal.expired).to.be.true;
      //   expect(memberDebt.proposalId).to.eq(1);
      //   expect(memberDebt.amount).to.eq(moneyAmount / 2);
      //   expect(memberDebtNumber).to.eq(moneyAmount / 2);
      //   expect(proposerAllowance).to.eq(moneyAmount);
      //   await expect(dao.vote(1, true)).to.be.reverted;
      // });
    });
  });
});
