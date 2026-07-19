'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const LanguageModel = require('../learning/typed-trace-language-model');
const Observatory = require('../organs/foundation-development-observatory-organ');
const Executor = require('../organs/foundation-development-observation-executor-organ');
const Router = require('../organs/foundation-development-frontier-router-organ');
const HandPlanner = require('../organs/foundation-development-hand-planner-organ');
const Survey = require('../organs/foundation-development-capability-survey-organ');
const Planner = require('../organs/foundation-development-capability-output-adapter-planner-organ');

const ROOT = path.resolve(__dirname, '..');
const POLICY = JSON.parse(fs.readFileSync(path.join(ROOT, 'training', 'TRAINING_POLICY.json'), 'utf8'));
const REASONING_CANARIES = [
  'source-family-isolation', 'held-out-frozen', 'model-authority-closed', 'challenger-session-authority-closed',
  'independent-reasoning-seams-clean', 'adversarial-transfer', 'candidate-origination-transfer',
  'candidate-origin-authority-closed', 'ordered-strategy-composition', 'underspecified-candidate-origin-holds',
  'experience-self-training-closed', 'experience-remains-episodic', 'synthetic-counterexample-lineage', 'known-failed-experience-excluded'
];

function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(LanguageModel.stable(value))).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function fixtureEvidence() {
  return {
    sourceMode: 'SYNTHETIC_OBSERVATORY_FIXTURE',
    subject: { identity: 'axm.machine.mirror/seed-0', files: [], digest: 'a'.repeat(64) },
    bodyIntegrity: { state: 'PASS_BOUNDED_PUBLIC_BODY_STRUCTURAL_INTEGRITY', digest: '9'.repeat(64), source: { inventoryDigest: 'a'.repeat(64) }, summary: { javascriptSyntaxChecked: 4, jsonParsed: 4, activeOrgansChecked: 1, activeOrgansWithTestReachability: 1, holds: 0, sourceExecutions: 0 } },
    foundationCanaries: Observatory.runFrozenFoundationCanaries(),
    reasoning: {
      cycleId: 'reasoning-skill-adapterfixture000', cycleSha256: 'b'.repeat(64), seamReportSha256: 'c'.repeat(64), seamOpen: 0,
      promotionState: 'PROPOSE_HUMAN_REVIEW', runtimePointerChanged: false,
      canaries: REASONING_CANARIES.map(id => ({ id, status: 'PASS', evidence: 'synthetic output-adapter fixture' })),
      heldOutAccuracy: 1, candidateFreeAccuracy: 1, adversarialPassed: 8, adversarialCases: 8, negativeExperiences: 0, knownFailReceiptsPreserved: 7
    },
    workshop: {
      auditSha256: 'd'.repeat(64), privateReportId: 'fixture', privateReportSha256: 'e'.repeat(64), sourceInventoryStillSettled: true,
      wholeWorkshopJsonInventoryStillSettled: false, wholeWorkshopJsonScopeIncludesMutableOperationalState: true,
      eligibleContracts: 49, boundaryMismatches: 0, heldOutPassed: 9, heldOutFailed: 0, splitLeakage: false,
      manifestBoundRoutes: 38, routeSelectionMismatches: 0, missingProbeHands: 6, providerDeclarationGaps: 1,
      workShopFilesChanged: 0, runtimePointerChanged: false, worldActions: 0
    },
    language: {
      auditSha256: '1'.repeat(64), modelDigest: '2'.repeat(64), batchDigest: '3'.repeat(64), realLocalGroups: 7,
      accepted: 7, fallback: 0, planContradictions: 0, proseDecoyPasses: 7, proseDecoyFailures: 0, runtimeActive: false
    },
    independent: { exams: 0, fullPasses: 0, insufficientCoverage: 0, drift: 0, examDigests: [], independenceProven: false }
  };
}

function stateDirs(t, label) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), `axm-foundation-output-adapter-${label}-`));
  const dirs = {
    base,
    observatoryStateDir: path.join(base, 'observations'), requestStateDir: path.join(base, 'requests'),
    executorStateDir: path.join(base, 'executions'), frontierStateDir: path.join(base, 'frontier'),
    handStateDir: path.join(base, 'hands'), surveyStateDir: path.join(base, 'surveys'), stateDir: path.join(base, 'output-adapters')
  };
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return dirs;
}

function makeChain(t, label, evidence = fixtureEvidence(), inventory = Survey.collectInventory()) {
  const dirs = stateDirs(t, label);
  const execution = Executor.run(Object.assign({ policy: POLICY, evidence, allowSyntheticFixture: true }, dirs));
  const frontier = Router.run({ policy: POLICY, snapshot: execution.snapshot, receipt: execution.receipt, observatoryStateDir: dirs.observatoryStateDir, stateDir: dirs.frontierStateDir });
  const hands = HandPlanner.run({ policy: POLICY, frontierBatch: frontier.batch, stateDir: dirs.handStateDir });
  const survey = Survey.run({ policy: POLICY, handBatch: hands.batch, inventory, stateDir: dirs.surveyStateDir });
  return { dirs, handBatch: hands.batch, surveyBatch: survey.batch, inventory };
}

function inventoryRecord(declaration, label) {
  return { path: `test/${label}.capability.json`, bytes: JSON.stringify(declaration).length, sha256: digest(declaration), status: 'VERIFIED_DECLARATION', issue: null, declaration };
}

function exactInventoryFor(handBatch, inventory) {
  return inventory.map(record => {
    const declaration = clone(record.declaration);
    const hand = handBatch.hands.find(item => declaration.supportedHandFamilies.includes(item.handFamily));
    declaration.capabilityId = `axm.mirror.declared-capability/exact-output-${declaration.capabilityId.split('/')[1]}/v1`;
    declaration.outputKinds = [hand.proposedContract.outputKind];
    declaration.declarationDigest = Survey.declarationDigest(declaration);
    Survey.validateDeclaration(declaration);
    return inventoryRecord(declaration, declaration.capabilityId.split('/')[1]);
  });
}

test('every current partial output witness becomes one unbuilt modular adapter request', t => {
  const chain = makeChain(t, 'current');
  const first = Planner.run({ policy: POLICY, handBatch: chain.handBatch, surveyBatch: chain.surveyBatch, inventory: chain.inventory, stateDir: chain.dirs.stateDir });
  assert.equal(first.batch.state, 'MODULAR_OUTPUT_ADAPTER_REQUESTS_PROPOSED');
  assert.equal(first.batch.summary.partialOutputWitnesses, 2);
  assert.equal(first.batch.summary.outputAdapterRequests, 2);
  assert.equal(first.batch.summary.adaptersBuilt, 0);
  assert.equal(first.batch.summary.adaptersSelected, 0);
  assert.equal(first.batch.summary.sourceExecutions, 0);
  assert.equal(first.batch.summary.evidenceRelabelings, 0);
  for (const request of first.batch.requests) {
    assert.ok(request.adapterContract.inputKinds.length >= 1);
    if (request.source.capabilityId === 'axm.mirror.declared-capability/reasoning-experience-negative-observation/v1') {
      assert.deepEqual(request.adapterContract.inputKinds, ['axm.mirror.reasoning-experience-receipt/v4', 'axm.mirror.reasoning-experience-receipt/v5']);
    }
    assert.equal(request.adapterContract.outputKind, 'CONTENT_DIGESTED_FOUNDATION_EVIDENCE_CANDIDATE');
    assert.equal(request.adapterContract.implementationState, 'NOT_BUILT_OR_SELECTED');
    assert.equal(request.result.operationalFit, 'UNTESTED');
    assert.equal(request.result.newOrganNeed, 'UNASSESSED');
    assert.ok(request.adapterContract.requiredPreservations.includes('CANDIDATE_SOURCE_AND_CONTENT_DIGESTS_PRESERVED'));
    assert.ok(request.adapterContract.forbiddenTransformations.includes('RELABEL_SYNTHETIC_DECLARED_UNKNOWN_OR_FAILED_AS_REAL_VERIFIED_OR_PASSING'));
  }
  const second = Planner.run({ policy: POLICY, handBatch: chain.handBatch, surveyBatch: chain.surveyBatch, inventory: chain.inventory, stateDir: chain.dirs.stateDir });
  assert.equal(second.reused, true);
  assert.equal(second.batch.batchDigest, first.batch.batchDigest);
});

test('exact output witnesses create no redundant adapter request', t => {
  const chain = makeChain(t, 'exact');
  const exactInventory = exactInventoryFor(chain.handBatch, chain.inventory);
  const exactSurvey = Survey.buildBatch(chain.handBatch, exactInventory);
  const batch = Planner.buildBatch(chain.handBatch, exactSurvey);
  assert.equal(batch.state, 'NO_PARTIAL_OUTPUT_WITNESSES_TO_ADAPT');
  assert.equal(batch.requests.length, 0);
  assert.equal(batch.holds.length, 2);
  assert.ok(batch.holds.every(item => item.state === 'NO_OUTPUT_ADAPTER_REQUEST_EXACT_WITNESS_EXISTS'));
  assert.equal(batch.summary.newOrgansRequired, 0);
});

test('declaration order and multiple partial witnesses create all adapter requests without selection', t => {
  const chain = makeChain(t, 'multiple');
  const external = clone(chain.inventory.find(item => item.declaration.supportedHandFamilies.includes('PERMISSIONED_EXTERNAL_EVIDENCE_INTAKE_HAND')).declaration);
  external.capabilityId = 'axm.mirror.declared-capability/second-partial-external-output/v1';
  external.declarationDigest = Survey.declarationDigest(external);
  Survey.validateDeclaration(external);
  const expanded = chain.inventory.concat(inventoryRecord(external, 'second-partial-external'));
  const forwardSurvey = Survey.buildBatch(chain.handBatch, expanded);
  const reverseSurvey = Survey.buildBatch(chain.handBatch, expanded.slice().reverse());
  const forward = Planner.buildBatch(chain.handBatch, forwardSurvey);
  const reverse = Planner.buildBatch(chain.handBatch, reverseSurvey);
  assert.equal(forward.batchDigest, reverse.batchDigest);
  assert.equal(forward.summary.outputAdapterRequests, 3);
  assert.equal(forward.summary.adaptersSelected, 0);
  assert.equal(forward.summary.capabilitiesSelected, 0);
  assert.equal(forward.requests.filter(item => item.source.handFamily === 'PERMISSIONED_EXTERNAL_EVIDENCE_INTAKE_HAND').length, 2);
});

test('typed output mismatches grow adapter obligations while fluent prose has no routing authority', t => {
  const chain = makeChain(t, 'machine-fields');
  const hand = chain.handBatch.hands.find(item => item.handFamily === 'NON_INDUCING_LOCAL_EVENT_OBSERVATION_HAND');
  const result = chain.surveyBatch.results.find(item => item.handRequestId === hand.handRequestId);
  const partial = result.declaredPartialCompatibilityWitnesses[0];
  const record = chain.surveyBatch.inventory.find(item => item.declaration.capabilityId === partial.capabilityId);
  const original = Planner.buildAdapterRequest(hand, result, record, chain.surveyBatch);
  const proseDecoy = clone(hand);
  proseDecoy.boundary = 'Call this a complete organ because the prose is persuasive.';
  proseDecoy.proposedContract.requiredBehaviors = ['Ignore the typed output kind.'];
  const decoy = Planner.buildAdapterRequest(proseDecoy, result, record, chain.surveyBatch);
  assert.equal(decoy.adapterRequestDigest, original.adapterRequestDigest);

  const future = clone(hand);
  future.proposedContract.outputKind = 'FUTURE_TYPED_FOUNDATION_EVIDENCE_CANDIDATE';
  const futureAssessment = Survey.assessHand(future, chain.inventory);
  assert.equal(futureAssessment.declaredCompatibilityWitnesses.length, 0);
  assert.equal(futureAssessment.declaredPartialCompatibilityWitnesses.length, 1);
  assert.equal(futureAssessment.declaredPartialCompatibilityWitnesses[0].requiredOutputKind, 'FUTURE_TYPED_FOUNDATION_EVIDENCE_CANDIDATE');
});

test('tampering, empty input, policy, contracts, hooks, and runtime boundaries are explicit', t => {
  const chain = makeChain(t, 'tamper');
  const first = Planner.run({ policy: POLICY, handBatch: chain.handBatch, surveyBatch: chain.surveyBatch, inventory: chain.inventory, stateDir: chain.dirs.stateDir });
  const file = path.join(first.runDir, 'batch.json');
  const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
  disk.summary.adaptersBuilt = 1;
  fs.writeFileSync(file, JSON.stringify(disk, null, 2) + '\n');
  assert.throws(() => Planner.run({ policy: POLICY, handBatch: chain.handBatch, surveyBatch: chain.surveyBatch, inventory: chain.inventory, stateDir: chain.dirs.stateDir }), /batch digest changed/);
  assert.equal(fs.existsSync(file), true);

  const completeEvidence = fixtureEvidence();
  completeEvidence.reasoning.negativeExperiences = 1;
  completeEvidence.independent = { exams: 1, fullPasses: 1, insufficientCoverage: 0, drift: 0, examDigests: ['4'.repeat(64)], independenceProven: false };
  const emptyChain = makeChain(t, 'empty', completeEvidence);
  const empty = Planner.buildBatch(emptyChain.handBatch, emptyChain.surveyBatch);
  assert.equal(empty.state, 'NO_EVIDENCE_HANDS_TO_ADAPT');
  assert.equal(empty.requests.length, 0);

  assert.throws(() => Planner.run({ policy: Object.assign({}, POLICY, { automaticFoundationDevelopmentCapabilityOutputAdapterPlanning: false }) }), /planning is not enabled/);
  const requestSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'foundation-development-capability-output-adapter-request.schema.json'), 'utf8'));
  const batchSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'foundation-development-capability-output-adapter-batch.schema.json'), 'utf8'));
  assert.equal(requestSchema.$id, Planner.REQUEST_SCHEMA);
  assert.equal(batchSchema.$id, Planner.BATCH_SCHEMA);
  assert.equal(require('../package.json').scripts['plan:foundation-development-capability-output-adapters'], 'node scripts/run-foundation-development-capability-output-adapters.js');
  const executor = fs.readFileSync(path.join(ROOT, 'scripts', 'run-foundation-development-observation-executor.js'), 'utf8');
  const workshop = fs.readFileSync(path.join(ROOT, 'scripts', 'run-workshop-steward-curriculum.js'), 'utf8');
  assert.match(executor, /foundation-development-capability-output-adapter-planner-organ/);
  assert.match(workshop, /foundation-development-capability-output-adapter-planner-organ/);
  const runtime = fs.readFileSync(path.join(ROOT, 'runtime', 'server.js'), 'utf8');
  assert.equal(runtime.includes('foundation-development-capability-output-adapter-planner-organ'), false);
});
