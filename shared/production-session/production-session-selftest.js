'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const Core = require('./production-session-core');
const Service = require('./production-session-service');

const participant = Core.cleanParticipant('  Ivan / unsafe?  ');
assert.strictEqual(participant, 'Ivan unsafe');
const id = Core.sessionId('Ivan', 1234);
assert.ok(/^ivan-ya-[a-f0-9]{8}$/.test(id));
const paths = Core.sessionPaths(path.join(os.tmpdir(), 'axm-test-base'), id);
assert.ok(paths.workspace.startsWith(paths.home));
const meta = Core.metadata({ id, participant: 'Ivan', port: 9999 });
assert.strictEqual(meta.boundaries.separateBrowserOrigin, true);
assert.strictEqual(meta.boundaries.automaticArchive, false);
assert.strictEqual(meta.boundaries.sharedLiveRuntimes, false);
const instructions = Core.workspaceInstructions(meta, 'C:\\axm workshop');
assert.ok(instructions.includes('read-only reference'));
assert.ok(instructions.includes('Nothing is archived automatically'));
const snap = Core.validateBrowserSnapshot({ origin: 'http://127.0.0.1:9999', localStorage: { a: 'b' }, indexedDb: {} });
assert.strictEqual(snap.localStorage.a, 'b');
console.log('temporary production session core: PASS');

function call(port, route, options, body) {
  return new Promise((resolve, reject) => {
    const request = http.request(Object.assign({ hostname: '127.0.0.1', port, path: route, method: body ? 'POST' : 'GET', timeout: 5000 }, options || {}), response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    request.on('timeout', () => request.destroy(Error('request timeout')));
    request.on('error', reject);
    if (body) request.end(JSON.stringify(body)); else request.end();
  });
}

async function integration() {
  const baseDir = path.join(os.tmpdir(), 'AXM-Production-Session-Selftest-' + process.pid);
  fs.mkdirSync(baseDir, { recursive: true });
  const service = Service.create({
    workshopRoot: path.resolve(__dirname, '..', '..'),
    serverFile: path.resolve(__dirname, '..', '..', 'server.js'),
    baseDir,
    auditFile: path.join(baseDir, 'audit.jsonl')
  });
  const session = await service.start({ participant: 'Ivan', preset: 'selftest' });
  const health = await call(session.port, '/api/health');
  assert.strictEqual(health.status, 200);
  assert.strictEqual(JSON.parse(health.body).productionSession.participant, 'Ivan');
  const heartbeat = await call(session.port, '/api/production-session/heartbeat', { method: 'POST' });
  assert.strictEqual(heartbeat.status, 200);
  const blocked = await call(session.port, '/services/mirror-native/health');
  assert.strictEqual(blocked.status, 409);
  const bundle = await call(session.port, '/api/production-session/bundle', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-axm-production-session': 'explicit-download-and-close' }
  }, { origin: 'http://127.0.0.1:' + session.port, localStorage: { isolated: 'yes' }, indexedDb: {} });
  assert.strictEqual(bundle.status, 200, bundle.body.toString());
  const prepared = JSON.parse(bundle.body);
  const download = await call(session.port, prepared.download);
  assert.strictEqual(download.status, 200);
  assert.ok(download.body.length > 100);
  assert.strictEqual(download.headers['content-type'], 'application/zip');
  await new Promise(resolve => setTimeout(resolve, 900));
  assert.strictEqual(fs.existsSync(session.workspace), false, 'temporary workspace should erase after download');
  console.log('temporary production session integration: PASS');
}

if (process.env.AXM_INTEGRATION_SESSION_TEST === '1') {
  integration().catch(error => { console.error(error); process.exitCode = 1; });
}
