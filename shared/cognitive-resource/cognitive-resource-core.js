'use strict';

const crypto = require('crypto');

const OBSERVATION_DRAFT_SCHEMA = 'axm.mirror.cognitive-work-observation-draft/v1';
const ECONOMICS_DRAFT_SCHEMA = 'axm.mirror.cognitive-resource-economics-profile-draft/v1';
const PROFILE_SEAL_SCHEMA = 'axm.cognitive-resource.machine-profile-seal/v1';
const SHA256 = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const MACHINE_TOKEN = /^[A-Z][A-Z0-9_]{0,79}$/;
const SENSITIVE_KEYS = new Set(['prompt','response','hiddenreasoning','reasoningtrace','chainofthought','secret','password','apikey','identity','useridentity','email','privatememory','memorysnapshot','contentsnapshot','rawcontent','messagehistory','conversation','transcript']);
const METRICS = Object.freeze(['ACCELERATOR_MILLISECONDS','CACHED_INPUT_TOKENS','CPU_CORE_MILLISECONDS','INPUT_TOKENS','OUTPUT_TOKENS','PROVIDER_COMPUTE_UNITS_MICROS','REASONING_TOKENS','TOTAL_TOKENS']);
const TOKEN_COMPONENT_METRICS = new Set(['INPUT_TOKENS','CACHED_INPUT_TOKENS','OUTPUT_TOKENS','REASONING_TOKENS']);
const PROFILE_FIELDS = Object.freeze({
  MODEL: ['providerDeclarationId','modelId','modelVersion','contextWindowTokens','capabilities'],
  TOOLCHAIN: ['toolIds','runtimeVersions'],
  ENVIRONMENT: ['osFamily','osVersion','architecture','containerized','runtimeVersions'],
  HARDWARE: ['cpuArchitecture','cpuModelClass','cpuLogicalCores','memoryBytes','acceleratorClass','acceleratorCount'],
  TOKEN_METER_DEFINITION: ['definitionId','coverageMeaning','observedFields','universalComputeClaim'],
  COMPUTE_METER_DEFINITION: ['definitionId','unitKind','observedFields','universalFlopsClaim']
});

function stableValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('non-finite number refused'); return value; }
  if (Array.isArray(value)) {
    const output = [];
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) throw new Error('sparse arrays are refused');
      output.push(stableValue(value[index]));
    }
    return output;
  }
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw new Error('plain JSON objects are required');
  const output = {};
  for (const key of Object.keys(value).sort()) {
    if (['__proto__','prototype','constructor'].includes(key)) throw new Error('unsafe JSON key refused');
    output[key] = stableValue(value[key]);
  }
  return output;
}
function stableStringify(value) { return JSON.stringify(stableValue(value)); }
function clone(value) { return JSON.parse(stableStringify(value)); }
function digest(value) { return crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : stableStringify(value)).digest('hex'); }
function same(left, right) { return stableStringify(left) === stableStringify(right); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(label + ' fields changed');
}
function sensitiveKey(key) { return SENSITIVE_KEYS.has(String(key).replace(/[^a-z0-9]/gi, '').toLowerCase()); }
function assertPrivacySafe(value, trail) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (sensitiveKey(key)) throw new Error('privacy boundary refused field ' + (trail ? trail + '.' : '') + key);
    assertPrivacySafe(value[key], (trail ? trail + '.' : '') + key);
  }
}
function sha(value, field, nullable) { if (value === null && nullable) return null; if (!SHA256.test(String(value || ''))) throw new Error(field + ' requires a SHA-256 digest'); return String(value); }
function id(value, field, nullable) { if (value === null && nullable) return null; const text = String(value || ''); if (!ID.test(text)) throw new Error(field + ' requires a bounded machine identifier'); return text; }
function token(value, field) { const text = String(value || ''); if (!MACHINE_TOKEN.test(text)) throw new Error(field + ' requires a bounded machine token'); return text; }
function count(value, field, nullable, positive) { if (value === null && nullable) return null; if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) throw new Error(field + ' requires a ' + (positive ? 'positive' : 'non-negative') + ' safe integer'); return value; }
function enumValue(value, allowed, field) { if (!allowed.includes(value)) throw new Error(field + ' changed'); return value; }
function tokens(values, field) { if (!Array.isArray(values) || !values.length) throw new Error(field + ' requires at least one machine token'); const result = Array.from(new Set(values.map((value, index) => token(value, field + '[' + index + ']')))).sort(); if (result.length !== values.length) throw new Error(field + ' contains duplicate tokens'); return result; }
function stringList(values, field) { if (!Array.isArray(values)) throw new Error(field + ' must be an array'); const result = values.map((value, index) => id(value, field + '[' + index + ']')).sort(); if (new Set(result).size !== result.length) throw new Error(field + ' contains duplicates'); return result; }
function nullableCounts(value, keys, label) { exactKeys(value, keys, label); return Object.fromEntries(keys.map(key => [key, count(value[key], label + '.' + key, true, false)])); }
function permission(value, label) {
  exactKeys(value, ['status','basisDigest'], label);
  const normalized = { status: enumValue(value.status, ['ALLOWED','UNKNOWN','FORBIDDEN'], label + '.status'), basisDigest: sha(value.basisDigest, label + '.basisDigest', true) };
  if (normalized.status === 'ALLOWED' && normalized.basisDigest === null) throw new Error(label + ' ALLOWED requires a basis digest');
  if (normalized.status !== 'ALLOWED' && normalized.basisDigest !== null) throw new Error(label + ' UNKNOWN or FORBIDDEN cannot carry an inferred basis');
  return normalized;
}

function normalizeTokenMeter(value) {
  exactKeys(value, ['definitionId','coverage','inputTokens','cachedInputTokens','outputTokens','reasoningTokens','totalTokens'], 'cognitive work token meter');
  const meter = { definitionId:id(value.definitionId,'execution.tokenMeter.definitionId',true), coverage:enumValue(value.coverage,['COMPLETE','PARTIAL','UNKNOWN'],'execution.tokenMeter.coverage'), inputTokens:count(value.inputTokens,'execution.tokenMeter.inputTokens',true), cachedInputTokens:count(value.cachedInputTokens,'execution.tokenMeter.cachedInputTokens',true), outputTokens:count(value.outputTokens,'execution.tokenMeter.outputTokens',true), reasoningTokens:count(value.reasoningTokens,'execution.tokenMeter.reasoningTokens',true), totalTokens:count(value.totalTokens,'execution.tokenMeter.totalTokens',true) };
  if (meter.coverage === 'COMPLETE' && (meter.definitionId === null || meter.totalTokens === null)) throw new Error('complete token coverage requires a definition and total');
  if (meter.coverage === 'UNKNOWN' && Object.entries(meter).some(([key, item]) => key !== 'coverage' && item !== null)) throw new Error('unknown token coverage cannot carry inferred token values');
  return meter;
}
function normalizeComputeMeter(value) {
  exactKeys(value, ['definitionId','coverage','cpuCoreMilliseconds','acceleratorMilliseconds','peakMemoryBytes','providerComputeUnitsMicros'], 'cognitive work compute meter');
  const meter = { definitionId:id(value.definitionId,'execution.computeMeter.definitionId',true), coverage:enumValue(value.coverage,['COMPLETE','PARTIAL','UNKNOWN'],'execution.computeMeter.coverage'), cpuCoreMilliseconds:count(value.cpuCoreMilliseconds,'execution.computeMeter.cpuCoreMilliseconds',true), acceleratorMilliseconds:count(value.acceleratorMilliseconds,'execution.computeMeter.acceleratorMilliseconds',true), peakMemoryBytes:count(value.peakMemoryBytes,'execution.computeMeter.peakMemoryBytes',true), providerComputeUnitsMicros:count(value.providerComputeUnitsMicros,'execution.computeMeter.providerComputeUnitsMicros',true) };
  const measured = [meter.cpuCoreMilliseconds,meter.acceleratorMilliseconds,meter.peakMemoryBytes,meter.providerComputeUnitsMicros];
  if (meter.coverage === 'COMPLETE' && (meter.definitionId === null || !measured.some(item => item !== null))) throw new Error('complete compute coverage requires a definition and at least one measured value');
  if (meter.coverage === 'UNKNOWN' && Object.entries(meter).some(([key, item]) => key !== 'coverage' && item !== null)) throw new Error('unknown compute coverage cannot carry inferred compute values');
  return meter;
}

function normalizeObservationDraft(draft) {
  assertPrivacySafe(draft);
  exactKeys(draft, ['schema','source','objective','workShape','execution','outcome','costObservation','permission'], 'cognitive work draft');
  if (draft.schema !== OBSERVATION_DRAFT_SCHEMA) throw new Error('cognitive work draft schema changed');
  exactKeys(draft.source, ['sourceSystemId','sourceRecordId','sourceRecordDigest','collectionMethod','authorshipState','measurementDefinitionDigest'], 'cognitive work source');
  const source = { sourceSystemId:id(draft.source.sourceSystemId,'source.sourceSystemId'), sourceRecordId:id(draft.source.sourceRecordId,'source.sourceRecordId'), sourceRecordDigest:sha(draft.source.sourceRecordDigest,'source.sourceRecordDigest',true), collectionMethod:enumValue(draft.source.collectionMethod,['DIRECT_MACHINE_METER','IMPORTED_ATTESTATION','MANUAL_DECLARATION'],'source.collectionMethod'), authorshipState:enumValue(draft.source.authorshipState,['DECLARED_NOT_CERTIFIED','UNKNOWN'],'source.authorshipState'), measurementDefinitionDigest:sha(draft.source.measurementDefinitionDigest,'source.measurementDefinitionDigest',true) };
  exactKeys(draft.objective, ['objectiveKind','objectiveDigest','startingStateDigest','endingStateDigest'], 'cognitive work objective');
  const objective = { objectiveKind:token(draft.objective.objectiveKind,'objective.objectiveKind'), objectiveDigest:sha(draft.objective.objectiveDigest,'objective.objectiveDigest'), startingStateDigest:sha(draft.objective.startingStateDigest,'objective.startingStateDigest',true), endingStateDigest:sha(draft.objective.endingStateDigest,'objective.endingStateDigest',true) };
  exactKeys(draft.workShape, ['operationKinds','domainKinds','requestedOutputKinds','riskTier','requiredVerificationKinds'], 'cognitive work shape');
  const workShape = { operationKinds:tokens(draft.workShape.operationKinds,'workShape.operationKinds'), domainKinds:tokens(draft.workShape.domainKinds,'workShape.domainKinds'), requestedOutputKinds:tokens(draft.workShape.requestedOutputKinds,'workShape.requestedOutputKinds'), riskTier:enumValue(draft.workShape.riskTier,['LOW','MEDIUM','HIGH','CRITICAL'],'workShape.riskTier'), requiredVerificationKinds:tokens(draft.workShape.requiredVerificationKinds,'workShape.requiredVerificationKinds') };
  exactKeys(draft.execution, ['modelProfileDigest','toolchainDigest','environmentDigest','hardwareProfileDigest','tokenMeter','computeMeter','timing','workCounts','verification'], 'cognitive work execution');
  exactKeys(draft.execution.timing, ['wallMilliseconds','toolMilliseconds'], 'cognitive work timing');
  const timing = { wallMilliseconds:count(draft.execution.timing.wallMilliseconds,'execution.timing.wallMilliseconds',true), toolMilliseconds:count(draft.execution.timing.toolMilliseconds,'execution.timing.toolMilliseconds',true) };
  const workCounts = nullableCounts(draft.execution.workCounts, ['filesExamined','filesChanged','linesAdded','linesRemoved','toolCalls'], 'cognitive work counts');
  exactKeys(draft.execution.verification, ['testsExecuted','testsPassed','testsFailed','testsNotRun','verificationDigest'], 'cognitive work verification');
  const verification = { testsExecuted:count(draft.execution.verification.testsExecuted,'execution.verification.testsExecuted',true), testsPassed:count(draft.execution.verification.testsPassed,'execution.verification.testsPassed',true), testsFailed:count(draft.execution.verification.testsFailed,'execution.verification.testsFailed',true), testsNotRun:count(draft.execution.verification.testsNotRun,'execution.verification.testsNotRun',true), verificationDigest:sha(draft.execution.verification.verificationDigest,'execution.verification.verificationDigest',true) };
  if ([verification.testsExecuted,verification.testsPassed,verification.testsFailed].every(item => item !== null) && verification.testsPassed + verification.testsFailed !== verification.testsExecuted) throw new Error('verification test counts do not reconcile');
  const execution = { modelProfileDigest:sha(draft.execution.modelProfileDigest,'execution.modelProfileDigest',true), toolchainDigest:sha(draft.execution.toolchainDigest,'execution.toolchainDigest',true), environmentDigest:sha(draft.execution.environmentDigest,'execution.environmentDigest',true), hardwareProfileDigest:sha(draft.execution.hardwareProfileDigest,'execution.hardwareProfileDigest',true), tokenMeter:normalizeTokenMeter(draft.execution.tokenMeter), computeMeter:normalizeComputeMeter(draft.execution.computeMeter), timing, workCounts, verification };
  exactKeys(draft.outcome, ['state','status','preexistingImplementationState'], 'cognitive work outcome');
  const outcome = { state:enumValue(draft.outcome.state,['VERIFIED_COMPLETE','VERIFIED_PARTIAL','KNOWN_FAIL','HOLD'],'outcome.state'), status:enumValue(draft.outcome.status,['EXPERIMENTAL','TEST','WORKING','KNOWN_FAIL','NEEDS_REVIEW'],'outcome.status'), preexistingImplementationState:enumValue(draft.outcome.preexistingImplementationState,['NONE','PARTIAL','SUBSTANTIAL','UNKNOWN'],'outcome.preexistingImplementationState') };
  if (outcome.state === 'VERIFIED_COMPLETE' && (verification.testsExecuted === null || verification.testsFailed !== 0 || verification.verificationDigest === null)) throw new Error('verified complete outcome requires sealed passing verification');
  exactKeys(draft.costObservation, ['basis','profileDigest','currency','moneyMicros','energyMilliwattHours','carbonMilligrams'], 'cognitive work cost observation');
  const costObservation = { basis:enumValue(draft.costObservation.basis,['MEASURED','BILLED','PROFILE_ESTIMATED','UNKNOWN'],'costObservation.basis'), profileDigest:sha(draft.costObservation.profileDigest,'costObservation.profileDigest',true), currency:draft.costObservation.currency === null ? null : String(draft.costObservation.currency), moneyMicros:count(draft.costObservation.moneyMicros,'costObservation.moneyMicros',true), energyMilliwattHours:count(draft.costObservation.energyMilliwattHours,'costObservation.energyMilliwattHours',true), carbonMilligrams:count(draft.costObservation.carbonMilligrams,'costObservation.carbonMilligrams',true) };
  if (costObservation.currency !== null && !/^[A-Z]{3}$/.test(costObservation.currency)) throw new Error('costObservation.currency requires an ISO-style currency token');
  if (costObservation.basis === 'UNKNOWN' && Object.entries(costObservation).some(([key, item]) => key !== 'basis' && item !== null)) throw new Error('unknown cost cannot carry inferred values');
  if (costObservation.basis !== 'UNKNOWN' && costObservation.profileDigest === null) throw new Error('observed or estimated cost requires a bound profile digest');
  return stableValue({ schema:OBSERVATION_DRAFT_SCHEMA, source, objective, workShape, execution, outcome, costObservation, permission:permission(draft.permission,'cognitive work permission') });
}

function observationAssessment(draft) {
  const normalized = normalizeObservationDraft(draft), issues = [];
  if (normalized.permission.status !== 'ALLOWED') issues.push('INTAKE_PERMISSION_NOT_ALLOWED');
  if (normalized.source.collectionMethod !== 'DIRECT_MACHINE_METER') issues.push('SOURCE_NOT_DIRECT_MACHINE_METER');
  if (normalized.source.sourceRecordDigest === null) issues.push('SOURCE_RECORD_DIGEST_MISSING');
  if (normalized.source.measurementDefinitionDigest === null) issues.push('MEASUREMENT_DEFINITION_DIGEST_MISSING');
  if (normalized.objective.startingStateDigest === null) issues.push('STARTING_STATE_DIGEST_MISSING');
  if (normalized.objective.endingStateDigest === null) issues.push('ENDING_STATE_DIGEST_MISSING');
  if (normalized.execution.modelProfileDigest === null) issues.push('MODEL_PROFILE_DIGEST_MISSING');
  if (normalized.execution.toolchainDigest === null) issues.push('TOOLCHAIN_DIGEST_MISSING');
  if (normalized.execution.environmentDigest === null) issues.push('ENVIRONMENT_DIGEST_MISSING');
  if (normalized.execution.hardwareProfileDigest === null) issues.push('HARDWARE_PROFILE_DIGEST_MISSING');
  if (normalized.execution.tokenMeter.coverage !== 'COMPLETE') issues.push('TOKEN_METER_NOT_COMPLETE');
  if (normalized.execution.computeMeter.coverage !== 'COMPLETE') issues.push('COMPUTE_METER_NOT_COMPLETE');
  if (normalized.execution.timing.wallMilliseconds === null) issues.push('WALL_TIME_MISSING');
  if (normalized.execution.verification.verificationDigest === null) issues.push('VERIFICATION_DIGEST_MISSING');
  return { normalized, state:issues.length ? 'HOLD_INCOMPLETE_OBSERVATION_DRAFT' : 'READY_FOR_MIRROR_INDEPENDENT_INTAKE', resourceProfileEligible:issues.length === 0, issues:issues.sort(), universalTokenComputeConversion:false, measuredOrBilledCostClaim:false, automaticSelection:false };
}

function normalizeEconomicsDraft(draft) {
  assertPrivacySafe(draft);
  exactKeys(draft, ['schema','source','scope','components','permission'], 'cognitive-resource economics profile draft');
  if (draft.schema !== ECONOMICS_DRAFT_SCHEMA) throw new Error('cognitive-resource economics profile draft schema changed');
  exactKeys(draft.source, ['sourceSystemId','sourceRecordId','sourceRecordDigest','collectionMethod','authorshipState','rateScheduleDigest','effectiveWindowId','freshnessState'], 'economics profile source');
  const source = { sourceSystemId:id(draft.source.sourceSystemId,'source.sourceSystemId'), sourceRecordId:id(draft.source.sourceRecordId,'source.sourceRecordId'), sourceRecordDigest:sha(draft.source.sourceRecordDigest,'source.sourceRecordDigest',true), collectionMethod:enumValue(draft.source.collectionMethod,['DIRECT_BILLING_SCHEDULE','DIRECT_HARDWARE_MEASUREMENT','IMPORTED_ATTESTATION','MANUAL_DECLARATION'],'source.collectionMethod'), authorshipState:enumValue(draft.source.authorshipState,['DECLARED_NOT_CERTIFIED','UNKNOWN'],'source.authorshipState'), rateScheduleDigest:sha(draft.source.rateScheduleDigest,'source.rateScheduleDigest',true), effectiveWindowId:id(draft.source.effectiveWindowId,'source.effectiveWindowId',true), freshnessState:enumValue(draft.source.freshnessState,['CURRENT_DECLARED_NOT_CERTIFIED','HISTORICAL','UNKNOWN'],'source.freshnessState') };
  exactKeys(draft.scope, ['accountingMode','currency','modelProfileDigest','hardwareProfileDigest','tokenMeterDefinitionId','computeMeterDefinitionId'], 'economics profile scope');
  const scope = { accountingMode:enumValue(draft.scope.accountingMode,['PROVIDER_TOKEN_BILLING','PROVIDER_COMPUTE_UNIT_BILLING','LOCAL_HARDWARE_TIME'],'scope.accountingMode'), currency:draft.scope.currency === null ? null : String(draft.scope.currency), modelProfileDigest:sha(draft.scope.modelProfileDigest,'scope.modelProfileDigest',true), hardwareProfileDigest:sha(draft.scope.hardwareProfileDigest,'scope.hardwareProfileDigest',true), tokenMeterDefinitionId:id(draft.scope.tokenMeterDefinitionId,'scope.tokenMeterDefinitionId',true), computeMeterDefinitionId:id(draft.scope.computeMeterDefinitionId,'scope.computeMeterDefinitionId',true) };
  if (scope.currency !== null && !/^[A-Z]{3}$/.test(scope.currency)) throw new Error('scope.currency requires an ISO-style currency token');
  if (!Array.isArray(draft.components) || draft.components.length < 1 || draft.components.length > 8) throw new Error('economics profile requires one to eight components');
  const components = draft.components.map((component, index) => {
    const label = 'economics component[' + index + ']'; exactKeys(component,['metric','quantityDenominator','moneyMicrosPerQuantity','energyMilliwattHoursPerQuantity','carbonMilligramsPerQuantity'],label);
    const item = { metric:enumValue(component.metric,METRICS,label+'.metric'), quantityDenominator:count(component.quantityDenominator,label+'.quantityDenominator',false,true), moneyMicrosPerQuantity:count(component.moneyMicrosPerQuantity,label+'.moneyMicrosPerQuantity',true), energyMilliwattHoursPerQuantity:count(component.energyMilliwattHoursPerQuantity,label+'.energyMilliwattHoursPerQuantity',true), carbonMilligramsPerQuantity:count(component.carbonMilligramsPerQuantity,label+'.carbonMilligramsPerQuantity',true) };
    if ([item.moneyMicrosPerQuantity,item.energyMilliwattHoursPerQuantity,item.carbonMilligramsPerQuantity].every(value => value === null)) throw new Error(label + ' requires at least one declared rate'); return item;
  }).sort((left,right) => left.metric.localeCompare(right.metric));
  if (new Set(components.map(component => component.metric)).size !== components.length) throw new Error('economics profile component metrics must be unique');
  const metrics = new Set(components.map(component => component.metric));
  if (scope.accountingMode === 'PROVIDER_TOKEN_BILLING') { if ([...metrics].some(metric => metric !== 'TOTAL_TOKENS' && !TOKEN_COMPONENT_METRICS.has(metric))) throw new Error('provider token billing contains a non-token metric'); if (metrics.has('TOTAL_TOKENS') && metrics.size > 1) throw new Error('total-token and component-token rates cannot be combined'); }
  if (scope.accountingMode === 'PROVIDER_COMPUTE_UNIT_BILLING' && (metrics.size !== 1 || !metrics.has('PROVIDER_COMPUTE_UNITS_MICROS'))) throw new Error('provider compute-unit billing requires only PROVIDER_COMPUTE_UNITS_MICROS');
  if (scope.accountingMode === 'LOCAL_HARDWARE_TIME' && [...metrics].some(metric => !['CPU_CORE_MILLISECONDS','ACCELERATOR_MILLISECONDS'].includes(metric))) throw new Error('local hardware time contains a non-hardware-time metric');
  if (components.some(component => component.moneyMicrosPerQuantity !== null) && scope.currency === null) throw new Error('money rates require one bound currency');
  return stableValue({ schema:ECONOMICS_DRAFT_SCHEMA, source, scope, components, permission:permission(draft.permission,'economics profile permission') });
}

function economicsAssessment(draft) {
  const normalized = normalizeEconomicsDraft(draft), issues = [];
  if (normalized.permission.status !== 'ALLOWED') issues.push('INTAKE_PERMISSION_NOT_ALLOWED');
  if (normalized.source.sourceRecordDigest === null) issues.push('SOURCE_RECORD_DIGEST_MISSING');
  if (normalized.source.rateScheduleDigest === null) issues.push('RATE_SCHEDULE_DIGEST_MISSING');
  if (normalized.scope.accountingMode === 'PROVIDER_TOKEN_BILLING') { if (normalized.scope.modelProfileDigest === null) issues.push('MODEL_PROFILE_DIGEST_MISSING'); if (normalized.scope.tokenMeterDefinitionId === null) issues.push('TOKEN_METER_DEFINITION_ID_MISSING'); if (normalized.scope.computeMeterDefinitionId !== null) issues.push('UNUSED_COMPUTE_METER_BINDING_PRESENT'); }
  if (normalized.scope.accountingMode === 'PROVIDER_COMPUTE_UNIT_BILLING') { if (normalized.scope.modelProfileDigest === null) issues.push('MODEL_PROFILE_DIGEST_MISSING'); if (normalized.scope.computeMeterDefinitionId === null) issues.push('COMPUTE_METER_DEFINITION_ID_MISSING'); if (normalized.scope.tokenMeterDefinitionId !== null) issues.push('UNUSED_TOKEN_METER_BINDING_PRESENT'); }
  if (normalized.scope.accountingMode === 'LOCAL_HARDWARE_TIME') { if (normalized.scope.hardwareProfileDigest === null) issues.push('HARDWARE_PROFILE_DIGEST_MISSING'); if (normalized.scope.computeMeterDefinitionId === null) issues.push('COMPUTE_METER_DEFINITION_ID_MISSING'); if (normalized.scope.tokenMeterDefinitionId !== null) issues.push('UNUSED_TOKEN_METER_BINDING_PRESENT'); }
  return { normalized, state:issues.length ? 'HOLD_INCOMPLETE_ECONOMICS_PROFILE_DRAFT' : 'READY_FOR_MIRROR_INDEPENDENT_DERIVATION', estimateEligible:issues.length === 0, issues:issues.sort(), externalFreshnessCertified:false, nonlinearBillingSupported:false, universalTokenComputeConversion:false, automaticSelection:false };
}

function compatibility(observationDraft, economicsDraft) {
  const observation = normalizeObservationDraft(observationDraft), profile = normalizeEconomicsDraft(economicsDraft), issues = [];
  if (observation.permission.status !== 'ALLOWED' || profile.permission.status !== 'ALLOWED') issues.push('PERMISSION_NOT_ALLOWED');
  if (observation.costObservation.currency !== null && profile.scope.currency !== null && observation.costObservation.currency !== profile.scope.currency) issues.push('CURRENCY_MISMATCH');
  if (profile.scope.modelProfileDigest !== null && profile.scope.modelProfileDigest !== observation.execution.modelProfileDigest) issues.push('MODEL_PROFILE_BINDING_MISMATCH');
  if (profile.scope.hardwareProfileDigest !== null && profile.scope.hardwareProfileDigest !== observation.execution.hardwareProfileDigest) issues.push('HARDWARE_PROFILE_BINDING_MISMATCH');
  if (profile.scope.accountingMode === 'PROVIDER_TOKEN_BILLING') { if (profile.scope.tokenMeterDefinitionId !== observation.execution.tokenMeter.definitionId) issues.push('TOKEN_METER_DEFINITION_MISMATCH'); if (observation.execution.tokenMeter.coverage !== 'COMPLETE') issues.push('TOKEN_METER_NOT_COMPLETE'); }
  else { if (profile.scope.computeMeterDefinitionId !== observation.execution.computeMeter.definitionId) issues.push('COMPUTE_METER_DEFINITION_MISMATCH'); if (observation.execution.computeMeter.coverage !== 'COMPLETE') issues.push('COMPUTE_METER_NOT_COMPLETE'); }
  const quantities = { INPUT_TOKENS:observation.execution.tokenMeter.inputTokens, CACHED_INPUT_TOKENS:observation.execution.tokenMeter.cachedInputTokens, OUTPUT_TOKENS:observation.execution.tokenMeter.outputTokens, REASONING_TOKENS:observation.execution.tokenMeter.reasoningTokens, TOTAL_TOKENS:observation.execution.tokenMeter.totalTokens, CPU_CORE_MILLISECONDS:observation.execution.computeMeter.cpuCoreMilliseconds, ACCELERATOR_MILLISECONDS:observation.execution.computeMeter.acceleratorMilliseconds, PROVIDER_COMPUTE_UNITS_MICROS:observation.execution.computeMeter.providerComputeUnitsMicros };
  profile.components.forEach(component => { if (quantities[component.metric] === null) issues.push('RESOURCE_METRIC_UNAVAILABLE_' + component.metric); });
  return { compatible:issues.length === 0, issues:Array.from(new Set(issues)).sort(), calculationPerformed:false, rankingPerformed:false, selectionPerformed:false };
}

function normalizeProfileSeal(value) {
  assertPrivacySafe(value);
  exactKeys(value, ['schema','kind','source','attributes','permission'], 'machine profile seal');
  if (value.schema !== PROFILE_SEAL_SCHEMA) throw new Error('machine profile seal schema changed');
  const kind = enumValue(value.kind,Object.keys(PROFILE_FIELDS),'profile.kind'), fields = PROFILE_FIELDS[kind];
  exactKeys(value.source, ['sourceSystemId','sourceRecordId','sourceRecordDigest','collectionMethod','authorshipState'], 'machine profile source');
  const source = { sourceSystemId:id(value.source.sourceSystemId,'source.sourceSystemId'), sourceRecordId:id(value.source.sourceRecordId,'source.sourceRecordId'), sourceRecordDigest:sha(value.source.sourceRecordDigest,'source.sourceRecordDigest',true), collectionMethod:enumValue(value.source.collectionMethod,['DIRECT_MACHINE_METER','IMPORTED_ATTESTATION','MANUAL_DECLARATION'],'source.collectionMethod'), authorshipState:enumValue(value.source.authorshipState,['DECLARED_NOT_CERTIFIED','UNKNOWN'],'source.authorshipState') };
  exactKeys(value.attributes, fields, 'machine profile attributes');
  const attributes = {};
  fields.forEach(field => {
    const item = value.attributes[field];
    if (['contextWindowTokens','cpuLogicalCores','memoryBytes','acceleratorCount'].includes(field)) attributes[field] = count(item,'attributes.'+field,true);
    else if (['containerized','universalComputeClaim','universalFlopsClaim'].includes(field)) { if (typeof item !== 'boolean') throw new Error('attributes.'+field+' must be boolean'); attributes[field] = item; }
    else if (['capabilities','toolIds','runtimeVersions','observedFields'].includes(field)) attributes[field] = stringList(item,'attributes.'+field);
    else attributes[field] = item === null ? null : id(item,'attributes.'+field,true);
  });
  if (attributes.universalComputeClaim === true || attributes.universalFlopsClaim === true) throw new Error('universal compute or FLOP claim refused');
  return stableValue({ schema:PROFILE_SEAL_SCHEMA, kind, source, attributes, permission:permission(value.permission,'machine profile permission') });
}

module.exports = { OBSERVATION_DRAFT_SCHEMA, ECONOMICS_DRAFT_SCHEMA, PROFILE_SEAL_SCHEMA, METRICS, PROFILE_FIELDS, stableValue, stableStringify, clone, digest, same, exactKeys, assertPrivacySafe, sha, id, count, enumValue, permission, normalizeTokenMeter, normalizeComputeMeter, normalizeObservationDraft, observationAssessment, normalizeEconomicsDraft, economicsAssessment, compatibility, normalizeProfileSeal };
