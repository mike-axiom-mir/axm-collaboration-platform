#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = __dirname;
const workshop = path.resolve(root, '..', '..');
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks += 1; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks += 1; };
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const json = (name) => JSON.parse(read(name));
const hash = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();

async function main() {
  const manifest = json('manifest.json');
  const contract = json('module.contract.json');
  equal(manifest.id, 'asset-engine-roundtrip-bridge', 'Manifest identity');
  equal(contract.id, manifest.id, 'Contract identity');
  equal(contract.version, manifest.version, 'Contract version');
  equal(manifest.category, 'Build', 'Hub parent');
  check(manifest.actions.length === 4 && manifest.produces.length === 3, 'Machine discovery metadata exists');
  check(contract.boundaries.automaticWrites.length === 0, 'No automatic writes');
  for (const refusal of ['source-glb-mutation', 'hidden-unit-or-axis-conversion', 'hidden-feature-loss', 'unsupported-feature-pass', 'visual-quality-approval-by-structure']) {
    check(contract.boundaries.refuses.includes(refusal), `Boundary refuses ${refusal}`);
  }
  const sources = ['index.html','styles.css','app.js','bridge-core.mjs','roundtrip-verifier.mjs'].map(read).join('\n');
  check(!/https?:\/\//i.test(sources), 'No external runtime URL');
  check(!/three(?:\.min)?\.js|from\s+['\"]three['\"]|THREE\./i.test(['app.js','bridge-core.mjs','roundtrip-verifier.mjs'].map(read).join('\n')), 'No Three.js dependency');
  check(!/from\s+['\"].*bridge-core/.test(read('roundtrip-verifier.mjs')), 'Verifier is implementation-independent from compiler');
  check(/source bytes written/.test(read('index.html')) && /Structure is not beauty/.test(read('index.html')), 'Human UI exposes immutability and visual boundary');

  const core = await import(pathToFileURL(path.join(root, 'bridge-core.mjs')).href);
  const verifier = await import(pathToFileURL(path.join(root, 'roundtrip-verifier.mjs')).href);
  const glb = await import(pathToFileURL(path.join(workshop, 'tools', 'local-3d-game-runtime', 'native-glb.mjs')).href);
  const fixtures = [
    {
      id: 'district-storefront', file: path.join(workshop, 'tools', 'ps2-asset-forge', 'proof', 'exports', 'storefront-technical-proof.glb'),
      sha: 'AFCB7802418930DEE6F8B7A410F1C78CE401D4C6F8B728336E99F62458237222', expected: { nodes: 42, meshes: 28, materials: 16, skins: 0, animations: 0 }
    },
    {
      id: 'animated-pedestrian', file: path.join(workshop, 'tools', 'ps2-asset-forge', 'proof', 'exports', 'animated-pedestrian.glb'),
      sha: 'B448863767B1A770D70EFD45F04DDDF1BBA93B7855D1DBA7A9A6456115685D63', expected: { nodes: 108, meshes: 13, materials: 13, skins: 13, animations: 22 }
    }
  ];
  for (const fixture of fixtures) {
    const bytes = fs.readFileSync(fixture.file);
    const before = Buffer.from(bytes);
    equal(hash(bytes), fixture.sha, `${fixture.id} exact source digest`);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const inspected = core.inspectBytes(arrayBuffer, fixture.id);
    equal(Object.fromEntries(Object.keys(fixture.expected).map((key) => [key, inspected.descriptor.structure[key]])), fixture.expected, `${fixture.id} source structure`);
    equal(inspected.losses, [], `${fixture.id} has no hidden runtime loss`);
    const engine = core.compileEngineContract(inspected.descriptor, { sha256: fixture.sha, byteLength: bytes.byteLength, losses: inspected.losses });
    const verification = verifier.verifyRoundTrip(inspected.descriptor, engine, { sha256: fixture.sha, byteLength: bytes.byteLength });
    equal(verification.status, 'pass', `${fixture.id} parity passes`);
    equal(verification.summary.failed, 0, `${fixture.id} has no parity failures`);
    equal(verification.checks.length, 14, `${fixture.id} emits complete parity matrix`);
    equal(engine.importProfile.transformApplied, false, `${fixture.id} has no hidden axis transform`);
    equal(engine.importProfile.unitConversionApplied, false, `${fixture.id} has no hidden unit conversion`);
    equal(engine.source.immutable, true, `${fixture.id} source is immutable`);
    equal(hash(bytes), hash(before), `${fixture.id} bytes unchanged after compilation`);
    equal(core.stableJson(engine), core.stableJson(core.compileEngineContract(inspected.descriptor, { sha256: fixture.sha, byteLength: bytes.byteLength, losses: inspected.losses })), `${fixture.id} contract is deterministic`);
  }

  const negativeBytes = fs.readFileSync(fixtures[1].file);
  const negativeModel = glb.parseGlb(negativeBytes.buffer.slice(negativeBytes.byteOffset, negativeBytes.byteOffset + negativeBytes.byteLength));
  negativeModel.document.animations[0].samplers[0].interpolation = 'CUBICSPLINE';
  const declaredLosses = core.sourceLosses(negativeModel);
  check(declaredLosses.some((loss) => loss.id === 'animation-interpolation' && loss.severity === 'error'), 'Unsupported interpolation becomes an explicit blocking loss');
  const validDescriptor = core.describeSource(negativeModel, 'negative-animation');
  const blockedEngine = core.compileEngineContract(validDescriptor, { sha256: hash(negativeBytes), byteLength: negativeBytes.byteLength, losses: declaredLosses });
  const blocked = verifier.verifyRoundTrip(validDescriptor, blockedEngine, { sha256: hash(negativeBytes), byteLength: negativeBytes.byteLength });
  equal(blocked.status, 'blocked', 'Unsupported feature fails closed');
  check(blocked.checks.some((entry) => entry.id === 'loss-registry' && entry.status === 'fail'), 'Loss registry is part of verdict');

  console.log(`Asset ↔ Engine Round-trip Bridge self-test passed ${checks} checks.`);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
