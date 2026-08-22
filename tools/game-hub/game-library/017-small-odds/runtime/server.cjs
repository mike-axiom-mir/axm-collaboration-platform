'use strict'; // CommonJS boundary beside the browser's ES-module runtime.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RUNTIME_DIR = __dirname;
const DEFAULT_PORT = 8817;
const HOST = '127.0.0.1';
const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml', '.webp':'image/webp'
};

function safeRuntimePath(urlPath) {
  const relative = urlPath.replace(/^\/games\/017\/?/, '').replace(/^\/+/, '') || 'index.html';
  const candidate = path.resolve(RUNTIME_DIR, relative);
  if (candidate !== RUNTIME_DIR && !candidate.startsWith(RUNTIME_DIR + path.sep)) return null;
  return candidate;
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length':Buffer.byteLength(body),
    'Cache-Control':'no-store'
  });
  response.end(body);
}

function createRequestHandler(session = {}) {
  const launchState = {
    schema:'small-odds.launch-session/v1',
    authority:'local-node-server',
    startedAt:session.startedAt || new Date().toISOString(),
    nonce:session.nonce || crypto.randomBytes(16).toString('hex'),
    gameId:'017-small-odds',
    playerSlots:1
  };
  return function requestHandler(request, response) {
    let url;
    try { url = new URL(request.url, `http://${request.headers.host || HOST}`); }
    catch { return sendJson(response, 400, { ok:false, error:'invalid-url' }); }
    if (request.method !== 'GET' && request.method !== 'HEAD') return sendJson(response, 405, { ok:false, error:'method-not-allowed' });
    if (url.pathname === '/health' || url.pathname === '/api/health') return sendJson(response, 200, { ok:true, gameId:'017-small-odds', localOnly:true });
    if (url.pathname === '/api/session') return sendJson(response, 200, launchState);
    if (!url.pathname.startsWith('/games/017')) return sendJson(response, 404, { ok:false, error:'not-found' });
    const filePath = safeRuntimePath(url.pathname);
    if (!filePath) return sendJson(response, 403, { ok:false, error:'path-refused' });
    fs.stat(filePath, (statError, stat) => {
      if (statError || !stat.isFile()) return sendJson(response, 404, { ok:false, error:'asset-not-found' });
      const headers = {
        'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Content-Length':stat.size,
        'Cache-Control': path.extname(filePath).toLowerCase() === '.png' ? 'public, max-age=3600' : 'no-store',
        'X-Content-Type-Options':'nosniff',
        'Referrer-Policy':'no-referrer',
        'Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; media-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"
      };
      response.writeHead(200, headers);
      if (request.method === 'HEAD') return response.end();
      fs.createReadStream(filePath).pipe(response);
    });
  };
}

function createServer(session) {
  return http.createServer(createRequestHandler(session));
}

function startServer(options = {}) {
  const port = Number(options.port ?? process.env.AXM_GAME_PORT ?? process.env.PORT ?? DEFAULT_PORT);
  const host = options.host || HOST;
  const server = createServer(options.session);
  server.listen(port, host, () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    console.log(`SMALL ODDS is awake at http://${host}:${actualPort}/games/017/`);
    console.log('Local-only runtime · Ctrl+C to stop');
  });
  return server;
}

if (require.main === module) {
  const server = startServer();
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

module.exports = { HOST, DEFAULT_PORT, safeRuntimePath, createRequestHandler, createServer, startServer };
