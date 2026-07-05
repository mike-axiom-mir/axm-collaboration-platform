/* ============================================================
   AXM WORKSHOP SERVER  —  server.js   (v0.1)
   ------------------------------------------------------------
   The private local launcher body. Steam-like for YOUR tools only.
   ZERO dependencies: plain Node http/fs. Read the whole file in
   five minutes — that's on purpose. If you can't audit it, it
   doesn't belong at the root of a trust system.

   WHAT IT DOES
     - serves the launcher UI + every tool from ONE origin
       (http://127.0.0.1:8788) -> all tools share the same spine
       storage naturally. No locker tricks needed on PC.
     - scans /tools/<folder>/manifest.json -> the library builds
       itself from the filesystem. Drop a folder in, it appears.
     - writes ONLY inside /exports and /logs (both append-friendly).
       Everything else on disk is read-only to the server.

   WHAT IT REFUSES (by design, not by accident)
     - binds 127.0.0.1 ONLY. Nothing outside this machine can
       reach it. No accounts, no cloud, no telemetry, nothing
       phones home. The only network it knows is the loopback.
     - no path tricks: requests containing '..' are rejected.
     - no writes outside /exports and /logs, no deletes anywhere.
   ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = 8788;
const HOST = '127.0.0.1';
const VERSION = '0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',   '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon', '.wav': 'audio/wav', '.mp3': 'audio/mpeg'
};

const STATUSES = ['TEST', 'WORKING', 'CANON', 'SHELL', 'BROKEN'];

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function safeName(name) {
  /* filenames only — no folders, no traversal, no weirdness */
  return String(name || '').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120) || 'unnamed.txt';
}

/* ---- library: scan tools/<dir>/manifest.json --------------------------- */
function scanTools() {
  const dir = path.join(ROOT, 'tools');
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.charAt(0) === '_') continue;   /* _templates etc: shelves, not tools */
    const mPath = path.join(dir, e.name, 'manifest.json');
    let m = null;
    try { m = JSON.parse(fs.readFileSync(mPath, 'utf8')); }
    catch (err) {
      out.push({ folder: e.name, id: e.name, name: e.name,
                 status: 'BROKEN', error: 'manifest.json missing or invalid',
                 entry: null });
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
      uses: Array.isArray(m.uses) ? m.uses : []   /* declared powers — trust charter #4 */
    });
  }
  return out;
}

/* ---- append-only server log -------------------------------------------- */
function slog(line) {
  const entry = new Date().toISOString() + '  ' + line + '\n';
  try { fs.appendFileSync(path.join(ROOT, 'logs', 'workshop.log'), entry); } catch (e) {}
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);

  if (url.includes('..')) return send(res, 400, { error: 'path tricks refused' });

  /* ---- API ---- */
  if (url === '/api/health') {
    return send(res, 200, { ok: true, body: 'axm-workshop', version: VERSION, host: HOST + ':' + PORT });
  }
  if (url === '/api/tools') {
    return send(res, 200, { tools: scanTools(), statuses: STATUSES });
  }
  if (url === '/api/export' && req.method === 'POST') {
    let buf = '';
    req.on('data', c => { buf += c; if (buf.length > 5e6) req.destroy(); });
    req.on('end', () => {
      try {
        const { filename, content } = JSON.parse(buf);
        const fn = safeName(filename);
        fs.writeFileSync(path.join(ROOT, 'exports', fn), String(content));
        slog('export ' + fn + ' (' + String(content).length + ' bytes)');
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

  /* ---- static files (read-only) ---- */
  let fp = url === '/' ? '/launcher/index.html' : url;
  const abs = path.join(ROOT, fp);
  if (!abs.startsWith(ROOT)) return send(res, 400, { error: 'outside root' });
  fs.readFile(abs, (err, data) => {
    if (err) {
      /* honest 404, launcher-styled, never a browser dead end */
      return send(res, 404, '<html><body style="background:#14171c;color:#dce2ea;font-family:sans-serif;padding:40px">' +
        '<h2>Not here: ' + fp.replace(/</g, '&lt;') + '</h2>' +
        '<p>The workshop looked inside its own folder and that file is not there.</p>' +
        '<a style="color:#38d6ec" href="/">back to the library</a></body></html>', 'text/html; charset=utf-8');
    }
    send(res, 200, data, MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream');
  });
});

server.listen(PORT, HOST, () => {
  slog('workshop up on http://' + HOST + ':' + PORT);
  console.log('');
  console.log('  AXM WORKSHOP is running (private, this machine only)');
  console.log('  Open:  http://' + HOST + ':' + PORT);
  console.log('  Stop:  Ctrl+C   (or close this window)');
  console.log('');
});
