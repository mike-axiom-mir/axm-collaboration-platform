'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Metrology = require('../kernel/cognitive-work-metrology-cell');
const Stewardship = require('../organs/cognitive-resource-stewardship-organ');

function sha(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function policy(enabled = true) {
  return {
    schema: 'axm.mirror.training-policy/v1',
    cognitiveWorkObservationIntakeEnabled: enabled,
    automaticRuntimePromotion: false,
    automaticCanonPromotion: false,
    automaticAuthorityGrowth: false
  };
}

function draft(index = 0, overrides = {}) {
  const outcomeState = overrides.outcomeState || 'VERIFIED_COMPLETE';
  const failed = outcomeState === 'KNOWN_FAIL' ? 1 : 0;
  const costBasis = overrides.costBasis || 'UNKNOWN';
  return {
    schema: Metrology.DRAFT_SCHEMA,
    source: {
      sourceSystemId: 'codex.goal-meter/v1',
      sourceRecordId: `goal-record-${index}`,
      sourceRecordDigest: sha(`source-${index}`),
      collectionMethod: overrides.collectionMethod || 'DIRECT_MACHINE_METER',
      authorshipState: 'DECLARED_NOT_CERTIFIED',
      measurementDefinitionDigest: sha('meter-definition-v1')
    },
    objective: {
      objectiveKind: 'REPOSITORY_STEWARDSHIP',
      objectiveDigest: sha(`objective-${index}`),
      startingStateDigest: sha(`start-${overrides.startGroup ?? index}`),
      endingStateDigest: sha(`end-${index}`)
    },
    workShape: {
      operationKinds: ['VERIFY', 'EDIT', 'AUDIT'],
      domainKinds: ['SOFTWARE_RESEARCH'],
      requestedOutputKinds: ['TESTED_REPOSITORY_CHANGE'],
      riskTier: 'MEDIUM',
      requiredVerificationKinds: ['NODE_TEST', 'STRUCTURE_DOCTOR']
    },
    execution: {
      modelProfileDigest: sha('model-profile-v1'),
      toolchainDigest: sha('toolchain-v1'),
      environmentDigest: sha('environment-v1'),
      hardwareProfileDigest: overrides.hardwareProfileDigest || sha('hardware-v1'),
      tokenMeter: {
        definitionId: 'codex.goal-total-tokens/v1',
        coverage: 'COMPLETE',
        inputTokens: 10 + index,
        cachedInputTokens: 2,
        outputTokens: 20 + index,
        reasoningTokens: 30 + index,
        totalTokens: 100 * (index + 1)
      },
      computeMeter: {
        definitionId: 'host.compute-meter/v1',
        coverage: 'COMPLETE',
        cpuCoreMilliseconds: 1000 * (index + 1),
        acceleratorMilliseconds: 200 * (index + 1),
        peakMemoryBytes: 1000000 * (index + 1),
        providerComputeUnitsMicros: null
      },
      timing: { wallMilliseconds: 1000 * (index + 1), toolMilliseconds: 100 * index },
      workCounts: { filesExamined: 10, filesChanged: 2, linesAdded: 20, linesRemoved: 3, toolCalls: 4 },
      verification: {
        testsExecuted: 1,
        testsPassed: failed ? 0 : 1,
        testsFailed: failed,
        testsNotRun: 0,
        verificationDigest: sha(`verification-${index}`)
      }
    },
    outcome: {
      state: outcomeState,
      status: failed ? 'KNOWN_FAIL' : 'TEST',
      preexistingImplementationState: overrides.preexistingImplementationState || 'SUBSTANTIAL'
    },
    costObservation: {
      basis: costBasis,
      profileDigest: costBasis === 'UNKNOWN' ? null : sha(`cost-profile-${overrides.costProfileGroup || 'a'}`),
      currency: costBasis === 'UNKNOWN' ? null : 'EUR',
      moneyMicros: costBasis === 'UNKNOWN' ? null : overrides.moneyMicros ?? 100 * (index + 1),
      energyMilliwattHours: costBasis === 'UNKNOWN' ? null : 10 * (index + 1),
      carbonMilligrams: costBasis === 'UNKNOWN' ? null : 5 * (index + 1)
    },
    permission: { status: 'ALLOWED', basisDigest: sha('mike-explicit-cognitive-metrology-permission') }
  };
}

test('cognitive-work observations normalize order, seal deterministically, detach mutation, and carry no authority', () => {
  const input = draft(0);
  const first = Metrology.sealObservation(input);
  input.workShape.operationKinds[0] = 'CORRUPT_AFTER_SEAL';
  const second = Metrology.sealObservation(draft(0));
  assert.deepEqual(first, second);
  assert.deepEqual(first.workShape.operationKinds, ['AUDIT', 'EDIT', 'VERIFY']);
  assert.equal(first.assessment.resourceProfileEligible, true);
  assert.equal(first.assessment.forecastCalibration, 'NOT_EVALUATED');
  assert.ok(Object.values(first.authority).every(value => value === false));
  assert.equal(Metrology.verifyObservation(first), true);
});

test('a self-digested forged assessment still fails reconstruction verification', () => {
  const forged = JSON.parse(JSON.stringify(Metrology.sealObservation(draft(0))));
  forged.assessment.issues = ['FORGED'];
  forged.assessment.resourceProfileEligible = false;
  forged.observationId = `cognitive-work-observation-${Metrology.digest(Object.assign({}, forged, { observationId: null, observationDigest: null })).slice(0, 24)}`;
  forged.observationDigest = Metrology.digest(Object.assign({}, forged, { observationDigest: null }));
  assert.throws(() => Metrology.verifyObservation(forged), /content changed/);
});

test('the reported 328,993-token run shape remains an incomplete observation hold, not a forecast basis', () => {
  const reported = draft(0, { collectionMethod: 'IMPORTED_ATTESTATION' });
  reported.source.sourceRecordDigest = null;
  reported.source.measurementDefinitionDigest = null;
  reported.objective.startingStateDigest = null;
  reported.objective.endingStateDigest = null;
  reported.execution.modelProfileDigest = null;
  reported.execution.toolchainDigest = null;
  reported.execution.environmentDigest = null;
  reported.execution.hardwareProfileDigest = null;
  reported.execution.tokenMeter.totalTokens = 328993;
  reported.execution.computeMeter = {
    definitionId: null,
    coverage: 'UNKNOWN',
    cpuCoreMilliseconds: null,
    acceleratorMilliseconds: null,
    peakMemoryBytes: null,
    providerComputeUnitsMicros: null
  };
  reported.execution.timing.wallMilliseconds = 1226000;
  reported.execution.verification.verificationDigest = null;
  reported.outcome = { state: 'HOLD', status: 'NEEDS_REVIEW', preexistingImplementationState: 'SUBSTANTIAL' };
  const observation = Metrology.sealObservation(reported);
  assert.equal(observation.assessment.resourceProfileEligible, false);
  assert.ok(observation.assessment.issues.includes('SOURCE_NOT_DIRECT_MACHINE_METER'));
  assert.ok(observation.assessment.issues.includes('STARTING_STATE_DIGEST_MISSING'));
  assert.ok(observation.assessment.issues.includes('COMPUTE_METER_NOT_COMPLETE'));
  const profile = Metrology.buildResourceProfile([observation], observation.comparisonKey);
  assert.equal(profile.state, 'HOLD_INSUFFICIENT_COMPARABLE_OBSERVATIONS');
  assert.equal(profile.source.eligibleObservations, 0);
  assert.equal(profile.resources.allEligibleTotalTokens, null);
  assert.equal(profile.calibration.accuracyClaim, null);
  assert.equal(profile.authority.forecastClaim, false);
});

test('five exact-cohort observations across three starts form description only and preserve failures', () => {
  const observations = [
    Metrology.sealObservation(draft(0, { startGroup: 0, costBasis: 'MEASURED', moneyMicros: 100 })),
    Metrology.sealObservation(draft(1, { startGroup: 1, costBasis: 'PROFILE_ESTIMATED', moneyMicros: 1 })),
    Metrology.sealObservation(draft(2, { startGroup: 2, costBasis: 'BILLED', moneyMicros: 300 })),
    Metrology.sealObservation(draft(3, { startGroup: 0, outcomeState: 'KNOWN_FAIL' })),
    Metrology.sealObservation(draft(4, { startGroup: 1, outcomeState: 'HOLD' }))
  ];
  const comparisonKey = observations[0].comparisonKey;
  assert.ok(observations.every(item => item.comparisonKey === comparisonKey));
  const mismatch = Metrology.sealObservation(draft(5, { hardwareProfileDigest: sha('hardware-v2') }));
  const profile = Metrology.buildResourceProfile(observations.concat(mismatch), comparisonKey);
  assert.equal(profile.state, 'DESCRIPTIVE_RESOURCE_PROFILE_NOT_A_CALIBRATED_FORECAST');
  assert.equal(profile.source.matchedObservations, 5);
  assert.equal(profile.source.eligibleObservations, 5);
  assert.equal(profile.source.distinctStartingStates, 3);
  assert.equal(profile.outcomes.knownFail, 1);
  assert.equal(profile.outcomes.hold, 1);
  assert.deepEqual(profile.resources.allEligibleTotalTokens, { minimum: 100, median: 300, maximum: 500, observations: 5 });
  assert.deepEqual(profile.resources.allEligibleCpuCoreMilliseconds, { minimum: 1000, median: 3000, maximum: 5000, observations: 5 });
  assert.deepEqual(profile.resources.allEligibleAcceleratorMilliseconds, { minimum: 200, median: 600, maximum: 1000, observations: 5 });
  assert.deepEqual(profile.resources.directlyObservedMoneyMicros, {
    currency: 'EUR',
    range: { minimum: 100, median: 100, maximum: 300, observations: 2 }
  });
  assert.equal(profile.resources.directCostAggregationState, 'EXACT_PROFILE_DIRECT_COST_DESCRIPTION');
  assert.equal(profile.resources.directCostProfileDigests.length, 1);
  assert.equal(profile.calibration.state, 'INDEPENDENT_PRE_OUTCOME_CALIBRATION_REQUIRED');
  assert.equal(profile.calibration.targetCoverage, null);
  assert.equal(profile.calibration.heldOutPredictions, 0);
  assert.equal(profile.calibration.accuracyClaim, null);
  assert.ok(Object.values(profile.authority).every(value => value === false));
  assert.equal(Metrology.verifyResourceProfile(profile, observations.concat(mismatch)), true);
});

test('different direct cost profiles remain separate instead of producing a false money or energy range', () => {
  const first = Metrology.sealObservation(draft(0, { costBasis: 'MEASURED', moneyMicros: 100, costProfileGroup: 'a' }));
  const second = Metrology.sealObservation(draft(1, { costBasis: 'BILLED', moneyMicros: 200, costProfileGroup: 'b' }));
  const profile = Metrology.buildResourceProfile([first, second], first.comparisonKey);
  assert.equal(profile.resources.directCostAggregationState, 'HOLD_MULTIPLE_COST_PROFILES');
  assert.equal(profile.resources.directCostProfileDigests.length, 2);
  assert.equal(profile.resources.directlyObservedMoneyMicros, null);
  assert.equal(profile.resources.directlyObservedEnergyMilliwattHours, null);
  assert.equal(profile.resources.directlyObservedCarbonMilligrams, null);
});

test('preexisting implementation, meter definition, environment, and hardware remain cohort boundaries', () => {
  const base = Metrology.sealObservation(draft(0));
  const changes = [
    draft(1, { preexistingImplementationState: 'NONE' }),
    draft(2, { hardwareProfileDigest: sha('different-hardware') }),
    draft(3),
    draft(4)
  ];
  changes[2].source.measurementDefinitionDigest = sha('different-meter-definition');
  changes[3].execution.environmentDigest = sha('different-environment');
  const computeChange = draft(5);
  computeChange.execution.computeMeter.definitionId = 'host.compute-meter/v2';
  changes.push(computeChange);
  for (const changed of changes) assert.notEqual(Metrology.sealObservation(changed).comparisonKey, base.comparisonKey);
});

test('unknown compute coverage cannot hide inferred compute values', () => {
  const changed = draft(0);
  changed.execution.computeMeter.coverage = 'UNKNOWN';
  changed.execution.computeMeter.definitionId = null;
  changed.execution.computeMeter.acceleratorMilliseconds = null;
  changed.execution.computeMeter.peakMemoryBytes = null;
  changed.execution.computeMeter.providerComputeUnitsMicros = null;
  assert.throws(() => Metrology.sealObservation(changed), /unknown compute coverage cannot carry inferred compute values/);
});

test('private stewardship intake is permission-bound, append-only, reusable, and holds one sample', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-cognitive-metrology-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const observationStateDir = path.join(root, 'observations');
  const profileStateDir = path.join(root, 'profiles');
  assert.throws(() => Stewardship.intake(draft(0), { policy: policy(false), observationStateDir }), /not enabled/);
  const first = Stewardship.intake(draft(0), { policy: policy(), observationStateDir });
  const second = Stewardship.intake(draft(0), { policy: policy(), observationStateDir });
  assert.equal(first.state, 'RECORDED_PROFILE_ELIGIBLE_OBSERVATION');
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(Stewardship.loadObservations(observationStateDir).length, 1);
  const profiled = Stewardship.profile(first.observation.comparisonKey, { policy: policy(), observationStateDir, profileStateDir });
  assert.equal(profiled.profile.state, 'HOLD_INSUFFICIENT_COMPARABLE_OBSERVATIONS');
  assert.equal(profiled.profile.calibration.accuracyClaim, null);
  assert.ok(fs.existsSync(path.join(profiled.runDir, 'profile.json')));
});

test('private state tampering and unexpected visible entries are refused', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-cognitive-metrology-tamper-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const observationStateDir = path.join(root, 'observations');
  const result = Stewardship.intake(draft(0), { policy: policy(), observationStateDir });
  const file = path.join(result.runDir, 'observation.json');
  const changed = JSON.parse(fs.readFileSync(file, 'utf8'));
  changed.execution.timing.wallMilliseconds += 1;
  fs.writeFileSync(file, JSON.stringify(changed));
  assert.throws(() => Stewardship.loadObservations(observationStateDir), /content changed/);

  const other = path.join(root, 'other-observations');
  fs.mkdirSync(other);
  fs.writeFileSync(path.join(other, 'visible.txt'), 'not an observation');
  assert.throws(() => Stewardship.loadObservations(other), /unexpected cognitive-resource state entry/);
});

test('cognitive metrology contracts are strict JSON and stay private from runtime routes', () => {
  const root = path.resolve(__dirname, '..');
  for (const name of ['cognitive-work-observation-draft.schema.json', 'cognitive-work-observation.schema.json', 'cognitive-resource-profile.schema.json']) {
    const schema = JSON.parse(fs.readFileSync(path.join(root, 'contracts', name), 'utf8'));
    assert.equal(schema.additionalProperties, false);
  }
  const runtime = fs.readFileSync(path.join(root, 'runtime', 'server.js'), 'utf8');
  assert.doesNotMatch(runtime, /cognitive-resource-stewardship|cognitive-work-metrology/);
  const repositoryPolicy = JSON.parse(fs.readFileSync(path.join(root, 'training', 'TRAINING_POLICY.json'), 'utf8'));
  assert.equal(repositoryPolicy.cognitiveWorkObservationIntakeEnabled, true);
  assert.match(repositoryPolicy.cognitiveWorkObservationIntakeScope, /no-forecast-or-accuracy-claim/);
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts['record:cognitive-work'], 'node scripts/record-cognitive-work-observation.js');
  assert.equal(packageJson.scripts['profile:cognitive-work'], 'node scripts/profile-cognitive-work-observations.js');
  const bom = JSON.parse(fs.readFileSync(path.join(root, 'MODEL_BOM.json'), 'utf8'));
  const entry = bom.deterministicEvaluationOrgans.find(item => item.path === 'organs/cognitive-resource-stewardship-organ.js');
  assert.equal(entry.calibratedForecastImplemented, false);
  assert.equal(entry.modelSelectionAuthority, false);
  assert.equal(entry.completeProviderDefinedComputeMeterRequiredForProfileEligibility, true);
  assert.equal(entry.universalFlopsClaim, false);
  const status = JSON.parse(fs.readFileSync(path.join(root, 'STATUS.json'), 'utf8'));
  assert.match(status.cognitiveResourceStewardshipOrgan, /NO_CALIBRATED_FORECAST_OR_SELECTION_AUTHORITY/);
  assert.equal(status.cognitiveResourceStewardshipEvidence.realObservationsWritten, 0);
  assert.equal(status.cognitiveResourceStewardshipEvidence.accuracyClaim, null);
  const integrity = require('../kernel/foundation-public-body-integrity-cell').inspect(root);
  assert.ok(integrity.coverage.javascriptSyntaxChecked.includes('kernel/cognitive-work-metrology-cell.js'));
  assert.ok(integrity.coverage.jsonParsed.includes('contracts/cognitive-resource-profile.schema.json'));
  assert.ok(integrity.coverage.javascriptSyntaxChecked.includes('scripts/profile-cognitive-work-observations.js'));
});
