'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const GAME_ID = '023-twin-sparks';
const HOST = '127.0.0.1';
const PORT = Number(process.env.AXM_TWIN_SPARKS_PORT || 8823);
const RUNTIME_ROOT = path.resolve(__dirname);
const CANDIDATE_ROOT = path.resolve(__dirname, '..', 'candidate');
const ROUTES = new Map([
  ['/', [RUNTIME_ROOT, 'host.html']], ['/games/023', [RUNTIME_ROOT, 'host.html']], ['/games/023/', [RUNTIME_ROOT, 'host.html']],
  ['/games/023/host.css', [RUNTIME_ROOT, 'host.css']],
  ['/games/023/candidate/', [CANDIDATE_ROOT, 'index.html']],
  ['/games/023/candidate/game.js', [CANDIDATE_ROOT, 'game.js']],
  ['/games/023/candidate/styles.css', [CANDIDATE_ROOT, 'styles.css']]
]);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";

function safeStaticFile(rawUrl) {
  let pathname;
  try { pathname = new URL(rawUrl, 'http://127.0.0.1').pathname; } catch { return null; }
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const route = ROUTES.get(decoded);
  if (!route) return null;
  const [root, relative] = route;
  const resolved = path.resolve(root, relative);
  if (path.dirname(resolved) !== root || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;
  return resolved;
}

function send(response, status, headers, body, headOnly) {
  response.writeHead(status, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  response.end(headOnly ? undefined : body);
}

function createServer() {
  return http.createServer((request, response) => {
    const headOnly = request.method === 'HEAD';
    if (request.method !== 'GET' && !headOnly) return send(response, 405, { Allow: 'GET, HEAD' }, 'Method not allowed', headOnly);
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (pathname === '/health') return send(response, 200, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({ ok: true, gameId: GAME_ID, status: 'TEST', installed: true, canon: false }), headOnly);
    const file = safeStaticFile(request.url);
    if (!file) return send(response, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found', headOnly);
    return send(response, 200, { 'Content-Type': MIME[path.extname(file)], 'Content-Security-Policy': CSP }, fs.readFileSync(file), headOnly);
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => process.stdout.write('Twin Sparks TEST on http://' + HOST + ':' + PORT + '/games/023/\n'));
}

module.exports = { GAME_ID, HOST, PORT, RUNTIME_ROOT, CANDIDATE_ROOT, ROUTES, CSP, safeStaticFile, createServer };
