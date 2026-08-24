'use strict';

const base = require('./code-grammar-glass-base.js');
const coreApi = require('./code-grammar-glass-interglass-core.js');
const { hash, deepFreeze, canon, digestCurrent } = base;
const { INTERGLASS_EVENT_TYPES, INTERGLASS_STATES, RESULT_STATES, createInterglassPolicy, validStar, createBrowserSandboxExecutorProfile, sandboxContractBinding } = coreApi;

function validRuntimeReceipt(receipt) {
  return !!receipt && receipt.schema === 'axm.code.interglass-browser-runtime-receipt.v1' && typeof receipt.runtimePayloadDigest === 'string' && typeof receipt.resultModelDigest === 'string';
}

function sealBrowserExecutionReceipt({ request, runtimeReceipt } = {}) {
  if (!request || request.schema !== 'axm.code.interglass-execution-request.v1' || request.result !== 'INTERGLASS_EXECUTION_REQUEST_READY_NOT_EXECUTED' || !digestCurrent(request, 'requestSha256')) {
    return deepFreeze({ schema: 'axm.code.interglass-sandbox-observation.v1', result: 'VALID_READY_INTERGLASS_REQUEST_REQUIRED', authority: 'NONE' });
  }
  if (!validRuntimeReceipt(runtimeReceipt)) {
    return deepFreeze({ schema: 'axm.code.interglass-sandbox-observation.v1', result: 'VALID_BROWSER_RUNTIME_RECEIPT_REQUIRED', authority: 'NONE' });
  }
  const receiptBytes = Buffer.byteLength(canon(runtimeReceipt), 'utf8');
  if (receiptBytes > request.resourceCeilings.maxRuntimeResultBytes) {
    return deepFreeze({ schema: 'axm.code.interglass-sandbox-observation.v1', result: 'RUNTIME_RECEIPT_RESOURCE_HOLD', receiptBytes, authority: 'NONE' });
  }
  const problems = [];
  if (runtimeReceipt.requestSha256 !== request.requestSha256) problems.push('REQUEST_DIGEST_MISMATCH');
  if (runtimeReceipt.candidateModelDigest !== request.candidateModelDigest) problems.push('CANDIDATE_DIGEST_MISMATCH');
  if (runtimeReceipt.executorProfileDigest !== request.executorProfileDigest) problems.push('EXECUTOR_PROFILE_DIGEST_MISMATCH');
  if (runtimeReceipt.resultModelDigest !== request.expectedResultDigest && runtimeReceipt.state === 'PASS_OBSERVED') problems.push('EXPECTED_RESULT_DIGEST_MISMATCH');
  if (runtimeReceipt.attempt !== 1) problems.push('ATTEMPT_CEILING_VIOLATION');
  if (canon(runtimeReceipt.sandboxTokens || []) !== canon(['allow-scripts'])) problems.push('SANDBOX_TOKEN_DRIFT');
  if (runtimeReceipt.cspDigest !== request.executorProfile.cspDigest) problems.push('CSP_DIGEST_MISMATCH');
  if (runtimeReceipt.opaqueOriginObserved !== true) problems.push('OPAQUE_ORIGIN_NOT_OBSERVED');
  if (runtimeReceipt.networkAttemptBlocked !== true) problems.push('NETWORK_BLOCK_NOT_OBSERVED');
  if (runtimeReceipt.sourceWorkspaceWriteObserved !== false) problems.push('SOURCE_WORKSPACE_WRITE_OBSERVED');
  if (runtimeReceipt.childProcessObserved !== false) problems.push('CHILD_PROCESS_OBSERVED');
  if (!RESULT_STATES.has(runtimeReceipt.state)) problems.push('RESULT_STATE_INVALID');
  if (problems.length) {
    const holdCore = {
      schema: 'axm.code.interglass-sandbox-observation.v1',
      version: '1.0.0',
      result: 'CONTAINMENT_OR_RESULT_EVIDENCE_HOLD',
      requestSha256: request.requestSha256,
      problems,
      executionClaimAccepted: false,
      authority: 'NONE'
    };
    return deepFreeze({ ...holdCore, observationSha256: hash(holdCore) });
  }
  const observationResult = runtimeReceipt.state === 'PASS_OBSERVED'
    ? 'INTERGLASS_EXECUTION_OBSERVATION_SEALED_PASS'
    : runtimeReceipt.state === 'FAIL_OBSERVED'
      ? 'INTERGLASS_EXECUTION_OBSERVATION_SEALED_FAIL'
      : runtimeReceipt.state === 'CRASH_OBSERVED'
        ? 'INTERGLASS_EXECUTION_OBSERVATION_SEALED_CRASH'
        : 'INTERGLASS_EXECUTION_OBSERVATION_SEALED_TIMEOUT';
  const core = {
    schema: 'axm.code.interglass-sandbox-observation.v1',
    version: '1.0.0',
    result: observationResult,
    requestSha256: request.requestSha256,
    requestId: request.requestId,
    candidateModelDigest: request.candidateModelDigest,
    executorProfileDigest: request.executorProfileDigest,
    executorClass: request.executorProfile.enforcementClass,
    runtimePayloadDigest: String(runtimeReceipt.runtimePayloadDigest),
    resultClass: runtimeReceipt.state,
    resultModelDigest: String(runtimeReceipt.resultModelDigest),
    resultSummary: runtimeReceipt.resultSummary || null,
    containmentEvidence: {
      sandboxTokens: ['allow-scripts'],
      cspDigest: runtimeReceipt.cspDigest,
      opaqueOriginObserved: true,
      networkAttemptBlocked: true,
      sourceWorkspaceWriteObserved: false,
      childProcessObserved: false,
      browserSandboxIsNotOsSandbox: true
    },
    attempt: 1,
    executionOccurred: true,
    transientPayloadReleased: runtimeReceipt.transientPayloadReleased === true,
    persistence: {
      intent: request.persistenceIntent,
      fullSaveSlotConsumed: false,
      fullSaveStillRequiresSeparateExistingSandboxBinding: request.persistenceIntent === 'FULL_SAVE_REQUEST'
    },
    returnPath: {
      draftStarEvidenceCandidate: true,
      constellationLedgerEventCandidate: true,
      productionDraftEvidenceCandidate: true,
      automaticTwisterReentry: false,
      automaticSecondExecution: false
    },
    truth: {
      candidateExecuted: true,
      runtimeQualityProven: false,
      correctnessProven: false,
      usefulnessProven: false,
      safetyProven: false,
      admissionGranted: false,
      selectionGranted: false,
      promotionGranted: false,
      mergeGranted: false,
      canonChanged: false,
      successfulRunIsOnlyOneObservation: true
    },
    authority: 'NONE'
  };
  return deepFreeze({ ...core, observationSha256: hash(core) });
}

function createExecutionReturnPacket({ star, observation } = {}) {
  if (!validStar(star) || !observation || observation.schema !== 'axm.code.interglass-sandbox-observation.v1' || !observation.observationSha256 || !digestCurrent(observation, 'observationSha256')) {
    return deepFreeze({ schema: 'axm.code.interglass-execution-return-packet.v1', result: 'VALID_STAR_AND_SEALED_OBSERVATION_REQUIRED', authority: 'NONE' });
  }
  const core = {
    schema: 'axm.code.interglass-execution-return-packet.v1',
    version: '1.0.0',
    result: 'INTERGLASS_EXECUTION_EVIDENCE_RETURN_READY_NO_REENTRY',
    draftStarSha256: star.starSha256,
    observationSha256: observation.observationSha256,
    resultClass: observation.resultClass,
    candidateModelDigest: observation.candidateModelDigest,
    runtimePayloadDigest: observation.runtimePayloadDigest,
    resultModelDigest: observation.resultModelDigest,
    evidenceTargets: ['DRAFT_STAR_EVIDENCE', 'CONSTELLATION_LEDGER', 'PRODUCTION_DRAFT_EVIDENCE'],
    automaticReentry: false,
    automaticRepeatExecution: false,
    automaticGrammarMutation: false,
    automaticLearningAdmission: false,
    truth: {
      returnPacketIsEvidenceNotAuthority: true,
      executionResultDoesNotRewriteTwister: true,
      resultDoesNotSelectItself: true
    },
    authority: 'NONE'
  };
  return deepFreeze({ ...core, returnPacketSha256: hash(core) });
}

function visualState({ candidateModel = null, runRequest = null, observation = null, returnPacket = null } = {}) {
  let state = 'EMPTY';
  if (candidateModel && candidateModel.candidateModelDigest) state = 'CANDIDATE_RECEIVED';
  if (runRequest && runRequest.result === 'EXECUTION_HELD_NO_ADAPTER') state = 'EXECUTION_HELD_NO_ADAPTER';
  if (runRequest && runRequest.result === 'INTERGLASS_EXECUTION_REQUEST_READY_NOT_EXECUTED') state = 'EXECUTION_READY';
  if (observation && observation.observationSha256) state = 'RESULT_SEALED';
  const core = {
    schema: 'axm.code.interglass-visual-state.v1',
    version: '1.0.0',
    state,
    candidateModel,
    runRequest,
    executionObservation: observation,
    returnPacket,
    availableStates: INTERGLASS_STATES,
    eventTypes: INTERGLASS_EVENT_TYPES,
    sandboxContractBinding: sandboxContractBinding(),
    truth: {
      visualStateDoesNotExecuteCandidate: true,
      browserExecutorMustProduceRuntimeReceipt: true,
      noCannedSuccessState: true
    },
    authority: 'NONE'
  };
  return deepFreeze({ ...core, visualStateSha256: hash(core) });
}

function augmentVisualSnapshot({ visualSnapshot, interglass } = {}) {
  if (!visualSnapshot || visualSnapshot.schema !== 'axm.code.grammar-glass-visual-snapshot.v1' || !visualSnapshot.visualSnapshotSha256 || !interglass || !interglass.visualStateSha256) {
    throw new Error('GRAMMAR_GLASS_VALID_VISUAL_AND_INTERGLASS_STATE_REQUIRED');
  }
  const core = {
    ...visualSnapshot,
    version: '1.3.0',
    result: 'DRAFTSKY_VISUAL_SNAPSHOT_READY_WITH_DOUBLE_GLASS_INTERGLASS',
    interglass,
    doubleGlass: {
      outerGlass: 'REACTIVE_DRAFT_MIRROR_GLASS',
      interglassLane: 'VISIBLE_SEEDED_CREATION_AND_EXECUTION_HANDOFF',
      innerGlass: 'DISPOSABLE_BROWSER_SANDBOX',
      returnLane: 'DIGEST_BOUND_EXECUTION_EVIDENCE_ONLY'
    },
    truth: {
      ...visualSnapshot.truth,
      interglassCandidateIsStructuredDataBeforeExecution: true,
      browserExecutionRequiresExplicitRunAction: true,
      animationDoesNotCreateEvidence: true,
      sandboxPassDoesNotProveCorrectness: true,
      automaticReentryDisabled: true
    }
  };
  delete core.visualSnapshotSha256;
  return deepFreeze({ ...core, visualSnapshotSha256: hash(core) });
}

function snapshot() {
  const policy = createInterglassPolicy();
  const executor = createBrowserSandboxExecutorProfile({ policy });
  const core = {
    schema: 'axm.code.grammar-glass-interglass-snapshot.v1',
    version: '1.0.0',
    status: 'TEST',
    seriousName: 'INTERGLASS SANDBOX EXECUTION LANE',
    internalName: 'DOUBLE GLASS',
    policySha256: policy.policySha256,
    executorProfileDigest: executor.executorProfileDigest,
    donorPatternUse: policy.donorPatterns,
    provides: [
      'detached structured runnable-candidate model',
      'one-attempt digest-bound execution request',
      'browser sandbox executor profile',
      'sealed execution observation',
      'evidence-only return packet',
      'double-glass visual state'
    ],
    truth: {
      browserSandboxIsRealBrowserEnforcementButNotOsSandbox: true,
      metadataModuleDoesNotExecuteCandidate: true,
      executionResultDoesNotGrantAuthority: true,
      runtimeQualityNotProvenBySinglePass: true,
      sourceBytesRemainTransientToExecutor: true,
      noAutomaticRepeatOrReentry: true
    },
    authority: 'NONE'
  };
  return deepFreeze({ ...core, snapshotSha256: hash(core) });
}


module.exports = Object.freeze({
  sealBrowserExecutionReceipt,
  createExecutionReturnPacket,
  visualState,
  augmentVisualSnapshot,
  snapshot
});
