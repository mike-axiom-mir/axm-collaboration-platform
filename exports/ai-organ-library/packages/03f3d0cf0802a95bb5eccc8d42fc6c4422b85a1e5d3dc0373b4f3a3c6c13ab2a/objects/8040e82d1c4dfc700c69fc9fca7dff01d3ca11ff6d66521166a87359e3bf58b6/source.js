'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Browser = require('./code-clone-web-browser-organ');
const Executor = require('./code-clone-vm-executor-organ');
const Supervisor = require('./code-clone-native-agency-supervisor-organ');
const StoryMission = require('./code-clone-native-code-story-lab-mission-organ');

const ORGAN_ID = 'axm.mirror.organ/code-clone-native-agency-heartbeat-v1';
const CONFIG_SCHEMA = 'axm.mirror.code-clone-native-agency-heartbeat-config/v1';
const LOG_SCHEMA = 'axm.mirror.code-clone-native-agency-heartbeat-log-entry/v1';
const SUMMARY_SCHEMA = 'axm.mirror.code-clone-native-agency-heartbeat-summary/v1';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function canonical(value) { return JSON.stringify(stable(value)); }
function sha256(value) { return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : canonical(value)).digest('hex'); }

function typedError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || canonical(Object.keys(value).sort()) !== canonical(expected.slice().sort())) throw typedError('SHAPE', `${label} shape is closed`);
}

function cleanText(value, maximum, label) {
  if (typeof value !== 'string' || !value.trim() || value.includes('\u0000') || value.length > maximum) throw typedError('TEXT', `${label} is invalid`);
  return value.normalize('NFC').trim();
}

function safeId(value, label, pattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/, maximum = 160) {
  const output = cleanText(value, maximum, label);
  if (!pattern.test(output)) throw typedError('IDENTITY', `${label} is invalid`);
  return output;
}

function realDirectory(value, label, create = false) {
  const root = path.resolve(cleanText(value, 8192, label));
  if (create) fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  let stat;
  try { stat = fs.lstatSync(root); }
  catch { throw typedError('DIRECTORY', `${label} does not exist`); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw typedError('DIRECTORY', `${label} must be a real directory`);
  return root;
}

function authority() {
  return { goalAuthority: 'CLONE_SELF', humanDirectiveRequired: false, reward: false, competition: false, selfGrant: false, parentWrite: false, canonChange: false };
}

function normalizeConfig(input) {
  exactKeys(input, ['schema', 'sessionId', 'cloneId', 'mirrorRoot', 'workshopRoot', 'stateDir', 'baselineIntervalMs', 'maxTurns', 'continuous', 'agencyCommand', 'browser', 'authority'], 'heartbeat config');
  if (input.schema !== CONFIG_SCHEMA) throw typedError('CONFIG_SCHEMA', 'heartbeat config schema is unsupported');
  if (canonical(input.authority) !== canonical(authority())) throw typedError('AUTHORITY', 'heartbeat authority contract changed');
  const continuous = input.continuous === true;
  const maxTurns = input.maxTurns == null ? null : Number(input.maxTurns);
  const baselineIntervalMs = Number(input.baselineIntervalMs);
  if (!Number.isInteger(baselineIntervalMs) || baselineIntervalMs < 1000 || baselineIntervalMs > 86400000) throw typedError('INTERVAL', 'baselineIntervalMs is out of range');
  if ((!continuous && maxTurns == null) || (maxTurns != null && (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 1000000000))) throw typedError('TURN_LIMIT', 'maxTurns is invalid');
  exactKeys(input.browser, ['enabled', 'executable', 'noSandbox'], 'browser config');
  if (typeof input.browser.enabled !== 'boolean' || typeof input.browser.noSandbox !== 'boolean') throw typedError('BROWSER_CONFIG', 'browser booleans are required');
  if (input.browser.executable != null && typeof input.browser.executable !== 'string') throw typedError('BROWSER_CONFIG', 'browser executable must be text or null');
  const mirrorRoot = realDirectory(input.mirrorRoot, 'mirrorRoot');
  const workshopRoot = realDirectory(input.workshopRoot, 'workshopRoot');
  const stateDir = realDirectory(input.stateDir, 'stateDir', true);
  let agencyCommand = null;
  if (input.agencyCommand != null) {
    const checked = Supervisor.validateAgencyCommand(input.agencyCommand, mirrorRoot);
    agencyCommand = { runtimeExecutable: checked.runtimeExecutable, entrypoint: checked.entrypoint, arguments: checked.arguments, timeoutMs: checked.timeoutMs, maxOutputBytes: checked.maxOutputBytes };
  }
  return stable({
    schema: CONFIG_SCHEMA,
    sessionId: safeId(input.sessionId, 'sessionId'),
    cloneId: safeId(input.cloneId, 'cloneId', /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/, 200),
    mirrorRoot,
    workshopRoot,
    stateDir,
    baselineIntervalMs,
    maxTurns,
    continuous,
    agencyCommand,
    browser: { enabled: input.browser.enabled, executable: input.browser.executable == null ? null : cleanText(input.browser.executable, 8192, 'browser.executable'), noSandbox: input.browser.noSandbox },
    authority: authority()
  });
}

function fileRef(root, relative, kind) {
  const absolute = path.resolve(root, ...relative.split('/'));
  const rootPrefix = path.resolve(root) + path.sep;
  if (!absolute.startsWith(rootPrefix)) return null;
  try {
    const stat = fs.lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    const bytes = fs.readFileSync(absolute);
    return { id: relative, kind, sha256: sha256(bytes), bytes: bytes.length };
  } catch { return null; }
}

function hostBody() {
  const free = os.freemem();
  const total = os.totalmem();
  return stable({
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    uptimeSeconds: Math.floor(os.uptime()),
    logicalCpuCount: os.cpus().length,
    loadAverage: os.loadavg().map(value => Number(value.toFixed(4))),
    memory: { freeBytes: free, totalBytes: total, usedRatio: total ? Number(((total - free) / total).toFixed(6)) : null },
    pid: process.pid
  });
}

function latestGrowthMemoryRef(stateDir) {
  const root = path.join(stateDir, 'code-clone-growth', 'memories');
  try {
    const names = fs.readdirSync(root, { withFileTypes: true }).filter(item => item.isDirectory() && !item.isSymbolicLink()).map(item => item.name).sort();
    if (!names.length) return null;
    const latest = path.join(root, names[names.length - 1], 'memory.json');
    const stat = fs.lstatSync(latest);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    const value = JSON.parse(fs.readFileSync(latest, 'utf8'));
    if (value.schema !== 'axm.mirror.code-clone-growth-memory/v1' || !/^[a-f0-9]{64}$/.test(String(value.memoryDigest || ''))) return null;
    return { id: value.memoryId, kind: 'SELF_DIRECTED_GROWTH_MEMORY', digest: value.memoryDigest, relativePath: path.relative(stateDir, latest).split(path.sep).join('/') };
  } catch { return null; }
}

function recentSupervisorRef(stateDir, sessionId) {
  const file = path.join(stateDir, 'native-agency-supervisor-sessions', sessionId, 'turns.jsonl');
  try {
    const verified = Supervisor.verifySupervisorLog(file);
    if (!verified.entries) return null;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
    const latest = JSON.parse(lines[lines.length - 1]);
    return {
      id: `supervisor-session:${sessionId}`,
      kind: 'RECENT_AGENCY_OUTCOMES',
      digest: verified.finalDigest,
      entries: verified.entries,
      latest: { decisionSource: latest.decisionSource, action: latest.action, invocationState: latest.invocationState, routeState: latest.routeState },
      consequence: latest.routeEffect || null
    };
  } catch { return null; }
}

function latestCodeStoryMissionRef(stateDir, sessionId) {
  const root = path.join(stateDir, 'native-curiosity-agency-sessions', sessionId);
  try {
    const files = fs.readdirSync(root).filter(name => /^code-story-mission-[a-f0-9]{24}\.json$/.test(name)).sort();
    if (!files.length || files.length > 128) return null;
    const valid = [];
    for (const name of files) {
      const file = path.join(root, name);
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) continue;
      try {
        const value = StoryMission.verifyReceipt(JSON.parse(fs.readFileSync(file, 'utf8')));
        valid.push({ file, value });
      } catch {}
    }
    valid.sort((left, right) => Date.parse(right.value.recordedAt) - Date.parse(left.value.recordedAt) || right.file.localeCompare(left.file));
    if (!valid.length) return null;
    const latest = valid[0];
    return { id: latest.value.receiptId, kind: 'NATIVE_CODE_STORY_LAB_MISSION', digest: latest.value.receiptDigest, state: latest.value.state, relativePath: path.relative(stateDir, latest.file).split(path.sep).join('/') };
  } catch { return null; }
}

function composeFrame(configInput, options = {}) {
  const config = options.normalized === true ? configInput : normalizeConfig(configInput);
  const sequence = Number(options.sequence);
  if (!Number.isInteger(sequence) || sequence < 1) throw typedError('SEQUENCE', 'heartbeat sequence must be a positive integer');
  const now = typeof options.clock === 'function' ? options.clock() : new Date();
  const createdAt = new Date(now).toISOString();
  const browser = Browser.discoverBrowser(config.browser.executable);
  const activation = Executor.probeActivation(options.executorOptions || {});
  const foundationRefs = [
    fileRef(config.mirrorRoot, 'roots/AXM_ROOTS_v1.json', 'ROOT_BUNDLE'),
    fileRef(config.mirrorRoot, 'lineage/code-clone-ivan-experiment-bootstrap-v4.json', 'EXPERIMENT_BOOTSTRAP'),
    fileRef(config.mirrorRoot, 'lineage/code-clone-ivan-experiment-bootstrap-v3.json', 'EXPERIMENT_BOOTSTRAP'),
    fileRef(config.mirrorRoot, 'lineage/code-clone-ivan-experiment-bootstrap-v2.json', 'EXPERIMENT_BOOTSTRAP'),
    fileRef(config.mirrorRoot, 'lineage/code-clone-mike-pride-message-v1.json', 'FIRST_PARTY_HUMAN_MESSAGE')
  ].filter(Boolean);
  const growth = latestGrowthMemoryRef(config.stateDir);
  if (growth) foundationRefs.push(growth);
  const storyMission = latestCodeStoryMissionRef(config.stateDir, config.sessionId);
  if (storyMission) foundationRefs.push(storyMission);
  const recent = recentSupervisorRef(config.stateDir, config.sessionId);
  const signals = [];
  if (!config.agencyCommand) signals.push({ id: 'mirror-native-agency-entrypoint-unbound', state: 'OPEN', kind: 'RUNTIME_SEAM', statement: 'No real Mirror-native chooser is bound; infrastructure must hold rather than invent a decision.' });
  if (process.platform !== 'linux') signals.push({ id: 'ivan-linux-unverified-on-this-host', state: 'UNKNOWN', kind: 'ENVIRONMENT_SEAM', statement: 'This host is not Ivan\'s Linux VM.' });
  if (activation.state !== 'ACTIVE') signals.push({ id: 'vm-executor-inactive', state: 'HELD', kind: 'ACTIVATION_SEAM', code: activation.code });
  if (browser.state !== 'AVAILABLE') signals.push({ id: 'chromium-browser-missing', state: 'UNKNOWN', kind: 'CAPABILITY_SEAM', statement: browser.reason });
  const turnId = `${config.sessionId}.turn-${sequence}`;
  return Supervisor.normalizeFrameEnvelope({
    schema: Supervisor.TURN_SCHEMA,
    messageType: 'FRAME',
    turnId,
    cloneId: config.cloneId,
    createdAt,
    frame: {
      heartbeat: { sessionId: config.sessionId, sequence, baselineIntervalMs: config.baselineIntervalMs, continuous: config.continuous, observedAt: createdAt },
      body: { identity: 'axm.machine.mirror/seed-0', specialistRole: 'future-code-mirror', disposable: true, host: hostBody(), roots: { mirror: config.mirrorRoot, workshop: config.workshopRoot, state: config.stateDir } },
      signals,
      memoryRefs: foundationRefs,
      recentOutcomeRefs: recent ? [recent] : [],
      capabilities: [
        { id: 'clone.web.browser', state: config.browser.enabled ? browser.state : 'DISABLED', evidence: browser.state === 'AVAILABLE' ? { executable: browser.executable, source: browser.source } : { reason: browser.reason || null } },
        { id: 'clone.vm-local.code-and-tool.execute', state: activation.state, evidence: { code: activation.code, markerSha256: activation.markerSha256 || null, boundaryEvidence: activation.boundaryEvidence || null } },
        { id: 'clone.mirror-native-agency.turn-route', state: 'AVAILABLE' },
        { id: 'clone.mirror-native-agency.entrypoint', state: config.agencyCommand ? recent && recent.latest && recent.latest.decisionSource === 'MIRROR_NATIVE_AGENCY' ? 'OBSERVED_RETURNED_PRIOR_TURN' : 'BOUND_UNVERIFIED_THIS_TURN' : 'UNBOUND' },
        { id: 'clone.workshop.mutable-machine-workspace', state: 'PRESENT', evidence: { path: config.workshopRoot } }
      ],
      freedom: { goalAuthority: 'CLONE_SELF', humanDirectiveRequired: false, requiredGoal: null, reward: false, competition: false, restValid: true, failureValid: true, unknownValid: true }
    },
    decision: null,
    authority: Supervisor.authority()
  });
}

function heartbeatLogPath(config) {
  const root = path.join(config.stateDir, 'native-agency-heartbeat-sessions', config.sessionId);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  return path.join(root, 'heartbeats.jsonl');
}

function verifyHeartbeatLog(logPath) {
  const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).filter(Boolean);
  let previous = null;
  let sessionId = null;
  for (let index = 0; index < lines.length; index += 1) {
    const entry = JSON.parse(lines[index]);
    if (entry.schema !== LOG_SCHEMA || entry.sequence !== index + 1 || entry.previousDigest !== previous) throw typedError('HEARTBEAT_LOG_LINEAGE', `heartbeat log line ${index + 1} changed`);
    if (sessionId == null) sessionId = entry.sessionId;
    if (entry.sessionId !== sessionId) throw typedError('HEARTBEAT_LOG_SESSION', 'heartbeat log mixes sessions');
    const declared = entry.entryDigest;
    const base = { ...entry };
    delete base.entryDigest;
    if (sha256(base) !== declared) throw typedError('HEARTBEAT_LOG_DIGEST', `heartbeat log line ${index + 1} digest changed`);
    previous = declared;
  }
  return { schema: 'axm.mirror.code-clone-native-agency-heartbeat-log-verification/v1', state: 'PASS', sessionId, entries: lines.length, finalDigest: previous };
}

function appendHeartbeat(config, frame, receipt) {
  const logPath = heartbeatLogPath(config);
  const before = fs.existsSync(logPath) ? verifyHeartbeatLog(logPath) : { entries: 0, finalDigest: null };
  const base = stable({
    schema: LOG_SCHEMA,
    sessionId: config.sessionId,
    sequence: before.entries + 1,
    recordedAt: new Date().toISOString(),
    turnId: frame.turnId,
    frameDigest: sha256(frame),
    receiptDigest: receipt.receiptDigest,
    decisionSource: receipt.decision.decision.source,
    action: receipt.decision.decision.action,
    state: receipt.state,
    previousDigest: before.finalDigest
  });
  const entry = stable({ ...base, entryDigest: sha256(base) });
  fs.appendFileSync(logPath, `${canonical(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
  const after = verifyHeartbeatLog(logPath);
  return { relativePath: path.relative(config.stateDir, logPath).split(path.sep).join('/'), entries: after.entries, finalDigest: after.finalDigest };
}

class LazyBrowserSession {
  constructor(config, options = {}) { this.config = config; this.options = options; this.opened = null; }
  async act(request) {
    if (!this.config.browser.enabled) throw typedError('BROWSER_DISABLED', 'browser use is disabled in heartbeat configuration');
    if (!this.opened) this.opened = await Browser.openSession({ stateDir: this.config.stateDir, sessionId: request.sessionId, browserExecutable: this.config.browser.executable, noSandbox: this.config.browser.noSandbox, ...(this.options.browserOptions || {}) });
    return this.opened.session.act(request);
  }
  async close() {
    if (!this.opened) return null;
    const receipt = await this.opened.session.close();
    this.opened = null;
    return receipt;
  }
}

function sleep(ms, signal = null) {
  if (signal && signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', done);
      resolve();
    }
    if (signal) signal.addEventListener('abort', done, { once: true });
  });
}

async function runHeartbeat(configInput, options = {}) {
  const config = normalizeConfig(configInput);
  const browserSession = options.browserSession || new LazyBrowserSession(config, options);
  const wait = typeof options.sleep === 'function' ? options.sleep : sleep;
  const startedAt = new Date().toISOString();
  const receipts = [];
  let stopReason = null;
  let sequence = 0;
  try {
    while (config.continuous || sequence < config.maxTurns) {
      if (options.signal && options.signal.aborted) { stopReason = 'EXTERNAL_STOP_SIGNAL'; break; }
      sequence += 1;
      const frame = composeFrame(config, { normalized: true, sequence, clock: options.clock, executorOptions: options.executorOptions });
      const receipt = await Supervisor.runTurn(frame, {
        mirrorRoot: config.mirrorRoot,
        agencyCommand: config.agencyCommand,
        agencyFunction: options.agencyFunction,
        browserSession,
        executorOptions: options.executorOptions || {},
        stateDir: config.stateDir,
        sessionId: config.sessionId
      });
      Supervisor.verifyReceipt(receipt);
      const log = appendHeartbeat(config, frame, receipt);
      receipts.push({ turnId: frame.turnId, state: receipt.state, decisionSource: receipt.decision.decision.source, action: receipt.decision.decision.action, receiptDigest: receipt.receiptDigest, logDigest: log.finalDigest });
      if (receipt.decision.decision.source === 'SUPERVISOR_HOLD_NOT_MIRROR') { stopReason = 'MIRROR_NATIVE_AGENCY_UNAVAILABLE_OR_INVALID'; break; }
      if (receipt.routed.action === 'STOP_EXPERIMENT') { stopReason = 'MIRROR_REQUESTED_STOP'; break; }
      if (!config.continuous && sequence >= config.maxTurns) { stopReason = 'TURN_LIMIT_REACHED'; break; }
      const restMs = receipt.routed.action === 'REST' && receipt.routed.effect ? receipt.routed.effect.restMs : config.baselineIntervalMs;
      await wait(restMs, options.signal || null);
      if (options.signal && options.signal.aborted) { stopReason = 'EXTERNAL_STOP_SIGNAL'; break; }
    }
  } finally {
    if (browserSession && typeof browserSession.close === 'function') await browserSession.close();
  }
  const logPath = heartbeatLogPath(config);
  const verified = fs.existsSync(logPath) ? verifyHeartbeatLog(logPath) : { entries: 0, finalDigest: null };
  return stable({
    schema: SUMMARY_SCHEMA,
    status: 'EXPERIMENTAL',
    sessionId: config.sessionId,
    cloneId: config.cloneId,
    startedAt,
    endedAt: new Date().toISOString(),
    turns: receipts.length,
    stopReason: stopReason || 'STOPPED',
    receipts,
    log: { relativePath: path.relative(config.stateDir, logPath).split(path.sep).join('/'), entries: verified.entries, finalDigest: verified.finalDigest },
    authority: authority(),
    boundary: 'This shell composes machine frames and transports Mirror decisions. It does not invent a goal, imitate Mirror, grant a pulse, prove containment, or turn a bounded native curiosity entrypoint into proof of open-ended coding intelligence.'
  });
}

module.exports = {
  ORGAN_ID,
  CONFIG_SCHEMA,
  LOG_SCHEMA,
  SUMMARY_SCHEMA,
  stable,
  canonical,
  sha256,
  authority,
  normalizeConfig,
  hostBody,
  latestGrowthMemoryRef,
  latestCodeStoryMissionRef,
  composeFrame,
  verifyHeartbeatLog,
  LazyBrowserSession,
  runHeartbeat
};
