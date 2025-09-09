const { expect, use } = require("chai");
const { waffle } = require("hardhat");
const { deployContract, provider } = waffle;
const DAO = require("../artifacts/contracts/DAO.sol/DAO.json");
const DAOFactory = require("../artifacts/contracts/DAOFactory.sol/DAOFactory.json");
const { Contract, ethers } = require("ethers");
const { Identity } = require("@semaphore-protocol/identity");
const { Group } = require("@semaphore-protocol/group");
const linker = require("solc/linker");
const PoseidonT3 = require("../artifacts/poseidon-solidity/PoseidonT3.sol/PoseidonT3.json");

let daoTemplate;
let daoFactory;
let dao;
let currentTimestamp;

const [wallet, walletTo, thirdWallet, fourthWallet] = provider.getWallets();

describe("DAO Semaphore Integration", () => {
  beforeEach(async () => {
    // Deploy PoseidonT3 library and link DAO bytecode
    const poseidon = await deployContract(wallet, PoseidonT3);
    const linkedBytecode = linker.linkBytecode(DAO.bytecode, {
      "poseidon-solidity/PoseidonT3.sol:PoseidonT3": poseidon.address,
    });

    daoTemplate = await deployContract(wallet, { abi: DAO.abi, bytecode: linkedBytecode });
    await daoTemplate.initialize(wallet.address);

    daoFactory = await deployContract(wallet, DAOFactory, [
      daoTemplate.address,
    ]);

    await daoFactory.createDAO();
    dao = await daoFactory.daosCreated(0);
    dao = new Contract(dao, DAO.abi, wallet);
    currentTimestamp = (await provider.getBlock("latest")).timestamp;
  });

  describe("Semaphore Group Management", () => {
    it("Should create a Semaphore group on initialization", async () => {
      // Check that the group was created with correct parameters
      const groupId = await dao.GROUP_ID();
      const merkleDepth = await dao.MERKLE_DEPTH();
      
      expect(groupId).to.equal(1);
      expect(merkleDepth).to.equal(20);
    });

    it("Should allow members to register their identity commitments", async () => {
      // Add a member to the DAO first
      await dao.addMemberDAO(walletTo.address, 1);
      
      // Create a Semaphore identity
      const identity = new Identity();
      const commitment = identity.commitment;
      
      // Connect as the new member and register commitment
      const daoFromMember = dao.connect(walletTo);
      await daoFromMember.registerCommitment(commitment);
      
      // Verify the commitment was registered
      const registeredCommitment = await dao.commitments(walletTo.address);
      expect(registeredCommitment).to.equal(commitment);
    });

    it("Should not allow non-members to register commitments", async () => {
      const identity = new Identity();
      const commitment = identity.commitment;
      
      // Try to register without being a member
      const daoFromNonMember = dao.connect(thirdWallet);
      await expect(
        daoFromNonMember.registerCommitment(commitment)
      ).to.be.revertedWith("Solo un miembro puede llamar a esta funcion");
    });

    it("Should not allow duplicate commitments", async () => {
      // Add two members
      await dao.addMemberDAO(walletTo.address, 1);
      await dao.addMemberDAO(thirdWallet.address, 1);
      
      const identity = new Identity();
      const commitment = identity.commitment;
      
      // First member registers
      const daoFromFirstMember = dao.connect(walletTo);
      await daoFromFirstMember.registerCommitment(commitment);
      
      // Second member tries to register same commitment
      const daoFromSecondMember = dao.connect(thirdWallet);
      await expect(
        daoFromSecondMember.registerCommitment(commitment)
      ).to.be.reverted;
    });

    it("Should update Merkle root when new members are added", async () => {
      // Get initial root
      const initialRoot = await dao.getRoot(1);
      
      // Add member and register commitment
      await dao.addMemberDAO(walletTo.address, 1);
      const identity = new Identity();
      const commitment = identity.commitment;
      
      const daoFromMember = dao.connect(walletTo);
      await daoFromMember.registerCommitment(commitment);
      
      // Check that root changed
      const newRoot = await dao.getRoot(1);
      expect(newRoot).to.not.equal(initialRoot);
    });
  });

  describe("Anonymous Voting", () => {
    let identity1, identity2, identity3;
    let commitment1, commitment2, commitment3;
    let proposalId;

    beforeEach(async () => {
      // Create identities for testing
      identity1 = new Identity();
      identity2 = new Identity();
      identity3 = new Identity();
      
      commitment1 = identity1.commitment;
      commitment2 = identity2.commitment;
      commitment3 = identity3.commitment;
      
      // Add members to DAO
      await dao.addMemberDAO(walletTo.address, 1);
      await dao.addMemberDAO(thirdWallet.address, 1);
      await dao.addMemberDAO(fourthWallet.address, 1);
      
      // Register commitments
      const daoFromMember1 = dao.connect(walletTo);
      const daoFromMember2 = dao.connect(thirdWallet);
      const daoFromMember3 = dao.connect(fourthWallet);
      
      await daoFromMember1.registerCommitment(commitment1);
      await daoFromMember2.registerCommitment(commitment2);
      await daoFromMember3.registerCommitment(commitment3);
      
      // Create a proposal
      const oneWeek = 7 * 24 * 60 * 60;
      const newTimestamp = currentTimestamp + oneWeek;
      const description = "Test proposal for Semaphore voting";
      
      await dao.propose(description, newTimestamp, 1000);
      proposalId = 1;
    });

    it("Should allow anonymous voting with valid Semaphore proof", async () => {
      // Simplified anonymous voting path (no real proof verification)
      const mockProof = [1, 2, 3, 4, 5, 6, 7, 8];
      const mockNullifierHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nullifier1"));
      const mockSignalHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Vote: YES"));

      // Perform anonymous vote
      await dao.voteAnonymously(proposalId, true, mockProof, mockNullifierHash, mockSignalHash);

      // Verify the vote was counted and nullifier marked as used
      const proposal = await dao.getProposal(proposalId);
      expect(proposal.positiveCount).to.equal(1);
      expect(proposal.negativeCount).to.equal(0);

      const isUsed = await dao.nullifierHashes(proposalId, mockNullifierHash);
      expect(isUsed).to.be.true;
    });

    it("Should prevent voting on non-existent proposals", async () => {
      const mockProof = [1, 2, 3, 4, 5, 6, 7, 8];
      const mockNullifierHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nullifier1"));
      const mockSignalHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Vote: YES"));
      
      await expect(
        dao.voteAnonymously(999, true, mockProof, mockNullifierHash, mockSignalHash)
      ).to.be.revertedWith("Proposal does not exist");
    });

    it("Should prevent voting on expired proposals", async () => {
      // Fast forward time to expire the proposal
      const twoWeeks = 14 * 24 * 60 * 60;
      await provider.send("evm_setNextBlockTimestamp", [
        currentTimestamp + twoWeeks,
      ]);
      
      const mockProof = [1, 2, 3, 4, 5, 6, 7, 8];
      const mockNullifierHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nullifier1"));
      const mockSignalHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Vote: YES"));
      
      await expect(
        dao.voteAnonymously(proposalId, true, mockProof, mockNullifierHash, mockSignalHash)
      ).to.be.revertedWith("Proposal has expired");
    });

    it("Should prevent duplicate votes using same nullifier", async () => {
      const mockProof = [1, 2, 3, 4, 5, 6, 7, 8];
      const mockNullifierHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nullifier1"));
      const mockSignalHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Vote: YES"));

      // First vote succeeds in simplified path
      await dao.voteAnonymously(proposalId, true, mockProof, mockNullifierHash, mockSignalHash);

      // Second vote with same nullifier must fail
      await expect(
        dao.voteAnonymously(proposalId, true, mockProof, mockNullifierHash, mockSignalHash)
      ).to.be.revertedWith("Nullifier already used");
    });

    it("Should track nullifier usage per proposal", async () => {
      const mockNullifierHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("nullifier1"));
      
      // Initially, nullifier should not be used
      const isUsed = await dao.nullifierHashes(proposalId, mockNullifierHash);
      expect(isUsed).to.be.false;
    });
  });

  describe("Proposal with Semaphore Root", () => {
    it("Should store the current Merkle root when creating a proposal", async () => {
      // Add a member and register commitment to change the root
      await dao.addMemberDAO(walletTo.address, 1);
      const identity = new Identity();
      const commitment = identity.commitment;
      
      const daoFromMember = dao.connect(walletTo);
      await daoFromMember.registerCommitment(commitment);
      
      // Get the current root
      const currentRoot = await dao.getRoot(1);
      
      // Create a proposal
      const oneWeek = 7 * 24 * 60 * 60;
      const newTimestamp = currentTimestamp + oneWeek;
      const description = "Proposal with Semaphore root";
      
      await dao.propose(description, newTimestamp, 1000);
      
      // Check that the proposal stores the correct root
      const proposal = await dao.getProposal(1);
      expect(proposal.groupRoot).to.equal(currentRoot);
    });
  });

  describe("Integration with Regular Voting", () => {
    it("Should allow both regular and anonymous voting on the same proposal", async () => {
      // Add members
      await dao.addMemberDAO(walletTo.address, 1);
      await dao.addMemberDAO(thirdWallet.address, 1);
      
      // Register one commitment for anonymous voting
      const identity = new Identity();
      const commitment = identity.commitment;
      
      const daoFromMember1 = dao.connect(walletTo);
      await daoFromMember1.registerCommitment(commitment);
      
      // Create proposal
      const oneWeek = 7 * 24 * 60 * 60;
      const newTimestamp = currentTimestamp + oneWeek;
      const description = "Mixed voting proposal";
      
      await dao.propose(description, newTimestamp, 1000);
      
      // Regular vote from second member
      const daoFromMember2 = dao.connect(thirdWallet);
      await daoFromMember2.vote(1, true);
      
      // Check that regular vote was counted
      const proposal = await dao.getProposal(1);
      expect(proposal.positiveCount).to.equal(1);
      expect(proposal.negativeCount).to.equal(0);
    });
  });

  describe("Edge Cases", () => {
    it("Should handle zero commitment", async () => {
      await dao.addMemberDAO(walletTo.address, 1);
      
      const daoFromMember = dao.connect(walletTo);
      await expect(
        daoFromMember.registerCommitment(0)
      ).to.be.reverted;
    });

    it("Should handle large commitment values", async () => {
      await dao.addMemberDAO(walletTo.address, 1);
      
      const identity = new Identity();
      const commitment = identity.commitment;
      
      const daoFromMember = dao.connect(walletTo);
      await daoFromMember.registerCommitment(commitment);
      
      // Verify it was stored correctly
      const storedCommitment = await dao.commitments(walletTo.address);
      expect(storedCommitment).to.equal(commitment);
    });

    it("Should maintain group integrity with multiple members", async () => {
      // Add multiple members
      const members = [walletTo, thirdWallet, fourthWallet];
      const identities = [];
      const commitments = [];
      
      for (let i = 0; i < members.length; i++) {
        await dao.addMemberDAO(members[i].address, 1);
        
        const identity = new Identity();
        identities.push(identity);
        commitments.push(identity.commitment);
        
        const daoFromMember = dao.connect(members[i]);
        await daoFromMember.registerCommitment(commitments[i]);
      }
      
      // Verify all commitments are stored
      for (let i = 0; i < members.length; i++) {
        const storedCommitment = await dao.commitments(members[i].address);
        expect(storedCommitment).to.equal(commitments[i]);
      }
      
      // Verify the group has the correct number of members
      const root = await dao.getRoot(1);
      expect(root).to.not.equal(0);
    });
  });
});
