'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { reason, rootHash } = require('../kernel/principle-cell');
const { createTraceStore } = require('./trace-store');
const { startWorkshopHeartbeat } = require('../adapters/workshop/workshop-heartbeat');

const ROOT = path.resolve(__dirname, '..');

function readConfig() {
  const defaults = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'mirror.config.example.json'), 'utf8'));
  const local = path.join(ROOT, 'config', 'mirror.config.local.json');
  let override = {};
  try { override = JSON.parse(fs.readFileSync(local, 'utf8')); } catch (_) {}
  return Object.assign({}, defaults, override, {
    host: process.env.AXM_MIRROR_HOST || override.host || defaults.host,
    port: Number(process.env.AXM_MIRROR_PORT || override.port || defaults.port),
    workshopUrl: process.env.AXM_WORKSHOP_URL || override.workshopUrl || defaults.workshopUrl
  });
}

function ensureToken(file, supplied) {
  if (supplied) return String(supplied);
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch (_) {}
  const token = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, token + '\n', { encoding: 'utf8', mode: 0o600 });
  return token;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createMirrorRuntime(options = {}) {
  const config = Object.assign(readConfig(), options.config || {});
  if (!['127.0.0.1', 'localhost', '::1'].includes(config.host)) throw new Error('Mirror Seed-0 refuses a non-loopback bind');
  if (!Number.isInteger(Number(config.port)) || Number(config.port) < 0 || Number(config.port) > 65535) throw new Error('AXM_MIRROR_PORT must be an integer from 0 through 65535');
  const tokenFile = options.tokenFile || path.join(ROOT, 'state', 'runtime-token.txt');
  const token = ensureToken(tokenFile, options.token);
  const traceStore = createTraceStore({ file: options.persist === false ? null : path.join(ROOT, 'state', 'traces.jsonl') });
  const sessions = new Map();
  const rate = new Map();
  let heartbeat = null;
  let server = null;
  let actualPort = Number(config.port);
  const startedAt = new Date().toISOString();
  const allowedOrigins = new Set(Array.isArray(config.allowedOrigins) ? config.allowedOrigins : []);

  function corsHeaders(req) {
    const origin = String(req.headers.origin || '');
    return origin && allowedOrigins.has(origin) ? {
      'access-control-allow-origin': origin,
      'vary': 'Origin',
      'access-control-allow-headers': 'authorization, content-type, x-axm-mirror-action',
      'access-control-allow-methods': 'GET, POST, OPTIONS'
    } : {};
  }

  function send(req, res, status, body) {
    res.writeHead(status, Object.assign({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY'
    }, corsHeaders(req)));
    res.end(body == null ? '' : JSON.stringify(body));
  }

  function limited(req) {
    const key = req.socket.remoteAddress || 'local';
    const minute = Math.floor(Date.now() / 60000);
    const entry = rate.get(key);
    const next = !entry || entry.minute !== minute ? { minute, count: 1 } : { minute, count: entry.count + 1 };
    rate.set(key, next);
    return next.count > Math.max(10, Number(config.requestsPerMinute) || 120);
  }

  function authorized(req) {
    const header = String(req.headers.authorization || '');
    return header.startsWith('Bearer ') && safeEqual(header.slice(7), token);
  }

  function readJson(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      let ended = false;
      req.setEncoding('utf8');
      req.on('data', chunk => {
        if (ended) return;
        body += chunk;
        if (Buffer.byteLength(body) > (Number(config.requestBodyLimitBytes) || 262144)) {
          ended = true;
          reject(Object.assign(new Error('request body too large'), { status: 413 }));
          req.destroy();
        }
      });
      req.on('end', () => {
        if (ended) return;
        try { resolve(JSON.parse(body || '{}')); }
        catch (_) { reject(Object.assign(new Error('invalid JSON body'), { status: 400 })); }
      });
      req.on('error', error => { if (!ended) reject(error); });
    });
  }

  function publicHealth() {
    return {
      ok: true,
      schema: 'axm.mirror.health/v1',
      identity: 'axm.machine.mirror/seed-0',
      displayName: 'Mirror',
      providerId: 'mirror-kernel',
      version: '0.0.0-seed',
      body: 'DETERMINISTIC_KERNEL',
      learnedWeights: false,
      languageOrgan: false,
      rootHash,
      host: config.host,
      port: actualPort,
      offlineCapable: true,
      outsideNetworkCalls: false,
      writePermissions: [],
      toolPermissions: [],
      startedAt,
      sessions: sessions.size,
      inMemoryTraces: traceStore.count(),
      workshopPresence: heartbeat ? heartbeat.status() : { state: 'disabled', ok: false }
    };
  }

  async function handle(req, res) {
    if (limited(req)) return send(req, res, 429, { ok: false, error: 'local rate limit exceeded' });
    const parsed = new URL(req.url, 'http://mirror.local');
    const route = parsed.pathname;
    if (req.method === 'OPTIONS') {
      if (req.headers.origin && !allowedOrigins.has(String(req.headers.origin))) return send(req, res, 403, { ok: false, error: 'origin not allowed' });
      return send(req, res, 204, null);
    }
    if (route === '/health' && req.method === 'GET') return send(req, res, 200, publicHealth());
    if (route === '/capabilities' && req.method === 'GET') return send(req, res, 200, {
      ok: true,
      schema: 'axm.mirror.capabilities/v1',
      supported: ['explicit-sessions', 'typed-evidence', 'unknown-preservation', 'contradiction-preservation', 'supplied-candidate-evaluation', 'permission-holds', 'ternary-decisions', 'machine-trace', 'human-trace-rendering'],
      unsupported: ['candidate-generation', 'learned-reasoning', 'open-ended-language', 'vision', 'tool-use', 'memory-learning', 'training', 'external-network'],
      authority: { files: false, tools: false, network: false, canon: false }
    });
    if (route === '/v1/models' && req.method === 'GET') return send(req, res, 200, {
      object: 'list', data: [{ id: 'mirror-kernel', object: 'model', owned_by: 'axm-local', status: 'deterministic-seed-no-weights' }]
    });
    if (!authorized(req)) return send(req, res, 401, { ok: false, error: 'local bearer token required' });

    if (route === '/axm/v1/session/open' && req.method === 'POST') {
      const body = await readJson(req);
      const sessionId = `session-${crypto.randomBytes(12).toString('hex')}`;
      const session = {
        id: sessionId,
        actor: body.actor && typeof body.actor === 'object' ? body.actor : { id: 'anonymous', kind: 'unknown' },
        purpose: String(body.purpose || 'bounded reasoning session').slice(0, 500),
        openedAt: new Date().toISOString(),
        traceIds: []
      };
      sessions.set(sessionId, session);
      if (heartbeat) heartbeat.beat('active');
      return send(req, res, 201, { ok: true, schema: 'axm.mirror.session/v1', session });
    }

    if (route === '/axm/v1/reason' && req.method === 'POST') {
      const body = await readJson(req);
      if (!body.sessionId || !sessions.has(String(body.sessionId))) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      if (heartbeat) heartbeat.beat('thinking');
      const trace = reason(body, { onTrace: item => traceStore.save(item) });
      sessions.get(String(body.sessionId)).traceIds.push(trace.traceId);
      if (heartbeat) heartbeat.beat('idle');
      return send(req, res, 200, { ok: true, trace });
    }

    if (route.startsWith('/axm/v1/trace/') && req.method === 'GET') {
      const traceId = decodeURIComponent(route.slice('/axm/v1/trace/'.length));
      const trace = traceStore.get(traceId);
      return trace ? send(req, res, 200, { ok: true, trace }) : send(req, res, 404, { ok: false, error: 'trace not found in this runtime window' });
    }

    if (route === '/axm/v1/session/close' && req.method === 'POST') {
      const body = await readJson(req);
      const session = sessions.get(String(body.sessionId || ''));
      if (!session) return send(req, res, 404, { ok: false, error: 'open session not found' });
      sessions.delete(session.id);
      session.closedAt = new Date().toISOString();
      session.memoryWrites = [];
      session.truth = 'Closing Seed-0 proposes no implicit memory writes.';
      return send(req, res, 200, { ok: true, session });
    }

    if (route === '/v1/responses' && req.method === 'POST') {
      const body = await readJson(req);
      const sessionId = String(body.sessionId || '');
      if (!sessions.has(sessionId)) return send(req, res, 409, { ok: false, error: 'an open explicit sessionId is required' });
      const raw = typeof body.input === 'string' ? body.input : JSON.stringify(body.input || '');
      const trace = reason({
        schema: 'axm.mirror.reason/v1',
        sessionId,
        actor: body.actor || { id: 'compatibility-client', kind: 'unknown' },
        goal: 'Interpret the supplied message without inventing an answer or promoting unsupported claims.',
        evidence: [{ id: 'input-message', kind: 'human-assertion', status: 'asserted', statement: raw.slice(0, 4000), source: { kind: 'compatibility-input', id: 'v1-responses' } }],
        unknowns: [{ id: 'language-organ', question: 'A native learned language organ has not been trained.', blocking: true }],
        constraints: [], permissions: [],
        actions: [{ id: 'hold-language', kind: 'hold', label: 'Preserve the message and hold for a capable collaborator', supportingEvidence: ['input-message'], risk: 'low', reversible: true, recovery: 'No world mutation occurred.' }]
      }, { onTrace: item => traceStore.save(item) });
      sessions.get(sessionId).traceIds.push(trace.traceId);
      return send(req, res, 200, {
        id: `response-${trace.traceId}`,
        object: 'response',
        model: 'mirror-kernel',
        output_text: trace.human.summary + ' ' + trace.human.boundary,
        trace
      });
    }

    if (route === '/axm/v1/runtime/stop' && req.method === 'POST') {
      if (String(req.headers['x-axm-mirror-action'] || '') !== 'explicit-stop') return send(req, res, 403, { ok: false, error: 'explicit stop header required' });
      send(req, res, 200, { ok: true, stopping: true, sessionsClosed: sessions.size });
      setTimeout(() => runtime.stop().then(() => process.exit(0)), 50);
      return;
    }
    return send(req, res, 404, { ok: false, error: 'route not found' });
  }

  const runtime = {
    config,
    tokenFile,
    token,
    get server() { return server; },
    get port() { return actualPort; },
    start() {
      if (server) return Promise.resolve(runtime);
      server = http.createServer((req, res) => handle(req, res).catch(error => {
        if (!res.headersSent) send(req, res, Number(error.status) || 400, { ok: false, error: String(error.message || error).slice(0, 500) });
        else res.end();
      }));
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(Number(config.port), config.host, () => {
          actualPort = server.address().port;
          if (options.presence !== false && config.presenceEnabled !== false) heartbeat = startWorkshopHeartbeat({ workshopUrl: config.workshopUrl, intervalMs: config.presenceIntervalMs });
          if (options.persist !== false) {
            fs.mkdirSync(path.join(ROOT, 'state'), { recursive: true });
            fs.writeFileSync(path.join(ROOT, 'state', 'runtime.pid'), String(process.pid) + '\n', 'utf8');
            fs.appendFileSync(path.join(ROOT, 'logs', 'mirror-events.jsonl'), JSON.stringify({ at: new Date().toISOString(), event: 'runtime-start', identity: 'axm.machine.mirror/seed-0', port: actualPort }) + '\n');
          }
          resolve(runtime);
        });
      });
    },
    stop() {
      if (heartbeat) heartbeat.stop();
      heartbeat = null;
      sessions.clear();
      if (!server) return Promise.resolve();
      const closing = server;
      server = null;
      return new Promise(resolve => closing.close(() => {
        if (options.persist !== false) {
          try { fs.unlinkSync(path.join(ROOT, 'state', 'runtime.pid')); } catch (_) {}
          fs.appendFileSync(path.join(ROOT, 'logs', 'mirror-events.jsonl'), JSON.stringify({ at: new Date().toISOString(), event: 'runtime-stop', identity: 'axm.machine.mirror/seed-0' }) + '\n');
        }
        resolve();
      }));
    },
    health: publicHealth
  };
  return runtime;
}

if (require.main === module) {
  let runtime;
  try { runtime = createMirrorRuntime(); }
  catch (error) { console.error(`Mirror refused to start: ${error.message}`); process.exit(1); }
  runtime.start().then(() => {
    console.log('AXM Mirror Seed-0');
    console.log(`Identity: axm.machine.mirror/seed-0`);
    console.log(`Runtime:  http://127.0.0.1:${runtime.port}`);
    console.log('Truth: deterministic kernel · no learned weights · no tool authority');
  }).catch(error => { console.error(`Mirror could not start: ${error.message}`); process.exit(1); });
  const stop = () => runtime.stop().then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

module.exports = { createMirrorRuntime };
