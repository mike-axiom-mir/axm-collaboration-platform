'use strict';

const crypto = require('node:crypto');
const http = require('node:http');
const Canonical = require('./canonical-json');
const Digest = require('./digest');
const HostCore = require('./local-browser-host-core');
const ShellPolicy = require('./shell-policy');
const BrowserAiControl = require('./browser-ai-control');
const BrowserAiControlHost = require('./browser-ai-control-host');
const BrowserAiChat = require('./browser-ai-chat');
const BrowserAiChatHost = require('./browser-ai-chat-host');
const HtmlLiveBuilderHost = require('./html-live-builder-host');
const ReferenceLabModule = require('./reference-lab');
const ReferenceLabHost = require('./reference-lab-host');
const ExposureLabHost = require('./exposure-lab-host');

const HOST_RECEIPT_SCHEMA = 'axm.web.local-browser-host-receipt/v2';

const CHAT_SHELL_CONTROLLER_SOURCE = `(function () {
  'use strict';
  const toggle = document.getElementById('ai-chat-toggle');
  const drawer = document.getElementById('ai-chat-drawer');
  const close = document.getElementById('ai-chat-collapse');
  const popout = document.getElementById('ai-chat-popout');
  const frame = document.getElementById('ai-chat-frame');
  if (!toggle || !drawer || !close || !popout || !frame) return;

  function setOpen(open) {
    drawer.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.textContent = open ? 'AI \\u2193' : 'AI Chat';
  }

  toggle.addEventListener('click', function () {
    setOpen(!drawer.classList.contains('open'));
  });
  close.addEventListener('click', function () { setOpen(false); });
  popout.addEventListener('click', function () {
    window.open(frame.src, 'axm-ai-chat', 'popup=yes,width=460,height=720,resizable=yes,scrollbars=yes');
  });
  document.addEventListener('keydown', function (event) {
    const active = document.activeElement;
    const typing = active && ['INPUT', 'SELECT', 'TEXTAREA'].includes(active.tagName);
    if (event.altKey && !typing && String(event.key || '').toLowerCase() === 'a') {
      event.preventDefault();
      setOpen(!drawer.classList.contains('open'));
    }
    if (event.key === 'Escape' && drawer.classList.contains('open') && !typing) setOpen(false);
  });
  setOpen(false);
}());`;

const CHAT_SHELL_CSS = `
.ai-chat-toggle{position:fixed;right:18px;bottom:18px;z-index:40;padding:10px 14px;border:1px solid var(--accent);border-radius:999px;background:var(--surface-strong);color:var(--accent);box-shadow:var(--shadow);font:800 11px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;cursor:pointer}
.ai-chat-toggle:focus-visible,.ai-chat-drawer button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.ai-chat-drawer{position:fixed;right:18px;bottom:62px;z-index:39;width:min(430px,calc(100vw - 24px));height:min(680px,calc(100vh - 92px));display:grid;grid-template-rows:auto minmax(0,1fr);border:1px solid var(--border);border-radius:16px;background:var(--surface-strong);box-shadow:0 25px 75px rgba(0,0,0,.5);overflow:hidden;transform:translateY(calc(100% + 90px));opacity:0;pointer-events:none;transition:transform .18s ease,opacity .18s ease}
.ai-chat-drawer.open{transform:translateY(0);opacity:1;pointer-events:auto}
.ai-chat-drawer-head{display:flex;align-items:center;gap:7px;padding:8px 9px;border-bottom:1px solid var(--border);background:var(--surface)}
.ai-chat-drawer-head strong{flex:1;color:var(--accent);font-size:12px}.ai-chat-drawer-head span{color:var(--muted);font-size:9px}
.ai-chat-drawer-head button{padding:6px 8px;border-radius:8px;background:var(--control);font-size:10px;cursor:pointer}
.ai-chat-frame{width:100%;height:100%;border:0;background:#050812}
@media(max-width:620px){.ai-chat-toggle{right:10px;bottom:10px}.ai-chat-drawer{right:5px;bottom:52px;width:calc(100vw - 10px);height:min(72vh,720px);border-radius:14px}}
@media(prefers-reduced-motion:reduce){.ai-chat-drawer{transition:none}}
`;

function currentSourceText(session) {
  const snapshot = session.snapshot();
  const pageId = snapshot.state.current.pageId;
  const record = Array.isArray(session.records)
    ? session.records.find(function (candidate) { return candidate.pageId === pageId; })
    : null;
  return record && Buffer.isBuffer(record.bytes) ? record.bytes.toString('utf8') : '<!doctype html>\n<html><head><title>AXM Builder Draft</title></head><body><main><h1>AXM Builder Draft</h1><p>Start editing.</p></main></body></html>\n';
}

function cleanChatUrl(value) {
  let url;
  try { url = new URL(String(value || '')); }
  catch (_error) { throw new TypeError('chatUrl must be an absolute loopback URL'); }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.hash) {
    throw new TypeError('chatUrl must use an exact loopback HTTP origin');
  }
  if (!/^\/chat\/[A-Za-z0-9_-]+\/$/.test(url.pathname)) throw new TypeError('chatUrl must use the bounded AXM chat capability path');
  return url;
}

function combinedShellControllerSource() {
  return HostCore.CONTROLLER_SOURCE + '\n' + CHAT_SHELL_CONTROLLER_SOURCE;
}

function chatShellControllerHash() {
  return crypto.createHash('sha256').update(combinedShellControllerSource(), 'utf8').digest('base64');
}

function chatShellContentSecurityPolicy(chatUrl) {
  const chat = cleanChatUrl(chatUrl);
  return "default-src 'none'; script-src 'sha256-" + chatShellControllerHash() + "'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src " + chat.origin + "; frame-ancestors 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'";
}

function chatMarkup(chatUrl) {
  const chat = cleanChatUrl(chatUrl);
  const safe = HostCore.escapeHtml(chat.toString());
  return '<button id="ai-chat-toggle" class="ai-chat-toggle" type="button" aria-expanded="false" aria-controls="ai-chat-drawer">AI Chat</button>\n' +
    '<aside id="ai-chat-drawer" class="ai-chat-drawer" aria-label="AXM AI chat" aria-hidden="true">' +
    '<header class="ai-chat-drawer-head"><strong>Browser AI Chat</strong><span>Alt+A</span><button id="ai-chat-popout" type="button">Pop out</button><button id="ai-chat-collapse" type="button" aria-label="Collapse AI chat">Down</button></header>' +
    '<iframe id="ai-chat-frame" class="ai-chat-frame" src="' + safe + '" title="AXM browser AI chat" loading="lazy" sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer"></iframe>' +
    '</aside>';
}

function renderChatShellHtml(chatUrl) {
  const policy = chatShellContentSecurityPolicy(chatUrl);
  let html = HostCore.renderShellHtml();
  const baseScript = '<script>' + HostCore.CONTROLLER_SOURCE + '</script>';
  if (!html.includes(baseScript)) throw new Error('AXM base shell controller seam changed; chat drawer injection refused');
  html = html.replace(baseScript, '<script>' + combinedShellControllerSource() + '</script>');
  const styleSeam = '</style>\n</head>';
  if (!html.includes(styleSeam)) throw new Error('AXM base shell style seam changed; chat drawer injection refused');
  html = html.replace(styleSeam, CHAT_SHELL_CSS + '\n</style>\n</head>');
  const bodySeam = '</main>\n<script>';
  if (!html.includes(bodySeam)) throw new Error('AXM base shell body seam changed; chat drawer injection refused');
  html = html.replace(bodySeam, '</main>\n' + chatMarkup(chatUrl) + '\n<script>');
  html = html.replace(
    /<meta http-equiv="Content-Security-Policy" content="[^"]*">/,
    '<meta http-equiv="Content-Security-Policy" content="' + HostCore.escapeHtml(policy) + '">'
  );
  html = html.replace(
    '<span class="badge held">EXTERNAL NETWORK HELD</span>',
    '<span class="badge held">EXTERNAL PAGE NETWORK HELD</span><span class="badge">AI CHAT LOOPBACK</span>'
  );
  return html;
}

function sendJson(response, statusCode, value) {
  const body = Canonical.stringify(value) + '\n';
  response.writeHead(statusCode, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  }, HostCore.securityHeaders()));
  response.end(body);
}

function sendHtml(response, html, policy) {
  response.writeHead(200, Object.assign({
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Content-Security-Policy': policy
  }, HostCore.securityHeaders()));
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
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (_error) { reject(Object.assign(new Error('action request must contain valid JSON'), { code: 'HOST_INVALID_JSON' })); }
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

async function createChatShellHost(session, options, chatUrlProvider) {
  options = options || {};
  if (!session || typeof session.snapshot !== 'function' || typeof session.apply !== 'function') throw new TypeError('a LocalBrowserSession is required');
  const port = options.port == null ? 0 : Number(options.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new TypeError('port must be an integer from 0 to 65535');
  const maxActionBytes = Number.isInteger(options.maxActionBytes) && options.maxActionBytes > 0 ? options.maxActionBytes : HostCore.DEFAULT_MAX_ACTION_BYTES;
  const token = crypto.randomBytes(24).toString('base64url');
  const basePath = '/s/' + token + '/';
  let expectedOrigin = null;

  const server = http.createServer(async function (request, response) {
    try {
      const host = String(request.headers.host || '');
      if (!expectedOrigin || host !== expectedOrigin.slice('http://'.length)) {
        sendJson(response, 421, HostCore.errorEnvelope(Object.assign(new Error('host header is outside the loopback shell origin'), { code: 'HOST_HEADER_REFUSED' })));
        return;
      }
      const requestUrl = new URL(request.url, expectedOrigin);
      if (!requestUrl.pathname.startsWith(basePath)) {
        sendJson(response, 404, HostCore.errorEnvelope(Object.assign(new Error('route not found'), { code: 'HOST_ROUTE_NOT_FOUND' })));
        return;
      }
      const route = requestUrl.pathname.slice(basePath.length);
      if (request.method === 'GET' && route === '') {
        const chatUrl = typeof chatUrlProvider === 'function' ? chatUrlProvider() : null;
        if (!chatUrl) {
          sendJson(response, 503, HostCore.errorEnvelope(Object.assign(new Error('AI chat companion is not ready'), { code: 'AI_CHAT_NOT_READY' })));
          return;
        }
        sendHtml(response, renderChatShellHtml(chatUrl), chatShellContentSecurityPolicy(chatUrl));
        return;
      }
      if (request.method === 'GET' && route === 'state') {
        sendJson(response, 200, session.snapshot());
        return;
      }
      if (request.method === 'POST' && route === 'action') {
        const origin = String(request.headers.origin || '');
        if (!origin) {
          sendJson(response, 403, HostCore.errorEnvelope(Object.assign(new Error('session actions require the exact loopback shell Origin header'), { code: 'HOST_ORIGIN_REQUIRED' })));
          return;
        }
        if (origin !== expectedOrigin) {
          sendJson(response, 403, HostCore.errorEnvelope(Object.assign(new Error('cross-origin session action refused'), { code: 'HOST_ORIGIN_REFUSED' })));
          return;
        }
        if (!/^application\/json(?:\s*;|$)/i.test(String(request.headers['content-type'] || ''))) {
          sendJson(response, 415, HostCore.errorEnvelope(Object.assign(new Error('session actions require application/json'), { code: 'HOST_CONTENT_TYPE_REFUSED' })));
          return;
        }
        const action = await readAction(request, maxActionBytes);
        sendJson(response, 200, session.apply(action));
        return;
      }
      sendJson(response, 405, HostCore.errorEnvelope(Object.assign(new Error('method or route not allowed'), { code: 'HOST_METHOD_REFUSED' })));
    } catch (error) {
      const status = ['HOST_ACTION_BYTES_LIMIT', 'HOST_INVALID_JSON'].includes(error.code) ? 400 : 422;
      if (!response.headersSent) sendJson(response, status, HostCore.errorEnvelope(error));
      else response.destroy();
    }
  });
  server.on('clientError', function (_error, socket) { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 1000;
  server.maxHeadersCount = 32;
  await listen(server, port);
  const addressInfo = server.address();
  expectedOrigin = 'http://127.0.0.1:' + addressInfo.port;
  const snapshot = session.snapshot();
  const receiptMaterial = {
    schema: HostCore.HOST_RECEIPT_SCHEMA,
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
  return { server, receipt, close: function () { return close(server); } };
}

async function createLocalBrowserHost(session, options) {
  options = options || {};
  const aiControl = options.aiControlPlane || new BrowserAiControl.LocalBrowserAiControl({
    aiRegistry: options.aiRegistry,
    researchRunner: options.researchRunner,
    researchConfig: options.researchConfig
  });
  const aiConfigured = Boolean(options.aiRegistry || options.aiControlPlane || options.researchRunner || options.researchConfig || options.aiChatConfig);
  const shouldStartAiChat = options.aiChat === true || (options.aiChat !== false && aiConfigured);

  let host = null;
  let aiChat = null;
  let aiChatHost = null;

  try {
    if (shouldStartAiChat) {
      host = await createChatShellHost(session, options, function () { return aiChatHost ? aiChatHost.receipt.chatUrl : null; });
      const chatConfig = options.aiChatConfig || {};
      const researchConfig = options.researchConfig || {};
      aiChat = new BrowserAiChat.LocalBrowserAiChat({
        aiRegistry: aiControl.registry,
        aiRegistryProvider: function () { return aiControl.registry; },
        visualStateProvider: function () { return aiControl.ensureVisualState(session.snapshot()); },
        aiNetworkAuthority: chatConfig.aiNetworkAuthority || researchConfig.aiNetworkAuthority,
        aiOptions: chatConfig.aiOptions || researchConfig.aiOptions || {},
        maxOutputTokens: chatConfig.maxOutputTokens
      });
      aiChatHost = await BrowserAiChatHost.createBrowserAiChatHost(session, aiChat, {
        parentOrigin: host.receipt.origin,
        port: chatConfig.port,
        maxActionBytes: chatConfig.maxActionBytes
      });
    } else {
      host = await HostCore.createLocalBrowserHost(session, options);
    }
  } catch (error) {
    if (aiChatHost) await aiChatHost.close().catch(function () {});
    if (host) await host.close().catch(function () {});
    throw error;
  }

  const shellPolicy = shouldStartAiChat
    ? ShellPolicy.buildShellPolicy({
      controllerHash: chatShellControllerHash(),
      contentSecurityPolicy: chatShellContentSecurityPolicy(aiChatHost.receipt.chatUrl)
    })
    : ShellPolicy.buildShellPolicy();

  const shouldStartAiControlHost = options.aiControlHost === true || (
    options.aiControlHost !== false && Boolean(options.aiRegistry || options.aiControlPlane || options.researchRunner || options.researchConfig)
  );
  const shouldStartBuilderHost = options.builderEnabled === true;
  const shouldStartReferenceLab = options.referenceLab === true || Boolean(options.referenceConfig || options.referenceLabInstance);
  const shouldStartExposureLab = options.exposureLab === true || Boolean(options.exposureConfig);
  let aiControlHost = null;
  let builderHost = null;
  let referenceLab = null;
  let referenceHost = null;
  let exposureHost = null;

  try {
    if (shouldStartAiControlHost) {
      aiControlHost = await BrowserAiControlHost.createBrowserAiControlHost(
        session,
        aiControl,
        options.aiControlHostOptions || {}
      );
    }
    if (shouldStartBuilderHost) {
      builderHost = await HtmlLiveBuilderHost.createHtmlLiveBuilderHost(
        options.builderInitialSource == null ? currentSourceText(session) : String(options.builderInitialSource),
        options.builderHostOptions || {}
      );
    }
    if (shouldStartReferenceLab) {
      const config = options.referenceConfig || {};
      referenceLab = options.referenceLabInstance || new ReferenceLabModule.ReferenceLab({
        aiRegistry: aiControl.registry,
        aiRegistryProvider: function () { return aiControl.registry; },
        visualStateProvider: function () { return aiControl.ensureVisualState(session.snapshot()); },
        searchConfig: config.searchConfig || (options.researchConfig && options.researchConfig.searchConfig) || {},
        imageSearchConfig: config.imageSearchConfig || config.searchConfig || (options.researchConfig && options.researchConfig.searchConfig) || {},
        aiNetworkAuthority: config.aiNetworkAuthority,
        searchNetworkAuthority: config.searchNetworkAuthority,
        aiOptions: config.aiOptions || {},
        searchOptions: config.searchOptions || {},
        imageSearchOptions: config.imageSearchOptions || {}
      });
      referenceHost = await ReferenceLabHost.createReferenceLabHost(referenceLab, {
        port: config.port,
        maxJsonBytes: config.maxJsonBytes,
        maxUploadBytes: config.maxUploadBytes
      });
    }
    if (shouldStartExposureLab) {
      const config = options.exposureConfig || {};
      exposureHost = await ExposureLabHost.createExposureLabHost({
        port: config.port,
        maxJsonBytes: config.maxJsonBytes,
        searchConfig: config.searchConfig || {},
        networkAuthority: config.networkAuthority,
        executorOptions: config.executorOptions || {},
        visualStateProvider: function () { return aiControl.ensureVisualState(session.snapshot()); }
      });
    }
  } catch (error) {
    if (exposureHost) await exposureHost.close().catch(function () {});
    if (referenceHost) await referenceHost.close().catch(function () {});
    if (builderHost) await builderHost.close().catch(function () {});
    if (aiControlHost) await aiControlHost.close().catch(function () {});
    if (aiChatHost) await aiChatHost.close().catch(function () {});
    await host.close().catch(function () {});
    throw error;
  }

  const receiptMaterial = Object.assign({}, host.receipt, {
    schema: HOST_RECEIPT_SCHEMA,
    shellPolicySchema: shellPolicy.schema,
    shellPolicyDigest: shellPolicy.policyDigest
  });
  delete receiptMaterial.receiptDigest;
  const receipt = Object.assign({}, receiptMaterial, {
    receiptDigest: Digest.canonicalDigest(receiptMaterial)
  });

  return {
    server: host.server,
    receipt,
    shellPolicy,
    aiControl,
    aiChat,
    aiChatHost,
    aiChatReceipt: aiChatHost ? aiChatHost.receipt : null,
    aiChatUrl: aiChatHost ? aiChatHost.receipt.chatUrl : null,
    aiControlReceipt: aiControlHost ? aiControlHost.receipt : null,
    aiControlUrl: aiControlHost ? aiControlHost.receipt.controlUrl : null,
    builderReceipt: builderHost ? builderHost.receipt : null,
    builderUrl: builderHost ? builderHost.receipt.builderUrl : null,
    referenceLab,
    referenceLabHost: referenceHost,
    referenceLabUrl: referenceHost ? referenceHost.url : null,
    referenceLabReceipt: referenceHost ? referenceHost.receipt : null,
    exposureLabHost: exposureHost,
    exposureLabUrl: exposureHost ? exposureHost.url : null,
    exposureLabReceipt: exposureHost ? exposureHost.receipt : null,
    controlState: function () { return aiControl.state(session.snapshot()); },
    visualState: function () { return aiControl.ensureVisualState(session.snapshot()); },
    chatState: function () { return aiChat ? aiChat.state() : null; },
    close: async function () {
      if (exposureHost) await exposureHost.close();
      if (referenceHost) await referenceHost.close();
      if (builderHost) await builderHost.close();
      if (aiControlHost) await aiControlHost.close();
      if (aiChatHost) await aiChatHost.close();
      await host.close();
    }
  };
}

module.exports = Object.assign({}, HostCore, {
  HOST_RECEIPT_SCHEMA,
  CHAT_SHELL_CONTROLLER_SOURCE,
  CHAT_SHELL_CSS,
  currentSourceText,
  chatShellControllerHash,
  chatShellContentSecurityPolicy,
  renderChatShellHtml,
  createChatShellHost,
  createLocalBrowserHost
});
