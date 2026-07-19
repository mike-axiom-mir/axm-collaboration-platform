'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Core = require('./learning-lab-core');
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
check('manifest registers a visible human-machine parent', () => {
  assert.equal(manifest.id, 'learning-lab');
  assert.equal(manifest.audience, 'human-machine');
  assert.equal(manifest.status, 'TEST');
});
check('contract names the school as an integrated but separate child', () => {
  assert.equal(contract.integratedChildren[0].id, 'mirror-learning-shell');
  assert.ok(contract.integratedChildren[0].separation.includes('identity'));
  assert.ok(contract.boundaries.refuses.includes('authority-from-grade'));
});
check('Mirror school child points at the Learning Lab parent', () => assert.equal(childManifest.integratedInto, 'learning-lab'));
check('interface exposes every promised workspace surface', () => {
  ['studyPanel','assessPanel','labPanel','codePanel','classroomPanel','notebookPanel','schoolPanel','authorPanel'].forEach(id => assert.ok(html.includes('id="' + id + '"')));
  assert.ok(html.includes('mirror-learning-shell/index.html'));
});
check('code practice uses a terminated worker and blocks common network routes', () => {
  assert.match(app, /new Worker/);
  assert.match(app, /execution exceeded 1500 ms/);
  assert.match(app, /WebSocket/);
  assert.match(app, /WebTransport/);
});

if (!process.exitCode) console.log('Learning Lab selftest: PASS (' + passes + ' checks)');
