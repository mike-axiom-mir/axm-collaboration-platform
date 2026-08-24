'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const dock = require('./code-work-context-dock.js');
const store = require('./code-work-context-local-store.js');
const relationship = require('./code-developer-relationship-plane.js');

const direction = dock.createDirection({
  projectId: 'browser-game-fixture',
  actorClass: 'AI',
  title: 'Browser game build plan',
  goal: 'Build a small browser game with visible mid-build artifacts and deterministic checks.',
  directionalPrompt: 'Plan first, use the JavaScript runtime role, keep candidate code quarantined until required checks pass.',
  roadmap: [
    'Plan the runtime and rendering structure',
    'Build the smallest playable loop',
    'Run affected verification',
    'Inspect the live artifact window'
  ],
  steps: [
    { id: 'plan', title: 'Create prebuild twin', expectedArtifacts: ['prebuild twin'], checks: ['route bindings known'] },
    { id: 'runtime', title: 'Build runtime loop', dependsOn: ['plan'], expectedArtifacts: ['game runtime candidate'], checks: ['parse', 'diagnostics'] },
    { id: 'verify', title: 'Run affected verification', dependsOn: ['runtime'], expectedArtifacts: ['admission evidence'], checks: ['affected tests', 'affected verifiers'] },
    { id: 'preview', title: 'Inspect build window', dependsOn: ['runtime'], expectedArtifacts: ['visual state'], checks: ['preview digest matches candidate'] }
  ],
  constraints: ['no network from candidate', 'no automatic merge', 'unknown is not pass'],
  sourceLinks: ['PR57:prebuild', 'PR59:build-window', 'PR60:relationship-plane']
});

assert.strictEqual(direction.validation.usable, true);
assert.strictEqual(direction.steps.length, 4);
assert.strictEqual(direction.truth.immutableRevision, true);

const e1 = dock.createProgressEvent({
  projectId: direction.projectId,
  directionSha256: direction.directionSha256,
  actorClass: 'MACHINE',
  sequence: 1,
  stepId: 'plan',
  status: 'DONE',
  evidenceDigests: ['sha256:prebuild-fixture']
});
const e2 = dock.createProgressEvent({
  projectId: direction.projectId,
  directionSha256: direction.directionSha256,
  actorClass: 'AI',
  sequence: 2,
  stepId: 'runtime',
  status: 'ACTIVE',
  note: 'Runtime loop is the current working step.'
});
const progress = dock.foldProgress(direction, [e2, e1]);
assert.strictEqual(progress.result, 'PROGRESS_READY');
assert(progress.doneStepIds.includes('plan'));
assert(progress.activeStepIds.includes('runtime'));
assert.strictEqual(direction.steps[0].status, undefined);

const n1 = dock.createScratchNote({
  projectId: direction.projectId,
  directionSha256: direction.directionSha256,
  actorClass: 'AI',
  sequence: 1,
  kind: 'HYPOTHESIS',
  text: 'The update loop may be invalidating more render work than expected.',
  tags: ['render', 'impact'],
  handoffCandidate: false
});
const n2 = dock.createScratchNote({
  projectId: direction.projectId,
  directionSha256: direction.directionSha256,
  actorClass: 'MACHINE',
  sequence: 2,
  kind: 'FAILED_ATTEMPT',
  text: 'A broad rebuild was unnecessary; use the affected verifier set instead.',
  tags: ['verification'],
  handoffCandidate: true
});
const n3 = dock.createScratchNote({
  projectId: direction.projectId,
  directionSha256: direction.directionSha256,
  actorClass: 'AI',
  sequence: 3,
  kind: 'OBSERVATION',
  text: 'Impact graph shows the bundle target and update test are affected.',
  supersedes: [n1.noteSha256],
  tags: ['observed-impact'],
  handoffCandidate: true
});
const scratch = dock.foldScratch({ projectId: direction.projectId, directionSha256: direction.directionSha256, notes: [n3, n1, n2] });
assert.strictEqual(scratch.result, 'SCRATCH_READY');
assert.strictEqual(scratch.activeNotes.length, 2);
assert(scratch.supersededNoteSha256s.includes(n1.noteSha256));
assert.strictEqual(n3.truth.noteIsNotFact, true);

const graph = relationship.buildGraph({ observations: [{
  sourceClass: 'LSP',
  nodes: [
    { id: 'sym:update', kind: 'SYMBOL', languageId: 'javascript' },
    { id: 'test:update', kind: 'TEST' },
    { id: 'verifier:eslint', kind: 'VERIFIER' }
  ],
  edges: [
    { from: 'test:update', to: 'sym:update', class: 'TESTS' },
    { from: 'verifier:eslint', to: 'sym:update', class: 'TESTS' }
  ]
}] });
const impact = relationship.impact({ graph, changedNodeIds: ['sym:update'] });
assert.strictEqual(impact.result, 'IMPACT_READY');
assert(impact.affectedTests.includes('test:update'));
assert(impact.affectedVerifiers.includes('verifier:eslint'));

const buildWindowState = {
  schema: 'axm.code.build-window-state.v1',
  stateSha256: 'sha256:build-window-fixture',
  stage: 'RENDERED_CANDIDATE_VISIBLE',
  status: { admission: 'HELD_IN_QUARANTINE', quickTest: null }
};
const card = dock.buildContextCard({
  direction,
  progressEvents: [e1, e2],
  scratchNotes: [n1, n2, n3],
  buildWindowState,
  relationshipImpact: impact
});
assert.strictEqual(card.result, 'CONTEXT_CARD_READY');
assert.strictEqual(card.focusStep.id, 'runtime');
assert.strictEqual(card.focusSelection, 'DERIVED_ACTIVE_STEP');
assert.strictEqual(card.recentScratch.length, 2);
assert.strictEqual(card.impact.affectedCount, 2);
assert.strictEqual(card.production, null);
assert(card.revisitTriggers.includes('BEFORE_EDIT_PROGRAM'));
assert(card.revisitTriggers.includes('AFTER_CONTEXT_COMPACTION'));
assert.strictEqual(dock.verifyContextCard({ card, direction }).result, 'CONTEXT_CARD_DIRECTION_CURRENT');

const handoff = dock.createHandoffCandidate({ direction, progressEvents: [e1, e2], scratchNotes: [n1, n2, n3] });
assert.strictEqual(handoff.schema, 'axm.code.work-context-handoff-candidate.v1');
assert.strictEqual(handoff.selectedScratchNotes.length, 2);
assert(!handoff.selectedScratchNotes.some(n => n.noteSha256 === n1.noteSha256));
assert.strictEqual(handoff.truth.continuationCapsuleNotWritten, true);

const revisedDirection = dock.createDirection({
  projectId: direction.projectId,
  actorClass: 'HUMAN',
  title: 'Browser game build plan v2',
  goal: direction.goal,
  directionalPrompt: 'Keep the plan, but inspect the visual state before running the full affected verifier set.',
  roadmap: direction.roadmap,
  steps: direction.steps,
  constraints: direction.constraints,
  sourceLinks: direction.sourceLinks,
  parentDirectionSha256: direction.directionSha256
});
assert.notStrictEqual(revisedDirection.directionSha256, direction.directionSha256);
assert.strictEqual(dock.verifyContextCard({ card, direction: revisedDirection }).result, 'STALE_CONTEXT_CARD_DIRECTION_CHANGED');

const badDirection = dock.createDirection({
  projectId: 'bad-fixture',
  goal: 'Bad dependency fixture',
  steps: [{ id: 'two', dependsOn: ['missing-step'] }]
});
assert.strictEqual(badDirection.validation.usable, false);
assert.strictEqual(dock.buildContextCard({ direction: badDirection }).result, 'CONTEXT_CARD_READY_DIRECTION_HELD');

const storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-work-context-'));
try {
  const descriptor = store.storeDescriptor(direction.projectId);
  assert.strictEqual(descriptor.logicalRoot, 'state/code-work-context/browser-game-fixture');
  assert.strictEqual(descriptor.truth.sourceTreeStorageRecommended, false);

  assert.strictEqual(store.putDirection({ root: storeRoot, direction }).operation, 'PUT_DIRECTION');
  assert.strictEqual(store.putDirection({ root: storeRoot, direction }).result, 'IMMUTABLE_OBJECT_ALREADY_PRESENT');
  assert.strictEqual(store.selectActiveDirection({ root: storeRoot, projectId: direction.projectId, directionSha256: direction.directionSha256, actorClass: 'HUMAN' }).operation, 'SELECT_ACTIVE_DIRECTION');
  store.putProgressEvent({ root: storeRoot, event: e1 });
  store.putProgressEvent({ root: storeRoot, event: e2 });
  store.putScratchNote({ root: storeRoot, note: n1 });
  store.putScratchNote({ root: storeRoot, note: n2 });
  store.putScratchNote({ root: storeRoot, note: n3 });
  store.putContextCard({ root: storeRoot, card });

  const read = store.readContext({ root: storeRoot, projectId: direction.projectId });
  assert.strictEqual(read.result, 'WORK_CONTEXT_READY');
  assert.strictEqual(read.direction.directionSha256, direction.directionSha256);
  assert.strictEqual(read.progressEvents.length, 2);
  assert.strictEqual(read.scratchNotes.length, 3);
  assert.strictEqual(read.storedCardStatus, 'CONTEXT_CARD_DIRECTION_CURRENT');
  assert.strictEqual(read.rebuiltCard.focusStep.id, 'runtime');
  assert.strictEqual(read.truth.sourceWorkspaceRead, false);

  store.putDirection({ root: storeRoot, direction: revisedDirection });
  store.selectActiveDirection({ root: storeRoot, projectId: direction.projectId, directionSha256: revisedDirection.directionSha256, actorClass: 'HUMAN' });
  const reread = store.readContext({ root: storeRoot, projectId: direction.projectId });
  assert.strictEqual(reread.direction.directionSha256, revisedDirection.directionSha256);
  assert.strictEqual(reread.storedCardStatus, 'STALE_CONTEXT_CARD_DIRECTION_CHANGED');
  assert.strictEqual(reread.progressEvents.length, 0);
  assert.strictEqual(reread.scratchNotes.length, 0);

  assert.throws(() => store.storeDescriptor('../escape'), /PROJECT_ID_UNSAFE/);
} finally {
  fs.rmSync(storeRoot, { recursive: true, force: true });
}

const intent = dock.createStoreIntent({ projectId: direction.projectId, operation: 'PUT_SCRATCH_NOTE', payloadDigest: n2.noteSha256, actorClass: 'AI' });
assert.strictEqual(intent.truth.intentOnly, true);
assert.strictEqual(intent.truth.storeWriteNotExecuted, true);

const snapshot = dock.snapshot();
assert.strictEqual(snapshot.directionLane, 'IMMUTABLE_REVISIONS');
assert.strictEqual(snapshot.progressLane, 'APPEND_ONLY_EVENTS');
assert.strictEqual(snapshot.scratchLane, 'APPEND_ONLY_NON_AUTHORITATIVE_NOTES');
assert.strictEqual(snapshot.hotCard, 'DERIVED_REBUILDABLE_CACHE_WITH_OPTIONAL_PRODUCTION_SUMMARY');
assert.strictEqual(snapshot.authority, 'NONE');

console.log(JSON.stringify({
  ok: true,
  directionSha256: direction.directionSha256,
  revisedDirectionSha256: revisedDirection.directionSha256,
  progressSha256: progress.progressSha256,
  scratchSha256: scratch.scratchSha256,
  contextCardSha256: card.cardSha256,
  focusStep: card.focusStep.id,
  revisitTriggers: card.revisitTriggers,
  handoffScratchCount: handoff.selectedScratchNotes.length,
  localStoreRootClass: 'state/code-work-context/<project-id>',
  snapshotSha256: snapshot.snapshotSha256,
  authority: snapshot.authority
}, null, 2));
