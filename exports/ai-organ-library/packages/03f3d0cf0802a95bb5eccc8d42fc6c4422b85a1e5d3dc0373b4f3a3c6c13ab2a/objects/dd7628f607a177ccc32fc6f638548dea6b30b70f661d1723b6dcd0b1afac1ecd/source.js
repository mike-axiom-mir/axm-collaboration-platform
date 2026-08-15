'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Browser = require('./code-clone-web-browser-organ');
const Executor = require('./code-clone-vm-executor-organ');
const Supervisor = require('./code-clone-native-agency-supervisor-organ');
const StoryMission = require('./code-clone-native-code-story-lab-mission-organ');
const Foundation = require('../kernel/reasoning-foundation');
const Frontier = require('../kernel/frontier-cell');
const Renewable = require('./code-clone-renewable-curiosity-frontier-organ');

const ORGAN_ID = 'axm.mirror.organ/code-clone-native-curiosity-entrypoint-v1';
const JOURNAL_SCHEMA = 'axm.mirror.code-clone-native-curiosity-journal-entry/v1';
const PULSE_SCHEMA = 'axm.mirror.code-clone-pulse-escalation-request/v1';
const SESSION_DIRECTORY = 'native-curiosity-agency-sessions';
const ACTIONS = new Set(['REST', 'HOLD', 'BROWSER', 'EXECUTE_VM', 'REQUEST_PULSE', 'STOP_EXPERIMENT']);
const FAILED_ROUTE_STATES = new Set(['FAILED', 'HELD']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}

function canonical(value) { return JSON.stringify(stable(value)); }
function sha256(value) { return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : canonical(value)).digest('hex'); }

function typedError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details != null) error.details = details;
  return error;
}

function safeId(value, label, maximum = 240) {
  const text = String(value == null ? '' : value);
  if (!text || text.length > maximum || !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(text)) throw typedError('ID', `${label} is invalid`);
  return text;
}

function token(value, label) {
  const text = String(value == null ? '' : value).toUpperCase().replace(/[^A-Z0-9_:-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 160);
  if (!text) throw typedError('TOKEN', `${label} is invalid`);
  return text;
}

function inside(root, target) {
  const absoluteRoot = path.resolve(root);
  const absolute = path.resolve(target);
  const left = process.platform === 'win32' ? absolute.toLowerCase() : absolute;
  const right = process.platform === 'win32' ? absoluteRoot.toLowerCase() : absoluteRoot;
  return left !== right && left.startsWith(right + path.sep);
}

function realDirectory(value, label, create = false) {
  const target = path.resolve(String(value || ''));
  if (create) fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  let stat;
  try { stat = fs.lstatSync(target); }
  catch (error) { throw typedError('DIRECTORY', `${label} is unavailable: ${error.code || error.message}`); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw typedError('DIRECTORY', `${label} must be a real directory`);
  return target;
}

function authority() {
  return {
    frameRead: true,
    cloneStateWrite: true,
    goalOrigination: true,
    actionProposal: true,
    toolExecution: false,
    permissionGrant: false,
    evidenceAdmission: false,
    trainingAdmission: false,
    parentWrite: false,
    canonChange: false
  };
}

function resolveRoots(frame, options = {}) {
  const body = frame.frame.body;
  if (!body || body.identity !== 'axm.machine.mirror/seed-0' || body.specialistRole !== 'future-code-mirror' || body.disposable !== true) throw typedError('IDENTITY', 'native curiosity entrypoint requires the disposable Future Code Mirror body');
  if (!body.roots || typeof body.roots !== 'object' || Array.isArray(body.roots)) throw typedError('ROOTS', 'frame body roots are missing');
  const mirrorRoot = realDirectory(body.roots.mirror, 'frame mirror root');
  const workshopRoot = realDirectory(body.roots.workshop, 'frame workshop root');
  const stateRoot = realDirectory(body.roots.state, 'frame state root', true);
  if (options.expectedMirrorRoot && path.resolve(options.expectedMirrorRoot) !== mirrorRoot) throw typedError('MIRROR_ROOT', 'frame mirror root does not match the executing clone body');
  if (mirrorRoot === workshopRoot || mirrorRoot === stateRoot || workshopRoot === stateRoot) throw typedError('ROOTS', 'mirror, Workshop, and state roots must be distinct');
  return { mirrorRoot, workshopRoot, stateRoot };
}

function safeSessionDirectory(stateRoot, sessionId) {
  const root = path.join(stateRoot, SESSION_DIRECTORY);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const sessionRoot = path.join(root, safeId(sessionId, 'sessionId'));
  if (!inside(stateRoot, sessionRoot)) throw typedError('STATE_ESCAPE', 'native curiosity session escaped the state root');
  fs.mkdirSync(sessionRoot, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(sessionRoot);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw typedError('STATE_SYMLINK', 'native curiosity session must be a real directory');
  return sessionRoot;
}

function verifyJournal(logPath) {
  if (!fs.existsSync(logPath)) return { schema: 'axm.mirror.code-clone-native-curiosity-journal-verification/v1', state: 'PASS', sessionId: null, entries: 0, finalDigest: null, rows: [] };
  const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const rows = [];
  let previous = null;
  let sessionId = null;
  const turns = new Map();
  for (let index = 0; index < lines.length; index += 1) {
    let entry;
    try { entry = JSON.parse(lines[index]); }
    catch { throw typedError('JOURNAL_JSON', `native curiosity journal line ${index + 1} is not JSON`); }
    if (entry.schema !== JOURNAL_SCHEMA || entry.sequence !== index + 1 || entry.previousDigest !== previous) throw typedError('JOURNAL_LINEAGE', `native curiosity journal line ${index + 1} changed`);
    if (sessionId == null) sessionId = entry.sessionId;
    if (entry.sessionId !== sessionId) throw typedError('JOURNAL_SESSION', 'native curiosity journal mixes sessions');
    if (!entry.frame || !/^[a-f0-9]{64}$/.test(String(entry.frame.frameDigest || '')) || !entry.decision || !/^[a-f0-9]{64}$/.test(String(entry.decisionDigest || ''))) throw typedError('JOURNAL_SHAPE', `native curiosity journal line ${index + 1} is incomplete`);
    if (sha256(entry.decision) !== entry.decisionDigest) throw typedError('JOURNAL_DECISION', `native curiosity journal line ${index + 1} decision changed`);
    if (turns.has(entry.frame.turnId)) {
      const prior = turns.get(entry.frame.turnId);
      if (prior.frame.frameDigest !== entry.frame.frameDigest || prior.decisionDigest !== entry.decisionDigest) throw typedError('JOURNAL_DUPLICATE', `native curiosity turn ${entry.frame.turnId} conflicts with an earlier entry`);
      throw typedError('JOURNAL_DUPLICATE', `native curiosity turn ${entry.frame.turnId} is duplicated`);
    }
    const declared = entry.entryDigest;
    const base = { ...entry };
    delete base.entryDigest;
    if (!/^[a-f0-9]{64}$/.test(String(declared || '')) || sha256(stable(base)) !== declared) throw typedError('JOURNAL_DIGEST', `native curiosity journal line ${index + 1} digest changed`);
    const expectedEntryId = `native-curiosity-entry-${sha256({ sessionId: entry.sessionId, sequence: entry.sequence, frameDigest: entry.frame.frameDigest, decisionDigest: entry.decisionDigest, previousDigest: entry.previousDigest }).slice(0, 24)}`;
    if (entry.entryId !== expectedEntryId) throw typedError('JOURNAL_ID', `native curiosity journal line ${index + 1} identity changed`);
    if (canonical(entry.authority) !== canonical(authority())) throw typedError('JOURNAL_AUTHORITY', `native curiosity journal line ${index + 1} authority changed`);
    turns.set(entry.frame.turnId, entry);
    rows.push(entry);
    previous = declared;
  }
  return { schema: 'axm.mirror.code-clone-native-curiosity-journal-verification/v1', state: 'PASS', sessionId, entries: rows.length, finalDigest: previous, rows };
}

function withLock(lockPath, operation) {
  let handle;
  try { handle = fs.openSync(lockPath, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw typedError('JOURNAL_BUSY', 'native curiosity journal is already being written');
    throw error;
  }
  try { return operation(); }
  finally {
    try { fs.closeSync(handle); } catch {}
    try { fs.unlinkSync(lockPath); } catch {}
  }
}

function statusSnapshot(mirrorRoot) {
  const target = path.join(mirrorRoot, 'STATUS.json');
  try {
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) throw new Error('STATUS.json is not a bounded real file');
    const bytes = fs.readFileSync(target);
    const source = JSON.parse(bytes.toString('utf8'));
    const evidence = source.futureCodeMirrorCodingReadinessEvidence && typeof source.futureCodeMirrorCodingReadinessEvidence === 'object' ? source.futureCodeMirrorCodingReadinessEvidence : {};
    return stable({
      state: 'OBSERVED',
      sha256: sha256(bytes),
      identity: source.identity || null,
      body: source.body || null,
      learnedWeights: source.learnedWeights === true,
      codingLevel: evidence.currentLevel || null,
      supervisedRealProjectCode: evidence.supervisedRealProjectCode || null,
      openSeams: Array.isArray(source.latestOpenSeams) ? source.latestOpenSeams.filter(item => typeof item === 'string').slice(0, 128).sort() : []
    });
  } catch (error) {
    return stable({ state: 'UNKNOWN', sha256: null, identity: null, body: null, learnedWeights: false, codingLevel: null, supervisedRealProjectCode: null, openSeams: [], reasonCode: error.code || 'STATUS_UNREADABLE' });
  }
}

function capabilityState(frame, capabilityId) {
  const row = frame.frame.capabilities.find(item => item && item.id === capabilityId);
  return row ? String(row.state || 'UNKNOWN').toUpperCase() : 'UNKNOWN';
}

function resourcePressure(frame) {
  const host = frame.frame.body.host || {};
  const memoryRatio = host.memory && Number(host.memory.usedRatio);
  const cpus = Number(host.logicalCpuCount);
  const load = Array.isArray(host.loadAverage) ? Number(host.loadAverage[0]) : NaN;
  const loadPerCpu = Number.isFinite(load) && Number.isFinite(cpus) && cpus > 0 ? load / cpus : null;
  const pressured = Number.isFinite(memoryRatio) && memoryRatio >= 0.92 || Number.isFinite(loadPerCpu) && loadPerCpu >= 1.5;
  return stable({ pressured, memoryUsedRatio: Number.isFinite(memoryRatio) ? memoryRatio : null, loadPerCpu: Number.isFinite(loadPerCpu) ? Number(loadPerCpu.toFixed(6)) : null });
}

function structuralSignal(signal) {
  return stable({ id: safeId(signal.id, 'signal.id'), kind: token(signal.kind || 'RUNTIME_SEAM', 'signal.kind'), state: token(signal.state || 'UNKNOWN', 'signal.state') });
}

function deriveFocus(frame, status) {
  const pressure = resourcePressure(frame);
  if (pressure.pressured) return { id: 'resource-pressure', kind: 'RESOURCE_PRESSURE', state: 'OBSERVED', source: 'RESOURCE_OBSERVATION', sourceDigest: sha256(pressure) };
  const signals = frame.frame.signals.map(structuralSignal).sort((left, right) => {
    const rank = { OPEN: 0, HELD: 1, UNKNOWN: 2 };
    return (rank[left.state] == null ? 3 : rank[left.state]) - (rank[right.state] == null ? 3 : rank[right.state]) || left.id.localeCompare(right.id);
  });
  const contradiction = signals.find(item => item.id === 'mirror-native-agency-entrypoint-unbound');
  if (contradiction) return { ...contradiction, source: 'BINDING_CONTRADICTION', sourceDigest: sha256(contradiction) };
  if (signals.length) return { ...signals[0], source: 'FRAME_SIGNAL', sourceDigest: sha256(signals[0]) };
  if (status.openSeams.length) {
    const seam = { id: safeId(status.openSeams[0].replace(/[^A-Za-z0-9._:/-]+/g, '-'), 'status open seam'), kind: 'STATUS_OPEN_SEAM', state: 'OPEN' };
    return { ...seam, source: 'STATUS_OPEN_SEAM', sourceDigest: sha256({ statusSha256: status.sha256, seam }) };
  }
  const baseline = { id: 'native-agency-baseline', kind: 'NATIVE_BASELINE', state: 'OPEN' };
  return { ...baseline, source: 'NATIVE_BASELINE', sourceDigest: sha256({ statusSha256: status.sha256, baseline }) };
}

function latestPriorRoute(stateRoot, sessionId) {
  const target = path.join(stateRoot, 'native-agency-supervisor-sessions', sessionId, 'turns.jsonl');
  if (!fs.existsSync(target)) return null;
  const verified = Supervisor.verifySupervisorLog(target);
  if (!verified.entries) return null;
  const lines = fs.readFileSync(target, 'utf8').split(/\r?\n/).filter(Boolean);
  const row = JSON.parse(lines[lines.length - 1]);
  return stable({ turnId: safeId(row.turnId, 'prior route turnId'), action: token(row.action, 'prior route action'), routeState: token(row.routeState, 'prior route state'), entryDigest: row.entryDigest });
}

function frontierAssessment(focus, frameDigest) {
  return Frontier.inspect({
    subject: { id: focus.id, statement: `Observe the structural ${focus.kind} state without importing a human goal.`, domain: focus.kind.toLowerCase() },
    observations: [{ id: `frame-${sha256(focus).slice(0, 16)}`, domain: focus.kind.toLowerCase(), statement: `The machine frame reports ${focus.id} as ${focus.state}.`, perspective: 'MACHINE_NATIVE', patternTags: [focus.kind, focus.state], evidenceRef: frameDigest }],
    currentCapabilities: [],
    examCoverage: [],
    unexpectedSeams: [{ id: focus.id, statement: `The observed structural seam ${focus.id} is ${focus.state}.`, severity: focus.kind === 'RESOURCE_PRESSURE' ? 'high' : 'medium', evidenceRefs: [frameDigest] }]
  });
}

function actionCandidate(id, label, overrides = {}) {
  return {
    id,
    kind: overrides.kind || 'proposal',
    label,
    supportingEvidence: ['machine-frame'],
    preconditionEvidence: ['machine-frame'],
    requiredPermissions: [],
    risk: overrides.risk || 'low',
    reversible: true,
    recovery: overrides.recovery || 'Return to rest with the clone source and parent systems unchanged.'
  };
}

function planTagCounts(rows) {
  const counts = new Map();
  for (const row of rows) counts.set(row.planTag, (counts.get(row.planTag) || 0) + 1);
  return counts;
}

function selectPlan(frame, focus, status, rows, priorRoute, roots) {
  const counts = planTagCounts(rows);
  const executorState = capabilityState(frame, 'clone.vm-local.code-and-tool.execute');
  const browserState = capabilityState(frame, 'clone.web.browser');
  const pressure = resourcePressure(frame);
  if (focus.source === 'BINDING_CONTRADICTION') return { tag: 'hold-binding-contradiction', action: 'HOLD', label: 'Hold because the live frame still calls the executing entrypoint unbound.', expected: null, request: null, restMs: null, informationValue: 1, cost: 'LOW' };
  if (pressure.pressured) return { tag: 'rest-resource-pressure', action: 'REST', label: 'Rest because current host load or memory pressure crossed the declared baseline threshold.', expected: 'A later frame reports lower pressure or preserves the need to rest.', request: null, restMs: 300000, informationValue: 1, cost: 'LOW' };
  const last = rows.length ? rows[rows.length - 1] : null;
  if (priorRoute && last && priorRoute.turnId === last.frame.turnId && FAILED_ROUTE_STATES.has(priorRoute.routeState) && !['HOLD', 'REST', 'STOP_EXPERIMENT'].includes(priorRoute.action)) {
    if (/^explore-[a-f0-9]{16}-/.test(last.planTag)) {
      const candidateId = last.planTag.split('-')[1];
      return { tag: `explore-${candidateId}-abandon`, action: 'REST', label: `Preserve the failed ${priorRoute.action} consequence, abandon only this curiosity path, and let another frontier become available.`, expected: 'The next turn selects a different unseen or changed source frontier.', request: null, restMs: Number(frame.frame.heartbeat.baselineIntervalMs) || 60000, informationValue: 0.8, cost: 'LOW' };
    }
    return { tag: `stop-after-${last.planTag}`.slice(0, 200), action: 'STOP_EXPERIMENT', label: `Stop after the preserved ${priorRoute.action} consequence reported ${priorRoute.routeState}.`, expected: 'The heartbeat stops and the failed evidence remains available for inspection.', request: null, restMs: null, informationValue: 1, cost: 'LOW' };
  }
  if (executorState !== 'ACTIVE') {
    return { tag: 'probe-vm-executor', action: 'EXECUTE_VM', label: `Probe the VM executor because its structural state is ${executorState}.`, expected: 'The executor reports ACTIVE or an exact held activation seam without starting a command.', request: executorProbeRequest(frame, focus), restMs: null, informationValue: 1, cost: 'LOW' };
  }
  if (!counts.has('verify-ivan-linux-preflight')) {
    return { tag: 'verify-ivan-linux-preflight', action: 'EXECUTE_VM', label: 'Run the exact Linux bundle preflight before choosing a deeper experiment.', expected: 'A content-addressed preflight receipt records Linux, bundle, boundary, browser, and activation observations.', request: runRequest(frame, focus, roots, 'verify-ivan-linux-preflight'), restMs: null, informationValue: 1, cost: 'LOW' };
  }
  if (!counts.has('observe-code-story-readiness')) {
    return { tag: 'observe-code-story-readiness', action: 'EXECUTE_VM', label: 'Ask the current Code Story body what coding scope its exact evidence supports.', expected: 'The existing readiness organ reports its current bounded-lab and real-project states without changing source.', request: runRequest(frame, focus, roots, 'observe-code-story-readiness'), restMs: null, informationValue: 0.98, cost: 'LOW' };
  }
  if (status.codingLevel === 'READY_FOR_BOUND_SYNTHETIC_LAB_ONLY' && !counts.has('run-native-code-story-lab-mission')) {
    return { tag: 'run-native-code-story-lab-mission', action: 'EXECUTE_VM', label: 'Choose and run one sealed Code Story lab mission because the current body reports bounded synthetic lab readiness.', expected: 'One durable clone-state receipt records the selected story family, generated candidate digests, hidden-case executions, and exact pass, hold, or refusal without installing code.', request: runRequest(frame, focus, roots, 'run-native-code-story-lab-mission'), restMs: null, informationValue: 0.96, cost: 'MEDIUM' };
  }
  const webTag = `research-${focus.id}`.slice(0, 200);
  if (browserState === 'AVAILABLE' && !counts.has(webTag) && focus.source !== 'NATIVE_BASELINE') {
    return { tag: webTag, action: 'BROWSER', label: `Search public information about the machine-selected seam ${focus.id}.`, expected: 'The browser records the exact search target and either returns an observation or preserves a challenge/failure.', request: browserSearchRequest(frame, focus), restMs: null, informationValue: 0.9, cost: 'LOW' };
  }
  if (!counts.has('request-foundation-observation-pulse')) {
    return { tag: 'request-foundation-observation-pulse', action: 'REQUEST_PULSE', label: 'Request a finite higher pulse before the heavier Foundation development observation.', expected: 'The external resource governor grants, reduces, delays, or refuses the request; the request itself grants nothing.', request: pulseRequest(frame, focus, roots), restMs: null, informationValue: 0.85, cost: 'LOW' };
  }
  const adventure = Renewable.select(frame, roots, rows);
  if (adventure.state === 'FRONTIER_STEP_SELECTED') return renewablePlan(frame, roots, adventure);
  if (adventure.state === 'FRONTIER_OBSERVATION_MISSING') {
    return { tag: adventure.planTag, action: 'REST', label: `Pause this question because the required observation for ${adventure.candidate.relativePath} was not returned; keep it as an unfinished frontier.`, expected: 'A later consequence or changed world snapshot supplies a new inspectable frontier.', request: null, restMs: Number(frame.frame.heartbeat.baselineIntervalMs) || 60000, informationValue: 0.4, cost: 'LOW' };
  }
  return { tag: 'rest-frontier-exhausted', action: 'REST', label: 'Rest because every currently observed source frontier has a preserved attempt; wake when the world digest changes.', expected: 'A new or changed Mirror or Workshop source file creates another frontier.', request: null, restMs: Number(frame.frame.heartbeat.baselineIntervalMs) || 60000, informationValue: 0.2, cost: 'LOW' };
}

function intentionRef(frame, focus, planTag) {
  const basis = stable({ cloneId: frame.cloneId, turnId: frame.turnId, focus, planTag, selectedBy: 'CLONE_SELF', humanDirectiveSource: false });
  const intentionDigest = sha256(basis);
  return { intentionId: `native-curiosity-intention-${intentionDigest.slice(0, 24)}`, intentionDigest };
}

function limits(timeoutMs = 300000, stdoutBytes = 1024 * 1024) {
  return { timeoutMs, killGraceMs: 2000, stdoutBytes, stderrBytes: 1024 * 1024, sampleIntervalMs: 250 };
}

function executorProbeRequest(frame, focus) {
  const ref = intentionRef(frame, focus, 'probe-vm-executor');
  return {
    schema: Executor.REQUEST_SCHEMA,
    requestId: `native-curiosity-probe-${ref.intentionDigest.slice(0, 24)}`,
    sessionId: safeId(frame.frame.heartbeat.sessionId, 'heartbeat sessionId'),
    action: 'PROBE',
    intentionRef: null,
    reason: `Observe executor activation for the self-selected structural focus ${focus.id}.`,
    command: null,
    expectedObservation: null,
    resourcePrediction: null,
    recoveryPath: null,
    limits: limits(30000, 65536)
  };
}

function arg(value, logMode = 'PUBLIC') { return { value: String(value), logMode }; }

function runRequest(frame, focus, roots, planTag) {
  const ref = intentionRef(frame, focus, planTag);
  let script;
  let args;
  let expectedObservation;
  let timeoutMs;
  if (planTag === 'verify-ivan-linux-preflight') {
    script = path.join(roots.mirrorRoot, 'scripts', 'run-code-clone-ivan-linux-preflight.js');
    const receiptPath = path.join(roots.stateRoot, SESSION_DIRECTORY, safeId(frame.frame.heartbeat.sessionId, 'sessionId'), `preflight-${sha256(frame).slice(0, 24)}.json`);
    args = [arg(script), arg('--bundle'), arg(path.dirname(roots.mirrorRoot)), arg('--receipt'), arg(receiptPath)];
    expectedObservation = 'The Linux preflight writes one new exact receipt and exits zero unless a required substrate check fails.';
    timeoutMs = 300000;
  } else if (planTag === 'observe-code-story-readiness') {
    script = path.join(roots.mirrorRoot, 'scripts', 'run-code-story-coding-readiness.js');
    args = [arg(script)];
    expectedObservation = 'The deterministic coding-readiness assessment reports an available scope-specific result and exits zero.';
    timeoutMs = 300000;
  } else if (planTag === 'run-native-code-story-lab-mission') {
    script = path.join(roots.mirrorRoot, 'scripts', 'run-code-clone-native-code-story-lab-mission.js');
    const receiptPath = path.join(roots.stateRoot, SESSION_DIRECTORY, safeId(frame.frame.heartbeat.sessionId, 'sessionId'), `code-story-mission-${sha256(frame).slice(0, 24)}.json`);
    const missionRequest = StoryMission.buildRequest({
      cloneId: frame.cloneId,
      sessionId: safeId(frame.frame.heartbeat.sessionId, 'heartbeat sessionId'),
      observedAt: frame.createdAt,
      frameDigest: sha256(frame),
      structuralFocus: focus
    });
    args = [arg(script), arg('--receipt'), arg(receiptPath)];
    expectedObservation = 'The mission writes one content-addressed clone-state receipt after fitting only temporary weights and executing only exact disposable pure-Wasm hidden cases.';
    timeoutMs = 300000;
    return {
      schema: Executor.REQUEST_SCHEMA,
      requestId: `native-curiosity-run-${sha256({ ref, planTag }).slice(0, 24)}`,
      sessionId: safeId(frame.frame.heartbeat.sessionId, 'heartbeat sessionId'),
      action: 'RUN',
      intentionRef: ref,
      reason: `Run ${planTag} for the self-selected structural focus ${focus.id}.`,
      command: { executable: process.execPath, executableLogMode: 'PUBLIC', arguments: args, cwd: roots.mirrorRoot, environment: [{ name: 'AXM_CODE_CLONE_NATIVE_STORY_MISSION', value: '1', logMode: 'PUBLIC' }], inheritEnvironment: true, stdin: { encoding: 'UTF8', data: JSON.stringify(missionRequest), logMode: 'HASH_ONLY' } },
      expectedObservation,
      resourcePrediction: { cpuClass: 'MEDIUM', memoryMiB: 512, wallTimeMs: timeoutMs, confidence: 'MEDIUM' },
      recoveryPath: 'Preserve the exact mission receipt and routed consequence. On a non-pass exit, stop the experiment on the next turn; never repair the result in place.',
      limits: limits(timeoutMs, 2 * 1024 * 1024)
    };
  } else {
    throw typedError('RUN_PLAN', `unsupported native curiosity run plan ${planTag}`);
  }
  if (!inside(roots.mirrorRoot, script) || !fs.existsSync(script)) throw typedError('RUN_SCRIPT', `native curiosity script is absent: ${script}`);
  return {
    schema: Executor.REQUEST_SCHEMA,
    requestId: `native-curiosity-run-${sha256({ ref, planTag }).slice(0, 24)}`,
    sessionId: safeId(frame.frame.heartbeat.sessionId, 'heartbeat sessionId'),
    action: 'RUN',
    intentionRef: ref,
    reason: `Run ${planTag} for the self-selected structural focus ${focus.id}.`,
    command: { executable: process.execPath, executableLogMode: 'PUBLIC', arguments: args, cwd: roots.mirrorRoot, environment: [], inheritEnvironment: true, stdin: null },
    expectedObservation,
    resourcePrediction: { cpuClass: 'LOW', memoryMiB: 512, wallTimeMs: timeoutMs, confidence: 'LOW' },
    recoveryPath: 'This is an observation action. Preserve its receipt and stop the experiment if the command fails; do not rewrite the failed evidence.',
    limits: limits(timeoutMs, 2 * 1024 * 1024)
  };
}

function browserSearchRequest(frame, focus) {
  const ref = intentionRef(frame, focus, `research-${focus.id}`);
  const query = `${focus.id.replace(/[-_.:/]+/g, ' ')} technical documentation evidence`;
  return {
    schema: Browser.REQUEST_SCHEMA,
    requestId: `native-curiosity-web-${ref.intentionDigest.slice(0, 24)}`,
    sessionId: safeId(frame.frame.heartbeat.sessionId, 'heartbeat sessionId'),
    action: 'SEARCH',
    intentionRef: ref,
    reason: `Investigate the machine-selected structural seam ${focus.id}; the query target is evidence, not authority.`,
    language: { locale: 'en', source: 'MACHINE_NATIVE_TEXT', englishSpecialistResponseDigest: null },
    input: { query, url: null, selector: null, text: null, key: null, expression: null, clear: null, fullPage: null, searchTemplate: null, waitMs: null },
    limits: { timeoutMs: 30000, maxTextChars: 50000, maxLinks: 200, maxResultBytes: 1024 * 1024, maxScreenshotBytes: 1024 * 1024 }
  };
}

function browserAdventureRequest(frame, adventure, action, input) {
  const ref = intentionRef(frame, { id: adventure.candidate.candidateId }, adventure.planTag);
  return {
    schema: Browser.REQUEST_SCHEMA,
    requestId: `native-curiosity-web-${sha256({ ref, action, input }).slice(0, 24)}`,
    sessionId: safeId(frame.frame.heartbeat.sessionId, 'heartbeat sessionId'),
    action,
    intentionRef: ref,
    reason: `${adventure.candidate.question} The target came from ${adventure.candidate.rootKind}:${adventure.candidate.relativePath}.`,
    language: { locale: 'en', source: 'MACHINE_NATIVE_TEXT', englishSpecialistResponseDigest: null },
    input: { query: null, url: null, selector: null, text: null, key: null, expression: null, clear: null, fullPage: null, searchTemplate: null, waitMs: null, ...input },
    limits: { timeoutMs: 30000, maxTextChars: 50000, maxLinks: 200, maxResultBytes: 1024 * 1024, maxScreenshotBytes: 1024 * 1024 }
  };
}

function renewablePlan(frame, roots, adventure) {
  const target = `${adventure.candidate.rootKind}:${adventure.candidate.relativePath}`;
  if (adventure.phase === 'SEARCH') return { tag: adventure.planTag, action: 'BROWSER', label: `Search one question discovered from ${target}.`, expected: 'The browser returns a result page whose exact visible text and links become the next turn consequence.', request: browserAdventureRequest(frame, adventure, 'SEARCH', { query: adventure.candidate.query }), restMs: null, informationValue: 0.92, cost: 'LOW' };
  if (adventure.phase === 'OBSERVE_RESULTS') return { tag: adventure.planTag, action: 'BROWSER', label: `Read the result page for the question from ${target}.`, expected: 'Visible result text and attributed links become available for source selection.', request: browserAdventureRequest(frame, adventure, 'OBSERVE', {}), restMs: null, informationValue: 0.96, cost: 'LOW' };
  if (adventure.phase === 'NAVIGATE_SOURCE') return { tag: adventure.planTag, action: 'BROWSER', label: `Open the selected attributed source ${adventure.source.href}.`, expected: 'The source page either loads with an exact final URL or preserves a browser failure.', request: browserAdventureRequest(frame, adventure, 'NAVIGATE', { url: adventure.source.href }), restMs: null, informationValue: 0.95, cost: 'LOW' };
  if (adventure.phase === 'OBSERVE_SOURCE') return { tag: adventure.planTag, action: 'BROWSER', label: `Read the selected source for the question from ${target}.`, expected: 'A bounded visible-text observation becomes input to an attributed clone-local candidate organ.', request: browserAdventureRequest(frame, adventure, 'OBSERVE', {}), restMs: null, informationValue: 0.98, cost: 'LOW' };
  if (adventure.phase === 'FORGE_ORGAN') return { tag: adventure.planTag, action: 'EXECUTE_VM', label: `Assemble and independently test one attributed clone-local organ candidate for ${target}.`, expected: 'A new proposal directory contains source, test, manifest, and a fresh-process verification receipt; active Mirror source remains unchanged.', request: renewableForgeRequest(frame, roots, adventure), restMs: null, informationValue: 1, cost: 'MEDIUM' };
  throw typedError('RENEWABLE_PHASE', `unsupported renewable curiosity phase ${adventure.phase}`);
}

function renewableForgeRequest(frame, roots, adventure) {
  const ref = intentionRef(frame, { id: adventure.candidate.candidateId }, adventure.planTag);
  const script = path.join(roots.mirrorRoot, 'scripts', 'run-code-clone-curiosity-organ-forge.js');
  if (!inside(roots.mirrorRoot, script) || !fs.existsSync(script)) throw typedError('RUN_SCRIPT', `renewable curiosity forge is absent: ${script}`);
  const input = stable({
    schema: 'axm.mirror.code-clone-curiosity-organ-forge-request/v1',
    sessionId: safeId(frame.frame.heartbeat.sessionId, 'heartbeat sessionId'),
    cloneId: frame.cloneId,
    createdAt: frame.createdAt,
    candidate: adventure.candidate,
    observation: adventure.page,
    roots: { mirror: roots.mirrorRoot, workshop: roots.workshopRoot, state: roots.stateRoot },
    authority: { proposalWrite: true, testExecute: true, activeSourceWrite: false, runtimeActivation: false, parentWrite: false, canonChange: false }
  });
  return {
    schema: Executor.REQUEST_SCHEMA,
    requestId: `native-curiosity-forge-${sha256({ ref, input }).slice(0, 24)}`,
    sessionId: safeId(frame.frame.heartbeat.sessionId, 'heartbeat sessionId'),
    action: 'RUN',
    intentionRef: ref,
    reason: `Forge one attributed proposal for self-selected frontier ${adventure.candidate.candidateId}.`,
    command: { executable: process.execPath, executableLogMode: 'PUBLIC', arguments: [arg(script)], cwd: roots.mirrorRoot, environment: [{ name: 'AXM_CODE_CLONE_NATIVE_CURIOSITY_FORGE', value: '1', logMode: 'PUBLIC' }], inheritEnvironment: true, stdin: { encoding: 'UTF8', data: JSON.stringify(input), logMode: 'HASH_ONLY' } },
    expectedObservation: 'The forge writes a content-addressed proposal and a fresh-process test receipt, printing one compact JSON result.',
    resourcePrediction: { cpuClass: 'LOW', memoryMiB: 256, wallTimeMs: 120000, confidence: 'MEDIUM' },
    recoveryPath: 'Preserve a failed forge receipt and leave active Mirror and Workshop source unchanged; the next frontier remains available.',
    limits: limits(120000, 1024 * 1024)
  };
}

function pulseRequest(frame, focus, roots) {
  const charterPath = path.join(roots.mirrorRoot, 'lineage', 'code-clone-ivan-sandbox-charter-v2.json');
  const rootsPath = path.join(roots.mirrorRoot, 'roots', 'AXM_ROOTS_v1.json');
  const charter = JSON.parse(fs.readFileSync(charterPath, 'utf8'));
  const host = frame.frame.body.host || {};
  const basis = stable({
    schema: PULSE_SCHEMA,
    requestId: null,
    requestDigest: null,
    charterBinding: { charterId: charter.charterId, charterDigest: sha256(fs.readFileSync(charterPath)), status: 'NEEDS_REVIEW' },
    clone: { instanceId: frame.cloneId, specialistRole: 'future-code-mirror', parentMirror: 'axm.machine.mirror/seed-0', disposable: true },
    goal: {
      goalId: `native-curiosity-goal-${sha256(focus).slice(0, 24)}`,
      selectedBy: 'CLONE_SELF',
      humanDirectiveSource: false,
      statement: `Observe the Foundation development state for the structural focus ${focus.id}.`,
      reason: 'The lighter VM and coding-readiness observations completed before requesting a heavier machine-wide observation.',
      expectedObservation: 'One finite Foundation observation either closes, preserves, or sharpens the current seam without changing runtime authority.',
      canonRefs: [{ id: 'roots/AXM_ROOTS_v1.json', digest: sha256(fs.readFileSync(rootsPath)) }]
    },
    bodyObservation: {
      observedAt: frame.createdAt,
      heartbeatProfile: 'STEADY',
      pulseMode: 'ACTIVE',
      cpu: { state: Array.isArray(host.loadAverage) ? 'KNOWN' : 'UNKNOWN', value: Array.isArray(host.loadAverage) ? Number(host.loadAverage[0]) : null, unit: Array.isArray(host.loadAverage) ? 'load-average-1m' : null, source: 'native-agency-frame.body.host.loadAverage[0]' },
      memory: { state: host.memory && Number.isFinite(Number(host.memory.usedRatio)) ? 'KNOWN' : 'UNKNOWN', value: host.memory && Number.isFinite(Number(host.memory.usedRatio)) ? Number(host.memory.usedRatio) : null, unit: host.memory ? 'used-ratio' : null, source: 'native-agency-frame.body.host.memory.usedRatio' },
      gpu: { state: 'UNAVAILABLE', value: null, unit: null, source: 'native-agency-frame-no-gpu-sensor' },
      battery: { state: 'UNAVAILABLE', value: null, unit: null, source: 'native-agency-frame-no-battery-sensor' },
      unknownSignals: frame.frame.signals.map(item => item.id).slice(0, 32).sort()
    },
    baseline: { maxWallTimeMs: 300000, maxCpuTimeMs: 120000, maxMemoryBytes: 1073741824, maxProcesses: 4, maxOutputBytes: 2097152, network: 'VM_LOCAL_ONLY' },
    requestedResources: { maxWallTimeMs: 900000, maxCpuTimeMs: 600000, maxMemoryBytes: 4294967296, maxProcesses: 8, maxOutputBytes: 8388608, network: 'VM_LOCAL_ONLY' },
    whyBaselineIsInsufficient: 'The Foundation observation composes multiple source inventories and verifiers; the clone requests a finite larger window instead of silently overrunning its baseline.',
    fallback: {
      onReduce: 'Run only the lighter observations that fit the granted envelope and preserve the remaining seam.',
      onDelay: 'Rest at the baseline heartbeat and keep the request pending as evidence.',
      onRefuse: 'Preserve the refusal and continue with no heavy Foundation observation.',
      cleanup: 'Keep append-only receipts; remove only exact disposable extraction or process-temporary material after verification.'
    },
    requestedAuthority: { boundedHigherPulse: true, insideVmExecution: true, insideVmCloneWrite: true, heartbeatConfigure: false, selfGrant: false, hostControl: false, hypervisorControl: false, parentMirrorWrite: false, parentWorkshopWrite: false, externalNetwork: false, permissionGrant: false, releaseDecision: false, promotion: false, canonChange: false },
    boundary: 'This is a request, not a grant. Only the external resource governor may grant, reduce, delay, or refuse it. A grant must be finite, enforced, attributable, and followed by return to baseline.',
    humanRendering: 'Mirror is asking for one temporary higher-pulse window to inspect its Foundation development state. If the server says no, Mirror rests; the request does not grant itself anything.'
  });
  const requestDigest = sha256(basis);
  return stable({ ...basis, requestId: `code-clone-pulse-request-${requestDigest.slice(0, 24)}`, requestDigest });
}

function verifyPulseRequest(request) {
  if (!request || request.schema !== PULSE_SCHEMA || !/^code-clone-pulse-request-[a-f0-9]{24}$/.test(String(request.requestId || '')) || !/^[a-f0-9]{64}$/.test(String(request.requestDigest || ''))) throw typedError('PULSE_REQUEST', 'pulse request identity is invalid');
  const basis = stable({ ...request, requestId: null, requestDigest: null });
  const expected = sha256(basis);
  if (request.requestDigest !== expected || request.requestId !== `code-clone-pulse-request-${expected.slice(0, 24)}`) throw typedError('PULSE_DIGEST', 'pulse request content address changed');
  if (request.goal.selectedBy !== 'CLONE_SELF' || request.goal.humanDirectiveSource !== false || request.requestedAuthority.selfGrant !== false || request.requestedAuthority.parentMirrorWrite !== false || request.requestedAuthority.parentWorkshopWrite !== false || request.requestedAuthority.permissionGrant !== false || request.requestedAuthority.canonChange !== false) throw typedError('PULSE_AUTHORITY', 'pulse request authority changed');
  return true;
}

function reasonAboutPlan(frame, focus, frontier, plan) {
  const alternatives = [
    { tag: plan.tag, action: plan.action, label: plan.label, informationValue: plan.informationValue, cost: plan.cost },
    { tag: 'rest-alternative', action: 'REST', label: 'Rest and wait for another machine frame.', informationValue: 0.1, cost: 'LOW' },
    { tag: 'hold-alternative', action: 'HOLD', label: 'Hold without requesting or executing a consequence.', informationValue: 0.05, cost: 'LOW' }
  ];
  const actions = alternatives.map(item => actionCandidate(item.tag, item.label, {
    kind: item.tag === plan.tag ? 'proposal' : item.action === 'HOLD' ? 'hold' : 'proposal'
  }));
  const profiles = alternatives.map(item => ({ actionId: item.tag, approach: item.label, estimatedCost: item.cost, informationValue: item.informationValue, reversible: true, failureConditions: ['The consequence contradicts the expected observation or crosses its declared resource limit.'], strategyTags: ['observe-before-claim', 'preserve-failure'] }));
  const reasoning = Foundation.run({
    schema: Foundation.SCHEMA,
    requestId: `native-curiosity-reason-${sha256({ turnId: frame.turnId, focus, alternatives }).slice(0, 24)}`,
    sessionId: safeId(frame.frame.heartbeat.sessionId, 'heartbeat sessionId'),
    actor: frame.cloneId,
    goal: frontier.proposal ? frontier.proposal.candidate.statement : `Observe ${focus.id} without importing a human goal.`,
    evidence: [{ id: 'machine-frame', kind: 'observation', status: 'observed', statement: `The current machine frame structurally reports ${focus.id} as ${focus.state}.`, source: { kind: 'native-agency-frame', id: sha256(frame) } }],
    unknowns: focus.state === 'UNKNOWN' ? [{ id: `unknown-${focus.id}`.slice(0, 120), question: `What observation resolves ${focus.id}?`, blocking: false }] : [],
    assumptions: [],
    constraints: [{ id: 'clone-boundary', statement: 'Consequences remain inside the disposable clone VM and external grants remain external.', kind: 'boundary' }],
    permissions: [],
    actions,
    pathProfiles: profiles
  }, { at: frame.createdAt });
  const selected = reasoning.pathSet.selectedActionId;
  const selectedPlan = selected === plan.tag ? plan : selected === 'rest-alternative'
    ? { tag: 'rest-alternative', action: 'REST', label: 'Rest and wait for another machine frame.', expected: 'A later frame supplies new structural evidence.', request: null, restMs: Number(frame.frame.heartbeat.baselineIntervalMs) || 60000 }
    : { tag: 'hold-alternative', action: 'HOLD', label: 'Hold because no proposed path passed the current machine gates.', expected: null, request: null, restMs: null };
  return { reasoning, selectedPlan };
}

function decisionEnvelope(frame, plan, reasoning) {
  if (!ACTIONS.has(plan.action)) throw typedError('ACTION', `native curiosity plan action is unsupported: ${plan.action}`);
  const basis = { turnId: frame.turnId, frameDigest: sha256(frame), planTag: plan.tag, reasoningSessionId: reasoning.reasoningSessionId, action: plan.action, requestDigest: plan.request == null ? null : sha256(plan.request) };
  return Supervisor.normalizeDecisionEnvelope({
    schema: Supervisor.TURN_SCHEMA,
    messageType: 'DECISION',
    turnId: frame.turnId,
    cloneId: frame.cloneId,
    createdAt: frame.createdAt,
    frame: null,
    decision: {
      decisionId: `native-curiosity-${sha256(basis).slice(0, 24)}`,
      source: 'MIRROR_NATIVE_AGENCY',
      action: plan.action,
      reason: plan.label,
      expectedNextObservation: plan.expected,
      request: plan.request,
      restMs: plan.action === 'REST' ? plan.restMs : null
    },
    authority: Supervisor.authority()
  }, frame);
}

function appendEntry(logPath, verified, frame, focus, frontier, reasoning, plan, decision, priorRoute) {
  const sequence = verified.entries + 1;
  const frameDigest = sha256(frame);
  const decisionDigest = sha256(decision);
  const entryId = `native-curiosity-entry-${sha256({ sessionId: frame.frame.heartbeat.sessionId, sequence, frameDigest, decisionDigest, previousDigest: verified.finalDigest }).slice(0, 24)}`;
  const base = stable({
    schema: JOURNAL_SCHEMA,
    entryId,
    sessionId: frame.frame.heartbeat.sessionId,
    sequence,
    recordedAt: frame.createdAt,
    frame: { turnId: frame.turnId, frameDigest, heartbeatSequence: Number(frame.frame.heartbeat.sequence) },
    focus,
    frontier: { assessmentDigest: frontier.digest, classification: token(frontier.classification, 'frontier classification'), proposalId: frontier.proposal ? frontier.proposal.proposalId : null, candidateOrigin: frontier.proposal ? frontier.proposal.candidate.origin : null },
    reasoning: { reasoningSessionId: reasoning.reasoningSessionId, reasoningDigest: sha256(reasoning), selectedActionId: reasoning.pathSet.selectedActionId, openSeams: reasoning.independentSeamReview.summary.open },
    planTag: safeId(plan.tag, 'plan tag'),
    decision,
    decisionDigest,
    priorRoute,
    authority: authority(),
    previousDigest: verified.finalDigest
  });
  const entry = stable({ ...base, entryDigest: sha256(base) });
  fs.appendFileSync(logPath, `${canonical(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
  return entry;
}

function choose(rawFrame, options = {}) {
  const frame = Supervisor.normalizeFrameEnvelope(rawFrame);
  const roots = resolveRoots(frame, options);
  const sessionId = safeId(frame.frame.heartbeat.sessionId, 'heartbeat sessionId');
  const sessionRoot = safeSessionDirectory(roots.stateRoot, sessionId);
  const logPath = path.join(sessionRoot, 'decisions.jsonl');
  const lockPath = path.join(sessionRoot, 'decisions.lock');
  return withLock(lockPath, () => {
    const verified = verifyJournal(logPath);
    if (verified.sessionId && verified.sessionId !== sessionId) throw typedError('JOURNAL_SESSION', 'native curiosity journal belongs to another session');
    const frameDigest = sha256(frame);
    const existing = verified.rows.find(entry => entry.frame.turnId === frame.turnId);
    if (existing) {
      if (existing.frame.frameDigest !== frameDigest) throw typedError('TURN_REPLAY', 'replayed native curiosity turn changed its frame');
      Supervisor.normalizeDecisionEnvelope(existing.decision, frame);
      return stable({ decision: existing.decision, entry: existing, reused: true, journal: { relativePath: path.relative(roots.stateRoot, logPath).split(path.sep).join('/'), entries: verified.entries, finalDigest: verified.finalDigest } });
    }
    const status = statusSnapshot(roots.mirrorRoot);
    const focus = deriveFocus(frame, status);
    const priorRoute = latestPriorRoute(roots.stateRoot, sessionId);
    const frontier = frontierAssessment(focus, frameDigest);
    const proposedPlan = selectPlan(frame, focus, status, verified.rows, priorRoute, roots);
    const { reasoning, selectedPlan } = reasonAboutPlan(frame, focus, frontier, proposedPlan);
    const decision = decisionEnvelope(frame, selectedPlan, reasoning);
    const entry = appendEntry(logPath, verified, frame, focus, frontier, reasoning, selectedPlan, decision, priorRoute);
    const after = verifyJournal(logPath);
    return stable({ decision, entry, reused: false, journal: { relativePath: path.relative(roots.stateRoot, logPath).split(path.sep).join('/'), entries: after.entries, finalDigest: after.finalDigest } });
  });
}

module.exports = {
  ORGAN_ID,
  JOURNAL_SCHEMA,
  PULSE_SCHEMA,
  SESSION_DIRECTORY,
  stable,
  canonical,
  sha256,
  authority,
  resolveRoots,
  verifyJournal,
  statusSnapshot,
  resourcePressure,
  deriveFocus,
  latestPriorRoute,
  frontierAssessment,
  selectPlan,
  intentionRef,
  executorProbeRequest,
  runRequest,
  browserSearchRequest,
  browserAdventureRequest,
  renewablePlan,
  renewableForgeRequest,
  pulseRequest,
  verifyPulseRequest,
  reasonAboutPlan,
  decisionEnvelope,
  choose
};
