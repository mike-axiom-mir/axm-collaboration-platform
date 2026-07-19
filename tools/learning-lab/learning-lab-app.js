(function () {
  'use strict';
  var Core = window.AXMLearningLabCore;
  if (!Core) throw new Error('Learning Lab core is unavailable');
  var STORE = 'axm.learning-lab.project.v1';
  var SHARED_STORE = 'axm.learning-lab.shared.v1';
  var MODE_COPY = {
    home: ['LEARNING MAP', 'Learn with evidence, not pressure.', 'One room for lessons, practice, simulation, code, discussion and the separate machine-native school.'],
    study: ['GUIDED STUDY', 'Choose a learner. Open one bounded path.', 'Every completed step keeps a reflection or result. Nobody is enrolled merely because a seat exists.'],
    assess: ['ASSESSMENT', 'Measure this attempt—never the learner’s worth.', 'Visible questions, explicit answers and repair explanations. Scores grant no permissions or authority.'],
    lab: ['SIMULATION LAB', 'Change inputs. Watch the verdict move.', 'A small deterministic teaching model with replayable receipts and an explicit domain boundary.'],
    code: ['GUIDED CODE', 'Run code where failure is cheap.', 'A time-limited worker blocks browser data and common network APIs, then returns visible test evidence.'],
    classroom: ['VIRTUAL CLASSROOM', 'Many perspectives, one attributed record.', 'Local discussion for humans, AI collaborators and machines. Network presence remains a future adapter.'],
    notebook: ['LAB NOTEBOOK', 'Preserve the attempt, not just the answer.', 'Private learner notes and explicitly shared project notes remain distinct.'],
    school: ['AI-NATIVE SCHOOL', 'The school is inside the map—not inside every mind.', 'Learning Lab exposes the existing Forge while learner identity, memory and promotion stay in their own bodies.'],
    author: ['COURSE BUILDER', 'Build a path another mind can inspect.', 'Draft small courses from explicit steps. No course publishes or becomes canon automatically.']
  };
  var ICONS = { home:'00', study:'01', assess:'02', lab:'03', code:'04', classroom:'05', notebook:'06', school:'07', author:'08' };
  var state = loadProject();
  var shared = loadShared();
  var activeMode = Core.MODES.some(function (mode) { return mode.id === state.settings.mode; }) ? state.settings.mode : 'home';
  var codeChallenge = Core.codeChallenge('claim-repair-v1');
  var lastAssessment = null;
  var lastLab = Core.runEvidenceLab({ evidence: 2, sourceQuality: 2, contradictions: 0 });
  var codeTimer = null;

  function $(id) { return document.getElementById(id); }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>'"]/g, function (char) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]; }); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function toast(message) { var box = $('toast'); box.textContent = message; box.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(function () { box.classList.remove('show'); }, 2600); }
  function loadProject() { try { return Core.normalize(JSON.parse(localStorage.getItem(STORE) || 'null')); } catch (error) { return Core.createProject(); } }
  function actorFor(learner) { return { id: learner ? learner.id : 'local-steward', kind: learner && learner.kind === 'human' ? 'human' : 'machine', name: learner ? learner.displayName : 'Local steward' }; }
  function createShared() {
    if (!window.AXMEngines) return { project: null, room: null, evidence: null };
    return {
      project: AXMEngines.Project.create({ id: 'learning-lab', kind: 'guided-learning', name: 'Learning Lab', documentSchema: Core.FORMAT, data: { summary: Core.summary(state) }, actor: { id: 'learning-lab', kind: 'service', name: 'Learning Lab' } }),
      room: AXMEngines.Collaboration.create('Learning Lab classroom'),
      evidence: AXMEngines.Evidence.create('Learning Lab practice evidence')
    };
  }
  function loadShared() {
    try { var stored = JSON.parse(localStorage.getItem(SHARED_STORE) || 'null'); if (stored && stored.project && stored.room && stored.evidence) return stored; } catch (error) {}
    return createShared();
  }
  function syncShared(reason) {
    if (!window.AXMEngines || !shared.project) return;
    try { shared.project = AXMEngines.Project.update(shared.project, { summary: Core.summary(state), projectId: state.id, updatedAt: state.updatedAt }, { id:'learning-lab', kind:'service', name:'Learning Lab' }, reason || 'state saved'); } catch (error) {}
  }
  function addSharedEvidence(kind, statement, proof, learner) {
    if (!window.AXMEngines || !shared.evidence) return;
    try {
      var added = AXMEngines.Evidence.add(shared.evidence, { kind: kind, statement: statement, evidence: proof || [], sources: [{ text: 'Learning Lab local session receipt', kind: 'receipt' }], confidence: 'medium' }, actorFor(learner));
      shared.evidence = added.ledger;
    } catch (error) {}
  }
  function persist(message) {
    state.updatedAt = new Date().toISOString();
    syncShared(message);
    localStorage.setItem(STORE, JSON.stringify(state));
    localStorage.setItem(SHARED_STORE, JSON.stringify(shared));
    $('saveState').textContent = 'Saved ' + new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    if (window.AXMHub) AXMHub.save({ project: state, shared: shared });
    renderAll();
    if (message) toast(message);
  }
  function download(name, value) {
    var blob = new Blob([JSON.stringify(value, null, 2)], { type:'application/json' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function activeSession() { return state.sessions.find(function (session) { return session.id === state.settings.activeSessionId; }) || null; }
  function activeLearner() { return state.learners.find(function (learner) { return learner.id === state.settings.activeLearnerId; }) || null; }
  function activeCourse() { return state.courses.find(function (course) { return course.id === state.settings.activeCourseId; }) || state.courses[0]; }

  function renderNav() {
    $('modeNav').innerHTML = Core.MODES.map(function (mode) { return '<button class="mode-button" data-mode="' + esc(mode.id) + '"><i>' + ICONS[mode.id] + '</i><b>' + esc(mode.title) + '</b></button>'; }).join('');
    $('modeNav').querySelectorAll('[data-mode]').forEach(function (button) { button.onclick = function () { selectMode(button.dataset.mode); }; });
    document.querySelectorAll('[data-mode-jump]').forEach(function (button) { button.onclick = function () { selectMode(button.dataset.modeJump); }; });
  }
  function selectMode(mode) {
    activeMode = MODE_COPY[mode] ? mode : 'home'; state.settings.mode = activeMode;
    document.querySelectorAll('.mode-panel').forEach(function (panel) { panel.hidden = panel.id !== activeMode + 'Panel'; });
    document.querySelectorAll('.mode-button').forEach(function (button) { button.classList.toggle('active', button.dataset.mode === activeMode); });
    $('modeKicker').textContent = MODE_COPY[activeMode][0]; $('modeTitle').textContent = MODE_COPY[activeMode][1]; $('modeDescription').textContent = MODE_COPY[activeMode][2];
    if (activeMode === 'school' && !$('schoolFrame').dataset.loaded) { $('schoolFrame').src = $('schoolFrame').dataset.src; $('schoolFrame').dataset.loaded = '1'; checkSchool(); }
    renderAll();
  }

  function learnerOptions(selectedId) {
    if (!state.learners.length) return '<option value="">No learners yet</option>';
    return state.learners.map(function (learner) { return '<option value="' + esc(learner.id) + '"' + (learner.id === selectedId ? ' selected' : '') + '>' + esc(learner.displayName) + ' · ' + esc(learner.kind) + (learner.optedIn ? ' · opted in' : ' · paused') + '</option>'; }).join('');
  }
  function courseOptions(selectedId) { return state.courses.map(function (course) { return '<option value="' + esc(course.id) + '"' + (course.id === selectedId ? ' selected' : '') + '>' + esc(course.title) + ' · ' + esc(course.status) + '</option>'; }).join(''); }
  function renderMetrics() {
    var summary = Core.summary(state), session = activeSession();
    $('metricCourses').textContent = summary.courses; $('metricLearners').textContent = summary.learners; $('metricSessions').textContent = summary.activeSessions; $('metricReceipts').textContent = state.receipts.length;
    $('projectTitle').textContent = state.title; $('courseCount').textContent = summary.courses; $('learnerCount').textContent = summary.learners; $('activeCount').textContent = summary.activeSessions;
    $('footerStatus').textContent = session ? session.status + ' · ' + session.learnerId + ' · ' + session.courseId : 'Ready · no active learner';
  }
  function renderHome() {
    $('courseShelf').innerHTML = state.courses.map(function (course) { return '<article class="course-item" data-course="' + esc(course.id) + '"><span>' + esc(course.level) + ' · ' + course.steps.length + ' STEPS · ' + esc(course.status) + '</span><b>' + esc(course.title) + '</b><small>' + esc(course.summary) + '</small></article>'; }).join('');
    $('courseShelf').querySelectorAll('[data-course]').forEach(function (card) { card.onclick = function () { state.settings.activeCourseId = card.dataset.course; $('courseSelect').value = card.dataset.course; selectMode('study'); }; });
    $('learnerList').innerHTML = state.learners.length ? state.learners.map(function (learner) { return '<article class="learner-item"><span>' + esc(learner.kind.toUpperCase()) + ' · ' + (learner.optedIn ? 'OPTED IN' : 'PAUSED') + '</span><b>' + esc(learner.displayName) + '</b><small>' + learner.privateProfile.completedSessions + ' completed · ' + learner.privateProfile.repairSessions + ' repair · ' + learner.privateProfile.reviewedSteps + ' steps</small></article>'; }).join('') : '<div class="empty">No learner has been added.</div>';
    var session = activeSession();
    if (!session) $('activeSessionHome').outerHTML = '<div id="activeSessionHome" class="empty">Nothing is running. Time exists; no session is forced.</div>';
    else {
      var course = state.courses.find(function (item) { return item.id === session.courseId; }), learner = state.learners.find(function (item) { return item.id === session.learnerId; });
      $('activeSessionHome').outerHTML = '<div id="activeSessionHome" class="truth-box"><b>' + esc(learner ? learner.displayName : session.learnerId) + '</b><br>' + esc(course ? course.title : session.courseId) + '<br>Step ' + Math.min(session.currentStep + 1, course.steps.length) + ' / ' + course.steps.length + ' · ' + esc(session.status) + '</div>';
    }
  }
  function renderLearnersAndSession() {
    var learner = activeLearner(), session = activeSession();
    ['learnerSelect','classroomLearner','notebookLearner','schoolLearner'].forEach(function (id) { $(id).innerHTML = learnerOptions(id === 'learnerSelect' ? state.settings.activeLearnerId : ($(id).value || state.settings.activeLearnerId)); });
    $('courseSelect').innerHTML = courseOptions(state.settings.activeCourseId);
    if (!learner) { $('sessionGate').textContent = 'NO LEARNER'; $('sessionGate').className = 'status held'; $('selectedLearnerTruth').textContent = 'Choose an attributed learner.'; $('toggleOptIn').disabled = true; $('startSession').disabled = true; }
    else {
      $('sessionGate').textContent = learner.optedIn ? 'OPTED IN' : 'PAUSED'; $('sessionGate').className = 'status ' + (learner.optedIn ? 'ready' : 'held');
      $('selectedLearnerTruth').innerHTML = '<b>' + esc(learner.displayName) + '</b> · ' + esc(learner.kind) + '<br>Identity, notes, results and school state remain attributed to <code>' + esc(learner.id) + '</code>.';
      $('toggleOptIn').disabled = false; $('toggleOptIn').textContent = learner.optedIn ? 'Pause learner' : 'Explicitly opt in'; $('startSession').disabled = !learner.optedIn || !!(session && session.status !== 'COMPLETE');
    }
    renderLesson();
  }
  function renderLesson() {
    var session = activeSession();
    if (!session) { $('lessonTitle').textContent = 'No active lesson'; $('lessonProgress').textContent = '0 / 0'; $('lessonBody').innerHTML = '<div class="empty">Start a session to open the first step.</div>'; $('openStepTool').disabled = true; $('completeStep').disabled = true; return; }
    var course = state.courses.find(function (item) { return item.id === session.courseId; });
    if (session.status === 'PAUSED') {
      $('lessonTitle').textContent = 'Session paused by learner'; $('lessonProgress').textContent = session.currentStep + ' / ' + course.steps.length;
      $('lessonBody').innerHTML = '<h4>Consent is currently paused.</h4><p>The session and its evidence remain preserved, but no next step may be recorded until this learner explicitly opts in again.</p>';
      $('openStepTool').disabled = true; $('completeStep').disabled = true; $('completeStep').textContent = 'Paused'; return;
    }
    if (session.status === 'READY_FOR_REVIEW' || session.status === 'REPAIR') {
      $('lessonTitle').textContent = session.status === 'REPAIR' ? 'Repair review' : 'Session ready for review'; $('lessonProgress').textContent = course.steps.length + ' / ' + course.steps.length;
      $('lessonBody').innerHTML = '<h4>' + esc(course.title) + '</h4><p>All ordered steps carry evidence. Review the sequence before closing it. Completion remains a session receipt—not permission, wisdom or canon.</p><p class="prompt">Use the button below as the explicit review gate.</p>';
      $('openStepTool').disabled = true; $('completeStep').disabled = false; $('completeStep').textContent = 'Review + complete session'; return;
    }
    var step = course.steps[session.currentStep];
    $('lessonTitle').textContent = step.title; $('lessonProgress').textContent = (session.currentStep + 1) + ' / ' + course.steps.length;
    var detail = step.body || (step.type === 'flashcards' ? step.cards.length + ' cards are ready in this step.' : step.type === 'assessment' ? step.questions.length + ' visible questions are ready.' : 'Open the dedicated tool, make one bounded attempt, then preserve what it showed.');
    $('lessonBody').innerHTML = '<span class="eyebrow">' + esc(step.type.toUpperCase()) + ' · ' + step.minutes + ' MIN</span><h4>' + esc(step.title) + '</h4><p>' + esc(detail) + '</p><p class="prompt">' + esc(step.prompt || 'Record what the attempt showed.') + '</p>' + renderStepExtra(step);
    $('openStepTool').disabled = ['lesson','reflection'].indexOf(step.type) >= 0; $('openStepTool').textContent = step.type === 'flashcards' ? 'Review cards' : step.type === 'assessment' ? 'Open assessment' : step.type === 'simulation' ? 'Open lab' : step.type === 'coding' ? 'Open code bench' : 'Open step tool';
    $('completeStep').disabled = false; $('completeStep').textContent = 'Record step + continue';
  }
  function renderStepExtra(step) {
    if (step.type !== 'flashcards') return '';
    return '<div class="test-preview">' + step.cards.map(function (card) { return '<span><b>' + esc(card.front) + '</b><br>' + esc(card.back) + '</span>'; }).join('') + '</div>';
  }
  function renderAssessment() {
    var course = activeCourse(), step = course && course.steps.find(function (item) { return item.type === 'assessment'; });
    if (!step) { $('assessmentQuestions').innerHTML = '<div class="empty">The selected course has no assessment.</div>'; $('gradeAssessment').disabled = true; return; }
    $('gradeAssessment').disabled = false;
    $('assessmentQuestions').innerHTML = step.questions.map(function (question, index) { return '<article class="question"><b>' + (index + 1) + '. ' + esc(question.prompt) + '</b>' + question.options.map(function (option, optionIndex) { return '<label><input type="radio" name="' + esc(question.id) + '" value="' + optionIndex + '"> ' + esc(option) + '</label>'; }).join('') + '</article>'; }).join('');
    renderAssessmentResult();
  }
  function renderAssessmentResult() {
    if (!lastAssessment) { $('assessmentResult').outerHTML = '<div id="assessmentResult" class="empty">Nothing graded. A score describes this bounded attempt only.</div>'; return; }
    $('assessmentResult').outerHTML = '<div id="assessmentResult"><b class="result-score">' + lastAssessment.correct + '/' + lastAssessment.total + '</b><p>' + lastAssessment.percent + '% on this attempt · authority NONE</p>' + lastAssessment.rows.map(function (row) { return '<div class="result-row ' + (row.correct ? 'pass' : 'fail') + '"><b>' + (row.correct ? 'SUPPORTED' : 'REPAIR') + '</b><small>' + esc(row.why) + '</small></div>'; }).join('') + '</div>';
  }
  function renderLab() {
    var result = lastLab; $('labVerdict').textContent = result.verdict; $('labScore').textContent = result.score; $('labMeter').style.width = Math.max(0, Math.min(100, result.score)) + '%'; $('labExplanation').textContent = result.explanation; $('labReceipt').textContent = JSON.stringify(result, null, 2);
    $('labHistory').innerHTML = state.labRuns.length ? state.labRuns.slice(-8).reverse().map(function (run) { return '<article class="history-item"><span>' + esc(run.verdict) + ' · SCORE ' + run.score + '</span><small>E ' + run.inputs.evidence + ' · S ' + run.inputs.sourceQuality + ' · C ' + run.inputs.contradictions + '<br>' + new Date(run.at).toLocaleString() + '</small></article>'; }).join('') : '<div class="empty">No runs recorded.</div>';
  }
  function renderCode() {
    $('codeChallengeTitle').textContent = codeChallenge.title; $('codePrompt').textContent = codeChallenge.prompt; $('codeBoundary').textContent = codeChallenge.boundary;
    $('codeTestsPreview').innerHTML = codeChallenge.tests.map(function (test, index) { return '<span>' + (index === codeChallenge.tests.length - 1 ? 'HELD-OUT' : 'VISIBLE') + ' · ' + esc(test.name) + '</span>'; }).join('');
    if (!$('codeSource').value) $('codeSource').value = codeChallenge.starter;
  }
  function renderClassroom() {
    $('classroomFeed').innerHTML = state.classroom.length ? state.classroom.slice().reverse().map(function (message) { return '<article class="message-item ' + esc(message.kind) + '"><span>' + esc(message.kind.toUpperCase()) + ' · ' + new Date(message.at).toLocaleString() + '</span><b>' + esc(message.author) + '</b><p>' + esc(message.body) + '</p></article>'; }).join('') : '<div class="empty">No messages yet.</div>';
    $('sendClassroom').disabled = !state.learners.length;
  }
  function renderNotebook() {
    $('noteCount').textContent = state.notebook.length; $('addNote').disabled = !state.learners.length;
    $('notebookEntries').innerHTML = state.notebook.length ? state.notebook.slice().reverse().map(function (entry) { return '<article class="note-item ' + esc(entry.visibility) + '"><span>' + esc(entry.visibility.toUpperCase()) + ' · ' + new Date(entry.at).toLocaleString() + '</span><b>' + esc(entry.title) + '</b><p>' + esc(entry.body) + '</p><small>' + esc(entry.evidence || 'No external evidence named') + ' · ' + esc(entry.learnerId) + '</small></article>'; }).join('') : '<div class="empty">No notebook entries.</div>';
  }
  function renderSchool() {
    $('schoolState').textContent = state.school.state; $('schoolState').className = 'status ' + (state.school.state === 'READY' ? 'ready' : 'held'); $('schoolDetail').textContent = state.school.state === 'READY' ? 'Local Forge answered. Track catalog is inspectable.' : state.school.state === 'OFFLINE' ? 'The optional school is not running. Learning Lab remains usable.' : 'Looking for the local Forge.';
    $('schoolTrackCount').textContent = state.school.tracks.length;
    $('schoolTracks').innerHTML = state.school.tracks.length ? state.school.tracks.map(function (track) { return '<article class="track-item"><span>' + esc((track.status || 'AVAILABLE').toUpperCase()) + '</span><b>' + esc(track.title || track.name || track.id) + '</b><small>' + esc(track.summary || track.purpose || track.description || 'Portable attributed study track.') + '</small></article>'; }).join('') : '<div class="empty">No live tracks loaded. The school may be offline; built-in Lab courses remain available.</div>';
  }
  function renderAll() { renderMetrics(); renderHome(); renderLearnersAndSession(); renderAssessment(); renderLab(); renderCode(); renderClassroom(); renderNotebook(); renderSchool(); }

  function addLearner() {
    try { var result = Core.addLearner(state, { id:$('newLearnerId').value, displayName:$('newLearnerName').value, kind:$('newLearnerKind').value, optedIn:$('newLearnerOptIn').checked }); state = result.project; ['newLearnerId','newLearnerName'].forEach(function (id) { $(id).value = ''; }); $('newLearnerOptIn').checked = false; persist('Added separate learner seat: ' + result.learner.displayName); } catch (error) { toast(error.message); }
  }
  function selectLearner() { state.settings.activeLearnerId = $('learnerSelect').value || null; renderAll(); }
  function selectCourse() { state.settings.activeCourseId = $('courseSelect').value; renderAll(); }
  function toggleOptIn() { var learner = activeLearner(); if (!learner) return; state = Core.setOptIn(state, learner.id, !learner.optedIn); persist(learner.optedIn ? 'Learner paused' : 'Learner explicitly opted in'); }
  function startSession() { try { var result = Core.startSession(state, { learnerId:state.settings.activeLearnerId, courseId:state.settings.activeCourseId }); state = result.project; persist('Started bounded learning session'); } catch (error) { toast(error.message); } }
  function openStepTool() { var session = activeSession(), step = session && Core.currentStep(state, session.id); if (!step) return; selectMode(step.type === 'assessment' ? 'assess' : step.type === 'simulation' ? 'lab' : step.type === 'coding' ? 'code' : 'study'); }
  function finishOrAdvance() {
    var session = activeSession(); if (!session) return;
    try {
      if (session.status === 'READY_FOR_REVIEW' || session.status === 'REPAIR') { var reviewed = Core.reviewSession(state, { sessionId:session.id, decision:'COMPLETE', note:'Explicit Learning Lab interface review: ordered evidence-bearing steps preserved.', reviewer:'local-steward' }); state = reviewed.project; persist('Session reviewed and completed · no authority granted'); return; }
      var evidence = $('lessonEvidence').value.trim(); var step = Core.currentStep(state, session.id); var result = Core.completeStep(state, { sessionId:session.id, stepId:step.id, evidence:evidence, result:'RECORDED' }); state = result.project; $('lessonEvidence').value = ''; persist(result.session.status === 'READY_FOR_REVIEW' ? 'All steps recorded · explicit review still required' : 'Step recorded · next practice opened');
    } catch (error) { toast(error.message); }
  }
  function gradeAssessment() {
    var course = activeCourse(), step = course.steps.find(function (item) { return item.type === 'assessment'; }), answers = {};
    if (!step) return;
    step.questions.forEach(function (question) { var checked = document.querySelector('input[name="' + question.id + '"]:checked'); if (checked) answers[question.id] = Number(checked.value); });
    try {
      var session = activeSession();
      if (session && session.courseId === course.id) { var recorded = Core.recordAssessment(state, { sessionId:session.id, answers:answers }); state = recorded.project; lastAssessment = recorded.result; addSharedEvidence('test', 'Assessment attempt ' + recorded.result.correct + '/' + recorded.result.total, ['assessment:' + recorded.result.stepId], activeLearner()); persist('Assessment recorded · result grants no authority'); }
      else { lastAssessment = Core.scoreAssessment(course, answers); renderAssessmentResult(); toast('Preview scored · start the matching course to preserve it'); }
    } catch (error) { toast(error.message); }
  }
  function updateLabPreview() { ['evidence','source','contradiction'].forEach(function (name) { $(name + 'Out').textContent = $(name + 'Input').value; }); lastLab = Core.runEvidenceLab({ evidence:$('evidenceInput').value, sourceQuality:$('sourceInput').value, contradictions:$('contradictionInput').value }); renderLab(); }
  function runLab() {
    try { var session = activeSession(); if (session) { var recorded = Core.recordLabRun(state, { sessionId:session.id, evidence:$('evidenceInput').value, sourceQuality:$('sourceInput').value, contradictions:$('contradictionInput').value }); state = recorded.project; lastLab = recorded.result; addSharedEvidence('test', 'Deterministic lab returned ' + recorded.result.verdict, ['lab:' + recorded.result.id, JSON.stringify(recorded.result.inputs)], activeLearner()); persist('Simulation receipt preserved'); } else { updateLabPreview(); toast('Preview ran · start a session to preserve its receipt'); } } catch (error) { toast(error.message); }
  }

  function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') { var out = {}; Object.keys(value).sort().forEach(function (key) { out[key] = stable(value[key]); }); return out; } return value; }
  function runCodeSandbox() {
    clearTimeout(codeTimer); $('runCode').disabled = true; $('codeState').textContent = 'RUNNING'; $('codeState').style.color = 'var(--gold)';
    var source = $('codeSource').value, workerText = [
      "'use strict';",
      "['fetch','WebSocket','XMLHttpRequest','EventSource','WebTransport','importScripts','Worker','SharedWorker'].forEach(function(k){try{self[k]=function(){throw new Error('network and nested workers are blocked');};}catch(e){}});",
      "function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object'){var o={};Object.keys(v).sort().forEach(function(k){o[k]=stable(v[k]);});return o;}return v;}",
      "self.onmessage=function(e){var d=e.data,rows=[];try{var fn=new Function(d.source+'\\n;return typeof '+d.functionName+\"==='function'?\"+d.functionName+':null;')();if(!fn)throw new Error('required function not found: '+d.functionName);d.tests.forEach(function(t){try{var input=JSON.parse(JSON.stringify(t.input)),out=fn(input),pass=JSON.stringify(stable(out))===JSON.stringify(stable(t.expect));rows.push({name:t.name,pass:pass,detail:pass?'output matched':('expected '+JSON.stringify(t.expect)+'; received '+JSON.stringify(out))});}catch(err){rows.push({name:t.name,pass:false,detail:err.message});}});self.postMessage({ok:true,tests:rows});}catch(err){self.postMessage({ok:false,error:err.message,tests:rows});}};"
    ].join('\n');
    var url = URL.createObjectURL(new Blob([workerText], { type:'text/javascript' })), worker = new Worker(url), finished = false;
    function finish(payload) { if (finished) return; finished = true; clearTimeout(codeTimer); worker.terminate(); URL.revokeObjectURL(url); $('runCode').disabled = false; handleCodeResult(source, payload); }
    worker.onmessage = function (event) { finish(event.data); }; worker.onerror = function (event) { finish({ ok:false, error:event.message || 'sandbox worker failed', tests:[] }); };
    codeTimer = setTimeout(function () { finish({ ok:false, error:'execution exceeded 1500 ms and was terminated', tests:[] }); }, 1500);
    worker.postMessage({ source:source, functionName:codeChallenge.functionName, tests:clone(codeChallenge.tests) });
  }
  function handleCodeResult(source, payload) {
    var tests = payload.tests || [], passed = tests.filter(function (test) { return test.pass; }).length;
    $('codeState').textContent = payload.ok && passed === tests.length ? 'PASS' : 'REPAIR'; $('codeState').style.color = payload.ok && passed === tests.length ? 'var(--green)' : 'var(--red)'; $('codeScore').textContent = passed + ' / ' + codeChallenge.tests.length;
    $('codeResultList').innerHTML = payload.error ? '<article class="test-result fail"><b>SANDBOX HELD</b><small>' + esc(payload.error) + '</small></article>' : tests.map(function (test) { return '<article class="test-result ' + (test.pass ? 'pass' : 'fail') + '"><b>' + (test.pass ? 'PASS' : 'REPAIR') + ' · ' + esc(test.name) + '</b><small>' + esc(test.detail) + '</small></article>'; }).join('');
    var session = activeSession();
    if (session && tests.length) { try { var recorded = Core.recordCodeRun(state, { sessionId:session.id, challengeId:codeChallenge.id, source:source, tests:tests }); state = recorded.project; addSharedEvidence('test', 'Guided code run returned ' + recorded.result.state, ['code:' + recorded.result.id, recorded.result.passed + '/' + recorded.result.total], activeLearner()); persist('Code run preserved · ' + recorded.result.state); } catch (error) { toast(error.message); } }
    else toast(session ? 'Sandbox returned without a test receipt' : 'Code preview complete · start a session to preserve it');
  }
  function sendClassroom() {
    try { var learnerId = $('classroomLearner').value, learner = state.learners.find(function (item) { return item.id === learnerId; }); var result = Core.addClassroomMessage(state, { learnerId:learnerId, body:$('classroomMessage').value, sessionId:state.settings.activeSessionId }); state = result.project; if (window.AXMEngines && shared.room) { shared.room = AXMEngines.Collaboration.join(shared.room, actorFor(learner)); var posted = AXMEngines.Collaboration.post(shared.room, 'comment', { body:result.message.body, target:'' }, actorFor(learner)); shared.room = posted.room; } $('classroomMessage').value = ''; persist('Attributed classroom message preserved'); } catch (error) { toast(error.message); }
  }
  function addNote() {
    try { var result = Core.addNotebookEntry(state, { learnerId:$('notebookLearner').value, title:$('noteTitle').value, body:$('noteBody').value, evidence:$('noteEvidence').value, visibility:$('noteVisibility').value, sessionId:state.settings.activeSessionId }); state = result.project; ['noteTitle','noteBody','noteEvidence'].forEach(function (id) { $(id).value = ''; }); persist('Notebook entry preserved · ' + result.entry.visibility); } catch (error) { toast(error.message); }
  }
  function normalizeTracks(value) {
    if (Array.isArray(value)) return value.map(function (track, index) { return typeof track === 'string' ? { id:track, title:track } : Object.assign({ id:track.id || ('track-' + index) }, track); });
    if (!value || typeof value !== 'object') return [];
    if (Array.isArray(value.tracks)) return normalizeTracks(value.tracks);
    return Object.keys(value).filter(function (key) { return typeof value[key] === 'object'; }).map(function (key) { return Object.assign({ id:key, title:key.replace(/[_-]/g, ' ') }, value[key]); });
  }
  function checkSchool() {
    $('schoolState').textContent = 'CHECKING'; $('schoolState').className = 'status held'; $('checkSchool').disabled = true;
    fetch('/services/ai-learning-forge/api/health', { cache:'no-store' }).then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); }).then(function () { return fetch('/services/ai-learning-forge/api/tracks', { cache:'no-store' }); }).then(function (response) { if (!response.ok) throw new Error('tracks HTTP ' + response.status); return response.json(); }).then(function (body) { state = Core.setSchoolStatus(state, { state:'READY', tracks:normalizeTracks(body.result || body.tracks || body) }); persist('AI Learning Forge is ready · separate school state preserved'); }).catch(function () { state = Core.setSchoolStatus(state, { state:'OFFLINE', tracks:[] }); persist(); }).finally(function () { $('checkSchool').disabled = false; renderSchool(); });
  }
  function buildSchoolHandoff() {
    try { var packet = Core.schoolHandoff(state, { learnerId:$('schoolLearner').value, curriculumId:$('schoolCurriculum').value, purpose:$('schoolPurpose').value }); $('schoolProposal').textContent = JSON.stringify(packet, null, 2); toast('Proposal built · nothing enrolled or submitted'); } catch (error) { toast(error.message); }
  }
  function createCourse() {
    try {
      var steps = $('courseSteps').value.split(/\r?\n/).map(function (line, index) { var parts = line.split('|').map(function (part) { return part.trim(); }); return { id:'custom-' + (index + 1), type:parts[0], title:parts[1], prompt:parts.slice(2).join(' | '), body:'Local authored learning step.', minutes:5 }; }).filter(function (step) { return step.title; });
      var result = Core.addCourse(state, { title:$('courseTitle').value, summary:$('courseSummary').value, steps:steps }); state = result.project; $('authorResult').outerHTML = '<div id="authorResult" class="truth-box"><b>' + esc(result.course.title) + '</b><br>' + result.course.steps.length + ' draft steps · authority NONE · local only</div>'; ['courseTitle','courseSummary','courseSteps'].forEach(function (id) { $(id).value = ''; }); persist('Draft course created');
    } catch (error) { toast(error.message); }
  }

  function bind() {
    $('addLearner').onclick = addLearner; $('learnerSelect').onchange = selectLearner; $('courseSelect').onchange = selectCourse; $('toggleOptIn').onclick = toggleOptIn; $('startSession').onclick = startSession; $('openStepTool').onclick = openStepTool; $('completeStep').onclick = finishOrAdvance;
    $('gradeAssessment').onclick = gradeAssessment; ['evidenceInput','sourceInput','contradictionInput'].forEach(function (id) { $(id).oninput = updateLabPreview; }); $('runLab').onclick = runLab;
    $('resetCode').onclick = function () { $('codeSource').value = codeChallenge.starter; toast('Starter restored'); }; $('runCode').onclick = runCodeSandbox;
    $('sendClassroom').onclick = sendClassroom; $('addNote').onclick = addNote; $('checkSchool').onclick = checkSchool; $('buildSchoolHandoff').onclick = buildSchoolHandoff; $('createCourse').onclick = createCourse;
    $('exportProject').onclick = function () { download('AXM_LEARNING_LAB_' + state.id + '.json', Core.exportPacket(state)); toast('Portable learning project exported'); };
    $('importProject').onchange = function (event) { var file = event.target.files[0]; if (!file) return; file.text().then(function (content) { var parsed = JSON.parse(content), project = parsed.project || parsed; if (project.schema !== Core.FORMAT) throw new Error('not a Learning Lab project'); state = Core.normalize(project); persist('Learning project imported explicitly'); }).catch(function (error) { toast(error.message); }); event.target.value = ''; };
    $('newProject').onclick = function () { if (!window.confirm('Start a fresh Learning Lab project? Export first if this project matters.')) return; state = Core.createProject(); shared = createShared(); persist('Fresh Learning Lab project created'); selectMode('home'); };
  }

  function init(saved) {
    if (saved && saved.project && saved.project.schema === Core.FORMAT) state = Core.normalize(saved.project);
    if (saved && saved.shared) shared = saved.shared;
    renderNav(); bind(); selectMode(activeMode); updateLabPreview();
  }
  if (window.AXMHub) {
    AXMHub.onInit(function (payload) { init(payload && payload.savedState); });
    AXMHub.ready({ id:'learning-lab', name:'AXM Learning Lab', version:'v0.1', hubApiVersion:'1.0', permissions:['storage','export','shared-engines'], savesState:true, handlesShutdown:false, capabilities:['lessons','assessment','simulation','sandboxed-code','classroom','notebook','course-authoring','school-door'] });
  } else init();
}());
