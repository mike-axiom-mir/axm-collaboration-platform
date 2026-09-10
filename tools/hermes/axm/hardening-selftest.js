'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const RuntimePolicy = require('./runtime-policy');
const RunLedger = require('./run-ledger');

const ROOT = path.resolve(__dirname, '..');
let passes = 0;
function check(value, label) { if (!value) throw new Error('FAIL: ' + label); passes += 1; }

const policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'axm-policy.example.json'), 'utf8'));
const bootstrap = fs.readFileSync(path.join(ROOT, 'hermes-bootstrap.js'), 'utf8');

check(RuntimePolicy.validatePolicy(policy).ok, 'default v0.5 policy validates');
check(policy.learning.memory_enabled === false && policy.learning.user_profile_enabled === false, 'built-in Hermes memory/profile are off by default');
check(policy.learning.background_review_enabled === false, 'automatic Hermes background review is off by default');
check(policy.learning.memory_write_approval === true && policy.learning.skill_write_approval === true, 'Hermes learning writes are approval-gated by default');
check(policy.limits.max_run_minutes === 15, 'hard wall-clock watchdog defaults to 15 minutes');

check(/HERMES_DISABLE_LAZY_INSTALLS:\s*'1'/.test(bootstrap), 'runtime disables Hermes lazy dependency installation');
check(/HERMES_WRITE_SAFE_ROOT/.test(bootstrap), 'runtime layers Hermes native write-safe-root under AXM gate');
check(/HERMES_REDACT_SECRETS:\s*'true'/.test(bootstrap), 'runtime forces Hermes secret redaction on');
check(/'run', '--no-sync', '--project'/.test(bootstrap), 'Hermes start cannot silently uv-sync packages');
check(!/\['clone', '--no-checkout'/.test(bootstrap), 'installer no longer clones floating branch history');
check(/\['init'\]/.test(bootstrap) && /\['fetch', '--depth', '1', '--no-tags', 'origin', lock\.commit\]/.test(bootstrap), 'installer initializes locally then fetches exact pinned commit only');
check(/OWNED_TOP_LEVEL_KEYS = \['hooks', 'memory', 'skills', 'auxiliary'\]/.test(bootstrap), 'AXM explicitly owns Hermes hooks and learning controls');
check(/memory_enabled:/.test(bootstrap) && /background_review:/.test(bootstrap), 'managed profile emits memory/background-review controls');
check(/max_run_minutes \* 60 \* 1000/.test(bootstrap) && /killSignal: 'SIGTERM'/.test(bootstrap), 'launcher applies wall-clock watchdog');
check(/process_tree_termination_guaranteed/.test(fs.readFileSync(path.join(__dirname, 'run-ledger.js'), 'utf8')), 'Return Packet refuses fake process-tree kill guarantee');

function evidenceRun() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-hermes-evidence-admission-'));
  const policyFile = path.join(tempRoot, 'policy.json');
  const configFile = path.join(tempRoot, 'config.yaml');
  fs.writeFileSync(policyFile, JSON.stringify(policy, null, 2) + '\n', 'utf8');
  fs.writeFileSync(configFile, 'hooks: {}\n', 'utf8');
  const run = RunLedger.createRun({
    runtimeRoot: path.join(tempRoot, 'runtime'),
    sourceLock: { repo_url: 'https://example.invalid/hermes.git', commit: '1'.repeat(40), tree: '2'.repeat(40), observed_version: 'test' },
    sourceVerified: true,
    policy,
    policyFile,
    configFile,
    args: [],
    environmentReport: null,
    launcherPid: process.pid
  });
  return { tempRoot, policyFile, configFile, run };
}

function finalizeFixture(fixture) {
  const run = fixture.run;
  return RunLedger.finalizeRun({
    runId: run.runId,
    runDir: run.runDir,
    receiptDir: run.receiptDir,
    providerReceiptDir: run.providerReceiptDir,
    sessionEventDir: run.sessionEventDir,
    sourceLock: { commit: '1'.repeat(40), tree: '2'.repeat(40) },
    sourceVerified: true,
    sourceVerifiedAfter: true,
    policyFile: fixture.policyFile,
    configFile: fixture.configFile,
    exitCode: 0,
    signal: null,
    watchdogTimedOut: false
  });
}

function expectEvidenceHold(mutator, expectedKind, expectedCause, label) {
  const fixture = evidenceRun();
  try {
    mutator(fixture);
    let error = null;
    try { finalizeFixture(fixture); } catch (caught) { error = caught; }
    check(error && error.code === 'RUN_EVIDENCE_INVALID', label + ' fails closed');
    check(error && error.details && error.details.kind === expectedKind && error.details.cause === expectedCause, label + ' reports bounded evidence cause');
    check(!fs.existsSync(path.join(fixture.run.runDir, 'return-packet.json')), label + ' publishes no Return Packet');
  } finally {
    fs.rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
}

expectEvidenceHold(fixture => {
  fs.writeFileSync(path.join(fixture.run.receiptDir, 'broken.json'), '{', 'utf8');
}, 'tool-receipt', 'INVALID_JSON', 'malformed tool receipt');

expectEvidenceHold(fixture => {
  fs.writeFileSync(path.join(fixture.run.providerReceiptDir, 'broken.json'), '[]\n', 'utf8');
}, 'provider-receipt', 'ROOT_NOT_OBJECT', 'non-object provider receipt');

expectEvidenceHold(fixture => {
  fs.writeFileSync(path.join(fixture.run.sessionEventDir, 'foreign.json'), JSON.stringify({
    schema: 'axm.hermes-session-event/v1', run_id: 'foreign-run', receipt_hash: 'a'.repeat(64)
  }) + '\n', 'utf8');
}, 'session-event', 'RUN_ID_MISMATCH', 'foreign-run session evidence');

expectEvidenceHold(fixture => {
  fs.writeFileSync(path.join(fixture.run.receiptDir, 'unsealed.json'), JSON.stringify({
    schema: 'axm.hermes-tool-receipt/v1', run_id: fixture.run.runId, receipt_hash: 'not-a-sha256'
  }) + '\n', 'utf8');
}, 'tool-receipt', 'RECEIPT_HASH_INVALID', 'unsealed tool receipt');

expectEvidenceHold(fixture => {
  fs.writeFileSync(path.join(fixture.run.stateDir, 'bad-state.json'), JSON.stringify({
    tool_calls: -1, files_read: 0, files_written: 0
  }) + '\n', 'utf8');
}, 'runtime-state', 'COUNTER_INVALID', 'invalid runtime counter state');

{
  const fixture = evidenceRun();
  try {
    fs.writeFileSync(path.join(fixture.run.receiptDir, 'tool.json'), JSON.stringify({
      schema: 'axm.hermes-tool-receipt/v1', run_id: fixture.run.runId, receipt_hash: 'b'.repeat(64), tool_name: 'read_file', status: 'success'
    }) + '\n', 'utf8');
    fs.writeFileSync(path.join(fixture.run.providerReceiptDir, 'provider.json'), JSON.stringify({
      schema: 'axm.hermes-provider-receipt/v1', run_id: fixture.run.runId, receipt_hash: 'c'.repeat(64), provider: 'lmstudio', model: 'local', base_url_scope: 'loopback', policy_mismatch: false
    }) + '\n', 'utf8');
    fs.writeFileSync(path.join(fixture.run.sessionEventDir, 'session.json'), JSON.stringify({
      schema: 'axm.hermes-session-event/v1', run_id: fixture.run.runId, receipt_hash: 'd'.repeat(64), event: 'on_session_end', completed: true, failed: false, interrupted: false,
      turn_exit_reason: null, model: 'local', platform: 'test'
    }) + '\n', 'utf8');
    fs.writeFileSync(path.join(fixture.run.stateDir, 'state.json'), JSON.stringify({ tool_calls: 1, files_read: 1, files_written: 0 }) + '\n', 'utf8');
    const packet = finalizeFixture(fixture);
    check(packet.tool_receipts.count === 1 && packet.tool_receipts.authorized_tool_calls === 1, 'admitted tool evidence remains counted');
    check(packet.provider_receipts.count === 1 && packet.session_events.count === 1, 'admitted provider/session evidence remains counted');
    check(packet.canon === false && packet.review_required === true && packet.promotion === 'candidate-only', 'evidence admission does not widen Return Packet authority');
  } finally {
    fs.rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
}

console.log('PASS AXM Hermes hardening selftest: ' + passes + ' assertions');
