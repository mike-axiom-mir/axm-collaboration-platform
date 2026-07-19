'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Metrology = require('../kernel/cognitive-work-metrology-cell');
const Calibration = require('../kernel/cognitive-resource-calibration-cell');
const Economics = require('../kernel/cognitive-resource-economics-cell');
const MetrologyStewardship = require('../organs/cognitive-resource-stewardship-organ');
const EconomicsStewardship = require('../organs/cognitive-resource-economics-stewardship-organ');

function sha(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function policy(economicsEnabled = true) {
  return {
    schema: 'axm.mirror.training-policy/v1',
    cognitiveWorkObservationIntakeEnabled: true,
    cognitiveResourceCalibrationIntakeEnabled: true,
    cognitiveResourceEconomicsIntakeEnabled: economicsEnabled,
    automaticRuntimePromotion: false,
    automaticCanonPromotion: false,
    automaticAuthorityGrowth: false
  };
}

function workDraft(index = 0, options = {}) {
  const totalTokens = options.totalTokens ?? 1000 + index;
  const wall = options.wall ?? 2000 + index;
  return {
    schema: Metrology.DRAFT_SCHEMA,
    source: {
      sourceSystemId: 'economics-test-meter/v1', sourceRecordId: `work-${index}`, sourceRecordDigest: sha(`work-source-${index}`),
      collectionMethod: 'DIRECT_MACHINE_METER', authorshipState: 'DECLARED_NOT_CERTIFIED', measurementDefinitionDigest: sha('economics-test-measurement-v1')
    },
    objective: {
      objectiveKind: 'REPOSITORY_STEWARDSHIP', objectiveDigest: options.objectiveDigest || sha(`objective-${index}`),
      startingStateDigest: options.startingStateDigest || sha(`start-${index % 5}`), endingStateDigest: sha(`end-${index}`)
    },
    workShape: {
      operationKinds: ['AUDIT', 'EDIT', 'VERIFY'], domainKinds: ['SOFTWARE_RESEARCH'], requestedOutputKinds: ['TESTED_REPOSITORY_CHANGE'],
      riskTier: 'MEDIUM', requiredVerificationKinds: ['NODE_TEST', 'STRUCTURE_DOCTOR']
    },
    execution: {
      modelProfileDigest: options.modelProfileDigest || sha('model-v1'), toolchainDigest: sha('toolchain-v1'), environmentDigest: sha('environment-v1'),
      hardwareProfileDigest: options.hardwareProfileDigest || sha('hardware-v1'),
      tokenMeter: {
        definitionId: 'goal-total-tokens/v1', coverage: 'COMPLETE', inputTokens: 100, cachedInputTokens: 20,
        outputTokens: 200, reasoningTokens: 300, totalTokens
      },
      computeMeter: {
        definitionId: 'host-compute/v1', coverage: 'COMPLETE', cpuCoreMilliseconds: options.cpuCoreMilliseconds ?? wall * 2,
        acceleratorMilliseconds: options.acceleratorMilliseconds ?? wall, peakMemoryBytes: 1000000 + index,
        providerComputeUnitsMicros: options.providerComputeUnitsMicros ?? null
      },
      timing: { wallMilliseconds: wall, toolMilliseconds: 100 },
      workCounts: { filesExamined: 10, filesChanged: 2, linesAdded: 20, linesRemoved: 3, toolCalls: 4 },
      verification: { testsExecuted: 2, testsPassed: 2, testsFailed: 0, testsNotRun: 0, verificationDigest: sha(`verify-${index}`) }
    },
    outcome: { state: 'VERIFIED_COMPLETE', status: 'TEST', preexistingImplementationState: 'SUBSTANTIAL' },
    costObservation: { basis: 'UNKNOWN', profileDigest: null, currency: null, moneyMicros: null, energyMilliwattHours: null, carbonMilligrams: null },
    permission: { status: 'ALLOWED', basisDigest: sha('economics-test-observation-permission') }
  };
}

function economicsDraft(options = {}) {
  const mode = options.accountingMode || 'PROVIDER_TOKEN_BILLING';
  const defaultComponents = mode === 'LOCAL_HARDWARE_TIME'
    ? [
        { metric: 'CPU_CORE_MILLISECONDS', quantityDenominator: 1000, moneyMicrosPerQuantity: 100, energyMilliwattHoursPerQuantity: 50, carbonMilligramsPerQuantity: null },
        { metric: 'ACCELERATOR_MILLISECONDS', quantityDenominator: 1000, moneyMicrosPerQuantity: 200, energyMilliwattHoursPerQuantity: 100, carbonMilligramsPerQuantity: 40 }
      ]
    : mode === 'PROVIDER_COMPUTE_UNIT_BILLING'
      ? [{ metric: 'PROVIDER_COMPUTE_UNITS_MICROS', quantityDenominator: 1000000, moneyMicrosPerQuantity: 500000, energyMilliwattHoursPerQuantity: null, carbonMilligramsPerQuantity: null }]
      : [{ metric: 'TOTAL_TOKENS', quantityDenominator: 1000, moneyMicrosPerQuantity: 1000, energyMilliwattHoursPerQuantity: null, carbonMilligramsPerQuantity: null }];
  return {
    schema: Economics.PROFILE_DRAFT_SCHEMA,
    source: {
      sourceSystemId: 'economics-test-source/v1', sourceRecordId: options.sourceRecordId || 'rates-1', sourceRecordDigest: sha(options.sourceRecordId || 'rates-1'),
      collectionMethod: options.collectionMethod || (mode === 'LOCAL_HARDWARE_TIME' ? 'DIRECT_HARDWARE_MEASUREMENT' : 'DIRECT_BILLING_SCHEDULE'),
      authorshipState: 'DECLARED_NOT_CERTIFIED', rateScheduleDigest: sha(options.rateSchedule || 'rates-v1'),
      effectiveWindowId: 'window-2026-07', freshnessState: options.freshnessState || 'CURRENT_DECLARED_NOT_CERTIFIED'
    },
    scope: {
      accountingMode: mode, currency: options.currency === undefined ? 'EUR' : options.currency,
      modelProfileDigest: options.modelProfileDigest === undefined ? (mode === 'LOCAL_HARDWARE_TIME' ? null : sha('model-v1')) : options.modelProfileDigest,
      hardwareProfileDigest: options.hardwareProfileDigest === undefined ? (mode === 'LOCAL_HARDWARE_TIME' ? sha('hardware-v1') : null) : options.hardwareProfileDigest,
      tokenMeterDefinitionId: mode === 'PROVIDER_TOKEN_BILLING' ? 'goal-total-tokens/v1' : null,
      computeMeterDefinitionId: mode === 'PROVIDER_TOKEN_BILLING' ? null : 'host-compute/v1'
    },
    components: options.components || defaultComponents,
    permission: { status: 'ALLOWED', basisDigest: sha('economics-test-profile-permission') }
  };
}

function supportedPrediction() {
  const observations = Array.from({ length: 5 }, (_, index) => Metrology.sealObservation(workDraft(index)));
  const resourceProfile = Metrology.buildResourceProfile(observations, observations[0].comparisonKey);
  const draft = {
    schema: Calibration.PREDICTION_DRAFT_SCHEMA,
    source: {
      sourceSystemId: 'economics-test-prediction-ledger/v1', sourceRecordId: 'prediction-source-0', sourceRecordDigest: sha('prediction-source-0'),
      collectionMethod: 'DIRECT_MACHINE_SEAL', authorshipState: 'DECLARED_NOT_CERTIFIED', sequence: 0, priorPredictionDigest: null
    },
    target: {
      objectiveKind: 'REPOSITORY_STEWARDSHIP', objectiveDigest: sha('future-objective'), startingStateDigest: sha('future-start'), comparisonKey: resourceProfile.comparisonKey
    },
    method: {
      methodId: 'descriptive-range-human-review/v1', methodDigest: sha('descriptive-range-human-review-v1'),
      resourceProfileId: resourceProfile.profileId, resourceProfileDigest: resourceProfile.profileDigest, targetCoverageBasisPoints: 8000
    },
    intervals: {
      totalTokens: { lower: 900, upper: 1200 }, wallMilliseconds: { lower: 1900, upper: 2200 }, cpuCoreMilliseconds: null,
      acceleratorMilliseconds: null, peakMemoryBytes: null, providerComputeUnitsMicros: null, moneyMicros: null,
      energyMilliwattHours: null, carbonMilligrams: null
    },
    costBinding: null,
    permission: { status: 'ALLOWED', basisDigest: sha('economics-test-prediction-permission') }
  };
  const prediction = Calibration.sealPrediction(draft, resourceProfile, { observations, predecessor: null });
  return { observations, resourceProfile, prediction };
}

test('economics profiles seal deterministically, normalize component order, and carry zero authority', () => {
  const draft = economicsDraft({ accountingMode: 'LOCAL_HARDWARE_TIME' });
  draft.components.reverse();
  const profile = Economics.sealProfile(draft);
  assert.deepEqual(profile.components.map(component => component.metric), ['ACCELERATOR_MILLISECONDS', 'CPU_CORE_MILLISECONDS']);
  assert.equal(profile.state, 'READY_LINEAR_PROFILE_DERIVATION_NOT_CALIBRATED_COST');
  assert.equal(profile.assessment.externalFreshnessCertified, false);
  assert.equal(profile.assessment.nonlinearBillingSupported, false);
  assert.ok(Object.values(profile.authority).every(value => value === false));
  assert.equal(Economics.verifyProfile(profile), true);
});

test('an exact token-meter and model binding derives only a profile-estimated interval', () => {
  const observation = Metrology.sealObservation(workDraft(0, { totalTokens: 1001 }));
  const profile = Economics.sealProfile(economicsDraft({
    components: [{ metric: 'TOTAL_TOKENS', quantityDenominator: 2, moneyMicrosPerQuantity: 3, energyMilliwattHoursPerQuantity: null, carbonMilligramsPerQuantity: null }]
  }));
  const estimate = Economics.estimateObservation(observation, profile);
  assert.deepEqual(estimate.totals.moneyMicros, { lower: 1501, upper: 1502 });
  assert.equal(estimate.totals.basis, 'PROFILE_ESTIMATED');
  assert.equal(estimate.assessment.billedCostClaim, false);
  assert.equal(estimate.assessment.measuredCostClaim, false);
  assert.equal(estimate.assessment.costCoverageClaim, null);
  assert.ok(Object.values(estimate.authority).every(value => value === false));
  assert.equal(Economics.verifyEstimate(estimate, observation, profile), true);
});

test('token totals and token components cannot be double counted', () => {
  const draft = economicsDraft({ components: [
    { metric: 'TOTAL_TOKENS', quantityDenominator: 1000, moneyMicrosPerQuantity: 100, energyMilliwattHoursPerQuantity: null, carbonMilligramsPerQuantity: null },
    { metric: 'INPUT_TOKENS', quantityDenominator: 1000, moneyMicrosPerQuantity: 50, energyMilliwattHoursPerQuantity: null, carbonMilligramsPerQuantity: null }
  ] });
  assert.throws(() => Economics.sealProfile(draft), /cannot be combined/);
  const duplicate = economicsDraft({ components: [
    { metric: 'OUTPUT_TOKENS', quantityDenominator: 1000, moneyMicrosPerQuantity: 100, energyMilliwattHoursPerQuantity: null, carbonMilligramsPerQuantity: null },
    { metric: 'OUTPUT_TOKENS', quantityDenominator: 1000, moneyMicrosPerQuantity: 200, energyMilliwattHoursPerQuantity: null, carbonMilligramsPerQuantity: null }
  ] });
  assert.throws(() => Economics.sealProfile(duplicate), /must be unique/);
  const crossMode = economicsDraft({ accountingMode: 'LOCAL_HARDWARE_TIME', components: [
    { metric: 'TOTAL_TOKENS', quantityDenominator: 1000, moneyMicrosPerQuantity: 100, energyMilliwattHoursPerQuantity: null, carbonMilligramsPerQuantity: null }
  ] });
  assert.throws(() => Economics.sealProfile(crossMode), /non-hardware-time metric/);
  const extraField = economicsDraft();
  extraField.hiddenDecision = 'cheapest';
  assert.throws(() => Economics.sealProfile(extraField), /fields changed/);
});

test('model, hardware, and meter mismatches remain explicit holds with no derived total', () => {
  const observation = Metrology.sealObservation(workDraft(0));
  const modelMismatch = Economics.sealProfile(economicsDraft({ modelProfileDigest: sha('other-model') }));
  const held = Economics.estimateObservation(observation, modelMismatch);
  assert.equal(held.assessment.state, 'HOLD_RESOURCE_ECONOMICS_BINDING');
  assert.ok(held.assessment.issues.includes('MODEL_PROFILE_BINDING_MISMATCH'));
  assert.equal(held.totals.moneyMicros, null);

  const hardwareDraft = economicsDraft({ accountingMode: 'LOCAL_HARDWARE_TIME', hardwareProfileDigest: sha('other-hardware') });
  hardwareDraft.scope.computeMeterDefinitionId = 'other-compute/v1';
  const hardwareHeld = Economics.estimateObservation(observation, Economics.sealProfile(hardwareDraft));
  assert.ok(hardwareHeld.assessment.issues.includes('HARDWARE_PROFILE_BINDING_MISMATCH'));
  assert.ok(hardwareHeld.assessment.issues.includes('COMPUTE_METER_DEFINITION_MISMATCH'));
  assert.equal(hardwareHeld.assessment.exactLinearTransformation, false);

  const partialDraft = workDraft(1);
  partialDraft.execution.tokenMeter.coverage = 'PARTIAL';
  const partial = Economics.estimateObservation(Metrology.sealObservation(partialDraft), Economics.sealProfile(economicsDraft()));
  assert.ok(partial.assessment.issues.includes('TOKEN_METER_NOT_COMPLETE'));
  assert.equal(partial.totals.moneyMicros, null);
});

test('local hardware time keeps money, energy, and carbon as separate totals', () => {
  const observation = Metrology.sealObservation(workDraft(0, { cpuCoreMilliseconds: 4000, acceleratorMilliseconds: 2000 }));
  const profile = Economics.sealProfile(economicsDraft({ accountingMode: 'LOCAL_HARDWARE_TIME' }));
  const estimate = Economics.estimateObservation(observation, profile);
  assert.deepEqual(estimate.totals.moneyMicros, { lower: 800, upper: 800 });
  assert.deepEqual(estimate.totals.energyMilliwattHours, { lower: 400, upper: 400 });
  assert.deepEqual(estimate.totals.carbonMilligrams, { lower: 80, upper: 80 });
  assert.equal(estimate.authority.candidateRanking, false);
  assert.equal(estimate.authority.hardwareSelection, false);
});

test('a pre-outcome resource interval can be transformed while preserving 80% only as resource-target lineage', () => {
  const { observations, resourceProfile, prediction } = supportedPrediction();
  const economicsProfile = Economics.sealProfile(economicsDraft());
  const estimate = Economics.estimatePrediction(prediction, resourceProfile, economicsProfile, observations);
  assert.deepEqual(estimate.totals.moneyMicros, { lower: 900, upper: 1200 });
  assert.equal(estimate.source.resourceTargetCoverageBasisPoints, 8000);
  assert.equal(estimate.assessment.costCoverageClaim, null);
  assert.equal(estimate.assessment.accuracyClaim, null);
  assert.equal(Economics.verifyEstimate(estimate, prediction, economicsProfile, { resourceProfile, observations }), true);

  const componentProfile = Economics.sealProfile(economicsDraft({ components: [
    { metric: 'INPUT_TOKENS', quantityDenominator: 1000, moneyMicrosPerQuantity: 1000, energyMilliwattHoursPerQuantity: null, carbonMilligramsPerQuantity: null }
  ] }));
  const held = Economics.estimatePrediction(prediction, resourceProfile, componentProfile, observations);
  assert.ok(held.assessment.issues.includes('RESOURCE_METRIC_UNAVAILABLE_INPUT_TOKENS'));
  assert.equal(held.totals.moneyMicros, null);
});

test('manual, imported, historical, and unknown-freshness rates never become direct or current claims', () => {
  const observation = Metrology.sealObservation(workDraft(0));
  for (const freshnessState of ['CURRENT_DECLARED_NOT_CERTIFIED', 'HISTORICAL', 'UNKNOWN']) {
    const profile = Economics.sealProfile(economicsDraft({ collectionMethod: 'MANUAL_DECLARATION', freshnessState, sourceRecordId: `manual-${freshnessState}` }));
    const estimate = Economics.estimateObservation(observation, profile);
    assert.equal(estimate.assessment.state, 'PROFILE_DERIVED_INTERVAL_DECLARED_RATE_SOURCE_UNCERTIFIED');
    assert.equal(estimate.economicsProfile.externalFreshnessCertified, false);
    assert.equal(estimate.authority.directCostAdmission, false);
  }
  const heldDraft = economicsDraft({ sourceRecordId: 'permission-hold' });
  heldDraft.source.sourceRecordDigest = null;
  heldDraft.source.rateScheduleDigest = null;
  heldDraft.permission = { status: 'UNKNOWN', basisDigest: null };
  const heldProfile = Economics.sealProfile(heldDraft);
  assert.equal(heldProfile.state, 'HOLD_INCOMPLETE_ECONOMICS_PROFILE');
  assert.deepEqual(heldProfile.assessment.issues, ['INTAKE_PERMISSION_NOT_ALLOWED', 'RATE_SCHEDULE_DIGEST_MISSING', 'SOURCE_RECORD_DIGEST_MISSING']);
  const heldEstimate = Economics.estimateObservation(observation, heldProfile);
  assert.ok(heldEstimate.assessment.issues.includes('ECONOMICS_PROFILE_NOT_ELIGIBLE'));
  assert.equal(heldEstimate.totals.moneyMicros, null);
});

test('a self-digested estimate forgery fails source reconstruction', () => {
  const observation = Metrology.sealObservation(workDraft(0));
  const profile = Economics.sealProfile(economicsDraft());
  const forged = JSON.parse(JSON.stringify(Economics.estimateObservation(observation, profile)));
  forged.assessment.issues = ['FORGED'];
  forged.assessment.state = 'HOLD_RESOURCE_ECONOMICS_BINDING';
  forged.estimateId = `cognitive-resource-cost-estimate-${Economics.digest(Object.assign({}, forged, { estimateId: null, estimateDigest: null })).slice(0, 24)}`;
  forged.estimateDigest = Economics.digest(Object.assign({}, forged, { estimateDigest: null }));
  assert.throws(() => Economics.verifyEstimate(forged, observation, profile), /content changed/);
});

test('private stewardship is policy-gated, append-only, reusable, and tamper-evident', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-economics-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const options = {
    policy: policy(),
    observationStateDir: path.join(root, 'observations'),
    resourceProfileStateDir: path.join(root, 'resource-profiles'),
    predictionStateDir: path.join(root, 'predictions'),
    economicsProfileStateDir: path.join(root, 'economics-profiles'),
    estimateStateDir: path.join(root, 'estimates')
  };
  assert.throws(() => EconomicsStewardship.intakeProfile(economicsDraft(), Object.assign({}, options, { policy: policy(false) })), /not enabled/);
  const observation = MetrologyStewardship.intake(workDraft(0), options).observation;
  const firstProfile = EconomicsStewardship.intakeProfile(economicsDraft(), options);
  const secondProfile = EconomicsStewardship.intakeProfile(economicsDraft(), options);
  assert.equal(firstProfile.reused, false);
  assert.equal(secondProfile.reused, true);
  const first = EconomicsStewardship.estimate('observation', observation.observationId, firstProfile.profile.profileId, options);
  const second = EconomicsStewardship.estimate('observation', observation.observationId, firstProfile.profile.profileId, options);
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(EconomicsStewardship.loadEstimates(options).length, 1);
  const file = path.join(first.runDir, 'estimate.json');
  const changed = JSON.parse(fs.readFileSync(file, 'utf8'));
  changed.totals.moneyMicros.upper += 1;
  fs.writeFileSync(file, JSON.stringify(changed));
  assert.throws(() => EconomicsStewardship.loadEstimates(options), /digest changed|content changed/);
});

test('contracts, commands, policy, BOM, status, and runtime separation are explicit', () => {
  const root = path.resolve(__dirname, '..');
  for (const name of ['cognitive-resource-economics-profile-draft.schema.json', 'cognitive-resource-economics-profile.schema.json', 'cognitive-resource-cost-estimate.schema.json']) {
    const schema = JSON.parse(fs.readFileSync(path.join(root, 'contracts', name), 'utf8'));
    assert.equal(schema.additionalProperties, false);
  }
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts['seal:cognitive-resource-economics-profile'], 'node scripts/seal-cognitive-resource-economics-profile.js');
  assert.equal(packageJson.scripts['estimate:cognitive-resource-cost'], 'node scripts/estimate-cognitive-resource-cost.js');
  const repositoryPolicy = JSON.parse(fs.readFileSync(path.join(root, 'training', 'TRAINING_POLICY.json'), 'utf8'));
  assert.equal(repositoryPolicy.cognitiveResourceEconomicsIntakeEnabled, true);
  assert.match(repositoryPolicy.cognitiveResourceEconomicsIntakeScope, /no-cost-optimization-or-selection/);
  const bom = JSON.parse(fs.readFileSync(path.join(root, 'MODEL_BOM.json'), 'utf8'));
  const entry = bom.deterministicEvaluationOrgans.find(item => item.path === 'organs/cognitive-resource-economics-stewardship-organ.js');
  assert.equal(entry.linearProfileDerivedIntervalsImplemented, true);
  assert.equal(entry.universalTokenComputeConversion, false);
  assert.equal(entry.costOptimizationAuthority, false);
  const status = JSON.parse(fs.readFileSync(path.join(root, 'STATUS.json'), 'utf8'));
  assert.match(status.cognitiveResourceEconomicsStewardshipOrgan, /NO_COST_OPTIMIZATION_OR_SELECTION_AUTHORITY/);
  assert.equal(status.cognitiveResourceEconomicsStewardshipEvidence.realEconomicsProfilesWritten, 0);
  assert.equal(status.cognitiveResourceEconomicsStewardshipEvidence.costCoverageClaim, null);
  const runtime = fs.readFileSync(path.join(root, 'runtime', 'server.js'), 'utf8');
  assert.doesNotMatch(runtime, /cognitive-resource-economics/);
  const integrity = require('../kernel/foundation-public-body-integrity-cell').inspect(root);
  assert.ok(integrity.coverage.javascriptSyntaxChecked.includes('kernel/cognitive-resource-economics-cell.js'));
  assert.ok(integrity.coverage.jsonParsed.includes('contracts/cognitive-resource-cost-estimate.schema.json'));
  assert.ok(integrity.coverage.javascriptSyntaxChecked.includes('scripts/estimate-cognitive-resource-cost.js'));
});
