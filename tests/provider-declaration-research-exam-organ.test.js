'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const HandoffGraph = require('../organs/reasoning-handoff-graph-organ');
const RouteReadiness = require('../organs/reasoning-route-readiness-organ');
const ReadinessHands = require('../organs/reasoning-readiness-hand-organ');
const Affordances = require('../organs/reasoning-readiness-probe-affordance-organ');
const ProviderHands = require('../organs/provider-declaration-hand-organ');
const Organ = require('../organs/provider-declaration-research-exam-organ');

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
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-provider-declaration-research-exam-'));
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
    schema: 'axm.technical-glasses/v1', ok: true, compiledAt: '2026-07-18T16:00:00.000Z', freshness: { fingerprint: 'e'.repeat(64) },
    modules: handoff.batch.contracts.map(item => ({
      id: item.moduleId,
      evidence: { manifest: item.manifestRelativePath, contract: item.contractRelativePath, contractDeclared: true, contractPass: true },
      readiness: item.moduleId === 'beta' ? requirements : [{ id: 'base', state: 'READY', detail: 'Fixture ready.' }]
    }))
  };
  const readiness = RouteReadiness.derive({ root, workshopRoot, handoffDerived: handoff, snapshot, stateDir: path.join(root, 'state', 'readiness') });
  const hands = ReadinessHands.derive({ root, workshopRoot, handoffDerived: handoff, readinessDerived: readiness, stateDir: path.join(root, 'state', 'hands') });
  const affordances = Affordances.derive({ root, workshopRoot, handDerived: hands, stateDir: path.join(root, 'state', 'affordances') });
  const providerHands = ProviderHands.derive({ root, workshopRoot, affordanceDerived: affordances, stateDir: path.join(root, 'state', 'provider-hands') });
  const stateDir = path.join(root, 'state', 'research-exams');
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return { base, root, workshopRoot, handoff, readiness, hands, affordances, providerHands, stateDir };
}

test('research organ turns only nonbuilt declaration hands into independent falsifiable exam requests', t => {
  const fx = fixture(t);
  const derived = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, providerDerived: fx.providerHands, stateDir: fx.stateDir });
  const summary = derived.batch.summary;
  assert.equal(summary.providerDeclarationHandResultsEvaluated, 5);
  assert.equal(summary.researchExamRequestsProposed, 2);
  assert.equal(summary.declarationsPresentNoExam, 1);
  assert.equal(summary.noConsumerDemandResearchHolds, 1);
  assert.equal(summary.ambiguousProviderResearchHolds, 1);
  assert.equal(summary.frontierExamRequired, 2);
  assert.equal(summary.reasoningDecisionsMatched, 5);
  assert.equal(summary.providerBuildCandidatesRejected, 5);
  assert.equal(summary.falseResolutionCandidatesRejected, 5);
  assert.equal(summary.architecturesSelected, 0);
  assert.equal(summary.examExecutorsBuilt, 0);
  assert.equal(summary.fixtureFilesGenerated, 0);
  assert.equal(summary.providerCandidatesBuilt, 0);
  assert.equal(summary.providerDeclarationsWritten, 0);
  assert.equal(summary.liveExperimentsExecuted, 0);
  assert.equal(summary.workshopFilesChanged, 0);
  assert.equal(Organ.verifyBatch(derived.batch, derived.runDir, fx.providerHands), true);

  const byId = new Map(derived.batch.results.map(item => [item.gapAssessment.requirementId, item]));
  const selected = byId.get('consumer-gap');
  assert.equal(selected.researchExamRequest.state, 'REVIEWABLE_PROVIDER_DECLARATION_RESEARCH_EXAM_NOT_EXECUTED');
  assert.equal(selected.researchExamRequest.architectureDecision, 'UNRESOLVED_REQUIRES_INDEPENDENT_EXPERIMENT');
  assert.equal(selected.researchExamRequest.examExecutorState, 'NOT_BUILT');
  assert.deepEqual(selected.researchExamRequest.knownRelations.demandedProviderSelectors, ['provider-v1']);
  assert.equal(selected.researchExamRequest.architectureHypotheses.length, 4);
  assert.ok(selected.researchExamRequest.architectureHypotheses.every(item => item.state === 'UNTESTED' && item.candidateMayClaimFitWithoutExam === false));
  assert.equal(selected.researchExamRequest.caseFamilies.length, 10);
  assert.equal(selected.researchExamRequest.caseFamilies.find(item => item.caseId === 'DEMANDED_SELECTOR_COVERAGE_MISSING').applicable, true);
  assert.equal(selected.researchExamRequest.independence.futureCandidateMayAuthorExpectedOutcomes, false);
  assert.equal(selected.researchExamRequest.independence.futureCandidateMayAuthorHeldOutFixtures, false);
  assert.ok(Object.values(selected.researchExamRequest.authority).every(value => value === false));
  assert.equal(selected.frontierAssessment.classification, 'FRONTIER_EXAM_REQUIRED');
  assert.equal(selected.frontierAssessment.proposal.nextGate, 'EXAM_AUTHORING_REVIEW');
  assert.equal(byId.get('bare-consumer-gap').researchExamRequest.caseFamilies.find(item => item.caseId === 'DEMANDED_SELECTOR_COVERAGE_MISSING').applicable, false);
  assert.equal(byId.get('no-demand').researchExamRequest, null);
  assert.equal(byId.get('exact-service').researchExamRequest, null);
  assert.equal(byId.get('ambiguous-service').researchExamRequest, null);
  assert.ok(derived.batch.results.every(item => item.architectureSelected === false && item.examExecutorBuilt === false && item.providerCandidateBuilt === false && item.providerDeclarationWritten === false));

  const response = Organ.respond(derived, { schema: Organ.REQUEST_SCHEMA, limit: 10 });
  assert.equal(response.state, 'PROPOSED_PROVIDER_DECLARATION_RESEARCH_EXAMS');
  assert.equal(response.examRequests.length, 2);
  assert.equal(response.holds.length, 3);
  assert.equal(response.architectureSelected, false);
  assert.equal(response.examExecutorBuilt, false);
  assert.equal(response.fixtureFilesGenerated, 0);
  const held = Organ.respond(derived, { schema: Organ.REQUEST_SCHEMA, requirementId: 'exact-service' });
  assert.equal(held.state, 'HOLD_NO_PROVIDER_DECLARATION_RESEARCH_EXAM_REQUIRED');
  const absent = Organ.respond(derived, { schema: Organ.REQUEST_SCHEMA, requirementId: 'unobserved' });
  assert.equal(absent.state, 'HOLD_UNKNOWN_PROVIDER_DECLARATION_HAND_RESULT');
});

test('a repaired declaration removes the next exam while prior evidence remains and tampering is refused', t => {
  const fx = fixture(t);
  const first = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, providerDerived: fx.providerHands, stateDir: fx.stateDir });
  const tampered = JSON.parse(JSON.stringify(first.batch));
  tampered.summary.researchExamRequestsProposed = 99;
  assert.throws(() => Organ.verifyBatch(tampered), /digest/);

  writeService(fx.workshopRoot, 'consumer-gap', 'consumer-gap');
  const nextAffordance = Affordances.derive({ root: fx.root, workshopRoot: fx.workshopRoot, handDerived: fx.hands, stateDir: path.join(fx.root, 'state', 'affordances') });
  const nextProviderHands = ProviderHands.derive({ root: fx.root, workshopRoot: fx.workshopRoot, affordanceDerived: nextAffordance, stateDir: path.join(fx.root, 'state', 'provider-hands') });
  const next = Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, providerDerived: nextProviderHands, stateDir: fx.stateDir });
  assert.notEqual(next.batch.batchId, first.batch.batchId);
  assert.equal(next.batch.summary.researchExamRequestsProposed, 1);
  assert.ok(fs.existsSync(path.join(first.runDir, 'batch.json')));
  const repaired = next.batch.results.find(item => item.gapAssessment.requirementId === 'consumer-gap');
  assert.equal(repaired.gapAssessment.classification, 'DECLARATION_PRESENT_NO_GAP');
  assert.equal(repaired.researchExamRequest, null);

  const sessionFile = path.join(next.runDir, next.batch.results[0].sessionFile);
  fs.appendFileSync(sessionFile, ' ');
  assert.throws(() => Organ.derive({ root: fx.root, workshopRoot: fx.workshopRoot, providerDerived: nextProviderHands, stateDir: fx.stateDir }), /session hash mismatch/);
});
