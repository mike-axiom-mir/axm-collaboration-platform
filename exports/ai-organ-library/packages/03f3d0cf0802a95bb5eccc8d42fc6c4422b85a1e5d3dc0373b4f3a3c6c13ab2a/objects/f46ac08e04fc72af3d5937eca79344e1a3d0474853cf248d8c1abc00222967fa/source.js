'use strict';

const fs = require('fs');
const path = require('path');
const Challenger = require('../kernel/outcome-method-challenger-cell');
const Planner = require('./outcome-curriculum-planner-organ');
const Foundation = require('../kernel/reasoning-foundation');
const ImmutableStore = require('../kernel/immutable-batch-store');

const ROOT = path.resolve(__dirname, '..');
const ORGAN_ID = 'axm.mirror.outcome-method-challenger-organ/v1';
const BATCH_SCHEMA = 'axm.mirror.outcome-method-challenger-batch/v1';
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'outcome-method-challenger-runs');
const DEFAULT_CURRICULUM_STATE_DIR = Planner.DEFAULT_STATE_DIR;
const MAX_SOURCE_BYTES = 64 * 1024 * 1024;
const MAX_PACKS_PER_ROLE = 128;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Challenger.same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(`${label} fields changed`);
}
function rejectHidden(value, trail = []) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (/chain.?of.?thought|hidden.?reasoning|private.?reasoning|reasoning.?content/i.test(key)) throw new Error(`private hidden reasoning field refused at ${trail.concat(key).join('.')}`);
    rejectHidden(value[key], trail.concat(key));
  }
}

function normalize(input) {
  rejectHidden(input);
  exactKeys(input, ['curriculumBatch', 'sourceOutcomeBatches', 'selectionPackDrafts', 'confirmationPackDrafts'], 'outcome method challenger input');
  const curriculumBatch = clone(input.curriculumBatch);
  const sourceOutcomeBatches = clone(input.sourceOutcomeBatches).sort((left, right) => left.batchId.localeCompare(right.batchId));
  Planner.verify(curriculumBatch, sourceOutcomeBatches);
  const selectionPackDrafts = clone(input.selectionPackDrafts);
  const confirmationPackDrafts = clone(input.confirmationPackDrafts);
  if (selectionPackDrafts.length > MAX_PACKS_PER_ROLE || confirmationPackDrafts.length > MAX_PACKS_PER_ROLE) throw new Error('outcome method challenger pack count exceeds its bound');
  selectionPackDrafts.forEach(item => Challenger.verifyExamDraft(item, 'SELECTION'));
  confirmationPackDrafts.forEach(item => Challenger.verifyExamDraft(item, 'CONFIRMATION'));
  const sortDrafts = items => items.sort((left, right) => left.failureSignatureDigest.localeCompare(right.failureSignatureDigest) || left.source.sourceRecordId.localeCompare(right.source.sourceRecordId));
  sortDrafts(selectionPackDrafts);
  sortDrafts(confirmationPackDrafts);
  const bytes = Buffer.byteLength(JSON.stringify({ curriculumBatch, sourceOutcomeBatches, selectionPackDrafts, confirmationPackDrafts }), 'utf8');
  if (bytes > MAX_SOURCE_BYTES) throw new Error('outcome method challenger source bytes exceed its bound');
  return { curriculumBatch, sourceOutcomeBatches, selectionPackDrafts, confirmationPackDrafts };
}

function sourceRefs(source) {
  return {
    curriculumBatch: { batchId: source.curriculumBatch.batchId, batchDigest: source.curriculumBatch.batchDigest },
    outcomeBatches: source.sourceOutcomeBatches.map(item => ({ batchId: item.batchId, batchDigest: item.batchDigest })).sort((left, right) => left.batchId.localeCompare(right.batchId))
  };
}

function foundationSession(result, candidateSet, selectionPacks, confirmationPacks, options = {}) {
  const candidateMap = new Map(candidateSet.candidates.map(item => [item.candidateId, item]));
  const packMap = new Map(selectionPacks.concat(confirmationPacks).map(item => [item.packId, item]));
  const evidence = [{
    id: result.resultId,
    kind: 'test',
    status: 'tested',
    statement: `Outcome method challenger result ${result.resultId} is content-bound in state ${result.proposal.state}.`,
    source: { kind: 'outcome-method-challenger-result', id: result.resultId, at: null }
  }];
  for (const ref of result.candidateRefs) {
    const candidate = candidateMap.get(ref.candidateId);
    evidence.push({
      id: candidate.candidateId,
      kind: 'artifact',
      status: 'observed',
      statement: `Closed declarative candidate ${candidate.candidateId} was derived from historical cases with zero exam inputs or answers.`,
      source: { kind: 'outcome-method-candidate', id: candidate.candidateId, at: null }
    });
  }
  for (const ref of [result.selectionPack, result.confirmationPack].filter(Boolean)) {
    const pack = packMap.get(ref.packId);
    evidence.push({
      id: pack.packId,
      kind: 'test',
      status: 'tested',
      statement: `${pack.role} pack ${pack.packId} is locally content-sealed against the candidate set; external independence and chronology remain uncertified.`,
      source: { kind: 'outcome-method-exam-pack', id: pack.packId, at: null }
    });
  }
  const evidenceIds = evidence.map(item => item.id);
  const unknowns = [
    { id: `external-independence-${result.failureSignatureDigest.slice(0, 20)}`, question: 'Can an externally attributed evaluator establish that future exam targets and answers were independently authored after candidate sealing?', blocking: true },
    { id: `broader-counterpattern-${result.failureSignatureDigest.slice(0, 20)}`, question: 'Does the declarative challenger survive broader adversarial counterpatterns, longer horizons, and other seeds without regressing earlier capabilities?', blocking: true }
  ];
  const actionIds = [
    `request-independent-confirmation-${result.resultId}`,
    `preserve-method-hold-${result.resultId}`
  ];
  const actions = [
    {
      id: actionIds[0],
      kind: 'proposal',
      label: 'Request externally attributed confirmation and human review without changing the runtime method',
      requiredPermissions: [],
      supportingEvidence: evidenceIds,
      preconditionEvidence: evidenceIds,
      expectedEffects: ['A future reviewer can test the same sealed candidate on new evidence without granting it runtime authority.'],
      possibleSideEffects: ['Repeated local fixture families may still overstate transfer.'],
      reversible: true,
      recovery: 'Discard the review proposal while preserving the candidate, exams, and failed evidence.',
      risk: 'low'
    },
    {
      id: actionIds[1],
      kind: 'hold',
      label: 'Keep the candidate isolated and preserve every selection, confirmation, and regression result',
      requiredPermissions: [],
      supportingEvidence: evidenceIds,
      preconditionEvidence: evidenceIds,
      expectedEffects: ['No live prediction method changes while evidence gaps remain inspectable.'],
      possibleSideEffects: ['The bounded method improvement remains unavailable to the runtime.'],
      reversible: true,
      recovery: 'Supersede the hold only with an attributed review bound to this exact candidate and additional evidence.',
      risk: 'low'
    }
  ];
  const reasoning = {
    schema: 'axm.mirror.reason/v1',
    requestId: `outcome-method-foundation-${result.resultId}`,
    sessionId: `outcome-method-${result.resultId}`,
    actor: { id: 'mirror-outcome-method-challenger-organ', kind: 'machine', displayName: 'Mirror Outcome Method Challenger Organ' },
    goal: { id: 'challenge-outcome-method-with-separated-exams', statement: 'Evaluate an exam-blind closed declarative method candidate against local selection, confirmation, and historical regression evidence without converting a local result into runtime authority.' },
    evidence,
    unknowns,
    constraints: [{ id: 'outcome-method-proposal-only', type: 'max-risk', statement: 'The challenger lab may propose further review but may not rewrite predictions, select a runtime method, train weights, grant permission, promote, or act.', actionIds, evidenceIds: [], permission: null, maxRisk: 'low', hard: true }],
    permissions: [],
    actions,
    budget: { maxCandidates: 3, deadlineMs: 1000 },
    decomposition: unknowns.map((item, index) => ({
      id: item.id,
      question: item.question,
      dependsOn: [],
      cheapestCheck: index === 0 ? 'Have a separately attributed evaluator seal new targets and answers against this exact candidate digest.' : 'Run the same candidate against new counterpatterns, other seeds, and preserved capability regressions.',
      status: 'OPEN',
      answerEvidenceRefs: []
    })),
    assumptions: [],
    pathProfiles: actions.map((action, index) => ({
      pathId: `path-${action.id}`,
      actionId: action.id,
      approach: action.label,
      questionIds: index === 0 ? unknowns.map(item => item.id) : [],
      requiredEvidence: action.preconditionEvidence,
      requiredPermissions: [],
      toolRequest: null,
      estimatedCost: 'LOW',
      informationValue: index === 0 ? 0.9 : 0.2,
      reversible: true,
      failureConditions: ['Candidate or pack reconstruction fails.', 'Exam answers enter candidate origination.', 'A local result is relabelled independent, broad, or runtime-ready.'],
      strategyTags: ['outcome-method-challenger', index === 0 ? 'request-independent-confirmation' : 'preserve-hold']
    })),
    verificationReceipts: actions.map((action, index) => ({
      id: `verify-${index + 1}-${result.resultId}`,
      actionId: action.id,
      claim: `The route ${action.id} is reproduced from the exact candidate set, local exam packs, and challenger result without changing the live method.`,
      evidenceRefs: evidenceIds,
      method: 'Re-run the deterministic Outcome Method Challenger verifier from its complete stored source bundle.',
      result: 'PASS',
      limitations: ['local pack separation is not external independence', 'no runtime admission', 'no broad generalization claim']
    })),
    outcome: {
      result: 'HOLD',
      statement: result.proposal.state === 'PROPOSE_REVIEWED_METHOD_IMPROVEMENT'
        ? 'Two-stage local evidence supports a human review proposal, while external independence, broader transfer, and runtime admission remain open.'
        : `The challenger remains held in state ${result.proposal.state}; no method change occurred.`,
      evidenceRefs: evidenceIds,
      transferEvidenceRefs: [],
      regressionEvidenceRefs: result.controlEvaluations.map(item => item.evaluationId),
      repairEvidenceRefs: [],
      resolvedSeams: [],
      observedAt: options.at || null,
      verified: true,
      repeatedVerifiedOutcomes: result.confirmationEvaluation ? result.confirmationEvaluation.metrics.candidateMatches : 0,
      usePermission: 'unknown',
      permissionBasis: null,
      worldMutations: 0,
      runtimePointerChanged: false,
      unexpectedSeams: []
    }
  };
  return Foundation.run(reasoning, { at: options.at });
}

function sealBatch(batch) {
  batch.batchId = `outcome-method-challenger-${Challenger.digest(Object.assign({}, batch, { batchId: null, batchDigest: null })).slice(0, 24)}`;
  batch.batchDigest = Challenger.digest(Object.assign({}, batch, { batchDigest: null }));
  return Challenger.stable(batch);
}

function run(input, options = {}) {
  const source = normalize(input);
  const createdAt = String(options.at == null ? '' : options.at).trim() || new Date().toISOString();
  const candidateSet = Challenger.originate(source.curriculumBatch);
  Challenger.verifyCandidateSet(candidateSet);
  const selectionPacks = source.selectionPackDrafts.map(item => Challenger.sealExamPack(item, candidateSet)).sort((left, right) => left.packId.localeCompare(right.packId));
  const confirmationPacks = source.confirmationPackDrafts.map(item => Challenger.sealExamPack(item, candidateSet)).sort((left, right) => left.packId.localeCompare(right.packId));
  Challenger.validateTopology(source.curriculumBatch, candidateSet, selectionPacks, confirmationPacks);
  const results = Challenger.evaluate(source.curriculumBatch, candidateSet, selectionPacks, confirmationPacks);
  results.forEach(item => Challenger.verifyResult(item, candidateSet.candidates, selectionPacks.concat(confirmationPacks)));
  const foundationPairs = results.map(item => ({ result: item, session: foundationSession(item, candidateSet, selectionPacks, confirmationPacks, { at: createdAt }) }));
  const foundationSessions = foundationPairs.map(item => item.session).sort((left, right) => left.reasoningSessionId.localeCompare(right.reasoningSessionId));
  const reasoningBindings = foundationPairs.map(item => ({ resultId: item.result.resultId, resultDigest: item.result.resultDigest, reasoningSessionId: item.session.reasoningSessionId })).sort((left, right) => left.resultId.localeCompare(right.resultId));
  const proposals = results.filter(item => item.proposal.state === 'PROPOSE_REVIEWED_METHOD_IMPROVEMENT').length;
  const state = source.curriculumBatch.requests.filter(item => item.state === 'PROPOSE_REVIEWED_OUTCOME_CURRICULUM').length === 0
    ? 'NO_RECURRENT_CURRICULUM_REQUESTS'
    : candidateSet.candidates.length === 0
      ? 'NO_DERIVABLE_DECLARATIVE_CHALLENGERS'
      : proposals
        ? 'METHOD_IMPROVEMENT_REVIEW_PROPOSED'
        : 'METHOD_CHALLENGERS_HELD';
  return sealBatch({
    schema: BATCH_SCHEMA,
    batchId: null,
    batchDigest: null,
    createdAt,
    organ: { id: ORGAN_ID, status: 'TEST', learnedWeights: false, claimCeiling: 'TEST_EXAM_BLIND_DECLARATIVE_CHALLENGERS_TO_LOCAL_TWO_STAGE_REVIEW_PROPOSALS' },
    source: sourceRefs(source),
    candidateSet,
    selectionPacks,
    confirmationPacks,
    results,
    reasoningBindings,
    foundationSessions,
    summary: {
      sourceOutcomeBatches: source.sourceOutcomeBatches.length,
      curriculumRequests: source.curriculumBatch.requests.length,
      recurrentCurriculumRequests: source.curriculumBatch.requests.filter(item => item.state === 'PROPOSE_REVIEWED_OUTCOME_CURRICULUM').length,
      declarativeCandidatesDerived: candidateSet.candidates.length,
      candidateDerivationHolds: candidateSet.holds.length,
      selectionPacks: selectionPacks.length,
      confirmationPacks: confirmationPacks.length,
      evaluationResults: results.length,
      reviewProposals: proposals,
      holds: results.length - proposals,
      foundationSessions: foundationSessions.length,
      arbitraryCodeGenerated: 0,
      learnedWeightsChanged: 0,
      examAnswersReadDuringCandidateOrigin: 0,
      independentAuthorshipCertifications: 0,
      externalChronologyCertifications: 0,
      trainingAdmissions: 0,
      predictionRewrites: 0,
      repairApplications: 0,
      permissionGrants: 0,
      toolCalls: 0,
      runtimeSelections: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    state,
    authority: Object.assign({ privateProposalTraceWrite: true }, Challenger.falseAuthority()),
    boundary: 'This TEST organ derives closed declarative method candidates only from verified historical failures, seals them before inspecting separately supplied local selection and confirmation packs, and may emit a human-review proposal only after both stages improve without historical control regression. It cannot certify independent authorship, chronology, causality, broad generalization, intelligence, or runtime readiness; generate arbitrary code or weights; rewrite predictions; apply repairs; grant permission; select or promote a runtime method; change CANON; or act.'
  });
}

function verify(batch, input, runDir) {
  exactKeys(batch, ['schema', 'batchId', 'batchDigest', 'createdAt', 'organ', 'source', 'candidateSet', 'selectionPacks', 'confirmationPacks', 'results', 'reasoningBindings', 'foundationSessions', 'summary', 'state', 'authority', 'boundary'], 'outcome method challenger batch');
  if (batch.schema !== BATCH_SCHEMA || batch.organ.id !== ORGAN_ID || batch.organ.status !== 'TEST' || batch.organ.learnedWeights !== false || batch.organ.claimCeiling !== 'TEST_EXAM_BLIND_DECLARATIVE_CHALLENGERS_TO_LOCAL_TWO_STAGE_REVIEW_PROPOSALS') throw new Error('outcome method challenger batch boundary changed');
  const trueAuthority = new Set(['privateProposalTraceWrite']);
  if (!batch.authority || Object.entries(batch.authority).some(([key, value]) => trueAuthority.has(key) ? value !== true : value !== false)) throw new Error('outcome method challenger batch gained authority');
  Challenger.verifyCandidateSet(batch.candidateSet);
  batch.selectionPacks.concat(batch.confirmationPacks).forEach(item => Challenger.verifyExamPack(item, batch.candidateSet));
  batch.results.forEach(item => Challenger.verifyResult(item, batch.candidateSet.candidates, batch.selectionPacks.concat(batch.confirmationPacks)));
  if (batch.foundationSessions.some(session => session.authority.proposalOnly !== true || Object.entries(session.authority).some(([key, value]) => key !== 'proposalOnly' && value !== false))) throw new Error('outcome method challenger Foundation session gained authority');
  const zeroClaims = ['arbitraryCodeGenerated', 'learnedWeightsChanged', 'examAnswersReadDuringCandidateOrigin', 'independentAuthorshipCertifications', 'externalChronologyCertifications', 'trainingAdmissions', 'predictionRewrites', 'repairApplications', 'permissionGrants', 'toolCalls', 'runtimeSelections', 'runtimePromotions', 'canonChanges', 'worldActions'];
  if (zeroClaims.some(key => batch.summary[key] !== 0)) throw new Error('outcome method challenger claim ceiling changed');
  if (batch.batchDigest !== Challenger.digest(Object.assign({}, batch, { batchDigest: null })) || batch.batchId !== `outcome-method-challenger-${Challenger.digest(Object.assign({}, batch, { batchId: null, batchDigest: null })).slice(0, 24)}`) throw new Error('outcome method challenger batch identity changed');
  const source = normalize(input);
  if (!Challenger.same(sourceRefs(source), batch.source)) throw new Error('outcome method challenger source refs changed');
  const reconstructed = run(source, { at: batch.createdAt });
  if (!Challenger.same(reconstructed, batch)) throw new Error('outcome method challenger batch does not replay from its complete source bundle');
  if (runDir) {
    const diskBatch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    const diskSource = JSON.parse(fs.readFileSync(path.join(runDir, 'source.json'), 'utf8'));
    if (!Challenger.same(diskBatch, batch) || !Challenger.same(normalize(diskSource), source)) throw new Error('outcome method challenger stored files changed');
  }
  return true;
}

function ensureDirectory(directory) {
  const target = path.resolve(directory);
  fs.mkdirSync(target, { recursive: true });
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('outcome method challenger state root must be a real directory');
  return target;
}

function record(input, options = {}) {
  const source = normalize(input);
  const batch = run(source, options);
  verify(batch, source);
  if (options.write === false) return { batch, written: false, reused: false, runDir: null };
  const root = ensureDirectory(options.stateDir || DEFAULT_STATE_DIR);
  const finalDir = path.join(root, batch.batchId);
  if (fs.existsSync(finalDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(finalDir, 'batch.json'), 'utf8'));
    const existingSource = JSON.parse(fs.readFileSync(path.join(finalDir, 'source.json'), 'utf8'));
    verify(existing, existingSource, finalDir);
    if (!Challenger.same(existing, batch) || !Challenger.same(normalize(existingSource), source)) throw new Error('outcome method challenger immutable identity collision');
    return { batch: existing, written: false, reused: true, runDir: finalDir };
  }
  const stageDir = path.join(root, `.${batch.batchId}-${process.pid}-${Date.now()}`);
  fs.mkdirSync(stageDir);
  fs.writeFileSync(path.join(stageDir, 'batch.json'), JSON.stringify(batch, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(stageDir, 'source.json'), JSON.stringify(source, null, 2) + '\n', { flag: 'wx' });
  verify(batch, source, stageDir);
  const commit = ImmutableStore.commitDirectory(stageDir, finalDir);
  return { batch, written: !commit.reused, reused: commit.reused, runDir: commit.runDir };
}

function loadLatestCurriculumRun(options = {}) {
  const root = path.resolve(options.curriculumStateDir || DEFAULT_CURRICULUM_STATE_DIR);
  if (!fs.existsSync(root)) return null;
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('outcome method challenger curriculum root must be a real directory');
  const runs = fs.readdirSync(root, { withFileTypes: true }).filter(item => item.isDirectory() && /^outcome-curriculum-plan-[a-f0-9]{24}$/.test(item.name)).map(entry => {
    const runDir = path.join(root, entry.name);
    const batchFile = path.join(runDir, 'batch.json');
    const sourcesFile = path.join(runDir, 'source-batches.json');
    for (const file of [batchFile, sourcesFile]) {
      const fileStat = fs.lstatSync(file);
      if (!fileStat.isFile() || fileStat.isSymbolicLink()) throw new Error(`outcome method challenger curriculum source is not a real file: ${entry.name}`);
    }
    const curriculumBatch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    const sourceOutcomeBatches = JSON.parse(fs.readFileSync(sourcesFile, 'utf8'));
    Planner.verify(curriculumBatch, sourceOutcomeBatches, runDir);
    return { curriculumBatch, sourceOutcomeBatches };
  }).sort((left, right) => left.curriculumBatch.createdAt.localeCompare(right.curriculumBatch.createdAt) || left.curriculumBatch.batchId.localeCompare(right.curriculumBatch.batchId));
  return runs.length ? runs.at(-1) : null;
}

module.exports = {
  ROOT,
  ORGAN_ID,
  BATCH_SCHEMA,
  DEFAULT_STATE_DIR,
  DEFAULT_CURRICULUM_STATE_DIR,
  MAX_SOURCE_BYTES,
  MAX_PACKS_PER_ROLE,
  normalize,
  sourceRefs,
  foundationSession,
  run,
  verify,
  record,
  loadLatestCurriculumRun
};
