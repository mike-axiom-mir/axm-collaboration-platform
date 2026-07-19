'use strict';

const Core = require('./cognitive-resource-core');

const GOAL_RECEIPT_SCHEMA = 'axm.workshop.codex-goal-completion-receipt/v1';
const ISSUE_GUIDANCE = Object.freeze({
  INTAKE_PERMISSION_NOT_ALLOWED: 'The evidence permission is not ALLOWED. Add an explicit basis digest before archiving.',
  SOURCE_NOT_DIRECT_MACHINE_METER: 'The source is imported or declared, not a direct live machine meter. Keep that limitation visible.',
  SOURCE_RECORD_DIGEST_MISSING: 'Bind the exact source receipt bytes with a SHA-256 digest.',
  MEASUREMENT_DEFINITION_DIGEST_MISSING: 'Bind the meter definition digest so the quantities have a stable meaning.',
  STARTING_STATE_DIGEST_MISSING: 'Seal a privacy-safe starting-state digest or leave the draft held.',
  ENDING_STATE_DIGEST_MISSING: 'Seal a privacy-safe ending-state digest or leave the draft held.',
  MODEL_PROFILE_DIGEST_MISSING: 'Choose or seal the model profile used for this run.',
  TOOLCHAIN_DIGEST_MISSING: 'Choose or seal the toolchain profile used for this run.',
  ENVIRONMENT_DIGEST_MISSING: 'Choose or seal the environment profile used for this run.',
  HARDWARE_PROFILE_DIGEST_MISSING: 'Choose or seal the hardware profile used for this run.',
  TOKEN_METER_NOT_COMPLETE: 'The token meter is partial or unknown; missing quantities must remain null.',
  COMPUTE_METER_NOT_COMPLETE: 'The compute meter is partial or unknown; it cannot support complete-compute claims.',
  WALL_TIME_MISSING: 'No wall-clock duration was observed for this run.',
  VERIFICATION_DIGEST_MISSING: 'Bind the exact verification evidence digest.',
  RATE_SCHEDULE_DIGEST_MISSING: 'Bind the exact rate schedule bytes before treating the profile as derivation-ready.',
  TOKEN_METER_DEFINITION_ID_MISSING: 'Provider-token mode needs the exact token meter definition ID.',
  COMPUTE_METER_DEFINITION_ID_MISSING: 'This accounting mode needs the exact compute meter definition ID.',
  UNUSED_COMPUTE_METER_BINDING_PRESENT: 'Remove the compute-meter binding from provider-token mode.',
  UNUSED_TOKEN_METER_BINDING_PRESENT: 'Remove the token-meter binding from this non-token mode.'
});

function normalizeGoalReceipt(value) {
  Core.assertPrivacySafe(value);
  Core.exactKeys(value, ['schema','goalRunId','objectiveDigest','startingStateDigest','endingStateDigest','workShape','profiles','totalTokens','timing','workCounts','verification','outcome','permission'], 'Codex goal completion receipt');
  if (value.schema !== GOAL_RECEIPT_SCHEMA) throw new Error('Codex goal completion receipt schema changed');
  Core.exactKeys(value.workShape, ['operationKinds','domainKinds','requestedOutputKinds','riskTier','requiredVerificationKinds'], 'goal receipt work shape');
  Core.exactKeys(value.profiles, ['modelProfileDigest','toolchainDigest','environmentDigest','hardwareProfileDigest'], 'goal receipt profiles');
  Core.exactKeys(value.timing, ['wallMilliseconds','toolMilliseconds'], 'goal receipt timing');
  Core.exactKeys(value.workCounts, ['filesExamined','filesChanged','linesAdded','linesRemoved','toolCalls'], 'goal receipt work counts');
  Core.exactKeys(value.verification, ['testsExecuted','testsPassed','testsFailed','testsNotRun','verificationDigest'], 'goal receipt verification');
  Core.exactKeys(value.outcome, ['state','status','preexistingImplementationState'], 'goal receipt outcome');
  const verification = {
    testsExecuted:Core.count(value.verification.testsExecuted,'verification.testsExecuted',true),
    testsPassed:Core.count(value.verification.testsPassed,'verification.testsPassed',true),
    testsFailed:Core.count(value.verification.testsFailed,'verification.testsFailed',true),
    testsNotRun:Core.count(value.verification.testsNotRun,'verification.testsNotRun',true),
    verificationDigest:Core.sha(value.verification.verificationDigest,'verification.verificationDigest',true)
  };
  if ([verification.testsExecuted,verification.testsPassed,verification.testsFailed].every(item => item !== null) && verification.testsPassed + verification.testsFailed !== verification.testsExecuted) throw new Error('goal receipt verification counts do not reconcile');
  const nullableDigest = (item, field) => Core.sha(item, field, true);
  return Core.stableValue({
    schema:GOAL_RECEIPT_SCHEMA,
    goalRunId:Core.id(value.goalRunId,'goalRunId'),
    objectiveDigest:Core.sha(value.objectiveDigest,'objectiveDigest'),
    startingStateDigest:nullableDigest(value.startingStateDigest,'startingStateDigest'),
    endingStateDigest:nullableDigest(value.endingStateDigest,'endingStateDigest'),
    workShape:{
      operationKinds:value.workShape.operationKinds.slice().map(item=>Core.enumValue(item,['BUILD','REVIEW','RESEARCH','TEST','DESIGN','OPERATE'],'workShape.operationKinds')).sort(),
      domainKinds:value.workShape.domainKinds.slice().map(item=>Core.enumValue(item,['SOFTWARE','RESEARCH','MEDIA','OPERATIONS','GENERAL'],'workShape.domainKinds')).sort(),
      requestedOutputKinds:value.workShape.requestedOutputKinds.slice().map(item=>Core.id(item,'workShape.requestedOutputKinds')).sort(),
      riskTier:Core.enumValue(value.workShape.riskTier,['LOW','MEDIUM','HIGH','CRITICAL'],'workShape.riskTier'),
      requiredVerificationKinds:value.workShape.requiredVerificationKinds.slice().map(item=>Core.id(item,'workShape.requiredVerificationKinds')).sort()
    },
    profiles:{
      modelProfileDigest:nullableDigest(value.profiles.modelProfileDigest,'profiles.modelProfileDigest'),
      toolchainDigest:nullableDigest(value.profiles.toolchainDigest,'profiles.toolchainDigest'),
      environmentDigest:nullableDigest(value.profiles.environmentDigest,'profiles.environmentDigest'),
      hardwareProfileDigest:nullableDigest(value.profiles.hardwareProfileDigest,'profiles.hardwareProfileDigest')
    },
    totalTokens:Core.count(value.totalTokens,'totalTokens',true),
    timing:{wallMilliseconds:Core.count(value.timing.wallMilliseconds,'timing.wallMilliseconds',true),toolMilliseconds:Core.count(value.timing.toolMilliseconds,'timing.toolMilliseconds',true)},
    workCounts:Object.fromEntries(Object.keys(value.workCounts).sort().map(key=>[key,Core.count(value.workCounts[key],'workCounts.'+key,true)])),
    verification,
    outcome:{state:Core.enumValue(value.outcome.state,['VERIFIED_COMPLETE','VERIFIED_PARTIAL','KNOWN_FAIL','HOLD'],'outcome.state'),status:Core.enumValue(value.outcome.status,['EXPERIMENTAL','TEST','WORKING','KNOWN_FAIL','NEEDS_REVIEW'],'outcome.status'),preexistingImplementationState:Core.enumValue(value.outcome.preexistingImplementationState,['NONE','PARTIAL','SUBSTANTIAL','UNKNOWN'],'outcome.preexistingImplementationState')},
    permission:Core.permission(value.permission,'goal receipt permission')
  });
}

function observationFromGoalReceipt(value, catalog) {
  const receipt = normalizeGoalReceipt(value);
  const definition = catalog.meterDefinitions.find(item => item.id === 'axm.workshop.codex-goal-total-tokens/v1');
  if (!definition) throw new Error('Codex goal token meter declaration is missing');
  const draft = {
    schema:Core.OBSERVATION_DRAFT_SCHEMA,
    source:{sourceSystemId:'openai.codex.goal-tracker',sourceRecordId:receipt.goalRunId,sourceRecordDigest:Core.digest(receipt),collectionMethod:'IMPORTED_ATTESTATION',authorshipState:'DECLARED_NOT_CERTIFIED',measurementDefinitionDigest:Core.digest(definition)},
    objective:{objectiveKind:'SOFTWARE_BUILD',objectiveDigest:receipt.objectiveDigest,startingStateDigest:receipt.startingStateDigest,endingStateDigest:receipt.endingStateDigest},
    workShape:receipt.workShape,
    execution:{modelProfileDigest:receipt.profiles.modelProfileDigest,toolchainDigest:receipt.profiles.toolchainDigest,environmentDigest:receipt.profiles.environmentDigest,hardwareProfileDigest:receipt.profiles.hardwareProfileDigest,tokenMeter:{definitionId:'axm.workshop.codex-goal-total-tokens/v1',coverage:receipt.totalTokens===null?'PARTIAL':'COMPLETE',inputTokens:null,cachedInputTokens:null,outputTokens:null,reasoningTokens:null,totalTokens:receipt.totalTokens},computeMeter:{definitionId:null,coverage:'UNKNOWN',cpuCoreMilliseconds:null,acceleratorMilliseconds:null,peakMemoryBytes:null,providerComputeUnitsMicros:null},timing:receipt.timing,workCounts:receipt.workCounts,verification:receipt.verification},
    outcome:receipt.outcome,
    costObservation:{basis:'UNKNOWN',profileDigest:null,currency:null,moneyMicros:null,energyMilliwattHours:null,carbonMilligrams:null},
    permission:receipt.permission
  };
  return Core.normalizeObservationDraft(draft);
}

function explainAssessment(assessment) {
  const issues = Array.isArray(assessment && assessment.issues) ? assessment.issues : [];
  return { state:assessment && assessment.state || 'UNKNOWN', ready:issues.length===0, issues:issues.map(code=>({code,guidance:ISSUE_GUIDANCE[code]||('Inspect the exact contract binding for '+code+'.')})), calculationPerformed:false, automaticRepair:false };
}

function timeline(records) {
  const observations=[],rates=[],profiles=[];
  (records||[]).forEach(wrapper=>{
    const record=wrapper.record,item={recordId:wrapper.recordId,digest:wrapper.recordDigest,handId:wrapper.handId,state:wrapper.indexState||'UNKNOWN',createdAt:wrapper.createdAt||null,sourceRecordId:record.source&&record.source.sourceRecordId||null};
    if(wrapper.kind==='OBSERVATION_DRAFT')observations.push(Object.assign(item,{tokenMeter:record.execution.tokenMeter,computeMeter:record.execution.computeMeter,timing:record.execution.timing,verification:record.execution.verification,outcome:record.outcome,costObservation:record.costObservation}));
    else if(wrapper.kind==='ECONOMICS_PROFILE_DRAFT')rates.push(Object.assign(item,{freshnessState:record.source.freshnessState,accountingMode:record.scope.accountingMode,currency:record.scope.currency,components:record.components}));
    else if(wrapper.kind==='MACHINE_PROFILE')profiles.push(Object.assign(item,{profileKind:record.kind,attributes:record.attributes}));
  });
  return {schema:'axm.cognitive-resource.timeline/v1',observations,rates,profiles,dimensions:['TOKENS','PROVIDER_COMPUTE_UNITS','CPU_TIME','ACCELERATOR_TIME','WALL_TIME','MONEY','ENERGY','CARBON','VERIFICATION'],compositeScore:false,calculationPerformed:false};
}

module.exports = { GOAL_RECEIPT_SCHEMA, ISSUE_GUIDANCE, normalizeGoalReceipt, observationFromGoalReceipt, explainAssessment, timeline };

