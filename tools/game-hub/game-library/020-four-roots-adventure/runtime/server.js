#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const Engine = require('./game-engine');

const GAME_ID = '020-four-roots-adventure';
const GAME_PREFIX = '/games/020/';
const PORT = Number(process.env.PORT || 8820);
const HOST = process.env.HOST || '127.0.0.1';
const RUNTIME_DIR = __dirname;
const MEDIA_DIR = path.resolve(__dirname, '..', 'media');
const MEDIA_PREFIX = '/games/020/trailer/';
const CONTENT_FILE = path.resolve(__dirname, '..', 'content', 'adventure-content.v0.2.json');
const MAX_BODY_BYTES = 8192;
const MIME = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.vtt': 'text/vtt; charset=utf-8',
  '.webm': 'video/webm'
});
const MEDIA_ALLOWLIST = new Set([
  'index.html', 'trailer.css', 'trailer-player.js',
  'rendered/four-roots-adventure-trailer.mp4',
  'rendered/four-roots-adventure-trailer.webm',
  'rendered/four-roots-adventure-trailer.vtt',
  'rendered/trailer-plan.json',
  'rendered/gameplay-replay.json',
  'rendered/sparse-sequence.json',
  'rendered/verification-receipt.json',
  'rendered/proof-first.png',
  'rendered/proof-middle.png',
  'rendered/proof-last.png'
]);

function digestBytes(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }
function resolveDataRoot(source) {
  const environment = source || process.env;
  const configured = environment.AXM_GAME_DATA_ROOT || environment.AXM_FOUR_ROOTS_DATA_ROOT;
  return path.resolve(configured || path.join(os.tmpdir(), 'axm-four-roots-adventure-test-state'));
}
function safeStaticFile(urlPath) {
  let relative;
  try { relative = decodeURIComponent(String(urlPath || '/').split('?')[0]); }
  catch (_) { return null; }
  if (/^[\\/]{2}/.test(relative)) return null;
  if (relative === '/games/020/trailer') relative = MEDIA_PREFIX;
  if (relative.startsWith(MEDIA_PREFIX)) {
    const mediaRelative = relative.slice(MEDIA_PREFIX.length) || 'index.html';
    if (!MEDIA_ALLOWLIST.has(mediaRelative)) return null;
    const mediaCandidate = path.resolve(MEDIA_DIR, mediaRelative);
    const mediaPrefix = MEDIA_DIR.endsWith(path.sep) ? MEDIA_DIR : MEDIA_DIR + path.sep;
    if (!mediaCandidate.startsWith(mediaPrefix) || !Object.prototype.hasOwnProperty.call(MIME, path.extname(mediaCandidate).toLowerCase())) return null;
    return mediaCandidate;
  }
  if (relative === '/' || relative === '/games/020' || relative === GAME_PREFIX) relative = 'index.html';
  else if (relative.startsWith(GAME_PREFIX)) relative = relative.slice(GAME_PREFIX.length);
  else relative = relative.replace(/^\/+/, '');
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  if (!/^[A-Za-z0-9._/-]+$/.test(relative) || relative.includes('..') || relative.includes(':') || relative.includes('\\')) return null;
  const candidate = path.resolve(RUNTIME_DIR, relative);
  const prefix = RUNTIME_DIR.endsWith(path.sep) ? RUNTIME_DIR : RUNTIME_DIR + path.sep;
  if (!candidate.startsWith(prefix) || !Object.prototype.hasOwnProperty.call(MIME, path.extname(candidate).toLowerCase())) return null;
  return candidate;
}

function responseHeaders(contentType) {
  return {
    'content-type': contentType,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"
  };
}
function sendJson(response, status, value) {
  response.writeHead(status, responseHeaders('application/json; charset=utf-8'));
  response.end(JSON.stringify(value));
}
function readJson(request) {
  return new Promise((resolve, reject) => {
    if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
      const error = new Error('content-type must be application/json'); error.statusCode = 415; reject(error); return;
    }
    const chunks = [];
    let total = 0;
    request.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        const error = new Error('request body too large'); error.statusCode = 413; request.destroy(error); return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try { resolve(total ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch (_) { const error = new Error('invalid JSON'); error.statusCode = 400; reject(error); }
    });
    request.on('error', reject);
  });
}
function exactInput(value, allowed, required) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('request body must be an object');
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed.includes(key)) || required.some((key) => !keys.includes(key))) throw new Error('request body fields are invalid');
}

function loadContent(contentFile) {
  const raw = fs.readFileSync(contentFile);
  if (raw.length > 262144) throw new Error('content file exceeds byte ceiling');
  const content = JSON.parse(raw.toString('utf8'));
  Engine.validateRuntimeContent(content);
  const normalizedRaw = Buffer.from(raw.toString('utf8').replace(/\r\n?/g, '\n'), 'utf8');
  return { content, contentDigest: digestBytes(normalizedRaw) };
}

function createRuntime(options) {
  const settings = options || {};
  const contentFile = path.resolve(settings.contentFile || CONTENT_FILE);
  const dataRoot = path.resolve(settings.dataRoot || resolveDataRoot(settings.environment));
  const stateDir = path.resolve(dataRoot, 'four-roots-adventure');
  const stateFile = path.resolve(stateDir, 'state.v0.2.json');
  if (!stateFile.startsWith(stateDir + path.sep)) throw new Error('state path escaped its data root');
  const { content, contentDigest } = loadContent(contentFile);
  const persistence = { mode: 'SERVER_FILE', contentBound: true, reload: 'RESUME', restart: 'RESUME', resetAvailable: true };

  function loadState() {
    try {
      if (!fs.existsSync(stateFile)) return Engine.createInitialState(content, contentDigest);
      const value = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      return Engine.normalizeSavedState(content, contentDigest, value);
    } catch (error) {
      const fresh = Engine.createInitialState(content, contentDigest);
      fresh.message = 'Saved progress was unreadable or belonged to different content. A fresh recoverable state was opened; the invalid bytes were not executed.';
      return fresh;
    }
  }

  let state = loadState();
  function saveState(next) {
    fs.mkdirSync(stateDir, { recursive: true });
    const tempFile = path.join(stateDir, 'state.v0.2.' + process.pid + '.tmp');
    fs.writeFileSync(tempFile, JSON.stringify(next, null, 2) + '\n', { encoding: 'utf8', flag: 'w' });
    fs.renameSync(tempFile, stateFile);
  }
  function view() { return Engine.publicSnapshot(content, state, persistence); }
  function apply(input) {
    exactInput(input, ['action', 'direction', 'expectedRevision'], ['action', 'expectedRevision']);
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision !== state.revision) {
      const error = new Error('stale revision'); error.statusCode = 409; error.view = view(); throw error;
    }
    if (input.action === 'move') {
      if (typeof input.direction !== 'string') throw new Error('move direction is required');
    } else if (input.direction !== undefined) throw new Error('direction is allowed only for move');
    const next = Engine.applyAction(content, state, input);
    saveState(next);
    state = next;
    return view();
  }
  function reset(input) {
    exactInput(input, ['confirm', 'expectedRevision'], ['confirm', 'expectedRevision']);
    if (input.confirm !== true) throw new Error('reset requires confirm=true');
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision !== state.revision) {
      const error = new Error('stale revision'); error.statusCode = 409; error.view = view(); throw error;
    }
    const next = Engine.createInitialState(content, contentDigest);
    next.revision = state.revision + 1;
    next.message = 'A new journey began. The prior installed release and its rollback ancestor remain unchanged.';
    saveState(next);
    state = next;
    return view();
  }
  return { content, contentDigest, dataRoot, stateFile, persistence, view, apply, reset };
}

function createServer(options) {
  const runtime = createRuntime(options);
  const server = http.createServer(async (request, response) => {
    const pathname = String(request.url || '/').split('?')[0];
    if (pathname === '/health' && request.method === 'GET') {
      sendJson(response, 200, { ok: true, status: 'ok', gameId: GAME_ID, releaseId: runtime.content.id, contentDigest: runtime.contentDigest, stateAuthority: 'server', persistence: 'server-file', outboundNetwork: false });
      return;
    }
    if ((pathname === '/api/bootstrap' || pathname === '/api/session') && request.method === 'GET') {
      sendJson(response, 200, runtime.view());
      return;
    }
    if (pathname === '/api/action' && request.method === 'POST') {
      try { sendJson(response, 200, runtime.apply(await readJson(request))); }
      catch (error) { sendJson(response, error.statusCode || 400, { error: error.message, view: error.view || null }); }
      return;
    }
    if (pathname === '/api/reset' && request.method === 'POST') {
      try { sendJson(response, 200, runtime.reset(await readJson(request))); }
      catch (error) { sendJson(response, error.statusCode || 400, { error: error.message, view: error.view || null }); }
      return;
    }
    if (pathname.startsWith('/api/')) {
      sendJson(response, 404, { error: 'unknown endpoint' });
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: 'method not allowed' });
      return;
    }
    const filePath = safeStaticFile(request.url);
    if (!filePath) {
      sendJson(response, 404, { error: 'not found' });
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) { sendJson(response, 404, { error: 'not found' }); return; }
      response.writeHead(200, { ...responseHeaders(MIME[path.extname(filePath).toLowerCase()]), 'content-length': data.length });
      response.end(request.method === 'HEAD' ? undefined : data);
    });
  });
  server.runtime = runtime;
  return server;
}

if (require.main === module) {
  createServer().listen(PORT, HOST, () => {
    console.log('Four Roots Adventure listening on http://' + HOST + ':' + PORT + GAME_PREFIX);
  });
}

module.exports = { GAME_ID, GAME_PREFIX, MEDIA_PREFIX, PORT, HOST, CONTENT_FILE, MAX_BODY_BYTES, digestBytes, resolveDataRoot, safeStaticFile, loadContent, createRuntime, createServer };
