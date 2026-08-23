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
  throw new Error('FAIL: Python is required by AXM Hermes runtime');
}

function hookCall(script, payload, env) {
  const r = spawnSync(pythonCommand(), [script], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: Object.assign({}, process.env, env),
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
        resolve({ status: res.statusCode, body: parsed, text });
      });
    });
    req.once('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function waitForHealth(port, child, output) {
  for (let i = 0; i < 60; i += 1) {
    if (child.exitCode !== null) throw new Error('runner exited before health: ' + output.value);
    try {
      const result = await request(port, 'GET', '/health');
      if (result.status === 200) return result;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('runner health timeout: ' + output.value);
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill();
  await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 1500))]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

function testRuntimeBoundary(tempRoot) {
  const gate = path.join(ROOT, 'axm', 'axm_gate.py');
  const context = path.join(ROOT, 'axm', 'axm_context.py');
  const receipt = path.join(ROOT, 'axm', 'axm_receipt.py');
  const policyFile = path.join(tempRoot, 'policy.json');
  const workspace = path.join(tempRoot, 'workspace');
  const stateDir = path.join(tempRoot, 'state');
  const receiptDir = path.join(tempRoot, 'receipts');
  fs.mkdirSync(workspace, { recursive: true });
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
  const call = (tool, args, session) => hookCall(gate, { tool_name: tool, tool_input: args || {}, session_id: session || tool }, env);

  let result = call('read_file', { path: 'a.txt' }, 'consent-off');
  check(result.action === 'block' && /consent is OFF/.test(result.message), 'consent off blocks tool dispatch');

  policy.consent.enabled = true;
  writeJson(policyFile, policy);
  result = call('read_file', { path: 'a.txt' }, 'allowed');
  check(Object.keys(result).length === 0, 'read inside configured root allowed');
  result = call('write_file', { path: 'draft.txt', content: 'x' }, 'allowed');
  check(Object.keys(result).length === 0, 'write inside configured root allowed');
  result = call('write_file', { path: path.join(tempRoot, 'outside.txt') }, 'outside');
  check(result.action === 'block' && /outside configured AXM roots/.test(result.message), 'outside-root write blocked');
  result = call('write_file', { content: 'no path' }, 'missing-path');
  check(result.action === 'block' && /containment cannot be verified/.test(result.message), 'unverifiable file mutation fails closed');

  const expectedCapability = {
    terminal: 'allow_terminal',
    process: 'allow_terminal',
    execute_code: 'allow_execute_code',
    computer_use: 'allow_computer_use',
    delegate_task: 'allow_delegation',
    cronjob: 'allow_scheduling',
    memory: 'allow_memory_mutation',
    skill_manage: 'allow_skill_mutation',
    browser_click: 'allow_browser_interaction',
    send_message: 'allow_messaging',
    ha_call_service: 'allow_home_automation',
    project_create: 'allow_project_changes',
    kanban_create: 'allow_coordination_mutation',
    image_generate: 'allow_generation'
  };
  for (const [tool, capability] of Object.entries(expectedCapability)) {
    result = call(tool, {}, 'blocked-' + tool);
    check(result.action === 'block' && result.message.includes(capability), tool + ' requires explicit ' + capability);
  }

  policy.mode.hub_sandbox = false;
  policy.mode.external_mode = false;
  writeJson(policyFile, policy);
  result = call('web_search', { query: 'test' }, 'bad-mode');
  check(result.action === 'block' && /exactly one run space/.test(result.message), 'ambiguous run-space policy fails closed');
  policy.mode.hub_sandbox = true;
  writeJson(policyFile, policy);

  policy.limits.max_tool_calls_per_session = 2;
  writeJson(policyFile, policy);
  check(Object.keys(call('web_search', { query: 'a' }, 'limit')).length === 0, 'first bounded tool call allowed');
  check(Object.keys(call('web_search', { query: 'b' }, 'limit')).length === 0, 'second bounded tool call allowed');
  result = call('web_search', { query: 'c' }, 'limit');
  check(result.action === 'block' && /tool-call limit reached/.test(result.message), 'tool-call limit enforced');

  const contextResult = hookCall(context, { user_message: 'hello' }, env);
  check(typeof contextResult.context === 'string' && /candidate/.test(contextResult.context) && /bypass/.test(contextResult.context), 'AXM context injects candidate/no-bypass rules');

  policy.limits.max_tool_calls_per_session = 3;
  writeJson(policyFile, policy);
  hookCall(receipt, {
    tool_name: 'read_file', status: 'success', session_id: 'raw-session', turn_id: 'raw-turn', tool_call_id: 'raw-call',
    args: { path: '/private/secret.txt', token: 'DO_NOT_STORE_ME' }, result: 'SECRET_RESULT_DO_NOT_STORE'
  }, env);
  const files = fs.readdirSync(receiptDir).filter(name => name.endsWith('.jsonl'));
  check(files.length === 1, 'metadata receipt written');
  const text = fs.readFileSync(path.join(receiptDir, files[0]), 'utf8');
  check(!text.includes('DO_NOT_STORE_ME') && !text.includes('SECRET_RESULT_DO_NOT_STORE') && !text.includes('/private/secret.txt') && !text.includes('raw-session'), 'receipt excludes raw arguments/results/paths/ids');
  const record = JSON.parse(text.trim());
  check(record.canon === false && record.review_required === true && record.raw_arguments_stored === false && record.raw_result_stored === false, 'receipt explicitly non-canonical and redacted');
}

async function testLegacyLoopback(tempRoot) {
  const hermesRoot = path.join(tempRoot, 'legacy-runner');
  fs.mkdirSync(hermesRoot, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'hermes-runner.js'), path.join(hermesRoot, 'hermes-runner.js'));
  const port = await freePort();
  const output = { value: '' };
  const child = spawn(process.execPath, [path.join(hermesRoot, 'hermes-runner.js')], {
    cwd: hermesRoot,
    env: Object.assign({}, process.env, { AXM_HERMES_PORT: String(port) }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', chunk => { output.value += chunk.toString(); });
  child.stderr.on('data', chunk => { output.value += chunk.toString(); });
  try {
    const health = await waitForHealth(port, child, output);
    check(health.body && health.body.ok === true && health.body.consent === false, 'legacy runner starts loopback with consent off');
    check(health.body.host === '127.0.0.1' && health.body.port === port, 'legacy health reports loopback endpoint');
    const refused = await request(port, 'POST', '/queue', { title: 'must not write' });
    check(refused.status === 403, 'legacy queue refuses write while consent off');
    const on = await request(port, 'POST', '/consent', { enabled: true, reason: 'selftest' });
    check(on.status === 200 && on.body.consent.enabled === true, 'legacy consent can be explicitly enabled');
    const queued = await request(port, 'POST', '/queue', { source: 'selftest', title: 'bounded', text: 'inspect only' });
    check(queued.status === 200 && queued.body.result.task.status === 'proposal' && /proposal only/.test(queued.body.result.task.axm_rule), 'legacy queue stays proposal-only');
    const proposal = await request(port, 'POST', '/proposal', { source: 'selftest', title: '../../boundary', text: 'No apply.' });
    check(proposal.status === 200 && !path.basename(proposal.body.result.file).includes('..'), 'legacy proposal filename is sanitized');
    const off = await request(port, 'POST', '/consent', { enabled: false, reason: 'done' });
    check(off.body.consent.enabled === false, 'legacy consent can be revoked');
  } finally {
    await stop(child);
  }
}

async function main() {
  const manifest = json('manifest.json');
  const contract = json('module.contract.json');
  const sourceLock = json('hermes-source.lock.json');
  const policy = json('axm-policy.example.json');
  const bootstrap = read('hermes-bootstrap.js');
  const runner = read('hermes-runner.js');
  const readme = read('README.md');
  const html = read('index.html');

  check(manifest.schema === ContractVerifier.MANIFEST_SCHEMA, 'manifest schema current');
  check(manifest.kind === 'adapter' && manifest.risk === 'HIGH', 'manifest exposes adapter/high-risk role');
  check(manifest.version === 'v0.3' && contract.version === 'v0.3', 'manifest and contract version aligned');
  check(ContractVerifier.validateContract(contract, manifest).pass, 'module contract validates');
  check(contract.boundaries.refuses.includes('os-container-or-vm-sandbox-enforcement-claim'), 'contract refuses fake OS sandbox claim');
  check(contract.boundaries.refuses.includes('tool-policy-as-model-provider-egress-gate-claim'), 'contract refuses fake provider-egress claim');
  check(contract.boundaries.refuses.includes('hermes-memory-as-axm-canon') && contract.boundaries.refuses.includes('hermes-generated-skill-as-axm-canon'), 'contract refuses automatic Hermes canon');

  check(sourceLock.repo_url === 'https://github.com/NousResearch/hermes-agent.git', 'source lock uses official upstream');
  check(/^[0-9a-f]{40}$/.test(sourceLock.commit), 'source lock is immutable full SHA');
  check(policy.consent.enabled === false && policy.mode.hub_sandbox === true && policy.mode.external_mode === false, 'default policy is consent-off in hub run space');
  Object.entries(policy.capabilities).forEach(([name, enabled]) => check(enabled === false, name + ' defaults off'));
  check(policy.canon.hermes_memory_is_canon === false && policy.canon.hermes_skills_are_canon === false, 'Hermes learning defaults non-canonical');

  check(/hermes-source\.lock\.json/.test(bootstrap), 'bootstrap consumes immutable source lock');
  check(/git', \['fetch', '--depth', '1', 'origin', lock\.commit\]/.test(bootstrap), 'bootstrap fetches exact commit');
  check(/git', \['checkout', '--detach', lock\.commit\]/.test(bootstrap), 'bootstrap checks out detached exact commit');
  check(/HERMES_YOLO_MODE: ''/.test(bootstrap) && /HERMES_ENABLE_PROJECT_PLUGINS: 'false'/.test(bootstrap), 'launcher disables YOLO and project plugins');
  check(/fail_closed: true/.test(bootstrap), 'generated pre-tool gate configured fail closed');
  check(/action === 'deps'/.test(bootstrap) && /\['sync', '--locked'\]/.test(bootstrap), 'dependencies are explicit and lockfile based');
  check(/Refusing silent rewrite/.test(bootstrap), 'profile preparation refuses silent rewrite');
  check(/const HOST = '127\.0\.0\.1'/.test(runner), 'legacy runner remains loopback only');
  check(/not an OS sandbox/i.test(readme) && /model-provider/i.test(readme), 'README states isolation and provider-egress limits');
  check(/not an OS sandbox/i.test(html), 'landing card states non-sandbox boundary');

  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    new Function(match[1]); passes += 1;
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-hermes-selftest-'));
  try {
    testRuntimeBoundary(path.join(tempRoot, 'runtime'));
    await testLegacyLoopback(tempRoot);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
  console.log('PASS AXM Hermes runtime adapter selftest: ' + passes + ' assertions; live upstream/model-provider execution not exercised');
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
