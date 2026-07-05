#!/usr/bin/env node
/* ============================================================
   AXM LOCAL BRIDGE  —  axm-bridge.js   (v0.3 · the lock + MULTI-PROVIDER)
   ------------------------------------------------------------
   Holds your API key so browser tools never touch it. v0.1 was the
   honest light version; its own NOT DONE section promised this v0.2:
   while v0.1 ran, ANY website open in your browser could call
   localhost and spend your key. v0.2 closes that door.

   THE LOCK (two ways in, everything else refused)
   1. FROM THE WORKSHOP: browsers stamp every cross-site request
      with an unforgeable Origin label. Requests stamped with the
      workshop's own address pass. A hostile website's stamp says
      the hostile website — refused before the key is touched.
      -> your tools need ZERO changes; the spine stays untouched.
   2. WITH THE DOOR KEY: on first start the bridge writes a random
      token to bridge-token.txt (a local file websites cannot read).
      Non-browser callers (scripts, local AIs) send it as the
      x-axm-token header. Wrong/no token + wrong origin = 403.
   Plus: CORS is now locked to the allowlist (v0.1 had '*' — open).
   Note: local programs on your own machine are outside this lock's
   job — anything running on your machine could read the token file.
   This lock is against hostile WEBSITES, which was the actual hole.

   ALSO NEW IN v0.2 (from the v0.1 NOT DONE list)
   - persistent append-only audit: bridge.log next to this file
   - simple rate cap (default 30 asks/minute) so nothing can drain
     your key quietly, not even your own runaway tool

   RUN IT
     set ANTHROPIC_API_KEY=sk-ant-...   (windows)  /  export ... (mac/linux)
     node axm-bridge.js
   AI stays OPTIONAL everywhere: never run this, everything still works.

   STILL NOT DONE (honest): no key rotation; chatgpt path built to
   OpenAI's published API shape but NOT live-tested here (sandbox can't
   reach api.openai.com) — your weekend test proves it, and check the
   model name (AXM_OPENAI_MODEL) against your OpenAI dashboard;
   no request queue; file:// -opened tools don't pass check #1 (serve
   tools through the workshop — the supported path — or use the token).
   NOT PROVEN against a real AI until your laptop test says so.
   ============================================================ */

'use strict';
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var PORT = process.env.AXM_BRIDGE_PORT ? Number(process.env.AXM_BRIDGE_PORT) : 8787;
var HOST = '127.0.0.1';                       // local machine ONLY
/* ---- providers: one key per mind, all keys stay on THIS machine -------
   claude  -> ANTHROPIC_API_KEY   (model: AXM_CLAUDE_MODEL)
   chatgpt -> OPENAI_API_KEY      (model: AXM_OPENAI_MODEL)
   Tools choose per request: AXM.ask(prompt, { provider:'chatgpt' })
   No provider named -> first one that has a key.                        */
var PROVIDERS = {
  claude: {
    key: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.AXM_CLAUDE_MODEL || 'claude-sonnet-4-6'
  },
  chatgpt: {
    key: process.env.OPENAI_API_KEY || '',
    model: process.env.AXM_OPENAI_MODEL || 'gpt-5.5'
  }
};
function firstProvider() {
  if (PROVIDERS.claude.key) return 'claude';
  if (PROVIDERS.chatgpt.key) return 'chatgpt';
  return null;
}
var RATE_PER_MIN = process.env.AXM_BRIDGE_RATE ? Number(process.env.AXM_BRIDGE_RATE) : 30;

/* who may knock: the workshop by default; extend via env if you must */
var ALLOWED_ORIGINS = (process.env.AXM_ALLOWED_ORIGINS ||
  'http://127.0.0.1:8788,http://localhost:8788').split(',').map(function (s) { return s.trim(); });

/* ---- the door key ------------------------------------------------------- */
var TOKEN_FILE = path.join(__dirname, 'bridge-token.txt');
var TOKEN = '';
try { TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim(); } catch (e) {}
if (!TOKEN) {
  TOKEN = crypto.randomBytes(24).toString('hex');
  fs.writeFileSync(TOKEN_FILE, TOKEN + '\n');
}

/* ---- append-only audit --------------------------------------------------- */
function audit(line) {
  var entry = new Date().toISOString() + '  ' + line;
  try { console.log('[bridge] ' + line); } catch (e) {}
  try { fs.appendFileSync(path.join(__dirname, 'bridge.log'), entry + '\n'); } catch (e) {}
}

/* ---- rate cap ------------------------------------------------------------ */
var stamps = [];
function overRate() {
  var now = Date.now();
  stamps = stamps.filter(function (t) { return now - t < 60000; });
  if (stamps.length >= RATE_PER_MIN) return true;
  stamps.push(now); return false;
}

/* ---- the lock ------------------------------------------------------------ */
function allowed(req) {
  var origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.indexOf(origin) >= 0) return 'origin:' + origin;
  var tok = req.headers['x-axm-token'];
  if (tok && TOKEN && crypto.timingSafeEqual(
        Buffer.from(String(tok).padEnd(64).slice(0, 64)),
        Buffer.from(String(TOKEN).padEnd(64).slice(0, 64)))) return 'token';
  return null;
}

function httpsJson(options, body) {
  return new Promise(function (resolve, reject) {
    var req = https.request(options, function (res) {
      var data = ''; res.on('data', function (d) { data += d; });
      res.on('end', function () {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('bad AI response')); }
      });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}


function toOpenAIContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content == null ? '' : content);
  return content.map(function (part) {
    if (!part || typeof part !== 'object') return { type: 'text', text: String(part == null ? '' : part) };
    if (part.type === 'text') return { type: 'text', text: part.text || '' };
    if (part.type === 'image' && part.source && part.source.type === 'base64') {
      var mt = part.source.media_type || 'image/png';
      return { type: 'image_url', image_url: { url: 'data:' + mt + ';base64,' + (part.source.data || '') } };
    }
    return { type: 'text', text: part.text || '' };
  });
}
function toOpenAIMessages(messages) {
  return (messages || []).map(function (m) {
    return { role: m.role || 'user', content: toOpenAIContent(m.content) };
  });
}

function callAI(payload) {
  var opts = payload.opts || {};
  // opts.provider is used by AXMConnect to choose the local connector provider (usually 'bridge').
  // opts.aiProvider/targetProvider chooses the actual AI behind the bridge: 'claude' or 'chatgpt'.
  var which = opts.aiProvider || opts.targetProvider || opts.provider || firstProvider();
  if (which === 'bridge' || which === 'auto') which = firstProvider();
  if (!which) return Promise.reject(new Error('no keys set — set ANTHROPIC_API_KEY and/or OPENAI_API_KEY'));
  var p = PROVIDERS[which];
  if (!p) return Promise.reject(new Error('unknown provider: ' + which + ' (have: ' + Object.keys(PROVIDERS).join(', ') + ')'));
  if (!p.key) return Promise.reject(new Error('provider ' + which + ' has no key set on this machine'));
  var messages = payload.messages || [];

  if (which === 'claude') {
    var body = JSON.stringify({
      model: opts.model || p.model,
      max_tokens: opts.maxTokens || 1024,
      messages: messages,
      system: opts.system || undefined
    });
    return httpsJson({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': p.key, 'anthropic-version': '2023-06-01', 'content-length': Buffer.byteLength(body) }
    }, body).then(function (j) {
      if (j.error) throw new Error('claude: ' + (j.error.message || 'api error'));
      var text = Array.isArray(j.content) ? j.content.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n') : '';
      return { text: text, provider: 'claude', raw: j };
    });
  }

  /* chatgpt: same idea, OpenAI shapes — system rides as first message.
     Studio sends Claude-style image blocks; convert them before OpenAI. */
  var omsgs = toOpenAIMessages(messages);
  var msgs = opts.system ? [{ role: 'system', content: opts.system }].concat(omsgs) : omsgs;
  var obody = JSON.stringify({
    model: opts.model || p.model,
    max_completion_tokens: opts.maxTokens || 1024,
    messages: msgs
  });
  return httpsJson({
    hostname: 'api.openai.com', path: '/v1/chat/completions', method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + p.key, 'content-length': Buffer.byteLength(obody) }
  }, obody).then(function (j) {
    if (j.error) throw new Error('chatgpt: ' + (j.error.message || 'api error'));
    var text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    return { text: text, provider: 'chatgpt', raw: j };
  });
}

function send(res, code, obj, origin) {
  var headers = { 'content-type': 'application/json' };
  /* CORS: answer ONLY for allowlisted origins — v0.1's '*' is gone */
  if (origin && ALLOWED_ORIGINS.indexOf(origin) >= 0) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-headers'] = 'content-type, x-axm-token';
    headers['access-control-allow-methods'] = 'GET,POST,OPTIONS';
  }
  res.writeHead(code, headers);
  res.end(JSON.stringify(obj));
}

var server = http.createServer(function (req, res) {
  var origin = req.headers.origin;
  if (req.method === 'OPTIONS') return send(res, 204, {}, origin);

  if (req.method === 'GET' && req.url === '/health') {
    /* health stays open (the Connector probes it) but says nothing usable */
    return send(res, 200, { ok: true, locked: true,
      providers: {
        claude:  { hasKey: !!PROVIDERS.claude.key,  model: PROVIDERS.claude.model },
        chatgpt: { hasKey: !!PROVIDERS.chatgpt.key, model: PROVIDERS.chatgpt.model }
      } }, origin);
  }

  if (req.method === 'POST' && req.url === '/ask') {
    var pass = allowed(req);
    if (!pass) {
      audit('REFUSED /ask from origin=' + (origin || 'none') + ' (no valid stamp, no valid token)');
      return send(res, 403, { error: 'refused: not the workshop and no valid token' }, origin);
    }
    if (overRate()) {
      audit('RATE-CAPPED /ask (' + RATE_PER_MIN + '/min) via ' + pass);
      return send(res, 429, { error: 'rate cap: ' + RATE_PER_MIN + ' asks/minute' }, origin);
    }
    var buf = '';
    req.on('data', function (d) { buf += d; if (buf.length > 5e6) req.destroy(); });
    req.on('end', function () {
      var payload; try { payload = JSON.parse(buf || '{}'); } catch (e) { return send(res, 400, { error: 'bad json' }, origin); }
      audit('ask via ' + pass + ' · ' + ((payload.messages && payload.messages.length) || 0) + ' message(s)');
      callAI(payload).then(function (r) { send(res, 200, { text: r.text, provider: r.provider }, origin); })
        .catch(function (e) { audit('ask error: ' + e.message); send(res, 502, { error: e.message }, origin); });
    });
    return;
  }
  send(res, 404, { error: 'not found' }, origin);
});

server.listen(PORT, HOST, function () {
  audit('bridge v0.3 up on http://' + HOST + ':' + PORT +
        ' · providers: claude(key:' + !!PROVIDERS.claude.key + ') chatgpt(key:' + !!PROVIDERS.chatgpt.key + ')' +
        ' · allowed origins: ' + ALLOWED_ORIGINS.join(' ') + ' · token: bridge-token.txt');
});
