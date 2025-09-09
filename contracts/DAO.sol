//SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@semaphore-protocol/contracts/Semaphore.sol";
import "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";

// AGREGAR VALIDACION DE NO PERMITIR VOTOS SI HAY DEUDAS //

contract DAO is OwnableUpgradeable {
    uint256 public constant VERSION = 100;
    uint8 public constant MERKLE_DEPTH = 20;
    uint256 public constant GROUP_ID = 1;

    // Semaphore instance for ZK proofs
    Semaphore public semaphore;

    // 1 => normal, 2 => proposer, 3 => admin
    mapping(address => uint256) public members;
    mapping(address => Debt[]) public debts;
    mapping(address => uint256) public debtsCounter;
    mapping(address => uint256) public totalDebts;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public votes;
    mapping(address => uint256) public allowances;
    mapping(address => uint256) public commitments;
    mapping(uint256 => mapping(uint256 => bool)) public nullifierUsed;

    address[] private membersKeys;
    uint256[] public allCommitments;
    address private vaultContract;
    uint256 private totalMembers;
    uint256 public totalProposals;

    struct Proposal {
        address proposer;
        string description;
        uint256 creationDate;
        uint256 expirationDate;
        uint256 positiveCount;
        uint256 negativeCount;
        uint256 moneyAmount;
        bool expired;
        uint256 groupRoot;
    }

    struct Debt {
        uint256 id;
        uint256 proposalId;
        uint256 amount;
        bool paid;
        uint256 timestamp;
    }

    function initialize(address _owner, address _semaphore) public initializer {
        __Ownable_init();
        semaphore = Semaphore(_semaphore);
        addMemberDAO(_owner, 3);
        // Create a Semaphore group for ZK voting
        semaphore.createGroup(address(this));
    }

    modifier onlyMembers() {
        require(
            members[msg.sender] > 0,
            "Solo un miembro puede llamar a esta funcion"
        );
        _;
    }

    modifier onlyProposers() {
        require(
            members[msg.sender] == 2 || members[msg.sender] == 3,
            "No tienes la autorizacion para elevar una propuesta"
        );
        _;
    }

    modifier onlyAdmins() {
        require(
            totalMembers == 0 ||
                owner() == msg.sender ||
                members[msg.sender] == 3,
            "No tienes la autorizacion necesaria para esta accion"
        );
        _;
    }

    modifier onlyDebtFree() {
        require(
            debtsCounter[msg.sender] == 0,
            "Tus deudas no te permiten realizar esta accion"
        );
        _;
    }

    function propose(
        string calldata description,
        uint256 expirationDate,
        uint256 moneyAmount
    ) external onlyProposers onlyDebtFree returns (uint256) {
        require(
            expirationDate > block.timestamp,
            "La fecha de expiracion debe ser valida"
        );

        Proposal memory _proposal;
        _proposal.groupRoot = semaphore.getMerkleTreeRoot(GROUP_ID);
        _proposal.description = description;
        _proposal.expirationDate = expirationDate;
        _proposal.creationDate = block.timestamp;
        _proposal.moneyAmount = moneyAmount;
        _proposal.proposer = msg.sender;
        proposals[++totalProposals] = _proposal;

        return totalProposals;
    }

    function vote(
        uint256 proposalId,
        bool voteValue
    ) external onlyMembers onlyDebtFree returns (bool) {
        Proposal storage p = proposals[proposalId];

        // Valid and open proposal
        require(p.creationDate != 0, "Invalid proposal");
        require(!p.expired, "Proposal is closed");

        // Prevent double voting by address (non-anonymous vote)
        require(!votes[proposalId][msg.sender], "Already voted");
        votes[proposalId][msg.sender] = true;

        // Count the vote
        if (voteValue) {
            p.positiveCount += 1;
        } else {
            p.negativeCount += 1;
        }

        return true;
    }

    function zkVote(
        uint256 proposalId,
        uint256 signal, // 1 = yes, 0 = no
        uint256 nullifierHash, // prevents double anonymous voting
        uint256[8] calldata proof // Groth16 proof from Semaphore
    ) external onlyDebtFree returns (bool) {
        Proposal storage p = proposals[proposalId];

        // Valid and open proposal
        require(p.creationDate != 0, "Invalid proposal");
        require(!p.expired, "Proposal is closed");
        require(signal == 0 || signal == 1, "Invalid signal");

        // Prevent double voting by nullifier for this proposal
        require(!nullifierUsed[proposalId][nullifierHash], "Duplicate vote");

        // Uniqueness tied to this proposal
        uint256 externalNullifier = uint256(
            keccak256(abi.encodePacked("DAO_VOTE", address(this), proposalId))
        );

        // ZK verification: group membership + uniqueness
        ISemaphore.SemaphoreProof memory semaphoreProof = ISemaphore
            .SemaphoreProof({
                merkleTreeDepth: MERKLE_DEPTH,
                merkleTreeRoot: p.groupRoot,
                nullifier: nullifierHash,
                message: signal,
                scope: externalNullifier,
                points: proof
            });

        require(
            semaphore.verifyProof(GROUP_ID, semaphoreProof),
            "Invalid ZK proof"
        );

        // Mark nullifier as used and count the vote
        nullifierUsed[proposalId][nullifierHash] = true;

        if (signal == 1) {
            p.positiveCount += 1;
        } else {
            p.negativeCount += 1;
        }

        return true;
    }

    function closeProposal(uint256 proposalId) external onlyAdmins {
        Proposal storage p = proposals[proposalId];
        require(p.creationDate != 0, "Invalid proposal");
        require(!p.expired, "Already closed");
        require(block.timestamp >= p.expirationDate, "Not yet expired");

        p.expired = true;

        // If applicable, distribute debts and enable allowance to the proposer
        if (p.moneyAmount > 0 && p.positiveCount > p.negativeCount) {
            Debt memory _debt;
            _debt.timestamp = block.timestamp;
            _debt.amount = p.moneyAmount / membersKeys.length;
            _debt.proposalId = proposalId;

            for (uint256 i = 0; i < membersKeys.length; i++) {
                _debt.id = ++totalDebts[membersKeys[i]];
                debts[membersKeys[i]].push(_debt);
                debtsCounter[membersKeys[i]] += _debt.amount;
            }

            allowances[p.proposer] = p.moneyAmount;
        }
    }

    function addMemberDAO(address _member, uint256 role) public onlyAdmins {
        if (members[_member] <= 0) {
            membersKeys.push(_member);
        }

        members[_member] = role;
        totalMembers++;
    }

    function getProposal(
        uint256 proposalId
    ) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    function getDebts() external view returns (Debt[] memory) {
        return debts[msg.sender];
    }

    function getDebts(
        address _member
    ) external view onlyAdmins returns (Debt[] memory) {
        return debts[_member];
    }

    function setVault(address _vault) external onlyAdmins {
        vaultContract = _vault;
    }

    function withdraw() external onlyProposers {
        require(allowances[msg.sender] > 0, "No tiene nada para cobrar");

        bytes memory withdrawCall = abi.encodeWithSignature(
            "withdraw(address)",
            msg.sender
        );

        (bool _success, ) = vaultContract.call(withdrawCall);
        require(_success, "VaultContract::withdraw call has failed.");

        allowances[msg.sender] = 0;
    }

    function payDebt(uint256 _debtId) external payable onlyMembers {
        Debt storage _debt = debts[msg.sender][_debtId - 1];
        uint256 _amount = _debt.amount;
        require(_debt.id > 0, "La deuda no existe");
        require(_debt.paid == false, "La deuda ya ha sido pagada");

        require(
            msg.value >= _amount,
            "El monto no ha sido suficiente para saldar la deuda"
        );

        debtsCounter[msg.sender] -= _amount;
        _debt.paid = true;

        uint256 change = msg.value - _amount;

        if (change > 0) {
            payable(msg.sender).transfer(change);
        }
    }

    function registerCommitment(
        address _member,
        uint256 _commitment
    ) public onlyAdmins {
        require(members[_member] > 0, "Address is not a DAO member");

        semaphore.addMember(GROUP_ID, _commitment);

        commitments[_member] = _commitment;
        allCommitments.push(_commitment);
    }
}
