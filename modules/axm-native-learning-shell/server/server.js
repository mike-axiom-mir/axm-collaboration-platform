'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const Shell = require('../core/learning-shell');
const IdentityBundle = require('../core/identity-bundle');

const MODULE_ROOT = path.resolve(__dirname, '..');
const MIRROR_ROOT = path.resolve(MODULE_ROOT, '..', '..');
const UI_ROOT = path.join(MODULE_ROOT, 'ui');
const HOST = process.env.AXM_LEARNING_SHELL_HOST || '127.0.0.1';
const PORT = Number(process.env.AXM_LEARNING_SHELL_PORT || 8802);
const TOKEN_FILE = path.join(MIRROR_ROOT, 'state', 'native-learning-shell', 'session-token.txt');
const ALLOWED_ORIGINS = new Set(['http://127.0.0.1:8788', 'http://localhost:8788', `http://${HOST}:${PORT}`]);

function token() {
  try { const current = fs.readFileSync(TOKEN_FILE, 'utf8').trim(); if (current.length >= 32) return current; } catch (_) {}
  const value = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, value + '\n', { encoding: 'utf8', mode: 0o600 });
  return value;
}

const SESSION_TOKEN = token();

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function authorized(req) {
  const header = String(req.headers.authorization || '');
  return header.startsWith('Bearer ') && safeEqual(header.slice(7), SESSION_TOKEN);
}

function cors(req) {
  const origin = String(req.headers.origin || '');
  return origin && ALLOWED_ORIGINS.has(origin) ? {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'vary': 'Origin'
  } : {};
}

function json(req, res, status, value) {
  res.writeHead(status, Object.assign({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'no-referrer'
  }, cors(req)));
  res.end(JSON.stringify(value));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { raw += chunk; if (raw.length > 262144) req.destroy(new Error('request body too large')); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (_) { reject(new Error('invalid JSON body')); } });
    req.on('error', reject);
  });
}

function serve(req, res, file, contentType, injectToken) {
  if (!fs.existsSync(file)) return json(req, res, 404, { ok: false, error: 'asset not found' });
  let bytes = fs.readFileSync(file);
  if (injectToken) {
    const html = bytes.toString('utf8').replace('</head>', `<meta name="axm-learning-shell-token" content="${SESSION_TOKEN}">\n</head>`);
    bytes = Buffer.from(html, 'utf8');
  }
  res.writeHead(200, {
    'content-type': contentType,
    'content-length': bytes.length,
    'cache-control': injectToken ? 'no-store' : 'public, max-age=60',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self' http://127.0.0.1:8802 http://localhost:8802; img-src 'self' data:; frame-ancestors 'self' http://127.0.0.1:8788 http://localhost:8788"
  });
  res.end(bytes);
}

function routeParts(pathname) { return pathname.split('/').filter(Boolean).map(decodeURIComponent); }

function createServer(options = {}) {
  const host = options.host || HOST;
  const port = Number(options.port == null ? PORT : options.port);
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('AXM Native Learning Shell refuses a non-loopback bind');
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://learning-shell.local');
      if (req.method === 'OPTIONS') {
        if (req.headers.origin && !ALLOWED_ORIGINS.has(String(req.headers.origin))) return json(req, res, 403, { ok: false, error: 'origin not allowed' });
        res.writeHead(204, cors(req)); res.end(); return;
      }
      if (req.method === 'GET' && url.pathname === '/') return serve(req, res, path.join(UI_ROOT, 'index.html'), 'text/html; charset=utf-8', true);
      if (req.method === 'GET' && url.pathname === '/app.js') return serve(req, res, path.join(UI_ROOT, 'app.js'), 'application/javascript; charset=utf-8', false);
      if (req.method === 'GET' && url.pathname === '/styles.css') return serve(req, res, path.join(UI_ROOT, 'styles.css'), 'text/css; charset=utf-8', false);
      if (req.method === 'GET' && url.pathname === '/api/health') return json(req, res, 200, {
        ok: true,
        schema: 'axm.mirror.learning-shell-health/v1',
        name: 'AXM Native Learning Shell',
        status: 'TEST',
        host,
        port: server.address() && server.address().port || port,
        externalHermesRequired: false,
        identity: 'axm.machine.mirror/seed-0',
        stages: Shell.STAGES,
        authority: { tools: false, externalNetwork: false, runtimePromotion: false, canonPromotion: false }
      });
      if (url.pathname.startsWith('/api/') && !authorized(req)) return json(req, res, 401, { ok: false, error: 'local bearer token required' });
      if (req.method === 'GET' && url.pathname === '/api/catalog') return json(req, res, 200, { ok: true, lessons: Shell.catalog(), bundle: IdentityBundle.build() });
      if (req.method === 'GET' && url.pathname === '/api/sessions') return json(req, res, 200, { ok: true, sessions: Shell.listSessions() });
      if (req.method === 'POST' && url.pathname === '/api/sessions') return json(req, res, 201, { ok: true, session: Shell.createSession(await body(req)) });

      const parts = routeParts(url.pathname);
      if (parts[0] === 'api' && parts[1] === 'sessions' && parts[2]) {
        const sessionId = parts[2];
        if (req.method === 'GET' && parts.length === 3) return json(req, res, 200, { ok: true, session: Shell.readSession(sessionId) });
        if (req.method === 'GET' && parts[3] === 'artifact' && parts[4]) {
          const session = Shell.readSession(sessionId);
          const artifact = Shell.readArtifact(session, parts[4]);
          return artifact ? json(req, res, 200, { ok: true, artifact }) : json(req, res, 404, { ok: false, error: 'artifact not found' });
        }
        if (req.method === 'POST' && parts[3] === 'tune') return json(req, res, 200, { ok: true, session: Shell.tuneSession(sessionId, await body(req)) });
        if (req.method === 'POST' && parts[3] === 'step') return json(req, res, 200, { ok: true, session: Shell.runNext(sessionId, await body(req)) });
        if (req.method === 'POST' && parts[3] === 'run') return json(req, res, 200, { ok: true, session: Shell.runAll(sessionId, await body(req)) });
      }
      return json(req, res, 404, { ok: false, error: 'route not found' });
    } catch (error) {
      return json(req, res, 400, { ok: false, error: String(error.message || error).slice(0, 1000) });
    }
  });
  return server;
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log('AXM Native Learning Shell — TEST');
    console.log(`Listening: http://${HOST}:${PORT}`);
    console.log('External Hermes: not required');
    console.log('Authority: private challenger only; no runtime, canon, identity or tool promotion');
  });
}

module.exports = { createServer, TOKEN_FILE };
