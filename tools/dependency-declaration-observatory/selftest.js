#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/dependency-core');

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
    permissions: [],
    readiness: []
  }, fields);
}

function contract(id, consumes = []) {
  return {
    schema: 'axm.module-contract/v1',
    id,
    version: 'v0.1',
    provides: [],
    consumes,
    permissions: [],
    handoffs: { emits: [], accepts: [] },
    boundaries: { writes: [], refuses: ['automatic-apply'] },
    lifecycle: {
      state_owner: 'none',
      reload: 'reset',
      disconnect: 'not-applicable',
      cleanup: 'not-applicable'
    }
  };
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

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-dependency-'));
try {
  fs.mkdirSync(path.join(fixtureRoot, 'tools'), { recursive: true });
  module(fixtureRoot, 'alpha', {
    uses: ['beta', 'storage'],
    readiness: ['runtime']
  }, contract('alpha', ['service:gamma', 'axm.artifact/v1']));
  module(fixtureRoot, 'beta', {
    integratedInto: 'gamma'
  }, contract('beta'));
  module(fixtureRoot, 'gamma', {}, contract('gamma', ['module:alpha']));
  module(fixtureRoot, 'unresolved', {}, contract('unresolved', ['service:not-installed']));
  module(fixtureRoot, 'self', {
    uses: ['self']
  }, contract('self'));
  module(fixtureRoot, 'contract-unknown', {
    uses: ['storage']
  }, null);
  fs.symlinkSync(path.join(fixtureRoot, 'tools', 'alpha'), path.join(fixtureRoot, 'tools', 'linked-alpha'), process.platform === 'win32' ? 'junction' : 'dir');

  const before = treeReceipt(fixtureRoot);
  const first = Core.scanWorkshop(fixtureRoot, { now: '2026-07-26T00:00:00Z' });
  const second = Core.scanWorkshop(fixtureRoot, { now: '2026-07-26T01:00:00Z' });
  const after = treeReceipt(fixtureRoot);
  const edge = (from, to) => first.edges.find(item => item.from === from && item.to === to);

  check('dependency map declares its exact output schema', () => {
    assert.equal(first.schema, 'axm.dependency-declaration-map/v1');
  });
  check('direct installed module ids form exact edges', () => {
    assert(edge('alpha', 'beta'));
    assert(edge('alpha', 'beta').sources.includes('manifest.uses'));
  });
  check('service-prefixed installed target forms an exact edge', () => {
    assert(edge('alpha', 'gamma'));
    assert(edge('alpha', 'gamma').tokens.includes('service:gamma'));
  });
  check('integratedInto is an explicit directional module reference', () => {
    assert(edge('beta', 'gamma'));
  });
  check('generic capability and artifact tokens remain uninterpreted', () => {
    assert(first.genericTokens.includes('storage'));
    assert(first.genericTokens.includes('runtime'));
    assert(first.genericTokens.includes('axm.artifact/v1'));
  });
  check('an explicit target outside top-level-module scope stays qualified', () => {
    const outside = first.explicitTargetsNotTopLevelModules.find(item => item.targetModuleId === 'not-installed');
    assert(outside);
    assert.equal(outside.token, 'service:not-installed');
    assert.equal(outside.targetKind, 'service');
    assert.equal(outside.state, 'EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE');
  });
  check('multi-module cycle is visible without automatic repair', () => {
    const cycle = first.cycles.find(item => item.members.join(',') === 'alpha,beta,gamma');
    assert(cycle);
    assert(cycle.edges.some(item => item.from === 'gamma' && item.to === 'alpha'));
  });
  const packet = Core.createCycleReviewPacket(first, 'alpha', {
    now: '2026-07-26T00:00:30Z',
    selectedSmallestAutomatically: true
  });
  check('one selected cycle emits the declared review-packet schema', () => {
    assert.equal(packet.schema, 'axm.dependency-cycle-review-packet/v1');
    assert.deepEqual(packet.cycle.members, ['alpha', 'beta', 'gamma']);
    assert.equal(packet.selection.requestedMemberId, 'alpha');
  });
  check('cycle review preserves internal incoming and outgoing edges separately', () => {
    assert.equal(packet.cycle.internalEdges.length, 4);
    assert.equal(packet.cycle.incomingEdges.length, 0);
    assert.equal(packet.cycle.outgoingEdges.length, 0);
  });
  check('cycle review asks edge-role questions without answering them', () => {
    assert.equal(packet.questions.filter(item => item.kind === 'EDGE_ROLE').length, 4);
    assert(packet.questions.every(item => item.answer === null));
  });
  check('cycle review keeps runtime defect and repair conclusions false', () => {
    assert.equal(packet.truth.cycleIsDefect, false);
    assert.equal(packet.truth.deadlockProven, false);
    assert.equal(packet.truth.edgeRemovalRecommended, false);
    assert.equal(packet.truth.declarationRepairPerformed, false);
  });
  check('non-cycle member selection is refused', () => {
    assert.throws(() => Core.createCycleReviewPacket(first, 'contract-unknown'), /not in an observed declared cycle/);
  });
  check('self dependency remains its own declared cycle', () => {
    assert(first.cycles.some(item => item.members.length === 1 && item.members[0] === 'self'));
  });
  check('contract absence remains visible rather than assumed dependency-free', () => {
    const record = first.modules.find(moduleRecord => moduleRecord.id === 'contract-unknown');
    assert.equal(record.contractState, 'NOT_DECLARED');
    assert.equal(first.summary.contractUnknown, 1);
  });
  check('filesystem symlinks are skipped and never followed', () => {
    assert.deepEqual(first.source.skippedSymlinks, ['tools/linked-alpha']);
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
  check('cycle detector keeps disconnected acyclic modules out', () => {
    const components = Core.stronglyConnected(
      ['a', 'b', 'c'],
      [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }, { from: 'c', to: 'b' }]
    );
    assert.deepEqual(components.map(item => item.members), [['a', 'b']]);
  });
  check('truth refuses readiness resolution substitution installation and CANON', () => {
    for (const field of [
      'dependencyAvailabilityProbed',
      'readinessProbed',
      'versionResolutionPerformed',
      'activationOrderSelected',
      'providerSubstitutionPerformed',
      'networkUsed',
      'dependencyInstalled',
      'declarationRepairPerformed',
      'sourceMutationPerformed',
      'installerStagingPerformed',
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
  check('contract preserves activation resolver and refuses mutation install and CANON', () => {
    const contractValue = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    for (const boundary of [
      'dependency-version-resolution',
      'activation-order-selection',
      'provider-substitution',
      'cycle-defect-inference',
      'edge-removal-recommendation',
      'declaration-repair',
      'source-mutation',
      'installer-staging',
      'canon-change'
    ]) assert(contractValue.boundaries.refuses.includes(boundary));
  });
  check('browser entry references only local candidate files', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    for (const name of ['styles.css', 'current-dependency-map.js', 'current-cycle-review.js', 'app.js']) assert(html.includes(name));
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
    check('live Workshop dependency scan finds installed modules', () => {
      assert(live.summary.modules > 0);
      assert(live.summary.declarationOccurrences > 0);
    });
    check('live Workshop scan remains topology observation only', () => {
      assert.equal(live.truth.readinessProbed, false);
      assert.equal(live.truth.sourceMutationPerformed, false);
      assert.equal(live.truth.canonChanged, false);
    });
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write('\nDependency Declaration Observatory selftest: PASS (' + checks + ' checks)\n');
