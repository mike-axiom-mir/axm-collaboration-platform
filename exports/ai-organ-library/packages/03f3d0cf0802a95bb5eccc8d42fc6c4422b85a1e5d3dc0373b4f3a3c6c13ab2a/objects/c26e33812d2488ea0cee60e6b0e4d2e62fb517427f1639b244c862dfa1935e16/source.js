'use strict';

const fs = require('fs');
const path = require('path');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');
const DraftCell = require('../kernel/declarative-reasoning-organ-recipe-draft-cell');

const ORGAN_ID = 'axm.mirror.organ/declarative-reasoning-organ-recipe-drafter-v1';
const BATCH_SCHEMA = 'axm.mirror.declarative-reasoning-organ-recipe-draft-batch/v1';
const RESPONSE_SCHEMA = 'axm.mirror.declarative-reasoning-organ-recipe-draft-response/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'declarative-reasoning-organ-recipe-draft-runs');
const MAX_REQUESTS = 16;
const SOURCE_PATHS = Object.freeze([
  'organs/declarative-reasoning-organ-recipe-draft-organ.js',
  'kernel/declarative-reasoning-organ-recipe-draft-cell.js',
  'kernel/declarative-reasoning-organ-recipe-cell.js',
  'kernel/organ-admission-cell.js',
  'kernel/schema-structural-feature-projection-cell.js',
  'organs/reasoning-structural-feature-organ.js',
  'kernel/immutable-batch-store.js',
  'contracts/declarative-reasoning-organ-recipe-authoring-example.schema.json',
  'contracts/declarative-reasoning-organ-recipe-draft.schema.json',
  'contracts/declarative-reasoning-organ-recipe-draft-batch.schema.json',
  'contracts/declarative-reasoning-organ-recipe-draft-response.schema.json'
]);

function stable(value) { return DraftCell.stable(value); }
function digest(value) { return DraftCell.digest(value); }
function clone(value) { return DraftCell.clone(value); }
function same(left, right) { return DraftCell.same(left, right); }
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function without(value, key) { const copy = clone(value); delete copy[key]; return copy; }
function inside(root, target) {
  const relation = path.relative(path.resolve(root), path.resolve(target));
  return !!relation && !relation.startsWith(`..${path.sep}`) && !path.isAbsolute(relation);
}

function sourceLineage(root = ROOT) {
  return SOURCE_PATHS.map(sourcePath => {
    const file = path.join(root, sourcePath);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) throw new Error(`recipe drafter source must be one bounded real file: ${sourcePath}`);
    const bytes = fs.readFileSync(file);
    return { path: sourcePath, bytes: bytes.length, sha256: digest(bytes) };
  });
}

function normalizeRequests(requests) {
  if (!Array.isArray(requests) || requests.length > MAX_REQUESTS) throw new Error(`recipe drafter accepts at most ${MAX_REQUESTS} requests`);
  const drafts = requests.map(request => DraftCell.build(request)).sort((left, right) => left.draftId.localeCompare(right.draftId));
  if (new Set(drafts.map(item => item.draftId)).size !== drafts.length) throw new Error('recipe drafter requests must produce unique drafts');
  return drafts;
}

function resultsFor(drafts) {
  return drafts.map(draft => ({
    draftId: draft.draftId,
    draftDigest: draft.draftDigest,
    assessmentId: draft.admission.assessmentId,
    assessmentDigest: draft.admission.assessmentDigest,
    targetOrganId: draft.admission.targetOrganId,
    state: draft.state,
    draft
  }));
}

function expectedSummary(results) {
  return {
    requests: results.length,
    draftsProduced: results.length,
    completeDrafts: results.filter(item => item.state === 'MACHINE_RECIPE_DRAFT_REQUIRES_HUMAN_REVIEW_AND_HELDOUT_EXAM').length,
    partialDrafts: results.filter(item => item.state === 'PARTIAL_MACHINE_RECIPE_DRAFT_WITH_HOLDS_REQUIRES_HUMAN_REVIEW').length,
    heldDrafts: results.filter(item => item.state === 'HOLD_NO_DISCRIMINATIVE_PERMISSIONED_RULE_DRAFT').length,
    rulesDrafted: results.reduce((sum, item) => sum + item.draft.summary.rulesDrafted, 0),
    heldOutputGroups: results.reduce((sum, item) => sum + item.draft.summary.heldOutputGroups, 0),
    labelsInferredFromProse: 0,
    humanReviews: 0,
    heldOutExamplesRead: 0,
    candidateFilesWritten: 0,
    candidatesBuilt: 0,
    candidatesInstalled: 0,
    trainingAdmissions: 0,
    runtimePromotions: 0,
    canonChanges: 0,
    worldActions: 0
  };
}

function batchAuthority() {
  return {
    sourceRead: true,
    privateProposalTraceWrite: true,
    humanDecision: false,
    evidenceAdmission: false,
    reviewApproval: false,
    heldOutAuthoring: false,
    heldOutEvaluation: false,
    candidateBuild: false,
    candidateInstall: false,
    candidateLoad: false,
    pathSelection: false,
    toolUse: false,
    permissionGrant: false,
    trainingAdmission: false,
    runtimePromotion: false,
    canonChange: false,
    identityChange: false,
    worldAction: false
  };
}

function buildBatch(requests, root = ROOT) {
  const drafts = normalizeRequests(requests);
  const lineage = sourceLineage(root);
  const inputs = drafts.map(draft => ({ draftId: draft.draftId, draftDigest: draft.draftDigest }));
  const inputsDigest = digest({ organId: ORGAN_ID, sourceLineage: lineage, inputs });
  const results = resultsFor(drafts);
  const summary = expectedSummary(results);
  const batch = {
    schema: BATCH_SCHEMA,
    batchId: `declarative-reasoning-organ-recipe-drafts-${inputsDigest.slice(0, 24)}`,
    batchDigest: null,
    inputsDigest,
    createdAt: null,
    organ: { id: ORGAN_ID, status: 'TEST_MACHINE_DRAFTED_STRUCTURAL_RECIPES_REQUIRE_HUMAN_REVIEW', learnedWeights: false },
    cell: { id: DraftCell.CELL_ID, draftSchema: DraftCell.DRAFT_SCHEMA, learnedWeights: false },
    sourceLineage: lineage,
    results,
    summary,
    state: results.length ? (summary.heldDrafts === results.length ? 'ALL_RECIPE_DRAFTS_HELD' : summary.heldOutputGroups ? 'RECIPE_DRAFTS_PRODUCED_WITH_EXPLICIT_HOLDS' : 'RECIPE_DRAFTS_PRODUCED_REQUIRING_HUMAN_REVIEW') : 'NO_RECIPE_DRAFT_REQUESTS_SUBMITTED',
    authority: batchAuthority(),
    boundary: 'This explicit proposal-only organ reconstructs earned PROPOSE_BUILD assessments and derives closed structural rule drafts from bounded permissioned authoring examples. It stores only sealed projections and lineage, not full contexts. Declared source independence is not certified. Drafts cannot review themselves, read or author held-out cases, build or install candidates, select paths, grant permissions, train, promote, change CANON, or act.'
  };
  batch.batchDigest = digest(without(batch, 'batchDigest'));
  return batch;
}

function verifyBatch(batch, requests = null, runDir = null, root = ROOT) {
  if (!batch || batch.schema !== BATCH_SCHEMA || !/^declarative-reasoning-organ-recipe-drafts-[a-f0-9]{24}$/.test(String(batch.batchId || '')) || batch.batchDigest !== digest(without(batch, 'batchDigest'))) throw new Error('declarative reasoning organ recipe draft batch seal changed');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.status !== 'TEST_MACHINE_DRAFTED_STRUCTURAL_RECIPES_REQUIRE_HUMAN_REVIEW' || batch.organ.learnedWeights !== false || !batch.cell || batch.cell.id !== DraftCell.CELL_ID || batch.cell.draftSchema !== DraftCell.DRAFT_SCHEMA || batch.cell.learnedWeights !== false) throw new Error('recipe drafter organ or cell lineage changed');
  if (!same(batch.authority, batchAuthority())) throw new Error('recipe drafter authority changed');
  const lineage = sourceLineage(root);
  if (!same(batch.sourceLineage, lineage)) throw new Error('recipe drafter source lineage changed');
  if (!Array.isArray(batch.results) || batch.results.length > MAX_REQUESTS) throw new Error('recipe drafter result bound changed');
  let drafts;
  if (requests == null) drafts = batch.results.map(item => item.draft);
  else {
    if (!Array.isArray(requests) || requests.length > MAX_REQUESTS) throw new Error(`recipe drafter accepts at most ${MAX_REQUESTS} requests`);
    drafts = requests.map(request => {
      const draft = DraftCell.build(request);
      DraftCell.verify(draft, request);
      return draft;
    }).sort((left, right) => left.draftId.localeCompare(right.draftId));
    if (new Set(drafts.map(item => item.draftId)).size !== drafts.length) throw new Error('recipe drafter requests must produce unique drafts');
  }
  const expected = buildBatchFromDrafts(drafts, lineage);
  if (!same(expected, batch)) throw new Error('recipe drafter batch does not reconstruct from sealed drafts and current source lineage');
  for (const draft of drafts) DraftCell.verify(draft);
  if (runDir) {
    const directoryName = path.basename(path.resolve(runDir));
    if (directoryName !== batch.batchId && !directoryName.startsWith(`.stage-${batch.batchId}-`)) throw new Error('stored recipe drafter directory does not match the content-addressed batch ID');
    const file = path.join(runDir, 'batch.json');
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || !same(JSON.parse(fs.readFileSync(file, 'utf8')), batch)) throw new Error('stored recipe drafter batch changed');
  }
  return true;
}

function buildBatchFromDrafts(drafts, lineage) {
  const ordered = drafts.slice().sort((left, right) => left.draftId.localeCompare(right.draftId));
  if (new Set(ordered.map(item => item.draftId)).size !== ordered.length) throw new Error('recipe drafter sealed drafts must be unique');
  const inputs = ordered.map(draft => ({ draftId: draft.draftId, draftDigest: draft.draftDigest }));
  const inputsDigest = digest({ organId: ORGAN_ID, sourceLineage: lineage, inputs });
  const results = resultsFor(ordered);
  const summary = expectedSummary(results);
  const batch = {
    schema: BATCH_SCHEMA,
    batchId: `declarative-reasoning-organ-recipe-drafts-${inputsDigest.slice(0, 24)}`,
    batchDigest: null,
    inputsDigest,
    createdAt: null,
    organ: { id: ORGAN_ID, status: 'TEST_MACHINE_DRAFTED_STRUCTURAL_RECIPES_REQUIRE_HUMAN_REVIEW', learnedWeights: false },
    cell: { id: DraftCell.CELL_ID, draftSchema: DraftCell.DRAFT_SCHEMA, learnedWeights: false },
    sourceLineage: clone(lineage),
    results,
    summary,
    state: results.length ? (summary.heldDrafts === results.length ? 'ALL_RECIPE_DRAFTS_HELD' : summary.heldOutputGroups ? 'RECIPE_DRAFTS_PRODUCED_WITH_EXPLICIT_HOLDS' : 'RECIPE_DRAFTS_PRODUCED_REQUIRING_HUMAN_REVIEW') : 'NO_RECIPE_DRAFT_REQUESTS_SUBMITTED',
    authority: batchAuthority(),
    boundary: 'This explicit proposal-only organ reconstructs earned PROPOSE_BUILD assessments and derives closed structural rule drafts from bounded permissioned authoring examples. It stores only sealed projections and lineage, not full contexts. Declared source independence is not certified. Drafts cannot review themselves, read or author held-out cases, build or install candidates, select paths, grant permissions, train, promote, change CANON, or act.'
  };
  batch.batchDigest = digest(without(batch, 'batchDigest'));
  return batch;
}

function derive(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'declarative-reasoning-organ-recipe-draft-runs'));
  if (!inside(root, stateDir)) throw new Error('recipe drafter private state must stay inside the Mirror root');
  const requests = options.requests || [];
  const batch = buildBatch(requests, root);
  fs.mkdirSync(stateDir, { recursive: true });
  const runDir = path.join(stateDir, batch.batchId);
  if (fs.existsSync(runDir)) {
    const stored = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    verifyBatch(stored, requests, runDir, root);
    return { batch: stored, runDir, reused: true };
  }
  const stageDir = path.join(stateDir, `.stage-${batch.batchId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error('recipe drafter staging directory already exists');
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  verifyBatch(batch, requests, stageDir, root);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused };
}

function respond(batchOrDerived) {
  const batch = batchOrDerived && batchOrDerived.batch ? batchOrDerived.batch : batchOrDerived;
  verifyBatch(batch);
  const response = {
    schema: RESPONSE_SCHEMA,
    responseDigest: null,
    organId: ORGAN_ID,
    sourceBatchId: batch.batchId,
    sourceBatchDigest: batch.batchDigest,
    state: batch.state,
    summary: clone(batch.summary),
    proposals: batch.results.filter(item => item.draft.recipeLanguage).map(item => ({
      draftId: item.draftId,
      draftDigest: item.draftDigest,
      assessmentId: item.assessmentId,
      assessmentDigest: item.assessmentDigest,
      targetOrganId: item.targetOrganId,
      state: item.state,
      recipeLanguage: clone(item.draft.recipeLanguage),
      humanReviewRequired: true,
      heldOutExamRequired: true
    })),
    holds: batch.results.flatMap(item => item.draft.holds.map(hold => ({ draftId: item.draftId, targetOrganId: item.targetOrganId, reasonCode: hold.reasonCode, output: clone(hold.output) }))),
    authority: clone(batch.authority),
    boundary: batch.boundary
  };
  response.responseDigest = digest(without(response, 'responseDigest'));
  return response;
}

module.exports = {
  ORGAN_ID, BATCH_SCHEMA, RESPONSE_SCHEMA, ROOT, DEFAULT_STATE_DIR, MAX_REQUESTS, SOURCE_PATHS,
  stable, digest, clone, same, sourceLineage, normalizeRequests, resultsFor, expectedSummary,
  batchAuthority, buildBatch, buildBatchFromDrafts, verifyBatch, derive, respond
};
