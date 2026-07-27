#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Codec = require('../accessible-document-codec');
const Hands = require('../asset-hands');
const Installer = require('./installer');
const Live = require('./live-executor');
const Pack = require('./pack-core');
const Zip = require('./zip');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-substrate-pack-'));
try {
  const lock = Pack.loadLock();
  assert.equal(lock.entries.length, 21);
  assert.equal(new Set(lock.entries.map((entry) => entry.id)).size, 21);
  assert.equal(lock.compositions.length, 1);
  assert.deepEqual(lock.compositions[0].components, ['godot', 'blender']);
  assert(lock.entries.every((entry) => /^[a-f0-9]{64}$/.test(entry.source.sha256) && entry.source.size_bytes > 0));
  assert(lock.entries.every((entry) => entry.licence.review_status === 'REVIEWED_FOR_LOCAL_TEST'));
  assert.equal(lock.policy.runtime_bytes_in_source, false);
  assert.equal(lock.policy.automatic_execution, false);
  const legacyLock = JSON.parse(JSON.stringify(lock));
  delete legacyLock.compositions;
  const legacyLockFile = path.join(root, 'legacy-lock.json');
  fs.writeFileSync(legacyLockFile, JSON.stringify(legacyLock));
  assert.equal(Pack.loadLock(legacyLockFile).entries.length, 21, 'locks saved before composition support remain readable');

  const missing = Pack.inventory({ root });
  assert.deepEqual(missing.counts, { MISSING: 21 });
  assert.deepEqual(missing.composition_counts, { DEPENDENCY_HOLD: 1 });
  assert.equal(missing.compositions[0].status, 'DEPENDENCY_HOLD');
  assert.deepEqual(missing.available_substrates, []);
  assert.equal(missing.private_location_retained, false);
  assert.equal(missing.automatic_installation, false);
  assert.equal(fs.existsSync(path.join(root, 'downloads')), false, 'read-only inventory must not create downloads');
  assert.equal(Pack.resolveRequest({ id: 'gltf-validator' }, { root }).status, 'MISSING');
  assert.equal(Pack.resolveRequest({ id: 'gltf-validator' }, { root, inventory: missing }).status, 'MISSING');
  assert.throws(() => Pack.resolveRequest({ id: 'gltf-validator' }, { root, inventory: JSON.parse(JSON.stringify(missing)) }), /not observed/);
  assert.equal(Pack.resolveRequest({ id: 'offline-renderer' }, { root }).status, 'MISSING');
  assert.equal(Pack.resolveRequest({ id: 'cross-renderer-runtime' }, { root }).status, 'MISSING');

  const refusedInstall = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'installer.js'), 'install', '--id', 'gltf-validator', '--root', root], { encoding: 'utf8', windowsHide: true, shell: false });
  assert.equal(refusedInstall.status, 1);
  assert.match(refusedInstall.stderr, /--yes and --accept/);
  assert.throws(() => Installer.parse(['status', '--surprise']), /unknown argument/);
  assert.equal(Live.createExecutor({ root }).identity.fresh_process, true);
  assert.equal(typeof Hands.runBlenderLiveRender, 'function');
  assert.equal(typeof Hands.runBlenderCapabilityMatrix, 'function');
  assert.equal(typeof Hands.runFfmpegCapabilityMatrix, 'function');
  assert.equal(typeof Hands.runEmbroideryCapabilityMatrix, 'function');
  assert.equal(typeof Hands.runThreeMfCapabilityMatrix, 'function');
  assert.equal(typeof Hands.runBrepStepCapabilityMatrix, 'function');

  const document = { schema: 'axm.accessible-document/v1', version: '1.0.0', id: 'zip', title: 'ZIP', language: 'en', direction: 'ltr', sections: [{ id: 'h', role: 'heading-1', text: 'ZIP', alt_text: null }], reading_order: ['h'], accessibility: { reading_order: true, alternative_text: true, structural_navigation: true, keyboard_navigation: true } };
  const archive = Buffer.from(Codec.epub(document).bytes);
  assert(Zip.list(archive).length >= 6);
  const corrupt = Buffer.from(archive);
  for (let offset = 0; offset <= corrupt.length - 8; offset += 1) if (corrupt.subarray(offset, offset + 8).toString('ascii') === 'mimetype') corrupt.write('../evilx', offset, 'ascii');
  assert.throws(() => Zip.list(corrupt), /traversal|unsafe/i);

  const archiveBytes = Buffer.from('exact fake source archive');
  const toolBytes = Buffer.from('exact fake executable');
  const fake = {
    id: 'fake-runtime', runtime_version: '1.0.0', source: { artifact_name: 'fake.zip', sha256: Pack.sha256(archiveBytes), size_bytes: archiveBytes.length },
    installation: { strategy: 'extract-zip', destination: 'fake-runtime/1.0.0', entrypoints: { tool: 'tool.exe' } }
  };
  const download = path.join(root, 'downloads', fake.source.artifact_name);
  const runtime = path.join(root, 'runtimes', fake.installation.destination);
  fs.mkdirSync(path.dirname(download), { recursive: true }); fs.writeFileSync(download, archiveBytes);
  fs.mkdirSync(runtime, { recursive: true }); fs.writeFileSync(path.join(runtime, 'tool.exe'), toolBytes);
  const marker = { schema: 'axm.external-substrate-install-marker/v1', id: fake.id, runtime_version: fake.runtime_version, source_artifact_sha256: fake.source.sha256, source_size_bytes: fake.source.size_bytes, licence_review_status: 'REVIEWED_FOR_LOCAL_TEST', entrypoint_sha256: { tool: Pack.sha256(toolBytes) }, installed_by: 'axm-substrate-pack', network_execution_authority: false };
  marker.digest = Pack.digest(marker);
  fs.writeFileSync(path.join(runtime, '.axm-substrate.json'), JSON.stringify(marker));
  assert.equal(Pack.verifyInstalled(fake, root).status, 'INSTALLED_VERIFIED');
  fs.writeFileSync(path.join(runtime, 'tool.exe'), Buffer.from('tampered'));
  assert.equal(Pack.verifyInstalled(fake, root).status, 'TAMPERED');
  marker.runtime_version = 'changed-without-new-digest';
  fs.writeFileSync(path.join(runtime, '.axm-substrate.json'), JSON.stringify(marker));
  assert.equal(Pack.verifyInstalled(fake, root).status, 'TAMPERED');

  const canvas = { medium: 'game-world', dimensions: { width: 1, height: 1, unit: 'game-world-unit' }, colour: { space: 'srgb', transparency: 'allowed' }, behaviour: ['static'], intended_use: 'ground-tile' };
  const request = { required_capabilities: ['asset.validator.gltf.official'], target_canvas: canvas, required_outputs: ['application/json'], available_substrates: ['khronos-gltf-validator', 'offline-renderer'] };
  const routed = Hands.diagnoseUpgradeWithInstalledSubstrates(request, { root });
  assert.equal(routed.status, 'MISSING_SUBSTRATE');
  assert(routed.missing.includes('khronos-gltf-validator'), 'caller substrate claims must be replaced by observed inventory');
  assert.equal(routed.substrate_authority, 'server-observed-exact-pack');
  assert(!JSON.stringify({ missing, routed }).includes(path.resolve(root)), 'public pack state must not retain private roots');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log('AXM substrate pack selftest PASS (exact lock, no implicit install, consent gate, safe ZIP, tamper evidence, honest missing resolution and anti-spoof registry routing)');
