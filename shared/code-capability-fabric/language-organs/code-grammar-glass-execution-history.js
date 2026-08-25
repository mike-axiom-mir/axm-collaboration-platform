'use strict';

const base = require('./code-grammar-glass-base.js');
const {
  AUTHORITY,
  hash,
  deepFreeze,
  digestCurrent,
  containsRawPrivateOrSource,
  clean,
  strings
} = base;

const EXECUTION_HISTORY_RESULT_CLASSES = Object.freeze([
  'PASS_OBSERVED',
  'FAIL_OBSERVED',
  'CRASH_OBSERVED',
  'TIMEOUT_OBSERVED',
  'HELD'
]);

const EXECUTION_HISTORY_EVENT_TYPES = Object.freeze([
  'EXECUTION_RUN_STAR_APPENDED',
  'EXECUTION_HOLD_STAR_APPENDED',
  'EXECUTION_REPLAY_REQUEST_CAPTURED'
]);

const HOLD_CLASSES = new Set([
  'EXECUTION_HELD_NO_ADAPTER',
  'RESOURCE_HOLD',
  'CONTAINMENT_EVIDENCE_MISSING',
  'FULL_SAVE_HELD',
  'EXECUTION_POLICY_HOLD'
]);

function validHistory(history) {
  return !!history &&
    history.schema === 'axm.code.grammar-glass-execution-history.v1' &&
    digestCurrent(history, 'executionHistorySha256');
}

function validStar(star) {
  return !!star &&
    star.schema === 'axm.code.grammar-glass-draft-star.v1' &&
    digestCurrent(star, 'starSha256');
}

function validObservation(observation) {
  return !!observation &&
    observation.schema === 'axm.code.interglass-sandbox-observation.v1' &&
    digestCurrent(observation, 'observationSha256');
}

function validReturnPacket(packet) {
  return !!packet &&
    packet.schema === 'axm.code.interglass-execution-return-packet.v1' &&
    digestCurrent(packet, 'returnPacketSha256');
}

function validRunStar(runStar) {
  return !!runStar &&
    runStar.schema === 'axm.code.grammar-glass-execution-run-star.v1' &&
    digestCurrent(runStar, 'runStarSha256');
}

function resultEventType(resultClass) {
  return resultClass === 'HELD' ? 'EXECUTION_HOLD_STAR_APPENDED' : 'EXECUTION_RUN_STAR_APPENDED';
}

function derivePosition(digest) {
  const a = Number.parseInt(String(digest).slice(0, 12), 16) / 0xffffffffffff;
  const r = Number.parseInt(String(digest).slice(12, 24), 16) / 0xffffffffffff;
  const angle = a * Math.PI * 2;
  const radius = 0.17 + r * 0.76;
  return deepFreeze({
    x: Number((Math.cos(angle) * radius).toFixed(6)),
    y: Number((Math.sin(angle) * radius).toFixed(6)),
    radius: Number(radius.toFixed(6)),
    positionBasis: 'RUN_STAR_DIGEST_ONLY_NOT_QUALITY'
  });
}

function createExecutionHistory({ dayStart, interglassPolicySha256 = null } = {}) {
  if (!dayStart || !digestCurrent(dayStart, 'dayStartSha256')) {
    throw new Error('GRAMMAR_GLASS_VALID_DAY_START_REQUIRED_FOR_EXECUTION_HISTORY');
  }
  const core = {
    schema: 'axm.code.grammar-glass-execution-history.v1',
    version: '1.0.0',
    result: 'EXECUTION_HISTORY_READY_APPEND_ONLY',
    dayId: dayStart.dayId,
    dayStartSha256: dayStart.dayStartSha256,
    rootSeed: dayStart.rootSeed,
    profileSnapshotSha256: dayStart.profileSnapshotSha256,
    organRegistrySnapshotSha256: dayStart.organRegistrySnapshotSha256,
    interglassPolicySha256: interglassPolicySha256 == null ? null : String(interglassPolicySha256),
    events: [],
    runStars: [],
    eventCount: 0,
    runStarCount: 0,
    headEventSha256: null,
    resultCounts: {
      PASS_OBSERVED: 0,
      FAIL_OBSERVED: 0,
      CRASH_OBSERVED: 0,
      TIMEOUT_OBSERVED: 0,
      HELD: 0
    },
    truth: {
      appendOnly: true,
      passAndFailureRetainedEquallyAsEvidenceClasses: true,
      countIsNotQuality: true,
      noAutomaticTwisterReentry: true,
      noAutomaticRepeatExecution: true,
      noAutomaticGrammarMutation: true,
      noAutomaticLearningAdmission: true,
      browserLocalReceiptChainIsNotIndependentRuntimeProof: true
    },
    authority: AUTHORITY
  };
  return deepFreeze({ ...core, executionHistorySha256: hash(core) });
}

function lineageFromStar(star) {
  return {
    draftStarSha256: star.starSha256,
    rootSeed: star.rootSeed,
    formationSeed: star.derivedFormationSeed,
    cycleStep: star.cycleStep,
    conditionDigest: star.conditionDigest,
    profileSnapshotDigest: star.profileSnapshotDigest,
    contributingGrammarIdentities: [...(star.contributingGrammarIdentities || [])],
    typedAtomAncestry: (star.typedAtomAncestry || []).map(item => ({ atomId: item.atomId, atomSha256: item.atomSha256 })),
    compositeKind: star.compositeKind || null,
    compositeLineageDigest: star.compositeLineageDigest || null,
    grammarComponentLineage: Array.isArray(star.grammarComponentLineage) ? star.grammarComponentLineage : []
  };
}

function buildRunStar({ history, star, resultClass, requestSha256 = null, observationSha256 = null, returnPacketSha256 = null, candidateModelDigest = null, executorProfileDigest = null, runtimePayloadDigest = null, resultModelDigest = null, holdClass = null, evidenceDigest = null, persistence = null } = {}) {
  if (!validHistory(history) || !validStar(star)) throw new Error('GRAMMAR_GLASS_VALID_HISTORY_AND_DRAFT_STAR_REQUIRED');
  if (!EXECUTION_HISTORY_RESULT_CLASSES.includes(resultClass)) throw new Error('GRAMMAR_GLASS_EXECUTION_HISTORY_RESULT_CLASS_INVALID');
  const sequence = history.runStarCount + 1;
  const lineage = lineageFromStar(star);
  const core = {
    schema: 'axm.code.grammar-glass-execution-run-star.v1',
    version: '1.0.0',
    result: resultClass === 'HELD' ? 'EXECUTION_HOLD_STAR_READY' : 'EXECUTION_RUN_STAR_READY',
    runStarId: null,
    sequence,
    dayStartSha256: history.dayStartSha256,
    parentHistoryEventSha256: history.headEventSha256,
    ...lineage,
    requestSha256,
    observationSha256,
    returnPacketSha256,
    candidateModelDigest,
    executorProfileDigest,
    runtimePayloadDigest,
    resultModelDigest,
    resultClass,
    holdClass,
    evidenceDigest,
    persistence: {
      mode: persistence && persistence.mode ? String(persistence.mode) : 'LIGHTWEIGHT_EXECUTION_RECEIPT',
      fullSaveSlotConsumed: !!(persistence && persistence.fullSaveSlotConsumed),
      fiveSlotContractStillApplies: true
    },
    replayRequirements: [
      `dayStart:${history.dayStartSha256}`,
      `draftStar:${star.starSha256}`,
      `rootSeed:${star.rootSeed}`,
      `formationSeed:${star.derivedFormationSeed}`,
      `condition:${star.conditionDigest}`,
      `candidate:${candidateModelDigest || 'HELD_NO_CANDIDATE'}`,
      `request:${requestSha256 || 'HELD_NO_REQUEST'}`,
      `executor:${executorProfileDigest || 'HELD_NO_EXECUTOR'}`,
      `observation:${observationSha256 || 'HELD_NO_OBSERVATION'}`
    ],
    metrics: {
      qualityScore: null,
      utilityScore: null,
      noveltyScore: null,
      brightnessMeaning: 'RESULT_CLASS_VISIBILITY_AND_REPLAY_RECEIPT_ONLY_NOT_QUALITY'
    },
    truth: {
      immutableReceipt: true,
      runStarIsNotDraftStarReplacement: true,
      passDoesNotProveCorrectness: true,
      passDoesNotProveUsefulness: true,
      failureIsRetainedNotErased: true,
      replayDoesNotProveRealWorldCorrectness: true,
      runCountIsNotQuality: true,
      automaticTwisterReentry: false,
      automaticRepeatExecution: false,
      automaticGrammarMutation: false,
      automaticLearningAdmission: false,
      automaticSelectionPromotionMergeCanon: false
    },
    authority: 'NONE'
  };
  const idDigest = hash({
    dayStartSha256: history.dayStartSha256,
    sequence,
    draftStarSha256: star.starSha256,
    resultClass,
    observationSha256,
    requestSha256,
    holdClass,
    evidenceDigest
  });
  core.runStarId = `execution-star:${idDigest.slice(0, 24)}`;
  return deepFreeze({ ...core, runStarSha256: hash(core) });
}

function appendRunStar(history, runStar) {
  if (!validHistory(history) || !validRunStar(runStar)) throw new Error('GRAMMAR_GLASS_VALID_HISTORY_AND_RUN_STAR_REQUIRED');
  const eventCore = {
    schema: 'axm.code.grammar-glass-execution-history-event.v1',
    version: '1.0.0',
    sequence: history.eventCount + 1,
    eventType: resultEventType(runStar.resultClass),
    parentEventSha256: history.headEventSha256,
    runStarSha256: runStar.runStarSha256,
    draftStarSha256: runStar.draftStarSha256,
    resultClass: runStar.resultClass,
    observationSha256: runStar.observationSha256,
    requestSha256: runStar.requestSha256
  };
  const event = deepFreeze({ ...eventCore, eventSha256: hash(eventCore) });
  const counts = { ...history.resultCounts, [runStar.resultClass]: (history.resultCounts[runStar.resultClass] || 0) + 1 };
  const core = {
    ...history,
    result: 'EXECUTION_HISTORY_APPENDED',
    events: [...history.events, event],
    runStars: [...history.runStars, runStar],
    eventCount: history.eventCount + 1,
    runStarCount: history.runStarCount + 1,
    headEventSha256: event.eventSha256,
    resultCounts: counts
  };
  delete core.executionHistorySha256;
  return deepFreeze({ ...core, executionHistorySha256: hash(core) });
}

function appendExecutionObservation({ history, star, observation, returnPacket } = {}) {
  const rawPath = containsRawPrivateOrSource({ star, observation, returnPacket });
  if (rawPath) {
    return deepFreeze({ schema: 'axm.code.grammar-glass-execution-history-append-result.v1', result: 'EXECUTION_HISTORY_REFUSED_RAW_PRIVATE_OR_SOURCE_FIELD', refusedPath: rawPath, history, authority: 'NONE' });
  }
  if (!validHistory(history) || !validStar(star) || !validObservation(observation) || !validReturnPacket(returnPacket)) {
    return deepFreeze({ schema: 'axm.code.grammar-glass-execution-history-append-result.v1', result: 'VALID_HISTORY_STAR_OBSERVATION_AND_RETURN_PACKET_REQUIRED', history, authority: 'NONE' });
  }
  if (returnPacket.draftStarSha256 !== star.starSha256 || returnPacket.observationSha256 !== observation.observationSha256 || returnPacket.resultClass !== observation.resultClass) {
    return deepFreeze({ schema: 'axm.code.grammar-glass-execution-history-append-result.v1', result: 'EXECUTION_RETURN_LINEAGE_MISMATCH_HELD', history, authority: 'NONE' });
  }
  if (history.runStars.some(runStar => runStar.observationSha256 === observation.observationSha256)) {
    return deepFreeze({
      schema: 'axm.code.grammar-glass-execution-history-append-result.v1',
      result: 'DUPLICATE_EXECUTION_OBSERVATION_HELD_NOT_DOUBLE_COUNTED',
      duplicateObservationSha256: observation.observationSha256,
      history,
      authority: 'NONE'
    });
  }
  const runStar = buildRunStar({
    history,
    star,
    resultClass: observation.resultClass,
    requestSha256: observation.requestSha256,
    observationSha256: observation.observationSha256,
    returnPacketSha256: returnPacket.returnPacketSha256,
    candidateModelDigest: observation.candidateModelDigest,
    executorProfileDigest: observation.executorProfileDigest,
    runtimePayloadDigest: observation.runtimePayloadDigest,
    resultModelDigest: observation.resultModelDigest,
    persistence: observation.persistence
  });
  const nextHistory = appendRunStar(history, runStar);
  return deepFreeze({
    schema: 'axm.code.grammar-glass-execution-history-append-result.v1',
    result: 'EXECUTION_OBSERVATION_APPENDED_AS_RUN_STAR',
    history: nextHistory,
    runStar,
    authority: 'NONE'
  });
}

function appendExecutionHold({ history, star, runRequest = null, holdClass, evidenceDigest = null } = {}) {
  const rawPath = containsRawPrivateOrSource({ star, runRequest });
  if (rawPath) {
    return deepFreeze({ schema: 'axm.code.grammar-glass-execution-history-append-result.v1', result: 'EXECUTION_HISTORY_REFUSED_RAW_PRIVATE_OR_SOURCE_FIELD', refusedPath: rawPath, history, authority: 'NONE' });
  }
  if (!validHistory(history) || !validStar(star) || !HOLD_CLASSES.has(String(holdClass || '').toUpperCase())) {
    return deepFreeze({ schema: 'axm.code.grammar-glass-execution-history-append-result.v1', result: 'VALID_HISTORY_STAR_AND_HOLD_CLASS_REQUIRED', history, authority: 'NONE' });
  }
  const normalizedHold = String(holdClass).toUpperCase();
  const requestSha256 = runRequest && (runRequest.requestSha256 || runRequest.requestId) ? String(runRequest.requestSha256 || runRequest.requestId) : null;
  const duplicateKey = hash({ draftStarSha256: star.starSha256, requestSha256, holdClass: normalizedHold, evidenceDigest });
  if (history.runStars.some(runStar => runStar.evidenceDigest === duplicateKey)) {
    return deepFreeze({ schema: 'axm.code.grammar-glass-execution-history-append-result.v1', result: 'DUPLICATE_EXECUTION_HOLD_HELD_NOT_DOUBLE_COUNTED', history, authority: 'NONE' });
  }
  const runStar = buildRunStar({
    history,
    star,
    resultClass: 'HELD',
    requestSha256,
    candidateModelDigest: runRequest && runRequest.candidateModelDigest || null,
    executorProfileDigest: runRequest && runRequest.executorProfileDigest || null,
    holdClass: normalizedHold,
    evidenceDigest: duplicateKey
  });
  const nextHistory = appendRunStar(history, runStar);
  return deepFreeze({ schema: 'axm.code.grammar-glass-execution-history-append-result.v1', result: 'EXECUTION_HOLD_APPENDED_AS_RUN_STAR', history: nextHistory, runStar, authority: 'NONE' });
}

function summarizeExecutionHistory(history) {
  if (!validHistory(history)) throw new Error('GRAMMAR_GLASS_VALID_EXECUTION_HISTORY_REQUIRED');
  const core = {
    schema: 'axm.code.grammar-glass-execution-history-summary.v1',
    version: '1.0.0',
    result: 'EXECUTION_HISTORY_SUMMARY_READY_NO_RANKING',
    dayStartSha256: history.dayStartSha256,
    executionHistorySha256: history.executionHistorySha256,
    eventCount: history.eventCount,
    runStarCount: history.runStarCount,
    resultCounts: history.resultCounts,
    headEventSha256: history.headEventSha256,
    metrics: {
      runCountMeaning: 'OBSERVATION_AND_HOLD_RECEIPT_COUNT_ONLY_NOT_QUALITY',
      passRate: null,
      qualityScore: null,
      winner: null
    },
    truth: history.truth,
    authority: 'NONE'
  };
  return deepFreeze({ ...core, summarySha256: hash(core) });
}

function createExecutionReplayRequest({ history, runStar, requestedBy = 'EXPLICIT_CALLER' } = {}) {
  if (!validHistory(history) || !validRunStar(runStar) || !history.runStars.some(item => item.runStarSha256 === runStar.runStarSha256)) {
    return deepFreeze({ schema: 'axm.code.grammar-glass-execution-replay-request.v1', result: 'VALID_HISTORY_MEMBER_RUN_STAR_REQUIRED', authority: 'NONE' });
  }
  const core = {
    schema: 'axm.code.grammar-glass-execution-replay-request.v1',
    version: '1.0.0',
    result: 'EXPLICIT_REPLAY_REQUEST_HELD_EXECUTOR_AND_USER_ACTION_REQUIRED',
    requestedBy: clean(requestedBy, 'EXPLICIT_CALLER'),
    executionHistorySha256: history.executionHistorySha256,
    runStarSha256: runStar.runStarSha256,
    replayRequirements: runStar.replayRequirements,
    requiredNextActions: [
      'BIND_CURRENT_EXECUTOR_POLICY_EXPLICITLY',
      'VERIFY_CANDIDATE_AND_START_STATE_DIGESTS',
      'REQUEST_ONE_NEW_RUN_EXPLICITLY'
    ],
    automaticExecution: false,
    automaticTwisterReentry: false,
    automaticRepeatLoop: false,
    priorResultDoesNotBiasAdmission: true,
    truth: {
      replayRequestIsNotExecutionPermission: true,
      replayMustCreateNewExecutionObservationIfRun: true,
      replayDoesNotRewritePriorHistory: true,
      replayDoesNotProveCorrectness: true
    },
    authority: 'NONE'
  };
  return deepFreeze({ ...core, replayRequestSha256: hash(core) });
}

function visualRunStar(runStar) {
  return deepFreeze({
    runStarId: runStar.runStarId,
    runStarSha256: runStar.runStarSha256,
    draftStarSha256: runStar.draftStarSha256,
    resultClass: runStar.resultClass,
    holdClass: runStar.holdClass,
    languageIds: runStar.contributingGrammarIdentities,
    cycleStep: runStar.cycleStep,
    requestSha256: runStar.requestSha256,
    observationSha256: runStar.observationSha256,
    candidateModelDigest: runStar.candidateModelDigest,
    resultModelDigest: runStar.resultModelDigest,
    replayRequirements: runStar.replayRequirements,
    position: derivePosition(runStar.runStarSha256),
    visualMeaning: 'RESULT_CLASS_AND_LINEAGE_ONLY_NOT_QUALITY'
  });
}

function augmentVisualSnapshotWithExecutionHistory({ visualSnapshot, executionHistory } = {}) {
  if (!visualSnapshot || visualSnapshot.schema !== 'axm.code.grammar-glass-visual-snapshot.v1' || !visualSnapshot.visualSnapshotSha256 || !validHistory(executionHistory)) {
    throw new Error('GRAMMAR_GLASS_VALID_VISUAL_AND_EXECUTION_HISTORY_REQUIRED');
  }
  const summary = summarizeExecutionHistory(executionHistory);
  const core = {
    ...visualSnapshot,
    version: '1.4.0',
    result: 'DRAFTSKY_VISUAL_SNAPSHOT_READY_WITH_DOUBLE_GLASS_AND_EXECUTION_CONSTELLATION',
    executionHistory: {
      executionHistorySha256: executionHistory.executionHistorySha256,
      dayStartSha256: executionHistory.dayStartSha256,
      eventCount: executionHistory.eventCount,
      runStarCount: executionHistory.runStarCount,
      resultCounts: executionHistory.resultCounts,
      headEventSha256: executionHistory.headEventSha256,
      summarySha256: summary.summarySha256,
      nodeSealedRunStars: executionHistory.runStars.map(visualRunStar),
      localBrowserReceiptChainClass: 'CLIENT_LIGHTWEIGHT_DIGEST_CHAIN_NOT_INDEPENDENT_RUNTIME_PROOF'
    },
    executionSky: executionHistory.runStars.map(visualRunStar),
    doubleGlass: {
      ...(visualSnapshot.doubleGlass || {}),
      returnLane: 'APPEND_ONLY_EXECUTION_CONSTELLATION_AND_EVIDENCE_RECEIPTS_NO_REENTRY'
    },
    truth: {
      ...(visualSnapshot.truth || {}),
      executionHistoryIsAppendOnly: true,
      passFailCrashTimeoutAndHeldRemainVisible: true,
      executionStarCountIsNotQuality: true,
      executionHistoryDoesNotFeedTwisterAutomatically: true,
      browserLocalHistoryIsNotNodeSealedObservation: true
    }
  };
  delete core.visualSnapshotSha256;
  return deepFreeze({ ...core, visualSnapshotSha256: hash(core) });
}

function snapshot() {
  const core = {
    schema: 'axm.code.grammar-glass-execution-history-snapshot.v1',
    version: '1.0.0',
    status: 'TEST',
    seriousName: 'EXECUTION CONSTELLATION / RETURN HISTORY',
    provides: [
      'append-only execution run stars',
      'pass/fail/crash/timeout/held retention',
      'exact lineage and replay requirements',
      'held explicit replay request',
      'execution-sky visual projection'
    ],
    resultClasses: EXECUTION_HISTORY_RESULT_CLASSES,
    eventTypes: EXECUTION_HISTORY_EVENT_TYPES,
    truth: {
      historyIsNotTraining: true,
      historyIsNotAutomaticReentry: true,
      runStarCountIsNotQuality: true,
      localBrowserChainIsNotIndependentRuntimeProof: true
    },
    authority: 'NONE'
  };
  return deepFreeze({ ...core, snapshotSha256: hash(core) });
}

module.exports = Object.freeze({
  EXECUTION_HISTORY_RESULT_CLASSES,
  EXECUTION_HISTORY_EVENT_TYPES,
  HOLD_CLASSES,
  validHistory,
  validRunStar,
  createExecutionHistory,
  appendExecutionObservation,
  appendExecutionHold,
  summarizeExecutionHistory,
  createExecutionReplayRequest,
  visualRunStar,
  augmentVisualSnapshotWithExecutionHistory,
  snapshot
});
