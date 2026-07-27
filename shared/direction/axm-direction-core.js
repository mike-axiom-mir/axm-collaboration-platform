(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AXMDirectionCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '0.2.0';
  var REQUEST_SCHEMA = 'axm.workshop-direction.request/v1';
  var PLAN_SCHEMA = 'axm.workshop-direction.plan/v1';
  var HAND_REQUEST_SCHEMA = 'axm.workshop-direction.hand-request/v1';
  var STATE_SCHEMA = 'axm.workshop-direction.state/v1';
  var QUALITIES = ['DRAFT', 'GOOD', 'HIGH'];
  var STATUSES = ['OPEN', 'PAUSED', 'DONE', 'CANCELLED'];

  var RULES = [
    { id: 'written-copy', label: 'Quotes and short copy', words: ['quote','quotes','slogan','slogans','motto','mottos','tagline','taglines','caption','captions','copywriting','inspiring','inspirational'], moduleId: 'copy-composer-hand', action: 'Compose a bounded deterministic short-copy candidate', outputs: ['axm.copy.candidate/v1','axm.copy.receipt/v1'], exams: ['requested-subject','bounded-length','deterministic-replay','candidate-only-authority'] },
    { id: 'visual-assets', label: 'Reusable visual assets', words: ['asset','assets','icon','icons','sprite','sprites','badge','badges','texture','textures','tile','tiles','skin','skins','pack'], moduleId: 'asset-fabric', action: 'Generate a requirement-driven visual family', outputs: ['axm.asset-fabric.candidate/v1'], exams: ['technical-integrity','declared-dimensions','visual-family-diversity'] },
    { id: 'studio-design', label: 'Creative design', words: ['image','images','picture','pictures','poster','graphic','graphics','drawing','draw','paint','photo','ui','ux','interface','website','logo','design'], moduleId: 'studio', action: 'Create or edit the requested visual design', outputs: ['axm.studio-project/v2','image/png'], exams: ['canvas-integrity','requested-format','visual-review'] },
    { id: 'game-build', label: 'Game development', words: ['game','games','gameplay','level','levels','npc','quest','multiplayer','controller','playtest','hud'], moduleId: 'game-forge', action: 'Build and verify the requested game feature', outputs: ['axm.game-forge-project/v1'], exams: ['runtime-starts','input-contract','playtest-receipt'] },
    { id: 'living-world', label: 'Living world evolution', words: ['globe','ecology','species','ecosystem','evolution','evolve','lineage','genome','habitat'], moduleId: 'governed-evolution-lab', action: 'Run a disposable world challenger and held-out ecology exam', outputs: ['axm.governed-evolution.receipt/v1'], exams: ['held-out-ecology-exam','lineage-receipt','rollback-available'] },
    { id: 'software-hand', label: 'Software and adapters', words: ['code','software','app','module','plugin','adapter','api','script','program','tool','tools','integration'], moduleId: 'agent-tool-forge', action: 'Draft the required modular software or callable hand', outputs: ['axm.software-proposal/v1'], exams: ['syntax-check','declared-contract','focused-tests','seam-review'] },
    { id: 'research-data', label: 'Research and structured knowledge', words: ['research','data','spreadsheet','chart','diagram','map','evidence','source','sources','citation','finance','statistics','metrics'], moduleId: 'knowledge-canvas', action: 'Build a sourced research or data workspace', outputs: ['axm.knowledge-canvas-project/v1'], exams: ['source-coverage','claim-traceability','calculation-check'] },
    { id: 'audio', label: 'Audio production', words: ['audio','music','song','sound','voice','foley','midi','score','synth'], moduleId: 'audio-studio', action: 'Create and verify the requested audio work', outputs: ['axm.audio-project/v1'], exams: ['audible-output','peak-check','format-check'] },
    { id: 'film-motion', label: 'Film and motion', words: ['film','movie','video','animation','animate','motion','storyboard','vfx'], moduleId: 'film-motion-studio', action: 'Create and review the requested time-based visual work', outputs: ['axm.film-motion-project/v1'], exams: ['timeline-integrity','playback-check','review-receipt'] },
    { id: 'publish', label: 'Packaging and release', words: ['publish','export','package','release','backup','library','distribution'], moduleId: 'publish-library', action: 'Prepare a reviewable package or export', outputs: ['axm.release-candidate/v1'], exams: ['package-manifest','public-safe-scan','explicit-release-gate'] },
    { id: 'project-direction', label: 'Project planning', words: ['project','plan','roadmap','milestone','task','tasks','decision','schedule'], moduleId: 'project-room', action: 'Turn the direction into a recoverable project plan', outputs: ['axm.project-room/v2'], exams: ['owner-visible','next-step-visible','recovery-record'] }
  ];

  var AUTOMATED_HANDS = {
    'copy-composer-hand': { handId: 'copy-composer', contract: 'axm.copy.request/v1', authority: 'candidate-text-only' },
    'asset-fabric': { handId: 'asset-fabric-heartbeat', contract: 'axm.asset-fabric.heartbeat/v1', authority: 'incubator-candidate-only' },
    'governed-evolution-lab': { handId: 'living-world-heartbeat', contract: 'axm.governed-evolution.heartbeat/v1', authority: 'disposable-lineage-only' }
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function text(value, max) { return String(value == null ? '' : value).trim().slice(0, max || 300); }
  function clean(value) { return text(value, 5000).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function tokens(value) { var seen = {}; return clean(value).split(/\s+/).filter(function (word) { return word && !seen[word] && (seen[word] = true); }); }
  function clamp(value, fallback, min, max) { var number = Number(value); if (!Number.isFinite(number)) number = fallback; return Math.max(min, Math.min(max, number)); }
  function stamp(now) { return new Date(now == null ? Date.now() : now).toISOString(); }
  function hash(value) { var result = 2166136261, input = String(value || ''); for (var i = 0; i < input.length; i += 1) { result ^= input.charCodeAt(i); result = Math.imul(result, 16777619); } return (result >>> 0).toString(36); }
  function slug(value) { return clean(value).split(' ').slice(0, 5).join('-').slice(0, 60) || 'direction'; }
  function installedMap(modules) { var out = {}; (Array.isArray(modules) ? modules : []).forEach(function (module) { if (module && module.id) out[String(module.id)] = module; }); return out; }

  function normalizeRequest(input, now) {
    input = input || {};
    var description = text(input.description || input.goal || input.title, 3000);
    if (!description) throw new Error('direction description required');
    var title = text(input.title || description.split(/[.!?\n]/)[0], 180) || 'Untitled direction';
    var actor = input.actor || {};
    var createdAt = text(input.createdAt, 40) || stamp(now);
    return {
      schema: REQUEST_SCHEMA,
      requestId: text(input.requestId, 120) || ('direction-' + slug(title) + '-' + hash(title + ':' + description + ':' + createdAt)),
      title: title,
      description: description,
      quality: QUALITIES.indexOf(String(input.quality || '').toUpperCase()) >= 0 ? String(input.quality).toUpperCase() : 'GOOD',
      priority: Math.round(clamp(input.priority, 60, 0, 100)),
      maxPulsesPerRoute: Math.round(clamp(input.maxPulsesPerRoute, 2, 1, 8)),
      reviewSeats: Math.round(clamp(input.reviewSeats, 2, 1, 10)),
      actor: { id: text(actor.id || input.actorId || 'local-steward', 100), kind: text(actor.kind || input.actorKind || 'unknown', 40), name: text(actor.name || input.actorName || actor.id || input.actorId || 'Local steward', 120) },
      status: STATUSES.indexOf(input.status) >= 0 ? input.status : 'OPEN',
      createdAt: createdAt
    };
  }

  function qualityExams(base, quality) {
    var exams = base.slice();
    if (quality === 'GOOD') exams.push('module-receipt','steward-review');
    if (quality === 'HIGH') exams.push('module-receipt','independent-perspective-review','provenance-record','rollback-or-source-preserved');
    return Array.from(new Set(exams));
  }

  function matchRules(description) {
    var words = tokens(description);
    var matched = RULES.map(function (rule) {
      var hits = rule.words.filter(function (word) { return words.indexOf(word) >= 0; });
      return { rule: rule, hits: hits, score: hits.length };
    }).filter(function (result) { return result.score > 0; }).sort(function (a, b) { return b.score - a.score || a.rule.id.localeCompare(b.rule.id); });
    if (!matched.length) matched.push({ rule: RULES[RULES.length - 1], hits: [], score: 0 });
    return matched.slice(0, 8);
  }

  function handRequest(request, route, moduleInstalled) {
    var missingModule = !moduleInstalled;
    var target = route.moduleId;
    return {
      schema: HAND_REQUEST_SCHEMA,
      handRequestId: 'hand-' + hash(request.requestId + ':' + route.routeId),
      directionId: request.requestId,
      routeId: route.routeId,
      kind: missingModule ? 'CAPABILITY_MODULE' : 'AUTOMATION_ADAPTER',
      targetModuleId: target,
      title: missingModule ? ('Build the missing ' + target + ' capability') : ('Give ' + target + ' a bounded callable hand'),
      reason: missingModule ? 'No installed module declares this required capability.' : 'The capability exists for interactive use, but it has no Body Pulse execution adapter.',
      desiredContract: 'axm.direction-hand/' + target + '/v1',
      accepts: ['axm.direction-task/v1'],
      produces: ['axm.direction-result/v1','axm.evidence-packet/v1'],
      acceptance: ['accept one explicit bounded task','honour maxPulsesPerRoute','return evidence against every declared quality exam','grant no promotion or release authority','stop or hold honestly when the exam cannot be met'],
      suggestedBuilder: moduleInstalled ? 'agent-tool-forge' : 'forge',
      status: 'OPEN'
    };
  }

  function compile(input, modules, now) {
    var request = normalizeRequest(input, now);
    var installed = installedMap(modules);
    var matched = matchRules(request.title + ' ' + request.description);
    var handRequests = [];
    var routes = matched.map(function (match, index) {
      var rule = match.rule;
      var moduleInstalled = !!installed[rule.moduleId];
      var automated = moduleInstalled && AUTOMATED_HANDS[rule.moduleId];
      var route = {
        schema: 'axm.workshop-direction.route/v1',
        routeId: 'route-' + (index + 1) + '-' + rule.id,
        directionId: request.requestId,
        capabilityId: rule.id,
        capability: rule.label,
        moduleId: rule.moduleId,
        moduleName: moduleInstalled ? text(installed[rule.moduleId].name || rule.moduleId, 140) : rule.moduleId,
        route: moduleInstalled ? '/tools/' + text(installed[rule.moduleId].folder || rule.moduleId, 120) + '/' + text(installed[rule.moduleId].entry || 'index.html', 120) : null,
        action: rule.action,
        matchedTerms: match.hits,
        outputs: rule.outputs.slice(),
        qualityExams: qualityExams(rule.exams, request.quality),
        execution: automated ? { mode: 'BODY_PULSE', handStatus: 'READY', handId: automated.handId, contract: automated.contract, authority: automated.authority } : moduleInstalled ? { mode: 'INTERACTIVE', handStatus: 'OPERATOR_REQUIRED', handId: null, contract: null, authority: 'workspace-local-only' } : { mode: 'UNAVAILABLE', handStatus: 'MISSING', handId: null, contract: null, authority: 'NONE' },
        bodyGoal: automated ? { moduleId: rule.moduleId, title: request.title + ' · ' + rule.label, priority: request.priority, maxPulses: request.maxPulsesPerRoute, requiresReview: true } : null,
        status: automated ? 'AUTOMATABLE_CANDIDATE_ONLY' : moduleInstalled ? 'WAITING_FOR_OPERATOR_OR_HAND' : 'HELD_MISSING_CAPABILITY'
      };
      if (!automated) handRequests.push(handRequest(request, route, moduleInstalled));
      return route;
    });
    var automatable = routes.filter(function (route) { return route.execution.mode === 'BODY_PULSE'; }).length;
    var verdict = automatable === routes.length ? 'READY_BOUNDED' : automatable > 0 ? 'PARTIAL_HANDS_REQUIRED' : 'HELD_HANDS_REQUIRED';
    return {
      schema: PLAN_SCHEMA,
      version: VERSION,
      request: request,
      verdict: verdict,
      summary: automatable + ' of ' + routes.length + ' route(s) have bounded automatic hands; ' + handRequests.length + ' hand request(s) remain.',
      routes: routes,
      handRequests: handRequests,
      limits: { maxRoutes: 8, maxPulsesPerRoute: request.maxPulsesPerRoute, maxReviewSeats: 10, requestedReviewSeats: request.reviewSeats, promotionAuthority: 'NONE', releaseAuthority: 'NONE', bodyModeChanged: false },
      trace: { method: 'DETERMINISTIC_CAPABILITY_MATCH', reasoningCompute: 'NONE', matchedDomains: matched.map(function (item) { return { id: item.rule.id, terms: item.hits }; }), capabilityCatalogVersion: 'runtime' },
      createdAt: stamp(now)
    };
  }

  function createState() { return { schema: STATE_SCHEMA, version: VERSION, directions: {}, events: [] }; }
  function normalizeState(raw) { var state = raw && raw.schema === STATE_SCHEMA ? clone(raw) : createState(); state.version = VERSION; state.directions = state.directions && typeof state.directions === 'object' ? state.directions : {}; state.events = Array.isArray(state.events) ? state.events.slice(-500) : []; return state; }
  function storePlan(rawState, plan, now) { var state = normalizeState(rawState); if (!plan || plan.schema !== PLAN_SCHEMA) throw new Error('compiled direction plan required'); var stored = clone(plan); stored.committedAt = stamp(now); stored.status = stored.request.status; state.directions[stored.request.requestId] = stored; state.events.push({ at: stamp(now), kind: 'direction-committed', directionId: stored.request.requestId, verdict: stored.verdict }); state.events = state.events.slice(-500); return state; }
  function setDirectionStatus(rawState, directionId, status, actorId, now) { if (STATUSES.indexOf(status) < 0) throw new Error('unknown direction status'); var state = normalizeState(rawState); var direction = state.directions[text(directionId, 120)]; if (!direction) throw new Error('direction not found'); direction.status = status; direction.statusChangedAt = stamp(now); direction.statusChangedBy = text(actorId || 'unknown', 100); state.events.push({ at: stamp(now), kind: 'direction-status', directionId: direction.request.requestId, status: status, actorId: direction.statusChangedBy }); state.events = state.events.slice(-500); return state; }
  function publicState(rawState) { var state = normalizeState(rawState); return { schema: 'axm.workshop-direction.status/v1', version: VERSION, directions: Object.keys(state.directions).map(function (key) { return clone(state.directions[key]); }).sort(function (a, b) { return Date.parse(b.committedAt) - Date.parse(a.committedAt); }), recentEvents: clone(state.events.slice(-50)), truth: 'Direction compiles goals into bounded routes. It grants no tool, file, network, promotion, release, or real-world authority.' }; }

  return { VERSION: VERSION, REQUEST_SCHEMA: REQUEST_SCHEMA, PLAN_SCHEMA: PLAN_SCHEMA, HAND_REQUEST_SCHEMA: HAND_REQUEST_SCHEMA, STATE_SCHEMA: STATE_SCHEMA, QUALITIES: QUALITIES.slice(), STATUSES: STATUSES.slice(), RULES: clone(RULES), AUTOMATED_HANDS: clone(AUTOMATED_HANDS), normalizeRequest: normalizeRequest, matchRules: matchRules, compile: compile, createState: createState, normalizeState: normalizeState, storePlan: storePlan, setDirectionStatus: setDirectionStatus, publicState: publicState };
});
