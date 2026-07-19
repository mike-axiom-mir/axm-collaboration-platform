'use strict';

const KeySafeJson = require('./key-safe-json-transport-cell');

const CELL_ID = 'axm.mirror.cognitive-work-metrology-cell/v1';
const DRAFT_SCHEMA = 'axm.mirror.cognitive-work-observation-draft/v1';
const OBSERVATION_SCHEMA = 'axm.mirror.cognitive-work-observation/v1';
const PROFILE_SCHEMA = 'axm.mirror.cognitive-resource-profile/v1';
const MIN_COMPARABLE_OBSERVATIONS = 5;
const MIN_DISTINCT_STARTING_STATES = 3;
const SHA256 = /^[a-f0-9]{64}$/;
const MACHINE_TOKEN = /^[A-Z][A-Z0-9_]{0,79}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;

function digest(value) { return KeySafeJson.digest(value); }
function stable(value) { return KeySafeJson.stable(value); }
function same(left, right) { return KeySafeJson.same(left, right); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(`${label} fields changed`);
}
function sha(value, field, nullable = false) {
  if (value === null && nullable) return null;
  if (!SHA256.test(String(value || ''))) throw new Error(`${field} requires a SHA-256 digest`);
  return String(value);
}
function id(value, field, nullable = false) {
  if (value === null && nullable) return null;
  const text = String(value || '');
  if (!ID.test(text)) throw new Error(`${field} requires a bounded machine identifier`);
  return text;
}
function token(value, field) {
  const text = String(value || '');
  if (!MACHINE_TOKEN.test(text)) throw new Error(`${field} requires a bounded machine token`);
  return text;
}
function count(value, field, nullable = false) {
  if (value === null && nullable) return null;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} requires a non-negative safe integer`);
  return value;
}
function enumValue(value, allowed, field) {
  if (!allowed.includes(value)) throw new Error(`${field} changed`);
  return value;
}
function tokens(values, field) {
  if (!Array.isArray(values) || !values.length) throw new Error(`${field} requires at least one machine token`);
  const normalized = Array.from(new Set(values.map((value, index) => token(value, `${field}[${index}]`)))).sort();
  if (normalized.length !== values.length) throw new Error(`${field} contains duplicate tokens`);
  return normalized;
}
function nullableCounts(value, keys, label) {
  exactKeys(value, keys, label);
  return Object.fromEntries(keys.map(key => [key, count(value[key], `${label}.${key}`, true)]));
}

function normalizeDraft(draft) {
  exactKeys(draft, ['schema', 'source', 'objective', 'workShape', 'execution', 'outcome', 'costObservation', 'permission'], 'cognitive work draft');
  if (draft.schema !== DRAFT_SCHEMA) throw new Error('cognitive work draft schema changed');

  exactKeys(draft.source, ['sourceSystemId', 'sourceRecordId', 'sourceRecordDigest', 'collectionMethod', 'authorshipState', 'measurementDefinitionDigest'], 'cognitive work source');
  const source = {
    sourceSystemId: id(draft.source.sourceSystemId, 'source.sourceSystemId'),
    sourceRecordId: id(draft.source.sourceRecordId, 'source.sourceRecordId'),
    sourceRecordDigest: sha(draft.source.sourceRecordDigest, 'source.sourceRecordDigest', true),
    collectionMethod: enumValue(draft.source.collectionMethod, ['DIRECT_MACHINE_METER', 'IMPORTED_ATTESTATION', 'MANUAL_DECLARATION'], 'source.collectionMethod'),
    authorshipState: enumValue(draft.source.authorshipState, ['DECLARED_NOT_CERTIFIED', 'UNKNOWN'], 'source.authorshipState'),
    measurementDefinitionDigest: sha(draft.source.measurementDefinitionDigest, 'source.measurementDefinitionDigest', true)
  };

  exactKeys(draft.objective, ['objectiveKind', 'objectiveDigest', 'startingStateDigest', 'endingStateDigest'], 'cognitive work objective');
  const objective = {
    objectiveKind: token(draft.objective.objectiveKind, 'objective.objectiveKind'),
    objectiveDigest: sha(draft.objective.objectiveDigest, 'objective.objectiveDigest'),
    startingStateDigest: sha(draft.objective.startingStateDigest, 'objective.startingStateDigest', true),
    endingStateDigest: sha(draft.objective.endingStateDigest, 'objective.endingStateDigest', true)
  };

  exactKeys(draft.workShape, ['operationKinds', 'domainKinds', 'requestedOutputKinds', 'riskTier', 'requiredVerificationKinds'], 'cognitive work shape');
  const workShape = {
    operationKinds: tokens(draft.workShape.operationKinds, 'workShape.operationKinds'),
    domainKinds: tokens(draft.workShape.domainKinds, 'workShape.domainKinds'),
    requestedOutputKinds: tokens(draft.workShape.requestedOutputKinds, 'workShape.requestedOutputKinds'),
    riskTier: enumValue(draft.workShape.riskTier, ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], 'workShape.riskTier'),
    requiredVerificationKinds: tokens(draft.workShape.requiredVerificationKinds, 'workShape.requiredVerificationKinds')
  };

  exactKeys(draft.execution, ['modelProfileDigest', 'toolchainDigest', 'environmentDigest', 'hardwareProfileDigest', 'tokenMeter', 'computeMeter', 'timing', 'workCounts', 'verification'], 'cognitive work execution');
  exactKeys(draft.execution.tokenMeter, ['definitionId', 'coverage', 'inputTokens', 'cachedInputTokens', 'outputTokens', 'reasoningTokens', 'totalTokens'], 'cognitive work token meter');
  const tokenMeter = {
    definitionId: id(draft.execution.tokenMeter.definitionId, 'execution.tokenMeter.definitionId', true),
    coverage: enumValue(draft.execution.tokenMeter.coverage, ['COMPLETE', 'PARTIAL', 'UNKNOWN'], 'execution.tokenMeter.coverage'),
    inputTokens: count(draft.execution.tokenMeter.inputTokens, 'execution.tokenMeter.inputTokens', true),
    cachedInputTokens: count(draft.execution.tokenMeter.cachedInputTokens, 'execution.tokenMeter.cachedInputTokens', true),
    outputTokens: count(draft.execution.tokenMeter.outputTokens, 'execution.tokenMeter.outputTokens', true),
    reasoningTokens: count(draft.execution.tokenMeter.reasoningTokens, 'execution.tokenMeter.reasoningTokens', true),
    totalTokens: count(draft.execution.tokenMeter.totalTokens, 'execution.tokenMeter.totalTokens', true)
  };
  if (tokenMeter.coverage === 'COMPLETE' && (tokenMeter.definitionId === null || tokenMeter.totalTokens === null)) throw new Error('complete token coverage requires a definition and total');
  if (tokenMeter.coverage === 'UNKNOWN' && Object.entries(tokenMeter).some(([key, value]) => key !== 'coverage' && value !== null)) throw new Error('unknown token coverage cannot carry inferred token values');

  exactKeys(draft.execution.computeMeter, ['definitionId', 'coverage', 'cpuCoreMilliseconds', 'acceleratorMilliseconds', 'peakMemoryBytes', 'providerComputeUnitsMicros'], 'cognitive work compute meter');
  const computeMeter = {
    definitionId: id(draft.execution.computeMeter.definitionId, 'execution.computeMeter.definitionId', true),
    coverage: enumValue(draft.execution.computeMeter.coverage, ['COMPLETE', 'PARTIAL', 'UNKNOWN'], 'execution.computeMeter.coverage'),
    cpuCoreMilliseconds: count(draft.execution.computeMeter.cpuCoreMilliseconds, 'execution.computeMeter.cpuCoreMilliseconds', true),
    acceleratorMilliseconds: count(draft.execution.computeMeter.acceleratorMilliseconds, 'execution.computeMeter.acceleratorMilliseconds', true),
    peakMemoryBytes: count(draft.execution.computeMeter.peakMemoryBytes, 'execution.computeMeter.peakMemoryBytes', true),
    providerComputeUnitsMicros: count(draft.execution.computeMeter.providerComputeUnitsMicros, 'execution.computeMeter.providerComputeUnitsMicros', true)
  };
  const computeValues = Object.entries(computeMeter).filter(([key]) => !['definitionId', 'coverage'].includes(key)).map(([, value]) => value);
  if (computeMeter.coverage === 'COMPLETE' && (computeMeter.definitionId === null || !computeValues.some(value => value !== null))) throw new Error('complete compute coverage requires a definition and at least one measured value');
  if (computeMeter.coverage === 'UNKNOWN' && Object.entries(computeMeter).some(([key, value]) => key !== 'coverage' && value !== null)) throw new Error('unknown compute coverage cannot carry inferred compute values');

  exactKeys(draft.execution.timing, ['wallMilliseconds', 'toolMilliseconds'], 'cognitive work timing');
  const timing = {
    wallMilliseconds: count(draft.execution.timing.wallMilliseconds, 'execution.timing.wallMilliseconds', true),
    toolMilliseconds: count(draft.execution.timing.toolMilliseconds, 'execution.timing.toolMilliseconds', true)
  };
  const workCounts = nullableCounts(draft.execution.workCounts, ['filesExamined', 'filesChanged', 'linesAdded', 'linesRemoved', 'toolCalls'], 'cognitive work counts');
  exactKeys(draft.execution.verification, ['testsExecuted', 'testsPassed', 'testsFailed', 'testsNotRun', 'verificationDigest'], 'cognitive work verification');
  const verification = {
    testsExecuted: count(draft.execution.verification.testsExecuted, 'execution.verification.testsExecuted', true),
    testsPassed: count(draft.execution.verification.testsPassed, 'execution.verification.testsPassed', true),
    testsFailed: count(draft.execution.verification.testsFailed, 'execution.verification.testsFailed', true),
    testsNotRun: count(draft.execution.verification.testsNotRun, 'execution.verification.testsNotRun', true),
    verificationDigest: sha(draft.execution.verification.verificationDigest, 'execution.verification.verificationDigest', true)
  };
  if ([verification.testsExecuted, verification.testsPassed, verification.testsFailed].every(value => value !== null) && verification.testsPassed + verification.testsFailed !== verification.testsExecuted) throw new Error('verification test counts do not reconcile');
  const execution = {
    modelProfileDigest: sha(draft.execution.modelProfileDigest, 'execution.modelProfileDigest', true),
    toolchainDigest: sha(draft.execution.toolchainDigest, 'execution.toolchainDigest', true),
    environmentDigest: sha(draft.execution.environmentDigest, 'execution.environmentDigest', true),
    hardwareProfileDigest: sha(draft.execution.hardwareProfileDigest, 'execution.hardwareProfileDigest', true),
    tokenMeter,
    computeMeter,
    timing,
    workCounts,
    verification
  };

  exactKeys(draft.outcome, ['state', 'status', 'preexistingImplementationState'], 'cognitive work outcome');
  const outcome = {
    state: enumValue(draft.outcome.state, ['VERIFIED_COMPLETE', 'VERIFIED_PARTIAL', 'KNOWN_FAIL', 'HOLD'], 'outcome.state'),
    status: enumValue(draft.outcome.status, ['EXPERIMENTAL', 'TEST', 'WORKING', 'KNOWN_FAIL', 'NEEDS_REVIEW'], 'outcome.status'),
    preexistingImplementationState: enumValue(draft.outcome.preexistingImplementationState, ['NONE', 'PARTIAL', 'SUBSTANTIAL', 'UNKNOWN'], 'outcome.preexistingImplementationState')
  };
  if (outcome.state === 'VERIFIED_COMPLETE' && (verification.testsExecuted === null || verification.testsFailed !== 0 || verification.verificationDigest === null)) throw new Error('verified complete outcome requires sealed passing verification');

  exactKeys(draft.costObservation, ['basis', 'profileDigest', 'currency', 'moneyMicros', 'energyMilliwattHours', 'carbonMilligrams'], 'cognitive work cost observation');
  const costObservation = {
    basis: enumValue(draft.costObservation.basis, ['MEASURED', 'BILLED', 'PROFILE_ESTIMATED', 'UNKNOWN'], 'costObservation.basis'),
    profileDigest: sha(draft.costObservation.profileDigest, 'costObservation.profileDigest', true),
    currency: draft.costObservation.currency === null ? null : String(draft.costObservation.currency),
    moneyMicros: count(draft.costObservation.moneyMicros, 'costObservation.moneyMicros', true),
    energyMilliwattHours: count(draft.costObservation.energyMilliwattHours, 'costObservation.energyMilliwattHours', true),
    carbonMilligrams: count(draft.costObservation.carbonMilligrams, 'costObservation.carbonMilligrams', true)
  };
  if (costObservation.currency !== null && !/^[A-Z]{3}$/.test(costObservation.currency)) throw new Error('costObservation.currency requires an ISO-style currency token');
  if (costObservation.basis === 'UNKNOWN' && Object.entries(costObservation).some(([key, value]) => key !== 'basis' && value !== null)) throw new Error('unknown cost cannot carry inferred values');
  if (costObservation.basis !== 'UNKNOWN' && costObservation.profileDigest === null) throw new Error('observed or estimated cost requires a bound profile digest');

  exactKeys(draft.permission, ['status', 'basisDigest'], 'cognitive work permission');
  const permission = {
    status: enumValue(draft.permission.status, ['ALLOWED', 'UNKNOWN', 'FORBIDDEN'], 'permission.status'),
    basisDigest: sha(draft.permission.basisDigest, 'permission.basisDigest', true)
  };
  if (permission.status === 'ALLOWED' && permission.basisDigest === null) throw new Error('allowed receipt intake requires a permission basis digest');
  if (permission.status !== 'ALLOWED' && permission.basisDigest !== null) throw new Error('unknown or forbidden permission cannot carry an inferred basis');

  return stable({ source, objective, workShape, execution, outcome, costObservation, permission });
}

function assessmentFor(normalized) {
  const issues = [];
  if (normalized.permission.status !== 'ALLOWED') issues.push('INTAKE_PERMISSION_NOT_ALLOWED');
  if (normalized.source.collectionMethod !== 'DIRECT_MACHINE_METER') issues.push('SOURCE_NOT_DIRECT_MACHINE_METER');
  if (normalized.source.sourceRecordDigest === null) issues.push('SOURCE_RECORD_DIGEST_MISSING');
  if (normalized.source.measurementDefinitionDigest === null) issues.push('MEASUREMENT_DEFINITION_DIGEST_MISSING');
  if (normalized.objective.startingStateDigest === null) issues.push('STARTING_STATE_DIGEST_MISSING');
  if (normalized.objective.endingStateDigest === null) issues.push('ENDING_STATE_DIGEST_MISSING');
  for (const [key, value] of Object.entries({
    MODEL_PROFILE_DIGEST_MISSING: normalized.execution.modelProfileDigest,
    TOOLCHAIN_DIGEST_MISSING: normalized.execution.toolchainDigest,
    ENVIRONMENT_DIGEST_MISSING: normalized.execution.environmentDigest,
    HARDWARE_PROFILE_DIGEST_MISSING: normalized.execution.hardwareProfileDigest
  })) if (value === null) issues.push(key);
  if (normalized.execution.tokenMeter.coverage !== 'COMPLETE') issues.push('TOKEN_METER_NOT_COMPLETE');
  if (normalized.execution.computeMeter.coverage !== 'COMPLETE') issues.push('COMPUTE_METER_NOT_COMPLETE');
  if (normalized.execution.timing.wallMilliseconds === null) issues.push('WALL_TIME_MISSING');
  if (normalized.execution.verification.verificationDigest === null) issues.push('VERIFICATION_DIGEST_MISSING');
  return {
    resourceProfileEligible: issues.length === 0,
    verifiedComplete: normalized.outcome.state === 'VERIFIED_COMPLETE',
    issues: issues.sort(),
    forecastCalibration: 'NOT_EVALUATED'
  };
}

function comparisonBasis(normalized) {
  return {
    objectiveKind: normalized.objective.objectiveKind,
    preexistingImplementationState: normalized.outcome.preexistingImplementationState,
    workShape: normalized.workShape,
    measurementDefinitionDigest: normalized.source.measurementDefinitionDigest,
    modelProfileDigest: normalized.execution.modelProfileDigest,
    toolchainDigest: normalized.execution.toolchainDigest,
    environmentDigest: normalized.execution.environmentDigest,
    hardwareProfileDigest: normalized.execution.hardwareProfileDigest,
    tokenMeterDefinitionId: normalized.execution.tokenMeter.definitionId,
    computeMeterDefinitionId: normalized.execution.computeMeter.definitionId
  };
}

function sealObservation(draft) {
  const normalized = normalizeDraft(draft);
  const assessment = assessmentFor(normalized);
  const observation = {
    schema: OBSERVATION_SCHEMA,
    observationId: null,
    observationDigest: null,
    organ: { id: CELL_ID, learnedWeights: false, costOptimization: false, forecastAuthority: false },
    source: normalized.source,
    objective: normalized.objective,
    workShape: normalized.workShape,
    comparisonKey: digest(comparisonBasis(normalized)),
    execution: normalized.execution,
    outcome: normalized.outcome,
    costObservation: normalized.costObservation,
    permission: normalized.permission,
    assessment,
    authority: {
      factPromotion: false,
      objectiveChange: false,
      modelSelection: false,
      hardwareSelection: false,
      budgetAllocation: false,
      permissionGrant: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'A machine-bound cognitive-work observation records declared and metered resources against one objective and state transition. It is not an intelligence, productivity, universal compute, forecast-accuracy, cheapest-path, model-selection, hardware-selection, budget, permission, training, promotion, canon, or world-action claim.'
  };
  observation.observationId = `cognitive-work-observation-${digest(Object.assign({}, observation, { observationId: null, observationDigest: null })).slice(0, 24)}`;
  observation.observationDigest = digest(Object.assign({}, observation, { observationDigest: null }));
  return stable(observation);
}

function verifyObservation(observation) {
  exactKeys(observation, ['schema', 'observationId', 'observationDigest', 'organ', 'source', 'objective', 'workShape', 'comparisonKey', 'execution', 'outcome', 'costObservation', 'permission', 'assessment', 'authority', 'boundary'], 'cognitive work observation');
  const reconstructed = sealObservation({
    schema: DRAFT_SCHEMA,
    source: observation.source,
    objective: observation.objective,
    workShape: observation.workShape,
    execution: observation.execution,
    outcome: observation.outcome,
    costObservation: observation.costObservation,
    permission: observation.permission
  });
  if (!same(reconstructed, observation)) throw new Error('cognitive work observation content changed');
  return true;
}

function range(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  if (!sorted.length) return null;
  return { minimum: sorted[0], median: sorted[Math.floor((sorted.length - 1) / 2)], maximum: sorted[sorted.length - 1], observations: sorted.length };
}

function buildResourceProfile(observations, comparisonKey) {
  if (!Array.isArray(observations)) throw new Error('cognitive resource profile requires observations');
  sha(comparisonKey, 'comparisonKey');
  for (const observation of observations) verifyObservation(observation);
  const matched = observations.filter(item => item.comparisonKey === comparisonKey).slice().sort((a, b) => a.observationId.localeCompare(b.observationId));
  const eligible = matched.filter(item => item.assessment.resourceProfileEligible === true);
  const distinctStarts = new Set(eligible.map(item => item.objective.startingStateDigest)).size;
  const complete = eligible.filter(item => item.outcome.state === 'VERIFIED_COMPLETE');
  const directCost = eligible.filter(item => ['MEASURED', 'BILLED'].includes(item.costObservation.basis));
  const directCostProfileDigests = Array.from(new Set(directCost.map(item => item.costObservation.profileDigest))).sort();
  const currencies = Array.from(new Set(directCost.map(item => item.costObservation.currency).filter(Boolean))).sort();
  const directCostComparable = directCostProfileDigests.length <= 1 && currencies.length <= 1;
  const directCostAggregationState = !directCost.length
    ? 'NO_DIRECT_COST_OBSERVATIONS'
    : directCostProfileDigests.length > 1
      ? 'HOLD_MULTIPLE_COST_PROFILES'
      : currencies.length > 1
        ? 'HOLD_MULTIPLE_CURRENCIES'
        : 'EXACT_PROFILE_DIRECT_COST_DESCRIPTION';
  const enough = eligible.length >= MIN_COMPARABLE_OBSERVATIONS && distinctStarts >= MIN_DISTINCT_STARTING_STATES;
  const profile = {
    schema: PROFILE_SCHEMA,
    profileId: null,
    profileDigest: null,
    organ: { id: CELL_ID, learnedWeights: false, forecastingModel: false, automaticSelection: false },
    comparisonKey,
    source: {
      observationIds: matched.map(item => item.observationId),
      observationDigests: matched.map(item => item.observationDigest),
      matchedObservations: matched.length,
      eligibleObservations: eligible.length,
      excludedObservations: matched.length - eligible.length,
      distinctStartingStates: distinctStarts
    },
    outcomes: {
      verifiedComplete: matched.filter(item => item.outcome.state === 'VERIFIED_COMPLETE').length,
      verifiedPartial: matched.filter(item => item.outcome.state === 'VERIFIED_PARTIAL').length,
      knownFail: matched.filter(item => item.outcome.state === 'KNOWN_FAIL').length,
      hold: matched.filter(item => item.outcome.state === 'HOLD').length
    },
    resources: {
      allEligibleTotalTokens: range(eligible.map(item => item.execution.tokenMeter.totalTokens)),
      allEligibleWallMilliseconds: range(eligible.map(item => item.execution.timing.wallMilliseconds)),
      allEligibleCpuCoreMilliseconds: range(eligible.filter(item => item.execution.computeMeter.cpuCoreMilliseconds !== null).map(item => item.execution.computeMeter.cpuCoreMilliseconds)),
      allEligibleAcceleratorMilliseconds: range(eligible.filter(item => item.execution.computeMeter.acceleratorMilliseconds !== null).map(item => item.execution.computeMeter.acceleratorMilliseconds)),
      allEligiblePeakMemoryBytes: range(eligible.filter(item => item.execution.computeMeter.peakMemoryBytes !== null).map(item => item.execution.computeMeter.peakMemoryBytes)),
      allEligibleProviderComputeUnitsMicros: range(eligible.filter(item => item.execution.computeMeter.providerComputeUnitsMicros !== null).map(item => item.execution.computeMeter.providerComputeUnitsMicros)),
      verifiedCompleteTotalTokens: range(complete.map(item => item.execution.tokenMeter.totalTokens)),
      verifiedCompleteWallMilliseconds: range(complete.map(item => item.execution.timing.wallMilliseconds)),
      directCostProfileDigests,
      directCostAggregationState,
      directlyObservedMoneyMicros: directCostComparable && currencies.length === 1 && directCost.some(item => item.costObservation.currency === currencies[0] && item.costObservation.moneyMicros !== null)
        ? { currency: currencies[0], range: range(directCost.filter(item => item.costObservation.currency === currencies[0] && item.costObservation.moneyMicros !== null).map(item => item.costObservation.moneyMicros)) }
        : null,
      directlyObservedEnergyMilliwattHours: directCostComparable ? range(directCost.filter(item => item.costObservation.energyMilliwattHours !== null).map(item => item.costObservation.energyMilliwattHours)) : null,
      directlyObservedCarbonMilligrams: directCostComparable ? range(directCost.filter(item => item.costObservation.carbonMilligrams !== null).map(item => item.costObservation.carbonMilligrams)) : null
    },
    calibration: {
      state: enough ? 'INDEPENDENT_PRE_OUTCOME_CALIBRATION_REQUIRED' : 'INSUFFICIENT_COMPARABLE_OBSERVATIONS',
      targetCoverage: null,
      heldOutPredictions: 0,
      observedCoverage: null,
      accuracyClaim: null
    },
    state: enough ? 'DESCRIPTIVE_RESOURCE_PROFILE_NOT_A_CALIBRATED_FORECAST' : 'HOLD_INSUFFICIENT_COMPARABLE_OBSERVATIONS',
    authority: {
      forecastClaim: false,
      costOptimization: false,
      modelSelection: false,
      hardwareSelection: false,
      budgetAllocation: false,
      permissionGrant: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This is an exact-cohort descriptive resource profile. Minimum, median, and maximum observations are not an 80% interval or a future guarantee. A calibrated forecast requires independently sealed predictions made before held-out outcomes. The profile cannot choose a model, hardware, budget, permission, training, promotion, canon, or action.'
  };
  profile.profileId = `cognitive-resource-profile-${digest(Object.assign({}, profile, { profileId: null, profileDigest: null })).slice(0, 24)}`;
  profile.profileDigest = digest(Object.assign({}, profile, { profileDigest: null }));
  return stable(profile);
}

function verifyResourceProfile(profile, observations) {
  if (!Array.isArray(observations)) throw new Error('cognitive resource profile verification requires source observations');
  if (!profile || profile.schema !== PROFILE_SCHEMA || profile.profileDigest !== digest(Object.assign({}, profile, { profileDigest: null }))) throw new Error('cognitive resource profile digest changed');
  const expectedId = `cognitive-resource-profile-${digest(Object.assign({}, profile, { profileId: null, profileDigest: null })).slice(0, 24)}`;
  if (profile.profileId !== expectedId || Object.values(profile.authority || {}).some(Boolean) || profile.calibration.accuracyClaim !== null) throw new Error('cognitive resource profile boundary changed');
  if (!same(buildResourceProfile(observations, profile.comparisonKey), profile)) throw new Error('cognitive resource profile content changed');
  return true;
}

module.exports = {
  CELL_ID, DRAFT_SCHEMA, OBSERVATION_SCHEMA, PROFILE_SCHEMA, MIN_COMPARABLE_OBSERVATIONS, MIN_DISTINCT_STARTING_STATES,
  stable, digest, normalizeDraft, assessmentFor, comparisonBasis, sealObservation, verifyObservation, buildResourceProfile, verifyResourceProfile
};
