'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dock = require('./code-work-context-dock.js');
const production = require('./code-production-draft-fabric.js');
const productionStore = require('./code-production-draft-store.js');
const productionContext = require('./code-production-work-context-bridge.js');
const productionBudget = require('./code-production-budget.js');
const keyboard = require('./machine-code-keyboard-router.js');
const admission = require('./code-candidate-admission-ground.js');

const direction = dock.createDirection({
  projectId: 'production-browser-game',
  actorClass: 'HUMAN',
  title: 'Browser game production batch',
  goal: 'Produce several editable runtime drafts, inspect them independently, and explicitly choose later.',
  directionalPrompt: 'Keep each candidate separate. Do not destroy earlier revisions or auto-select a winner.',
  roadmap: ['prepare production batch', 'edit candidates', 'compare candidates', 'select explicitly'],
  steps: [
    { id: 'batch', title: 'Create bounded draft batch' },
    { id: 'edit', title: 'Edit and compile candidates', dependsOn: ['batch'] },
    { id: 'compare', title: 'Compare candidate evidence', dependsOn: ['edit'] },
    { id: 'select', title: 'Select candidate explicitly', dependsOn: ['compare'] }
  ],
  constraints: ['no automatic winner', 'preserve draft lineage', 'selection is not promotion']
});
assert.strictEqual(direction.validation.usable, true);

const batch = production.createBatch({
  projectId: direction.projectId,
  direction,
  draftCount: 4,
  languageId: 'javascript',
  role: 'game-runtime',
  intent: 'build',
  signals: ['game loop', 'state', 'verification'],
  variantAxes: [
    { axis: 'control-strategy', instruction: 'Explore a fixed-step control structure.', tags: ['runtime'] },
    { axis: 'state-shape', instruction: 'Explore an explicit state-machine structure.', tags: ['state'] }
  ]
});
assert.strictEqual(batch.result, 'PRODUCTION_BATCH_READY');
assert.strictEqual(batch.draftCount, 4);
assert.strictEqual(batch.variantMode, 'CALLER_DECLARED_DIRECTED_VARIANTS');
assert.strictEqual(batch.slots[0].variant.axis, 'control-strategy');
assert.strictEqual(batch.slots[1].variant.axis, 'state-shape');
assert.strictEqual(batch.slots[2].variant.branchIndex, 2);
assert.strictEqual(batch.truth.noDraftAutoSelected, true);
assert.strictEqual(production.assessBatchDirection({ batch, direction }).result, 'PRODUCTION_BATCH_DIRECTION_CURRENT');

const batchRepeat = production.createBatch({
  projectId: direction.projectId,
  direction,
  draftCount: 4,
  languageId: 'javascript',
  role: 'game-runtime',
  intent: 'build',
  signals: ['game loop', 'state', 'verification'],
  variantAxes: [
    { axis: 'control-strategy', instruction: 'Explore a fixed-step control structure.', tags: ['runtime'] },
    { axis: 'state-shape', instruction: 'Explore an explicit state-machine structure.', tags: ['state'] }
  ]
});
assert.strictEqual(batchRepeat.batchSha256, batch.batchSha256);

const plainBatch = production.createBatch({
  projectId: direction.projectId,
  direction,
  draftCount: 2,
  languageId: 'javascript',
  role: 'game-runtime'
});
assert.strictEqual(plainBatch.variantMode, 'EDITABLE_SLOTS_NO_INVENTED_VARIATION');
assert.strictEqual(plainBatch.slots[0].variant, null);
assert.strictEqual(plainBatch.truth.noVariationInventedWithoutCallerAxes, true);

assert.strictEqual(production.createBatch({ projectId: direction.projectId, direction, draftCount: 17, languageId: 'javascript' }).result, 'DRAFT_COUNT_OUT_OF_RANGE');
assert.strictEqual(production.createBatch({ projectId: direction.projectId, direction, draftCount: 0, languageId: 'javascript' }).result, 'DRAFT_COUNT_OUT_OF_RANGE');

const set = production.spawnDrafts(batch);
assert.strictEqual(set.result, 'PRODUCTION_DRAFTS_READY');
assert.strictEqual(set.drafts.length, 4);
assert.strictEqual(new Set(set.drafts.map(d => d.draftRevisionSha256)).size, 4);
assert(set.drafts.every(d => d.revision === 1));
assert(set.drafts.every(d => d.truth.editableByNewRevision));
assert(set.drafts.every(d => d.keyProgram === null));

const program = keyboard.program({
  languageId: 'javascript',
  layout: batch.layout,
  presses: [
    { keyId: 'K24', arguments: { condition: 'running' } },
    { keyId: 'K25', arguments: { loop: 'fixed-step' } },
    { keyId: 'K40', arguments: { assertion: 'state remains valid' } }
  ]
});
assert.strictEqual(program.result, 'EDIT_PROGRAM_READY');
assert.strictEqual(program.sourceCode, null);

const candidateDigest = 'sha256:production-draft-browser-game-v1';
const policy = admission.buildPolicy({ languageId: 'javascript', mode: 'GUARDED', existingTests: false });
assert.strictEqual(policy.result, 'ADMISSION_POLICY_READY');
const admitted = admission.evaluate({
  languageId: 'javascript',
  candidateDigest,
  mode: 'GUARDED',
  existingTests: false,
  observations: admission.makePassingFixtureObservations(policy)
});
assert.strictEqual(admitted.result, 'ADMISSIBLE_CANDIDATE_NOT_PROMOTED');

const draft1v1 = set.drafts[0];
const draft1v2 = production.reviseDraft({
  batch,
  draft: draft1v1,
  actorClass: 'AI',
  editSummary: 'Add a bounded fixed-step loop and assertion intent.',
  keyProgram: program,
  artifact: {
    artifactId: 'browser-runtime-candidate',
    digest: candidateDigest,
    kind: 'browser-runtime',
    mime: 'text/javascript',
    visualState: 'RENDERED_CANDIDATE_VISIBLE',
    byteLength: 1200
  },
  admissionReport: admitted,
  buildWindowState: {
    schema: 'axm.code.build-window-state.v1',
    stateSha256: 'sha256:window-draft-1-v2',
    stage: 'CANDIDATE_ADMISSIBLE_NOT_PROMOTED',
    artifactDigest: candidateDigest,
    status: { admission: admitted.result, quickTest: 'PASS' }
  }
});
assert.strictEqual(draft1v2.result, 'EDITABLE_DRAFT_READY');
assert.strictEqual(draft1v2.revision, 2);
assert.strictEqual(draft1v2.parentRevisionSha256, draft1v1.draftRevisionSha256);
assert.strictEqual(draft1v2.compileState, 'ADMISSIBLE_DRAFT_NOT_SELECTED');
assert.strictEqual(draft1v2.evidenceFreshness.admission, 'CURRENT_DIGEST_BOUND');
assert.strictEqual(draft1v2.truth.priorRevisionPreserved, true);
assert.strictEqual(draft1v1.revision, 1);
assert.strictEqual(draft1v1.keyProgram, null);

// Steward regression: changing the structural program must invalidate prior
// artifact, admission and quick-test evidence rather than silently inherit it.
const changedProgram = keyboard.program({
  languageId: 'javascript',
  layout: batch.layout,
  presses: [
    { keyId: 'K24', arguments: { condition: 'running' } },
    { keyId: 'K25', arguments: { loop: 'variable-step' } },
    { keyId: 'K40', arguments: { assertion: 'state remains bounded' } }
  ]
});
assert.strictEqual(changedProgram.result, 'EDIT_PROGRAM_READY');
assert.notStrictEqual(changedProgram.programSha256, program.programSha256);

const draft1v3 = production.reviseDraft({
  batch,
  draft: draft1v2,
  actorClass: 'MACHINE',
  editSummary: 'Change the structural loop program; previous evidence must go stale.',
  keyProgram: changedProgram
});
assert.strictEqual(draft1v3.revision, 3);
assert.strictEqual(draft1v3.changeClass, 'STRUCTURAL_PROGRAM_CHANGED');
assert.strictEqual(draft1v3.artifact, null);
assert.strictEqual(draft1v3.admission, null);
assert.strictEqual(draft1v3.buildWindow, null);
assert.strictEqual(draft1v3.compileState, 'STRUCTURAL_PROGRAM_READY_RENDER_COMPILE_EXTERNAL');
assert(draft1v3.evidenceFreshness.invalidatedBy.includes('STRUCTURAL_PROGRAM_CHANGED'));
assert.strictEqual(draft1v3.evidenceFreshness.artifact, 'STALE_CLEARED_PROGRAM_CHANGED');

const candidateDigest2 = 'sha256:production-draft-browser-game-v2';
const admitted2 = admission.evaluate({
  languageId: 'javascript',
  candidateDigest: candidateDigest2,
  mode: 'GUARDED',
  existingTests: false,
  observations: admission.makePassingFixtureObservations(policy)
});
const draft1v4 = production.reviseDraft({
  batch,
  draft: draft1v3,
  actorClass: 'AI',
  editSummary: 'Bind freshly rendered candidate and fresh admission evidence.',
  artifact: {
    artifactId: 'browser-runtime-candidate',
    digest: candidateDigest2,
    kind: 'browser-runtime',
    mime: 'text/javascript',
    visualState: 'RENDERED_CANDIDATE_VISIBLE',
    byteLength: 1240
  },
  admissionReport: admitted2,
  buildWindowState: {
    schema: 'axm.code.build-window-state.v1',
    stateSha256: 'sha256:window-draft-1-v4',
    stage: 'CANDIDATE_ADMISSIBLE_NOT_PROMOTED',
    artifactDigest: candidateDigest2,
    status: { admission: admitted2.result, quickTest: 'PASS' }
  }
});
assert.strictEqual(draft1v4.compileState, 'ADMISSIBLE_DRAFT_NOT_SELECTED');
assert.strictEqual(draft1v4.evidenceFreshness.admission, 'CURRENT_DIGEST_BOUND');

const draft1v5 = production.reviseDraft({
  batch,
  draft: draft1v4,
  actorClass: 'HUMAN',
  editSummary: 'Add a note only; candidate program and evidence stay bound.',
  scratchNoteRefs: ['sha256:note-production-1']
});
assert.strictEqual(draft1v5.revision, 5);
assert.strictEqual(draft1v5.parentRevisionSha256, draft1v4.draftRevisionSha256);
assert.strictEqual(draft1v5.draftId, draft1v1.draftId);
assert.strictEqual(draft1v5.artifact.digest, candidateDigest2);
assert.strictEqual(draft1v5.admission.candidateDigest, candidateDigest2);
assert.strictEqual(draft1v5.evidenceFreshness.artifact, 'INHERITED_UNCHANGED_PROGRAM');

// Exact structural-program duplicates are surfaced only as reuse/check
// candidates; they are never automatically deleted, ranked or selected.
const draft2v2 = production.reviseDraft({
  batch,
  draft: set.drafts[1],
  actorClass: 'MACHINE',
  editSummary: 'Independent draft happens to use the same structural program.',
  keyProgram: changedProgram
});
const comparison = production.compareDrafts({
  batch,
  drafts: [draft1v1, draft1v2, draft1v3, draft1v4, draft1v5, draft2v2, ...set.drafts.slice(2)]
});
assert.strictEqual(comparison.result, 'DRAFT_COMPARISON_READY');
assert.strictEqual(comparison.rows.length, 4);
assert.strictEqual(comparison.rows.find(r => r.draftId === 'draft-01').revision, 5);
assert.strictEqual(comparison.truth.rankingPerformed, false);
assert.strictEqual(comparison.truth.winnerSelected, false);
assert.strictEqual(comparison.duplicateProgramCandidates.length, 1);
assert.deepStrictEqual(comparison.duplicateProgramCandidates[0].draftIds, ['draft-01', 'draft-02']);

const directionV2 = dock.createDirection({
  projectId: direction.projectId,
  actorClass: 'HUMAN',
  title: 'Browser game production batch v2',
  goal: 'Revise the build direction after reviewing the first production batch.',
  directionalPrompt: 'Keep old drafts inspectable, but do not silently treat them as current-direction candidates.',
  roadmap: ['review old batch', 'revise direction', 'create or explicitly rebase production'],
  steps: [
    { id: 'review', title: 'Review existing candidates' },
    { id: 'rebase', title: 'Create or explicitly rebase production', dependsOn: ['review'] }
  ],
  constraints: ['stale production must remain visible', 'no silent rebase'],
  parentDirectionSha256: direction.directionSha256
});
assert.notStrictEqual(directionV2.directionSha256, direction.directionSha256);
assert.strictEqual(production.assessBatchDirection({ batch, direction: directionV2 }).result, 'PRODUCTION_BATCH_DIRECTION_STALE');
assert.strictEqual(production.selectDraft({ batch, draft: draft1v5, currentDirection: directionV2 }).result, 'DRAFT_SELECTION_HELD_STALE_DIRECTION');

const selection = production.selectDraft({
  batch,
  draft: draft1v5,
  actorClass: 'HUMAN',
  currentDirection: direction,
  reason: 'Explicitly keep this direction for the next review gate.'
});
assert.strictEqual(selection.result, 'DRAFT_SELECTED_NOT_PROMOTED');
assert.strictEqual(selection.revision, 5);
assert.strictEqual(selection.truth.selectionIsNotPromotion, true);
assert.strictEqual(selection.truth.otherDraftsRemainAvailable, true);

const summary = production.summarizeProduction({
  batch,
  drafts: [draft1v5, draft2v2, ...set.drafts.slice(2)],
  selection,
  direction
});
assert.strictEqual(summary.result, 'PRODUCTION_CONTEXT_READY');
assert.strictEqual(summary.directionStatus, 'PRODUCTION_BATCH_DIRECTION_CURRENT');
assert.strictEqual(summary.latestDrafts.length, 4);
assert.strictEqual(summary.selected.draftRevisionSha256, draft1v5.draftRevisionSha256);

const budget = productionBudget.createBudget({
  batch,
  ceilings: {
    maxTotalDraftRevisions: 16,
    maxRevisionsPerDraft: 8,
    maxArtifactBuilds: 8,
    maxAdmissionChecks: 8,
    maxQuickTests: 8,
    maxHeavyVerifierRuns: 1
  },
  label: 'production-hot-context-budget'
});
const budgetStatus = productionBudget.assessBudget({
  batch,
  budget,
  drafts: [draft1v5, draft2v2, ...set.drafts.slice(2)],
  currentDirection: direction
});
assert.strictEqual(budgetStatus.result, 'PRODUCTION_WORK_WITHIN_BUDGET');

const hotCard = productionContext.buildProductionContextCard({
  direction,
  batch,
  drafts: [draft1v5, draft2v2, ...set.drafts.slice(2)],
  selection,
  budgetStatus
});
assert.strictEqual(hotCard.result, 'CONTEXT_CARD_READY_WITH_PRODUCTION');
assert.strictEqual(hotCard.production.draftCount, 4);
assert.strictEqual(hotCard.production.selected.draftRevisionSha256, draft1v5.draftRevisionSha256);
assert.strictEqual(hotCard.production.budget.result, 'PRODUCTION_WORK_WITHIN_BUDGET');
assert.strictEqual(productionContext.verifyProductionContextCard({ card: hotCard, direction }).result, 'PRODUCTION_CONTEXT_CARD_CURRENT');

const heavyVerifierReceipt = productionBudget.createWorkReceipt({
  batch,
  kind: 'HEAVY_VERIFIER',
  draftId: draft1v5.draftId,
  draftRevisionSha256: draft1v5.draftRevisionSha256,
  evidenceDigest: 'sha256:production-heavy-verifier-fixture',
  outcome: 'PASS'
});
const heldBudgetStatus = productionBudget.assessBudget({
  batch,
  budget,
  drafts: [draft1v5, draft2v2, ...set.drafts.slice(2)],
  workReceipts: [heavyVerifierReceipt],
  currentDirection: direction
});
assert.strictEqual(heldBudgetStatus.result, 'PRODUCTION_WORK_HELD');
const heldHotCard = productionContext.buildProductionContextCard({
  direction,
  batch,
  drafts: [draft1v5, draft2v2, ...set.drafts.slice(2)],
  selection,
  budgetStatus: heldBudgetStatus
});
assert.strictEqual(heldHotCard.result, 'CONTEXT_CARD_READY_WITH_PRODUCTION_HELD');
assert.strictEqual(productionContext.verifyProductionContextCard({ card: heldHotCard, direction }).result, 'PRODUCTION_CONTEXT_CARD_CURRENT_WORK_HELD');

const staleHotCard = productionContext.buildProductionContextCard({
  direction: directionV2,
  batch,
  drafts: [draft1v5, draft2v2, ...set.drafts.slice(2)],
  selection
});
assert.strictEqual(staleHotCard.result, 'CONTEXT_CARD_READY_WITH_STALE_PRODUCTION_BATCH');
assert.strictEqual(staleHotCard.production.directionStatus, 'PRODUCTION_BATCH_DIRECTION_STALE');
assert.strictEqual(productionContext.verifyProductionContextCard({ card: staleHotCard, direction: directionV2 }).result, 'PRODUCTION_CONTEXT_CARD_CURRENT_BATCH_STALE');

const svg = production.renderComparisonSvg({
  batch,
  drafts: [draft1v5, draft2v2, ...set.drafts.slice(2)],
  title: 'Browser Game Production Drafts'
});
assert(svg.includes('<svg'));
assert(svg.includes('draft-01'));
assert(svg.includes('draft-04'));
assert(svg.includes('no automatic winner'));
assert(svg.includes('evidence:'));

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-production-drafts-'));
try {
  const descriptor = productionStore.storeDescriptor(direction.projectId);
  assert.strictEqual(descriptor.logicalRoot, 'state/code-work-context/production-browser-game/production');
  assert.strictEqual(descriptor.truth.sourceWorkspaceStorage, false);

  assert.strictEqual(productionStore.putBatch({ root, batch }).operation, 'PUT_BATCH');
  assert.strictEqual(productionStore.putBatch({ root, batch }).result, 'IMMUTABLE_OBJECT_ALREADY_PRESENT');

  for (const draft of set.drafts) productionStore.putDraftRevision({ root, draft });
  productionStore.putDraftRevision({ root, draft: draft1v2 });
  productionStore.putDraftRevision({ root, draft: draft1v3 });
  productionStore.putDraftRevision({ root, draft: draft1v4 });
  productionStore.putDraftRevision({ root, draft: draft1v5 });

  // Referential closure: selection cannot point at a revision that has not
  // actually been persisted yet.
  const missingSelection = production.selectDraft({ batch, draft: draft2v2, actorClass: 'HUMAN', currentDirection: direction });
  assert.throws(() => productionStore.putSelection({ root, selection: missingSelection }), /SELECTION_REVISION_MISSING/);

  productionStore.putDraftRevision({ root, draft: draft2v2 });
  assert.strictEqual(productionStore.selectActiveDraftRevision({ root, draft: draft1v5, actorClass: 'HUMAN' }).operation, 'SELECT_ACTIVE_DRAFT_REVISION');
  const selectionReceipt = productionStore.putSelection({ root, selection });
  assert.strictEqual(selectionReceipt.operation, 'PUT_SELECTION_POINTER');
  assert.strictEqual(selectionReceipt.selectionIntegrity, 'SELECTION_REFERENCE_CURRENT');

  const read = productionStore.readBatch({ root, projectId: direction.projectId, batchSha256: batch.batchSha256 });
  assert.strictEqual(read.result, 'PRODUCTION_BATCH_STATE_READY');
  assert.strictEqual(read.drafts.length, 4);
  const storedDraft1 = read.drafts.find(d => d.draftId === 'draft-01');
  assert.strictEqual(storedDraft1.revisions.length, 5);
  assert.strictEqual(storedDraft1.active.draftRevisionSha256, draft1v5.draftRevisionSha256);
  assert.strictEqual(read.selection.draftRevisionSha256, draft1v5.draftRevisionSha256);
  assert.strictEqual(read.selectionIntegrity.result, 'SELECTION_REFERENCE_CURRENT');
  assert.strictEqual(read.truth.rawSourceStored, false);

  const fakeRaw = {
    ...draft1v5,
    draftRevisionSha256: 'sha256:fake-raw-revision',
    keyProgram: { ...changedProgram, sourceCode: 'console.log("raw")' }
  };
  assert.throws(() => productionStore.putDraftRevision({ root, draft: fakeRaw }), /RAW_SOURCE_REFUSED/);
  assert.throws(() => productionStore.storeDescriptor('../escape'), /PROJECT_ID_UNSAFE/);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

const snapshot = production.snapshot();
assert.strictEqual(snapshot.maxDraftsPerBatch, 16);
assert.strictEqual(snapshot.evidenceFreshness, 'DOWNSTREAM_EVIDENCE_CLEARED_OR_REBOUND_WHEN_CANDIDATE_CHANGES');
assert.strictEqual(snapshot.authority, 'NONE');

console.log(JSON.stringify({
  ok: true,
  batchSha256: batch.batchSha256,
  draftCount: batch.draftCount,
  variantMode: batch.variantMode,
  draft1RevisionCount: 5,
  evidenceInvalidation: draft1v3.evidenceFreshness.invalidatedBy,
  comparisonRows: comparison.rows.length,
  duplicateProgramCandidates: comparison.duplicateProgramCandidates.length,
  selection: selection.result,
  selectionIntegrity: 'SELECTION_REFERENCE_CURRENT',
  productionContext: hotCard.result,
  staleProductionContext: staleHotCard.result,
  productionBudget: budgetStatus.result,
  heldProductionBudgetContext: heldHotCard.result,
  storeRootClass: 'state/code-work-context/<project-id>/production',
  snapshotSha256: snapshot.snapshotSha256,
  authority: snapshot.authority
}, null, 2));
