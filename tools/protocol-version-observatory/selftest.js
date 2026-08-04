#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/protocol-version-core');

let checks = 0;
function check(label, action) {
  action();
  checks += 1;
  process.stdout.write('PASS ' + label + '\n');
}

const publishedManifest = require('./manifest.json');
check('published manifest declares the modern schema', () => assert.equal(publishedManifest.schema, 'axm.tool-manifest/v1'));
check('published manifest classifies the observatory as a product', () => assert.equal(publishedManifest.kind, 'product'));

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
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
    lifecycle: {
      state_owner: 'none',
      reload: 'reset',
      disconnect: 'not-applicable',
      cleanup: 'not-applicable'
    }
  }, fields);
}

function module(root, id, manifestFields, contractValue) {
  const directory = path.join(root, 'tools', id);
  fs.mkdirSync(directory, { recursive: true });
  const manifest = Object.assign({
    id,
    name: id,
    version: 'v0.1',
    status: 'EXPERIMENTAL',
    entry: 'index.html',
    uses: [],
    permissions: [],
    accepts: [],
    produces: []
  }, manifestFields);
  if (contractValue) manifest.contract = 'module.contract.json';
  writeJson(path.join(directory, 'manifest.json'), manifest);
  fs.writeFileSync(path.join(directory, 'index.html'), '<!doctype html>');
  if (contractValue) writeJson(path.join(directory, 'module.contract.json'), contractValue);
}

function treeReceipt(root) {
  const rows = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
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

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-protocol-version-'));
try {
  fs.mkdirSync(path.join(fixtureRoot, 'tools'), { recursive: true });
  module(fixtureRoot, 'producer-v1', {
    produces: ['axm.demo/v1', 'KTX.2.0']
  }, contract('producer-v1', {
    handoffs: { emits: ['axm.demo/v1'], accepts: [] }
  }));
  module(fixtureRoot, 'consumer-v2', {
    accepts: ['axm.demo/v2']
  }, contract('consumer-v2', {
    handoffs: { emits: [], accepts: ['axm.demo/v2', 'future:axm.next/v3'] }
  }));
  module(fixtureRoot, 'unparsed-family', {
    accepts: ['axm.demo']
  }, contract('unparsed-family'));
  module(fixtureRoot, 'single', {}, contract('single', {
    provides: ['axm.single/v7']
  }));
  module(fixtureRoot, 'contract-unknown', {
    accepts: ['axm.unknown/v1']
  }, null);
  fs.symlinkSync(path.join(fixtureRoot, 'tools', 'single'), path.join(fixtureRoot, 'tools', 'linked-single'), process.platform === 'win32' ? 'junction' : 'dir');

  const before = treeReceipt(fixtureRoot);
  const first = Core.scanWorkshop(fixtureRoot, { now: '2026-07-26T00:00:00Z' });
  const second = Core.scanWorkshop(fixtureRoot, { now: '2026-07-26T01:00:00Z' });
  const after = treeReceipt(fixtureRoot);
  const family = id => first.families.find(item => item.family === id);
  const token = value => first.tokens.find(item => item.token === value);

  check('protocol surface declares its exact output schema', () => {
    assert.equal(first.schema, 'axm.protocol-version-surface/v1');
  });
  check('exact slash version convention is parsed', () => {
    const parsed = Core.parseProtocolToken('axm.demo/v12-beta');
    assert.equal(parsed.family, 'axm.demo');
    assert.equal(parsed.version, 'v12-beta');
  });
  check('non-AXM syntax remains explicitly unparsed', () => {
    assert.equal(Core.parseProtocolToken('KTX.2.0').convention, 'UNPARSED_VERSION_CONVENTION');
    assert.equal(token('KTX.2.0').version, null);
  });
  check('future prefix is retained while slash version remains visible', () => {
    const parsed = Core.parseProtocolToken('future:axm.next/v3');
    assert.equal(parsed.future, true);
    assert.equal(parsed.family, 'axm.next');
    assert.equal(parsed.version, 'v3');
  });
  check('multiple exact versions are one visible family', () => {
    const group = family('axm.demo');
    assert.deepEqual(group.versions, ['v1', 'v2']);
  });
  check('mixed unparsed family token is a distinct state', () => {
    const group = family('axm.demo');
    assert.equal(group.state, 'MIXED_VERSIONED_AND_UNPARSED_FAMILY');
    assert.deepEqual(group.mixedUnparsedTokens, ['axm.demo']);
  });
  check('multiple versions never become incompatibility proof', () => {
    assert.equal(family('axm.demo').truth.versionsIncompatible, false);
  });
  check('single version family remains separately labeled', () => {
    assert.equal(family('axm.single').state, 'SINGLE_DECLARED_VERSION');
  });
  check('exact token preserves all declaration roles', () => {
    const demo = token('axm.demo/v1');
    assert(demo.roles.includes('manifest.produces'));
    assert(demo.roles.includes('contract.handoffs.emits'));
  });
  check('contract absence remains visible without losing manifest declarations', () => {
    const record = first.modules.find(moduleRecord => moduleRecord.id === 'contract-unknown');
    assert.equal(record.contractState, 'NOT_DECLARED');
    assert(token('axm.unknown/v1'));
  });
  check('filesystem symlinks are skipped and never followed', () => {
    assert.deepEqual(first.source.skippedSymlinks, ['tools/linked-single']);
    assert.equal(first.source.symlinksFollowed, false);
  });
  check('scanning performs no source writes', () => {
    assert.deepEqual(after, before);
  });
  check('measurement time does not alter the source fingerprint', () => {
    assert.equal(first.source.fingerprint, second.source.fingerprint);
    assert.notEqual(first.measuredAt, second.measuredAt);
  });
  check('output leaks no absolute fixture root', () => {
    assert.equal(JSON.stringify(first).includes(fixtureRoot), false);
  });
  check('freshness is live inside TTL and stale after TTL', () => {
    const timed = Object.assign({}, first, { freshnessTtlMs: 1000 });
    assert.equal(Core.freshness(timed, { now: '2026-07-26T00:00:00.500Z' }).status, 'LIVE');
    assert.equal(Core.freshness(timed, { now: '2026-07-26T00:00:02Z' }).status, 'STALE');
  });
  check('unknown timing remains explicitly untimed', () => {
    assert.equal(Core.freshness({}).status, 'UNTIMED');
  });
  check('truth refuses validation compatibility choice migration install and CANON', () => {
    for (const field of [
      'protocolsValidated',
      'nonAxmVersionSyntaxGuessed',
      'compatibilityInferred',
      'preferredVersionSelected',
      'migrationGenerated',
      'adapterGenerated',
      'declarationRewritten',
      'sourceMutationPerformed',
      'installerStagingPerformed',
      'installationPerformed',
      'permissionChanged',
      'promotionPerformed',
      'canonChanged'
    ]) assert.equal(first.truth[field], false);
  });
  check('manifest and contract identity version and permissions align', () => {
    const manifestValue = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
    const contractValue = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    assert.equal(manifestValue.id, contractValue.id);
    assert.equal(manifestValue.version, contractValue.version);
    assert.deepEqual(manifestValue.permissions, contractValue.permissions);
  });
  check('contract refuses guessing selection adapters mutation install and CANON', () => {
    const contractValue = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    for (const boundary of [
      'non-axm-version-syntax-guessing',
      'preferred-version-selection',
      'migration-generation',
      'adapter-generation',
      'source-mutation',
      'installer-staging',
      'canon-change'
    ]) assert(contractValue.boundaries.refuses.includes(boundary));
  });
  check('browser entry references only local candidate files', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    for (const name of ['styles.css', 'current-protocol-surface.js', 'app.js']) assert(html.includes(name));
    assert.equal(/https?:\/\//.test(html), false);
  });
  check('bundle builder is self-contained and excludes its output', () => {
    const source = fs.readFileSync(path.join(__dirname, 'build-bundle.js'), 'utf8');
    assert(source.includes("absolute === output"));
    assert(source.includes("'axm.module-bundle/v1'"));
  });

  const workshopRoot = argValue('--workshop-root');
  if (workshopRoot) {
    const live = Core.scanWorkshop(workshopRoot);
    check('live Workshop protocol scan finds declared tokens', () => {
      assert(live.summary.modules > 0);
      assert(live.summary.uniqueTokens > 0);
    });
    check('live Workshop scan remains version observation only', () => {
      assert.equal(live.truth.compatibilityInferred, false);
      assert.equal(live.truth.sourceMutationPerformed, false);
      assert.equal(live.truth.canonChanged, false);
    });
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write('\nProtocol Version Observatory selftest: PASS (' + checks + ' checks)\n');
