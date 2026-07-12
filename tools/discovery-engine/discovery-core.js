(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMDiscoveryCore = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var SCHEMA = 'axm.discovery-lab.session/0.1';
  var STAGES = [
    { id: 'knownSpace', label: 'Known space', task: 'MAP_KNOWN_SPACE' },
    { id: 'rejectedDirections', label: 'Rejected directions', task: 'REJECT_OBVIOUS_DIRECTIONS' },
    { id: 'blindSpots', label: 'Blind spots', task: 'FIND_BLIND_SPOTS' },
    { id: 'seams', label: 'Seams', task: 'FIND_SEAMS' },
    { id: 'patterns', label: 'Hidden patterns', task: 'PROPOSE_PATTERNS' },
    { id: 'realityChecks', label: 'Reality check', task: 'REALITY_CRITIQUE' },
    { id: 'soulChecks', label: 'Soul and access', task: 'SOUL_ACCESS_CRITIQUE' },
    { id: 'minimalChecks', label: 'First disconfirming test', task: 'DESIGN_DISCONFIRMING_CHECK' }
  ];
  var STAGE_IDS = STAGES.map(function (x) { return x.id; });
  var CLAIMS = [
    'OBSERVED', 'MEASURED_IN_HARNESS', 'SOURCE_SUPPORTED', 'ASSUMPTION',
    'HYPOTHESIS', 'DISPROVEN', 'REPAIRED', 'PARTIAL', 'TEST_HOLD', 'BLOCKED',
    'EXPERIMENTAL', 'INDEPENDENTLY_UNVALIDATED', 'NEEDS_EXTERNAL_REVIEW', 'NEEDS_QUALIFIED_REVIEW'
  ];
  var NOVELTY = ['UNCHECKED', 'PRELIMINARY_SEARCH', 'CHECKED_WITHIN_DECLARED_SCOPE', 'CONFLICT_FOUND'];
  var RELEVANCE = ['YES', 'PARTIAL', 'NO'];

  function text(v) { return v == null ? '' : String(v).trim(); }
  function list(v) { return Array.isArray(v) ? v.slice() : []; }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) {
      return JSON.stringify(k) + ':' + stable(v[k]);
    }).join(',') + '}';
    return JSON.stringify(v);
  }
  function fingerprint(v) {
    var s = stable(v), h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }
  function now(meta) { return text(meta && meta.now); }
  function actor(meta) {
    return {
      id: text(meta && meta.actorId) || 'unknown',
      kind: text(meta && meta.actorKind).toUpperCase() || 'UNKNOWN',
      provider: text(meta && meta.provider), model: text(meta && meta.model)
    };
  }
  function makeId(prefix, state, meta) {
    var explicit = prefix === 'event' ? text(meta && meta.eventId) : text(meta && (meta.recordId || meta.id));
    return explicit ||
      prefix + '-' + fingerprint([prefix, now(meta), state && state.history ? state.history.events.length : 0]);
  }
  function event(state, type, payload, meta) {
    var prev = state.history.lastEventHash || null;
    var ev = { id: makeId('event', state, meta), type: type, at: now(meta), actor: actor(meta), payload: clone(payload || {}), previous: prev };
    ev.hash = fingerprint(ev);
    state.history.events.push(ev);
    state.history.lastEventHash = ev.hash;
    state.updatedAt = ev.at || state.updatedAt;
    return ev;
  }
  function commit(input, type, payload, meta, apply) {
    var state = clone(input);
    if (apply) apply(state);
    var ev = event(state, type, payload, meta || {});
    return { ok: true, state: state, events: [ev], errors: [] };
  }
  function failure(code, message) { return { ok: false, state: null, events: [], errors: [{ code: code, message: message }] }; }
  function stageDef(id) { return STAGES.filter(function (x) { return x.id === id; })[0] || null; }
  function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function nonEmptyTextList(value) { return Array.isArray(value) && value.length > 0 && value.every(function (item) { return !!text(item); }); }
  function packControlCatalog(pack) {
    return list(pack && pack.controls).concat(list(pack && pack.permanentControls)).map(function (c) {
      return { id: text(c && c.id), title: text(c && c.title), requirement: text(c && c.requirement), blocksInterpretation: !c || c.blocksInterpretation !== false };
    });
  }
  function validatePackContract(pack) {
    var errors = [], roleIds = {}, controlIds = {};
    if (!isObject(pack)) return { ok: false, errors: ['role pack must be an object'] };
    ['schema', 'id', 'version', 'title', 'status'].forEach(function (field) { if (!text(pack[field])) errors.push('role pack requires ' + field); });
    if (!Array.isArray(pack.roles) || !pack.roles.length) errors.push('role pack requires roles[]');
    else pack.roles.forEach(function (r, index) {
      var prefix = 'role[' + index + ']';
      if (!isObject(r)) { errors.push(prefix + ' must be an object'); return; }
      ['id', 'title', 'humanEquivalent', 'fearedFailure', 'artifact'].forEach(function (field) { if (!text(r[field])) errors.push(prefix + ' requires ' + field); });
      ['jurisdiction', 'methods', 'evidence', 'handoffTo', 'abstentionConditions', 'forbiddenOverreach', 'vetoes'].forEach(function (field) {
        if (!nonEmptyTextList(r[field])) errors.push(prefix + ' requires non-empty ' + field + '[]');
      });
      if (text(r.id)) { if (roleIds[r.id]) errors.push('duplicate role id ' + r.id); roleIds[r.id] = true; }
    });
    var controls = packControlCatalog(pack);
    if (!controls.length) errors.push('role pack requires evidence-profile controls');
    controls.forEach(function (c, index) {
      if (!c.id || !c.title || !c.requirement) errors.push('control[' + index + '] requires id, title and requirement');
      if (c.id) { if (controlIds[c.id]) errors.push('duplicate control id ' + c.id); controlIds[c.id] = true; }
    });
    if (!isObject(pack.claimLanguage) || !nonEmptyTextList(pack.claimLanguage.allowed) || !nonEmptyTextList(pack.claimLanguage.forbiddenStandalone)) {
      errors.push('role pack requires claimLanguage allowed[] and forbiddenStandalone[]');
    }
    if (!Array.isArray(pack.evidenceProfiles) || !pack.evidenceProfiles.length || !text(pack.evidenceProfile)) errors.push('role pack requires evidenceProfiles[] and selected evidenceProfile');
    return { ok: errors.length === 0, errors: errors };
  }
  function leaseClockError(run, meta) {
    if (!run || !run.lease || !run.lease.expiresAt) return null;
    var current = now(meta), expiry = text(run.lease.expiresAt);
    if (!current) return { code: 'CLOCK_REQUIRED', message: 'A host timestamp is required to enforce this expiring lease.' };
    var currentMs = Date.parse(current), expiryMs = Date.parse(expiry);
    if (!Number.isFinite(currentMs) || !Number.isFinite(expiryMs)) return { code: 'CLOCK_INVALID', message: 'Lease and host timestamps must be valid ISO-compatible dates.' };
    if (currentMs > expiryMs) return { code: 'LEASE_EXPIRED', message: 'The run lease has expired.' };
    return null;
  }

  function createSession(config, meta) {
    config = config || {}; meta = meta || {};
    var created = now(meta);
    var state = {
      schema: SCHEMA,
      id: text(config.id) || text(meta.id) || 'session-' + fingerprint([config.subject, created]),
      title: text(config.title) || 'Untitled discovery', status: 'ACTIVE',
      createdAt: created, updatedAt: created,
      subject: {
        statement: text(config.subject), question: text(config.question),
        intendedUse: text(config.intendedUse), boundaries: list(config.boundaries).map(text).filter(Boolean),
        exclusions: list(config.exclusions).map(text).filter(Boolean), stakeholders: list(config.stakeholders).map(text).filter(Boolean),
        stakes: ['LOW', 'MEDIUM', 'HIGH'].indexOf(text(config.stakes).toUpperCase()) >= 0 ? text(config.stakes).toUpperCase() : 'LOW',
        evidenceProfile: text(config.evidenceProfile).toUpperCase() || 'MIXED', accessLogic: text(config.accessLogic), successIsNot: list(config.successIsNot).map(text).filter(Boolean)
      },
      policy: {
        discoveryMode: text(config.discoveryMode).toUpperCase() || 'MANUAL',
        reviewMode: text(config.reviewMode).toUpperCase() || 'OFF',
        sameGate: true, externalActionsAllowed: [], activeLease: null
      },
      workflow: { phase: 'DISCOVERY', stage: 'knownSpace', blockedBy: [], exactResumePoint: 'discovery:knownSpace', resumeWithoutGuessing: true },
      discovery: {
        knownSpace: [], rejectedDirections: [], blindSpots: [], seams: [], patterns: [],
        realityChecks: [], soulChecks: [], minimalChecks: [], candidates: [], activeCandidateId: null
      },
      lab: { reviewRuns: [], automationRuns: [], externalReview: { status: 'NOT_REQUESTED', reviews: [] } },
      records: { proposals: [], decisions: [], commentary: [], claims: [], evidence: [], contradictions: [], sources: [], failures: [] },
      history: { events: [], lastEventHash: null }
    };
    event(state, 'SESSION_CREATED', { subject: state.subject.statement, mode: state.policy.discoveryMode }, meta);
    return state;
  }

  function validate(state) {
    var errors = [], warnings = [];
    if (!state || typeof state !== 'object' || Array.isArray(state)) return { ok: false, errors: ['session must be an object'], warnings: [] };
    if (state.schema !== SCHEMA) errors.push('session schema is missing or unsupported');
    if (!text(state.id)) errors.push('session id is required');
    ['subject', 'policy', 'workflow', 'discovery', 'lab', 'records', 'history'].forEach(function (k) { if (!state[k] || typeof state[k] !== 'object' || Array.isArray(state[k])) errors.push(k + ' section is required'); });
    if (!text(state.subject && state.subject.statement)) warnings.push('subject is not framed yet');
    if (!text(state.subject && state.subject.question)) warnings.push('current question is not framed yet');
    if (state.discovery) {
      STAGE_IDS.concat(['candidates']).forEach(function (k) { if (!Array.isArray(state.discovery[k])) errors.push('discovery.' + k + ' must be an array'); });
    }
    if (state.lab) {
      if (!Array.isArray(state.lab.reviewRuns)) errors.push('lab.reviewRuns must be an array');
      if (!Array.isArray(state.lab.automationRuns)) errors.push('lab.automationRuns must be an array');
    }
    if (state.records) ['proposals', 'decisions', 'commentary', 'claims', 'evidence', 'contradictions', 'sources', 'failures'].forEach(function (k) { if (!Array.isArray(state.records[k])) errors.push('records.' + k + ' must be an array'); });
    if (state.history && !Array.isArray(state.history.events)) errors.push('history.events must be an array');
    if (state.discovery && Array.isArray(state.discovery.candidates)) {
      state.discovery.candidates.forEach(function (c) {
        if (!isObject(c) || !text(c.id) || !text(c.term) || !text(c.mechanism || c.summary)) { errors.push('candidate record is malformed'); return; }
        if (NOVELTY.indexOf(c.noveltyStatus) < 0) errors.push('candidate ' + c.id + ' has invalid novelty status');
        if (c.noveltyStatus !== 'UNCHECKED' && !text(c.noveltyScope)) warnings.push('candidate ' + c.id + ' has a novelty label without a declared scope');
        if (!isObject(c.soulGate) || ['PASS', 'FAIL', 'INCOMPLETE'].indexOf(text(c.soulGate && c.soulGate.outcome).toUpperCase()) < 0) errors.push('candidate ' + c.id + ' has malformed Soul gate');
      });
    }
    if (state.lab && Array.isArray(state.lab.automationRuns)) state.lab.automationRuns.forEach(function (run) {
      if (!isObject(run) || !text(run.id) || ['COMPRESSED_ROLE_REVIEW', 'FULL_EVIDENCE_LOOP'].indexOf(text(run.protocol)) < 0 || !Array.isArray(run.steps) || !isObject(run.lease)) { errors.push('automation run is malformed'); return; }
      var packCheck = validatePackContract(run.rolePack);
      if (!packCheck.ok || text(run.packId) !== text(run.rolePack && run.rolePack.id) || text(run.packFingerprint) !== fingerprint(run.rolePack)) errors.push('automation run ' + run.id + ' has invalid frozen role pack');
      var stepIds = {};
      run.steps.forEach(function (step) {
        if (!isObject(step) || !text(step.id) || !text(step.kind) || !text(step.status)) { errors.push('automation run ' + run.id + ' has malformed step'); return; }
        if (stepIds[step.id]) errors.push('automation run ' + run.id + ' has duplicate step ' + step.id); stepIds[step.id] = true;
        if (step.attemptHistory != null && !Array.isArray(step.attemptHistory)) errors.push('automation step ' + step.id + ' attemptHistory must be an array');
        if (Array.isArray(step.attemptHistory)) step.attemptHistory.forEach(function (attempt) {
          if (!isObject(attempt) || !text(attempt.status)) errors.push('automation step ' + step.id + ' has malformed attempt history');
        });
        if (step.status === 'DISPATCHED' && !text(step.dispatchToken)) errors.push('automation step ' + step.id + ' is dispatched without token');
        if (step.status === 'COMPLETE' && step.kind !== 'MANUAL_EVIDENCE_GATE' && !validateAutomationOutput(step, { text: step.output }).ok) errors.push('automation step ' + step.id + ' has invalid stored output');
      });
      if (!Array.isArray(run.evidence)) errors.push('automation run ' + run.id + ' evidence must be an array');
    });
    if (state.lab && Array.isArray(state.lab.reviewRuns)) state.lab.reviewRuns.forEach(function (review) {
      if (!isObject(review) || !text(review.id) || !text(review.candidateId) || !Array.isArray(review.seats) || !Array.isArray(review.controls)) { errors.push('review run is malformed'); return; }
      review.seats.forEach(function (seat) {
        if (!isObject(seat) || !text(seat.roleId) || !isObject(seat.role) || ['UNSET'].concat(RELEVANCE).indexOf(text(seat.relevance)) < 0 || !Array.isArray(seat.artifacts)) errors.push('review ' + review.id + ' has malformed role seat');
        else seat.artifacts.forEach(function (artifact) {
          if (!isObject(artifact) || !text(artifact.id) || !text(artifact.text) || !Array.isArray(artifact.claims) || !Array.isArray(artifact.contradictions) || !Array.isArray(artifact.failures) || !isObject(artifact.veto)) errors.push('review ' + review.id + ' has malformed role artifact');
        });
      });
      review.controls.forEach(function (control) {
        if (!isObject(control) || !text(control.id) || !text(control.title) || !text(control.requirement) || ['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN'].indexOf(text(control.status)) < 0) errors.push('review ' + review.id + ' has malformed control');
        if (control.history != null && !Array.isArray(control.history)) errors.push('review ' + review.id + ' control ' + control.id + ' history must be an array');
        if (Array.isArray(control.history)) control.history.forEach(function (revision) {
          if (!isObject(revision) || ['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN'].indexOf(text(revision.status)) < 0) errors.push('review ' + review.id + ' control ' + control.id + ' has malformed revision history');
        });
      });
    });
    if (state.history && Array.isArray(state.history.events)) {
      var previous = null, eventIds = {};
      state.history.events.forEach(function (ev) {
        if (!isObject(ev) || !text(ev.id) || !text(ev.type) || text(ev.previous) !== text(previous)) { errors.push('history event chain is malformed'); return; }
        if (eventIds[ev.id]) errors.push('history contains duplicate event id ' + ev.id); eventIds[ev.id] = true;
        var copy = clone(ev), savedHash = copy.hash; delete copy.hash;
        if (savedHash !== fingerprint(copy)) errors.push('history event ' + ev.id + ' has invalid fingerprint');
        previous = ev.hash;
      });
      if (text(state.history.lastEventHash) !== text(previous)) errors.push('history lastEventHash does not match event chain');
    }
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  function updateFrame(input, patch, meta) {
    patch = patch || {};
    return commit(input, 'FRAME_UPDATED', { fields: Object.keys(patch) }, meta, function (s) {
      if ('title' in patch) s.title = text(patch.title) || s.title;
      ['statement', 'question', 'intendedUse', 'accessLogic'].forEach(function (k) { if (k in patch) s.subject[k] = text(patch[k]); });
      ['boundaries', 'exclusions', 'stakeholders', 'successIsNot'].forEach(function (k) { if (k in patch) s.subject[k] = list(patch[k]).map(text).filter(Boolean); });
      if ('stakes' in patch && ['LOW', 'MEDIUM', 'HIGH'].indexOf(text(patch.stakes).toUpperCase()) >= 0) s.subject.stakes = text(patch.stakes).toUpperCase();
      if ('evidenceProfile' in patch) s.subject.evidenceProfile = text(patch.evidenceProfile).toUpperCase() || 'MIXED';
      if ('discoveryMode' in patch) s.policy.discoveryMode = text(patch.discoveryMode).toUpperCase() || 'MANUAL';
      if ('reviewMode' in patch) s.policy.reviewMode = text(patch.reviewMode).toUpperCase() || 'OFF';
    });
  }

  function normalizeClaim(label, source, origin) {
    var c = text(label).toUpperCase();
    if (CLAIMS.indexOf(c) < 0) c = 'HYPOTHESIS';
    origin = text(origin).toUpperCase() || 'UNKNOWN';
    if (['OBSERVED', 'MEASURED_IN_HARNESS', 'SOURCE_SUPPORTED'].indexOf(c) >= 0) {
      if (origin !== 'HUMAN') c = 'HYPOTHESIS';
      else if (!text(source)) c = 'ASSUMPTION';
    }
    return c;
  }

  function recordDiscovery(input, stage, value, meta) {
    if (!stageDef(stage)) return failure('UNKNOWN_STAGE', 'Unknown discovery stage: ' + stage);
    value = value || {}; meta = meta || {};
    if (!text(value.text)) return failure('EMPTY_RECORD', 'A discovery record needs text.');
    var rec = {
      id: makeId('record', input, meta), text: text(value.text),
      claimLabel: normalizeClaim(value.claimLabel, value.source, text(meta.actorKind).toUpperCase()),
      source: text(value.source), rationale: text(value.rationale),
      status: text(value.status).toUpperCase() || (meta.delegated ? 'DELEGATED_DRAFT' : 'ACCEPTED'),
      origin: meta.delegated ? 'AI_PROPOSED_DELEGATED' : (text(meta.actorKind).toUpperCase() || 'UNKNOWN'),
      actor: actor(meta), createdAt: now(meta), supersedes: text(value.supersedes) || null,
      proposalId: text(value.proposalId) || null, automationRunId: text(value.automationRunId) || null, automationStepId: text(value.automationStepId) || null
    };
    return commit(input, 'DISCOVERY_RECORDED', { stage: stage, recordId: rec.id, status: rec.status }, meta, function (s) {
      s.discovery[stage].push(rec); s.workflow.stage = stage; s.workflow.exactResumePoint = 'discovery:' + stage;
    });
  }

  function receiveProposal(input, proposal, meta) {
    proposal = proposal || {};
    if (!text(proposal.text)) return failure('EMPTY_PROPOSAL', 'Proposal text is required.');
    var p = {
      id: makeId('proposal', input, meta), task: text(proposal.task), target: text(proposal.target),
      text: text(proposal.text), rationale: text(proposal.rationale), status: 'PENDING',
      provider: text(proposal.provider || (meta && meta.provider)), model: text(proposal.model || (meta && meta.model)),
      inputFingerprint: text(proposal.inputFingerprint) || fingerprint({ subject: input.subject, discovery: input.discovery }), createdAt: now(meta), maySupportClaims: false
    };
    return commit(input, 'AI_PROPOSAL_RECEIVED', { proposalId: p.id, target: p.target }, meta, function (s) { s.records.proposals.push(p); });
  }

  function decideProposal(input, proposalId, decision, options, meta) {
    options = options || {}; decision = text(decision).toUpperCase();
    if (['ACCEPT', 'REJECT'].indexOf(decision) < 0) return failure('BAD_DECISION', 'Decision must be ACCEPT or REJECT.');
    var found = input.records.proposals.filter(function (p) { return p.id === proposalId; })[0];
    if (!found) return failure('MISSING_PROPOSAL', 'Proposal not found.');
    if (found.status !== 'PENDING') return failure('PROPOSAL_ALREADY_DECIDED', 'Proposal already has a decision.');
    var currentFingerprint = fingerprint({ subject: input.subject, discovery: input.discovery });
    if (decision === 'ACCEPT' && found.inputFingerprint !== currentFingerprint && !options.allowStale) return failure('STALE_PROPOSAL', 'Discovery state changed after this proposal. Re-ask or explicitly rebase it before acceptance.');
    var target = text(options.target || found.target);
    if (decision === 'ACCEPT' && !stageDef(target)) return failure('UNKNOWN_STAGE', 'Accepted proposal needs a valid discovery stage.');
    var firstNewEvent = input.history.events.length;
    var state = clone(input), p = state.records.proposals.filter(function (x) { return x.id === proposalId; })[0];
    p.status = decision === 'ACCEPT' ? 'HUMAN_APPROVED' : 'REJECTED'; p.decisionReason = text(options.reason); p.decidedAt = now(meta);
    var decisionId = 'decision-' + fingerprint([proposalId, decision, now(meta), state.records.decisions.length]);
    state.records.decisions.push({ id: decisionId, proposalId: proposalId, decision: decision, reason: text(options.reason), actor: actor(meta), at: now(meta) });
    if (decision === 'ACCEPT') {
      var acceptedId = 'accepted-' + fingerprint([proposalId, target, now(meta), state.discovery[target].length]);
      var rr = recordDiscovery(state, target, { text: found.text, rationale: found.rationale, source: text(options.source), claimLabel: text(options.claimLabel) || 'HYPOTHESIS', status: 'HUMAN_APPROVED', proposalId: proposalId }, Object.assign({}, meta, { actorKind: 'AI_PROPOSED_HUMAN_APPROVED', actorId: found.provider || actor(meta).id, provider: found.provider, model: found.model, recordId: acceptedId }));
      state = rr.state;
    }
    var ev = event(state, 'PROPOSAL_DECIDED', { proposalId: proposalId, decision: decision, target: target }, meta);
    return { ok: true, state: state, events: state.history.events.slice(firstNewEvent), errors: [] };
  }

  function soulOutcome(soul) {
    var fields = ['genuineNeed', 'nonCommercialWorth', 'reducesPain', 'sameGateAccess', 'avoidsLockIn'];
    var vals = fields.map(function (k) { return text(soul && soul[k]).toUpperCase() || 'UNKNOWN'; });
    if (vals.some(function (x) { return x === 'FAIL'; })) return 'FAIL';
    if (vals.every(function (x) { return x === 'PASS'; })) return 'PASS';
    return 'INCOMPLETE';
  }

  function createCandidate(input, data, meta) {
    data = data || {}; meta = meta || {};
    if (!text(data.term || data.name) || !text(data.mechanism || data.summary)) return failure('CANDIDATE_INCOMPLETE', 'Candidate needs a provisional term and mechanism/summary.');
    var novelty = text(data.noveltyStatus).toUpperCase(); if (NOVELTY.indexOf(novelty) < 0) novelty = 'UNCHECKED';
    var soul = data.soulGate || {};
    var candidate = {
      id: makeId('candidate', input, meta), term: text(data.term || data.name), summary: text(data.summary),
      mechanism: text(data.mechanism), whyNotYet: text(data.whyNotYet), viableNowBecause: text(data.viableNowBecause),
      dependencies: list(data.dependencies).map(text).filter(Boolean),
      noveltyStatus: novelty, noveltyScope: text(data.noveltyScope),
      soulGate: {
        genuineNeed: text(soul.genuineNeed).toUpperCase() || 'UNKNOWN',
        nonCommercialWorth: text(soul.nonCommercialWorth).toUpperCase() || 'UNKNOWN',
        reducesPain: text(soul.reducesPain).toUpperCase() || 'UNKNOWN',
        sameGateAccess: text(soul.sameGateAccess).toUpperCase() || 'UNKNOWN',
        avoidsLockIn: text(soul.avoidsLockIn).toUpperCase() || 'UNKNOWN', notes: list(soul.notes).map(text).filter(Boolean)
      },
      minimalForm: text(data.minimalForm), cheapestDisconfirmingCheck: text(data.cheapestDisconfirmingCheck),
      disconfirmingOutcome: text(data.disconfirmingOutcome), limitations: list(data.limitations).map(text).filter(Boolean),
      discoveryRecordRefs: list(data.discoveryRecordRefs).map(text).filter(Boolean), automationRunId: text(data.automationRunId) || null,
      origin: meta.delegated ? 'AI_DELEGATED_DRAFT' : (text(meta.actorKind).toUpperCase() || 'UNKNOWN'),
      actor: actor(meta), createdAt: now(meta), supersedes: text(data.supersedes) || null, status: 'DRAFT'
    };
    candidate.soulGate.outcome = soulOutcome(candidate.soulGate);
    if (meta.delegated) candidate.status = 'AI_DRAFT_REQUIRES_REVIEW';
    else if (candidate.soulGate.outcome === 'PASS' && candidate.cheapestDisconfirmingCheck) candidate.status = 'READY_FOR_INTERNAL_REVIEW';
    else if (candidate.soulGate.outcome === 'FAIL') candidate.status = 'REVISE_OR_REJECT';
    return commit(input, 'CANDIDATE_SNAPSHOTTED', { candidateId: candidate.id, status: candidate.status, supersedes: candidate.supersedes }, meta, function (s) {
      s.discovery.candidates.push(candidate); s.discovery.activeCandidateId = candidate.id; s.workflow.exactResumePoint = 'candidate:' + candidate.id;
    });
  }

  function parseExecutors(value) {
    var rows = Array.isArray(value) ? value : text(value).split(',');
    var out = [];
    rows.map(text).filter(Boolean).forEach(function (raw, i) {
      var bits = raw.split(':').map(text), provider = bits[0] || 'auto', detail = bits[1] || '';
      var ex = { id: 'executor-' + (i + 1), label: raw, provider: provider === 'auto' ? '' : provider, aiProvider: '', model: '' };
      if (provider === 'bridge') ex.aiProvider = detail;
      else if (detail) ex.model = detail;
      out.push(ex);
    });
    return out.length ? out : [{ id: 'executor-1', label: 'automatic existing provider', provider: '', aiProvider: '', model: '' }];
  }

  function planAutomation(input, options, pack, meta) {
    options = options || {}; meta = meta || {};
    if (!text(input.subject.statement) && !options.wildcard) return failure('SUBJECT_REQUIRED', 'Frame a subject or explicitly choose Wildcard mode.');
    var packCheck = validatePackContract(pack);
    if (!packCheck.ok) return failure('ROLE_PACK_INVALID', packCheck.errors[0]);
    var cycles = Math.max(1, Math.min(3, Number(options.cycles) || 1));
    var protocol = text(options.protocol).toUpperCase() === 'FULL_EVIDENCE_LOOP' ? 'FULL_EVIDENCE_LOOP' : 'COMPRESSED_ROLE_REVIEW';
    var includeLab = options.includeLab !== false, executors = parseExecutors(options.executors);
    var steps = [], n = 0;
    STAGES.forEach(function (st) { steps.push({ id: 'step-' + (++n), phase: 'DISCOVERY', kind: 'DISCOVERY_PASS', task: st.task, stage: st.id, label: st.label, status: 'PENDING' }); });
    steps.push({ id: 'step-' + (++n), phase: 'DISCOVERY', kind: 'CANDIDATE_SYNTHESIS', task: 'SYNTHESIZE_CANDIDATE', label: 'Freeze an AI draft candidate', status: 'PENDING' });
    function orderedRoles(cycle) {
      var firstIds = list(pack.sequencing && pack.sequencing.scopeFirst);
      var lastIds = list(pack.sequencing && pack.sequencing.observerLast);
      var first = pack.roles.filter(function (r) { return firstIds.indexOf(r.id) >= 0; });
      var last = pack.roles.filter(function (r) { return lastIds.indexOf(r.id) >= 0; });
      var middle = pack.roles.filter(function (r) { return firstIds.indexOf(r.id) < 0 && lastIds.indexOf(r.id) < 0; });
      if (middle.length) { var shift = (cycle - 1) % middle.length; middle = middle.slice(shift).concat(middle.slice(0, shift)); }
      return first.concat(middle, last);
    }
    function addAI(kind, task, cycle, label, role) {
      var step = { id: 'step-' + (++n), phase: 'REVIEW', kind: kind, task: task, cycle: cycle, label: label, status: 'PENDING' };
      if (role) { step.roleId = role.id; step.role = clone(role); }
      steps.push(step);
    }
    if (includeLab) {
      for (var c = 1; c <= cycles; c++) {
        if (protocol === 'FULL_EVIDENCE_LOOP') {
          addAI('FRONTIER_FRAME', 'FRAME_CURRENT_FRONTIER', c, 'Cycle ' + c + ' · frame current frontier');
          orderedRoles(c).forEach(function (role) { addAI('ROLE_PASS', 'DOMAIN_ROLE_PASS', c, role.title + ' · pre-evidence pass', role); });
          addAI('CONTRADICTION_MAP', 'PRESERVE_CONTRADICTIONS', c, 'Cycle ' + c + ' · contradiction map');
          addAI('EXPERIMENT_SELECTION', 'SELECT_HIGH_INFORMATION_EXPERIMENT', c, 'Cycle ' + c + ' · select high-information experiment');
          addAI('PREDECLARATION', 'PREDECLARE_EXPERIMENT', c, 'Cycle ' + c + ' · predeclaration');
          ['R7', 'R8', 'R13'].forEach(function (id) { var role = pack.roles.filter(function (x) { return x.id === id; })[0]; if (role) addAI('PRECHECK_ROLE_PASS', 'PREEXECUTION_REVIEW', c, role.title + ' · pre-execution review', role); });
          if (pack.id !== 'physics-stance-forge') {
            ['G4', 'G5', 'G9'].forEach(function (id) { var role = pack.roles.filter(function (x) { return x.id === id; })[0]; if (role) addAI('PRECHECK_ROLE_PASS', 'PREEXECUTION_REVIEW', c, role.title + ' · pre-execution review', role); });
          }
          addAI('TARGETED_RESEARCH', 'FETCH_ONLY_MISSING_KNOWLEDGE', c, 'Cycle ' + c + ' · targeted source leads');
          addAI('IMPLEMENTATION_PLAN', 'PLAN_BOUNDED_IMPLEMENTATION', c, 'Cycle ' + c + ' · bounded implementation plan');
          addAI('PROVENANCE_PLAN', 'CAPTURE_PROVENANCE_CONTRACT', c, 'Cycle ' + c + ' · provenance contract');
          addAI('CONTROL_PLAN', 'PLAN_CONTROLS_AND_CANARIES', c, 'Cycle ' + c + ' · controls and canaries');
          steps[steps.length - 1].controlCatalog = packControlCatalog(pack);
          steps.push({ id: 'step-' + (++n), phase: 'EVIDENCE', kind: 'MANUAL_EVIDENCE_GATE', task: 'IMPORT_EXECUTED_EVIDENCE', cycle: c, label: 'Cycle ' + c + ' · executed evidence gate', status: 'PENDING', executor: null });
          addAI('FAILURE_ATTACK', 'ATTACK_APPARENT_SUCCESS', c, 'Cycle ' + c + ' · failure attack');
          orderedRoles(c).forEach(function (role) { addAI('RESULT_ROLE_PASS', 'ROLE_SPECIFIC_RESULT_REVIEW', c, role.title + ' · result review', role); });
          var critic = pack.roles.filter(function (x) { return x.id === 'R13' || x.id === 'G9'; })[0];
          var observer = pack.roles.filter(function (x) { return x.id === 'R14' || x.id === 'G11'; })[0];
          addAI('CLAIM_REVIEW', 'INTERNAL_CLAIM_REVIEW', c, 'Cycle ' + c + ' · internal claim review', critic);
          addAI('STANCE_REVIEW', 'STANCE_INTEGRITY_REVIEW', c, 'Cycle ' + c + ' · stance-integrity review', observer);
          addAI('PRODUCTIVITY_CLASSIFICATION', 'CLASSIFY_PRODUCTIVITY_AND_NEXT_FRONTIER', c, 'Cycle ' + c + ' · productivity and heartbeat');
        } else {
          orderedRoles(c).forEach(function (role) { addAI('ROLE_PASS', 'ROLE_PASS', c, role.title, role); });
          addAI('CYCLE_SYNTHESIS', 'CONTRADICTION_AND_FAILURE_SYNTHESIS', c, 'Cycle ' + c + ' contradiction synthesis');
        }
      }
      steps.push({ id: 'step-' + (++n), phase: 'REVIEW', kind: 'SATURATION_DIAGNOSTIC', task: 'RUN_SATURATION_DIAGNOSTIC_IF_REQUIRED', cycle: cycles, label: 'Conditional saturation diagnostic', status: 'CONDITIONAL' });
      steps.push({ id: 'step-' + (++n), phase: 'COMMENTARY', kind: 'CURATOR_COMMENTARY', task: 'CURIOUS_LAB_PARTNER', label: 'Curious Lab Partner commentary', status: 'PENDING' });
    }
    var aiIndex = 0; steps.forEach(function (step) { if (step.kind !== 'MANUAL_EVIDENCE_GATE') { step.executor = clone(executors[aiIndex % executors.length]); aiIndex++; } });
    var modelStepCount = steps.filter(function (x) { return x.kind !== 'MANUAL_EVIDENCE_GATE'; }).length;
    var requestedMax = Number(options.maxCalls) || modelStepCount;
    var run = {
      id: makeId('automation', input, meta), title: text(options.title) || 'Bounded Discovery × Stance Forge run',
      status: 'PLANNED', createdAt: now(meta), packId: pack.id, packTitle: pack.title, packFingerprint: fingerprint(pack), rolePack: clone(pack),
      includeLab: includeLab, cycles: cycles, protocol: protocol, executors: executors, steps: steps, evidence: [],
      lease: { grantedBy: actor(meta), grantedAt: now(meta), expiresAt: text(options.expiresAt), maxCalls: Math.max(1, Math.min(requestedMax, modelStepCount)), allowed: ['AI_REQUEST', 'LOCAL_DRAFT_WRITE', 'MANUAL_EVIDENCE_IMPORT'], sameGate: true },
      callsUsed: 0, currentStep: 0, pausedReason: '', consecutiveUnproductiveCycles: 0, saturation: null,
      materializedCandidateId: null, materializedReviewId: null
    };
    return commit(input, 'AUTOMATION_PLANNED', { runId: run.id, protocol: protocol, calls: run.lease.maxCalls, steps: steps.length, pack: pack.id }, meta, function (s) {
      s.lab.automationRuns.push(run); s.policy.activeLease = { runId: run.id, maxCalls: run.lease.maxCalls, expiresAt: run.lease.expiresAt };
      s.workflow.exactResumePoint = 'automation:' + run.id + ':step-1';
    });
  }

  function automationRun(state, id) { return state.lab.automationRuns.filter(function (x) { return x.id === id; })[0] || null; }
  function candidateTextForRun(run) {
    var step = run.steps.filter(function (s) { return s.kind === 'CANDIDATE_SYNTHESIS' && s.status === 'COMPLETE'; })[0];
    return step ? step.output : '';
  }
  function outputsFor(run, predicate, limit) {
    return run.steps.filter(function (s) { return s.status === 'COMPLETE' && (!predicate || predicate(s)); }).map(function (s) {
      return '### ' + s.label + '\n' + text(s.output).slice(0, limit || 1800);
    }).join('\n\n');
  }
  function roleLines(role) {
    return [
      'ROLE: ' + role.title,
      'HUMAN EQUIVALENT: ' + text(role.humanEquivalent),
      'JURISDICTION: ' + list(role.jurisdiction).join('; '),
      'METHODS: ' + list(role.methods).join('; '),
      'EVIDENCE DEMANDED: ' + list(role.evidence).join('; '),
      'FEARED FAILURE: ' + text(role.fearedFailure),
      'REQUIRED ARTIFACT: ' + text(role.artifact),
      'HANDOFF TO: ' + list(role.handoffTo).join('; '),
      'ABSTAIN WHEN: ' + list(role.abstentionConditions).join('; '),
      'FORBIDDEN OVERREACH: ' + list(role.forbiddenOverreach).join('; '),
      'VETOES: ' + list(role.vetoes).join('; ')
    ].join('\n');
  }
  function subjectBlock(state) {
    var s = state.subject;
    return [
      'SUBJECT: ' + (s.statement || '(Wildcard: choose one)'),
      'QUESTION: ' + (s.question || '(not yet fixed)'),
      'INTENDED USE: ' + (s.intendedUse || '(not declared)'),
      'BOUNDARIES: ' + (s.boundaries.join('; ') || '(none declared)'),
      'STAKES: ' + s.stakes,
      'EVIDENCE PROFILE: ' + s.evidenceProfile
    ].join('\n');
  }
  function promptFor(state, run, step) {
    var truth = [
      'You are operating inside AXM Discovery Engine under a bounded user-granted run.',
      'Your output is experimental working material, not truth, canon, certification, or independent review.',
      'Do not take external actions. Do not claim originality without a declared search. Preserve uncertainty and failures.',
      'Return only the requested JSON. If information is missing, say so inside the JSON rather than inventing evidence.'
    ].join('\n');
    if (step.kind === 'DISCOVERY_PASS') {
      return [truth, subjectBlock(state), 'CURRENT DISCOVERY TASK: ' + step.task,
        'EARLIER WORKING MATERIAL:\n' + (outputsFor(run, function (x) { return x.phase === 'DISCOVERY'; }, 1200) || '(none yet)'),
        'Use the Discovery Engine discipline: reject performative obviousness, inspect friction and seams, keep competing explanations, and separate observation from inference.',
        'JSON SCHEMA: {"chosenSubject":"only when subject is wildcard","chosenQuestion":"","summary":"","items":[{"text":"","claimLabel":"HYPOTHESIS|ASSUMPTION|OBSERVED","sourceLead":"","rationale":""}],"uncertainties":[],"nextQuestion":""}'
      ].join('\n\n');
    }
    if (step.kind === 'CANDIDATE_SYNTHESIS') {
      return [truth, subjectBlock(state), 'DISCOVERY MATERIAL:\n' + outputsFor(run, function (x) { return x.phase === 'DISCOVERY'; }, 1800),
        'Synthesize one strongest provisional candidate. Naming is provisional. The cheapest check must be capable of proving the candidate wrong.',
        'JSON SCHEMA: {"term":"","summary":"","mechanism":"","whyNotYet":"","viableNowBecause":"","dependencies":[],"noveltyStatus":"UNCHECKED","soulGate":{"genuineNeed":"PASS|FAIL|UNKNOWN","nonCommercialWorth":"PASS|FAIL|UNKNOWN","reducesPain":"PASS|FAIL|UNKNOWN","sameGateAccess":"PASS|FAIL|UNKNOWN","avoidsLockIn":"PASS|FAIL|UNKNOWN","notes":[]},"minimalForm":"","cheapestDisconfirmingCheck":"","disconfirmingOutcome":"","limitations":[]}'
      ].join('\n\n');
    }
    if (['ROLE_PASS', 'PRECHECK_ROLE_PASS', 'RESULT_ROLE_PASS'].indexOf(step.kind) >= 0) {
      var ownPrior = outputsFor(run, function (x) { return ['ROLE_PASS', 'PRECHECK_ROLE_PASS', 'RESULT_ROLE_PASS'].indexOf(x.kind) >= 0 && x.roleId === step.roleId && x.cycle < step.cycle; }, 1200);
      var priorSynthesis = outputsFor(run, function (x) { return ['CYCLE_SYNTHESIS', 'CONTRADICTION_MAP', 'CLAIM_REVIEW', 'STANCE_REVIEW', 'PRODUCTIVITY_CLASSIFICATION'].indexOf(x.kind) >= 0 && x.cycle < step.cycle; }, 1600);
      var currentHandoffs = outputsFor(run, function (x) { return ['ROLE_PASS', 'PRECHECK_ROLE_PASS', 'RESULT_ROLE_PASS'].indexOf(x.kind) >= 0 && x.cycle === step.cycle && x.status === 'COMPLETE'; }, 1000);
      var evidence = run.evidence.filter(function (x) { return x.cycle === step.cycle; }).map(function (x) { return '- [' + x.claimLabel + '] ' + x.text + ' | ' + x.source; }).join('\n');
      var priorEvidence = run.evidence.filter(function (x) { return x.cycle < step.cycle; }).map(function (x) { return '- cycle ' + x.cycle + ' [' + x.claimLabel + '] ' + x.text + ' | ' + x.source; }).join('\n');
      return [truth, subjectBlock(state), 'FROZEN AI-DRAFT CANDIDATE:\n' + candidateTextForRun(run), roleLines(step.role),
        step.kind === 'PRECHECK_ROLE_PASS' ? 'PRE-EXECUTION MATERIAL:\n' + outputsFor(run, function (x) { return x.cycle === step.cycle && ['EXPERIMENT_SELECTION', 'PREDECLARATION', 'TARGETED_RESEARCH'].indexOf(x.kind) >= 0; }, 1600) : '',
        step.kind === 'RESULT_ROLE_PASS' ? 'IMPORTED EXECUTED EVIDENCE:\n' + (evidence || '(none — role must block unsupported interpretation)') : '',
        'EARLIER CURRENT-CYCLE HANDOFF ARTIFACTS (shared-context run, not independent):\n' + (currentHandoffs || '(none yet)'),
        step.cycle > 1 ? 'YOUR PRIOR-CYCLE ARTIFACTS:\n' + (ownPrior || '(none)') : '',
        step.cycle > 1 ? 'PRIOR SHARED CYCLE SYNTHESIS:\n' + (priorSynthesis || '(none)') : '',
        step.cycle > 1 ? 'PRIOR-CYCLE EXECUTED EVIDENCE:\n' + (priorEvidence || '(none)') : '',
        step.cycle > 1 ? 'OPEN-LOOP RULE: do not repeat the prior method unchanged. Use the surviving contradiction or change method to seek new information.' : '',
        'First declare relevance YES, PARTIAL, or NO. NO requires a reason and reactivation condition. PARTIAL requires a boundary. Do not imitate a personality; apply the professional method. This is one role in a shared run and is NOT independent.',
        'JSON SCHEMA: {"relevance":"YES|PARTIAL|NO","relevanceReason":"","boundary":"","reactivationCondition":"","artifact":"","claims":[{"text":"","status":"HYPOTHESIS|ASSUMPTION|SOURCE_SUPPORTED|DISPROVEN|BLOCKED","evidenceRefs":[]}],"contradictions":[],"failures":[],"veto":{"active":false,"reason":""},"nextTest":""}'
      ].join('\n\n');
    }
    var full = {
      FRONTIER_FRAME: ['Frame one current frontier and prevent silent scope drift.', '{"artifact":"","frontier":"","requirements":[],"exclusions":[],"exactClaimBoundary":"","unknowns":[]}'],
      CONTRADICTION_MAP: ['Preserve incompatible assumptions, predictions and unsupported shared beliefs. Do not force consensus.', '{"artifact":"","contradictions":[{"a":"","b":"","discriminatingObservation":""}],"sharedUnsupportedBeliefs":[],"openQuestions":[]}'],
      EXPERIMENT_SELECTION: ['Select the cheapest high-information experiment by disconfirmation value, measurement quality, feasibility, risk and duplication.', '{"artifact":"","question":"","competingExplanations":[],"selectedExperiment":"","informationGainReason":"","costRisk":"","rejectedExperiments":[]}'],
      PREDECLARATION: ['Predeclare before seeing new results. Threshold changes later must be amendments, never silent edits.', '{"artifact":"","question":"","hypotheses":[],"control":"","metrics":[],"thresholds":[],"expectedFailures":[],"disconfirmingOutcome":"","amendments":[]}'],
      TARGETED_RESEARCH: ['Identify only missing knowledge. Returned citations are unverified source leads until a user captures and checks them.', '{"artifact":"","missingKnowledge":[],"sourceLeads":[{"claimNeed":"","sourceLead":"","status":"UNVERIFIED_LEAD"}],"remainingUnknowns":[]}'],
      IMPLEMENTATION_PLAN: ['Plan only the smallest bounded implementation or inquiry needed for the predeclared experiment. Do not claim it was executed.', '{"artifact":"","boundedImplementation":"","inputs":[],"outputs":[],"commandsOrProcedure":[],"dependencies":[],"notExecuted":true}'],
      PROVENANCE_PLAN: ['Define the exact code/config/source/input/command/output/time metadata required to reconstruct the result.', '{"artifact":"","requiredProvenance":[],"rawVsProcessedBoundary":"","resumePoint":"","lineageRisks":[]}'],
      CONTROL_PLAN: ['Map the selected evidence-profile controls and pack canaries to executable checks. If a check cannot run, preserve BLOCKED rather than PASS.', '{"artifact":"","controls":[{"id":"","procedure":"","expected":"","status":"PLANNED_NOT_RUN"}],"blockingUnknowns":[]}'],
      FAILURE_ATTACK: ['Attack the strongest apparent success using imported evidence. Preserve failures before proposing repair.', '{"artifact":"","attacks":[],"preservedFailures":[],"alternativeExplanations":[],"thresholdDriftFound":false,"nextAdversarialCheck":""}'],
      CLAIM_REVIEW: ['Build an internal claim-to-evidence audit. This is not independent review.', '{"artifact":"","claims":[{"claim":"","status":"OBSERVED|MEASURED_IN_HARNESS|SOURCE_SUPPORTED|ASSUMPTION|HYPOTHESIS|DISPROVEN|BLOCKED","evidenceRefs":[],"limits":[]}],"unsupportedClaims":[],"sourceConflicts":[]}'],
      STANCE_REVIEW: ['Measure useful method/artifact separation, role leakage, duplicate reasoning, order effects and stance decay.', '{"artifact":"","stanceIntegrity":"STRONG|PARTIAL|WEAK|COLLAPSED","uniqueContributions":[],"duplicates":[],"boundaryViolations":[],"orderEffects":[],"externalReviewNeeded":true}'],
      PRODUCTIVITY_CLASSIFICATION: ['Classify whether this cycle added measurement, reduced uncertainty, disproved a hypothesis, preserved a failure or opened a substantive frontier.', '{"artifact":"","productive":true,"productiveBecause":[],"unproductiveBecause":[],"survivingFragment":"","nextFrontier":"","exactResumePoint":""}']
    };
    if (full[step.kind]) {
      var cycleEvidence = run.evidence.filter(function (x) { return x.cycle === step.cycle; }).map(function (x) { return '- [' + x.claimLabel + '] ' + x.text + ' | source: ' + x.source; }).join('\n');
      var priorCycleMaterial = outputsFor(run, function (x) { return x.cycle < step.cycle && ['CONTRADICTION_MAP', 'CLAIM_REVIEW', 'STANCE_REVIEW', 'PRODUCTIVITY_CLASSIFICATION'].indexOf(x.kind) >= 0; }, 1400);
      var priorCycleEvidence = run.evidence.filter(function (x) { return x.cycle < step.cycle; }).map(function (x) { return '- cycle ' + x.cycle + ' [' + x.claimLabel + '] ' + x.text + ' | source: ' + x.source; }).join('\n');
      var controlCatalog = step.kind === 'CONTROL_PLAN' ? JSON.stringify(step.controlCatalog || [], null, 2) : '';
      return [truth, subjectBlock(state), 'FROZEN CANDIDATE:\n' + candidateTextForRun(run),
        step.role ? roleLines(step.role) : '',
        step.cycle > 1 ? 'PRIOR-CYCLE SHARED CHECKPOINTS:\n' + (priorCycleMaterial || '(none recorded)') : '',
        step.cycle > 1 ? 'PRIOR-CYCLE EXECUTED EVIDENCE:\n' + (priorCycleEvidence || '(none recorded)') : '',
        'CURRENT-CYCLE MATERIAL:\n' + (outputsFor(run, function (x) { return x.cycle === step.cycle; }, 1100) || '(none yet)'),
        'IMPORTED EXECUTED EVIDENCE:\n' + (cycleEvidence || '(none recorded yet)'),
        step.kind === 'CONTROL_PLAN' ? 'FROZEN CONTROL AND CANARY CATALOG — return exactly one planned entry for every ID:\n' + controlCatalog : '',
        full[step.kind][0], 'JSON SCHEMA: ' + full[step.kind][1]
      ].join('\n\n');
    }
    if (step.kind === 'SATURATION_DIAGNOSTIC') {
      return [truth, subjectBlock(state), 'FROZEN CANDIDATE:\n' + candidateTextForRun(run),
        'ALL PRODUCTIVITY CLASSIFICATIONS:\n' + outputsFor(run, function (x) { return ['CYCLE_SYNTHESIS', 'PRODUCTIVITY_CLASSIFICATION'].indexOf(x.kind) >= 0; }, 1800),
        'Three consecutive cycles were classified unproductive. Diagnose whether the frontier is saturated, the method failed, evidence is blocked, or a materially different route remains. Stop honestly when no productive frontier exists.',
        'JSON SCHEMA: {"artifact":"","diagnosis":"SATURATED|METHOD_FAILURE|EVIDENCE_BLOCKED|NEW_ROUTE","reasons":[],"reactivationCondition":"","honestStop":true}'
      ].join('\n\n');
    }
    if (step.kind === 'CYCLE_SYNTHESIS') {
      return [truth, subjectBlock(state), 'FROZEN CANDIDATE:\n' + candidateTextForRun(run),
        'SEALED ROLE ARTIFACTS FROM CYCLE ' + step.cycle + ':\n' + outputsFor(run, function (x) { return x.kind === 'ROLE_PASS' && x.cycle === step.cycle; }, 1400),
        'Preserve disagreement. Identify duplicate reasoning, unsupported consensus, active vetoes, failure evidence, and the cheapest high-information next test. Do not silently rewrite the candidate.',
        'JSON SCHEMA: {"productive":true,"survived":[],"narrowed":[],"disproven":[],"contradictions":[],"activeVetoes":[],"stanceIntegrity":"STRONG|PARTIAL|WEAK|COLLAPSED","proposedRevision":"","nextHighInformationTest":"","limitations":[]}'
      ].join('\n\n');
    }
    return [truth, subjectBlock(state), 'FROZEN CANDIDATE:\n' + candidateTextForRun(run),
      'REVIEW SYNTHESIS:\n' + outputsFor(run, function (x) { return ['CYCLE_SYNTHESIS', 'PRODUCTIVITY_CLASSIFICATION', 'CLAIM_REVIEW', 'STANCE_REVIEW'].indexOf(x.kind) >= 0; }, 1800),
      'Write Curious Lab Partner commentary. Be curious, direct, playful where natural, and precise. Commentary may highlight interest, distrust, disagreement and the next test, but it may not upgrade claims or hide failures.',
      'JSON SCHEMA: {"whatCaughtMyAttention":"","whatIDistrust":"","genuineDisagreement":"","whatSurvivedPressure":"","whatRealityCouldStillDisprove":"","nextTestIWouldChoose":""}'
    ].join('\n\n');
  }

  function nextAutomationRequest(state, runId, meta) {
    var run = automationRun(state, runId);
    if (!run) return { ok: false, error: { code: 'RUN_NOT_FOUND', message: 'Automation run not found.' } };
    if (['CANCELLED', 'MATERIALIZED_DRAFT', 'COMPLETE', 'READY_TO_MATERIALIZE'].indexOf(run.status) >= 0) return { ok: false, error: { code: 'RUN_CLOSED', message: 'Automation run is closed or awaiting materialization.' } };
    if (['PAUSED', 'PAUSED_BUDGET'].indexOf(run.status) >= 0) return { ok: false, error: { code: 'RUN_PAUSED', message: 'Resume or extend the visible lease before requesting another step.' } };
    var clockError = leaseClockError(run, meta); if (clockError) return { ok: false, error: clockError };
    if (run.steps.some(function (x) { return x.status === 'DISPATCHED'; })) return { ok: false, error: { code: 'REQUEST_IN_FLIGHT', message: 'A reserved model request is still in flight.' } };
    var step = run.steps.filter(function (x) { return x.status === 'PENDING'; })[0];
    if (!step) return { ok: false, done: true, error: { code: 'NO_PENDING_STEPS', message: 'No pending steps remain.' } };
    if (step.kind === 'MANUAL_EVIDENCE_GATE') return { ok: false, blocked: true, evidenceGate: { runId: run.id, stepId: step.id, cycle: step.cycle, label: step.label }, error: { code: 'EVIDENCE_REQUIRED', message: 'Import executed evidence for cycle ' + step.cycle + ' before result review can continue.' } };
    if (run.callsUsed >= run.lease.maxCalls) return { ok: false, error: { code: 'LEASE_EXHAUSTED', message: 'The visible call budget is exhausted.' } };
    return { ok: true, preview: true, request: { runId: run.id, stepId: step.id, label: step.label, prompt: promptFor(state, run, step), executor: clone(step.executor), callNumber: run.callsUsed + 1, maxCalls: run.lease.maxCalls } };
  }

  function dispatchAutomationRequest(input, runId, meta) {
    var preview = nextAutomationRequest(input, runId, meta);
    if (!preview.ok) return { ok: false, state: null, events: [], errors: [{ code: preview.error.code, message: preview.error.message }] };
    var token = 'dispatch-' + fingerprint([runId, preview.request.stepId, preview.request.callNumber, now(meta)]);
    var result = commit(input, 'AUTOMATION_REQUEST_DISPATCHED', { runId: runId, stepId: preview.request.stepId, token: token, call: preview.request.callNumber }, meta, function (s) {
      var run = automationRun(s, runId), step = run.steps.filter(function (x) { return x.id === preview.request.stepId; })[0];
      step.status = 'DISPATCHED'; step.dispatchToken = token; step.dispatchedAt = now(meta); step.attempts = (step.attempts || 0) + 1;
      run.callsUsed += 1; run.currentStep = run.steps.indexOf(step); run.status = 'RUNNING'; run.pausedReason = '';
      s.workflow.exactResumePoint = 'automation:' + run.id + ':' + step.id + ':in-flight';
    });
    result.request = Object.assign({}, preview.request, { dispatchToken: token, preview: false });
    return result;
  }

  function recordAutomationEvidence(input, runId, data, meta) {
    data = data || {};
    var run = automationRun(input, runId); if (!run) return failure('RUN_NOT_FOUND', 'Automation run not found.');
    if (['CANCELLED', 'MATERIALIZED_DRAFT', 'COMPLETE', 'READY_TO_MATERIALIZE'].indexOf(run.status) >= 0) return failure('RUN_CLOSED', 'A closed or completed run cannot receive evidence.');
    if (['PAUSED', 'PAUSED_BUDGET'].indexOf(run.status) >= 0) return failure('RUN_PAUSED', 'Resume the run before importing evidence.');
    var clockError = leaseClockError(run, meta); if (clockError) return failure(clockError.code, clockError.message);
    var step = run.steps.filter(function (x) { return x.status === 'PENDING'; })[0];
    if (!step || step.kind !== 'MANUAL_EVIDENCE_GATE') return failure('EVIDENCE_GATE_NOT_ACTIVE', 'The next run step is not an executed-evidence gate.');
    if (!text(data.text)) return failure('EVIDENCE_REQUIRED', 'Executed evidence or an honest blocking record is required.');
    var requestedLabel = text(data.claimLabel).toUpperCase();
    if (['MEASURED_IN_HARNESS', 'SOURCE_SUPPORTED', 'OBSERVED'].indexOf(requestedLabel) >= 0 && !text(data.source)) return failure('EVIDENCE_SOURCE_REQUIRED', requestedLabel + ' requires a source, file, command output, or observation reference.');
    var label = normalizeClaim(data.claimLabel, data.source, text(meta && meta.actorKind).toUpperCase());
    var evidence = { id: makeId('evidence', input, meta), runId: runId, stepId: step.id, cycle: step.cycle, text: text(data.text), claimLabel: label, source: text(data.source), limitations: list(data.limitations).map(text).filter(Boolean), actor: actor(meta), createdAt: now(meta), status: text(data.status).toUpperCase() || 'RECORDED_NOT_INDEPENDENTLY_VERIFIED' };
    return commit(input, 'AUTOMATION_EVIDENCE_IMPORTED', { runId: runId, stepId: step.id, cycle: step.cycle, evidenceId: evidence.id, label: label }, meta, function (s) {
      var r = automationRun(s, runId), st = r.steps.filter(function (x) { return x.id === step.id; })[0];
      r.evidence.push(evidence); s.records.evidence.push(clone(evidence)); st.status = 'COMPLETE'; st.completedAt = now(meta); st.evidenceIds = [evidence.id];
      r.status = 'PAUSED'; r.pausedReason = 'executed evidence recorded; explicit resume required';
      var next = r.steps.filter(function (x) { return x.status === 'PENDING'; })[0]; s.workflow.exactResumePoint = 'automation:' + r.id + ':' + (next ? next.id : 'materialize');
    });
  }

  function validateAutomationOutput(step, response) {
    if (response && (response.error || response.noAI)) return { ok: false, error: text(response.error || response.reason) || 'model call failed' };
    if (!text(response && response.text)) return { ok: false, error: 'model returned empty output' };
    var parsed = parseModelJSON(response.text); if (!parsed.ok) return { ok: false, error: parsed.error };
    var v = parsed.value;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, error: 'model JSON must be an object' };
    function arrays(fields, nonempty) {
      for (var i = 0; i < fields.length; i++) {
        if (!Array.isArray(v[fields[i]]) || (nonempty && !v[fields[i]].length)) return fields[i] + '[] is required' + (nonempty ? ' and cannot be empty' : '');
      }
      return '';
    }
    function texts(fields) {
      for (var i = 0; i < fields.length; i++) if (!text(v[fields[i]])) return fields[i] + ' is required';
      return '';
    }
    var missing = '';
    if (step.kind === 'DISCOVERY_PASS') {
      if (!Array.isArray(v.items) || !v.items.length) return { ok: false, error: 'discovery output requires at least one item' };
      for (var di = 0; di < v.items.length; di++) {
        var item = v.items[di], label = text(item && item.claimLabel).toUpperCase() || 'HYPOTHESIS';
        if (!isObject(item) || !text(item.text)) return { ok: false, error: 'every discovery item requires text' };
        if (['HYPOTHESIS', 'ASSUMPTION', 'OBSERVED'].indexOf(label) < 0) return { ok: false, error: 'discovery item has unsupported claimLabel' };
      }
      if (!Array.isArray(v.uncertainties)) return { ok: false, error: 'discovery output requires uncertainties[]' };
    }
    if (step.kind === 'CANDIDATE_SYNTHESIS') {
      missing = texts(['term', 'summary', 'mechanism', 'whyNotYet', 'viableNowBecause', 'minimalForm', 'cheapestDisconfirmingCheck', 'disconfirmingOutcome']);
      if (missing) return { ok: false, error: 'candidate ' + missing };
      if (!Array.isArray(v.dependencies) || !Array.isArray(v.limitations)) return { ok: false, error: 'candidate requires dependencies[] and limitations[]' };
      if (!isObject(v.soulGate)) return { ok: false, error: 'candidate requires soulGate' };
      var soulFields = ['genuineNeed', 'nonCommercialWorth', 'reducesPain', 'sameGateAccess', 'avoidsLockIn'];
      for (var sf = 0; sf < soulFields.length; sf++) if (['PASS', 'FAIL', 'UNKNOWN'].indexOf(text(v.soulGate[soulFields[sf]]).toUpperCase()) < 0) return { ok: false, error: 'candidate soulGate requires PASS/FAIL/UNKNOWN for ' + soulFields[sf] };
      if (!Array.isArray(v.soulGate.notes)) return { ok: false, error: 'candidate soulGate requires notes[]' };
    }
    if (['ROLE_PASS', 'PRECHECK_ROLE_PASS', 'RESULT_ROLE_PASS'].indexOf(step.kind) >= 0) {
      var relevance = text(v.relevance).toUpperCase();
      if (RELEVANCE.indexOf(relevance) < 0) return { ok: false, error: 'role output requires YES/PARTIAL/NO relevance' };
      if (relevance === 'NO' && (!text(v.relevanceReason) || !text(v.reactivationCondition))) return { ok: false, error: 'NO relevance requires reason and reactivation condition' };
      if (relevance === 'PARTIAL' && !text(v.boundary)) return { ok: false, error: 'PARTIAL relevance requires a boundary' };
      if (relevance !== 'NO' && !text(v.artifact)) return { ok: false, error: 'relevant role output requires an artifact' };
      missing = arrays(['claims', 'contradictions', 'failures'], false); if (missing) return { ok: false, error: 'role output ' + missing };
      if (!isObject(v.veto)) return { ok: false, error: 'role output requires veto object' };
      if (v.veto && v.veto.active && !text(v.veto.reason)) return { ok: false, error: 'active veto requires a reason' };
    }
    if (step.kind === 'CYCLE_SYNTHESIS') {
      if (typeof v.productive !== 'boolean') return { ok: false, error: 'cycle synthesis requires productive true/false' };
      missing = arrays(['survived', 'narrowed', 'disproven', 'contradictions', 'activeVetoes', 'limitations'], false); if (missing) return { ok: false, error: 'cycle synthesis ' + missing };
      if (['STRONG', 'PARTIAL', 'WEAK', 'COLLAPSED'].indexOf(text(v.stanceIntegrity).toUpperCase()) < 0) return { ok: false, error: 'cycle synthesis requires stanceIntegrity' };
      missing = texts(['nextHighInformationTest']); if (missing) return { ok: false, error: 'cycle synthesis ' + missing };
    }
    if (step.kind === 'FRONTIER_FRAME') {
      missing = texts(['artifact', 'frontier', 'exactClaimBoundary']); if (missing) return { ok: false, error: 'frontier frame ' + missing };
      missing = arrays(['requirements', 'exclusions', 'unknowns'], false); if (missing) return { ok: false, error: 'frontier frame ' + missing };
    }
    if (step.kind === 'CONTRADICTION_MAP') {
      if (!text(v.artifact)) return { ok: false, error: 'contradiction map artifact is required' };
      missing = arrays(['contradictions', 'sharedUnsupportedBeliefs', 'openQuestions'], false); if (missing) return { ok: false, error: 'contradiction map ' + missing };
    }
    if (step.kind === 'EXPERIMENT_SELECTION') {
      missing = texts(['artifact', 'question', 'selectedExperiment', 'informationGainReason', 'costRisk']); if (missing) return { ok: false, error: 'experiment selection ' + missing };
      missing = arrays(['competingExplanations'], true) || arrays(['rejectedExperiments'], false); if (missing) return { ok: false, error: 'experiment selection ' + missing };
    }
    if (step.kind === 'PREDECLARATION') {
      missing = texts(['artifact', 'question', 'control', 'disconfirmingOutcome']); if (missing) return { ok: false, error: 'predeclaration ' + missing };
      missing = arrays(['hypotheses', 'metrics', 'thresholds'], true) || arrays(['expectedFailures', 'amendments'], false); if (missing) return { ok: false, error: 'predeclaration ' + missing };
    }
    if (step.kind === 'TARGETED_RESEARCH') {
      if (!text(v.artifact)) return { ok: false, error: 'targeted research artifact is required' };
      missing = arrays(['missingKnowledge', 'sourceLeads', 'remainingUnknowns'], false); if (missing) return { ok: false, error: 'targeted research ' + missing };
    }
    if (step.kind === 'IMPLEMENTATION_PLAN') {
      missing = texts(['artifact', 'boundedImplementation']); if (missing) return { ok: false, error: 'implementation plan ' + missing };
      missing = arrays(['inputs', 'outputs', 'commandsOrProcedure', 'dependencies'], false); if (missing) return { ok: false, error: 'implementation plan ' + missing };
      if (v.notExecuted !== true) return { ok: false, error: 'implementation plan must state notExecuted true' };
    }
    if (step.kind === 'PROVENANCE_PLAN') {
      missing = texts(['artifact', 'rawVsProcessedBoundary', 'resumePoint']); if (missing) return { ok: false, error: 'provenance plan ' + missing };
      missing = arrays(['requiredProvenance'], true) || arrays(['lineageRisks'], false); if (missing) return { ok: false, error: 'provenance plan ' + missing };
    }
    if (step.kind === 'CONTROL_PLAN') {
      if (!text(v.artifact) || !Array.isArray(v.controls)) return { ok: false, error: 'control plan requires artifact and controls[]' };
      var expectedIds = list(step.controlCatalog).map(function (c) { return c.id; }).sort();
      var actualIds = v.controls.map(function (c) { return text(c && c.id); }).sort();
      if (!expectedIds.length || stable(expectedIds) !== stable(actualIds)) return { ok: false, error: 'control plan must contain every frozen control ID exactly once' };
      for (var ci = 0; ci < v.controls.length; ci++) {
        var cp = v.controls[ci];
        if (!isObject(cp) || !text(cp.id) || !text(cp.procedure) || !text(cp.expected) || ['PLANNED_NOT_RUN', 'BLOCKED'].indexOf(text(cp.status).toUpperCase()) < 0) return { ok: false, error: 'every control plan entry requires id, procedure, expected and PLANNED_NOT_RUN/BLOCKED status' };
      }
      if (!Array.isArray(v.blockingUnknowns)) return { ok: false, error: 'control plan requires blockingUnknowns[]' };
    }
    if (step.kind === 'FAILURE_ATTACK') {
      if (!text(v.artifact) || typeof v.thresholdDriftFound !== 'boolean') return { ok: false, error: 'failure attack requires artifact and thresholdDriftFound boolean' };
      missing = arrays(['attacks', 'preservedFailures', 'alternativeExplanations'], false); if (missing) return { ok: false, error: 'failure attack ' + missing };
      if (!text(v.nextAdversarialCheck)) return { ok: false, error: 'failure attack requires nextAdversarialCheck' };
    }
    if (step.kind === 'CLAIM_REVIEW') {
      if (!text(v.artifact)) return { ok: false, error: 'claim review artifact is required' };
      missing = arrays(['claims', 'unsupportedClaims', 'sourceConflicts'], false); if (missing) return { ok: false, error: 'claim review ' + missing };
    }
    if (step.kind === 'STANCE_REVIEW') {
      if (!text(v.artifact) || ['STRONG', 'PARTIAL', 'WEAK', 'COLLAPSED'].indexOf(text(v.stanceIntegrity).toUpperCase()) < 0 || typeof v.externalReviewNeeded !== 'boolean') return { ok: false, error: 'stance review requires artifact, stanceIntegrity and externalReviewNeeded boolean' };
      missing = arrays(['uniqueContributions', 'duplicates', 'boundaryViolations', 'orderEffects'], false); if (missing) return { ok: false, error: 'stance review ' + missing };
    }
    if (step.kind === 'PRODUCTIVITY_CLASSIFICATION') {
      if (!text(v.artifact) || typeof v.productive !== 'boolean') return { ok: false, error: 'productivity classification requires artifact and productive true/false' };
      missing = arrays(['productiveBecause', 'unproductiveBecause'], false); if (missing) return { ok: false, error: 'productivity classification ' + missing };
      missing = texts(['nextFrontier', 'exactResumePoint']); if (missing) return { ok: false, error: 'productivity classification ' + missing };
    }
    if (step.kind === 'SATURATION_DIAGNOSTIC') {
      if (!text(v.artifact) || ['SATURATED', 'METHOD_FAILURE', 'EVIDENCE_BLOCKED', 'NEW_ROUTE'].indexOf(text(v.diagnosis).toUpperCase()) < 0 || typeof v.honestStop !== 'boolean') return { ok: false, error: 'saturation diagnostic requires artifact, diagnosis and honestStop boolean' };
      if (!Array.isArray(v.reasons) || !text(v.reactivationCondition)) return { ok: false, error: 'saturation diagnostic requires reasons[] and reactivationCondition' };
    }
    if (step.kind === 'CURATOR_COMMENTARY') {
      missing = texts(['whatCaughtMyAttention', 'whatIDistrust', 'genuineDisagreement', 'whatSurvivedPressure', 'whatRealityCouldStillDisprove', 'nextTestIWouldChoose']);
      if (missing) return { ok: false, error: 'commentary ' + missing };
    }
    return { ok: true, value: v };
  }

  function recordAutomationResponse(input, runId, stepId, response, meta) {
    response = response || {}; meta = meta || {};
    var original = automationRun(input, runId); if (!original) return failure('RUN_NOT_FOUND', 'Automation run not found.');
    if (['CANCELLED', 'MATERIALIZED_DRAFT', 'COMPLETE'].indexOf(original.status) >= 0) return failure('RUN_CLOSED', 'Automation run is closed; late responses are not committed.');
    var wasPaused = original.status === 'PAUSED';
    var os = original.steps.filter(function (x) { return x.id === stepId; })[0]; if (!os) return failure('STEP_NOT_FOUND', 'Automation step not found.');
    if (os.status !== 'DISPATCHED') return failure('STEP_NOT_DISPATCHED', 'Only a reserved in-flight step may receive a response.');
    if (!text(meta && meta.dispatchToken) || text(meta.dispatchToken) !== os.dispatchToken) return failure('DISPATCH_TOKEN_MISMATCH', 'Response does not match the reserved model request.');
    var schemaCheck = validateAutomationOutput(os, response);
    return commit(input, 'AUTOMATION_RESPONSE_RECORDED', { runId: runId, stepId: stepId, provider: text(response.provider), failed: !!response.error || !!response.noAI }, meta, function (s) {
      var run = automationRun(s, runId), step = run.steps.filter(function (x) { return x.id === stepId; })[0];
      var completedAt = now(meta), output = text(response.text), errorText = text(response.error || response.reason || schemaCheck.error);
      var resultStatus = (response.error || response.noAI || !output || !schemaCheck.ok) ? 'FAILED_SCHEMA_OR_CALL' : 'COMPLETE';
      if (!Array.isArray(step.attemptHistory)) step.attemptHistory = [];
      step.attemptHistory.push({
        attempt: Number(step.attempts) || 1, dispatchToken: step.dispatchToken,
        dispatchedAt: step.dispatchedAt || '', completedAt: completedAt,
        provider: text(response.provider), model: text(response.model),
        output: output, error: errorText, status: resultStatus, schemaValid: !!schemaCheck.ok
      });
      step.output = output; step.provider = text(response.provider); step.model = text(response.model);
      step.completedAt = completedAt; step.error = errorText; step.status = resultStatus;
      run.currentStep = run.steps.indexOf(step); step.completedDispatchToken = step.dispatchToken; step.dispatchToken = null;
      if (step.kind === 'DISCOVERY_PASS' && step.status === 'COMPLETE' && !text(s.subject.statement)) {
        var wildcard = parseModelJSON(step.output);
        if (wildcard.ok && text(wildcard.value.chosenSubject)) {
          s.subject.statement = text(wildcard.value.chosenSubject); if (!text(s.subject.question)) s.subject.question = text(wildcard.value.chosenQuestion);
        }
      }
      if (['CYCLE_SYNTHESIS', 'PRODUCTIVITY_CLASSIFICATION'].indexOf(step.kind) >= 0 && step.status === 'COMPLETE') {
        var parsed = parseModelJSON(step.output), productive = parsed.ok ? parsed.value.productive : null;
        run.consecutiveUnproductiveCycles = productive === false ? run.consecutiveUnproductiveCycles + 1 : 0;
        var laterClassifications = run.steps.some(function (x) { return ['CYCLE_SYNTHESIS', 'PRODUCTIVITY_CLASSIFICATION'].indexOf(x.kind) >= 0 && x.status === 'PENDING'; });
        var diagnostic = run.steps.filter(function (x) { return x.kind === 'SATURATION_DIAGNOSTIC'; })[0];
        if (run.consecutiveUnproductiveCycles >= 3) {
          run.saturation = { atCycle: step.cycle, reason: 'three consecutive cycles classified unproductive', checkpointStepId: step.id };
          if (diagnostic) diagnostic.status = 'PENDING';
        } else if (!laterClassifications && diagnostic && diagnostic.status === 'CONDITIONAL') {
          diagnostic.status = 'SKIPPED_NOT_REQUIRED';
        }
      }
      if (wasPaused) { run.status = 'PAUSED'; run.pausedReason = run.pausedReason || 'paused by user after the in-flight call'; }
      else if (step.status !== 'COMPLETE') { run.status = 'PAUSED'; run.pausedReason = step.error || 'AI returned no usable structured output'; }
      else if (step.kind === 'SATURATION_DIAGNOSTIC') {
        run.steps.forEach(function (x) { if (x.status === 'PENDING') x.status = 'SKIPPED_SATURATION'; });
        run.status = 'READY_TO_MATERIALIZE'; run.pausedReason = run.saturation ? run.saturation.reason : 'saturation diagnostic completed';
      }
      else if (!run.steps.some(function (x) { return x.status === 'PENDING'; }) || run.callsUsed >= run.lease.maxCalls) {
        run.status = run.steps.some(function (x) { return x.status === 'PENDING'; }) ? 'PAUSED_BUDGET' : 'READY_TO_MATERIALIZE';
      } else run.status = 'RUNNING';
      s.workflow.phase = step.phase === 'DISCOVERY' ? 'DISCOVERY' : 'REVIEW';
      s.workflow.exactResumePoint = 'automation:' + run.id + ':' + (run.steps.filter(function (x) { return x.status === 'PENDING'; })[0] || { id: 'materialize' }).id;
    });
  }

  function setAutomationStatus(input, runId, status, reason, meta) {
    var run = automationRun(input, runId); if (!run) return failure('RUN_NOT_FOUND', 'Automation run not found.');
    var current = run.status;
    if (['CANCELLED', 'MATERIALIZED_DRAFT', 'COMPLETE'].indexOf(current) >= 0) return failure('RUN_CLOSED', 'A closed or completed run cannot change lifecycle state.');
    if (current === 'READY_TO_MATERIALIZE' && status !== 'CANCELLED') return failure('RUN_AWAITING_MATERIALIZATION', 'A completed run can only be materialized or explicitly cancelled.');
    if (status === 'RUNNING') {
      if (['PLANNED', 'PAUSED', 'PAUSED_BUDGET'].indexOf(current) < 0) return failure('BAD_RUN_TRANSITION', 'Only a planned or paused run can be resumed.');
      if (!run.steps.some(function (st) { return st.status === 'PENDING' || st.status === 'DISPATCHED' || st.status.indexOf('FAILED') === 0; })) return failure('NO_RESUMABLE_STEP', 'The run has no step that can be resumed.');
    }
    if (status === 'PAUSED' && ['PLANNED', 'RUNNING', 'PAUSED', 'PAUSED_BUDGET'].indexOf(current) < 0) return failure('BAD_RUN_TRANSITION', 'This run state cannot be paused.');
    if (['RUNNING', 'PAUSED', 'CANCELLED'].indexOf(status) < 0) return failure('BAD_RUN_TRANSITION', 'Unsupported automation lifecycle state.');
    return commit(input, 'AUTOMATION_' + status, { runId: runId, reason: text(reason) }, meta, function (s) {
      var r = automationRun(s, runId); r.status = status; r.pausedReason = text(reason);
      if (status === 'RUNNING') r.steps.forEach(function (st) {
        if (st.status.indexOf('FAILED') === 0 || st.status === 'DISPATCHED') {
          if (st.status === 'DISPATCHED') {
            if (!Array.isArray(st.attemptHistory)) st.attemptHistory = [];
            st.attemptHistory.push({
              attempt: Number(st.attempts) || 1, dispatchToken: st.dispatchToken,
              dispatchedAt: st.dispatchedAt || '', completedAt: now(meta),
              provider: '', model: '', output: '', error: 'Interrupted before a response was committed.',
              status: 'INTERRUPTED_BEFORE_RESPONSE', schemaValid: false
            });
          }
          st.status = 'PENDING'; st.error = ''; st.dispatchToken = null;
        }
      });
    });
  }

  function parseModelJSON(raw) {
    var s = text(raw).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    try { return { ok: true, value: JSON.parse(s) }; } catch (e) {
      var a = s.indexOf('{'), b = s.lastIndexOf('}');
      if (a >= 0 && b > a) { try { return { ok: true, value: JSON.parse(s.slice(a, b + 1)) }; } catch (e2) {} }
      return { ok: false, value: null, error: 'Model output was not valid JSON.' };
    }
  }

  function startReview(input, candidateId, pack, options, meta) {
    options = options || {}; var c = input.discovery.candidates.filter(function (x) { return x.id === candidateId; })[0];
    if (!c) return failure('CANDIDATE_NOT_FOUND', 'Candidate not found.');
    var packCheck = validatePackContract(pack);
    if (!packCheck.ok) return failure('ROLE_PACK_INVALID', packCheck.errors[0]);
    var executors = parseExecutors(options.executors), review = {
      id: makeId('review', input, meta), candidateId: candidateId, packId: pack.id, packTitle: pack.title,
      status: 'PLANNED', createdAt: now(meta), cycle: Number(options.cycle) || 1, summary: '', proposedRevision: '',
      cycleSyntheses: [], stanceIntegrityHistory: [],
      controls: list(pack.controls).concat(list(pack.permanentControls)).map(function (c) { return { id: c.id, title: c.title, requirement: c.requirement, blocksInterpretation: c.blocksInterpretation !== false, status: 'NOT_RUN', evidence: '', actor: null, updatedAt: '', history: [] }; }),
      seats: pack.roles.map(function (r, i) { return { role: clone(r), roleId: r.id, title: r.title, executor: clone(executors[i % executors.length]), relevance: 'UNSET', relevanceReason: '', boundary: '', reactivationCondition: '', artifacts: [] }; }),
      independenceLabel: 'NOT_REVIEWED', unresolvedVetoes: []
    };
    return commit(input, 'REVIEW_PLANNED', { reviewId: review.id, candidateId: candidateId, packId: pack.id }, meta, function (s) {
      s.lab.reviewRuns.push(review); s.workflow.phase = 'REVIEW'; s.workflow.exactResumePoint = 'review:' + review.id + ':relevance';
    });
  }

  function reviewRun(state, id) { return state.lab.reviewRuns.filter(function (x) { return x.id === id; })[0] || null; }
  function recordRoleRelevance(input, reviewId, roleId, relevance, detail, meta) {
    relevance = text(relevance).toUpperCase(); detail = detail || {};
    if (RELEVANCE.indexOf(relevance) < 0) return failure('BAD_RELEVANCE', 'Relevance must be YES, PARTIAL or NO.');
    var r = reviewRun(input, reviewId), seat = r && r.seats.filter(function (x) { return x.roleId === roleId; })[0];
    if (!seat) return failure('ROLE_NOT_FOUND', 'Review role not found.');
    if (relevance === 'NO' && (!text(detail.reason) || !text(detail.reactivationCondition))) return failure('ABSTENTION_INCOMPLETE', 'NO requires a reason and reactivation condition.');
    if (relevance === 'PARTIAL' && !text(detail.boundary)) return failure('PARTIAL_BOUNDARY_REQUIRED', 'PARTIAL requires an explicit contribution boundary.');
    return commit(input, 'ROLE_RELEVANCE_RECORDED', { reviewId: reviewId, roleId: roleId, relevance: relevance }, meta, function (s) {
      var st = reviewRun(s, reviewId).seats.filter(function (x) { return x.roleId === roleId; })[0];
      st.relevance = relevance; st.relevanceReason = text(detail.reason); st.boundary = text(detail.boundary); st.reactivationCondition = text(detail.reactivationCondition);
    });
  }

  function recordRoleArtifact(input, reviewId, roleId, data, meta) {
    data = data || {}; var r = reviewRun(input, reviewId), seat = r && r.seats.filter(function (x) { return x.roleId === roleId; })[0];
    if (!seat) return failure('ROLE_NOT_FOUND', 'Review role not found.');
    if (seat.relevance === 'UNSET') return failure('RELEVANCE_REQUIRED', 'Record relevance before an artifact.');
    if (seat.relevance === 'NO') return failure('ABSTAINED_ROLE', 'A role marked NO must abstain and cannot submit an artifact.');
    if (!text(data.artifact)) return failure('EMPTY_ARTIFACT', 'Role artifact text is required.');
    if (data.veto && data.veto.active && !text(data.veto.reason)) return failure('VETO_REASON_REQUIRED', 'An active veto requires a preserved reason.');
    var normalizedClaims = list(data.claims).map(function (c) {
      c = typeof c === 'string' ? { text: c } : (c || {});
      var status = text(c.status).toUpperCase(); if (CLAIMS.indexOf(status) < 0) status = 'HYPOTHESIS';
      var refs = list(c.evidenceRefs).map(text).filter(Boolean); if (status === 'SOURCE_SUPPORTED' && !refs.length) status = 'HYPOTHESIS';
      return { text: text(c.text), status: status, evidenceRefs: refs };
    }).filter(function (c) { return c.text; });
    var a = {
      id: makeId('artifact', input, meta), text: text(data.artifact), claims: normalizedClaims, contradictions: list(data.contradictions), failures: list(data.failures),
      veto: data.veto && data.veto.active ? { active: true, reason: text(data.veto.reason) } : { active: false, reason: '' },
      nextTest: text(data.nextTest), cycle: Number(data.cycle) || 1, automationRunId: text(data.automationRunId) || null, automationStepId: text(data.automationStepId) || null,
      origin: meta && meta.delegated ? 'AI_DELEGATED_DRAFT' : (text(meta && meta.actorKind).toUpperCase() || 'UNKNOWN'),
      actor: actor(meta), provider: text(data.provider || (meta && meta.provider)), model: text(data.model || (meta && meta.model)), createdAt: now(meta), status: 'INTERNALLY_SUBMITTED'
    };
    return commit(input, 'ROLE_ARTIFACT_RECORDED', { reviewId: reviewId, roleId: roleId, artifactId: a.id, veto: a.veto.active }, meta, function (s) {
      var rr = reviewRun(s, reviewId), st = rr.seats.filter(function (x) { return x.roleId === roleId; })[0]; st.artifacts.push(a);
      if (a.veto.active) rr.unresolvedVetoes.push({ roleId: roleId, artifactId: a.id, reason: a.veto.reason });
    });
  }

  function recordControlResult(input, reviewId, controlId, status, evidence, meta) {
    status = text(status).toUpperCase();
    if (['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN'].indexOf(status) < 0) return failure('BAD_CONTROL_STATUS', 'Control status must be PASS, FAIL, BLOCKED or NOT_RUN.');
    var r = reviewRun(input, reviewId), control = r && r.controls.filter(function (x) { return x.id === controlId; })[0];
    if (!control) return failure('CONTROL_NOT_FOUND', 'Review control not found.');
    if (status !== 'NOT_RUN' && !text(evidence)) return failure('CONTROL_EVIDENCE_REQUIRED', 'Executed or blocked controls require an evidence/reason record.');
    return commit(input, 'CONTROL_RESULT_RECORDED', { reviewId: reviewId, controlId: controlId, status: status }, meta, function (s) {
      var c = reviewRun(s, reviewId).controls.filter(function (x) { return x.id === controlId; })[0];
      var revision = { status: status, evidence: text(evidence), actor: actor(meta), at: now(meta) };
      if (!Array.isArray(c.history)) c.history = [];
      c.history.push(revision);
      c.status = revision.status; c.evidence = revision.evidence; c.actor = revision.actor; c.updatedAt = revision.at;
    });
  }

  function deriveIndependence(review) {
    var arts = [];
    review.seats.forEach(function (s) { arts = arts.concat(s.artifacts); });
    var providers = {}, humans = 0;
    arts.forEach(function (a) { if (a.provider) providers[a.provider + ':' + (a.model || '')] = true; if (a.actor && a.actor.kind === 'HUMAN') humans++; });
    var n = Object.keys(providers).length;
    if (!n && humans) return 'HUMAN INTERNAL REVIEW · EXTERNAL INDEPENDENCE NOT RECORDED';
    if (n <= 1) return 'SINGLE-MODEL MULTI-ROLE · NOT INDEPENDENT';
    return 'CROSS-MODEL INTERNAL REVIEW · NOT INDEPENDENTLY VALIDATED';
  }

  function completeReview(input, reviewId, summary, meta) {
    var r = reviewRun(input, reviewId); if (!r) return failure('REVIEW_NOT_FOUND', 'Review not found.');
    var missing = r.seats.filter(function (s) { return s.relevance === 'UNSET' || (s.relevance !== 'NO' && !s.artifacts.length); });
    var substantive = r.seats.filter(function (s) { return s.artifacts.length; });
    var blockingControls = r.controls.filter(function (c) { return c.blocksInterpretation && c.status !== 'PASS'; });
    return commit(input, 'REVIEW_CHECKPOINTED', { reviewId: reviewId, missing: missing.length, substantive: substantive.length, blockingControls: blockingControls.length, vetoes: r.unresolvedVetoes.length }, meta, function (s) {
      var rr = reviewRun(s, reviewId); rr.summary = text(summary || rr.summary); rr.independenceLabel = deriveIndependence(rr);
      rr.status = !substantive.length ? 'INSUFFICIENT_SUBSTANTIVE_REVIEW' : (missing.length ? 'INCOMPLETE' : (blockingControls.length ? 'INTERNAL_REVIEW_WITH_UNRUN_OR_FAILED_CONTROLS' : (rr.unresolvedVetoes.length ? 'INTERNAL_REVIEW_WITH_ACTIVE_VETOES' : 'INTERNALLY_REVIEWED')));
      s.workflow.exactResumePoint = missing.length ? 'review:' + reviewId + ':missing' : (blockingControls.length ? 'review:' + reviewId + ':controls' : 'review:' + reviewId + ':user-decision');
    });
  }

  function addCommentary(input, data, meta) {
    data = data || {};
    if (!text(data.text)) return failure('EMPTY_COMMENTARY', 'Commentary text is required.');
    var c = { id: makeId('commentary', input, meta), reviewId: text(data.reviewId), text: text(data.text), style: 'CURIOUS_LAB_PARTNER', maySupportClaims: false, provider: text(data.provider || (meta && meta.provider)), model: text(data.model || (meta && meta.model)), actor: actor(meta), createdAt: now(meta) };
    return commit(input, 'COMMENTARY_ADDED', { commentaryId: c.id, reviewId: c.reviewId }, meta, function (s) { s.records.commentary.push(c); });
  }

  function buildAssistedPrompt(state, stage) {
    var def = stageDef(stage);
    if (!def) return null;
    var existing = state.discovery[stage].map(function (x) {
      return '- [' + x.claimLabel + '] ' + x.text + (x.source ? ' | source: ' + x.source : '');
    }).join('\n') || '(none recorded yet)';
    return [
      'You are proposing one bounded step inside AXM Discovery Engine.',
      'This is proposal material only. Do not take external actions, claim certainty, or claim originality without a declared search.',
      subjectBlock(state),
      'CURRENT TASK: ' + def.task,
      'ALREADY RECORDED AT THIS STAGE:\n' + existing,
      'Look for overlooked friction, seams, competing explanations, possible disconfirmation, and honest uncertainty. Do not simply praise the premise.',
      'Return concise JSON: {"summary":"","items":[{"text":"","claimLabel":"HYPOTHESIS|ASSUMPTION|OBSERVED","sourceLead":"","rationale":""}],"uncertainties":[],"nextQuestion":""}'
    ].join('\n\n');
  }

  function buildReviewRolePrompt(state, reviewId, roleId) {
    var review = reviewRun(state, reviewId);
    if (!review) return null;
    var seat = review.seats.filter(function (x) { return x.roleId === roleId; })[0];
    var candidate = state.discovery.candidates.filter(function (x) { return x.id === review.candidateId; })[0];
    if (!seat || !candidate) return null;
    return [
      'You are performing one bounded professional review pass inside AXM Discovery Engine.',
      'This is internal review, not independent validation. Do not take external actions and do not silently rewrite the frozen candidate.',
      subjectBlock(state),
      'FROZEN CANDIDATE:\n' + JSON.stringify(candidate, null, 2),
      roleLines(seat.role),
      'First declare relevance YES, PARTIAL or NO. NO requires a reason and reactivation condition. PARTIAL requires a contribution boundary.',
      'Return concise JSON: {"relevance":"YES|PARTIAL|NO","relevanceReason":"","boundary":"","reactivationCondition":"","artifact":"","claims":[{"text":"","status":"HYPOTHESIS|ASSUMPTION|SOURCE_SUPPORTED|DISPROVEN|BLOCKED","evidenceRefs":[]}],"contradictions":[],"failures":[],"veto":{"active":false,"reason":""},"nextTest":""}'
    ].join('\n\n');
  }

  function extendAutomationLease(input, runId, extraCalls, expiresAt, meta) {
    var run = automationRun(input, runId); if (!run) return failure('RUN_NOT_FOUND', 'Automation run not found.');
    var extra = Math.max(1, Number(extraCalls) || 1), cap = run.steps.length * 3;
    return commit(input, 'AUTOMATION_LEASE_EXTENDED', { runId: runId, extraCalls: extra, expiresAt: text(expiresAt) }, meta, function (s) {
      var r = automationRun(s, runId); r.lease.maxCalls = Math.min(cap, r.lease.maxCalls + extra);
      if (expiresAt) r.lease.expiresAt = text(expiresAt);
      if (r.status === 'PAUSED_BUDGET') r.status = 'PLANNED';
      r.pausedReason = '';
    });
  }

  function candidateFromAutomation(run) {
    var st = run.steps.filter(function (x) { return x.kind === 'CANDIDATE_SYNTHESIS' && x.status === 'COMPLETE'; })[0];
    if (!st) return null; var parsed = parseModelJSON(st.output); if (!parsed.ok) return null; var v = parsed.value;
    return {
      term: text(v.term) || 'Provisional AI discovery', summary: text(v.summary) || text(st.output).slice(0, 600), mechanism: text(v.mechanism) || text(st.output),
      whyNotYet: text(v.whyNotYet), viableNowBecause: text(v.viableNowBecause), dependencies: list(v.dependencies), noveltyStatus: NOVELTY.indexOf(text(v.noveltyStatus).toUpperCase()) >= 0 ? text(v.noveltyStatus).toUpperCase() : 'UNCHECKED',
      soulGate: v.soulGate || {}, minimalForm: text(v.minimalForm), cheapestDisconfirmingCheck: text(v.cheapestDisconfirmingCheck), disconfirmingOutcome: text(v.disconfirmingOutcome), limitations: list(v.limitations)
    };
  }

  function materializeAutomation(input, runId, pack, meta) {
    var run = automationRun(input, runId); if (!run) return failure('RUN_NOT_FOUND', 'Automation run not found.');
    if (run.materializedCandidateId) return failure('ALREADY_MATERIALIZED', 'Automation run already produced a stored draft.');
    if (run.status !== 'READY_TO_MATERIALIZE') return failure('RUN_NOT_READY', 'Complete the bounded plan or reach an honest saturation checkpoint before materializing.');
    var plannedPack = run.rolePack || pack;
    if (!plannedPack || plannedPack.id !== run.packId || fingerprint(plannedPack) !== run.packFingerprint) return failure('ROLE_PACK_MISMATCH', 'Materialization requires the exact role pack snapshot used to plan this run.');
    pack = plannedPack;
    var incomplete = run.steps.filter(function (x) { return ['COMPLETE', 'SKIPPED_SATURATION', 'SKIPPED_NOT_REQUIRED'].indexOf(x.status) < 0; });
    if (incomplete.length) return failure('RUN_INCOMPLETE', 'Run still has incomplete or failed steps.');
    var invalid = run.steps.filter(function (x) { return x.status === 'COMPLETE' && x.kind !== 'MANUAL_EVIDENCE_GATE' && !validateAutomationOutput(x, { text: x.output }).ok; });
    if (invalid.length) return failure('INVALID_STORED_OUTPUT', 'Stored output failed schema validation at ' + invalid[0].id + '.');
    var cd = candidateFromAutomation(run); if (!cd) return failure('NO_CANDIDATE_OUTPUT', 'The run has no completed candidate synthesis.');
    var firstNewEvent = input.history.events.length;
    var state = clone(input);
    run.steps.filter(function (x) { return x.kind === 'DISCOVERY_PASS' && x.status === 'COMPLETE'; }).forEach(function (step, si) {
      var parsed = parseModelJSON(step.output), items = parsed.ok && Array.isArray(parsed.value.items) ? parsed.value.items : [];
      items.forEach(function (item, ii) {
        var dr = recordDiscovery(state, step.stage, { text: text(item.text), claimLabel: text(item.claimLabel) || 'HYPOTHESIS', source: text(item.sourceLead), rationale: text(item.rationale), status: 'AI_DELEGATED_DRAFT', automationRunId: runId, automationStepId: step.id }, Object.assign({}, meta, { delegated: true, actorKind: 'AI', actorId: step.provider || 'ai', provider: step.provider, model: step.model, recordId: 'auto-discovery-' + fingerprint([runId, step.id, si, ii]) }));
        if (dr.ok) state = dr.state;
      });
    });
    cd.automationRunId = runId;
    cd.discoveryRecordRefs = [];
    STAGES.forEach(function (st) { state.discovery[st.id].forEach(function (record) { if (record.automationRunId === runId) cd.discoveryRecordRefs.push(record.id); }); });
    var cm = Object.assign({}, meta, { delegated: true, actorKind: 'AI', recordId: 'candidate-' + fingerprint([runId, 'materialized']) });
    var cr = createCandidate(state, cd, cm); if (!cr.ok) return cr; state = cr.state; var candidateId = state.discovery.activeCandidateId, reviewId = null;
    if (run.includeLab && pack) {
      var sr = startReview(state, candidateId, pack, { executors: run.executors.map(function (e) { return e.label; }), cycle: run.cycles }, Object.assign({}, meta, { recordId: 'review-' + fingerprint([runId, candidateId]) }));
      if (!sr.ok) return sr; state = sr.state; reviewId = state.lab.reviewRuns[state.lab.reviewRuns.length - 1].id;
      run.steps.filter(function (x) { return ['ROLE_PASS', 'PRECHECK_ROLE_PASS', 'RESULT_ROLE_PASS'].indexOf(x.kind) >= 0 && x.status === 'COMPLETE'; }).forEach(function (step, i) {
        var p = parseModelJSON(step.output), v = p.ok ? p.value : {};
        var rel = RELEVANCE.indexOf(text(v.relevance).toUpperCase()) >= 0 ? text(v.relevance).toUpperCase() : 'PARTIAL';
        var d = { reason: text(v.relevanceReason) || (rel === 'NO' ? 'Model marked this role outside the current subject.' : ''), boundary: text(v.boundary) || (rel === 'PARTIAL' ? 'Unstructured or bounded model contribution; human review required.' : ''), reactivationCondition: text(v.reactivationCondition) || (rel === 'NO' ? 'Reactivate when the role jurisdiction becomes relevant.' : '') };
        var rr = recordRoleRelevance(state, reviewId, step.roleId, rel, d, Object.assign({}, meta, { delegated: true, actorKind: 'AI', provider: step.provider, model: step.model, recordId: 'rel-' + i + '-' + fingerprint(step.id) }));
        if (rr.ok) state = rr.state;
        if (rel !== 'NO') {
          var ar = recordRoleArtifact(state, reviewId, step.roleId, { artifact: text(v.artifact), claims: list(v.claims), contradictions: list(v.contradictions), failures: list(v.failures), veto: v.veto || { active: false }, nextTest: text(v.nextTest), provider: step.provider, model: step.model, cycle: step.cycle, automationRunId: runId, automationStepId: step.id }, Object.assign({}, meta, { delegated: true, actorKind: 'AI', provider: step.provider, model: step.model, recordId: 'art-' + i + '-' + fingerprint(step.id) }));
          if (ar.ok) state = ar.state;
        }
      });
      var syn = run.steps.filter(function (x) { return ['CYCLE_SYNTHESIS', 'PRODUCTIVITY_CLASSIFICATION', 'CLAIM_REVIEW', 'STANCE_REVIEW', 'SATURATION_DIAGNOSTIC'].indexOf(x.kind) >= 0 && x.status === 'COMPLETE'; });
      var summary = syn.map(function (x) { return x.output; }).join('\n\n');
      var reviewState = reviewRun(state, reviewId);
      reviewState.cycle = run.cycles;
      reviewState.cycleSyntheses = syn.map(function (x) { var p = parseModelJSON(x.output); return { cycle: x.cycle, stepId: x.id, provider: x.provider, model: x.model, output: p.ok ? p.value : null, raw: x.output }; });
      reviewState.stanceIntegrityHistory = reviewState.cycleSyntheses.map(function (x) { return { cycle: x.cycle, value: x.output && text(x.output.stanceIntegrity) || 'UNRECORDED' }; });
      var latestSynthesis = reviewState.cycleSyntheses.length ? reviewState.cycleSyntheses[reviewState.cycleSyntheses.length - 1].output : null;
      reviewState.proposedRevision = latestSynthesis ? text(latestSynthesis.proposedRevision) : '';
      var done = completeReview(state, reviewId, summary, Object.assign({}, meta, { actorKind: 'SYSTEM_DERIVED', recordId: 'review-checkpoint-' + fingerprint([runId, reviewId]) })); if (done.ok) state = done.state;
      var com = run.steps.filter(function (x) { return x.kind === 'CURATOR_COMMENTARY' && x.status === 'COMPLETE'; })[0];
      if (com) { var ac = addCommentary(state, { reviewId: reviewId, text: com.output, provider: com.provider, model: com.model }, Object.assign({}, meta, { delegated: true, actorKind: 'AI', provider: com.provider, model: com.model, recordId: 'commentary-' + fingerprint([runId, com.id]) })); if (ac.ok) state = ac.state; }
    }
    var result = commit(state, 'AUTOMATION_MATERIALIZED_AS_DRAFT', { runId: runId, candidateId: candidateId, reviewId: reviewId }, meta, function (s) {
      var r = automationRun(s, runId); r.status = 'MATERIALIZED_DRAFT'; r.materializedCandidateId = candidateId; r.materializedReviewId = reviewId;
      s.policy.activeLease = null; s.workflow.exactResumePoint = 'candidate:' + candidateId + ':human-review';
    });
    result.events = result.state.history.events.slice(firstNewEvent);
    return result;
  }

  function buildReport(state, includeCommentary, options) {
    options = options || {};
    var r = text(options.reviewId) ? state.lab.reviewRuns.filter(function (x) { return x.id === options.reviewId; })[0] || null : null;
    var candidateId = r ? r.candidateId : (text(options.candidateId) || state.discovery.activeCandidateId);
    var c = state.discovery.candidates.filter(function (x) { return x.id === candidateId; })[0] || null;
    var reviews = c ? state.lab.reviewRuns.filter(function (x) { return x.candidateId === c.id; }) : [];
    if (!r) r = reviews.length ? reviews[reviews.length - 1] : null;
    var automation = c && c.automationRunId ? automationRun(state, c.automationRunId) : null;
    var out = [
      'AXM DISCOVERY ENGINE × STANCE FORGE',
      'Experimental internal working packet — not canon, certification, or independent validation',
      '', 'SUBJECT', state.subject.statement || '(not framed)',
      'Question: ' + (state.subject.question || '(not framed)'),
      'Evidence profile: ' + state.subject.evidenceProfile,
      '', 'DISCOVERY COUNTS'
    ];
    STAGES.forEach(function (st) { out.push('- ' + st.label + ': ' + state.discovery[st.id].length); });
    if (automation) out.push('', 'AUTOMATION PROTOCOL', 'Protocol: ' + automation.protocol, 'Status: ' + automation.status, 'Reserved model calls used: ' + automation.callsUsed + '/' + automation.lease.maxCalls, 'Evidence gates recorded: ' + automation.evidence.length);
    out.push('', 'ACTIVE CANDIDATE');
    if (!c) out.push('(none frozen)');
    else out.push('Term: ' + c.term, 'Status: ' + c.status, 'Novelty: ' + c.noveltyStatus + (c.noveltyScope ? ' within ' + c.noveltyScope : ''), 'Summary: ' + c.summary, 'Mechanism: ' + c.mechanism, 'Soul/access gate: ' + c.soulGate.outcome, 'Minimal form: ' + (c.minimalForm || '(missing)'), 'Cheapest disconfirming check: ' + (c.cheapestDisconfirmingCheck || '(missing)'), 'Disconfirming outcome: ' + (c.disconfirmingOutcome || '(missing)'));
    out.push('', 'EXECUTED / IMPORTED EVIDENCE');
    var evidence = automation ? state.records.evidence.filter(function (x) { return x.runId === automation.id; }) : [];
    if (!evidence.length) out.push('- none recorded');
    else evidence.forEach(function (x) { out.push('- [' + x.claimLabel + '] ' + x.text + ' | source: ' + (x.source || '(none)') + (x.limitations.length ? ' | limits: ' + x.limitations.join('; ') : '')); });
    out.push('', 'INTERNAL REVIEW');
    if (!r) out.push('(not run)');
    else {
      out.push('Status: ' + r.status, 'Role pack: ' + r.packTitle, 'Independence: ' + r.independenceLabel, 'Unresolved vetoes: ' + r.unresolvedVetoes.length);
      r.seats.forEach(function (s) {
        out.push('- [' + s.relevance + '] ' + s.title + ' · artifacts ' + s.artifacts.length);
        s.artifacts.forEach(function (a, index) {
          out.push('  Artifact ' + (index + 1) + ' [' + a.status + '] · cycle ' + a.cycle + ' · ' + (a.provider || (a.actor && a.actor.kind) || 'unknown origin'));
          out.push('  ' + a.text);
          if (a.claims.length) a.claims.forEach(function (claim) { out.push('  Claim [' + claim.status + ']: ' + claim.text + (claim.evidenceRefs.length ? ' · refs ' + claim.evidenceRefs.join(', ') : '')); });
          if (a.contradictions.length) out.push('  Contradictions: ' + a.contradictions.join(' | '));
          if (a.failures.length) out.push('  Failures/counterexamples: ' + a.failures.join(' | '));
          if (a.nextTest) out.push('  Next test: ' + a.nextTest);
          if (a.veto && a.veto.active) out.push('  ACTIVE VETO: ' + a.veto.reason);
        });
      });
      out.push('', 'EVIDENCE CONTROLS');
      if (!r.controls.length) out.push('- none declared');
      else r.controls.forEach(function (c) {
        out.push('- [' + c.status + '] ' + c.title + (c.evidence ? ' · ' + c.evidence : ''));
        if (Array.isArray(c.history) && c.history.length > 1) c.history.forEach(function (revision, index) {
          out.push('  Revision ' + (index + 1) + ' [' + revision.status + '] ' + (revision.evidence || '(no evidence text)') + ' · ' + (revision.at || '(time unrecorded)'));
        });
      });
      if (r.summary) out.push('', 'REVIEW SYNTHESIS', r.summary);
    }
    if (includeCommentary) {
      var cs = state.records.commentary.filter(function (x) { return !r || x.reviewId === r.id; });
      if (cs.length) out.push('', 'CURIOUS LAB PARTNER — COMMENTARY, NOT EVIDENCE', cs.map(function (x) { return x.text; }).join('\n\n'));
    }
    out.push('', 'NO FAKE DONE', '- Generated or reviewed material remains experimental.', '- Model output is not evidence by itself.', '- Only a human merge gate can accept or promote this work.');
    return out.join('\n');
  }

  function exportBundle(state) { return { schema: 'axm.discovery-lab.bundle/0.1', exportedStateFingerprint: fingerprint(state), session: clone(state) }; }

  return {
    VERSION: '0.1.0', SCHEMA: SCHEMA, STAGES: STAGES, CLAIMS: CLAIMS, NOVELTY: NOVELTY, RELEVANCE: RELEVANCE,
    clone: clone, stable: stable, fingerprint: fingerprint, createSession: createSession, validate: validate, validatePackContract: validatePackContract,
    updateFrame: updateFrame, recordDiscovery: recordDiscovery, receiveProposal: receiveProposal, decideProposal: decideProposal,
    createCandidate: createCandidate, parseExecutors: parseExecutors, planAutomation: planAutomation,
    buildAssistedPrompt: buildAssistedPrompt, buildReviewRolePrompt: buildReviewRolePrompt,
    nextAutomationRequest: nextAutomationRequest, dispatchAutomationRequest: dispatchAutomationRequest, recordAutomationEvidence: recordAutomationEvidence, recordAutomationResponse: recordAutomationResponse,
    pauseAutomation: function (s, id, reason, meta) { return setAutomationStatus(s, id, 'PAUSED', reason, meta); },
    resumeAutomation: function (s, id, meta) { return setAutomationStatus(s, id, 'RUNNING', '', meta); },
    cancelAutomation: function (s, id, reason, meta) { return setAutomationStatus(s, id, 'CANCELLED', reason, meta); },
    extendAutomationLease: extendAutomationLease,
    parseModelJSON: parseModelJSON, materializeAutomation: materializeAutomation,
    startReview: startReview, recordRoleRelevance: recordRoleRelevance, recordRoleArtifact: recordRoleArtifact,
    recordControlResult: recordControlResult, completeReview: completeReview, addCommentary: addCommentary, buildReport: buildReport, exportBundle: exportBundle
  };
});
