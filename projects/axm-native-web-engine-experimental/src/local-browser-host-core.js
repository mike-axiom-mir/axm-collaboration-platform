'use strict';

const crypto = require('node:crypto');
const http = require('node:http');
const Canonical = require('./canonical-json');
const Digest = require('./digest');

const HOST_RECEIPT_SCHEMA = 'axm.web.local-browser-host-receipt/v1';
const DEFAULT_MAX_ACTION_BYTES = 16 * 1024;
const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), display-capture=(), usb=(), serial=(), hid=(), bluetooth=()';

const CONTROLLER_SOURCE = `(function () {
  'use strict';
  const byId = function (id) { return document.getElementById(id); };
  const root = document.documentElement;
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
  const theme = byId('theme');
  const density = byId('density');
  const textScale = byId('text-scale');
  const focusMode = byId('focus-mode');
  const metadata = byId('metadata');
  const filter = byId('filter');
  const clearFilter = byId('clear-filter');
  const resetView = byId('reset-view');
  const visibleCount = byId('visible-count');
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

  function allowed(value, values, fallback) {
    return values.includes(value) ? value : fallback;
  }

  function applyVisualPreferences() {
    root.dataset.theme = allowed(theme.value, ['midnight', 'paper', 'contrast'], 'midnight');
    root.dataset.density = allowed(density.value, ['comfortable', 'compact'], 'comfortable');
    root.dataset.scale = allowed(textScale.value, ['small', 'normal', 'large'], 'normal');
    root.dataset.focus = focusMode.checked ? 'reading' : 'full';
    root.dataset.meta = metadata.checked ? 'show' : 'hide';
  }

  function applyFilter() {
    const needle = String(filter.value || '').trim().toLowerCase();
    let visible = 0;
    let total = 0;
    cards.querySelectorAll('.semantic-card').forEach(function (card) {
      total += 1;
      const match = !needle || String(card.dataset.searchText || '').includes(needle);
      card.hidden = !match;
      if (match) visible += 1;
    });
    map.querySelectorAll('li').forEach(function (item) {
      item.hidden = Boolean(needle) && !String(item.dataset.searchText || '').includes(needle);
    });
    visibleCount.textContent = String(visible) + '/' + String(total) + ' visible';
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
      item.dataset.searchText = (entry.label + ' ' + entry.text + ' ' + entry.meta).toLowerCase();
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
      card.dataset.searchText = (entry.label + ' ' + entry.text + ' ' + entry.meta).toLowerCase();
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
    applyFilter();
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

  [theme, density, textScale, focusMode, metadata].forEach(function (control) {
    control.addEventListener('change', applyVisualPreferences);
  });
  filter.addEventListener('input', applyFilter);
  clearFilter.addEventListener('click', function () {
    filter.value = '';
    applyFilter();
    filter.focus();
  });
  resetView.addEventListener('click', function () {
    theme.value = 'midnight';
    density.value = 'comfortable';
    textScale.value = 'normal';
    focusMode.checked = false;
    metadata.checked = true;
    filter.value = '';
    applyVisualPreferences();
    applyFilter();
    setStatus('VIEW RESET \u00b7 shell-only preferences', 'ready');
  });

  document.addEventListener('keydown', function (event) {
    const active = document.activeElement;
    const typing = active && ['INPUT', 'SELECT', 'TEXTAREA'].includes(active.tagName);
    if (event.key === '/' && !typing) {
      event.preventDefault();
      filter.focus();
    }
    if (event.key === 'Escape' && focusMode.checked && !typing) {
      focusMode.checked = false;
      applyVisualPreferences();
    }
  });

  applyVisualPreferences();
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

function contentSecurityPolicy() {
  return "default-src 'none'; script-src 'sha256-" + controllerHash() + "'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'";
}

function renderShellHtml() {
  const policy = contentSecurityPolicy();
  return '<!doctype html>\n<html lang="en" data-theme="midnight" data-density="comfortable" data-scale="normal" data-focus="full" data-meta="show">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<meta http-equiv="Content-Security-Policy" content="' + escapeHtml(policy) + '">\n' +
    '<title>AXM Local Browser Session \u2014 EXPERIMENTAL</title>\n' +
    '<style>\n' +
    ':root{color-scheme:dark;--bg:#050812;--glow:#17345d;--surface:#0d1728;--surface-strong:#09111f;--panel:#101e32;--card:#142842;--card-focus:#193856;--control:#142842;--input:#070d18;--fg:#f4f7ff;--muted:#9fb1cc;--border:#2b4568;--accent:#72e1c2;--accent2:#6fc5ff;--warn:#f3bd63;--danger:#ffab7a;--shadow:0 20px 55px rgba(0,0,0,.28);--content-size:15px;--card-pad:17px;--space:12px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--fg)}' +
    'html[data-theme="paper"]{color-scheme:light;--bg:#eef2f7;--glow:#c7ddf7;--surface:#ffffff;--surface-strong:#f8fafc;--panel:#f8fafc;--card:#ffffff;--card-focus:#effaf7;--control:#f7fafc;--input:#ffffff;--fg:#172033;--muted:#64748b;--border:#c9d4e3;--accent:#006f62;--accent2:#005ea8;--warn:#875100;--danger:#a43b17;--shadow:0 18px 45px rgba(39,52,78,.12)}' +
    'html[data-theme="contrast"]{color-scheme:dark;--bg:#000;--glow:#001b1a;--surface:#050505;--surface-strong:#000;--panel:#080808;--card:#0b0b0b;--card-focus:#101a18;--control:#111;--input:#000;--fg:#fff;--muted:#e2e2e2;--border:#fff;--accent:#00ffd5;--accent2:#53c8ff;--warn:#ffd400;--danger:#ff8a5b;--shadow:none}' +
    'html[data-density="compact"]{--card-pad:11px;--space:7px}html[data-scale="small"]{--content-size:13px}html[data-scale="large"]{--content-size:18px}*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;min-height:100vh;background:radial-gradient(circle at top,var(--glow) 0,var(--bg) 52rem);color:var(--fg);transition:background .18s,color .18s}button,input,select{font:inherit;color:inherit}button,select,input{border:1px solid var(--border);background:var(--control)}button{cursor:pointer}.shell{width:min(1540px,calc(100% - 24px));margin:12px auto 48px}.boundary,.toolbar,.viewbar,.hero,.panel{border:1px solid var(--border);box-shadow:var(--shadow)}' +
    '.boundary{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 14px;border-radius:14px;background:var(--surface)}.badge{padding:5px 9px;border:1px solid var(--accent);border-radius:999px;color:var(--accent);font:800 10px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.04em}.badge.held{border-color:var(--warn);color:var(--warn)}.boundary p{flex:1 1 360px;margin:0;color:var(--muted);font-size:12px;line-height:1.5}' +
    '.toolbar{position:sticky;top:0;z-index:8;display:grid;grid-template-columns:auto minmax(220px,1fr) minmax(180px,auto);gap:9px;margin:10px 0;padding:9px;border-radius:14px;background:var(--surface-strong)}.nav-buttons{display:flex;gap:6px}.toolbar button,.open-link,.map-button,.mini-button{border-radius:9px;background:var(--control)}.toolbar button{min-width:42px;padding:9px 11px}.toolbar button:hover:not(:disabled),.toolbar button:focus-visible,.open-link:hover:not(:disabled),.open-link:focus-visible,.map-button:hover,.map-button:focus-visible,.mini-button:hover,.mini-button:focus-visible,select:focus-visible,input:focus-visible{border-color:var(--accent);outline:2px solid var(--accent);outline-offset:1px}.toolbar button:disabled,.open-link:disabled{cursor:not-allowed;opacity:.42}.address-wrap{display:flex;min-width:0}.address-wrap input{width:100%;min-width:0;padding:9px 12px;border-radius:9px 0 0 9px;background:var(--input)}.address-wrap button{border-radius:0 9px 9px 0}.status{align-self:center;max-width:320px;color:var(--muted);font:700 10px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow-wrap:anywhere}.status[data-kind="fail"],.status[data-kind="held"]{color:var(--danger)}.status[data-kind="ready"],.status[data-kind="applied"]{color:var(--accent)}' +
    '.viewbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px;padding:9px;border-radius:14px;background:var(--surface)}.view-label{margin:0 5px;color:var(--muted);font:800 10px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-transform:uppercase;letter-spacing:.06em}.control{display:flex;gap:6px;align-items:center;padding:5px 7px;border:1px solid var(--border);border-radius:10px;background:var(--surface-strong)}.control span{color:var(--muted);font-size:10px}.control select{padding:5px 24px 5px 7px;border-radius:7px;background:var(--input);font-size:11px}.toggle{display:flex;gap:6px;align-items:center;padding:7px 9px;border:1px solid var(--border);border-radius:10px;background:var(--surface-strong);font-size:11px;cursor:pointer}.toggle input{accent-color:var(--accent)}.filter-wrap{display:flex;flex:1 1 260px;min-width:220px}.filter-wrap input{width:100%;min-width:0;padding:7px 9px;border-radius:8px 0 0 8px;background:var(--input)}.filter-wrap button{border-radius:0 8px 8px 0}.mini-button{padding:7px 9px;font-size:11px}.view-state{margin-left:auto;color:var(--muted);font:700 10px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}' +
    '.hero{position:relative;overflow:hidden;padding:24px;border-radius:18px;background:linear-gradient(135deg,var(--surface),var(--panel))}.hero:after{content:"";position:absolute;right:-90px;top:-110px;width:260px;height:260px;border:1px solid var(--border);border-radius:50%;opacity:.28;pointer-events:none}.eyebrow{position:relative;z-index:1;margin:0 0 8px;color:var(--accent);font:800 11px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.08em}.hero h1{position:relative;z-index:1;margin:0;max-width:1100px;font-size:clamp(27px,4vw,46px);line-height:1.08;letter-spacing:-.025em}.locator{position:relative;z-index:1;margin:11px 0 0;color:var(--muted);font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow-wrap:anywhere}.summary{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:7px;margin:16px 0 0;padding:0;list-style:none}.summary li{display:flex;gap:6px;align-items:baseline;padding:7px 10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-strong)}.summary strong{color:var(--accent);font-size:14px}.summary span{color:var(--muted);font-size:10px}' +
    '.grid{display:grid;grid-template-columns:minmax(230px,290px) minmax(0,1fr) minmax(220px,270px);gap:var(--space);margin-top:var(--space);align-items:start}.panel{border-radius:16px;background:var(--surface)}.side{position:sticky;top:78px;max-height:calc(100vh - 90px);overflow:auto;padding:14px}.side h2,.content h2{margin:0;font-size:14px;letter-spacing:-.01em}.side-note{margin:6px 0 12px;color:var(--muted);font-size:11px;line-height:1.45}.document-map,.history-list{display:grid;gap:6px;margin:0;padding:0;list-style:none}.map-button{display:grid;width:100%;gap:3px;padding:9px;text-align:left}.map-kind{color:var(--accent);font:800 9px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-transform:uppercase}.map-text{font-size:11px;line-height:1.35}.content{padding:15px}.content-top{display:flex;justify-content:space-between;gap:8px;align-items:center}.content-top .badge{white-space:nowrap}.cards{display:grid;gap:var(--space);margin-top:12px}.semantic-card{--entry-accent:var(--accent2);scroll-margin-top:82px;padding:var(--card-pad);border:1px solid var(--border);border-left:5px solid var(--entry-accent);border-radius:13px;background:var(--card);box-shadow:0 10px 28px rgba(0,0,0,.08);transition:transform .12s,border-color .12s,background .12s}.semantic-card:hover{transform:translateY(-1px)}.semantic-card:focus{border-color:var(--accent);background:var(--card-focus);outline:2px solid var(--accent);outline-offset:2px}.semantic-card header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:7px;padding-bottom:8px;border-bottom:1px solid var(--border)}.kind-label{color:var(--entry-accent);font:800 10px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-transform:uppercase;letter-spacing:.04em}.semantic-card code{color:var(--muted);font-size:10px}.entry-text{margin:11px 0 0;font-size:var(--content-size);font-weight:520;line-height:1.58;overflow-wrap:anywhere}.entry-meta{margin:7px 0 0;color:var(--muted);font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow-wrap:anywhere}.kind-heading{--entry-accent:var(--accent)}.kind-landmark{--entry-accent:#69d4ff}.kind-link{--entry-accent:#b5a2ff}.kind-media{--entry-accent:#ff9dc8}.kind-list{--entry-accent:#8bd98b}.kind-table{--entry-accent:#f5cf72}.kind-form{--entry-accent:#ffab7a}.kind-paragraph{--entry-accent:var(--accent2)}.link-controls{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:center;margin-top:11px}.resolution{font:800 10px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--muted)}.resolution.available,.resolution.same_document{color:var(--accent)}.open-link{padding:7px 10px;font-size:11px}.history-list li{display:grid;gap:3px;padding:8px;border-left:3px solid var(--border);color:var(--muted);font-size:10px;overflow-wrap:anywhere}.history-list li.current-history{border-color:var(--accent);background:var(--card);color:var(--fg)}.receipt{display:grid;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--border)}.receipt div{display:grid;gap:2px}.receipt span{color:var(--muted);font:800 9px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-transform:uppercase}.receipt code{font:9px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;word-break:break-all}' +
    'html[data-meta="hide"] .entry-meta,html[data-meta="hide"] .semantic-card code{display:none}html[data-focus="reading"] .map-panel,html[data-focus="reading"] .history-panel{display:none}html[data-focus="reading"] .grid{grid-template-columns:minmax(0,980px);justify-content:center}html[data-focus="reading"] .content{padding:clamp(14px,2vw,26px)}html[data-focus="reading"] .semantic-card{border-left-width:4px}html[data-density="compact"] .semantic-card header{padding-bottom:5px}html[data-density="compact"] .entry-text{margin-top:7px;line-height:1.45}html[data-density="compact"] .entry-meta{margin-top:4px}' +
    '@media(max-width:1080px){.grid{grid-template-columns:250px minmax(0,1fr)}.history-panel{position:static;grid-column:1/-1;max-height:none}.toolbar{grid-template-columns:auto minmax(180px,1fr)}.status{grid-column:1/-1;max-width:none}.view-state{margin-left:0}}@media(max-width:760px){.shell{width:min(100% - 10px,1540px);margin-top:5px}.toolbar{grid-template-columns:auto 1fr}.grid{grid-template-columns:1fr}.side{position:static;max-height:none}.history-panel{grid-column:auto}.hero{padding:18px}.content{padding:10px}.semantic-card{padding:13px}.nav-buttons button{min-width:38px;padding:8px}.address-wrap input{padding:8px}.viewbar{align-items:stretch}.control,.toggle{flex:1 1 140px}.filter-wrap{flex-basis:100%;min-width:0}html[data-focus="reading"] .grid{display:block}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}.semantic-card:hover{transform:none}}\n' +
    '</style>\n</head>\n<body>\n<main class="shell">\n' +
    '<section class="boundary" aria-label="Experimental boundary"><span class="badge">EXPERIMENTAL</span><span class="badge">LOCAL SESSION</span><span class="badge">SHARED ENGINE</span><span class="badge held">EXTERNAL NETWORK HELD</span><span class="badge held">PAGE CODE INERT</span><p>The trusted AXM shell may navigate only among explicitly allowed local pages. Visual controls affect this shell only; they do not grant page, file, script, or network authority.</p></section>\n' +
    '<nav class="toolbar" aria-label="Local browser controls"><div class="nav-buttons"><button id="back" type="button" aria-label="Back">\u2190</button><button id="forward" type="button" aria-label="Forward">\u2192</button><button id="reload" type="button" aria-label="Reload">\u21bb</button></div><div class="address-wrap"><input id="address" aria-label="Bundled local address" autocomplete="off" spellcheck="false"><button id="go" type="button">Go</button></div><output id="status" class="status" aria-live="polite">CONNECTING\u2026</output></nav>\n' +
    '<section class="viewbar" aria-label="Visual options"><p class="view-label">View</p><label class="control"><span>Theme</span><select id="theme" aria-label="Theme"><option value="midnight">Midnight</option><option value="paper">Paper</option><option value="contrast">Contrast</option></select></label><label class="control"><span>Density</span><select id="density" aria-label="Density"><option value="comfortable">Comfort</option><option value="compact">Compact</option></select></label><label class="control"><span>Text</span><select id="text-scale" aria-label="Text size"><option value="small">Small</option><option value="normal" selected>Normal</option><option value="large">Large</option></select></label><label class="toggle"><input id="focus-mode" type="checkbox">Focus reading</label><label class="toggle"><input id="metadata" type="checkbox" checked>Metadata</label><div class="filter-wrap"><input id="filter" type="search" aria-label="Filter semantic entries" placeholder="Filter this page ( / )" autocomplete="off"><button id="clear-filter" class="mini-button" type="button">Clear</button></div><button id="reset-view" class="mini-button" type="button">Reset view</button><span id="visible-count" class="view-state" aria-live="polite">0/0 visible</span></section>\n' +
    '<header class="hero"><p class="eyebrow">AXM LOCAL BROWSER / HUMAN SHELL + HEADLESS SESSION</p><h1 id="page-title">Loading local page\u2026</h1><p id="page-locator" class="locator"></p><ul id="summary" class="summary" aria-label="Extracted structure counts"></ul></header>\n' +
    '<div class="grid"><nav class="panel side map-panel" aria-label="Current document map"><h2>Document map</h2><p class="side-note">Focus and scroll restoration use the same stable entry references exposed to headless callers.</p><ol id="document-map-list" class="document-map"></ol></nav>\n' +
    '<section class="panel content" aria-labelledby="content-heading"><header class="content-top"><h2 id="content-heading">Semantic page</h2><span class="badge">LOCAL VIEW</span></header><div id="cards" class="cards"></div></section>\n' +
    '<aside class="panel side history-panel" aria-label="Session history"><h2>History</h2><p class="side-note">Bounded local navigation only.</p><ol id="history-list" class="history-list"></ol><div class="receipt"><div><span>Session</span><code id="session-id"></code></div><div><span>Bundle</span><code id="bundle-digest"></code></div><div><span>Source</span><code id="source-digest"></code></div><div><span>Reloads</span><code id="reload-count"></code></div></div></aside></div>\n' +
    '</main>\n<script>' + CONTROLLER_SOURCE + '</script>\n</body>\n</html>\n';
}

function securityHeaders() {
  return {
    'Cache-Control': 'no-store',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': PERMISSIONS_POLICY,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY'
  };
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
    'Content-Length': Buffer.byteLength(html),
    'Content-Security-Policy': contentSecurityPolicy()
  }, securityHeaders()));
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
        const origin = String(request.headers.origin || '');
        if (!origin) {
          sendJson(response, 403, errorEnvelope(Object.assign(new Error('session actions require the exact loopback shell Origin header'), { code: 'HOST_ORIGIN_REQUIRED' })));
          return;
        }
        if (origin !== expectedOrigin) {
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
  const addressInfo = server.address();
  expectedOrigin = 'http://127.0.0.1:' + addressInfo.port;
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
  PERMISSIONS_POLICY,
  CONTROLLER_SOURCE,
  escapeHtml,
  controllerHash,
  contentSecurityPolicy,
  securityHeaders,
  renderShellHtml,
  errorEnvelope,
  createLocalBrowserHost
};
