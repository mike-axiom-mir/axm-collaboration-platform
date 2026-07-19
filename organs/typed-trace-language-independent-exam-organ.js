'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const LanguageModel = require('../learning/typed-trace-language-model');
const LanguageOrgan = require('./typed-trace-language-organ');
const ShadowEvaluation = require('./typed-trace-language-shadow-evaluation-organ');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.typed-trace-language-independent-exam-organ/v1';
const PACK_SCHEMA = 'axm.mirror.typed-trace-language-independent-pack/v1';
const EXAM_SCHEMA = 'axm.mirror.typed-trace-language-independent-exam/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'typed-trace-language-independent-exams');
const MAX_RECORDS = 128;
const AUTHOR_KINDS = new Set(['HUMAN', 'AI_SYSTEM', 'TEAM']);
const REQUIRED_PLAN_FAMILIES = Object.freeze(Object.keys(LanguageOrgan.PLAN_ORDER).sort());
const INDEPENDENCE_FLAGS = Object.freeze([
  'authoredOutsideModelAndCorpusEffort',
  'modelWeightsUnavailableDuringAuthorship',
  'modelPredictionsUnavailableDuringAuthorship',
  'recordsFrozenBeforeFirstEvaluation',
  'notDerivedFromMirrorLanguageCorpus'
]);

function stable(value) { return LanguageModel.stable(value); }
function digest(value) {
  const bytes = typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function clean(value, max = 1000) { return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const unexpected = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = allowed.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  if (unexpected.length || missing.length) throw new Error(`${label} fields changed; unexpected=${unexpected.join(',') || 'none'} missing=${missing.join(',') || 'none'}`);
}

function canonicalDraft(draft) {
  exactKeys(draft, ['schema', 'usePermission', 'permissionBasis', 'author', 'independence', 'frozenHeldOut', 'records', 'boundary'], 'independent held-out draft');
  if (draft.schema !== PACK_SCHEMA) throw new Error(`independent held-out pack schema must be ${PACK_SCHEMA}`);
  if (draft.usePermission !== 'allowed' || !clean(draft.permissionBasis)) throw new Error('independent held-out pack lacks explicit evaluation permission');
  exactKeys(draft.author, ['id', 'kind', 'relationshipToMirrorTrainingEffort'], 'independent held-out author');
  const author = {
    id: clean(draft.author.id, 160),
    kind: clean(draft.author.kind, 40).toUpperCase(),
    relationshipToMirrorTrainingEffort: clean(draft.author.relationshipToMirrorTrainingEffort, 240)
  };
  if (!author.id || !AUTHOR_KINDS.has(author.kind) || author.relationshipToMirrorTrainingEffort !== 'OUTSIDE_MODEL_AND_CORPUS_AUTHORING') {
    throw new Error('independent held-out author must declare an outside model-and-corpus authorship relationship');
  }
  exactKeys(draft.independence, INDEPENDENCE_FLAGS.concat('attestationBasis'), 'independent held-out attestation');
  for (const flag of INDEPENDENCE_FLAGS) if (draft.independence[flag] !== true) throw new Error(`independent held-out attestation is not declared: ${flag}`);
  const attestationBasis = clean(draft.independence.attestationBasis, 1200);
  if (!attestationBasis) throw new Error('independent held-out attestation requires a basis');
  if (draft.frozenHeldOut !== true) throw new Error('independent held-out records must be frozen before evaluation');
  if (!Array.isArray(draft.records) || draft.records.length < 1 || draft.records.length > MAX_RECORDS) throw new Error(`independent held-out pack requires 1-${MAX_RECORDS} records`);
  const records = draft.records.map((record, index) => {
    exactKeys(record, ['id', 'sourceGroupId', 'trace'], `independent held-out record ${index}`);
    const id = clean(record.id, 160);
    const sourceGroupId = clean(record.sourceGroupId, 160);
    if (!id || !sourceGroupId || !record.trace || record.trace.schema !== 'axm.mirror.trace/v1') throw new Error(`independent held-out record ${index} lacks bounded identity or typed trace`);
    return { id, sourceGroupId, trace: JSON.parse(JSON.stringify(record.trace)) };
  }).sort((left, right) => left.id.localeCompare(right.id));
  if (new Set(records.map(item => item.id)).size !== records.length) throw new Error('duplicate independent held-out record id');
  if (new Set(records.map(item => item.sourceGroupId)).size !== records.length) throw new Error('each independent held-out record requires a distinct source group');
  return {
    schema: PACK_SCHEMA,
    usePermission: 'allowed',
    permissionBasis: clean(draft.permissionBasis, 1200),
    author,
    independence: Object.assign({}, Object.fromEntries(INDEPENDENCE_FLAGS.map(flag => [flag, true])), { attestationBasis }),
    frozenHeldOut: true,
    records,
    boundary: clean(draft.boundary, 1600)
  };
}

function sealPack(draft) {
  const canonical = canonicalDraft(draft);
  if (!canonical.boundary) throw new Error('independent held-out pack requires a claim boundary');
  const contentDigest = digest(canonical);
  const pack = Object.assign({}, canonical, {
    packId: `typed-trace-language-independent-pack-${contentDigest.slice(0, 24)}`,
    packDigest: null
  });
  // Identifiers are inserted in a fixed position by stable serialization; the
  // digest therefore seals both the authored content and its derived identity.
  pack.packDigest = digest(Object.assign({}, pack, { packDigest: null }));
  return stable(pack);
}

function assertedDraftFromPack(pack) {
  exactKeys(pack, ['schema', 'packId', 'packDigest', 'usePermission', 'permissionBasis', 'author', 'independence', 'frozenHeldOut', 'records', 'boundary'], 'sealed independent held-out pack');
  const draft = {};
  for (const key of ['schema', 'usePermission', 'permissionBasis', 'author', 'independence', 'frozenHeldOut', 'records', 'boundary']) draft[key] = pack[key];
  return draft;
}

function localEvaluationGroupIds(options = {}) {
  if (Array.isArray(options.localEvaluationGroupIds)) return new Set(options.localEvaluationGroupIds.map(item => clean(item, 160)).filter(Boolean));
  const directory = path.resolve(options.receiptDir || ShadowEvaluation.DEFAULT_RECEIPT_DIR);
  if (!fs.existsSync(directory)) return new Set();
  return new Set(ShadowEvaluation.collectRealReasoningReceiptRecords(directory).map(item => item.sourceGroupId));
}

function assertSealedPack(pack, options = {}) {
  const resealed = sealPack(assertedDraftFromPack(pack));
  if (pack.packId !== resealed.packId || pack.packDigest !== resealed.packDigest || JSON.stringify(stable(pack)) !== JSON.stringify(resealed)) {
    throw new Error('independent held-out pack seal or canonical bytes changed');
  }
  const inputs = ShadowEvaluation.loadInputs(options);
  const knownGroups = new Set(inputs.corpus.examples.map(item => clean(item.groupId, 160)));
  for (const group of localEvaluationGroupIds(options)) knownGroups.add(group);
  for (const record of pack.records) {
    if (knownGroups.has(record.sourceGroupId)) throw new Error(`independent held-out source group overlaps known Mirror evidence: ${record.sourceGroupId}`);
    ShadowEvaluation.normalizeRecord({
      id: record.id,
      sourceGroupId: record.sourceGroupId,
      sourceKind: 'INDEPENDENT_HELD_OUT_TRACE',
      usePermission: pack.usePermission,
      permissionBasis: pack.permissionBasis,
      trace: record.trace
    }, record.id, inputs.trainingGroupIds);
  }
  return true;
}

function evaluationRecords(pack) {
  return pack.records.map(record => ({
    id: record.id,
    sourceGroupId: record.sourceGroupId,
    sourceKind: 'INDEPENDENT_HELD_OUT_TRACE',
    usePermission: pack.usePermission,
    permissionBasis: pack.permissionBasis,
    trace: record.trace
  }));
}

function buildExam(pack, options = {}) {
  assertSealedPack(pack, options);
  const evaluation = ShadowEvaluation.buildBatch(evaluationRecords(pack), options);
  const observedPlans = Array.from(new Set(evaluation.results.map(item => item.response.verifier.expectedPlanId))).sort();
  const missingPlans = REQUIRED_PLAN_FAMILIES.filter(plan => !observedPlans.includes(plan));
  const fullCoverage = pack.records.length >= REQUIRED_PLAN_FAMILIES.length && missingPlans.length === 0;
  const drift = evaluation.summary.curriculumGapsProposed > 0 || evaluation.summary.humanProseDecoyInvariantFailures > 0;
  const state = drift
    ? 'DECLARED_INDEPENDENT_SHADOW_DRIFT_REQUIRES_REVIEW'
    : fullCoverage
      ? 'DECLARED_INDEPENDENT_SHADOW_EXAM_PASSED'
      : 'DECLARED_INDEPENDENT_EVIDENCE_INSUFFICIENT_COVERAGE';
  const basis = {
    organId: ORGAN_ID,
    packDigest: pack.packDigest,
    evaluationBatchDigest: evaluation.batchDigest,
    requiredPlanFamilies: REQUIRED_PLAN_FAMILIES
  };
  const examId = `typed-trace-language-independent-exam-${digest(basis).slice(0, 24)}`;
  const packBytes = Buffer.from(json(pack));
  const evaluationBytes = Buffer.from(json(evaluation));
  const exam = {
    schema: EXAM_SCHEMA,
    examId,
    examDigest: null,
    organ: { id: ORGAN_ID, learnedWeights: false, automaticEvaluation: false },
    sourcePack: {
      packId: pack.packId,
      packDigest: pack.packDigest,
      author: pack.author,
      recordsFrozenBeforeEvaluation: pack.frozenHeldOut,
      usePermission: pack.usePermission
    },
    independence: {
      declaredBySource: true,
      declarationBoundByPackDigest: true,
      cryptographicallyProven: false,
      externallyVerified: false,
      claim: 'Authorship separation is declared and content-sealed, not independently proven by Mirror.'
    },
    evaluation: {
      schema: evaluation.schema,
      batchId: evaluation.batchId,
      batchDigest: evaluation.batchDigest,
      modelDigest: evaluation.organ.learnedModelDigest,
      summary: evaluation.summary
    },
    coverage: {
      distinctSourceGroups: new Set(pack.records.map(item => item.sourceGroupId)).size,
      requiredPlanFamilies: REQUIRED_PLAN_FAMILIES,
      observedPlanFamilies: observedPlans,
      missingPlanFamilies: missingPlans,
      fullRequiredPlanCoverage: fullCoverage
    },
    files: [
      { path: 'source-pack.json', bytes: packBytes.length, sha256: digest(packBytes) },
      { path: 'shadow-evaluation-batch.json', bytes: evaluationBytes.length, sha256: digest(evaluationBytes) }
    ],
    state,
    authority: {
      privateEvidenceTraceWrite: true,
      independenceCertification: false,
      trainingAdmission: false,
      automaticRetraining: false,
      thresholdChange: false,
      modelChange: false,
      runtimePromotion: false,
      activeHumanRendering: false,
      worldAction: false
    },
    boundary: 'A pass means one declared-independent, sealed typed-trace pack survived the existing hard verifier and prose-decoy exam with all seven plan families. It is not proof of independent authorship, general language, neutrality, calibration, wisdom, runtime readiness, or permission to train or promote.'
  };
  exam.examDigest = digest(Object.assign({}, exam, { examDigest: null }));
  return { exam, evaluation };
}

function verifyExam(exam, pack, evaluation, runDir, options = {}) {
  if (!exam || exam.schema !== EXAM_SCHEMA || exam.examDigest !== digest(Object.assign({}, exam, { examDigest: null }))) throw new Error('independent language exam digest changed');
  if (!exam.organ || exam.organ.id !== ORGAN_ID || exam.organ.learnedWeights !== false || exam.organ.automaticEvaluation !== false) throw new Error('independent language exam organ boundary changed');
  if (!exam.authority || exam.authority.privateEvidenceTraceWrite !== true || Object.entries(exam.authority).some(([key, value]) => key === 'privateEvidenceTraceWrite' ? value !== true : value !== false)) throw new Error('independent language exam authority changed');
  assertSealedPack(pack, options);
  ShadowEvaluation.verifyBatch(evaluation);
  if (exam.sourcePack.packDigest !== pack.packDigest || exam.evaluation.batchDigest !== evaluation.batchDigest) throw new Error('independent language exam source binding changed');
  if (runDir) {
    const diskExam = JSON.parse(fs.readFileSync(path.join(runDir, 'exam.json'), 'utf8'));
    const diskPack = fs.readFileSync(path.join(runDir, 'source-pack.json'));
    const diskEvaluation = fs.readFileSync(path.join(runDir, 'shadow-evaluation-batch.json'));
    if (JSON.stringify(stable(diskExam)) !== JSON.stringify(stable(exam))) throw new Error('independent language exam file changed');
    for (const [name, bytes] of [['source-pack.json', diskPack], ['shadow-evaluation-batch.json', diskEvaluation]]) {
      const manifest = exam.files.find(item => item.path === name);
      if (!manifest || manifest.bytes !== bytes.length || manifest.sha256 !== digest(bytes)) throw new Error(`independent language exam evidence file changed: ${name}`);
    }
  }
  return true;
}

function run(pack, options = {}) {
  const stateDir = path.resolve(options.stateDir || DEFAULT_STATE_DIR);
  fs.mkdirSync(stateDir, { recursive: true });
  const built = buildExam(pack, options);
  const runDir = path.join(stateDir, built.exam.examId);
  if (fs.existsSync(runDir)) {
    const exam = JSON.parse(fs.readFileSync(path.join(runDir, 'exam.json'), 'utf8'));
    const sourcePack = JSON.parse(fs.readFileSync(path.join(runDir, 'source-pack.json'), 'utf8'));
    const evaluation = JSON.parse(fs.readFileSync(path.join(runDir, 'shadow-evaluation-batch.json'), 'utf8'));
    verifyExam(exam, sourcePack, evaluation, runDir, options);
    if (exam.examDigest !== built.exam.examDigest) throw new Error('independent language exam content-addressed identity collision');
    return { exam, evaluation, runDir, reused: true };
  }
  const stageDir = path.join(stateDir, `.stage-${built.exam.examId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`independent language exam staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'source-pack.json'), json(pack), { flag: 'wx' });
  fs.writeFileSync(path.join(stageDir, 'shadow-evaluation-batch.json'), json(built.evaluation), { flag: 'wx' });
  fs.writeFileSync(path.join(stageDir, 'exam.json'), json(built.exam), { flag: 'wx' });
  verifyExam(built.exam, pack, built.evaluation, stageDir, options);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { exam: built.exam, evaluation: built.evaluation, runDir, reused: commit.reused };
}

module.exports = {
  ORGAN_ID, PACK_SCHEMA, EXAM_SCHEMA, DEFAULT_STATE_DIR, MAX_RECORDS, REQUIRED_PLAN_FAMILIES,
  sealPack, assertSealedPack, evaluationRecords, buildExam, verifyExam, run
};
