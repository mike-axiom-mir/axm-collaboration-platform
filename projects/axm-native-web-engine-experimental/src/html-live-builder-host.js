'use strict';

const crypto = require('node:crypto');
const http = require('node:http');
const Digest = require('./digest');
const Builder = require('./html-live-builder');

const HTML_BUILDER_HOST_RECEIPT_SCHEMA = 'axm.web.html-builder-host-receipt/v1';
const DEFAULT_MAX_REQUEST_BYTES = 384 * 1024;

const BUILDER_CONTROLLER_SOURCE = `(function () {
  'use strict';
  const root = document.getElementById('axm-builder');
  const source = document.getElementById('source');
  const preview = document.getElementById('preview');
  const status = document.getElementById('status');
  const sourceMeta = document.getElementById('source-meta');
  const compileMeta = document.getElementById('compile-meta');
  const warnings = document.getElementById('warnings');
  const width = document.getElementById('viewport-width');
  const height = document.getElementById('viewport-height');
  const compileButton = document.getElementById('compile-now');
  const resetButton = document.getElementById('reset-draft');
  let initialSource = '';
  let timer = null;
  let sequence = 0;
  let activeSequence = 0;

  function setStatus(text, kind) {
    status.textContent = text;
    status.dataset.kind = kind || 'info';
  }

  function renderWarnings(items) {
    warnings.replaceChildren();
    if (!items || !items.length) {
      const item = document.createElement('li');
      item.textContent = 'No parser warnings.';
      warnings.append(item);
      return;
    }
    items.slice(0, 24).forEach(function (warning) {
      const item = document.createElement('li');
      const code = document.createElement('code');
      code.textContent = warning.code;
      const message = document.createElement('span');
      message.textContent = warning.message;
      item.append(code, message);
      warnings.append(item);
    });
  }

  function applyPreview(result) {
    preview.srcdoc = result.preview.html;
    sourceMeta.textContent = result.source.bytes + ' bytes · ' + result.source.sha256.slice(0, 16) + '…';
    compileMeta.textContent = result.page.entryCount + ' entries · ' + result.warningCount + ' warnings · ' + result.previewDigest.slice(0, 16) + '…';
    renderWarnings(result.warnings);
    setStatus(result.status === 'PASS' ? 'LIVE · compiled' : 'LIVE · compiled with warnings', result.status === 'PASS' ? 'pass' : 'warn');
  }

  async function compileDraft() {
    const currentSequence = ++sequence;
    activeSequence = currentSequence;
    setStatus('COMPILING…', 'busy');
    const payload = {
      source: source.value,
      viewport: {
        width: Math.max(240, Math.min(3840, Number(width.value) || 1120)),
        height: Math.max(180, Math.min(2160, Number(height.value) || 760))
      }
    };
    try {
      const response = await fetch('compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
        credentials: 'omit'
      });
      const body = await response.json();
      if (currentSequence !== activeSequence) return;
      if (!response.ok) throw new Error((body.code || 'BUILDER_COMPILE_FAILED') + ': ' + (body.message || 'compile failed'));
      applyPreview(body.preview);
    } catch (error) {
      if (currentSequence !== activeSequence) return;
      setStatus(String(error && error.message || error), 'fail');
    }
  }

  function scheduleCompile() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(compileDraft, 180);
  }

  source.addEventListener('input', scheduleCompile);
  width.addEventListener('change', scheduleCompile);
  height.addEventListener('change', scheduleCompile);
  compileButton.addEventListener('click', function () {
    if (timer) clearTimeout(timer);
    compileDraft();
  });
  resetButton.addEventListener('click', function () {
    source.value = initialSource;
    scheduleCompile();
    source.focus();
  });
  source.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      if (timer) clearTimeout(timer);
      compileDraft();
    }
  });

  fetch('state', { cache: 'no-store', credentials: 'omit' })
    .then(function (response) { if (!response.ok) throw new Error('builder state failed: ' + response.status); return response.json(); })
    .then(function (body) {
      initialSource = body.source;
      source.value = body.source;
      width.value = String(body.preview.viewport.width);
      height.value = String(body.preview.viewport.height);
      applyPreview(body.preview);
      root.dataset.ready = 'true';
    })
    .catch(function (error) { setStatus(String(error && error.message || error), 'fail'); });
}());`;

function controllerHash() {
  return crypto.createHash('sha256').update(BUILDER_CONTROLLER_SOURCE, 'utf8').digest('base64');
}

function contentSecurityPolicy() {
  return "default-src 'none'; script-src 'sha256-" + controllerHash() + "'; style-src 'unsafe-inline'; connect-src 'self'; frame-src 'self'; img-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderBuilderHtml() {
  const policy = contentSecurityPolicy();
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<meta http-equiv="Content-Security-Policy" content="' + escapeHtml(policy) + '">\n' +
    '<title>AXM HTML Live Builder — EXPERIMENTAL</title>\n' +
    '<style>\n' +
    ':root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#050812;color:#f4f7ff;--panel:#0d1728;--card:#111f35;--border:#294264;--accent:#72e1c2;--muted:#9fb1cc;--warn:#f3bd63;--danger:#ff9d7a}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#17345d 0,#050812 54rem);min-height:100vh}.shell{width:min(1700px,calc(100% - 18px));margin:9px auto 36px}.top{display:flex;flex-wrap:wrap;gap:9px;align-items:center;padding:12px 14px;border:1px solid var(--border);border-radius:14px;background:var(--panel)}.badge{padding:5px 8px;border:1px solid var(--accent);border-radius:999px;color:var(--accent);font:800 10px/1.2 ui-monospace,monospace}.badge.held{border-color:var(--warn);color:var(--warn)}.top p{flex:1 1 420px;margin:0;color:var(--muted);font-size:12px;line-height:1.45}.status{font:800 10px/1.3 ui-monospace,monospace;color:var(--muted)}.status[data-kind="pass"]{color:var(--accent)}.status[data-kind="warn"]{color:var(--warn)}.status[data-kind="fail"]{color:var(--danger)}.workspace{display:grid;grid-template-columns:minmax(320px,.9fr) minmax(0,1.4fr);gap:10px;margin-top:10px}.panel{min-width:0;border:1px solid var(--border);border-radius:16px;background:var(--panel);overflow:hidden}.panel-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--border);background:#09111f}.panel-head h1,.panel-head h2{margin:0;font-size:14px}.meta{color:var(--muted);font:10px/1.3 ui-monospace,monospace}.editor-tools{display:flex;flex-wrap:wrap;gap:7px;align-items:center}.editor-tools label{display:flex;gap:5px;align-items:center;color:var(--muted);font-size:10px}.editor-tools input{width:76px;padding:6px;border:1px solid var(--border);border-radius:7px;background:#070d18;color:#f4f7ff}.editor-tools button{padding:7px 9px;border:1px solid var(--border);border-radius:8px;background:#142842;color:#f4f7ff;cursor:pointer}.editor-tools button:hover,.editor-tools button:focus-visible,.editor-tools input:focus-visible,textarea:focus-visible{border-color:var(--accent);outline:2px solid var(--accent);outline-offset:1px}textarea{display:block;width:100%;min-height:620px;resize:vertical;padding:15px;border:0;outline:0;background:#050914;color:#e9f2ff;font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;tab-size:2}.preview-wrap{padding:8px;background:#070d18}.preview-wrap iframe{display:block;width:100%;min-height:650px;border:1px solid var(--border);border-radius:11px;background:#030711}.diagnostics{padding:12px;border-top:1px solid var(--border)}.diagnostics h3{margin:0 0 8px;font-size:12px}.warnings{display:grid;gap:5px;margin:0;padding:0;list-style:none}.warnings li{display:flex;gap:8px;align-items:flex-start;padding:7px 8px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--muted);font-size:11px}.warnings code{color:var(--warn);font-size:10px}.foot{margin:10px 2px 0;color:var(--muted);font-size:11px;line-height:1.45}@media(max-width:900px){.workspace{grid-template-columns:1fr}textarea{min-height:430px}.preview-wrap iframe{min-height:560px}}@media(max-width:520px){.shell{width:min(100% - 8px,1700px);margin-top:4px}.top,.panel-head{border-radius:10px}.editor-tools{width:100%}.editor-tools label{flex:1 1 115px}.editor-tools input{width:100%}textarea{font-size:12px;padding:11px}.preview-wrap{padding:4px}}\n' +
    '</style>\n</head>\n<body>\n<main class="shell" id="axm-builder" data-ready="false">\n' +
    '<section class="top"><span class="badge">EXPERIMENTAL BUILDER</span><span class="badge">IN-MEMORY DRAFT</span><span class="badge held">PAGE JS INERT</span><span class="badge held">EXTERNAL RESOURCES HELD</span><p>Type HTML and the AXM parser → Page Model → Structure Index → layout/display pipeline recompiles it into a sandboxed inert preview. This workspace does not write the source file or mutate Browser Session history.</p><span class="status" id="status" aria-live="polite">STARTING…</span></section>\n' +
    '<section class="workspace">\n' +
      '<article class="panel"><header class="panel-head"><div><h1>HTML draft</h1><div class="meta" id="source-meta">loading…</div></div><div class="editor-tools"><label>W <input id="viewport-width" inputmode="numeric" value="1120"></label><label>H <input id="viewport-height" inputmode="numeric" value="760"></label><button id="compile-now" type="button">Compile now</button><button id="reset-draft" type="button">Reset</button></div></header><textarea id="source" spellcheck="false" aria-label="HTML source editor"></textarea><section class="diagnostics"><h3>Compiler diagnostics</h3><ul class="warnings" id="warnings"><li>Loading compiler state…</li></ul></section></article>\n' +
      '<article class="panel"><header class="panel-head"><div><h2>Live AXM preview</h2><div class="meta" id="compile-meta">loading…</div></div><span class="badge">SANDBOXED</span></header><div class="preview-wrap"><iframe id="preview" sandbox="" title="Live inert AXM HTML preview"></iframe></div></article>\n' +
    '</section><p class="foot">Typing recompiles after a 180 ms debounce. Ctrl/Cmd + Enter compiles immediately. The preview is generated from AXM’s trusted renderer; source scripts/forms/remote resources are not executed.</p>\n' +
    '</main>\n<script>' + BUILDER_CONTROLLER_SOURCE + '</script>\n</body>\n</html>\n';
}

function readBody(req, maxBytes) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let total = 0;
    req.on('data', function (chunk) {
      total += chunk.length;
      if (total > maxBytes) {
        reject(Object.assign(new Error('builder request exceeds byte limit'), { code: 'BUILDER_REQUEST_BYTES_LIMIT' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', function () { resolve(Buffer.concat(chunks, total)); });
    req.on('error', reject);
  });
}

function jsonResponse(res, status, body, headers) {
  const text = JSON.stringify(body);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin'
  }, headers || {}));
  res.end(text);
}

function safeError(error) {
  return {
    schema: 'axm.web.error/v1',
    status: 'FAIL',
    code: String(error && error.code || 'BUILDER_ERROR'),
    message: String(error && error.message || error),
    details: error && error.details ? error.details : null
  };
}

async function createHtmlLiveBuilderHost(initialSource, options) {
  options = options || {};
  const maxRequestBytes = Number.isInteger(options.maxRequestBytes) ? options.maxRequestBytes : DEFAULT_MAX_REQUEST_BYTES;
  const token = crypto.randomBytes(24).toString('hex');
  const routeRoot = '/' + token + '/';
  let source = typeof initialSource === 'string' ? initialSource : String(initialSource || '');
  let preview = Builder.compileHtmlDraft(source, options.builderOptions || {});
  let compileSequence = 1;
  let origin = null;
  let expectedHost = null;

  const server = http.createServer(async function (req, res) {
    try {
      if (req.headers.host !== expectedHost) {
        jsonResponse(res, 421, safeError(Object.assign(new Error('builder Host header refused'), { code: 'BUILDER_HOST_REFUSED' })));
        return;
      }
      const url = new URL(req.url, origin);
      if (!url.pathname.startsWith(routeRoot)) {
        jsonResponse(res, 404, safeError(Object.assign(new Error('unknown builder route'), { code: 'BUILDER_ROUTE_NOT_FOUND' })));
        return;
      }
      const tail = url.pathname.slice(routeRoot.length);
      if (req.method === 'GET' && tail === '') {
        const html = renderBuilderHtml();
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': Buffer.byteLength(html),
          'Cache-Control': 'no-store',
          'Content-Security-Policy': contentSecurityPolicy(),
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), display-capture=(), usb=(), serial=(), hid=(), bluetooth=()',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
          'X-Frame-Options': 'DENY',
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Resource-Policy': 'same-origin'
        });
        res.end(html);
        return;
      }
      if (req.method === 'GET' && tail === 'state') {
        jsonResponse(res, 200, { source, preview, compileSequence });
        return;
      }
      if (req.method === 'POST' && tail === 'compile') {
        const requestOrigin = req.headers.origin;
        if (!requestOrigin) {
          jsonResponse(res, 403, safeError(Object.assign(new Error('builder mutation requires Origin'), { code: 'BUILDER_ORIGIN_REQUIRED' })));
          return;
        }
        if (requestOrigin !== origin) {
          jsonResponse(res, 403, safeError(Object.assign(new Error('builder Origin refused'), { code: 'BUILDER_ORIGIN_REFUSED' })));
          return;
        }
        if (!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type'] || ''))) {
          jsonResponse(res, 415, safeError(Object.assign(new Error('builder compile requires application/json'), { code: 'BUILDER_CONTENT_TYPE_REQUIRED' })));
          return;
        }
        const bytes = await readBody(req, maxRequestBytes);
        let body;
        try { body = JSON.parse(bytes.toString('utf8')); }
        catch (_error) {
          jsonResponse(res, 400, safeError(Object.assign(new Error('builder request is not valid JSON'), { code: 'BUILDER_JSON_INVALID' })));
          return;
        }
        const candidateSource = typeof body.source === 'string' ? body.source : null;
        if (candidateSource == null) {
          jsonResponse(res, 400, safeError(Object.assign(new Error('builder request requires source string'), { code: 'BUILDER_SOURCE_REQUIRED' })));
          return;
        }
        const candidate = Builder.compileHtmlDraft(candidateSource, Object.assign({}, options.builderOptions || {}, { viewport: body.viewport }));
        source = candidateSource;
        preview = candidate;
        compileSequence += 1;
        jsonResponse(res, 200, { preview, compileSequence });
        return;
      }
      jsonResponse(res, 404, safeError(Object.assign(new Error('unknown builder route'), { code: 'BUILDER_ROUTE_NOT_FOUND' })));
    } catch (error) {
      const status = error && /LIMIT|INVALID|REQUIRED|COMPILE/.test(String(error.code || '')) ? 422 : 500;
      jsonResponse(res, status, safeError(error));
    }
  });

  await new Promise(function (resolve, reject) {
    server.once('error', reject);
    server.listen(options.port == null ? 0 : options.port, '127.0.0.1', function () {
      server.removeListener('error', reject);
      resolve();
    });
  });
  const address = server.address();
  expectedHost = '127.0.0.1:' + address.port;
  origin = 'http://' + expectedHost;
  const builderUrl = origin + routeRoot;
  const receiptMaterial = {
    schema: HTML_BUILDER_HOST_RECEIPT_SCHEMA,
    version: 1,
    status: 'EXPERIMENTAL',
    origin,
    builderUrl,
    capabilityPathBytes: 24,
    initialSourceDigest: preview.source.sha256,
    loopbackTransportUsed: true,
    externalNetworkUsedByBuilderHost: false,
    sourceFileMutationAllowed: false,
    browserSessionMutationAllowed: false
  };
  const receipt = Object.assign({}, receiptMaterial, { receiptDigest: Digest.canonicalDigest(receiptMaterial) });
  return {
    server,
    receipt,
    builderUrl,
    state: function () { return { source, preview, compileSequence }; },
    close: function () {
      return new Promise(function (resolve, reject) {
        if (!server.listening) { resolve(); return; }
        server.close(function (error) { if (error) reject(error); else resolve(); });
      });
    }
  };
}

module.exports = {
  HTML_BUILDER_HOST_RECEIPT_SCHEMA,
  DEFAULT_MAX_REQUEST_BYTES,
  BUILDER_CONTROLLER_SOURCE,
  controllerHash,
  contentSecurityPolicy,
  renderBuilderHtml,
  createHtmlLiveBuilderHost
};
