'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const U = require('./operations-utils');

function privateIpv4() {
  const rows = [];
  for (const entries of Object.values(os.networkInterfaces())) for (const item of entries || []) {
    if (item.family !== 'IPv4' || item.internal) continue;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address)) rows.push(item.address);
  }
  return rows[0] || null;
}
function html(session) {
  const safeId = JSON.stringify(session.id), safeToken = JSON.stringify(session.token);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AXM Device Handoff</title><style>body{font:16px system-ui;background:#10151c;color:#edf4f7;margin:0;padding:28px}main{max-width:620px;margin:auto;background:#18222d;border:1px solid #395066;border-radius:18px;padding:24px}button,input{font:inherit}input{display:block;margin:18px 0}button{background:#4ddac5;color:#06221d;border:0;border-radius:10px;padding:12px 18px;font-weight:800}.muted{color:#9eb0bf}.ok{color:#70efc0}.bad{color:#ff9a9a}</style></head><body><main><p class="muted">AXM LOCAL DEVICE HANDOFF</p><h1>Send selected files</h1><p>Only the files you choose below are sent. This page cannot browse the rest of your device.</p><input id="files" type="file" multiple><button id="send">Send selected files</button><p id="status" class="muted">Waiting for your selection.</p></main><script>const sid=${safeId},token=${safeToken},status=document.getElementById('status');document.getElementById('send').onclick=async()=>{const files=[...document.getElementById('files').files];if(!files.length){status.textContent='Choose at least one file.';return}if(files.length>8){status.textContent='Maximum 8 files per handoff.';return}status.textContent='Reading selected files…';try{const payload=[];let total=0;for(const file of files){total+=file.size;if(total>25*1024*1024)throw Error('Selection is larger than 25 MB');const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=()=>reject(r.error);r.readAsDataURL(file)});payload.push({name:file.name,type:file.type,size:file.size,data})}status.textContent='Sending…';const response=await fetch('/upload',{method:'POST',headers:{'content-type':'application/json','x-axm-handoff-token':token},body:JSON.stringify({sessionId:sid,files:payload})});const result=await response.json();if(!response.ok)throw Error(result.error||'Upload refused');status.className='ok';status.textContent=result.saved.length+' file(s) arrived safely. You may close this page.'}catch(error){status.className='bad';status.textContent=error.message}}</script></body></html>`;
}

function create(options) {
  const inboxRoot = path.join(options.root, 'assets', 'inbox', 'device-handoff'), stateDir = path.join(options.stateRoot, 'device-handoff'), receiptFile = path.join(stateDir, 'receipts.json'), auditFile = path.join(stateDir, 'audit.jsonl');
  let server = null, activePort = null; const sessions = new Map();
  function receipts() { return U.loadJson(receiptFile, { schema: 'axm.device-handoff.receipts/v1', receipts: [] }); }
  function saveReceipt(receipt) { const state = receipts(); state.receipts.unshift(receipt); state.receipts = state.receipts.slice(0, 300); U.atomicJson(receiptFile, state); U.appendJsonl(auditFile, Object.assign({ at: U.now() }, receipt)); }
  function send(res, code, body, type) { res.writeHead(code, { 'content-type': type || 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); }
  function cleanName(name) { const value = path.basename(String(name || '')).replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120); if (!value || value === '.' || value === '..') throw new Error('unsafe filename refused'); return value; }
  function availableName(dir, name) { let target = path.join(dir, name), n = 1, ext = path.extname(name), stem = path.basename(name, ext); while (fs.existsSync(target)) target = path.join(dir, stem + '-' + n++ + ext); return target; }
  function parseBody(req, max) { return new Promise((resolve, reject) => { let body = '', refused = false; req.on('data', chunk => { if (refused) return; body += chunk; if (body.length > max) { refused = true; reject(new Error('handoff payload exceeds 36 MB')); req.destroy(); } }); req.on('end', () => { if (!refused) try { resolve(JSON.parse(body || '{}')); } catch (_) { reject(new Error('invalid handoff payload')); } }); req.on('error', reject); }); }
  async function handle(req, res) {
    let url; try { url = new URL(req.url, 'http://local'); } catch (_) { return send(res, 400, { ok: false, error: 'bad URL' }); }
    if (url.pathname === '/health') return send(res, 200, { ok: true, service: 'axm-device-handoff', sessions: sessions.size });
    if (req.method === 'GET' && url.pathname.startsWith('/receive/')) {
      const id = url.pathname.slice('/receive/'.length), token = url.searchParams.get('token'), session = sessions.get(id);
      if (!session || token !== session.token || Date.now() > session.expiresAt) return send(res, 404, 'Handoff session expired or unavailable.', 'text/plain; charset=utf-8');
      return send(res, 200, html(session), 'text/html; charset=utf-8');
    }
    if (req.method === 'POST' && url.pathname === '/upload') {
      try {
        const parsed = await parseBody(req, 36 * 1024 * 1024), session = sessions.get(String(parsed.sessionId || '')), token = String(req.headers['x-axm-handoff-token'] || '');
        if (!session || token !== session.token || Date.now() > session.expiresAt || session.remainingUploads <= 0) throw new Error('handoff session expired or unavailable');
        if (!Array.isArray(parsed.files) || !parsed.files.length || parsed.files.length > 8) throw new Error('select 1–8 files');
        const decoded = []; let total = 0;
        for (const item of parsed.files) { const name = cleanName(item.name), bytes = Buffer.from(String(item.data || ''), 'base64'); if (bytes.length !== Number(item.size)) throw new Error(name + ': declared size does not match content'); if (bytes.length > 15 * 1024 * 1024) throw new Error(name + ': file exceeds 15 MB'); total += bytes.length; if (total > 25 * 1024 * 1024) throw new Error('selection exceeds 25 MB'); decoded.push({ name, bytes, type: String(item.type || '').slice(0, 120) }); }
        const dir = path.join(inboxRoot, session.id); fs.mkdirSync(dir, { recursive: true }); const saved = [];
        for (const item of decoded) { const target = availableName(dir, item.name); U.assertUnder(target, inboxRoot); fs.writeFileSync(target, item.bytes, { flag: 'wx' }); saved.push({ name: path.basename(target), path: path.relative(options.root, target).replace(/\\/g, '/'), bytes: item.bytes.length, sha256: U.fileSha256(target), mediaType: item.type || null }); }
        session.remainingUploads -= 1; session.received += saved.length; const receipt = { type: 'files-received', sessionId: session.id, source: 'selected-device-files', files: saved, totalBytes: total, remoteAddress: String(req.socket.remoteAddress || '').replace(/^::ffff:/, ''), wholeDeviceScan: false, receivedAt: U.now() }; saveReceipt(receipt); return send(res, 200, { ok: true, saved, remainingUploads: session.remainingUploads });
      } catch (error) { saveReceipt({ type: 'upload-refused', error: String(error.message || error).slice(0, 500), wholeDeviceScan: false }); return send(res, 400, { ok: false, error: error.message }); }
    }
    return send(res, 404, { ok: false, error: 'handoff route not found' });
  }
  function startServer(preferredPort) {
    if (server) return Promise.resolve(status()); let port = Math.max(1024, Math.min(65500, Number(preferredPort) || 8844));
    return new Promise((resolve, reject) => {
      let attempts = 15;
      const listen = () => {
        const candidate = http.createServer((req, res) => { handle(req, res).catch(error => send(res, 500, { ok: false, error: error.message })); });
        candidate.once('error', error => { if (error.code === 'EADDRINUSE' && attempts-- > 0) { port += 1; return listen(); } reject(error); });
        candidate.once('listening', () => { server = candidate; activePort = port; resolve(status()); });
        candidate.listen(port, '0.0.0.0');
      }; listen();
    });
  }
  async function createSession(input) {
    await startServer(input && input.port); const id = U.uid('handoff'), token = crypto.randomBytes(24).toString('base64url'), ttlMinutes = Math.max(2, Math.min(30, Number(input && input.ttlMinutes) || 10)), address = privateIpv4();
    const session = { id, token, createdAt: U.now(), expiresAt: Date.now() + ttlMinutes * 60 * 1000, remainingUploads: 3, received: 0, actor: String(input && input.actor || 'local-user').slice(0, 120) }; sessions.set(id, session);
    setTimeout(() => sessions.delete(id), ttlMinutes * 60 * 1000 + 5000).unref(); const base = 'http://' + (address || '127.0.0.1') + ':' + activePort, url = base + '/receive/' + id + '?token=' + encodeURIComponent(token);
    saveReceipt({ type: 'session-created', sessionId: id, actor: session.actor, expiresAt: new Date(session.expiresAt).toISOString(), lanAddressAvailable: !!address, selectedFilesOnly: true }); return { id, url, localUrl: 'http://127.0.0.1:' + activePort + '/receive/' + id + '?token=' + encodeURIComponent(token), expiresAt: new Date(session.expiresAt).toISOString(), lanAddressAvailable: !!address, selectedFilesOnly: true, wholeDeviceScan: false };
  }
  function stop() { return new Promise(resolve => { sessions.clear(); if (!server) return resolve(status()); const closing = server; server = null; activePort = null; closing.close(() => resolve(status())); }); }
  function status() { return { running: !!server, port: activePort, bind: server ? '0.0.0.0' : null, privateAddress: privateIpv4(), activeSessions: Array.from(sessions.values()).map(x => ({ id: x.id, createdAt: x.createdAt, expiresAt: new Date(x.expiresAt).toISOString(), remainingUploads: x.remainingUploads, received: x.received })), receipts: receipts().receipts.slice(0, 40), workshopExposedToLan: false }; }
  return { createSession, startServer, stop, status, receiptFile, auditFile };
}

module.exports = { privateIpv4, create };

