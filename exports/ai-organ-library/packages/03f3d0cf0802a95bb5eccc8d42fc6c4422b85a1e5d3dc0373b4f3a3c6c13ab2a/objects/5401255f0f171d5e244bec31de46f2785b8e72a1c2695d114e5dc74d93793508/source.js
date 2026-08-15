'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const Browser = require('./code-clone-web-browser-organ');
const Executor = require('./code-clone-vm-executor-organ');

const ORGAN_ID = 'axm.mirror.organ/code-clone-native-agency-supervisor-v1';
const TURN_SCHEMA = 'axm.mirror.code-clone-native-agency-turn/v1';
const RECEIPT_SCHEMA = 'axm.mirror.code-clone-native-agency-supervisor-receipt/v1';
const LOG_SCHEMA_V1 = 'axm.mirror.code-clone-native-agency-supervisor-log-entry/v1';
const LOG_SCHEMA = 'axm.mirror.code-clone-native-agency-supervisor-log-entry/v2';
const ACTIONS = new Set(['REST', 'HOLD', 'BROWSER', 'EXECUTE_VM', 'REQUEST_PULSE', 'STOP_EXPERIMENT']);
const FORBIDDEN_REASONING_KEYS = /^(chain[-_ ]?of[-_ ]?thought|hidden[-_ ]?reasoning|private[-_ ]?reasoning|scratchpad|internal[-_ ]?monologue)$/i;

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

function scanForbiddenReasoning(value, trail = ['envelope']) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_REASONING_KEYS.test(key)) throw typedError('PRIVATE_REASONING', `private hidden reasoning field refused at ${trail.concat(key).join('.')}`);
    scanForbiddenReasoning(child, trail.concat(key));
  }
}

function safeId(value, label, pattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/, maximum = 160) {
  const output = String(value == null ? '' : value).trim();
  if (!output || output.length > maximum || !pattern.test(output)) throw typedError('IDENTITY', `${label} must be a safe machine identifier`);
  return output;
}

function cleanText(value, maximum, label, allowEmpty = false) {
  if (typeof value !== 'string' || value.includes('\u0000')) throw typedError('TEXT', `${label} must be UTF-8 text without null bytes`);
  const output = value.normalize('NFC');
  if ((!allowEmpty && output.trim().length === 0) || output.length > maximum) throw typedError('TEXT', `${label} length is invalid`);
  return output;
}

function safeClone(value, label) {
  try { return JSON.parse(JSON.stringify(value)); }
  catch { throw typedError('JSON_VALUE', `${label} must be finite JSON data`); }
}

function authority() {
  return { humanProseDecisionAuthority: false, permissionGrant: false, evidenceAdmission: false, trainingAdmission: false, parentWrite: false, canonChange: false };
}

function normalizeAuthority(input) {
  exactKeys(input, ['humanProseDecisionAuthority', 'permissionGrant', 'evidenceAdmission', 'trainingAdmission', 'parentWrite', 'canonChange'], 'authority');
  if (Object.values(input).some(value => value !== false)) throw typedError('AUTHORITY', 'agency envelope authority must remain false');
  return authority();
}

function normalizeRefs(items, label) {
  if (!Array.isArray(items) || items.length > 4096) throw typedError('FRAME_LIST', `${label} must contain at most 4096 JSON records`);
  return items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw typedError('FRAME_LIST', `${label}[${index}] must be an object`);
    return stable(safeClone(item, `${label}[${index}]`));
  });
}

function normalizeFrameEnvelope(input) {
  scanForbiddenReasoning(input);
  exactKeys(input, ['schema', 'messageType', 'turnId', 'cloneId', 'createdAt', 'frame', 'decision', 'authority'], 'agency frame envelope');
  if (input.schema !== TURN_SCHEMA || input.messageType !== 'FRAME' || input.decision !== null) throw typedError('FRAME_SCHEMA', 'agency frame envelope is unsupported');
  if (!Number.isFinite(Date.parse(String(input.createdAt)))) throw typedError('FRAME_TIME', 'createdAt must be an ISO date-time');
  exactKeys(input.frame, ['heartbeat', 'body', 'signals', 'memoryRefs', 'recentOutcomeRefs', 'capabilities', 'freedom'], 'agency frame');
  exactKeys(input.frame.freedom, ['goalAuthority', 'humanDirectiveRequired', 'requiredGoal', 'reward', 'competition', 'restValid', 'failureValid', 'unknownValid'], 'agency freedom');
  const expectedFreedom = { goalAuthority: 'CLONE_SELF', humanDirectiveRequired: false, requiredGoal: null, reward: false, competition: false, restValid: true, failureValid: true, unknownValid: true };
  if (canonical(input.frame.freedom) !== canonical(expectedFreedom)) throw typedError('FREEDOM', 'agency frame freedom contract changed');
  for (const name of ['heartbeat', 'body']) if (!input.frame[name] || typeof input.frame[name] !== 'object' || Array.isArray(input.frame[name])) throw typedError('FRAME_OBJECT', `frame.${name} must be an object`);
  return stable({
    schema: TURN_SCHEMA,
    messageType: 'FRAME',
    turnId: safeId(input.turnId, 'turnId'),
    cloneId: safeId(input.cloneId, 'cloneId', /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/, 200),
    createdAt: new Date(input.createdAt).toISOString(),
    frame: {
      heartbeat: stable(safeClone(input.frame.heartbeat, 'frame.heartbeat')),
      body: stable(safeClone(input.frame.body, 'frame.body')),
      signals: normalizeRefs(input.frame.signals, 'frame.signals'),
      memoryRefs: normalizeRefs(input.frame.memoryRefs, 'frame.memoryRefs'),
      recentOutcomeRefs: normalizeRefs(input.frame.recentOutcomeRefs, 'frame.recentOutcomeRefs'),
      capabilities: normalizeRefs(input.frame.capabilities, 'frame.capabilities'),
      freedom: expectedFreedom
    },
    decision: null,
    authority: normalizeAuthority(input.authority)
  });
}

function normalizeDecisionEnvelope(input, frame) {
  scanForbiddenReasoning(input);
  exactKeys(input, ['schema', 'messageType', 'turnId', 'cloneId', 'createdAt', 'frame', 'decision', 'authority'], 'agency decision envelope');
  if (input.schema !== TURN_SCHEMA || input.messageType !== 'DECISION' || input.frame !== null) throw typedError('DECISION_SCHEMA', 'agency decision envelope is unsupported');
  if (input.turnId !== frame.turnId || input.cloneId !== frame.cloneId) throw typedError('DECISION_BINDING', 'agency decision does not bind the exact frame turn and clone');
  if (!Number.isFinite(Date.parse(String(input.createdAt)))) throw typedError('DECISION_TIME', 'createdAt must be an ISO date-time');
  exactKeys(input.decision, ['decisionId', 'source', 'action', 'reason', 'expectedNextObservation', 'request', 'restMs'], 'agency decision');
  const source = String(input.decision.source || '').toUpperCase();
  if (!['MIRROR_NATIVE_AGENCY', 'SUPERVISOR_HOLD_NOT_MIRROR'].includes(source)) throw typedError('DECISION_SOURCE', 'decision source is unsupported');
  const action = String(input.decision.action || '').toUpperCase();
  if (!ACTIONS.has(action)) throw typedError('DECISION_ACTION', 'decision action is unsupported');
  const decision = {
    decisionId: safeId(input.decision.decisionId, 'decision.decisionId'),
    source,
    action,
    reason: cleanText(input.decision.reason, 4000, 'decision.reason'),
    expectedNextObservation: input.decision.expectedNextObservation == null ? null : cleanText(input.decision.expectedNextObservation, 4000, 'decision.expectedNextObservation'),
    request: input.decision.request == null ? null : stable(safeClone(input.decision.request, 'decision.request')),
    restMs: input.decision.restMs == null ? null : Number(input.decision.restMs)
  };
  if (decision.restMs != null && (!Number.isInteger(decision.restMs) || decision.restMs < 0 || decision.restMs > 86400000)) throw typedError('REST', 'decision.restMs is out of range');
  if (source === 'SUPERVISOR_HOLD_NOT_MIRROR' && action !== 'HOLD') throw typedError('DECISION_SOURCE', 'supervisor infrastructure may only emit HOLD');
  if (action === 'REST' && (decision.request != null || decision.restMs == null)) throw typedError('REST', 'REST requires restMs and no request');
  if (['HOLD', 'STOP_EXPERIMENT'].includes(action) && (decision.request != null || decision.restMs != null)) throw typedError('DECISION_PAYLOAD', `${action} accepts no request or restMs`);
  if (['BROWSER', 'EXECUTE_VM', 'REQUEST_PULSE'].includes(action) && (!decision.request || decision.restMs != null)) throw typedError('DECISION_PAYLOAD', `${action} requires a request and no restMs`);
  if (action === 'BROWSER') Browser.normalizeRequest(decision.request);
  if (action === 'EXECUTE_VM') Executor.normalizeRequest(decision.request);
  return stable({
    schema: TURN_SCHEMA,
    messageType: 'DECISION',
    turnId: frame.turnId,
    cloneId: frame.cloneId,
    createdAt: new Date(input.createdAt).toISOString(),
    frame: null,
    decision,
    authority: normalizeAuthority(input.authority)
  });
}

function supervisorHold(frame, code, reason) {
  return normalizeDecisionEnvelope({
    schema: TURN_SCHEMA,
    messageType: 'DECISION',
    turnId: frame.turnId,
    cloneId: frame.cloneId,
    createdAt: new Date().toISOString(),
    frame: null,
    decision: { decisionId: `hold-${sha256(`${frame.turnId}\0${code}`).slice(0, 24)}`, source: 'SUPERVISOR_HOLD_NOT_MIRROR', action: 'HOLD', reason: `${code}: ${reason}`.slice(0, 4000), expectedNextObservation: null, request: null, restMs: null },
    authority: authority()
  }, frame);
}

function inside(root, target) {
  const absoluteRoot = path.resolve(root);
  const absolute = path.resolve(target);
  const left = process.platform === 'win32' ? absolute.toLowerCase() : absolute;
  const right = process.platform === 'win32' ? absoluteRoot.toLowerCase() : absoluteRoot;
  return left !== right && left.startsWith(right + path.sep);
}

function validateAgencyCommand(config, mirrorRoot) {
  exactKeys(config, ['runtimeExecutable', 'entrypoint', 'arguments', 'timeoutMs', 'maxOutputBytes'], 'agency command');
  const root = path.resolve(mirrorRoot);
  const entrypoint = path.resolve(config.entrypoint);
  if (!inside(root, entrypoint)) throw typedError('AGENCY_ENTRYPOINT', 'Mirror-native agency entrypoint must remain inside the clone Mirror root');
  const stat = fs.lstatSync(entrypoint);
  if (!stat.isFile() || stat.isSymbolicLink()) throw typedError('AGENCY_ENTRYPOINT', 'Mirror-native agency entrypoint must be a real file');
  if (!Array.isArray(config.arguments) || config.arguments.length > 256 || config.arguments.some(value => typeof value !== 'string' || value.includes('\u0000') || value.length > 65536)) throw typedError('AGENCY_ARGUMENTS', 'agency command arguments are invalid');
  const timeoutMs = Number(config.timeoutMs);
  const maxOutputBytes = Number(config.maxOutputBytes);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 3600000) throw typedError('AGENCY_LIMIT', 'agency timeout is out of range');
  if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1024 || maxOutputBytes > 16 * 1024 * 1024) throw typedError('AGENCY_LIMIT', 'agency output limit is out of range');
  return { runtimeExecutable: cleanText(config.runtimeExecutable, 8192, 'agency runtimeExecutable'), entrypoint, arguments: config.arguments.slice(), timeoutMs, maxOutputBytes, mirrorRoot: root };
}

async function invokeCommand(frame, config) {
  return new Promise(resolve => {
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let overflow = false;
    let settled = false;
    let child;
    try {
      child = spawn(config.runtimeExecutable, [config.entrypoint, ...config.arguments], { cwd: config.mirrorRoot, env: { ...process.env, AXM_MIRROR_NATIVE_AGENCY: '1' }, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (error) { resolve({ ok: false, code: 'AGENCY_SPAWN', reason: error.message }); return; }
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, config.timeoutMs);
    child.stdout.on('data', chunk => {
      if (stdout.length + chunk.length > config.maxOutputBytes) { overflow = true; try { child.kill('SIGKILL'); } catch {} }
      else stdout = Buffer.concat([stdout, chunk]);
    });
    child.stderr.on('data', chunk => { stderr = Buffer.concat([stderr, chunk]).subarray(-65536); });
    child.once('error', error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, code: 'AGENCY_PROCESS_ERROR', reason: error.message, stderrSha256: sha256(stderr) });
    });
    child.once('close', exitCode => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (overflow) { resolve({ ok: false, code: 'AGENCY_OUTPUT_LIMIT', reason: 'Mirror-native agency response exceeded the output ceiling', stderrSha256: sha256(stderr) }); return; }
      if (exitCode !== 0) { resolve({ ok: false, code: 'AGENCY_EXIT', reason: `Mirror-native agency exited ${exitCode}`, stderrSha256: sha256(stderr) }); return; }
      let parsed;
      try { parsed = JSON.parse(stdout.toString('utf8').trim()); }
      catch { resolve({ ok: false, code: 'AGENCY_RESPONSE_JSON', reason: 'Mirror-native agency output was not one JSON decision', stdoutSha256: sha256(stdout), stderrSha256: sha256(stderr) }); return; }
      resolve({ ok: true, value: parsed, stdoutSha256: sha256(stdout), stderrSha256: sha256(stderr) });
    });
    child.stdin.end(`${canonical(frame)}\n`);
  });
}

async function invokeNativeAgency(frame, options = {}) {
  if (typeof options.agencyFunction === 'function') {
    try { return { state: 'RETURNED', decision: normalizeDecisionEnvelope(await options.agencyFunction(frame), frame), evidence: { mode: 'INJECTED_TEST_OR_COMPOSED_MIRROR_FUNCTION', responseDigest: null } }; }
    catch (error) { return { state: 'HELD', decision: supervisorHold(frame, error.code || 'AGENCY_FUNCTION', error.message), evidence: { mode: 'INJECTED_TEST_OR_COMPOSED_MIRROR_FUNCTION', responseDigest: null } }; }
  }
  if (!options.agencyCommand || !options.mirrorRoot) return { state: 'HELD', decision: supervisorHold(frame, 'MIRROR_NATIVE_AGENCY_UNAVAILABLE', 'No clone-Mirror agency entrypoint is bound'), evidence: { mode: 'UNBOUND', responseDigest: null } };
  let config;
  try { config = validateAgencyCommand(options.agencyCommand, options.mirrorRoot); }
  catch (error) { return { state: 'HELD', decision: supervisorHold(frame, error.code || 'AGENCY_COMMAND', error.message), evidence: { mode: 'CLONE_MIRROR_PROCESS', responseDigest: null } }; }
  const invoked = await invokeCommand(frame, config);
  if (!invoked.ok) return { state: 'HELD', decision: supervisorHold(frame, invoked.code, invoked.reason), evidence: { mode: 'CLONE_MIRROR_PROCESS', responseDigest: invoked.stdoutSha256 || null, stderrDigest: invoked.stderrSha256 || null } };
  try {
    return { state: 'RETURNED', decision: normalizeDecisionEnvelope(invoked.value, frame), evidence: { mode: 'CLONE_MIRROR_PROCESS', responseDigest: invoked.stdoutSha256, stderrDigest: invoked.stderrSha256 } };
  } catch (error) {
    return { state: 'HELD', decision: supervisorHold(frame, error.code || 'AGENCY_DECISION', error.message), evidence: { mode: 'CLONE_MIRROR_PROCESS', responseDigest: invoked.stdoutSha256, stderrDigest: invoked.stderrSha256 } };
  }
}

async function routeDecision(decisionEnvelope, options = {}) {
  const decision = decisionEnvelope.decision;
  if (decision.source !== 'MIRROR_NATIVE_AGENCY') return { state: 'HELD', action: 'HOLD', effect: null, reason: decision.reason };
  if (decision.action === 'REST') return { state: 'REST', action: 'REST', effect: { restMs: decision.restMs }, reason: decision.reason };
  if (decision.action === 'HOLD') return { state: 'HELD', action: 'HOLD', effect: null, reason: decision.reason };
  if (decision.action === 'STOP_EXPERIMENT') return { state: 'STOP_REQUESTED', action: 'STOP_EXPERIMENT', effect: null, reason: decision.reason };
  if (decision.action === 'REQUEST_PULSE') return { state: 'EXTERNAL_DECISION_REQUIRED', action: 'REQUEST_PULSE', effect: { requestDigest: sha256(decision.request), request: decision.request, granted: false }, reason: decision.reason };
  if (decision.action === 'BROWSER') {
    if (!options.browserSession || typeof options.browserSession.act !== 'function') return { state: 'HELD', action: 'BROWSER', effect: null, reason: 'BROWSER_SESSION_UNAVAILABLE' };
    const receipt = await options.browserSession.act(decision.request);
    Browser.verifyReceipt(receipt);
    return { state: receipt.state, action: 'BROWSER', effect: receipt, reason: decision.reason };
  }
  if (decision.action === 'EXECUTE_VM') {
    const receipt = await Executor.execute(decision.request, options.executorOptions || {});
    Executor.verifyReceipt(receipt);
    return { state: receipt.state, action: 'EXECUTE_VM', effect: receipt, reason: decision.reason };
  }
  throw typedError('ROUTE', 'decision action route is missing');
}

function verifySupervisorLog(logPath) {
  const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).filter(Boolean);
  let previous = null;
  let sessionId = null;
  for (let index = 0; index < lines.length; index += 1) {
    const entry = JSON.parse(lines[index]);
    if (![LOG_SCHEMA_V1, LOG_SCHEMA].includes(entry.schema) || entry.sequence !== index + 1 || entry.previousDigest !== previous) throw typedError('SUPERVISOR_LOG_LINEAGE', `supervisor log line ${index + 1} changed`);
    if (entry.schema === LOG_SCHEMA_V1 && Object.prototype.hasOwnProperty.call(entry, 'routeEffect')) throw typedError('SUPERVISOR_LOG_LINEAGE', `supervisor log line ${index + 1} uses a v2 consequence under the v1 schema`);
    if (entry.schema === LOG_SCHEMA && !Object.prototype.hasOwnProperty.call(entry, 'routeEffect')) throw typedError('SUPERVISOR_LOG_LINEAGE', `supervisor log line ${index + 1} omits its v2 consequence`);
    if (sessionId == null) sessionId = entry.sessionId;
    if (entry.sessionId !== sessionId) throw typedError('SUPERVISOR_LOG_SESSION', 'supervisor log mixes sessions');
    const declared = entry.entryDigest;
    const base = { ...entry };
    delete base.entryDigest;
    if (sha256(base) !== declared) throw typedError('SUPERVISOR_LOG_DIGEST', `supervisor log line ${index + 1} digest changed`);
    previous = declared;
  }
  return { schema: 'axm.mirror.code-clone-native-agency-supervisor-log-verification/v1', state: 'PASS', sessionId, entries: lines.length, finalDigest: previous };
}

function appendSupervisorLog(stateDir, sessionId, frame, invocation, routed) {
  if (!stateDir) return null;
  const root = path.resolve(stateDir);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const sessionRoot = path.resolve(root, 'native-agency-supervisor-sessions', safeId(sessionId, 'sessionId'));
  if (!inside(root, sessionRoot)) throw typedError('SUPERVISOR_STATE', 'supervisor session escaped state root');
  fs.mkdirSync(sessionRoot, { recursive: true, mode: 0o700 });
  const logPath = path.join(sessionRoot, 'turns.jsonl');
  const verified = fs.existsSync(logPath) ? verifySupervisorLog(logPath) : { entries: 0, finalDigest: null };
  const base = stable({
    schema: LOG_SCHEMA,
    sessionId,
    sequence: verified.entries + 1,
    recordedAt: new Date().toISOString(),
    turnId: frame.turnId,
    frameDigest: sha256(frame),
    decisionDigest: sha256(invocation.decision),
    decisionSource: invocation.decision.decision.source,
    action: invocation.decision.decision.action,
    invocationState: invocation.state,
    routeState: routed.state,
    routeEffectDigest: routed.effect == null ? null : sha256(routed.effect),
    routeEffect: consequenceView(routed),
    authority: authority(),
    previousDigest: verified.finalDigest
  });
  const entry = stable({ ...base, entryDigest: sha256(base) });
  fs.appendFileSync(logPath, `${canonical(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
  const after = verifySupervisorLog(logPath);
  return { relativePath: path.relative(root, logPath).split(path.sep).join('/'), entries: after.entries, finalDigest: after.finalDigest };
}

function consequenceView(routed) {
  if (!routed || routed.effect == null) return null;
  if (routed.action === 'BROWSER') {
    const effect = routed.effect || {};
    const result = effect.result && typeof effect.result === 'object' ? effect.result : null;
    const page = result && result.page && typeof result.page === 'object' ? result.page : null;
    return stable({
      action: 'BROWSER',
      state: routed.state,
      effect: {
        requestId: effect.requestId || null,
        action: effect.action || null,
        target: effect.target || null,
        result: result ? {
          kind: result.kind || null,
          page: page ? {
            url: typeof page.url === 'string' ? page.url.slice(0, 8192) : null,
            title: typeof page.title === 'string' ? page.title.slice(0, 500) : '',
            readyState: page.readyState || null,
            pageClass: page.pageClass || null,
            text: typeof page.text === 'string' ? page.text.slice(0, 12000) : null,
            links: Array.isArray(page.links) ? page.links.slice(0, 32).map(item => ({ index: item.index, text: String(item.text || '').slice(0, 500), href: String(item.href || '').slice(0, 8192), rel: String(item.rel || '').slice(0, 200) })) : []
          } : null
        } : null,
        receiptDigest: effect.receiptDigest || null
      }
    });
  }
  if (routed.action === 'EXECUTE_VM') {
    const effect = routed.effect || {};
    const outcome = effect.outcome || {};
    const process = outcome.process || {};
    return stable({
      action: 'EXECUTE_VM',
      state: routed.state,
      effect: {
        requestId: effect.requestId || null,
        receiptDigest: effect.receiptDigest || null,
        process: { exitCode: process.exitCode == null ? null : process.exitCode, signal: process.signal || null },
        stdout: outcome.stdout ? { text: typeof outcome.stdout.text === 'string' ? outcome.stdout.text.slice(0, 12000) : null, sha256: outcome.stdout.sha256 || null, truncated: Boolean(outcome.stdout.truncated) } : null,
        stderr: outcome.stderr ? { text: typeof outcome.stderr.text === 'string' ? outcome.stderr.text.slice(0, 4000) : null, sha256: outcome.stderr.sha256 || null, truncated: Boolean(outcome.stderr.truncated) } : null
      }
    });
  }
  return stable({ action: routed.action, state: routed.state, effect: null });
}

function finalizeReceipt(base) { return stable({ ...base, receiptDigest: sha256(stable(base)) }); }

function verifyReceipt(receipt) {
  if (!receipt || receipt.schema !== RECEIPT_SCHEMA || !/^[a-f0-9]{64}$/.test(String(receipt.receiptDigest || ''))) throw typedError('RECEIPT', 'supervisor receipt is invalid');
  const base = { ...receipt };
  delete base.receiptDigest;
  if (sha256(stable(base)) !== receipt.receiptDigest) throw typedError('RECEIPT_DIGEST', 'supervisor receipt digest changed');
  if (Object.values(receipt.authority || {}).some(value => value !== false)) throw typedError('RECEIPT_AUTHORITY', 'supervisor receipt authority changed');
  return true;
}

async function runTurn(rawFrame, options = {}) {
  const frame = normalizeFrameEnvelope(rawFrame);
  const invocation = await invokeNativeAgency(frame, options);
  const routed = await routeDecision(invocation.decision, options);
  const log = appendSupervisorLog(options.stateDir || null, options.sessionId || frame.cloneId.replace(/[^A-Za-z0-9._:-]/g, '-'), frame, invocation, routed);
  return finalizeReceipt({
    schema: RECEIPT_SCHEMA,
    receiptId: `native-agency-turn-${sha256(`${frame.turnId}\0${sha256(frame)}`).slice(0, 24)}`,
    recordedAt: new Date().toISOString(),
    state: routed.state,
    frameDigest: sha256(frame),
    decision: invocation.decision,
    invocationEvidence: invocation.evidence,
    routed,
    log,
    authority: { humanProseDecisionAuthority: false, permissionGrant: false, evidenceAdmission: false, trainingAdmission: false, parentWrite: false, canonChange: false }
  });
}

module.exports = {
  ORGAN_ID,
  TURN_SCHEMA,
  RECEIPT_SCHEMA,
  LOG_SCHEMA,
  LOG_SCHEMA_V1,
  stable,
  canonical,
  sha256,
  authority,
  normalizeFrameEnvelope,
  normalizeDecisionEnvelope,
  supervisorHold,
  validateAgencyCommand,
  invokeNativeAgency,
  routeDecision,
  verifySupervisorLog,
  consequenceView,
  verifyReceipt,
  runTurn
};
