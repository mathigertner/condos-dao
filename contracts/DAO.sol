//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@semaphore-protocol/contracts/base/SemaphoreGroups.sol";
import "@semaphore-protocol/contracts/base/SemaphoreVerifier.sol";

// AGREGAR VALIDACION DE NO PERMITIR VOTOS SI HAY DEUDAS //

contract DAO is OwnableUpgradeable, SemaphoreGroups, SemaphoreVerifier {
    uint256 public constant VERSION = 100;
    uint8 public constant MERKLE_DEPTH = 20;
    uint256 public constant GROUP_ID = 1;

    // 1 => normal, 2 => proposer, 3 => admin
    mapping(address => uint256) public members;
    mapping(address => Debt[]) public debts;
    mapping(address => uint256) public debtsCounter;
    mapping(address => uint256) public totalDebts;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public votes;
    mapping(address => uint256) public allowances;
    mapping(address => uint256) public commitments;

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

    function initialize(address _owner) public initializer {
        __Ownable_init();
        addMemberDAO(_owner, 3);
        createGroup(GROUP_ID, MERKLE_DEPTH, address(this));
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
        _proposal.groupRoot = getRoot(GROUP_ID);
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

        // chequeo propuesta exista
        if (p.creationDate == 0) {
            revert("Propuesta no valida");
        }

        // chequeo si esta expirada
        if (p.expired) {
            revert("Propuesta ha expirado");
        }

        // chequeo si expiró y recien me doy cuenta
        if (p.expirationDate < block.timestamp) {
            p.expired = true;

            if (p.moneyAmount > 0 && p.positiveCount > p.negativeCount) {
                Debt memory _debt;
                _debt.timestamp = block.timestamp;
                _debt.amount = p.moneyAmount / membersKeys.length;
                _debt.proposalId = proposalId;

                for (uint256 i = 0; i < membersKeys.length; i++) {
                    _debt.id = ++totalDebts[msg.sender];
                    debts[membersKeys[i]].push(_debt);
                    debtsCounter[membersKeys[i]] += _debt.amount;
                }

                // libero el dinero
                allowances[p.proposer] = p.moneyAmount;
            }

            return false;
        }

        // chequeo doble voto y voto en caso +
        if (!votes[proposalId][msg.sender]) {
            votes[proposalId][msg.sender] = true;

            if (voteValue) {
                p.positiveCount = p.positiveCount + 1;
            } else {
                p.negativeCount = p.negativeCount + 1;
            }
        }

        return true;
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

    function registerCommitment(uint256 _commitment) public onlyMembers {
        addMember(GROUP_ID, _commitment);

        commitments[msg.sender] = _commitment;
        allCommitments.push(_commitment);
    }
}
