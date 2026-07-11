/* ============================================================
   AXM WORKSHOP SERVER — server.js (v0.2b one-click start fix)
   ------------------------------------------------------------
   Local-only, zero-dependency Node server for the AXM Workshop.

   STARTING
     START_AXM.bat  -> opens the library
     START_HUB.bat  -> opens the Hub directly

   The browser is opened only AFTER the server is listening.
   If the preferred local port is busy, the server selects the
   next free local port and opens the correct address itself.
   ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const ROOT = __dirname;
const HOST = '127.0.0.1';
const DEFAULT_PORT = Number(process.env.AXM_PORT || 8788);
const MAX_PORT_TRIES = 20;
const VERSION = '0.2b-public-safe-experimental';
const BUILD = 'AXM_WORKSHOP_PUBLIC_SAFE_v0.2b';
let ACTIVE_PORT = DEFAULT_PORT;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',   '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.zip': 'application/zip'
};

const STATUSES = ['EXPERIMENTAL', 'TEST', 'WORKING', 'CANON', 'SHELL', 'BROKEN'];

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function safeName(name) {
  return String(name || '').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120) || 'unnamed.txt';
}

function scanTools() {
  const dir = path.join(ROOT, 'tools');
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    if (!e.isDirectory() || e.name.charAt(0) === '_') continue;
    const mPath = path.join(dir, e.name, 'manifest.json');
    let m = null;
    try { m = JSON.parse(fs.readFileSync(mPath, 'utf8')); }
    catch (err) {
      out.push({ folder: e.name, id: e.name, name: e.name,
                 status: 'BROKEN', error: 'manifest.json missing or invalid', entry: null });
      continue;
    }
    out.push({
      folder: e.name,
      id: m.id || e.name,
      name: m.name || e.name,
      version: m.version || 'v?',
      status: STATUSES.indexOf(m.status) >= 0 ? m.status : 'TEST',
      entry: m.entry || 'index.html',
      tags: Array.isArray(m.tags) ? m.tags : [],
      notes: m.notes || '',
      uses: Array.isArray(m.uses) ? m.uses : [],
      type: m.type || null,
      category: m.category || null,
      audience: m.audience || 'human',
      risk: m.risk || null,
      summary: m.summary || '',
      card: m.card && typeof m.card === 'object' ? m.card : null
    });
  }
  return out;
}

function slog(line) {
  const entry = new Date().toISOString() + '  ' + line + '\n';
  try { fs.mkdirSync(path.join(ROOT, 'logs'), { recursive: true }); } catch (e) {}
  try { fs.appendFileSync(path.join(ROOT, 'logs', 'workshop.log'), entry); } catch (e) {}
}

function requestPath(req) {
  let raw = String(req.url || '/').split('?')[0];
  try { raw = decodeURIComponent(raw); } catch (e) { return null; }
  return raw;
}

const server = http.createServer((req, res) => {
  const url = requestPath(req);
  if (url === null) return send(res, 400, { error: 'malformed URL refused' });
  if (url.includes('..') || url.includes('\0')) return send(res, 400, { error: 'path tricks refused' });

  if (url === '/api/health') {
    return send(res, 200, {
      ok: true,
      body: 'axm-workshop',
      version: VERSION,
      build: BUILD,
      host: HOST + ':' + ACTIVE_PORT,
      root: path.basename(ROOT)
    });
  }
  if (url === '/api/tools') {
    return send(res, 200, { tools: scanTools(), statuses: STATUSES });
  }
  if (url === '/api/export' && req.method === 'POST') {
    let buf = '';
    req.on('data', c => { buf += c; if (buf.length > 5e6) req.destroy(); });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(buf);
        const fn = safeName(parsed.filename);
        const target = path.join(ROOT, 'exports', fn);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, String(parsed.content));
        slog('export ' + fn + ' (' + String(parsed.content).length + ' bytes)');
        return send(res, 200, { ok: true, saved: 'exports/' + fn });
      } catch (e) { return send(res, 400, { error: 'bad export: ' + e.message }); }
    });
    return;
  }
  if (url === '/api/log' && req.method === 'POST') {
    let buf = '';
    req.on('data', c => { buf += c; if (buf.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try { slog('tool: ' + JSON.parse(buf).line); return send(res, 200, { ok: true }); }
      catch (e) { return send(res, 400, { error: 'bad log line' }); }
    });
    return;
  }

  let fp = url === '/' ? '/launcher/index.html' : url;
  if (url === '/hub' || url === '/hub/') fp = '/hub/index.html';

  const relative = fp.replace(/^[/\\]+/, '');
  let abs = path.resolve(ROOT, relative);
  const rootPrefix = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (abs !== ROOT && !abs.startsWith(rootPrefix)) return send(res, 400, { error: 'outside root' });

  try {
    if (fs.statSync(abs).isDirectory()) abs = path.join(abs, 'index.html');
  } catch (e) {}

  fs.readFile(abs, (err, data) => {
    if (err) {
      return send(res, 404,
        '<!doctype html><html><body style="background:#14171c;color:#dce2ea;font-family:sans-serif;padding:40px">' +
        '<h2>Not here: ' + fp.replace(/</g, '&lt;') + '</h2>' +
        '<p>The workshop looked inside its own folder and that file is not there.</p>' +
        '<a style="color:#38d6ec" href="/">back to the library</a></body></html>',
        'text/html; charset=utf-8');
    }
    send(res, 200, data, MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream');
  });
});

function openTarget() {
  const arg = process.argv.find(a => a.startsWith('--open='));
  const mode = arg ? arg.slice('--open='.length).toLowerCase() : String(process.env.AXM_OPEN || 'none').toLowerCase();
  if (mode === 'hub') return '/hub/index.html';
  if (mode === 'launcher' || mode === 'library' || mode === 'root') return '/';
  if (mode.startsWith('/')) return mode;
  return null;
}

function openBrowser(url) {
  if (process.env.AXM_NO_BROWSER === '1') return;
  try {
    let child;
    if (process.platform === 'win32') {
      child = childProcess.exec('start "" "' + url + '"', {
        windowsHide: true
      });
    } else if (process.platform === 'darwin') {
      child = childProcess.spawn('open', [url], { detached: true, stdio: 'ignore' });
    } else {
      child = childProcess.spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
    }
    child.unref();
  } catch (e) {
    console.error('  Browser could not be opened automatically. Open this address: ' + url);
  }
}

function listenOn(port, attemptsLeft) {
  const onError = (err) => {
    server.removeListener('listening', onListening);
    if (err && err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      console.log('  Local port ' + port + ' is busy; trying ' + (port + 1) + ' instead.');
      setTimeout(() => listenOn(port + 1, attemptsLeft - 1), 80);
      return;
    }
    console.error('');
    console.error('  AXM Workshop could not start: ' + (err && err.message ? err.message : String(err)));
    console.error('');
    process.exitCode = 2;
  };
  const onListening = () => {
    server.removeListener('error', onError);
    ACTIVE_PORT = port;
    const base = 'http://' + HOST + ':' + ACTIVE_PORT;
    slog('workshop up on ' + base + ' build=' + BUILD);
    console.log('');
    console.log('  AXM WORKSHOP is running (local, this machine only)');
    console.log('  Open:  ' + base);
    console.log('  Hub:   ' + base + '/hub/index.html');
    console.log('  Stop:  Ctrl+C   (or close this window)');
    console.log('');
    const target = openTarget();
    if (target) openBrowser(base + target);
  };
  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(port, HOST);
}

listenOn(DEFAULT_PORT, MAX_PORT_TRIES);
