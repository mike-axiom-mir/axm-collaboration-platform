'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const HandoffGraph = require('../organs/reasoning-handoff-graph-organ');
const RouteReadiness = require('../organs/reasoning-route-readiness-organ');
const ReadinessHands = require('../organs/reasoning-readiness-hand-organ');
const Organ = require('../organs/reasoning-readiness-probe-affordance-organ');

function contract(id, emits, accepts, consumes = []) {
  return { schema: 'axm.module-contract/v1', id, version: '1.0.0', provides: [], consumes, permissions: [], handoffs: { emits, accepts }, boundaries: { writes: [], refuses: ['automatic-world-action'] } };
}

function writeModule(workshopRoot, definition) {
  const directory = path.join(workshopRoot, 'tools', definition.id);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'index.html'), '<!doctype html>fixture\n');
  fs.writeFileSync(path.join(directory, 'module.contract.json'), JSON.stringify(contract(definition.id, definition.emits || [], definition.accepts || [], definition.consumes || []), null, 2) + '\n');
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ schema: 'axm.tool-manifest/v1', id: definition.id, version: '1.0.0', status: 'TEST', entry: 'index.html', uses: [], permissions: [], contract: 'module.contract.json' }, null, 2) + '\n');
}

function writeService(workshopRoot, directory, id, overrides = {}) {
  const target = path.join(workshopRoot, 'shared', directory, 'service.contract.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(Object.assign({ schema: 'axm.shared-service-contract/v1', id, version: '1.0.0', status: 'TEST', provides: [], accepts: [], produces: [], boundaries: { automaticWrites: [], refuses: [] } }, overrides), null, 2) + '\n');
}

function writeFoundationPlane(workshopRoot, directory, services, overrides = {}) {
  const target = path.join(workshopRoot, 'shared', directory, 'service-contract.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(Object.assign({ schema: 'axm.foundation-service-plane/v1', purpose: 'Fixture permanent infrastructure', rules: ['All declared services remain represented'], services }, overrides), null, 2) + '\n');
}

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-readiness-affordance-'));
  const root = path.join(base, 'mirror');
  const workshopRoot = path.join(base, 'workshop');
  fs.mkdirSync(root, { recursive: true });
  writeModule(workshopRoot, { id: 'alpha', emits: ['axm.test/x-v1'] });
  writeModule(workshopRoot, { id: 'beta', accepts: ['axm.test/x-v1'], consumes: ['service:consumer-only/v1'] });
  writeModule(workshopRoot, { id: 'exact-module' });
  writeService(workshopRoot, 'exact-service', 'exact-service');
  writeService(workshopRoot, 'ambiguous-a', 'ambiguous-service');
  writeService(workshopRoot, 'ambiguous-b', 'ambiguous-service');
  writeService(workshopRoot, 'name-decoy', 'different-service');
  writeFoundationPlane(workshopRoot, 'foundation', ['exact-foundation-service', 'ambiguous-service']);
  writeFoundationPlane(workshopRoot, 'malformed-foundation', ['malformed-foundation', 'malformed-foundation']);

  const handoff = HandoffGraph.derive({ root, workshopRoot, stateDir: path.join(root, 'state', 'handoffs') });
  const requirements = ['exact-module', 'exact-service', 'exact-foundation-service', 'malformed-foundation', 'consumer-only', 'ambiguous-service', 'name-decoy'].map(id => ({ id, state: 'UNKNOWN', detail: 'No live readiness source declared' }));
  const snapshot = {
    schema: 'axm.technical-glasses/v1', ok: true, compiledAt: '2026-07-18T12:00:00.000Z', freshness: { fingerprint: 'a'.repeat(64) },
    modules: handoff.batch.contracts.map(item => ({
      id: item.moduleId,
      evidence: { manifest: item.manifestRelativePath, contract: item.contractRelativePath, contractDeclared: true, contractPass: true },
      readiness: item.moduleId === 'beta' ? requirements : [{ id: 'base', state: 'READY', detail: 'Fixture ready.' }]
    }))
  };
  const readiness = RouteReadiness.derive({ root, workshopRoot, handoffDerived: handoff, snapshot, stateDir: path.join(root, 'state', 'readiness') });
  const hands = ReadinessHands.derive({ root, workshopRoot, handoffDerived: handoff, readinessDerived: readiness, stateDir: path.join(root, 'state', 'hands') });
  const stateDir = path.join(root, 'state', 'affordances');
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return { base, root, workshopRoot, handoff, readiness, hands, stateDir };
}

test('affordance planner proposes only unique exact typed providers and holds consumer, name, and ambiguity signals', t => {
  const fx = fixture(t);
  const derived = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, handDerived: fx.hands, stateDir: fx.stateDir });
  assert.equal(derived.batch.summary.handRequestsAssessed, 7);
  assert.equal(derived.batch.summary.exactModuleReviewPackets, 1);
  assert.equal(derived.batch.summary.exactSharedServiceReviewPackets, 1);
  assert.equal(derived.batch.summary.exactFoundationServiceReviewPackets, 1);
  assert.equal(derived.batch.summary.reviewPacketsProposed, 3);
  assert.equal(derived.batch.summary.noProviderHolds, 3);
  assert.equal(derived.batch.summary.ambiguousProviderHolds, 1);
  assert.equal(derived.batch.summary.reasoningDecisionsMatched, 7);
  assert.equal(derived.batch.summary.nameInferenceCandidatesRejected, 7);
  assert.equal(derived.batch.summary.falseReadyCandidatesRejected, 7);
  assert.equal(derived.batch.summary.humanReviewsCreated, 0);
  assert.equal(derived.batch.summary.candidatesBuilt, 0);
  assert.equal(derived.batch.summary.workshopFilesChanged, 0);
  assert.equal(Organ.verifyBatch(derived.batch, derived.runDir, fx.hands.batch, fx.handoff.batch, fx.workshopRoot), true);

  const byId = new Map(derived.batch.results.map(item => [item.assessment.requirementId, item.assessment]));
  assert.equal(byId.get('exact-module').recommendation.suggestedProbe.kind, 'DECLARED_MODULE_AVAILABLE');
  assert.equal(byId.get('exact-module').recommendation.suggestedProbe.targetRelativePath, 'tools/exact-module/manifest.json');
  assert.equal(byId.get('exact-service').recommendation.suggestedProbe.kind, 'DECLARED_SHARED_SERVICE_AVAILABLE');
  assert.equal(byId.get('exact-service').recommendation.suggestedProbe.targetRelativePath, 'shared/exact-service/service.contract.json');
  assert.equal(byId.get('exact-foundation-service').classification, 'PROPOSE_EXACT_FOUNDATION_SERVICE_AFFORDANCE');
  assert.equal(byId.get('exact-foundation-service').providerEvidence[0].declarationKind, 'FOUNDATION_SERVICE_MEMBER');
  assert.equal(byId.get('exact-foundation-service').recommendation.suggestedProbe.kind, 'DECLARED_FOUNDATION_SERVICE_AVAILABLE');
  assert.equal(byId.get('exact-foundation-service').recommendation.suggestedProbe.targetRelativePath, 'shared/foundation/service-contract.json');
  assert.equal(byId.get('malformed-foundation').recommendation, null);
  assert.equal(byId.get('malformed-foundation').rejectedExactServiceSignals.length, 1);
  assert.match(byId.get('malformed-foundation').rejectedExactServiceSignals[0].error, /structural fields/);
  assert.equal(byId.get('consumer-only').recommendation, null);
  assert.equal(byId.get('consumer-only').consumerBindings[0].consumes, 'service:consumer-only/v1');
  assert.equal(byId.get('name-decoy').providerEvidence.length, 0);
  assert.equal(byId.get('ambiguous-service').providerEvidence.length, 3);
  assert.ok(derived.batch.results.every(item => Object.values(item.assessment.authority).every(value => value === false)));
  assert.equal(derived.batch.authority.privateEvidenceTraceWrite, true);
  assert.ok(Object.entries(derived.batch.authority).every(([key, value]) => key === 'privateEvidenceTraceWrite' ? value === true : value === false));

  const response = Organ.respond(derived, { schema: Organ.REQUEST_SCHEMA, limit: 10 });
  assert.equal(response.state, 'PROPOSED_EXACT_DECLARATION_REVIEW_PACKETS');
  assert.equal(response.reviewPackets.length, 3);
  assert.equal(response.holds.length, 4);
  assert.equal(response.humanReviewCreated, false);
  assert.equal(response.recipesSealed, false);
  assert.equal(response.candidatesBuilt, false);
  const held = Organ.respond(derived, { schema: Organ.REQUEST_SCHEMA, requirementId: 'consumer-only' });
  assert.equal(held.state, 'HOLD_NO_UNIQUE_EXACT_PROVIDER_DECLARATION');
  const unknown = Organ.respond(derived, { schema: Organ.REQUEST_SCHEMA, requirementId: 'not-observed' });
  assert.equal(unknown.state, 'HOLD_UNKNOWN_READINESS_HAND');
});

test('affordance source drift appends a new batch while immutable trace tampering is refused', t => {
  const fx = fixture(t);
  const derived = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, handDerived: fx.hands, stateDir: fx.stateDir });
  const tampered = JSON.parse(JSON.stringify(derived.batch));
  tampered.summary.reviewPacketsProposed = 99;
  assert.throws(() => Organ.verifyBatch(tampered), /digest/);

  fs.appendFileSync(path.join(fx.workshopRoot, 'tools', 'exact-module', 'index.html'), 'drift');
  const superseding = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, handDerived: fx.hands, stateDir: fx.stateDir });
  assert.notEqual(superseding.batch.batchId, derived.batch.batchId);
  assert.ok(fs.existsSync(path.join(derived.runDir, 'batch.json')));
  const oldEntry = derived.batch.results.find(item => item.assessment.requirementId === 'exact-module').assessment.providerEvidence[0].entrySha256;
  const newEntry = superseding.batch.results.find(item => item.assessment.requirementId === 'exact-module').assessment.providerEvidence[0].entrySha256;
  assert.notEqual(newEntry, oldEntry);

  const sessionFile = path.join(superseding.runDir, superseding.batch.results[0].sessionFile);
  fs.appendFileSync(sessionFile, ' ');
  assert.throws(() => Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, handDerived: fx.hands, stateDir: fx.stateDir }), /session hash mismatch/);
});
