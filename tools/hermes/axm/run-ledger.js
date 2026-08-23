'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function hashText(value) { return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : Buffer.from(String(value || ''), 'utf8')).digest('hex'); }
function hashFile(file) { return fs.existsSync(file) ? hashText(fs.readFileSync(file)) : null; }
function now() { return new Date().toISOString(); }
function safeRunId() { return 'run-' + now().replace(/[^0-9]/g, '').slice(0, 14) + '-' + crypto.randomBytes(4).toString('hex'); }
function argvShape(args) { return (args || []).map(arg => String(arg).startsWith('-') ? 'flag' : 'value'); }

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
      external_mode: options.policy.mode && options.policy.mode.external_mode === true
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
  fs.writeFileSync(path.join(runDir, 'run-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return { runId, runDir, stateDir, receiptDir, providerReceiptDir, sessionEventDir, manifest };
}

function readJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort().map(name => {
    try { return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); } catch (_) { return null; }
  }).filter(Boolean);
}

function tally(records, key) {
  const out = {};
  for (const record of records) {
    const value = String(record[key] || 'unknown');
    out[value] = (out[value] || 0) + 1;
  }
  return out;
}

function receiptSetHash(records) {
  const hashes = records.map(record => String(record.receipt_hash || '')).filter(Boolean).sort();
  return hashText(hashes.join('\n'));
}

function latestSessionEvidence(records) {
  const end = records.filter(r => r.event === 'on_session_end').sort((a, b) => Number(a.timestamp_ns || 0) - Number(b.timestamp_ns || 0)).pop();
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
  const toolReceipts = readJsonFiles(options.receiptDir);
  const providerReceipts = readJsonFiles(options.providerReceiptDir);
  const sessionEvents = readJsonFiles(options.sessionEventDir);
  const providerMismatch = providerReceipts.some(record => record.policy_mismatch === true);
  const sessionEvidence = latestSessionEvidence(sessionEvents);
  const packet = {
    schema: 'axm.hermes-return-packet/v1',
    run_id: options.runId,
    finished_at: now(),
    process_exit_code: Number.isInteger(options.exitCode) ? options.exitCode : null,
    process_signal: options.signal || null,
    source_commit: options.sourceLock.commit,
    source_tree: options.sourceLock.tree || null,
    policy_sha256: hashFile(options.policyFile),
    profile_sha256: hashFile(options.configFile),
    tool_receipts: {
      count: toolReceipts.length,
      receipt_set_sha256: receiptSetHash(toolReceipts),
      by_tool: tally(toolReceipts, 'tool_name'),
      by_status: tally(toolReceipts, 'status')
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
    outcome: sessionEvidence && sessionEvidence.failed === true ? 'session-reported-failure' :
      sessionEvidence && sessionEvidence.interrupted === true ? 'session-reported-interruption' :
      options.exitCode === 0 ? 'process-exited-zero' : 'process-exited-nonzero-or-unknown',
    integrity_flags: {
      provider_policy_mismatch: providerMismatch,
      source_was_verified_before_launch: options.sourceVerified === true
    },
    raw_prompt_stored: false,
    raw_response_stored: false,
    raw_tool_arguments_stored: false,
    raw_tool_results_stored: false,
    canon: false,
    review_required: true,
    promotion: 'candidate-only'
  };
  const packetPath = path.join(options.runDir, 'return-packet.json');
  fs.writeFileSync(packetPath, JSON.stringify(packet, null, 2) + '\n', 'utf8');
  if (options.reportDir) {
    ensureDir(options.reportDir);
    fs.writeFileSync(path.join(options.reportDir, options.runId + '.json'), JSON.stringify(packet, null, 2) + '\n', 'utf8');
  }
  return packet;
}

module.exports = { hashText, hashFile, createRun, finalizeRun };
