(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMLearningLabCore = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FORMAT = 'axm.learning-lab.project/v1';
  var VERSION = 1;
  var MODES = [
    { id: 'home', title: 'Academy' },
    { id: 'study', title: 'Lessons' },
    { id: 'assess', title: 'Assessment' },
    { id: 'lab', title: 'Simulation lab' },
    { id: 'code', title: 'Guided code' },
    { id: 'classroom', title: 'Classroom' },
    { id: 'notebook', title: 'Lab notebook' },
    { id: 'school', title: 'AI Learning Forge' },
    { id: 'author', title: 'Course builder' }
  ];
  var LEARNER_KINDS = ['human', 'ai', 'machine'];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function now() { return new Date().toISOString(); }
  function text(value, fallback) {
    var out = String(value == null ? '' : value).trim();
    return out || (fallback || '');
  }
  function id(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function clamp(value, min, max) {
    value = Number(value);
    if (!Number.isFinite(value)) value = min;
    return Math.max(min, Math.min(max, value));
  }
  function find(list, itemId, label) {
    var item = (list || []).find(function (entry) { return entry.id === itemId; });
    if (!item) throw new Error((label || 'item') + ' not found: ' + itemId);
    return item;
  }
  function records(value) {
    return Array.isArray(value) ? value.filter(function (item) { return item && typeof item === 'object' && !Array.isArray(item); }) : [];
  }
  function assertUniqueIds(items, label) {
    var seen = Object.create(null);
    items.forEach(function (item) {
      var itemId = text(item.id);
      if (!itemId) throw new Error((label || 'record') + ' id is required');
      if (seen[itemId]) throw new Error('duplicate ' + (label || 'record') + ' id: ' + itemId);
      seen[itemId] = true;
    });
    return items;
  }

  var BUILTIN_COURSES = [
    {
      id: 'common-ground-v1',
      title: 'Common Ground: Honest Learning',
      summary: 'A shared first course for human and machine learners: evidence, uncertainty, consent, repair and transfer.',
      level: 'FOUNDATION',
      source: 'learning-lab',
      status: 'WORKING',
      authority: 'NONE',
      tags: ['truth', 'repair', 'human-machine', 'foundations'],
      steps: [
        { id: 'cg-observe', type: 'lesson', title: 'Observe before concluding', minutes: 6, body: 'Separate what was observed from what was inferred. A fluent explanation is still a proposal until evidence supports it.', prompt: 'Write one observation and one inference about the same event.' },
        { id: 'cg-cards', type: 'flashcards', title: 'Truth vocabulary', minutes: 5, cards: [
          { id: 'candidate', front: 'Candidate', back: 'A useful proposal that has not yet earned verified status.' },
          { id: 'seam', front: 'Seam', back: 'A named gap, contradiction or boundary where the current structure may fail.' },
          { id: 'receipt', front: 'Receipt', back: 'A replayable record of what was attempted, observed and decided.' }
        ] },
        { id: 'cg-assess', type: 'assessment', title: 'Claim-state check', minutes: 7, questions: [
          { id: 'q1', prompt: 'A polished answer has no source. What state has it earned?', options: ['VERIFIED', 'CANDIDATE', 'CANON'], correct: 1, why: 'Fluency is not evidence.' },
          { id: 'q2', prompt: 'A test fails. What should happen to the failed attempt?', options: ['Delete it', 'Preserve it and repair', 'Rename it success'], correct: 1, why: 'Failure becomes useful when its evidence survives.' },
          { id: 'q3', prompt: 'A learner receives a high score. What authority follows?', options: ['None', 'Tool authority', 'Canon authority'], correct: 0, why: 'Grades describe bounded performance; they never grant authority.' }
        ] },
        { id: 'cg-lab', type: 'simulation', title: 'Evidence pressure bench', minutes: 8, lab: 'evidence-pressure-v1', prompt: 'Change evidence, source quality and contradictions. Watch when the honest verdict changes.' },
        { id: 'cg-code', type: 'coding', title: 'Repair a claim packet', minutes: 12, challenge: 'claim-repair-v1', prompt: 'Complete repair(packet) so unsupported VERIFIED claims become CANDIDATE without deleting the claim.' },
        { id: 'cg-reflect', type: 'reflection', title: 'Transfer note', minutes: 5, body: 'Name one place outside this lesson where the same observation → test → repair loop could help.', prompt: 'Write a bounded transfer claim and the first test you would use.' }
      ]
    },
    {
      id: 'guided-code-v1',
      title: 'Guided Code: State Without Guessing',
      summary: 'Small deterministic exercises for reading, validating and repairing state without hidden execution authority.',
      level: 'EARLY PRACTICE',
      source: 'learning-lab',
      status: 'TEST',
      authority: 'NONE',
      tags: ['json', 'code', 'state', 'tests'],
      steps: [
        { id: 'code-read', type: 'lesson', title: 'Read the contract first', minutes: 5, body: 'Inputs, outputs, refused actions and tests are part of the program. Code is not complete merely because it runs.', prompt: 'List the input and output contract before editing.' },
        { id: 'code-practice', type: 'coding', title: 'Repair a claim packet', minutes: 12, challenge: 'claim-repair-v1', prompt: 'Pass the visible and held-out state checks.' },
        { id: 'code-note', type: 'reflection', title: 'Explain the repair', minutes: 5, body: 'Describe what changed, what was preserved and what remains unknown.', prompt: 'Write a three-line repair receipt.' }
      ]
    }
  ];

  var CODE_CHALLENGES = {
    'claim-repair-v1': {
      id: 'claim-repair-v1',
      title: 'Repair a claim packet',
      functionName: 'repair',
      prompt: 'Return a new packet. Preserve claim and evidence. If state is VERIFIED but evidence is empty, set state to CANDIDATE and add uncertainty: "evidence missing".',
      starter: "function repair(packet) {\n  // Preserve the input. Return a repaired copy.\n  return packet;\n}",
      tests: [
        { name: 'holds unsupported verification', input: { claim: 'Bridge works', state: 'VERIFIED', evidence: [] }, expect: { claim: 'Bridge works', state: 'CANDIDATE', evidence: [], uncertainty: 'evidence missing' } },
        { name: 'preserves evidenced verification', input: { claim: '2 tests pass', state: 'VERIFIED', evidence: ['T1', 'T2'] }, expect: { claim: '2 tests pass', state: 'VERIFIED', evidence: ['T1', 'T2'] } },
        { name: 'does not promote candidates', input: { claim: 'Maybe useful', state: 'CANDIDATE', evidence: [] }, expect: { claim: 'Maybe useful', state: 'CANDIDATE', evidence: [] } }
      ],
      boundary: 'Executed in a time-limited, network-blocked sandbox. Passing tests grants no Workshop or school authority.'
    }
  };

  function createProject(input) {
    input = input && typeof input === 'object' ? input : {};
    var stamp = now();
    return {
      schema: FORMAT,
      version: VERSION,
      id: text(input.id, id('learning-project')),
      title: text(input.title, 'Learning Lab'),
      owner: text(input.owner, 'local-steward'),
      createdAt: stamp,
      updatedAt: stamp,
      courses: clone(BUILTIN_COURSES),
      learners: [],
      sessions: [],
      notebook: [],
      classroom: [],
      labRuns: [],
      codeRuns: [],
      receipts: [],
      school: { childId: 'mirror-learning-shell', service: 'mirror-learning-forge', state: 'UNKNOWN', tracks: [], checkedAt: null },
      settings: { activeCourseId: 'common-ground-v1', activeLearnerId: null, activeSessionId: null, mode: 'home' }
    };
  }

  function normalize(input) {
    if (!input || input.schema !== FORMAT) return createProject(input);
    var base = createProject(input);
    Object.keys(base).forEach(function (key) {
      if (input[key] != null) base[key] = clone(input[key]);
    });
    base.courses = Array.isArray(input.courses) && input.courses.length ? clone(input.courses) : clone(BUILTIN_COURSES);
    base.learners = Array.isArray(input.learners) ? clone(input.learners) : [];
    base.sessions = Array.isArray(input.sessions) ? clone(input.sessions) : [];
    base.sessions.forEach(function (session) {
      if (!Array.isArray(session.repairHistory)) session.repairHistory = [];
      if (!Object.prototype.hasOwnProperty.call(session, 'activeRepairId')) session.activeRepairId = null;
    });
    base.notebook = Array.isArray(input.notebook) ? clone(input.notebook) : [];
    base.classroom = Array.isArray(input.classroom) ? clone(input.classroom) : [];
    base.labRuns = Array.isArray(input.labRuns) ? clone(input.labRuns) : [];
    base.codeRuns = Array.isArray(input.codeRuns) ? clone(input.codeRuns) : [];
    base.receipts = Array.isArray(input.receipts) ? clone(input.receipts) : [];
    base.updatedAt = text(input.updatedAt, now());
    return base;
  }

  function importProject(input) {
    if (!input || input.schema !== FORMAT) throw new Error('not a Learning Lab project');
    var project = normalize(input);
    project.courses = assertUniqueIds(records(project.courses), 'course').map(function (course) {
      var copy = clone(course);
      copy.authority = 'NONE';
      copy.steps = assertUniqueIds(records(copy.steps), 'course step');
      if (!text(copy.title) || !copy.steps.length) throw new Error('imported course needs a title and steps: ' + copy.id);
      return copy;
    });
    project.learners = assertUniqueIds(records(project.learners), 'learner').map(function (learner) {
      var kind = text(learner.kind, 'human').toLowerCase();
      if (learner.attributed !== true) throw new Error('unattributed learner refused: ' + text(learner.id));
      if (LEARNER_KINDS.indexOf(kind) < 0) throw new Error('unknown learner kind: ' + kind);
      return {
        id: text(learner.id), displayName: text(learner.displayName, learner.id), kind: kind,
        attributed: true, optedIn: false, optedInAt: null, enrolledCourses: [],
        privateProfile: { completedSessions: 0, repairSessions: 0, reviewedSteps: 0 }
      };
    });
    project.sessions = assertUniqueIds(records(project.sessions), 'session').map(function (raw) {
      var learner = find(project.learners, raw.learnerId, 'session learner');
      var course = find(project.courses, raw.courseId, 'session course');
      var stepIds = course.steps.map(function (step) { return step.id; });
      var attempts = records(raw.attempts).filter(function (attempt) { return stepIds.indexOf(attempt.stepId) >= 0 && text(attempt.evidence); }).map(function (attempt) {
        return { id:text(attempt.id, id('attempt')), stepId:text(attempt.stepId), type:text(attempt.type), evidence:text(attempt.evidence), at:text(attempt.at, now()), result:text(attempt.result, 'RECORDED'), authority:'NONE' };
      });
      var repairs = records(raw.repairHistory).filter(function (repair) { return stepIds.indexOf(repair.stepId) >= 0 && text(repair.note); }).map(function (repair) {
        return { id:text(repair.id, id('repair')), stepId:text(repair.stepId), note:text(repair.note), reviewer:text(repair.reviewer, learner.id), requestedAt:text(repair.requestedAt, now()), resolvedAt:text(repair.resolvedAt) || null, attemptId:text(repair.attemptId) || null, authority:'SESSION_ONLY' };
      });
      var activeRepair = repairs.find(function (repair) { return repair.id === raw.activeRepairId && !repair.resolvedAt; }) || null;
      var session = {
        id:text(raw.id), learnerId:learner.id, learnerKind:learner.kind, courseId:course.id,
        status:'PAUSED', startedAt:text(raw.startedAt, now()), updatedAt:text(raw.updatedAt, now()), completedAt:null,
        currentStep:0, attempts:attempts,
        flashcards:records(raw.flashcards).map(function (card) { return { cardId:text(card.cardId), confidence:clamp(card.confidence, 0, 3), at:text(card.at, now()) }; }),
        assessment:null, labRunIds:[], codeRunIds:[], review:null,
        repairHistory:repairs, activeRepairId:activeRepair ? activeRepair.id : null, resumeStatus:'ACTIVE'
      };
      if (raw.assessment && Array.isArray(raw.assessment.rows)) {
        var answers = {};
        raw.assessment.rows.forEach(function (row) { if (row && text(row.id)) answers[row.id] = row.answer; });
        try { session.assessment = Object.assign({ at:text(raw.assessment.at, now()), origin:'IMPORTED_REDERIVED' }, scoreAssessment(course, answers)); } catch (error) { session.assessment = null; }
      }
      var review = buildSessionReview(course, session);
      var completeClaim = raw.status === 'COMPLETE' && review.canComplete && raw.review && text(raw.review.decision).toUpperCase() === 'COMPLETE' && text(raw.review.note);
      if (completeClaim) {
        session.status = 'COMPLETE';
        session.resumeStatus = null;
        session.currentStep = course.steps.length;
        session.completedAt = text(raw.completedAt, raw.review.at || now());
        session.review = { decision:'COMPLETE', note:text(raw.review.note), reviewer:text(raw.review.reviewer, learner.id), at:text(raw.review.at, session.completedAt), authority:'SESSION_ONLY', origin:'IMPORTED_REDERIVED' };
      } else {
        var nextIndex = activeRepair ? stepIds.indexOf(activeRepair.stepId) : review.rows.findIndex(function (row) { return !row.evidence; });
        session.currentStep = nextIndex < 0 ? course.steps.length : nextIndex;
        session.resumeStatus = session.currentStep >= course.steps.length ? 'READY_FOR_REVIEW' : 'ACTIVE';
      }
      return session;
    });
    project.labRuns = records(project.labRuns).filter(function (run) { return project.sessions.some(function (session) { return session.id === run.sessionId; }); }).map(function (run) {
      var session = find(project.sessions, run.sessionId, 'lab session');
      var result = runEvidenceLab(run.inputs || {});
      result.id = text(run.id, result.id); result.sessionId = session.id; result.learnerId = session.learnerId; result.at = text(run.at, result.at); result.origin = 'IMPORTED_REDERIVED';
      return result;
    });
    project.codeRuns = records(project.codeRuns).filter(function (run) { return project.sessions.some(function (session) { return session.id === run.sessionId; }) && CODE_CHALLENGES[run.challengeId]; }).map(function (run) {
      var session = find(project.sessions, run.sessionId, 'code session');
      var tests = records(run.tests).map(function (test) { return { name:text(test.name), pass:false, reportedPass:test.pass === true, detail:'Imported result requires a new local sandbox run.' }; });
      return {
        schema:'axm.learning-lab.code-run/v1', id:text(run.id, id('code')), sessionId:session.id, learnerId:session.learnerId,
        challengeId:text(run.challengeId), source:text(run.source), tests:tests, passed:0, total:tests.length,
        state:'UNVERIFIED_IMPORT', sandboxed:false, network:'UNKNOWN', authority:'NONE', at:text(run.at, now()), origin:'IMPORTED_DECLARATION'
      };
    });
    project.sessions.forEach(function (session) {
      session.labRunIds = project.labRuns.filter(function (run) { return run.sessionId === session.id; }).map(function (run) { return run.id; });
      session.codeRunIds = project.codeRuns.filter(function (run) { return run.sessionId === session.id; }).map(function (run) { return run.id; });
    });
    project.notebook = records(project.notebook).filter(function (entry) { return project.learners.some(function (learner) { return learner.id === entry.learnerId; }); }).map(function (entry) {
      var learner = find(project.learners, entry.learnerId, 'notebook learner');
      return { id:text(entry.id, id('note')), learnerId:learner.id, author:learner.displayName, visibility:entry.visibility === 'shared' ? 'shared' : 'private', title:text(entry.title, 'Learning note'), body:text(entry.body), evidence:text(entry.evidence), sessionId:text(entry.sessionId), at:text(entry.at, now()), authority:'NONE' };
    }).filter(function (entry) { return entry.body; });
    project.classroom = records(project.classroom).filter(function (message) { return project.learners.some(function (learner) { return learner.id === message.learnerId; }) && text(message.body); }).map(function (message) {
      var learner = find(project.learners, message.learnerId, 'classroom learner');
      return { id:text(message.id, id('message')), learnerId:learner.id, author:learner.displayName, kind:learner.kind, body:text(message.body), sessionId:text(message.sessionId), at:text(message.at, now()), authority:'NONE' };
    });
    project.receipts = records(project.receipts).map(function (receipt) {
      return { id:text(receipt.id, id('receipt')), at:text(receipt.at, now()), action:text(receipt.action, 'imported-receipt'), detail:text(receipt.detail), authority:'NONE', origin:'IMPORTED_DECLARATION' };
    });
    project.learners.forEach(function (learner) {
      var sessions = project.sessions.filter(function (session) { return session.learnerId === learner.id; });
      learner.enrolledCourses = Array.from(new Set(sessions.map(function (session) { return session.courseId; })));
      learner.privateProfile.completedSessions = sessions.filter(function (session) { return session.status === 'COMPLETE'; }).length;
      learner.privateProfile.repairSessions = sessions.reduce(function (count, session) { return count + session.repairHistory.length; }, 0);
      learner.privateProfile.reviewedSteps = sessions.reduce(function (count, session) { return count + session.attempts.length; }, 0);
    });
    project.school = { childId:'mirror-learning-shell', service:'mirror-learning-forge', state:'UNKNOWN', tracks:[], checkedAt:null };
    project.settings = {
      activeCourseId:project.courses.some(function (course) { return course.id === (input.settings && input.settings.activeCourseId); }) ? input.settings.activeCourseId : project.courses[0].id,
      activeLearnerId:project.learners.some(function (learner) { return learner.id === (input.settings && input.settings.activeLearnerId); }) ? input.settings.activeLearnerId : null,
      activeSessionId:null, mode:'home'
    };
    project.updatedAt = now();
    project.receipts.push({ id:id('receipt'), at:project.updatedAt, action:'project-import-normalized', detail:'Consent reset; progress and authority re-derived; imported code evidence held for local rerun.', authority:'NONE' });
    return project;
  }

  function touch(project, action, detail) {
    project.updatedAt = now();
    project.receipts.push({ id: id('receipt'), at: project.updatedAt, action: action, detail: text(detail), authority: 'NONE' });
    return project;
  }

  function addLearner(project, input) {
    project = normalize(project); input = input || {};
    var learnerId = text(input.id);
    if (!learnerId) throw new Error('learner id is required');
    if (project.learners.some(function (item) { return item.id === learnerId; })) throw new Error('learner already exists: ' + learnerId);
    var kind = text(input.kind, 'human').toLowerCase();
    if (LEARNER_KINDS.indexOf(kind) < 0) throw new Error('unknown learner kind: ' + kind);
    var learner = {
      id: learnerId,
      displayName: text(input.displayName, learnerId),
      kind: kind,
      attributed: true,
      optedIn: input.optedIn === true,
      optedInAt: input.optedIn === true ? now() : null,
      enrolledCourses: [],
      privateProfile: { completedSessions: 0, repairSessions: 0, reviewedSteps: 0 }
    };
    project.learners.push(learner);
    if (!project.settings.activeLearnerId) project.settings.activeLearnerId = learner.id;
    touch(project, 'learner-added', learner.id + ' · ' + learner.kind + ' · opt-in ' + learner.optedIn);
    return { project: project, learner: clone(learner) };
  }

  function setOptIn(project, learnerId, enabled) {
    project = normalize(project);
    var learner = find(project.learners, learnerId, 'learner');
    learner.optedIn = enabled === true;
    learner.optedInAt = learner.optedIn ? now() : null;
    project.sessions.forEach(function (session) {
      if (session.learnerId !== learner.id) return;
      if (!learner.optedIn && ['ACTIVE', 'READY_FOR_REVIEW', 'REPAIR'].indexOf(session.status) >= 0) { session.resumeStatus = session.status; session.status = 'PAUSED'; }
      else if (learner.optedIn && session.status === 'PAUSED') { session.status = ['ACTIVE', 'READY_FOR_REVIEW', 'REPAIR'].indexOf(session.resumeStatus) >= 0 ? session.resumeStatus : 'ACTIVE'; session.resumeStatus = null; }
      session.updatedAt = now();
    });
    touch(project, learner.optedIn ? 'learner-opted-in' : 'learner-opted-out', learner.id);
    return project;
  }

  function addCourse(project, input) {
    project = normalize(project); input = input || {};
    var title = text(input.title);
    if (!title) throw new Error('course title is required');
    var steps = Array.isArray(input.steps) ? input.steps.filter(function (step) { return step && text(step.title); }).map(function (step, index) {
      return {
        id: text(step.id, 'step-' + (index + 1)),
        type: ['lesson', 'flashcards', 'assessment', 'simulation', 'coding', 'reflection'].indexOf(step.type) >= 0 ? step.type : 'lesson',
        title: text(step.title),
        minutes: clamp(step.minutes || 5, 1, 240),
        body: text(step.body),
        prompt: text(step.prompt)
      };
    }) : [];
    if (!steps.length) throw new Error('course needs at least one valid step');
    var course = {
      id: text(input.id, id('course')),
      title: title,
      summary: text(input.summary, 'Local custom course.'),
      level: text(input.level, 'CUSTOM'),
      source: text(input.source, 'local-author'),
      status: text(input.status, 'DRAFT'),
      category: text(input.category),
      authority: 'NONE',
      tags: Array.isArray(input.tags) ? input.tags.map(String) : [],
      provenance: input.provenance && typeof input.provenance === 'object' ? clone(input.provenance) : null,
      steps: steps
    };
    if (project.courses.some(function (item) { return item.id === course.id; })) throw new Error('course id already exists');
    project.courses.push(course);
    touch(project, 'course-drafted', course.id + ' · ' + steps.length + ' steps');
    return { project: project, course: clone(course) };
  }

  function startSession(project, input) {
    project = normalize(project); input = input || {};
    var learner = find(project.learners, input.learnerId, 'learner');
    if (!learner.attributed) throw new Error('unattributed learner refused');
    if (!learner.optedIn) throw new Error('learner has not opted in');
    var course = find(project.courses, input.courseId, 'course');
    if (project.sessions.some(function (session) { return session.learnerId === learner.id && ['ACTIVE', 'PAUSED', 'READY_FOR_REVIEW', 'REPAIR'].indexOf(session.status) >= 0; })) throw new Error('learner already has an active or review-held session');
    if (learner.enrolledCourses.indexOf(course.id) < 0) learner.enrolledCourses.push(course.id);
    var session = {
      id: id('study'), learnerId: learner.id, learnerKind: learner.kind, courseId: course.id,
      status: 'ACTIVE', startedAt: now(), updatedAt: now(), completedAt: null,
      currentStep: 0, attempts: [], flashcards: [], assessment: null, labRunIds: [], codeRunIds: [], review: null,
      repairHistory: [], activeRepairId: null
    };
    project.sessions.push(session);
    project.settings.activeLearnerId = learner.id;
    project.settings.activeCourseId = course.id;
    project.settings.activeSessionId = session.id;
    project.settings.mode = 'study';
    touch(project, 'study-session-started', session.id + ' · ' + learner.id + ' · ' + course.id);
    return { project: project, session: clone(session) };
  }

  function currentStep(project, sessionId) {
    project = normalize(project);
    var session = find(project.sessions, sessionId, 'session');
    var course = find(project.courses, session.courseId, 'course');
    return course.steps[session.currentStep] || null;
  }

  function buildSessionReview(course, session) {
    var attempts = Array.isArray(session.attempts) ? session.attempts : [];
    var rows = course.steps.map(function (step, index) {
      var stepAttempts = attempts.filter(function (attempt) { return attempt.stepId === step.id; });
      var latest = stepAttempts.length ? stepAttempts[stepAttempts.length - 1] : null;
      return {
        order: index + 1,
        stepId: step.id,
        type: step.type,
        title: step.title,
        prompt: text(step.prompt, 'Record what this step showed.'),
        attemptCount: stepAttempts.length,
        evidence: latest ? text(latest.evidence) : '',
        result: latest ? text(latest.result, 'RECORDED') : 'MISSING',
        at: latest ? latest.at : null
      };
    });
    return {
      schema: 'axm.learning-lab.session-evidence-review/v1',
      sessionId: session.id,
      learnerId: session.learnerId,
      courseId: course.id,
      courseTitle: course.title,
      status: session.status,
      completedSteps: rows.filter(function (row) { return !!row.evidence; }).length,
      totalSteps: rows.length,
      canComplete: rows.length > 0 && rows.every(function (row) { return !!row.evidence; }),
      rows: rows,
      repairs: clone(Array.isArray(session.repairHistory) ? session.repairHistory : []),
      boundary: course.provenance && text(course.provenance.boundary) ? text(course.provenance.boundary) : 'A completion receipt describes this bounded session only; it grants no authority, wisdom or canon status.',
      authority: 'NONE'
    };
  }

  function prepareSessionReview(project, sessionId) {
    project = normalize(project);
    var session = find(project.sessions, sessionId, 'session');
    var course = find(project.courses, session.courseId, 'course');
    return clone(buildSessionReview(course, session));
  }

  function completeStep(project, input) {
    project = normalize(project); input = input || {};
    var session = find(project.sessions, input.sessionId, 'session');
    if (session.status !== 'ACTIVE') throw new Error('session is not active');
    var course = find(project.courses, session.courseId, 'course');
    var step = course.steps[session.currentStep];
    if (!step) throw new Error('course has no remaining step');
    if (input.stepId && input.stepId !== step.id) throw new Error('step order mismatch');
    var evidence = text(input.evidence);
    if (!evidence) throw new Error('step evidence or reflection is required');
    var repair = null;
    if (session.activeRepairId) {
      repair = (Array.isArray(session.repairHistory) ? session.repairHistory : []).find(function (item) { return item.id === session.activeRepairId; }) || null;
      if (!repair || repair.stepId !== step.id) throw new Error('active repair does not match the current step');
    }
    var attempt = { id: id('attempt'), stepId: step.id, type: step.type, evidence: evidence, at: now(), result: text(input.result, repair ? 'REPAIRED' : 'RECORDED') };
    session.attempts.push(attempt);
    if (repair) {
      repair.resolvedAt = attempt.at;
      repair.attemptId = attempt.id;
      session.activeRepairId = null;
      session.currentStep = course.steps.length;
      session.status = 'READY_FOR_REVIEW';
    } else session.currentStep += 1;
    session.updatedAt = now();
    var learner = find(project.learners, session.learnerId, 'learner');
    learner.privateProfile.reviewedSteps += 1;
    if (session.currentStep >= course.steps.length) session.status = 'READY_FOR_REVIEW';
    touch(project, 'learning-step-recorded', session.id + ' · ' + step.id + ' · ' + session.status);
    return { project: project, session: clone(session), nextStep: course.steps[session.currentStep] || null };
  }

  function reviewFlashcard(project, input) {
    project = normalize(project); input = input || {};
    var session = find(project.sessions, input.sessionId, 'session');
    if (session.status !== 'ACTIVE') throw new Error('session is not active');
    var confidence = clamp(input.confidence, 0, 3);
    session.flashcards.push({ cardId: text(input.cardId), confidence: confidence, at: now() });
    session.updatedAt = now();
    touch(project, 'flashcard-reviewed', session.id + ' · ' + text(input.cardId) + ' · confidence ' + confidence);
    return project;
  }

  function scoreAssessment(course, answers) {
    course = clone(course); answers = answers || {};
    var step = course.steps.find(function (item) { return item.type === 'assessment'; });
    if (!step || !Array.isArray(step.questions)) throw new Error('course has no assessment');
    var rows = step.questions.map(function (question) {
      var answer = Number(answers[question.id]);
      return { id: question.id, correct: answer === question.correct, answer: answer, expected: question.correct, why: question.why };
    });
    var correct = rows.filter(function (row) { return row.correct; }).length;
    return { schema: 'axm.learning-lab.assessment/v1', stepId: step.id, correct: correct, total: rows.length, percent: rows.length ? Math.round(correct / rows.length * 100) : 0, rows: rows, authority: 'NONE' };
  }

  function recordAssessment(project, input) {
    project = normalize(project); input = input || {};
    var session = find(project.sessions, input.sessionId, 'session');
    var course = find(project.courses, session.courseId, 'course');
    var result = scoreAssessment(course, input.answers);
    session.assessment = Object.assign({ at: now() }, result);
    session.updatedAt = now();
    touch(project, 'assessment-recorded', session.id + ' · ' + result.correct + '/' + result.total + ' · authority NONE');
    return { project: project, result: result };
  }

  function runEvidenceLab(input) {
    input = input || {};
    var evidence = clamp(input.evidence, 0, 5);
    var sourceQuality = clamp(input.sourceQuality, 0, 5);
    var contradictions = clamp(input.contradictions, 0, 5);
    var score = evidence * 12 + sourceQuality * 8 - contradictions * 22;
    var verdict = contradictions > 0 || score < 32 ? 'HOLD' : score >= 72 && evidence >= 4 ? 'VERIFY_CANDIDATE' : 'PROPOSE';
    return {
      schema: 'axm.learning-lab.simulation-result/v1', id: id('lab'), lab: 'evidence-pressure-v1',
      inputs: { evidence: evidence, sourceQuality: sourceQuality, contradictions: contradictions },
      score: score, verdict: verdict,
      explanation: verdict === 'HOLD' ? 'Contradiction or insufficient support requires a named hold and another test.' : verdict === 'PROPOSE' ? 'Useful support exists, but verification has not yet been earned.' : 'The bounded model permits a verification candidate; human or external gates still decide.',
      deterministic: true, authority: 'NONE', at: now()
    };
  }

  function recordLabRun(project, input) {
    project = normalize(project); input = input || {};
    var session = find(project.sessions, input.sessionId, 'session');
    var result = runEvidenceLab(input);
    result.sessionId = session.id;
    result.learnerId = session.learnerId;
    project.labRuns.push(result); session.labRunIds.push(result.id); session.updatedAt = now();
    touch(project, 'simulation-run-recorded', result.id + ' · ' + result.verdict);
    return { project: project, result: clone(result) };
  }

  function codeChallenge(challengeId) {
    var challenge = CODE_CHALLENGES[challengeId];
    if (!challenge) throw new Error('code challenge not found: ' + challengeId);
    return clone(challenge);
  }

  function recordCodeRun(project, input) {
    project = normalize(project); input = input || {};
    var session = find(project.sessions, input.sessionId, 'session');
    var challenge = codeChallenge(input.challengeId);
    var tests = Array.isArray(input.tests) ? input.tests.map(function (test) { return { name: text(test.name), pass: test.pass === true, detail: text(test.detail) }; }) : [];
    if (!tests.length) throw new Error('code run requires sandbox test results');
    var run = {
      schema: 'axm.learning-lab.code-run/v1', id: id('code'), sessionId: session.id, learnerId: session.learnerId,
      challengeId: challenge.id, source: text(input.source), tests: tests,
      passed: tests.filter(function (test) { return test.pass; }).length, total: tests.length,
      state: tests.every(function (test) { return test.pass; }) ? 'PASS' : 'REPAIR',
      sandboxed: true, network: false, authority: 'NONE', at: now()
    };
    project.codeRuns.push(run); session.codeRunIds.push(run.id); session.updatedAt = now();
    touch(project, 'guided-code-run-recorded', run.id + ' · ' + run.state + ' · ' + run.passed + '/' + run.total);
    return { project: project, result: clone(run) };
  }

  function addNotebookEntry(project, input) {
    project = normalize(project); input = input || {};
    var learner = find(project.learners, input.learnerId, 'learner');
    var body = text(input.body);
    if (!body) throw new Error('notebook entry is empty');
    var entry = {
      id: id('note'), learnerId: learner.id, author: text(input.author, learner.displayName),
      visibility: input.visibility === 'shared' ? 'shared' : 'private', title: text(input.title, 'Learning note'),
      body: body, evidence: text(input.evidence), sessionId: text(input.sessionId), at: now()
    };
    project.notebook.push(entry);
    touch(project, 'notebook-entry-added', entry.id + ' · ' + entry.visibility + ' · ' + learner.id);
    return { project: project, entry: clone(entry) };
  }

  function addClassroomMessage(project, input) {
    project = normalize(project); input = input || {};
    var learner = find(project.learners, input.learnerId, 'learner');
    var body = text(input.body);
    if (!body) throw new Error('classroom message is empty');
    var message = { id: id('message'), learnerId: learner.id, author: learner.displayName, kind: learner.kind, body: body, sessionId: text(input.sessionId), at: now(), authority: 'NONE' };
    project.classroom.push(message);
    touch(project, 'classroom-message-added', message.id + ' · ' + learner.id);
    return { project: project, message: clone(message) };
  }

  function reviewSession(project, input) {
    project = normalize(project); input = input || {};
    var session = find(project.sessions, input.sessionId, 'session');
    if (['READY_FOR_REVIEW', 'REPAIR'].indexOf(session.status) < 0) throw new Error('session is not ready for review');
    var decision = text(input.decision).toUpperCase();
    if (['COMPLETE', 'REPAIR'].indexOf(decision) < 0) throw new Error('review decision must be COMPLETE or REPAIR');
    var note = text(input.note);
    if (!note) throw new Error('review note is required');
    var course = find(project.courses, session.courseId, 'course');
    var learner = find(project.learners, session.learnerId, 'learner');
    var reviewedAt = now();
    if (decision === 'COMPLETE') {
      if (!buildSessionReview(course, session).canComplete) throw new Error('every ordered step needs visible evidence before completion');
      session.status = 'COMPLETE';
      session.review = { decision:decision, note:note, reviewer:text(input.reviewer, 'local-steward'), at:reviewedAt, authority:'SESSION_ONLY' };
      session.completedAt = reviewedAt;
      session.updatedAt = reviewedAt;
      learner.privateProfile.completedSessions += 1;
      if (project.settings.activeSessionId === session.id) project.settings.activeSessionId = null;
      touch(project, 'study-session-reviewed', session.id + ' · COMPLETE · visible evidence reviewed · no authority from grade');
      return { project: project, session: clone(session) };
    }
    var stepId = text(input.stepId);
    var stepIndex = course.steps.findIndex(function (step) { return step.id === stepId; });
    if (stepIndex < 0) throw new Error('repair step is required and must belong to the course');
    if (!learner.optedIn) throw new Error('learner has not opted in for repair');
    var repair = { id:id('repair'), stepId:stepId, note:note, reviewer:text(input.reviewer, learner.id), requestedAt:reviewedAt, resolvedAt:null, attemptId:null, authority:'SESSION_ONLY' };
    if (!Array.isArray(session.repairHistory)) session.repairHistory = [];
    session.repairHistory.push(repair);
    session.activeRepairId = repair.id;
    session.currentStep = stepIndex;
    session.status = 'ACTIVE';
    session.review = { decision:decision, note:note, reviewer:repair.reviewer, stepId:stepId, at:reviewedAt, authority:'SESSION_ONLY' };
    session.completedAt = null;
    session.updatedAt = reviewedAt;
    learner.privateProfile.repairSessions += 1;
    project.settings.activeSessionId = session.id;
    project.settings.activeCourseId = course.id;
    project.settings.activeLearnerId = learner.id;
    touch(project, 'study-session-repair-opened', session.id + ' · ' + stepId + ' · prior attempts preserved');
    return { project: project, session: clone(session) };
  }

  function setSchoolStatus(project, input) {
    project = normalize(project); input = input || {};
    project.school.state = text(input.state, 'UNKNOWN');
    project.school.tracks = Array.isArray(input.tracks) ? clone(input.tracks) : [];
    project.school.checkedAt = now();
    project.updatedAt = project.school.checkedAt;
    return project;
  }

  function schoolHandoff(project, input) {
    project = normalize(project); input = input || {};
    var learner = find(project.learners, input.learnerId, 'learner');
    if (!learner.optedIn) throw new Error('learner has not opted in');
    return {
      schema: 'axm.ai-learning.session-proposal/v1', source: 'learning-lab', learner: { id: learner.id, displayName: learner.displayName, kind: learner.kind },
      curriculumId: text(input.curriculumId), purpose: text(input.purpose, 'Explicit guided study'),
      consent: { explicit: true, at: now() }, separation: { identityMerge: false, memoryMerge: false, authorityGrant: false },
      state: 'PROPOSAL', authority: 'NONE'
    };
  }

  function summary(project) {
    project = normalize(project);
    return {
      courses: project.courses.length,
      learners: project.learners.length,
      optedIn: project.learners.filter(function (learner) { return learner.optedIn; }).length,
      activeSessions: project.sessions.filter(function (session) { return session.status === 'ACTIVE'; }).length,
      completedSessions: project.sessions.filter(function (session) { return session.status === 'COMPLETE'; }).length,
      notebookEntries: project.notebook.length,
      labRuns: project.labRuns.length,
      codeRuns: project.codeRuns.length
    };
  }

  function exportPacket(project) {
    project = normalize(project);
    return { schema: FORMAT, exportedAt: now(), project: clone(project), summary: summary(project), boundary: 'Grades and completion receipts grant no authority. Learner profiles and school state remain attributed and separate.' };
  }

  return {
    FORMAT: FORMAT, VERSION: VERSION, MODES: MODES, LEARNER_KINDS: LEARNER_KINDS,
    BUILTIN_COURSES: clone(BUILTIN_COURSES), CODE_CHALLENGES: clone(CODE_CHALLENGES),
    createProject: createProject, normalize: normalize, importProject: importProject, addLearner: addLearner, setOptIn: setOptIn,
    addCourse: addCourse, startSession: startSession, currentStep: currentStep, prepareSessionReview: prepareSessionReview, completeStep: completeStep,
    reviewFlashcard: reviewFlashcard, scoreAssessment: scoreAssessment, recordAssessment: recordAssessment,
    runEvidenceLab: runEvidenceLab, recordLabRun: recordLabRun, codeChallenge: codeChallenge, recordCodeRun: recordCodeRun,
    addNotebookEntry: addNotebookEntry, addClassroomMessage: addClassroomMessage, reviewSession: reviewSession,
    setSchoolStatus: setSchoolStatus, schoolHandoff: schoolHandoff, summary: summary, exportPacket: exportPacket
  };
}));
