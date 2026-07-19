'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TOKEN_FILE = path.join(ROOT, 'storage', 'runtime', 'forge-token.txt');
const LOCK_FILE = path.join(ROOT, 'storage', 'runtime', 'safe-learning.lock');
const FORGE_PORT = Number(process.env.AXM_MIRROR_FORGE_PORT || 8801);
const WORKSHOP_PORT = Number(process.env.AXM_WORKSHOP_PORT || 8788);
const MAX_INPUT_BYTES = 512 * 1024;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30000;
const REFUSED_ROUTES = new Set(['/api/opt-in', '/api/opt-out', '/api/promotions/apply', '/api/promotions/rollback', '/api/mirror-core/export']);

function usage() {
  return [
    'Usage:',
    '  node scripts/safe-learning-request.js --route /api/tracks/structured/grade --input payload.json [--mode manual|automatic] [--output receipt.json]',
    '',
    'Manual mode still uses the Forge memory/session guard.',
    'Automatic mode additionally requires a live Body Pulse lease and refuses when the shared body is stopped, resting, busy or red.'
  ].join('\n');
}

function args(argv) {
  const result = { mode: 'manual' };
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    result[argv[i].slice(2)] = argv[i + 1];
    i += 1;
  }
  if (!result.route || !result.input) throw new Error(usage());
  if (!/^\/api\/[a-z0-9/_-]+$/i.test(result.route) || REFUSED_ROUTES.has(result.route)) throw new Error('route is not permitted by the safe learning client');
  if (!['manual', 'automatic'].includes(result.mode)) throw new Error('mode must be manual or automatic');
  return result;
}

function requestJson({ port, route, method = 'GET', body = null, headers = {}, timeoutMs = REQUEST_TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    const encoded = body == null ? null : Buffer.from(JSON.stringify(body));
    const req = http.request({ host: '127.0.0.1', port, path: route, method, headers: Object.assign({ accept: 'application/json' }, encoded ? { 'content-type': 'application/json', 'content-length': encoded.length } : {}, headers) }, res => {
      const chunks = [];
      let size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) {
          req.destroy(new Error('response exceeded the safe 2 MiB ceiling'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        try {
          const text = Buffer.concat(chunks).toString('utf8');
          const payload = text ? JSON.parse(text) : {};
          if (res.statusCode < 200 || res.statusCode >= 300 || payload.ok === false) throw new Error((payload && payload.error) || ('HTTP ' + res.statusCode));
          resolve(payload);
        } catch (error) { reject(error); }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('safe learning request exceeded ' + timeoutMs + ' ms')));
    req.on('error', reject);
    if (encoded) req.write(encoded);
    req.end();
  });
}

function processAlive(pid) {
  try { process.kill(Number(pid), 0); return true; } catch (error) { return error && error.code === 'EPERM'; }
}

function acquireLock() {
  fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  try {
    const descriptor = fs.openSync(LOCK_FILE, 'wx');
    fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }) + '\n');
    fs.closeSync(descriptor);
    return;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  let prior = null;
  try { prior = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')); } catch (_error) {}
  if (prior && processAlive(prior.pid)) throw new Error('another safe learning client is already active (PID ' + prior.pid + ')');
  fs.rmSync(LOCK_FILE, { force: true });
  return acquireLock();
}

function releaseLock() {
  try {
    const record = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
    if (Number(record.pid) === process.pid) fs.rmSync(LOCK_FILE, { force: true });
  } catch (_error) {}
}

async function requestPulse() {
  await requestJson({
    port: WORKSHOP_PORT,
    route: '/api/body-pulse/register',
    method: 'POST',
    headers: { 'x-axm-body-pulse': 'explicit-module-config' },
    body: {
      moduleId: 'mirror-learning-forge', name: 'Mirror Learning Forge', goalQueueId: 'mirror-learning-goals', enabled: true,
      allowMaintenance: true, priority: 75, activeCadenceMs: 900000, idleCadenceMs: 7200000,
      cost: { cpu: 4, memory: 4, gpu: 0 }, authority: 'challenger-only', promotionGate: 'held-out-evidence-and-explicit-steward-review'
    }
  });
  const payload = await requestJson({
    port: WORKSHOP_PORT,
    route: '/api/body-pulse/request',
    method: 'POST',
    headers: { 'x-axm-body-pulse': 'bounded-pulse-request' },
    body: { moduleId: 'mirror-learning-forge', leaseMs: REQUEST_TIMEOUT_MS + 5000 }
  });
  if (!payload.decision || !payload.decision.granted) throw new Error('Body Pulse held automatic learning: ' + (payload.decision && payload.decision.reason || 'unknown reason'));
  return payload.decision.lease;
}

async function completePulse(lease, outcome, summary) {
  if (!lease) return;
  await requestJson({
    port: WORKSHOP_PORT,
    route: '/api/body-pulse/complete',
    method: 'POST',
    headers: { 'x-axm-body-pulse': 'bounded-pulse-complete' },
    body: { leaseId: lease.leaseId, outcome, summary, effect: 'mirror-forge-candidate-or-grade-state-only' }
  });
}

async function main() {
  const options = args(process.argv.slice(2));
  const inputPath = path.resolve(options.input);
  const inputStat = fs.statSync(inputPath);
  if (!inputStat.isFile() || inputStat.size > MAX_INPUT_BYTES) throw new Error('input must be a JSON file no larger than 512 KiB');
  const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  if (token.length < 32) throw new Error('Forge token is missing; start the Forge first');
  acquireLock();
  let lease = null;
  try {
    if (options.mode === 'automatic') lease = await requestPulse();
    const response = await requestJson({
      port: FORGE_PORT,
      route: options.route,
      method: 'POST',
      headers: Object.assign({ authorization: 'Bearer ' + token, 'x-axm-learning-mode': options.mode }, lease ? { 'x-axm-body-pulse-lease': lease.leaseId } : {}),
      body: payload
    });
    await completePulse(lease, 'COMPLETED', 'One bounded Mirror learning request completed.');
    if (options.output) fs.writeFileSync(path.resolve(options.output), JSON.stringify(response, null, 2) + '\n', 'utf8');
    const result = response.result || response;
    console.log(JSON.stringify({ ok: true, route: options.route, mode: options.mode, leaseId: lease && lease.leaseId || null, resultId: result.grade_id || result.model_id || result.episode_id || result.candidate_id || result.session_id || null }, null, 2));
  } catch (error) {
    try { await completePulse(lease, 'FAILED', String(error.message || error).slice(0, 500)); } catch (_completionError) {}
    throw error;
  } finally { releaseLock(); }
}

main().catch(error => { console.error('SAFE LEARNING HELD\n' + String(error.message || error)); process.exitCode = 1; });
