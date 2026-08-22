#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_PORT = 8790;
const DEFAULT_GAME_HUB_PORT = 8789;
const ALLOWED_STATIC_EXTENSIONS = new Set([
  '.css', '.gif', '.html', '.ico', '.jpeg', '.jpg', '.js', '.json',
  '.map', '.png', '.svg', '.ttf', '.webp', '.woff', '.woff2'
]);
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function sendJson(res, statusCode, body) {
  const encoded = Buffer.from(JSON.stringify(body, null, 2) + '\n');
  res.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-length': encoded.length,
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff'
  });
  res.end(encoded);
}

function safeInside(base, relative) {
  const target = path.resolve(base, relative);
  const prefix = base.endsWith(path.sep) ? base : base + path.sep;
  return target === base || target.startsWith(prefix) ? target : null;
}

function resolvePublicFile(root, rawPathname) {
  let pathname;
  try { pathname = decodeURIComponent(rawPathname); }
  catch (error) { return null; }
  if (pathname === '/') pathname = '/tools/game-hub/index.html';
  if (pathname === '/tools/game-hub' || pathname === '/tools/game-hub/') pathname = '/tools/game-hub/index.html';
  if (pathname.startsWith('/tools/game-hub/asset-inbox/')) return null;

  const mounts = [
    { prefix: '/tools/game-hub/', base: path.join(root, 'tools', 'game-hub') },
    { prefix: '/shared/presentation-spine/', base: path.join(root, 'shared', 'presentation-spine') },
    { prefix: '/shared/profile/', base: path.join(root, 'shared', 'profile'), exact: 'axm-profile-client.js' }
  ];
  for (const mount of mounts) {
    if (!pathname.startsWith(mount.prefix)) continue;
    const relative = pathname.slice(mount.prefix.length).replace(/^[/\\]+/, '');
    if (mount.exact && relative !== mount.exact) return null;
    let target = safeInside(mount.base, relative);
    if (!target) return null;
    try { if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html'); }
    catch (error) { return null; }
    if (!ALLOWED_STATIC_EXTENSIONS.has(path.extname(target).toLowerCase())) return null;
    try { return fs.statSync(target).isFile() ? target : null; }
    catch (error) { return null; }
  }
  return null;
}

function serveFile(req, res, file) {
  const extension = path.extname(file).toLowerCase();
  const stat = fs.statSync(file);
  res.writeHead(200, {
    'cache-control': 'no-store',
    'content-length': stat.size,
    'content-security-policy': "default-src 'self' data: blob:; connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'",
    'content-type': MIME[extension] || 'application/octet-stream',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN'
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

function proxyGameApi(req, res, gameHubPort) {
  const raw = String(req.url || '/');
  let target = raw.slice('/game-api'.length) || '/';
  if (target.charAt(0) !== '/') target = '/' + target;
  const headers = Object.assign({}, req.headers, { host: `127.0.0.1:${gameHubPort}` });
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: gameHubPort,
    path: target,
    method: req.method,
    headers
  }, upstreamResponse => {
    res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(res);
  });
  upstream.on('error', error => {
    if (!res.headersSent) return sendJson(res, 502, { ok: false, error: 'local GameHub unavailable', detail: error.message });
    res.end();
  });
  req.pipe(upstream);
}

function createRequestHandler(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const gameHubPort = Number(options.gameHubPort || DEFAULT_GAME_HUB_PORT);
  return function steamShellRequest(req, res) {
    const requestUrl = new URL(String(req.url || '/'), 'http://127.0.0.1');
    const pathname = requestUrl.pathname;
    if (req.method === 'GET' && pathname === '/health') {
      return sendJson(res, 200, { ok: true, name: 'AXM Steam GameHub Shell', distribution: 'steam', product: 'AXM Local GameHub' });
    }
    if (req.method === 'GET' && pathname === '/worlds/world-registry.json') {
      return sendJson(res, 200, { schema: 'axm.world-registry/v1', worlds: [] });
    }
    if (pathname === '/game-api/assets/inbox' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, handoffs: [], distribution: 'steam' });
    }
    if (pathname === '/game-api/assets/accept' || pathname === '/game-api/assets/handoff') {
      return sendJson(res, 403, { ok: false, error: 'asset authoring is unavailable in the Steam distribution' });
    }
    if (pathname === '/game-api' || pathname.startsWith('/game-api/')) return proxyGameApi(req, res, gameHubPort);
    if (pathname === '/api/profile' || pathname.startsWith('/api/profile/')) {
      return sendJson(res, 404, { ok: false, error: 'Workshop profile services are not part of the Steam distribution' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { ok: false, error: 'method not allowed' });
    const file = resolvePublicFile(root, pathname);
    if (!file) return sendJson(res, 404, { ok: false, error: 'not part of the AXM Local GameHub Steam surface' });
    return serveFile(req, res, file);
  };
}

function createSteamShellServer(options = {}) {
  return http.createServer(createRequestHandler(options));
}

function main() {
  const host = '127.0.0.1';
  const port = Number(process.env.AXM_STEAM_SHELL_PORT || process.env.AXM_WORKSHOP_PORT || DEFAULT_PORT);
  const gameHubPort = Number(process.env.AXM_GAME_HUB_PORT || DEFAULT_GAME_HUB_PORT);
  const server = createSteamShellServer({ gameHubPort });
  server.listen(port, host, () => console.log(`AXM Steam GameHub Shell TEST listening on http://${host}:${port}`));
  server.on('error', error => {
    console.error('AXM Steam GameHub Shell failed: ' + error.message);
    process.exitCode = 1;
  });
}

if (require.main === module) main();
module.exports = { DEFAULT_GAME_HUB_PORT, DEFAULT_PORT, ROOT, createRequestHandler, createSteamShellServer, resolvePublicFile, safeInside };
