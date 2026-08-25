'use strict';

const assert = require('assert');
const dock = require('./code-work-context-dock.js');
const sandbox = require('./code-built-software-experiment-sandbox.js');

const direction = dock.createDirection({
  projectId: 'bold-software-fixture',
  actorClass: 'HUMAN',
  title: 'Bold built-software experiments',
  goal: 'Let the creator produce uncertain software ideas and test only the resulting software in an enforced sandbox.',
  directionalPrompt: 'Do not cage idea generation. Contain candidate consequences, observe hardware health, and retain only sufficient evidence plus five explicit saves.',
  roadmap: ['build candidate', 'run candidate externally', 'observe evidence', 'retain or revise'],
  steps: [
    { id: 'build', title: 'Build a candidate artifact' },
    { id: 'experiment', title: 'Experiment with the built artifact', dependsOn: ['build'] },
    { id: 'review', title: 'Review evidence without automatic promotion', dependsOn: ['experiment'] }
  ],
  constraints: ['five save slots', '100 MB per slot', 'no silent quality downgrade', 'no automatic promotion']
});
assert.strictEqual(direction.schema, 'axm.code.work-direction.v1');
assert.strictEqual(direction.validation.usable, true);

const workspace = sandbox.createWorkspace({
  projectId: direction.projectId,
  direction,
  workspaceId: 'creator-built-software-lab',
  title: 'Creator Built-Software Lab'
});
assert.strictEqual(workspace.result, 'BUILT_SOFTWARE_SANDBOX_WORKSPACE_READY');
assert.strictEqual(workspace.sandboxScope, 'SOFTWARE_BUILT_BY_CREATOR_ONLY');
assert.strictEqual(workspace.creatorScope.ideaGenerationSandboxed, false);
assert.strictEqual(workspace.creatorScope.reasoningQualityCapped, false);
assert.strictEqual(workspace.runtimeContract.thisModuleIsRuntimeContainment, false);
assert.strictEqual(workspace.runtimeContract.hardwareModel, 'ADAPTIVE_HEALTH_AND_SHARED_PRESSURE_NOT_FIXED_TOKEN_OR_COMPUTE_CAP');
assert.strictEqual(workspace.saveLayout.slotCount, 5);
assert.strictEqual(workspace.saveLayout.maxBytesPerActiveSlot, 100000000);
assert.strictEqual(workspace.saveLayout.maxActiveBytesAcrossSlots, 500000000);
assert.deepStrictEqual(sandbox.createWorkspace({ projectId: direction.projectId, direction, workspaceId: 'creator-built-software-lab', title: 'Creator Built-Software Lab' }), workspace);

const batch = Object.freeze({
  schema: 'axm.code.production-batch.v1',
  result: 'PRODUCTION_BATCH_READY',
  projectId: direction.projectId,
  directionSha256: direction.directionSha256,
  batchSha256: 'sha256:bold-software-batch',
  draftCount: 1,
  slots: [{ draftId: 'draft-01' }]
});
const draft = Object.freeze({
  schema: 'axm.code.production-draft-revision.v1',
  result: 'EDITABLE_DRAFT_READY',
  projectId: direction.projectId,
  batchSha256: batch.batchSha256,
  directionSha256: direction.directionSha256,
  draftId: 'draft-01',
  revision: 4,
  draftRevisionSha256: 'sha256:bold-software-draft-rev-4',
  artifact: {
    digest: 'sha256:bold-software-artifact',
    kind: 'experimental-runtime'
  }
});
const draftWithoutArtifact = { ...draft, draftRevisionSha256: 'sha256:no-artifact', artifact: null };

const experiment = sandbox.createExperiment({
  workspace,
  batch,
  draft,
  purpose: 'Try a bold uncertain generation loop and observe what the built software actually produces.',
  hypotheses: ['The candidate may discover useful visual families without a predefined winner.'],
  unknowns: ['Runtime behavior is unknown until observed.', 'A long loop may produce mostly duplicates.'],
  requiredObservations: ['termination behavior', 'novelty coverage', 'hardware pressure', 'failure families'],
  inputFixtureDigests: ['sha256:fixture-a'],
  networkMode: 'NONE'
});
assert.strictEqual(experiment.result, 'SOFTWARE_EXPERIMENT_READY_EXTERNAL_ENFORCED_SANDBOX_REQUIRED');
assert.strictEqual(experiment.candidateArtifactDigest, draft.artifact.digest);
assert.strictEqual(experiment.truth.creatorReasoningSandboxed, false);
assert.strictEqual(experiment.truth.builtCandidateMustBeSandboxed, true);
assert.strictEqual(sandbox.createExperiment({ workspace, batch, draft: draftWithoutArtifact }).result, 'RENDERED_OR_COMPILED_ARTIFACT_REQUIRED');
assert.strictEqual(sandbox.createExperiment({ workspace, batch, draft, networkMode: 'EXPLICIT_SCOPED' }).result, 'SCOPED_NETWORK_POLICY_DIGEST_REQUIRED');

assert.strictEqual(sandbox.createExecutionRequest({ workspace, experiment }).result, 'EXTERNAL_ENFORCED_EXECUTOR_ADAPTER_REQUIRED');
const request = sandbox.createExecutionRequest({
  workspace,
  experiment,
  actorClass: 'AI',
  runLabel: 'million-picture-coverage-probe',
  executorAdapter: {
    id: 'fixture-vm-executor',
    digest: 'sha256:fixture-vm-executor-v1',
    enforcementClass: 'VM'
  }
});
assert.strictEqual(request.result, 'EXECUTION_REQUEST_READY_NOT_EXECUTED');
assert.strictEqual(request.truth.requestWasNotExecutedByThisModule, true);
assert.strictEqual(request.requiredContract.noReasoningQualityDowngrade, true);

const normalTelemetry = {
  evidenceDigest: 'sha256:hardware-health-normal',
  memory: 'NORMAL',
  swap: 'NORMAL',
  thermal: 'NORMAL',
  disk: 'NORMAL',
  io: 'NORMAL',
  interactiveLatency: 'NORMAL',
  sharedQueue: 'NORMAL'
};
const healthy = sandbox.assessHardwareHealth({ workspace, telemetry: normalTelemetry });
assert.strictEqual(healthy.result, 'HARDWARE_HEALTHY_TO_CONTINUE_NOT_EXECUTION_PERMISSION');
assert.strictEqual(healthy.truth.tokenCountIsNotHardwareHealth, true);
const elevated = sandbox.assessHardwareHealth({ workspace, telemetry: { ...normalTelemetry, evidenceDigest: 'sha256:elevated', sharedQueue: 'ELEVATED' } });
assert.strictEqual(elevated.result, 'ADAPT_WORKLOAD_SHAPE_PRESERVE_QUALITY');
assert(elevated.allowedResponses.includes('REDUCE_CONCURRENCY'));
assert(elevated.forbiddenResponses.includes('SILENT_REASONING_QUALITY_DOWNGRADE'));
const critical = sandbox.assessHardwareHealth({ workspace, telemetry: { ...normalTelemetry, evidenceDigest: 'sha256:critical', thermal: 'CRITICAL' } });
assert.strictEqual(critical.result, 'PAUSE_FOR_HARDWARE_HEALTH');
const unknown = sandbox.assessHardwareHealth({ workspace, telemetry: { evidenceDigest: 'sha256:partial-health', memory: 'NORMAL' } });
assert.strictEqual(unknown.result, 'HARDWARE_HEALTH_UNKNOWN_QUEUE_OR_OBSERVE');
assert.strictEqual(sandbox.assessHardwareHealth({ workspace }).result, 'HARDWARE_HEALTH_EVIDENCE_REQUIRED');

const heldExecutor = sandbox.sealExecutorReceipt({
  workspace,
  experiment,
  request,
  executorId: 'fixture-vm-executor',
  executorDigest: 'sha256:fixture-vm-executor-v1',
  containmentEvidenceDigest: 'sha256:containment',
  processIsolation: false,
  ephemeralWorkspace: true,
  sourceWorkspaceWrite: false,
  hardwareGovernorBound: true,
  networkMode: 'NONE'
});
assert.strictEqual(heldExecutor.result, 'EXECUTOR_CONTAINMENT_RECEIPT_HELD');
assert(heldExecutor.missing.includes('processIsolation'));

const executorReceipt = sandbox.sealExecutorReceipt({
  workspace,
  experiment,
  request,
  executorId: 'fixture-vm-executor',
  executorDigest: 'sha256:fixture-vm-executor-v1',
  containmentEvidenceDigest: 'sha256:containment-observation-v1',
  processIsolation: true,
  ephemeralWorkspace: true,
  sourceWorkspaceWrite: false,
  hardwareGovernorBound: true,
  networkMode: 'NONE',
  exitCode: 0,
  terminationReason: 'BOUNDED_EXPERIMENT_COMPLETE',
  stdoutDigest: 'sha256:stdout-digest-only',
  stderrDigest: 'sha256:stderr-digest-only'
});
assert.strictEqual(executorReceipt.result, 'EXTERNAL_SANDBOX_OBSERVATION_SEALED_NOT_INDEPENDENTLY_VERIFIED');
assert.strictEqual(executorReceipt.containment.sourceWorkspaceWrite, false);
assert.strictEqual(executorReceipt.truth.rawStdoutOrStderrStored, false);
assert.strictEqual(sandbox.sealExecutorReceipt({ workspace, experiment, request, stdout: 'raw output' }).result, 'RAW_EXECUTION_OUTPUT_REFUSED_FROM_RECEIPT');

const retained = Array.from({ length: 6 }, (_, index) => `sha256:representative-image-${index + 1}`);
const outcome = sandbox.recordOutcome({
  workspace,
  experiment,
  request,
  executorReceipt,
  hardwareHealth: healthy,
  outcomeClass: 'NOVEL_BEHAVIOR_OBSERVED',
  observations: ['One million generated items were clustered into six representative evidence families.'],
  evidenceDigests: ['sha256:novelty-metrics', 'sha256:failure-family-metrics'],
  observedItemCount: 1000000,
  retainedArtifactDigests: retained,
  transientItemCount: 999994,
  retentionDeclaredBeforeRun: true,
  experimentManifestDigest: 'sha256:million-item-experiment-manifest',
  coverageSummaryDigest: 'sha256:six-family-coverage-summary',
  regenerationRecipeDigest: 'sha256:regeneration-recipe'
});
assert.strictEqual(outcome.result, 'EXPERIMENT_OBSERVED_NOT_ADMITTED_OR_PROMOTED');
assert.strictEqual(outcome.retention.observedItemCount, 1000000);
assert.strictEqual(outcome.retention.retainedArtifactCount, 6);
assert.strictEqual(outcome.retention.transientItemCount, 999994);
assert.strictEqual(outcome.truth.millionItemExperimentAllowedByThisMetadataContract, true);
assert.strictEqual(outcome.truth.metadataListBoundIsNotExperimentVolumeCap, true);
assert.strictEqual(outcome.truth.transientReleaseIsDeclaredNotSilent, true);

const missingRetention = sandbox.recordOutcome({
  workspace,
  experiment,
  request,
  executorReceipt,
  hardwareHealth: healthy,
  observedItemCount: 1000000,
  transientItemCount: 999994,
  retainedArtifactDigests: retained
});
assert.strictEqual(missingRetention.result, 'TRANSIENT_RELEASE_HELD_RETENTION_EVIDENCE_MISSING');
assert.strictEqual(sandbox.recordOutcome({ workspace, experiment, request, executorReceipt, hardwareHealth: healthy, rawOutputs: ['bytes'] }).result, 'RAW_EXPERIMENT_OUTPUT_REFUSED_FROM_OUTCOME_STATE');
const criticalOutcome = sandbox.recordOutcome({ workspace, experiment, request, executorReceipt, hardwareHealth: critical, observedItemCount: 0 });
assert.strictEqual(criticalOutcome.result, 'EXPERIMENT_OBSERVED_HARDWARE_HEALTH_HOLD');

function saveFor(slot, replacesSaveSha256 = null, suffix = '') {
  return sandbox.createSaveManifest({
    workspace,
    experiment,
    outcome,
    slotId: slot,
    label: `Representative checkpoint ${slot}${suffix}`,
    byteLength: 80000000 + slot,
    payloadDigest: `sha256:save-payload-${slot}${suffix}`,
    contentsManifestDigest: `sha256:save-contents-${slot}${suffix}`,
    replacesSaveSha256
  });
}

const saves = Array.from({ length: 5 }, (_, index) => saveFor(index + 1));
assert(saves.every(save => save.result === 'SAVE_SLOT_MANIFEST_READY_FOR_SCOPED_PAYLOAD_STORE'));
assert.strictEqual(sandbox.createSaveManifest({ workspace, experiment, outcome, slotId: 6, byteLength: 1, payloadDigest: 'sha256:x', contentsManifestDigest: 'sha256:y' }).result, 'SAVE_SLOT_INVALID');
assert.strictEqual(sandbox.createSaveManifest({ workspace, experiment, outcome, slotId: 1, byteLength: 100000001, payloadDigest: 'sha256:x', contentsManifestDigest: 'sha256:y' }).result, 'SAVE_SLOT_PAYLOAD_TOO_LARGE_OR_INVALID');
assert.strictEqual(sandbox.createSaveManifest({ workspace, experiment, outcome, slotId: 1, byteLength: 1, payloadDigest: 'sha256:x', contentsManifestDigest: 'sha256:y', payload: Buffer.from('raw') }).result, 'RAW_SAVE_PAYLOAD_REFUSED_FROM_MANIFEST');

const fullSaveSet = sandbox.assessSaveSet({ workspace, saves });
assert.strictEqual(fullSaveSet.result, 'SAVE_SET_READY');
assert.strictEqual(fullSaveSet.occupiedSlotCount, 5);
assert(fullSaveSet.totalActiveBytes < 500000000);
assert.strictEqual(sandbox.assessIterationPersistence({ workspace, saveSet: fullSaveSet, saveIntent: { mode: 'SAVE_NEW' } }).result, 'ITERATION_PERSISTENCE_HELD_ALL_SAVE_SLOTS_OCCUPIED');
const transientLoop = sandbox.assessIterationPersistence({ workspace, saveSet: fullSaveSet, saveIntent: { mode: 'TRANSIENT_NO_SAVE' } });
assert.strictEqual(transientLoop.result, 'ITERATION_TRANSIENT_ALLOWED_NOT_EXECUTION_PERMISSION');
assert.strictEqual(transientLoop.truth.loopMayNotCreateSixthSaveSlot, true);
assert.strictEqual(transientLoop.truth.transientIterationDoesNotConsumeSaveSlot, true);
assert.strictEqual(sandbox.assessIterationPersistence({ workspace, saveSet: fullSaveSet, saveIntent: { mode: 'REPLACE_SLOT', slotId: 1, expectedSaveSha256: 'sha256:wrong' } }).result, 'ITERATION_REPLACEMENT_EXPECTED_PARENT_MISMATCH');
const replaceGate = sandbox.assessIterationPersistence({
  workspace,
  saveSet: fullSaveSet,
  saveIntent: { mode: 'REPLACE_SLOT', slotId: 1, expectedSaveSha256: saves[0].saveSha256 }
});
assert.strictEqual(replaceGate.result, 'ITERATION_EXPLICIT_SLOT_REPLACEMENT_READY_NOT_EXECUTION_PERMISSION');
assert.strictEqual(replaceGate.replacesSaveSha256, saves[0].saveSha256);

const replacement = saveFor(1, saves[0].saveSha256, '-replacement');
const replacedSet = sandbox.assessSaveSet({ workspace, saves: [...saves, replacement] });
assert.strictEqual(replacedSet.result, 'SAVE_SET_READY');
assert.strictEqual(replacedSet.occupiedSlotCount, 5);
assert.strictEqual(replacedSet.activeSaves.find(save => save.slotId === 'save-01').saveSha256, replacement.saveSha256);
const competingReplacement = saveFor(1, saves[0].saveSha256, '-competing');
assert.strictEqual(sandbox.assessSaveSet({ workspace, saves: [...saves, replacement, competingReplacement] }).result, 'SAVE_SET_HELD');

const draftEvidence = sandbox.createDraftEvidenceCandidate({ workspace, experiment, outcome, save: replacement });
assert.strictEqual(draftEvidence.result, 'SOFTWARE_EXPERIMENT_EVIDENCE_CANDIDATE_NOT_ADMISSION');
assert.strictEqual(draftEvidence.truth.draftMutationPerformed, false);
assert.strictEqual(draftEvidence.truth.evidenceCandidateIsNotPromotion, true);

const summary = sandbox.summarize({
  workspace,
  experiments: [experiment],
  outcomes: [outcome, criticalOutcome],
  saveSet: replacedSet,
  hardwareHealth: healthy
});
assert.strictEqual(summary.result, 'SOFTWARE_EXPERIMENT_SUMMARY_READY');
assert.strictEqual(summary.experimentCount, 1);
assert.strictEqual(summary.outcomeCount, 2);
assert.strictEqual(summary.saveSet.occupiedSlotCount, 5);
assert.strictEqual(summary.truth.summaryDoesNotRankCandidates, true);

const snapshot = sandbox.snapshot();
assert.strictEqual(snapshot.saveSlotCount, 5);
assert.strictEqual(snapshot.maxSaveBytes, 100000000);
assert.strictEqual(snapshot.maxActiveSaveBytes, 500000000);
assert.strictEqual(snapshot.sandboxScope, 'BUILT_SOFTWARE_ONLY');
assert.strictEqual(snapshot.authority, 'NONE');

console.log(JSON.stringify({
  ok: true,
  workspaceSha256: workspace.workspaceSha256,
  experimentSha256: experiment.experimentSha256,
  outcomeSha256: outcome.outcomeSha256,
  observedItems: outcome.retention.observedItemCount,
  retainedRepresentatives: outcome.retention.retainedArtifactCount,
  activeSaveSlots: replacedSet.occupiedSlotCount,
  maxBytesPerSaveSlot: snapshot.maxSaveBytes,
  sixthSave: 'HELD',
  transientLoop: transientLoop.result,
  explicitReplacement: replaceGate.result,
  creatorReasoningSandboxed: workspace.creatorScope.ideaGenerationSandboxed,
  runtimeContainmentProvidedByModule: workspace.runtimeContract.thisModuleIsRuntimeContainment,
  authority: snapshot.authority
}, null, 2));
