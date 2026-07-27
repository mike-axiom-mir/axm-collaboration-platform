'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ContractVerifier = require('../../hub/module-contract-verifier');

const SCHEMA = 'axm.technical-glasses/v1';
const VERSION = '0.2.0';
const READINESS_VIEW_SCHEMA = 'axm.workshop-readiness-view/v1';
const SOURCE_EXTENSIONS = new Set(['.js', '.json', '.html', '.css', '.md', '.txt', '.bat', '.ps1']);
const SOURCE_ROOTS = ['tools', 'shared', 'hub', 'worlds', 'tests', 'prompts'];
const SKIP_DIRS = new Set(['node_modules', 'exports', 'logs', 'state', '.git']);
const SEVERITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, INFO: 3 };

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { return fallback; }
}

function safeStat(file) {
  try { return fs.statSync(file); }
  catch (error) { return null; }
}

function relative(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function walk(root, start, output) {
  const absolute = path.join(root, start);
  let entries = [];
  try { entries = fs.readdirSync(absolute, { withFileTypes: true }); }
  catch (error) { return output; }
  entries.forEach(entry => {
    if (entry.name.startsWith('.') && entry.name !== '.github') return;
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) return;
    const child = path.join(absolute, entry.name);
    const childRelative = relative(root, child);
    if (entry.isDirectory()) walk(root, childRelative, output);
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      const stat = safeStat(child);
      if (stat) output.push({ path: childRelative, bytes: stat.size, modifiedMs: Math.floor(stat.mtimeMs) });
    }
  });
  return output;
}

function sourceInventory(root) {
  const files = [];
  SOURCE_ROOTS.forEach(folder => walk(root, folder, files));
  ['server.js', 'package.json', 'verify.js', 'verify.config.json', 'README.md', 'AI_START_HERE.md'].forEach(name => {
    const file = path.join(root, name), stat = safeStat(file);
    if (stat) files.push({ path: name, bytes: stat.size, modifiedMs: Math.floor(stat.mtimeMs) });
  });
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

function fingerprint(root, files) {
  const hash = crypto.createHash('sha256');
  files.forEach(file => hash.update(file.path + ':' + file.bytes + ':' + file.modifiedMs + '\n'));
  const controlFiles = files.filter(file => /(^|\/)(manifest|module\.contract)\.json$/.test(file.path) || [
    'server.js', 'package.json', 'verify.js', 'verify.config.json',
    'shared/capabilities/capability-metadata.json',
    'shared/capabilities/readiness-guidance.json'
  ].includes(file.path));
  controlFiles.forEach(file => {
    try { hash.update(fs.readFileSync(path.join(root, file.path))); }
    catch (error) { hash.update('UNREADABLE:' + file.path); }
  });
  return hash.digest('hex');
}

function issue(severity, code, moduleId, message, evidence, next) {
  return { severity, code, moduleId: moduleId || null, message, evidence: evidence || null, next: next || null };
}

function normalizeStructuralReadiness(value) {
  const fallback = {
    schema: READINESS_VIEW_SCHEMA,
    state: 'UNAVAILABLE',
    source: null,
    generatedAt: null,
    sourceDigest: null,
    summary: null,
    reviewCandidates: [],
    reason: 'No shared structural-readiness observation was supplied.',
    errors: [],
    truth: {
      automaticPromotion: false,
      structuralEligibilityIsRuntimeProof: false,
      selftestPassIsHumanApproval: false,
      capabilityCatalogGrantsAuthority: false,
      missingValuesRemainVisible: true
    },
    authority: {
      humanPromotionRequired: true,
      humanGate: 'explicit human steward',
      reviewCandidateMeans: 'Current structural and self-test evidence is available for human review.',
      reviewCandidateDoesNotMean: ['approved', 'promoted', 'CANON', 'need-satisfied']
    }
  };
  if (!value || value.schema !== READINESS_VIEW_SCHEMA || typeof value.state !== 'string') return fallback;
  return Object.assign({}, fallback, value, {
    reviewCandidates: Array.isArray(value.reviewCandidates) ? value.reviewCandidates : [],
    truth: Object.assign({}, fallback.truth, value.truth || {}),
    authority: Object.assign({}, fallback.authority, value.authority || {})
  });
}

function moduleRecords(root, tools, readiness) {
  const byId = new Map((tools || []).map(tool => [tool.id, tool]));
  const contractReport = ContractVerifier.verifyDeclaredContracts(root);
  const contracts = new Map(contractReport.results.map(record => [record.id, record]));
  const priorities = [];
  const modules = (tools || []).map(tool => {
    const folder = tool.folder || tool.id;
    const manifestPath = path.join(root, 'tools', folder, 'manifest.json');
    const manifest = readJson(manifestPath, {});
    const entry = path.join(root, 'tools', folder, tool.entry || 'index.html');
    const entryExists = !!safeStat(entry);
    const parentExists = !tool.integratedInto || byId.has(tool.integratedInto);
    const contract = contracts.get(tool.id) || null;
    const declaredContract = !!manifest.contract;
    const selftest = !!safeStat(path.join(root, 'tools', folder, 'selftest.js'));
    const discoveryReview = !!safeStat(path.join(root, 'tools', folder, 'discovery-seam-review.js'));
    const readme = !!safeStat(path.join(root, 'tools', folder, 'README.md'));
    const dependencies = (tool.readiness || []).map(id => Object.assign({ id }, readiness[id] || { state: 'UNKNOWN', detail: 'No live readiness source declared' }));
    const unavailable = dependencies.filter(item => ['OFFLINE', 'TRIPPED'].includes(String(item.state).toUpperCase()));
    const unknown = dependencies.filter(item => String(item.state).toUpperCase() === 'UNKNOWN');

    if (tool.status === 'BROKEN') priorities.push(issue('CRITICAL', 'MODULE_BROKEN', tool.id, tool.name + ' is declared BROKEN.', 'tools/' + folder + '/manifest.json', 'Inspect the manifest error before routing work here.'));
    if (!entryExists) priorities.push(issue('CRITICAL', 'ENTRY_MISSING', tool.id, 'Declared entry file is missing.', relative(root, entry), 'Repair the entry route or manifest declaration.'));
    if (!parentExists) priorities.push(issue('CRITICAL', 'PARENT_MISSING', tool.id, 'Integrated parent ' + tool.integratedInto + ' is not registered.', 'tools/' + folder + '/manifest.json', 'Restore the parent or remove the stale ownership declaration.'));
    if (declaredContract && contract && !contract.pass) priorities.push(issue('HIGH', 'CONTRACT_INVALID', tool.id, contract.errors.join('; '), contract.path || ('tools/' + folder + '/' + manifest.contract), 'Repair the contract before treating its capability or boundary as authority.'));
    if (declaredContract && !contract) priorities.push(issue('HIGH', 'CONTRACT_UNREADABLE', tool.id, 'Declared contract could not be inspected.', 'tools/' + folder + '/' + manifest.contract, 'Repair or remove the declaration.'));
    if (unavailable.length) priorities.push(issue('HIGH', 'READINESS_UNAVAILABLE', tool.id, unavailable.map(item => item.id + '=' + item.state).join(', '), unavailable.map(item => item.detail).join(' | '), 'Treat capability as present but not currently ready.'));
    if (unknown.length) priorities.push(issue('MEDIUM', 'READINESS_UNKNOWN', tool.id, unknown.map(item => item.id).join(', ') + ' lack live probes.', unknown.map(item => item.detail).join(' | '), 'Inspect the target service before acting; UNKNOWN is not OFFLINE and not READY.'));
    if (!declaredContract) priorities.push(issue('MEDIUM', 'CONTRACT_NOT_DECLARED', tool.id, 'No versioned module contract is declared.', 'tools/' + folder + '/manifest.json', 'Use the manifest as limited evidence; do not invent permissions or handoffs.'));
    if (!(tool.actions || []).length) priorities.push(issue('MEDIUM', 'ACTIONS_UNAUTHORED', tool.id, 'Plain action vocabulary is absent.', 'shared/capabilities/capability-metadata.json', 'Use inferred routing only and verify the destination manually.'));

    return {
      id: tool.id,
      name: tool.name,
      version: tool.version,
      status: tool.status,
      route: '/tools/' + folder + '/' + (tool.entry || 'index.html'),
      integratedInto: tool.integratedInto || null,
      audience: tool.audience,
      risk: tool.risk || null,
      summary: tool.summary || '',
      actions: tool.actions || [],
      accepts: tool.accepts || [],
      produces: tool.produces || [],
      readiness: dependencies,
      evidence: {
        manifest: 'tools/' + folder + '/manifest.json',
        contract: declaredContract ? 'tools/' + folder + '/' + manifest.contract : null,
        entry: relative(root, entry),
        entryExists,
        contractDeclared: declaredContract,
        contractPass: contract ? contract.pass : null,
        selftest,
        discoveryReview,
        readme
      }
    };
  });

  priorities.sort((a, b) => (SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]) || String(a.moduleId).localeCompare(String(b.moduleId)) || a.code.localeCompare(b.code));
  return { modules, priorities, contractReport };
}

function activeState(root) {
  const directions = readJson(path.join(root, 'state', 'workshop-direction', 'directions.json'), { directions: {} });
  const pulse = readJson(path.join(root, 'state', 'body-pulse', 'pulse.json'), null);
  const evidenceRoot = path.join(root, 'state', 'evidence-retention'), telemetry = readJson(path.join(evidenceRoot, 'telemetry-rollups.json'), { buckets:{} }), legacy = readJson(path.join(evidenceRoot, 'legacy-sources.json'), { sources:{} });
  const openDir = path.join(evidenceRoot, 'sessions', 'open'), sealedDir = path.join(evidenceRoot, 'sessions', 'sealed');
  let openSessions = 0, sealedSessions = 0, sealedEvents = 0;
  try { openSessions = fs.readdirSync(openDir).filter(name => name.endsWith('.jsonl')).length; } catch (error) {}
  try { fs.readdirSync(sealedDir, { withFileTypes:true }).filter(entry => entry.isDirectory()).forEach(month => fs.readdirSync(path.join(sealedDir, month.name)).filter(name => name.endsWith('.manifest.json')).forEach(name => { const item = readJson(path.join(sealedDir, month.name, name), null); if (item) { sealedSessions++; sealedEvents += Number(item.events || 0); } })); } catch (error) {}
  const telemetryBuckets = Object.values(telemetry.buckets || {});
  const directionList = Object.values(directions.directions || {}).filter(item => item && !['COMPLETED', 'ARCHIVED', 'DELETED'].includes(String(item.status || '').toUpperCase())).map(item => ({
    id: item.id || null,
    title: item.title || item.goal || 'Untitled direction',
    status: item.status || 'UNKNOWN',
    updatedAt: item.updatedAt || item.createdAt || null
  }));
  return {
    directions: directionList,
    evidence: { state: fs.existsSync(evidenceRoot) ? 'ACTIVE' : 'NOT_INITIALIZED', openSessions, sealedSessions, sealedEvents, legacySources:Object.keys(legacy.sources || {}).length, telemetryBuckets:telemetryBuckets.length, telemetryObservations:telemetryBuckets.reduce((sum, item) => sum + Number(item.count || 0), 0), policy:'state/evidence-retention/POLICY.json', exactEventsCompacted:false, mirrorJournalMigrated:false },
    body: pulse ? {
      mode: pulse.mode || 'UNKNOWN',
      pressure: pulse.body && pulse.body.pressure || 'UNKNOWN',
      sampledAt: pulse.body && pulse.body.sampledAt || null,
      thermalC: pulse.body && pulse.body.thermalC != null ? pulse.body.thermalC : null,
      memoryUsedRatio: pulse.body && pulse.body.memoryUsedRatio != null ? pulse.body.memoryUsedRatio : null,
      activeLeases: Array.isArray(pulse.leases) ? pulse.leases.filter(lease => String(lease.status || '').toUpperCase() === 'ACTIVE').length : 0,
      enabledModules: Object.values(pulse.modules || {}).filter(module => module && module.enabled).map(module => module.moduleId)
    } : { mode: 'UNKNOWN', pressure: 'UNKNOWN', sampledAt: null, thermalC: null, memoryUsedRatio: null, activeLeases: 0, enabledModules: [] }
  };
}

function docFreshness(root, latestSourceMs) {
  return ['README.md', 'AI_START_HERE.md'].map(name => {
    const stat = safeStat(path.join(root, name));
    if (!stat) return { path: name, state: 'MISSING', technicalAuthority: false, modifiedAt: null };
    return {
      path: name,
      state: latestSourceMs > stat.mtimeMs + 1000 ? 'OLDER_THAN_SOURCE' : 'CURRENT_WITH_SOURCE_CLOCK',
      technicalAuthority: false,
      modifiedAt: new Date(stat.mtimeMs).toISOString()
    };
  });
}

function toBriefing(snapshot) {
  const structural = snapshot.structuralReadiness;
  const lines = [
    'AXM TECHNICAL GLASSES ' + snapshot.version,
    'Compiled live: ' + snapshot.compiledAt,
    'Ground-truth fingerprint: ' + snapshot.freshness.fingerprint.slice(0, 16),
    'Focus: ' + (snapshot.focus.query || 'whole Workshop'),
    '',
    'READ THIS AS TECHNICAL EVIDENCE, NOT AS AUTHORITY TO ACT.',
    'Never guess a missing state. Use UNKNOWN and name the cheapest check.',
    'README files are narrative context; manifests, contracts, live readiness and tests outrank them.',
    '',
    'CURRENT BODY',
    'mode=' + snapshot.active.body.mode + ' pressure=' + snapshot.active.body.pressure + ' thermalC=' + (snapshot.active.body.thermalC == null ? 'UNKNOWN' : snapshot.active.body.thermalC) + ' activeLeases=' + snapshot.active.body.activeLeases,
    'evidence=' + snapshot.active.evidence.state + ' sealedSessions=' + snapshot.active.evidence.sealedSessions + ' sealedEvents=' + snapshot.active.evidence.sealedEvents + ' telemetryObservations=' + snapshot.active.evidence.telemetryObservations,
    '',
    'WORKSHOP',
    'modules=' + snapshot.counts.modules + ' broken=' + snapshot.counts.broken + ' contracts=' + snapshot.counts.contractsPassing + '/' + snapshot.counts.contractsDeclared + ' priorities=' + snapshot.counts.priorities,
    '',
    'STRUCTURAL REVIEW EVIDENCE',
    'state=' + structural.state + ' reviewCandidates=' + snapshot.counts.reviewCandidates + ' legacyKinds=' + (snapshot.counts.legacyKinds == null ? 'UNKNOWN' : snapshot.counts.legacyKinds),
    'meaning=' + structural.authority.reviewCandidateMeans,
    'boundary=review candidate is not approval, promotion, CANON, runtime proof or a satisfied need.',
    '',
    'FOCUS ROUTES'
  ];
  if (!snapshot.focus.routes.length) lines.push('- none requested; inspect a specific goal before choosing a module');
  snapshot.focus.routes.forEach(route => lines.push('- ' + route.destinationId + ' | ' + route.destinationName + ' | score=' + route.score + ' | ' + route.route));
  lines.push('', 'IMPORTANT OPEN TECHNICAL SEAMS');
  if (!snapshot.priorities.length) lines.push('- none detected by this structural scan; runtime behavior still requires tests');
  snapshot.priorities.slice(0, 18).forEach(item => lines.push('- [' + item.severity + '] ' + (item.moduleId || 'workshop') + ' ' + item.code + ': ' + item.message + ' | evidence=' + (item.evidence || 'none')));
  lines.push('', 'READING ORDER');
  snapshot.readingOrder.forEach((item, index) => lines.push((index + 1) + '. ' + item));
  lines.push('', 'BOUNDARY: observation only; automaticAction=false permissionChange=false canonChange=false.');
  return lines.join('\n') + '\n';
}

function compile(options) {
  options = options || {};
  const root = path.resolve(options.root || path.join(__dirname, '..', '..'));
  const tools = Array.isArray(options.tools) ? options.tools : [];
  const readiness = options.readiness && typeof options.readiness === 'object' ? options.readiness : {};
  const structuralReadiness = normalizeStructuralReadiness(options.structuralReadiness);
  const files = sourceInventory(root);
  const latestSourceMs = files.reduce((max, file) => Math.max(max, file.modifiedMs), 0);
  const records = moduleRecords(root, tools, readiness);
  const focusRoutes = [];
  const seenDestinations = new Set();
  (Array.isArray(options.focusRoutes) ? options.focusRoutes : []).forEach(route => {
    if (focusRoutes.length >= 8 || seenDestinations.has(route.destinationId)) return;
    seenDestinations.add(route.destinationId);
    focusRoutes.push({
      id: route.id,
      destinationId: route.destinationId,
      destinationName: route.destinationName,
      route: route.route,
      score: route.score,
      matched: route.matched || [],
      inferred: route.inferred || []
    });
  });
  const compiledAt = new Date(options.now || Date.now()).toISOString();
  const sourceFingerprint = fingerprint(root, files);
  const focusedIds = new Set(focusRoutes.reduce((all, route) => all.concat([route.id, route.destinationId]), []));
  const structuralPriority = structuralReadiness.state === 'CURRENT' ? [] : [issue(
    ['STALE', 'INVALID'].includes(structuralReadiness.state) ? 'HIGH' : 'MEDIUM',
    'STRUCTURAL_READINESS_' + structuralReadiness.state,
    'workshop',
    structuralReadiness.reason || 'Shared structural-readiness evidence is not current.',
    structuralReadiness.source || 'shared/readiness/readiness-observer.js',
    'Refresh or repair the deterministic tools index before using its human-review queue.'
  )];
  const priorities = records.priorities.concat(structuralPriority).sort((a, b) => {
    const severity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (severity) return severity;
    const focusRank = Number(focusedIds.has(b.moduleId)) - Number(focusedIds.has(a.moduleId));
    if (focusRank) return focusRank;
    return String(a.moduleId).localeCompare(String(b.moduleId)) || a.code.localeCompare(b.code);
  });
  const snapshot = {
    ok: true,
    schema: SCHEMA,
    version: VERSION,
    compiledAt,
    freshness: {
      mode: 'COMPILED_FROM_CURRENT_LOCAL_SOURCE',
      generatedFromLiveScan: true,
      autoRefreshContract: 'recompile-on-every-request-or-cli-run',
      fingerprint: sourceFingerprint,
      sourceFiles: files.length,
      latestSourceModifiedAt: latestSourceMs ? new Date(latestSourceMs).toISOString() : null,
      narrativeDocs: docFreshness(root, latestSourceMs)
    },
    focus: { query: String(options.focus || '').trim().slice(0, 240), routes: focusRoutes },
    counts: {
      modules: records.modules.length,
      broken: records.modules.filter(module => module.status === 'BROKEN').length,
      contractsDeclared: records.modules.filter(module => module.evidence.contractDeclared).length,
      contractsPassing: records.modules.filter(module => module.evidence.contractPass === true).length,
      readinessIndexState: structuralReadiness.state,
      reviewCandidates: structuralReadiness.state === 'CURRENT' ? structuralReadiness.reviewCandidates.length : 0,
      legacyKinds: structuralReadiness.state === 'CURRENT' && structuralReadiness.summary ? structuralReadiness.summary.legacyKinds : null,
      priorities: priorities.length,
      critical: priorities.filter(item => item.severity === 'CRITICAL').length,
      high: priorities.filter(item => item.severity === 'HIGH').length
    },
    active: activeState(root),
    structuralReadiness,
    priorities,
    modules: records.modules,
    recentSources: files.slice().sort((a, b) => b.modifiedMs - a.modifiedMs).slice(0, 24).map(file => ({ path: file.path, modifiedAt: new Date(file.modifiedMs).toISOString(), bytes: file.bytes })),
    authority: {
      technicalOrder: ['current deterministic tools index', 'live readiness', 'executable tests and receipts', 'module contracts', 'module manifests', 'implementation source', 'generated Technical Glasses snapshot', 'README narrative'],
      readmeTechnicalAuthority: false,
      chatMemoryTechnicalAuthority: false,
      missingMeansUnknown: true,
      noGuessing: true
    },
    readingOrder: [
      'This live Technical Glasses result and its fingerprint.',
      'The Evidence Retention policy, sealed session manifests and machine-readable rollups.',
      'The target module manifest and module.contract.json.',
      'Live readiness for every declared dependency.',
      'Focused selftests, discovery seam review and preserved failure receipts.',
      'Implementation source only where the contract or test leaves a question.',
      'README narrative last; verify its freshness before relying on it.'
    ],
    instructionsForAnyAI: [
      'State OBSERVED, INFERRED and UNKNOWN separately.',
      'Cite local evidence paths for every important technical claim.',
      'Do not infer permissions, readiness, completion or quality from a module name.',
      'If a source conflicts, follow authority.technicalOrder and preserve the conflict.',
      'Recompile the glasses after edits before handing work to another instance.',
      'Read repeated telemetry as a counted rollup; never treat compaction as loss of an exact decision.',
      'A clean structural scan does not replace runtime or human behavior testing.'
    ],
    truth: {
      observationOnly: true,
      automaticAction: false,
      automaticRepair: false,
      permissionChange: false,
      canonChange: false,
      reviewReadinessIsApproval: false,
      reviewReadinessIsPromotion: false,
      hiddenReasoningCaptured: false,
      sameViewForHumanAndMachine: true
    }
  };
  snapshot.briefing = toBriefing(snapshot);
  return snapshot;
}

function writeSnapshot(file, snapshot) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  fs.renameSync(temporary, file);
  return file;
}

module.exports = { SCHEMA, VERSION, compile, toBriefing, writeSnapshot, sourceInventory };
