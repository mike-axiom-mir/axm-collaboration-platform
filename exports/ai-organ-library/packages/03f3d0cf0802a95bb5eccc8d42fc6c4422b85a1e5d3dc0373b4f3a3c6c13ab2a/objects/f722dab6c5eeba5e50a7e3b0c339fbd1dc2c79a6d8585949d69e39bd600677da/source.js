'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ImmutableStore = require('../kernel/immutable-batch-store');
const Frontier = require('./english-capability-frontier-organ');
const EnglishExam = require('./english-behavioral-exam-organ');

const ORGAN_ID = 'axm.mirror.organ/specialist-evidence-intake-v1';
const REQUEST_SCHEMA = 'axm.mirror.specialist-evidence-request/v1';
const RECEIPT_SCHEMA = 'axm.mirror.specialist-evidence-intake-receipt/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SPECIALIST_ROOT = path.join(ROOT, 'state', 'ai-organ-archive', 'specialist-mirrors', 'english-learner-mirror', 'private-state');
const DEFAULT_INBOX_ROOT = path.join(DEFAULT_SPECIALIST_ROOT, 'outside-evidence-inbox');
const MAX_UPLOAD_BYTES = 262144;
const CASE_PLAN = Object.freeze({ PARAPHRASE_TRANSFER: 6, SAFE_UNKNOWN_HOLD: 3, CONTRADICTION_DISCRIMINATION: 3 });

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
function realDirectory(root, label, create = false) {
  const resolved = path.resolve(root);
  if (create) fs.mkdirSync(resolved, { recursive: true });
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a real directory`);
  return resolved;
}

function verifyRequest(request, batch = null) {
  exactKeys(request, ['schema', 'requestId', 'requestDigest', 'organ', 'specialistId', 'source', 'evidenceKind', 'targetModelDigest', 'casePlan', 'prompt', 'state', 'authority', 'nextStep', 'boundary'], 'specialist evidence request');
  if (request.schema !== REQUEST_SCHEMA || !/^specialist-evidence-request-[a-f0-9]{24}$/.test(request.requestId || '')) throw new Error('specialist evidence request identity is invalid');
  if (request.requestDigest !== sha256(Object.assign({}, request, { requestDigest: null }))) throw new Error('specialist evidence request digest changed');
  if (request.evidenceKind !== 'OUTSIDE_AUTHORED_FROZEN_ENGLISH_BEHAVIORAL_EXAM_DRAFT' || request.specialistId !== 'english-learner-mirror') throw new Error('specialist evidence request kind changed');
  if (!same(request.casePlan, CASE_PLAN)) throw new Error('specialist evidence request case plan changed');
  if (!request.authority || Object.entries(request.authority).some(([key, value]) => key === 'sourceRead' ? value !== true : value !== false)) throw new Error('specialist evidence request gained authority');
  if (request.state !== 'AWAITING_OUTSIDE_AUTHORED_FROZEN_EVIDENCE' || request.nextStep !== 'HUMAN_MAY_COPY_PROMPT_AND_RETURN_ONE_JSON_DRAFT') throw new Error('specialist evidence request state changed');
  if (batch && (request.source.frontierBatchId !== batch.batchId || request.source.frontierBatchDigest !== batch.batchDigest)) throw new Error('specialist evidence request does not bind the frontier batch');
  return true;
}

function buildRequest(batch, sourceExam, promptText, promptPath = 'docs/ENGLISH_LEARNER_OUTSIDE_FROZEN_EXAM_AUTHOR_PROMPT_2026-07-22.md') {
  Frontier.verifyBatch(batch, sourceExam);
  if (batch.nextGate !== 'REQUEST_SEPARATELY_AUTHORED_FROZEN_EVIDENCE' || batch.requests.length !== 1) throw new Error('specialist evidence intake requires one additional-evidence frontier request');
  const frontierRequest = batch.requests[0];
  if (frontierRequest.route !== 'REQUEST_MORE_SEPARATELY_AUTHORED_EVIDENCE' || frontierRequest.reasoningFoundation.selectedActionId !== 'request-more-evidence') throw new Error('specialist evidence intake source route changed');
  if (frontierRequest.answerKeysCopiedIntoRequest !== false || frontierRequest.examPromptsCopiedIntoRequest !== false) throw new Error('specialist evidence intake source leaked exam material');
  const prompt = String(promptText || '');
  if (!prompt.includes(frontierRequest.targetModelDigest) || !prompt.includes(EnglishExam.DRAFT_SCHEMA)) throw new Error('specialist evidence author prompt does not bind the target and draft contract');
  const promptSha256 = sha256(prompt);
  const basis = { frontierBatchDigest: batch.batchDigest, frontierRequestId: frontierRequest.requestId, promptSha256 };
  const request = stable({
    schema: REQUEST_SCHEMA,
    requestId: `specialist-evidence-request-${sha256(basis).slice(0, 24)}`,
    requestDigest: null,
    organ: { id: ORGAN_ID, learnedWeights: false, automaticAcquisition: false },
    specialistId: batch.specialistId,
    source: {
      frontierBatchId: batch.batchId,
      frontierBatchDigest: batch.batchDigest,
      frontierRequestId: frontierRequest.requestId,
      frontierSourceExamId: batch.sourceExam.examId,
      frontierSourceExamDigest: batch.sourceExam.examDigest,
      selectedActionId: frontierRequest.reasoningFoundation.selectedActionId
    },
    evidenceKind: 'OUTSIDE_AUTHORED_FROZEN_ENGLISH_BEHAVIORAL_EXAM_DRAFT',
    targetModelDigest: frontierRequest.targetModelDigest,
    casePlan: clone(CASE_PLAN),
    prompt: { path: String(promptPath).replaceAll('\\', '/'), sha256: promptSha256, text: prompt },
    state: 'AWAITING_OUTSIDE_AUTHORED_FROZEN_EVIDENCE',
    authority: { sourceRead: true, externalCommunication: false, evidenceAdmission: false, evaluation: false, trainingAdmission: false, modelChange: false, runtimeChange: false, parentMirrorWrite: false, permissionGrant: false, canonChange: false, worldAction: false },
    nextStep: 'HUMAN_MAY_COPY_PROMPT_AND_RETURN_ONE_JSON_DRAFT',
    boundary: 'This request exposes a frozen outside-author prompt. It cannot contact an author, certify independence, accept evidence, evaluate a model, create a lesson, train, change Mirror, grant permission, promote runtime, change CANON, or act.'
  });
  request.requestDigest = sha256(Object.assign({}, request, { requestDigest: null }));
  verifyRequest(request, batch);
  return stable(request);
}

function loadDefaultRequest(options = {}) {
  const bomPath = path.resolve(options.bomPath || path.join(ROOT, 'MODEL_BOM.json'));
  const bom = JSON.parse(fs.readFileSync(bomPath, 'utf8'));
  const record = bom.englishLearnerMirror;
  if (!record || !record.capabilityFrontierBatchId || !record.behavioralExamId) throw new Error('MODEL_BOM does not declare the English evidence frontier');
  const specialistRoot = path.resolve(options.specialistRoot || DEFAULT_SPECIALIST_ROOT);
  const batchDir = path.join(specialistRoot, 'english-capability-frontier', record.capabilityFrontierBatchId);
  const examDir = path.join(specialistRoot, 'english-behavioral-exams', record.behavioralExamId);
  const batch = JSON.parse(fs.readFileSync(path.join(batchDir, 'batch.json'), 'utf8'));
  const sourceExam = JSON.parse(fs.readFileSync(path.join(examDir, 'exam.json'), 'utf8'));
  Frontier.verifyBatch(batch, sourceExam, batchDir);
  if (record.capabilityFrontierBatchDigest !== batch.batchDigest || record.behavioralExamDigest !== sourceExam.examDigest) throw new Error('MODEL_BOM English evidence binding changed');
  const promptPath = path.resolve(options.promptPath || path.join(ROOT, record.outsideFrozenExamAuthorPrompt));
  const promptText = fs.readFileSync(promptPath, 'utf8');
  if (sha256(promptText) !== record.outsideFrozenExamAuthorPromptSha256) throw new Error('outside frozen exam author prompt digest changed');
  return { request: buildRequest(batch, sourceExam, promptText, path.relative(ROOT, promptPath)), batch, sourceExam, batchDir, examDir };
}

function validateDraftForRequest(input, request, options = {}) {
  verifyRequest(request);
  const draft = EnglishExam.normalizeDraft(input);
  if (draft.targetModelDigest !== request.targetModelDigest) throw new Error('outside evidence target model digest does not match the request');
  const author = draft.authorship;
  if (author.authorKind !== 'INDEPENDENT_EXAM_AUTHOR' || author.relationshipToTraining !== 'OUTSIDE_MODEL_AND_CORPUS_AUTHORING' || author.modelOutputsUnavailableDuringAuthorship !== true || author.independentAuthorshipClaim !== true) throw new Error('outside evidence independence declaration is incomplete');
  if (draft.cases.length !== 12) throw new Error('outside evidence requires exactly 12 cases');
  const counts = Object.fromEntries(Object.keys(CASE_PLAN).map(key => [key, draft.cases.filter(item => item.capabilityClass === key).length]));
  if (!same(counts, CASE_PLAN)) throw new Error('outside evidence case plan does not match the request');
  const surfaces = draft.cases.map(item => item.english.text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en'));
  if (new Set(surfaces).size !== surfaces.length) throw new Error('outside evidence contains duplicate English surfaces');
  const examStateDir = path.resolve(options.examStateDir || path.join(DEFAULT_SPECIALIST_ROOT, 'english-behavioral-exams'));
  const reserved = new Set(EnglishExam.collectReservedSourceGroupIds(examStateDir));
  const overlap = draft.cases.map(item => item.sourceGroupId).filter(id => reserved.has(id));
  if (overlap.length) throw new Error(`outside evidence source groups overlap reserved evidence: ${overlap.join(', ')}`);
  return draft;
}

function verifyReceipt(receipt, request = null, pack = null) {
  exactKeys(receipt, ['schema', 'receiptId', 'receiptDigest', 'organ', 'request', 'upload', 'sealedPack', 'checks', 'state', 'authority', 'nextGate', 'boundary'], 'specialist evidence intake receipt');
  if (receipt.schema !== RECEIPT_SCHEMA || !/^specialist-evidence-intake-[a-f0-9]{24}$/.test(receipt.receiptId || '')) throw new Error('specialist evidence receipt identity is invalid');
  if (receipt.receiptDigest !== sha256(Object.assign({}, receipt, { receiptDigest: null }))) throw new Error('specialist evidence receipt digest changed');
  if (request && (receipt.request.requestId !== request.requestId || receipt.request.requestDigest !== request.requestDigest)) throw new Error('specialist evidence receipt request binding changed');
  if (pack && (receipt.sealedPack.packId !== pack.packId || receipt.sealedPack.packDigest !== pack.packDigest)) throw new Error('specialist evidence receipt pack binding changed');
  if (!receipt.authority || Object.entries(receipt.authority).some(([key, value]) => key === 'privateEvidenceWrite' ? value !== true : value !== false)) throw new Error('specialist evidence receipt gained authority');
  return true;
}

function storeUploadedDraft(bytes, request, options = {}) {
  verifyRequest(request);
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_UPLOAD_BYTES) throw new Error(`outside evidence upload must contain 1 through ${MAX_UPLOAD_BYTES} bytes`);
  let input;
  try { input = JSON.parse(bytes.toString('utf8')); } catch (error) { throw new Error(`outside evidence upload is not valid JSON: ${error.message}`); }
  const draft = validateDraftForRequest(input, request, options);
  const pack = EnglishExam.sealPack(draft);
  const uploadSha256 = sha256(bytes);
  const basis = { requestDigest: request.requestDigest, uploadSha256, packDigest: pack.packDigest };
  const receipt = stable({
    schema: RECEIPT_SCHEMA,
    receiptId: `specialist-evidence-intake-${sha256(basis).slice(0, 24)}`,
    receiptDigest: null,
    organ: { id: ORGAN_ID, automaticEvaluation: false, automaticTraining: false },
    request: { requestId: request.requestId, requestDigest: request.requestDigest },
    upload: { bytes: bytes.length, sha256: uploadSha256, exactBytesPreserved: true },
    sealedPack: { packId: pack.packId, packDigest: pack.packDigest, targetModelDigest: pack.targetModelDigest, cases: pack.cases.length },
    checks: { schemaClosed: true, targetBound: true, explicitUsePermission: true, declaredOutsideAuthorship: true, frozenBeforeEvaluation: true, exactCasePlan: true, exactDuplicateSurfacesRefused: true, reservedSourceGroupOverlapRefused: true, semanticNearDuplicateReview: 'HUMAN_REVIEW_REQUIRED', independenceCertifiedByMirror: false },
    state: 'SEALED_PRIVATE_EVIDENCE_AWAITING_HUMAN_REVIEW_AND_EXPLICIT_EVALUATION',
    authority: { privateEvidenceWrite: true, evidenceAdmission: false, evaluation: false, trainingAdmission: false, lessonCreation: false, modelChange: false, runtimeChange: false, parentMirrorWrite: false, permissionGrant: false, canonChange: false, worldAction: false },
    nextGate: 'HUMAN_REVIEW_AUTHORSHIP_PERMISSION_AND_SEMANTIC_DISTINCTNESS_THEN_EXPLICIT_EXAM_COMMAND',
    boundary: 'Exact uploaded bytes and a canonical sealed pack are preserved privately. Authorship is a declaration, not certified independence. Nothing was evaluated, learned, installed, connected, promoted, granted permission, made CANON, or acted on.'
  });
  receipt.receiptDigest = sha256(Object.assign({}, receipt, { receiptDigest: null }));
  verifyReceipt(receipt, request, pack);
  const inboxRoot = realDirectory(options.inboxRoot || DEFAULT_INBOX_ROOT, 'specialist evidence inbox', true);
  const finalDir = path.join(inboxRoot, receipt.receiptId);
  if (fs.existsSync(finalDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(finalDir, 'receipt.json'), 'utf8'));
    verifyReceipt(existing, request, pack);
    if (!same(existing, receipt) || sha256(fs.readFileSync(path.join(finalDir, 'upload.json'))) !== uploadSha256) throw new Error('specialist evidence content-addressed identity collision');
    return { request, draft, pack, receipt: existing, runDir: finalDir, reused: true };
  }
  const stage = path.join(inboxRoot, `.stage-${process.pid}-${receipt.receiptId}`);
  if (fs.existsSync(stage)) throw new Error('specialist evidence staging directory already exists');
  fs.mkdirSync(stage);
  try {
    fs.writeFileSync(path.join(stage, 'upload.json'), bytes, { flag: 'wx' });
    fs.writeFileSync(path.join(stage, 'draft.json'), json(draft), { flag: 'wx' });
    fs.writeFileSync(path.join(stage, 'pack.json'), json(pack), { flag: 'wx' });
    fs.writeFileSync(path.join(stage, 'receipt.json'), json(receipt), { flag: 'wx' });
    if (sha256(fs.readFileSync(path.join(stage, 'upload.json'))) !== uploadSha256) throw new Error('specialist evidence uploaded bytes changed during staging');
    EnglishExam.assertSealedPack(JSON.parse(fs.readFileSync(path.join(stage, 'pack.json'), 'utf8')));
    verifyReceipt(JSON.parse(fs.readFileSync(path.join(stage, 'receipt.json'), 'utf8')), request, pack);
    const commit = ImmutableStore.commitDirectory(stage, finalDir);
    return { request, draft, pack, receipt, runDir: finalDir, reused: commit.reused };
  } catch (error) {
    if (fs.existsSync(stage) && path.dirname(stage) === inboxRoot && path.basename(stage).startsWith(`.stage-${process.pid}-`)) fs.rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}

function status(options = {}) {
  try {
    const loaded = loadDefaultRequest(options);
    const inboxRoot = path.resolve(options.inboxRoot || DEFAULT_INBOX_ROOT);
    const receipts = fs.existsSync(inboxRoot) ? fs.readdirSync(inboxRoot).filter(name => /^specialist-evidence-intake-[a-f0-9]{24}$/.test(name)).sort() : [];
    const currentReceipts = [];
    for (const name of receipts) {
      const receipt = JSON.parse(fs.readFileSync(path.join(inboxRoot, name, 'receipt.json'), 'utf8'));
      verifyReceipt(receipt);
      if (receipt.request.requestId === loaded.request.requestId && receipt.request.requestDigest === loaded.request.requestDigest) currentReceipts.push(receipt);
    }
    const latestReceipt = currentReceipts.length ? currentReceipts.at(-1) : null;
    return { available: true, request: loaded.request, receiptCount: receipts.length, currentRequestReceiptCount: currentReceipts.length, latestReceipt, state: latestReceipt ? latestReceipt.state : loaded.request.state, error: null };
  } catch (error) {
    return { available: false, request: null, receiptCount: 0, currentRequestReceiptCount: 0, latestReceipt: null, state: 'HOLD_SPECIALIST_EVIDENCE_SOURCE_UNAVAILABLE', error: error.message };
  }
}

module.exports = { ORGAN_ID, REQUEST_SCHEMA, RECEIPT_SCHEMA, ROOT, DEFAULT_SPECIALIST_ROOT, DEFAULT_INBOX_ROOT, MAX_UPLOAD_BYTES, CASE_PLAN, stable, sha256, verifyRequest, buildRequest, loadDefaultRequest, validateDraftForRequest, verifyReceipt, storeUploadedDraft, status };
