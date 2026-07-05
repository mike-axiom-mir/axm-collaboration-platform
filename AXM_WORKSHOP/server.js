/* ============================================================
   AXM WORKSHOP SERVER  —  server.js   (v0.3 TEST)
   ------------------------------------------------------------
   The private local launcher body. Steam-like for YOUR tools only.
   ZERO dependencies: plain Node http/fs.

   WHAT IT DOES
     - serves the launcher UI + every tool from ONE origin
       (http://127.0.0.1:8788) so all tools share the same spine storage.
     - scans /tools/<folder>/manifest.json so the library builds itself.
     - exposes safe tool card metadata to the launcher.
     - writes normal exports only inside /exports and /logs.
     - TEST endpoint: user-initiated card metadata patch for tool manifests.

   WHAT IT REFUSES
     - binds 127.0.0.1 ONLY.
     - rejects path traversal.
     - no deletes anywhere.
     - no arbitrary manifest editing; /api/tool-card only patches card + summary.
   ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = 8788;
const HOST = '127.0.0.1';
const VERSION = '0.3-test';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon', '.wav': 'audio/wav', '.mp3': 'audio/mpeg'
};
const STATUSES = ['TEST', 'WORKING', 'CANON', 'SHELL', 'BROKEN'];
const ACCENTS = ['cyan', 'purple', 'gold', 'green', 'pink'];

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function safeName(name) {
  return String(name || '').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120) || 'unnamed.txt';
}
function safeString(v, fallback) { return typeof v === 'string' ? v : (fallback || ''); }
function safeArray(v) { return Array.isArray(v) ? v : []; }
function safeObj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : null; }
function safeCardText(v, max) { return safeString(v, '').replace(/[\r\n\t]/g, ' ').trim().slice(0, max || 160); }
function safeAssetRef(v) {
  const s = safeString(v, '').trim();
  if (!s) return null;
  if (s.includes('..') || s.includes('://') || s.startsWith('/') || s.startsWith('data:')) return null;
  return s.replace(/[^a-zA-Z0-9._/ -]/g, '_').slice(0, 180);
}
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function scanTools() {
  const dir = path.join(ROOT, 'tools');
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.charAt(0) === '_') continue;
    const mPath = path.join(dir, e.name, 'manifest.json');
    let m = null;
    try { m = readJson(mPath); }
    catch (err) {
      out.push({ folder: e.name, id: e.name, name: e.name, status: 'BROKEN', error: 'manifest.json missing or invalid', entry: null });
      continue;
    }
    out.push({
      folder: e.name,
      id: safeString(m.id, e.name),
      name: safeString(m.name, e.name),
      version: safeString(m.version, 'v?'),
      status: STATUSES.indexOf(m.status) >= 0 ? m.status : 'TEST',
      entry: safeString(m.entry, 'index.html'),
      category: safeString(m.category, ''),
      summary: safeString(m.summary, ''),
      tags: safeArray(m.tags),
      notes: safeString(m.notes, ''),
      uses: safeArray(m.uses),
      supports: safeArray(m.supports),
      card: safeObj(m.card),
      no_fake_done: safeArray(m.no_fake_done)
    });
  }
  return out;
}
function findToolManifest(toolId) {
  const wanted = safeString(toolId, '').trim();
  if (!wanted || wanted.includes('..') || wanted.includes('/')) return null;
  for (const t of scanTools()) {
    if (t.id === wanted || t.folder === wanted) return path.join(ROOT, 'tools', t.folder, 'manifest.json');
  }
  return null;
}
function buildCardPatch(input) {
  const cardIn = safeObj(input.card) || {};
  const card = {};
  const accent = safeString(cardIn.accent, 'cyan');
  card.accent = ACCENTS.includes(accent) ? accent : 'cyan';
  const subtitle = safeCardText(cardIn.subtitle, 140);
  if (subtitle) card.subtitle = subtitle;
  const cover = safeAssetRef(cardIn.cover);
  if (cover) card.cover = cover;
  return card;
}
function applyToolCardPatch(payload) {
  const manifestPath = findToolManifest(payload && payload.toolId);
  if (!manifestPath) throw new Error('tool not found');
  const manifest = readJson(manifestPath);
  const card = buildCardPatch(payload || {});
  manifest.card = Object.assign({}, safeObj(manifest.card) || {}, card);
  const summary = safeCardText(payload && payload.summary, 180);
  if (summary) manifest.summary = summary;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  slog('tool-card patch ' + (manifest.id || path.basename(path.dirname(manifestPath))) + ' card=' + JSON.stringify(card));
  return { ok: true, toolId: manifest.id || payload.toolId, saved: path.relative(ROOT, manifestPath), card: manifest.card, summary: manifest.summary || '' };
}
function slog(line) {
  const entry = new Date().toISOString() + '  ' + line + '\n';
  try { fs.appendFileSync(path.join(ROOT, 'logs', 'workshop.log'), entry); } catch (e) {}
}
function readBody(req, max, cb) {
  let buf = '';
  req.on('data', c => { buf += c; if (buf.length > max) req.destroy(); });
  req.on('end', () => cb(buf));
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url.includes('..')) return send(res, 400, { error: 'path tricks refused' });

  if (url === '/api/health') return send(res, 200, { ok: true, body: 'axm-workshop', version: VERSION, host: HOST + ':' + PORT });
  if (url === '/api/tools') return send(res, 200, { tools: scanTools(), statuses: STATUSES });

  if (url === '/api/export' && req.method === 'POST') {
    return readBody(req, 5e6, buf => {
      try {
        const { filename, content } = JSON.parse(buf);
        const fn = safeName(filename);
        fs.writeFileSync(path.join(ROOT, 'exports', fn), String(content));
        slog('export ' + fn + ' (' + String(content).length + ' bytes)');
        return send(res, 200, { ok: true, saved: 'exports/' + fn });
      } catch (e) { return send(res, 400, { error: 'bad export: ' + e.message }); }
    });
  }
  if (url === '/api/tool-card' && req.method === 'POST') {
    return readBody(req, 1e5, buf => {
      try { return send(res, 200, applyToolCardPatch(JSON.parse(buf))); }
      catch (e) { return send(res, 400, { error: 'bad tool-card patch: ' + e.message }); }
    });
  }
  if (url === '/api/log' && req.method === 'POST') {
    return readBody(req, 1e5, buf => {
      try { slog('tool: ' + JSON.parse(buf).line); return send(res, 200, { ok: true }); }
      catch (e) { return send(res, 400, { error: 'bad log line' }); }
    });
  }

  let fp = url === '/' ? '/launcher/index.html' : url;
  const abs = path.join(ROOT, fp);
  if (!abs.startsWith(ROOT)) return send(res, 400, { error: 'outside root' });
  fs.readFile(abs, (err, data) => {
    if (err) {
      return send(res, 404, '<html><body style="background:#14171c;color:#dce2ea;font-family:sans-serif;padding:40px">' +
        '<h2>Not here: ' + fp.replace(/</g, '&lt;') + '</h2>' +
        '<p>The workshop looked inside its own folder and that file is not there.</p>' +
        '<a style="color:#38d6ec" href="/">back to the library</a></body></html>', 'text/html; charset=utf-8');
    }
    send(res, 200, data, MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream');
  });
});

server.listen(PORT, HOST, () => {
  console.log('AXM Workshop running: http://' + HOST + ':' + PORT);
  console.log('Local only. Close this window to stop.');
});
