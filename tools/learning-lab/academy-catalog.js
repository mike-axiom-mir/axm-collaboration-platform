(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMAcademyCatalog = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FORMAT = 'axm.academy.source-lesson/v1';
  var CATEGORIES = [
    { id: 'all', title: 'All fields', description: 'Every source currently admitted to the Academy.' },
    { id: 'visual-language', title: 'Visual language', description: 'Colour, form, atmosphere, accessibility and presentation boundaries.' },
    { id: 'organ-building', title: 'Organ building', description: 'How reusable molds, contracts and bounded systems are assembled.' },
    { id: 'living-systems', title: 'Living systems', description: 'Cause, feedback, conservation and honest model limits.' },
    { id: 'evidence-stewardship', title: 'Evidence stewardship', description: 'How observations become durable lessons without becoming dogma.' }
  ];
  var CATALOG_FORMAT = 'axm.academy.source-catalog/v1';
  var PATH_CATALOG_FORMAT = 'axm.academy.learning-path-catalog/v1';
  var FINGERPRINT_ALGORITHM = 'dual-fnv1a32/v2';
  var LESSON_RECIPE = 'source-observe-organ-boundary-model-inheritance/v1';
  var INHERITANCE_FORMAT = 'axm.academy.inheritance-packet/v1';
  var INHERITANCE_BOUNDARY = 'Lesson edition and source provenance only. The fingerprint detects change; it is not proof of source authenticity. Import adds one course to the shelf; it does not enroll, start, merge identities, or import private learner state.';
  var MAX_INHERITANCE_BYTES = 262144;
  var COURSE_FIELDS = ['id', 'title', 'summary', 'level', 'source', 'status', 'category', 'authority', 'tags', 'provenance', 'steps'];
  var PROVENANCE_FIELDS = ['schema', 'sourceId', 'lineageId', 'editionId', 'lessonFingerprint', 'path', 'tool', 'organ', 'quality', 'admission', 'extractedFacts', 'boundary'];
  var FINGERPRINT_FIELDS = ['algorithm', 'value', 'recipe', 'boundary'];
  var FACT_FIELDS = ['label', 'value', 'meaning'];
  var STEP_FIELDS = ['id', 'type', 'title', 'minutes', 'body', 'prompt'];
  var PACKET_FIELDS = ['schema', 'version', 'exportedAt', 'lineageId', 'editionId', 'lesson', 'privacy', 'boundary'];
  var PRIVACY_FIELDS = ['scope', 'learners', 'sessions', 'attempts', 'notebookEntries', 'classroomMessages'];
  var SNAPSHOT_QUALITY = ['local source', 'explicit provenance', 'bounded extraction', 'human review required'];
  var ADMISSION_CHECKS = ['catalog-contract', 'local-source-route', 'bounded-fact-extraction', 'explicit-non-claim-boundary'];
  var ALLOWED_ADAPTERS = ['preskins', 'molds', 'aetherglass', 'planet', 'lineage', 'module-contract'];
  var SOURCE_FIELDS = ['id', 'category', 'adapter', 'organ', 'title', 'level', 'path', 'summary', 'boundary', 'tool'];
  var PATH_FIELDS = ['id', 'title', 'level', 'audience', 'summary', 'boundary', 'outcomes', 'stages'];
  var PATH_STAGE_FIELDS = ['sourceId', 'reason'];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function text(value, fallback) { var out = String(value == null ? '' : value).trim(); return out || (fallback || ''); }
  function unique(values) { return Array.from(new Set((values || []).filter(Boolean))); }
  function fact(label, value, meaning) { return { label: label, value: String(value), meaning: meaning }; }
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') {
      var out = {};
      Object.keys(value).sort().forEach(function (key) { out[key] = stable(value[key]); });
      return out;
    }
    return value;
  }
  function same(value, expected) { return JSON.stringify(stable(value)) === JSON.stringify(stable(expected)); }
  function record(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function exactFields(value, fields, label, errors) {
    if (!record(value)) { errors.push(label + ' must be an object'); return false; }
    Object.keys(value).forEach(function (field) { if (fields.indexOf(field) < 0) errors.push(label + ' field is unsupported: ' + field); });
    fields.forEach(function (field) { if (!Object.prototype.hasOwnProperty.call(value, field)) errors.push(label + ' field is required: ' + field); });
    return true;
  }
  function fnv1a32(value, seed) {
    var source = JSON.stringify(stable(value)), hash = seed >>> 0;
    for (var index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return ('00000000' + hash.toString(16)).slice(-8);
  }
  function compiledLessonSteps(snapshot) {
    snapshot = record(snapshot) ? snapshot : {};
    var sourceId = text(snapshot.sourceId, 'unidentified-source');
    var facts = Array.isArray(snapshot.facts) ? snapshot.facts : [];
    var factLines = facts.map(function (item) { return text(item && item.label) + ': ' + text(item && item.value) + ' — ' + text(item && item.meaning); }).join('\n');
    return [
      { id: sourceId + '-source', type: 'lesson', title: 'Read the source before the story', minutes: 7, body: factLines, prompt: 'Write two observations that are present in the source and one conclusion the source does not earn.' },
      { id: sourceId + '-organ', type: 'lesson', title: 'Meet the organ', minutes: 8, body: text(snapshot.organ) + ' turns bounded inputs into inspectable outputs. Its data is useful because the producing organ and route remain named.', prompt: 'Explain the organ as input → transformation → output. Name where a receipt or boundary appears.' },
      { id: sourceId + '-boundary', type: 'reflection', title: 'Find the edge of the claim', minutes: 6, body: text(snapshot.boundary), prompt: 'What would become misleading if this boundary disappeared from the lesson?' },
      { id: sourceId + '-model', type: 'lesson', title: 'Build a small teaching model', minutes: 10, body: 'Choose two extracted facts and connect them with a testable relationship. Keep description, cause and value judgment separate.', prompt: 'Make one diagram, comparison or experiment another learner could reproduce.' },
      { id: sourceId + '-inherit', type: 'reflection', title: 'Leave a path for the next learner', minutes: 6, body: 'The lesson is useful only if someone after us can find the source, repeat the observation and challenge the interpretation.', prompt: 'Write the source path, the smallest repeatable check and one open question.' }
    ];
  }
  function fingerprintSemantics(snapshot) {
    return {
      recipe: LESSON_RECIPE,
      schema: snapshot && snapshot.schema,
      sourceId: snapshot && snapshot.sourceId,
      category: snapshot && snapshot.category,
      organ: snapshot && snapshot.organ,
      title: snapshot && snapshot.title,
      level: snapshot && snapshot.level,
      path: snapshot && snapshot.path,
      tool: snapshot && snapshot.tool,
      summary: snapshot && snapshot.summary,
      boundary: snapshot && snapshot.boundary,
      facts: snapshot && snapshot.facts,
      steps: compiledLessonSteps(snapshot)
    };
  }
  function lessonFingerprint(snapshot) {
    var semanticLesson = fingerprintSemantics(snapshot);
    return {
      algorithm: FINGERPRINT_ALGORITHM,
      value: fnv1a32(semanticLesson, 2166136261) + fnv1a32(semanticLesson, 2654435769),
      recipe: LESSON_RECIPE,
      boundary: 'Change detector for source semantics, compiler recipe and generated teaching steps; not a cryptographic source signature.'
    };
  }
  function localPath(value, jsonOnly) {
    value = text(value);
    if (!value || value.length > 260 || /[:?#\[\]\\]/.test(value) || !/^(?:\.\/|(?:\.\.\/){1,2})[a-z0-9._/-]+$/i.test(value)) return false;
    var tail = value.replace(/^(?:\.\/|(?:\.\.\/){1,2})/, '');
    if (/(^|\/)\.\.(\/|$)/.test(tail) || /\/\//.test(tail)) return false;
    if (jsonOnly && !/\.json$/i.test(value)) return false;
    return true;
  }
  function cleanSource(input) {
    var out = {};
    SOURCE_FIELDS.forEach(function (field) { out[field] = text(input && input[field]); });
    return out;
  }
  function validateCatalog(input) {
    var errors = [], seen = {}, knownCategories = CATEGORIES.filter(function (item) { return item.id !== 'all'; }).map(function (item) { return item.id; });
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok:false, errors:['catalog must be an object'], sources:[] };
    Object.keys(input).forEach(function (field) { if (['schema', 'version', 'sources'].indexOf(field) < 0) errors.push('catalog field is unsupported: ' + field); });
    if (input.schema !== CATALOG_FORMAT) errors.push('catalog schema must be ' + CATALOG_FORMAT);
    if (input.version !== 1) errors.push('catalog version must be 1');
    if (!Array.isArray(input.sources) || input.sources.length < 1 || input.sources.length > 64) errors.push('catalog needs 1 to 64 sources');
    var rawSources = Array.isArray(input.sources) ? input.sources : [];
    rawSources.forEach(function (entry, index) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
      Object.keys(entry).forEach(function (field) { if (SOURCE_FIELDS.indexOf(field) < 0) errors.push('source[' + index + '] field is unsupported: ' + field); });
    });
    var sources = rawSources.map(cleanSource);
    sources.forEach(function (entry, index) {
      var prefix = 'source[' + index + '] ';
      SOURCE_FIELDS.forEach(function (field) { if (!entry[field]) errors.push(prefix + field + ' is required'); });
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) || entry.id.length > 80) errors.push(prefix + 'id is invalid');
      if (seen[entry.id]) errors.push(prefix + 'id is duplicated: ' + entry.id);
      seen[entry.id] = true;
      if (knownCategories.indexOf(entry.category) < 0) errors.push(prefix + 'category is unsupported: ' + entry.category);
      if (ALLOWED_ADAPTERS.indexOf(entry.adapter) < 0) errors.push(prefix + 'adapter is unsupported: ' + entry.adapter);
      if (entry.organ.length < 2 || entry.organ.length > 120) errors.push(prefix + 'organ must be 2 to 120 characters');
      if (entry.title.length < 3 || entry.title.length > 140) errors.push(prefix + 'title must be 3 to 140 characters');
      if (entry.level.length < 3 || entry.level.length > 40) errors.push(prefix + 'level must be 3 to 40 characters');
      if (!localPath(entry.path, true)) errors.push(prefix + 'path must be a local relative JSON file');
      if (!localPath(entry.tool, false)) errors.push(prefix + 'tool must be a local relative route');
      if (entry.summary.length < 40 || entry.summary.length > 500) errors.push(prefix + 'summary must be 40 to 500 characters');
      if (entry.boundary.length < 40 || entry.boundary.length > 600) errors.push(prefix + 'boundary must be 40 to 600 characters');
    });
    return { ok:errors.length === 0, errors:errors, sources:errors.length ? [] : sources };
  }
  function validateLearningPaths(input, sources) {
    var errors = [], pathIds = {}, knownSources = {};
    (Array.isArray(sources) ? sources : []).forEach(function (source) {
      if (source && text(source.id)) knownSources[text(source.id)] = true;
    });
    if (!record(input)) return { ok:false, errors:['learning path catalog must be an object'], paths:[] };
    exactFields(input, ['schema', 'version', 'paths'], 'learning path catalog', errors);
    if (input.schema !== PATH_CATALOG_FORMAT) errors.push('learning path catalog schema must be ' + PATH_CATALOG_FORMAT);
    if (input.version !== 1) errors.push('learning path catalog version must be 1');
    if (!Array.isArray(input.paths) || input.paths.length < 1 || input.paths.length > 16) errors.push('learning path catalog needs 1 to 16 paths');
    var paths = Array.isArray(input.paths) ? input.paths.map(function (rawPath, pathIndex) {
      var prefix = 'path[' + pathIndex + '] ', stageIds = {};
      if (!exactFields(rawPath, PATH_FIELDS, prefix.trim(), errors)) return null;
      var path = {
        id: text(rawPath.id),
        title: text(rawPath.title),
        level: text(rawPath.level),
        audience: text(rawPath.audience),
        summary: text(rawPath.summary),
        boundary: text(rawPath.boundary),
        outcomes: Array.isArray(rawPath.outcomes) ? rawPath.outcomes.map(function (outcome) { return text(outcome); }) : [],
        stages: []
      };
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path.id) || path.id.length > 80) errors.push(prefix + 'id is invalid');
      if (pathIds[path.id]) errors.push(prefix + 'id is duplicated: ' + path.id);
      pathIds[path.id] = true;
      [['title', 3, 140], ['level', 3, 80], ['audience', 20, 300], ['summary', 40, 500], ['boundary', 40, 600]].forEach(function (limit) {
        if (path[limit[0]].length < limit[1] || path[limit[0]].length > limit[2]) errors.push(prefix + limit[0] + ' must be ' + limit[1] + ' to ' + limit[2] + ' characters');
      });
      if (!Array.isArray(rawPath.outcomes) || rawPath.outcomes.length < 2 || rawPath.outcomes.length > 6) errors.push(prefix + 'outcomes must contain 2 to 6 statements');
      path.outcomes.forEach(function (outcome, outcomeIndex) {
        if (outcome.length < 10 || outcome.length > 240) errors.push(prefix + 'outcome[' + outcomeIndex + '] must be 10 to 240 characters');
      });
      if (!Array.isArray(rawPath.stages) || rawPath.stages.length < 2 || rawPath.stages.length > 12) errors.push(prefix + 'stages must contain 2 to 12 entries');
      path.stages = (Array.isArray(rawPath.stages) ? rawPath.stages : []).map(function (rawStage, stageIndex) {
        var stagePrefix = prefix + 'stage[' + stageIndex + '] ';
        if (!exactFields(rawStage, PATH_STAGE_FIELDS, stagePrefix.trim(), errors)) return null;
        var stage = { sourceId:text(rawStage.sourceId), reason:text(rawStage.reason) };
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stage.sourceId) || stage.sourceId.length > 80) errors.push(stagePrefix + 'sourceId is invalid');
        if (!knownSources[stage.sourceId]) errors.push(stagePrefix + 'sourceId is not admitted: ' + stage.sourceId);
        if (stageIds[stage.sourceId]) errors.push(stagePrefix + 'sourceId is duplicated: ' + stage.sourceId);
        stageIds[stage.sourceId] = true;
        if (stage.reason.length < 20 || stage.reason.length > 300) errors.push(stagePrefix + 'reason must be 20 to 300 characters');
        return stage;
      }).filter(Boolean);
      return path;
    }).filter(Boolean) : [];
    return { ok:errors.length === 0, errors:errors, paths:errors.length ? [] : paths };
  }
  function learningPathProgress(path, courses, sessions, learnerId, snapshots) {
    if (!record(path) || !Array.isArray(path.stages)) throw new Error('validated Academy learning path required');
    courses = Array.isArray(courses) ? courses : [];
    sessions = Array.isArray(sessions) ? sessions : [];
    snapshots = Array.isArray(snapshots) ? snapshots : [];
    learnerId = text(learnerId);
    var learnerSessions = learnerId ? sessions.filter(function (session) { return session && session.learnerId === learnerId; }) : [];
    var stages = path.stages.map(function (stage) {
      var currentSnapshot = snapshots.find(function (snapshot) { return snapshot && snapshot.sourceId === stage.sourceId && snapshot.schema === FORMAT; }) || null;
      var currentFingerprint = currentSnapshot ? (currentSnapshot.lessonFingerprint || lessonFingerprint(currentSnapshot)) : null;
      var stageCourses = courses.filter(function (course) { return course && course.provenance && course.provenance.sourceId === stage.sourceId; });
      var currentCourses = currentFingerprint ? stageCourses.filter(function (course) {
        var stored = course.provenance && course.provenance.lessonFingerprint;
        return stored && stored.algorithm === currentFingerprint.algorithm && stored.recipe === currentFingerprint.recipe && stored.value === currentFingerprint.value;
      }) : stageCourses;
      var currentCourseIds = currentCourses.map(function (course) { return course.id; });
      var historicalCourses = currentFingerprint ? stageCourses.filter(function (course) { return currentCourseIds.indexOf(course.id) < 0; }) : [];
      var historicalCourseIds = historicalCourses.map(function (course) { return course.id; });
      var currentSessions = learnerSessions.filter(function (session) { return currentCourseIds.indexOf(session.courseId) >= 0; });
      var historicalSessions = learnerSessions.filter(function (session) { return historicalCourseIds.indexOf(session.courseId) >= 0; });
      var complete = currentSessions.some(function (session) { return session.status === 'COMPLETE'; });
      var historicalComplete = historicalSessions.some(function (session) { return session.status === 'COMPLETE'; });
      var open = currentSessions.slice().reverse().find(function (session) { return ['ACTIVE', 'PAUSED', 'READY_FOR_REVIEW', 'REPAIR'].indexOf(session.status) >= 0; }) || null;
      var historicalOpen = historicalSessions.slice().reverse().find(function (session) { return ['ACTIVE', 'PAUSED', 'READY_FOR_REVIEW', 'REPAIR'].indexOf(session.status) >= 0; }) || null;
      var status = complete ? 'COMPLETE' : open ? 'IN_PROGRESS' : historicalComplete ? 'REVIEW_UPDATED' : historicalOpen ? 'OLD_IN_PROGRESS' : currentCourses.length ? 'SHELVED' : historicalCourses.length ? 'UPDATE_AVAILABLE' : 'READY';
      var chosenCourse = open ? currentCourses.find(function (course) { return course.id === open.courseId; }) : historicalOpen ? historicalCourses.find(function (course) { return course.id === historicalOpen.courseId; }) : currentCourses[0] || historicalCourses[0] || null;
      return {
        sourceId: stage.sourceId,
        reason: stage.reason,
        status: status,
        courseId: chosenCourse ? chosenCourse.id : null,
        sessionId: open ? open.id : historicalOpen ? historicalOpen.id : null,
        historicalComplete: historicalComplete,
        currentFingerprint: currentFingerprint ? currentFingerprint.value : null
      };
    });
    var completed = stages.filter(function (stage) { return stage.status === 'COMPLETE'; }).length;
    var historicalCompleted = stages.filter(function (stage) { return stage.historicalComplete; }).length;
    var next = stages.find(function (stage) { return stage.status === 'IN_PROGRESS'; }) || stages.find(function (stage) { return stage.status === 'OLD_IN_PROGRESS'; }) || stages.find(function (stage) { return stage.status === 'REVIEW_UPDATED'; }) || stages.find(function (stage) { return stage.status === 'UPDATE_AVAILABLE'; }) || stages.find(function (stage) { return stage.status !== 'COMPLETE'; }) || null;
    return {
      pathId: path.id,
      learnerId: learnerId || null,
      completed: completed,
      historicalCompleted: historicalCompleted,
      total: stages.length,
      percent: stages.length ? Math.round(completed / stages.length * 100) : 0,
      nextSourceId: next ? next.sourceId : null,
      stages: clone(stages)
    };
  }
  function inspectPreskins(data) {
    var rows = Array.isArray(data && data.presets) ? data.presets : [];
    if (!rows.length) throw new Error('preskin catalog has no entries');
    if (Number(data.count) !== rows.length) throw new Error('preskin catalog count does not match its entries');
    var families = unique(rows.map(function (item) { return item.family; }));
    var sealed = rows.filter(function (item) { return /^[a-f0-9]{64}$/i.test(text(item.integrity)); }).length;
    return [
      fact('Portable preskins', rows.length, 'Distinct examples available for comparison.'),
      fact('Visual families', families.length, families.join(', ') || 'No families declared.'),
      fact('Integrity receipts', sealed + ' / ' + rows.length, 'Entries with a content-addressed integrity value.'),
      fact('Release', text(data && data.release, 'unknown'), text(data && data.status, 'status not declared'))
    ];
  }
  function inspectMolds(data) {
    var rows = Array.isArray(data && data.kits) ? data.kits : [];
    if (!rows.length) throw new Error('mold catalog has no entries');
    if (Number(data.count) !== rows.length) throw new Error('mold catalog count does not match its entries');
    var molds = unique(rows.map(function (item) { return item.moldId; }));
    var profiles = unique(rows.map(function (item) { return item.performanceProfile; }));
    return [
      fact('Generated kits', rows.length, 'Concrete outputs learners can compare.'),
      fact('Semantic molds', molds.length, molds.slice(0, 6).join(', ') + (molds.length > 6 ? '…' : '')),
      fact('Performance profiles', profiles.length, profiles.join(', ') || 'No profiles declared.'),
      fact('Hashed outputs', rows.filter(function (item) { return /^[a-f0-9]{64}$/i.test(text(item.sha256)); }).length + ' / ' + rows.length, 'Generated files with a SHA-256 receipt.')
    ];
  }
  function inspectAetherglass(data) {
    var rollback = data && data.rollback && typeof data.rollback === 'object' ? data.rollback : {};
    if (!text(data && data.version) || !text(data && data.status)) throw new Error('visual engine must declare version and status');
    if (!Array.isArray(data && data.runtime) || !data.runtime.length) throw new Error('visual engine must declare at least one runtime surface');
    if (!Object.keys(rollback).length) throw new Error('visual engine must declare rollback paths');
    var rollbackReady = Object.keys(rollback).filter(function (key) { return rollback[key] === true; }).length;
    return [
      fact('Engine version', text(data && data.version, 'unknown'), text(data && data.status, 'status not declared')),
      fact('Runtime surfaces', Array.isArray(data && data.runtime) ? data.runtime.length : 0, (data && data.runtime || []).join(', ')),
      fact('Rollback paths', rollbackReady, 'Explicit reversible operations declared by the organ.'),
      fact('Network access', data && data.network_access === false ? 'OFF' : 'DECLARED / UNKNOWN', 'Atmosphere does not require a remote service.'),
      fact('Automatic rewrite', data && data.automatic_rewrite === false ? 'OFF' : 'DECLARED / UNKNOWN', 'Presentation does not silently rewrite content.')
    ];
  }
  function inspectPlanet(data) {
    var truth = data && data.truth && typeof data.truth === 'object' ? data.truth : {};
    var keys = Object.keys(truth), supported = keys.filter(function (key) { return truth[key] === true; });
    if (keys.length < 10) throw new Error('living-world truth map is missing or too small to teach honestly');
    var refused = keys.filter(function (key) { return truth[key] === false; });
    var conservation = supported.filter(function (key) { return /conservation_checked/.test(key); });
    return [
      fact('Truth-map claims', keys.length, 'Every true and false capability remains inspectable.'),
      fact('Supported claims', supported.length, 'Claims this manifest explicitly marks true.'),
      fact('Explicit non-claims', refused.length, 'Limits kept visible instead of being omitted.'),
      fact('Conservation checks', conservation.length, 'Declared bounded ledgers that can become inquiry prompts.'),
      fact('Scientific Earth model', truth.scientific_earth_model === false ? 'NO' : 'UNKNOWN', 'The model names what it is not.')
    ];
  }
  function inspectLineage(data) {
    var actions = Array.isArray(data && data.actions) ? data.actions : [];
    var readiness = Array.isArray(data && data.readiness) ? data.readiness : [];
    if (!actions.length || !readiness.length) throw new Error('lineage source must declare actions and readiness conditions');
    return [
      fact('Inspectable actions', actions.length, actions.join(' · ')),
      fact('Readiness conditions', readiness.length, readiness.join(', ')),
      fact('Risk class', text(data && data.risk, 'UNKNOWN'), 'The source declares its operating risk.'),
      fact('Automatic promotion', /no-automatic-promotion/.test(readiness.join(' ')) ? 'OFF' : 'UNKNOWN', 'A lesson remains review-required.')
    ];
  }
  function inspectModuleContract(data) {
    var handoffs = record(data && data.handoffs) ? data.handoffs : {};
    var boundaries = record(data && data.boundaries) ? data.boundaries : {};
    var provides = Array.isArray(data && data.provides) ? data.provides.map(function (item) { return text(item); }).filter(Boolean) : [];
    var consumes = Array.isArray(data && data.consumes) ? data.consumes.map(function (item) { return text(item); }).filter(Boolean) : [];
    var emits = Array.isArray(handoffs.emits) ? handoffs.emits.map(function (item) { return text(item); }).filter(Boolean) : [];
    var accepts = Array.isArray(handoffs.accepts) ? handoffs.accepts.map(function (item) { return text(item); }).filter(Boolean) : [];
    var slots = Array.isArray(data && data.adapterSlots) ? data.adapterSlots.map(function (item) { return text(item); }).filter(Boolean) : [];
    var writes = Array.isArray(boundaries.writes) ? boundaries.writes.map(function (item) { return text(item); }).filter(Boolean) : [];
    var refuses = Array.isArray(boundaries.refuses) ? boundaries.refuses.map(function (item) { return text(item); }).filter(Boolean) : [];
    if (data && data.schema !== 'axm.module-contract/v1') throw new Error('module contract schema must be axm.module-contract/v1');
    if (!text(data && data.id) || !text(data && data.version)) throw new Error('module contract must declare id and version');
    if (!provides.length) throw new Error('module contract must declare at least one capability');
    if (!record(data && data.handoffs) || !Array.isArray(handoffs.emits) || !Array.isArray(handoffs.accepts)) throw new Error('module contract must declare emitted and accepted handoffs');
    if (!refuses.length) throw new Error('module contract must declare at least one explicit refusal');
    var receiptPayload = {
      schema: data.schema,
      id: text(data.id),
      version: text(data.version),
      provides: provides,
      consumes: consumes,
      handoffs: { emits: emits, accepts: accepts },
      adapterSlots: slots,
      boundaries: { writes: writes, refuses: refuses }
    };
    var receipt = fnv1a32(receiptPayload, 2166136261) + fnv1a32(receiptPayload, 2654435769);
    return [
      fact('Declared capabilities', provides.length, provides.slice(0, 3).join(', ') + (provides.length > 3 ? '…' : '')),
      fact('Consumed dependencies', consumes.length, 'Named services, workspaces and child systems the organ expects.'),
      fact('Handoff routes', emits.length + ' out / ' + accepts.length + ' in', 'Declared formats crossing the organ boundary.'),
      fact('Explicit refusals', refuses.length, 'Promises the organ makes about behavior it will not perform.'),
      fact('Extension slots', slots.length, slots.length ? slots.slice(0, 4).join(', ') + (slots.length > 4 ? '…' : '') : 'No extension slots declared.'),
      fact('Contract change receipt', receipt, 'Non-cryptographic detector over the declared capabilities, dependencies, handoffs, extension slots, writes and refusals.')
    ];
  }
  var INSPECTORS = { preskins: inspectPreskins, molds: inspectMolds, aetherglass: inspectAetherglass, planet: inspectPlanet, lineage: inspectLineage, 'module-contract': inspectModuleContract };

  function buildSnapshot(entry, data) {
    entry = cleanSource(entry);
    var checked = validateCatalog({ schema:CATALOG_FORMAT, version:1, sources:[entry] });
    if (!checked.ok) throw new Error('Academy source refused: ' + checked.errors.join('; '));
    entry = checked.sources[0];
    var inspector = INSPECTORS[entry.adapter];
    if (!inspector) throw new Error('Academy adapter not found: ' + entry.adapter);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Academy source data must be an object');
    var facts = inspector(data);
    var factErrors = [];
    if (facts.length < 4 || facts.length > 12) factErrors.push('source must produce 4 to 12 bounded facts');
    facts.forEach(function (item, index) {
      if (!text(item.label) || !text(item.value) || !text(item.meaning)) factErrors.push('fact[' + index + '] must name label, value and meaning');
    });
    if (factErrors.length) throw new Error('Academy source refused: ' + factErrors.join('; '));
    var snapshot = {
      schema: FORMAT,
      sourceId: entry.id,
      category: entry.category,
      organ: entry.organ,
      title: entry.title,
      level: entry.level,
      path: entry.path,
      tool: entry.tool,
      summary: entry.summary,
      boundary: entry.boundary,
      facts: facts,
      quality: ['local source', 'explicit provenance', 'bounded extraction', 'human review required'],
      admission: {
        state: 'ADMITTED',
        checks: [
          { id:'catalog-contract', pass:true },
          { id:'local-source-route', pass:true },
          { id:'bounded-fact-extraction', pass:true },
          { id:'explicit-non-claim-boundary', pass:true }
        ]
      },
      authority: 'NONE'
    };
    snapshot.lessonFingerprint = lessonFingerprint(snapshot);
    return snapshot;
  }

  function courseFromSnapshot(snapshot, options) {
    if (!snapshot || snapshot.schema !== FORMAT || !Array.isArray(snapshot.facts) || !snapshot.facts.length || !snapshot.admission || snapshot.admission.state !== 'ADMITTED') throw new Error('admitted Academy snapshot required');
    options = options || {};
    var fingerprint = snapshot.lessonFingerprint && snapshot.lessonFingerprint.algorithm === FINGERPRINT_ALGORITHM && snapshot.lessonFingerprint.recipe === LESSON_RECIPE && snapshot.lessonFingerprint.boundary === lessonFingerprint({}).boundary && /^[a-f0-9]{16}$/.test(snapshot.lessonFingerprint.value) ? clone(snapshot.lessonFingerprint) : lessonFingerprint(snapshot);
    var baseId = 'academy-' + snapshot.sourceId;
    return {
      id: options.edition === true ? baseId + '--' + fingerprint.value.slice(0, 12) : baseId,
      title: snapshot.title,
      summary: snapshot.summary,
      level: snapshot.level,
      source: 'academy:' + snapshot.organ,
      status: 'CURATED DRAFT',
      category: snapshot.category,
      authority: 'NONE',
      tags: ['academy', snapshot.category, snapshot.organ.toLowerCase().replace(/[^a-z0-9]+/g, '-')],
      provenance: {
        schema: FORMAT,
        sourceId: snapshot.sourceId,
        lineageId: 'academy:' + snapshot.sourceId,
        editionId: 'academy:' + snapshot.sourceId + '@' + fingerprint.value,
        lessonFingerprint: fingerprint,
        path: snapshot.path,
        tool: snapshot.tool,
        organ: snapshot.organ,
        quality: clone(snapshot.quality),
        admission: clone(snapshot.admission),
        extractedFacts: clone(snapshot.facts),
        boundary: snapshot.boundary
      },
      steps: compiledLessonSteps(snapshot)
    };
  }

  function snapshotFromCourse(course) {
    var errors = [], provenance, fingerprint, facts, admission;
    exactFields(course, COURSE_FIELDS, 'lesson', errors);
    provenance = record(course && course.provenance) ? course.provenance : {};
    exactFields(provenance, PROVENANCE_FIELDS, 'lesson.provenance', errors);
    fingerprint = record(provenance.lessonFingerprint) ? provenance.lessonFingerprint : {};
    exactFields(fingerprint, FINGERPRINT_FIELDS, 'lesson fingerprint', errors);
    if (fingerprint.algorithm !== FINGERPRINT_ALGORITHM) errors.push('lesson fingerprint algorithm must be ' + FINGERPRINT_ALGORITHM);
    if (!/^[a-f0-9]{16}$/.test(text(fingerprint.value))) errors.push('lesson fingerprint value must be 16 lowercase hex characters');
    if (fingerprint.recipe !== LESSON_RECIPE) errors.push('lesson fingerprint recipe must be ' + LESSON_RECIPE);
    if (fingerprint.boundary !== lessonFingerprint({}).boundary) errors.push('lesson fingerprint boundary is not exact');
    if (provenance.schema !== FORMAT) errors.push('lesson provenance schema must be ' + FORMAT);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text(provenance.sourceId)) || text(provenance.sourceId).length > 80) errors.push('lesson sourceId is invalid');
    if (!localPath(provenance.path, true)) errors.push('lesson source path must be a local relative JSON file');
    if (!localPath(provenance.tool, false)) errors.push('lesson producing tool must be a local relative route');
    if (!same(provenance.quality, SNAPSHOT_QUALITY)) errors.push('lesson quality gates are not the Academy set');
    admission = record(provenance.admission) ? provenance.admission : {};
    exactFields(admission, ['state', 'checks'], 'lesson admission', errors);
    if (admission.state !== 'ADMITTED') errors.push('lesson admission state must be ADMITTED');
    if (!Array.isArray(admission.checks) || admission.checks.length !== ADMISSION_CHECKS.length) errors.push('lesson admission must contain the four Academy checks');
    else admission.checks.forEach(function (check, index) {
      exactFields(check, ['id', 'pass'], 'lesson admission check[' + index + ']', errors);
      if (check.id !== ADMISSION_CHECKS[index] || check.pass !== true) errors.push('lesson admission check[' + index + '] is not the required passing check');
    });
    facts = Array.isArray(provenance.extractedFacts) ? provenance.extractedFacts : [];
    if (facts.length < 4 || facts.length > 12) errors.push('lesson must preserve 4 to 12 extracted facts');
    facts.forEach(function (item, index) {
      exactFields(item, FACT_FIELDS, 'lesson fact[' + index + ']', errors);
      FACT_FIELDS.forEach(function (field) { if (!text(item && item[field])) errors.push('lesson fact[' + index + '] ' + field + ' is required'); });
      if (text(item && item.label).length > 120 || text(item && item.value).length > 800 || text(item && item.meaning).length > 600) errors.push('lesson fact[' + index + '] exceeds its bounded field length');
    });
    if (!text(course && course.title) || !text(course && course.summary) || !text(course && course.level) || !text(course && course.category) || !text(provenance.organ) || !text(provenance.boundary)) errors.push('lesson teaching fields must be present');
    if (text(course && course.title).length < 3 || text(course && course.title).length > 140) errors.push('lesson title must be 3 to 140 characters');
    if (text(course && course.summary).length < 40 || text(course && course.summary).length > 500) errors.push('lesson summary must be 40 to 500 characters');
    if (text(course && course.level).length < 3 || text(course && course.level).length > 40) errors.push('lesson level must be 3 to 40 characters');
    if (text(provenance.organ).length < 2 || text(provenance.organ).length > 120) errors.push('lesson organ must be 2 to 120 characters');
    if (text(provenance.boundary).length < 40 || text(provenance.boundary).length > 600) errors.push('lesson boundary must be 40 to 600 characters');
    if (CATEGORIES.slice(1).map(function (item) { return item.id; }).indexOf(course && course.category) < 0) errors.push('lesson category is unsupported');
    if (course && course.authority !== 'NONE') errors.push('lesson authority must be NONE');
    if (course && course.status !== 'CURATED DRAFT') errors.push('lesson status must be CURATED DRAFT');
    if (!Array.isArray(course && course.tags)) errors.push('lesson tags must be an array');
    if (!Array.isArray(course && course.steps) || course.steps.length !== 5) errors.push('lesson must contain the five compiled Academy steps');
    else course.steps.forEach(function (step, index) { exactFields(step, STEP_FIELDS, 'lesson step[' + index + ']', errors); });
    if (errors.length) throw new Error(errors.join('; '));
    var snapshot = {
      schema: FORMAT,
      sourceId: provenance.sourceId,
      category: course.category,
      organ: provenance.organ,
      title: course.title,
      level: course.level,
      path: provenance.path,
      tool: provenance.tool,
      summary: course.summary,
      boundary: provenance.boundary,
      facts: clone(facts),
      quality: clone(provenance.quality),
      admission: clone(admission),
      authority: 'NONE',
      lessonFingerprint: clone(fingerprint)
    };
    var computed = lessonFingerprint(snapshot);
    if (!same(computed, fingerprint)) throw new Error('lesson fingerprint does not match its teaching semantics');
    var baseId = 'academy-' + snapshot.sourceId;
    var expected = courseFromSnapshot(snapshot, { edition:course.id !== baseId });
    if (!same(course, expected)) throw new Error('lesson does not match the deterministic Academy compiler');
    return snapshot;
  }

  function buildInheritancePacket(course) {
    var snapshot = snapshotFromCourse(course);
    var edition = courseFromSnapshot(snapshot, { edition:true });
    return {
      schema: INHERITANCE_FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      lineageId: edition.provenance.lineageId,
      editionId: edition.provenance.editionId,
      lesson: edition,
      privacy: { scope:'LESSON_ONLY', learners:false, sessions:false, attempts:false, notebookEntries:false, classroomMessages:false },
      boundary: INHERITANCE_BOUNDARY
    };
  }

  function validateInheritancePacket(input) {
    var errors = [], course = null;
    try { if (JSON.stringify(input).length > MAX_INHERITANCE_BYTES) errors.push('inheritance packet exceeds 256 KiB'); }
    catch (error) { errors.push('inheritance packet must be serializable JSON'); }
    exactFields(input, PACKET_FIELDS, 'inheritance packet', errors);
    if (input && input.schema !== INHERITANCE_FORMAT) errors.push('inheritance packet schema must be ' + INHERITANCE_FORMAT);
    if (input && input.version !== 1) errors.push('inheritance packet version must be 1');
    if (!input || typeof input.exportedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.exportedAt) || isNaN(Date.parse(input.exportedAt))) errors.push('inheritance packet exportedAt must be an ISO timestamp');
    if (input && input.boundary !== INHERITANCE_BOUNDARY) errors.push('inheritance packet boundary is not exact');
    var privacy = record(input && input.privacy) ? input.privacy : {};
    exactFields(privacy, PRIVACY_FIELDS, 'inheritance packet privacy', errors);
    if (privacy.scope !== 'LESSON_ONLY') errors.push('inheritance packet privacy scope must be LESSON_ONLY');
    PRIVACY_FIELDS.slice(1).forEach(function (field) { if (privacy[field] !== false) errors.push('inheritance packet privacy must exclude ' + field); });
    if (errors.length === 0) {
      try {
        var snapshot = snapshotFromCourse(input.lesson);
        course = courseFromSnapshot(snapshot, { edition:true });
        if (!same(input.lesson, course)) errors.push('inheritance packet lesson must use its immutable edition ID');
        if (input.lineageId !== course.provenance.lineageId) errors.push('inheritance packet lineageId does not match the lesson');
        if (input.editionId !== course.provenance.editionId) errors.push('inheritance packet editionId does not match the lesson');
      } catch (error) { errors.push(error.message); }
    }
    return { ok:errors.length === 0, errors:errors, course:errors.length ? null : course };
  }

  function matchingEdition(courses, course) {
    var wanted = course && course.provenance && course.provenance.lessonFingerprint;
    if (!wanted) return null;
    return (Array.isArray(courses) ? courses : []).find(function (item) {
      var provenance = item && item.provenance;
      var fingerprint = provenance && provenance.lessonFingerprint;
      return provenance && provenance.sourceId === course.provenance.sourceId && fingerprint && fingerprint.algorithm === wanted.algorithm && fingerprint.recipe === wanted.recipe && fingerprint.value === wanted.value;
    }) || null;
  }

  function prepareInheritanceReview(courses, input) {
    var checked = validateInheritancePacket(input);
    if (!checked.ok) return { ok:false, errors:checked.errors, course:null, existingCourseId:null, requiresAdmission:false, preview:null };
    var course = checked.course;
    var existing = matchingEdition(courses, course);
    var provenance = course.provenance;
    return {
      ok: true,
      errors: [],
      course: clone(course),
      existingCourseId: existing ? existing.id : null,
      requiresAdmission: !existing,
      preview: {
        title: course.title,
        summary: course.summary,
        category: course.category,
        level: course.level,
        sourceId: provenance.sourceId,
        organ: provenance.organ,
        path: provenance.path,
        tool: provenance.tool,
        boundary: provenance.boundary,
        fingerprint: provenance.lessonFingerprint.value,
        fingerprintAlgorithm: provenance.lessonFingerprint.algorithm,
        compilerRecipe: provenance.lessonFingerprint.recipe,
        editionId: provenance.editionId,
        exportedAt: input.exportedAt,
        stepCount: course.steps.length,
        factCount: provenance.extractedFacts.length,
        minutes: course.steps.reduce(function (sum, step) { return sum + step.minutes; }, 0),
        privacy: clone(input.privacy),
        authenticity: 'The fingerprint detects changed lesson semantics. It does not prove who authored the packet or that the named source is authentic.'
      }
    };
  }

  function freshness(course, snapshot) {
    if (!snapshot || snapshot.schema !== FORMAT) throw new Error('Academy snapshot required for freshness check');
    var current = snapshot.lessonFingerprint && snapshot.lessonFingerprint.algorithm === FINGERPRINT_ALGORITHM && snapshot.lessonFingerprint.recipe === LESSON_RECIPE ? clone(snapshot.lessonFingerprint) : lessonFingerprint(snapshot);
    if (!course) return { state:'NOT_INSTALLED', sourceId:snapshot.sourceId, current:current, stored:null };
    var provenance = course.provenance && typeof course.provenance === 'object' ? course.provenance : {};
    if (provenance.sourceId !== snapshot.sourceId) return { state:'UNRELATED', sourceId:snapshot.sourceId, current:current, stored:null };
    var stored = provenance.lessonFingerprint;
    if (!stored || !/^[a-f0-9]{16}$/.test(text(stored.value))) return { state:'UNVERIFIED_EDITION', sourceId:snapshot.sourceId, current:current, stored:stored ? clone(stored) : null };
    if (stored.algorithm !== FINGERPRINT_ALGORITHM || stored.recipe !== LESSON_RECIPE) return { state:'COMPILER_CHANGED', sourceId:snapshot.sourceId, current:current, stored:clone(stored) };
    return { state:stored.value === current.value ? 'CURRENT' : 'SOURCE_CHANGED', sourceId:snapshot.sourceId, current:current, stored:clone(stored) };
  }

  return {
    FORMAT: FORMAT,
    CATALOG_FORMAT: CATALOG_FORMAT,
    PATH_CATALOG_FORMAT: PATH_CATALOG_FORMAT,
    FINGERPRINT_ALGORITHM: FINGERPRINT_ALGORITHM,
    LESSON_RECIPE: LESSON_RECIPE,
    INHERITANCE_FORMAT: INHERITANCE_FORMAT,
    INHERITANCE_BOUNDARY: INHERITANCE_BOUNDARY,
    categories: function () { return clone(CATEGORIES); },
    adapters: function () { return clone(ALLOWED_ADAPTERS); },
    validateCatalog: validateCatalog,
    validateLearningPaths: validateLearningPaths,
    learningPathProgress: learningPathProgress,
    buildSnapshot: buildSnapshot,
    compileLessonSteps: function (snapshot) { return clone(compiledLessonSteps(snapshot)); },
    fingerprintSemantics: function (snapshot) { return clone(fingerprintSemantics(snapshot)); },
    lessonFingerprint: lessonFingerprint,
    freshness: freshness,
    courseFromSnapshot: courseFromSnapshot,
    buildInheritancePacket: buildInheritancePacket,
    validateInheritancePacket: validateInheritancePacket,
    matchingEdition: matchingEdition,
    prepareInheritanceReview: prepareInheritanceReview
  };
}));
