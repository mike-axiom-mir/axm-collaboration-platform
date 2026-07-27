#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Core = require('./core');
const Runner = require('./runner');
const Toolchain = require('./toolchain');
const Ktx2Glb = require('./ktx2-glb');
const ContractVerifier = require('../../hub/module-contract-verifier');

const moduleRoot = __dirname;
const workshopRoot = path.resolve(__dirname, '../..');
let assertions = 0;
function check(value, message) { assert.ok(value, message); assertions += 1; }

function json(relative) {
  return JSON.parse(fs.readFileSync(path.join(moduleRoot, relative), 'utf8'));
}

function ps2TreeDigest() {
  const root = path.join(workshopRoot, 'tools', 'ps2-asset-forge');
  const files = [];
  (function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file); else files.push(file);
    }
  }(root));
  const relative = file => path.relative(root, file).split(path.sep).join('/');
  files.sort((left, right) => relative(left) < relative(right) ? -1 : relative(left) > relative(right) ? 1 : 0);
  const lines = files.map(file => relative(file) + '\t' + Core.fileDigest(file) + '\t' + fs.statSync(file).size);
  return { fileCount: files.length, byteCount: files.reduce((sum, file) => sum + fs.statSync(file).size, 0), digest: Core.sha256(lines.join('\n')) };
}

async function main() {
  for (const relative of [
    'manifest.json', 'module.contract.json', 'schemas/build-request.schema.json', 'schemas/build-receipt.schema.json',
    'schemas/asset-manifest.schema.json', 'schemas/capability-inventory.schema.json', 'phase0/requirements.json',
    'phase0/capability-inventory.json', 'phase0/capability-gap-report.json', 'phase0/ps2-preservation-baseline.json', 'phase0/modular-hands-audit.json',
    'phase0/evidence-matrix.json', 'examples/phase1-existing-glb.request.json', 'examples/phase1-existing-glb-with-texture.request.json'
  ]) check(json(relative), relative + ' must parse as JSON');

  const manifest = json('manifest.json');
  const contract = json('module.contract.json');
  const contractResult = ContractVerifier.validateContract(contract, manifest);
  check(contractResult.pass, 'module contract must pass: ' + contractResult.errors.join(', '));
  check(contract.boundaries.refuses.includes('silent-requirement-weakening'), 'contract must refuse silent weakening');
  check(contract.boundaries.refuses.includes('automatic-library-download'), 'contract must refuse library downloads');
  check(contract.boundaries.refuses.includes('editing-or-replacing-the-ps2-asset-forge'), 'contract must preserve PS2 Forge');

  const request = json('examples/phase1-existing-glb.request.json');
  check(Core.validateRequest(request).pass, 'example request must pass runtime validation');
  const invalidCanonical = JSON.parse(JSON.stringify(request));
  invalidCanonical.mode = 'canonical_build';
  check(!Core.validateRequest(invalidCanonical).pass, 'canonical build must reject GLB-only source truth');
  assert.throws(() => Core.cleanRelative('../escape.glb'), /escapes/); assertions += 1;
  assert.throws(() => Core.cleanRelative('E:\\vault\\asset.glb'), /absolute|drive/); assertions += 1;

  const baseline = json('phase0/ps2-preservation-baseline.json');
  const observedTree = ps2TreeDigest();
  check(observedTree.fileCount === baseline.file_count, 'PS2 file count must remain stable');
  check(observedTree.byteCount === baseline.byte_count, 'PS2 byte count must remain stable');
  check(observedTree.digest === baseline.tree_sha256, 'PS2 tree digest must remain stable');
  for (const item of baseline.key_files) check(Core.fileDigest(path.join(workshopRoot, 'tools', 'ps2-asset-forge', item.path)) === item.sha256, 'PS2 key file drift: ' + item.path);
  const ps2Test = childProcess.spawnSync(process.execPath, [path.join(workshopRoot, 'tools', 'ps2-asset-forge', 'selftest.js')], { cwd: workshopRoot, shell: false, windowsHide: true, encoding: 'utf8', timeout: 30000 });
  check(ps2Test.status === 0 && /PASS/.test(ps2Test.stdout), 'PS2 selftest must still pass');

  const proof = path.join(workshopRoot, 'tools', 'ps2-asset-forge', 'proof', 'exports', 'storefront-technical-proof.glb');
  const inspected = Core.inspectGlb(fs.readFileSync(proof));
  check(inspected.pass, 'real PS2 proof GLB must pass Modern Forge inspection');
  check(inspected.metrics.meshes > 0 && inspected.metrics.triangles > 0, 'GLB metrics must be derived from real geometry');
  const damaged = Buffer.from(fs.readFileSync(proof));
  damaged.writeUInt32LE(damaged.length + 12, 8);
  check(!Core.inspectGlb(damaged).pass, 'length-tampered GLB must fail');

  const rgba = new Uint8Array(4 * 4 * 4);
  for (let index = 0; index < rgba.length; index += 4) {
    rgba[index] = (index * 17) % 255; rgba[index + 1] = 110; rgba[index + 2] = 190; rgba[index + 3] = 255;
  }
  const encoded = await Toolchain.KTX2.encodeRgba(4, 4, rgba, { colourSpace: 'srgb', transparency: 'opaque', tileable: false, maxMipLevels: 3, quality: 160, effort: 2 });
  const ktxValidation = await Toolchain.KTX2.validate(encoded.bytes, { includePixels: true });
  check(ktxValidation.pass, 'bundled engine must encode and independently decode real KTX2 bytes');
  check(ktxValidation.structural.supercompressionName === 'BasisLZ' && ktxValidation.module.isEtc1s, 'KTX2 must be ETC1S BasisLZ, not relabelled bytes');
  const bound = Ktx2Glb.bind(fs.readFileSync(proof), [{ targetTextureIndex: 0, bytes: Buffer.from(encoded.bytes), name: 'selftest-base-color' }]);
  const boundInspection = Core.inspectGlb(bound.bytes);
  check(boundInspection.pass, 'KTX2 binding hand must emit a structurally valid GLB');
  check(boundInspection.metrics.extensions_required.includes('KHR_texture_basisu'), 'bound GLB must require KHR_texture_basisu instead of silently falling back');
  check(bound.receipt.fallback_sources_removed === true && bound.receipt.mappings.length === 1, 'binding receipt must expose the exact texture replacement');
  assert.throws(() => Ktx2Glb.bind(fs.readFileSync(proof), [
    { targetTextureIndex: 0, bytes: Buffer.from(encoded.bytes) },
    { targetTextureIndex: 0, bytes: Buffer.from(encoded.bytes) }
  ]), /more than once/); assertions += 1;

  const snapshot = json('phase0/capability-inventory.json');
  const snapshotDigest = snapshot.digest;
  delete snapshot.digest;
  check(Core.sha256(Core.stableStringify(snapshot)) === snapshotDigest, 'Phase 0 capability snapshot digest must bind its content');
  const live = await Toolchain.discover({});
  check(live.inventory.automatic_installation === false, 'capability discovery must never install tools');
  check(live.inventory.capabilities.find(item => item.id === 'encode.ktx2.basis').status === 'available', 'real bundled Basis capability must be live');
  check(live.tools.browser.available, 'pinned local KTX2 and meshopt browser runtime must pass byte-level verification');
  check(live.inventory.capabilities.find(item => item.id === 'render.webgl2.ktx2').status === 'available', 'KTX2 browser runtime capability must be available');
  check(live.inventory.capabilities.find(item => item.id === 'render.webgl2.meshopt').status === 'available', 'meshopt browser runtime capability must be available');

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-modern-forge-selftest-'));
  try {
    const result = await Runner.run(request, { workspaceRoot: workshopRoot, vaultRoot: tempRoot });
    check(result.receipt.status === 'BLOCKED', 'diagnostic run must expose missing required Phase 1 stages');
    check(result.receipt.canonical_delivery_emitted === false, 'diagnostic run must not emit canonical delivery');
    check(result.receipt.network_access_performed === false && result.receipt.automatic_installation === false, 'run must stay local and installation-free');
    check(result.receipt.stages.find(item => item.id === 'axm-glb-inspection').status === 'PASS', 'real GLB inspection stage must run');
    const optimizerStage = result.receipt.stages.find(item => item.id === 'meshopt-optimization');
    if (live.tools.transform.available || live.tools.gltfpack.available) {
      check(optimizerStage.status === 'DEGRADED', 'live unpinned optimizer must execute but remain degraded');
      check(optimizerStage.detail.output_created === true && optimizerStage.detail.output_bytes > 0, 'optimizer output must exist and pass GLB inspection');
    } else {
      check(optimizerStage.status === 'BLOCKED', 'missing optimizer must remain blocked');
    }
    check(result.receipt.stages.find(item => item.id === 'browser-webgl2-smoke').status === 'PREPARED', 'browser smoke must be prepared, not falsely passed');
    check(result.manifest.canonical_runtime_artifact_id === null, 'manifest must withhold canonical artifact id');
  } finally {
    const resolved = path.resolve(tempRoot);
    const expectedPrefix = path.resolve(os.tmpdir()) + path.sep;
    if (!resolved.startsWith(expectedPrefix) || !path.basename(resolved).startsWith('axm-modern-forge-selftest-')) throw new Error('refused unsafe selftest cleanup');
    fs.rmSync(resolved, { recursive: true, force: true });
  }
  process.stdout.write('Modern Asset Forge selftest: PASS (' + assertions + ' assertions; PS2 preserved; real GLB/KTX2 engines exercised; gaps retained)\n');
}

main().catch(error => {
  process.stderr.write('Modern Asset Forge selftest: FAIL\n' + (error.stack || error.message) + '\n');
  process.exitCode = 1;
});
