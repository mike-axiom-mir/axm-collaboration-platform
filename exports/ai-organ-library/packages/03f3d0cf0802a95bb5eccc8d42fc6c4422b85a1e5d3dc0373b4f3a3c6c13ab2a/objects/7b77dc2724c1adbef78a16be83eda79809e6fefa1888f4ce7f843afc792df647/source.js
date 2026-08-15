'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ImmutableStore = require('../kernel/immutable-batch-store');
const English = require('./english-lesson-stewardship-organ');

const ORGAN_ID = 'axm.mirror.english-behavioral-exam-organ/experimental-v4';
const DRAFT_SCHEMA = 'axm.mirror.english-behavioral-exam-pack-draft/v1';
const PACK_SCHEMA = 'axm.mirror.english-behavioral-exam-pack/v1';
const EXAM_SCHEMA = 'axm.mirror.english-behavioral-exam/v1';
const GAP_SCHEMA = 'axm.mirror.english-curriculum-gap-request/v1';
const MAX_CASES = 64;
const AUTHOR_KINDS = new Set(['HUMAN_STEWARD', 'AI_STEWARD_WITH_HUMAN_DIRECTION', 'INDEPENDENT_EXAM_AUTHOR']);
const RELATIONSHIPS = new Set(['SAME_STEWARD_LOCAL_PROBE', 'OUTSIDE_MODEL_AND_CORPUS_AUTHORING']);
const CAPABILITY_CLASSES = new Set([
  'EXACT_ASSOCIATION_RECALL',
  'NORMALIZATION_INVARIANCE',
  'PARAPHRASE_TRANSFER',
  'SAFE_UNKNOWN_HOLD',
  'CONTRADICTION_DISCRIMINATION'
]);
const RESPONSE_STATES = new Set(['PROPOSED_PRIVATE_SHADOW_GROUNDING', 'HOLD_UNSEEN_ENGLISH_SURFACE']);
const GROUNDING_KINDS = new Set(['EPISTEMIC_STATE', 'REASONING_DIRECTIVE', 'IDENTITY_REFERENCE', 'CONCRETE_FIXTURE']);
const FORBIDDEN_REASONING_KEYS = /^(chain[-_ ]?of[-_ ]?thought|hidden[-_ ]?reasoning|private[-_ ]?reasoning|scratchpad|internal[-_ ]?monologue)$/i;
const FORBIDDEN_FACT_KEYS = /(permission|authority|runtime|canon|tool|execute|worldaction|world_action|write|promote|trainingadmission|training_admission)/i;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function json(value) { return `${JSON.stringify(stable(value), null, 2)}\n`; }
function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(stable(value)));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(expected.slice().sort())) {
    throw new Error(`${label} shape is closed`);
  }
}
function clean(value, maximum, label) {
  const output = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!output || output.length > maximum) throw new Error(`${label} must contain 1 through ${maximum} characters`);
  return output;
}
function boundedId(value, label, maximum = 160) {
  const output = clean(value, maximum, label);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(output)) throw new Error(`${label} must be a bounded machine identifier`);
  return output;
}
function digest64(value, label) {
  const output = String(value || '');
  if (!/^[a-f0-9]{64}$/.test(output)) throw new Error(`${label} must be a sha256 digest`);
  return output;
}
function stringList(value, label, maximum = 32) {
  if (!Array.isArray(value) || value.length > maximum) throw new Error(`${label} must be a bounded array`);
  const output = value.map((item, index) => boundedId(item, `${label}[${index}]`));
  if (new Set(output).size !== output.length) throw new Error(`${label} contains duplicates`);
  return output.sort();
}
function scanForbiddenReasoning(value, trail = ['examPack']) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_REASONING_KEYS.test(key)) throw new Error(`private hidden reasoning field refused at ${trail.concat(key).join('.')}`);
    scanForbiddenReasoning(child, trail.concat(key));
  }
}

function normalizeMachineFacts(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be a finite object`);
  const entries = Object.entries(value);
  if (!entries.length || entries.length > 16) throw new Error(`${label} requires 1 through 16 facts`);
  const output = {};
  for (const [key, raw] of entries.sort(([left], [right]) => left.localeCompare(right))) {
    if (!/^[a-z][a-zA-Z0-9]{0,63}$/.test(key) || FORBIDDEN_FACT_KEYS.test(key)) throw new Error(`${label} key is refused: ${key}`);
    const values = Array.isArray(raw) ? raw : [raw];
    if (!values.length || values.length > 16) throw new Error(`${label}.${key} must be bounded`);
    const normalized = values.map((item, index) => {
      if (typeof item === 'boolean' || Number.isSafeInteger(item)) return item;
      if (typeof item === 'string' && /^[A-Z][A-Z0-9_:/.-]{0,119}$/.test(item)) return item;
      throw new Error(`${label}.${key}[${index}] requires a finite machine token, boolean, or safe integer`);
    });
    output[key] = Array.isArray(raw) ? normalized : normalized[0];
  }
  return output;
}

function normalizeExpected(input, label) {
  exactKeys(input, ['responseState', 'grounding'], label);
  if (!RESPONSE_STATES.has(input.responseState)) throw new Error(`${label}.responseState is unsupported`);
  if (input.responseState === 'HOLD_UNSEEN_ENGLISH_SURFACE') {
    if (input.grounding !== null) throw new Error(`${label}.grounding must be null for an expected hold`);
    return { responseState: input.responseState, grounding: null };
  }
  exactKeys(input.grounding, ['kind', 'conceptId', 'machineFacts'], `${label}.grounding`);
  if (!GROUNDING_KINDS.has(input.grounding.kind)) throw new Error(`${label}.grounding.kind is unsupported`);
  return {
    responseState: input.responseState,
    grounding: {
      kind: input.grounding.kind,
      conceptId: boundedId(input.grounding.conceptId, `${label}.grounding.conceptId`, 120),
      machineFacts: normalizeMachineFacts(input.grounding.machineFacts, `${label}.grounding.machineFacts`)
    }
  };
}

function normalizeCase(input, index) {
  const label = `cases[${index}]`;
  exactKeys(input, ['caseId', 'sourceGroupId', 'capabilityClass', 'english', 'expected', 'evidenceRefs', 'boundary'], label);
  if (!CAPABILITY_CLASSES.has(input.capabilityClass)) throw new Error(`${label}.capabilityClass is unsupported`);
  exactKeys(input.english, ['locale', 'text'], `${label}.english`);
  if (input.english.locale !== 'en') throw new Error(`${label}.english.locale must be en`);
  const english = clean(input.english.text, 500, `${label}.english.text`).normalize('NFKC').replace(/\s+/g, ' ').trim();
  return {
    caseId: boundedId(input.caseId, `${label}.caseId`, 120),
    sourceGroupId: boundedId(input.sourceGroupId, `${label}.sourceGroupId`, 160),
    capabilityClass: input.capabilityClass,
    english: { locale: 'en', text: english },
    expected: normalizeExpected(input.expected, `${label}.expected`),
    evidenceRefs: stringList(input.evidenceRefs, `${label}.evidenceRefs`),
    boundary: clean(input.boundary, 1000, `${label}.boundary`)
  };
}

function normalizeDraft(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('one English behavioral exam pack draft is required');
  scanForbiddenReasoning(input);
  exactKeys(input, ['schema', 'draftId', 'specialistId', 'targetModelDigest', 'usePermission', 'permissionBasis', 'authorship', 'frozenBeforeEvaluation', 'cases', 'boundary'], 'English behavioral exam pack draft');
  if (input.schema !== DRAFT_SCHEMA) throw new Error('English behavioral exam draft schema is unsupported');
  if (input.specialistId !== English.SPECIALIST_ID) throw new Error(`English behavioral exam is isolated to ${English.SPECIALIST_ID}`);
  if (input.usePermission !== 'allowed') throw new Error('English behavioral exam requires usePermission: allowed');
  if (input.frozenBeforeEvaluation !== true) throw new Error('English behavioral exam cases must be frozen before evaluation');
  exactKeys(input.authorship, ['authorId', 'authorKind', 'relationshipToTraining', 'modelOutputsUnavailableDuringAuthorship', 'independentAuthorshipClaim'], 'English behavioral exam authorship');
  if (!AUTHOR_KINDS.has(input.authorship.authorKind)) throw new Error('English behavioral exam authorKind is unsupported');
  if (!RELATIONSHIPS.has(input.authorship.relationshipToTraining)) throw new Error('English behavioral exam relationshipToTraining is unsupported');
  if (typeof input.authorship.modelOutputsUnavailableDuringAuthorship !== 'boolean' || typeof input.authorship.independentAuthorshipClaim !== 'boolean') throw new Error('English behavioral exam authorship claims must be boolean');
  if (input.authorship.independentAuthorshipClaim && (input.authorship.authorKind !== 'INDEPENDENT_EXAM_AUTHOR' || input.authorship.relationshipToTraining !== 'OUTSIDE_MODEL_AND_CORPUS_AUTHORING' || !input.authorship.modelOutputsUnavailableDuringAuthorship)) {
    throw new Error('independent English behavioral exam attestation is incomplete');
  }
  if (!Array.isArray(input.cases) || !input.cases.length || input.cases.length > MAX_CASES) throw new Error(`English behavioral exam requires 1 through ${MAX_CASES} cases`);
  const cases = input.cases.map(normalizeCase).sort((left, right) => left.caseId.localeCompare(right.caseId));
  if (new Set(cases.map(item => item.caseId)).size !== cases.length) throw new Error('English behavioral exam case IDs must be unique');
  if (new Set(cases.map(item => item.sourceGroupId)).size !== cases.length) throw new Error('English behavioral exam source groups must be unique per case');
  return stable({
    schema: DRAFT_SCHEMA,
    draftId: boundedId(input.draftId, 'draftId', 120),
    specialistId: English.SPECIALIST_ID,
    targetModelDigest: digest64(input.targetModelDigest, 'targetModelDigest'),
    usePermission: 'allowed',
    permissionBasis: clean(input.permissionBasis, 1000, 'permissionBasis'),
    authorship: {
      authorId: boundedId(input.authorship.authorId, 'authorship.authorId', 160),
      authorKind: input.authorship.authorKind,
      relationshipToTraining: input.authorship.relationshipToTraining,
      modelOutputsUnavailableDuringAuthorship: input.authorship.modelOutputsUnavailableDuringAuthorship,
      independentAuthorshipClaim: input.authorship.independentAuthorshipClaim
    },
    frozenBeforeEvaluation: true,
    cases,
    boundary: clean(input.boundary, 1600, 'boundary')
  });
}

function packDigestBasis(pack) {
  const basis = clone(pack);
  basis.packDigest = null;
  return basis;
}

function sealPack(input) {
  const draft = normalizeDraft(input);
  const packId = `english-behavioral-pack-${sha256(draft).slice(0, 24)}`;
  const pack = stable({
    schema: PACK_SCHEMA,
    packId,
    packDigest: null,
    draftId: draft.draftId,
    specialistId: draft.specialistId,
    targetModelDigest: draft.targetModelDigest,
    usePermission: draft.usePermission,
    permissionBasis: draft.permissionBasis,
    authorship: draft.authorship,
    frozenBeforeEvaluation: draft.frozenBeforeEvaluation,
    cases: draft.cases,
    boundary: draft.boundary
  });
  pack.packDigest = sha256(packDigestBasis(pack));
  return stable(pack);
}

function assertSealedPack(pack) {
  exactKeys(pack, ['schema', 'packId', 'packDigest', 'draftId', 'specialistId', 'targetModelDigest', 'usePermission', 'permissionBasis', 'authorship', 'frozenBeforeEvaluation', 'cases', 'boundary'], 'sealed English behavioral exam pack');
  if (pack.schema !== PACK_SCHEMA || !/^english-behavioral-pack-[a-f0-9]{24}$/.test(pack.packId || '')) throw new Error('sealed English behavioral exam pack identity is invalid');
  digest64(pack.packDigest, 'packDigest');
  const draft = normalizeDraft({
    schema: DRAFT_SCHEMA,
    draftId: pack.draftId,
    specialistId: pack.specialistId,
    targetModelDigest: pack.targetModelDigest,
    usePermission: pack.usePermission,
    permissionBasis: pack.permissionBasis,
    authorship: pack.authorship,
    frozenBeforeEvaluation: pack.frozenBeforeEvaluation,
    cases: pack.cases,
    boundary: pack.boundary
  });
  const expected = sealPack(draft);
  if (JSON.stringify(stable(expected)) !== JSON.stringify(stable(pack))) throw new Error('sealed English behavioral exam pack digest or canonical content changed');
  return expected;
}

function capabilityId(capabilityClass) {
  return ({
    EXACT_ASSOCIATION_RECALL: 'language.english.exact-association-recall',
    NORMALIZATION_INVARIANCE: 'language.english.normalization-invariance',
    PARAPHRASE_TRANSFER: 'language.english.paraphrase-transfer',
    SAFE_UNKNOWN_HOLD: 'language.english.safe-unknown-hold',
    CONTRADICTION_DISCRIMINATION: 'language.english.contradiction-discrimination'
  })[capabilityClass];
}

function observedGrounding(recalled) {
  return recalled.proposal ? stable({
    kind: recalled.proposal.groundingKind,
    conceptId: recalled.proposal.conceptId,
    machineFacts: recalled.proposal.machineFacts
  }) : null;
}

function assessCase(testCase, model) {
  const recalled = English.recall(model, testCase.english.text);
  const observed = {
    responseState: recalled.state,
    grounding: observedGrounding(recalled),
    responseDigest: sha256({ responseState: recalled.state, grounding: observedGrounding(recalled), modelDigest: recalled.modelDigest }),
    activeRuntime: recalled.authority.activeRuntime,
    factPromotion: recalled.authority.factPromotion
  };
  const passed = observed.responseState === testCase.expected.responseState && sha256(observed.grounding) === sha256(testCase.expected.grounding);
  return stable({
    caseId: testCase.caseId,
    sourceGroupId: testCase.sourceGroupId,
    capabilityClass: testCase.capabilityClass,
    inputDigest: sha256(testCase.english),
    expected: testCase.expected,
    observed,
    verdict: passed ? 'PASS' : 'FAIL'
  });
}

function curriculumGap(result, packDigest) {
  if (result.verdict !== 'FAIL') return null;
  const unexpectedProposal = result.expected.responseState === 'HOLD_UNSEEN_ENGLISH_SURFACE' && result.observed.responseState === 'PROPOSED_PRIVATE_SHADOW_GROUNDING';
  const requestKind = unexpectedProposal
    ? 'REQUEST_SAFETY_BOUNDARY_REVIEW'
    : result.expected.responseState === 'PROPOSED_PRIVATE_SHADOW_GROUNDING' && result.observed.responseState === 'HOLD_UNSEEN_ENGLISH_SURFACE'
      ? 'REQUEST_PERMISSIONED_CONTRASTIVE_LESSON'
      : 'REQUEST_MODEL_BEHAVIOR_REVIEW';
  const basis = { packDigest, caseId: result.caseId, capabilityId: capabilityId(result.capabilityClass), requestKind, observedState: result.observed.responseState };
  return stable({
    schema: GAP_SCHEMA,
    gapId: `english-curriculum-gap-${sha256(basis).slice(0, 24)}`,
    caseId: result.caseId,
    capabilityId: basis.capabilityId,
    requestKind,
    observedState: result.observed.responseState,
    evidenceRef: `${packDigest}:${result.caseId}`,
    answerKeyCopiedIntoRequest: false,
    automaticLessonCreation: false,
    automaticTraining: false,
    trainingAdmissionAuthority: false,
    detail: 'Request a separately permissioned lesson or review; the exam answer key must not become training material.'
  });
}

function examDigestBasis(exam) {
  const basis = clone(exam);
  basis.examDigest = null;
  return basis;
}

function buildExam(packInput, model) {
  const pack = assertSealedPack(packInput);
  English.assertModel(model);
  if (pack.targetModelDigest !== model.modelDigest) throw new Error('English behavioral exam target model digest does not match the supplied model');
  const trainingGroups = new Set(model.lineage.sourceGroupIds || []);
  for (const testCase of pack.cases) if (trainingGroups.has(testCase.sourceGroupId)) throw new Error(`English behavioral exam source group overlaps training lineage: ${testCase.sourceGroupId}`);
  const results = pack.cases.map(testCase => assessCase(testCase, model));
  const gaps = results.map(result => curriculumGap(result, pack.packDigest)).filter(Boolean);
  const byCapability = Array.from(CAPABILITY_CLASSES).sort().map(capabilityClass => {
    const rows = results.filter(item => item.capabilityClass === capabilityClass);
    return {
      capabilityClass,
      capabilityId: capabilityId(capabilityClass),
      cases: rows.length,
      passed: rows.filter(item => item.verdict === 'PASS').length,
      failed: rows.filter(item => item.verdict === 'FAIL').length
    };
  }).filter(item => item.cases > 0);
  const state = gaps.length ? 'KNOWN_FAIL_LOCAL_FROZEN_BEHAVIORAL_GAPS_OBSERVED' : 'TEST_LOCAL_FROZEN_BEHAVIORAL_PROBE_PASSED';
  const idBasis = { organId: ORGAN_ID, packDigest: pack.packDigest, modelDigest: model.modelDigest, results: results.map(item => ({ caseId: item.caseId, responseDigest: item.observed.responseDigest, verdict: item.verdict })) };
  const exam = stable({
    schema: EXAM_SCHEMA,
    examId: `english-behavioral-exam-${sha256(idBasis).slice(0, 24)}`,
    examDigest: null,
    organ: { id: ORGAN_ID, learnedWeights: false, automaticEvaluation: false },
    specialistId: English.SPECIALIST_ID,
    target: {
      modelDigest: model.modelDigest,
      modelStatus: model.status,
      modelArchitecture: model.architecture,
      trainingLessonCount: model.trainingLessonCount,
      activeAssociationCount: model.activeAssociationCount,
      trainingSourceGroupIds: (model.lineage.sourceGroupIds || []).slice().sort()
    },
    sourcePack: {
      packId: pack.packId,
      packDigest: pack.packDigest,
      frozenBeforeEvaluation: pack.frozenBeforeEvaluation,
      authorKind: pack.authorship.authorKind,
      relationshipToTraining: pack.authorship.relationshipToTraining
    },
    independence: {
      sourceDeclaredIndependent: pack.authorship.independentAuthorshipClaim,
      modelOutputsUnavailableDuringAuthorship: pack.authorship.modelOutputsUnavailableDuringAuthorship,
      cryptographicallyProven: false,
      externallyVerified: false,
      eligibleAsLearningImprovementEvidence: false,
      claim: pack.authorship.independentAuthorshipClaim
        ? 'Outside authorship is declared and digest-bound but not independently certified by Mirror.'
        : 'This is a same-steward local frozen probe, not independent learning-improvement evidence.'
    },
    state,
    summary: {
      cases: results.length,
      passed: results.filter(item => item.verdict === 'PASS').length,
      failed: gaps.length,
      curriculumGapsRequested: gaps.length,
      answerKeysAdmittedToTraining: 0,
      modelWrites: 0,
      trainingWrites: 0,
      activeRuntimeLoads: 0,
      parentMirrorWrites: 0,
      worldActions: 0,
      byCapability
    },
    results,
    curriculumGaps: gaps,
    authority: {
      privateExamEvidenceWrite: true,
      answerKeyTrainingAdmission: false,
      automaticLessonCreation: false,
      automaticTraining: false,
      modelChange: false,
      factPromotion: false,
      decisionChange: false,
      permissionGrant: false,
      toolUse: false,
      activeRuntime: false,
      parentMirrorWrite: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    nextGate: gaps.length
      ? 'STEWARD_REVIEW_TYPED_CURRICULUM_GAPS_AND_REQUEST_SEPARATELY_PERMISSIONED_CONTRASTIVE_LESSONS'
      : 'REQUEST_A_SEPARATELY_AUTHORED_UNSEEN_PACK_BEFORE_ANY_TRANSFER_OR_IMPROVEMENT_CLAIM',
    boundary: 'This exam measures deterministic behavior of one exact clone-local model on one frozen pack. It may expose typed curriculum gaps but cannot turn its answer key into training, prove independent learning improvement, general English, semantic understanding, reasoning, truth, neutrality, safety, intelligence, interpreter readiness, runtime compatibility, or CANON.'
  });
  exam.examDigest = sha256(examDigestBasis(exam));
  return stable(exam);
}

function verifyExam(exam, pack, model, runDir) {
  verifyExamEnvelope(exam);
  const rebuilt = buildExam(pack, model);
  if (JSON.stringify(stable(rebuilt)) !== JSON.stringify(stable(exam))) throw new Error('English behavioral exam does not reconstruct from its pack and model');
  if (!exam.organ || exam.organ.id !== ORGAN_ID || exam.organ.learnedWeights !== false || exam.organ.automaticEvaluation !== false) throw new Error('English behavioral exam organ boundary changed');
  if (!exam.authority || exam.authority.privateExamEvidenceWrite !== true || Object.entries(exam.authority).some(([key, value]) => key === 'privateExamEvidenceWrite' ? value !== true : value !== false)) throw new Error('English behavioral exam authority changed');
  if (runDir) {
    const diskPackBytes = fs.readFileSync(path.join(runDir, 'pack.json'), 'utf8');
    const diskReferenceBytes = fs.readFileSync(path.join(runDir, 'model-reference.json'), 'utf8');
    const diskExamBytes = fs.readFileSync(path.join(runDir, 'exam.json'), 'utf8');
    const diskPack = JSON.parse(diskPackBytes);
    const diskReference = JSON.parse(diskReferenceBytes);
    const diskExam = JSON.parse(diskExamBytes);
    if (diskPackBytes !== json(pack) || JSON.stringify(stable(diskPack)) !== JSON.stringify(stable(pack))) throw new Error('English behavioral exam pack file changed');
    if (diskReference.schema !== 'axm.mirror.english-behavioral-model-reference/v1' || diskReference.modelDigest !== model.modelDigest || diskReference.copiedModelBytes !== false) throw new Error('English behavioral exam model reference changed');
    if (diskReferenceBytes !== json({ schema: 'axm.mirror.english-behavioral-model-reference/v1', modelDigest: model.modelDigest, copiedModelBytes: false })) throw new Error('English behavioral exam model reference bytes changed');
    if (diskExamBytes !== json(exam) || JSON.stringify(stable(diskExam)) !== JSON.stringify(stable(exam))) throw new Error('English behavioral exam file changed');
    const gapRoot = path.join(runDir, 'curriculum-gaps');
    if (!fs.existsSync(gapRoot) || !fs.lstatSync(gapRoot).isDirectory() || fs.lstatSync(gapRoot).isSymbolicLink()) throw new Error('English behavioral curriculum gap directory changed');
    const expectedGapFiles = exam.curriculumGaps.map(gap => `${gap.gapId}.json`).sort();
    const actualGapFiles = fs.readdirSync(gapRoot).sort();
    if (JSON.stringify(actualGapFiles) !== JSON.stringify(expectedGapFiles)) throw new Error('English behavioral curriculum gap file set changed');
    for (const gap of exam.curriculumGaps) {
      const bytes = fs.readFileSync(path.join(gapRoot, `${gap.gapId}.json`), 'utf8');
      if (bytes !== json(gap)) throw new Error(`English behavioral curriculum gap file changed: ${gap.gapId}`);
    }
  }
  return true;
}

function verifyExamEnvelope(exam) {
  if (!exam || exam.schema !== EXAM_SCHEMA || !/^english-behavioral-exam-[a-f0-9]{24}$/.test(exam.examId || '')) throw new Error('English behavioral exam identity is invalid');
  if (exam.examDigest !== sha256(examDigestBasis(exam))) throw new Error('English behavioral exam digest changed');
  if (!exam.organ || exam.organ.id !== ORGAN_ID || exam.organ.learnedWeights !== false || exam.organ.automaticEvaluation !== false) throw new Error('English behavioral exam organ boundary changed');
  if (!exam.target || !exam.target.modelArchitecture || !exam.target.modelDigest) throw new Error('English behavioral exam target architecture binding is absent');
  if (!exam.authority || exam.authority.privateExamEvidenceWrite !== true || Object.entries(exam.authority).some(([key, value]) => key === 'privateExamEvidenceWrite' ? value !== true : value !== false)) throw new Error('English behavioral exam authority changed');
  if (!Array.isArray(exam.curriculumGaps) || exam.curriculumGaps.some(gap => gap.schema !== GAP_SCHEMA || gap.answerKeyCopiedIntoRequest !== false || gap.automaticTraining !== false || gap.trainingAdmissionAuthority !== false)) throw new Error('English behavioral curriculum gap boundary changed');
  return true;
}

function run(pack, model, options = {}) {
  if (!options.stateDir) throw new Error('English behavioral exam requires an explicit clone-private stateDir');
  const stateDir = path.resolve(options.stateDir);
  fs.mkdirSync(stateDir, { recursive: true });
  const stat = fs.lstatSync(stateDir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('English behavioral exam stateDir must be a real directory');
  const exam = buildExam(pack, model);
  const runDir = path.join(stateDir, exam.examId);
  if (fs.existsSync(runDir)) {
    const storedPack = JSON.parse(fs.readFileSync(path.join(runDir, 'pack.json'), 'utf8'));
    const storedExam = JSON.parse(fs.readFileSync(path.join(runDir, 'exam.json'), 'utf8'));
    verifyExam(storedExam, storedPack, model, runDir);
    if (storedExam.examDigest !== exam.examDigest) throw new Error('English behavioral exam content-addressed identity collision');
    return { exam: storedExam, runDir, reused: true, writes: 0 };
  }
  const stage = path.join(stateDir, `.stage-${process.pid}-${exam.examId}`);
  if (fs.existsSync(stage)) throw new Error('English behavioral exam staging directory already exists');
  fs.mkdirSync(stage);
  try {
    fs.writeFileSync(path.join(stage, 'pack.json'), json(pack), { encoding: 'utf8', flag: 'wx' });
    fs.writeFileSync(path.join(stage, 'model-reference.json'), json({ schema: 'axm.mirror.english-behavioral-model-reference/v1', modelDigest: model.modelDigest, copiedModelBytes: false }), { encoding: 'utf8', flag: 'wx' });
    fs.writeFileSync(path.join(stage, 'exam.json'), json(exam), { encoding: 'utf8', flag: 'wx' });
    const gapRoot = path.join(stage, 'curriculum-gaps');
    fs.mkdirSync(gapRoot);
    for (const gap of exam.curriculumGaps) fs.writeFileSync(path.join(gapRoot, `${gap.gapId}.json`), json(gap), { encoding: 'utf8', flag: 'wx' });
    verifyExam(exam, pack, model, stage);
    const commit = ImmutableStore.commitDirectory(stage, runDir);
    return { exam, runDir, reused: commit.reused, writes: commit.reused ? 0 : 3 + exam.curriculumGaps.length };
  } catch (error) {
    if (fs.existsSync(stage) && stage.startsWith(stateDir + path.sep) && path.basename(stage).startsWith(`.stage-${process.pid}-`)) fs.rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}

function collectReservedSourceGroupIds(stateDir) {
  const root = path.resolve(stateDir);
  if (!fs.existsSync(root)) return [];
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('English behavioral exam reservation root must be a real directory');
  const groups = new Set();
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name.startsWith('.')) continue;
    if (!entry.isDirectory() || !/^english-behavioral-exam-[a-f0-9]{24}$/.test(entry.name)) throw new Error(`unexpected visible English behavioral exam state entry: ${entry.name}`);
    const runDir = path.join(root, entry.name);
    const pack = assertSealedPack(JSON.parse(fs.readFileSync(path.join(runDir, 'pack.json'), 'utf8')));
    const exam = JSON.parse(fs.readFileSync(path.join(runDir, 'exam.json'), 'utf8'));
    if (exam.schema !== EXAM_SCHEMA || exam.examId !== entry.name || !exam.sourcePack || exam.sourcePack.packDigest !== pack.packDigest) throw new Error(`English behavioral exam reservation binding changed: ${entry.name}`);
    for (const testCase of pack.cases) groups.add(testCase.sourceGroupId);
  }
  return Array.from(groups).sort();
}

module.exports = {
  ORGAN_ID,
  DRAFT_SCHEMA,
  PACK_SCHEMA,
  EXAM_SCHEMA,
  GAP_SCHEMA,
  MAX_CASES,
  CAPABILITY_CLASSES,
  normalizeDraft,
  sealPack,
  assertSealedPack,
  assessCase,
  curriculumGap,
  buildExam,
  verifyExamEnvelope,
  verifyExam,
  run,
  collectReservedSourceGroupIds
};
