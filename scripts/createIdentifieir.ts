import { Identity } from "@semaphore-protocol/identity";
import { writeFileSync } from "fs";
import { join } from "path";
import { ethers, BigNumber } from "ethers";

async function createSemaphoreIdentity(
  daoAddress?: string,
  privateKey?: string,
  rpcUrl: string = "http://localhost:8545"
) {
  try {
    console.log("🔐 Creating Semaphore identity...");

    // Create a new identity
    const identity = new Identity();

    // Get the identity data
    const identityPrivateKey = identity.privateKey;
    const secretScalar = identity.secretScalar;
    const publicKey = identity.publicKey;
    const commitment = identity.commitment;

    console.log("✅ Identity created successfully!");
    console.log("📋 Identity details:");
    console.log(`   Private Key: ${identityPrivateKey}`);
    console.log(`   Secret Scalar: ${secretScalar}`);
    console.log(`   Public Key: ${publicKey}`);
    console.log(`   Commitment: ${commitment}`);

    // Save identity to file
    const identityData = {
      privateKey: identityPrivateKey.toString(),
      secretScalar: secretScalar.toString(),
      publicKey: publicKey.toString(),
      commitment: commitment.toString(),
      createdAt: new Date().toISOString(),
    };

    const outputPath = join(__dirname, "identity.json");
    writeFileSync(outputPath, JSON.stringify(identityData, null, 2));

    console.log(`💾 Identity saved to: ${outputPath}`);
    console.log(
      "⚠️  Keep this file secure! Do not share your private key and secret scalar."
    );

    // If DAO address is provided, register the commitment
    if (daoAddress && privateKey) {
      await registerCommitmentOnDAO(
        daoAddress,
        privateKey,
        commitment.toString(),
        rpcUrl
      );
    }

    return identityData;
  } catch (error) {
    console.error("❌ Error creating identity:", error);
    throw error;
  }
}

async function registerCommitmentOnDAO(
  daoAddress: string,
  walletPrivateKey: string,
  commitment: string,
  rpcUrl: string = "http://localhost:8545"
) {
  try {
    console.log("📝 Registering commitment on DAO contract...");

    // Connect to the network (parametrized)
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(walletPrivateKey, provider);

    // DAO contract ABI (you'll need to add the registerCommitment function)
    const daoABI = [
      "function registerCommitment(uint256 _commitment) public",
      "function members(address) public view returns (uint256)",
    ];

    const daoContract = new ethers.Contract(daoAddress, daoABI, wallet);

    // Check if user is a member
    const memberRole: BigNumber = await daoContract.members(wallet.address);
    if (memberRole.eq(0)) {
      throw new Error(
        "You must be a member of the DAO to register a commitment"
      );
    }

    // Register the commitment
    const tx = await daoContract.registerCommitment(commitment);
    console.log(`📤 Transaction sent: ${tx.hash}`);

    await tx.wait();
    console.log("✅ Commitment registered successfully on DAO!");
  } catch (error) {
    console.error("❌ Error registering commitment:", error);
    throw error;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length >= 2) {
    const daoAddress = args[0];
    const walletPrivateKey = args[1];
    const rpcUrl = args[2] || "http://localhost:8545";
    await createSemaphoreIdentity(daoAddress, walletPrivateKey, rpcUrl);
  } else {
    await createSemaphoreIdentity();
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

export { createSemaphoreIdentity, registerCommitmentOnDAO };
