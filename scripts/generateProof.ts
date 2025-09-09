import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import { generateProof, verifyProof } from "@semaphore-protocol/proof";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { ethers } from "ethers";

interface ProofData {
    proof: any;
    publicSignals: any;
    message: string;
    groupId: string;
    memberIndex: number;
    createdAt: string;
}

async function generateSemaphoreProof(
    identityPath: string,
    daoAddress: string,
    proposalId: string,
    voteValue: boolean,
    rpcUrl: string = "http://localhost:8545"
) {
    try {
        console.log("🔐 Generating Semaphore proof for anonymous voting...");
        
        // Load identity
        if (!existsSync(identityPath)) {
            throw new Error(`Identity file not found: ${identityPath}`);
        }
        
        const identityData = JSON.parse(readFileSync(identityPath, 'utf8'));
        const identity = new Identity(identityData.privateKey);
        
        // Connect to blockchain
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        
        // DAO contract ABI
        const daoABI = [
            "function getRoot(uint256 groupId) public view returns (uint256)",
            "function getProposal(uint256 proposalId) external view returns (tuple(address proposer, string description, uint256 creationDate, uint256 expirationDate, uint256 positiveCount, uint256 negativeCount, uint256 moneyAmount, bool expired, uint256 groupRoot))",
            "function commitments(address) public view returns (uint256)"
        ];
        
        const daoContract = new ethers.Contract(daoAddress, daoABI, provider);
        
        // Get proposal data
        const proposal = await daoContract.getProposal(proposalId);
        if (proposal.creationDate.toString() === "0") {
            throw new Error("Proposal does not exist");
        }
        
        // Get current Merkle root from contract
        const merkleRoot = await daoContract.getRoot(1); // GROUP_ID = 1
        
        console.log(`📋 Proposal: ${proposal.description}`);
        console.log(`🌳 Merkle Root: ${merkleRoot}`);
        console.log(`🗳️  Vote: ${voteValue ? "YES" : "NO"}`);
        
        // Create message for the vote
        const message = `Vote: ${voteValue ? "YES" : "NO"} for proposal ${proposalId}`;
        const externalNullifier = `proposal-${proposalId}-vote`;
        
        // For now, we'll use a simplified approach
        // In a real implementation, you'd need to reconstruct the Merkle tree
        // or use a service that provides the Merkle proof
        
        console.log("⚠️  Note: This is a simplified proof generation.");
        console.log("   In production, you need to get the Merkle proof from the on-chain tree.");
        
        // Save proof data (simplified)
        const proofData: ProofData = {
            proof: [0, 0, 0, 0, 0, 0, 0, 0], // Placeholder
            publicSignals: {
                nullifierHash: "0",
                signalHash: "0",
                externalNullifier: externalNullifier,
                merkleRoot: merkleRoot.toString()
            },
            message,
            groupId: "1",
            memberIndex: 0,
            createdAt: new Date().toISOString()
        };
        
        const outputPath = join(__dirname, "proof.json");
        require('fs').writeFileSync(outputPath, JSON.stringify(proofData, null, 2));
        
        console.log(`💾 Proof data saved to: ${outputPath}`);
        console.log("⚠️  This is a placeholder proof. You need to implement proper Merkle proof generation.");
        
        return proofData;
        
    } catch (error) {
        console.error("❌ Error generating proof:", error);
        throw error;
    }
}

async function verifySemaphoreProof(proofPath: string) {
    try {
        console.log("🔍 Verifying Semaphore proof...");
        
        if (!existsSync(proofPath)) {
            throw new Error(`Proof file not found: ${proofPath}`);
        }
        
        const proofData: ProofData = JSON.parse(readFileSync(proofPath, 'utf8'));
        
        console.log(`📝 Message: "${proofData.message}"`);
        console.log(`🏷️  Group ID: ${proofData.groupId}`);
        console.log(`👤 Member index: ${proofData.memberIndex}`);
        
        // Reconstruct the semaphore proof object
        const semaphoreProof: any = {
            proof: proofData.proof,
            publicSignals: proofData.publicSignals
        };
        
        // Verify the proof
        const isValid = await verifyProof(semaphoreProof);
        
        if (isValid) {
            console.log("✅ Proof is VALID!");
        } else {
            console.log("❌ Proof is INVALID!");
        }
        
        return isValid;
        
    } catch (error) {
        console.error("❌ Error verifying proof:", error);
        throw error;
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
        case "generate":
            const identityPath = args[1] || join(__dirname, "identity.json");
            const daoAddress = args[2];
            const proposalId = args[3];
            const voteValue = args[4] === "true";
            const rpcUrl = args[5] || "http://localhost:8545";
            
            if (!daoAddress || !proposalId) {
                console.log("❌ Missing required parameters: daoAddress and proposalId");
                console.log("Usage: npx ts-node scripts/generateProof.ts generate [identityPath] [daoAddress] [proposalId] [voteValue] [rpcUrl]");
                return;
            }
            
            await generateSemaphoreProof(identityPath, daoAddress, proposalId, voteValue, rpcUrl);
            break;
            
        case "verify":
            const proofPath = args[1] || join(__dirname, "proof.json");
            await verifySemaphoreProof(proofPath);
            break;
            
        default:
            console.log("🔐 Semaphore Proof Generator for DAO Voting");
            console.log("");
            console.log("Usage:");
            console.log("  npx ts-node scripts/generateProof.ts generate [identityPath] [daoAddress] [proposalId] [voteValue] [rpcUrl]");
            console.log("  npx ts-node scripts/generateProof.ts verify [proofPath]");
            console.log("");
            console.log("Examples:");
            console.log("  npx ts-node scripts/generateProof.ts generate scripts/identity.json 0x123... 1 true");
            console.log("  npx ts-node scripts/generateProof.ts generate scripts/identity.json 0x123... 1 false http://localhost:8545");
            console.log("  npx ts-node scripts/generateProof.ts verify scripts/proof.json");
            break;
    }
}

// Run the script if called directly
if (require.main === module) {
    main()
        .then(() => {
            console.log("🎉 Script completed successfully!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("💥 Script failed:", error);
            process.exit(1);
        });
}

export { generateSemaphoreProof, verifySemaphoreProof };
