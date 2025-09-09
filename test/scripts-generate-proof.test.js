const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('Generate/Verify proof script', function () {
  const identityPath = path.join(__dirname, '..', 'scripts', 'identity.json');
  const proofPath = path.join(__dirname, '..', 'scripts', 'proof.json');
  const groupPath = path.join(__dirname, '..', 'scripts', 'group.json');

  it('can generate a placeholder proof in local mode and verify step runs', function () {
    this.timeout(30000); // Increase timeout for proof generation
    // Ensure identity exists
    if (!fs.existsSync(identityPath)) {
      const resId = spawnSync('npx', ['ts-node', path.join('scripts', 'createIdentifieir.ts')], { encoding: 'utf8' });
      if (resId.status !== 0) {
        console.error('identity script stdout:\n', resId.stdout);
        console.error('identity script stderr:\n', resId.stderr);
        throw new Error('Failed to generate identity.json');
      }
    }

    // Remove previous proof and group
    try { fs.unlinkSync(proofPath); } catch (_) {}
    try { fs.unlinkSync(groupPath); } catch (_) {}

    // Create group
    const resGroup = spawnSync('npx', ['ts-node', path.join('scripts', 'merkleTree.ts'), 'create'], { encoding: 'utf8' });
    if (resGroup.status !== 0) {
      console.error('group creation stdout:\n', resGroup.stdout);
      console.error('group creation stderr:\n', resGroup.stderr);
      throw new Error('Failed to create group');
    }

    // Add identity to group
    const resAdd = spawnSync('npx', ['ts-node', path.join('scripts', 'merkleTree.ts'), 'add', identityPath], { encoding: 'utf8' });
    if (resAdd.status !== 0) {
      console.error('add member stdout:\n', resAdd.stdout);
      console.error('add member stderr:\n', resAdd.stderr);
      throw new Error('Failed to add identity to group');
    }

    // Generate (local mode avoids needing a blockchain)
    const resGen = spawnSync('npx', ['ts-node', path.join('scripts', 'generateProof.ts'), 'generate', identityPath, 'local', '1', 'true'], { encoding: 'utf8' });
    if (resGen.status !== 0) {
      console.error('generate stdout:\n', resGen.stdout);
      console.error('generate stderr:\n', resGen.stderr);
    }
    if (resGen.status !== 0) throw new Error('generateProof.ts generate exited with non-zero code');

    if (!fs.existsSync(proofPath)) throw new Error('proof.json not created');

    // Verify (will likely be INVALID but the command should complete successfully)
    const resVer = spawnSync('npx', ['ts-node', path.join('scripts', 'generateProof.ts'), 'verify', proofPath], { encoding: 'utf8' });
    if (resVer.status !== 0) {
      console.error('verify stdout:\n', resVer.stdout);
      console.error('verify stderr:\n', resVer.stderr);
    }
    if (resVer.status !== 0) throw new Error('generateProof.ts verify exited with non-zero code');
  });
});
