#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/authority-core');

let checks = 0;
function check(label, action) {
  action();
  checks += 1;
  process.stdout.write('PASS ' + label + '\n');
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function manifest(id, fields = {}) {
  return Object.assign({
    id,
    name: id,
    version: 'v0.1',
    status: 'EXPERIMENTAL',
    entry: 'index.html',
    uses: [],
    permissions: []
  }, fields);
}

function contract(id, fields = {}) {
  return Object.assign({
    schema: 'axm.module-contract/v1',
    id,
    version: 'v0.1',
    provides: [],
    consumes: [],
    permissions: [],
    handoffs: { emits: [], accepts: [] },
    boundaries: { writes: [], refuses: ['automatic-apply'] },
    lifecycle: { state_owner: 'none', reload: 'reset', disconnect: 'not-applicable', cleanup: 'not-applicable' }
  }, fields);
}

function module(root, id, manifestFields, contractValue) {
  const directory = path.join(root, 'tools', id);
  fs.mkdirSync(directory, { recursive: true });
  const value = manifest(id, manifestFields);
  if (contractValue) value.contract = 'module.contract.json';
  writeJson(path.join(directory, 'manifest.json'), value);
  fs.writeFileSync(path.join(directory, 'index.html'), '<!doctype html>');
  if (contractValue) writeJson(path.join(directory, 'module.contract.json'), contractValue);
}

function treeReceipt(root) {
  const rows = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute);
      if (entry.isSymbolicLink()) rows.push('SYMLINK:' + relative);
      else if (entry.isDirectory()) visit(absolute);
      else rows.push(relative + ':' + fs.statSync(absolute).size);
    }
  }
  visit(root);
  return rows;
}

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-authority-'));
try {
  fs.mkdirSync(path.join(fixtureRoot, 'tools'), { recursive: true });
  module(fixtureRoot, 'exact', {
    uses: ['storage'],
    permissions: ['storage']
  }, contract('exact', {
    permissions: ['storage'],
    boundaries: { writes: ['state/exact.json'], refuses: ['automatic-apply', 'network'] }
  }));
  module(fixtureRoot, 'permissionless', {
    uses: [],
    permissions: []
  }, contract('permissionless'));
  module(fixtureRoot, 'unknown-contract', {
    uses: ['network.fetch'],
    permissions: ['network.fetch']
  }, null);
  module(fixtureRoot, 'permission-drift', {
    uses: ['storage', 'network.fetch'],
    permissions: ['storage']
  }, contract('permission-drift', {
    permissions: ['network.fetch']
  }));
  module(fixtureRoot, 'outside-uses', {
    uses: ['storage'],
    permissions: ['network.fetch']
  }, contract('outside-uses', {
    permissions: ['network.fetch']
  }));
  const incomplete = contract('incomplete');
  delete incomplete.boundaries.writes;
  module(fixtureRoot, 'incomplete', {
    uses: [],
    permissions: []
  }, incomplete);
  module(fixtureRoot, 'id-drift', {
    uses: [],
    permissions: []
  }, contract('other-id'));
  const missingPermissionField = manifest('missing-manifest-field', { uses: [] });
  delete missingPermissionField.permissions;
  const missingDirectory = path.join(fixtureRoot, 'tools', 'missing-manifest-field');
  fs.mkdirSync(missingDirectory, { recursive: true });
  missingPermissionField.contract = 'module.contract.json';
  writeJson(path.join(missingDirectory, 'manifest.json'), missingPermissionField);
  fs.writeFileSync(path.join(missingDirectory, 'index.html'), '<!doctype html>');
  writeJson(path.join(missingDirectory, 'module.contract.json'), contract('missing-manifest-field'));
  fs.symlinkSync(path.join(fixtureRoot, 'tools', 'exact'), path.join(fixtureRoot, 'tools', 'linked-tool'), process.platform === 'win32' ? 'junction' : 'dir');

  const before = treeReceipt(fixtureRoot);
  const first = Core.scanWorkshop(fixtureRoot, { now: '2026-07-26T00:00:00Z' });
  const second = Core.scanWorkshop(fixtureRoot, { now: '2026-07-26T01:00:00Z' });
  const after = treeReceipt(fixtureRoot);
  const record = id => first.modules.find(moduleRecord => moduleRecord.id === id);

  check('string declarations are deduplicated and sorted exactly', () => {
    assert.deepEqual(Core.cleanStrings(['z', 'a', 'z', '', 4]), ['a', 'z']);
  });
  check('contract paths cannot escape a module folder', () => {
    const directory = path.join(fixtureRoot, 'tools', 'exact');
    assert(Core.safeContractPath(directory, 'module.contract.json').startsWith(directory));
    assert.equal(Core.safeContractPath(directory, '../escape.json'), null);
  });
  check('scope excludes underscore folders and filesystem symlinks', () => {
    assert.equal(first.summary.modules, 8);
    assert.deepEqual(first.source.skippedSymlinks, ['linked-tool']);
    assert.equal(first.source.symlinksFollowed, false);
  });
  check('matching manifest contract and uses declarations are exact', () => {
    assert.equal(record('exact').state, 'EXACT_DECLARATION');
    assert.deepEqual(record('exact').deltas.contractPermissionsOutsideManifestUses, []);
  });
  check('empty permissions remain declarations rather than safety proof', () => {
    assert.equal(record('permissionless').state, 'EXACT_DECLARATION');
    assert.equal(record('permissionless').truth.permissionlessMeansSafe, false);
  });
  check('missing contracts remain unknown authority surfaces', () => {
    assert.equal(record('unknown-contract').state, 'CONTRACT_AUTHORITY_UNKNOWN');
    assert(record('unknown-contract').findings.includes('CONTRACT_AUTHORITY_UNKNOWN'));
    assert(!record('unknown-contract').findings.includes('MANIFEST_CONTRACT_PERMISSION_DRIFT'));
  });
  check('manifest and contract permission differences stay visible', () => {
    assert.equal(record('permission-drift').state, 'PERMISSION_DRIFT');
    assert.deepEqual(record('permission-drift').deltas.manifestOnlyPermissions, ['storage']);
    assert.deepEqual(record('permission-drift').deltas.contractOnlyPermissions, ['network.fetch']);
  });
  check('contract permission outside manifest uses is its own hold', () => {
    assert.equal(record('outside-uses').state, 'PERMISSION_OUTSIDE_USES');
    assert.deepEqual(record('outside-uses').deltas.contractPermissionsOutsideManifestUses, ['network.fetch']);
  });
  check('missing write declaration is incomplete rather than assumed empty', () => {
    assert.equal(record('incomplete').state, 'INCOMPLETE_DECLARATION');
    assert(record('incomplete').findings.includes('CONTRACT_WRITES_MISSING'));
  });
  check('manifest permission field absence is distinct from an explicit empty array', () => {
    assert.equal(record('missing-manifest-field').state, 'INCOMPLETE_DECLARATION');
    assert(record('missing-manifest-field').findings.includes('MANIFEST_PERMISSIONS_MISSING'));
  });
  check('contract identity drift is visible', () => {
    assert.equal(record('id-drift').state, 'CONTRACT_ID_DRIFT');
    assert(record('id-drift').findings.includes('CONTRACT_ID_DRIFT'));
  });
  check('declared writes are recorded but never resolved', () => {
    assert.deepEqual(record('exact').contract.writes, ['state/exact.json']);
    assert.equal(record('exact').truth.writesResolvedOrOpened, false);
  });
  check('declared refusals remain data rather than enforcement proof', () => {
    assert(record('exact').contract.refuses.includes('network'));
    assert.equal(record('exact').truth.refusalsProveEnforcement, false);
  });
  check('permission index keeps manifest contract and uses membership separate', () => {
    const storage = first.permissions.find(permission => permission.permission === 'storage');
    assert(storage.manifestDeclarers.includes('exact'));
    assert(storage.contractDeclarers.includes('exact'));
    assert(storage.manifestUsesDeclarers.includes('permission-drift'));
  });
  check('permission declarations never become grants or risk labels', () => {
    const network = first.permissions.find(permission => permission.permission === 'network.fetch');
    assert.equal(network.truth.declarationIsGrant, false);
    assert.equal(network.truth.riskInferred, false);
  });
  check('scan reads no secret value or grant ledger', () => {
    assert.equal(first.truth.secretValuesRead, false);
    assert.equal(first.truth.grantsCreated, false);
    assert.equal(first.truth.grantsRevoked, false);
  });
  check('scanning performs no filesystem writes', () => {
    assert.deepEqual(after, before);
  });
  check('fingerprint ignores measurement time', () => {
    assert.equal(first.source.fingerprint, second.source.fingerprint);
    assert.notEqual(first.measuredAt, second.measuredAt);
  });
  check('map leaks no absolute fixture path', () => {
    assert.equal(JSON.stringify(first).includes(fixtureRoot), false);
  });
  check('manifest byte drift changes the source fingerprint', () => {
    const file = path.join(fixtureRoot, 'tools', 'exact', 'manifest.json');
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    value.tags = ['changed'];
    writeJson(file, value);
    const drifted = Core.scanWorkshop(fixtureRoot, { now: '2026-07-26T01:01:00Z' });
    assert.notEqual(drifted.source.fingerprint, first.source.fingerprint);
  });
  check('freshness is LIVE inside TTL and STALE after it', () => {
    const timed = Object.assign({}, first, { freshnessTtlMs: 1000 });
    assert.equal(Core.freshness(timed, { now: '2026-07-26T00:00:00.500Z' }).status, 'LIVE');
    assert.equal(Core.freshness(timed, { now: '2026-07-26T00:00:02Z' }).status, 'STALE');
  });
  check('truth refuses scores rankings repairs mutations installs and CANON', () => {
    for (const field of [
      'runtimeEnforcementVerified',
      'declaredWriteTargetsResolved',
      'permissionlessMeansSafe',
      'refusalsProveEnforcement',
      'riskScoreComputed',
      'modulesRanked',
      'automaticContractRepairPerformed',
      'sourceMutationPerformed',
      'installerStagingPerformed',
      'installationPerformed',
      'rollbackChanged',
      'promotionPerformed',
      'canonChanged'
    ]) assert.equal(first.truth[field], false);
  });
  check('manifest and contract identity versions and permissions align', () => {
    const manifestValue = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
    const contractValue = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    assert.equal(manifestValue.schema, 'axm.tool-manifest/v1');
    assert.equal(manifestValue.kind, 'product');
    assert.equal(manifestValue.id, contractValue.id);
    assert.equal(manifestValue.version, contractValue.version);
    assert.deepEqual(manifestValue.permissions, contractValue.permissions);
    assert(manifestValue.uses.includes('storage'));
  });
  check('contract refuses grants risk scores repair installation and CANON', () => {
    const contractValue = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    for (const boundary of [
      'permission-as-runtime-grant-inference',
      'automatic-risk-score',
      'grant-creation',
      'grant-revocation',
      'automatic-contract-repair',
      'installer-staging',
      'module-installation',
      'canon-change'
    ]) assert(contractValue.boundaries.refuses.includes(boundary));
  });

  const liveRoot = process.argv[2] ? path.resolve(process.argv[2]) : null;
  if (liveRoot) {
    const live = Core.scanWorkshop(liveRoot);
    check('live Workshop scan sees eighty-one modules and no broken manifests', () => {
      assert.equal(live.summary.modules, 81);
      assert.equal(live.source.broken.length, 0);
    });
    check('live missing contracts remain twenty-eight unknown authority surfaces', () => {
      assert.equal(live.summary.contractAuthorityUnknown, 28);
      assert.equal(live.summary.exactDeclarations + live.summary.incompleteDeclarations + live.summary.permissionDrift + live.summary.permissionOutsideUses + live.summary.contractIdDrift + live.summary.contractAuthorityUnknown, 81);
    });
    check('live authority scan remains observation only', () => {
      assert.equal(live.truth.grantsCreated, false);
      assert.equal(live.truth.sourceMutationPerformed, false);
      assert.equal(live.truth.canonChanged, false);
    });
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write('\nAuthority Surface Observatory selftest: PASS (' + checks + ' checks)\n');
