'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const INTAKE_RELATIVE = 'intakes/universal-object-fabric-v0.7.0-2026-07-28';
const INTAKE_ROOT = path.join(WORKSPACE_ROOT, ...INTAKE_RELATIVE.split('/'));
const STAGE_ROOT = path.join(INTAKE_ROOT, 'game-stage');
const SOURCE_ROOT = path.join(INTAKE_ROOT, 'source');
const SOURCE_ARCHIVE = 'AXM_UNIVERSAL_OBJECT_FABRIC_COMPLETE_INTAKE_v0_7_0_2026-07-28.zip';
const EXPECTED_SOURCE_SHA256 = '41c82b063d754ac417af297dcd91f3c54bee239793f1376331231aad64d747a0';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function portable(file) {
  return path.relative(WORKSPACE_ROOT, file).split(path.sep).join('/');
}

function bounded(root, relative) {
  if (typeof relative !== 'string' || !relative.trim() || path.isAbsolute(relative) || relative.includes(':')) {
    throw new Error('stage path must be a non-empty portable relative path');
  }
  const target = path.resolve(root, ...relative.replace(/\\/g, '/').split('/'));
  if (target !== root && !target.startsWith(root + path.sep)) throw new Error('stage path escapes its root: ' + relative);
  return target;
}

function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const handle = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytes = 0;
    while ((bytes = fs.readSync(handle, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, bytes));
  } finally {
    fs.closeSync(handle);
  }
  return hash.digest('hex');
}

function walkFiles(root, current, found) {
  current = current || root;
  found = found || [];
  fs.readdirSync(current, { withFileTypes: true }).forEach(entry => {
    const target = path.join(current, entry.name);
    if (entry.isDirectory()) walkFiles(root, target, found);
    else found.push(path.relative(root, target).split(path.sep).join('/'));
  });
  return found;
}

function load() {
  const stageManifest = readJson(path.join(STAGE_ROOT, 'STAGE_MANIFEST.json'));
  const resolution = readJson(path.join(STAGE_ROOT, 'STAGE_RESOLUTION_MAP.json'));
  const runtimeCatalog = readJson(path.join(STAGE_ROOT, 'game_geometry', 'AXM_RUNTIME_CATALOG.json'));
  const objectCatalog = readJson(path.join(STAGE_ROOT, 'universal_objects', 'UNIVERSAL_OBJECT_CATALOG.json'));
  const runtimeByIdentity = new Map(runtimeCatalog.assets.map(item => [item.asset_id + '@' + item.version, item]));
  const objectByIdentity = new Map(objectCatalog.assets.map(item => [item.asset_id + '@' + item.asset_version, item]));
  const assets = resolution.assets.map(item => {
    const identity = item.asset_id + '@' + item.asset_version;
    return Object.freeze({
      ...item,
      identity,
      runtime: runtimeByIdentity.get(identity) || null,
      universal: objectByIdentity.get(identity) || null
    });
  });
  return Object.freeze({ stageManifest, resolution, runtimeCatalog, objectCatalog, assets: Object.freeze(assets) });
}

function listAssets() {
  return load().assets.map(item => JSON.parse(JSON.stringify(item)));
}

function resolve(assetId, assetVersion) {
  if (!String(assetId || '').trim() || !String(assetVersion || '').trim()) {
    throw new Error('exact assetId and assetVersion are required');
  }
  const identity = String(assetId).trim() + '@' + String(assetVersion).trim();
  const matches = load().assets.filter(item => item.identity === identity);
  if (matches.length !== 1) throw new Error('exact Universal Object identity not found: ' + identity);
  const item = matches[0];
  return {
    schema: 'axm.uof.exact-resolution/v0.7',
    identity,
    stageRoot: portable(STAGE_ROOT),
    runtimeManifest: item.runtime_manifest,
    universalManifest: item.universal_manifest,
    runtimeCapsule: item.runtime_capsule,
    visualSkin: item.visual_skin
  };
}

function verifyStage() {
  const errors = [];
  const warnings = [];
  const loaded = load();
  if (loaded.stageManifest.status !== 'STAGED-NOT-INTEGRATED') errors.push('stage status must remain STAGED-NOT-INTEGRATED');
  if (loaded.assets.length !== 10 || loaded.stageManifest.asset_count !== 10) errors.push('exactly ten staged assets are required');
  const identities = new Set();
  loaded.assets.forEach(item => {
    if (identities.has(item.identity)) errors.push('duplicate identity: ' + item.identity);
    identities.add(item.identity);
    if (!item.runtime || !item.universal) errors.push('catalog join failed: ' + item.identity);
    const files = [item.runtime_manifest, item.universal_manifest, item.runtime_capsule, item.visual_skin];
    files.forEach(relative => {
      const target = bounded(STAGE_ROOT, relative);
      if (!fs.existsSync(target)) errors.push('missing resolved file: ' + relative);
    });
    if (files.some(relative => /\.(?:stl|3mf)$/i.test(relative))) errors.push('manufacturing path leaked into resolution: ' + item.identity);
    if (!files.every(relative => fs.existsSync(bounded(STAGE_ROOT, relative)))) return;
    const runtime = readJson(bounded(STAGE_ROOT, item.runtime_manifest));
    const universal = readJson(bounded(STAGE_ROOT, item.universal_manifest));
    const capsule = readJson(bounded(STAGE_ROOT, item.runtime_capsule));
    const skin = readJson(bounded(STAGE_ROOT, item.visual_skin));
    if (runtime.asset.asset_id !== item.asset_id || runtime.asset.version !== item.asset_version) errors.push('runtime identity drift: ' + item.identity);
    if (universal.asset_id !== item.asset_id || universal.asset_version !== item.asset_version) errors.push('Universal Object identity drift: ' + item.identity);
    if (capsule.asset.asset_id !== item.asset_id || capsule.asset.asset_version !== item.asset_version) errors.push('Runtime Capsule identity drift: ' + item.identity);
    if (skin.asset_id !== item.asset_id || skin.asset_version !== item.asset_version) errors.push('visual-skin identity drift: ' + item.identity);
    if (capsule.authority_limits.automatic_game_project_write !== false || capsule.authority_limits.manufacturing_authority !== false) {
      errors.push('authority boundary drift: ' + item.identity);
    }
    if (universal.validation_status === 'WARN') warnings.push(item.asset_id + ': declared object WARN preserved');
  });

  const checksumFile = path.join(STAGE_ROOT, 'STAGE_SHA256SUMS.txt');
  const rows = fs.readFileSync(checksumFile, 'utf8').split(/\r?\n/).filter(Boolean);
  const declared = new Map();
  rows.forEach((line, index) => {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match) return errors.push('invalid checksum row ' + (index + 1));
    if (declared.has(match[2])) return errors.push('duplicate checksum path: ' + match[2]);
    declared.set(match[2], match[1]);
  });
  if (declared.size !== 668) errors.push('expected 668 staged checksum rows, found ' + declared.size);
  declared.forEach((expected, relative) => {
    const target = bounded(STAGE_ROOT, relative);
    if (!fs.existsSync(target)) errors.push('checksummed stage file missing: ' + relative);
    else if (sha256File(target) !== expected) errors.push('stage checksum mismatch: ' + relative);
  });
  const actual = walkFiles(STAGE_ROOT).filter(relative => relative !== 'STAGE_SHA256SUMS.txt');
  actual.forEach(relative => { if (!declared.has(relative)) errors.push('unlisted stage file: ' + relative); });
  declared.forEach((value, relative) => { if (!actual.includes(relative)) errors.push('listed stage file absent: ' + relative); });
  const manufacturing = actual.filter(relative => /\.(?:stl|3mf)$/i.test(relative));
  if (manufacturing.length) errors.push('manufacturing files present in game stage: ' + manufacturing.join(', '));

  const sourceArchive = path.join(SOURCE_ROOT, SOURCE_ARCHIVE);
  const acceptance = readJson(path.join(SOURCE_ROOT, 'AXM_UNIVERSAL_OBJECT_FABRIC_COMPLETE_INTAKE_v0_7_0_2026-07-28_FINAL_ACCEPTANCE.json'));
  const sourceSha256 = fs.existsSync(sourceArchive) ? sha256File(sourceArchive) : null;
  if (sourceSha256 !== EXPECTED_SOURCE_SHA256) errors.push('accepted source archive SHA-256 mismatch');
  if (acceptance.zip_sha256 !== EXPECTED_SOURCE_SHA256 || acceptance.zip_file_members !== 3344) errors.push('source acceptance receipt drift');

  return {
    status: errors.length ? 'FAIL' : warnings.length ? 'PASS-WITH-DECLARED-WARN' : 'PASS',
    assetCount: loaded.assets.length,
    checksumCount: declared.size,
    sourceSha256,
    manufacturingFiles: manufacturing,
    warnings: Array.from(new Set(warnings)),
    errors
  };
}

module.exports = {
  EXPECTED_SOURCE_SHA256,
  INTAKE_RELATIVE,
  INTAKE_ROOT,
  STAGE_ROOT,
  listAssets,
  resolve,
  verifyStage
};
