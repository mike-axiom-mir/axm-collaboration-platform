'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Json = require('../../tools/deterministic-json-core');
const Steward = require('./capability-lesson-steward-v1');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('PASS ' + name);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function hash(value) { return 'sha256:' + crypto.createHash('sha256').update(Json.canonicalJson(value), 'utf8').digest('hex'); }
function ref(id, schema, seed, byteLength = 128) {
  return { id, schema, sha256: hash({ seed }), byteLength };
}
function roots() {
  return Steward.ROOTS.map((root) => ({ root, verdict: 'PASS', evidenceRefs: [ref('root-' + root.toLowerCase().replace(/_/g, '-'), 'axm.four-root-technical-review/v1', root)] }));
}
function requestInput(overrides = {}) {
  const base = {
    schema: Steward.REQUEST_SCHEMA,
    id: 'parser-boundary-neighbor-lesson-01',
    laneId: 'knowledge.code.application-logic',
    lessonKind: 'ACCEPTED_RECIPE',
    applicability: { languageIds: ['rust'], familyIds: ['systems'], signalCodes: ['PARSER_BOUNDARY_AMBIGUOUS'] },
    rule: {
      triggerCodes: ['DETERMINISTIC_BOUNDARY_UNPROBED'],
      actionCodes: ['PROBE_BELOW_AT_ABOVE_BOUNDARY'],
      expectedOutcomeCodes: ['BOUNDARY_EVIDENCE_COMPLETE'],
      limitationCodes: ['STATIC_RULE_ONLY', 'RUNTIME_GENERALIZATION_UNPROVEN'],
      countertestCodes: ['MISSING_BOUNDARY_NEIGHBOR', 'STABLE_BOUNDARY_CASE']
    },
    provenance: {
      trialObservationRef: ref('parser-boundary-trial-observation', 'axm.code.creation-reasoning-trial-observation.v1', 'trial'),
      acceptedArtifactRef: ref('accepted-parser-repair', 'axm.human-accepted-artifact/v1', 'accepted'),
      sourceRefs: [ref('parser-repair-source', 'axm.byte-bound-source-observation/v1', 'source', 512)]
    },
    evidence: {
      supportRefs: [ref('boundary-support-a', 'axm.test-observation/v1', 'support-a'), ref('boundary-support-b', 'axm.test-observation/v1', 'support-b')],
      contradictionRefs: [],
      unknownRefs: []
    },
    rights: { state: 'DIRECT_REUSE_ALLOWED', directReuseAllowed: true, authorityRef: ref('public-domain-authority', 'axm.reuse-rights-authority/v1', 'rights') },
    review: { authoredAt: '2026-08-24T12:00:00.000Z', reviewAfter: '2026-09-24T12:00:00.000Z', expiresAt: '2027-08-24T12:00:00.000Z' },
    rootsGate: roots(),
    authorization: {
      decisionRef: ref('mike-lesson-candidate-direction', 'axm.explicit-human-direction/v1', 'direction'),
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
      authority: 'NONE'
    },
    resources: clone(Steward.MAXIMUMS),
    privacy: clone(Steward.PRIVACY),
    authority: 'NONE'
  };
  return { ...base, ...overrides };
}
function candidateRef(lesson) { return { id: lesson.id, schema: lesson.schema, sha256: lesson.lessonDigest, byteLength: lesson.resources.recordBytes }; }
function suiteInput(lesson, suiteKind, outcomes = ['PASS', 'PASS'], overrides = {}) {
  return {
    id: lesson.id + '-' + suiteKind.toLowerCase().replace(/_/g, '-'),
    suiteKind,
    candidateRef: candidateRef(lesson),
    preparedAt: '2026-08-25T12:00:00.000Z',
    cases: outcomes.map((outcome, index) => ({
      caseId: suiteKind.toLowerCase().replace(/_/g, '-') + '-case-' + (index + 1),
      goalRef: ref('goal-' + suiteKind.toLowerCase().replace(/_/g, '-') + '-' + (index + 1), 'axm.evaluation-goal/v1', suiteKind + '-goal-' + index),
      authoredFromCandidate: false,
      outcome,
      evidenceRef: ref('evidence-' + suiteKind.toLowerCase().replace(/_/g, '-') + '-' + (index + 1), 'axm.test-observation/v1', suiteKind + '-evidence-' + index)
    })),
    authority: 'NONE',
    ...overrides
  };
}
function lessonSummary(lesson) {
  return { id: lesson.id, laneId: lesson.laneId, lessonKind: lesson.lessonKind, lessonKeyDigest: lesson.lessonKeyDigest, lessonDigest: lesson.lessonDigest, byteLength: lesson.resources.recordBytes };
}
function assessmentInput(parts) {
  return { request: parts.request, lesson: parts.lesson, currentLibrary: parts.library, fixedRegression: parts.regression, heldOutGoals: parts.heldOut, evaluatedAt: '2026-08-26T12:00:00.000Z' };
}
function buildReady() {
  const request = Steward.sealRequest(requestInput());
  const lesson = Steward.createLesson(request);
  const library = Steward.createLibrarySnapshot({ id: 'code-capability-library', libraryVersion: '0.0.0', createdAt: '2026-08-24T00:00:00.000Z', lessons: [], authority: 'NONE' });
  const regression = Steward.createEvaluationSuite(suiteInput(lesson, 'FIXED_REGRESSION'));
  const heldOut = Steward.createEvaluationSuite(suiteInput(lesson, 'HELD_OUT_GOALS'));
  return { request, lesson, library, regression, heldOut };
}

const ready = buildReady();

const SCHEMAS = [
  ['capability-lesson-candidate-request.schema.json', Steward.REQUEST_SCHEMA],
  ['capability-lesson.schema.json', Steward.LESSON_SCHEMA],
  ['capability-library-snapshot.schema.json', Steward.LIBRARY_SCHEMA],
  ['capability-lesson-evaluation-suite.schema.json', Steward.SUITE_SCHEMA],
  ['capability-lesson-assessment.schema.json', Steward.ASSESSMENT_SCHEMA],
  ['capability-library-release-candidate.schema.json', Steward.RELEASE_CANDIDATE_SCHEMA],
  ['capability-library-release-receipt.schema.json', Steward.RELEASE_RECEIPT_SCHEMA],
  ['capability-lesson-steward-snapshot.schema.json', Steward.SNAPSHOT_SCHEMA]
];
function assertClosedSchemaObjects(value, location = '$') {
  if (!value || typeof value !== 'object') return;
  if (value.type === 'object') assert.strictEqual(value.additionalProperties, false, location + ' must close object fields');
  for (const [key, child] of Object.entries(value)) assertClosedSchemaObjects(child, location + '.' + key);
}

test('specialization catalog exposes fourteen bounded knowledge lanes', () => assert.strictEqual(Steward.KNOWLEDGE_LANES.length, 14));
test('all emitted record schemas exist with exact identities and closed object nodes', () => {
  for (const [file, id] of SCHEMAS) {
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
    assert.strictEqual(schema.$id, id);
    assertClosedSchemaObjects(schema, file);
  }
});
test('shared lesson schema definitions exist and close every object node', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'capability-lesson-common.schema.json'), 'utf8'));
  assert.strictEqual(schema.$id, 'axm.capability-lesson-common/v1');
  assertClosedSchemaObjects(schema, 'capability-lesson-common.schema.json');
});
test('lesson kinds exactly reuse the specialization knowledge policy', () => assert.deepStrictEqual(Steward.LESSON_KINDS, ['ACCEPTED_RECIPE', 'COUNTERTEST', 'PRIVACY_SAFE_FAILURE_RULE', 'TEST']));
test('forbidden durable lesson content is inherited from the specialization catalog', () => assert(Steward.FORBIDDEN_DURABLE_CONTENT.includes('RAW_SOURCE') && Steward.FORBIDDEN_DURABLE_CONTENT.includes('HIDDEN_REASONING')));
test('sealed lesson request is byte deterministic', () => assert.deepStrictEqual(Steward.sealRequest(requestInput()), ready.request));
test('lesson is byte deterministic', () => assert.deepStrictEqual(Steward.createLesson(ready.request), ready.lesson));
test('lesson verifies through exact independent rebuild', () => assert.deepStrictEqual(Steward.verifyLesson(ready.request, ready.lesson), ready.lesson));
test('lesson binds the exact specialization knowledge policy', () => assert.deepStrictEqual(ready.lesson.knowledgePolicyRef, Steward.CATALOG_REF));
test('lesson lineage is byte counted and bounded', () => assert(ready.lesson.resources.lineageFiles === 6 && ready.lesson.resources.lineageBytes > 0 && ready.lesson.resources.recordBytes <= ready.request.resources.maxLessonBytes));
test('lesson retains no private source or process output', () => assert.strictEqual(Object.values(Steward.PRIVACY).every((value) => value === false), true));
test('lesson calculates no reward, score, rank or winner', () => assert.strictEqual(ready.lesson.truth.rewardOrScoreCalculated || ready.lesson.truth.winnerSelected, false));
test('lesson cannot mutate a running attempt or admit persistent learning', () => assert.strictEqual(ready.lesson.truth.runningAttemptMutated || ready.lesson.truth.persistentLearningAdmitted, false));
test('empty library snapshot is immutable reference data', () => assert.strictEqual(ready.library.truth.immutableSnapshot && !ready.library.truth.activeRuntimeLibrary, true));
test('fixed regression suite is deterministic', () => assert.deepStrictEqual(Steward.createEvaluationSuite(suiteInput(ready.lesson, 'FIXED_REGRESSION')), ready.regression));
test('held-out suite is deterministic', () => assert.deepStrictEqual(Steward.createEvaluationSuite(suiteInput(ready.lesson, 'HELD_OUT_GOALS')), ready.heldOut));

const assessment = Steward.assess(assessmentInput(ready));
test('complete evidence reaches technical pass only', () => assert.strictEqual(assessment.status, 'TECHNICAL_PASS_TIER_3_DECISION_REQUIRED'));
test('technical pass still requires rights verification and authenticated Tier 3 human decision', () => assert.strictEqual(assessment.nextGate, 'VERIFY_RIGHTS_AUTHORITY_THEN_AUTHENTICATED_TIER_3_HUMAN_DECISION_AND_SEPARATE_HOST_ADMISSION'));
test('technical pass verifies by exact rebuild', () => assert.deepStrictEqual(Steward.verifyAssessment(assessment, assessmentInput(ready)), assessment));
test('technical assessment admits no persistent learning', () => assert.strictEqual(assessment.truth.persistentLearningAdmitted, false));
test('rights authority is byte-bound but not claimed independently verified', () => assert.strictEqual(ready.lesson.truth.rightsAuthorityReferencePresent && !assessment.truth.rightsAuthorityIndependentlyVerified, true));

const release = Steward.createReleaseCandidate({ ...assessmentInput(ready), nextVersion: '0.0.1' });
test('emitted records match the exact top-level fields declared by their schemas', () => {
  const records = [
    ['capability-lesson-candidate-request.schema.json', ready.request],
    ['capability-lesson.schema.json', ready.lesson],
    ['capability-library-snapshot.schema.json', ready.library],
    ['capability-lesson-evaluation-suite.schema.json', ready.regression],
    ['capability-lesson-assessment.schema.json', assessment],
    ['capability-library-release-candidate.schema.json', release.releaseCandidate],
    ['capability-library-release-receipt.schema.json', release.receipt],
    ['capability-lesson-steward-snapshot.schema.json', Steward.snapshot()]
  ];
  for (const [file, record] of records) {
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
    assert.deepStrictEqual(Object.keys(record).sort(), schema.required.slice().sort(), file + ' top-level field drift');
    assert.strictEqual(record.schema, schema.$id, file + ' identity drift');
    assert.strictEqual(schema.properties.schema.const, record.schema, file + ' schema const drift');
  }
});
test('technical pass emits one detached release candidate', () => assert.strictEqual(release.receipt.status, 'RELEASE_CANDIDATE_READY_FOR_TIER_3_DECISION'));
test('release candidate is the exact next patch version', () => assert.strictEqual(release.releaseCandidate.libraryVersion, '0.0.1'));
test('release candidate retains parent and rollback references', () => assert.deepStrictEqual(release.releaseCandidate.parentLibraryRef, release.releaseCandidate.rollbackRef));
test('release candidate contains the new lesson and preserves the empty parent', () => assert.deepStrictEqual(release.releaseCandidate.lessons, [lessonSummary(ready.lesson)]));
test('release candidate remains inactive and uninstalled', () => assert.strictEqual(release.releaseCandidate.truth.activeRuntimeLibrary || release.releaseCandidate.truth.installed, false));
test('release receipt grants no admission, integration, promotion or CANON authority', () => assert.strictEqual(release.receipt.truth.persistentLearningAdmitted || release.receipt.truth.integrated || release.receipt.truth.promoted || release.receipt.truth.canonChanged, false));

test('unknown request fields are refused', () => assert.throws(() => Steward.sealRequest({ ...requestInput(), reward: 100 }), /fields are not closed/));
test('request ids that overflow derived receipt ids are refused before emission', () => assert.throws(() => Steward.sealRequest(requestInput({ id: 'a'.repeat(95) })), /derived release receipt id/));
test('a root HOLD stops lesson formation', () => { const value = requestInput(); value.rootsGate[0].verdict = 'HOLD'; assert.throws(() => Steward.sealRequest(value), /ROOTS_GATE_HOLD/); });
test('root order drift is refused', () => { const value = requestInput(); value.rootsGate.reverse(); assert.throws(() => Steward.sealRequest(value), /ROOTS_GATE_HOLD/); });
test('unknown specialization lane is refused', () => assert.throws(() => Steward.sealRequest(requestInput({ laneId: 'knowledge.code.imaginary' })), /unknown code specialization/));
test('unknown lesson kind is refused', () => assert.throws(() => Steward.sealRequest(requestInput({ lessonKind: 'SELF_REWARD' })), /lesson kind is not allowed/));
test('forbidden raw source code cannot enter a lesson rule', () => { const value = requestInput(); value.rule.actionCodes = ['RAW_SOURCE']; assert.throws(() => Steward.sealRequest(value), /forbidden durable content/); });
test('forbidden durable content cannot hide inside a longer rule code', () => { const value = requestInput(); value.rule.actionCodes = ['COPY_RAW_SOURCE_BYTES']; assert.throws(() => Steward.sealRequest(value), /forbidden durable content/); });
test('private content fields cannot be smuggled into provenance', () => { const value = requestInput(); value.provenance.rawPrompt = 'private'; assert.throws(() => Steward.sealRequest(value), /fields are not closed/); });
test('permission or lifecycle expansion is refused', () => { const value = requestInput(); value.authorization.persistentLearning = true; assert.throws(() => Steward.sealRequest(value), /authorization exceeds/); });
test('network or process budget expansion is refused', () => { const value = requestInput(); value.resources.maxNetworkRequests = 1; assert.throws(() => Steward.sealRequest(value), /outside its integer bound|resource authority/); });
test('lesson byte budget is enforced against the emitted record', () => { const value = requestInput(); value.resources.maxLessonBytes = 128; const request = Steward.sealRequest(value); assert.throws(() => Steward.createLesson(request), /byte budget/); });
test('accepted recipe requires an exact accepted artifact', () => { const value = requestInput(); value.provenance.acceptedArtifactRef = null; assert.throws(() => Steward.sealRequest(value), /accepted recipe requires/); });
test('overlapping evidence refs are refused', () => { const value = requestInput(); value.evidence.contradictionRefs = [clone(value.evidence.supportRefs[0])]; assert.throws(() => Steward.sealRequest(value), /overlap/); });
test('cross-role lineage aliases are refused', () => { const value = requestInput(); value.evidence.supportRefs[0] = clone(value.provenance.sourceRefs[0]); assert.throws(() => Steward.sealRequest(value), /alias bytes/); });

test('rehashed lesson lifecycle forgery fails exact rebuild', () => {
  const forged = clone(ready.lesson);
  forged.truth.persistentLearningAdmitted = true;
  const core = clone(forged); delete core.lessonDigest;
  forged.lessonDigest = hash(core);
  assert.throws(() => Steward.verifyLesson(ready.request, forged), /differs from exact deterministic rebuild/);
});
test('source byte-length drift invalidates the old lesson', () => {
  const value = requestInput(); value.provenance.sourceRefs[0].byteLength += 1;
  const changedRequest = Steward.sealRequest(value);
  assert.throws(() => Steward.verifyLesson(changedRequest, ready.lesson), /differs from exact deterministic rebuild/);
});

test('research-only rights produce a technical hold', () => {
  const value = requestInput(); value.rights = { state: 'RESEARCH_ONLY_HOLD', directReuseAllowed: false, authorityRef: null };
  const request = Steward.sealRequest(value); const lesson = Steward.createLesson(request);
  const regression = Steward.createEvaluationSuite(suiteInput(lesson, 'FIXED_REGRESSION'));
  const heldOut = Steward.createEvaluationSuite(suiteInput(lesson, 'HELD_OUT_GOALS'));
  const held = Steward.assess({ request, lesson, currentLibrary: ready.library, fixedRegression: regression, heldOutGoals: heldOut, evaluatedAt: '2026-08-26T12:00:00.000Z' });
  assert(held.technicalHolds.includes('DIRECT_REUSE_RIGHTS_HELD'));
});
test('missing support evidence produces a technical hold', () => {
  const value = requestInput(); value.evidence.supportRefs = [];
  const request = Steward.sealRequest(value); const lesson = Steward.createLesson(request);
  const regression = Steward.createEvaluationSuite(suiteInput(lesson, 'FIXED_REGRESSION'));
  const heldOut = Steward.createEvaluationSuite(suiteInput(lesson, 'HELD_OUT_GOALS'));
  assert(Steward.assess({ request, lesson, currentLibrary: ready.library, fixedRegression: regression, heldOutGoals: heldOut, evaluatedAt: '2026-08-26T12:00:00.000Z' }).technicalHolds.includes('SUPPORT_EVIDENCE_REQUIRED'));
});
test('contradictory evidence remains visible and holds admission', () => {
  const value = requestInput(); value.evidence.contradictionRefs = [ref('boundary-contradiction', 'axm.test-observation/v1', 'contradiction')];
  const request = Steward.sealRequest(value); const lesson = Steward.createLesson(request);
  const regression = Steward.createEvaluationSuite(suiteInput(lesson, 'FIXED_REGRESSION'));
  const heldOut = Steward.createEvaluationSuite(suiteInput(lesson, 'HELD_OUT_GOALS'));
  const held = Steward.assess({ request, lesson, currentLibrary: ready.library, fixedRegression: regression, heldOutGoals: heldOut, evaluatedAt: '2026-08-26T12:00:00.000Z' });
  assert(held.technicalHolds.includes('CONTRADICTION_REQUIRES_RESOLUTION') && lesson.evidence.contradictionRefs.length === 1);
});
test('unknown evidence remains visible and holds admission', () => {
  const value = requestInput(); value.evidence.unknownRefs = [ref('boundary-unknown', 'axm.test-observation/v1', 'unknown')];
  const request = Steward.sealRequest(value); const lesson = Steward.createLesson(request);
  const regression = Steward.createEvaluationSuite(suiteInput(lesson, 'FIXED_REGRESSION'));
  const heldOut = Steward.createEvaluationSuite(suiteInput(lesson, 'HELD_OUT_GOALS'));
  assert(Steward.assess({ request, lesson, currentLibrary: ready.library, fixedRegression: regression, heldOutGoals: heldOut, evaluatedAt: '2026-08-26T12:00:00.000Z' }).technicalHolds.includes('UNKNOWN_EVIDENCE_REQUIRES_RESOLUTION'));
});
test('fixed regression failure is preserved as a hold', () => {
  const regression = Steward.createEvaluationSuite(suiteInput(ready.lesson, 'FIXED_REGRESSION', ['PASS', 'FAIL']));
  assert(Steward.assess({ ...assessmentInput(ready), fixedRegression: regression }).technicalHolds.includes('FIXED_REGRESSION_FAILURE'));
});
test('held-out unknown is preserved as a hold', () => {
  const heldOut = Steward.createEvaluationSuite(suiteInput(ready.lesson, 'HELD_OUT_GOALS', ['PASS', 'UNKNOWN']));
  assert(Steward.assess({ ...assessmentInput(ready), heldOutGoals: heldOut }).technicalHolds.includes('HELD_OUT_UNKNOWN'));
});
test('candidate-authored held-out goals are refused', () => {
  const value = suiteInput(ready.lesson, 'HELD_OUT_GOALS'); value.cases[0].authoredFromCandidate = true;
  assert.throws(() => Steward.createEvaluationSuite(value), /cannot be authored/);
});
test('undersized evaluation suites are refused', () => assert.throws(() => Steward.createEvaluationSuite(suiteInput(ready.lesson, 'HELD_OUT_GOALS', ['PASS'])), /outside its array bound/));
test('stale pre-candidate evaluation evidence produces a time hold', () => {
  const regression = Steward.createEvaluationSuite(suiteInput(ready.lesson, 'FIXED_REGRESSION', ['PASS', 'PASS'], { preparedAt: '2026-08-23T12:00:00.000Z' }));
  assert(Steward.assess({ ...assessmentInput(ready), fixedRegression: regression }).technicalHolds.includes('FIXED_REGRESSION_TIME_DRIFT'));
});
test('future evaluation evidence produces a time hold', () => {
  const heldOut = Steward.createEvaluationSuite(suiteInput(ready.lesson, 'HELD_OUT_GOALS', ['PASS', 'PASS'], { preparedAt: '2026-08-27T12:00:00.000Z' }));
  assert(Steward.assess({ ...assessmentInput(ready), heldOutGoals: heldOut }).technicalHolds.includes('HELD_OUT_TIME_DRIFT'));
});
test('suite binding to another lesson produces an exact hold', () => {
  const value = suiteInput(ready.lesson, 'HELD_OUT_GOALS'); value.candidateRef = { ...value.candidateRef, sha256: hash('other-lesson') };
  const heldOut = Steward.createEvaluationSuite(value);
  assert(Steward.assess({ ...assessmentInput(ready), heldOutGoals: heldOut }).technicalHolds.includes('HELD_OUT_CANDIDATE_BINDING_DRIFT'));
});
test('suite identity alias with the right bytes still produces a binding hold', () => {
  const value = suiteInput(ready.lesson, 'HELD_OUT_GOALS'); value.candidateRef.id = 'aliased-candidate-id';
  const heldOut = Steward.createEvaluationSuite(value);
  assert(Steward.assess({ ...assessmentInput(ready), heldOutGoals: heldOut }).technicalHolds.includes('HELD_OUT_CANDIDATE_BINDING_DRIFT'));
});
test('evaluation suites refuse duplicate goal bytes', () => {
  const value = suiteInput(ready.lesson, 'FIXED_REGRESSION'); value.cases[1].goalRef = clone(value.cases[0].goalRef);
  assert.throws(() => Steward.createEvaluationSuite(value), /reuse the same goal bytes/);
});
test('held-out goals must stay distinct from fixed regression goals', () => {
  const heldInput = suiteInput(ready.lesson, 'HELD_OUT_GOALS'); heldInput.cases[0].goalRef = clone(ready.regression.cases[0].goalRef);
  const heldOut = Steward.createEvaluationSuite(heldInput);
  assert(Steward.assess({ ...assessmentInput(ready), heldOutGoals: heldOut }).technicalHolds.includes('HELD_OUT_GOAL_OVERLAP'));
});
test('future current-library observations produce a time hold', () => {
  const library = Steward.createLibrarySnapshot({ id: 'code-capability-library', libraryVersion: '0.0.0', createdAt: '2026-08-27T00:00:00.000Z', lessons: [], authority: 'NONE' });
  assert(Steward.assess({ ...assessmentInput(ready), currentLibrary: library }).technicalHolds.includes('CURRENT_LIBRARY_TIME_DRIFT'));
});
test('expired lessons cannot become release candidates', () => {
  const result = Steward.createReleaseCandidate({ ...assessmentInput(ready), evaluatedAt: '2027-08-24T12:00:00.000Z', nextVersion: '0.0.1' });
  assert.strictEqual(result.receipt.status, 'RELEASE_HELD'); assert.strictEqual(result.releaseCandidate, null); assert(result.assessment.technicalHolds.includes('LESSON_EXPIRED'));
});

test('semantic duplicate is held even when a new id would be used', () => {
  const library = Steward.createLibrarySnapshot({ id: 'code-capability-library', libraryVersion: '0.0.1', createdAt: '2026-08-25T00:00:00.000Z', lessons: [lessonSummary(ready.lesson)], authority: 'NONE' });
  const held = Steward.assess({ ...assessmentInput(ready), currentLibrary: library });
  assert(held.technicalHolds.includes('SEMANTIC_DUPLICATE'));
});
test('library refuses duplicate semantic keys internally', () => {
  const duplicate = { ...lessonSummary(ready.lesson), id: 'different-lesson-id', lessonDigest: hash('different-record') };
  assert.throws(() => Steward.createLibrarySnapshot({ id: 'code-capability-library', libraryVersion: '0.0.1', createdAt: '2026-08-25T00:00:00.000Z', lessons: [lessonSummary(ready.lesson), duplicate], authority: 'NONE' }), /semantic lesson duplicates/);
});
test('release refuses a skipped version', () => assert.throws(() => Steward.createReleaseCandidate({ ...assessmentInput(ready), nextVersion: '0.0.2' }), /exact next patch/));
test('release refuses a major or minor jump', () => assert.throws(() => Steward.createReleaseCandidate({ ...assessmentInput(ready), nextVersion: '1.0.0' }), /exact next patch/));
test('library ids that overflow derived release ids are refused at snapshot formation', () => assert.throws(() => Steward.createLibrarySnapshot({ id: 'a'.repeat(88), libraryVersion: '0.0.0', createdAt: '2026-08-24T00:00:00.000Z', lessons: [], authority: 'NONE' }), /derived library release id/));
test('unbounded semantic-version strings are refused', () => assert.throws(() => Steward.createLibrarySnapshot({ id: 'code-capability-library', libraryVersion: '1'.repeat(33) + '.0.0', createdAt: '2026-08-24T00:00:00.000Z', lessons: [], authority: 'NONE' }), /bounded plain semantic version/));

test('privacy-safe failure lessons can be represented without raw failed attempts', () => {
  const value = requestInput({ lessonKind: 'PRIVACY_SAFE_FAILURE_RULE' });
  value.provenance.acceptedArtifactRef = null;
  value.rule.actionCodes = ['STOP_AND_REQUEST_BOUNDARY_EVIDENCE'];
  const request = Steward.sealRequest(value);
  const lesson = Steward.createLesson(request);
  assert.strictEqual(lesson.lessonKind, 'PRIVACY_SAFE_FAILURE_RULE');
  assert.strictEqual(lesson.truth.rawFailedAttemptsRetained, false);
});
test('failure lessons cannot smuggle a raw failed attempt field', () => {
  const value = requestInput({ lessonKind: 'PRIVACY_SAFE_FAILURE_RULE' }); value.provenance.acceptedArtifactRef = null; value.rawFailedAttempt = 'secret';
  assert.throws(() => Steward.sealRequest(value), /fields are not closed/);
});

test('rehashed assessment promotion forgery fails exact rebuild', () => {
  const forged = clone(assessment); forged.truth.persistentLearningAdmitted = true;
  const core = clone(forged); delete core.assessmentDigest; forged.assessmentDigest = hash(core);
  assert.throws(() => Steward.verifyAssessment(forged, assessmentInput(ready)), /differs from deterministic rebuild/);
});
test('module source imports no filesystem, process, network or child-process executor', () => {
  const source = fs.readFileSync(path.join(__dirname, 'capability-lesson-steward-v1.js'), 'utf8');
  assert(!/require\(['"](?:fs|node:fs|child_process|node:child_process|http|https|net|tls)['"]\)/.test(source));
  assert(!/\b(?:fetch|spawn|execFile|execSync|Date\.now|Math\.random|process\.env)\s*\(/.test(source));
});
test('module contract grants no permissions or writes', () => {
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module-capability-lesson-steward-v1.contract.json'), 'utf8'));
  assert.strictEqual(contract.status, 'TEST');
  assert.deepStrictEqual(contract.permissions, []);
  assert.deepStrictEqual(contract.boundaries.writes, []);
});
test('module contract refuses admission, incentives, execution and CANON', () => {
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module-capability-lesson-steward-v1.contract.json'), 'utf8'));
  for (const boundary of ['reward-loop', 'incentive-loop', 'candidate-execution', 'automatic-lesson-admission', 'persistent-learning', 'promotion', 'canon-change']) assert(contract.boundaries.refuses.includes(boundary));
});
test('snapshot makes the no-incentive and no-admission boundaries explicit', () => {
  const snapshot = Steward.snapshot();
  assert.strictEqual(snapshot.rewardOrIncentiveLoop, false);
  assert.strictEqual(snapshot.persistentAdmission, 'HELD_FOR_RIGHTS_VERIFICATION_AUTHENTICATED_TIER_3_DECISION_AND_SEPARATE_HOST');
  assert.strictEqual(snapshot.rightsAuthorityAssurance, 'REFERENCE_BOUND_NOT_INDEPENDENTLY_VERIFIED');
  assert.strictEqual(snapshot.authority, 'NONE');
});

console.log('Capability lesson steward v1 selftest: ' + passed + ' PASS');
