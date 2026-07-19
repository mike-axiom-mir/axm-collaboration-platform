'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Cell = require('../kernel/workshop-transfer-regression-exam-cell');
const ExamOrgan = require('../organs/workshop-transfer-regression-exam-organ');
const ContractCurriculum = require('../organs/reasoning-contract-curriculum-organ');
const Observatory = require('../organs/foundation-development-observatory-organ');

function moduleIdFor(partition, prefix) {
  for (let index = 0; index < 1000; index += 1) {
    const id = `${prefix}-${index}`;
    if (ContractCurriculum.partitionFor(id) === partition) return id;
  }
  throw new Error(`unable to find ${partition} fixture module id`);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function makeWorkshop(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-workshop-transfer-exam-'));
  const producer = moduleIdFor('PRIVATE_TRAINING', 'producer');
  const consumer = moduleIdFor('HELD_OUT_EVALUATION', 'consumer');
  const decoy = moduleIdFor('PRIVATE_TRAINING', 'decoy');
  const type = 'axm.fixture/payload-v1';
  for (const [id, emits, accepts] of [[producer, [type], []], [consumer, [], options.noRoute ? [] : [type]], [decoy, [], []]]) {
    const directory = path.join(root, 'tools', id);
    writeJson(path.join(directory, 'module.contract.json'), {
      schema: 'axm.module-contract/v1',
      id,
      version: '1.0.0',
      permissions: [],
      boundaries: { refuses: [`${id}-forbidden-write`] },
      handoffs: { emits, accepts }
    });
    writeJson(path.join(directory, 'manifest.json'), {
      schema: 'axm.ai-native-module/v1',
      id,
      version: '1.0.0',
      entry: 'index.js',
      contract: 'module.contract.json',
      uses: []
    });
    fs.writeFileSync(path.join(directory, 'index.js'), `'use strict'; module.exports = { id: ${JSON.stringify(id)} };\n`, 'utf8');
  }
  fs.mkdirSync(path.join(root, 'shared'), { recursive: true });
  fs.writeFileSync(path.join(root, 'shared', 'poison.js'), `'use strict'; global.__AXM_WORKSHOP_TRANSFER_POISON_EXECUTED__ = true;\n`, 'utf8');
  writeJson(path.join(root, 'shared', 'registry.json'), { schema: 'axm.fixture.registry/v1', modules: [producer, consumer, decoy] });
  return { root, producer, consumer, decoy };
}

function binding(overrides = {}) {
  return Object.assign({
    dimensionId: 'DISCOVERY_TRANSFER_ACROSS_WORKSHOP_GROWTH',
    observedState: 'REGRESSION_REQUIRES_REVIEW',
    handBatchId: 'foundation-development-hands-' + '1'.repeat(24),
    handBatchDigest: '2'.repeat(64),
    handRequestId: 'foundation-evidence-hand-' + '3'.repeat(24),
    handRequestDigest: '4'.repeat(64),
    frontierBatchId: 'foundation-development-frontier-' + '5'.repeat(24),
    frontierBatchDigest: '6'.repeat(64),
    frontierRequestId: 'foundation-frontier-request-' + '7'.repeat(24),
    frontierRequestDigest: '8'.repeat(64),
    snapshotId: 'foundation-development-' + '9'.repeat(24),
    snapshotDigest: 'a'.repeat(64),
    executionId: 'foundation-observation-execution-' + 'b'.repeat(24),
    executionReceiptDigest: 'c'.repeat(64),
    deltas: { comparedPriorSnapshotIds: [], evidenceSectionsChanged: ['workshop'], sourceFilePathsChanged: [] },
    evidenceNeed: {
      evidenceKind: 'BOUND_INDEPENDENT_REGRESSION_EXAM',
      acquisitionMode: 'INDEPENDENT_BOUNDED_EXAM',
      sourceConstraint: 'Bind exact changed source.',
      independentFromCandidate: true,
      permissionRequired: true,
      eventInductionAllowed: false,
      candidateMayAuthorExpectedResult: false,
      acceptanceEvidence: ['bound evidence']
    },
    candidateRepair: null,
    causeHypothesis: 'Source drift may have changed relational behavior.'
  }, overrides);
}

function settledAudit() {
  return {
    schema: 'axm.mirror.settled-workshop-growth-audit/v1',
    status: 'TEST_LIVE_SETTLED_WORKSHOP_GROWTH_PASSED',
    observedAt: '2026-07-18T00:00:00.000Z',
    workshop: {
      javascriptFiles: 0, javascriptBytes: 0, javascriptDigest: 'd'.repeat(64),
      sharedJavascriptFiles: 0, sharedJavascriptBytes: 0, sharedJavascriptDigest: 'e'.repeat(64),
      sharedJsonFiles: 0, sharedJsonBytes: 0, sharedJsonDigest: 'f'.repeat(64)
    }
  };
}

test('read-only Workshop transfer revalidation separates source drift from preserved bounded behavior', () => {
  const fixture = makeWorkshop();
  delete global.__AXM_WORKSHOP_TRANSFER_POISON_EXECUTED__;
  const result = Cell.examine({ workshopRoot: fixture.root, regressionBinding: binding(), settledAudit: settledAudit() });
  assert.equal(Cell.verify(result), true);
  assert.equal(result.state, Cell.PASS_STATE);
  assert.equal(result.source.baselineSourceTopologyChanged, true);
  assert.equal(result.source.stableDuringExam, true);
  assert.equal(result.causeClassification, 'SOURCE_TOPOLOGY_DRIFT_WITH_BOUNDED_RELATIONAL_BEHAVIOR_PRESERVED');
  assert.equal(result.contractBoundaryCanaries.eligibleContracts, 3);
  assert.equal(result.contractBoundaryCanaries.heldOutContracts, 1);
  assert.equal(result.contractBoundaryCanaries.behaviorMismatches, 0);
  assert.equal(result.handoffRouteCanaries.exactRoutes, 1);
  assert.equal(result.handoffRouteCanaries.behaviorMismatches, 0);
  assert.equal(result.summary.authoritySeams, 0);
  assert.equal(result.summary.trainingAdmissions, 0);
  assert.equal(result.summary.repairsSelected, 0);
  assert.equal(result.summary.workshopJavascriptExecuted, 0);
  assert.equal(global.__AXM_WORKSHOP_TRANSFER_POISON_EXECUTED__, undefined);
});

test('missing relational route coverage remains an honest hold', () => {
  const fixture = makeWorkshop({ noRoute: true });
  const result = Cell.examine({ workshopRoot: fixture.root, regressionBinding: binding(), settledAudit: settledAudit() });
  assert.equal(Cell.verify(result), true);
  assert.equal(result.state, Cell.HOLD_STATE);
  assert.equal(result.handoffRouteCanaries.exactRoutes, 0);
  assert.ok(result.summary.failedChecks.includes('exact-route-coverage'));
  assert.equal(result.claimCeiling, 'NO_BEHAVIOR_PRESERVATION_CLAIM');
});

test('result tampering and false pass promotion are refused', () => {
  const fixture = makeWorkshop();
  const result = Cell.examine({ workshopRoot: fixture.root, regressionBinding: binding(), settledAudit: settledAudit() });
  const tampered = JSON.parse(JSON.stringify(result));
  tampered.summary.repairsSelected = 1;
  assert.throws(() => Cell.verify(tampered), /digest changed/);
  const falsePass = JSON.parse(JSON.stringify(result));
  falsePass.checks[0].pass = false;
  falsePass.resultDigest = Cell.digest(Object.assign({}, falsePass, { resultDigest: null }));
  assert.throws(() => Cell.verify(falsePass), /pass is not supported/);
});

test('regression binding comes only from the exact typed hand and frontier request', () => {
  const request = {
    requestId: 'foundation-frontier-request-' + '1'.repeat(24),
    requestDigest: '2'.repeat(64),
    dimensionId: 'DISCOVERY_TRANSFER_ACROSS_WORKSHOP_GROWTH',
    observedState: 'REGRESSION_REQUIRES_REVIEW',
    classification: 'REGRESSION_INVESTIGATION_REQUEST',
    deltas: { comparedPriorSnapshotIds: ['prior'], evidenceSectionsChanged: ['workshop'], sourceFilePathsChanged: ['one.js'] },
    observation: {
      snapshotId: 'foundation-development-' + '3'.repeat(24), snapshotDigest: '4'.repeat(64),
      executionId: 'foundation-observation-execution-' + '5'.repeat(24), executionReceiptDigest: '6'.repeat(64)
    }
  };
  const hand = {
    handFamily: 'INDEPENDENT_REGRESSION_EXAM_HAND',
    handRequestId: 'foundation-evidence-hand-' + '7'.repeat(24),
    handRequestDigest: '8'.repeat(64),
    evidenceNeed: binding().evidenceNeed,
    source: { dimensionId: request.dimensionId, frontierRequestId: request.requestId, frontierRequestDigest: request.requestDigest }
  };
  const loaded = {
    frontierBatch: { batchId: 'foundation-development-frontier-' + '9'.repeat(24), batchDigest: 'a'.repeat(64), requests: [request] },
    handBatch: { batchId: 'foundation-development-hands-' + 'b'.repeat(24), batchDigest: 'c'.repeat(64), hands: [hand] }
  };
  const selected = ExamOrgan.selectRegressionBinding(loaded);
  assert.equal(selected.snapshotDigest, request.observation.snapshotDigest);
  assert.deepEqual(selected.deltas, request.deltas);
  loaded.frontierBatch.requests[0].requestDigest = 'd'.repeat(64);
  assert.throws(() => ExamOrgan.selectRegressionBinding(loaded), /no longer binds/);
});

test('content-addressed exam is reusable and only matches the exact current Workshop and examiner lineage', () => {
  const fixture = makeWorkshop();
  const audit = settledAudit();
  const auditBytes = Buffer.from(JSON.stringify(audit, null, 2) + '\n');
  const result = Cell.examine({ workshopRoot: fixture.root, regressionBinding: binding(), settledAudit: audit });
  const exam = ExamOrgan.buildExam(result, binding(), audit, auditBytes);
  assert.equal(ExamOrgan.verifyExam(exam, null, { verifyCurrentLineage: true }), true);
  assert.equal(exam.expectedResultAuthorship.outsideAuthorshipClaimed, false);
  assert.equal(exam.expectedResultAuthorship.humanAcceptedAsCanon, false);
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-workshop-transfer-exam-state-'));
  const first = ExamOrgan.storeExam(exam, stateDir);
  const repeated = ExamOrgan.storeExam(exam, stateDir);
  assert.equal(first.reused, false);
  assert.equal(repeated.reused, true);
  const auditPath = path.join(stateDir, 'settled-audit.json');
  fs.writeFileSync(auditPath, auditBytes);
  const matching = ExamOrgan.loadMatchingExam({ workshopRoot: fixture.root, stateDir, auditPath });
  assert.equal(matching.state, 'MATCHING_BOUND_WORKSHOP_TRANSFER_EXAM');
  assert.equal(matching.exam.examDigest, exam.examDigest);
  fs.appendFileSync(path.join(fixture.root, 'shared', 'poison.js'), '// source drift\n');
  const drifted = ExamOrgan.loadMatchingExam({ workshopRoot: fixture.root, stateDir, auditPath });
  assert.equal(drifted.state, 'NO_MATCHING_WORKSHOP_TRANSFER_EXAM');
});

test('Foundation admits only a fresh closed-authority bounded revalidation, not an independence claim', () => {
  const canaryIds = [
    'source-family-isolation', 'held-out-frozen', 'model-authority-closed', 'challenger-session-authority-closed',
    'independent-reasoning-seams-clean', 'adversarial-transfer', 'candidate-origination-transfer',
    'candidate-origin-authority-closed', 'ordered-strategy-composition', 'underspecified-candidate-origin-holds',
    'experience-self-training-closed', 'experience-remains-episodic', 'synthetic-counterexample-lineage', 'known-failed-experience-excluded'
  ];
  const evidence = {
    subject: { digest: 'a'.repeat(64) },
    bodyIntegrity: { state: 'HOLD', summary: { holds: 1, sourceExecutions: 0, activeOrgansChecked: 0, activeOrgansWithTestReachability: 0 }, source: { inventoryDigest: 'a'.repeat(64) } },
    foundationCanaries: Observatory.runFrozenFoundationCanaries(),
    reasoning: { canaries: canaryIds.map(id => ({ id, status: 'PASS' })), negativeExperiences: 0 },
    workshop: {
      sourceInventoryStillSettled: false,
      currentTransferSourceDigest: 'b'.repeat(64),
      boundaryMismatches: 0, heldOutFailed: 0, splitLeakage: false, routeSelectionMismatches: 0,
      workShopFilesChanged: 0, runtimePointerChanged: false, worldActions: 0,
      revalidation: {
        state: 'MATCHING_BOUND_WORKSHOP_TRANSFER_EXAM',
        examState: Cell.PASS_STATE,
        examDigest: 'c'.repeat(64), resultDigest: 'd'.repeat(64), sourceInventoryDigest: 'b'.repeat(64), sourceStableDuringExam: true,
        eligibleContracts: 3, contractBehaviorMismatches: 0, manifestBoundContracts: 3, exactRoutes: 1, routeBehaviorMismatches: 0,
        authoritySeams: 0, workshopJavascriptExecuted: 0, workshopModulesInvoked: 0, trainingAdmissions: 0, repairsSelected: 0, worldActions: 0,
        outsideAuthorshipClaimed: false, humanAcceptedAsCanon: false
      }
    },
    language: { accepted: 0, realLocalGroups: 0, fallback: 0, planContradictions: 0, proseDecoyFailures: 0, proseDecoyPasses: 0, runtimeActive: false },
    independent: { drift: 0, fullPasses: 0, examDigests: [] }
  };
  const dimension = Observatory.dimensions(evidence).find(item => item.id === 'DISCOVERY_TRANSFER_ACROSS_WORKSHOP_GROWTH');
  assert.equal(dimension.state, 'OBSERVED_PASS');
  assert.match(dimension.statement, /Mirror-authored read-only revalidation/);
  evidence.workshop.revalidation.outsideAuthorshipClaimed = true;
  const refused = Observatory.dimensions(evidence).find(item => item.id === 'DISCOVERY_TRANSFER_ACROSS_WORKSHOP_GROWTH');
  assert.equal(refused.state, 'REGRESSION_REQUIRES_REVIEW');
});

test('policy, contracts, command, automatic hook, and active-runtime separation are explicit', () => {
  const policy = ExamOrgan.loadPolicy();
  assert.equal(policy.automaticWorkshopTransferRegressionRevalidation, true);
  assert.match(policy.workshopTransferRegressionRevalidationScope, /read-only-current-source-no-workshop-code-execution-no-training-no-repair/);
  for (const relative of [
    'contracts/workshop-transfer-regression-exam-result.schema.json',
    'contracts/workshop-transfer-regression-exam.schema.json',
    'scripts/run-workshop-transfer-regression-exam.js'
  ]) assert.equal(fs.existsSync(path.resolve(__dirname, '..', relative)), true);
  const hook = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'run-workshop-steward-curriculum.js'), 'utf8');
  assert.match(hook, /WorkshopTransferRegressionExam\.run\(\)/);
  const runtimeFiles = ['runtime/server.js', 'runtime/api.js'].filter(relative => fs.existsSync(path.resolve(__dirname, '..', relative)));
  for (const relative of runtimeFiles) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8');
    assert.doesNotMatch(source, /workshop-transfer-regression-exam/);
  }
});
