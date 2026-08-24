'use strict';

const crypto = require('crypto');

const SAVE_SLOT_COUNT = 5;
const MAX_SAVE_BYTES = 100000000;
const MAX_ACTIVE_SAVE_BYTES = SAVE_SLOT_COUNT * MAX_SAVE_BYTES;
const ACTORS = new Set(['MACHINE', 'AI', 'HUMAN', 'UNKNOWN']);
const NETWORK_MODES = new Set(['NONE', 'EXPLICIT_SCOPED']);
const EXECUTOR_CLASSES = new Set(['OS_PROCESS_SANDBOX', 'CONTAINER', 'VM', 'WASM_RUNTIME', 'MOBILE_APP_SANDBOX']);
const PRESSURE_STATES = new Set(['NORMAL', 'ELEVATED', 'CRITICAL', 'UNKNOWN']);
const PRESSURE_SIGNALS = Object.freeze([
  'memory',
  'swap',
  'thermal',
  'disk',
  'io',
  'interactiveLatency',
  'sharedQueue'
]);
const OUTCOME_CLASSES = new Set([
  'SUPPORTED_CANDIDATE',
  'COUNTEREVIDENCE',
  'INCONCLUSIVE',
  'FAILED_ATTEMPT',
  'NOVEL_BEHAVIOR_OBSERVED'
]);
const AUTHORITY = Object.freeze({
  sourceWorkspaceRead: false,
  sourceWorkspaceMutation: false,
  candidateExecution: false,
  toolExecution: false,
  network: false,
  install: false,
  deployment: false,
  promotion: false,
  merge: false,
  canon: false
});

function canon(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
}

function hash(v) {
  return crypto.createHash('sha256').update(canon(v)).digest('hex');
}

function digestCurrent(record, digestField) {
  if (!record || !record[digestField]) return false;
  const core = { ...record };
  const expected = core[digestField];
  delete core[digestField];
  return hash(core) === expected;
}

function clean(v, fallback = '') {
  const value = String(v == null ? '' : v).trim();
  return value || fallback;
}

function cleanId(v, fallback = '') {
  const value = clean(v, fallback).replace(/[^a-zA-Z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
  return value || fallback;
}

function actor(v) {
  const value = String(v || 'UNKNOWN').toUpperCase();
  return ACTORS.has(value) ? value : 'UNKNOWN';
}

function strings(v, max = 64) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(x => clean(x)).filter(Boolean))].slice(0, max);
}

function validDirection(direction, projectId) {
  return !!direction &&
    direction.schema === 'axm.code.work-direction.v1' &&
    direction.projectId === projectId &&
    !!direction.directionSha256 &&
    (!direction.validation || direction.validation.usable === true);
}

function validWorkspace(workspace) {
  return !!workspace &&
    workspace.schema === 'axm.code.built-software-sandbox-workspace.v1' &&
    workspace.result === 'BUILT_SOFTWARE_SANDBOX_WORKSPACE_READY' &&
    digestCurrent(workspace, 'workspaceSha256');
}

function validBatch(batch) {
  return !!batch && batch.schema === 'axm.code.production-batch.v1' && batch.result === 'PRODUCTION_BATCH_READY' && !!batch.batchSha256;
}

function validDraft(batch, draft) {
  return !!draft &&
    draft.schema === 'axm.code.production-draft-revision.v1' &&
    draft.batchSha256 === batch.batchSha256 &&
    draft.directionSha256 === batch.directionSha256 &&
    !!draft.draftRevisionSha256;
}

function slotId(raw) {
  const number = typeof raw === 'number'
    ? raw
    : Number(String(raw || '').replace(/^save-0?/, ''));
  if (!Number.isInteger(number) || number < 1 || number > SAVE_SLOT_COUNT) return null;
  return `save-${String(number).padStart(2, '0')}`;
}

function createWorkspace({ projectId, direction, workspaceId = 'built-software-experiments', title = 'Built Software Experiments' } = {}) {
  const pid = cleanId(projectId || direction && direction.projectId);
  if (!pid) return Object.freeze({ schema: 'axm.code.built-software-sandbox-workspace.v1', result: 'PROJECT_ID_REQUIRED', authority: 'NONE' });
  if (!validDirection(direction, pid)) {
    return Object.freeze({
      schema: 'axm.code.built-software-sandbox-workspace.v1',
      result: 'CURRENT_USABLE_DIRECTION_REQUIRED',
      projectId: pid,
      authority: 'NONE'
    });
  }
  const slots = Array.from({ length: SAVE_SLOT_COUNT }, (_, index) => Object.freeze({
    slotId: `save-${String(index + 1).padStart(2, '0')}`,
    maxActiveBytes: MAX_SAVE_BYTES,
    activePayloadCount: 1,
    replacement: 'EXPLICIT_EXPECTED_PARENT_REQUIRED'
  }));
  const core = {
    schema: 'axm.code.built-software-sandbox-workspace.v1',
    version: '1.0.0',
    result: 'BUILT_SOFTWARE_SANDBOX_WORKSPACE_READY',
    projectId: pid,
    workspaceId: cleanId(workspaceId, 'built-software-experiments'),
    title: String(title || 'Built Software Experiments'),
    directionSha256: direction.directionSha256,
    sandboxScope: 'SOFTWARE_BUILT_BY_CREATOR_ONLY',
    creatorScope: {
      ideaGenerationSandboxed: false,
      reasoningQualityCapped: false,
      tokenOrComputeQuotaUsedAsHardwareSafety: false,
      candidateExecutionAuthorityGranted: false
    },
    runtimeContract: {
      enforcement: 'EXTERNAL_OS_PROCESS_CONTAINER_VM_OR_EQUIVALENT_REQUIRED',
      thisModuleIsRuntimeContainment: false,
      candidateRunsInEphemeralWorkspace: true,
      sourceWorkspaceWrite: false,
      networkDefault: 'NONE',
      networkRequiresExplicitScopedExperiment: true,
      hardwareModel: 'ADAPTIVE_HEALTH_AND_SHARED_PRESSURE_NOT_FIXED_TOKEN_OR_COMPUTE_CAP',
      observedPressureSignals: PRESSURE_SIGNALS,
      pressureResponseOrder: ['REDUCE_CONCURRENCY', 'REDUCE_BATCH_SIZE', 'QUEUE_WORK', 'PAUSE_AND_RESUME'],
      forbiddenPressureResponses: ['SILENT_REASONING_QUALITY_DOWNGRADE', 'SILENT_VERIFICATION_REDUCTION']
    },
    saveLayout: {
      slotCount: SAVE_SLOT_COUNT,
      maxBytesPerActiveSlot: MAX_SAVE_BYTES,
      maxActiveBytesAcrossSlots: MAX_ACTIVE_SAVE_BYTES,
      slots,
      transientExperimentBytesOutsideSaveSlots: 'ALLOWED_WHILE_EXTERNAL_HARDWARE_HEALTH_ENVELOPE_IS_NORMAL',
      transientReleaseRequiresDeclaredRetention_AND_receipt: true
    },
    truth: {
      sandboxAppliesToBuiltSoftwareNotCreator: true,
      boldUncertainSoftwareMayBeTried: true,
      speculationIsNotFact: true,
      runtimeContainmentNotProvidedByThisMetadataModule: true,
      saveLimitAppliesToPersistentActivePayloads: true,
      saveLimitDoesNotCapTransientExperimentVolume: true,
      noAutomaticPromotion: true
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, workspaceSha256: hash(core) });
}

function createExperiment({
  workspace,
  batch,
  draft,
  purpose,
  hypotheses = [],
  unknowns = [],
  requiredObservations = [],
  inputFixtureDigests = [],
  networkMode = 'NONE',
  networkPolicyDigest = null
} = {}) {
  if (!validWorkspace(workspace)) {
    return Object.freeze({ schema: 'axm.code.built-software-experiment.v1', result: 'INVALID_WORKSPACE', authority: 'NONE' });
  }
  if (!validBatch(batch) || batch.projectId !== workspace.projectId || batch.directionSha256 !== workspace.directionSha256) {
    return Object.freeze({ schema: 'axm.code.built-software-experiment.v1', result: 'INVALID_STALE_OR_FOREIGN_BATCH', authority: 'NONE' });
  }
  if (!validDraft(batch, draft)) {
    return Object.freeze({ schema: 'axm.code.built-software-experiment.v1', result: 'INVALID_OR_FOREIGN_DRAFT', authority: 'NONE' });
  }
  const artifactDigest = draft.artifact && draft.artifact.digest || null;
  if (!artifactDigest) {
    return Object.freeze({
      schema: 'axm.code.built-software-experiment.v1',
      result: 'RENDERED_OR_COMPILED_ARTIFACT_REQUIRED',
      draftRevisionSha256: draft.draftRevisionSha256,
      authority: 'NONE'
    });
  }
  const normalizedNetwork = String(networkMode || 'NONE').toUpperCase();
  if (!NETWORK_MODES.has(normalizedNetwork)) {
    return Object.freeze({ schema: 'axm.code.built-software-experiment.v1', result: 'NETWORK_MODE_INVALID', allowedModes: [...NETWORK_MODES], authority: 'NONE' });
  }
  if (normalizedNetwork === 'EXPLICIT_SCOPED' && !networkPolicyDigest) {
    return Object.freeze({ schema: 'axm.code.built-software-experiment.v1', result: 'SCOPED_NETWORK_POLICY_DIGEST_REQUIRED', authority: 'NONE' });
  }
  const core = {
    schema: 'axm.code.built-software-experiment.v1',
    version: '1.0.0',
    result: 'SOFTWARE_EXPERIMENT_READY_EXTERNAL_ENFORCED_SANDBOX_REQUIRED',
    projectId: workspace.projectId,
    workspaceSha256: workspace.workspaceSha256,
    directionSha256: workspace.directionSha256,
    batchSha256: batch.batchSha256,
    draftId: draft.draftId,
    draftRevisionSha256: draft.draftRevisionSha256,
    candidateArtifactDigest: artifactDigest,
    purpose: clean(purpose, 'Observe built candidate behavior under bounded conditions.'),
    hypotheses: strings(hypotheses, 64),
    unknowns: strings(unknowns, 64),
    requiredObservations: strings(requiredObservations, 128),
    inputFixtureDigests: strings(inputFixtureDigests, 512).sort(),
    network: {
      mode: normalizedNetwork,
      policyDigest: normalizedNetwork === 'EXPLICIT_SCOPED' ? String(networkPolicyDigest) : null
    },
    containmentRequired: {
      externalExecutor: true,
      processOrEquivalentIsolation: true,
      ephemeralWorkspace: true,
      sourceWorkspaceWrite: false,
      hardwareHealthGovernor: true,
      containmentEvidenceReceipt: true
    },
    truth: {
      boldHypothesisIsNotFact: true,
      experimentIsNotExecution: true,
      creatorReasoningSandboxed: false,
      builtCandidateMustBeSandboxed: true,
      artifactDigestIsNotRuntimeCorrectness: true,
      successfulRunIsNotPromotion: true
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, experimentSha256: hash(core) });
}

function createExecutionRequest({ workspace, experiment, executorAdapter, actorClass = 'UNKNOWN', runLabel = null } = {}) {
  if (!validWorkspace(workspace) || !experiment || experiment.schema !== 'axm.code.built-software-experiment.v1' || experiment.workspaceSha256 !== workspace.workspaceSha256 || !digestCurrent(experiment, 'experimentSha256')) {
    return Object.freeze({ schema: 'axm.code.software-experiment-execution-request.v1', result: 'INVALID_OR_FOREIGN_EXPERIMENT', authority: 'NONE' });
  }
  const enforcementClass = String(executorAdapter && executorAdapter.enforcementClass || '').toUpperCase();
  if (!executorAdapter || !executorAdapter.id || !executorAdapter.digest || !EXECUTOR_CLASSES.has(enforcementClass)) {
    return Object.freeze({
      schema: 'axm.code.software-experiment-execution-request.v1',
      result: 'EXTERNAL_ENFORCED_EXECUTOR_ADAPTER_REQUIRED',
      allowedEnforcementClasses: [...EXECUTOR_CLASSES].sort(),
      authority: 'NONE'
    });
  }
  const core = {
    schema: 'axm.code.software-experiment-execution-request.v1',
    version: '1.0.0',
    result: 'EXECUTION_REQUEST_READY_NOT_EXECUTED',
    projectId: workspace.projectId,
    workspaceSha256: workspace.workspaceSha256,
    experimentSha256: experiment.experimentSha256,
    candidateArtifactDigest: experiment.candidateArtifactDigest,
    requestedBy: actor(actorClass),
    runLabel: runLabel == null ? null : String(runLabel),
    executorAdapter: {
      id: String(executorAdapter.id),
      digest: String(executorAdapter.digest),
      enforcementClass
    },
    requiredContract: {
      candidateOnly: true,
      ephemeralWorkspace: true,
      sourceWorkspaceWrite: false,
      networkMode: experiment.network.mode,
      networkPolicyDigest: experiment.network.policyDigest,
      adaptiveHardwareHealthGovernor: true,
      noReasoningQualityDowngrade: true,
      returnDigestBoundObservationOnly: true
    },
    truth: {
      requestIsNotPermissionOutsideBoundExecutor: true,
      requestWasNotExecutedByThisModule: true,
      executorBindingIsNotContainmentProof: true
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, requestSha256: hash(core) });
}

function assessHardwareHealth({ workspace, telemetry } = {}) {
  if (!validWorkspace(workspace)) {
    return Object.freeze({ schema: 'axm.code.software-experiment-hardware-health.v1', result: 'INVALID_WORKSPACE', authority: 'NONE' });
  }
  if (!telemetry || !telemetry.evidenceDigest) {
    return Object.freeze({
      schema: 'axm.code.software-experiment-hardware-health.v1',
      result: 'HARDWARE_HEALTH_EVIDENCE_REQUIRED',
      workspaceSha256: workspace.workspaceSha256,
      authority: 'NONE'
    });
  }
  const signals = {};
  for (const name of PRESSURE_SIGNALS) {
    const state = String(telemetry[name] || 'UNKNOWN').toUpperCase();
    signals[name] = PRESSURE_STATES.has(state) ? state : 'UNKNOWN';
  }
  const values = Object.values(signals);
  const overall = values.includes('CRITICAL')
    ? 'CRITICAL'
    : values.includes('UNKNOWN')
      ? 'UNKNOWN'
      : values.includes('ELEVATED')
        ? 'ELEVATED'
        : 'NORMAL';
  const result = overall === 'CRITICAL'
    ? 'PAUSE_FOR_HARDWARE_HEALTH'
    : overall === 'UNKNOWN'
      ? 'HARDWARE_HEALTH_UNKNOWN_QUEUE_OR_OBSERVE'
      : overall === 'ELEVATED'
        ? 'ADAPT_WORKLOAD_SHAPE_PRESERVE_QUALITY'
        : 'HARDWARE_HEALTHY_TO_CONTINUE_NOT_EXECUTION_PERMISSION';
  const core = {
    schema: 'axm.code.software-experiment-hardware-health.v1',
    version: '1.0.0',
    result,
    projectId: workspace.projectId,
    workspaceSha256: workspace.workspaceSha256,
    evidenceDigest: String(telemetry.evidenceDigest),
    signals,
    overall,
    allowedResponses: overall === 'NORMAL'
      ? ['CONTINUE_CURRENT_WORKLOAD_SHAPE']
      : overall === 'ELEVATED'
        ? ['REDUCE_CONCURRENCY', 'REDUCE_BATCH_SIZE', 'QUEUE_WORK']
        : ['PAUSE_AND_RESUME_AFTER_FRESH_HEALTH_EVIDENCE'],
    forbiddenResponses: ['SILENT_REASONING_QUALITY_DOWNGRADE', 'SILENT_VERIFICATION_REDUCTION'],
    truth: {
      healthStateComesFromExternalTelemetry: true,
      highUtilizationAloneIsNotDeclaredDamage: true,
      tokenCountIsNotHardwareHealth: true,
      healthAssessmentIsNotExecutionPermission: true
    },
    authority: 'NONE'
  };
  return Object.freeze({ ...core, healthSha256: hash(core) });
}

function sealExecutorReceipt(input = {}) {
  const { workspace, experiment, request } = input;
  if (!validWorkspace(workspace) || !experiment || !digestCurrent(experiment, 'experimentSha256') || !request || !digestCurrent(request, 'requestSha256')) {
    return Object.freeze({ schema: 'axm.code.external-sandbox-executor-receipt.v1', result: 'INVALID_WORKSPACE_EXPERIMENT_OR_REQUEST', authority: 'NONE' });
  }
  if (experiment.workspaceSha256 !== workspace.workspaceSha256 || request.experimentSha256 !== experiment.experimentSha256) {
    return Object.freeze({ schema: 'axm.code.external-sandbox-executor-receipt.v1', result: 'FOREIGN_EXECUTION_BINDING', authority: 'NONE' });
  }
  if (input.stdout != null || input.stderr != null || input.rawOutput != null || input.bytes != null || input.sourceCode != null) {
    return Object.freeze({ schema: 'axm.code.external-sandbox-executor-receipt.v1', result: 'RAW_EXECUTION_OUTPUT_REFUSED_FROM_RECEIPT', authority: 'NONE' });
  }
  const required = {
    processIsolation: input.processIsolation === true,
    ephemeralWorkspace: input.ephemeralWorkspace === true,
    sourceWorkspaceWrite: input.sourceWorkspaceWrite === false,
    hardwareGovernorBound: input.hardwareGovernorBound === true,
    containmentEvidenceDigest: !!input.containmentEvidenceDigest,
    executorIdentity: !!input.executorId && !!input.executorDigest,
    networkModeMatch: String(input.networkMode || 'NONE').toUpperCase() === experiment.network.mode
  };
  const missing = Object.entries(required).filter(([, pass]) => !pass).map(([name]) => name);
  if (missing.length) {
    return Object.freeze({
      schema: 'axm.code.external-sandbox-executor-receipt.v1',
      result: 'EXECUTOR_CONTAINMENT_RECEIPT_HELD',
      missing,
      authority: 'NONE'
    });
  }
  const core = {
    schema: 'axm.code.external-sandbox-executor-receipt.v1',
    version: '1.0.0',
    result: 'EXTERNAL_SANDBOX_OBSERVATION_SEALED_NOT_INDEPENDENTLY_VERIFIED',
    projectId: workspace.projectId,
    workspaceSha256: workspace.workspaceSha256,
    experimentSha256: experiment.experimentSha256,
    requestSha256: request.requestSha256,
    candidateArtifactDigest: experiment.candidateArtifactDigest,
    executor: {
      id: String(input.executorId),
      digest: String(input.executorDigest),
      enforcementClass: request.executorAdapter.enforcementClass
    },
    containment: {
      evidenceDigest: String(input.containmentEvidenceDigest),
      processIsolation: true,
      ephemeralWorkspace: true,
      sourceWorkspaceWrite: false,
      networkMode: experiment.network.mode,
      networkPolicyDigest: experiment.network.policyDigest,
      hardwareGovernorBound: true
    },
    observation: {
      exitCode: Number.isInteger(input.exitCode) ? input.exitCode : null,
      terminationReason: input.terminationReason == null ? null : String(input.terminationReason),
      stdoutDigest: input.stdoutDigest == null ? null : String(input.stdoutDigest),
      stderrDigest: input.stderrDigest == null ? null : String(input.stderrDigest)
    },
    truth: {
      executorReceiptIsClaimBoundToEvidenceNotIndependentProof: true,
      rawStdoutOrStderrStored: false,
      candidateExecutedByThisModule: false,
      containmentMustBeVerifiedByExecutorEvidence: true
    },
    authority: 'NONE'
  };
  return Object.freeze({ ...core, executorReceiptSha256: hash(core) });
}

function nonNegativeSafeInteger(v) {
  return Number.isSafeInteger(v) && v >= 0;
}

function recordOutcome(input = {}) {
  const { workspace, experiment, request, executorReceipt, hardwareHealth } = input;
  if (!validWorkspace(workspace) || !experiment || !digestCurrent(experiment, 'experimentSha256') || experiment.workspaceSha256 !== workspace.workspaceSha256) {
    return Object.freeze({ schema: 'axm.code.software-experiment-outcome.v1', result: 'INVALID_OR_FOREIGN_EXPERIMENT', authority: 'NONE' });
  }
  if (!request || !digestCurrent(request, 'requestSha256') || request.experimentSha256 !== experiment.experimentSha256) {
    return Object.freeze({ schema: 'axm.code.software-experiment-outcome.v1', result: 'INVALID_OR_FOREIGN_REQUEST', authority: 'NONE' });
  }
  if (!executorReceipt || executorReceipt.schema !== 'axm.code.external-sandbox-executor-receipt.v1' || !digestCurrent(executorReceipt, 'executorReceiptSha256') || executorReceipt.requestSha256 !== request.requestSha256) {
    return Object.freeze({ schema: 'axm.code.software-experiment-outcome.v1', result: 'CURRENT_EXECUTOR_RECEIPT_REQUIRED', authority: 'NONE' });
  }
  if (!hardwareHealth || hardwareHealth.schema !== 'axm.code.software-experiment-hardware-health.v1' || !digestCurrent(hardwareHealth, 'healthSha256') || hardwareHealth.workspaceSha256 !== workspace.workspaceSha256) {
    return Object.freeze({ schema: 'axm.code.software-experiment-outcome.v1', result: 'CURRENT_HARDWARE_HEALTH_EVIDENCE_REQUIRED', authority: 'NONE' });
  }
  if (input.rawOutputs != null || input.bytes != null || input.sourceCode != null) {
    return Object.freeze({ schema: 'axm.code.software-experiment-outcome.v1', result: 'RAW_EXPERIMENT_OUTPUT_REFUSED_FROM_OUTCOME_STATE', authority: 'NONE' });
  }
  const outcomeClass = String(input.outcomeClass || 'INCONCLUSIVE').toUpperCase();
  if (!OUTCOME_CLASSES.has(outcomeClass)) {
    return Object.freeze({ schema: 'axm.code.software-experiment-outcome.v1', result: 'OUTCOME_CLASS_INVALID', allowedClasses: [...OUTCOME_CLASSES].sort(), authority: 'NONE' });
  }
  const observedItemCount = Number(input.observedItemCount || 0);
  const transientItemCount = Number(input.transientItemCount || 0);
  if (!nonNegativeSafeInteger(observedItemCount) || !nonNegativeSafeInteger(transientItemCount) || transientItemCount > observedItemCount) {
    return Object.freeze({ schema: 'axm.code.software-experiment-outcome.v1', result: 'EXPERIMENT_ITEM_COUNTS_INVALID', authority: 'NONE' });
  }
  const retainedArtifactDigests = strings(input.retainedArtifactDigests, 1024).sort();
  if (retainedArtifactDigests.length > observedItemCount) {
    return Object.freeze({ schema: 'axm.code.software-experiment-outcome.v1', result: 'RETAINED_COUNT_EXCEEDS_OBSERVED_COUNT', authority: 'NONE' });
  }
  if (transientItemCount > 0 && (!input.retentionDeclaredBeforeRun || !input.coverageSummaryDigest || !input.experimentManifestDigest)) {
    return Object.freeze({
      schema: 'axm.code.software-experiment-outcome.v1',
      result: 'TRANSIENT_RELEASE_HELD_RETENTION_EVIDENCE_MISSING',
      required: ['retentionDeclaredBeforeRun', 'coverageSummaryDigest', 'experimentManifestDigest'],
      authority: 'NONE'
    });
  }
  const healthHold = ['CRITICAL', 'UNKNOWN'].includes(hardwareHealth.overall);
  const core = {
    schema: 'axm.code.software-experiment-outcome.v1',
    version: '1.0.0',
    result: healthHold ? 'EXPERIMENT_OBSERVED_HARDWARE_HEALTH_HOLD' : 'EXPERIMENT_OBSERVED_NOT_ADMITTED_OR_PROMOTED',
    projectId: workspace.projectId,
    workspaceSha256: workspace.workspaceSha256,
    directionSha256: experiment.directionSha256,
    batchSha256: experiment.batchSha256,
    draftId: experiment.draftId,
    draftRevisionSha256: experiment.draftRevisionSha256,
    candidateArtifactDigest: experiment.candidateArtifactDigest,
    experimentSha256: experiment.experimentSha256,
    requestSha256: request.requestSha256,
    executorReceiptSha256: executorReceipt.executorReceiptSha256,
    hardwareHealthSha256: hardwareHealth.healthSha256,
    outcomeClass,
    observations: strings(input.observations, 256),
    evidenceDigests: strings(input.evidenceDigests, 1024).sort(),
    retention: {
      observedItemCount,
      retainedArtifactDigests,
      retainedArtifactCount: retainedArtifactDigests.length,
      transientItemCount,
      retentionDeclaredBeforeRun: input.retentionDeclaredBeforeRun === true,
      experimentManifestDigest: input.experimentManifestDigest == null ? null : String(input.experimentManifestDigest),
      coverageSummaryDigest: input.coverageSummaryDigest == null ? null : String(input.coverageSummaryDigest),
      regenerationRecipeDigest: input.regenerationRecipeDigest == null ? null : String(input.regenerationRecipeDigest),
      state: transientItemCount > 0 ? 'EVIDENCE_COVERAGE_RETAINED_TRANSIENT_ITEMS_RELEASE_CANDIDATE' : 'NO_TRANSIENT_RELEASE_RECORDED'
    },
    truth: {
      observedOutcomeIsNotCorrectnessProof: true,
      successfulExperimentIsNotAdmission: true,
      successfulExperimentIsNotPromotion: true,
      counterevidencePreserved: outcomeClass === 'COUNTEREVIDENCE',
      millionItemExperimentAllowedByThisMetadataContract: observedItemCount >= 1000000,
      metadataListBoundIsNotExperimentVolumeCap: true,
      transientReleaseIsDeclaredNotSilent: transientItemCount === 0 || input.retentionDeclaredBeforeRun === true,
      rawExperimentOutputsStoredHere: false
    },
    authority: 'NONE'
  };
  return Object.freeze({ ...core, outcomeSha256: hash(core) });
}

function createSaveManifest(input = {}) {
  const { workspace, experiment, outcome } = input;
  if (!validWorkspace(workspace) || !experiment || !digestCurrent(experiment, 'experimentSha256') || !outcome || !digestCurrent(outcome, 'outcomeSha256')) {
    return Object.freeze({ schema: 'axm.code.software-experiment-save.v1', result: 'INVALID_WORKSPACE_EXPERIMENT_OR_OUTCOME', authority: 'NONE' });
  }
  if (experiment.workspaceSha256 !== workspace.workspaceSha256 || outcome.experimentSha256 !== experiment.experimentSha256) {
    return Object.freeze({ schema: 'axm.code.software-experiment-save.v1', result: 'FOREIGN_SAVE_BINDING', authority: 'NONE' });
  }
  if (input.payload != null || input.bytes != null || input.body != null || input.sourceCode != null) {
    return Object.freeze({ schema: 'axm.code.software-experiment-save.v1', result: 'RAW_SAVE_PAYLOAD_REFUSED_FROM_MANIFEST', authority: 'NONE' });
  }
  const sid = slotId(input.slotId);
  if (!sid) {
    return Object.freeze({ schema: 'axm.code.software-experiment-save.v1', result: 'SAVE_SLOT_INVALID', allowedSlots: workspace.saveLayout.slots.map(slot => slot.slotId), authority: 'NONE' });
  }
  const byteLength = Number(input.byteLength);
  if (!nonNegativeSafeInteger(byteLength) || byteLength > MAX_SAVE_BYTES) {
    return Object.freeze({
      schema: 'axm.code.software-experiment-save.v1',
      result: 'SAVE_SLOT_PAYLOAD_TOO_LARGE_OR_INVALID',
      slotId: sid,
      byteLength: Number.isFinite(byteLength) ? byteLength : null,
      maxBytes: MAX_SAVE_BYTES,
      authority: 'NONE'
    });
  }
  if (!input.payloadDigest || !input.contentsManifestDigest) {
    return Object.freeze({ schema: 'axm.code.software-experiment-save.v1', result: 'SAVE_PAYLOAD_AND_CONTENTS_DIGESTS_REQUIRED', slotId: sid, authority: 'NONE' });
  }
  const core = {
    schema: 'axm.code.software-experiment-save.v1',
    version: '1.0.0',
    result: 'SAVE_SLOT_MANIFEST_READY_FOR_SCOPED_PAYLOAD_STORE',
    projectId: workspace.projectId,
    workspaceSha256: workspace.workspaceSha256,
    slotId: sid,
    experimentSha256: experiment.experimentSha256,
    outcomeSha256: outcome.outcomeSha256,
    candidateArtifactDigest: experiment.candidateArtifactDigest,
    label: input.label == null ? null : String(input.label),
    byteLength,
    maxBytes: MAX_SAVE_BYTES,
    payloadDigest: String(input.payloadDigest),
    contentsManifestDigest: String(input.contentsManifestDigest),
    replacesSaveSha256: input.replacesSaveSha256 == null ? null : String(input.replacesSaveSha256),
    truth: {
      oneActivePayloadPerSlot: true,
      replacementMustNameExpectedParent: true,
      replacedRawPayloadMayBeReleasedAfterReceipt: true,
      replacedPayloadDigestHistoryMustRemain: true,
      rawPayloadStoredInManifest: false,
      saveIsNotPromotion: true
    },
    authority: 'NONE'
  };
  return Object.freeze({ ...core, saveSha256: hash(core) });
}

function assessSaveSet({ workspace, saves = [] } = {}) {
  if (!validWorkspace(workspace)) {
    return Object.freeze({ schema: 'axm.code.software-experiment-save-set.v1', result: 'INVALID_WORKSPACE', authority: 'NONE' });
  }
  const items = Array.isArray(saves) ? saves : [];
  const invalid = items.filter(save =>
    !save ||
    save.schema !== 'axm.code.software-experiment-save.v1' ||
    save.workspaceSha256 !== workspace.workspaceSha256 ||
    !digestCurrent(save, 'saveSha256') ||
    !slotId(save.slotId) ||
    save.byteLength > MAX_SAVE_BYTES
  );
  if (invalid.length) {
    return Object.freeze({ schema: 'axm.code.software-experiment-save-set.v1', result: 'INVALID_OR_FOREIGN_SAVE_MANIFEST', invalidCount: invalid.length, authority: 'NONE' });
  }
  const active = [];
  const problems = [];
  for (const sid of workspace.saveLayout.slots.map(slot => slot.slotId)) {
    const group = items.filter(save => save.slotId === sid);
    if (!group.length) continue;
    const bySha = new Map(group.map(save => [save.saveSha256, save]));
    const referenced = new Set(group.map(save => save.replacesSaveSha256).filter(Boolean));
    for (const save of group) {
      if (save.replacesSaveSha256 && !bySha.has(save.replacesSaveSha256)) {
        problems.push({ code: 'SAVE_REPLACEMENT_PARENT_MISSING', slotId: sid, saveSha256: save.saveSha256, parent: save.replacesSaveSha256 });
      }
    }
    const heads = group.filter(save => !referenced.has(save.saveSha256));
    if (heads.length !== 1) {
      problems.push({ code: 'SAVE_SLOT_LINEAGE_AMBIGUOUS', slotId: sid, headCount: heads.length });
      continue;
    }
    const visited = new Set();
    let cursor = heads[0];
    while (cursor) {
      if (visited.has(cursor.saveSha256)) {
        problems.push({ code: 'SAVE_SLOT_LINEAGE_CYCLE', slotId: sid });
        break;
      }
      visited.add(cursor.saveSha256);
      cursor = cursor.replacesSaveSha256 ? bySha.get(cursor.replacesSaveSha256) : null;
    }
    if (visited.size !== group.length) problems.push({ code: 'SAVE_SLOT_LINEAGE_DISCONNECTED', slotId: sid, visited: visited.size, manifestCount: group.length });
    active.push(heads[0]);
  }
  const totalActiveBytes = active.reduce((sum, save) => sum + save.byteLength, 0);
  if (totalActiveBytes > MAX_ACTIVE_SAVE_BYTES) problems.push({ code: 'ACTIVE_SAVE_BYTES_EXCEED_WORKSPACE_LIMIT', totalActiveBytes, maxActiveBytes: MAX_ACTIVE_SAVE_BYTES });
  const core = {
    schema: 'axm.code.software-experiment-save-set.v1',
    version: '1.0.0',
    result: problems.length ? 'SAVE_SET_HELD' : 'SAVE_SET_READY',
    projectId: workspace.projectId,
    workspaceSha256: workspace.workspaceSha256,
    slotCount: SAVE_SLOT_COUNT,
    occupiedSlotCount: active.length,
    activeSaves: active.sort((a, b) => a.slotId.localeCompare(b.slotId)).map(save => ({
      slotId: save.slotId,
      saveSha256: save.saveSha256,
      payloadDigest: save.payloadDigest,
      byteLength: save.byteLength,
      outcomeSha256: save.outcomeSha256
    })),
    totalActiveBytes,
    maxActiveBytes: MAX_ACTIVE_SAVE_BYTES,
    problems,
    truth: {
      onlyActivePayloadsCountTowardLimit: true,
      replacementHistoryRetainsMetadataNotOldPayloadBytes: true,
      fiveSlotsMaximum: true,
      saveSetDoesNotRankExperiments: true
    },
    authority: 'NONE'
  };
  return Object.freeze({ ...core, saveSetSha256: hash(core) });
}

function assessIterationPersistence({ workspace, saveSet = null, saveIntent = null } = {}) {
  if (!validWorkspace(workspace)) {
    return Object.freeze({ schema: 'axm.code.software-experiment-iteration-persistence.v1', result: 'INVALID_WORKSPACE', authority: 'NONE' });
  }
  if (saveSet && (
    saveSet.schema !== 'axm.code.software-experiment-save-set.v1' ||
    saveSet.workspaceSha256 !== workspace.workspaceSha256 ||
    saveSet.result !== 'SAVE_SET_READY' ||
    !digestCurrent(saveSet, 'saveSetSha256')
  )) {
    return Object.freeze({ schema: 'axm.code.software-experiment-iteration-persistence.v1', result: 'CURRENT_VALID_SAVE_SET_REQUIRED', authority: 'NONE' });
  }
  if (!saveIntent || !saveIntent.mode) {
    return Object.freeze({
      schema: 'axm.code.software-experiment-iteration-persistence.v1',
      result: 'ITERATION_SAVE_INTENT_REQUIRED',
      allowedModes: ['TRANSIENT_NO_SAVE', 'SAVE_NEW', 'REPLACE_SLOT'],
      authority: 'NONE'
    });
  }
  const mode = String(saveIntent.mode).toUpperCase();
  const active = saveSet && Array.isArray(saveSet.activeSaves) ? saveSet.activeSaves : [];
  const activeBySlot = new Map(active.map(save => [save.slotId, save]));
  const emptySlots = workspace.saveLayout.slots.map(slot => slot.slotId).filter(id => !activeBySlot.has(id));
  let result;
  let slot = null;
  let replacesSaveSha256 = null;
  if (mode === 'TRANSIENT_NO_SAVE') {
    result = 'ITERATION_TRANSIENT_ALLOWED_NOT_EXECUTION_PERMISSION';
  } else if (mode === 'SAVE_NEW') {
    if (!emptySlots.length) {
      result = 'ITERATION_PERSISTENCE_HELD_ALL_SAVE_SLOTS_OCCUPIED';
    } else {
      result = 'ITERATION_NEW_SAVE_SLOT_AVAILABLE_NOT_EXECUTION_PERMISSION';
      slot = emptySlots[0];
    }
  } else if (mode === 'REPLACE_SLOT') {
    slot = slotId(saveIntent.slotId);
    if (!slot || !activeBySlot.has(slot)) {
      return Object.freeze({
        schema: 'axm.code.software-experiment-iteration-persistence.v1',
        result: 'ITERATION_REPLACEMENT_ACTIVE_SLOT_REQUIRED',
        requestedSlotId: saveIntent.slotId == null ? null : String(saveIntent.slotId),
        authority: 'NONE'
      });
    }
    const current = activeBySlot.get(slot);
    if (!saveIntent.expectedSaveSha256 || String(saveIntent.expectedSaveSha256) !== current.saveSha256) {
      return Object.freeze({
        schema: 'axm.code.software-experiment-iteration-persistence.v1',
        result: 'ITERATION_REPLACEMENT_EXPECTED_PARENT_MISMATCH',
        slotId: slot,
        currentSaveSha256: current.saveSha256,
        authority: 'NONE'
      });
    }
    result = 'ITERATION_EXPLICIT_SLOT_REPLACEMENT_READY_NOT_EXECUTION_PERMISSION';
    replacesSaveSha256 = current.saveSha256;
  } else {
    return Object.freeze({
      schema: 'axm.code.software-experiment-iteration-persistence.v1',
      result: 'ITERATION_SAVE_MODE_INVALID',
      mode,
      allowedModes: ['TRANSIENT_NO_SAVE', 'SAVE_NEW', 'REPLACE_SLOT'],
      authority: 'NONE'
    });
  }
  const core = {
    schema: 'axm.code.software-experiment-iteration-persistence.v1',
    version: '1.0.0',
    result,
    projectId: workspace.projectId,
    workspaceSha256: workspace.workspaceSha256,
    saveSetSha256: saveSet && saveSet.saveSetSha256 || null,
    mode,
    occupiedSlotCount: active.length,
    emptySlotCount: emptySlots.length,
    slotId: slot,
    replacesSaveSha256,
    truth: {
      loopMayNotCreateSixthSaveSlot: true,
      transientIterationDoesNotConsumeSaveSlot: true,
      fullSaveSetRequiresExplicitReplacementOrNoSave: true,
      replacementMustBindCurrentParentDigest: true,
      persistenceDecisionIsNotExecutionPermission: true
    },
    authority: 'NONE'
  };
  return Object.freeze({ ...core, iterationPersistenceSha256: hash(core) });
}

function createDraftEvidenceCandidate({ workspace, experiment, outcome, save = null } = {}) {
  if (!validWorkspace(workspace) || !experiment || !digestCurrent(experiment, 'experimentSha256') || !outcome || !digestCurrent(outcome, 'outcomeSha256')) {
    return Object.freeze({ schema: 'axm.code.software-experiment-draft-evidence.v1', result: 'INVALID_EXPERIMENT_OR_OUTCOME', authority: 'NONE' });
  }
  if (outcome.experimentSha256 !== experiment.experimentSha256) {
    return Object.freeze({ schema: 'axm.code.software-experiment-draft-evidence.v1', result: 'FOREIGN_OUTCOME', authority: 'NONE' });
  }
  if (save && (!digestCurrent(save, 'saveSha256') || save.outcomeSha256 !== outcome.outcomeSha256)) {
    return Object.freeze({ schema: 'axm.code.software-experiment-draft-evidence.v1', result: 'FOREIGN_OR_STALE_SAVE', authority: 'NONE' });
  }
  const core = {
    schema: 'axm.code.software-experiment-draft-evidence.v1',
    version: '1.0.0',
    result: 'SOFTWARE_EXPERIMENT_EVIDENCE_CANDIDATE_NOT_ADMISSION',
    projectId: workspace.projectId,
    workspaceSha256: workspace.workspaceSha256,
    batchSha256: experiment.batchSha256,
    draftId: experiment.draftId,
    draftRevisionSha256: experiment.draftRevisionSha256,
    candidateArtifactDigest: experiment.candidateArtifactDigest,
    experimentSha256: experiment.experimentSha256,
    outcomeSha256: outcome.outcomeSha256,
    outcomeClass: outcome.outcomeClass,
    saveSha256: save && save.saveSha256 || null,
    slotId: save && save.slotId || null,
    truth: {
      evidenceCandidateIsNotAdmission: true,
      evidenceCandidateIsNotSelection: true,
      evidenceCandidateIsNotPromotion: true,
      draftMutationPerformed: false
    },
    authority: 'NONE'
  };
  return Object.freeze({ ...core, draftEvidenceSha256: hash(core) });
}

function summarize({ workspace, experiments = [], outcomes = [], saveSet = null, hardwareHealth = null } = {}) {
  if (!validWorkspace(workspace)) {
    return Object.freeze({ schema: 'axm.code.software-experiment-summary.v1', result: 'INVALID_WORKSPACE', authority: 'NONE' });
  }
  const validExperiments = (Array.isArray(experiments) ? experiments : []).filter(experiment => experiment && experiment.workspaceSha256 === workspace.workspaceSha256 && digestCurrent(experiment, 'experimentSha256'));
  const validOutcomes = (Array.isArray(outcomes) ? outcomes : []).filter(outcome => outcome && outcome.workspaceSha256 === workspace.workspaceSha256 && digestCurrent(outcome, 'outcomeSha256'));
  const core = {
    schema: 'axm.code.software-experiment-summary.v1',
    version: '1.0.0',
    result: 'SOFTWARE_EXPERIMENT_SUMMARY_READY',
    projectId: workspace.projectId,
    workspaceSha256: workspace.workspaceSha256,
    directionSha256: workspace.directionSha256,
    experimentCount: validExperiments.length,
    outcomeCount: validOutcomes.length,
    outcomesByClass: Object.fromEntries([...OUTCOME_CLASSES].sort().map(kind => [kind, validOutcomes.filter(outcome => outcome.outcomeClass === kind).length])),
    hardwareState: hardwareHealth && hardwareHealth.workspaceSha256 === workspace.workspaceSha256 ? hardwareHealth.result : 'NOT_SUPPLIED',
    saveSet: saveSet && saveSet.workspaceSha256 === workspace.workspaceSha256 ? {
      result: saveSet.result,
      occupiedSlotCount: saveSet.occupiedSlotCount,
      totalActiveBytes: saveSet.totalActiveBytes,
      maxActiveBytes: saveSet.maxActiveBytes,
      activeSaves: saveSet.activeSaves
    } : null,
    truth: {
      summaryIsDerived: true,
      summaryDoesNotRankCandidates: true,
      failedAndCounterevidenceOutcomesRemainVisible: true,
      saveStateIsNotPromotion: true
    },
    authority: 'NONE'
  };
  return Object.freeze({ ...core, summarySha256: hash(core) });
}

function snapshot() {
  const core = {
    schema: 'axm.code.built-software-experiment-sandbox-snapshot.v1',
    version: '1.0.0',
    saveSlotCount: SAVE_SLOT_COUNT,
    maxSaveBytes: MAX_SAVE_BYTES,
    maxActiveSaveBytes: MAX_ACTIVE_SAVE_BYTES,
    resourceModel: 'ADAPTIVE_HARDWARE_HEALTH_PLUS_BOUNDED_PERSISTENT_SAVE_SLOTS',
    sandboxScope: 'BUILT_SOFTWARE_ONLY',
    schemas: [
      'axm.code.built-software-sandbox-workspace.v1',
      'axm.code.built-software-experiment.v1',
      'axm.code.software-experiment-execution-request.v1',
      'axm.code.software-experiment-hardware-health.v1',
      'axm.code.external-sandbox-executor-receipt.v1',
      'axm.code.software-experiment-outcome.v1',
      'axm.code.software-experiment-save.v1',
      'axm.code.software-experiment-save-set.v1',
      'axm.code.software-experiment-iteration-persistence.v1',
      'axm.code.software-experiment-draft-evidence.v1',
      'axm.code.software-experiment-summary.v1'
    ],
    authority: 'NONE'
  };
  return Object.freeze({ ...core, snapshotSha256: hash(core) });
}

module.exports = {
  SAVE_SLOT_COUNT,
  MAX_SAVE_BYTES,
  MAX_ACTIVE_SAVE_BYTES,
  createWorkspace,
  createExperiment,
  createExecutionRequest,
  assessHardwareHealth,
  sealExecutorReceipt,
  recordOutcome,
  createSaveManifest,
  assessSaveSet,
  assessIterationPersistence,
  createDraftEvidenceCandidate,
  summarize,
  snapshot
};
