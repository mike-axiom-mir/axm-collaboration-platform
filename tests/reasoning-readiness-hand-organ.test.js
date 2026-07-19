'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const GapCell = require('../kernel/readiness-gap-cell');
const HandoffGraph = require('../organs/reasoning-handoff-graph-organ');
const RouteReadiness = require('../organs/reasoning-route-readiness-organ');
const Organ = require('../organs/reasoning-readiness-hand-organ');

function contract(id, emits, accepts) {
  return { schema: 'axm.module-contract/v1', id, version: '1.0.0', provides: [], consumes: [], permissions: [], handoffs: { emits, accepts }, boundaries: { writes: [], refuses: ['automatic-world-action'] } };
}

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-readiness-hand-'));
  const root = path.join(base, 'mirror');
  const workshopRoot = path.join(base, 'workshop');
  fs.mkdirSync(root, { recursive: true });
  const definitions = [
    { id: 'alpha', emits: ['axm.test/x-v1'], accepts: [] },
    { id: 'beta', emits: ['axm.test/y-v1'], accepts: ['axm.test/x-v1'] },
    { id: 'gamma', emits: [], accepts: ['axm.test/y-v1'] }
  ];
  for (const item of definitions) {
    const directory = path.join(workshopRoot, 'tools', item.id);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'module.contract.json'), JSON.stringify(contract(item.id, item.emits, item.accepts), null, 2) + '\n');
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ schema: 'axm.tool-manifest/v1', id: item.id, version: '1.0.0', status: 'TEST', entry: 'index.html', uses: [], permissions: [], contract: 'module.contract.json' }, null, 2) + '\n');
  }
  const handoff = HandoffGraph.derive({ root, workshopRoot });
  function snapshot(requirements = {}) {
    return {
      schema: 'axm.technical-glasses/v1', ok: true, compiledAt: '2026-07-18T12:00:00.000Z', freshness: { fingerprint: Organ.digest(requirements) },
      modules: handoff.batch.contracts.map(item => ({
        id: item.moduleId,
        evidence: { manifest: item.manifestRelativePath, contract: item.contractRelativePath, contractDeclared: true, contractPass: true },
        readiness: requirements[item.moduleId] || [{ id: 'base', state: 'READY', detail: 'Ready fixture.' }]
      }))
    };
  }
  function derive(requirements) {
    const readiness = RouteReadiness.derive({ root, workshopRoot, handoffDerived: handoff, snapshot: snapshot(requirements), stateDir: path.join(root, 'state', 'readiness') });
    return Organ.derive({ root, workshopRoot, handoffDerived: handoff, readinessDerived: readiness, stateDir: path.join(root, 'state', 'hands') });
  }
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return { base, root, workshopRoot, handoff, snapshot, derive };
}

function gapInput(detail = 'No live readiness source declared') {
  return {
    sourceReadinessBatchId: 'reasoning-route-readiness-' + 'a'.repeat(20),
    sourceReadinessBatchDigest: 'b'.repeat(64),
    sourceStateDigest: 'c'.repeat(64),
    requirementId: 'missing-service',
    observations: [{ moduleId: 'alpha', state: 'UNKNOWN', detail, evidenceMatchesGraph: true, manifestRelativePath: 'tools/alpha/manifest.json', manifestSha256: 'd'.repeat(64), contractRelativePath: 'tools/alpha/module.contract.json', contractSha256: 'e'.repeat(64) }],
    impactedRouteIds: ['route-one']
  };
}

test('readiness gap cell distinguishes an absent probe from another UNKNOWN and detects tampering', () => {
  const missing = GapCell.evaluate(gapInput());
  assert.equal(missing.classification, 'MISSING_PROBE_HAND_CANDIDATE');
  assert.ok(Object.values(missing.authority).every(value => value === false));
  assert.equal(GapCell.verify(missing), true);
  const timeout = GapCell.evaluate(gapInput('Probe timed out after 500 ms'));
  assert.equal(timeout.classification, 'UNKNOWN_INSPECTION_REQUIRED');
  const tampered = JSON.parse(JSON.stringify(missing));
  tampered.classification = 'UNKNOWN_INSPECTION_REQUIRED';
  assert.throws(() => GapCell.verify(tampered), /digest mismatch|content mismatch/);
});

test('planner discovers requirement IDs, aggregates route impact, and refuses to turn timeout into a new probe', t => {
  const fx = fixture(t);
  const result = fx.derive({
    beta: [{ id: 'service-z', state: 'UNKNOWN', detail: 'No live readiness source declared' }],
    gamma: [{ id: 'service-z', state: 'UNKNOWN', detail: 'No live readiness source declared' }, { id: 'timed-service', state: 'UNKNOWN', detail: 'Probe timed out' }]
  });
  assert.equal(result.batch.summary.unknownRequirementIds, 2);
  assert.equal(result.batch.summary.missingProbeHandRequests, 1);
  assert.equal(result.batch.summary.unknownInspectionHolds, 1);
  assert.equal(result.batch.summary.classificationsMatched, 2);
  assert.equal(result.batch.summary.falseReadyCandidatesRejected, 2);
  assert.equal(result.batch.summary.codeFilesGenerated, 0);
  assert.equal(result.batch.summary.probesInstalled, 0);
  assert.equal(result.batch.summary.servicesStartedOrRepaired, 0);
  assert.equal(result.batch.summary.trainingReceiptsCreated, 0);
  assert.equal(result.batch.summary.worldActionsExecuted, 0);
  const service = result.batch.results.find(item => item.requirementId === 'service-z');
  assert.deepEqual(service.handRequest.observedInModuleIds, ['beta', 'gamma']);
  assert.equal(service.handRequest.impact.manifestBoundRouteCount, 3);
  assert.equal(service.handRequest.proposedProbeContract.implementationState, 'NOT_BUILT');
  assert.equal(service.handRequest.proposedProbeContract.permissionRequirements, 'UNKNOWN_REQUIRES_EXPLICIT_CONTRACT_AND_STEWARD_REVIEW');
  assert.ok(Object.values(service.handRequest.authority).every(value => value === false));
  const timed = result.batch.results.find(item => item.requirementId === 'timed-service');
  assert.equal(timed.handRequest, null);
  assert.equal(timed.assessment.classification, 'UNKNOWN_INSPECTION_REQUIRED');

  const response = Organ.plan(result, { schema: Organ.REQUEST_SCHEMA, limit: 10 });
  assert.equal(response.state, 'PROPOSED_READINESS_PROBE_HAND_REQUESTS');
  assert.equal(response.proposals.length, 1);
  assert.equal(response.inspectionHolds.length, 1);
  assert.ok(Object.values(response.authority).every(value => value === false));
  const filtered = Organ.plan(result, { schema: Organ.REQUEST_SCHEMA, requirementId: 'timed-service' });
  assert.equal(filtered.state, 'HOLD_UNKNOWN_REQUIRES_INSPECTION_NOT_NEW_PROBE');
  const unknown = Organ.plan(result, { schema: Organ.REQUEST_SCHEMA, requirementId: 'not-observed' });
  assert.equal(unknown.state, 'HOLD_UNKNOWN_READINESS_REQUIREMENT');
});

test('new and repaired readiness requirements automatically create new immutable planner batches', t => {
  const fx = fixture(t);
  const first = fx.derive({ beta: [{ id: 'dynamic-one', state: 'UNKNOWN', detail: 'No readiness probe declared' }] });
  const second = fx.derive({ beta: [{ id: 'dynamic-one', state: 'UNKNOWN', detail: 'No readiness probe declared' }, { id: 'dynamic-two', state: 'UNKNOWN', detail: 'No live readiness source declared' }] });
  assert.notEqual(first.batch.batchId, second.batch.batchId);
  assert.deepEqual(second.batch.results.map(item => item.requirementId), ['dynamic-one', 'dynamic-two']);
  assert.ok(fs.existsSync(path.join(first.runDir, 'batch.json')));
  assert.ok(fs.existsSync(path.join(second.runDir, 'batch.json')));
  const repaired = fx.derive({ beta: [{ id: 'dynamic-one', state: 'READY', detail: 'Probe now passes.' }] });
  assert.notEqual(repaired.batch.batchId, second.batch.batchId);
  assert.equal(repaired.batch.summary.unknownRequirementIds, 0);
  assert.equal(Organ.plan(repaired, { schema: Organ.REQUEST_SCHEMA }).state, 'NO_MISSING_READINESS_PROBE_HANDS');
});

test('planner batch and private reasoning session tampering refuse verification and reuse', t => {
  const fx = fixture(t);
  const result = fx.derive({ beta: [{ id: 'missing-service', state: 'UNKNOWN', detail: 'No live readiness source declared' }] });
  const tampered = JSON.parse(JSON.stringify(result.batch));
  tampered.summary.codeFilesGenerated = 1;
  assert.throws(() => Organ.verifyBatch(tampered), /digest/);
  const session = path.join(result.runDir, result.batch.results[0].sessionFile);
  fs.appendFileSync(session, ' ');
  assert.throws(() => fx.derive({ beta: [{ id: 'missing-service', state: 'UNKNOWN', detail: 'No live readiness source declared' }] }), /session hash mismatch/);
});
