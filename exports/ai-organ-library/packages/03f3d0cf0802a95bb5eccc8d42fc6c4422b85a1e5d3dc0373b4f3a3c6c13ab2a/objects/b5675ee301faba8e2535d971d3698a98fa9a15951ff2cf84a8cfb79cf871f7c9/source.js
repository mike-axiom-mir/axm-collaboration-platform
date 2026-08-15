'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ImmutableStore = require('../kernel/immutable-batch-store');
const ReasoningFoundation = require('../kernel/reasoning-foundation');
const NativeTokenizer = require('../learning/native-tokenizer');

const ORGAN_ID = 'axm.mirror.english-lesson-stewardship-organ/experimental-v1';
const LESSON_SCHEMA = 'axm.mirror.english-lesson/v1';
const GROUNDING_SCHEMA = 'axm.mirror.english-grounding/v1';
const MODEL_SCHEMA = 'axm.mirror.private-english-association-model/v1';
const CYCLE_SCHEMA = 'axm.mirror.english-learning-cycle/v1';
const SPECIALIST_ID = 'english-learner-mirror';
const MAX_LESSONS = 512;
const AUTHOR_KINDS = new Set(['HUMAN_STEWARD', 'AI_STEWARD_WITH_HUMAN_DIRECTION', 'INDEPENDENT_EXAM_AUTHOR']);
const ROLES = new Set(['TRAIN', 'HELD_OUT']);
const GROUNDING_KINDS = new Set(['EPISTEMIC_STATE', 'REASONING_DIRECTIVE', 'IDENTITY_REFERENCE', 'CONCRETE_FIXTURE']);
const FORBIDDEN_REASONING_KEYS = /^(chain[-_ ]?of[-_ ]?thought|hidden[-_ ]?reasoning|private[-_ ]?reasoning|scratchpad|internal[-_ ]?monologue)$/i;
const FORBIDDEN_FACT_KEYS = /(permission|authority|runtime|canon|tool|execute|worldaction|world_action|write|promote|trainingadmission|training_admission)/i;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}
function json(value) { return `${JSON.stringify(stable(value), null, 2)}\n`; }
function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(stable(value)));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
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
function boundedId(value, label, maximum = 120) {
  const output = clean(value, maximum, label);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(output)) throw new Error(`${label} must be a bounded machine identifier`);
  return output;
}
function stringList(value, label, maximum = 32) {
  if (!Array.isArray(value) || value.length > maximum) throw new Error(`${label} must be a bounded array`);
  const output = value.map((item, index) => boundedId(item, `${label}[${index}]`, 160));
  if (new Set(output).size !== output.length) throw new Error(`${label} contains duplicates`);
  return output;
}
function scanForbiddenReasoning(value, trail = ['lesson']) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_REASONING_KEYS.test(key)) throw new Error(`private hidden reasoning field refused at ${trail.concat(key).join('.')}`);
    scanForbiddenReasoning(child, trail.concat(key));
  }
}
function normalizeEnglishText(value) {
  return clean(value, 500, 'english.text').normalize('NFKC').replace(/\s+/g, ' ').trim();
}
function associationKey(value) { return normalizeEnglishText(value).toLocaleLowerCase('en-US'); }

function normalizeMachineFacts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('grounding.machineFacts must be a finite object');
  const entries = Object.entries(value);
  if (!entries.length || entries.length > 16) throw new Error('grounding.machineFacts requires 1 through 16 facts');
  const output = {};
  for (const [key, raw] of entries.sort(([left], [right]) => left.localeCompare(right))) {
    if (!/^[a-z][a-zA-Z0-9]{0,63}$/.test(key) || FORBIDDEN_FACT_KEYS.test(key)) throw new Error(`grounding.machineFacts key is refused: ${key}`);
    const values = Array.isArray(raw) ? raw : [raw];
    if (!values.length || values.length > 16) throw new Error(`grounding.machineFacts.${key} must be bounded`);
    const normalized = values.map((item, index) => {
      if (typeof item === 'boolean') return item;
      if (Number.isSafeInteger(item)) return item;
      if (typeof item === 'string' && /^[A-Z][A-Z0-9_:/.-]{0,119}$/.test(item)) return item;
      throw new Error(`grounding.machineFacts.${key}[${index}] requires a finite machine token, boolean, or safe integer`);
    });
    output[key] = Array.isArray(raw) ? normalized : normalized[0];
  }
  return output;
}

function normalizeLesson(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('one English lesson object is required per cycle');
  scanForbiddenReasoning(input);
  exactKeys(input, ['schema', 'lessonId', 'specialistId', 'role', 'source', 'english', 'grounding', 'correction', 'boundary'], 'English lesson');
  if (input.schema !== LESSON_SCHEMA) throw new Error('English lesson schema is unsupported');
  if (input.specialistId !== SPECIALIST_ID) throw new Error(`English lesson is isolated to ${SPECIALIST_ID}`);
  if (!ROLES.has(input.role)) throw new Error('English lesson role must be TRAIN or HELD_OUT');
  exactKeys(input.source, ['sourceId', 'sourceGroupId', 'authorKind', 'authorId', 'usePermission', 'permissionBasis'], 'English lesson source');
  if (!AUTHOR_KINDS.has(input.source.authorKind)) throw new Error('English lesson authorKind is unsupported');
  if (input.source.usePermission !== 'allowed') throw new Error('English lesson requires explicit usePermission: allowed');
  exactKeys(input.english, ['locale', 'text'], 'English surface');
  if (input.english.locale !== 'en') throw new Error('English learner accepts locale en only');
  exactKeys(input.grounding, ['schema', 'kind', 'conceptId', 'machineFacts', 'evidenceRefs'], 'English grounding');
  if (input.grounding.schema !== GROUNDING_SCHEMA) throw new Error('English grounding schema is unsupported');
  if (!GROUNDING_KINDS.has(input.grounding.kind)) throw new Error('English grounding kind is unsupported');
  let correction = null;
  if (input.correction != null) {
    exactKeys(input.correction, ['supersedesLessonDigest', 'reason'], 'English correction');
    if (!/^[a-f0-9]{64}$/.test(input.correction.supersedesLessonDigest || '')) throw new Error('correction requires an exact prior lesson digest');
    correction = {
      supersedesLessonDigest: input.correction.supersedesLessonDigest,
      reason: clean(input.correction.reason, 1000, 'correction.reason')
    };
  }
  const lesson = {
    schema: LESSON_SCHEMA,
    lessonId: boundedId(input.lessonId, 'lessonId'),
    specialistId: SPECIALIST_ID,
    role: input.role,
    source: {
      sourceId: boundedId(input.source.sourceId, 'source.sourceId', 160),
      sourceGroupId: boundedId(input.source.sourceGroupId, 'source.sourceGroupId', 160),
      authorKind: input.source.authorKind,
      authorId: boundedId(input.source.authorId, 'source.authorId', 160),
      usePermission: 'allowed',
      permissionBasis: clean(input.source.permissionBasis, 1000, 'source.permissionBasis')
    },
    english: { locale: 'en', text: normalizeEnglishText(input.english.text) },
    grounding: {
      schema: GROUNDING_SCHEMA,
      kind: input.grounding.kind,
      conceptId: boundedId(input.grounding.conceptId, 'grounding.conceptId', 120),
      machineFacts: normalizeMachineFacts(input.grounding.machineFacts),
      evidenceRefs: stringList(input.grounding.evidenceRefs, 'grounding.evidenceRefs', 32)
    },
    correction,
    boundary: clean(input.boundary, 1600, 'boundary')
  };
  return lesson;
}

function sealLesson(input) {
  const lesson = normalizeLesson(input);
  return { schema: 'axm.mirror.sealed-english-lesson/v1', lessonDigest: sha256(lesson), lesson };
}

function verifyLessonRecord(record) {
  exactKeys(record, ['schema', 'lessonDigest', 'lesson'], 'sealed English lesson');
  if (record.schema !== 'axm.mirror.sealed-english-lesson/v1' || !/^[a-f0-9]{64}$/.test(record.lessonDigest || '')) throw new Error('sealed English lesson identity is invalid');
  const sealed = sealLesson(record.lesson);
  if (sealed.lessonDigest !== record.lessonDigest) throw new Error('sealed English lesson digest mismatch');
  return sealed;
}

function validateHistory(records) {
  if (!Array.isArray(records) || records.length > MAX_LESSONS) throw new Error(`English lesson history is limited to ${MAX_LESSONS} lessons`);
  const verified = records.map(verifyLessonRecord);
  const digests = new Set();
  const ids = new Map();
  const groupRoles = new Map();
  const superseded = new Set();
  for (const record of verified) {
    const lesson = record.lesson;
    if (digests.has(record.lessonDigest)) throw new Error(`duplicate English lesson digest: ${record.lessonDigest}`);
    digests.add(record.lessonDigest);
    const priorId = ids.get(lesson.lessonId);
    if (priorId && priorId !== record.lessonDigest) throw new Error(`lessonId was reused with different content: ${lesson.lessonId}`);
    ids.set(lesson.lessonId, record.lessonDigest);
    const priorRole = groupRoles.get(lesson.source.sourceGroupId);
    if (priorRole && priorRole !== lesson.role) throw new Error(`source group role changed: ${lesson.source.sourceGroupId}`);
    groupRoles.set(lesson.source.sourceGroupId, lesson.role);
    if (lesson.correction) {
      const target = verified.find(item => item.lessonDigest === lesson.correction.supersedesLessonDigest);
      if (!target) throw new Error(`correction target is absent: ${lesson.correction.supersedesLessonDigest}`);
      if (superseded.has(target.lessonDigest)) throw new Error(`correction target was already superseded: ${target.lessonDigest}`);
      if (target.lesson.source.sourceGroupId !== lesson.source.sourceGroupId || target.lesson.source.authorId !== lesson.source.authorId || target.lesson.role !== lesson.role) {
        throw new Error('correction cannot cross author, source-group, or evaluation-role lineage');
      }
      superseded.add(target.lessonDigest);
    }
  }
  return { records: verified, superseded, groupRoles };
}

function sealModel(model) {
  const basis = clone(model);
  delete basis.modelDigest;
  return Object.assign({}, stable(basis), { modelDigest: sha256(basis) });
}

function buildModel(records) {
  const history = validateHistory(records);
  const activeTraining = history.records.filter(record => record.lesson.role === 'TRAIN' && !history.superseded.has(record.lessonDigest));
  const bySurface = new Map();
  for (const record of activeTraining) {
    const key = associationKey(record.lesson.english.text);
    const groundingDigest = sha256(record.lesson.grounding);
    if (!bySurface.has(key)) bySurface.set(key, new Map());
    const byGrounding = bySurface.get(key);
    if (!byGrounding.has(groundingDigest)) byGrounding.set(groundingDigest, []);
    byGrounding.get(groundingDigest).push(record);
  }
  const conflicts = [];
  for (const [surface, groundings] of bySurface.entries()) if (groundings.size > 1) {
    conflicts.push({ normalizedEnglish: surface, groundingDigests: Array.from(groundings.keys()).sort(), lessonDigests: Array.from(groundings.values()).flat().map(item => item.lessonDigest).sort() });
  }
  const tokenizer = activeTraining.length ? NativeTokenizer.train(activeTraining.map(record => record.lesson.english.text), { vocabSize: 512, minFrequency: 2 }) : null;
  const associations = conflicts.length || !tokenizer ? [] : Array.from(bySurface.entries()).map(([surface, groundings]) => {
    const rows = Array.from(groundings.values())[0];
    const grounding = rows[0].lesson.grounding;
    return {
      normalizedEnglish: surface,
      surfaceForms: Array.from(new Set(rows.map(item => item.lesson.english.text))).sort(),
      tokenIds: NativeTokenizer.encode(tokenizer, surface, { bos: true, eos: true }),
      conceptId: grounding.conceptId,
      groundingKind: grounding.kind,
      machineFacts: clone(grounding.machineFacts),
      groundingDigest: sha256(grounding),
      lessonDigests: rows.map(item => item.lessonDigest).sort()
    };
  }).sort((left, right) => left.normalizedEnglish.localeCompare(right.normalizedEnglish));
  return sealModel({
    schema: MODEL_SCHEMA,
    modelDigest: null,
    specialistId: SPECIALIST_ID,
    status: conflicts.length ? 'HOLD_CONTRADICTORY_ACTIVE_TRAINING_ASSOCIATIONS' : activeTraining.length ? 'EXPERIMENTAL_PRIVATE_EXACT_ASSOCIATION_MODEL' : 'EMPTY_NO_TRAINING_LESSONS',
    architecture: 'clone-local-byte-bpe-plus-exact-normalized-surface-to-typed-grounding-associations',
    learnedWeights: activeTraining.length > 0,
    trainingLessonCount: activeTraining.length,
    activeAssociationCount: associations.length,
    heldOutLessonCount: history.records.filter(record => record.lesson.role === 'HELD_OUT' && !history.superseded.has(record.lessonDigest)).length,
    tokenizer,
    associations,
    conflicts,
    lineage: {
      lessonDigests: activeTraining.map(item => item.lessonDigest).sort(),
      sourceGroupIds: Array.from(new Set(activeTraining.map(item => item.lesson.source.sourceGroupId))).sort(),
      inheritedParentCheckpoint: false,
      inheritedParentPrivateMemory: false
    },
    authority: {
      activeRuntime: false,
      factPromotion: false,
      decisionChange: false,
      permissionGrant: false,
      toolUse: false,
      parentMemoryRead: false,
      mirrorWrite: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This clone-local model can recall only exact normalized English surfaces learned from active TRAIN lessons. Its output is a private shadow grounding proposal, not language understanding, truth, permission, reasoning, or runtime authority.'
  });
}

function assertModel(model) {
  if (!model || model.schema !== MODEL_SCHEMA || model.specialistId !== SPECIALIST_ID) throw new Error('private English association model is invalid');
  if (sealModel(model).modelDigest !== model.modelDigest) throw new Error('private English association model digest mismatch');
}

function recall(model, text) {
  assertModel(model);
  const normalizedEnglish = associationKey(text);
  if (model.status !== 'EXPERIMENTAL_PRIVATE_EXACT_ASSOCIATION_MODEL') {
    return { state: 'HOLD_MODEL_NOT_AVAILABLE', normalizedEnglish, proposal: null, modelDigest: model.modelDigest, authority: clone(model.authority) };
  }
  const match = model.associations.find(item => item.normalizedEnglish === normalizedEnglish) || null;
  return {
    state: match ? 'PROPOSED_PRIVATE_SHADOW_GROUNDING' : 'HOLD_UNSEEN_ENGLISH_SURFACE',
    normalizedEnglish,
    tokenIds: NativeTokenizer.encode(model.tokenizer, normalizedEnglish, { bos: true, eos: true }),
    proposal: match ? { conceptId: match.conceptId, groundingKind: match.groundingKind, machineFacts: clone(match.machineFacts), sourceLessonDigests: match.lessonDigests.slice() } : null,
    modelDigest: model.modelDigest,
    claim: match ? 'EXACT_NORMALIZED_SURFACE_ASSOCIATION_RECALLED' : 'NO_ASSOCIATION',
    authority: clone(model.authority),
    boundary: 'A recalled association is a private shadow proposal and cannot promote a fact, decision, permission, identity, or world action.'
  };
}

function foundationGate(lessonRecord, model, options = {}) {
  const conflicts = model.conflicts.length;
  const emptyExam = lessonRecord.lesson.role === 'HELD_OUT' && model.trainingLessonCount === 0;
  const evidence = [
    { id: 'lesson-schema-verified', kind: 'test', status: 'tested', statement: 'The lesson passed the closed English lesson contract.', source: { kind: 'test', id: ORGAN_ID } },
    { id: 'lesson-permission-declared', kind: 'human-assertion', status: 'asserted', statement: 'The lesson declares allowed private research use and preserves its permission basis.', source: { kind: 'lesson-source', id: lessonRecord.lesson.source.sourceId, who: lessonRecord.lesson.source.authorId } },
    { id: 'clone-lineage-isolated', kind: 'rule', status: 'tested', statement: 'The cycle targets only the English learner clone private namespace.', source: { kind: 'contract', id: SPECIALIST_ID } }
  ];
  const unknowns = [];
  if (conflicts) unknowns.push({ id: 'contradictory-active-association', question: 'Which conflicting typed grounding, if either, should remain active?', blocking: true });
  if (emptyExam) unknowns.push({ id: 'exam-without-training-model', question: 'What clone-local model can this held-out lesson examine?', blocking: true });
  const input = {
    schema: 'axm.mirror.reasoning-session/v1',
    requestId: `english-lesson-gate-${lessonRecord.lessonDigest.slice(0, 24)}`,
    actor: { id: SPECIALIST_ID, kind: 'experimental-specialist-clone', displayName: 'English Learner Mirror' },
    goal: 'Preserve one permissioned English lesson without crossing clone, evaluation, or runtime boundaries.',
    evidence,
    unknowns,
    constraints: [
      { id: 'one-lesson', type: 'hard-limit', statement: 'Exactly one lesson may enter this explicit cycle.', actionIds: ['preserve-private-lesson'], hard: true },
      { id: 'shadow-only', type: 'authority-boundary', statement: 'The lesson and model remain private shadow research with no active runtime authority.', actionIds: ['preserve-private-lesson'], hard: true }
    ],
    permissions: ['private-english-lesson-intake'],
    actions: [
      { id: 'preserve-private-lesson', kind: 'proposal', label: 'Preserve the lesson in the isolated clone and update only an eligible private association model.', supportingEvidence: ['lesson-schema-verified', 'lesson-permission-declared', 'clone-lineage-isolated'], preconditionEvidence: ['lesson-schema-verified', 'clone-lineage-isolated'], requiredPermissions: ['private-english-lesson-intake'], risk: 'low', reversible: true, recovery: 'Supersede the lesson explicitly while preserving both versions and restore the earlier current pointer.' },
      { id: 'hold-private-lesson', kind: 'hold', label: 'Preserve a hold and do not update the private association model.', supportingEvidence: ['lesson-schema-verified'], risk: 'low', reversible: true, recovery: 'Supply a corrected permissioned lesson or resolve the typed contradiction.' }
    ],
    pathProfiles: [
      { actionId: 'preserve-private-lesson', approach: 'Apply the closed lesson contract and clone-local association update.', estimatedCost: 'LOW', informationValue: 0.8, reversible: true, requiredEvidence: ['lesson-schema-verified', 'clone-lineage-isolated'], requiredPermissions: ['private-english-lesson-intake'], strategyTags: ['verify-before-commit', 'preserve-lineage'] },
      { actionId: 'hold-private-lesson', approach: 'Retain the unresolved lesson as held evidence without model admission.', estimatedCost: 'LOW', informationValue: 0.5, reversible: true, strategyTags: ['retain-uncertainty'] }
    ]
  };
  const session = ReasoningFoundation.run(input, { at: options.at });
  return {
    inputDigest: sha256(input),
    reasoningSessionId: session.reasoningSessionId,
    sessionDigest: sha256(session),
    selectedActionId: session.pathSet.selectedActionId,
    principleDecision: session.principleTrace.decision.value,
    openSeams: session.seams.filter(item => item.status !== 'CLOSED').map(item => item.id),
    blockingUnknowns: unknowns.map(item => item.id),
    proposalOnly: session.authority.proposalOnly,
    trainingAdmissionAuthority: session.authority.trainingAdmission,
    runtimePromotionAuthority: session.authority.runtimePromotion,
    foundationChangedModel: false
  };
}

function createCycle(input, previousRecords = [], options = {}) {
  const lessonRecord = sealLesson(input);
  const reservedHeldOutSourceGroupIds = stringList(options.reservedHeldOutSourceGroupIds || [], 'reservedHeldOutSourceGroupIds', 4096);
  if (lessonRecord.lesson.role === 'TRAIN' && reservedHeldOutSourceGroupIds.includes(lessonRecord.lesson.source.sourceGroupId)) {
    throw new Error(`source group is reserved by a frozen English behavioral exam and cannot enter TRAIN: ${lessonRecord.lesson.source.sourceGroupId}`);
  }
  const prior = validateHistory(previousRecords);
  if (prior.records.some(item => item.lessonDigest === lessonRecord.lessonDigest)) {
    return { reused: true, status: 'REUSED_IDENTICAL_LESSON_NO_NEW_CYCLE', lessonRecord, model: buildModel(prior.records), cycle: null };
  }
  if (prior.records.length >= MAX_LESSONS) throw new Error(`English lesson history reached ${MAX_LESSONS}; steward archive review is required`);
  const records = prior.records.concat(lessonRecord);
  const model = buildModel(records);
  const gate = foundationGate(lessonRecord, model, options);
  const canUpdate = gate.selectedActionId === 'preserve-private-lesson' && !gate.blockingUnknowns.length && model.status !== 'HOLD_CONTRADICTORY_ACTIVE_TRAINING_ASSOCIATIONS';
  let evaluation = null;
  if (lessonRecord.lesson.role === 'HELD_OUT') {
    const recalled = recall(model, lessonRecord.lesson.english.text);
    evaluation = {
      sourceGroupSeparateFromTraining: !model.lineage.sourceGroupIds.includes(lessonRecord.lesson.source.sourceGroupId),
      authorDeclaredIndependent: lessonRecord.lesson.source.authorKind === 'INDEPENDENT_EXAM_AUTHOR',
      expectedGroundingDigest: sha256(lessonRecord.lesson.grounding),
      proposedGroundingDigest: recalled.proposal ? sha256({ schema: GROUNDING_SCHEMA, kind: recalled.proposal.groundingKind, conceptId: recalled.proposal.conceptId, machineFacts: recalled.proposal.machineFacts, evidenceRefs: lessonRecord.lesson.grounding.evidenceRefs }) : null,
      exactSurfaceMatched: recalled.state === 'PROPOSED_PRIVATE_SHADOW_GROUNDING',
      groundingMatched: recalled.proposal ? recalled.proposal.conceptId === lessonRecord.lesson.grounding.conceptId && sha256(recalled.proposal.machineFacts) === sha256(lessonRecord.lesson.grounding.machineFacts) : false,
      broadLanguageClaim: false,
      independentAuthorshipCertified: false
    };
  }
  const status = !canUpdate ? 'HOLD_ENGLISH_LESSON_NOT_ADMITTED'
    : lessonRecord.lesson.role === 'HELD_OUT'
      ? (evaluation.groundingMatched ? 'TEST_LOCAL_HELD_OUT_EXACT_ASSOCIATION_MATCH' : 'KNOWN_FAIL_LOCAL_HELD_OUT_EXACT_ASSOCIATION_MISS')
      : 'EXPERIMENTAL_PRIVATE_ASSOCIATION_LEARNED_NO_LANGUAGE_EXAM';
  const cycleBasis = {
    schema: CYCLE_SCHEMA,
    cycleId: null,
    cycleDigest: null,
    status,
    specialistId: SPECIALIST_ID,
    createdAt: String(options.at || new Date().toISOString()),
    explicitInvocation: true,
    lessonsAcceptedThisCycle: 1,
    previousCycleDigest: options.previousCycleDigest || null,
    lessonDigest: lessonRecord.lessonDigest,
    historyLessonDigests: records.map(item => item.lessonDigest),
    lessonDisposition: canUpdate ? (lessonRecord.lesson.role === 'TRAIN' ? 'ADMITTED_TO_PRIVATE_CLONE_TRAINING_ONLY' : 'PRESERVED_AS_LOCAL_HELD_OUT_EXAM_ONLY') : 'PRESERVED_AS_HELD_EVIDENCE_NOT_ACTIVE_TRAINING',
    modelDigest: model.modelDigest,
    modelStatus: model.status,
    reasoningGate: gate,
    evaluation,
    metrics: {
      totalLessons: records.length,
      activeTrainingLessons: model.trainingLessonCount,
      heldOutLessons: model.heldOutLessonCount,
      exactAssociations: model.activeAssociationCount,
      contradictorySurfaces: model.conflicts.length,
      inheritedParentCheckpoints: 0,
      inheritedParentPrivateMemories: 0,
      activeRuntimeLoads: 0,
      parentMirrorWrites: 0,
      worldActions: 0
    },
    authority: clone(model.authority),
    nextGate: lessonRecord.lesson.role === 'TRAIN' ? 'ADD_ANOTHER_PERMISSIONED_MACHINE_GROUNDED_ENGLISH_LESSON_OR_SEPARATE_HELD_OUT_EXAM' : 'STEWARD_REVIEW_EXAM_WITHOUT_PROMOTING_RUNTIME',
    boundary: 'One explicit cycle preserves one lesson. Passing means at most an exact clone-local association; it does not prove English understanding, transfer, reasoning, neutrality, truth, safety, intelligence, or runtime readiness.'
  };
  const cycleId = `english-cycle-${sha256(cycleBasis).slice(0, 24)}`;
  cycleBasis.cycleId = cycleId;
  const withoutDigest = clone(cycleBasis);
  delete withoutDigest.cycleDigest;
  const cycle = Object.assign({}, stable(withoutDigest), { cycleDigest: sha256(withoutDigest) });
  return { reused: false, status, lessonRecord, model, cycle };
}

function persistObject(parent, id, filename, value) {
  fs.mkdirSync(parent, { recursive: true });
  const destination = path.join(parent, id);
  const bytes = json(value);
  if (fs.existsSync(destination)) {
    const stored = fs.readFileSync(path.join(destination, filename), 'utf8');
    if (stored !== bytes) throw new Error(`immutable English learning object diverged: ${id}`);
    return { reused: true, directory: destination };
  }
  const stage = path.join(parent, `.stage-${process.pid}-${id}`);
  if (fs.existsSync(stage)) throw new Error('English learning stage already exists');
  fs.mkdirSync(stage);
  fs.writeFileSync(path.join(stage, filename), bytes, { encoding: 'utf8', flag: 'wx' });
  const committed = ImmutableStore.commitDirectory(stage, destination);
  return { reused: committed.reused, directory: destination };
}

function safeTarget(root, relativePath) {
  const target = path.resolve(root, relativePath);
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error('English learning pointer escaped private state');
  return target;
}

function loadState(stateRoot) {
  const root = path.resolve(stateRoot);
  const pointerPath = path.join(root, 'CURRENT.json');
  if (!fs.existsSync(pointerPath)) return { records: [], previousCycleDigest: null, currentCycleId: null };
  const pointer = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));
  exactKeys(pointer, ['schema', 'specialistId', 'cycleId', 'cycleDigest', 'relativePath', 'derivedPointer'], 'English learning current pointer');
  if (pointer.schema !== 'axm.mirror.english-learning-current-pointer/v1' || pointer.specialistId !== SPECIALIST_ID || pointer.derivedPointer !== true) throw new Error('English learning current pointer is invalid');
  const cycle = JSON.parse(fs.readFileSync(safeTarget(root, pointer.relativePath), 'utf8'));
  if (cycle.schema !== CYCLE_SCHEMA || cycle.cycleId !== pointer.cycleId || cycle.cycleDigest !== pointer.cycleDigest) throw new Error('English learning current cycle pointer mismatch');
  const cycleBasis = clone(cycle);
  delete cycleBasis.cycleDigest;
  if (sha256(cycleBasis) !== cycle.cycleDigest) throw new Error('English learning current cycle digest mismatch');
  const records = cycle.historyLessonDigests.map(lessonDigest => {
    if (!/^[a-f0-9]{64}$/.test(lessonDigest)) throw new Error('English learning history digest is invalid');
    return JSON.parse(fs.readFileSync(safeTarget(root, `lessons/${lessonDigest}/lesson.json`), 'utf8'));
  });
  validateHistory(records);
  return { records, previousCycleDigest: cycle.cycleDigest, currentCycleId: cycle.cycleId };
}

function runAndPersist(input, options = {}) {
  if (!options.stateRoot) throw new Error('English learning requires an explicit clone-private stateRoot');
  const root = path.resolve(options.stateRoot);
  fs.mkdirSync(root, { recursive: true });
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('English learning stateRoot must be a real directory');
  const current = loadState(root);
  const result = createCycle(input, current.records, {
    at: options.at,
    previousCycleDigest: current.previousCycleDigest,
    reservedHeldOutSourceGroupIds: options.reservedHeldOutSourceGroupIds || []
  });
  if (result.reused) return { schema: 'axm.mirror.english-learning-persistence-result/v1', status: result.status, specialistId: SPECIALIST_ID, lessonDigest: result.lessonRecord.lessonDigest, currentCycleId: current.currentCycleId, writes: 0, activeRuntimeLoads: 0, parentMirrorWrites: 0 };
  const lessonStored = persistObject(path.join(root, 'lessons'), result.lessonRecord.lessonDigest, 'lesson.json', result.lessonRecord);
  const modelStored = persistObject(path.join(root, 'models'), result.model.modelDigest, 'model.json', result.model);
  const cycleStored = persistObject(path.join(root, 'cycles'), result.cycle.cycleId, 'cycle.json', result.cycle);
  const pointer = {
    schema: 'axm.mirror.english-learning-current-pointer/v1',
    specialistId: SPECIALIST_ID,
    cycleId: result.cycle.cycleId,
    cycleDigest: result.cycle.cycleDigest,
    relativePath: `cycles/${result.cycle.cycleId}/cycle.json`,
    derivedPointer: true
  };
  fs.writeFileSync(path.join(root, 'CURRENT.json'), json(pointer), 'utf8');
  return {
    schema: 'axm.mirror.english-learning-persistence-result/v1',
    status: result.status,
    specialistId: SPECIALIST_ID,
    lessonDigest: result.lessonRecord.lessonDigest,
    cycleId: result.cycle.cycleId,
    cycleDigest: result.cycle.cycleDigest,
    modelDigest: result.model.modelDigest,
    lessonReused: lessonStored.reused,
    modelReused: modelStored.reused,
    cycleReused: cycleStored.reused,
    writes: [lessonStored, modelStored, cycleStored].filter(item => !item.reused).length + 1,
    metrics: result.cycle.metrics,
    nextGate: result.cycle.nextGate,
    activeRuntimeLoads: 0,
    parentMirrorWrites: 0,
    worldActions: 0,
    boundary: result.cycle.boundary
  };
}

module.exports = {
  ORGAN_ID,
  LESSON_SCHEMA,
  GROUNDING_SCHEMA,
  MODEL_SCHEMA,
  CYCLE_SCHEMA,
  SPECIALIST_ID,
  MAX_LESSONS,
  normalizeLesson,
  sealLesson,
  verifyLessonRecord,
  validateHistory,
  buildModel,
  assertModel,
  recall,
  foundationGate,
  createCycle,
  loadState,
  runAndPersist
};
