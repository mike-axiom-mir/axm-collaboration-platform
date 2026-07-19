'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Metrology = require('../kernel/cognitive-work-metrology-cell');
const Calibration = require('../kernel/cognitive-resource-calibration-cell');
const MetrologyStewardship = require('../organs/cognitive-resource-stewardship-organ');
const CalibrationStewardship = require('../organs/cognitive-resource-calibration-stewardship-organ');

function sha(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function policy(calibrationEnabled = true) {
  return {
    schema: 'axm.mirror.training-policy/v1',
    cognitiveWorkObservationIntakeEnabled: true,
    cognitiveResourceCalibrationIntakeEnabled: calibrationEnabled,
    automaticRuntimePromotion: false,
    automaticCanonPromotion: false,
    automaticAuthorityGrowth: false
  };
}

function workDraft(index, options = {}) {
  const actualTokens = options.actualTokens ?? 1000 + index;
  const actualWall = options.actualWall ?? 2000 + index;
  return {
    schema: Metrology.DRAFT_SCHEMA,
    source: {
      sourceSystemId: 'calibration-test-meter/v1',
      sourceRecordId: `work-${index}`,
      sourceRecordDigest: sha(`work-source-${index}`),
      collectionMethod: 'DIRECT_MACHINE_METER',
      authorshipState: 'DECLARED_NOT_CERTIFIED',
      measurementDefinitionDigest: sha('calibration-test-measurement-v1')
    },
    objective: {
      objectiveKind: 'REPOSITORY_STEWARDSHIP',
      objectiveDigest: options.objectiveDigest || sha(`objective-${index}`),
      startingStateDigest: options.startingStateDigest || sha(`start-${index % 5}`),
      endingStateDigest: sha(`end-${index}`)
    },
    workShape: {
      operationKinds: ['AUDIT', 'EDIT', 'VERIFY'],
      domainKinds: ['SOFTWARE_RESEARCH'],
      requestedOutputKinds: ['TESTED_REPOSITORY_CHANGE'],
      riskTier: 'MEDIUM',
      requiredVerificationKinds: ['NODE_TEST', 'STRUCTURE_DOCTOR']
    },
    execution: {
      modelProfileDigest: sha('model-v1'),
      toolchainDigest: sha('toolchain-v1'),
      environmentDigest: sha('environment-v1'),
      hardwareProfileDigest: sha('hardware-v1'),
      tokenMeter: {
        definitionId: 'goal-total-tokens/v1', coverage: 'COMPLETE', inputTokens: 100, cachedInputTokens: 20,
        outputTokens: 200, reasoningTokens: 300, totalTokens: actualTokens
      },
      computeMeter: {
        definitionId: 'host-compute/v1', coverage: 'COMPLETE', cpuCoreMilliseconds: actualWall * 2,
        acceleratorMilliseconds: actualWall, peakMemoryBytes: 1000000 + index, providerComputeUnitsMicros: null
      },
      timing: { wallMilliseconds: actualWall, toolMilliseconds: 100 },
      workCounts: { filesExamined: 10, filesChanged: 2, linesAdded: 20, linesRemoved: 3, toolCalls: 4 },
      verification: { testsExecuted: 2, testsPassed: 2, testsFailed: 0, testsNotRun: 0, verificationDigest: sha(`verify-${index}`) }
    },
    outcome: { state: 'VERIFIED_COMPLETE', status: 'TEST', preexistingImplementationState: 'SUBSTANTIAL' },
    costObservation: { basis: 'UNKNOWN', profileDigest: null, currency: null, moneyMicros: null, energyMilliwattHours: null, carbonMilligrams: null },
    permission: { status: 'ALLOWED', basisDigest: sha('calibration-test-permission') }
  };
}

function supportedProfile() {
  const observations = Array.from({ length: 5 }, (_, index) => Metrology.sealObservation(workDraft(index)));
  const profile = Metrology.buildResourceProfile(observations, observations[0].comparisonKey);
  assert.equal(profile.state, 'DESCRIPTIVE_RESOURCE_PROFILE_NOT_A_CALIBRATED_FORECAST');
  return { observations, profile };
}

function predictionDraft(index, profile, target = {}, overrides = {}) {
  return {
    schema: Calibration.PREDICTION_DRAFT_SCHEMA,
    source: {
      sourceSystemId: overrides.sourceSystemId || 'mirror-local-prediction-ledger/v1',
      sourceRecordId: `prediction-source-${index}`,
      sourceRecordDigest: sha(`prediction-source-${index}`),
      collectionMethod: overrides.collectionMethod || 'DIRECT_MACHINE_SEAL',
      authorshipState: 'DECLARED_NOT_CERTIFIED',
      sequence: index,
      priorPredictionDigest: overrides.priorPredictionDigest ?? null
    },
    target: {
      objectiveKind: 'REPOSITORY_STEWARDSHIP',
      objectiveDigest: target.objectiveDigest || sha(`future-objective-${index}`),
      startingStateDigest: target.startingStateDigest || sha(`future-start-${index % 5}`),
      comparisonKey: profile.comparisonKey
    },
    method: {
      methodId: 'descriptive-range-human-review/v1',
      methodDigest: sha('descriptive-range-human-review-v1'),
      resourceProfileId: profile.profileId,
      resourceProfileDigest: profile.profileDigest,
      targetCoverageBasisPoints: 8000
    },
    intervals: {
      totalTokens: overrides.totalTokens || { lower: 900, upper: 1200 },
      wallMilliseconds: overrides.wallMilliseconds || { lower: 1900, upper: 2200 },
      cpuCoreMilliseconds: null,
      acceleratorMilliseconds: null,
      peakMemoryBytes: null,
      providerComputeUnitsMicros: null,
      moneyMicros: null,
      energyMilliwattHours: null,
      carbonMilligrams: null
    },
    costBinding: null,
    permission: { status: 'ALLOWED', basisDigest: sha('prediction-intake-permission') }
  };
}

test('prediction seal binds profile, source chain, target, local pre-outcome inventory, and zero authority', () => {
  const { observations, profile } = supportedProfile();
  const first = Calibration.sealPrediction(predictionDraft(0, profile), profile, { observations, predecessor: null });
  assert.equal(first.assessment.heldOutEvaluationEligible, true);
  assert.equal(first.localOrderEvidence.observationsPresentBeforeSeal, 5);
  assert.equal(first.localOrderEvidence.externalTimeCertified, false);
  assert.equal(first.method.targetCoverageBasisPoints, 8000);
  assert.ok(Object.values(first.authority).every(value => value === false));
  assert.equal(Calibration.verifyPrediction(first, profile, observations, null), true);

  const secondDraft = predictionDraft(1, profile, {}, { priorPredictionDigest: first.predictionDigest });
  const second = Calibration.sealPrediction(secondDraft, profile, { observations, predecessor: first });
  assert.equal(Calibration.verifyPrediction(second, profile, observations, first), true);

  const brokenChain = predictionDraft(1, profile, {}, { priorPredictionDigest: sha('wrong') });
  assert.throws(() => Calibration.sealPrediction(brokenChain, profile, { observations, predecessor: first }), /source chain changed/);
  const missingWall = predictionDraft(0, profile);
  missingWall.intervals.wallMilliseconds = null;
  assert.throws(() => Calibration.sealPrediction(missingWall, profile, { observations, predecessor: null }), /requires token and wall-time intervals/);
  const unsupportedCompute = predictionDraft(0, profile);
  unsupportedCompute.intervals.providerComputeUnitsMicros = { lower: 1, upper: 2 };
  assert.throws(() => Calibration.sealPrediction(unsupportedCompute, profile, { observations, predecessor: null }), /lacks profile support/);
  const unsupportedCost = predictionDraft(0, profile);
  unsupportedCost.intervals.moneyMicros = { lower: 1, upper: 2 };
  unsupportedCost.costBinding = { costProfileDigest: sha('unseen-cost-profile'), currency: 'EUR' };
  assert.throws(() => Calibration.sealPrediction(unsupportedCost, profile, { observations, predecessor: null }), /lacks profile support|cost profile is absent/);
});

test('a target whose outcome is already in the local observation inventory is refused', () => {
  const { observations, profile } = supportedProfile();
  const existing = observations[0];
  const draft = predictionDraft(0, profile, {
    objectiveDigest: existing.objective.objectiveDigest,
    startingStateDigest: existing.objective.startingStateDigest
  });
  assert.throws(() => Calibration.sealPrediction(draft, profile, { observations, predecessor: null }), /outcome already exists/);
});

test('coverage report preserves every hit, miss, pending outcome, and claim boundary', () => {
  const { observations: baseline, profile } = supportedProfile();
  const predictions = [];
  const outcomes = [];
  let predecessor = null;
  for (let index = 0; index < 21; index += 1) {
    const objectiveDigest = sha(`held-out-objective-${index}`);
    const startingStateDigest = sha(`held-out-start-${index % 5}`);
    const hit = index < 16;
    const draft = predictionDraft(index, profile, { objectiveDigest, startingStateDigest }, {
      priorPredictionDigest: predecessor ? predecessor.predictionDigest : null,
      totalTokens: { lower: 900, upper: 1200 },
      wallMilliseconds: { lower: 1900, upper: 2200 }
    });
    const prediction = Calibration.sealPrediction(draft, profile, { observations: baseline, predecessor });
    predictions.push(prediction);
    predecessor = prediction;
    if (index < 20) outcomes.push(Metrology.sealObservation(workDraft(100 + index, {
      objectiveDigest,
      startingStateDigest,
      actualTokens: hit ? 1000 : 1500,
      actualWall: 2000
    })));
  }
  const allObservations = baseline.concat(outcomes);
  for (let index = 0; index < predictions.length; index += 1) {
    Calibration.verifyPrediction(predictions[index], profile, allObservations, index === 0 ? null : predictions[index - 1]);
  }
  const report = Calibration.buildCalibrationReport(predictions, allObservations, predictions[0].calibrationKey);
  assert.equal(report.state, 'EMPIRICAL_LOCAL_ORDER_COVERAGE_NOT_INDEPENDENTLY_TIME_CERTIFIED');
  assert.equal(report.source.predictions, 21);
  assert.equal(report.source.evaluatedPredictions, 20);
  assert.equal(report.source.pendingPredictions, 1);
  assert.equal(report.coverage.overall.hits, 16);
  assert.equal(report.coverage.overall.misses, 4);
  assert.equal(report.coverage.overall.observedCoverageBasisPoints, 8000);
  assert.equal(report.coverage.metrics.totalTokens.observedCoverageBasisPoints, 8000);
  assert.equal(report.coverage.metrics.wallMilliseconds.observedCoverageBasisPoints, 10000);
  assert.equal(report.chronology.externalTimeCertified, false);
  assert.equal(report.calibrationClaim, null);
  assert.equal(report.accuracyClaim, null);
  assert.ok(Object.values(report.authority).every(value => value === false));
  assert.equal(Calibration.verifyCalibrationReport(report, predictions, allObservations), true);
});

test('small locally ordered samples remain an explicit insufficient-evidence hold', () => {
  const { observations, profile } = supportedProfile();
  const prediction = Calibration.sealPrediction(predictionDraft(0, profile), profile, { observations, predecessor: null });
  const report = Calibration.buildCalibrationReport([prediction], observations, prediction.calibrationKey);
  assert.equal(report.state, 'HOLD_INSUFFICIENT_EVALUATED_PREDICTIONS');
  assert.equal(report.source.pendingPredictions, 1);
  assert.equal(report.coverage.overall.observedCoverageBasisPoints, null);
});

test('method, target coverage, metric shape, and cost shape remain calibration cohort boundaries', () => {
  const { observations, profile } = supportedProfile();
  const base = Calibration.sealPrediction(predictionDraft(0, profile), profile, { observations, predecessor: null });
  const coverageDraft = predictionDraft(0, profile);
  coverageDraft.method.targetCoverageBasisPoints = 9000;
  const coverageChanged = Calibration.sealPrediction(coverageDraft, profile, { observations, predecessor: null });
  const methodDraft = predictionDraft(0, profile);
  methodDraft.method.methodDigest = sha('different-method');
  const methodChanged = Calibration.sealPrediction(methodDraft, profile, { observations, predecessor: null });
  const shapeDraft = predictionDraft(0, profile);
  shapeDraft.intervals.cpuCoreMilliseconds = { lower: 1, upper: 100000 };
  const shapeChanged = Calibration.sealPrediction(shapeDraft, profile, { observations, predecessor: null });
  assert.notEqual(coverageChanged.calibrationKey, base.calibrationKey);
  assert.notEqual(methodChanged.calibrationKey, base.calibrationKey);
  assert.notEqual(shapeChanged.calibrationKey, base.calibrationKey);
});

test('private calibration stewardship is policy-gated, append-only, and detects disk tampering', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-calibration-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const observationStateDir = path.join(root, 'observations');
  const profileStateDir = path.join(root, 'profiles');
  const predictionStateDir = path.join(root, 'predictions');
  const reportStateDir = path.join(root, 'reports');
  let comparisonKey = null;
  for (let index = 0; index < 5; index += 1) {
    const result = MetrologyStewardship.intake(workDraft(index), { policy: policy(), observationStateDir });
    comparisonKey = result.observation.comparisonKey;
  }
  const profile = MetrologyStewardship.profile(comparisonKey, { policy: policy(), observationStateDir, profileStateDir }).profile;
  const options = { policy: policy(), observationStateDir, profileStateDir, predictionStateDir, reportStateDir };
  assert.throws(() => CalibrationStewardship.sealPrediction(predictionDraft(0, profile), Object.assign({}, options, { policy: policy(false) })), /not enabled/);
  const first = CalibrationStewardship.sealPrediction(predictionDraft(0, profile), options);
  const secondDraft = predictionDraft(1, profile, {}, { priorPredictionDigest: first.prediction.predictionDigest, totalTokens: { lower: 1, upper: 10 } });
  const chained = CalibrationStewardship.sealPrediction(secondDraft, options);
  const second = CalibrationStewardship.sealPrediction(predictionDraft(0, profile), options);
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(CalibrationStewardship.loadPredictions(options).length, 2);
  MetrologyStewardship.intake(workDraft(99, {
    objectiveDigest: first.prediction.target.objectiveDigest,
    startingStateDigest: first.prediction.target.startingStateDigest,
    actualTokens: 1000,
    actualWall: 2000
  }), { policy: policy(), observationStateDir });
  MetrologyStewardship.intake(workDraft(100, {
    objectiveDigest: chained.prediction.target.objectiveDigest,
    startingStateDigest: chained.prediction.target.startingStateDigest,
    actualTokens: 1000,
    actualWall: 2000
  }), { policy: policy(), observationStateDir });
  assert.equal(CalibrationStewardship.loadPredictions(options).length, 2);
  const reported = CalibrationStewardship.report(first.prediction.calibrationKey, options);
  assert.equal(reported.report.source.predictions, 2);
  assert.equal(reported.report.source.evaluatedPredictions, 2);
  assert.equal(reported.report.source.pendingPredictions, 0);
  assert.equal(reported.report.coverage.overall.hits, 1);
  assert.equal(reported.report.coverage.overall.misses, 1);
  assert.ok(fs.existsSync(path.join(reported.runDir, 'report.json')));

  const file = path.join(first.runDir, 'prediction.json');
  const changed = JSON.parse(fs.readFileSync(file, 'utf8'));
  changed.intervals.totalTokens.upper += 1;
  fs.writeFileSync(file, JSON.stringify(changed));
  assert.throws(() => CalibrationStewardship.loadPredictions(options), /content changed|digest changed/);
});

test('contracts, commands, policy, and runtime separation remain explicit', () => {
  const root = path.resolve(__dirname, '..');
  for (const name of ['cognitive-resource-prediction-draft.schema.json', 'cognitive-resource-prediction.schema.json', 'cognitive-resource-calibration-report.schema.json']) {
    const schema = JSON.parse(fs.readFileSync(path.join(root, 'contracts', name), 'utf8'));
    assert.equal(schema.additionalProperties, false);
  }
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts['seal:cognitive-resource-prediction'], 'node scripts/seal-cognitive-resource-prediction.js');
  assert.equal(packageJson.scripts['evaluate:cognitive-resource-calibration'], 'node scripts/evaluate-cognitive-resource-calibration.js');
  const runtime = fs.readFileSync(path.join(root, 'runtime', 'server.js'), 'utf8');
  assert.doesNotMatch(runtime, /cognitive-resource-calibration/);
  const repositoryPolicy = JSON.parse(fs.readFileSync(path.join(root, 'training', 'TRAINING_POLICY.json'), 'utf8'));
  assert.equal(repositoryPolicy.cognitiveResourceCalibrationIntakeEnabled, true);
  assert.match(repositoryPolicy.cognitiveResourceCalibrationIntakeScope, /no-calibrated-forecast-claim/);
  const bom = JSON.parse(fs.readFileSync(path.join(root, 'MODEL_BOM.json'), 'utf8'));
  const entry = bom.deterministicEvaluationOrgans.find(item => item.path === 'organs/cognitive-resource-calibration-stewardship-organ.js');
  assert.equal(entry.localOrderCoverageImplemented, true);
  assert.equal(entry.externalTimeCertificationImplemented, false);
  assert.equal(entry.calibratedForecastImplemented, false);
  assert.equal(entry.modelSelectionAuthority, false);
  const status = JSON.parse(fs.readFileSync(path.join(root, 'STATUS.json'), 'utf8'));
  assert.match(status.cognitiveResourceCalibrationStewardshipOrgan, /EXTERNAL_TIME_AND_INDEPENDENCE_UNCERTIFIED/);
  assert.equal(status.cognitiveResourceCalibrationStewardshipEvidence.realPredictionsWritten, 0);
  assert.equal(status.cognitiveResourceCalibrationStewardshipEvidence.calibrationClaim, null);
  const integrity = require('../kernel/foundation-public-body-integrity-cell').inspect(root);
  assert.ok(integrity.coverage.javascriptSyntaxChecked.includes('kernel/cognitive-resource-calibration-cell.js'));
  assert.ok(integrity.coverage.jsonParsed.includes('contracts/cognitive-resource-calibration-report.schema.json'));
  assert.ok(integrity.coverage.javascriptSyntaxChecked.includes('scripts/evaluate-cognitive-resource-calibration.js'));
});
