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
    policy, policyFile, configFile, args: ['-q', 'DO_NOT_STORE_PROMPT'], environmentReport: { mode: 'local_only', inherited_secret_count: 2, explicitly_restored_secret_count: 1, secret_variable_names_stored: false, network_isolation_claimed: false }
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

  policy.limits.max_tool_calls_per_session = 3; writeJson(policyFile, policy);
  hookCall(toolReceipt, {
    hook_event_name: 'post_tool_call', tool_name: 'read_file', tool_input: { path: '/private/secret.txt', token: 'DO_NOT_STORE_ME' }, session_id: 'raw-session',
    extra: { turn_id: 'raw-turn', tool_call_id: 'raw-call', status: 'success', duration_ms: 7, result: 'SECRET_RESULT_DO_NOT_STORE' }
  }, env);
  const toolFiles = fs.readdirSync(run.receiptDir).filter(name => name.endsWith('.json'));
  check(toolFiles.length === 1, 'one independently hashed tool receipt written');
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
  const providerFiles = fs.readdirSync(run.providerReceiptDir).filter(name => name.endsWith('.json'));
  check(providerFiles.length === 2, 'provider metadata receipts written without request bodies');
  const providers = providerFiles.map(name => JSON.parse(fs.readFileSync(path.join(run.providerReceiptDir, name), 'utf8')));
  check(providers.some(r => r.base_url_scope === 'loopback' && r.policy_mismatch === false), 'loopback provider recorded as local evidence');
  check(providers.some(r => r.base_url_scope === 'remote' && r.policy_mismatch === true), 'remote provider under local_only flagged as policy mismatch');
  check(providerFiles.every(name => !fs.readFileSync(path.join(run.providerReceiptDir, name), 'utf8').includes('DO_NOT_STORE_PROVIDER_PROMPT')), 'provider receipts exclude raw prompts');

  hookCall(sessionEvent, {
    hook_event_name: 'on_session_end', session_id: 'raw-session-id', extra: { completed: true, failed: false, interrupted: false, turn_exit_reason: 'final_response', model: 'local-model', platform: 'cli' }
  }, env);
  check(fs.readdirSync(run.sessionEventDir).filter(name => name.endsWith('.json')).length === 1, 'content-free session outcome event written');

  const packet = RunLedger.finalizeRun({
    runId: run.runId, runDir: run.runDir, receiptDir: run.receiptDir, providerReceiptDir: run.providerReceiptDir, sessionEventDir: run.sessionEventDir,
    reportDir: path.join(tempRoot, 'reports'), sourceLock: json('hermes-source.lock.json'), policyFile, configFile, sourceVerified: true, exitCode: 0, signal: null
  });
  check(packet.tool_receipts.count === 1 && packet.provider_receipts.count === 2 && packet.session_events.count === 1, 'Return Packet aggregates run-local evidence');
  check(packet.provider_receipts.local_only_policy_mismatch_observed === true && packet.integrity_flags.provider_policy_mismatch === true, 'Return Packet carries provider boundary failure flag');
  check(packet.session_events.latest_turn_evidence.completed === true && packet.canon === false && packet.promotion === 'candidate-only', 'Return Packet preserves outcome evidence without promotion');
  const manifestText = fs.readFileSync(path.join(run.runDir, 'run-manifest.json'), 'utf8');
  check(!manifestText.includes('DO_NOT_STORE_PROMPT'), 'run manifest stores invocation shape, never raw CLI values');
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
  check(manifest.version === 'v0.4' && contract.version === 'v0.4', 'manifest and contract aligned on v0.4');
  check(ContractVerifier.validateContract(contract, manifest).pass, 'module contract validates');
  check(contract.boundaries.refuses.includes('os-container-or-vm-sandbox-enforcement-claim'), 'contract refuses fake OS sandbox claim');
  check(contract.boundaries.refuses.includes('provider-credential-guard-as-network-isolation-claim'), 'contract refuses fake network-isolation claim');
  check(contract.boundaries.refuses.includes('hermes-memory-as-axm-canon'), 'contract refuses Hermes memory canon');

  check(sourceLock.repo_url === 'https://github.com/NousResearch/hermes-agent.git', 'source lock uses official upstream');
  check(/^[0-9a-f]{40}$/.test(sourceLock.commit) && /^[0-9a-f]{40}$/.test(sourceLock.tree), 'source lock pins commit and exact tree');
  check(sourceLock.observed_version === '0.20.5', 'source lock records reviewed upstream version');
  check(policy.posture === 'research' && policy.provider_egress.mode === 'local_only', 'default posture is research with local-only provider credentials');
  check(policy.consent.enabled === false && policy.mode.hub_sandbox === true && policy.mode.external_mode === false, 'default policy is inert inside hub run space');
  Object.entries(policy.capabilities).forEach(([name, enabled]) => check(enabled === false, name + ' defaults off'));
  check(policy.canon.hermes_memory_is_canon === false && policy.canon.hermes_skills_are_canon === false, 'Hermes learning defaults non-canonical');

  check(/HEAD\^\{tree\}/.test(bootstrap) && /observedHermesVersion/.test(bootstrap), 'bootstrap verifies commit tree and declared version');
  check(/sanitizeEnvironment/.test(bootstrap) && /verifyHermesHomeCredentialPolicy/.test(bootstrap), 'bootstrap applies provider credential egress guard');
  check(/RunLedger\.createRun/.test(bootstrap) && /RunLedger\.finalizeRun/.test(bootstrap), 'launcher wraps each Hermes execution in run capsule and Return Packet');
  check(/repairInterruptedRuns/.test(bootstrap) && /action === 'repair'/.test(bootstrap), 'launcher has explicit crash/config repair path');
  check(/BEGIN AXM MANAGED HERMES RUNTIME/.test(bootstrap) && /backupFile/.test(bootstrap), 'managed hook block is repairable with config backup');
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
  console.log('PASS AXM Hermes runtime adapter v0.4 selftest: ' + passes + ' assertions; live upstream/model-provider execution intentionally not required');
}

main().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
