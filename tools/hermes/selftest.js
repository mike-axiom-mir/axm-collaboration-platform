'use strict';

const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const ContractVerifier = require('../../hub/module-contract-verifier');
const RuntimePolicy = require('./axm/runtime-policy');
const RunLedger = require('./axm/run-ledger');

const ROOT = __dirname;
let passes = 0;
function check(value, label) { if (!value) throw new Error('FAIL: ' + label); passes += 1; }
function read(name) { return fs.readFileSync(path.join(ROOT, name), 'utf8'); }
function json(name) { return JSON.parse(read(name)); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8'); }

function pythonCommand() {
  for (const cmd of ['python', 'python3']) {
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
    if (r.status === 0) return cmd;
  }
  throw new Error('FAIL: Python required by AXM Hermes runtime');
}
function hookCall(script, payload, env) {
  const r = spawnSync(pythonCommand(), [script], { input: JSON.stringify(payload), encoding: 'utf8', env: Object.assign({}, process.env, env), shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error('hook process failed: ' + (r.stderr || r.stdout || r.status));
  try { return JSON.parse(String(r.stdout || '{}').trim() || '{}'); } catch (_) { throw new Error('hook returned non-JSON: ' + r.stdout); }
}
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer(); server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(error => error ? reject(error) : resolve(port)); });
  });
}
function request(port, method, route, payload) {
  return new Promise((resolve, reject) => {
    const body = payload === undefined ? null : JSON.stringify(payload);
    const req = http.request({ host: '127.0.0.1', port, path: route, method, headers: body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {} }, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', chunk => { text += chunk; });
      res.on('end', () => { let parsed = null; try { parsed = JSON.parse(text); } catch (_) {} resolve({ status: res.statusCode, body: parsed, text }); });
    });
    req.once('error', reject); if (body) req.write(body); req.end();
  });
}
async function waitForHealth(port, child, output) {
  for (let i = 0; i < 60; i += 1) {
    if (child.exitCode !== null) throw new Error('runner exited before health: ' + output.value);
    try { const result = await request(port, 'GET', '/health'); if (result.status === 200) return result; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('runner health timeout: ' + output.value);
}
async function stop(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve)); child.kill();
  await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 1500))]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

function testProviderEnvironmentGuard() {
  const policy = json('axm-policy.example.json');
  check(RuntimePolicy.validatePolicy(policy).ok, 'default policy validates');
  check(policy.limits.max_run_minutes === 15, 'default wall-clock watchdog is 15 minutes');
  const invalidWatchdog = JSON.parse(JSON.stringify(policy)); invalidWatchdog.limits.max_run_minutes = 0;
  check(!RuntimePolicy.validatePolicy(invalidWatchdog).ok, 'zero-minute watchdog is rejected');
  const excessiveWatchdog = JSON.parse(JSON.stringify(policy)); excessiveWatchdog.limits.max_run_minutes = 1441;
  check(!RuntimePolicy.validatePolicy(excessiveWatchdog).ok, 'watchdog above 24 hours is rejected');

  const source = {
    PATH: process.env.PATH || '/usr/bin',
    OPENROUTER_API_KEY: 'REMOTE_SECRET', GH_TOKEN: 'GITHUB_SECRET',
    OPENAI_BASE_URL: 'https://api.openai.com/v1', OPENAI_API_KEY: 'OPENAI_REMOTE_SECRET',
    LM_BASE_URL: 'http://127.0.0.1:1234/v1', LM_API_KEY: 'LOCAL_PLACEHOLDER',
    HTTPS_PROXY: 'http://proxy.example:8080'
  };
  const local = RuntimePolicy.sanitizeEnvironment(source, policy);
  check(!local.env.OPENROUTER_API_KEY && !local.env.GH_TOKEN && !local.env.OPENAI_API_KEY, 'local_only strips inherited remote secrets');
  check(!local.env.OPENAI_BASE_URL && local.env.LM_BASE_URL === source.LM_BASE_URL && local.env.LM_API_KEY === source.LM_API_KEY, 'local_only preserves loopback provider pair and removes remote base pair');
  check(!local.env.HTTPS_PROXY && String(local.env.NO_PROXY).includes('127.0.0.1'), 'local_only strips proxy path and forces loopback no-proxy');
  check(local.report.inherited_secret_count >= 3 && local.report.secret_variable_names_stored === false, 'egress report stores counts not secret-variable names');

  const remotePolicy = JSON.parse(JSON.stringify(policy));
  remotePolicy.provider_egress.mode = 'explicit_remote';
  remotePolicy.provider_egress.allowed_secret_env = ['OPENROUTER_API_KEY'];
  const remote = RuntimePolicy.sanitizeEnvironment(source, remotePolicy);
  check(remote.env.OPENROUTER_API_KEY === 'REMOTE_SECRET' && !remote.env.GH_TOKEN && !remote.env.OPENAI_API_KEY, 'explicit_remote restores only explicitly named secret variables');
}

function testRuntimeBoundary(tempRoot) {
  const gate = path.join(ROOT, 'axm', 'axm_gate.py');
  const context = path.join(ROOT, 'axm', 'axm_context.py');
  const toolReceipt = path.join(ROOT, 'axm', 'axm_receipt.py');
  const providerReceipt = path.join(ROOT, 'axm', 'axm_provider_receipt.py');
  const sessionEvent = path.join(ROOT, 'axm', 'axm_session_event.py');
  const policyFile = path.join(tempRoot, 'policy.json');
  const configFile = path.join(tempRoot, 'config.yaml');
  const workspace = path.join(tempRoot, 'workspace');
  fs.mkdirSync(workspace, { recursive: true }); fs.writeFileSync(configFile, 'hooks: {}\n', 'utf8');
  const policy = json('axm-policy.example.json');
  policy.paths.read_roots = [workspace]; policy.paths.write_roots = [workspace];
  policy.limits.max_tool_calls_per_session = 3; policy.limits.max_files_read_per_session = 3; policy.limits.max_files_written_per_session = 2;
  writeJson(policyFile, policy);

  const run = RunLedger.createRun({
    runtimeRoot: path.join(tempRoot, 'runtime'), sourceLock: json('hermes-source.lock.json'), sourceVerified: true,
    policy, policyFile, configFile, args: ['-q', 'DO_NOT_STORE_PROMPT'], environmentReport: { mode: 'local_only', inherited_secret_count: 2, explicitly_restored_secret_count: 1, secret_variable_names_stored: false, network_isolation_claimed: false }, launcherPid: process.pid
  });
  const env = {
    AXM_HERMES_ROOT: ROOT, AXM_HERMES_POLICY_FILE: policyFile, AXM_HERMES_WORKSPACE: workspace,
    AXM_HERMES_RUN_ID: run.runId, AXM_HERMES_STATE_DIR: run.stateDir, AXM_HERMES_RECEIPT_DIR: run.receiptDir,
    AXM_HERMES_PROVIDER_RECEIPT_DIR: run.providerReceiptDir, AXM_HERMES_SESSION_EVENT_DIR: run.sessionEventDir
  };
  const call = (tool, args, session) => hookCall(gate, { hook_event_name: 'pre_tool_call', tool_name: tool, tool_input: args || {}, session_id: session || tool, extra: {} }, env);

  let result = call('read_file', { path: 'a.txt' }, 'consent-off');
  check(result.action === 'block' && /consent is OFF/.test(result.message), 'consent off blocks all tools');
  policy.consent.enabled = true; writeJson(policyFile, policy);
  result = call('read_file', { path: 'a.txt' }, 'research-read');
  check(Object.keys(result).length === 0, 'research posture permits allowlisted read');
  result = call('write_file', { path: 'draft.txt', content: 'x' }, 'research-write');
  check(result.action === 'block' && /research posture/.test(result.message), 'research posture blocks mutation even with global consent on');

  policy.posture = 'operator'; writeJson(policyFile, policy);
  result = call('write_file', { path: 'draft.txt', content: 'x' }, 'operator-write-gated');
  check(result.action === 'block' && /allow_file_mutation/.test(result.message), 'operator posture still requires explicit file-mutation capability');
  policy.capabilities.allow_file_mutation = true; writeJson(policyFile, policy);
  result = call('write_file', { path: 'draft.txt', content: 'x' }, 'operator-write');
  check(Object.keys(result).length === 0, 'explicit file-mutation capability permits contained write');
  result = call('write_file', { path: path.join(tempRoot, 'outside.txt') }, 'outside');
  check(result.action === 'block' && /outside configured AXM roots/.test(result.message), 'operator write outside configured root blocked');
  result = call('write_file', { content: 'no path' }, 'missing-path');
  check(result.action === 'block' && /containment cannot be verified/.test(result.message), 'unverifiable file mutation fails closed');

  const capabilityCases = {
    terminal: 'allow_terminal', process: 'allow_terminal', execute_code: 'allow_execute_code', computer_use: 'allow_computer_use',
    delegate_task: 'allow_delegation', cronjob: 'allow_scheduling', memory: 'allow_memory_mutation', skill_manage: 'allow_skill_mutation',
    browser_click: 'allow_browser_interaction', send_message: 'allow_messaging', ha_call_service: 'allow_home_automation',
    project_create: 'allow_project_changes', kanban_create: 'allow_coordination_mutation', image_generate: 'allow_generation'
  };
  for (const [tool, capability] of Object.entries(capabilityCases)) {
    result = call(tool, {}, 'blocked-' + tool);
    check(result.action === 'block' && result.message.includes(capability), tool + ' requires explicit ' + capability);
  }
  result = call('future_unknown_tool', {}, 'unknown');
  check(result.action === 'block' && /unclassified tool/.test(result.message), 'operator posture fails closed on unknown future tool');
  policy.allowed_tools.push('future_unknown_tool'); writeJson(policyFile, policy);
  result = call('future_unknown_tool', {}, 'explicit-unknown');
  check(Object.keys(result).length === 0, 'operator can explicitly allow a reviewed unclassified tool');

  policy.mode.hub_sandbox = false; policy.mode.external_mode = false; writeJson(policyFile, policy);
  result = call('web_search', { query: 'test' }, 'bad-mode');
  check(result.action === 'block' && /exactly one run space/.test(result.message), 'ambiguous run-space policy fails closed');
  policy.mode.hub_sandbox = true; writeJson(policyFile, policy);

  policy.limits.max_tool_calls_per_session = 2; writeJson(policyFile, policy);
  check(Object.keys(call('web_search', { query: 'a' }, 'limit')).length === 0, 'first bounded tool call allowed');
  check(Object.keys(call('web_search', { query: 'b' }, 'limit')).length === 0, 'second bounded tool call allowed');
  result = call('web_search', { query: 'c' }, 'limit');
  check(result.action === 'block' && /tool-call limit reached/.test(result.message), 'tool-call limit enforced');

  const contextResult = hookCall(context, { hook_event_name: 'pre_llm_call', session_id: 'context', extra: { user_message: 'SECRET' } }, env);
  check(typeof contextResult.context === 'string' && /candidate/.test(contextResult.context) && /bypass/.test(contextResult.context) && !contextResult.context.includes('SECRET'), 'AXM context is static and content-free');

  policy.limits.max_tool_calls_per_session = 3;
  policy.consent.enabled = false;
  writeJson(policyFile, policy);
  hookCall(toolReceipt, {
    hook_event_name: 'post_tool_call', tool_name: 'read_file', tool_input: { path: '/private/secret.txt', token: 'DO_NOT_STORE_ME' }, session_id: 'raw-session',
    extra: { turn_id: 'raw-turn', tool_call_id: 'raw-call', status: 'success', duration_ms: 7, result: 'SECRET_RESULT_DO_NOT_STORE' }
  }, env);
  const toolFiles = fs.readdirSync(run.receiptDir).filter(name => name.endsWith('.json'));
  check(toolFiles.length === 1, 'tool completion evidence survives mid-run consent revocation');
  const toolText = fs.readFileSync(path.join(run.receiptDir, toolFiles[0]), 'utf8');
  check(!toolText.includes('DO_NOT_STORE_ME') && !toolText.includes('SECRET_RESULT_DO_NOT_STORE') && !toolText.includes('/private/secret.txt') && !toolText.includes('raw-session'), 'tool receipt excludes raw args/results/paths/ids');
  const toolRecord = JSON.parse(toolText);
  check(/^[0-9a-f]{64}$/.test(toolRecord.receipt_hash) && toolRecord.canon === false, 'tool receipt is independently hashed and non-canonical');

  hookCall(providerReceipt, {
    hook_event_name: 'pre_api_request', session_id: 'raw-provider-session', extra: {
      turn_id: 'raw-provider-turn', api_request_id: 'raw-api', provider: 'lmstudio', model: 'local-model', base_url: 'http://127.0.0.1:1234/v1',
      user_message: 'DO_NOT_STORE_PROVIDER_PROMPT', request_messages: ['SECRET'], approx_input_tokens: 42, message_count: 2, tool_count: 3
    }
  }, env);
  hookCall(providerReceipt, {
    hook_event_name: 'pre_api_request', session_id: 'remote-session', extra: {
      api_request_id: 'remote-api', provider: 'openai', model: 'remote-model', base_url: 'https://api.openai.com/v1', user_message: 'REMOTE_SECRET'
    }
  }, env);
  hookCall(providerReceipt, {
    hook_event_name: 'pre_api_request', session_id: 'unknown-base', extra: { api_request_id: 'unknown-api', provider: 'custom', model: 'm' }
  }, env);
  const providerFiles = fs.readdirSync(run.providerReceiptDir).filter(name => name.endsWith('.json'));
  check(providerFiles.length === 3, 'provider metadata receipts written without request bodies');
  const providers = providerFiles.map(name => JSON.parse(fs.readFileSync(path.join(run.providerReceiptDir, name), 'utf8')));
  check(providers.some(r => r.base_url_scope === 'loopback' && r.policy_mismatch === false), 'loopback provider recorded as local evidence');
  check(providers.some(r => r.base_url_scope === 'remote' && r.policy_mismatch === true), 'remote provider under local_only flagged as policy mismatch');
  check(providers.some(r => r.base_url_scope === 'unknown' && r.policy_mismatch === false), 'missing provider base URL remains unknown rather than false-remote');
  check(providerFiles.every(name => !fs.readFileSync(path.join(run.providerReceiptDir, name), 'utf8').includes('DO_NOT_STORE_PROVIDER_PROMPT')), 'provider receipts exclude raw prompts');

  hookCall(sessionEvent, {
    hook_event_name: 'on_session_end', session_id: 'raw-session-id', extra: { completed: true, failed: false, interrupted: false, turn_exit_reason: 'final_response', model: 'local-model', platform: 'cli' }
  }, env);
  check(fs.readdirSync(run.sessionEventDir).filter(name => name.endsWith('.json')).length === 1, 'content-free session outcome event written');

  const packet = RunLedger.finalizeRun({
    runId: run.runId, runDir: run.runDir, receiptDir: run.receiptDir, providerReceiptDir: run.providerReceiptDir, sessionEventDir: run.sessionEventDir,
    reportDir: path.join(tempRoot, 'reports'), sourceLock: json('hermes-source.lock.json'), policyFile, configFile,
    sourceVerified: true, sourceVerifiedAfter: true, exitCode: 0, signal: null, watchdogTimedOut: false
  });
  check(packet.tool_receipts.count === 1 && packet.provider_receipts.count === 3 && packet.session_events.count === 1, 'Return Packet aggregates run-local evidence');
  check(packet.provider_receipts.local_only_policy_mismatch_observed === true && packet.integrity_flags.provider_policy_mismatch === true, 'Return Packet carries provider boundary failure flag');
  check(packet.session_events.latest_turn_evidence.completed === true && packet.canon === false && packet.promotion === 'candidate-only', 'Return Packet preserves outcome evidence without promotion');
  check(packet.integrity_flags.policy_changed_during_run === true && packet.integrity_flags.profile_changed_during_run === false, 'Return Packet detects policy drift while distinguishing stable profile');
  check(packet.integrity_flags.source_verified_after_run === true && packet.watchdog.max_run_minutes === 15 && packet.watchdog.timed_out === false, 'Return Packet carries source-after-run and watchdog evidence');
  check(packet.schema === 'axm.hermes-return-packet/v2' && /^[0-9a-f]{64}$/.test(packet.packet_sha256), 'Return Packet v2 carries a deterministic self-verifying identity');
  check(/^[0-9a-f]{64}$/.test(packet.run_manifest_sha256), 'Return Packet binds the exact launch manifest evidence');
  check(RunLedger.verifyReturnPacket(packet, { runDir: run.runDir, expectedRunId: run.runId }).ok, 'completed Return Packet verifies against its exact run capsule');
  check(RunLedger.inspectRunCompletion(run.runDir, run.runId).state === 'COMPLETE', 'run completion requires an admitted Return Packet');
  check(fs.readdirSync(run.runDir).every(name => !name.endsWith('.tmp')), 'successful publication leaves no private temporary completion artifact');
  const packetPath = path.join(run.runDir, 'return-packet.json');
  const sealedPacketText = fs.readFileSync(packetPath, 'utf8');
  const tamperedPacket = JSON.parse(sealedPacketText); tamperedPacket.outcome = 'process-exited-nonzero-or-unknown';
  fs.writeFileSync(packetPath, JSON.stringify(tamperedPacket) + '\n', 'utf8');
  check(RunLedger.inspectRunCompletion(run.runDir, run.runId).state === 'HELD_INVALID', 'tampered Return Packet cannot suppress interrupted-run recovery as false completion');
  let conflictHeld = false;
  try {
    RunLedger.finalizeRun({
      runId: run.runId, runDir: run.runDir, receiptDir: run.receiptDir, providerReceiptDir: run.providerReceiptDir, sessionEventDir: run.sessionEventDir,
      reportDir: path.join(tempRoot, 'reports'), sourceLock: json('hermes-source.lock.json'), policyFile, configFile,
      sourceVerified: true, sourceVerifiedAfter: true, exitCode: 0, signal: null, watchdogTimedOut: false
    });
  } catch (error) { conflictHeld = error && error.code === 'EVIDENCE_PATH_CONFLICT'; }
  check(conflictHeld && fs.readFileSync(packetPath, 'utf8') !== sealedPacketText, 'conflicting occupied completion evidence is preserved and held, never overwritten');
  fs.writeFileSync(packetPath, sealedPacketText, 'utf8');
  const repeated = RunLedger.finalizeRun({
    runId: run.runId, runDir: run.runDir, receiptDir: run.receiptDir, providerReceiptDir: run.providerReceiptDir, sessionEventDir: run.sessionEventDir,
    reportDir: path.join(tempRoot, 'reports'), sourceLock: json('hermes-source.lock.json'), policyFile, configFile,
    sourceVerified: true, sourceVerifiedAfter: true, exitCode: 99, signal: 'must-not-replace', watchdogTimedOut: false
  });
  check(repeated.packet_sha256 === packet.packet_sha256 && repeated.outcome === packet.outcome, 'repeat finalization is idempotent and cannot revise admitted completion truth');
  const manifestPath = path.join(run.runDir, 'run-manifest.json');
  const manifestTextBeforeTamper = fs.readFileSync(manifestPath, 'utf8');
  const alteredManifest = JSON.parse(manifestTextBeforeTamper); alteredManifest.launcher_pid = 1;
  fs.writeFileSync(manifestPath, JSON.stringify(alteredManifest) + '\n', 'utf8');
  check(RunLedger.inspectRunCompletion(run.runDir, run.runId).state === 'HELD_INVALID', 'completion is held when its launch manifest drifts');
  fs.writeFileSync(manifestPath, manifestTextBeforeTamper, 'utf8');
  fs.writeFileSync(packetPath, JSON.stringify(Object.assign({}, packet, { schema: 'axm.hermes-return-packet/v1' })) + '\n', 'utf8');
  check(RunLedger.inspectRunCompletion(run.runDir, run.runId).state === 'HELD_LEGACY_UNSEALED', 'legacy unsealed Return Packets remain explicit held evidence');
  fs.writeFileSync(packetPath, sealedPacketText, 'utf8');
  const manifestText = fs.readFileSync(path.join(run.runDir, 'run-manifest.json'), 'utf8');
  check(!manifestText.includes('DO_NOT_STORE_PROMPT') && manifestText.includes('"max_run_minutes": 15'), 'run manifest stores watchdog and invocation shape, never raw CLI values');

  const watchdogPolicyFile = path.join(tempRoot, 'watchdog-policy.json');
  const watchdogPolicy = json('axm-policy.example.json');
  writeJson(watchdogPolicyFile, watchdogPolicy);
  const watchdogRun = RunLedger.createRun({
    runtimeRoot: path.join(tempRoot, 'runtime-watchdog'), sourceLock: json('hermes-source.lock.json'), sourceVerified: true,
    policy: watchdogPolicy, policyFile: watchdogPolicyFile, configFile, args: [], environmentReport: null, launcherPid: process.pid
  });
  const watchdogPacket = RunLedger.finalizeRun({
    runId: watchdogRun.runId, runDir: watchdogRun.runDir, receiptDir: watchdogRun.receiptDir,
    providerReceiptDir: watchdogRun.providerReceiptDir, sessionEventDir: watchdogRun.sessionEventDir,
    sourceLock: json('hermes-source.lock.json'), policyFile: watchdogPolicyFile, configFile,
    sourceVerified: true, sourceVerifiedAfter: true, exitCode: null, signal: 'SIGTERM', watchdogTimedOut: true
  });
  check(watchdogPacket.outcome === 'launcher-watchdog-timeout' && watchdogPacket.integrity_flags.watchdog_timeout === true, 'watchdog timeout becomes explicit Return Packet outcome');
  check(watchdogPacket.watchdog.process_tree_termination_guaranteed === false, 'watchdog refuses fake process-tree termination claim');
}

async function testLegacyLoopback(tempRoot) {
  const hermesRoot = path.join(tempRoot, 'legacy-runner'); fs.mkdirSync(hermesRoot, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'hermes-runner.js'), path.join(hermesRoot, 'hermes-runner.js'));
  const port = await freePort(); const output = { value: '' };
  const child = spawn(process.execPath, [path.join(hermesRoot, 'hermes-runner.js')], { cwd: hermesRoot, env: Object.assign({}, process.env, { AXM_HERMES_PORT: String(port) }), stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { output.value += chunk.toString(); }); child.stderr.on('data', chunk => { output.value += chunk.toString(); });
  try {
    const health = await waitForHealth(port, child, output);
    check(health.body && health.body.ok === true && health.body.consent === false, 'legacy runner starts loopback with consent off');
    const refused = await request(port, 'POST', '/queue', { title: 'must not write' }); check(refused.status === 403, 'legacy queue refuses consent-off write');
    const on = await request(port, 'POST', '/consent', { enabled: true, reason: 'selftest' }); check(on.body.consent.enabled === true, 'legacy consent explicitly enables');
    const queued = await request(port, 'POST', '/queue', { source: 'selftest', title: 'bounded', text: 'inspect only' });
    check(queued.status === 200 && queued.body.result.task.status === 'proposal' && /proposal only/.test(queued.body.result.task.axm_rule), 'legacy queue remains proposal-only');
    const off = await request(port, 'POST', '/consent', { enabled: false, reason: 'done' }); check(off.body.consent.enabled === false, 'legacy consent revokes');
  } finally { await stop(child); }
}

async function main() {
  const manifest = json('manifest.json'); const contract = json('module.contract.json'); const sourceLock = json('hermes-source.lock.json');
  const policy = json('axm-policy.example.json'); const bootstrap = read('hermes-bootstrap.js'); const runner = read('hermes-runner.js');
  const readme = read('README.md'); const html = read('index.html');

  check(manifest.schema === ContractVerifier.MANIFEST_SCHEMA, 'manifest schema current');
  check(manifest.kind === 'adapter' && manifest.risk === 'HIGH', 'manifest exposes adapter/high-risk role');
  check(manifest.version === 'v0.5' && contract.version === 'v0.5', 'manifest and contract aligned on v0.5');
  check(ContractVerifier.validateContract(contract, manifest).pass, 'module contract validates');
  check(contract.boundaries.refuses.includes('os-container-or-vm-sandbox-enforcement-claim'), 'contract refuses fake OS sandbox claim');
  check(contract.boundaries.refuses.includes('provider-credential-guard-as-network-isolation-claim'), 'contract refuses fake network-isolation claim');
  check(contract.boundaries.refuses.includes('hermes-memory-as-axm-canon'), 'contract refuses Hermes memory canon');

  check(sourceLock.repo_url === 'https://github.com/NousResearch/hermes-agent.git', 'source lock uses official upstream');
  check(/^[0-9a-f]{40}$/.test(sourceLock.commit) && /^[0-9a-f]{40}$/.test(sourceLock.tree), 'source lock pins commit and exact tree');
  check(sourceLock.observed_version === '0.20.5', 'source lock records reviewed upstream version');
  check(policy.posture === 'research' && policy.provider_egress.mode === 'local_only', 'default posture is research with local-only provider credentials');
  check(policy.limits.max_run_minutes === 15, 'default policy contains hard 15-minute run watchdog');
  check(policy.consent.enabled === false && policy.mode.hub_sandbox === true && policy.mode.external_mode === false, 'default policy is inert inside hub run space');
  Object.entries(policy.capabilities).forEach(([name, enabled]) => check(enabled === false, name + ' defaults off'));
  check(policy.canon.hermes_memory_is_canon === false && policy.canon.hermes_skills_are_canon === false, 'Hermes learning defaults non-canonical');

  check(/HEAD\^\{tree\}/.test(bootstrap) && /observedHermesVersion/.test(bootstrap), 'bootstrap verifies commit tree and declared version');
  check(/sanitizeEnvironment/.test(bootstrap) && /verifyHermesHomeCredentialPolicy/.test(bootstrap), 'bootstrap applies provider credential egress guard');
  check(/RunLedger\.createRun/.test(bootstrap) && /RunLedger\.finalizeRun/.test(bootstrap), 'launcher wraps each Hermes execution in run capsule and Return Packet');
  check(/repairInterruptedRuns/.test(bootstrap) && /inspectRunCompletion/.test(bootstrap) && /action === 'repair'/.test(bootstrap), 'launcher repairs only explicitly inspected interrupted runs');
  check(/BEGIN AXM MANAGED HERMES RUNTIME/.test(bootstrap) && /backupFile/.test(bootstrap), 'managed hook block is repairable with config backup');
  check(/max_run_minutes \* 60 \* 1000/.test(bootstrap) && /killSignal: 'SIGTERM'/.test(bootstrap), 'launcher enforces wall-clock watchdog');
  check(/\^\[A-Za-z0-9_.-\]\+\\s\*:/.test(bootstrap), 'force-repair YAML remover stops at any next top-level key');
  check(/HERMES_YOLO_MODE: ''/.test(bootstrap) && /HERMES_ENABLE_PROJECT_PLUGINS: 'false'/.test(bootstrap), 'launcher disables YOLO and project plugins');
  check(/fail_closed: true/.test(bootstrap), 'pre-tool AXM gate is fail closed');
  check(/const HOST = '127\.0\.0\.1'/.test(runner), 'legacy runner remains loopback-only');
  check(/not an OS sandbox/i.test(readme) && /provider/i.test(readme), 'README preserves isolation truth boundary');
  check(/not an OS sandbox/i.test(html), 'landing card preserves isolation truth boundary');

  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) { new Function(match[1]); passes += 1; }
  testProviderEnvironmentGuard();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-hermes-v04-'));
  try { testRuntimeBoundary(path.join(tempRoot, 'runtime')); await testLegacyLoopback(tempRoot); }
  finally { fs.rmSync(tempRoot, { recursive: true, force: true }); }
  console.log('PASS AXM Hermes runtime adapter v0.5 selftest: ' + passes + ' assertions; live upstream/model-provider execution intentionally not required');
}

main().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
