'use strict';

const crypto = require('node:crypto');
const http = require('node:http');
const Canonical = require('./canonical-json');
const Digest = require('./digest');
const HostCore = require('./local-browser-host-core');

const CHAT_HOST_RECEIPT_SCHEMA = 'axm.web.browser-ai-chat-host-receipt/v1';
const DEFAULT_MAX_CHAT_ACTION_BYTES = 16 * 1024;

const CONTROLLER_SOURCE = `(function () {
  'use strict';
  const byId = function (id) { return document.getElementById(id); };
  const provider = byId('provider');
  const messages = byId('messages');
  const input = byId('message');
  const send = byId('send');
  const clear = byId('clear');
  const refresh = byId('refresh');
  const status = byId('status');
  const sight = byId('sight');
  const execution = byId('execution');
  let state = null;
  let busy = false;

  function element(name, className, text) {
    const node = document.createElement(name);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function setStatus(message, kind) {
    status.textContent = message;
    status.dataset.kind = kind || 'info';
  }

  async function getState() {
    const response = await fetch('state', { cache: 'no-store', credentials: 'omit' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.code + ': ' + body.message);
    state = body;
    render();
  }

  async function action(body) {
    if (busy) return null;
    busy = true;
    send.disabled = true;
    setStatus('WORKING\\u2026', 'busy');
    try {
      const response = await fetch('action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
        credentials: 'omit'
      });
      const result = await response.json();
      if (!response.ok) throw new Error((result.code || 'AI_CHAT_FAILED') + ': ' + (result.message || response.status));
      state = result;
      render();
      setStatus('READY \\u00b7 ' + body.type, 'ready');
      return result;
    } catch (error) {
      setStatus(String(error && error.message || error), 'fail');
      throw error;
    } finally {
      busy = false;
      send.disabled = !state || !state.available || state.running;
    }
  }

  function selectedProvider() {
    if (!state) return null;
    return state.providers.find(function (item) { return item.id === state.selectedProviderId; }) || null;
  }

  function renderProviders() {
    const previous = state.selectedProviderId;
    provider.replaceChildren();
    state.providers.filter(function (item) { return item.enabled; }).forEach(function (item) {
      const option = element('option', null, item.label + ' \\u00b7 ' + item.model + (item.local ? ' \\u00b7 LOCAL' : ' \\u00b7 REMOTE'));
      option.value = item.id;
      option.selected = item.id === previous;
      provider.append(option);
    });
    provider.disabled = !state.available || state.running;
  }

  function renderMessages() {
    messages.replaceChildren();
    if (!state.messages.length) {
      messages.append(element('p', 'empty', 'Start a conversation with the selected browser AI.'));
      return;
    }
    state.messages.forEach(function (item) {
      const article = element('article', 'message ' + item.role);
      const head = element('div', 'message-head');
      head.append(
        element('strong', null, item.role === 'assistant' ? 'AI' : 'You'),
        element('span', null, item.role === 'assistant' && item.visualStateUsed ? 'screen context used' : '')
      );
      article.append(head, element('p', null, item.text));
      messages.append(article);
    });
    requestAnimationFrame(function () { messages.scrollTop = messages.scrollHeight; });
  }

  function renderContext() {
    const selected = selectedProvider();
    if (!selected) {
      sight.textContent = 'NO ENABLED AI';
      sight.dataset.on = 'false';
    } else if (selected.visualStateAccess && state.visualState) {
      sight.textContent = 'SCREEN ON \\u00b7 ' + state.visualState.fidelity;
      sight.dataset.on = 'true';
    } else {
      sight.textContent = 'SCREEN OFF';
      sight.dataset.on = 'false';
    }
    execution.textContent = state.executionConfigured ? 'EXECUTION ARMED BY HOST' : 'EXECUTION HELD';
    execution.dataset.on = state.executionConfigured ? 'true' : 'false';
  }

  function render() {
    renderProviders();
    renderMessages();
    renderContext();
    send.disabled = !state.available || state.running;
    clear.disabled = !state.available || state.running || state.messages.length === 0;
    input.disabled = !state.available || state.running;
    if (!state.available) setStatus('NO ENABLED AI PROVIDER', 'fail');
    else if (state.lastError) setStatus(state.lastError.code + ': ' + state.lastError.message, 'fail');
  }

  provider.addEventListener('change', function () {
    if (provider.value) action({ type: 'ai-chat-select', providerId: provider.value }).catch(function () {});
  });

  send.addEventListener('click', function () {
    const message = String(input.value || '').trim();
    if (!message) return;
    action({ type: 'ai-chat-send', message: message }).then(function () {
      input.value = '';
      input.focus();
    }).catch(function () {});
  });

  input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send.click();
    }
  });

  clear.addEventListener('click', function () {
    action({ type: 'ai-chat-clear' }).catch(function () {});
  });

  refresh.addEventListener('click', function () {
    getState().then(function () { setStatus('REFRESHED', 'ready'); }).catch(function (error) { setStatus(String(error && error.message || error), 'fail'); });
  });

  getState().then(function () { setStatus('READY \\u00b7 chat history is memory-only', 'ready'); }).catch(function (error) { setStatus(String(error && error.message || error), 'fail'); });
}());`;

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function controllerHash() {
  return crypto.createHash('sha256').update(CONTROLLER_SOURCE, 'utf8').digest('base64');
}

function cleanParentOrigin(value) {
  const text = String(value || '');
  let url;
  try { url = new URL(text); }
  catch (_error) { throw new TypeError('parentOrigin must be an absolute loopback HTTP origin'); }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new TypeError('parentOrigin must be an exact http://127.0.0.1:<port> origin');
  }
  return url.origin;
}

function contentSecurityPolicy(parentOrigin) {
  return "default-src 'none'; script-src 'sha256-" + controllerHash() + "'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; frame-ancestors " + cleanParentOrigin(parentOrigin) + "; worker-src 'none'; base-uri 'none'; form-action 'none'";
}

function securityHeaders(parentOrigin) {
  const headers = Object.assign({}, HostCore.securityHeaders());
  delete headers['X-Frame-Options'];
  headers['Cross-Origin-Resource-Policy'] = 'same-site';
  headers['Content-Security-Policy'] = contentSecurityPolicy(parentOrigin);
  return headers;
}

function renderHtml(parentOrigin) {
  const policy = contentSecurityPolicy(parentOrigin);
  return '<!doctype html>\\n<html lang="en"><head><meta charset="utf-8">\\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\\n' +
    '<meta http-equiv="Content-Security-Policy" content="' + escapeHtml(policy) + '">\\n' +
    '<title>AXM Browser AI Chat</title>\\n<style>\\n' +
    ':root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#050812;color:#f4f7ff;--surface:#0d1728;--card:#142842;--border:#2b4568;--accent:#72e1c2;--muted:#9fb1cc;--danger:#ffab7a;--user:#15375b}*{box-sizing:border-box}body{margin:0;height:100vh;overflow:hidden;background:linear-gradient(180deg,#101f36,#050812)}button,select,textarea{font:inherit;color:inherit;border:1px solid var(--border);background:#07101f}main{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto}.top{padding:10px;border-bottom:1px solid var(--border);background:var(--surface)}.top-row{display:flex;gap:7px;align-items:center}.top select{min-width:0;flex:1;padding:7px;border-radius:8px}.mini{padding:7px 9px;border-radius:8px;cursor:pointer}.badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.badge{padding:4px 6px;border:1px solid var(--border);border-radius:999px;color:var(--muted);font:800 9px/1.2 ui-monospace,monospace}.badge[data-on="true"]{color:var(--accent);border-color:var(--accent)}.messages{overflow:auto;display:grid;align-content:start;gap:9px;padding:11px}.message{max-width:92%;padding:10px;border:1px solid var(--border);border-radius:12px;background:var(--card)}.message.user{justify-self:end;background:var(--user)}.message.assistant{justify-self:start}.message-head{display:flex;justify-content:space-between;gap:7px;margin-bottom:5px}.message-head strong{font-size:10px;color:var(--accent)}.message-head span{font-size:9px;color:var(--muted)}.message p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.48}.empty{margin:auto;color:var(--muted);font-size:12px;text-align:center}.composer{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;padding:9px;border-top:1px solid var(--border);background:var(--surface)}textarea{min-height:58px;max-height:150px;resize:vertical;padding:9px;border-radius:9px;line-height:1.4}.send{padding:9px 13px;border-radius:9px;border-color:var(--accent);color:var(--accent);cursor:pointer}.footer{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:6px 9px;color:var(--muted);font:700 9px/1.3 ui-monospace,monospace;border-top:1px solid var(--border)}.status[data-kind="ready"]{color:var(--accent)}.status[data-kind="fail"]{color:var(--danger)}button:disabled,textarea:disabled,select:disabled{opacity:.45;cursor:not-allowed}button:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:1px}@media(max-width:420px){.top-row{flex-wrap:wrap}.top select{flex-basis:100%}.message{max-width:96%}}\\n' +
    '</style></head><body><main>\\n' +
    '<header class="top"><div class="top-row"><select id="provider" aria-label="AI provider"></select><button id="refresh" class="mini" type="button">Refresh</button><button id="clear" class="mini" type="button">Clear</button></div><div class="badges"><span id="sight" class="badge">SCREEN</span><span id="execution" class="badge">EXECUTION</span><span class="badge">MEMORY ONLY</span></div></header>\\n' +
    '<section id="messages" class="messages" aria-live="polite"></section>\\n' +
    '<div class="composer"><textarea id="message" maxlength="4000" placeholder="Chat with the selected browser AI…"></textarea><button id="send" class="send" type="button">Send</button></div>\\n' +
    '<footer class="footer"><span>Enter sends · Shift+Enter newline</span><output id="status" class="status">CONNECTING…</output></footer>\\n' +
    '</main><script>' + CONTROLLER_SOURCE + '</script></body></html>\\n';
}

function sendJson(response, statusCode, value, parentOrigin) {
  const body = Canonical.stringify(value) + '\n';
  response.writeHead(statusCode, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  }, securityHeaders(parentOrigin)));
  response.end(body);
}

function sendHtml(response, html, parentOrigin) {
  response.writeHead(200, Object.assign({
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html)
  }, securityHeaders(parentOrigin)));
  response.end(html);
}

function readJson(request, maxBytes) {
  return new Promise(function (resolve, reject) {
    const declared = Number(request.headers['content-length']);
    if (Number.isFinite(declared) && declared > maxBytes) {
      reject(Object.assign(new Error('chat action exceeds configured byte bound'), { code: 'AI_CHAT_HOST_BYTES_LIMIT' }));
      request.resume();
      return;
    }
    const chunks = [];
    let total = 0;
    request.on('data', function (chunk) {
      total += chunk.length;
      if (total > maxBytes) {
        reject(Object.assign(new Error('chat action exceeds configured byte bound'), { code: 'AI_CHAT_HOST_BYTES_LIMIT' }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', function () {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (_error) { reject(Object.assign(new Error('chat action must contain valid JSON'), { code: 'AI_CHAT_HOST_INVALID_JSON' })); }
    });
    request.on('error', reject);
  });
}

function listen(server, port) {
  return new Promise(function (resolve, reject) {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', function () {
      server.removeListener('error', reject);
      resolve();
    });
  });
}

function close(server) {
  return new Promise(function (resolve, reject) {
    server.close(function (error) { if (error) reject(error); else resolve(); });
  });
}

function errorEnvelope(error) {
  return {
    schema: 'axm.web.error/v1',
    code: String(error && error.code || 'UNEXPECTED_ERROR'),
    message: String(error && error.message || error),
    details: error && error.details ? error.details : null,
    status: 'FAIL'
  };
}

async function createBrowserAiChatHost(session, chatPlane, options) {
  options = options || {};
  if (!session || typeof session.snapshot !== 'function') throw new TypeError('a LocalBrowserSession is required');
  if (!chatPlane || typeof chatPlane.state !== 'function' || typeof chatPlane.apply !== 'function') throw new TypeError('a LocalBrowserAiChat plane is required');
  const parentOrigin = cleanParentOrigin(options.parentOrigin);
  const port = options.port == null ? 0 : Number(options.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new TypeError('port must be 0..65535');
  const maxActionBytes = Number.isInteger(options.maxActionBytes) && options.maxActionBytes > 0 ? options.maxActionBytes : DEFAULT_MAX_CHAT_ACTION_BYTES;
  const token = crypto.randomBytes(24).toString('base64url');
  const basePath = '/chat/' + token + '/';
  const html = renderHtml(parentOrigin);
  let expectedOrigin = null;

  const server = http.createServer(async function (request, response) {
    try {
      const host = String(request.headers.host || '');
      if (!expectedOrigin || host !== expectedOrigin.slice('http://'.length)) {
        sendJson(response, 421, errorEnvelope(Object.assign(new Error('host header is outside the AI chat origin'), { code: 'AI_CHAT_HOST_REFUSED' })), parentOrigin);
        return;
      }
      const requestUrl = new URL(request.url, expectedOrigin);
      if (!requestUrl.pathname.startsWith(basePath)) {
        sendJson(response, 404, errorEnvelope(Object.assign(new Error('route not found'), { code: 'AI_CHAT_ROUTE_NOT_FOUND' })), parentOrigin);
        return;
      }
      const route = requestUrl.pathname.slice(basePath.length);
      if (request.method === 'GET' && route === '') {
        sendHtml(response, html, parentOrigin);
        return;
      }
      if (request.method === 'GET' && route === 'state') {
        sendJson(response, 200, chatPlane.state(), parentOrigin);
        return;
      }
      if (request.method === 'POST' && route === 'action') {
        const origin = String(request.headers.origin || '');
        if (!origin) {
          sendJson(response, 403, errorEnvelope(Object.assign(new Error('chat actions require the exact chat Origin header'), { code: 'AI_CHAT_ORIGIN_REQUIRED' })), parentOrigin);
          return;
        }
        if (origin !== expectedOrigin) {
          sendJson(response, 403, errorEnvelope(Object.assign(new Error('cross-origin chat action refused'), { code: 'AI_CHAT_ORIGIN_REFUSED' })), parentOrigin);
          return;
        }
        if (!/^application\/json(?:\s*;|$)/i.test(String(request.headers['content-type'] || ''))) {
          sendJson(response, 415, errorEnvelope(Object.assign(new Error('chat actions require application/json'), { code: 'AI_CHAT_CONTENT_TYPE_REFUSED' })), parentOrigin);
          return;
        }
        const action = await readJson(request, maxActionBytes);
        sendJson(response, 200, await chatPlane.apply(action), parentOrigin);
        return;
      }
      sendJson(response, 405, errorEnvelope(Object.assign(new Error('method or route not allowed'), { code: 'AI_CHAT_METHOD_REFUSED' })), parentOrigin);
    } catch (error) {
      const status = ['AI_CHAT_HOST_BYTES_LIMIT', 'AI_CHAT_HOST_INVALID_JSON'].includes(error.code) ? 400 : 422;
      if (!response.headersSent) sendJson(response, status, errorEnvelope(error), parentOrigin);
      else response.destroy();
    }
  });
  server.on('clientError', function (_error, socket) { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); });
  server.requestTimeout = 120000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 1000;
  server.maxHeadersCount = 32;
  await listen(server, port);

  const address = server.address();
  expectedOrigin = 'http://127.0.0.1:' + address.port;
  const registry = chatPlane.registryNow();
  const material = {
    schema: CHAT_HOST_RECEIPT_SCHEMA,
    version: 1,
    status: 'EXPERIMENTAL',
    origin: expectedOrigin,
    chatUrl: expectedOrigin + basePath,
    parentOrigin,
    sessionId: session.snapshot().sessionId,
    registryDigest: registry.registryDigest,
    loopbackTransportUsed: true,
    controllerCspHash: 'sha256-' + controllerHash(),
    maxActionBytes,
    conversationPersistence: 'MEMORY_ONLY',
    authority: {
      providerExecutionImplicit: false,
      providerExecutionRequiresExplicitAuthority: true,
      browserMutationAllowed: false,
      browserNavigationAllowed: false,
      searchExecutionGranted: false,
      toolExecutionGranted: false,
      pageCodeExecutionGranted: false,
      installAllowed: false,
      promotionAllowed: false,
      canonAllowed: false
    }
  };
  const receipt = Object.assign({}, material, { receiptDigest: Digest.canonicalDigest(material) });
  return { server, receipt, url: receipt.chatUrl, close: function () { return close(server); } };
}

module.exports = {
  CHAT_HOST_RECEIPT_SCHEMA,
  DEFAULT_MAX_CHAT_ACTION_BYTES,
  CONTROLLER_SOURCE,
  controllerHash,
  cleanParentOrigin,
  contentSecurityPolicy,
  securityHeaders,
  renderHtml,
  createBrowserAiChatHost
};
