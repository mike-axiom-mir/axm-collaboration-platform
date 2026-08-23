'use strict';

const crypto = require('node:crypto');
const http = require('node:http');
const Canonical = require('./canonical-json');
const Digest = require('./digest');

const HOST_RECEIPT_SCHEMA = 'axm.web.local-browser-host-receipt/v1';
const DEFAULT_MAX_ACTION_BYTES = 16 * 1024;

const CONTROLLER_SOURCE = `(function () {
  'use strict';
  const byId = function (id) { return document.getElementById(id); };
  const back = byId('back');
  const forward = byId('forward');
  const reload = byId('reload');
  const address = byId('address');
  const go = byId('go');
  const title = byId('page-title');
  const locator = byId('page-locator');
  const summary = byId('summary');
  const map = byId('document-map-list');
  const cards = byId('cards');
  const history = byId('history-list');
  const status = byId('status');
  let snapshot = null;
  let busy = false;

  function element(name, className, text) {
    const node = document.createElement(name);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function currentPage() {
    return snapshot.bundle.pages.find(function (page) { return page.pageId === snapshot.state.current.pageId; });
  }

  function setStatus(message, kind) {
    status.textContent = message;
    status.dataset.kind = kind || 'info';
  }

  async function requestAction(action) {
    if (busy) return;
    busy = true;
    setStatus('Applying ' + action.type + '\u2026', 'busy');
    try {
      const response = await fetch('action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
        cache: 'no-store',
        credentials: 'omit'
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.code + ': ' + body.message);
      snapshot = body;
      render();
      const transition = snapshot.transitionTrace[snapshot.transitionTrace.length - 1];
      setStatus(transition.status + (transition.reason ? ' \u2014 ' + transition.reason : '') + ' \u00b7 ' + transition.action.type, transition.status.toLowerCase());
    } catch (error) {
      setStatus(String(error && error.message || error), 'fail');
    } finally {
      busy = false;
    }
  }

  function renderSummary(page) {
    summary.replaceChildren();
    Object.keys(page.summary).forEach(function (key) {
      const item = element('li');
      item.append(element('strong', null, page.summary[key]), element('span', null, key));
      summary.append(item);
    });
  }

  function renderMap(page) {
    map.replaceChildren();
    page.entries.forEach(function (entry) {
      const item = element('li');
      const button = element('button', 'map-button');
      button.type = 'button';
      button.dataset.entryRef = entry.entryId;
      button.append(element('span', 'map-kind', entry.label), element('span', 'map-text', entry.text));
      item.append(button);
      map.append(item);
    });
  }

  function renderCards(page) {
    cards.replaceChildren();
    page.entries.forEach(function (entry) {
      const card = element('article', 'semantic-card kind-' + entry.kind);
      card.id = entry.entryId;
      card.tabIndex = -1;
      card.dataset.entryRef = entry.entryId;
      const header = element('header');
      header.append(element('span', 'kind-label', entry.label), element('code', null, entry.entryId + (entry.nodeRef ? ' / ' + entry.nodeRef : '')));
      card.append(header, element('p', 'entry-text', entry.text), element('p', 'entry-meta', entry.meta));
      if (entry.kind === 'link') {
        const link = page.links.find(function (candidate) { return candidate.entryRef === entry.entryId; });
        if (link) {
          const controls = element('div', 'link-controls');
          const state = element('span', 'resolution ' + link.resolution.state.toLowerCase(), link.resolution.state.replaceAll('_', ' '));
          const button = element('button', 'open-link', link.resolution.state === 'SAME_DOCUMENT' ? 'Jump in document' : 'Open bundled page');
          button.type = 'button';
          button.dataset.entryRef = entry.entryId;
          button.disabled = !['AVAILABLE', 'SAME_DOCUMENT'].includes(link.resolution.state);
          controls.append(state, button);
          card.append(controls);
        }
      }
      cards.append(card);
    });
  }

  function renderHistory() {
    history.replaceChildren();
    snapshot.state.history.forEach(function (entry, index) {
      const item = element('li', index === snapshot.state.historyCursor ? 'current-history' : '');
      item.append(element('code', null, entry.navigationId), element('span', null, entry.address));
      history.append(item);
    });
  }

  function restoreView() {
    const focusRef = snapshot.state.current.focusEntryRef;
    const scrollRef = snapshot.state.current.scrollEntryRef;
    requestAnimationFrame(function () {
      const focusTarget = focusRef ? document.getElementById(focusRef) : null;
      if (focusTarget) focusTarget.focus({ preventScroll: true });
      const scrollTarget = scrollRef ? document.getElementById(scrollRef) : null;
      if (scrollTarget) scrollTarget.scrollIntoView({ block: 'start' });
      else window.scrollTo({ top: 0, left: 0 });
    });
  }

  function render() {
    const page = currentPage();
    back.disabled = !snapshot.state.canGoBack;
    forward.disabled = !snapshot.state.canGoForward;
    address.value = snapshot.state.current.address;
    title.textContent = page.title;
    locator.textContent = page.locator;
    byId('session-id').textContent = snapshot.sessionId;
    byId('bundle-digest').textContent = snapshot.bundle.bundleDigest;
    byId('source-digest').textContent = page.sourceDigest;
    byId('reload-count').textContent = String(snapshot.state.reloadCount);
    renderSummary(page);
    renderMap(page);
    renderCards(page);
    renderHistory();
    restoreView();
  }

  back.addEventListener('click', function () { requestAction({ type: 'back' }); });
  forward.addEventListener('click', function () { requestAction({ type: 'forward' }); });
  reload.addEventListener('click', function () { requestAction({ type: 'reload' }); });
  go.addEventListener('click', function () { requestAction({ type: 'open-locator', locator: address.value }); });
  address.addEventListener('keydown', function (event) { if (event.key === 'Enter') requestAction({ type: 'open-locator', locator: address.value }); });
  map.addEventListener('click', function (event) {
    const button = event.target.closest('button[data-entry-ref]');
    if (button) requestAction({ type: 'focus-entry', entryRef: button.dataset.entryRef });
  });
  cards.addEventListener('click', function (event) {
    const button = event.target.closest('button.open-link[data-entry-ref]');
    if (button) requestAction({ type: 'activate', entryRef: button.dataset.entryRef });
  });

  fetch('state', { cache: 'no-store', credentials: 'omit' })
    .then(function (response) { if (!response.ok) throw new Error('state request failed: ' + response.status); return response.json(); })
    .then(function (body) { snapshot = body; render(); setStatus('READY \u00b7 local bundle only', 'ready'); })
    .catch(function (error) { setStatus(String(error && error.message || error), 'fail'); });
}());`;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function controllerHash() {
  return crypto.createHash('sha256').update(CONTROLLER_SOURCE, 'utf8').digest('base64');
}

function renderShellHtml() {
  const hash = controllerHash();
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'sha256-' + escapeHtml(hash) + '\'; style-src \'unsafe-inline\'; connect-src \'self\'; img-src \'none\'; font-src \'none\'; media-src \'none\'; object-src \'none\'; frame-src \'none\'; worker-src \'none\'; base-uri \'none\'; form-action \'none\'">\n' +
    '<title>AXM Local Browser Session \u2014 EXPERIMENTAL</title>\n' +
    '<style>\n' +
    ':root{color-scheme:dark;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#030711;color:#f4f7ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#122541 0,#030711 54rem);min-height:100vh}button,input{font:inherit}.shell{width:min(1500px,calc(100% - 24px));margin:12px auto 44px}.boundary{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 14px;border:1px solid #294264;border-radius:12px;background:#0e1930}.badge{padding:5px 9px;border:1px solid #347266;border-radius:999px;color:#72e1c2;font-size:11px;font-weight:800}.held{border-color:#7b6030;color:#f3bd63}.boundary p{flex:1 1 360px;margin:0;color:#9fb1cc;font-size:12px;line-height:1.45}.toolbar{position:sticky;top:0;z-index:5;display:grid;grid-template-columns:auto minmax(180px,1fr) auto;gap:8px;margin:10px 0;padding:10px;border:1px solid #294264;border-radius:12px;background:#07101ff0;backdrop-filter:blur(12px)}.nav-buttons{display:flex;gap:6px}.toolbar button,.open-link,.map-button{border:1px solid #365477;border-radius:8px;background:#142642;color:#f4f7ff;cursor:pointer}.toolbar button{min-width:42px;padding:9px 11px}.toolbar button:hover:not(:disabled),.toolbar button:focus-visible,.open-link:hover:not(:disabled),.open-link:focus-visible,.map-button:hover,.map-button:focus-visible{border-color:#72e1c2;outline:none}.toolbar button:disabled,.open-link:disabled{cursor:not-allowed;opacity:.42}.address-wrap{display:flex;min-width:0}.address-wrap input{width:100%;min-width:0;padding:9px 12px;border:1px solid #365477;border-radius:8px 0 0 8px;background:#030711;color:#f4f7ff}.address-wrap button{border-radius:0 8px 8px 0}.status{align-self:center;max-width:260px;color:#9fb1cc;font-size:11px;overflow-wrap:anywhere}.status[data-kind="fail"],.status[data-kind="held"]{color:#ffab7a}.hero{padding:22px;border:1px solid #294264;border-radius:16px;background:#0e1930}.eyebrow{margin:0 0 7px;color:#72e1c2;font-size:11px;font-weight:800;letter-spacing:.08em}.hero h1{margin:0;font-size:clamp(24px,4vw,40px);line-height:1.1}.locator{margin:10px 0 0;color:#9fb1cc;overflow-wrap:anywhere}.summary{display:flex;flex-wrap:wrap;gap:7px;margin:15px 0 0;padding:0;list-style:none}.summary li{display:flex;gap:6px;align-items:baseline;padding:6px 9px;border:1px solid #294264;border-radius:8px;background:#111f39}.summary strong{color:#72e1c2}.summary span{color:#9fb1cc;font-size:10px}.grid{display:grid;grid-template-columns:minmax(230px,290px) minmax(0,1fr) minmax(210px,260px);gap:12px;margin-top:12px;align-items:start}.panel{border:1px solid #294264;border-radius:14px;background:#0e1930}.side{position:sticky;top:76px;max-height:calc(100vh - 88px);overflow:auto;padding:15px}.side h2,.content h2{margin:0;font-size:15px}.side-note{margin:6px 0 12px;color:#9fb1cc;font-size:11px;line-height:1.4}.document-map,.history-list{display:grid;gap:6px;margin:0;padding:0;list-style:none}.map-button{display:grid;width:100%;gap:3px;padding:9px;text-align:left}.map-kind{color:#72e1c2;font-size:9px;font-weight:800;text-transform:uppercase}.map-text{font-size:11px;line-height:1.3}.content{padding:15px}.cards{display:grid;gap:9px;margin-top:12px}.semantic-card{--accent:#79b8ff;scroll-margin-top:78px;padding:15px 17px;border:1px solid #294264;border-left:5px solid var(--accent);border-radius:11px;background:#142642}.semantic-card:focus{border-color:#72e1c2;background:#18304e;outline:2px solid #72e1c255;outline-offset:2px}.semantic-card header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:7px;padding-bottom:8px;border-bottom:1px solid #294264}.kind-label{color:var(--accent);font-size:10px;font-weight:800;text-transform:uppercase}.semantic-card code{color:#9fb1cc;font-size:10px}.entry-text{margin:11px 0 0;font-size:14px;line-height:1.5;overflow-wrap:anywhere}.entry-meta{margin:7px 0 0;color:#9fb1cc;font-size:11px;line-height:1.45;overflow-wrap:anywhere}.kind-heading{--accent:#72e1c2}.kind-landmark{--accent:#69d4ff}.kind-link{--accent:#b5a2ff}.kind-media{--accent:#ff9dc8}.kind-list{--accent:#8bd98b}.kind-table{--accent:#f5cf72}.kind-form{--accent:#ffab7a}.link-controls{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:center;margin-top:11px}.resolution{font-size:10px;color:#9fb1cc}.resolution.available,.resolution.same_document{color:#72e1c2}.open-link{padding:7px 10px;font-size:11px}.history-list li{display:grid;gap:3px;padding:8px;border-left:3px solid #294264;color:#9fb1cc;font-size:10px;overflow-wrap:anywhere}.history-list li.current-history{border-color:#72e1c2;background:#142642;color:#f4f7ff}.receipt{display:grid;gap:8px;margin-top:14px}.receipt div{display:grid;gap:2px}.receipt span{color:#9fb1cc;font-size:9px;text-transform:uppercase}.receipt code{font-size:9px;word-break:break-all}.kind-paragraph{--accent:#79b8ff}@media(max-width:1050px){.grid{grid-template-columns:250px minmax(0,1fr)}.history-panel{position:static;grid-column:1/-1;max-height:none}}@media(max-width:760px){.shell{width:min(100% - 10px,1500px);margin-top:5px}.toolbar{grid-template-columns:auto 1fr;top:0}.status{grid-column:1/-1;max-width:none}.grid{grid-template-columns:1fr}.side{position:static;max-height:none}.history-panel{grid-column:auto}.hero{padding:17px}.content{padding:10px}.semantic-card{padding:13px}.nav-buttons button{min-width:38px;padding:8px}.address-wrap input{padding:8px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}\n' +
    '</style>\n</head>\n<body>\n<main class="shell">\n' +
    '<section class="boundary" aria-label="Experimental boundary"><span class="badge">EXPERIMENTAL</span><span class="badge">LOCAL SESSION</span><span class="badge">SHARED ENGINE</span><span class="badge held">EXTERNAL NETWORK HELD</span><span class="badge held">PAGE CODE INERT</span><p>The trusted AXM shell may navigate only among explicitly allowed local pages. It reparses bound source on reload; unlisted files, HTTP(S), forms, and page scripts remain unavailable.</p></section>\n' +
    '<nav class="toolbar" aria-label="Local browser controls"><div class="nav-buttons"><button id="back" type="button" aria-label="Back">\u2190</button><button id="forward" type="button" aria-label="Forward">\u2192</button><button id="reload" type="button" aria-label="Reload">\u21bb</button></div><div class="address-wrap"><input id="address" aria-label="Bundled local address" autocomplete="off" spellcheck="false"><button id="go" type="button">Go</button></div><output id="status" class="status" aria-live="polite">CONNECTING\u2026</output></nav>\n' +
    '<header class="hero"><p class="eyebrow">AXM LOCAL BROWSER / HUMAN SHELL + HEADLESS SESSION</p><h1 id="page-title">Loading local page\u2026</h1><p id="page-locator" class="locator"></p><ul id="summary" class="summary" aria-label="Extracted structure counts"></ul></header>\n' +
    '<div class="grid"><nav class="panel side" aria-label="Current document map"><h2>Document map</h2><p class="side-note">Focus and scroll restoration use the same stable entry references exposed to headless callers.</p><ol id="document-map-list" class="document-map"></ol></nav>\n' +
    '<section class="panel content" aria-labelledby="content-heading"><h2 id="content-heading">Semantic page</h2><div id="cards" class="cards"></div></section>\n' +
    '<aside class="panel side history-panel" aria-label="Session history"><h2>History</h2><p class="side-note">Bounded local navigation only.</p><ol id="history-list" class="history-list"></ol><div class="receipt"><div><span>Session</span><code id="session-id"></code></div><div><span>Bundle</span><code id="bundle-digest"></code></div><div><span>Source</span><code id="source-digest"></code></div><div><span>Reloads</span><code id="reload-count"></code></div></div></aside></div>\n' +
    '</main>\n<script>' + CONTROLLER_SOURCE + '</script>\n</body>\n</html>\n';
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

function sendJson(response, statusCode, value) {
  const body = Canonical.stringify(value) + '\n';
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY'
  });
  response.end(body);
}

function sendHtml(response, html) {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; script-src 'sha256-" + controllerHash() + "'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY'
  });
  response.end(html);
}

function readAction(request, maxBytes) {
  return new Promise(function (resolve, reject) {
    const declared = Number(request.headers['content-length']);
    if (Number.isFinite(declared) && declared > maxBytes) {
      reject(Object.assign(new Error('action request exceeds the configured byte bound'), { code: 'HOST_ACTION_BYTES_LIMIT' }));
      request.resume();
      return;
    }
    const chunks = [];
    let length = 0;
    request.on('data', function (chunk) {
      length += chunk.length;
      if (length > maxBytes) {
        reject(Object.assign(new Error('action request exceeds the configured byte bound'), { code: 'HOST_ACTION_BYTES_LIMIT' }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', function () {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (_error) {
        reject(Object.assign(new Error('action request must contain valid JSON'), { code: 'HOST_INVALID_JSON' }));
      }
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

async function createLocalBrowserHost(session, options) {
  options = options || {};
  if (!session || typeof session.snapshot !== 'function' || typeof session.apply !== 'function') {
    throw new TypeError('a LocalBrowserSession is required');
  }
  const port = options.port == null ? 0 : Number(options.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new TypeError('port must be an integer from 0 to 65535');
  const maxActionBytes = Number.isInteger(options.maxActionBytes) && options.maxActionBytes > 0
    ? options.maxActionBytes : DEFAULT_MAX_ACTION_BYTES;
  const token = crypto.randomBytes(24).toString('base64url');
  const basePath = '/s/' + token + '/';
  const shellHtml = renderShellHtml();
  let expectedOrigin = null;

  const server = http.createServer(async function (request, response) {
    try {
      const host = String(request.headers.host || '');
      if (!expectedOrigin || host !== expectedOrigin.slice('http://'.length)) {
        sendJson(response, 421, errorEnvelope(Object.assign(new Error('host header is outside the loopback shell origin'), { code: 'HOST_HEADER_REFUSED' })));
        return;
      }
      const requestUrl = new URL(request.url, expectedOrigin);
      if (!requestUrl.pathname.startsWith(basePath)) {
        sendJson(response, 404, errorEnvelope(Object.assign(new Error('route not found'), { code: 'HOST_ROUTE_NOT_FOUND' })));
        return;
      }
      const route = requestUrl.pathname.slice(basePath.length);
      if (request.method === 'GET' && route === '') {
        sendHtml(response, shellHtml);
        return;
      }
      if (request.method === 'GET' && route === 'state') {
        sendJson(response, 200, session.snapshot());
        return;
      }
      if (request.method === 'POST' && route === 'action') {
        const origin = request.headers.origin;
        if (origin && origin !== expectedOrigin) {
          sendJson(response, 403, errorEnvelope(Object.assign(new Error('cross-origin session action refused'), { code: 'HOST_ORIGIN_REFUSED' })));
          return;
        }
        if (!/^application\/json(?:\s*;|$)/i.test(String(request.headers['content-type'] || ''))) {
          sendJson(response, 415, errorEnvelope(Object.assign(new Error('session actions require application/json'), { code: 'HOST_CONTENT_TYPE_REFUSED' })));
          return;
        }
        const action = await readAction(request, maxActionBytes);
        sendJson(response, 200, session.apply(action));
        return;
      }
      sendJson(response, 405, errorEnvelope(Object.assign(new Error('method or route not allowed'), { code: 'HOST_METHOD_REFUSED' })));
    } catch (error) {
      const status = ['HOST_ACTION_BYTES_LIMIT', 'HOST_INVALID_JSON'].includes(error.code) ? 400 : 422;
      if (!response.headersSent) sendJson(response, status, errorEnvelope(error));
      else response.destroy();
    }
  });
  server.on('clientError', function (_error, socket) {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 1000;
  server.maxHeadersCount = 32;
  await listen(server, port);
  const address = server.address();
  expectedOrigin = 'http://127.0.0.1:' + address.port;
  const snapshot = session.snapshot();
  const receiptMaterial = {
    schema: HOST_RECEIPT_SCHEMA,
    status: 'EXPERIMENTAL',
    origin: expectedOrigin,
    shellUrl: expectedOrigin + basePath,
    sessionId: snapshot.sessionId,
    bundleDigest: snapshot.bundle.bundleDigest,
    loopbackTransportUsed: true,
    externalNetworkUsed: false,
    trustedShellScriptActive: true,
    pageScriptExecuted: false,
    allowedMethods: ['GET', 'POST'],
    maxActionBytes
  };
  const receipt = Object.assign({}, receiptMaterial, { receiptDigest: Digest.canonicalDigest(receiptMaterial) });
  return {
    server,
    receipt,
    close: function () { return close(server); }
  };
}

module.exports = {
  HOST_RECEIPT_SCHEMA,
  DEFAULT_MAX_ACTION_BYTES,
  CONTROLLER_SOURCE,
  escapeHtml,
  controllerHash,
  renderShellHtml,
  errorEnvelope,
  createLocalBrowserHost
};
