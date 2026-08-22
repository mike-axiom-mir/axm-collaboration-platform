#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/census-core');

let passed = 0;
function check(condition, label) {
  assert(condition, label);
  passed += 1;
  process.stdout.write('PASS ' + label + '\n');
}

const publishedManifest = require('./manifest.json');
check(publishedManifest.schema === 'axm.tool-manifest/v1', 'published manifest declares the modern schema');
check(publishedManifest.kind === 'product', 'published manifest classifies the observatory as a product');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function manifest(id) {
  return {
    id,
    name: id,
    version: 'v0.1',
    status: 'TEST',
    entry: 'index.html',
    contract: 'module.contract.json',
    uses: []
  };
}

function contract(id) {
  return {
    schema: 'axm.module-contract/v1',
    id,
    version: 'v0.1',
    provides: [],
    consumes: [],
    permissions: [],
    handoffs: { emits: [], accepts: [] },
    lifecycle: {
      state_owner: 'none',
      reload: 'not-applicable',
      disconnect: 'not-applicable',
      cleanup: 'not-applicable'
    },
    boundaries: { writes: [], refuses: [] }
  };
}

function findScope(census, id) {
  return census.scopes.find(item => item.scopeId === id);
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-census-selftest-'));
  writeJson(path.join(root, 'tools', 'alpha', 'manifest.json'), manifest('alpha'));
  writeJson(path.join(root, 'tools', 'alpha', 'module.contract.json'), contract('alpha'));
  writeJson(path.join(root, 'tools', '_module-template', 'manifest.json'), manifest('template'));
  writeJson(path.join(root, 'packs', 'nested', 'manifest.json'), manifest('alpha'));
  writeJson(path.join(root, 'packs', 'nested', 'module.contract.json'), contract('alpha'));
  writeJson(path.join(root, 'games', 'one', 'game.manifest.json'), { id: 'one' });
  fs.mkdirSync(path.join(root, 'shared', 'core'), { recursive: true });
  fs.mkdirSync(path.join(root, 'shared', 'vendor'), { recursive: true });
  fs.mkdirSync(path.join(root, 'worlds', 'one'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets', 'local'), { recursive: true });
  return root;
}

function safelyRemoveFixture(root) {
  const resolved = path.resolve(root);
  const prefix = path.resolve(os.tmpdir()) + path.sep;
  if (!resolved.startsWith(prefix) || !path.basename(resolved).startsWith('axm-census-selftest-')) {
    throw new Error('temporary cleanup boundary refused');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

function main() {
  const root = fixture();
  try {
    const one = Core.scanWorkshop(root, { now: '2026-07-25T00:00:00.000Z' });
    const two = Core.scanWorkshop(root, { now: '2026-07-25T01:00:00.000Z' });
    check(one.schema === Core.CENSUS_SCHEMA, 'census uses the declared schema');
    check(one.source.fingerprint === two.source.fingerprint, 'fingerprint ignores measurement time');
    check(findScope(one, 'hub-registered-tools').count === 1, 'Hub tools exclude underscore templates');
    check(findScope(one, 'tool-directories').count === 2, 'tool directories keep templates visible');
    check(findScope(one, 'hub-tools-with-declared-contracts').count === 1, 'Hub contract coverage is explicit');
    check(findScope(one, 'recursive-manifest-files').count === 3, 'recursive manifests remain a separate scope');
    check(findScope(one, 'recursive-module-contract-files').count === 2, 'recursive contracts remain a separate scope');
    check(findScope(one, 'shared-top-level-bodies').count === 1, 'shared vendor dependency zone is excluded from bodies');
    check(findScope(one, 'world-directories').count === 1, 'world directories have a named scope');
    check(findScope(one, 'game-packages').count === 1, 'game manifests have a named scope');
    check(findScope(one, 'asset-zones').count === 1, 'asset zones have a named scope');
    check(one.relations.nestedOrNonHubManifests.length === 2, 'non-Hub manifests stay visible');
    check(one.relations.duplicateManifestIds.length === 1, 'duplicate manifest ids are reported');
    check(one.truth.universalModuleTotalClaimed === false && one.truth.canonChanged === false, 'truth refuses universal totals and CANON claims');

    const matching = Core.compareReference(one, {
      schema: Core.REFERENCE_SCHEMA,
      scopeId: 'hub-registered-tools',
      count: 1,
      measuredAt: '2026-07-25T00:00:00.000Z',
      ttlMs: 7200000
    }, { now: '2026-07-25T01:00:00.000Z' });
    check(matching.outcome === 'MATCH' && matching.reference.freshness === 'LIVE', 'same-scope current reference matches');

    const drift = Core.compareReference(one, {
      scopeId: 'hub-registered-tools',
      count: 0,
      measuredAt: '2026-07-24T00:00:00.000Z',
      ttlMs: 3600000
    }, { now: '2026-07-25T01:00:00.000Z' });
    check(drift.outcome === 'DRIFT' && drift.delta === 1 && drift.reference.freshness === 'STALE', 'same-scope drift and stale age are explicit');

    const unknown = Core.compareReference(one, { scopeId: 'top-level-modules', count: 157 });
    check(unknown.outcome === 'NOT_COMPARABLE' && unknown.delta === null, 'unknown scope refuses false arithmetic');

    const untimed = Core.compareReference(one, { scopeId: 'hub-registered-tools', count: 1 });
    check(untimed.reference.freshness === 'UNTIMED', 'missing reference time remains visible');

    const realRoot = process.argv[2] || process.env.AXM_WORKSHOP_ROOT;
    if (realRoot) {
      const real = Core.scanWorkshop(realRoot);
      check(findScope(real, 'hub-registered-tools').count > 0, 'selected live Workshop has registered tools');
      check(findScope(real, 'recursive-manifest-files').count >= findScope(real, 'hub-registered-tools').count, 'live recursive manifests do not masquerade as fewer Hub tools');
      check(real.truth.installationPerformed === false && real.truth.automaticAction === false, 'live scan performs no installation or automatic action');
    }

    process.stdout.write('\nCensus Observatory selftest: PASS (' + passed + ' checks)\n');
  } finally {
    safelyRemoveFixture(root);
  }
}

try {
  main();
} catch (error) {
  process.stderr.write((error && error.stack || error) + '\n');
  process.exitCode = 1;
}
