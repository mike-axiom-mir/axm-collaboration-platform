#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/wiring-core');

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
    uses: ['storage'],
    permissions: []
  }, fields);
}

function contract(id, accepts, emits) {
  return {
    schema: 'axm.module-contract/v1',
    id,
    version: 'v0.1',
    provides: [],
    consumes: [],
    permissions: [],
    handoffs: { accepts, emits },
    boundaries: { writes: [], refuses: ['automatic-apply'] },
    lifecycle: { state_owner: 'none', reload: 'reset', disconnect: 'not-applicable', cleanup: 'not-applicable' }
  };
}

function module(root, id, fields, contractValue) {
  const directory = path.join(root, 'tools', id);
  fs.mkdirSync(directory, { recursive: true });
  const value = manifest(id, fields);
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

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-wiring-'));
try {
  fs.mkdirSync(path.join(fixtureRoot, 'tools'), { recursive: true });
  module(fixtureRoot, 'producer-a', {
    accepts: [],
    produces: ['axm.alpha/v1', 'axm.multi/v1', 'image/*']
  }, contract('producer-a', [], ['axm.alpha/v1', 'axm.multi/v1', 'image/*']));
  module(fixtureRoot, 'producer-b', {
    accepts: [],
    produces: ['axm.multi/v1']
  }, contract('producer-b', [], ['axm.multi/v1']));
  module(fixtureRoot, 'consumer', {
    accepts: ['axm.alpha/v1', 'axm.external/v1', 'image/png'],
    produces: ['axm.beta/v1']
  }, contract('consumer', ['axm.alpha/v1', 'axm.external/v1'], ['axm.beta/v1']));
  module(fixtureRoot, 'downstream', {
    accepts: ['axm.beta/v1'],
    produces: []
  }, contract('downstream', ['axm.beta/v1'], []));
  module(fixtureRoot, 'self-loop', {
    accepts: ['axm.self/v1'],
    produces: ['axm.self/v1']
  }, contract('self-loop', ['axm.self/v1'], ['axm.self/v1']));
  module(fixtureRoot, 'metadata-only', {}, null);
  module(fixtureRoot, 'producer-only', {
    accepts: [],
    produces: ['axm.lonely/v1']
  }, contract('producer-only', [], ['axm.lonely/v1']));
  fs.mkdirSync(path.join(fixtureRoot, 'shared', 'capabilities'), { recursive: true });
  writeJson(path.join(fixtureRoot, 'shared', 'capabilities', 'capability-metadata.json'), {
    schema: 'axm.workshop-capability-metadata/v1',
    modules: {
      'metadata-only': {
        accepts: ['axm.beta/v1'],
        produces: ['axm.metadata/v1']
      }
    }
  });
  fs.symlinkSync(path.join(fixtureRoot, 'tools', 'producer-a'), path.join(fixtureRoot, 'tools', 'linked-tool'), process.platform === 'win32' ? 'junction' : 'dir');

  const before = treeReceipt(fixtureRoot);
  const first = Core.scanWorkshop(fixtureRoot, { now: '2026-07-26T00:00:00Z' });
  const second = Core.scanWorkshop(fixtureRoot, { now: '2026-07-26T01:00:00Z' });
  const after = treeReceipt(fixtureRoot);
  const artifact = name => first.artifacts.find(item => item.artifact === name);
  const moduleRecord = id => first.modules.find(item => item.id === id);

  check('clean string arrays deduplicate and sort without normalization', () => {
    assert.deepEqual(Core.cleanStrings(['z', 'a', 'z', '', 4]), ['a', 'z']);
  });
  check('safe contract paths stay below the module root', () => {
    const moduleDir = path.join(fixtureRoot, 'tools', 'producer-a');
    assert(Core.safeContractPath(moduleDir, 'module.contract.json').startsWith(moduleDir));
    assert.equal(Core.safeContractPath(moduleDir, '../escape.json'), null);
  });
  check('top-level manifest scope excludes underscore folders and symlinks', () => {
    assert.equal(first.summary.modules, 7);
    assert.deepEqual(first.source.skippedSymlinks, ['linked-tool']);
    assert.equal(first.source.symlinksFollowed, false);
  });
  check('exact producer and consumer form an exact wire', () => {
    assert.equal(artifact('axm.alpha/v1').state, 'EXACTLY_WIRED');
    assert.deepEqual(artifact('axm.alpha/v1').providers, ['producer-a']);
    assert.deepEqual(artifact('axm.alpha/v1').consumers, ['consumer']);
  });
  check('producer-only declarations stay separate', () => {
    assert.equal(artifact('axm.lonely/v1').state, 'PRODUCER_ONLY');
  });
  check('consumer-only external declarations stay separate', () => {
    assert.equal(artifact('axm.external/v1').state, 'CONSUMER_ONLY');
  });
  check('one-module exact loops are explicitly named', () => {
    assert.equal(artifact('axm.self/v1').state, 'SELF_LOOP_ONLY');
  });
  check('multiple providers are visible but never called a collision', () => {
    assert.equal(artifact('axm.multi/v1').multiProvider, true);
    assert.equal(artifact('axm.multi/v1').truth.multiProviderCalledCollision, false);
  });
  check('wildcard-looking names are not joined to concrete names', () => {
    assert.equal(artifact('image/*').state, 'PRODUCER_ONLY');
    assert.equal(artifact('image/png').state, 'CONSUMER_ONLY');
    assert.equal(first.truth.wildcardCompatibilityInferred, false);
  });
  check('capability metadata fallback is attributed rather than hidden', () => {
    assert.equal(moduleRecord('metadata-only').sources.accepts, 'capability-metadata-fallback');
    assert.equal(moduleRecord('metadata-only').sources.produces, 'capability-metadata-fallback');
    assert(first.summary.modulesUsingMetadataFallback >= 1);
  });
  check('metadata fallback can participate in an exact string wire', () => {
    assert(artifact('axm.beta/v1').consumers.includes('metadata-only'));
    assert(artifact('axm.beta/v1').consumers.includes('downstream'));
  });
  check('undeclared contract authority remains unknown', () => {
    assert.equal(moduleRecord('metadata-only').contract.state, 'NOT_DECLARED');
    assert.equal(moduleRecord('metadata-only').reconciliation.accepts.state, 'CONTRACT_UNKNOWN');
  });
  check('authored manifest and contract drift remains visible', () => {
    assert.equal(moduleRecord('consumer').reconciliation.accepts.state, 'DRIFT');
    assert.deepEqual(moduleRecord('consumer').reconciliation.accepts.effectiveOnly, ['image/png']);
  });
  check('exact authored and contract envelopes reconcile', () => {
    assert.equal(moduleRecord('producer-a').reconciliation.emits.state, 'EXACT');
  });
  check('relation rows retain exact provider and consumer identity', () => {
    assert(first.relations.some(row => row.artifact === 'axm.alpha/v1' && row.provider === 'producer-a' && row.consumer === 'consumer'));
  });
  check('self-loop relation is tagged without being deleted', () => {
    assert(first.relations.some(row => row.artifact === 'axm.self/v1' && row.self === true));
  });
  check('scanning performs no filesystem writes', () => {
    assert.deepEqual(after, before);
  });
  check('source fingerprint ignores measurement time', () => {
    assert.equal(first.source.fingerprint, second.source.fingerprint);
    assert.notEqual(first.measuredAt, second.measuredAt);
  });
  check('source map leaks no absolute fixture path', () => {
    assert.equal(JSON.stringify(first).includes(fixtureRoot), false);
  });
  check('manifest byte drift changes the source fingerprint', () => {
    const file = path.join(fixtureRoot, 'tools', 'producer-only', 'manifest.json');
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    value.produces.push('axm.changed/v1');
    writeJson(file, value);
    const drifted = Core.scanWorkshop(fixtureRoot, { now: '2026-07-26T01:01:00Z' });
    assert.notEqual(drifted.source.fingerprint, first.source.fingerprint);
  });
  check('freshness is LIVE inside TTL and STALE after it', () => {
    const timed = Object.assign({}, first, { freshnessTtlMs: 1000 });
    assert.equal(Core.freshness(timed, { now: '2026-07-26T00:00:00.500Z' }).status, 'LIVE');
    assert.equal(Core.freshness(timed, { now: '2026-07-26T00:00:02Z' }).status, 'STALE');
  });
  check('truth block refuses adapters rewires installs and authority changes', () => {
    for (const field of [
      'schemaNamesNormalized',
      'wildcardCompatibilityInferred',
      'semanticCompatibilityInferred',
      'automaticAdaptersGenerated',
      'automaticRewirePerformed',
      'sourceMutationPerformed',
      'installerStagingPerformed',
      'installationPerformed',
      'permissionChanged',
      'rollbackChanged',
      'promotionPerformed',
      'canonChanged'
    ]) assert.equal(first.truth[field], false);
  });
  check('manifest and contract identity versions and permissions align', () => {
    const manifestValue = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
    const contractValue = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    assert.equal(manifestValue.id, contractValue.id);
    assert.equal(manifestValue.version, contractValue.version);
    assert.deepEqual(manifestValue.permissions, contractValue.permissions);
    assert(manifestValue.uses.includes('storage'));
  });
  check('contract refuses inference adapters rewiring installation and CANON', () => {
    const contractValue = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    for (const boundary of [
      'wildcard-compatibility-inference',
      'semantic-compatibility-inference',
      'automatic-adapter-generation',
      'automatic-rewire',
      'installer-staging',
      'module-installation',
      'canon-change'
    ]) assert(contractValue.boundaries.refuses.includes(boundary));
  });

  const liveRoot = process.argv[2] ? path.resolve(process.argv[2]) : null;
  if (liveRoot) {
    const live = Core.scanWorkshop(liveRoot);
    check('live Workshop scan sees the current eighty-one Hub modules', () => {
      assert.equal(live.summary.modules, 81);
      assert.equal(live.source.broken.length, 0);
    });
    check('live Workshop exposes exact artifact relations and honest seams', () => {
      assert(live.summary.artifacts > 0);
      assert(live.summary.exactModuleRelations > 0);
      assert(live.summary.producerOnlyArtifacts + live.summary.consumerOnlyArtifacts > 0);
    });
    check('live Workshop scan remains observation only', () => {
      assert.equal(live.truth.automaticAdaptersGenerated, false);
      assert.equal(live.truth.sourceMutationPerformed, false);
      assert.equal(live.truth.canonChanged, false);
    });
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write('\nHandoff Wiring Observatory selftest: PASS (' + checks + ' checks)\n');
