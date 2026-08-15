'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ORGAN_ID = 'axm.mirror.organ/code-clone-vm-executor-v1';
const ACTIVATION_SCHEMA = 'axm.mirror.code-clone-vm-activation/v1';
const REQUEST_SCHEMA = 'axm.mirror.code-clone-vm-execution-request/v1';
const RECEIPT_SCHEMA = 'axm.mirror.code-clone-vm-execution-receipt/v1';
const LOG_SCHEMA = 'axm.mirror.code-clone-vm-execution-log-entry/v1';
const VM_ID = 'IVAN_CODE_CLONE_EXPERIMENT_VM';
const ENABLE_TOKEN = 'IVAN_DISPOSABLE_VM_GENERAL_EXECUTION_ENABLED';
const DEFAULT_MARKER_PATH = '/etc/axm-code-clone-vm.json';
const ACTIONS = new Set(['PROBE', 'RUN']);
const LOG_MODES = new Set(['PUBLIC', 'HASH_ONLY']);
const FORBIDDEN_REASONING_KEYS = /^(chain[-_ ]?of[-_ ]?thought|hidden[-_ ]?reasoning|private[-_ ]?reasoning|scratchpad|internal[-_ ]?monologue)$/i;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function canonical(value) { return JSON.stringify(stable(value)); }

function sha256(value) {
  return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : canonical(value)).digest('hex');
}

function typedError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || canonical(Object.keys(value).sort()) !== canonical(expected.slice().sort())) {
    throw typedError('SHAPE', `${label} shape is closed`);
  }
}

function scanForbiddenReasoning(value, trail = ['request']) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_REASONING_KEYS.test(key)) throw typedError('PRIVATE_REASONING', `private hidden reasoning field refused at ${trail.concat(key).join('.')}`);
    scanForbiddenReasoning(child, trail.concat(key));
  }
}

function safeId(value, label, maximum = 160) {
  const output = String(value == null ? '' : value).trim();
  if (!output || output.length > maximum || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(output)) throw typedError('IDENTITY', `${label} must be a safe machine identifier`);
  return output;
}

function cleanText(value, maximum, label, allowEmpty = false) {
  if (typeof value !== 'string') throw typedError('TEXT', `${label} must be text`);
  if (value.includes('\u0000')) throw typedError('TEXT', `${label} contains a null byte`);
  const output = value.normalize('NFC');
  if ((!allowEmpty && output.trim().length === 0) || output.length > maximum) throw typedError('TEXT', `${label} must contain ${allowEmpty ? '0' : '1'} through ${maximum} UTF-8 characters`);
  return output;
}

function digest64(value, label) {
  const output = String(value == null ? '' : value);
  if (!/^[a-f0-9]{64}$/.test(output)) throw typedError('DIGEST', `${label} must be a sha256 digest`);
  return output;
}

function boundedInteger(value, minimum, maximum, fallback, label) {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw typedError('LIMIT', `${label} must be an integer from ${minimum} through ${maximum}`);
  return value;
}

function normalizeLogMode(value, label) {
  const mode = String(value || '').toUpperCase();
  if (!LOG_MODES.has(mode)) throw typedError('LOG_MODE', `${label} must be PUBLIC or HASH_ONLY`);
  return mode;
}

function normalizeMarker(input) {
  exactKeys(input, ['schema', 'vmId', 'cloneId', 'purpose', 'guestOsFamily', 'createdAt', 'createdBy', 'generalProcessExecution', 'roots', 'vmBoundary'], 'activation marker');
  if (input.schema !== ACTIVATION_SCHEMA) throw typedError('ACTIVATION_SCHEMA', 'activation marker schema is unsupported');
  if (input.vmId !== VM_ID) throw typedError('ACTIVATION_VM', 'activation marker targets a different VM');
  if (input.purpose !== 'DISPOSABLE_FULL_MIRROR_PLUS_CODE_AND_GROWTH_SPECIALIST_EXPERIMENT') throw typedError('ACTIVATION_PURPOSE', 'activation purpose is unsupported');
  if (input.guestOsFamily !== 'LINUX') throw typedError('ACTIVATION_OS', 'activation marker must target Linux');
  if (input.generalProcessExecution !== true) throw typedError('ACTIVATION_PERMISSION', 'general process execution is not enabled by the marker');
  if (!Number.isFinite(Date.parse(String(input.createdAt)))) throw typedError('ACTIVATION_TIME', 'activation createdAt must be an ISO date-time');
  exactKeys(input.roots, ['mirror', 'workshop', 'state', 'externalEvidenceSink'], 'activation roots');
  const roots = {};
  for (const key of ['mirror', 'workshop', 'state']) {
    const value = cleanText(input.roots[key], 8192, `roots.${key}`);
    if (!path.posix.isAbsolute(value)) throw typedError('ACTIVATION_ROOT', `roots.${key} must be an absolute Linux path`);
    roots[key] = path.posix.normalize(value);
  }
  if (input.roots.externalEvidenceSink == null) roots.externalEvidenceSink = null;
  else {
    const value = cleanText(input.roots.externalEvidenceSink, 8192, 'roots.externalEvidenceSink');
    if (!path.posix.isAbsolute(value)) throw typedError('ACTIVATION_ROOT', 'roots.externalEvidenceSink must be an absolute Linux path');
    roots.externalEvidenceSink = path.posix.normalize(value);
  }
  exactKeys(input.vmBoundary, ['state', 'writableHostMounts', 'snapshotResetAvailable', 'verifiedByMachine'], 'activation vmBoundary');
  if (input.vmBoundary.state !== 'DECLARED_BY_OWNER_NOT_CRYPTOGRAPHICALLY_PROVEN') throw typedError('ACTIVATION_BOUNDARY', 'VM boundary state is unsupported');
  if (input.vmBoundary.writableHostMounts !== false) throw typedError('ACTIVATION_HOST_MOUNT', 'general execution refuses a marker declaring writable host mounts');
  if (typeof input.vmBoundary.snapshotResetAvailable !== 'boolean' || typeof input.vmBoundary.verifiedByMachine !== 'boolean') throw typedError('ACTIVATION_BOUNDARY', 'VM boundary booleans are required');
  return stable({
    schema: ACTIVATION_SCHEMA,
    vmId: VM_ID,
    cloneId: safeId(input.cloneId, 'cloneId'),
    purpose: input.purpose,
    guestOsFamily: 'LINUX',
    createdAt: new Date(input.createdAt).toISOString(),
    createdBy: cleanText(input.createdBy, 160, 'createdBy'),
    generalProcessExecution: true,
    roots,
    vmBoundary: {
      state: input.vmBoundary.state,
      writableHostMounts: false,
      snapshotResetAvailable: input.vmBoundary.snapshotResetAvailable,
      verifiedByMachine: input.vmBoundary.verifiedByMachine
    }
  });
}

function probeActivation(options = {}) {
  const platform = options.platform || process.platform;
  const markerPath = path.resolve(String(options.markerPath || process.env.AXM_CODE_CLONE_VM_MARKER || DEFAULT_MARKER_PATH));
  const token = options.enableToken == null ? process.env.AXM_CODE_CLONE_VM_ENABLE : options.enableToken;
  const testMode = options.testMode === true;
  if (platform !== 'linux' && !testMode) {
    return { state: 'HELD', code: 'NON_LINUX_PARENT', platform, markerPath, marker: null, reason: 'general executor activates only in the Linux experiment VM' };
  }
  if (token !== ENABLE_TOKEN) {
    return { state: 'HELD', code: 'ENABLE_TOKEN_MISSING', platform, markerPath, marker: null, reason: 'the experiment VM enable latch is absent' };
  }
  let raw;
  try { raw = fs.readFileSync(markerPath, 'utf8'); }
  catch (error) { return { state: 'HELD', code: 'ACTIVATION_MARKER_UNREADABLE', platform, markerPath, marker: null, reason: error.code || error.message };
  }
  let marker;
  try { marker = normalizeMarker(JSON.parse(raw)); }
  catch (error) { return { state: 'HELD', code: error.code || 'ACTIVATION_MARKER_INVALID', platform, markerPath, marker: null, reason: error.message };
  }
  return {
    state: 'ACTIVE',
    code: 'ACTIVE_DECLARED_VM_BOUNDARY',
    platform,
    markerPath,
    marker,
    markerSha256: sha256(Buffer.from(raw)),
    boundaryEvidence: marker.vmBoundary.verifiedByMachine ? 'MACHINE_VERIFIED_DECLARATION' : 'OWNER_DECLARATION_ONLY'
  };
}

function normalizeArgument(input, index) {
  exactKeys(input, ['value', 'logMode'], `command.arguments[${index}]`);
  return { value: cleanText(input.value, 1048576, `command.arguments[${index}].value`, true), logMode: normalizeLogMode(input.logMode, `command.arguments[${index}].logMode`) };
}

function normalizeEnvironment(input) {
  if (!Array.isArray(input) || input.length > 2048) throw typedError('ENVIRONMENT', 'command.environment must contain no more than 2048 entries');
  const seen = new Set();
  return input.map((item, index) => {
    exactKeys(item, ['name', 'value', 'logMode'], `command.environment[${index}]`);
    const name = String(item.name || '');
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,255}$/.test(name)) throw typedError('ENVIRONMENT', `command.environment[${index}].name is invalid`);
    if (seen.has(name)) throw typedError('ENVIRONMENT', `command.environment repeats ${name}`);
    seen.add(name);
    return { name, value: cleanText(item.value, 1048576, `command.environment[${index}].value`, true), logMode: normalizeLogMode(item.logMode, `command.environment[${index}].logMode`) };
  });
}

function normalizeStdin(input) {
  if (input == null) return null;
  exactKeys(input, ['encoding', 'data', 'logMode'], 'command.stdin');
  const encoding = String(input.encoding || '').toUpperCase();
  if (!['UTF8', 'BASE64'].includes(encoding)) throw typedError('STDIN', 'command.stdin.encoding must be UTF8 or BASE64');
  const data = cleanText(input.data, 22369624, 'command.stdin.data', true);
  if (encoding === 'BASE64' && (data.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data))) throw typedError('STDIN', 'command.stdin.data must be canonical base64');
  const bytes = encoding === 'BASE64' ? Buffer.from(data, 'base64') : Buffer.from(data, 'utf8');
  if (bytes.length > 16 * 1024 * 1024) throw typedError('STDIN', 'decoded stdin exceeds 16 MiB');
  return { encoding, data, logMode: normalizeLogMode(input.logMode, 'command.stdin.logMode') };
}

function normalizeCommand(input) {
  exactKeys(input, ['executable', 'arguments', 'cwd', 'environment', 'inheritEnvironment', 'stdin', 'executableLogMode'], 'command');
  if (!Array.isArray(input.arguments) || input.arguments.length > 4096) throw typedError('ARGUMENTS', 'command.arguments must contain no more than 4096 entries');
  const cwd = input.cwd == null ? null : cleanText(input.cwd, 8192, 'command.cwd');
  if (cwd && !path.isAbsolute(cwd)) throw typedError('CWD', 'command.cwd must be absolute');
  if (typeof input.inheritEnvironment !== 'boolean') throw typedError('ENVIRONMENT', 'command.inheritEnvironment must be boolean');
  return {
    executable: cleanText(input.executable, 8192, 'command.executable'),
    executableLogMode: normalizeLogMode(input.executableLogMode, 'command.executableLogMode'),
    arguments: input.arguments.map(normalizeArgument),
    cwd,
    environment: normalizeEnvironment(input.environment),
    inheritEnvironment: input.inheritEnvironment,
    stdin: normalizeStdin(input.stdin)
  };
}

function normalizeRequest(input) {
  scanForbiddenReasoning(input);
  exactKeys(input, ['schema', 'requestId', 'sessionId', 'action', 'intentionRef', 'reason', 'command', 'expectedObservation', 'resourcePrediction', 'recoveryPath', 'limits'], 'execution request');
  if (input.schema !== REQUEST_SCHEMA) throw typedError('SCHEMA', 'execution request schema is unsupported');
  const action = String(input.action || '').toUpperCase();
  if (!ACTIONS.has(action)) throw typedError('ACTION', 'execution action is unsupported');
  let intentionRef = null;
  if (input.intentionRef != null) {
    exactKeys(input.intentionRef, ['intentionId', 'intentionDigest'], 'intentionRef');
    intentionRef = { intentionId: safeId(input.intentionRef.intentionId, 'intentionRef.intentionId'), intentionDigest: digest64(input.intentionRef.intentionDigest, 'intentionRef.intentionDigest') };
  }
  let resourcePrediction = null;
  if (input.resourcePrediction != null) {
    exactKeys(input.resourcePrediction, ['cpuClass', 'memoryMiB', 'wallTimeMs', 'confidence'], 'resourcePrediction');
    const cpuClass = String(input.resourcePrediction.cpuClass || '').toUpperCase();
    const confidence = String(input.resourcePrediction.confidence || '').toUpperCase();
    if (!['TINY', 'LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'].includes(cpuClass)) throw typedError('RESOURCE_PREDICTION', 'resourcePrediction.cpuClass is unsupported');
    if (!['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'].includes(confidence)) throw typedError('RESOURCE_PREDICTION', 'resourcePrediction.confidence is unsupported');
    resourcePrediction = {
      cpuClass,
      memoryMiB: input.resourcePrediction.memoryMiB == null ? null : boundedInteger(input.resourcePrediction.memoryMiB, 0, 1048576, null, 'resourcePrediction.memoryMiB'),
      wallTimeMs: input.resourcePrediction.wallTimeMs == null ? null : boundedInteger(input.resourcePrediction.wallTimeMs, 0, 604800000, null, 'resourcePrediction.wallTimeMs'),
      confidence
    };
  }
  exactKeys(input.limits, ['timeoutMs', 'killGraceMs', 'stdoutBytes', 'stderrBytes', 'sampleIntervalMs'], 'limits');
  const request = {
    schema: REQUEST_SCHEMA,
    requestId: safeId(input.requestId, 'requestId'),
    sessionId: safeId(input.sessionId, 'sessionId'),
    action,
    intentionRef,
    reason: cleanText(input.reason, 4000, 'reason'),
    command: input.command == null ? null : normalizeCommand(input.command),
    expectedObservation: input.expectedObservation == null ? null : cleanText(input.expectedObservation, 4000, 'expectedObservation'),
    resourcePrediction,
    recoveryPath: input.recoveryPath == null ? null : cleanText(input.recoveryPath, 4000, 'recoveryPath'),
    limits: {
      timeoutMs: boundedInteger(input.limits.timeoutMs, 1, 604800000, 300000, 'limits.timeoutMs'),
      killGraceMs: boundedInteger(input.limits.killGraceMs, 0, 60000, 2000, 'limits.killGraceMs'),
      stdoutBytes: boundedInteger(input.limits.stdoutBytes, 0, 16 * 1024 * 1024, 1024 * 1024, 'limits.stdoutBytes'),
      stderrBytes: boundedInteger(input.limits.stderrBytes, 0, 16 * 1024 * 1024, 1024 * 1024, 'limits.stderrBytes'),
      sampleIntervalMs: boundedInteger(input.limits.sampleIntervalMs, 50, 60000, 250, 'limits.sampleIntervalMs')
    }
  };
  if (action === 'RUN' && (!request.intentionRef || !request.command || !request.expectedObservation || !request.resourcePrediction || !request.recoveryPath)) {
    throw typedError('RUN_LINEAGE', 'RUN requires intentionRef, command, expectedObservation, resourcePrediction, and recoveryPath');
  }
  if (action === 'PROBE' && (request.intentionRef || request.command || request.expectedObservation || request.resourcePrediction || request.recoveryPath)) {
    throw typedError('PROBE_SHAPE', 'PROBE does not accept execution fields');
  }
  return stable(request);
}

function publicOrDigest(value, mode) {
  const bytes = Buffer.from(value, 'utf8');
  return mode === 'PUBLIC' ? { logMode: 'PUBLIC', value, characters: value.length, bytes: bytes.length, sha256: sha256(bytes) } : { logMode: 'HASH_ONLY', value: null, characters: value.length, bytes: bytes.length, sha256: sha256(bytes) };
}

function commandSummary(command) {
  if (!command) return null;
  const stdin = command.stdin == null ? null : publicOrDigest(command.stdin.encoding === 'BASE64' ? command.stdin.data : command.stdin.data, command.stdin.logMode);
  if (stdin) stdin.encoding = command.stdin.encoding;
  const inheritedEnvironment = command.inheritEnvironment
    ? Object.keys(process.env).sort().map(name => [name, sha256(String(process.env[name] == null ? '' : process.env[name]))])
    : [];
  return stable({
    executable: publicOrDigest(command.executable, command.executableLogMode),
    arguments: command.arguments.map(item => publicOrDigest(item.value, item.logMode)),
    cwd: command.cwd,
    environment: command.environment.map(item => ({ name: item.name, ...publicOrDigest(item.value, item.logMode) })),
    inheritedEnvironment: {
      enabled: command.inheritEnvironment,
      names: inheritedEnvironment.map(item => item[0]),
      valueDigest: command.inheritEnvironment ? sha256(inheritedEnvironment) : null
    },
    stdin,
    shell: false
  });
}

function assertStateRoot(root) {
  const resolved = path.resolve(String(root || ''));
  fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw typedError('STATE_ROOT', 'executor state root must be a real directory');
  return resolved;
}

function assertInside(parent, target, label) {
  const root = path.resolve(parent);
  const child = path.resolve(target);
  if (child === root || !child.startsWith(root + path.sep)) throw typedError('PATH_BOUNDARY', `${label} must remain inside executor state`);
  return child;
}

function verifyExecutionLog(logPath) {
  const text = fs.readFileSync(logPath, 'utf8');
  const lines = text.length ? text.split(/\r?\n/).filter(Boolean) : [];
  let previous = null;
  let sessionId = null;
  const eventTypes = {};
  for (let index = 0; index < lines.length; index += 1) {
    let entry;
    try { entry = JSON.parse(lines[index]); }
    catch { throw typedError('LOG_PARSE', `execution log line ${index + 1} is not JSON`); }
    if (entry.schema !== LOG_SCHEMA || entry.sequence !== index + 1) throw typedError('LOG_SEQUENCE', `execution log line ${index + 1} shape or sequence changed`);
    if (sessionId == null) sessionId = entry.sessionId;
    if (entry.sessionId !== sessionId || entry.previousDigest !== previous) throw typedError('LOG_LINEAGE', `execution log line ${index + 1} lineage changed`);
    const declared = entry.entryDigest;
    const base = { ...entry };
    delete base.entryDigest;
    if (sha256(base) !== declared) throw typedError('LOG_DIGEST', `execution log line ${index + 1} digest changed`);
    previous = declared;
    eventTypes[entry.eventType] = (eventTypes[entry.eventType] || 0) + 1;
  }
  return stable({ schema: 'axm.mirror.code-clone-vm-execution-log-verification/v1', state: 'PASS', sessionId, entries: lines.length, eventTypes, finalDigest: previous });
}

async function withLogLock(lockPath, operation, timeoutMs = 5000) {
  const started = Date.now();
  let handle;
  while (!handle) {
    try { handle = fs.openSync(lockPath, 'wx', 0o600); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() - started >= timeoutMs) throw typedError('LOG_LOCK_TIMEOUT', 'execution log lock remained occupied');
      await new Promise(resolve => setTimeout(resolve, 15));
    }
  }
  try { return await operation(); }
  finally {
    try { fs.closeSync(handle); } catch {}
    try { fs.unlinkSync(lockPath); } catch {}
  }
}

async function appendExecutionLog(stateRoot, request, eventType, outcome) {
  const sessionRoot = assertInside(stateRoot, path.join(stateRoot, 'vm-executor-sessions', request.sessionId), 'session root');
  fs.mkdirSync(sessionRoot, { recursive: true, mode: 0o700 });
  const logPath = assertInside(sessionRoot, path.join(sessionRoot, 'execution-events.jsonl'), 'execution log');
  const lockPath = assertInside(sessionRoot, path.join(sessionRoot, 'execution-events.lock'), 'execution log lock');
  return withLogLock(lockPath, async () => {
    const verification = fs.existsSync(logPath) ? verifyExecutionLog(logPath) : { entries: 0, finalDigest: null };
    if (verification.sessionId && verification.sessionId !== request.sessionId) throw typedError('LOG_SESSION', 'execution log belongs to another session');
    const base = stable({
      schema: LOG_SCHEMA,
      sessionId: request.sessionId,
      sequence: verification.entries + 1,
      recordedAt: new Date().toISOString(),
      eventType,
      requestId: request.requestId,
      action: request.action,
      intentionRef: request.intentionRef,
      reason: request.reason,
      command: commandSummary(request.command),
      outcome,
      authority: { decisionAuthority: false, evidenceAdmission: false, trainingAdmission: false, parentWrite: false, canonChange: false, vmLocalExecution: request.action === 'RUN' },
      previousDigest: verification.finalDigest
    });
    const entry = stable({ ...base, entryDigest: sha256(base) });
    fs.appendFileSync(logPath, `${canonical(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
    const checked = verifyExecutionLog(logPath);
    return { relativePath: path.relative(stateRoot, logPath).split(path.sep).join('/'), entries: checked.entries, finalDigest: checked.finalDigest };
  });
}

function decodeCaptured(chunks) { return Buffer.concat(chunks).toString('utf8'); }

function captureAccumulator(limit, onExceeded) {
  const hash = crypto.createHash('sha256');
  const chunks = [];
  let retained = 0;
  let total = 0;
  let exceeded = false;
  return {
    add(chunk) {
      const bytes = Buffer.from(chunk);
      total += bytes.length;
      hash.update(bytes);
      if (retained < limit) {
        const keep = bytes.subarray(0, Math.min(bytes.length, limit - retained));
        if (keep.length) chunks.push(keep);
        retained += keep.length;
      }
      if (total > limit && !exceeded) { exceeded = true; onExceeded(); }
    },
    finish() {
      return { encoding: 'UTF8_WITH_REPLACEMENT', text: decodeCaptured(chunks), capturedBytes: retained, totalBytes: total, sha256: hash.digest('hex'), truncated: total > retained };
    }
  };
}

function readLinuxProcessSample(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const close = stat.lastIndexOf(')');
    if (close < 0) return null;
    const fields = stat.slice(close + 2).trim().split(/\s+/);
    return {
      recordedAt: new Date().toISOString(),
      userCpuTicks: Number(fields[11]),
      systemCpuTicks: Number(fields[12]),
      startTimeTicks: Number(fields[19]),
      residentSetPages: Number(fields[21])
    };
  } catch { return null; }
}

function hostSample() {
  return { recordedAt: new Date().toISOString(), loadAverage: os.loadavg(), freeMemoryBytes: os.freemem(), totalMemoryBytes: os.totalmem() };
}

function buildEnvironment(command) {
  const env = command.inheritEnvironment ? { ...process.env } : {};
  for (const item of command.environment) env[item.name] = item.value;
  return env;
}

function terminateTree(child, platform, signal) {
  if (!child || !child.pid) return false;
  try {
    if (platform === 'linux') process.kill(-child.pid, signal);
    else child.kill(signal);
    return true;
  } catch { return false; }
}

async function runCommand(request, activation, options = {}) {
  const command = request.command;
  const platform = options.platform || process.platform;
  const startHost = hostSample();
  const startedAt = Date.now();
  const samples = [];
  let child;
  let termination = null;
  let softKillTimer = null;
  let timeoutTimer = null;
  let sampleTimer = null;
  let settled = false;
  const result = await new Promise(resolve => {
    function terminate(reason) {
      if (termination) return;
      termination = reason;
      terminateTree(child, platform, 'SIGTERM');
      softKillTimer = setTimeout(() => terminateTree(child, platform, 'SIGKILL'), request.limits.killGraceMs);
      if (softKillTimer.unref) softKillTimer.unref();
    }
    const stdout = captureAccumulator(request.limits.stdoutBytes, () => terminate('STDOUT_LIMIT'));
    const stderr = captureAccumulator(request.limits.stderrBytes, () => terminate('STDERR_LIMIT'));
    try {
      child = (options.spawn || spawn)(command.executable, command.arguments.map(item => item.value), {
        cwd: command.cwd || activation.marker.roots.workshop,
        env: buildEnvironment(command),
        shell: false,
        detached: platform === 'linux',
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (error) {
      resolve({ spawnError: error, stdout: stdout.finish(), stderr: stderr.finish(), exitCode: null, signal: null });
      return;
    }
    if (command.stdin) child.stdin.end(command.stdin.encoding === 'BASE64' ? Buffer.from(command.stdin.data, 'base64') : Buffer.from(command.stdin.data, 'utf8'));
    else child.stdin.end();
    child.stdout.on('data', chunk => stdout.add(chunk));
    child.stderr.on('data', chunk => stderr.add(chunk));
    timeoutTimer = setTimeout(() => terminate('TIMEOUT'), request.limits.timeoutMs);
    if (timeoutTimer.unref) timeoutTimer.unref();
    sampleTimer = setInterval(() => {
      const sample = platform === 'linux' ? readLinuxProcessSample(child.pid) : null;
      if (sample) samples.push(sample);
    }, request.limits.sampleIntervalMs);
    if (sampleTimer.unref) sampleTimer.unref();
    child.once('error', error => {
      if (settled) return;
      settled = true;
      resolve({ spawnError: error, stdout: stdout.finish(), stderr: stderr.finish(), exitCode: null, signal: null });
    });
    child.once('close', (exitCode, signal) => {
      if (settled) return;
      settled = true;
      resolve({ spawnError: null, stdout: stdout.finish(), stderr: stderr.finish(), exitCode, signal });
    });
  });
  if (timeoutTimer) clearTimeout(timeoutTimer);
  if (softKillTimer) clearTimeout(softKillTimer);
  if (sampleTimer) clearInterval(sampleTimer);
  const lastSample = platform === 'linux' && child && child.pid ? readLinuxProcessSample(child.pid) : null;
  if (lastSample) samples.push(lastSample);
  const state = !result.spawnError && termination == null && result.exitCode === 0 ? 'PASS' : 'FAILED';
  return stable({
    state,
    process: { pid: child && child.pid ? child.pid : null, processGroupRequested: platform === 'linux', exitCode: result.exitCode, signal: result.signal, termination, spawnError: result.spawnError ? { code: result.spawnError.code || 'SPAWN_ERROR', message: String(result.spawnError.message || result.spawnError) } : null },
    stdout: result.stdout,
    stderr: result.stderr,
    resources: {
      wallTimeMs: Date.now() - startedAt,
      processSampleScope: platform === 'linux' ? 'DIRECT_PROCESS_PROCFS_ONLY_NOT_DESCENDANT_TREE' : 'UNAVAILABLE_NON_LINUX_TEST_HOST',
      samples,
      startHost,
      endHost: hostSample(),
      prediction: request.resourcePrediction
    }
  });
}

function baseAuthority() {
  return {
    intelligence: 'MIRROR_ITSELF',
    secondAiProvider: false,
    decisionAuthority: false,
    evidenceAdmission: false,
    trainingAdmission: false,
    permissionGrant: false,
    releaseDecision: false,
    parentMirrorWrite: false,
    mainWorkshopWrite: false,
    hostOrHypervisorWrite: false,
    canonChange: false
  };
}

function finalizeReceipt(input) {
  const base = stable(input);
  return stable({ ...base, receiptDigest: sha256(base) });
}

function verifyReceipt(receipt) {
  if (!receipt || receipt.schema !== RECEIPT_SCHEMA || !/^[a-f0-9]{64}$/.test(String(receipt.receiptDigest || ''))) throw typedError('RECEIPT', 'execution receipt is invalid');
  const base = { ...receipt };
  delete base.receiptDigest;
  if (sha256(base) !== receipt.receiptDigest) throw typedError('RECEIPT_DIGEST', 'execution receipt digest changed');
  if (!receipt.authority || receipt.authority.decisionAuthority !== false || receipt.authority.evidenceAdmission !== false || receipt.authority.parentMirrorWrite !== false || receipt.authority.canonChange !== false) throw typedError('RECEIPT_AUTHORITY', 'execution receipt authority changed');
  return true;
}

async function execute(rawRequest, options = {}) {
  const request = normalizeRequest(rawRequest);
  const requestDigest = sha256(request);
  const activation = probeActivation(options);
  const activationView = stable({
    state: activation.state,
    code: activation.code,
    platform: activation.platform,
    markerPath: activation.markerPath,
    markerSha256: activation.markerSha256 || null,
    vmId: activation.marker ? activation.marker.vmId : null,
    cloneId: activation.marker ? activation.marker.cloneId : null,
    boundaryEvidence: activation.boundaryEvidence || null,
    verifiedByMachine: activation.marker ? activation.marker.vmBoundary.verifiedByMachine : false,
    reason: activation.reason || null
  });
  if (request.action === 'PROBE') {
    return finalizeReceipt({
      schema: RECEIPT_SCHEMA,
      receiptId: `vm-execution-${requestDigest.slice(0, 24)}`,
      recordedAt: new Date().toISOString(),
      requestId: request.requestId,
      sessionId: request.sessionId,
      action: 'PROBE',
      state: activation.state === 'ACTIVE' ? 'PASS' : 'HELD',
      requestDigest,
      activation: activationView,
      command: null,
      outcome: { state: activation.state, code: activation.code, reason: activation.reason || null },
      resources: { executionStarted: false },
      log: null,
      authority: baseAuthority()
    });
  }
  if (activation.state !== 'ACTIVE') {
    return finalizeReceipt({
      schema: RECEIPT_SCHEMA,
      receiptId: `vm-execution-${requestDigest.slice(0, 24)}`,
      recordedAt: new Date().toISOString(),
      requestId: request.requestId,
      sessionId: request.sessionId,
      action: 'RUN',
      state: 'HELD',
      requestDigest,
      activation: activationView,
      command: commandSummary(request.command),
      outcome: { state: 'HELD', code: activation.code, reason: activation.reason },
      resources: { executionStarted: false, prediction: request.resourcePrediction },
      log: null,
      authority: baseAuthority()
    });
  }
  const stateRoot = assertStateRoot(options.stateDirOverride || activation.marker.roots.state);
  const requested = await appendExecutionLog(stateRoot, request, 'EXECUTION_REQUEST', { state: 'REQUESTED', requestDigest, expectedObservationSha256: sha256(request.expectedObservation), recoveryPathSha256: sha256(request.recoveryPath), resourcePrediction: request.resourcePrediction });
  let observation;
  try { observation = await runCommand(request, activation, options); }
  catch (error) {
    observation = { state: 'FAILED', process: { pid: null, processGroupRequested: activation.platform === 'linux', exitCode: null, signal: null, termination: null, spawnError: { code: error.code || 'EXECUTOR_ERROR', message: error.message } }, stdout: null, stderr: null, resources: { wallTimeMs: 0, prediction: request.resourcePrediction } };
  }
  const compactOutcome = stable({
    state: observation.state,
    exitCode: observation.process.exitCode,
    signal: observation.process.signal,
    termination: observation.process.termination,
    spawnErrorCode: observation.process.spawnError ? observation.process.spawnError.code : null,
    stdoutBytes: observation.stdout ? observation.stdout.totalBytes : 0,
    stdoutSha256: observation.stdout ? observation.stdout.sha256 : null,
    stderrBytes: observation.stderr ? observation.stderr.totalBytes : 0,
    stderrSha256: observation.stderr ? observation.stderr.sha256 : null,
    wallTimeMs: observation.resources.wallTimeMs
  });
  const log = await appendExecutionLog(stateRoot, request, observation.state === 'PASS' ? 'EXECUTION_RESULT' : 'EXECUTION_FAILURE', compactOutcome);
  return finalizeReceipt({
    schema: RECEIPT_SCHEMA,
    receiptId: `vm-execution-${requestDigest.slice(0, 24)}`,
    recordedAt: new Date().toISOString(),
    requestId: request.requestId,
    sessionId: request.sessionId,
    action: 'RUN',
    state: observation.state,
    requestDigest,
    activation: activationView,
    command: commandSummary(request.command),
    outcome: { expectedObservation: request.expectedObservation, recoveryPath: request.recoveryPath, process: observation.process, stdout: observation.stdout, stderr: observation.stderr },
    resources: observation.resources,
    log: { ...log, requestedEntryDigest: requested.finalDigest },
    authority: baseAuthority()
  });
}

module.exports = {
  ORGAN_ID,
  ACTIVATION_SCHEMA,
  REQUEST_SCHEMA,
  RECEIPT_SCHEMA,
  LOG_SCHEMA,
  VM_ID,
  ENABLE_TOKEN,
  DEFAULT_MARKER_PATH,
  stable,
  canonical,
  sha256,
  normalizeMarker,
  normalizeRequest,
  commandSummary,
  probeActivation,
  verifyExecutionLog,
  verifyReceipt,
  execute
};
