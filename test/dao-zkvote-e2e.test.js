const { expect } = require('chai');
const { ethers } = require('hardhat');
const { Identity } = require('@semaphore-protocol/identity');
const { Group } = require('@semaphore-protocol/group');
const { generateProof, verifyProof } = require('@semaphore-protocol/proof');

// E2E test: deploy DAO + Semaphore, register a member, create a proposal, generate a real Semaphore proof and verify on-chain.
// NOTE: If this test fails due to circuit downloads or library linking, follow the README-style steps below.

describe('DAO zkVote end-to-end', function () {
  this.timeout(120000);

  it('generates a real proof and verifies it on-chain', async function () {
    // 1) Deploy SemaphoreVerifier and Semaphore (from @semaphore-protocol/contracts)
    const Verifier = await ethers.getContractFactory('SemaphoreVerifier');
    const verifier = await Verifier.deploy();
    await verifier.deployed();

    // Deploy Poseidon library required by Semaphore
    const PoseidonT3 = await ethers.getContractFactory('PoseidonT3');
    const poseidon = await PoseidonT3.deploy();
    await poseidon.deployed();

    // Link Poseidon into Semaphore
    const Semaphore = await ethers.getContractFactory('Semaphore', {
      libraries: {
        'poseidon-solidity/PoseidonT3.sol:PoseidonT3': poseidon.address,
      },
    });
    const semaphore = await Semaphore.deploy(verifier.address);
    await semaphore.deployed();

    // 2) Deploy DAO and initialize with the Semaphore address
    const [owner, member] = await ethers.getSigners();
    const DAO = await ethers.getContractFactory('DAO');
    const dao = await DAO.deploy();
    await dao.deployed();

    await dao.initialize(owner.address, semaphore.address);

    // Ensure DAO is admin of groupId=1 expected by DAO (create a second group with DAO as admin)
    await semaphore['createGroup(address)'](dao.address);

    // 3) Create identity and register commitment on-chain y local
    const identity = new Identity();
    const commitment = identity.commitment;

    // On-chain: make member an allowed DAO member and register commitment (admin-only)
    await dao.addMemberDAO(owner.address, 3); // ensure owner is admin (idempotent)
    await dao.addMemberDAO(member.address, 1);
    await dao.registerCommitment(member.address, commitment);

    // 4) Build a local group with the same members (order matters!)
    const group = new Group([], 20);
    group.addMember(commitment);

    // 5) Create a proposal which snapshots current on-chain root
    const now = (await ethers.provider.getBlock('latest')).timestamp;
    const inOneWeek = now + 7 * 24 * 60 * 60;
    const tx = await dao.propose('ZK voting proposal', inOneWeek, 0);
    await tx.wait();
    const proposalId = 1;

    // 6) Generate Merkle proof for the identity
    const index = group.indexOf(commitment);
    expect(index).to.not.equal(-1);
    const merkleProof = group.generateMerkleProof(index);

    // 7) Compute external nullifier exactly like the contract
    const externalNullifier = ethers.utils.solidityKeccak256(
      ['string', 'address', 'uint256'],
      ['DAO_VOTE', dao.address, proposalId]
    );

    // 8) Build a signal: '1' for YES, '0' for NO. We pass string; library will hash.
    const signal = '1';

    // 9) Generate the real Semaphore proof and verify locally
    const semaphoreProof = await generateProof(identity, merkleProof, signal, externalNullifier);
    const isValid = await verifyProof(semaphoreProof);
    console.log('semaphoreProof keys:', Object.keys(semaphoreProof));
    console.log('semaphoreProof value:', JSON.stringify(semaphoreProof, null, 2));
    expect(isValid).to.equal(true);

    // 10) Pack to Solidity proof and extract public signals
    const solidityProof = semaphoreProof.points;
    const nullifier = semaphoreProof.nullifier;

    // 11) Call zkVote on-chain
    const res = await dao.zkVote(proposalId, 1, nullifier, solidityProof);
    await res.wait();

    // 12) Validate the vote was counted
    const proposal = await dao.getProposal(proposalId);
    expect(proposal.positiveCount).to.equal(1);
  });
});
