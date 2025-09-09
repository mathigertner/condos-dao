const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('Identity creation script', function () {
  const identityPath = path.join(__dirname, '..', 'scripts', 'identity.json');

  it('generates identity.json with expected fields', function () {
    // Remove previous file if exists
    try { fs.unlinkSync(identityPath); } catch (_) {}

    const result = spawnSync('npx', ['ts-node', path.join('scripts', 'createIdentifieir.ts')], {
      encoding: 'utf8'
    });

    if (result.error) {
      console.error(result.error);
    }

    // Expect successful exit
    if (result.status !== 0) {
      console.error('stdout:\n', result.stdout);
      console.error('stderr:\n', result.stderr);
    }
    if (result.status !== 0) throw new Error('createIdentifieir.ts exited with non-zero code');

    // Check file exists
    if (!fs.existsSync(identityPath)) throw new Error('identity.json not created');

    const data = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
    ['privateKey', 'secretScalar', 'publicKey', 'commitment', 'createdAt'].forEach((k) => {
      if (!(k in data)) throw new Error(`Missing field ${k}`);
      if (typeof data[k] !== 'string' || data[k].length === 0) throw new Error(`Field ${k} is empty`);
    });
  });
});
