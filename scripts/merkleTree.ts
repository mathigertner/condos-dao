import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

interface GroupData {
  groupId: number;
  members: string[];
  treeDepth: number;
  createdAt: string;
  lastUpdated: string;
}

const DEFAULT_DEPTH = 20; // Must match DAO.MERKLE_DEPTH
// const DEFAULT_GROUP_ID = "condos-dao-group";
const DEFAULT_GROUP_ID = 0;

async function createMerkleTree(groupId: number = DEFAULT_GROUP_ID) {
  try {
    console.log("🌳 Creating Semaphore Merkle Tree...");

    // Create a new group with fixed depth to match on-chain (DAO.MERKLE_DEPTH = 20)
    const group = new Group();

    console.log(`✅ Group created with ID: ${groupId}`);
    console.log(`📏 Tree depth: ${DEFAULT_DEPTH}`);
    console.log(`👥 Initial members: ${group.members.length}`);

    // Save group data
    const groupData: GroupData = {
      groupId,
      members: [],
      treeDepth: DEFAULT_DEPTH,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

    const outputPath = join(__dirname, "group.json");
    writeFileSync(outputPath, JSON.stringify(groupData, null, 2));

    console.log(`💾 Group data saved to: ${outputPath}`);

    return { group, groupData };
  } catch (error) {
    console.error("❌ Error creating Merkle Tree:", error);
    throw error;
  }
}

function loadGroupFromDisk(): { group: Group; groupData: GroupData } {
  const groupDataPath = join(__dirname, "group.json");
  if (!existsSync(groupDataPath)) {
    throw new Error(
      "Group not found. Create it first with: npx ts-node scripts/merkleTree.ts create"
    );
  }
  const groupData: GroupData = JSON.parse(readFileSync(groupDataPath, "utf8"));
  const group = new Group();
  if (groupData.members && groupData.members.length > 0) {
    group.addMembers(groupData.members.map((m: string) => BigInt(m)));
  }
  return { group, groupData };
}

async function addMemberToGroup(
  identityPath: string,
  groupId: number = DEFAULT_GROUP_ID
) {
  try {
    console.log("👤 Adding member to group...");

    // Load identity
    if (!existsSync(identityPath)) {
      throw new Error(`Identity file not found: ${identityPath}`);
    }

    const identityData = JSON.parse(readFileSync(identityPath, "utf8"));

    // Load or create group
    const groupDataPath = join(__dirname, "group.json");
    let group: Group;
    let groupData: GroupData;

    if (existsSync(groupDataPath)) {
      ({ group, groupData } = loadGroupFromDisk());
    } else {
      const result = await createMerkleTree(groupId);
      group = result.group;
      groupData = result.groupData;
    }

    // Add new member using the commitment from the file
    const commitment = BigInt(identityData.commitment);
    group.addMember(commitment);

    // Update group data
    groupData.members.push(commitment.toString());
    groupData.lastUpdated = new Date().toISOString();

    // Save updated group
    writeFileSync(groupDataPath, JSON.stringify(groupData, null, 2));

    console.log("✅ Member added successfully!");
    console.log(`📋 Member details:`);
    console.log(`   Commitment: ${commitment}`);
    console.log(`   Group ID: ${groupId}`);
    console.log(`   Total members: ${group.members.length}`);
    console.log(`   Member index: ${group.members.length - 1}`);

    return { group, memberIndex: group.members.length - 1, commitment };
  } catch (error) {
    console.error("❌ Error adding member:", error);
    throw error;
  }
}

async function getGroupInfo(groupId: number = DEFAULT_GROUP_ID) {
  try {
    const groupDataPath = join(__dirname, "group.json");

    if (!existsSync(groupDataPath)) {
      console.log("❌ No group found. Create a group first.");
      return;
    }

    const groupData: GroupData = JSON.parse(
      readFileSync(groupDataPath, "utf8")
    );

    console.log("📊 Group Information:");
    console.log(`   Group ID: ${groupData.groupId}`);
    console.log(`   Tree Depth: ${groupData.treeDepth}`);
    console.log(`   Total Members: ${groupData.members.length}`);
    console.log(`   Created: ${groupData.createdAt}`);
    console.log(`   Last Updated: ${groupData.lastUpdated}`);

    if (groupData.members.length > 0) {
      console.log("👥 Members:");
      groupData.members.forEach((member, index) => {
        console.log(`   ${index}: ${member}`);
      });
    }

    return groupData;
  } catch (error) {
    console.error("❌ Error getting group info:", error);
    throw error;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "create":
      const groupId = args[1] ? parseInt(args[1]) : DEFAULT_GROUP_ID;
      await createMerkleTree(groupId);
      break;

    case "add":
      const identityPath = args[1] || join(__dirname, "identity.json");
      const targetGroupId = args[2] ? parseInt(args[2]) : DEFAULT_GROUP_ID;
      await addMemberToGroup(identityPath, targetGroupId);
      break;

    case "info":
      const infoGroupId = args[1] ? parseInt(args[1]) : DEFAULT_GROUP_ID;
      await getGroupInfo(infoGroupId);
      break;

    default:
      console.log("🌳 Semaphore Merkle Tree Manager");
      console.log("");
      console.log("Usage:");
      console.log("  npx ts-node scripts/merkleTree.ts create [groupId]");
      console.log(
        "  npx ts-node scripts/merkleTree.ts add [identityPath] [groupId]"
      );
      console.log("  npx ts-node scripts/merkleTree.ts info [groupId]");
      console.log("");
      console.log("Examples:");
      console.log("  npx ts-node scripts/merkleTree.ts create");
      console.log(
        "  npx ts-node scripts/merkleTree.ts add scripts/identity.json"
      );
      console.log("  npx ts-node scripts/merkleTree.ts info");
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

export {
  createMerkleTree,
  addMemberToGroup,
  getGroupInfo,
  loadGroupFromDisk,
  DEFAULT_DEPTH,
};
