'use strict';

const assert = require('assert');
const budgetFabric = require('./code-production-budget.js');

const batch = Object.freeze({
  schema: 'axm.code.production-batch.v1',
  result: 'PRODUCTION_BATCH_READY',
  projectId: 'budget-fixture',
  batchSha256: 'sha256:batch-budget-fixture',
  directionSha256: 'sha256:direction-v1',
  draftCount: 2,
  slots: [{ draftId: 'draft-01' }, { draftId: 'draft-02' }]
});
const currentDirection = Object.freeze({
  schema: 'axm.code.work-direction.v1',
  projectId: batch.projectId,
  directionSha256: batch.directionSha256
});
const staleDirection = Object.freeze({
  schema: 'axm.code.work-direction.v1',
  projectId: batch.projectId,
  directionSha256: 'sha256:direction-v2'
});

function revision(draftId, number) {
  return Object.freeze({
    schema: 'axm.code.production-draft-revision.v1',
    batchSha256: batch.batchSha256,
    directionSha256: batch.directionSha256,
    draftId,
    revision: number,
    draftRevisionSha256: `sha256:${draftId}-rev-${number}`
  });
}

const drafts = [revision('draft-01', 1), revision('draft-01', 2), revision('draft-02', 1)];
const ceilings = {
  maxTotalDraftRevisions: 4,
  maxRevisionsPerDraft: 3,
  maxArtifactBuilds: 2,
  maxAdmissionChecks: 2,
  maxQuickTests: 2,
  maxHeavyVerifierRuns: 1
};
const budget = budgetFabric.createBudget({ batch, ceilings, label: 'bounded-review-fixture' });
assert.strictEqual(budget.result, 'PRODUCTION_BUDGET_READY');
assert.strictEqual(budget.truth.budgetIsCeilingNotPermission, true);
assert.strictEqual(budget.truth.budgetDoesNotSelectWinner, true);
assert.deepStrictEqual(budgetFabric.createBudget({ batch, ceilings, label: 'bounded-review-fixture' }), budget);
assert.strictEqual(budgetFabric.createBudget({ batch }).result, 'PRODUCTION_BUDGET_CEILINGS_REQUIRED');
assert.strictEqual(budgetFabric.createBudget({ batch, ceilings: { ...ceilings, maxHeavyVerifierRuns: 65 } }).result, 'PRODUCTION_BUDGET_CEILINGS_INVALID');

const artifact = budgetFabric.createWorkReceipt({
  batch,
  kind: 'ARTIFACT_BUILD',
  draftId: 'draft-01',
  draftRevisionSha256: drafts[1].draftRevisionSha256,
  evidenceDigest: 'sha256:artifact-build-1',
  outcome: 'BUILD_VISIBLE',
  actorClass: 'MACHINE'
});
const admission = budgetFabric.createWorkReceipt({
  batch,
  kind: 'ADMISSION_CHECK',
  draftId: 'draft-01',
  draftRevisionSha256: drafts[1].draftRevisionSha256,
  evidenceDigest: 'sha256:admission-1',
  outcome: 'ADMISSIBLE_CANDIDATE_NOT_PROMOTED',
  actorClass: 'AI'
});
const quickTest = budgetFabric.createWorkReceipt({
  batch,
  kind: 'QUICK_TEST',
  draftId: 'draft-01',
  draftRevisionSha256: drafts[1].draftRevisionSha256,
  evidenceDigest: 'sha256:quick-test-1',
  outcome: 'PASS',
  actorClass: 'HUMAN'
});
assert.strictEqual(artifact.result, 'PRODUCTION_WORK_OBSERVED_NOT_AUTHORIZED');
assert.strictEqual(artifact.truth.receiptDoesNotAuthorizeAnotherRun, true);
assert.strictEqual(budgetFabric.createWorkReceipt({ batch, kind: 'UNKNOWN', evidenceDigest: 'sha256:x' }).result, 'WORK_KIND_INVALID');
assert.strictEqual(budgetFabric.createWorkReceipt({ batch, kind: 'HEAVY_VERIFIER' }).result, 'WORK_EVIDENCE_DIGEST_REQUIRED');
assert.strictEqual(budgetFabric.createWorkReceipt({ batch, kind: 'HEAVY_VERIFIER', evidenceDigest: 'sha256:x' }).result, 'WORK_DRAFT_REQUIRED_OR_FOREIGN');
assert.strictEqual(budgetFabric.createWorkReceipt({ batch, kind: 'HEAVY_VERIFIER', draftId: 'draft-01', evidenceDigest: 'sha256:x' }).result, 'WORK_DRAFT_REVISION_REQUIRED');

const workReceipts = [artifact, admission, quickTest, artifact];
const use = budgetFabric.measureUse({ batch, drafts: [...drafts, drafts[0]], workReceipts });
assert.strictEqual(use.result, 'PRODUCTION_BUDGET_USE_MEASURED');
assert.strictEqual(use.counters.totalDraftRevisions, 3);
assert.strictEqual(use.counters.maxObservedRevisionsPerDraft, 2);
assert.strictEqual(use.counters.artifactBuilds, 1);
assert.strictEqual(use.counters.admissionChecks, 1);
assert.strictEqual(use.counters.quickTests, 1);
assert.strictEqual(use.counters.heavyVerifierRuns, 0);
assert.strictEqual(use.duplicateWorkReceiptCount, 1);

const within = budgetFabric.assessBudget({ batch, budget, drafts, workReceipts, currentDirection });
assert.strictEqual(within.result, 'PRODUCTION_WORK_WITHIN_BUDGET');
assert.strictEqual(within.stopConditions.length, 0);
assert.strictEqual(within.truth.withinBudgetIsNotExecutionPermission, true);
assert.strictEqual(within.truth.admittedDraftDoesNotEndProductionAutomatically, true);

const finalRevisionUnit = budgetFabric.checkProposedWork({ status: within, kind: 'DRAFT_REVISION', units: 1, draftId: 'draft-01' });
assert.strictEqual(finalRevisionUnit.result, 'PROPOSED_WORK_WITHIN_CEILING_NOT_AUTHORIZED');
assert.strictEqual(finalRevisionUnit.truth.preflightDoesNotExecuteWork, true);
const tooManyRevisions = budgetFabric.checkProposedWork({ status: within, kind: 'DRAFT_REVISION', units: 2, draftId: 'draft-01' });
assert.strictEqual(tooManyRevisions.result, 'PROPOSED_WORK_WOULD_EXCEED_BUDGET');
assert(tooManyRevisions.failures.some(failure => failure.code === 'WOULD_EXCEED_TOTAL_DRAFT_REVISIONS'));
assert(tooManyRevisions.failures.some(failure => failure.code === 'WOULD_EXCEED_REVISIONS_PER_DRAFT'));
assert.strictEqual(budgetFabric.checkProposedWork({ status: within, kind: 'DRAFT_REVISION' }).result, 'DRAFT_ID_REQUIRED_FOR_REVISION_BUDGET');
assert.strictEqual(budgetFabric.checkProposedWork({ status: within, kind: 'DRAFT_REVISION', draftId: 'draft-99' }).result, 'PROPOSED_DRAFT_ID_NOT_IN_BATCH');

const heavy = budgetFabric.createWorkReceipt({
  batch,
  kind: 'HEAVY_VERIFIER',
  draftId: 'draft-01',
  draftRevisionSha256: drafts[1].draftRevisionSha256,
  evidenceDigest: 'sha256:heavy-verifier-1',
  outcome: 'PASS'
});
const atHeavyCeiling = budgetFabric.assessBudget({
  batch,
  budget,
  drafts,
  workReceipts: [...workReceipts, heavy],
  currentDirection
});
assert.strictEqual(atHeavyCeiling.result, 'PRODUCTION_WORK_HELD');
assert.strictEqual(atHeavyCeiling.limits.heavyVerifierRuns.state, 'CEILING_REACHED');
assert(atHeavyCeiling.stopConditions.some(condition => condition.counter === 'heavyVerifierRuns'));
assert.strictEqual(budgetFabric.checkProposedWork({ status: atHeavyCeiling, kind: 'HEAVY_VERIFIER' }).result, 'PROPOSED_WORK_HELD_BY_BUDGET_STATUS');

const callerPause = budgetFabric.assessBudget({
  batch,
  budget,
  drafts,
  workReceipts,
  currentDirection,
  stopSignals: [{ code: 'CALLER_PAUSE', detail: 'Mike requested a checkpoint before more compute.' }]
});
assert.strictEqual(callerPause.result, 'PRODUCTION_WORK_HELD');
assert(callerPause.stopConditions.some(condition => condition.code === 'CALLER_PAUSE'));
assert.strictEqual(budgetFabric.assessBudget({ batch, budget, drafts, workReceipts, currentDirection, stopSignals: ['NOT_REAL'] }).result, 'INVALID_STOP_SIGNAL');

const stale = budgetFabric.assessBudget({ batch, budget, drafts, workReceipts, currentDirection: staleDirection });
assert.strictEqual(stale.result, 'PRODUCTION_WORK_HELD');
assert.strictEqual(stale.directionStatus, 'PRODUCTION_BATCH_DIRECTION_STALE');
assert(stale.stopConditions.some(condition => condition.code === 'DIRECTION_CHANGED'));
const noDirection = budgetFabric.assessBudget({ batch, budget, drafts, workReceipts });
assert.strictEqual(noDirection.result, 'PRODUCTION_WORK_HELD');
assert(noDirection.stopConditions.some(condition => condition.code === 'CURRENT_DIRECTION_NOT_SUPPLIED'));

const foreignBatch = { ...batch, batchSha256: 'sha256:foreign-batch' };
assert.strictEqual(budgetFabric.assessBudget({ batch: foreignBatch, budget, currentDirection }).result, 'INVALID_OR_FOREIGN_BUDGET');
assert.strictEqual(budgetFabric.measureUse({ batch, drafts, workReceipts: [{ ...artifact, batchSha256: 'sha256:foreign' }] }).result, 'INVALID_OR_FOREIGN_WORK_RECEIPT');
assert.strictEqual(budgetFabric.measureUse({ batch, drafts, workReceipts: [{ ...artifact, outcome: 'MUTATED_AFTER_DIGEST' }] }).result, 'INVALID_OR_FOREIGN_WORK_RECEIPT');
assert.strictEqual(budgetFabric.assessBudget({ batch, budget: { ...budget, ceilings: { ...budget.ceilings, maxHeavyVerifierRuns: 2 } }, currentDirection }).result, 'INVALID_OR_FOREIGN_BUDGET');

const snapshot = budgetFabric.snapshot();
assert.strictEqual(snapshot.authority, 'NONE');
assert(snapshot.schemas.includes('axm.code.production-work-preflight.v1'));

console.log(JSON.stringify({
  ok: true,
  budgetSha256: budget.budgetSha256,
  within: within.result,
  finalUnit: finalRevisionUnit.result,
  ceilingHold: atHeavyCeiling.result,
  callerPause: callerPause.result,
  staleDirection: stale.directionStatus,
  observedCounters: use.counters,
  rankingPerformed: false,
  winnerSelected: false,
  authority: snapshot.authority
}, null, 2));
