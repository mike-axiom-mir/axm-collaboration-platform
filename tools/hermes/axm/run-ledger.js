'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RETURN_PACKET_SCHEMA = 'axm.hermes-return-packet/v2';
const LEGACY_RETURN_PACKET_SCHEMA = 'axm.hermes-return-packet/v1';
const MAX_EVIDENCE_BYTES = 1024 * 1024;

class RunLedgerError extends Error {
  constructor(code, message, details) { super(message); this.name = 'RunLedgerError'; this.code = code; this.details = details || null; }
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function hashText(value) { return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : Buffer.from(String(value || ''), 'utf8')).digest('hex'); }
function hashFile(file) { return fs.existsSync(file) ? hashText(fs.readFileSync(file)) : null; }
function now() { return new Date().toISOString(); }
function safeRunId() { return 'run-' + now().replace(/[^0-9]/g, '').slice(0, 14) + '-' + crypto.randomBytes(4).toString('hex'); }
function argvShape(args) { return (args || []).map(arg => String(arg).startsWith('-') ? 'flag' : 'value'); }

function assertPortable(value, at, seen) {
  const location = at || '$';
  const visited = seen || new Set();
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RunLedgerError('NON_PORTABLE_JSON', `Non-finite number at ${location}`);
    return;
  }
  if (typeof value !== 'object') throw new RunLedgerError('NON_PORTABLE_JSON', `Unsupported JSON value at ${location}`);
  if (visited.has(value)) throw new RunLedgerError('NON_PORTABLE_JSON', `Cyclic JSON value at ${location}`);
  visited.add(value);
  if (Array.isArray(value)) value.forEach((entry, index) => assertPortable(entry, `${location}[${index}]`, visited));
  else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new RunLedgerError('NON_PORTABLE_JSON', `Non-plain object at ${location}`);
    for (const key of Object.keys(value)) assertPortable(value[key], `${location}.${key}`, visited);
  }
  visited.delete(value);
}

function stableStringify(value) {
  assertPortable(value);
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function readEvidenceBytes(file, maxBytes) {
  const limit = Number.isInteger(maxBytes) && maxBytes > 0 ? maxBytes : MAX_EVIDENCE_BYTES;
  let stat;
  try { stat = fs.lstatSync(file); } catch (error) { throw new RunLedgerError('EVIDENCE_READ_FAILED', `Cannot inspect evidence ${path.basename(file)}`, { cause: error.code }); }
  if (!stat.isFile()) throw new RunLedgerError('EVIDENCE_NOT_REGULAR', `Evidence is not a regular file: ${path.basename(file)}`);
  if (stat.size < 1 || stat.size > limit) throw new RunLedgerError('EVIDENCE_SIZE_INVALID', `Evidence size outside 1..${limit} bytes: ${path.basename(file)}`);
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
  let fd;
  try {
    fd = fs.openSync(file, flags);
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.size !== stat.size) throw new RunLedgerError('EVIDENCE_CHANGED_DURING_READ', `Evidence changed while opening: ${path.basename(file)}`);
    return fs.readFileSync(fd);
  } finally { if (fd !== undefined) fs.closeSync(fd); }
}

function syncDirectory(directory) {
  const fd = fs.openSync(directory, fs.constants.O_RDONLY);
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function verifyExistingBytes(file, expected) {
  let actual;
  try { actual = readEvidenceBytes(file, Math.max(MAX_EVIDENCE_BYTES, expected.length)); }
  catch (error) { throw new RunLedgerError('EVIDENCE_PATH_CONFLICT', `Occupied evidence path cannot be admitted: ${path.basename(file)}`, { cause: error.code }); }
  if (!actual.equals(expected)) throw new RunLedgerError('EVIDENCE_PATH_CONFLICT', `Occupied evidence path contains different bytes: ${path.basename(file)}`);
}

function publishEvidence(file, bytes) {
  ensureDir(path.dirname(file));
  if (fs.existsSync(file)) { verifyExistingBytes(file, bytes); syncDirectory(path.dirname(file)); return { created: false }; }
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`);
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = undefined;
    try { fs.linkSync(temporary, file); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      verifyExistingBytes(file, bytes);
    }
    syncDirectory(path.dirname(file));
    return { created: true };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.unlinkSync(temporary); } catch (_) {}
  }
}

function packetIdentity(packet) {
  const unsigned = Object.assign({}, packet); delete unsigned.packet_sha256;
  return hashText(stableStringify(unsigned));
}

function verifyReturnPacket(packet, options) {
  try {
    assertPortable(packet);
    if (!packet || packet.schema !== RETURN_PACKET_SCHEMA) throw new RunLedgerError('UNSUPPORTED_RETURN_PACKET', 'Return Packet schema is not v2');
    if (!/^[0-9a-f]{64}$/.test(packet.packet_sha256 || '') || packetIdentity(packet) !== packet.packet_sha256) throw new RunLedgerError('RETURN_PACKET_HASH_DRIFT', 'Return Packet fields do not match packet_sha256');
    if (!/^[0-9a-f]{64}$/.test(packet.run_manifest_sha256 || '')) throw new RunLedgerError('RUN_MANIFEST_HASH_INVALID', 'Return Packet lacks an exact run-manifest identity');
    if (options && options.expectedRunId && packet.run_id !== options.expectedRunId) throw new RunLedgerError('RUN_ID_MISMATCH', 'Return Packet run_id does not match the selected run');
    if (packet.canon !== false || packet.review_required !== true || packet.promotion !== 'candidate-only') throw new RunLedgerError('RETURN_PACKET_AUTHORITY_DRIFT', 'Return Packet widened candidate-only authority');
    if (options && options.runDir) {
      const manifestPath = path.join(options.runDir, 'run-manifest.json');
      const manifestBytes = readEvidenceBytes(manifestPath);
      if (hashText(manifestBytes) !== packet.run_manifest_sha256) throw new RunLedgerError('RUN_MANIFEST_HASH_DRIFT', 'Launch manifest bytes no longer match the completed packet');
      let manifest;
      try { manifest = JSON.parse(manifestBytes.toString('utf8')); } catch (_) { throw new RunLedgerError('RUN_MANIFEST_INVALID', 'Launch manifest is not valid JSON'); }
      if (!manifest || manifest.schema !== 'axm.hermes-run-manifest/v1' || manifest.run_id !== packet.run_id) throw new RunLedgerError('RUN_MANIFEST_MISMATCH', 'Launch manifest does not identify this run');
    }
    return { ok: true, packet_sha256: packet.packet_sha256 };
  } catch (error) { return { ok: false, code: error.code || 'RETURN_PACKET_INVALID', message: error.message }; }
}

function loadReturnPacket(file, options) {
  const bytes = readEvidenceBytes(file);
  let packet;
  try { packet = JSON.parse(bytes.toString('utf8')); } catch (_) { throw new RunLedgerError('RETURN_PACKET_INVALID_JSON', 'Return Packet is not valid JSON'); }
  if (stableStringify(packet) + '\n' !== bytes.toString('utf8')) throw new RunLedgerError('RETURN_PACKET_NONCANONICAL', 'Return Packet bytes are not canonical JSON');
  const verified = verifyReturnPacket(packet, options);
  if (!verified.ok) throw new RunLedgerError(verified.code, verified.message);
  return packet;
}

function inspectRunCompletion(runDir, expectedRunId) {
  const manifestPath = path.join(runDir, 'run-manifest.json');
  try {
    const manifestBytes = readEvidenceBytes(manifestPath);
    const manifest = JSON.parse(manifestBytes.toString('utf8'));
    if (!manifest || manifest.schema !== 'axm.hermes-run-manifest/v1' || (expectedRunId && manifest.run_id !== expectedRunId)) {
      return { state: 'HELD_INVALID', reason: 'run-manifest-mismatch' };
    }
  } catch (error) { return { state: 'HELD_INVALID', reason: error.code || 'run-manifest-invalid' }; }
  const packetPath = path.join(runDir, 'return-packet.json');
  if (!fs.existsSync(packetPath)) return { state: 'INTERRUPTED', reason: 'return-packet-missing' };
  try {
    const bytes = readEvidenceBytes(packetPath);
    let parsed;
    try { parsed = JSON.parse(bytes.toString('utf8')); } catch (_) { return { state: 'HELD_INVALID', reason: 'return-packet-invalid-json' }; }
    if (parsed && parsed.schema === LEGACY_RETURN_PACKET_SCHEMA) return { state: 'HELD_LEGACY_UNSEALED', reason: 'v1-has-no-self-verifying-completion-identity' };
    loadReturnPacket(packetPath, { runDir, expectedRunId });
    return { state: 'COMPLETE', reason: 'sealed-return-packet-admitted' };
  } catch (error) { return { state: 'HELD_INVALID', reason: error.code || 'return-packet-invalid' }; }
}

function createRun(options) {
  const runId = safeRunId();
  const runDir = path.join(options.runtimeRoot, 'runs', runId);
  const stateDir = path.join(runDir, 'state');
  const receiptDir = path.join(runDir, 'receipts');
  const providerReceiptDir = path.join(runDir, 'provider-receipts');
  const sessionEventDir = path.join(runDir, 'session-events');
  [runDir, stateDir, receiptDir, providerReceiptDir, sessionEventDir].forEach(ensureDir);

  const manifest = {
    schema: 'axm.hermes-run-manifest/v1',
    run_id: runId,
    started_at: now(),
    launcher_pid: Number.isInteger(options.launcherPid) ? options.launcherPid : null,
    source: {
      repository: options.sourceLock.repo_url,
      commit: options.sourceLock.commit,
      tree: options.sourceLock.tree || null,
      observed_version: options.sourceLock.observed_version || null,
      verified_before_launch: options.sourceVerified === true
    },
    policy: {
      sha256: hashFile(options.policyFile),
      posture: options.policy.posture,
      consent_enabled: options.policy.consent && options.policy.consent.enabled === true,
      provider_egress_mode: options.policy.provider_egress && options.policy.provider_egress.mode,
      hub_sandbox: options.policy.mode && options.policy.mode.hub_sandbox === true,
      external_mode: options.policy.mode && options.policy.mode.external_mode === true,
      max_run_minutes: options.policy.limits && options.policy.limits.max_run_minutes,
      background_review_enabled: options.policy.learning && options.policy.learning.background_review_enabled === true,
      built_in_memory_enabled: options.policy.learning && (options.policy.learning.memory_enabled === true || options.policy.learning.user_profile_enabled === true)
    },
    profile_sha256: hashFile(options.configFile),
    invocation: {
      argument_count: (options.args || []).length,
      argument_shape: argvShape(options.args),
      raw_arguments_stored: false
    },
    environment_guard: options.environmentReport || null,
    canon: false,
    review_required: true
  };
  publishEvidence(path.join(runDir, 'run-manifest.json'), Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8'));
  return { runId, runDir, stateDir, receiptDir, providerReceiptDir, sessionEventDir, manifest };
}

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; } }
function readJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort().map(name => readJson(path.join(dir, name))).filter(Boolean);
}
function tally(records, key) {
  const out = {};
  for (const record of records) {
    const value = String(record[key] || 'unknown');
    out[value] = (out[value] || 0) + 1;
  }
  return out;
}
function sumStateCounters(dir) {
  const states = readJsonFiles(dir);
  return states.reduce((acc, state) => {
    acc.tool_calls += Number.isFinite(Number(state.tool_calls)) ? Number(state.tool_calls) : 0;
    acc.files_read += Number.isFinite(Number(state.files_read)) ? Number(state.files_read) : 0;
    acc.files_written += Number.isFinite(Number(state.files_written)) ? Number(state.files_written) : 0;
    return acc;
  }, { tool_calls: 0, files_read: 0, files_written: 0 });
}
function receiptSetHash(records) {
  const hashes = records.map(record => String(record.receipt_hash || '')).filter(Boolean).sort();
  return hashText(hashes.join('\n'));
}
function latestSessionEvidence(records) {
  const end = records.filter(r => r.event === 'on_session_end').pop();
  return end ? {
    completed: end.completed,
    failed: end.failed,
    interrupted: end.interrupted,
    turn_exit_reason: end.turn_exit_reason,
    model: end.model,
    platform: end.platform
  } : null;
}

function finalizeRun(options) {
  const packetPath = path.join(options.runDir, 'return-packet.json');
  const prior = inspectRunCompletion(options.runDir, options.runId);
  if (prior.state === 'COMPLETE') return loadReturnPacket(packetPath, { runDir: options.runDir, expectedRunId: options.runId });
  if (prior.state !== 'INTERRUPTED') throw new RunLedgerError('EVIDENCE_PATH_CONFLICT', `Run completion is ${prior.state}; existing evidence was preserved`, prior);
  const toolReceipts = readJsonFiles(options.receiptDir);
  const providerReceipts = readJsonFiles(options.providerReceiptDir);
  const sessionEvents = readJsonFiles(options.sessionEventDir);
  const stateCounters = sumStateCounters(path.join(options.runDir, 'state'));
  const manifestPath = path.join(options.runDir, 'run-manifest.json');
  const manifestBytes = readEvidenceBytes(manifestPath);
  let manifest;
  try { manifest = JSON.parse(manifestBytes.toString('utf8')); } catch (_) { throw new RunLedgerError('RUN_MANIFEST_INVALID', 'Launch manifest is not valid JSON'); }
  if (!manifest || manifest.schema !== 'axm.hermes-run-manifest/v1' || manifest.run_id !== options.runId) throw new RunLedgerError('RUN_MANIFEST_MISMATCH', 'Launch manifest does not identify the selected run');
  const providerMismatch = providerReceipts.some(record => record.policy_mismatch === true);
  const toolReceiptGap = toolReceipts.length < stateCounters.tool_calls;
  const sessionEvidence = latestSessionEvidence(sessionEvents);
  const finalPolicyHash = hashFile(options.policyFile);
  const finalProfileHash = hashFile(options.configFile);
  const initialPolicyHash = manifest.policy && manifest.policy.sha256 || null;
  const initialProfileHash = manifest.profile_sha256 || null;
  const watchdogTimedOut = options.watchdogTimedOut === true;

  const unsignedPacket = {
    schema: RETURN_PACKET_SCHEMA,
    run_id: options.runId,
    run_manifest_sha256: hashText(manifestBytes),
    finished_at: now(),
    process_exit_code: Number.isInteger(options.exitCode) ? options.exitCode : null,
    process_signal: options.signal || null,
    watchdog: {
      max_run_minutes: manifest.policy && manifest.policy.max_run_minutes || null,
      timed_out: watchdogTimedOut,
      process_tree_termination_guaranteed: false
    },
    source_commit: options.sourceLock.commit,
    source_tree: options.sourceLock.tree || null,
    initial_policy_sha256: initialPolicyHash,
    final_policy_sha256: finalPolicyHash,
    initial_profile_sha256: initialProfileHash,
    final_profile_sha256: finalProfileHash,
    tool_receipts: {
      count: toolReceipts.length,
      authorized_tool_calls: stateCounters.tool_calls,
      completion_receipt_count: toolReceipts.length,
      evidence_gap: toolReceiptGap,
      receipt_set_sha256: receiptSetHash(toolReceipts),
      by_tool: tally(toolReceipts, 'tool_name'),
      by_status: tally(toolReceipts, 'status'),
      file_read_authorizations: stateCounters.files_read,
      file_write_authorizations: stateCounters.files_written
    },
    provider_receipts: {
      count: providerReceipts.length,
      receipt_set_sha256: receiptSetHash(providerReceipts),
      by_provider: tally(providerReceipts, 'provider'),
      by_model: tally(providerReceipts, 'model'),
      remote_base_url_observed: providerReceipts.some(record => record.base_url_scope === 'remote'),
      local_only_policy_mismatch_observed: providerMismatch
    },
    session_events: {
      count: sessionEvents.length,
      receipt_set_sha256: receiptSetHash(sessionEvents),
      latest_turn_evidence: sessionEvidence
    },
    outcome: watchdogTimedOut ? 'launcher-watchdog-timeout' :
      sessionEvidence && sessionEvidence.failed === true ? 'session-reported-failure' :
      sessionEvidence && sessionEvidence.interrupted === true ? 'session-reported-interruption' :
      options.exitCode === 0 ? 'process-exited-zero' : 'process-exited-nonzero-or-unknown',
    integrity_flags: {
      tool_receipt_gap: toolReceiptGap,
      provider_policy_mismatch: providerMismatch,
      watchdog_timeout: watchdogTimedOut,
      source_was_verified_before_launch: options.sourceVerified === true,
      source_verified_after_run: options.sourceVerifiedAfter === true,
      policy_changed_during_run: Boolean(initialPolicyHash && finalPolicyHash && initialPolicyHash !== finalPolicyHash),
      profile_changed_during_run: Boolean(initialProfileHash && finalProfileHash && initialProfileHash !== finalProfileHash)
    },
    raw_prompt_stored: false,
    raw_response_stored: false,
    raw_tool_arguments_stored: false,
    raw_tool_results_stored: false,
    canon: false,
    review_required: true,
    promotion: 'candidate-only'
  };
  const packet = Object.assign({}, unsignedPacket, { packet_sha256: packetIdentity(unsignedPacket) });
  const bytes = Buffer.from(stableStringify(packet) + '\n', 'utf8');
  publishEvidence(packetPath, bytes);
  if (options.reportDir) {
    ensureDir(options.reportDir);
    publishEvidence(path.join(options.reportDir, options.runId + '.json'), bytes);
  }
  return packet;
}

module.exports = {
  RETURN_PACKET_SCHEMA, LEGACY_RETURN_PACKET_SCHEMA, RunLedgerError,
  hashText, hashFile, stableStringify, verifyReturnPacket, loadReturnPacket, inspectRunCompletion,
  createRun, finalizeRun
};
