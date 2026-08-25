'use strict';

const base = require('./code-grammar-glass-base.js');
const sandbox = require('./code-built-software-experiment-sandbox.js');

const {
  AUTHORITY,
  canon,
  hash,
  deepFreeze,
  clean,
  cleanId,
  strings,
  digestCurrent,
  containsRawPrivateOrSource,
  deriveSeed,
  unitFromSeed
} = base;

const INTERGLASS_EVENT_TYPES = Object.freeze([
  'INTERGLASS_REQUEST_CAPTURED',
  'SANDBOX_POLICY_CHECKED',
  'EXECUTION_HELD',
  'EXECUTION_STARTED',
  'EXECUTION_OBSERVED_PASS',
  'EXECUTION_OBSERVED_FAIL',
  'EXECUTION_OBSERVED_CRASH',
  'EXECUTION_OBSERVED_TIMEOUT',
  'EXECUTION_RESULT_SEALED',
  'EXECUTION_PAYLOAD_RELEASED',
  'FULL_SAVE_REQUESTED',
  'FULL_SAVE_HELD',
  'FULL_SAVE_BOUND'
]);

const INTERGLASS_STATES = Object.freeze([
  'EMPTY',
  'CANDIDATE_RECEIVED',
  'POLICY_CHECK',
  'EXECUTION_HELD_NO_ADAPTER',
  'EXECUTION_READY',
  'RUNNING',
  'PASS_OBSERVED',
  'FAIL_OBSERVED',
  'CRASH_OBSERVED',
  'TIMEOUT_OBSERVED',
  'RESOURCE_HOLD',
  'CONTAINMENT_EVIDENCE_MISSING',
  'RESULT_SEALED'
]);

const RESULT_STATES = new Set(['PASS_OBSERVED', 'FAIL_OBSERVED', 'CRASH_OBSERVED', 'TIMEOUT_OBSERVED']);
const DEFAULT_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; media-src 'none'; font-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; child-src 'none'; form-action 'none'; base-uri 'none'";
const DEFAULT_POLICY = Object.freeze({
  maxAttempts: 1,
  maxCandidateModelBytes: 65536,
  maxRuntimeResultBytes: 16384,
  timeoutMs: 1800,
  networkMode: 'NONE',
  sandboxTokens: Object.freeze(['allow-scripts']),
  persistentStorage: false,
  sourceWorkspaceWrite: false,
  automaticReentry: false,
  automaticRepeat: false,
  persistenceIntent: 'TRANSIENT'
});

function boundedInteger(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizePolicy(values = {}) {
  const policy = {
    maxAttempts: boundedInteger(values.maxAttempts, DEFAULT_POLICY.maxAttempts, 1, 1),
    maxCandidateModelBytes: boundedInteger(values.maxCandidateModelBytes, DEFAULT_POLICY.maxCandidateModelBytes, 1024, 1000000),
    maxRuntimeResultBytes: boundedInteger(values.maxRuntimeResultBytes, DEFAULT_POLICY.maxRuntimeResultBytes, 512, 1000000),
    timeoutMs: boundedInteger(values.timeoutMs, DEFAULT_POLICY.timeoutMs, 250, 10000),
    networkMode: String(values.networkMode || DEFAULT_POLICY.networkMode).toUpperCase() === 'NONE' ? 'NONE' : 'NONE',
    sandboxTokens: ['allow-scripts'],
    persistentStorage: false,
    sourceWorkspaceWrite: false,
    automaticReentry: false,
    automaticRepeat: false,
    persistenceIntent: values.persistenceIntent === 'FULL_SAVE_REQUEST' ? 'FULL_SAVE_REQUEST' : 'TRANSIENT'
  };
  return deepFreeze(policy);
}

function createInterglassPolicy(values = {}) {
  const settings = normalizePolicy(values);
  const core = {
    schema: 'axm.code.grammar-glass-interglass-policy.v1',
    version: '1.0.0',
    result: 'INTERGLASS_POLICY_READY',
    settings,
    creationProgram: [
      'MATERIALIZE_STRUCTURED_CANDIDATE_MODEL',
      'VERIFY_CANDIDATE_MODEL_DIGEST',
      'CHECK_BROWSER_SANDBOX_POLICY',
      'EXECUTE_EXACTLY_ONCE_IN_BOUND_SANDBOX',
      'SEAL_DIGEST_BOUND_RUNTIME_OBSERVATION',
      'RELEASE_TRANSIENT_RUNTIME_PAYLOAD'
    ],
    donorPatterns: {
      boundedCreationProgram: 'SELECTIVELY_ADAPTED_CONCEPT',
      detachedCandidateMaterialization: 'SELECTIVELY_ADAPTED_CONCEPT',
      slowCreationReceipt: 'SELECTIVELY_ADAPTED_CONCEPT',
      donorCodeCopiedWholesale: false
    },
    truth: {
      planningDoesNotGrantExecutionAuthority: true,
      oneAttemptCeilingPerRequest: true,
      rawSourceDoesNotEnterDurableMetadataByDefault: true,
      executionAndRuntimeQualityRemainSeparateClaims: true
    },
    authority: 'NONE'
  };
  return deepFreeze({ ...core, policySha256: hash(core) });
}

function validStar(star) {
  return !!star && star.schema === 'axm.code.grammar-glass-draft-star.v1' && digestCurrent(star, 'starSha256');
}

function validMirror(mirror) {
  return !!mirror && mirror.schema === 'axm.code.reactive-draft-mirror-observation.v1' && digestCurrent(mirror, 'mirrorObservationSha256');
}

function validWhy(why) {
  return !why || (why.schema === 'axm.code.grammar-glass-formation-explanation.v1' && digestCurrent(why, 'explanationSha256'));
}

function normalizeAtomTypes(star) {
  return [...new Set((star.typedAtomAncestry || []).map(item => {
    const id = String(item.atomId || '');
    const tail = id.split(':').pop() || 'unknown';
    return tail.toUpperCase().replace(/-/g, '_');
  }))].sort();
}

function candidateCells(seed, count = 16) {
  const cells = [];
  for (let index = 0; index < count; index += 1) {
    const cellSeed = deriveSeed(seed, 'interglass-cell', index);
    cells.push({
      index,
      xPpm: Math.round(unitFromSeed(cellSeed, 'x') * 1000000),
      yPpm: Math.round(unitFromSeed(cellSeed, 'y') * 1000000),
      energyPpm: 120000 + Math.round(unitFromSeed(cellSeed, 'energy') * 880000),
      radiusPpm: 18000 + Math.round(unitFromSeed(cellSeed, 'radius') * 42000),
      phasePpm: Math.round(unitFromSeed(cellSeed, 'phase') * 1000000),
      seedDigest: hash({ cellSeed, index })
    });
  }
  return cells;
}

function expectedResultFromModel(model) {
  const energySumPpm = model.cells.reduce((sum, cell) => sum + cell.energyPpm, 0);
  const resultCore = {
    schema: 'axm.code.interglass-candidate-result-model.v1',
    candidateSeed: model.candidateSeed,
    languageCount: model.languageIds.length,
    atomTypeCount: model.atomTypes.length,
    connectionClassCount: model.connectionClasses.length,
    cellCount: model.cells.length,
    energySumPpm,
    formationToken: hash({
      candidateSeed: model.candidateSeed,
      compositeLineageDigest: model.compositeLineageDigest,
      energySumPpm,
      cellCount: model.cells.length
    })
  };
  return deepFreeze({ ...resultCore, resultModelDigest: hash(resultCore) });
}

function createInterglassCandidateModel({ star, mirrorObservation, formationWhy = null, policy = null } = {}) {
  const rawPath = containsRawPrivateOrSource({ star, mirrorObservation, formationWhy });
  if (rawPath) {
    return deepFreeze({
      schema: 'axm.code.interglass-browser-candidate-model.v1',
      result: 'INTERGLASS_CANDIDATE_REFUSED_RAW_PRIVATE_OR_SOURCE_FIELD',
      refusedPath: rawPath,
      authority: 'NONE'
    });
  }
  if (!validStar(star) || !validMirror(mirrorObservation) || !validWhy(formationWhy)) {
    return deepFreeze({ schema: 'axm.code.interglass-browser-candidate-model.v1', result: 'VALID_STAR_MIRROR_AND_OPTIONAL_WHY_REQUIRED', authority: 'NONE' });
  }
  if (star.mirrorObservationDigest !== mirrorObservation.mirrorObservationSha256 || star.draftRecipeDigest !== mirrorObservation.draftRecipe.draftRecipeSha256) {
    return deepFreeze({ schema: 'axm.code.interglass-browser-candidate-model.v1', result: 'STAR_MIRROR_LINEAGE_MISMATCH', authority: 'NONE' });
  }
  const resolvedPolicy = policy && policy.schema === 'axm.code.grammar-glass-interglass-policy.v1' && digestCurrent(policy, 'policySha256')
    ? policy
    : createInterglassPolicy(policy || {});
  const candidateSeed = deriveSeed(star.rootSeed, `interglass:${star.derivedFormationSeed}:${star.compositeLineageDigest}`, 0);
  const modelCore = {
    schema: 'axm.code.interglass-browser-candidate-model.v1',
    version: '1.0.0',
    result: 'DETACHED_STRUCTURED_BROWSER_CANDIDATE_MODEL_READY',
    templateId: 'DETERMINISTIC_LINEAGE_CRYSTAL_V1',
    candidateSeed,
    rootSeed: star.rootSeed,
    formationSeed: star.derivedFormationSeed,
    draftStarSha256: star.starSha256,
    formationDigest: mirrorObservation.formationSha256,
    mirrorObservationSha256: mirrorObservation.mirrorObservationSha256,
    mirrorRecipeDigest: star.draftRecipeDigest,
    compositeLineageDigest: star.compositeLineageDigest,
    explanationDigest: formationWhy ? formationWhy.explanationSha256 : null,
    languageIds: [...star.contributingGrammarIdentities].sort(),
    atomTypes: normalizeAtomTypes(star),
    atomAncestry: (star.typedAtomAncestry || []).map(item => ({ atomId: item.atomId, atomSha256: item.atomSha256 })),
    connectionClasses: [...star.connectionClasses].sort(),
    cells: candidateCells(candidateSeed),
    runtimeContract: {
      runtimeType: 'BROWSER_HTML_JS',
      requestedBehavior: 'RENDER_DETERMINISTIC_LINEAGE_CRYSTAL_AND_RETURN_RESULT_MODEL',
      sourceCodeStoredInDurableModel: false,
      runtimePayloadBuiltTransientlyByExecutor: true,
      networkRequired: false,
      filesystemRequired: false,
      childProcessRequired: false
    },
    policySha256: resolvedPolicy.policySha256,
    truth: {
      candidateModelIsStructuredDataNotSourceCode: true,
      candidateModelDoesNotProveRuntimeQuality: true,
      rngPathIsDeterministicAfterRecordedSeed: true,
      rngDoesNotProveNovelty: true,
      compositeLineagePreserved: true,
      candidateIsNotAdmissionSelectionOrPromotion: true
    },
    authority: AUTHORITY
  };
  const candidateModel = { ...modelCore, candidateModelDigest: hash(modelCore) };
  const byteLength = Buffer.byteLength(canon(candidateModel), 'utf8');
  if (byteLength > resolvedPolicy.settings.maxCandidateModelBytes) {
    return deepFreeze({
      schema: 'axm.code.interglass-browser-candidate-model.v1',
      result: 'INTERGLASS_CANDIDATE_MODEL_RESOURCE_HOLD',
      byteLength,
      maximumBytes: resolvedPolicy.settings.maxCandidateModelBytes,
      authority: 'NONE'
    });
  }
  const expectedResult = expectedResultFromModel(candidateModel);
  return deepFreeze({
    ...candidateModel,
    byteLength,
    expectedResult,
    candidateReceiptDigest: hash({
      candidateModelDigest: candidateModel.candidateModelDigest,
      byteLength,
      expectedResultDigest: expectedResult.resultModelDigest,
      policySha256: resolvedPolicy.policySha256
    })
  });
}

function createBrowserSandboxExecutorProfile({ policy = null } = {}) {
  const resolvedPolicy = policy && policy.schema === 'axm.code.grammar-glass-interglass-policy.v1' && digestCurrent(policy, 'policySha256')
    ? policy
    : createInterglassPolicy(policy || {});
  const cspDigest = hash(DEFAULT_CSP);
  const core = {
    schema: 'axm.code.interglass-browser-sandbox-executor-profile.v1',
    version: '1.0.0',
    result: 'DISPOSABLE_BROWSER_SANDBOX_EXECUTOR_PROFILE_READY',
    id: 'grammar-glass-interglass-browser-sandbox-v1',
    enforcementClass: 'DISPOSABLE_BROWSER_SANDBOX',
    runtimeType: 'SANDBOXED_IFRAME_SRCDOC',
    sandboxTokens: ['allow-scripts'],
    allowSameOrigin: false,
    contentSecurityPolicy: DEFAULT_CSP,
    cspDigest,
    timeoutMs: resolvedPolicy.settings.timeoutMs,
    maxAttempts: 1,
    networkMode: 'NONE',
    sourceWorkspaceWrite: false,
    persistentStorage: false,
    externalBinding: {
      builtSoftwareSandboxContract: 'code-built-software-experiment-sandbox',
      artifactBuildWindowSeam: 'ephemeral-live-preview / browser quick run',
      browserIsEnforcementBoundaryForThisAdapter: true,
      metadataModuleIsNotRuntimeContainment: true
    },
    truth: {
      browserSandboxIsNotOsSandbox: true,
      noSameOriginTokenKeepsOpaqueOrigin: true,
      cspDefaultDenyBlocksCandidateNetworkByPolicy: true,
      executorDoesNotGrantPromotionOrWorkspaceAuthority: true
    },
    authority: 'EXECUTE_EXACT_TRANSIENT_CANDIDATE_INSIDE_BOUND_BROWSER_SANDBOX_ONLY'
  };
  return deepFreeze({ ...core, executorProfileDigest: hash(core) });
}

function sandboxContractBinding() {
  const core = {
    schema: 'axm.code.interglass-existing-sandbox-binding.v1',
    version: '1.0.0',
    result: 'INTERGLASS_BOUND_TO_EXISTING_BUILT_SOFTWARE_SANDBOX_CONTRACT',
    saveSlotCount: sandbox.SAVE_SLOT_COUNT,
    maxBytesPerSaveSlot: sandbox.MAX_SAVE_BYTES,
    maxActiveSaveBytes: sandbox.MAX_ACTIVE_SAVE_BYTES,
    starReceiptConsumesFullSaveSlot: false,
    transientExecutionConsumesFullSaveSlot: false,
    sixthSilentSaveAllowed: false,
    physicalPersistenceRequiresExistingSandboxAdapter: true,
    existingSandboxSurfaces: {
      executionRequestAvailable: typeof sandbox.createExecutionRequest === 'function',
      executorReceiptSealerAvailable: typeof sandbox.sealExecutorReceipt === 'function',
      iterationPersistenceGateAvailable: typeof sandbox.assessIterationPersistence === 'function',
      draftEvidenceCandidateAvailable: typeof sandbox.createDraftEvidenceCandidate === 'function'
    },
    truth: {
      existingSaveSystemReused: true,
      existingSandboxExecutionAndPersistenceSurfacesReusedByReference: true,
      browserExecutorIsAExplicitLowerAdapterForThisPhase2Demo: true,
      noSixthSaveInvented: true,
      browserExecutionDoesNotImplyPersistentSave: true
    },
    authority: 'NONE'
  };
  return deepFreeze({ ...core, bindingSha256: hash(core) });
}

function createInterglassRunRequest({ candidateModel, star, mirrorObservation, executorProfile = null, policy = null, requestedBy = 'HUMAN_EXPLICIT_DEMO' } = {}) {
  if (!candidateModel || candidateModel.schema !== 'axm.code.interglass-browser-candidate-model.v1' || !candidateModel.candidateModelDigest || !validStar(star) || !validMirror(mirrorObservation)) {
    return deepFreeze({ schema: 'axm.code.interglass-execution-request.v1', result: 'VALID_CANDIDATE_STAR_AND_MIRROR_REQUIRED', authority: 'NONE' });
  }
  const resolvedPolicy = policy && policy.schema === 'axm.code.grammar-glass-interglass-policy.v1' && digestCurrent(policy, 'policySha256')
    ? policy
    : createInterglassPolicy(policy || {});
  if (candidateModel.policySha256 !== resolvedPolicy.policySha256) {
    return deepFreeze({ schema: 'axm.code.interglass-execution-request.v1', result: 'CANDIDATE_POLICY_MISMATCH', authority: 'NONE' });
  }
  if (!executorProfile || executorProfile.schema !== 'axm.code.interglass-browser-sandbox-executor-profile.v1' || !digestCurrent(executorProfile, 'executorProfileDigest')) {
    const holdCore = {
      schema: 'axm.code.interglass-execution-request.v1',
      version: '1.0.0',
      result: 'EXECUTION_HELD_NO_ADAPTER',
      candidateModelDigest: candidateModel.candidateModelDigest,
      draftStarSha256: star.starSha256,
      formationDigest: mirrorObservation.formationSha256,
      policySha256: resolvedPolicy.policySha256,
      requiredExecutorClass: 'DISPOSABLE_BROWSER_SANDBOX_OR_STRONGER_EXTERNAL_SANDBOX',
      truth: { executionOccurred: false, holdIsNotFailureOfCandidate: true },
      authority: 'NONE'
    };
    return deepFreeze({ ...holdCore, requestSha256: hash(holdCore) });
  }
  const binding = sandboxContractBinding();
  const requestCore = {
    schema: 'axm.code.interglass-execution-request.v1',
    version: '1.0.0',
    result: 'INTERGLASS_EXECUTION_REQUEST_READY_NOT_EXECUTED',
    requestId: `interglass-run:${hash({ candidateModelDigest: candidateModel.candidateModelDigest, executorProfileDigest: executorProfile.executorProfileDigest }).slice(0, 24)}`,
    requestedBy: cleanId(requestedBy, 'EXPLICIT_CALLER'),
    draftStarSha256: star.starSha256,
    formationDigest: mirrorObservation.formationSha256,
    compositeLineageDigest: star.compositeLineageDigest,
    rootSeed: star.rootSeed,
    formationSeed: star.derivedFormationSeed,
    conditionDigest: star.conditionDigest,
    contributingGrammarIdentities: [...star.contributingGrammarIdentities],
    typedAtomAncestry: star.typedAtomAncestry,
    mirrorObservationSha256: mirrorObservation.mirrorObservationSha256,
    mirrorRecipeDigest: star.draftRecipeDigest,
    candidateModel,
    candidateModelDigest: candidateModel.candidateModelDigest,
    candidateReceiptDigest: candidateModel.candidateReceiptDigest,
    expectedResultDigest: candidateModel.expectedResult.resultModelDigest,
    executorProfile,
    executorProfileDigest: executorProfile.executorProfileDigest,
    sandboxContractBinding: binding,
    policySha256: resolvedPolicy.policySha256,
    resourceCeilings: {
      maxAttempts: 1,
      timeoutMs: resolvedPolicy.settings.timeoutMs,
      maxCandidateModelBytes: resolvedPolicy.settings.maxCandidateModelBytes,
      maxRuntimeResultBytes: resolvedPolicy.settings.maxRuntimeResultBytes
    },
    persistenceIntent: resolvedPolicy.settings.persistenceIntent,
    transientPayload: {
      sourceBytesIncludedInRequest: false,
      sourceBytesPersistedByRequest: false,
      executorMayMaterializeExactRuntimeBytesFromCandidateModel: true,
      payloadMustBeReleasedAfterRunUnlessSeparatelySaved: true
    },
    creationProgram: [
      'CANDIDATE_RECEIVED',
      'POLICY_CHECK',
      'EXECUTION_READY',
      'RUNNING',
      'RESULT_OBSERVATION',
      'RESULT_SEALED',
      'TRANSIENT_PAYLOAD_RELEASED'
    ],
    truth: {
      requestIsNotExecution: true,
      requestIsNotAdmission: true,
      requestIsNotSelection: true,
      requestIsNotPromotion: true,
      automaticRepeatAllowed: false,
      automaticReentryAllowed: false,
      browserPayloadIsTransient: true
    },
    authority: 'BOUND_EXECUTOR_REQUEST_ONLY'
  };
  return deepFreeze({ ...requestCore, requestSha256: hash(requestCore) });
}


module.exports = Object.freeze({
  INTERGLASS_EVENT_TYPES,
  INTERGLASS_STATES,
  RESULT_STATES,
  DEFAULT_CSP,
  DEFAULT_POLICY,
  createInterglassPolicy,
  validStar,
  createInterglassCandidateModel,
  expectedResultFromModel,
  createBrowserSandboxExecutorProfile,
  sandboxContractBinding,
  createInterglassRunRequest
});
