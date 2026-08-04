(function () {
  'use strict';
  var Core = window.AXMLearningLabCore;
  var Academy = window.AXMAcademyCatalog;
  if (!Core) throw new Error('Learning Lab core is unavailable');
  if (!Academy) throw new Error('Academy catalog is unavailable');
  var STORE = 'axm.learning-lab.project.v1';
  var SHARED_STORE = 'axm.learning-lab.shared.v1';
  var MODE_COPY = {
    home: ['ACADEMY', 'Turn what the Workshop learns into paths people can follow.', 'Curated local data becomes categorized, source-linked lessons; practice and learner state remain inside the Learning Lab.'],
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
  var academyRows = [];
  var academyCategory = 'all';
  var academySelected = null;
  var academyLoadStarted = false;
  var academyCatalogError = '';
  var academyPaths = [];
  var academyPathError = '';
  var academyLearnerChoice = null;
  var pendingInheritanceReview = null;

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
  function renderInheritanceReview(prepared) {
    var preview = prepared.preview;
    $('academyReviewStatus').textContent = prepared.requiresAdmission ? 'READY FOR HUMAN REVIEW' : 'ALREADY ON SHELF';
    $('academyReviewStatus').className = 'status ' + (prepared.requiresAdmission ? 'held' : 'ready');
    $('academyReviewTitle').textContent = preview.title;
    $('academyReviewSummary').textContent = preview.summary;
    $('academyReviewCategory').textContent = preview.category.replace(/-/g, ' ').toUpperCase() + ' · ' + preview.level;
    $('academyReviewOrgan').textContent = preview.organ;
    $('academyReviewPath').textContent = preview.path;
    $('academyReviewFingerprint').textContent = preview.fingerprint.slice(0, 12).toUpperCase();
    $('academyReviewRecipe').textContent = preview.compilerRecipe;
    $('academyReviewEdition').textContent = preview.editionId;
    $('academyReviewScope').textContent = preview.stepCount + ' steps · ' + preview.factCount + ' extracted facts · ' + preview.minutes + ' minutes';
    $('academyReviewBoundary').textContent = preview.boundary;
    $('academyReviewAuthenticity').textContent = preview.authenticity;
    $('academyReviewExisting').hidden = prepared.requiresAdmission;
    $('academyReviewAccept').textContent = prepared.requiresAdmission ? 'Add lesson to shelf' : 'Open existing edition';
  }
  function closeInheritanceReview() {
    var dialog = $('academyImportReview');
    if (dialog && dialog.open) dialog.close();
    pendingInheritanceReview = null;
  }
  function openInheritanceReview(packet) {
    var prepared = Academy.prepareInheritanceReview(state.courses, packet);
    if (!prepared.ok) throw new Error('Lesson packet refused: ' + prepared.errors.join('; '));
    var dialog = $('academyImportReview');
    if (!dialog || typeof dialog.showModal !== 'function') throw new Error('Lesson review is unavailable; nothing was imported');
    pendingInheritanceReview = { packet:clone(packet) };
    renderInheritanceReview(prepared);
    if (!dialog.open) dialog.showModal();
    toast('Lesson packet validated · human review required before admission');
  }
  function admitInheritanceReview() {
    try {
      if (!pendingInheritanceReview) throw new Error('No lesson packet is awaiting review');
      var prepared = Academy.prepareInheritanceReview(state.courses, pendingInheritanceReview.packet);
      if (!prepared.ok) throw new Error('Lesson packet refused on admission: ' + prepared.errors.join('; '));
      var existing = prepared.existingCourseId && state.courses.find(function (course) { return course.id === prepared.existingCourseId; });
      if (existing) {
        state.settings.activeCourseId = existing.id;
        closeInheritanceReview();
        persist('Existing Academy edition opened · no learner state imported');
        return;
      }
      var added = Core.addCourse(state, prepared.course);
      state = added.project;
      state.settings.activeCourseId = added.course.id;
      closeInheritanceReview();
      persist('Reviewed Academy edition added to the shelf · no learner or session imported');
    } catch (error) { toast(error.message); }
  }
  function importLearningFile(parsed) {
    if (parsed && parsed.schema === Academy.INHERITANCE_FORMAT) { openInheritanceReview(parsed); return; }
    var project = parsed && (parsed.project || parsed);
    if (!project || project.schema !== Core.FORMAT) throw new Error('not a Learning Lab project or Academy lesson packet');
    state = Core.importProject(project);
    persist('Learning project admitted with consent reset and imported evidence re-derived');
  }
  function activeSession() { return state.sessions.find(function (session) { return session.id === state.settings.activeSessionId; }) || null; }
  function activeLearner() { return state.learners.find(function (learner) { return learner.id === state.settings.activeLearnerId; }) || null; }
  function activeCourse() { return state.courses.find(function (course) { return course.id === state.settings.activeCourseId; }) || state.courses[0]; }
  function courseEditionLabel(course) {
    var fingerprint = course && course.provenance && course.provenance.lessonFingerprint;
    return fingerprint && /^[a-f0-9]{16}$/.test(fingerprint.value || '') ? ' · EDITION ' + fingerprint.value.slice(0, 8).toUpperCase() : '';
  }
  function academyOpenSession(learnerId) {
    return state.sessions.slice().reverse().find(function (session) {
      return session.learnerId === learnerId && ['ACTIVE','PAUSED','READY_FOR_REVIEW','REPAIR'].indexOf(session.status) >= 0;
    }) || null;
  }
  function academyCoursesForSnapshot(snapshot) {
    var baseId = 'academy-' + snapshot.sourceId;
    return state.courses.filter(function (course) {
      return course.id === baseId || (course.provenance && course.provenance.sourceId === snapshot.sourceId);
    });
  }
  function academyCourseProgress(snapshot) {
    var courses = academyCoursesForSnapshot(snapshot), courseIds = courses.map(function (course) { return course.id; });
    var sessions = state.sessions.filter(function (session) { return courseIds.indexOf(session.courseId) >= 0; });
    var current = sessions.slice().reverse().find(function (session) { return ['ACTIVE','PAUSED','READY_FOR_REVIEW','REPAIR'].indexOf(session.status) >= 0; });
    var installed = current ? courses.find(function (course) { return course.id === current.courseId; }) : null;
    if (current) {
      if (current.status === 'READY_FOR_REVIEW' || current.status === 'REPAIR') return { state:current.status, label:'REVIEW READY' };
      var editionState = installed ? Academy.freshness(installed, snapshot).state : 'UNVERIFIED_EDITION';
      return { state:current.status, label:(current.status === 'PAUSED' ? 'PAUSED · ' : '') + 'STEP ' + Math.min(current.currentStep + 1, installed ? installed.steps.length : current.currentStep + 1) + (editionState === 'CURRENT' ? '' : ' · OLD EDITION') };
    }
    var currentCourse = courses.find(function (course) { return Academy.freshness(course, snapshot).state === 'CURRENT'; });
    if (currentCourse && sessions.some(function (session) { return session.courseId === currentCourse.id && session.status === 'COMPLETE'; })) return { state:'COMPLETE', label:'COMPLETED' };
    if (currentCourse) return { state:'SHELVED', label:'ON SHELF · CURRENT' };
    if (courses.some(function (course) { return Academy.freshness(course, snapshot).state === 'COMPILER_CHANGED'; })) return { state:'COMPILER_CHANGED', label:'COMPILER UPDATED' };
    if (courses.length) return { state:'SOURCE_CHANGED', label:'SOURCE CHANGED' };
    return { state:'AVAILABLE', label:'READY TO LEARN' };
  }
  function academyLearnerOptions(selectedId) {
    var rows = state.learners.map(function (learner) {
      return '<option value="' + esc(learner.id) + '"' + (learner.id === selectedId ? ' selected' : '') + '>' + esc(learner.displayName) + ' · ' + (learner.optedIn ? 'opted in' : 'paused') + '</option>';
    });
    rows.push('<option value="__new__"' + (selectedId === '__new__' ? ' selected' : '') + '>New human learner…</option>');
    return rows.join('');
  }
  function academyLearnerId(name) {
    var stem = String(name || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 44) || 'local-learner';
    var candidate = stem, suffix = 2;
    while (state.learners.some(function (learner) { return learner.id === candidate; })) { candidate = stem.slice(0, 40) + '-' + suffix; suffix += 1; }
    return candidate;
  }
  function installAcademyCourse(course) {
    var existing = state.courses.find(function (item) { return item.id === course.id; });
    if (existing) return existing;
    var result = Core.addCourse(state, course);
    state = result.project;
    state.settings.activeCourseId = result.course.id;
    return result.course;
  }

  function academyCourseCount() { return state.courses.filter(function (course) { return /^academy:/.test(course.source || ''); }).length; }
  function loadAcademySources() {
    if (academyLoadStarted) return;
    academyLoadStarted = true;
    fetch('./academy-source-catalog.json', { cache:'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('catalog HTTP ' + response.status);
      return response.json();
    }).then(function (catalog) {
      var checked = Academy.validateCatalog(catalog);
      if (!checked.ok) throw new Error(checked.errors.join('; '));
      academyRows = checked.sources.map(function (item) { return { source:item, state:'LOADING', snapshot:null, error:'' }; });
      academySelected = academyRows.length ? academyRows[0].source.id : null;
      renderAcademy();
      fetch('./academy-learning-path-catalog.json', { cache:'no-store' }).then(function (response) {
        if (!response.ok) throw new Error('learning path catalog HTTP ' + response.status);
        return response.json();
      }).then(function (catalog) {
        var pathCheck = Academy.validateLearningPaths(catalog, checked.sources);
        if (!pathCheck.ok) throw new Error(pathCheck.errors.join('; '));
        academyPaths = pathCheck.paths;
        academyPathError = '';
      }).catch(function (error) {
        academyPaths = [];
        academyPathError = error.message;
      }).finally(renderAcademy);
      academyRows.forEach(function (row) {
        fetch(row.source.path, { cache:'no-store' }).then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        }).then(function (data) {
          row.snapshot = Academy.buildSnapshot(row.source, data);
          row.state = 'READY';
        }).catch(function (error) {
          row.state = 'HELD';
          row.error = error.message;
        }).finally(renderAcademy);
      });
    }).catch(function (error) {
      academyCatalogError = error.message;
      academyRows = [];
      academySelected = null;
      renderAcademy();
    });
  }
  function renderAcademyPaths() {
    if (!$('academyLearningPaths')) return;
    if (academyPathError) {
      $('academyLearningPaths').innerHTML = '<div class="academy-path-held"><b>FOUNDATION TRAIL HELD</b><span>' + esc(academyPathError) + '</span></div>';
      return;
    }
    if (!academyPaths.length) {
      $('academyLearningPaths').innerHTML = '<div class="academy-path-loading">Reading the optional foundation trail from its local data contract…</div>';
      return;
    }
    var learner = activeLearner();
    var currentSnapshots = academyRows.filter(function (row) { return row.state === 'READY' && row.snapshot; }).map(function (row) { return row.snapshot; });
    $('academyLearningPaths').innerHTML = academyPaths.map(function (path) {
      var progress = Academy.learningPathProgress(path, state.courses, state.sessions, learner ? learner.id : null, currentSnapshots);
      var nextRow = academyRows.find(function (row) { return row.source.id === progress.nextSourceId; });
      var nextTitle = nextRow ? nextRow.source.title : progress.nextSourceId;
      var historicalCopy = progress.historicalCompleted ? ' · ' + progress.historicalCompleted + ' earlier edition completion' + (progress.historicalCompleted === 1 ? '' : 's') + ' preserved' : '';
      var learnerCopy = learner ? esc(learner.displayName) + ' · ' + progress.completed + ' of ' + progress.total + ' current' + historicalCopy : 'No learner selected · inspect the route before taking a seat';
      var stages = progress.stages.map(function (stage, index) {
        var row = academyRows.find(function (item) { return item.source.id === stage.sourceId; });
        var revisionNote = stage.status === 'REVIEW_UPDATED' ? 'Earlier completion preserved · the current edition awaits review.' : stage.status === 'OLD_IN_PROGRESS' ? 'An earlier edition is still open · its attributed session remains intact.' : stage.status === 'UPDATE_AVAILABLE' ? 'A different edition is on the shelf · inspect the current lesson before continuing.' : '';
        return '<li class="' + stage.status.toLowerCase() + '"><span class="academy-path-index">' + String(index + 1).padStart(2, '0') + '</span><div><b>' + esc(row ? row.source.title : stage.sourceId) + '</b><p>' + esc(stage.reason) + '</p>' + (revisionNote ? '<small class="academy-path-revision">' + esc(revisionNote) + '</small>' : '') + '</div><em>' + esc(stage.status.replace(/_/g, ' ')) + '</em></li>';
      }).join('');
      var nextStage = progress.stages.find(function (stage) { return stage.sourceId === progress.nextSourceId; });
      var nextVerb = nextStage && ['REVIEW_UPDATED', 'OLD_IN_PROGRESS', 'UPDATE_AVAILABLE'].indexOf(nextStage.status) >= 0 ? 'Inspect current edition' : 'Inspect next lesson';
      var nextAction = progress.nextSourceId ? '<button class="button primary academy-path-next" data-academy-next="' + esc(progress.nextSourceId) + '">' + nextVerb + ' · ' + esc(nextTitle) + '</button>' : '<span class="academy-path-finished">Trail complete · revisit any lesson whenever it helps.</span>';
      return '<article class="academy-learning-path"><header><div><span>' + esc(path.level) + '</span><h4>' + esc(path.title) + '</h4></div><strong>' + progress.percent + '%</strong></header><p class="academy-path-summary">' + esc(path.summary) + '</p><div class="academy-path-audience"><b>For</b><span>' + esc(path.audience) + '</span></div><ol>' + stages + '</ol><div class="academy-path-actions"><span>' + learnerCopy + '</span>' + nextAction + '</div><details><summary>Outcomes and limits</summary><ul>' + path.outcomes.map(function (outcome) { return '<li>' + esc(outcome) + '</li>'; }).join('') + '</ul><p>' + esc(path.boundary) + '</p></details></article>';
    }).join('');
    $('academyLearningPaths').querySelectorAll('[data-academy-next]').forEach(function (button) {
      button.onclick = function () {
        academyCategory = 'all';
        academySelected = button.dataset.academyNext;
        renderAcademy();
        setTimeout(function () { if ($('academyDetail')) $('academyDetail').scrollIntoView({ behavior:'smooth', block:'start' }); }, 0);
      };
    });
  }
  function renderAcademyCategories() {
    $('academyCategories').innerHTML = Academy.categories().map(function (category) {
      var count = category.id === 'all' ? academyRows.length : academyRows.filter(function (row) { return row.source.category === category.id; }).length;
      return '<button class="academy-category' + (academyCategory === category.id ? ' active' : '') + '" data-academy-category="' + esc(category.id) + '"><b>' + esc(category.title) + '</b><span>' + count + '</span></button>';
    }).join('');
    $('academyCategories').querySelectorAll('[data-academy-category]').forEach(function (button) {
      button.onclick = function () {
        academyCategory = button.dataset.academyCategory;
        var visible = academyRows.filter(function (row) { return academyCategory === 'all' || row.source.category === academyCategory; });
        if (!visible.some(function (row) { return row.source.id === academySelected; })) academySelected = visible.length ? visible[0].source.id : null;
        renderAcademy();
      };
    });
  }
  function renderAcademy() {
    if (!$('academyCatalog')) return;
    var ready = academyRows.filter(function (row) { return row.state === 'READY'; }).length;
    $('academySourceCount').textContent = academyRows.length;
    $('academyReadyCount').textContent = ready;
    $('academyLessonCount').textContent = academyCourseCount();
    renderAcademyPaths();
    renderAcademyCategories();
    var visible = academyRows.filter(function (row) { return academyCategory === 'all' || row.source.category === academyCategory; });
    $('academyCatalog').innerHTML = visible.map(function (row) {
      var category = Academy.categories().find(function (item) { return item.id === row.source.category; });
      var factCount = row.snapshot ? row.snapshot.facts.length : 0;
      var progress = row.snapshot ? academyCourseProgress(row.snapshot) : null;
      return '<button class="academy-source-card' + (row.source.id === academySelected ? ' active' : '') + '" data-academy-source="' + esc(row.source.id) + '">'
        + '<span class="academy-card-top"><i>' + esc(category ? category.title : row.source.category) + '</i><em class="' + row.state.toLowerCase() + '">' + esc(row.state) + '</em></span>'
        + '<b>' + esc(row.source.title) + '</b><small>' + esc(row.source.organ) + '</small><span class="academy-card-summary">' + esc(row.source.summary) + '</span>'
        + '<span class="academy-card-foot"><span>' + (factCount ? factCount + ' facts · ' + esc(progress.label) : 'reading local source') + '</span><i>→</i></span></button>';
    }).join('') || '<div class="empty">' + (academyCatalogError ? 'Academy catalog held: ' + esc(academyCatalogError) : 'No Academy sources are assigned to this category yet.') + '</div>';
    $('academyCatalog').querySelectorAll('[data-academy-source]').forEach(function (button) {
      button.onclick = function () { academySelected = button.dataset.academySource; renderAcademy(); };
    });
    var selected = academyRows.find(function (row) { return row.source.id === academySelected; });
    if (!selected) { $('academyDetail').innerHTML = '<div class="empty">' + (academyCatalogError ? 'No source was admitted. Repair the catalog before compiling lessons.' : 'Choose a source to inspect its lesson path.') + '</div>'; return; }
    if (selected.state !== 'READY') {
      $('academyDetail').innerHTML = '<span class="eyebrow">' + esc(selected.state) + ' · LOCAL SOURCE</span><h3>' + esc(selected.source.title) + '</h3><p>' + (selected.error ? 'The source could not be read: ' + esc(selected.error) : 'Reading the organ data and extracting bounded facts…') + '</p><code>' + esc(selected.source.path) + '</code>';
      return;
    }
    var snapshot = selected.snapshot, templateCourse = Academy.courseFromSnapshot(snapshot);
    var admissionPassed = snapshot.admission.checks.filter(function (check) { return check.pass; }).length;
    var lineageCourses = academyCoursesForSnapshot(snapshot);
    var lineageStates = lineageCourses.map(function (item) { return Academy.freshness(item, snapshot).state; });
    var currentCourse = lineageCourses.find(function (item) { return Academy.freshness(item, snapshot).state === 'CURRENT'; }) || null;
    var unverifiedOnly = lineageStates.length && lineageStates.every(function (item) { return item === 'UNVERIFIED_EDITION'; });
    var compilerChangedOnly = lineageStates.length && lineageStates.every(function (item) { return item === 'COMPILER_CHANGED'; });
    var revised = lineageCourses.length > 0 && !currentCourse;
    var course = currentCourse || (revised ? Academy.courseFromSnapshot(snapshot, { edition:true }) : templateCourse);
    var installed = !!currentCourse;
    var freshnessState = currentCourse ? 'CURRENT EDITION' : unverifiedOnly ? 'UNVERIFIED EDITION' : compilerChangedOnly ? 'COMPILER UPDATED' : revised ? 'SOURCE CHANGED' : 'NEW SNAPSHOT';
    var freshnessClass = currentCourse ? 'current' : revised ? 'changed' : 'new';
    var fingerprintShort = snapshot.lessonFingerprint.value.slice(0, 12);
    var freshnessCopy = currentCourse ? 'The installed lesson matches the current source, compiler recipe and generated teaching steps. Existing attempts remain attached to this exact edition.' : unverifiedOnly ? 'An installed legacy lesson has no usable fingerprint. It stays intact; adding the tracked edition creates a new course instead of rewriting that history.' : compilerChangedOnly ? 'The source may be unchanged, but the teaching compiler receipt is older. Existing lessons and attempts stay intact; the current recipe becomes a separate reviewed edition.' : revised ? 'The current source now compiles into a different lesson. Earlier editions and their sessions stay intact; this revision is added as a separate course.' : 'No edition is installed yet. This fingerprint covers both source meaning and generated teaching steps so neither can change silently.';
    if (!academyLearnerChoice || (academyLearnerChoice !== '__new__' && !state.learners.some(function (learner) { return learner.id === academyLearnerChoice; }))) {
      academyLearnerChoice = state.settings.activeLearnerId || (state.learners.length ? state.learners[0].id : '__new__');
    }
    var launchLearner = state.learners.find(function (learner) { return learner.id === academyLearnerChoice; }) || null;
    var launchSession = launchLearner ? academyOpenSession(launchLearner.id) : null;
    var sameCourse = launchSession && launchSession.courseId === course.id;
    var completedBefore = launchLearner && state.sessions.some(function (session) { return session.learnerId === launchLearner.id && session.courseId === course.id && session.status === 'COMPLETE'; });
    var launchState = academyLearnerChoice === '__new__' ? 'NEW LEARNER' : sameCourse ? (launchSession.status === 'READY_FOR_REVIEW' || launchSession.status === 'REPAIR' ? 'REVIEW READY' : launchSession.status === 'PAUSED' ? 'PAUSED' : 'IN PROGRESS') : launchSession ? 'OTHER LESSON ACTIVE' : completedBefore ? 'COMPLETED BEFORE' : installed ? 'READY TO BEGIN' : 'ADD + BEGIN';
    var launchButton = academyLearnerChoice === '__new__' ? (revised ? 'Create learner + begin revised edition' : 'Create learner + begin') : sameCourse ? (launchSession.status === 'PAUSED' ? 'Opt in + resume lesson' : 'Resume this lesson') : launchSession ? 'Resume current lesson' : completedBefore ? 'Study this lesson again' : launchLearner && !launchLearner.optedIn ? (revised ? 'Opt in + begin revised edition' : 'Opt in + begin lesson') : installed ? 'Begin this lesson' : revised ? 'Add revised edition + begin' : 'Add + begin lesson';
    var launchCopy = launchSession && !sameCourse ? esc(launchLearner.displayName) + ' already has “' + esc((state.courses.find(function (item) { return item.id === launchSession.courseId; }) || { title:launchSession.courseId }).title) + '” open. This lesson can wait on the shelf while that attributed session resumes.' : 'Beginning creates or resumes one attributed, evidence-bearing session. Reloading the Workshop keeps the learner at the same step.';
    $('academyDetail').innerHTML = '<div class="academy-detail-head"><div><span class="eyebrow">' + esc(snapshot.level) + ' · ' + esc(snapshot.organ) + '</span><h3>' + esc(snapshot.title) + '</h3></div><span class="status ready">ADMITTED ' + admissionPassed + '/' + snapshot.admission.checks.length + '</span></div>'
      + '<p class="academy-summary">' + esc(snapshot.summary) + '</p>'
      + '<div class="academy-provenance"><span>LOCAL · CONTRACT GATED</span><code>' + esc(snapshot.path) + '</code><a href="' + esc(snapshot.path) + '" target="_blank" rel="noopener">Inspect data ↗</a></div>'
      + '<div class="academy-freshness ' + freshnessClass + '"><div><span>' + esc(freshnessState) + '</span><code>' + esc(fingerprintShort) + '</code></div><p>' + esc(freshnessCopy) + '</p><small>Recipe ' + esc(snapshot.lessonFingerprint.recipe) + ' · ' + esc(snapshot.lessonFingerprint.boundary) + '</small></div>'
      + '<div class="academy-facts">' + snapshot.facts.map(function (item) { return '<article><b>' + esc(item.value) + '</b><span>' + esc(item.label) + '</span><small>' + esc(item.meaning) + '</small></article>'; }).join('') + '</div>'
      + '<div class="academy-boundary"><span>BOUNDARY STAYS IN THE LESSON</span><p>' + esc(snapshot.boundary) + '</p></div>'
      + '<h4>Human lesson path</h4><ol class="academy-steps">' + course.steps.map(function (step) { return '<li><span>' + esc(step.minutes) + ' min</span><div><b>' + esc(step.title) + '</b><small>' + esc(step.prompt) + '</small></div></li>'; }).join('') + '</ol>'
      + '<section class="academy-inheritance"><div><span>LESSON INHERITANCE</span><b>Carry this exact edition forward</b><p>One source-linked lesson only. No learners, sessions, attempts, notebook entries, classroom messages or private evidence leave with it.</p></div><button id="academyExportLesson" class="button secondary">Export lesson packet</button><small>The fingerprint detects change; it is not a source signature. Import through the top bar adds the lesson without enrolling or starting anyone.</small></section>'
      + '<section class="academy-launchpad" aria-labelledby="academyLaunchTitle"><header><div><span>LEARNER HANDOFF</span><h4 id="academyLaunchTitle">Learn this lesson</h4></div><em class="' + (launchState === 'OTHER LESSON ACTIVE' || launchState === 'PAUSED' ? 'held' : 'ready') + '">' + esc(launchState) + '</em></header><p>' + launchCopy + '</p>'
      + '<div class="academy-learner-fields"><label><span>Learner</span><select id="academyLearnerChoice">' + academyLearnerOptions(academyLearnerChoice) + '</select></label>'
      + '<label id="academyNewLearnerField"' + (academyLearnerChoice === '__new__' ? '' : ' hidden') + '><span>Your learning name</span><input id="academyNewLearnerName" maxlength="80" autocomplete="name" placeholder="Name kept on this device"></label></div>'
      + '<div class="academy-actions"><button id="academyBeginCourse" class="button primary">' + esc(launchButton) + '</button>' + (!installed ? '<button id="academyAddCourse" class="button secondary">' + (revised ? 'Add revised edition only' : 'Add to shelf only') + '</button>' : '') + '<a class="button secondary" href="' + esc(snapshot.tool) + '">Open producing organ</a></div>'
      + '<small class="academy-consent">A new or paused learner opts in only through the named button above. Completion remains a learning receipt—not authority or canon.</small></section>';
    $('academyLearnerChoice').onchange = function () { academyLearnerChoice = this.value; renderAcademy(); };
    if ($('academyNewLearnerName')) $('academyNewLearnerName').onkeydown = function (event) { if (event.key === 'Enter') $('academyBeginCourse').click(); };
    if ($('academyAddCourse')) $('academyAddCourse').onclick = function () {
      try { installAcademyCourse(course); persist(revised ? 'Revised Academy edition added · earlier learning history preserved' : 'Academy lesson added with source provenance'); } catch (error) { toast(error.message); }
    };
    $('academyExportLesson').onclick = function () {
      try {
        var packet = Academy.buildInheritancePacket(course);
        var fingerprint = packet.lesson.provenance.lessonFingerprint.value.slice(0, 12);
        download('AXM_ACADEMY_LESSON_' + snapshot.sourceId + '_' + fingerprint + '.json', packet);
        toast('Lesson-only inheritance packet exported · no learner data included');
      } catch (error) { toast(error.message); }
    };
    $('academyBeginCourse').onclick = function () { beginAcademyCourse(course); };
  }

  function beginAcademyCourse(course) {
    try {
      var isRevision = /--[a-f0-9]{12}$/.test(course.id);
      var learner = state.learners.find(function (item) { return item.id === academyLearnerChoice; }) || null;
      if (academyLearnerChoice === '__new__') {
        var name = $('academyNewLearnerName').value.trim();
        if (!name) { $('academyNewLearnerName').focus(); throw new Error('Name the learner before beginning'); }
        var added = Core.addLearner(state, { id:academyLearnerId(name), displayName:name, kind:'human', optedIn:true });
        state = added.project;
        learner = added.learner;
        academyLearnerChoice = learner.id;
      } else if (!learner) throw new Error('Choose an attributed learner');
      if (!learner.optedIn) { state = Core.setOptIn(state, learner.id, true); learner = state.learners.find(function (item) { return item.id === learner.id; }); }
      installAcademyCourse(course);
      var open = academyOpenSession(learner.id);
      if (open) {
        state.settings.activeLearnerId = learner.id;
        state.settings.activeCourseId = open.courseId;
        state.settings.activeSessionId = open.id;
        selectMode('study');
        persist(open.courseId === course.id ? 'Resumed attributed Academy lesson' : (isRevision ? 'Revised Academy edition shelved · resumed the learner’s current practice' : 'Academy lesson shelved · resumed the learner’s current practice'));
        return;
      }
      var started = Core.startSession(state, { learnerId:learner.id, courseId:course.id });
      state = started.project;
      selectMode('study');
      persist(isRevision ? 'Revised Academy edition begun · earlier sessions remain intact' : 'Academy lesson begun · progress will resume after reload');
    } catch (error) { toast(error.message); }
  }

  function renderNav() {
    $('modeNav').innerHTML = Core.MODES.map(function (mode) { return '<button class="mode-button" data-mode="' + esc(mode.id) + '"><i>' + ICONS[mode.id] + '</i><b>' + esc(mode.title) + '</b></button>'; }).join('');
    $('modeNav').querySelectorAll('[data-mode]').forEach(function (button) { button.onclick = function () { selectMode(button.dataset.mode); }; });
    document.querySelectorAll('[data-mode-jump]').forEach(function (button) { button.onclick = function () { selectMode(button.dataset.modeJump); }; });
  }
  function selectMode(mode) {
    activeMode = MODE_COPY[mode] ? mode : 'home'; state.settings.mode = activeMode;
    localStorage.setItem(STORE, JSON.stringify(state));
    if (window.AXMHub) AXMHub.save({ project:state, shared:shared });
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
  function courseOptions(selectedId) { return state.courses.map(function (course) { return '<option value="' + esc(course.id) + '"' + (course.id === selectedId ? ' selected' : '') + '>' + esc(course.title) + ' · ' + esc(course.status + courseEditionLabel(course)) + '</option>'; }).join(''); }
  function renderMetrics() {
    var summary = Core.summary(state), session = activeSession();
    $('metricCourses').textContent = summary.courses; $('metricLearners').textContent = summary.learners; $('metricSessions').textContent = summary.activeSessions; $('metricReceipts').textContent = state.receipts.length;
    $('projectTitle').textContent = state.title; $('courseCount').textContent = summary.courses; $('learnerCount').textContent = summary.learners; $('activeCount').textContent = summary.activeSessions;
    $('footerStatus').textContent = session ? session.status + ' · ' + session.learnerId + ' · ' + session.courseId : 'Ready · no active learner';
  }
  function renderHome() {
    $('courseShelf').innerHTML = state.courses.map(function (course) { return '<article class="course-item" data-course="' + esc(course.id) + '"><span>' + esc(course.level) + ' · ' + course.steps.length + ' STEPS · ' + esc(course.status + courseEditionLabel(course)) + '</span><b>' + esc(course.title) + '</b><small>' + esc(course.summary) + '</small></article>'; }).join('');
    $('courseShelf').querySelectorAll('[data-course]').forEach(function (card) { card.onclick = function () { state.settings.activeCourseId = card.dataset.course; $('courseSelect').value = card.dataset.course; selectMode('study'); }; });
    $('learnerList').innerHTML = state.learners.length ? state.learners.map(function (learner) { return '<article class="learner-item"><span>' + esc(learner.kind.toUpperCase()) + ' · ' + (learner.optedIn ? 'OPTED IN' : 'PAUSED') + '</span><b>' + esc(learner.displayName) + '</b><small>' + learner.privateProfile.completedSessions + ' completed · ' + learner.privateProfile.repairSessions + ' repair · ' + learner.privateProfile.reviewedSteps + ' steps</small></article>'; }).join('') : '<div class="empty">No learner has been added.</div>';
    var session = activeSession();
    if (!session) $('activeSessionHome').outerHTML = '<div id="activeSessionHome" class="empty">Nothing is running. Time exists; no session is forced.</div>';
    else {
      var course = state.courses.find(function (item) { return item.id === session.courseId; }), learner = state.learners.find(function (item) { return item.id === session.learnerId; });
      $('activeSessionHome').outerHTML = '<div id="activeSessionHome" class="truth-box"><b>' + esc(learner ? learner.displayName : session.learnerId) + '</b><br>' + esc(course ? course.title : session.courseId) + '<br>Step ' + Math.min(session.currentStep + 1, course.steps.length) + ' / ' + course.steps.length + ' · ' + esc(session.status) + '</div>';
    }
    renderAcademy();
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
  function sessionEvidenceReviewMarkup(review) {
    var repaired = review.repairs.filter(function (item) { return !!item.resolvedAt; }).length;
    return '<div class="session-evidence-review"><div class="session-review-summary"><div><span>LEARNER EVIDENCE REVIEW</span><b>' + review.completedSteps + ' / ' + review.totalSteps + ' responses visible</b></div><em>' + repaired + ' repaired</em></div>'
      + '<p>Compare each response with its original prompt. Completion stays available only after every step has visible evidence; choose one response to revisit if it can be clearer or more honest.</p>'
      + '<div class="session-review-rows">' + review.rows.map(function (row) {
        return '<article class="session-review-row"><header><span>' + String(row.order).padStart(2, '0') + ' · ' + esc(row.type.toUpperCase()) + '</span><em>' + row.attemptCount + ' attempt' + (row.attemptCount === 1 ? '' : 's') + '</em></header><b>' + esc(row.title) + '</b><small>Prompt · ' + esc(row.prompt) + '</small><blockquote>' + esc(row.evidence || 'Evidence missing for this step.') + '</blockquote><button class="button secondary" data-repair-step="' + esc(row.stepId) + '" aria-label="Revisit step: ' + esc(row.title) + '">Revisit this step</button></article>';
      }).join('') + '</div><div class="session-review-boundary"><span>REVIEW BOUNDARY</span><p>' + esc(review.boundary) + '</p><small>Earlier attempts remain in the session. Repair adds evidence; it never overwrites history.</small></div></div>';
  }
  function revisitEvidenceStep(session, stepId) {
    try {
      var learner = state.learners.find(function (item) { return item.id === session.learnerId; }) || null;
      var course = state.courses.find(function (item) { return item.id === session.courseId; }) || null;
      var step = course && course.steps.find(function (item) { return item.id === stepId; });
      if (!step) throw new Error('review step is no longer available');
      var reopened = Core.reviewSession(state, { sessionId:session.id, decision:'REPAIR', stepId:step.id, note:'Learner explicitly reopened “' + step.title + '” after comparing the visible evidence sequence.', reviewer:learner ? learner.id : 'local-learner' });
      state = reopened.project;
      persist('Reopened one evidence step for repair · prior attempts preserved');
    } catch (error) { toast(error.message); }
  }
  function renderLesson() {
    var session = activeSession();
    if (!session) { $('lessonTitle').textContent = 'No active lesson'; $('lessonProgress').textContent = '0 / 0'; $('lessonBody').innerHTML = '<div class="empty">Start a session to open the first step.</div>'; $('lessonEvidenceField').hidden = true; $('openStepTool').disabled = true; $('completeStep').disabled = true; $('completeStep').textContent = 'Record step + continue'; return; }
    var course = state.courses.find(function (item) { return item.id === session.courseId; });
    if (session.status === 'PAUSED') {
      $('lessonTitle').textContent = 'Session paused by learner'; $('lessonProgress').textContent = session.currentStep + ' / ' + course.steps.length;
      $('lessonBody').innerHTML = '<h4>Consent is currently paused.</h4><p>The session and its evidence remain preserved, but no next step may be recorded until this learner explicitly opts in again.</p>';
      $('lessonEvidenceField').hidden = true; $('openStepTool').disabled = true; $('completeStep').disabled = true; $('completeStep').textContent = 'Paused'; return;
    }
    if (session.status === 'READY_FOR_REVIEW' || session.status === 'REPAIR') {
      var review = Core.prepareSessionReview(state, session.id);
      $('lessonTitle').textContent = session.status === 'REPAIR' ? 'Repair review' : 'Session evidence review'; $('lessonProgress').textContent = review.completedSteps + ' / ' + review.totalSteps;
      $('lessonBody').innerHTML = '<h4>' + esc(course.title) + '</h4>' + sessionEvidenceReviewMarkup(review);
      $('lessonEvidenceField').hidden = true;
      $('lessonBody').querySelectorAll('[data-repair-step]').forEach(function (button) { button.onclick = function () { revisitEvidenceStep(session, button.dataset.repairStep); }; });
      $('openStepTool').disabled = true; $('completeStep').disabled = !review.canComplete; $('completeStep').textContent = review.canComplete ? 'Complete after evidence review' : 'Evidence missing'; return;
    }
    var step = course.steps[session.currentStep];
    $('lessonEvidenceField').hidden = false;
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
      if (session.status === 'READY_FOR_REVIEW' || session.status === 'REPAIR') { var review = Core.prepareSessionReview(state, session.id), learner = state.learners.find(function (item) { return item.id === session.learnerId; }) || null; var reviewed = Core.reviewSession(state, { sessionId:session.id, decision:'COMPLETE', note:'Learner reviewed ' + review.completedSteps + '/' + review.totalSteps + ' visible evidence responses. Earlier attempts and focused repairs remain preserved.', reviewer:learner ? learner.id : 'local-steward' }); state = reviewed.project; persist('Visible evidence reviewed and session completed · no authority granted'); return; }
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
    $('browseAcademy').onclick = function () { $('academyFoundation').scrollIntoView({ behavior:'smooth', block:'start' }); };
    $('addLearner').onclick = addLearner; $('learnerSelect').onchange = selectLearner; $('courseSelect').onchange = selectCourse; $('toggleOptIn').onclick = toggleOptIn; $('startSession').onclick = startSession; $('openStepTool').onclick = openStepTool; $('completeStep').onclick = finishOrAdvance;
    $('gradeAssessment').onclick = gradeAssessment; ['evidenceInput','sourceInput','contradictionInput'].forEach(function (id) { $(id).oninput = updateLabPreview; }); $('runLab').onclick = runLab;
    $('resetCode').onclick = function () { $('codeSource').value = codeChallenge.starter; toast('Starter restored'); }; $('runCode').onclick = runCodeSandbox;
    $('sendClassroom').onclick = sendClassroom; $('addNote').onclick = addNote; $('checkSchool').onclick = checkSchool; $('buildSchoolHandoff').onclick = buildSchoolHandoff; $('createCourse').onclick = createCourse;
    $('academyReviewClose').onclick = closeInheritanceReview; $('academyReviewCancel').onclick = closeInheritanceReview; $('academyReviewAccept').onclick = admitInheritanceReview;
    $('academyImportReview').addEventListener('cancel', function (event) { event.preventDefault(); closeInheritanceReview(); });
    $('exportProject').onclick = function () { download('AXM_LEARNING_LAB_' + state.id + '.json', Core.exportPacket(state)); toast('Portable learning project exported'); };
    $('importProject').onchange = function (event) { var file = event.target.files[0]; if (!file) return; file.text().then(function (content) { importLearningFile(JSON.parse(content)); }).catch(function (error) { toast(error.message); }); event.target.value = ''; };
    $('newProject').onclick = function () { if (!window.confirm('Start a fresh Learning Lab project? Export first if this project matters.')) return; state = Core.createProject(); shared = createShared(); persist('Fresh Learning Lab project created'); selectMode('home'); };
  }

  function init(saved) {
    if (saved && saved.project && saved.project.schema === Core.FORMAT) state = Core.normalize(saved.project);
    if (saved && saved.shared) shared = saved.shared;
    renderNav(); bind(); selectMode(activeMode); updateLabPreview(); loadAcademySources();
  }
  if (window.AXMHub) {
    AXMHub.onInit(function (payload) { init(payload && payload.savedState); });
    AXMHub.ready({ id:'learning-lab', name:'AXM Academy · Learning Lab', version:'v0.1', hubApiVersion:'1.0', permissions:['storage','export','shared-engines'], savesState:true, handlesShutdown:false, capabilities:['source-to-lesson-academy','categorized-local-curriculum','lessons','assessment','simulation','sandboxed-code','classroom','notebook','course-authoring','school-door'] });
  } else init();
}());
