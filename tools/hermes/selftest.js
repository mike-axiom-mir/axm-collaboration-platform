'use strict';

const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const ContractVerifier = require('../../hub/module-contract-verifier');

const ROOT = __dirname;
let passes = 0;

function check(value, label) {
  if (!value) throw new Error('FAIL: ' + label);
  passes += 1;
}
function read(name) { return fs.readFileSync(path.join(ROOT, name), 'utf8'); }
function json(name) { return JSON.parse(read(name)); }
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8'); }

function pythonCommand() {
  for (const cmd of ['python', 'python3']) {
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
    if (r.status === 0) return cmd;
  }
  throw new Error('FAIL: Python required by Hermes AXM gate selftest');
}

function hookCall(script, payload, env) {
  const r = spawnSync(pythonCommand(), [script], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: Object.assign({}, process.env, env || {}),
    shell: process.platform === 'win32'
  });
  if (r.status !== 0) throw new Error('hook process failed: ' + (r.stderr || r.stdout || r.status));
  try { return JSON.parse(String(r.stdout || '{}').trim() || '{}'); }
  catch (_) { throw new Error('hook returned non-JSON: ' + r.stdout); }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function request(port, method, route, payload) {
  return new Promise((resolve, reject) => {
    const body = payload === undefined ? null : JSON.stringify(payload);
    const req = http.request({
      host: '127.0.0.1', port, path: route, method,
      headers: body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {}
    }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(text); } catch (_) {}
        resolve({ status: res.statusCode, text, body: parsed });
      });
    });
    req.once('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function waitForHealth(port, child, output) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error('runner exited before health: ' + output.value);
    try {
      const result = await request(port, 'GET', '/health');
      if (result.status === 200) return result;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('runner health timed out: ' + output.value);
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill();
  await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 1500))]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

function testRuntimeGate(tempRoot) {
  const gate = path.join(ROOT, 'axm', 'axm_gate.py');
  const context = path.join(ROOT, 'axm', 'axm_context.py');
  const receipt = path.join(ROOT, 'axm', 'axm_receipt.py');
  const policyFile = path.join(tempRoot, 'policy.json');
  const workspace = path.join(tempRoot, 'workspace');
  const stateDir = path.join(tempRoot, 'state');
  const receiptDir = path.join(tempRoot, 'receipts');
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(stateDir, { recursive: true });
  const policy = json('axm-policy.example.json');
  policy.paths.read_roots = [workspace];
  policy.paths.write_roots = [workspace];
  policy.limits.max_tool_calls_per_session = 3;
  policy.limits.max_files_read_per_session = 3;
  policy.limits.max_files_written_per_session = 2;
  writeJson(policyFile, policy);
  const env = {
    AXM_HERMES_ROOT: ROOT,
    AXM_HERMES_POLICY_FILE: policyFile,
    AXM_HERMES_WORKSPACE: workspace,
    AXM_HERMES_STATE_DIR: stateDir,
    AXM_HERMES_RECEIPT_DIR: receiptDir
  };

  let result = hookCall(gate, { tool_name: 'read_file', tool_input: { path: 'a.txt' }, session_id: 'off' }, env);
  check(result.action === 'block' && /consent is OFF/.test(result.message), 'runtime gate blocks every tool while consent is off');

  policy.consent.enabled = true;
  writeJson(policyFile, policy);
  result = hookCall(gate, { tool_name: 'read_file', tool_input: { path: 'a.txt' }, session_id: 'allowed' }, env);
  check(Object.keys(result).length === 0, 'runtime gate allows a consented read inside configured root');
  result = hookCall(gate, { tool_name: 'write_file', tool_input: { path: 'draft.txt', content: 'x' }, session_id: 'allowed' }, env);
  check(Object.keys(result).length === 0, 'runtime gate allows a consented write inside configured root');
  result = hookCall(gate, { tool_name: 'write_file', tool_input: { path: path.join(tempRoot, 'outside.txt') }, session_id: 'outside' }, env);
  check(result.action === 'block' && /outside configured AXM roots/.test(result.message), 'runtime gate blocks write outside configured roots');
  result = hookCall(gate, { tool_name: 'terminal', tool_input: { command: 'echo hi' }, session_id: 'terminal' }, env);
  check(result.action === 'block' && /allow_terminal/.test(result.message), 'runtime gate blocks terminal by default');

  policy.limits.max_tool_calls_per_session = 2;
  writeJson(policyFile, policy);
  check(Object.keys(hookCall(gate, { tool_name: 'read_file', tool_input: { path: 'a' }, session_id: 'limit' }, env)).length === 0, 'first bounded tool call allowed');
  check(Object.keys(hookCall(gate, { tool_name: 'read_file', tool_input: { path: 'b' }, session_id: 'limit' }, env)).length === 0, 'second bounded tool call allowed');
  result = hookCall(gate, { tool_name: 'read_file', tool_input: { path: 'c' }, session_id: 'limit' }, env);
  check(result.action === 'block' && /tool-call limit reached/.test(result.message), 'runtime gate enforces tool-call limit');

  const contextResult = hookCall(context, { user_message: 'hello' }, env);
  check(typeof contextResult.context === 'string' && /candidate/.test(contextResult.context) && /bypass/.test(contextResult.context), 'pre-LLM context carries candidate and no-bypass rules');

  policy.limits.max_tool_calls_per_session = 3;
  policy.receipts.enabled = true;
  writeJson(policyFile, policy);
  hookCall(receipt, {
    tool_name: 'read_file', status: 'success', session_id: 'receipt-session', turn_id: 'raw-turn-id', tool_call_id: 'raw-call-id',
    args: { path: '/private/secret.txt', token: 'DO_NOT_STORE_ME' }, result: 'SECRET_RESULT_DO_NOT_STORE'
  }, env);
  const receiptFiles = fs.readdirSync(receiptDir).filter(name => name.endsWith('.jsonl'));
  check(receiptFiles.length === 1, 'receipt hook writes one local metadata receipt');
  const receiptText = fs.readFileSync(path.join(receiptDir, receiptFiles[0]), 'utf8');
  check(!receiptText.includes('DO_NOT_STORE_ME') && !receiptText.includes('SECRET_RESULT_DO_NOT_STORE') && !receiptText.includes('/private/secret.txt'), 'receipt excludes raw arguments, results, and paths');
  const receiptRecord = JSON.parse(receiptText.trim());
  check(receiptRecord.canon === false && receiptRecord.review_required === true && receiptRecord.raw_arguments_stored === false, 'receipt is explicitly non-canonical and redacted');
}

async function main() {
  const manifest = json('manifest.json');
  const contract = json('module.contract.json');
  const sourceLock = json('hermes-source.lock.json');
  const policyExample = json('axm-policy.example.json');
  const runnerSource = read('hermes-runner.js');
  const bootstrapSource = read('hermes-bootstrap.js');
  const gateSource = read(path.join('axm', 'axm_gate.py'));
  const html = read('index.html');
  const readme = read('README.md');

  check(manifest.schema === ContractVerifier.MANIFEST_SCHEMA, 'manifest uses current tool schema');
  check(manifest.kind === 'adapter' && manifest.audience === 'human-machine', 'manifest declares adapter kind and audience');
  check(manifest.version === 'v0.3' && contract.version === 'v0.3', 'manifest and contract agree on v0.3');
  check(manifest.risk === 'HIGH', 'manifest keeps external runtime risk visible');
  check(manifest.contract === 'module.contract.json', 'manifest declares module contract');
  check(manifest.permissions.includes('files') && manifest.permissions.includes('network') && manifest.permissions.includes('machine.execute'), 'manifest declares file, network, and process authority');
  check(ContractVerifier.validateContract(contract, manifest).pass, 'contract validates against manifest permissions');
  check(contract.boundaries.refuses.includes('os-container-or-vm-sandbox-enforcement-claim'), 'contract refuses fake OS sandbox claim');
  check(contract.boundaries.refuses.includes('tool-policy-as-model-provider-egress-gate-claim'), 'contract refuses fake provider-egress claim');
  check(contract.boundaries.refuses.includes('hermes-memory-as-axm-canon') && contract.boundaries.refuses.includes('hermes-generated-skill-as-axm-canon'), 'contract refuses automatic Hermes learning canon');

  check(sourceLock.schema === 'axm.hermes-source-lock/v1', 'reviewed source lock has expected schema');
  check(sourceLock.repo_url === 'https://github.com/NousResearch/hermes-agent.git', 'source lock points to official NousResearch Hermes repository');
  check(/^[0-9a-f]{40}$/.test(sourceLock.commit), 'source lock uses a full immutable commit SHA');
  check(policyExample.consent.enabled === false, 'runtime policy consent defaults off');
  ['allow_terminal', 'allow_execute_code', 'allow_computer_use', 'allow_delegation', 'allow_scheduling', 'allow_messaging'].forEach(key => {
    check(policyExample.capabilities[key] === false, key + ' defaults off');
  });
  check(policyExample.canon.hermes_memory_is_canon === false && policyExample.canon.hermes_skills_are_canon === false, 'policy keeps Hermes memory and skills non-canonical');

  check(/const HOST = '127\.0\.0\.1'/.test(runnerSource), 'legacy control layer binds to loopback');
  ['/queue', '/proposal', '/prompt-packs/add'].forEach(route => {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    check(new RegExp("req\\.url === '" + escaped + "'[\\s\\S]{0,140}requireConsent\\(res\\)").test(runnerSource), route + ' stays consent-gated');
  });
  check(!/require\(['"]https['"]\)|\bfetch\s*\(/.test(runnerSource), 'legacy control layer contains no external network client');

  check(/hermes-source\.lock\.json/.test(bootstrapSource) && /\^\[0-9a-f\]\{40\}\$/.test(bootstrapSource), 'bootstrap requires immutable source lock');
  check(/fetch', '--depth', '1', 'origin', lock\.commit/.test(bootstrapSource), 'bootstrap fetches the exact locked commit');
  check(/checkout', '--detach', lock\.commit/.test(bootstrapSource), 'bootstrap checks out locked commit detached');
  check(/HERMES_YOLO_MODE: ''/.test(bootstrapSource) && /HERMES_ENABLE_PROJECT_PLUGINS: 'false'/.test(bootstrapSource), 'launcher disables YOLO and project plugins');
  check(/fail_closed: true/.test(bootstrapSource), 'generated Hermes pre-tool hook is fail closed');
  check(/action === 'deps'/.test(bootstrapSource) && /\['sync', '--locked'\]/.test(bootstrapSource), 'dependency install is separate and lockfile based');
  check(/Refusing silent rewrite/.test(bootstrapSource), 'prepare refuses silent local profile replacement');
  check(/HIGH_AUTHORITY/.test(gateSource) && /allow_terminal/.test(gateSource), 'gate contains explicit high-authority capability controls');
  check(/not an OS sandbox/i.test(readme) && /model-provider/i.test(readme), 'README exposes sandbox and provider-egress limits');
  check(/not an OS sandbox/i.test(html), 'landing card exposes non-sandbox boundary');

  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    new Function(match[1]); passes += 1;
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-hermes-selftest-'));
  const hermesRoot = path.join(tempRoot, 'hermes');
  const runnerCopy = path.join(hermesRoot, 'hermes-runner.js');
  const output = { value: '' };
  let child = null;
  try {
    testRuntimeGate(path.join(tempRoot, 'runtime-gate'));

    fs.mkdirSync(hermesRoot, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'hermes-runner.js'), runnerCopy);
    const port = await freePort();
    child = spawn(process.execPath, [runnerCopy], {
      cwd: hermesRoot,
      env: Object.assign({}, process.env, { AXM_HERMES_PORT: String(port) }),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', chunk => { output.value += chunk.toString(); });
    child.stderr.on('data', chunk => { output.value += chunk.toString(); });

    const health = await waitForHealth(port, child, output);
    check(health.body && health.body.ok === true && health.body.consent === false, 'isolated legacy runner starts healthy with consent off');
    check(health.body.host === '127.0.0.1' && health.body.port === port, 'health reports isolated loopback endpoint');

    const modules = await request(port, 'GET', '/modules');
    check(modules.status === 200 && modules.body.modules.some(item => item.id === 'task-queue'), 'module inventory readable without consent');
    const refusedQueue = await request(port, 'POST', '/queue', { title: 'must not write' });
    check(refusedQueue.status === 403 && refusedQueue.body.ok === false, 'legacy queue write refused with consent off');
    check(fs.readdirSync(path.join(hermesRoot, 'queue')).length === 0, 'refused queue request writes no task file');

    const consentOn = await request(port, 'POST', '/consent', { enabled: true, reason: 'isolated selftest' });
    check(consentOn.status === 200 && consentOn.body.consent.enabled === true, 'explicit request enables legacy control-layer consent');
    check(fs.existsSync(path.join(hermesRoot, '.hermes-consent.json')), 'legacy consent state persists inside isolated module');

    const queued = await request(port, 'POST', '/queue', { source: 'selftest', kind: 'review', title: 'Bounded task', text: 'Inspect only.' });
    check(queued.status === 200 && queued.body.result.task.status === 'proposal', 'consented legacy queue emits proposal status');
    const queueFiles = fs.readdirSync(path.join(hermesRoot, 'queue')).filter(name => name.endsWith('.json'));
    check(queueFiles.length === 1, 'consented legacy queue writes exactly one task JSON');
    const task = JSON.parse(fs.readFileSync(path.join(hermesRoot, 'queue', queueFiles[0]), 'utf8'));
    check(/proposal only/.test(task.axm_rule), 'task record preserves proposal-only rule');

    const proposed = await request(port, 'POST', '/proposal', { source: 'selftest', title: '../../Review boundary', text: 'No apply.' });
    check(proposed.status === 200 && !path.basename(proposed.body.result.file).includes('..'), 'proposal route sanitizes generated filename');
    const proposalPath = path.resolve(hermesRoot, proposed.body.result.file);
    const proposalText = fs.readFileSync(proposalPath, 'utf8');
    check(proposalPath.startsWith(path.join(hermesRoot, 'outbox') + path.sep) && /Human review required/.test(proposalText), 'proposal stays in outbox and requires review');

    const prompt = await request(port, 'POST', '/prompt-packs/add', { title: '../../Prompt boundary', purpose: 'test', text: 'Review me.' });
    check(prompt.status === 200 && prompt.body.result.prompt_pack.status === 'local-prompt-pack', 'prompt-pack route emits local status');
    const promptPath = path.resolve(hermesRoot, prompt.body.result.file);
    check(promptPath.startsWith(path.join(tempRoot, 'agent-tool-forge', 'prompt-packs') + path.sep) && fs.existsSync(promptPath), 'prompt pack stays in declared sibling folder');

    const consentOff = await request(port, 'POST', '/consent', { enabled: false, reason: 'selftest complete' });
    check(consentOff.body.consent.enabled === false, 'legacy control-layer consent can be revoked');
    const refusedList = await request(port, 'GET', '/prompt-packs/list');
    check(refusedList.status === 403, 'prompt-pack list refused after consent revocation');
    const missing = await request(port, 'GET', '/not-a-route');
    check(missing.status === 404, 'unknown legacy routes fail closed');
  } finally {
    await stop(child);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log('PASS AXM Hermes runtime adapter selftest: ' + passes + ' assertions; upstream model/provider runtime execution not exercised');
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
