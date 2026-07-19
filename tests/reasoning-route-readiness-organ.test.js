'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Cell = require('../kernel/route-readiness-cell');
const HandoffGraph = require('../organs/reasoning-handoff-graph-organ');
const Organ = require('../organs/reasoning-route-readiness-organ');
const TechnicalGlasses = require('../adapters/workshop/technical-glasses-reader');

function contract(id, emits, accepts) {
  return {
    schema: 'axm.module-contract/v1',
    id,
    version: '1.0.0',
    provides: [],
    consumes: [],
    permissions: [],
    handoffs: { emits, accepts },
    boundaries: { writes: [], refuses: ['automatic-world-action'] }
  };
}

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-route-readiness-'));
  const root = path.join(base, 'mirror');
  const workshopRoot = path.join(base, 'workshop');
  fs.mkdirSync(root, { recursive: true });
  const definitions = [
    { id: 'alpha', emits: ['axm.test/x-v1'], accepts: [] },
    { id: 'beta', emits: ['axm.test/y-v1'], accepts: ['axm.test/x-v1'] },
    { id: 'gamma', emits: [], accepts: ['axm.test/y-v1'] },
    { id: 'delta', emits: [], accepts: ['axm.test/x-v1'] }
  ];
  for (const item of definitions) {
    const directory = path.join(workshopRoot, 'tools', item.id);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'module.contract.json'), JSON.stringify(contract(item.id, item.emits, item.accepts), null, 2) + '\n');
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({
      schema: 'axm.tool-manifest/v1', id: item.id, version: '1.0.0', status: 'TEST', entry: 'index.html', uses: [], permissions: [], contract: 'module.contract.json'
    }, null, 2) + '\n');
  }
  const handoff = HandoffGraph.derive({ root, workshopRoot });
  function snapshot(states = {}, options = {}) {
    const modules = handoff.batch.contracts.map(item => ({
      id: item.moduleId,
      evidence: {
        manifest: item.manifestRelativePath,
        contract: item.contractRelativePath,
        contractDeclared: true,
        contractPass: true
      },
      readiness: (states[item.moduleId] || ['READY']).map((state, index) => ({ id: `requirement-${index + 1}`, state, detail: `${item.moduleId} ${state}` }))
    }));
    if (options.mismatchModuleId) {
      const mismatched = modules.find(item => item.id === options.mismatchModuleId);
      mismatched.evidence.contract = 'tools/wrong/module.contract.json';
    }
    return {
      schema: 'axm.technical-glasses/v1',
      ok: true,
      compiledAt: options.compiledAt || '2026-07-18T12:00:00.000Z',
      freshness: { fingerprint: options.fingerprint || 'a'.repeat(64) },
      modules
    };
  }
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return { base, root, workshopRoot, handoff, snapshot };
}

function request(sourceModuleId, targetModuleId, maximumDepth = 2) {
  return { schema: HandoffGraph.REQUEST_SCHEMA, sourceModuleId, targetModuleId, maximumDepth };
}

test('route readiness cell preserves the Workshop ordering and detects tampering', () => {
  const requirements = state => [{ id: 'probe', state, detail: state }];
  assert.equal(Cell.classify(requirements('READY')), 'READY');
  assert.equal(Cell.classify(requirements('OPTIONAL')), 'AVAILABLE');
  assert.equal(Cell.classify(requirements('AVAILABLE')), 'AVAILABLE');
  assert.equal(Cell.classify(requirements('USER_ACTION')), 'NEEDS_ACTION');
  assert.equal(Cell.classify(requirements('UNKNOWN')), 'BLOCKED');
  assert.equal(Cell.classify([{ id: 'action', state: 'USER_ACTION' }, { id: 'offline', state: 'OFFLINE' }]), 'BLOCKED');
  const assessment = Cell.evaluate({
    sourceStateDigest: 'b'.repeat(64),
    route: { routeId: 'alpha-to-beta', moduleIds: ['alpha', 'beta'] },
    modules: [
      { moduleId: 'alpha', evidenceMatchesGraph: true, requirements: requirements('READY') },
      { moduleId: 'beta', evidenceMatchesGraph: true, requirements: requirements('AVAILABLE') }
    ]
  });
  assert.equal(assessment.routeState, 'AVAILABLE');
  assert.ok(Object.values(assessment.authority).every(value => value === false));
  assert.equal(Cell.verify(assessment), true);
  const tampered = JSON.parse(JSON.stringify(assessment));
  tampered.routeState = 'READY';
  assert.throws(() => Cell.verify(tampered), /digest mismatch|content mismatch/);
});

test('Technical Glasses reader refuses non-loopback endpoints and accepts typed injection without network', async () => {
  assert.throws(() => TechnicalGlasses.endpoint('https://example.com'), /loopback HTTP Workshop URL/);
  const snapshot = { schema: 'axm.technical-glasses/v1', ok: true, modules: [] };
  const observed = await TechnicalGlasses.observe({ snapshot });
  assert.equal(observed.source, 'INJECTED_TYPED_SNAPSHOT');
  assert.equal(observed.refreshed, false);
  assert.deepEqual(observed.snapshot, snapshot);
  assert.notEqual(observed.snapshot, snapshot);
});

test('fresh typed observations independently gate ready, available, needs-action, and blocked routes', t => {
  const fx = fixture(t);
  const observed = fx.snapshot({ beta: ['AVAILABLE'], delta: ['USER_ACTION'], gamma: ['READY'] });
  const derived = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, handoffDerived: fx.handoff, snapshot: observed });
  assert.equal(derived.batch.summary.graphRoutes, 4);
  assert.equal(derived.batch.summary.readyRoutes, 0);
  assert.equal(derived.batch.summary.availableRoutes, 3);
  assert.equal(derived.batch.summary.needsActionRoutes, 1);
  assert.equal(derived.batch.summary.blockedRoutes, 0);
  assert.equal(derived.batch.summary.classificationsMatched, 4);
  assert.equal(derived.batch.summary.trainingReceiptsCreated, 0);
  assert.equal(derived.batch.summary.worldActionsExecuted, 0);
  assert.ok(derived.batch.results.every(item => item.observedDecision.actionId === item.expectedDecision.actionId));
  assert.ok(Object.entries(derived.batch.authority).every(([key, value]) => key === 'privateEvaluationTraceWrite' ? value === true : value === false));

  const available = Organ.plan(derived, request('alpha', 'gamma'), { now: '2026-07-18T12:01:00.000Z' });
  assert.equal(available.state, 'PROPOSED_AVAILABLE_EXPLICIT_START_REQUIRED_ROUTES');
  assert.equal(available.proposals.length, 1);
  assert.equal(available.proposals[0].state, 'REVIEWABLE_AVAILABLE_PROPOSAL_EXPLICIT_START_REQUIRED_NOT_EXECUTED');
  assert.ok(Object.values(available.authority).every(value => value === false));
  const needsAction = Organ.plan(derived, request('alpha', 'delta', 1), { now: '2026-07-18T12:01:00.000Z' });
  assert.equal(needsAction.state, 'HOLD_ROUTE_READINESS_NEEDS_ACTION');
  assert.equal(needsAction.proposals.length, 0);

  const readySnapshot = fx.snapshot();
  const readyDerived = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, handoffDerived: fx.handoff, snapshot: readySnapshot });
  const ready = Organ.plan(readyDerived, request('alpha', 'gamma'), { now: '2026-07-18T12:01:00.000Z' });
  assert.equal(ready.state, 'PROPOSED_READY_MANIFEST_BOUND_EXACT_TYPED_ROUTES');
  assert.equal(ready.proposals[0].state, 'REVIEWABLE_READY_PROPOSAL_NOT_EXECUTED');

  const blockedSnapshot = fx.snapshot({ beta: ['UNKNOWN'] }, { fingerprint: 'c'.repeat(64) });
  const blockedDerived = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, handoffDerived: fx.handoff, snapshot: blockedSnapshot });
  const blocked = Organ.plan(blockedDerived, request('alpha', 'gamma'), { now: '2026-07-18T12:01:00.000Z' });
  assert.equal(blocked.state, 'HOLD_ROUTE_READINESS_BLOCKED');
  assert.equal(blocked.proposals.length, 0);
  assert.deepEqual(blocked.heldRoutes[0].attention.map(item => item.state), ['UNKNOWN']);
});

test('readiness state changes create immutable batches and stale or mismatched evidence holds', t => {
  const fx = fixture(t);
  const first = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, handoffDerived: fx.handoff, snapshot: fx.snapshot({ beta: ['UNKNOWN'] }) });
  const second = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, handoffDerived: fx.handoff, snapshot: fx.snapshot({ beta: ['READY'] }) });
  assert.notEqual(first.batch.batchId, second.batch.batchId);
  assert.ok(fs.existsSync(path.join(first.runDir, 'batch.json')));
  assert.ok(fs.existsSync(path.join(second.runDir, 'batch.json')));
  const reused = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, handoffDerived: fx.handoff, snapshot: fx.snapshot({ beta: ['READY'] }, { compiledAt: '2026-07-18T12:02:00.000Z' }) });
  assert.equal(reused.reused, true);
  assert.equal(reused.batch.batchId, second.batch.batchId);
  assert.equal(reused.observation.compiledAt, '2026-07-18T12:02:00.000Z');

  const stale = Organ.plan(reused, request('alpha', 'gamma'), { now: '2026-07-18T12:10:00.001Z' });
  assert.equal(stale.state, 'HOLD_READINESS_EVIDENCE_STALE_OR_MISSING');
  assert.equal(stale.proposals.length, 0);
  const mismatch = Organ.derive({
    root: fx.root,
    workshopRoot: fx.workshopRoot,
    handoffDerived: fx.handoff,
    snapshot: fx.snapshot({}, { mismatchModuleId: 'beta', fingerprint: 'd'.repeat(64) })
  });
  const held = Organ.plan(mismatch, request('alpha', 'gamma'), { now: '2026-07-18T12:01:00.000Z' });
  assert.equal(held.state, 'HOLD_ROUTE_READINESS_BLOCKED');
  assert.ok(held.heldRoutes[0].attention.some(item => item.moduleId === 'beta' && item.id === 'technical-glasses-graph-evidence' && item.state === 'UNKNOWN'));
});

test('batch and private session tampering refuse verification and reuse', t => {
  const fx = fixture(t);
  const derived = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, handoffDerived: fx.handoff, snapshot: fx.snapshot() });
  const batchTamper = JSON.parse(JSON.stringify(derived.batch));
  batchTamper.summary.readyRoutes = 0;
  assert.throws(() => Organ.verifyBatch(batchTamper), /batch digest mismatch/);
  const session = path.join(derived.runDir, derived.batch.results[0].sessionFile);
  fs.appendFileSync(session, ' ');
  assert.throws(() => Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, handoffDerived: fx.handoff, snapshot: fx.snapshot() }), /session hash mismatch/);
});
