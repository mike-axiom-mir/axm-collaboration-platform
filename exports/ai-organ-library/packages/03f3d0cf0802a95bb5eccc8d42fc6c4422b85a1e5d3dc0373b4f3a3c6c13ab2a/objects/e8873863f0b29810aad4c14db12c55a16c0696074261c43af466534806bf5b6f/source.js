'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ImmutableStore = require('../kernel/immutable-batch-store');
const English = require('./english-lesson-stewardship-organ');
const Exam = require('./english-behavioral-exam-organ');
const Frontier = require('./english-capability-frontier-organ');
const Intake = require('./specialist-evidence-intake-organ');

const ORGAN_ID = 'axm.mirror.organ/specialist-evidence-review-exam-v1';
const REVIEW_SCHEMA = 'axm.mirror.specialist-evidence-human-review/v1';
const CYCLE_SCHEMA = 'axm.mirror.specialist-evidence-reviewed-exam-cycle/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SPECIALIST_ROOT = Intake.DEFAULT_SPECIALIST_ROOT;
const DEFAULT_REVIEW_ROOT = path.join(DEFAULT_SPECIALIST_ROOT, 'outside-evidence-reviews');
const DEFAULT_CYCLE_ROOT = path.join(DEFAULT_SPECIALIST_ROOT, 'outside-evidence-cycles');
const DEFAULT_EXAM_ROOT = path.join(DEFAULT_SPECIALIST_ROOT, 'english-behavioral-exams');
const DEFAULT_FRONTIER_ROOT = path.join(DEFAULT_SPECIALIST_ROOT, 'english-capability-frontier');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(stable(value)));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
function json(value) { return `${JSON.stringify(stable(value), null, 2)}\n`; }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }
function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(expected.slice().sort())) throw new Error(`${label} shape is closed`);
}
function bounded(value, label, maximum = 160) {
  const output = String(value || '').trim();
  if (!output || output.length > maximum) throw new Error(`${label} must be a bounded non-empty value`);
  return output;
}
function actorId(value) {
  const output = bounded(value, 'specialist evidence reviewer actor id', 80);
  if (!/^[A-Za-z0-9._-]+$/.test(output)) throw new Error('specialist evidence reviewer actor id is invalid');
  return output;
}
function realDirectory(root, label, create = false) {
  const resolved = path.resolve(root);
  if (create) fs.mkdirSync(resolved, { recursive: true });
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a real directory`);
  return resolved;
}
function relativeInside(root, target, label) {
  const base = path.resolve(root);
  const resolved = path.resolve(target);
  if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) throw new Error(`${label} escaped specialist-private state`);
  return path.relative(base, resolved).replaceAll('\\', '/');
}

function buildReview(receipt, pack, request, input = {}) {
  Intake.verifyRequest(request);
  Exam.assertSealedPack(pack);
  Intake.verifyReceipt(receipt, request, pack);
  const action = String(input.action || '');
  if (!['APPROVE_FOR_EXACT_EXAM', 'HOLD_FOR_REVIEW'].includes(action)) throw new Error('specialist evidence review action is unsupported');
  const reviewer = actorId(input.actorId || 'mike-local-steward');
  const authorshipReviewed = input.authorshipReviewed === true;
  const semanticDistinctnessReviewed = input.semanticDistinctnessReviewed === true;
  const permissionReviewed = input.permissionReviewed === true;
  const holdReason = action === 'HOLD_FOR_REVIEW' ? bounded(input.holdReason, 'specialist evidence hold reason', 800) : null;
  if (action === 'APPROVE_FOR_EXACT_EXAM' && (!authorshipReviewed || !semanticDistinctnessReviewed || !permissionReviewed)) throw new Error('specialist evidence exam approval requires all three explicit human review checks');
  const basis = { receiptDigest: receipt.receiptDigest, packDigest: pack.packDigest, actorId: reviewer, action, authorshipReviewed, semanticDistinctnessReviewed, permissionReviewed, holdReason };
  const review = stable({
    schema: REVIEW_SCHEMA,
    reviewId: `specialist-evidence-review-${sha256(basis).slice(0, 24)}`,
    reviewDigest: null,
    organ: { id: ORGAN_ID, learnedWeights: false, identityCertification: false },
    source: {
      requestId: request.requestId,
      requestDigest: request.requestDigest,
      intakeReceiptId: receipt.receiptId,
      intakeReceiptDigest: receipt.receiptDigest,
      packId: pack.packId,
      packDigest: pack.packDigest,
      targetModelDigest: pack.targetModelDigest
    },
    reviewer: { kind: 'HUMAN_DECLARED_LOCAL', id: reviewer, identityCertified: false },
    checks: { authorshipReviewed, semanticDistinctnessReviewed, permissionReviewed, independenceCertifiedByMirror: false },
    decision: { action, holdReason, examAuthorityForExactPackOnly: action === 'APPROVE_FOR_EXACT_EXAM' },
    state: action === 'APPROVE_FOR_EXACT_EXAM' ? 'HUMAN_REVIEW_APPROVED_EXACT_PACK_FOR_EXAM_ONLY' : 'HUMAN_REVIEW_HELD_EXACT_PACK_NO_EXAM',
    authority: { privateReviewWrite: true, exactPackExamPermission: action === 'APPROVE_FOR_EXACT_EXAM', evidenceAdmission: false, lessonCreation: false, trainingAdmission: false, modelChange: false, runtimeChange: false, parentMirrorWrite: false, permissionGrant: false, canonChange: false, worldAction: false },
    boundary: 'This declared-human review can authorize only deterministic evaluation of the exact bound sealed pack against its exact target model. It does not certify identity or independence and cannot admit evidence as truth, create lessons, train, change a model, connect runtime, write parent Mirror, grant broader permission, change CANON, or act.'
  });
  review.reviewDigest = sha256(Object.assign({}, review, { reviewDigest: null }));
  verifyReview(review, receipt, pack, request);
  return stable(review);
}

function verifyReview(review, receipt = null, pack = null, request = null) {
  exactKeys(review, ['schema', 'reviewId', 'reviewDigest', 'organ', 'source', 'reviewer', 'checks', 'decision', 'state', 'authority', 'boundary'], 'specialist evidence human review');
  exactKeys(review.organ, ['id', 'learnedWeights', 'identityCertification'], 'specialist evidence human review organ');
  exactKeys(review.source, ['requestId', 'requestDigest', 'intakeReceiptId', 'intakeReceiptDigest', 'packId', 'packDigest', 'targetModelDigest'], 'specialist evidence human review source');
  exactKeys(review.reviewer, ['kind', 'id', 'identityCertified'], 'specialist evidence human reviewer');
  exactKeys(review.checks, ['authorshipReviewed', 'semanticDistinctnessReviewed', 'permissionReviewed', 'independenceCertifiedByMirror'], 'specialist evidence human review checks');
  exactKeys(review.decision, ['action', 'holdReason', 'examAuthorityForExactPackOnly'], 'specialist evidence human review decision');
  exactKeys(review.authority, ['privateReviewWrite', 'exactPackExamPermission', 'evidenceAdmission', 'lessonCreation', 'trainingAdmission', 'modelChange', 'runtimeChange', 'parentMirrorWrite', 'permissionGrant', 'canonChange', 'worldAction'], 'specialist evidence human review authority');
  if (review.schema !== REVIEW_SCHEMA || !/^specialist-evidence-review-[a-f0-9]{24}$/.test(review.reviewId || '')) throw new Error('specialist evidence human review identity is invalid');
  if (review.reviewDigest !== sha256(Object.assign({}, review, { reviewDigest: null }))) throw new Error('specialist evidence human review digest changed');
  if (review.organ.id !== ORGAN_ID || review.organ.learnedWeights !== false || review.organ.identityCertification !== false) throw new Error('specialist evidence human review organ boundary changed');
  if (!review.reviewer || review.reviewer.kind !== 'HUMAN_DECLARED_LOCAL' || review.reviewer.identityCertified !== false || actorId(review.reviewer.id) !== review.reviewer.id) throw new Error('specialist evidence human review identity boundary changed');
  if (!review.checks || review.checks.independenceCertifiedByMirror !== false || ['authorshipReviewed', 'semanticDistinctnessReviewed', 'permissionReviewed'].some(key => typeof review.checks[key] !== 'boolean')) throw new Error('specialist evidence review independence boundary changed');
  if (!['APPROVE_FOR_EXACT_EXAM', 'HOLD_FOR_REVIEW'].includes(review.decision.action)) throw new Error('specialist evidence human review action changed');
  const approved = review.decision.action === 'APPROVE_FOR_EXACT_EXAM';
  if (approved !== review.decision.examAuthorityForExactPackOnly || approved !== review.authority.exactPackExamPermission) throw new Error('specialist evidence exact-pack exam authority changed');
  if (approved && (!review.checks.authorshipReviewed || !review.checks.semanticDistinctnessReviewed || !review.checks.permissionReviewed)) throw new Error('specialist evidence approved review lacks human checks');
  if (approved && (review.decision.holdReason !== null || review.state !== 'HUMAN_REVIEW_APPROVED_EXACT_PACK_FOR_EXAM_ONLY')) throw new Error('specialist evidence approved review state changed');
  if (!approved && (review.decision.holdReason !== bounded(review.decision.holdReason, 'specialist evidence hold reason', 800) || review.state !== 'HUMAN_REVIEW_HELD_EXACT_PACK_NO_EXAM')) throw new Error('specialist evidence held review state changed');
  if (!review.authority || review.authority.privateReviewWrite !== true || Object.entries(review.authority).some(([key, value]) => ['privateReviewWrite', 'exactPackExamPermission'].includes(key) ? typeof value !== 'boolean' : value !== false)) throw new Error('specialist evidence review gained authority');
  if (receipt || pack || request) {
    if (!receipt || !pack || !request) throw new Error('specialist evidence review source verification requires receipt, pack, and request together');
    Intake.verifyReceipt(receipt, request, pack);
    if (review.source.requestDigest !== request.requestDigest || review.source.intakeReceiptDigest !== receipt.receiptDigest || review.source.packDigest !== pack.packDigest || review.source.targetModelDigest !== pack.targetModelDigest) throw new Error('specialist evidence human review source binding changed');
  }
  return true;
}

function storeReview(review, options = {}) {
  verifyReview(review);
  const root = realDirectory(options.reviewRoot || DEFAULT_REVIEW_ROOT, 'specialist evidence review root', true);
  const finalDir = path.join(root, review.reviewId);
  if (fs.existsSync(finalDir)) {
    const stored = JSON.parse(fs.readFileSync(path.join(finalDir, 'review.json'), 'utf8'));
    verifyReview(stored);
    if (!same(stored, review)) throw new Error('specialist evidence review content-addressed identity collision');
    return { review: stored, runDir: finalDir, reused: true };
  }
  const stage = path.join(root, `.stage-${process.pid}-${review.reviewId}`);
  if (fs.existsSync(stage)) throw new Error('specialist evidence review staging directory already exists');
  fs.mkdirSync(stage);
  try {
    fs.writeFileSync(path.join(stage, 'review.json'), json(review), { flag: 'wx' });
    verifyReview(JSON.parse(fs.readFileSync(path.join(stage, 'review.json'), 'utf8')));
    const commit = ImmutableStore.commitDirectory(stage, finalDir);
    return { review, runDir: finalDir, reused: commit.reused };
  } catch (error) {
    if (fs.existsSync(stage) && path.dirname(stage) === root && path.basename(stage).startsWith(`.stage-${process.pid}-`)) fs.rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}

function loadCurrentModel(options = {}) {
  if (options.model) {
    English.assertModel(options.model);
    return options.model;
  }
  const learningRoot = path.resolve(options.learningRoot || path.join(DEFAULT_SPECIALIST_ROOT, 'english-learning'));
  const pointer = JSON.parse(fs.readFileSync(path.join(learningRoot, 'CURRENT.json'), 'utf8'));
  const cyclePath = path.resolve(learningRoot, pointer.relativePath);
  if (!cyclePath.startsWith(`${learningRoot}${path.sep}`)) throw new Error('specialist evidence current English cycle escaped clone-private state');
  const cycle = JSON.parse(fs.readFileSync(cyclePath, 'utf8'));
  const modelPath = path.join(learningRoot, 'models', cycle.modelDigest, 'model.json');
  const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
  English.assertModel(model);
  return model;
}

function refuseReservedOverlap(pack, examRoot) {
  const root = path.resolve(examRoot);
  if (!fs.existsSync(root)) return true;
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('specialist evidence exam reservation root must be a real directory');
  const reserved = new Set();
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name.startsWith('.')) continue;
    if (!entry.isDirectory() || !/^english-behavioral-exam-[a-f0-9]{24}$/.test(entry.name)) throw new Error(`unexpected visible specialist evidence exam state entry: ${entry.name}`);
    const runDir = path.join(root, entry.name);
    const storedPack = Exam.assertSealedPack(JSON.parse(fs.readFileSync(path.join(runDir, 'pack.json'), 'utf8')));
    const storedExam = JSON.parse(fs.readFileSync(path.join(runDir, 'exam.json'), 'utf8'));
    if (storedExam.schema !== Exam.EXAM_SCHEMA || storedExam.examId !== entry.name || !storedExam.sourcePack || storedExam.sourcePack.packDigest !== storedPack.packDigest) throw new Error(`specialist evidence exam reservation binding changed: ${entry.name}`);
    if (storedPack.packDigest === pack.packDigest) continue;
    for (const testCase of storedPack.cases) reserved.add(testCase.sourceGroupId);
  }
  const overlap = Array.from(new Set(pack.cases.map(item => item.sourceGroupId).filter(id => reserved.has(id)))).sort();
  if (overlap.length) throw new Error(`specialist evidence exam source groups became reserved before evaluation: ${overlap.join(', ')}`);
  return true;
}

function buildCycle(review, receipt, pack, request, model, examResult, frontierResult, specialistRoot) {
  verifyReview(review, receipt, pack, request);
  if (review.decision.action !== 'APPROVE_FOR_EXACT_EXAM' || review.authority.exactPackExamPermission !== true) throw new Error('specialist evidence cycle requires exact-pack human exam approval');
  Exam.verifyExam(examResult.exam, pack, model, examResult.runDir);
  Frontier.verifyBatch(frontierResult.batch, examResult.exam, frontierResult.runDir);
  const basis = { reviewDigest: review.reviewDigest, examDigest: examResult.exam.examDigest, frontierBatchDigest: frontierResult.batch.batchDigest };
  const cycle = stable({
    schema: CYCLE_SCHEMA,
    cycleId: `specialist-evidence-exam-cycle-${sha256(basis).slice(0, 24)}`,
    cycleDigest: null,
    organ: { id: ORGAN_ID, learnedWeights: false, automaticTraining: false },
    source: { reviewId: review.reviewId, reviewDigest: review.reviewDigest, intakeReceiptId: receipt.receiptId, intakeReceiptDigest: receipt.receiptDigest, packId: pack.packId, packDigest: pack.packDigest, modelDigest: model.modelDigest },
    exam: { examId: examResult.exam.examId, examDigest: examResult.exam.examDigest, state: examResult.exam.state, cases: examResult.exam.summary.cases, passed: examResult.exam.summary.passed, failed: examResult.exam.summary.failed, relativeRunDir: relativeInside(specialistRoot, examResult.runDir, 'specialist evidence exam') },
    frontier: { batchId: frontierResult.batch.batchId, batchDigest: frontierResult.batch.batchDigest, state: frontierResult.batch.state, requests: frontierResult.batch.summary.requestCount, nextGate: frontierResult.batch.nextGate, relativeRunDir: relativeInside(specialistRoot, frontierResult.runDir, 'specialist evidence frontier') },
    summary: { reviews: 1, exams: 1, frontierBatches: 1, answerKeysAdmittedToTraining: 0, lessonsCreated: 0, trainingWrites: 0, modelWrites: 0, runtimeAdmissions: 0, parentMirrorWrites: 0, permissionGrants: 0, canonChanges: 0, worldActions: 0 },
    state: frontierResult.batch.requests.length ? 'EXAM_OBSERVED_TYPED_NEXT_FRONTIER_READY_FOR_HUMAN_REVIEW' : 'EXAM_OBSERVED_NO_CURRENT_GAPS_MORE_INDEPENDENT_EVIDENCE_REQUIRED',
    authority: { privateReviewRead: true, privateExamEvidenceWrite: true, privateFrontierRequestWrite: true, evidenceAdmission: false, lessonCreation: false, trainingAdmission: false, modelChange: false, runtimeChange: false, parentMirrorWrite: false, permissionGrant: false, canonChange: false, worldAction: false },
    nextGate: frontierResult.batch.requests.length ? 'HUMAN_REVIEW_TYPED_FRONTIER_WITHOUT_ANSWER_KEYS' : 'REQUEST_ANOTHER_SEPARATELY_AUTHORED_FROZEN_PACK_BEFORE_IMPROVEMENT_CLAIM',
    boundary: 'This explicit cycle evaluates one human-reviewed exact sealed pack against one exact specialist model and regenerates proposal-only typed frontier requests. It does not certify independence, admit answer keys, create lessons, train, change a model, connect runtime, write parent Mirror, grant permission, promote, change CANON, or act.'
  });
  cycle.cycleDigest = sha256(Object.assign({}, cycle, { cycleDigest: null }));
  verifyCycle(cycle, review, receipt, pack, model, examResult, frontierResult, specialistRoot);
  return stable(cycle);
}

function verifyCycle(cycle, review = null, receipt = null, pack = null, model = null, examResult = null, frontierResult = null, specialistRoot = null) {
  exactKeys(cycle, ['schema', 'cycleId', 'cycleDigest', 'organ', 'source', 'exam', 'frontier', 'summary', 'state', 'authority', 'nextGate', 'boundary'], 'specialist evidence reviewed exam cycle');
  exactKeys(cycle.organ, ['id', 'learnedWeights', 'automaticTraining'], 'specialist evidence exam cycle organ');
  exactKeys(cycle.source, ['reviewId', 'reviewDigest', 'intakeReceiptId', 'intakeReceiptDigest', 'packId', 'packDigest', 'modelDigest'], 'specialist evidence exam cycle source');
  exactKeys(cycle.exam, ['examId', 'examDigest', 'state', 'cases', 'passed', 'failed', 'relativeRunDir'], 'specialist evidence exam cycle exam');
  exactKeys(cycle.frontier, ['batchId', 'batchDigest', 'state', 'requests', 'nextGate', 'relativeRunDir'], 'specialist evidence exam cycle frontier');
  exactKeys(cycle.summary, ['reviews', 'exams', 'frontierBatches', 'answerKeysAdmittedToTraining', 'lessonsCreated', 'trainingWrites', 'modelWrites', 'runtimeAdmissions', 'parentMirrorWrites', 'permissionGrants', 'canonChanges', 'worldActions'], 'specialist evidence exam cycle summary');
  exactKeys(cycle.authority, ['privateReviewRead', 'privateExamEvidenceWrite', 'privateFrontierRequestWrite', 'evidenceAdmission', 'lessonCreation', 'trainingAdmission', 'modelChange', 'runtimeChange', 'parentMirrorWrite', 'permissionGrant', 'canonChange', 'worldAction'], 'specialist evidence exam cycle authority');
  if (cycle.schema !== CYCLE_SCHEMA || !/^specialist-evidence-exam-cycle-[a-f0-9]{24}$/.test(cycle.cycleId || '')) throw new Error('specialist evidence exam cycle identity is invalid');
  if (cycle.cycleDigest !== sha256(Object.assign({}, cycle, { cycleDigest: null }))) throw new Error('specialist evidence exam cycle digest changed');
  if (cycle.organ.id !== ORGAN_ID || cycle.organ.learnedWeights !== false || cycle.organ.automaticTraining !== false) throw new Error('specialist evidence exam cycle organ boundary changed');
  if (![cycle.exam.cases, cycle.exam.passed, cycle.exam.failed, cycle.frontier.requests].every(Number.isInteger) || cycle.exam.cases < 1 || cycle.exam.passed < 0 || cycle.exam.failed < 0 || cycle.exam.passed + cycle.exam.failed !== cycle.exam.cases || cycle.frontier.requests < 0) throw new Error('specialist evidence exam cycle counts changed');
  const expectedState = cycle.frontier.requests > 0 ? 'EXAM_OBSERVED_TYPED_NEXT_FRONTIER_READY_FOR_HUMAN_REVIEW' : 'EXAM_OBSERVED_NO_CURRENT_GAPS_MORE_INDEPENDENT_EVIDENCE_REQUIRED';
  const expectedNextGate = cycle.frontier.requests > 0 ? 'HUMAN_REVIEW_TYPED_FRONTIER_WITHOUT_ANSWER_KEYS' : 'REQUEST_ANOTHER_SEPARATELY_AUTHORED_FROZEN_PACK_BEFORE_IMPROVEMENT_CLAIM';
  if (cycle.state !== expectedState || cycle.nextGate !== expectedNextGate) throw new Error('specialist evidence exam cycle state changed');
  if (!cycle.authority || cycle.authority.privateReviewRead !== true || cycle.authority.privateExamEvidenceWrite !== true || cycle.authority.privateFrontierRequestWrite !== true || Object.entries(cycle.authority).some(([key, value]) => ['privateReviewRead', 'privateExamEvidenceWrite', 'privateFrontierRequestWrite'].includes(key) ? value !== true : value !== false)) throw new Error('specialist evidence exam cycle gained authority');
  if (cycle.summary.reviews !== 1 || cycle.summary.exams !== 1 || cycle.summary.frontierBatches !== 1) throw new Error('specialist evidence exam cycle execution summary changed');
  const zeroSummaryKeys = ['answerKeysAdmittedToTraining', 'lessonsCreated', 'trainingWrites', 'modelWrites', 'runtimeAdmissions', 'parentMirrorWrites', 'permissionGrants', 'canonChanges', 'worldActions'];
  if (zeroSummaryKeys.some(key => cycle.summary[key] !== 0)) throw new Error('specialist evidence exam cycle exceeded its claim ceiling');
  if (review || receipt || pack || model || examResult || frontierResult || specialistRoot) {
    if (!review || !receipt || !pack || !model || !examResult || !frontierResult || !specialistRoot) throw new Error('specialist evidence cycle full verification inputs are incomplete');
    if (cycle.source.reviewDigest !== review.reviewDigest || cycle.source.intakeReceiptDigest !== receipt.receiptDigest || cycle.source.packDigest !== pack.packDigest || cycle.source.modelDigest !== model.modelDigest) throw new Error('specialist evidence cycle source binding changed');
    if (cycle.exam.examDigest !== examResult.exam.examDigest || cycle.frontier.batchDigest !== frontierResult.batch.batchDigest) throw new Error('specialist evidence cycle result binding changed');
    relativeInside(specialistRoot, path.join(specialistRoot, cycle.exam.relativeRunDir), 'specialist evidence exam reference');
    relativeInside(specialistRoot, path.join(specialistRoot, cycle.frontier.relativeRunDir), 'specialist evidence frontier reference');
  }
  return true;
}

function storeCycle(cycle, options = {}) {
  verifyCycle(cycle);
  const root = realDirectory(options.cycleRoot || DEFAULT_CYCLE_ROOT, 'specialist evidence cycle root', true);
  const finalDir = path.join(root, cycle.cycleId);
  if (fs.existsSync(finalDir)) {
    const stored = JSON.parse(fs.readFileSync(path.join(finalDir, 'cycle.json'), 'utf8'));
    verifyCycle(stored);
    if (!same(stored, cycle)) throw new Error('specialist evidence cycle content-addressed identity collision');
    return { cycle: stored, runDir: finalDir, reused: true };
  }
  const stage = path.join(root, `.stage-${process.pid}-${cycle.cycleId}`);
  if (fs.existsSync(stage)) throw new Error('specialist evidence cycle staging directory already exists');
  fs.mkdirSync(stage);
  try {
    fs.writeFileSync(path.join(stage, 'cycle.json'), json(cycle), { flag: 'wx' });
    verifyCycle(JSON.parse(fs.readFileSync(path.join(stage, 'cycle.json'), 'utf8')));
    const commit = ImmutableStore.commitDirectory(stage, finalDir);
    return { cycle, runDir: finalDir, reused: commit.reused };
  } catch (error) {
    if (fs.existsSync(stage) && path.dirname(stage) === root && path.basename(stage).startsWith(`.stage-${process.pid}-`)) fs.rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}

function run(input = {}, options = {}) {
  const { receipt, pack, request } = input;
  const review = buildReview(receipt, pack, request, input.review || {});
  const storedReview = storeReview(review, options);
  if (storedReview.review.decision.action === 'HOLD_FOR_REVIEW') return { review: storedReview.review, reviewRunDir: storedReview.runDir, reviewReused: storedReview.reused, exam: null, frontier: null, cycle: null, state: 'HUMAN_REVIEW_HELD_EXACT_PACK_NO_EXAM' };
  const model = loadCurrentModel(Object.assign({}, options, { model: input.model || options.model }));
  if (model.modelDigest !== pack.targetModelDigest) throw new Error('specialist evidence exact target model is no longer current');
  const specialistRoot = realDirectory(options.specialistRoot || DEFAULT_SPECIALIST_ROOT, 'specialist evidence private root', true);
  const examRoot = realDirectory(options.examRoot || DEFAULT_EXAM_ROOT, 'specialist evidence exam root', true);
  const frontierRoot = realDirectory(options.frontierRoot || DEFAULT_FRONTIER_ROOT, 'specialist evidence frontier root', true);
  refuseReservedOverlap(pack, examRoot);
  const examResult = Exam.run(pack, model, { stateDir: examRoot });
  const frontierResult = Frontier.run(examResult.exam, { stateDir: frontierRoot, at: String(input.observedAt || options.observedAt || '') });
  const cycle = buildCycle(storedReview.review, receipt, pack, request, model, examResult, frontierResult, specialistRoot);
  const storedCycle = storeCycle(cycle, options);
  return { review: storedReview.review, reviewRunDir: storedReview.runDir, reviewReused: storedReview.reused, exam: examResult, frontier: frontierResult, cycle: storedCycle.cycle, cycleRunDir: storedCycle.runDir, cycleReused: storedCycle.reused, state: storedCycle.cycle.state };
}

function loadIntakeEvidence(receiptId, options = {}) {
  if (!/^specialist-evidence-intake-[a-f0-9]{24}$/.test(String(receiptId || ''))) throw new Error('specialist evidence receipt id is invalid');
  const loaded = Intake.loadDefaultRequest(options);
  const inboxRoot = path.resolve(options.inboxRoot || Intake.DEFAULT_INBOX_ROOT);
  const runDir = path.join(inboxRoot, receiptId);
  if (path.dirname(runDir) !== inboxRoot) throw new Error('specialist evidence receipt path escaped inbox');
  const receipt = JSON.parse(fs.readFileSync(path.join(runDir, 'receipt.json'), 'utf8'));
  const pack = JSON.parse(fs.readFileSync(path.join(runDir, 'pack.json'), 'utf8'));
  Intake.verifyReceipt(receipt, loaded.request, pack);
  return { request: loaded.request, receipt, pack, runDir };
}

function status(evidenceStatus, options = {}) {
  try {
    if (!evidenceStatus || !evidenceStatus.available || !evidenceStatus.latestReceipt) return { available: true, state: 'AWAITING_SEALED_SPECIALIST_EVIDENCE', latestReview: null, latestCycle: null, error: null };
    const receipt = evidenceStatus.latestReceipt;
    const reviewRoot = path.resolve(options.reviewRoot || DEFAULT_REVIEW_ROOT);
    const cycleRoot = path.resolve(options.cycleRoot || DEFAULT_CYCLE_ROOT);
    const reviews = fs.existsSync(reviewRoot) ? fs.readdirSync(reviewRoot).filter(name => /^specialist-evidence-review-[a-f0-9]{24}$/.test(name)).sort() : [];
    const cycles = fs.existsSync(cycleRoot) ? fs.readdirSync(cycleRoot).filter(name => /^specialist-evidence-exam-cycle-[a-f0-9]{24}$/.test(name)).sort() : [];
    const boundReviews = reviews.map(name => JSON.parse(fs.readFileSync(path.join(reviewRoot, name, 'review.json'), 'utf8'))).filter(review => {
      verifyReview(review);
      return review.source.intakeReceiptDigest === receipt.receiptDigest;
    });
    const boundCycles = cycles.map(name => JSON.parse(fs.readFileSync(path.join(cycleRoot, name, 'cycle.json'), 'utf8'))).filter(cycle => {
      verifyCycle(cycle);
      return cycle.source.intakeReceiptDigest === receipt.receiptDigest;
    });
    const latestCycle = boundCycles.length ? boundCycles.at(-1) : null;
    const cycleReview = latestCycle ? boundReviews.find(review => review.reviewDigest === latestCycle.source.reviewDigest) : null;
    const approvedReview = boundReviews.find(review => review.decision.action === 'APPROVE_FOR_EXACT_EXAM') || null;
    const latestReview = cycleReview || approvedReview || (boundReviews.length ? boundReviews.at(-1) : null);
    return { available: true, state: latestCycle ? latestCycle.state : latestReview ? latestReview.state : 'AWAITING_HUMAN_REVIEW_OF_SEALED_PACK', latestReview, latestCycle, error: null };
  } catch (error) {
    return { available: false, state: 'HOLD_SPECIALIST_EVIDENCE_REVIEW_SOURCE_UNAVAILABLE', latestReview: null, latestCycle: null, error: error.message };
  }
}

module.exports = { ORGAN_ID, REVIEW_SCHEMA, CYCLE_SCHEMA, ROOT, DEFAULT_SPECIALIST_ROOT, DEFAULT_REVIEW_ROOT, DEFAULT_CYCLE_ROOT, DEFAULT_EXAM_ROOT, DEFAULT_FRONTIER_ROOT, stable, sha256, buildReview, verifyReview, storeReview, loadCurrentModel, refuseReservedOverlap, buildCycle, verifyCycle, storeCycle, run, loadIntakeEvidence, status };
