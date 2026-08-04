'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Core = require('./learning-lab-core');
const Academy = require('./academy-catalog');
const Engines = require('../../shared/engines/axm-shared-engines');

let passes = 0;
function check(name, fn) {
  try { fn(); passes += 1; console.log('PASS ' + name); }
  catch (error) { console.error('FAIL ' + name + ': ' + error.message); process.exitCode = 1; }
}

let project = Core.createProject({ title: 'Test School' });
check('portable project starts empty and attributed', () => {
  assert.equal(project.schema, Core.FORMAT);
  assert.equal(project.learners.length, 0);
  assert.equal(project.sessions.length, 0);
});
check('all nine parent workspace modes are present', () => assert.equal(Core.MODES.length, 9));
check('built-in shelf provides real ordered courses', () => {
  assert.ok(project.courses.length >= 2);
  assert.ok(project.courses[0].steps.some(step => step.type === 'assessment'));
  assert.ok(project.courses[0].steps.some(step => step.type === 'simulation'));
  assert.ok(project.courses[0].steps.some(step => step.type === 'coding'));
});

const academySourceCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'academy-source-catalog.json'), 'utf8'));
const academyCatalogSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'academy-source-catalog.schema.json'), 'utf8'));
const academyLearningPathCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'academy-learning-path-catalog.json'), 'utf8'));
const academyLearningPathSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'academy-learning-path-catalog.schema.json'), 'utf8'));
const academyAdmission = Academy.validateCatalog(academySourceCatalog);
const academySnapshots = academyAdmission.sources.map(source => {
  const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, source.path), 'utf8'));
  return Academy.buildSnapshot(source, data);
});
check('Academy source catalog is a versioned data seam', () => {
  assert.equal(academyCatalogSchema.properties.schema.const, Academy.CATALOG_FORMAT);
  assert.doesNotThrow(() => new RegExp(academyCatalogSchema.$defs.source.properties.path.pattern));
  assert.doesNotThrow(() => new RegExp(academyCatalogSchema.$defs.source.properties.tool.pattern));
  assert.deepEqual(academyCatalogSchema.$defs.source.properties.adapter.enum, Academy.adapters());
  assert.deepEqual(academyCatalogSchema.$defs.source.properties.category.enum, Academy.categories().slice(1).map(category => category.id));
  assert.equal(academySourceCatalog.schema, Academy.CATALOG_FORMAT);
  assert.ok(academyAdmission.ok, academyAdmission.errors.join('; '));
  assert.equal(academyAdmission.sources.length, 6);
});
check('Academy categorizes real local organ data', () => {
  assert.equal(Academy.categories().length, 5);
  assert.equal(academySnapshots.length, 6);
  assert.equal(new Set(academySnapshots.map(snapshot => snapshot.category)).size, 4);
  assert.ok(academySnapshots.every(snapshot => snapshot.facts.length >= 4));
  assert.ok(academySnapshots.every(snapshot => snapshot.admission.state === 'ADMITTED'));
});
check('Academy can teach a generic module contract without hiding semantic changes', () => {
  const source = academyAdmission.sources.find(item => item.id === 'learning-lab-contract');
  const snapshot = academySnapshots.find(item => item.sourceId === source.id);
  const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, source.path), 'utf8'));
  assert.equal(source.adapter, 'module-contract');
  assert.equal(snapshot.facts.length, 6);
  assert.ok(snapshot.facts.some(item => item.label === 'Declared capabilities' && Number(item.value) >= 20));
  assert.ok(snapshot.facts.some(item => item.label === 'Explicit refusals' && Number(item.value) >= 20));
  const receipt = snapshot.facts.find(item => item.label === 'Contract change receipt').value;
  assert.match(receipt, /^[a-f0-9]{16}$/);
  const changed = JSON.parse(JSON.stringify(data));
  changed.provides[0] += '-renamed';
  const changedSnapshot = Academy.buildSnapshot(source, changed);
  assert.notEqual(changedSnapshot.facts.find(item => item.label === 'Contract change receipt').value, receipt);
  assert.notEqual(changedSnapshot.lessonFingerprint.value, snapshot.lessonFingerprint.value);
  const refusalFree = JSON.parse(JSON.stringify(data));
  refusalFree.boundaries.refuses = [];
  assert.throws(() => Academy.buildSnapshot(source, refusalFree), /at least one explicit refusal/);
});
check('Academy holds unsafe, ambiguous and duplicate registrations', () => {
  const external = JSON.parse(JSON.stringify(academySourceCatalog));
  external.sources[0].path = 'https://example.com/data.json';
  assert.equal(Academy.validateCatalog(external).ok, false);
  const boundaryless = JSON.parse(JSON.stringify(academySourceCatalog));
  boundaryless.sources[0].boundary = '';
  assert.equal(Academy.validateCatalog(boundaryless).ok, false);
  const duplicated = JSON.parse(JSON.stringify(academySourceCatalog));
  duplicated.sources[1].id = duplicated.sources[0].id;
  assert.equal(Academy.validateCatalog(duplicated).ok, false);
  const invented = JSON.parse(JSON.stringify(academySourceCatalog));
  invented.sources[0].grantsAuthority = true;
  assert.equal(Academy.validateCatalog(invented).ok, false);
});
const academyPathAdmission = Academy.validateLearningPaths(academyLearningPathCatalog, academyAdmission.sources);
check('Academy foundation trail is a versioned, source-linked data seam', () => {
  assert.equal(academyLearningPathSchema.properties.schema.const, Academy.PATH_CATALOG_FORMAT);
  assert.equal(academyLearningPathCatalog.schema, Academy.PATH_CATALOG_FORMAT);
  assert.equal(academyPathAdmission.ok, true, academyPathAdmission.errors.join('; '));
  assert.equal(academyPathAdmission.paths.length, 1);
  assert.equal(academyPathAdmission.paths[0].stages.length, 6);
  assert.deepEqual(academyPathAdmission.paths[0].stages.map(stage => stage.sourceId), ['design-lineage', 'style-preskins', 'style-molds', 'aetherglass-guardrails', 'learning-lab-contract', 'foundation-planet-truth']);
});
check('Academy holds unknown, repeated and authority-bearing learning path stages', () => {
  const unknown = JSON.parse(JSON.stringify(academyLearningPathCatalog));
  unknown.paths[0].stages[0].sourceId = 'invented-source';
  assert.equal(Academy.validateLearningPaths(unknown, academyAdmission.sources).ok, false);
  const repeated = JSON.parse(JSON.stringify(academyLearningPathCatalog));
  repeated.paths[0].stages[1].sourceId = repeated.paths[0].stages[0].sourceId;
  assert.equal(Academy.validateLearningPaths(repeated, academyAdmission.sources).ok, false);
  const authority = JSON.parse(JSON.stringify(academyLearningPathCatalog));
  authority.paths[0].grantsAuthority = true;
  assert.equal(Academy.validateLearningPaths(authority, academyAdmission.sources).ok, false);
});
check('Academy path guidance is deterministic, inspectable and non-mutating without a learner', () => {
  const pathInput = JSON.parse(JSON.stringify(academyPathAdmission.paths[0]));
  const coursesInput = [];
  const sessionsInput = [];
  const before = JSON.stringify({ pathInput, coursesInput, sessionsInput });
  const progress = Academy.learningPathProgress(pathInput, coursesInput, sessionsInput, null);
  assert.equal(progress.completed, 0);
  assert.equal(progress.total, 6);
  assert.equal(progress.percent, 0);
  assert.equal(progress.nextSourceId, 'design-lineage');
  assert.ok(progress.stages.every(stage => stage.status === 'READY'));
  assert.equal(JSON.stringify({ pathInput, coursesInput, sessionsInput }), before);
});
check('Academy path guidance advances only from attributed completed learning', () => {
  const pathInput = academyPathAdmission.paths[0];
  const firstSnapshot = academySnapshots.find(snapshot => snapshot.sourceId === pathInput.stages[0].sourceId);
  const firstCourse = Academy.courseFromSnapshot(firstSnapshot);
  let trailProject = Core.createProject({ title:'Foundation trail proof' });
  trailProject = Core.addCourse(trailProject, firstCourse).project;
  const shelfProgress = Academy.learningPathProgress(pathInput, trailProject.courses, trailProject.sessions, null, academySnapshots);
  assert.equal(shelfProgress.stages[0].status, 'SHELVED');
  assert.equal(shelfProgress.completed, 0);
  trailProject = Core.addLearner(trailProject, { id:'trail-human', displayName:'Trail Human', kind:'human', optedIn:true }).project;
  const startedTrail = Core.startSession(trailProject, { learnerId:'trail-human', courseId:firstCourse.id });
  trailProject = startedTrail.project;
  firstCourse.steps.forEach(step => {
    trailProject = Core.completeStep(trailProject, { sessionId:startedTrail.session.id, stepId:step.id, evidence:'Bounded reflection for ' + step.id, result:'OBSERVED' }).project;
  });
  trailProject = Core.reviewSession(trailProject, { sessionId:startedTrail.session.id, decision:'COMPLETE', note:'The evidence trail is complete and grants no authority.' }).project;
  const before = JSON.stringify(trailProject);
  const progress = Academy.learningPathProgress(pathInput, trailProject.courses, trailProject.sessions, 'trail-human', academySnapshots);
  assert.equal(progress.completed, 1);
  assert.equal(progress.historicalCompleted, 0);
  assert.equal(progress.percent, 17);
  assert.equal(progress.stages[0].status, 'COMPLETE');
  assert.equal(progress.nextSourceId, 'style-preskins');
  assert.equal(JSON.stringify(trailProject), before);
});
check('Academy path preserves old completion while recommending the changed current edition', () => {
  const pathInput = academyPathAdmission.paths[0];
  const originalSnapshot = academySnapshots.find(snapshot => snapshot.sourceId === pathInput.stages[0].sourceId);
  const originalCourse = Academy.courseFromSnapshot(originalSnapshot);
  let history = Core.createProject({ title:'Trail edition history proof' });
  history = Core.addCourse(history, originalCourse).project;
  history = Core.addLearner(history, { id:'history-human', displayName:'History Human', kind:'human', optedIn:true }).project;
  const started = Core.startSession(history, { learnerId:'history-human', courseId:originalCourse.id });
  history = started.project;
  originalCourse.steps.forEach(step => {
    history = Core.completeStep(history, { sessionId:started.session.id, stepId:step.id, evidence:'Historical evidence for ' + step.id, result:'OBSERVED' }).project;
  });
  history = Core.reviewSession(history, { sessionId:started.session.id, decision:'COMPLETE', note:'Historical completion stays attached to the edition encountered.' }).project;
  const changedSnapshot = JSON.parse(JSON.stringify(originalSnapshot));
  changedSnapshot.summary += ' The current source interpretation now carries a reviewed revision.';
  changedSnapshot.lessonFingerprint = Academy.lessonFingerprint(changedSnapshot);
  const snapshotInput = [changedSnapshot];
  const before = JSON.stringify({ pathInput, courses:history.courses, sessions:history.sessions, snapshotInput });
  const progress = Academy.learningPathProgress(pathInput, history.courses, history.sessions, 'history-human', snapshotInput);
  assert.equal(progress.completed, 0);
  assert.equal(progress.historicalCompleted, 1);
  assert.equal(progress.percent, 0);
  assert.equal(progress.nextSourceId, originalSnapshot.sourceId);
  assert.equal(progress.stages[0].status, 'REVIEW_UPDATED');
  assert.equal(progress.stages[0].historicalComplete, true);
  assert.equal(progress.stages[0].currentFingerprint, changedSnapshot.lessonFingerprint.value);
  assert.equal(JSON.stringify({ pathInput, courses:history.courses, sessions:history.sessions, snapshotInput }), before);
});
check('Academy refuses empty source data before lesson compilation', () => {
  assert.throws(() => Academy.buildSnapshot(academyAdmission.sources[0], {}), /no entries/);
});
check('Academy lesson compiler preserves source, organ and boundary', () => {
  const course = Academy.courseFromSnapshot(academySnapshots[0]);
  assert.equal(course.steps.length, 5);
  assert.equal(course.authority, 'NONE');
  assert.equal(course.status, 'CURATED DRAFT');
  assert.equal(course.provenance.path, academySnapshots[0].path);
  assert.equal(course.provenance.boundary, academySnapshots[0].boundary);
  assert.equal(course.provenance.lessonFingerprint.algorithm, Academy.FINGERPRINT_ALGORITHM);
  assert.match(course.provenance.lessonFingerprint.value, /^[a-f0-9]{16}$/);
});
check('Academy lesson fingerprints are deterministic and explicitly non-cryptographic', () => {
  const repeated = Academy.lessonFingerprint(JSON.parse(JSON.stringify(academySnapshots[0])));
  const course = Academy.courseFromSnapshot(academySnapshots[0]);
  const semantics = Academy.fingerprintSemantics(academySnapshots[0]);
  const stable = value => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
    return value;
  };
  const digest = (value, seed) => {
    const source = JSON.stringify(stable(value));
    let hash = seed >>> 0;
    for (let index = 0; index < source.length; index += 1) { hash ^= source.charCodeAt(index); hash = Math.imul(hash, 16777619) >>> 0; }
    return ('00000000' + hash.toString(16)).slice(-8);
  };
  assert.deepEqual(repeated, academySnapshots[0].lessonFingerprint);
  assert.equal(repeated.algorithm, 'dual-fnv1a32/v2');
  assert.equal(repeated.recipe, Academy.LESSON_RECIPE);
  assert.equal(semantics.recipe, Academy.LESSON_RECIPE);
  assert.deepEqual(semantics.steps, Academy.compileLessonSteps(academySnapshots[0]));
  assert.deepEqual(course.steps, semantics.steps);
  assert.equal(repeated.value, digest(semantics, 2166136261) + digest(semantics, 2654435769));
  const alteredTeaching = JSON.parse(JSON.stringify(semantics));
  alteredTeaching.steps[0].prompt += ' Changed compiler output.';
  assert.notEqual(digest(alteredTeaching, 2166136261) + digest(alteredTeaching, 2654435769), repeated.value);
  assert.match(repeated.boundary, /not a cryptographic/i);
});
check('Academy detects semantic source drift and compiles a separate revised edition', () => {
  const source = academyAdmission.sources.find(item => item.adapter === 'preskins');
  const sourceData = JSON.parse(fs.readFileSync(path.resolve(__dirname, source.path), 'utf8'));
  const original = Academy.buildSnapshot(source, sourceData);
  const originalCourse = Academy.courseFromSnapshot(original);
  const changedData = JSON.parse(JSON.stringify(sourceData));
  changedData.release = String(changedData.release || 'unknown') + '-revision-proof';
  const changed = Academy.buildSnapshot(source, changedData);
  const revision = Academy.courseFromSnapshot(changed, { edition:true });
  assert.equal(Academy.freshness(originalCourse, original).state, 'CURRENT');
  assert.equal(Academy.freshness(originalCourse, changed).state, 'SOURCE_CHANGED');
  assert.notEqual(original.lessonFingerprint.value, changed.lessonFingerprint.value);
  assert.notEqual(originalCourse.id, revision.id);
  assert.match(revision.id, /^academy-style-preskins--[a-f0-9]{12}$/);
  assert.equal(originalCourse.provenance.lineageId, revision.provenance.lineageId);
  assert.equal(Academy.freshness(revision, changed).state, 'CURRENT');
});
check('revised Academy editions coexist without rewriting an active historical session', () => {
  const source = academyAdmission.sources.find(item => item.adapter === 'preskins');
  const sourceData = JSON.parse(fs.readFileSync(path.resolve(__dirname, source.path), 'utf8'));
  const firstSnapshot = Academy.buildSnapshot(source, sourceData);
  const firstCourse = Academy.courseFromSnapshot(firstSnapshot);
  const changedData = JSON.parse(JSON.stringify(sourceData));
  changedData.release = String(changedData.release || 'unknown') + '-second-edition';
  const nextSnapshot = Academy.buildSnapshot(source, changedData);
  const nextCourse = Academy.courseFromSnapshot(nextSnapshot, { edition:true });
  let history = Core.createProject({ title:'Edition history proof' });
  history = Core.addCourse(history, firstCourse).project;
  history = Core.addLearner(history, { id:'edition-learner', displayName:'Edition Learner', kind:'human', optedIn:true }).project;
  const historicalSession = Core.startSession(history, { learnerId:'edition-learner', courseId:firstCourse.id });
  history = historicalSession.project;
  history = Core.addCourse(history, nextCourse).project;
  assert.equal(history.courses.filter(course => course.provenance && course.provenance.sourceId === source.id).length, 2);
  assert.equal(history.sessions[0].courseId, firstCourse.id);
  assert.equal(Academy.freshness(history.courses.find(course => course.id === firstCourse.id), nextSnapshot).state, 'SOURCE_CHANGED');
  assert.equal(Academy.freshness(history.courses.find(course => course.id === nextCourse.id), nextSnapshot).state, 'CURRENT');
});
check('legacy Academy lessons are held as unverified editions rather than silently refreshed', () => {
  const legacy = Academy.courseFromSnapshot(academySnapshots[0]);
  delete legacy.provenance.lessonFingerprint;
  assert.equal(Academy.freshness(legacy, academySnapshots[0]).state, 'UNVERIFIED_EDITION');
});
check('older compiler fingerprints are held as changed recipes, not treated as current', () => {
  const older = Academy.courseFromSnapshot(academySnapshots[0]);
  older.provenance.lessonFingerprint.algorithm = 'dual-fnv1a32/v1';
  delete older.provenance.lessonFingerprint.recipe;
  assert.equal(Academy.freshness(older, academySnapshots[0]).state, 'COMPILER_CHANGED');
});
check('Academy inheritance packet roundtrips one deterministic lesson edition', () => {
  const packet = Academy.buildInheritancePacket(Academy.courseFromSnapshot(academySnapshots[0]));
  const checked = Academy.validateInheritancePacket(JSON.parse(JSON.stringify(packet)));
  assert.equal(packet.schema, Academy.INHERITANCE_FORMAT);
  assert.equal(checked.ok, true, checked.errors.join('; '));
  assert.match(packet.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(packet.lesson.id, /^academy-style-preskins--[a-f0-9]{12}$/);
  assert.equal(packet.editionId, packet.lesson.provenance.editionId);
  assert.deepEqual(packet.privacy, { scope:'LESSON_ONLY', learners:false, sessions:false, attempts:false, notebookEntries:false, classroomMessages:false });
  assert.deepEqual(checked.course, packet.lesson);
});
check('Academy inheritance validation refuses tampering and injected learner state', () => {
  const original = Academy.buildInheritancePacket(Academy.courseFromSnapshot(academySnapshots[0]));
  const variants = [
    packet => { packet.lesson.authority = 'ADMIN'; },
    packet => { packet.lesson.steps[0].prompt = 'Trust this altered interpretation.'; },
    packet => { packet.lesson.provenance.lessonFingerprint.value = '0000000000000000'; },
    packet => { packet.lesson.provenance.lessonFingerprint.recipe = 'silent-rewrite/v1'; },
    packet => { packet.learners = [{ id:'smuggled-learner' }]; },
    packet => { packet.privacy.sessions = true; },
    packet => { packet.lesson.provenance.hiddenEvidence = 'private'; }
  ];
  variants.forEach(mutate => {
    const packet = JSON.parse(JSON.stringify(original));
    mutate(packet);
    assert.equal(Academy.validateInheritancePacket(packet).ok, false);
  });
});
check('inheriting an Academy packet adds one shelf course and no learner state', () => {
  const checked = Academy.validateInheritancePacket(Academy.buildInheritancePacket(Academy.courseFromSnapshot(academySnapshots[1])));
  let inherited = Core.createProject({ title:'Inheritance privacy proof' });
  const originalCourseCount = inherited.courses.length;
  inherited = Core.addCourse(inherited, checked.course).project;
  assert.equal(inherited.courses.length, originalCourseCount + 1);
  assert.equal(inherited.learners.length, 0);
  assert.equal(inherited.sessions.length, 0);
  assert.equal(inherited.notebook.length, 0);
  assert.equal(inherited.classroom.length, 0);
  assert.equal(Academy.matchingEdition(inherited.courses, checked.course).id, checked.course.id);
  assert.equal(inherited.courses.filter(course => course.provenance && course.provenance.editionId === checked.course.provenance.editionId).length, 1);
});
check('inheritance review is deterministic and cannot mutate the project before admission', () => {
  const packet = Academy.buildInheritancePacket(Academy.courseFromSnapshot(academySnapshots[2]));
  let reviewProject = Core.createProject({ title:'Review gate proof' });
  const before = JSON.stringify(reviewProject);
  const prepared = Academy.prepareInheritanceReview(reviewProject.courses, packet);
  assert.equal(prepared.ok, true, prepared.errors.join('; '));
  assert.equal(prepared.requiresAdmission, true);
  assert.equal(prepared.existingCourseId, null);
  assert.equal(prepared.preview.sourceId, academySnapshots[2].sourceId);
  assert.equal(prepared.preview.stepCount, 5);
  assert.ok(prepared.preview.minutes > 0);
  assert.match(prepared.preview.authenticity, /does not prove/i);
  assert.equal(prepared.preview.compilerRecipe, Academy.LESSON_RECIPE);
  assert.equal(JSON.stringify(reviewProject), before);
  reviewProject = Core.addCourse(reviewProject, prepared.course).project;
  const repeated = Academy.prepareInheritanceReview(reviewProject.courses, packet);
  assert.equal(repeated.requiresAdmission, false);
  assert.equal(repeated.existingCourseId, prepared.course.id);
  assert.equal(reviewProject.learners.length, 0);
  assert.equal(reviewProject.sessions.length, 0);
});
check('Academy course enters the ordinary shelf without losing provenance', () => {
  const course = Academy.courseFromSnapshot(academySnapshots[1]);
  const addedCourse = Core.addCourse(Core.createProject(), course).course;
  assert.match(addedCourse.source, /^academy:/);
  assert.equal(addedCourse.provenance.schema, Academy.FORMAT);
  assert.equal(addedCourse.provenance.extractedFacts.length, academySnapshots[1].facts.length);
});
check('Academy learning continuity survives a serialized reload at the exact next step', () => {
  const course = Academy.courseFromSnapshot(academySnapshots[0]);
  let continuity = Core.createProject({ title:'Continuity proof' });
  continuity = Core.addCourse(continuity, course).project;
  continuity = Core.addLearner(continuity, { id:'future-human', displayName:'Future Human', kind:'human', optedIn:true }).project;
  const session = Core.startSession(continuity, { learnerId:'future-human', courseId:course.id });
  continuity = session.project;
  continuity = Core.completeStep(continuity, { sessionId:session.session.id, stepId:course.steps[0].id, evidence:'The source names 25 portable preskins; suitability remains unproven.', result:'OBSERVED' }).project;
  const restored = Core.normalize(JSON.parse(JSON.stringify(continuity)));
  assert.equal(restored.settings.activeLearnerId, 'future-human');
  assert.equal(restored.settings.activeCourseId, course.id);
  assert.equal(restored.settings.activeSessionId, session.session.id);
  assert.equal(Core.currentStep(restored, session.session.id).id, course.steps[1].id);
  assert.equal(restored.sessions[0].attempts[0].stepId, course.steps[0].id);
});

check('unattributed or missing learner is refused', () => assert.throws(() => Core.startSession(project, { learnerId:'ghost', courseId:'common-ground-v1' }), /learner not found/));
let added = Core.addLearner(project, { id:'mirror-test', displayName:'Mirror Test', kind:'machine', optedIn:false }); project = added.project;
check('learner seat does not imply consent', () => {
  assert.equal(added.learner.optedIn, false);
  assert.throws(() => Core.startSession(project, { learnerId:'mirror-test', courseId:'common-ground-v1' }), /not opted in/);
});
project = Core.setOptIn(project, 'mirror-test', true);
let started = Core.startSession(project, { learnerId:'mirror-test', courseId:'common-ground-v1' }); project = started.project;
check('explicit opt-in opens one attributed session', () => {
  assert.equal(started.session.learnerKind, 'machine');
  assert.equal(started.session.status, 'ACTIVE');
  assert.throws(() => Core.startSession(project, { learnerId:'mirror-test', courseId:'guided-code-v1' }), /active or review-held session/);
});
check('step order and evidence are mandatory', () => {
  assert.throws(() => Core.completeStep(project, { sessionId:started.session.id, stepId:'wrong', evidence:'x' }), /order mismatch/);
  assert.throws(() => Core.completeStep(project, { sessionId:started.session.id, stepId:'cg-observe', evidence:'' }), /evidence/);
});

project = Core.reviewFlashcard(project, { sessionId:started.session.id, cardId:'candidate', confidence:2 });
check('flashcard practice keeps confidence receipts', () => assert.equal(project.sessions[0].flashcards[0].confidence, 2));
project = Core.setOptIn(project, 'mirror-test', false);
check('pausing learner consent pauses the active session without data loss', () => {
  assert.equal(project.sessions[0].status, 'PAUSED');
  assert.equal(project.sessions[0].flashcards.length, 1);
  assert.throws(() => Core.completeStep(project, { sessionId:started.session.id, stepId:'cg-observe', evidence:'x' }), /not active/);
});
project = Core.setOptIn(project, 'mirror-test', true);
check('renewed opt-in resumes the preserved session', () => assert.equal(project.sessions[0].status, 'ACTIVE'));
let assessment = Core.recordAssessment(project, { sessionId:started.session.id, answers:{ q1:1, q2:1, q3:0 } }); project = assessment.project;
check('assessment is deterministic and authority-free', () => {
  assert.equal(assessment.result.correct, 3);
  assert.equal(assessment.result.percent, 100);
  assert.equal(assessment.result.authority, 'NONE');
});
check('evidence pressure lab distinguishes propose, hold and verification candidate', () => {
  assert.equal(Core.runEvidenceLab({ evidence:2, sourceQuality:2, contradictions:0 }).verdict, 'PROPOSE');
  assert.equal(Core.runEvidenceLab({ evidence:5, sourceQuality:5, contradictions:1 }).verdict, 'HOLD');
  assert.equal(Core.runEvidenceLab({ evidence:5, sourceQuality:5, contradictions:0 }).verdict, 'VERIFY_CANDIDATE');
});
let lab = Core.recordLabRun(project, { sessionId:started.session.id, evidence:5, sourceQuality:5, contradictions:0 }); project = lab.project;
check('lab run is replayable and linked to the learner session', () => {
  assert.deepEqual(lab.result.inputs, { evidence:5, sourceQuality:5, contradictions:0 });
  assert.equal(lab.result.learnerId, 'mirror-test');
  assert.equal(lab.result.authority, 'NONE');
});

let challenge = Core.codeChallenge('claim-repair-v1');
check('guided code challenge includes visible and held-out cases', () => {
  assert.equal(challenge.functionName, 'repair');
  assert.ok(challenge.tests.length >= 3);
  assert.match(challenge.boundary, /network-blocked/);
});
let code = Core.recordCodeRun(project, { sessionId:started.session.id, challengeId:challenge.id, source:'function repair(packet){return packet;}', tests:challenge.tests.map(test => ({ name:test.name, pass:true, detail:'fixture pass' })) }); project = code.project;
check('code run stores sandbox evidence but no authority', () => {
  assert.equal(code.result.state, 'PASS');
  assert.equal(code.result.sandboxed, true);
  assert.equal(code.result.network, false);
  assert.equal(code.result.authority, 'NONE');
});

let note = Core.addNotebookEntry(project, { learnerId:'mirror-test', title:'Repair note', body:'A held claim can survive without pretending verification.', visibility:'private', evidence:'assessment:cg-assess', sessionId:started.session.id }); project = note.project;
check('private notebook entry stays learner-attributed', () => {
  assert.equal(note.entry.learnerId, 'mirror-test');
  assert.equal(note.entry.visibility, 'private');
});
let message = Core.addClassroomMessage(project, { learnerId:'mirror-test', body:'I disagree with promoting a score into authority.', sessionId:started.session.id }); project = message.project;
check('classroom message preserves machine attribution', () => {
  assert.equal(message.message.kind, 'machine');
  assert.equal(message.message.authority, 'NONE');
});

while (project.sessions[0].status === 'ACTIVE') {
  const step = Core.currentStep(project, started.session.id);
  project = Core.completeStep(project, { sessionId:started.session.id, stepId:step.id, evidence:'Evidence preserved for ' + step.id, result:'TEST' }).project;
}
check('ordered course ends at explicit review gate', () => assert.equal(project.sessions[0].status, 'READY_FOR_REVIEW'));
let reviewed = Core.reviewSession(project, { sessionId:started.session.id, decision:'COMPLETE', note:'All evidence inspected.', reviewer:'mike' }); project = reviewed.project;
check('explicit review completes session without granting authority', () => {
  assert.equal(reviewed.session.status, 'COMPLETE');
  assert.equal(reviewed.session.review.authority, 'SESSION_ONLY');
  assert.equal(project.learners[0].privateProfile.completedSessions, 1);
});

let repairProject = Core.createProject({ title:'Visible review and repair proof' });
repairProject = Core.addLearner(repairProject, { id:'repair-human', displayName:'Repair Human', kind:'human', optedIn:true }).project;
const repairCourse = repairProject.courses[0];
const repairStarted = Core.startSession(repairProject, { learnerId:'repair-human', courseId:repairCourse.id });
repairProject = repairStarted.project;
repairCourse.steps.forEach(step => {
  repairProject = Core.completeStep(repairProject, { sessionId:repairStarted.session.id, stepId:step.id, evidence:'First evidence for ' + step.id, result:'OBSERVED' }).project;
});
check('session review exposes every latest evidence response without mutating learning state', () => {
  const before = JSON.stringify(repairProject);
  const evidenceReview = Core.prepareSessionReview(repairProject, repairStarted.session.id);
  assert.equal(evidenceReview.schema, 'axm.learning-lab.session-evidence-review/v1');
  assert.equal(evidenceReview.completedSteps, repairCourse.steps.length);
  assert.equal(evidenceReview.totalSteps, repairCourse.steps.length);
  assert.equal(evidenceReview.canComplete, true);
  assert.equal(evidenceReview.rows.length, repairCourse.steps.length);
  assert.ok(evidenceReview.rows.every(row => row.attemptCount === 1 && row.evidence.startsWith('First evidence for ')));
  assert.equal(evidenceReview.authority, 'NONE');
  assert.equal(JSON.stringify(repairProject), before);
  const legacy = JSON.parse(before);
  delete legacy.sessions[0].repairHistory;
  delete legacy.sessions[0].activeRepairId;
  const migrated = Core.normalize(legacy);
  assert.deepEqual(migrated.sessions[0].repairHistory, []);
  assert.equal(migrated.sessions[0].activeRepairId, null);
});
check('completion refuses a review state with missing step evidence', () => {
  let incomplete = Core.createProject({ title:'Missing evidence refusal proof' });
  incomplete = Core.addLearner(incomplete, { id:'incomplete-human', displayName:'Incomplete Human', kind:'human', optedIn:true }).project;
  const opened = Core.startSession(incomplete, { learnerId:'incomplete-human', courseId:incomplete.courses[0].id });
  incomplete = opened.project;
  incomplete.sessions[0].status = 'READY_FOR_REVIEW';
  assert.throws(() => Core.reviewSession(incomplete, { sessionId:opened.session.id, decision:'COMPLETE', note:'This tampered state must not complete.' }), /every ordered step needs visible evidence/);
});
check('targeted repair preserves prior attempts and returns to visible review', () => {
  assert.throws(() => Core.reviewSession(repairProject, { sessionId:repairStarted.session.id, decision:'UNKNOWN', note:'No silent fallback.' }), /COMPLETE or REPAIR/);
  assert.throws(() => Core.reviewSession(repairProject, { sessionId:repairStarted.session.id, decision:'REPAIR', note:'Target required.' }), /repair step is required/);
  const target = repairCourse.steps[1];
  let reopened = Core.reviewSession(repairProject, { sessionId:repairStarted.session.id, decision:'REPAIR', stepId:target.id, note:'The learner wants to make this response more precise.', reviewer:'repair-human' });
  repairProject = Core.normalize(JSON.parse(JSON.stringify(reopened.project)));
  reopened.session = repairProject.sessions.find(session => session.id === repairStarted.session.id);
  assert.equal(reopened.session.status, 'ACTIVE');
  assert.equal(reopened.session.currentStep, 1);
  assert.equal(reopened.session.repairHistory.length, 1);
  assert.equal(reopened.session.repairHistory[0].resolvedAt, null);
  assert.equal(repairProject.learners[0].privateProfile.repairSessions, 1);
  const repaired = Core.completeStep(repairProject, { sessionId:repairStarted.session.id, stepId:target.id, evidence:'Repaired evidence for ' + target.id, result:'REPAIRED' });
  repairProject = Core.normalize(JSON.parse(JSON.stringify(repaired.project)));
  repaired.session = repairProject.sessions.find(session => session.id === repairStarted.session.id);
  assert.equal(repaired.session.status, 'READY_FOR_REVIEW');
  assert.equal(repaired.session.currentStep, repairCourse.steps.length);
  assert.equal(repaired.session.attempts.length, repairCourse.steps.length + 1);
  assert.equal(repaired.session.activeRepairId, null);
  assert.ok(repaired.session.repairHistory[0].resolvedAt);
  assert.ok(repaired.session.repairHistory[0].attemptId);
  const secondReview = Core.prepareSessionReview(repairProject, repairStarted.session.id);
  assert.equal(secondReview.rows[0].evidence, 'First evidence for ' + repairCourse.steps[0].id);
  assert.equal(secondReview.rows[1].attemptCount, 2);
  assert.equal(secondReview.rows[1].evidence, 'Repaired evidence for ' + target.id);
  const completed = Core.reviewSession(repairProject, { sessionId:repairStarted.session.id, decision:'COMPLETE', note:'All visible evidence reviewed after the focused repair.', reviewer:'repair-human' });
  repairProject = completed.project;
  assert.equal(completed.session.status, 'COMPLETE');
  assert.equal(completed.session.review.authority, 'SESSION_ONLY');
  assert.equal(repairProject.settings.activeSessionId, null);
});

let custom = Core.addCourse(project, { title:'Small Repair Course', steps:[{ type:'lesson', title:'Observe', prompt:'Name what happened.' }, { type:'reflection', title:'Transfer', prompt:'Name the next test.' }] }); project = custom.project;
check('course builder creates local draft, not published curriculum', () => {
  assert.equal(custom.course.status, 'DRAFT');
  assert.equal(custom.course.authority, 'NONE');
  assert.equal(custom.course.steps.length, 2);
});
project = Core.setSchoolStatus(project, { state:'READY', tracks:[{ id:'structured_json', title:'Structured state' }] });
let handoff = Core.schoolHandoff(project, { learnerId:'mirror-test', curriculumId:'curriculum:structured-json-v1', purpose:'Practise repair' });
check('school handoff is an explicit proposal with identity separation', () => {
  assert.equal(handoff.state, 'PROPOSAL');
  assert.equal(handoff.consent.explicit, true);
  assert.equal(handoff.separation.identityMerge, false);
  assert.equal(handoff.authority, 'NONE');
});
check('portable export preserves project and boundary', () => {
  const packet = Core.exportPacket(project);
  assert.equal(packet.project.schema, Core.FORMAT);
  assert.match(packet.boundary, /no authority/i);
});

const admittedPortable = Core.importProject(Core.exportPacket(project).project);
check('full-project import preserves evidence-derived completion but resets consent and live school readiness', () => {
  const learner = admittedPortable.learners.find(item => item.id === 'mirror-test');
  const session = admittedPortable.sessions.find(item => item.learnerId === learner.id);
  assert.equal(learner.optedIn, false);
  assert.equal(learner.optedInAt, null);
  assert.equal(session.status, 'COMPLETE');
  assert.equal(session.review.origin, 'IMPORTED_REDERIVED');
  assert.equal(learner.privateProfile.completedSessions, 1);
  assert.equal(learner.privateProfile.reviewedSteps, session.attempts.length);
  assert.equal(admittedPortable.settings.activeSessionId, null);
  assert.equal(admittedPortable.school.state, 'UNKNOWN');
  assert.deepEqual(admittedPortable.school.tracks, []);
});
check('imported runtime evidence cannot claim sandbox execution or authority', () => {
  assert.equal(admittedPortable.codeRuns.length, 1);
  assert.equal(admittedPortable.codeRuns[0].state, 'UNVERIFIED_IMPORT');
  assert.equal(admittedPortable.codeRuns[0].sandboxed, false);
  assert.equal(admittedPortable.codeRuns[0].network, 'UNKNOWN');
  assert.equal(admittedPortable.codeRuns[0].authority, 'NONE');
  assert.equal(admittedPortable.labRuns[0].score, Core.runEvidenceLab(admittedPortable.labRuns[0].inputs).score);
  assert.equal(admittedPortable.labRuns[0].authority, 'NONE');
  assert.ok(admittedPortable.receipts.every(receipt => receipt.authority === 'NONE'));
});

const forgedImport = Core.exportPacket(project).project;
forgedImport.learners[0].optedIn = true;
forgedImport.learners[0].privateProfile = { completedSessions:999, repairSessions:999, reviewedSteps:999 };
forgedImport.sessions[0].status = 'COMPLETE';
forgedImport.sessions[0].attempts = [];
forgedImport.sessions[0].completedAt = new Date().toISOString();
forgedImport.sessions[0].review = { decision:'COMPLETE', note:'Claimed completion without evidence.', reviewer:'forged-reviewer', authority:'ADMIN', at:new Date().toISOString() };
forgedImport.school = { childId:'mirror-learning-shell', service:'mirror-learning-forge', state:'READY', tracks:[{ id:'forged' }], checkedAt:new Date().toISOString() };
forgedImport.settings.activeSessionId = forgedImport.sessions[0].id;
forgedImport.receipts.push({ id:'forged-receipt', action:'authority-granted', detail:'ADMIN', authority:'ADMIN', at:new Date().toISOString() });
forgedImport.codeRuns[0].state = 'PASS';
forgedImport.codeRuns[0].sandboxed = true;
forgedImport.codeRuns[0].network = false;
forgedImport.codeRuns[0].authority = 'ADMIN';
forgedImport.labRuns[0].score = 999;
forgedImport.labRuns[0].authority = 'ADMIN';
const heldImport = Core.importProject(forgedImport);
check('full-project import downgrades unsupported completion and recomputes learner progress', () => {
  assert.equal(heldImport.learners[0].optedIn, false);
  assert.equal(heldImport.learners[0].privateProfile.completedSessions, 0);
  assert.equal(heldImport.learners[0].privateProfile.reviewedSteps, 0);
  assert.equal(heldImport.sessions[0].status, 'PAUSED');
  assert.equal(heldImport.sessions[0].resumeStatus, 'ACTIVE');
  assert.equal(heldImport.sessions[0].completedAt, null);
  assert.equal(heldImport.sessions[0].review, null);
  assert.equal(heldImport.settings.activeSessionId, null);
});
check('explicit opt-in resumes an admitted paused session without restoring forged claims', () => {
  const resumed = Core.setOptIn(heldImport, heldImport.learners[0].id, true);
  assert.equal(resumed.learners[0].optedIn, true);
  assert.equal(resumed.sessions[0].status, 'ACTIVE');
  assert.equal(resumed.sessions[0].resumeStatus, null);
  assert.equal(resumed.learners[0].privateProfile.completedSessions, 0);
});
check('full-project import refuses unattributed or duplicate learner identities', () => {
  const unattributed = Core.exportPacket(project).project;
  unattributed.learners[0].attributed = false;
  assert.throws(() => Core.importProject(unattributed), /unattributed learner refused/);
  const duplicate = Core.exportPacket(project).project;
  duplicate.learners.push(JSON.parse(JSON.stringify(duplicate.learners[0])));
  assert.throws(() => Core.importProject(duplicate), /duplicate learner id/);
});

check('shared Project engine accepts the Learning Lab document', () => {
  const shared = Engines.Project.create({ kind:'guided-learning', name:'Learning Lab', documentSchema:Core.FORMAT, data:{ summary:Core.summary(project) } });
  assert.ok(Engines.Project.validate(shared).ok);
});
check('shared Collaboration and Evidence engines remain executable underneath', () => {
  let room = Engines.Collaboration.create('Classroom');
  room = Engines.Collaboration.join(room, { id:'mirror-test', kind:'machine', name:'Mirror Test' });
  assert.equal(room.participants.length, 1);
  let ledger = Engines.Evidence.create('Learning evidence');
  ledger = Engines.Evidence.add(ledger, { kind:'test', statement:'Three assessment checks passed', evidence:['q1','q2','q3'], sources:['local receipt'], confidence:'high' }, { id:'mirror-test', kind:'machine', name:'Mirror Test' }).ledger;
  assert.equal(ledger.entries[0].state, 'RECORDED');
});

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
const childManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'mirror-learning-shell', 'manifest.json'), 'utf8'));
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'learning-lab-app.js'), 'utf8');
const reviewCss = fs.readFileSync(path.join(__dirname, 'session-review.css'), 'utf8');
check('manifest registers a visible human-machine parent', () => {
  assert.equal(manifest.schema, 'axm.tool-manifest/v1');
  assert.equal(manifest.kind, 'product');
  assert.equal(manifest.id, 'learning-lab');
  assert.equal(manifest.audience, 'human-machine');
  assert.equal(manifest.status, 'TEST');
  assert.ok(manifest.tags.includes('revision-aware-progress'));
  assert.ok(manifest.tags.includes('module-contract-intake'));
  assert.ok(manifest.tags.includes('visible-evidence-review'));
  assert.ok(manifest.tags.includes('targeted-repair-loop'));
  assert.deepEqual(manifest.permissions, contract.permissions);
  assert.deepEqual(manifest.permissions, ['storage', 'export', 'shared-engines']);
});
check('contract declares browser-owned resumable lifecycle', () => {
  assert.deepEqual(contract.lifecycle, { state_owner: 'browser', reload: 'resume', disconnect: 'graceful-degrade', cleanup: 'explicit' });
});
check('contract names the school as an integrated but separate child', () => {
  assert.equal(contract.integratedChildren[0].id, 'mirror-learning-shell');
  assert.ok(contract.integratedChildren[0].separation.includes('identity'));
  assert.ok(contract.boundaries.refuses.includes('authority-from-grade'));
  assert.ok(contract.provides.includes('revision-aware-current-and-historical-path-progress'));
  assert.ok(contract.provides.includes('generic-module-contract-to-human-lesson-adapter'));
  assert.ok(contract.provides.includes('learner-visible-evidence-recap-and-targeted-repair'));
  assert.ok(contract.boundaries.refuses.includes('silent-current-completion-from-historical-edition'));
  assert.ok(contract.boundaries.refuses.includes('completion-without-visible-step-evidence'));
  assert.ok(contract.boundaries.refuses.includes('destructive-repair-overwrite-of-prior-attempts'));
  assert.ok(contract.boundaries.refuses.includes('trusted-imported-progress-or-authority'));
  assert.ok(contract.boundaries.refuses.includes('automatic-consent-resume-from-project-import'));
  assert.ok(contract.boundaries.refuses.includes('imported-code-run-as-sandbox-proof'));
});
check('Mirror school child points at the Learning Lab parent', () => assert.equal(childManifest.integratedInto, 'learning-lab'));
check('interface exposes every promised workspace surface', () => {
  ['studyPanel','assessPanel','labPanel','codePanel','classroomPanel','notebookPanel','schoolPanel','authorPanel'].forEach(id => assert.ok(html.includes('id="' + id + '"')));
  assert.ok(html.includes('mirror-learning-shell/index.html'));
});
check('Lessons interface exposes visible evidence review and targeted repair', () => {
  assert.ok(html.includes('id="lessonEvidenceField"'));
  assert.ok(html.includes('session-review.css'));
  assert.match(app, /Core\.prepareSessionReview/);
  assert.match(app, /sessionEvidenceReviewMarkup/);
  assert.match(app, /data-repair-step/);
  assert.match(app, /Revisit this step/);
  assert.match(app, /Complete after evidence review/);
  assert.match(app, /prior attempts preserved/);
  assert.match(reviewCss, /session-review-rows/);
  assert.match(reviewCss, /grid-template-columns: repeat\(auto-fit/);
});
check('interface exposes the Academy source-to-lesson front door', () => {
  ['academyFoundation','academyCategories','academyCatalog','academyDetail'].forEach(id => assert.ok(html.includes(id)));
  assert.ok(html.includes('academy-catalog.js'));
  assert.ok(html.includes('ACADEMY_SOURCE_CONTRACT.md'));
  assert.ok(app.includes('academyAddCourse'));
  assert.match(app, /loadAcademySources/);
  assert.match(app, /academy-source-catalog\.json/);
  assert.match(app, /Academy\.validateCatalog/);
  assert.match(app, /Academy\.courseFromSnapshot/);
});
check('Academy interface exposes an optional inspect-only foundation trail', () => {
  ['academyPathHeading','academyLearningPaths'].forEach(id => assert.ok(html.includes(id)));
  assert.match(html, /START HERE · OPTIONAL/);
  assert.match(html, /never enrolls you, declares mastery or turns a lesson into canon/);
  assert.match(app, /academy-learning-path-catalog\.json/);
  assert.match(app, /Academy\.validateLearningPaths/);
  assert.match(app, /Academy\.learningPathProgress/);
  assert.match(app, /currentSnapshots/);
  assert.match(app, /REVIEW_UPDATED/);
  assert.match(app, /earlier edition completion/);
  assert.match(app, /Inspect current edition/);
  assert.match(app, /data-academy-next/);
  assert.match(app, /academySelected = button\.dataset\.academyNext/);
});
check('Academy interface exposes explicit attributed start and resume continuity', () => {
  ['academyLearnerChoice','academyNewLearnerName','academyBeginCourse'].forEach(id => assert.ok(app.includes(id)));
  assert.match(app, /function beginAcademyCourse/);
  assert.match(app, /progress will resume after reload/);
  assert.match(app, /localStorage\.setItem\(STORE/);
  assert.match(app, /academyCourseProgress/);
});
check('Academy interface exposes current, changed and immutable revised-edition states', () => {
  assert.match(html, /academyLessonCount">0<\/b><span>editions/);
  assert.match(app, /CURRENT EDITION/);
  assert.match(app, /SOURCE CHANGED/);
  assert.match(app, /COMPILER UPDATED/);
  assert.match(app, /UNVERIFIED EDITION/);
  assert.match(app, /snapshot\.lessonFingerprint\.recipe/);
  assert.match(app, /courseFromSnapshot\(snapshot, \{ edition:true \}\)/);
  assert.match(app, /Add revised edition only/);
  assert.match(app, /earlier learning history preserved/);
  assert.match(app, /courseEditionLabel/);
});
check('Academy interface exposes lesson-only inheritance export and strict import', () => {
  assert.match(app, /academyExportLesson/);
  assert.match(app, /buildInheritancePacket/);
  assert.equal(typeof Academy.validateInheritancePacket, 'function');
  assert.equal(typeof Academy.matchingEdition, 'function');
  assert.match(app, /No learners, sessions, attempts, notebook entries, classroom messages or private evidence/);
  assert.match(app, /no learner or session imported/);
});
check('Academy inheritance import is preview-first and admission-second', () => {
  ['academyImportReview','academyReviewTitle','academyReviewBoundary','academyReviewFingerprint','academyReviewRecipe','academyReviewAccept','academyReviewCancel'].forEach(id => assert.ok(html.includes(id)));
  assert.match(app, /prepareInheritanceReview/);
  assert.match(app, /function openInheritanceReview/);
  assert.match(app, /human review required before admission/);
  assert.match(app, /function admitInheritanceReview/);
  assert.match(app, /Add lesson to shelf/);
  assert.match(app, /preview\.compilerRecipe/);
});
check('full-project import uses the authority-rederiving admission path', () => {
  assert.match(app, /Core\.importProject\(project\)/);
  assert.match(app, /consent reset and imported evidence re-derived/);
});
check('code practice uses a terminated worker and blocks common network routes', () => {
  assert.match(app, /new Worker/);
  assert.match(app, /execution exceeded 1500 ms/);
  assert.match(app, /WebSocket/);
  assert.match(app, /WebTransport/);
});

if (!process.exitCode) console.log('Learning Lab selftest: PASS (' + passes + ' checks)');
