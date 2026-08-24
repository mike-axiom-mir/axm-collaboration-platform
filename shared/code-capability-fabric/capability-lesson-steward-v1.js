'use strict';

const crypto = require('crypto');
const Json = require('../../tools/deterministic-json-core');
const Catalog = require('./code-specialization-catalog-v1.json');

const VERSION = '1.0.0';
const REQUEST_SCHEMA = 'axm.capability-lesson-candidate-request/v1';
const LESSON_SCHEMA = 'axm.capability-lesson/v1';
const LIBRARY_SCHEMA = 'axm.capability-library-snapshot/v1';
const SUITE_SCHEMA = 'axm.capability-lesson-evaluation-suite/v1';
const ASSESSMENT_SCHEMA = 'axm.capability-lesson-assessment/v1';
const RELEASE_CANDIDATE_SCHEMA = 'axm.capability-library-release-candidate/v1';
const RELEASE_RECEIPT_SCHEMA = 'axm.capability-library-release-receipt/v1';
const SNAPSHOT_SCHEMA = 'axm.capability-lesson-steward-snapshot/v1';
const ROOTS = Object.freeze(['TRUTH', 'AGENCY_NON_DOMINATION', 'CONTINUITY', 'WISDOM_OVER_SPEED']);
const LESSON_KINDS = Object.freeze(Catalog.knowledgePolicy.allowedLessonKinds.slice().sort(compareText));
const FORBIDDEN_DURABLE_CONTENT = Object.freeze(Catalog.knowledgePolicy.forbiddenDurableContent.slice().sort(compareText));
const KNOWLEDGE_LANES = Object.freeze(Catalog.specialistOrgans.map((organ) => organ.knowledgeLane.id).sort(compareText));
const CATALOG_REF = Object.freeze({
  id: Catalog.id,
  schema: Catalog.schema,
  sha256: sha256Value(Catalog),
  byteLength: Buffer.byteLength(Json.canonicalJson(Catalog), 'utf8')
});
const MAXIMUMS = Object.freeze({
  maxSourceRefs: 32,
  maxEvidenceRefs: 64,
  maxEvaluationCases: 128,
  maxLibraryLessons: 256,
  maxLessonBytes: 32768,
  maxReleaseBytes: 262144,
  maxIterations: 1,
  maxNetworkRequests: 0,
  maxChildProcesses: 0
});
const PRIVACY = Object.freeze({
  rawSourceRetained: false,
  rawFailedAttemptsRetained: false,
  stdoutRetained: false,
  stderrRetained: false,
  promptsRetained: false,
  hiddenReasoningRetained: false,
  privateContentRetained: false,
  machinePathsRetained: false,
  secretsRead: false
});
const AUTHORITY = 'NONE';
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const CODE = /^[A-Z0-9][A-Z0-9._-]{1,95}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function compareText(left, right) { return left < right ? -1 : left > right ? 1 : 0; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonical(value) { return Json.canonicalJson(value); }
function same(left, right) { return canonical(left) === canonical(right); }
function sha256Value(value) { return 'sha256:' + crypto.createHash('sha256').update(canonical(value), 'utf8').digest('hex'); }
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  return value;
}
function exact(value, fields, label) {
  object(value, label);
  if (!same(Object.keys(value).sort(compareText), fields.slice().sort(compareText))) throw new Error(label + ' fields are not closed');
}
function identifier(value, label) {
  if (typeof value !== 'string' || !ID.test(value)) throw new Error(label + ' must be a portable identifier');
  return value;
}
function code(value, label) {
  if (typeof value !== 'string' || !CODE.test(value)) throw new Error(label + ' must be an uppercase portable code');
  if (FORBIDDEN_DURABLE_CONTENT.some((token) => value.includes(token))) throw new Error(label + ' names forbidden durable content');
  return value;
}
function digest(value, label) {
  if (typeof value !== 'string' || !DIGEST.test(value)) throw new Error(label + ' must be a lowercase SHA-256 digest');
  return value;
}
function integer(value, label, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(label + ' is outside its integer bound');
  return value;
}
function timestamp(value, label) {
  if (typeof value !== 'string' || !UTC.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new Error(label + ' must be a canonical UTC timestamp');
  return value;
}
function version(value, label) {
  if (typeof value !== 'string' || value.length > 32 || !SEMVER.test(value)) throw new Error(label + ' must be a bounded plain semantic version');
  return value;
}
function uniqueSorted(values, label, normalizer, maximum, minimum = 0) {
  if (!Array.isArray(values) || values.length < minimum || values.length > maximum) throw new Error(label + ' is outside its array bound');
  const normalized = values.map((item, index) => normalizer(item, label + '[' + index + ']')).sort((a, b) => compareText(typeof a === 'string' ? a : canonical(a), typeof b === 'string' ? b : canonical(b)));
  if (new Set(normalized.map((item) => typeof item === 'string' ? item : canonical(item))).size !== normalized.length) throw new Error(label + ' contains duplicates');
  return normalized;
}
function byteReference(value, label) {
  exact(value, ['id', 'schema', 'sha256', 'byteLength'], label);
  if (typeof value.schema !== 'string' || value.schema.length < 3 || value.schema.length > 220) throw new Error(label + '.schema is invalid');
  return {
    id: identifier(value.id, label + '.id'),
    schema: value.schema,
    sha256: digest(value.sha256, label + '.sha256'),
    byteLength: integer(value.byteLength, label + '.byteLength', 1, 67108864)
  };
}
function optionalByteReference(value, label) { return value === null ? null : byteReference(value, label); }
function codeList(values, label, maximum, minimum = 0) { return uniqueSorted(values, label, code, maximum, minimum); }
function idList(values, label, maximum, minimum = 0) { return uniqueSorted(values, label, identifier, maximum, minimum); }
function normalizeRoots(values) {
  if (!Array.isArray(values) || values.length !== ROOTS.length) throw new Error('rootsGate must contain the four ordered roots');
  return values.map((entry, index) => {
    exact(entry, ['root', 'verdict', 'evidenceRefs'], 'rootsGate[' + index + ']');
    if (entry.root !== ROOTS[index] || entry.verdict !== 'PASS') throw new Error('ROOTS_GATE_HOLD:' + ROOTS[index]);
    const evidenceRefs = uniqueSorted(entry.evidenceRefs, 'rootsGate[' + index + '].evidenceRefs', byteReference, 8, 1);
    return { root: entry.root, verdict: 'PASS', evidenceRefs };
  });
}
function normalizeResources(value) {
  exact(value, Object.keys(MAXIMUMS), 'resources');
  const normalized = {};
  for (const [field, maximum] of Object.entries(MAXIMUMS)) {
    const minimum = field === 'maxNetworkRequests' || field === 'maxChildProcesses' ? 0 : 1;
    normalized[field] = integer(value[field], 'resources.' + field, minimum, maximum);
  }
  if (normalized.maxIterations !== 1 || normalized.maxNetworkRequests !== 0 || normalized.maxChildProcesses !== 0) throw new Error('resource authority exceeds the pure one-pass steward');
  return normalized;
}
function normalizeAuthorization(value) {
  exact(value, ['decisionRef', 'scope', 'lessonCandidate', 'releaseCandidate', 'persistentLearning', 'runningAttemptMutation', 'install', 'integrate', 'publish', 'train', 'physicalActuation', 'promote', 'canon', 'authenticatedIdentityProven', 'authority'], 'authorization');
  const expected = {
    decisionRef: byteReference(value.decisionRef, 'authorization.decisionRef'),
    scope: 'CREATE_DETACHED_LESSON_AND_LIBRARY_RELEASE_CANDIDATES_ONLY',
    lessonCandidate: true,
    releaseCandidate: true,
    persistentLearning: false,
    runningAttemptMutation: false,
    install: false,
    integrate: false,
    publish: false,
    train: false,
    physicalActuation: false,
    promote: false,
    canon: false,
    authenticatedIdentityProven: false,
    authority: AUTHORITY
  };
  if (!same(value, expected)) throw new Error('authorization exceeds detached candidate planning');
  return expected;
}
function normalizeApplicability(value) {
  exact(value, ['languageIds', 'familyIds', 'signalCodes'], 'applicability');
  const languageIds = idList(value.languageIds, 'applicability.languageIds', 32);
  const familyIds = idList(value.familyIds, 'applicability.familyIds', 32);
  const signalCodes = codeList(value.signalCodes, 'applicability.signalCodes', 32, 1);
  if (!languageIds.length && !familyIds.length) throw new Error('applicability requires a language or family boundary');
  return { languageIds, familyIds, signalCodes };
}
function normalizeRule(value) {
  exact(value, ['triggerCodes', 'actionCodes', 'expectedOutcomeCodes', 'limitationCodes', 'countertestCodes'], 'rule');
  return {
    triggerCodes: codeList(value.triggerCodes, 'rule.triggerCodes', 32, 1),
    actionCodes: codeList(value.actionCodes, 'rule.actionCodes', 32, 1),
    expectedOutcomeCodes: codeList(value.expectedOutcomeCodes, 'rule.expectedOutcomeCodes', 16, 1),
    limitationCodes: codeList(value.limitationCodes, 'rule.limitationCodes', 32, 1),
    countertestCodes: codeList(value.countertestCodes, 'rule.countertestCodes', 32, 1)
  };
}
function normalizeProvenance(value, kind, resources) {
  exact(value, ['trialObservationRef', 'acceptedArtifactRef', 'sourceRefs'], 'provenance');
  const trialObservationRef = optionalByteReference(value.trialObservationRef, 'provenance.trialObservationRef');
  const acceptedArtifactRef = optionalByteReference(value.acceptedArtifactRef, 'provenance.acceptedArtifactRef');
  const sourceRefs = uniqueSorted(value.sourceRefs, 'provenance.sourceRefs', byteReference, resources.maxSourceRefs, 1);
  if (!trialObservationRef && !acceptedArtifactRef) throw new Error('provenance requires a trial observation or accepted artifact');
  if (kind === 'ACCEPTED_RECIPE' && !acceptedArtifactRef) throw new Error('accepted recipe requires exact accepted artifact lineage');
  return { trialObservationRef, acceptedArtifactRef, sourceRefs };
}
function normalizeEvidence(value, resources) {
  exact(value, ['supportRefs', 'contradictionRefs', 'unknownRefs'], 'evidence');
  const supportRefs = uniqueSorted(value.supportRefs, 'evidence.supportRefs', byteReference, resources.maxEvidenceRefs);
  const contradictionRefs = uniqueSorted(value.contradictionRefs, 'evidence.contradictionRefs', byteReference, resources.maxEvidenceRefs);
  const unknownRefs = uniqueSorted(value.unknownRefs, 'evidence.unknownRefs', byteReference, resources.maxEvidenceRefs);
  const all = [...supportRefs, ...contradictionRefs, ...unknownRefs];
  if (all.length > resources.maxEvidenceRefs || new Set(all.map((item) => item.sha256)).size !== all.length) throw new Error('evidence refs overlap or exceed the shared ceiling');
  return { supportRefs, contradictionRefs, unknownRefs };
}
function refuseLineageAliases(provenance, evidence, rights) {
  const refs = [
    ...provenance.sourceRefs,
    ...evidence.supportRefs,
    ...evidence.contradictionRefs,
    ...evidence.unknownRefs,
    provenance.trialObservationRef,
    provenance.acceptedArtifactRef,
    rights.authorityRef
  ].filter(Boolean);
  if (new Set(refs.map((item) => item.sha256)).size !== refs.length) throw new Error('lesson lineage refs alias bytes across distinct roles');
}
function normalizeRights(value) {
  exact(value, ['state', 'directReuseAllowed', 'authorityRef'], 'rights');
  if (!['DIRECT_REUSE_ALLOWED', 'RESEARCH_ONLY_HOLD'].includes(value.state)) throw new Error('rights state is invalid');
  const authorityRef = optionalByteReference(value.authorityRef, 'rights.authorityRef');
  if ((value.state === 'DIRECT_REUSE_ALLOWED') !== (value.directReuseAllowed === true) || (value.directReuseAllowed && !authorityRef) || (!value.directReuseAllowed && authorityRef)) throw new Error('rights state, direct reuse and authority ref disagree');
  return { state: value.state, directReuseAllowed: value.directReuseAllowed, authorityRef };
}
function normalizeReview(value) {
  exact(value, ['authoredAt', 'reviewAfter', 'expiresAt'], 'review');
  const authoredAt = timestamp(value.authoredAt, 'review.authoredAt');
  const reviewAfter = timestamp(value.reviewAfter, 'review.reviewAfter');
  const expiresAt = timestamp(value.expiresAt, 'review.expiresAt');
  if (!(Date.parse(authoredAt) < Date.parse(reviewAfter) && Date.parse(reviewAfter) <= Date.parse(expiresAt))) throw new Error('lesson review window is invalid');
  return { authoredAt, reviewAfter, expiresAt };
}
function sealMeasured(core, digestField, bytesPath, maximum) {
  const work = clone(core);
  work[bytesPath].recordBytes = 0;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const record = { ...work, [digestField]: sha256Value(work) };
    const recordBytes = Buffer.byteLength(canonical(record), 'utf8');
    if (recordBytes > maximum) throw new Error('emitted record exceeds its byte budget');
    if (recordBytes === work[bytesPath].recordBytes) return record;
    work[bytesPath].recordBytes = recordBytes;
  }
  throw new Error('record byte measurement did not converge');
}
function sealRequest(value) {
  exact(value, ['schema', 'id', 'laneId', 'lessonKind', 'applicability', 'rule', 'provenance', 'evidence', 'rights', 'review', 'rootsGate', 'authorization', 'resources', 'privacy', 'authority'], 'lesson request');
  if (value.schema !== REQUEST_SCHEMA || value.authority !== AUTHORITY) throw new Error('lesson request identity or authority drift');
  const requestId = identifier(value.id, 'request.id');
  identifier(requestId + '-lesson-assessment-release-receipt', 'derived release receipt id');
  const laneId = identifier(value.laneId, 'laneId');
  if (!KNOWLEDGE_LANES.includes(laneId)) throw new Error('unknown code specialization knowledge lane');
  if (!LESSON_KINDS.includes(value.lessonKind)) throw new Error('lesson kind is not allowed by the specialization catalog');
  const resources = normalizeResources(value.resources);
  if (!same(value.privacy, PRIVACY)) throw new Error('lesson privacy declaration drift');
  const provenance = normalizeProvenance(value.provenance, value.lessonKind, resources);
  const evidence = normalizeEvidence(value.evidence, resources);
  const rights = normalizeRights(value.rights);
  refuseLineageAliases(provenance, evidence, rights);
  const core = {
    schema: REQUEST_SCHEMA,
    id: requestId,
    laneId,
    lessonKind: value.lessonKind,
    applicability: normalizeApplicability(value.applicability),
    rule: normalizeRule(value.rule),
    provenance,
    evidence,
    rights,
    review: normalizeReview(value.review),
    rootsGate: normalizeRoots(value.rootsGate),
    authorization: normalizeAuthorization(value.authorization),
    resources,
    privacy: clone(PRIVACY),
    authority: AUTHORITY
  };
  return { ...core, requestDigest: sha256Value(core) };
}
function normalizeRequest(value) {
  exact(value, ['schema', 'id', 'laneId', 'lessonKind', 'applicability', 'rule', 'provenance', 'evidence', 'rights', 'review', 'rootsGate', 'authorization', 'resources', 'privacy', 'authority', 'requestDigest'], 'sealed lesson request');
  const { requestDigest, ...core } = value;
  const sealed = sealRequest(core);
  if (requestDigest !== sealed.requestDigest || !same(value, sealed)) throw new Error('lesson request digest or normalized bytes drifted');
  return sealed;
}
function lessonKey(request) {
  return sha256Value({ laneId: request.laneId, lessonKind: request.lessonKind, applicability: request.applicability, rule: request.rule });
}
function createLesson(requestInput) {
  const request = normalizeRequest(requestInput);
  const id = identifier(request.id + '-lesson', 'lesson.id');
  const lineageRefs = [...request.provenance.sourceRefs, ...request.evidence.supportRefs, ...request.evidence.contradictionRefs, ...request.evidence.unknownRefs];
  if (request.provenance.trialObservationRef) lineageRefs.push(request.provenance.trialObservationRef);
  if (request.provenance.acceptedArtifactRef) lineageRefs.push(request.provenance.acceptedArtifactRef);
  if (request.rights.authorityRef) lineageRefs.push(request.rights.authorityRef);
  const core = {
    schema: LESSON_SCHEMA,
    version: VERSION,
    status: 'PROPOSED',
    id,
    laneId: request.laneId,
    lessonKind: request.lessonKind,
    applicability: clone(request.applicability),
    rule: clone(request.rule),
    provenance: clone(request.provenance),
    evidence: clone(request.evidence),
    rights: clone(request.rights),
    review: clone(request.review),
    rootsGate: clone(request.rootsGate),
    requestRef: { id: request.id, schema: request.schema, sha256: request.requestDigest, byteLength: Buffer.byteLength(canonical(request), 'utf8') },
    knowledgePolicyRef: clone(CATALOG_REF),
    lessonKeyDigest: lessonKey(request),
    resources: { lineageFiles: lineageRefs.length, lineageBytes: lineageRefs.reduce((sum, item) => sum + item.byteLength, 0), recordBytes: 0, enforced: true },
    truth: {
      deterministicBytes: true,
      rawSourceRetained: false,
      rawFailedAttemptsRetained: false,
      stdoutRetained: false,
      stderrRetained: false,
      promptsRetained: false,
      hiddenReasoningRetained: false,
      privateContentRetained: false,
      machinePathsRetained: false,
      contradictionRefsPreserved: true,
      rightsAuthorityReferencePresent: Boolean(request.rights.authorityRef),
      rightsAuthorityIndependentlyVerified: false,
      rewardOrScoreCalculated: false,
      winnerSelected: false,
      runningAttemptMutated: false,
      persistentLearningAdmitted: false,
      installed: false,
      integrated: false,
      published: false,
      promoted: false,
      canonChanged: false,
      mikeFinalMergeGatePreserved: true
    },
    authority: AUTHORITY
  };
  return sealMeasured(core, 'lessonDigest', 'resources', request.resources.maxLessonBytes);
}
function verifyLesson(requestInput, lesson) {
  const rebuilt = createLesson(requestInput);
  if (!same(rebuilt, lesson)) throw new Error('lesson differs from exact deterministic rebuild');
  return rebuilt;
}
function lessonSummary(value, label) {
  exact(value, ['id', 'laneId', 'lessonKind', 'lessonKeyDigest', 'lessonDigest', 'byteLength'], label);
  const laneId = identifier(value.laneId, label + '.laneId');
  if (!KNOWLEDGE_LANES.includes(laneId) || !LESSON_KINDS.includes(value.lessonKind)) throw new Error(label + ' lane or kind is invalid');
  return { id: identifier(value.id, label + '.id'), laneId, lessonKind: value.lessonKind, lessonKeyDigest: digest(value.lessonKeyDigest, label + '.lessonKeyDigest'), lessonDigest: digest(value.lessonDigest, label + '.lessonDigest'), byteLength: integer(value.byteLength, label + '.byteLength', 1, MAXIMUMS.maxLessonBytes) };
}
function summaryFromLesson(lesson) {
  return lessonSummary({ id: lesson.id, laneId: lesson.laneId, lessonKind: lesson.lessonKind, lessonKeyDigest: lesson.lessonKeyDigest, lessonDigest: lesson.lessonDigest, byteLength: lesson.resources.recordBytes }, 'lesson summary');
}
function createLibrarySnapshot(value) {
  exact(value, ['id', 'libraryVersion', 'createdAt', 'lessons', 'authority'], 'library snapshot input');
  if (value.authority !== AUTHORITY) throw new Error('library snapshot authority drift');
  const lessons = uniqueSorted(value.lessons, 'library.lessons', lessonSummary, MAXIMUMS.maxLibraryLessons);
  if (new Set(lessons.map((item) => item.id.toLowerCase())).size !== lessons.length || new Set(lessons.map((item) => item.lessonKeyDigest)).size !== lessons.length) throw new Error('library contains id aliases or semantic lesson duplicates');
  const id = identifier(value.id, 'library.id');
  identifier(id + '-release-' + '0'.repeat(32), 'derived library release id');
  const core = {
    schema: LIBRARY_SCHEMA,
    version: VERSION,
    status: 'REFERENCE_ONLY',
    id,
    libraryVersion: version(value.libraryVersion, 'library.libraryVersion'),
    createdAt: timestamp(value.createdAt, 'library.createdAt'),
    lessons,
    truth: { immutableSnapshot: true, activeRuntimeLibrary: false, runningAttemptMutated: false, persistentLearningAdmitted: false, rollbackAvailable: false, installed: false, promoted: false, canonChanged: false },
    authority: AUTHORITY
  };
  return { ...core, libraryDigest: sha256Value(core) };
}
function normalizeLibrary(value) {
  exact(value, ['schema', 'version', 'status', 'id', 'libraryVersion', 'createdAt', 'lessons', 'truth', 'authority', 'libraryDigest'], 'library snapshot');
  if (value.schema !== LIBRARY_SCHEMA || value.version !== VERSION || value.status !== 'REFERENCE_ONLY') throw new Error('library snapshot identity drift');
  const rebuilt = createLibrarySnapshot({ id: value.id, libraryVersion: value.libraryVersion, createdAt: value.createdAt, lessons: value.lessons, authority: value.authority });
  if (!same(rebuilt, value)) throw new Error('library snapshot differs from deterministic rebuild');
  return rebuilt;
}
function lessonRef(lesson) { return { id: lesson.id, schema: lesson.schema, sha256: lesson.lessonDigest, byteLength: lesson.resources.recordBytes }; }
function libraryRef(library) { return { id: library.id, schema: library.schema, sha256: library.libraryDigest, byteLength: Buffer.byteLength(canonical(library), 'utf8') }; }
function normalizeCase(value, label) {
  exact(value, ['caseId', 'goalRef', 'authoredFromCandidate', 'outcome', 'evidenceRef'], label);
  if (typeof value.authoredFromCandidate !== 'boolean' || !['PASS', 'FAIL', 'UNKNOWN'].includes(value.outcome)) throw new Error(label + ' authorship or outcome is invalid');
  return { caseId: identifier(value.caseId, label + '.caseId'), goalRef: byteReference(value.goalRef, label + '.goalRef'), authoredFromCandidate: value.authoredFromCandidate, outcome: value.outcome, evidenceRef: byteReference(value.evidenceRef, label + '.evidenceRef') };
}
function createEvaluationSuite(value) {
  exact(value, ['id', 'suiteKind', 'candidateRef', 'preparedAt', 'cases', 'authority'], 'evaluation suite input');
  if (!['FIXED_REGRESSION', 'HELD_OUT_GOALS'].includes(value.suiteKind) || value.authority !== AUTHORITY) throw new Error('evaluation suite identity or authority drift');
  const cases = uniqueSorted(value.cases, 'evaluation.cases', normalizeCase, MAXIMUMS.maxEvaluationCases, 2);
  if (new Set(cases.map((item) => item.caseId.toLowerCase())).size !== cases.length) throw new Error('evaluation cases contain aliases');
  if (new Set(cases.map((item) => item.goalRef.sha256)).size !== cases.length) throw new Error('evaluation cases reuse the same goal bytes');
  if (new Set(cases.map((item) => item.evidenceRef.sha256)).size !== cases.length) throw new Error('evaluation cases reuse the same evidence bytes');
  if (cases.some((item) => item.goalRef.sha256 === item.evidenceRef.sha256)) throw new Error('evaluation goal and evidence bytes must be disjoint');
  if (value.suiteKind === 'HELD_OUT_GOALS' && cases.some((item) => item.authoredFromCandidate)) throw new Error('held-out goals cannot be authored from the candidate lesson');
  const core = { schema: SUITE_SCHEMA, version: VERSION, status: 'OBSERVED', id: identifier(value.id, 'suite.id'), suiteKind: value.suiteKind, candidateRef: byteReference(value.candidateRef, 'suite.candidateRef'), preparedAt: timestamp(value.preparedAt, 'suite.preparedAt'), cases, truth: { executionPerformedBySteward: false, outcomesAreSuppliedEvidence: true, scoreCalculated: false, winnerSelected: false, persistentLearningAdmitted: false }, authority: AUTHORITY };
  return { ...core, suiteDigest: sha256Value(core) };
}
function normalizeSuite(value) {
  exact(value, ['schema', 'version', 'status', 'id', 'suiteKind', 'candidateRef', 'preparedAt', 'cases', 'truth', 'authority', 'suiteDigest'], 'evaluation suite');
  if (value.schema !== SUITE_SCHEMA || value.version !== VERSION || value.status !== 'OBSERVED') throw new Error('evaluation suite identity drift');
  const rebuilt = createEvaluationSuite({ id: value.id, suiteKind: value.suiteKind, candidateRef: value.candidateRef, preparedAt: value.preparedAt, cases: value.cases, authority: value.authority });
  if (!same(rebuilt, value)) throw new Error('evaluation suite differs from deterministic rebuild');
  return rebuilt;
}
function suiteRef(suite) { return { id: suite.id, schema: suite.schema, sha256: suite.suiteDigest, byteLength: Buffer.byteLength(canonical(suite), 'utf8') }; }
function assessmentCore({ request, lesson, library, regression, heldOut, evaluatedAt }) {
  const technicalHolds = [];
  if (!lesson.rights.directReuseAllowed) technicalHolds.push('DIRECT_REUSE_RIGHTS_HELD');
  if (!lesson.evidence.supportRefs.length) technicalHolds.push('SUPPORT_EVIDENCE_REQUIRED');
  if (lesson.evidence.contradictionRefs.length) technicalHolds.push('CONTRADICTION_REQUIRES_RESOLUTION');
  if (lesson.evidence.unknownRefs.length) technicalHolds.push('UNKNOWN_EVIDENCE_REQUIRES_RESOLUTION');
  if (Date.parse(evaluatedAt) >= Date.parse(lesson.review.expiresAt)) technicalHolds.push('LESSON_EXPIRED');
  if (Date.parse(library.createdAt) > Date.parse(evaluatedAt)) technicalHolds.push('CURRENT_LIBRARY_TIME_DRIFT');
  if (library.lessons.some((item) => item.lessonKeyDigest === lesson.lessonKeyDigest)) technicalHolds.push('SEMANTIC_DUPLICATE');
  for (const [suite, prefix] of [[regression, 'FIXED_REGRESSION'], [heldOut, 'HELD_OUT']]) {
    if (!same(suite.candidateRef, lessonRef(lesson))) technicalHolds.push(prefix + '_CANDIDATE_BINDING_DRIFT');
    if (Date.parse(suite.preparedAt) < Date.parse(lesson.review.authoredAt) || Date.parse(suite.preparedAt) > Date.parse(evaluatedAt)) technicalHolds.push(prefix + '_TIME_DRIFT');
    if (suite.cases.some((item) => item.outcome === 'FAIL')) technicalHolds.push(prefix + '_FAILURE');
    if (suite.cases.some((item) => item.outcome === 'UNKNOWN')) technicalHolds.push(prefix + '_UNKNOWN');
  }
  const regressionGoals = new Set(regression.cases.map((item) => item.goalRef.sha256));
  const regressionEvidence = new Set(regression.cases.map((item) => item.evidenceRef.sha256));
  if (heldOut.cases.some((item) => regressionGoals.has(item.goalRef.sha256))) technicalHolds.push('HELD_OUT_GOAL_OVERLAP');
  if (heldOut.cases.some((item) => regressionEvidence.has(item.evidenceRef.sha256))) technicalHolds.push('EVALUATION_EVIDENCE_OVERLAP');
  const holds = [...new Set(technicalHolds)].sort(compareText);
  return {
    schema: ASSESSMENT_SCHEMA,
    version: VERSION,
    status: holds.length ? 'TECHNICAL_HOLD' : 'TECHNICAL_PASS_TIER_3_DECISION_REQUIRED',
    id: identifier(lesson.id + '-assessment', 'assessment.id'),
    requestRef: { id: request.id, schema: request.schema, sha256: request.requestDigest, byteLength: Buffer.byteLength(canonical(request), 'utf8') },
    lessonRef: lessonRef(lesson),
    currentLibraryRef: libraryRef(library),
    fixedRegressionRef: suiteRef(regression),
    heldOutGoalsRef: suiteRef(heldOut),
    evaluatedAt,
    technicalHolds: holds,
    nextGate: holds.length ? 'REPAIR_EVIDENCE_OR_LESSON_AND_REASSESS' : 'VERIFY_RIGHTS_AUTHORITY_THEN_AUTHENTICATED_TIER_3_HUMAN_DECISION_AND_SEPARATE_HOST_ADMISSION',
    truth: { exactLessonRebuilt: true, exactLibraryRebuilt: true, fixedRegressionBound: true, heldOutGoalsBound: true, contradictionsPreserved: true, failuresPreserved: true, unknownsPreserved: true, rightsAuthorityIndependentlyVerified: false, scoreCalculated: false, winnerSelected: false, authenticatedTier3DecisionVerified: false, runningAttemptMutated: false, persistentLearningAdmitted: false, installed: false, integrated: false, promoted: false, canonChanged: false, mikeFinalMergeGatePreserved: true },
    authority: AUTHORITY
  };
}
function assess(input) {
  exact(input, ['request', 'lesson', 'currentLibrary', 'fixedRegression', 'heldOutGoals', 'evaluatedAt'], 'assessment input');
  const request = normalizeRequest(input.request);
  const lesson = verifyLesson(request, input.lesson);
  const library = normalizeLibrary(input.currentLibrary);
  const regression = normalizeSuite(input.fixedRegression);
  const heldOut = normalizeSuite(input.heldOutGoals);
  if (regression.suiteKind !== 'FIXED_REGRESSION' || heldOut.suiteKind !== 'HELD_OUT_GOALS') throw new Error('assessment suites are in the wrong roles');
  const evaluatedAt = timestamp(input.evaluatedAt, 'assessment.evaluatedAt');
  const core = assessmentCore({ request, lesson, library, regression, heldOut, evaluatedAt });
  return { ...core, assessmentDigest: sha256Value(core) };
}
function verifyAssessment(value, input) {
  const rebuilt = assess(input);
  if (!same(rebuilt, value)) throw new Error('assessment differs from deterministic rebuild');
  return rebuilt;
}
function nextPatch(current, next) {
  const left = version(current, 'current version').split('.').map(Number);
  const right = version(next, 'next version').split('.').map(Number);
  return left[0] === right[0] && left[1] === right[1] && right[2] === left[2] + 1;
}
function createReleaseCandidate(input) {
  exact(input, ['request', 'lesson', 'currentLibrary', 'fixedRegression', 'heldOutGoals', 'evaluatedAt', 'nextVersion'], 'release input');
  const assessment = assess({ request: input.request, lesson: input.lesson, currentLibrary: input.currentLibrary, fixedRegression: input.fixedRegression, heldOutGoals: input.heldOutGoals, evaluatedAt: input.evaluatedAt });
  const lesson = verifyLesson(input.request, input.lesson);
  const library = normalizeLibrary(input.currentLibrary);
  if (!nextPatch(library.libraryVersion, input.nextVersion)) throw new Error('release candidate version must be the exact next patch');
  let candidate = null;
  if (assessment.status === 'TECHNICAL_PASS_TIER_3_DECISION_REQUIRED') {
    const lessons = [...library.lessons, summaryFromLesson(lesson)].sort((a, b) => compareText(canonical(a), canonical(b)));
    const candidateCore = {
      schema: RELEASE_CANDIDATE_SCHEMA,
      version: VERSION,
      status: 'DETACHED_RELEASE_CANDIDATE',
      id: identifier(library.id + '-release-' + input.nextVersion.replace(/\./g, '-'), 'release candidate.id'),
      libraryId: library.id,
      libraryVersion: version(input.nextVersion, 'nextVersion'),
      createdAt: timestamp(input.evaluatedAt, 'release.createdAt'),
      parentLibraryRef: libraryRef(library),
      rollbackRef: libraryRef(library),
      addedLessonRef: lessonRef(lesson),
      lessons,
      resources: { lessonCount: lessons.length, recordBytes: 0, enforced: true },
      truth: { immutableCandidate: true, parentPreserved: true, rollbackBound: true, activeRuntimeLibrary: false, authenticatedTier3DecisionVerified: false, runningAttemptMutated: false, persistentLearningAdmitted: false, installed: false, integrated: false, published: false, promoted: false, canonChanged: false },
      authority: AUTHORITY
    };
    candidate = sealMeasured(candidateCore, 'releaseCandidateDigest', 'resources', input.request.resources.maxReleaseBytes);
  }
  const receiptCore = {
    schema: RELEASE_RECEIPT_SCHEMA,
    version: VERSION,
    status: candidate ? 'RELEASE_CANDIDATE_READY_FOR_TIER_3_DECISION' : 'RELEASE_HELD',
    id: identifier(assessment.id + '-release-receipt', 'release receipt.id'),
    assessmentRef: { id: assessment.id, schema: assessment.schema, sha256: assessment.assessmentDigest, byteLength: Buffer.byteLength(canonical(assessment), 'utf8') },
    lessonRef: lessonRef(lesson),
    parentLibraryRef: libraryRef(library),
    releaseCandidateRef: candidate ? { id: candidate.id, schema: candidate.schema, sha256: candidate.releaseCandidateDigest, byteLength: candidate.resources.recordBytes } : null,
    technicalHolds: assessment.technicalHolds.slice(),
    nextGate: assessment.nextGate,
    truth: { releaseCandidateCreated: Boolean(candidate), currentLibraryMutated: false, authenticatedTier3DecisionVerified: false, persistentLearningAdmitted: false, runningAttemptMutated: false, installed: false, integrated: false, published: false, promoted: false, canonChanged: false, mikeFinalMergeGatePreserved: true },
    authority: AUTHORITY
  };
  return { assessment, releaseCandidate: candidate, receipt: { ...receiptCore, receiptDigest: sha256Value(receiptCore) } };
}
function snapshot() {
  const core = { schema: SNAPSHOT_SCHEMA, version: VERSION, status: 'TEST', knowledgePolicyRef: clone(CATALOG_REF), supportedLessonKinds: LESSON_KINDS.slice(), knowledgeLanes: KNOWLEDGE_LANES.slice(), forbiddenDurableContent: FORBIDDEN_DURABLE_CONTENT.slice(), capability: 'EVIDENCE_BOUND_LESSON_AND_DETACHED_RELEASE_CANDIDATES', rightsAuthorityAssurance: 'REFERENCE_BOUND_NOT_INDEPENDENTLY_VERIFIED', persistentAdmission: 'HELD_FOR_RIGHTS_VERIFICATION_AUTHENTICATED_TIER_3_DECISION_AND_SEPARATE_HOST', rewardOrIncentiveLoop: false, authority: AUTHORITY };
  return { ...core, snapshotDigest: sha256Value(core) };
}

module.exports = Object.freeze({
  VERSION,
  REQUEST_SCHEMA,
  LESSON_SCHEMA,
  LIBRARY_SCHEMA,
  SUITE_SCHEMA,
  ASSESSMENT_SCHEMA,
  RELEASE_CANDIDATE_SCHEMA,
  RELEASE_RECEIPT_SCHEMA,
  SNAPSHOT_SCHEMA,
  ROOTS,
  LESSON_KINDS,
  FORBIDDEN_DURABLE_CONTENT,
  KNOWLEDGE_LANES,
  CATALOG_REF,
  MAXIMUMS,
  PRIVACY,
  sealRequest,
  normalizeRequest,
  createLesson,
  verifyLesson,
  createLibrarySnapshot,
  createEvaluationSuite,
  assess,
  verifyAssessment,
  createReleaseCandidate,
  snapshot
});
