'use strict';

const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const ContractVerifier = require('../../hub/module-contract-verifier');

const ROOT = __dirname;
let passes = 0;

function check(value, label) {
  if (!value) throw new Error('FAIL: ' + label);
  passes += 1;
}

function read(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8');
}

function json(name) {
  return JSON.parse(read(name));
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
      host: '127.0.0.1',
      port,
      path: route,
      method,
      headers: body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {}
    }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(text); } catch (error) {}
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
    } catch (error) {}
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

async function main() {
  const manifest = json('manifest.json');
  const contract = json('module.contract.json');
  const runnerSource = read('hermes-runner.js');
  const bootstrapSource = read('hermes-bootstrap.js');
  const html = read('index.html');
  const readme = read('README.md');

  check(manifest.schema === ContractVerifier.MANIFEST_SCHEMA, 'manifest uses the current tool schema');
  check(manifest.kind === 'adapter' && manifest.audience === 'human-machine', 'manifest declares adapter kind and audience');
  check(manifest.risk === 'HIGH', 'manifest exposes the external-process risk');
  check(manifest.contract === 'module.contract.json', 'manifest declares the module contract');
  check(manifest.permissions.includes('files') && manifest.permissions.includes('network') && manifest.permissions.includes('machine.execute'), 'manifest declares file, network, and process authority');
  check(ContractVerifier.validateContract(contract, manifest).pass, 'contract validates against manifest permissions');
  check(contract.boundaries.refuses.includes('hermes-runtime-readiness-claim'), 'contract refuses unproven runtime readiness');
  check(contract.boundaries.refuses.includes('control-layer-to-hermes-runtime-connection-claim'), 'contract refuses an unimplemented runtime connection');
  check(contract.boundaries.explicitWrites.includes('configured-external-command:effects-outside-wrapper-not-bounded'), 'contract exposes unbounded configured-command effects');
  check(contract.lifecycle.state_owner === 'filesystem' && contract.lifecycle.cleanup === 'explicit', 'contract declares filesystem state and explicit cleanup');

  check(/const HOST = '127\.0\.0\.1'/.test(runnerSource), 'control layer binds to loopback');
  ['/queue', '/proposal', '/prompt-packs/add'].forEach(route => {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    check(new RegExp("req\\.url === '" + escaped + "'[\\s\\S]{0,140}requireConsent\\(res\\)").test(runnerSource), route + ' is consent-gated in source');
  });
  check(!/require\(['"]https['"]\)|\bfetch\s*\(/.test(runnerSource), 'control layer contains no external network client');
  check(/action === 'install'/.test(bootstrapSource) && /run\('git', args\)/.test(bootstrapSource), 'bootstrap clone is tied to explicit install action');
  check(/action === 'start'/.test(bootstrapSource) && /cfg\.start_command/.test(bootstrapSource), 'bootstrap launch requires configured start action');
  check(/Refusing to guess/.test(bootstrapSource), 'bootstrap refuses install without explicit source config');
  check(/does not install, start, connect to, sandbox, or verify Hermes/.test(html), 'landing card states its non-runtime boundary');
  check(!/prompt-vault\/(?:add|list)/.test(readme) && /prompt-packs\/add/.test(readme), 'README endpoints match the runner');
  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    new Function(match[1]);
    passes += 1;
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-hermes-selftest-'));
  const hermesRoot = path.join(tempRoot, 'hermes');
  const runnerCopy = path.join(hermesRoot, 'hermes-runner.js');
  const output = { value: '' };
  let child = null;
  try {
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
    check(health.body && health.body.ok === true && health.body.consent === false, 'isolated runner starts healthy with consent off');
    check(health.body.host === '127.0.0.1' && health.body.port === port, 'health reports the isolated loopback endpoint');

    const modules = await request(port, 'GET', '/modules');
    check(modules.status === 200 && modules.body.modules.some(item => item.id === 'task-queue'), 'module inventory is readable without consent');

    const refusedQueue = await request(port, 'POST', '/queue', { title: 'must not write' });
    check(refusedQueue.status === 403 && refusedQueue.body.ok === false, 'queue write is refused with consent off');
    check(fs.readdirSync(path.join(hermesRoot, 'queue')).length === 0, 'refused queue request writes no task file');

    const consentOn = await request(port, 'POST', '/consent', { enabled: true, reason: 'isolated selftest' });
    check(consentOn.status === 200 && consentOn.body.consent.enabled === true, 'explicit local request enables control-layer consent');
    check(fs.existsSync(path.join(hermesRoot, '.hermes-consent.json')), 'consent state is persisted inside the isolated module');

    const queued = await request(port, 'POST', '/queue', { source: 'selftest', kind: 'review', title: 'Bounded task', text: 'Inspect only.' });
    check(queued.status === 200 && queued.body.result.task.status === 'proposal', 'consented queue route emits proposal status');
    const queueFiles = fs.readdirSync(path.join(hermesRoot, 'queue')).filter(name => name.endsWith('.json'));
    check(queueFiles.length === 1, 'consented queue route writes exactly one task JSON');
    const task = JSON.parse(fs.readFileSync(path.join(hermesRoot, 'queue', queueFiles[0]), 'utf8'));
    check(/proposal only/.test(task.axm_rule), 'task record preserves proposal-only rule');

    const proposed = await request(port, 'POST', '/proposal', { source: 'selftest', title: '../../Review boundary', text: 'No apply.' });
    check(proposed.status === 200 && !path.basename(proposed.body.result.file).includes('..'), 'proposal route sanitizes its generated filename');
    const proposalPath = path.resolve(hermesRoot, proposed.body.result.file);
    const proposalText = fs.readFileSync(proposalPath, 'utf8');
    check(proposalPath.startsWith(path.join(hermesRoot, 'outbox') + path.sep) && /Human review required/.test(proposalText), 'proposal stays in outbox and requires review');

    const prompt = await request(port, 'POST', '/prompt-packs/add', { title: '../../Prompt boundary', purpose: 'test', text: 'Review me.' });
    check(prompt.status === 200 && prompt.body.result.prompt_pack.status === 'local-prompt-pack', 'prompt-pack route emits local status');
    const promptPath = path.resolve(hermesRoot, prompt.body.result.file);
    check(promptPath.startsWith(path.join(tempRoot, 'agent-tool-forge', 'prompt-packs') + path.sep) && fs.existsSync(promptPath), 'prompt pack stays in the declared sibling folder');

    const consentOff = await request(port, 'POST', '/consent', { enabled: false, reason: 'selftest complete' });
    check(consentOff.body.consent.enabled === false, 'control-layer consent can be revoked');
    const refusedList = await request(port, 'GET', '/prompt-packs/list');
    check(refusedList.status === 403, 'prompt-pack list is refused after consent revocation');
    const missing = await request(port, 'GET', '/not-a-route');
    check(missing.status === 404, 'unknown routes fail closed');
  } finally {
    await stop(child);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log('PASS Hermes local wrapper selftest: ' + passes + ' assertions; external Hermes runtime readiness UNKNOWN');
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
