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
      cycleId: 'reasoning-skill-testfixture000000000', cycleSha256: 'b'.repeat(64), seamReportSha256: 'c'.repeat(64), seamOpen: 0,
      promotionState: 'PROPOSE_HUMAN_REVIEW', runtimePointerChanged: false,
      canaries: REASONING_CANARIES.map(id => ({ id, status: 'PASS', evidence: 'synthetic capability fixture' })),
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
  const base = fs.mkdtempSync(path.join(os.tmpdir(), `axm-foundation-capabilities-${label}-`));
  const dirs = {
    base,
    observatoryStateDir: path.join(base, 'observations'),
    requestStateDir: path.join(base, 'requests'),
    executorStateDir: path.join(base, 'executions'),
    frontierStateDir: path.join(base, 'frontier'),
    handStateDir: path.join(base, 'hands'),
    stateDir: path.join(base, 'surveys')
  };
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  return dirs;
}

function makeHandBatch(t, label, evidence) {
  const dirs = stateDirs(t, label);
  const execution = Executor.run(Object.assign({ policy: POLICY, evidence, allowSyntheticFixture: true }, dirs));
  const frontier = Router.run({ policy: POLICY, snapshot: execution.snapshot, receipt: execution.receipt, observatoryStateDir: dirs.observatoryStateDir, stateDir: dirs.frontierStateDir });
  const hands = HandPlanner.run({ policy: POLICY, frontierBatch: frontier.batch, stateDir: dirs.handStateDir });
  return { dirs, handBatch: hands.batch };
}

function inventoryRecord(declaration, label) {
  return {
    path: `test/${label}.capability.json`,
    bytes: JSON.stringify(declaration).length,
    sha256: digest(declaration),
    status: 'VERIFIED_DECLARATION',
    issue: null,
    declaration
  };
}

test('every hand is compared on family, input, output, and tokens without promoting partial witnesses', t => {
  const { dirs, handBatch } = makeHandBatch(t, 'current', fixtureEvidence());
  const inventory = Survey.collectInventory();
  const first = Survey.run({ policy: POLICY, handBatch, inventory, stateDir: dirs.stateDir });
  assert.equal(first.batch.summary.declarationsInventoried, 2);
  assert.equal(first.batch.summary.verifiedDeclarations, 2);
  assert.equal(first.batch.summary.declaredExactCompatibilityWitnesses, 0);
  assert.equal(first.batch.summary.declaredPartialCompatibilityWitnesses, 2);
  assert.equal(first.batch.summary.handsWithExactWitnesses, 0);
  assert.equal(first.batch.summary.handsWithPartialOnlyWitnesses, 2);
  assert.equal(first.batch.state, 'DECLARED_PARTIAL_COMPATIBILITY_WITNESSES_RECORDED');
  assert.equal(first.batch.summary.existingCapabilitiesSelected, 0);
  assert.equal(first.batch.summary.operationalFitsClaimed, 0);
  assert.equal(first.batch.summary.newOrgansRequired, 0);
  assert.ok(first.batch.results.every(item => item.assessments.length === inventory.length));
  assert.ok(first.batch.results.every(item => item.existingCapabilitySelected === false && item.operationalFit === 'UNTESTED' && item.newOrganNeed === 'UNASSESSED'));
  assert.ok(first.batch.results.every(item => item.declaredCompatibilityWitnesses.length === 0));
  assert.ok(first.batch.results.every(item => item.declaredPartialCompatibilityWitnesses.length === 1));
  assert.ok(first.batch.results.every(item => item.assessments.some(assessment => assessment.outputKindMatch === false)));
  const second = Survey.run({ policy: POLICY, handBatch, inventory, stateDir: dirs.stateDir });
  assert.equal(second.reused, true);
  assert.equal(second.batch.batchDigest, first.batch.batchDigest);
});

test('inventory order and multiple exact witnesses never select first or most frequent', t => {
  const { handBatch } = makeHandBatch(t, 'ambiguous', fixtureEvidence());
  const inventory = Survey.collectInventory();
  const externalHand = handBatch.hands.find(item => item.handFamily === 'PERMISSIONED_EXTERNAL_EVIDENCE_INTAKE_HAND');
  const externalBase = inventory.find(item => item.declaration.supportedHandFamilies.includes('PERMISSIONED_EXTERNAL_EVIDENCE_INTAKE_HAND')).declaration;
  const exactA = clone(externalBase);
  exactA.capabilityId = 'axm.mirror.declared-capability/first-exact-external-intake/v1';
  exactA.outputKinds = [externalHand.proposedContract.outputKind];
  exactA.declarationDigest = Survey.declarationDigest(exactA);
  Survey.validateDeclaration(exactA);
  const exactB = clone(exactA);
  exactB.capabilityId = 'axm.mirror.declared-capability/second-exact-external-intake/v1';
  exactB.declarationDigest = Survey.declarationDigest(exactB);
  Survey.validateDeclaration(exactB);
  const expanded = inventory.concat(inventoryRecord(exactA, 'first-exact-external'), inventoryRecord(exactB, 'second-exact-external'));
  const forward = Survey.buildBatch(handBatch, expanded);
  const reversed = Survey.buildBatch(handBatch, expanded.slice().reverse());
  assert.equal(forward.batchDigest, reversed.batchDigest);
  const result = forward.results.find(item => item.handFamily === 'PERMISSIONED_EXTERNAL_EVIDENCE_INTAKE_HAND');
  assert.equal(result.declaredCompatibilityWitnesses.length, 2);
  assert.equal(result.declaredPartialCompatibilityWitnesses.length, 1);
  assert.equal(result.existingCapabilitySelected, false);
  assert.equal(forward.summary.existingCapabilitiesSelected, 0);
});

test('stale declarations are refused and incomplete tokens cannot become a match', t => {
  const { handBatch } = makeHandBatch(t, 'refused', fixtureEvidence());
  const inventory = Survey.collectInventory();
  const stale = clone(inventory[0].declaration);
  stale.implementation.sourceFiles[0].sha256 = 'f'.repeat(64);
  stale.declarationDigest = Survey.declarationDigest(stale);
  assert.throws(() => Survey.validateDeclaration(stale), /source stale/);

  const partial = clone(inventory.find(item => item.declaration.supportedHandFamilies.includes('NON_INDUCING_LOCAL_EVENT_OBSERVATION_HAND')).declaration);
  partial.capabilityId = 'axm.mirror.declared-capability/partial-passive-observer/v1';
  partial.capabilityTokens = partial.capabilityTokens.filter(token => token !== 'NO_EVENT_INDUCTION');
  partial.declarationDigest = Survey.declarationDigest(partial);
  Survey.validateDeclaration(partial);
  const records = [
    { path: 'test/stale.capability.json', bytes: 1, sha256: '1'.repeat(64), status: 'REFUSED_DECLARATION', issue: 'source stale', declaration: stale },
    inventoryRecord(partial, 'partial')
  ];
  const batch = Survey.buildBatch(handBatch, records);
  assert.equal(batch.state, 'NO_DECLARED_COMPATIBILITY_WITNESSES');
  assert.equal(batch.summary.declaredCompatibilityWitnesses, 0);
  assert.equal(batch.summary.refusedDeclarations, 1);
  assert.equal(batch.summary.newOrgansRequired, 0);
  const passive = batch.results.find(item => item.handFamily === 'NON_INDUCING_LOCAL_EVENT_OBSERVATION_HAND');
  assert.ok(passive.assessments.find(item => item.capabilityId === partial.capabilityId).missingCapabilityTokens.includes('NO_EVENT_INDUCTION'));
});

test('committed survey tampering is refused without erasing the evidence', t => {
  const { dirs, handBatch } = makeHandBatch(t, 'tamper', fixtureEvidence());
  const inventory = Survey.collectInventory();
  const first = Survey.run({ policy: POLICY, handBatch, inventory, stateDir: dirs.stateDir });
  const file = path.join(first.runDir, 'batch.json');
  const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
  disk.summary.existingCapabilitiesSelected = 1;
  fs.writeFileSync(file, JSON.stringify(disk, null, 2) + '\n');
  assert.throws(() => Survey.run({ policy: POLICY, handBatch, inventory, stateDir: dirs.stateDir }), /batch digest changed/);
  assert.equal(fs.existsSync(file), true);
});

test('empty input, policy, contracts, command hooks, and runtime boundary remain explicit', t => {
  const evidence = fixtureEvidence();
  evidence.reasoning.negativeExperiences = 1;
  evidence.independent.fullPasses = 1;
  evidence.independent.exams = 1;
  evidence.independent.examDigests = ['4'.repeat(64)];
  const { handBatch } = makeHandBatch(t, 'empty', evidence);
  const empty = Survey.buildBatch(handBatch, Survey.collectInventory());
  assert.equal(empty.state, 'NO_EVIDENCE_HANDS_TO_SURVEY');
  assert.equal(empty.results.length, 0);
  assert.equal(empty.summary.existingCapabilitiesSelected, 0);

  const disabled = Object.assign({}, POLICY, { automaticFoundationDevelopmentCapabilitySurvey: false });
  assert.throws(() => Survey.run({ policy: disabled }), /survey is not enabled/);
  const declaration = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'foundation-development-capability-declaration-v2.schema.json'), 'utf8'));
  const batch = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'foundation-development-capability-survey-batch-v2.schema.json'), 'utf8'));
  assert.equal(declaration.$id, Survey.DECLARATION_SCHEMA);
  assert.equal(batch.$id, Survey.BATCH_SCHEMA);
  assert.equal(fs.existsSync(path.join(ROOT, 'scripts', 'run-foundation-development-capability-survey.js')), true);
  const executor = fs.readFileSync(path.join(ROOT, 'scripts', 'run-foundation-development-observation-executor.js'), 'utf8');
  const workshop = fs.readFileSync(path.join(ROOT, 'scripts', 'run-workshop-steward-curriculum.js'), 'utf8');
  assert.match(executor, /foundation-development-capability-survey-organ/);
  assert.match(workshop, /foundation-development-capability-survey-organ/);
  const runtime = fs.readFileSync(path.join(ROOT, 'runtime', 'server.js'), 'utf8');
  assert.equal(runtime.includes('foundation-development-capability-survey-organ'), false);
});
