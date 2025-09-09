import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import { generateProof, verifyProof } from "@semaphore-protocol/proof";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { ethers } from "ethers";
import { loadGroupFromDisk, DEFAULT_DEPTH } from "./merkleTree";

interface ProofData {
    proof: any;
    publicSignals: any;
    message: string;
    groupId: string;
    memberIndex: number;
    externalNullifier: string;
    merkleRoot: string;
    merkleTreeDepth: number;
    scope: string;
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
        
        // Recreate identity correctly from the private key array
        const privateKeyArray = identityData.privateKey.split(',').map((n: string) => parseInt(n.trim()));
        const privateKeyBuffer = new Uint8Array(privateKeyArray);
        const identity = new Identity(privateKeyBuffer);
        
        // Build local group from disk (must be kept in sync with on-chain)
        const { group, groupData } = loadGroupFromDisk();

        // Find member index by commitment
        const commitment = identity.commitment;
        const memberIndex = group.indexOf(commitment);
        if (memberIndex === -1) {
            throw new Error("Identity commitment not found in local group. Add it with scripts/merkleTree.ts add.");
        }

        // Generate Merkle proof
        const merkleProof = group.generateMerkleProof(memberIndex);

        // External nullifier: must match DAO contract computation
        let externalNullifier: string;
        if (daoAddress && daoAddress !== "local") {
            externalNullifier = ethers.utils.solidityKeccak256(
                ["string", "address", "uint256"],
                ["DAO_VOTE", daoAddress, proposalId]
            );
        } else {
            externalNullifier = ethers.utils.solidityKeccak256(
                ["string", "address", "uint256"],
                ["DAO_VOTE", "0x0000000000000000000000000000000000000000", proposalId]
            );
            console.log("🧪 Using local mode externalNullifier based on zero address.");
        }

        // Signal (vote): we use "1" for YES and "0" for NO
        const signal = voteValue ? "1" : "0";

        // Generate Semaphore proof (real)
        const semaphoreProof: any = await generateProof(
            identity,
            merkleProof,
            signal,
            externalNullifier
        );

        // Optional local verification
        const isValid = await verifyProof(semaphoreProof);
        console.log(`🔍 Local proof verification: ${isValid ? "VALID" : "INVALID"}`);

        // Prepare data to save
        const solidityProof = semaphoreProof.points;
        const nullifierHash = semaphoreProof.nullifier;
        const signalHash = semaphoreProof.message;
        const merkleRoot = merkleProof.root.toString();

        const message = `Vote: ${voteValue ? "YES" : "NO"} for proposal ${proposalId}`;

        const proofData: ProofData = {
            proof: solidityProof,
            publicSignals: {
                nullifierHash,
                signalHash,
            },
            message,
            groupId: groupData.groupId.toString(),
            memberIndex,
            externalNullifier,
            merkleRoot,
            merkleTreeDepth: semaphoreProof.merkleTreeDepth, // Use the actual proof depth
            scope: semaphoreProof.scope,
            createdAt: new Date().toISOString()
        };

        const outputPath = join(__dirname, "proof.json");
        writeFileSync(outputPath, JSON.stringify(proofData, null, 2));
        console.log(`💾 Proof data saved to: ${outputPath}`);
        console.log("👉 Use these fields for on-chain call: zkVote(proposalId, signalHash, nullifierHash, proof)");

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
        
        // Reconstruct the semaphore proof object shape expected by verifyProof
        const semaphoreProof: any = {
            points: proofData.proof,
            merkleTreeDepth: proofData.merkleTreeDepth,
            merkleTreeRoot: proofData.merkleRoot,
            nullifier: proofData.publicSignals.nullifierHash,
            message: proofData.publicSignals.signalHash,
            scope: proofData.scope
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
            const proposalId = args[3] || "1";
            const voteValue = args[4] === "true";
            const rpcUrl = args[5] || "http://localhost:8545";
            
            if (!daoAddress) {
                console.log("ℹ️  No daoAddress provided. Use 'local' to run in offline mode.");
                console.log("Usage: npx ts-node scripts/generateProof.ts generate [identityPath] [daoAddress|local] [proposalId] [voteValue] [rpcUrl]");
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
            console.log("  npx ts-node scripts/generateProof.ts generate [identityPath] [daoAddress|local] [proposalId] [voteValue] [rpcUrl]");
            console.log("  npx ts-node scripts/generateProof.ts verify [proofPath]");
            console.log("");
            console.log("Examples:");
            console.log("  npx ts-node scripts/generateProof.ts generate scripts/identity.json local 1 true");
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
