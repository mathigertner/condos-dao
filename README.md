# Condos DAO - Zero-Knowledge Governance Platform

A decentralized autonomous organization (DAO) platform designed for condominium governance with privacy-preserving voting using zero-knowledge proofs.

## 🏗️ Project Overview

This project implements a complete DAO infrastructure that allows condominium residents to:

- Create and manage proposals
- Vote anonymously using zero-knowledge proofs (ZK)
- Manage financial obligations and debt distribution
- Maintain transparent governance while preserving voter privacy

## 🔧 Smart Contracts

1. **DAO.sol** - Main governance contract with proposal management and anonymous voting
2. **DAOFactory.sol** - DAO deployment factory using minimal proxy pattern (EIP-1167)
3. **SemaphoreDeployer.sol** - Semaphore infrastructure deployer
4. **Vault.sol** - Treasury management

## 🛡️ Key Features

- **Anonymous Voting**: Members can vote without revealing their identity using Semaphore ZK proofs
- **Role-Based Access**: Admin, Proposer, and Member roles with different permissions
- **Financial Management**: Debt distribution and payment tracking
- **Gas Efficient**: 96.5% gas savings using minimal proxy pattern for DAO deployment

## 🏭 EIP-1167 Minimal Proxy Pattern

This project uses the **Minimal Proxy Clone pattern (EIP-1167)** for extremely gas-efficient DAO deployment:

- **How it works**: Instead of deploying the full contract code multiple times, it creates lightweight "proxy" contracts that delegate all calls to a single implementation contract
- **Gas savings**: Each new DAO costs only ~45K gas instead of ~3M gas (96.5% savings)
- **Isolated storage**: Each DAO operates independently with completely separate storage
- **Battle-tested**: Used by major protocols like Gnosis Safe and Uniswap

## 🚀 Quick Start

```bash
npm install
npx hardhat compile
npx hardhat test
```

## 📁 Project Structure

```
contracts/
├── DAO.sol                    # Main governance contract
├── DAOFactory.sol             # DAO deployment factory
├── SemaphoreDeployer.sol      # ZK infrastructure deployer
└── Vault.sol                  # Treasury management

test/
└── dao-test.js               # Test suite
```

## 🛠️ Technology Stack

- Solidity ^0.8.23
- Hardhat
- OpenZeppelin
- Semaphore Protocol
- EIP-1167 Minimal Proxy

## ⚠️ Security Notice

This is a development version. Please ensure thorough testing and security audits before any mainnet deployment.
# Condos DAO - Anonymous Voting System with Semaphore

This project implements an anonymous voting system for a DAO using the Semaphore protocol, which allows members to vote privately while maintaining the integrity of the process.

## 🔐 Complete Semaphore Verification Process

### Step 1: Create a Semaphore Identity

**Command:**
```bash
npx ts-node scripts/createIdentifieir.ts
```

**Expected output:**
```
🔐 Creating Semaphore identity...
✅ Identity created successfully!
📋 Identity details:
   Private Key: 205,114,186,194,57,6,205,197,247,150,155,75,195,240,202,69,17,176,51,175,152,185,254,126,70,58,23,182,129,188,167,167
   Secret Scalar: 2083601394934432361033216781372214699217102550671403096234832774885294098413
   Public Key: 11679545163999207737421183713290353918360280095113863427141221904713820547263,4903643666040492325034045483545478268985065604992841086547505312432753494829
   Commitment: 17680393926156873221232549829566416868053395779211879882515765591922876578078
💾 Identity saved to: /home/bogo/condos-dao/scripts/identity.json
⚠️  Keep this file secure! Do not share your private key and secret scalar.
🎉 Script completed successfully!
```

**Generated file:** `scripts/identity.json`

### Step 2: Create the Merkle Tree Group

**Command:**
```bash
npx ts-node scripts/merkleTree.ts create [groupId]
```

**Example:**
```bash
npx ts-node scripts/merkleTree.ts create 1
```

**Expected output:**
```
🌳 Creating Semaphore Merkle Tree...
✅ Group created with ID: 1
📏 Tree depth: 20
👥 Initial members: 0
💾 Group data saved to: /home/bogo/condos-dao/scripts/group.json
🎉 Script completed successfully!
```

**Generated file:** `scripts/group.json`

### Step 3: Add Identity to the Group

**Command:**
```bash
npx ts-node scripts/merkleTree.ts add [identityPath] [groupId]
```

**Example:**
```bash
npx ts-node scripts/merkleTree.ts add scripts/identity.json 1
```

**Expected output:**
```
👤 Adding member to group...
✅ Member added successfully!
📋 Member details:
   Commitment: 12926265437076478444666459941249196177783752835307391466498579445960425808605
   Group ID: 1
   Total members: 1
   Member index: 0
🎉 Script completed successfully!
```

### Step 4: Verify Group Information

**Command:**
```bash
npx ts-node scripts/merkleTree.ts info [groupId]
```

**Example:**
```bash
npx ts-node scripts/merkleTree.ts info 1
```

**Expected output:**
```
📊 Group Information:
   Group ID: 1
   Tree Depth: 20
   Total Members: 1
   Created: 2025-09-09T06:22:52.603Z
   Last Updated: 2025-09-09T06:22:52.605Z
👥 Members:
   0: 12926265437076478444666459941249196177783752835307391466498579445960425808605
🎉 Script completed successfully!
```

### Step 5: Generate Semaphore Proof

**Command:**
```bash
npx ts-node scripts/generateProof.ts generate [identityPath] [daoAddress|local] [proposalId] [voteValue] [rpcUrl]
```

**Example:**
```bash
npx ts-node scripts/generateProof.ts generate scripts/identity.json local 1 true
```

**Expected output:**
```
🔐 Generating Semaphore proof for anonymous voting...
🧪 Using local mode externalNullifier based on zero address.
🔍 Local proof verification: VALID
💾 Proof data saved to: /home/bogo/condos-dao/scripts/proof.json
👉 Use these fields for on-chain call: zkVote(proposalId, signalHash, nullifierHash, proof)
🎉 Script completed successfully!
```

**Generated file:** `scripts/proof.json`

### Step 6: Verify the Generated Proof

**Command:**
```bash
npx ts-node scripts/generateProof.ts verify [proofPath]
```

**Example:**
```bash
npx ts-node scripts/generateProof.ts verify scripts/proof.json
```

**Expected output:**
```
🔍 Verifying Semaphore proof...
📝 Message: "Vote: YES for proposal 1"
🏷️  Group ID: 1
👤 Member index: 0
✅ Proof is VALID!
🎉 Script completed successfully!
```

## 📋 Generated Files Structure

### `scripts/identity.json`
```json
{
  "privateKey": "205,114,186,194,57,6,205,197,247,150,155,75,195,240,202,69,17,176,51,175,152,185,254,126,70,58,23,182,129,188,167,167",
  "secretScalar": "2083601394934432361033216781372214699217102550671403096234832774885294098413",
  "publicKey": "11679545163999207737421183713290353918360280095113863427141221904713820547263,4903643666040492325034045483545478268985065604992841086547505312432753494829",
  "commitment": "17680393926156873221232549829566416868053395779211879882515765591922876578078",
  "createdAt": "2025-09-09T06:16:22.906Z"
}
```

### `scripts/group.json`
```json
{
  "groupId": 1,
  "members": [
    "12926265437076478444666459941249196177783752835307391466498579445960425808605"
  ],
  "treeDepth": 20,
  "createdAt": "2025-09-09T06:22:52.603Z",
  "lastUpdated": "2025-09-09T06:22:52.605Z"
}
```

### `scripts/proof.json`
```json
{
  "proof": [
    "4690163212950163455384391838753004923689295520750687597916519218599493499511",
    "11037188411870065412443955435290255840113588889442689219785461863388845402960",
    "15178280614405258002960912971464751746098669516986866856743783025140376763173",
    "6347423047606799164141077482330503151385992203037943341327152556256997030869",
    "17161888669102096801977306845928460497007514472923025572422194085359883958288",
    "4317183319554022273012152628430238242660079806093069574065664045172645582443",
    "13877942552972000704136974342982744655398942760340726888337201554826966913412",
    "20574661988237168371335575503930912928596279366476366588511997420791587051471"
  ],
  "publicSignals": {
    "nullifierHash": "19192014691103635765009096779697656988585256352568224290356409774154866406666",
    "signalHash": "1"
  },
  "message": "Vote: YES for proposal 1",
  "groupId": "1",
  "memberIndex": 0,
  "externalNullifier": "0x215e993cba08191a3d85657c5da2cffea7be9a4e63f6d0c29b0a7fde962c40be",
  "merkleRoot": "12926265437076478444666459941249196177783752835307391466498579445960425808605",
  "merkleTreeDepth": 1,
  "scope": "15093465231716235526228915669137155129638405770088682671055063457067793399998",
  "createdAt": "2025-09-09T06:25:13.600Z"
}
```

## 🔧 Smart Contract Usage

### Parameters for the `zkVote()` function:

```solidity
zkVote(
    proposalId,           // uint256: 1
    signalHash,          // uint256: 1 (YES vote)
    nullifierHash,       // uint256: 19192014691103635765009096779697656988585256352568224290356409774154866406666
    proof                // uint256[8]: [4690163212950163455384391838753004923689295520750687597916519218599493499511, 11037188411870065412443955435290255840113588889442689219785461863388845402960, 15178280614405258002960912971464751746098669516986866856743783025140376763173, 6347423047606799164141077482330503151385992203037943341327152556256997030869, 17161888669102096801977306845928460497007514472923025572422194085359883958288, 4317183319554022273012152628430238242660079806093069574065664045172645582443, 13877942552972000704136974342982744655398942760340726888337201554826966913412, 20574661988237168371335575503930912928596279366476366588511997420791587051471]
)
```

## 🚀 Quick Commands

### Complete flow in sequence:
```bash
# 1. Create identity
npx ts-node scripts/createIdentifieir.ts

# 2. Create group
npx ts-node scripts/merkleTree.ts create 1

# 3. Add identity to group
npx ts-node scripts/merkleTree.ts add scripts/identity.json 1

# 4. Verify group
npx ts-node scripts/merkleTree.ts info 1

# 5. Generate proof
npx ts-node scripts/generateProof.ts generate scripts/identity.json local 1 true

# 6. Verify proof
npx ts-node scripts/generateProof.ts verify scripts/proof.json
```

## ⚠️ Important Notes

1. **Security**: Keep the `identity.json` file secure and never share the private key.
2. **Consistency**: Make sure the `groupId` is consistent across all commands.
3. **Verification**: Always verify the proof before using it in the smart contract.
4. **Local Mode**: Use `local` as `daoAddress` for offline testing.

## 🔍 Troubleshooting

### Error: "Identity commitment not found in local group"
- Solution: Make sure to add the identity to the group with the `add` command.

### Error: "Group not found"
- Solution: Create the group first with the `create` command.

### Error: "Proof is INVALID"
- Solution: Verify that the identity is correctly added to the group and that the parameters are consistent.
