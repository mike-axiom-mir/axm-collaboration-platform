'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');

const HUB_ROOT = path.resolve(__dirname, '..');
const HUB_ENTRY = path.join(HUB_ROOT, 'game-hub-server.js');

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function request(port, requestPath, options) {
  const config = options || {};
  const body = config.body == null ? null : JSON.stringify(config.body);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: requestPath,
      method: config.method || 'GET',
      timeout: 3000,
      headers: body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {}
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch (error) {}
        resolve({ status: response.statusCode, text, json });
      });
    });
    req.on('timeout', () => req.destroy(new Error('request timed out')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function waitFor(check, timeoutMs, label) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  throw new Error(label + (lastError ? ': ' + lastError.message : ''));
}

async function portClosed(port) {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(true));
    socket.setTimeout(500, () => { socket.destroy(); resolve(true); });
  });
}

async function run() {
  const hubPort = await freePort();
  const resultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-idle-test-'));
  let output = '';
  let hub = null;
  let assertions = 0;
  try {
    assert.equal(await portClosed(8800), true, 'slot 010 runtime port must be free before the test'); assertions++;
    hub = childProcess.spawn(process.execPath, [HUB_ENTRY], {
      cwd: HUB_ROOT,
      env: Object.assign({}, process.env, {
        AXM_GAME_HUB_HOST: '127.0.0.1',
        AXM_GAME_HUB_PORT: String(hubPort),
        AXM_GAME_HUB_RESULT_DIR: resultDir,
        AXM_GAME_IDLE_TIMEOUT_MS: '900'
      }),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    hub.stdout.on('data', chunk => { output += chunk; });
    hub.stderr.on('data', chunk => { output += chunk; });
    await waitFor(async () => (await request(hubPort, '/health')).status === 200, 5000, 'Game Hub did not start');
    const health = await request(hubPort, '/health');
    assert.equal(health.json.runtime_idle_timeout_ms, 900); assertions++;

    let response = await request(hubPort, '/seat/assign', { method: 'POST', body: { seat_id: 'seat_1', patch: { type: 'human', display_name: 'Idle Test' } } });
    assert.equal(response.status, 200); assertions++;
    response = await request(hubPort, '/seat/ready', { method: 'POST', body: { seat_id: 'seat_1', ready: true } });
    assert.equal(response.status, 200); assertions++;
    response = await request(hubPort, '/game/start', { method: 'POST', body: { game_id: '010-living-globe-tycoon', play_mode: 'rules-lab' } });
    assert.equal(response.status, 200, response.text); assertions++;
    assert.equal(response.json.runtime_idle.timeout_ms, 900); assertions++;

    const page = await request(8800, '/games/010/game/tycoon-steward/');
    assert.equal(page.status, 200); assertions++;
    assert.ok(page.text.includes('data-axm-runtime-activity="v1"'), 'managed HTML must receive the activity sensor'); assertions++;
    const sensor = await request(8800, '/__axm/activity-client.js');
    assert.equal(sensor.status, 200); assertions++;
    assert.ok(sensor.text.includes("'pointerdown'"), 'sensor must observe explicit browser input'); assertions++;

    await new Promise(resolve => setTimeout(resolve, 550));
    const activity = await request(8800, '/__axm/activity', { method: 'POST', body: { kind: 'selftest-input' } });
    assert.equal(activity.status, 204); assertions++;
    await new Promise(resolve => setTimeout(resolve, 550));
    let current = await request(hubPort, '/state');
    assert.equal(current.json.state.session.phase, 'RUNNING', 'activity must extend the runtime lease'); assertions++;

    await waitFor(async () => {
      current = await request(hubPort, '/state');
      return current.json.state.session.phase === 'LOBBY';
    }, 3500, 'idle runtime did not return to lobby');
    assertions++;
    const results = await request(hubPort, '/results');
    assert.equal(results.json.results[0].status, 'idle-timeout'); assertions++;
    assert.equal(results.json.results[0].confirmed_finish, false); assertions++;
    await waitFor(() => portClosed(8800), 2000, 'idle child runtime port stayed open'); assertions++;
    return { assertions };
  } finally {
    if (hub && hub.exitCode === null) hub.kill();
    fs.rmSync(resultDir, { recursive: true, force: true });
    if (output && process.env.AXM_TEST_VERBOSE === '1') process.stdout.write(output);
  }
}

if (require.main === module) {
  run().then(result => console.log(`PASS runtime idle integration: ${result.assertions} assertions`)).catch(error => {
    console.error('FAIL runtime idle integration: ' + error.message);
    process.exitCode = 1;
  });
}

module.exports = { run };
