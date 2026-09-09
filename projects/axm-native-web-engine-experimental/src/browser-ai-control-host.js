'use strict';

const crypto = require('node:crypto');
const http = require('node:http');
const Canonical = require('./canonical-json');
const Digest = require('./digest');
const HostCore = require('./local-browser-host-core');

const CONTROL_HOST_RECEIPT_SCHEMA = 'axm.web.browser-ai-control-host-receipt/v1';
const DEFAULT_MAX_CONTROL_BYTES = 16 * 1024;

const CONTROLLER_SOURCE = `(function () {
  'use strict';
  const byId = function (id) { return document.getElementById(id); };
  const providers = byId('providers');
  const status = byId('status');
  const mode = byId('ai-mode');
  const active = byId('active-provider');
  const researchEnabled = byId('research-enabled');
  const researchMode = byId('research-run-mode');
  const question = byId('research-question');
  const run = byId('research-run');
  const visual = byId('visual-state');
  const researchOutput = byId('research-output');
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
    if (busy) return;
    busy = true;
    setStatus('Applying ' + body.type + '\u2026', 'busy');
    try {
      const response = await fetch('action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
        credentials: 'omit'
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.code + ': ' + result.message);
      state = result;
      render();
      setStatus('APPLIED \u00b7 ' + body.type, 'ready');
    } catch (error) {
      setStatus(String(error && error.message || error), 'fail');
    } finally {
      busy = false;
    }
  }

  function renderProviders() {
    providers.replaceChildren();
    active.replaceChildren();
    state.providers.forEach(function (provider) {
      const option = element('option', null, provider.label + ' / ' + provider.model);
      option.value = provider.id;
      option.selected = provider.id === state.activeProviderId;
      option.disabled = !provider.enabled;
      active.append(option);

      const card = element('article', 'provider-card');
      const heading = element('div', 'provider-heading');
      const title = element('div');
      title.append(element('strong', null, provider.label), element('code', null, provider.id + ' \u00b7 ' + provider.adapter));
      const badges = element('div', 'provider-badges');
      badges.append(
        element('span', 'badge ' + (provider.local ? 'local' : 'cloud'), provider.local ? 'LOCAL' : 'REMOTE'),
        element('span', 'badge', provider.model)
      );
      heading.append(title, badges);

      const switches = element('div', 'switches');
      const enabledLabel = element('label', 'toggle');
      const enabled = element('input');
      enabled.type = 'checkbox';
      enabled.checked = provider.enabled;
      enabled.dataset.providerId = provider.id;
      enabled.dataset.kind = 'enabled';
      enabledLabel.append(enabled, element('span', null, 'AI enabled'));

      const visualLabel = element('label', 'toggle');
      const visualAccess = element('input');
      visualAccess.type = 'checkbox';
      visualAccess.checked = provider.visualStateAccess;
      visualAccess.dataset.providerId = provider.id;
      visualAccess.dataset.kind = 'visual';
      visualLabel.append(visualAccess, element('span', null, 'Can see browser state'));

      switches.append(enabledLabel, visualLabel);
      card.append(heading, switches);
      providers.append(card);
    });
  }

  function renderVisual() {
    visual.replaceChildren();
    if (!state.visualState) {
      visual.append(element('p', 'muted', 'No screen state yet.'));
      return;
    }
    const view = state.visualState;
    const grid = element('dl', 'visual-grid');
    [
      ['Fidelity', view.fidelity],
      ['Page', view.page.title],
      ['Address', view.page.address],
      ['Viewport', Math.round(view.viewport.width) + '\u00d7' + Math.round(view.viewport.height)],
      ['Theme', view.shell.theme],
      ['Visible semantic entries', view.visibleEntryCount],
      ['Digest', view.visualDigest]
    ].forEach(function (row) {
      const wrap = element('div');
      wrap.append(element('dt', null, row[0]), element('dd', null, row[1]));
      grid.append(wrap);
    });
    visual.append(grid);
  }

  function renderResearch() {
    researchEnabled.checked = state.researchModeEnabled;
    run.disabled = !state.researchModeEnabled || state.researchRunning;
    researchOutput.replaceChildren();
    if (!state.lastResearchRun) {
      researchOutput.append(element('p', 'muted', 'No Research Mode result in this session.'));
      return;
    }
    const result = state.lastResearchRun;
    const header = element('div', 'research-result-head');
    header.append(element('strong', null, result.status + ' \u00b7 ' + result.mode), element('span', 'muted', result.question));
    researchOutput.append(header);
    if (result.search && result.search.resultSet) {
      const search = element('section', 'result-section');
      search.append(element('h3', null, 'Search evidence'));
      result.search.resultSet.results.slice(0, 10).forEach(function (item) {
        const row = element('article', 'evidence-row');
        row.append(element('strong', null, item.title), element('code', null, item.url), element('p', null, item.snippet || ''));
        search.append(row);
      });
      researchOutput.append(search);
    }
    if (result.ai && Array.isArray(result.ai.outputs)) {
      const answers = element('section', 'result-section');
      answers.append(element('h3', null, 'AI panel'));
      result.ai.outputs.forEach(function (item) {
        const row = element('article', 'answer-row');
        row.append(element('strong', null, item.providerId + ' \u00b7 ' + item.status));
        if (item.output) row.append(element('p', null, item.output));
        else row.append(element('p', 'muted', (item.code || 'AI_PROVIDER_ERROR') + ': ' + (item.message || 'provider failed')));
        answers.append(row);
      });
      researchOutput.append(answers);
    }
  }

  function render() {
    mode.value = state.mode;
    renderProviders();
    renderVisual();
    renderResearch();
  }

  providers.addEventListener('change', function (event) {
    const input = event.target.closest('input[data-provider-id][data-kind]');
    if (!input) return;
    if (input.dataset.kind === 'enabled') action({ type: 'ai-provider-enabled', providerId: input.dataset.providerId, enabled: input.checked });
    else action({ type: 'ai-visual-access', providerId: input.dataset.providerId, enabled: input.checked });
  });
  mode.addEventListener('change', function () { action({ type: 'ai-mode', mode: mode.value }); });
  active.addEventListener('change', function () { if (active.value) action({ type: 'ai-active-provider', providerId: active.value }); });
  researchEnabled.addEventListener('change', function () { action({ type: 'research-mode-enabled', enabled: researchEnabled.checked }); });
  run.addEventListener('click', function () {
    action({ type: 'research-run', question: question.value, mode: researchMode.value });
  });
  question.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') action({ type: 'research-run', question: question.value, mode: researchMode.value });
  });
  byId('refresh').addEventListener('click', function () { getState().then(function () { setStatus('REFRESHED', 'ready'); }).catch(function (error) { setStatus(String(error && error.message || error), 'fail'); }); });

  getState().then(function () { setStatus('READY \u00b7 AI providers are individually gated', 'ready'); }).catch(function (error) { setStatus(String(error && error.message || error), 'fail'); });
}());`;

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function controllerHash() {
  return crypto.createHash('sha256').update(CONTROLLER_SOURCE, 'utf8').digest('base64');
}

function contentSecurityPolicy() {
  return "default-src 'none'; script-src 'sha256-" + controllerHash() + "'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'";
}

function securityHeaders() {
  return Object.assign({}, HostCore.securityHeaders(), { 'Content-Security-Policy': contentSecurityPolicy() });
}

function renderHtml() {
  const policy = contentSecurityPolicy();
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<meta http-equiv="Content-Security-Policy" content="' + escapeHtml(policy) + '">\n' +
    '<title>AXM Browser AI / Research Control</title>\n' +
    '<style>\n' +
    ':root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#050812;color:#f4f7ff;--surface:#0d1728;--card:#142842;--border:#2b4568;--accent:#72e1c2;--muted:#9fb1cc;--danger:#ffab7a}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at top,#17345d 0,#050812 54rem)}button,input,select,textarea{font:inherit;color:inherit;border:1px solid var(--border);background:#07101f}.shell{width:min(1180px,calc(100% - 20px));margin:10px auto 48px}.top,.panel{border:1px solid var(--border);border-radius:16px;background:var(--surface)}.top{padding:18px}.eyebrow{margin:0 0 7px;color:var(--accent);font-size:11px;font-weight:800;letter-spacing:.08em}.top h1{margin:0;font-size:clamp(26px,4vw,42px)}.top p{color:var(--muted);line-height:1.55}.status{display:block;margin-top:10px;color:var(--muted);font:700 10px/1.4 ui-monospace,monospace}.status[data-kind="ready"]{color:var(--accent)}.status[data-kind="fail"]{color:var(--danger)}.grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.7fr);gap:12px;margin-top:12px}.panel{padding:16px}.panel h2{margin:0 0 10px;font-size:16px}.controls{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}.control{display:grid;gap:4px}.control span{color:var(--muted);font-size:10px}.control select,.control input{padding:8px;border-radius:8px}.provider-list{display:grid;gap:8px}.provider-card{padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--card)}.provider-heading{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px}.provider-heading strong,.provider-heading code{display:block}.provider-heading code{margin-top:4px;color:var(--muted);font-size:10px}.provider-badges{display:flex;flex-wrap:wrap;gap:5px}.badge{padding:4px 7px;border:1px solid var(--border);border-radius:999px;color:var(--muted);font-size:9px}.badge.local{border-color:var(--accent);color:var(--accent)}.switches{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.toggle{display:flex;gap:7px;align-items:center;padding:7px 9px;border:1px solid var(--border);border-radius:9px;font-size:11px}.toggle input{accent-color:var(--accent)}.visual-grid{display:grid;gap:7px;margin:0}.visual-grid div{display:grid;grid-template-columns:130px 1fr;gap:8px}.visual-grid dt{color:var(--muted);font-size:10px;text-transform:uppercase}.visual-grid dd{margin:0;overflow-wrap:anywhere;font:11px/1.4 ui-monospace,monospace}.research{grid-column:1/-1}.research-controls{display:grid;grid-template-columns:auto auto 1fr auto;gap:8px;align-items:end}.research-controls textarea{min-height:84px;padding:9px;border-radius:9px;resize:vertical}.research-controls button,.controls button{padding:8px 11px;border-radius:9px;cursor:pointer}.research-output{display:grid;gap:10px;margin-top:12px}.research-result-head{display:grid;gap:3px;padding:10px;border-left:4px solid var(--accent);background:var(--card)}.muted{color:var(--muted)}.result-section{display:grid;gap:7px}.result-section h3{margin:6px 0 0;font-size:13px}.evidence-row,.answer-row{padding:11px;border:1px solid var(--border);border-radius:10px;background:var(--card)}.evidence-row code{display:block;margin-top:4px;color:var(--muted);font-size:10px;overflow-wrap:anywhere}.evidence-row p,.answer-row p{margin:8px 0 0;line-height:1.55;white-space:pre-wrap}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}@media(max-width:760px){.grid{grid-template-columns:1fr}.research-controls{grid-template-columns:1fr}.visual-grid div{grid-template-columns:1fr;gap:2px}}\n' +
    '</style></head><body><main class="shell">\n' +
    '<header class="top"><p class="eyebrow">AXM BROWSER / AI + RESEARCH CONTROL</p><h1>Swappable AI, visible authority.</h1><p>Each provider has its own on/off and browser-state permission. Research Mode is a separate opt-in. This console shares the Browser Session but cannot navigate pages, run page code, install, promote, or canonize anything.</p><output id="status" class="status" aria-live="polite">CONNECTING\u2026</output></header>\n' +
    '<div class="grid"><section class="panel"><h2>AI providers</h2><div class="controls"><label class="control"><span>AI mode</span><select id="ai-mode"><option value="single">Single</option><option value="panel">Panel</option></select></label><label class="control"><span>Active AI</span><select id="active-provider"></select></label><button id="refresh" type="button">Refresh state</button></div><div id="providers" class="provider-list"></div></section>\n' +
    '<aside class="panel"><h2>Browser visual state</h2><div id="visual-state"></div></aside>\n' +
    '<section class="panel research"><h2>Research Mode</h2><div class="research-controls"><label class="toggle"><input id="research-enabled" type="checkbox"><span>Research enabled</span></label><label class="control"><span>Mode</span><select id="research-run-mode"><option value="search+ai">Search + AI</option><option value="search-only">Search only</option><option value="ai-only">AI only</option></select></label><label class="control"><span>Question</span><textarea id="research-question" maxlength="4000" placeholder="Research a topic using the enabled providers and current browser state\u2026"></textarea></label><button id="research-run" type="button">Run research</button></div><div id="research-output" class="research-output"></div></section></div>\n' +
    '</main><script>' + CONTROLLER_SOURCE + '</script></body></html>\n';
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
  response.writeHead(statusCode, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  }, securityHeaders()));
  response.end(body);
}

function sendHtml(response, html) {
  response.writeHead(200, Object.assign({
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html)
  }, securityHeaders()));
  response.end(html);
}

function readJson(request, maxBytes) {
  return new Promise(function (resolve, reject) {
    const declared = Number(request.headers['content-length']);
    if (Number.isFinite(declared) && declared > maxBytes) {
      reject(Object.assign(new Error('control action exceeds the configured byte bound'), { code: 'CONTROL_ACTION_BYTES_LIMIT' }));
      request.resume();
      return;
    }
    const chunks = [];
    let length = 0;
    request.on('data', function (chunk) {
      length += chunk.length;
      if (length > maxBytes) {
        reject(Object.assign(new Error('control action exceeds the configured byte bound'), { code: 'CONTROL_ACTION_BYTES_LIMIT' }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', function () {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (_error) { reject(Object.assign(new Error('control action must contain valid JSON'), { code: 'CONTROL_INVALID_JSON' })); }
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

async function createBrowserAiControlHost(session, controlPlane, options) {
  options = options || {};
  if (!session || typeof session.snapshot !== 'function') throw new TypeError('a LocalBrowserSession is required');
  if (!controlPlane || typeof controlPlane.state !== 'function' || typeof controlPlane.apply !== 'function') throw new TypeError('a LocalBrowserAiControl plane is required');
  const port = options.port == null ? 0 : Number(options.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new TypeError('port must be an integer from 0 to 65535');
  const maxControlBytes = Number.isInteger(options.maxControlBytes) && options.maxControlBytes > 0 ? options.maxControlBytes : DEFAULT_MAX_CONTROL_BYTES;
  const token = crypto.randomBytes(24).toString('base64url');
  const basePath = '/ai/' + token + '/';
  const html = renderHtml();
  let expectedOrigin = null;

  const server = http.createServer(async function (request, response) {
    try {
      const host = String(request.headers.host || '');
      if (!expectedOrigin || host !== expectedOrigin.slice('http://'.length)) {
        sendJson(response, 421, errorEnvelope(Object.assign(new Error('host header is outside the AI control origin'), { code: 'CONTROL_HOST_REFUSED' })));
        return;
      }
      const requestUrl = new URL(request.url, expectedOrigin);
      if (!requestUrl.pathname.startsWith(basePath)) {
        sendJson(response, 404, errorEnvelope(Object.assign(new Error('route not found'), { code: 'CONTROL_ROUTE_NOT_FOUND' })));
        return;
      }
      const route = requestUrl.pathname.slice(basePath.length);
      if (request.method === 'GET' && route === '') {
        sendHtml(response, html);
        return;
      }
      if (request.method === 'GET' && route === 'state') {
        sendJson(response, 200, controlPlane.state(session.snapshot()));
        return;
      }
      if (request.method === 'POST' && route === 'action') {
        const origin = String(request.headers.origin || '');
        if (!origin) {
          sendJson(response, 403, errorEnvelope(Object.assign(new Error('control mutations require the exact loopback Origin header'), { code: 'CONTROL_ORIGIN_REQUIRED' })));
          return;
        }
        if (origin !== expectedOrigin) {
          sendJson(response, 403, errorEnvelope(Object.assign(new Error('cross-origin control mutation refused'), { code: 'CONTROL_ORIGIN_REFUSED' })));
          return;
        }
        if (!/^application\/json(?:\s*;|$)/i.test(String(request.headers['content-type'] || ''))) {
          sendJson(response, 415, errorEnvelope(Object.assign(new Error('control mutations require application/json'), { code: 'CONTROL_CONTENT_TYPE_REFUSED' })));
          return;
        }
        const action = await readJson(request, maxControlBytes);
        sendJson(response, 200, await controlPlane.apply(action, session.snapshot()));
        return;
      }
      sendJson(response, 405, errorEnvelope(Object.assign(new Error('method or route not allowed'), { code: 'CONTROL_METHOD_REFUSED' })));
    } catch (error) {
      const status = ['CONTROL_ACTION_BYTES_LIMIT', 'CONTROL_INVALID_JSON'].includes(error.code) ? 400 : 422;
      if (!response.headersSent) sendJson(response, status, errorEnvelope(error));
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
  const receiptMaterial = {
    schema: CONTROL_HOST_RECEIPT_SCHEMA,
    status: 'EXPERIMENTAL',
    origin: expectedOrigin,
    controlUrl: expectedOrigin + basePath,
    sessionId: session.snapshot().sessionId,
    registryDigest: controlPlane.registry.registryDigest,
    loopbackTransportUsed: true,
    externalNetworkUsedByControlHost: false,
    pageScriptExecuted: false,
    controllerCspHash: 'sha256-' + controllerHash(),
    maxControlBytes,
    authority: {
      browserNavigationGranted: false,
      providerExecutionGranted: false,
      searchExecutionGranted: false,
      installAllowed: false,
      promotionAllowed: false,
      canonAllowed: false
    }
  };
  const receipt = Object.assign({}, receiptMaterial, { receiptDigest: Digest.canonicalDigest(receiptMaterial) });
  return { server, receipt, close: function () { return close(server); } };
}

module.exports = {
  CONTROL_HOST_RECEIPT_SCHEMA,
  DEFAULT_MAX_CONTROL_BYTES,
  CONTROLLER_SOURCE,
  controllerHash,
  contentSecurityPolicy,
  securityHeaders,
  renderHtml,
  createBrowserAiControlHost
};
