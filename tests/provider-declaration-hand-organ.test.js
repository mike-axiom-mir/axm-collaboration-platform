'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const GapCell = require('../kernel/provider-declaration-gap-cell');
const HandoffGraph = require('../organs/reasoning-handoff-graph-organ');
const RouteReadiness = require('../organs/reasoning-route-readiness-organ');
const ReadinessHands = require('../organs/reasoning-readiness-hand-organ');
const Affordances = require('../organs/reasoning-readiness-probe-affordance-organ');
const Organ = require('../organs/provider-declaration-hand-organ');

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

function writeService(workshopRoot, directory, id) {
  const target = path.join(workshopRoot, 'shared', directory, 'service.contract.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify({ schema: 'axm.shared-service-contract/v1', id, version: '1.0.0', status: 'TEST', provides: [], accepts: [], produces: [], boundaries: { automaticWrites: [], refuses: [] } }, null, 2) + '\n');
}

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-provider-declaration-hand-'));
  const root = path.join(base, 'mirror');
  const workshopRoot = path.join(base, 'workshop');
  fs.mkdirSync(root, { recursive: true });
  writeModule(workshopRoot, { id: 'alpha', emits: ['axm.test/x-v1'] });
  writeModule(workshopRoot, { id: 'beta', emits: ['axm.test/y-v1'], accepts: ['axm.test/x-v1'], consumes: ['service:consumer-gap/provider-v1', 'service:bare-consumer-gap'] });
  writeModule(workshopRoot, { id: 'gamma', accepts: ['axm.test/y-v1'] });
  writeService(workshopRoot, 'exact-service', 'exact-service');
  writeService(workshopRoot, 'ambiguous-a', 'ambiguous-service');
  writeService(workshopRoot, 'ambiguous-b', 'ambiguous-service');

  const handoff = HandoffGraph.derive({ root, workshopRoot, stateDir: path.join(root, 'state', 'handoffs') });
  const requirements = ['consumer-gap', 'bare-consumer-gap', 'no-demand', 'exact-service', 'ambiguous-service'].map(id => ({ id, state: 'UNKNOWN', detail: 'No live readiness source declared' }));
  const snapshot = {
    schema: 'axm.technical-glasses/v1', ok: true, compiledAt: '2026-07-18T15:00:00.000Z', freshness: { fingerprint: 'd'.repeat(64) },
    modules: handoff.batch.contracts.map(item => ({
      id: item.moduleId,
      evidence: { manifest: item.manifestRelativePath, contract: item.contractRelativePath, contractDeclared: true, contractPass: true },
      readiness: item.moduleId === 'beta' ? requirements : [{ id: 'base', state: 'READY', detail: 'Fixture ready.' }]
    }))
  };
  const readiness = RouteReadiness.derive({ root, workshopRoot, handoffDerived: handoff, snapshot, stateDir: path.join(root, 'state', 'readiness') });
  const hands = ReadinessHands.derive({ root, workshopRoot, handoffDerived: handoff, readinessDerived: readiness, stateDir: path.join(root, 'state', 'hands') });
  const affordances = Affordances.derive({ root, workshopRoot, handDerived: hands, stateDir: path.join(root, 'state', 'affordances') });
  const stateDir = path.join(root, 'state', 'provider-declaration-hands');
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return { base, root, workshopRoot, handoff, readiness, hands, affordances, stateDir };
}

test('gap cell and hand organ originate only exact consumer-bound missing provider declaration hands', t => {
  const fx = fixture(t);
  const sourceById = new Map(fx.affordances.batch.results.map(item => [item.assessment.requirementId, item.assessment]));
  const cell = GapCell.evaluate({ affordanceAssessment: sourceById.get('consumer-gap') });
  assert.equal(cell.classification, 'PROVIDER_DECLARATION_GAP_CANDIDATE');
  assert.deepEqual(cell.providerSelectors, ['provider-v1']);
  assert.ok(Object.values(cell.authority).every(value => value === false));
  assert.equal(GapCell.verify(cell, sourceById.get('consumer-gap')), true);
  assert.throws(() => GapCell.evaluate({ affordanceAssessment: sourceById.get('consumer-gap'), hidden: true }), /unknown critical/);

  const derived = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, affordanceDerived: fx.affordances, stateDir: fx.stateDir });
  assert.equal(derived.batch.summary.affordanceAssessmentsEvaluated, 5);
  assert.equal(derived.batch.summary.providerDeclarationHandsProposed, 2);
  assert.equal(derived.batch.summary.declarationsPresentNoGap, 1);
  assert.equal(derived.batch.summary.noConsumerDemandHolds, 1);
  assert.equal(derived.batch.summary.ambiguousProviderHolds, 1);
  assert.equal(derived.batch.summary.reasoningDecisionsMatched, 5);
  assert.equal(derived.batch.summary.providerInferenceCandidatesRejected, 5);
  assert.equal(derived.batch.summary.falseAvailableCandidatesRejected, 5);
  assert.equal(derived.batch.summary.declarationCandidateFilesGenerated, 0);
  assert.equal(derived.batch.summary.providerDeclarationsWritten, 0);
  assert.equal(derived.batch.summary.workshopFilesChanged, 0);
  assert.equal(Organ.verifyBatch(derived.batch, derived.runDir, fx.affordances.batch), true);

  const byId = new Map(derived.batch.results.map(item => [item.gapAssessment.requirementId, item]));
  const selected = byId.get('consumer-gap').handRequest;
  assert.equal(selected.state, 'REVIEWABLE_PROVIDER_DECLARATION_GAP_HAND_NOT_BUILT');
  assert.deepEqual(selected.consumerDemand.providerSelectors, ['provider-v1']);
  assert.equal(selected.proposedProviderDeclarationContract.providerIdentity, 'UNRESOLVED_NOT_INFERRED');
  assert.equal(selected.proposedProviderDeclarationContract.declarationSchema, 'UNRESOLVED_REQUIRES_STEWARD_SELECTION');
  assert.equal(selected.proposedProviderDeclarationContract.declarationTargetRelativePath, null);
  assert.equal(selected.proposedProviderDeclarationContract.implementationRelativePath, null);
  assert.equal(selected.proposedProviderDeclarationContract.implementationState, 'NOT_BUILT');
  assert.ok(Object.values(selected.authority).every(value => value === false));
  assert.deepEqual(byId.get('bare-consumer-gap').handRequest.consumerDemand.providerSelectors, []);
  assert.equal(byId.get('no-demand').handRequest, null);
  assert.equal(byId.get('exact-service').gapAssessment.classification, 'DECLARATION_PRESENT_NO_GAP');
  assert.equal(byId.get('ambiguous-service').gapAssessment.classification, 'AMBIGUOUS_PROVIDER_DECLARATIONS_HOLD');
  assert.ok(derived.batch.results.every(item => item.declarationCandidateBuilt === false && item.providerDeclarationWritten === false && item.workshopChanged === false));

  const response = Organ.respond(derived, { schema: Organ.REQUEST_SCHEMA, limit: 10 });
  assert.equal(response.state, 'PROPOSED_PROVIDER_DECLARATION_GAP_HANDS');
  assert.equal(response.proposals.length, 2);
  assert.equal(response.holds.length, 3);
  assert.equal(response.declarationCandidatesBuilt, false);
  assert.equal(response.providerDeclarationsWritten, false);
  const held = Organ.respond(derived, { schema: Organ.REQUEST_SCHEMA, requirementId: 'exact-service' });
  assert.equal(held.state, 'HOLD_NO_CONSUMER_BOUND_UNIQUE_PROVIDER_DECLARATION_GAP');
  const absent = Organ.respond(derived, { schema: Organ.REQUEST_SCHEMA, requirementId: 'unobserved' });
  assert.equal(absent.state, 'HOLD_UNKNOWN_AFFORDANCE_ASSESSMENT');
});

test('a later exact provider removes the next hand while old evidence remains and tampering is refused', t => {
  const fx = fixture(t);
  const first = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, affordanceDerived: fx.affordances, stateDir: fx.stateDir });
  const tampered = JSON.parse(JSON.stringify(first.batch));
  tampered.summary.providerDeclarationHandsProposed = 99;
  assert.throws(() => Organ.verifyBatch(tampered), /digest/);

  writeService(fx.workshopRoot, 'consumer-gap', 'consumer-gap');
  const nextAffordance = Affordances.derive({ root: fx.root, workshopRoot: fx.workshopRoot, handDerived: fx.hands, stateDir: path.join(fx.root, 'state', 'affordances') });
  const next = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, affordanceDerived: nextAffordance, stateDir: fx.stateDir });
  assert.notEqual(next.batch.batchId, first.batch.batchId);
  assert.equal(next.batch.summary.providerDeclarationHandsProposed, 1);
  assert.ok(fs.existsSync(path.join(first.runDir, 'batch.json')));
  const repaired = next.batch.results.find(item => item.gapAssessment.requirementId === 'consumer-gap');
  assert.equal(repaired.gapAssessment.classification, 'DECLARATION_PRESENT_NO_GAP');
  assert.equal(repaired.handRequest, null);

  const sessionFile = path.join(next.runDir, next.batch.results[0].sessionFile);
  fs.appendFileSync(sessionFile, ' ');
  assert.throws(() => Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, affordanceDerived: nextAffordance, stateDir: fx.stateDir }), /session hash mismatch/);
});
