'use strict';

const Svg = require('./svg-renderer');

function escapeHtml(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '\ufffd')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function digestRow(label, value) {
  return '<div><dt>' + escapeHtml(label) + '</dt><dd><code>' + escapeHtml(value) + '</code></dd></div>';
}

function shortText(value, limit) {
  const text = String(value || '');
  if (text.length <= limit) return text;
  return text.slice(0, Math.max(1, limit - 1)).trimEnd() + '\u2026';
}

function renderSummary(summary) {
  return Object.keys(summary).map(function (key) {
    return '<li><strong>' + escapeHtml(summary[key]) + '</strong><span>' + escapeHtml(key) + '</span></li>';
  }).join('');
}

function renderOutline(index) {
  if (index.entries.length === 0) return '<p class="empty">No semantic entries were extracted.</p>';
  return '<ol class="outline-list">' + index.entries.map(function (entry) {
    return '<li><a href="#' + escapeHtml(entry.entryId) + '"><span class="outline-kind">' +
      escapeHtml(entry.label) + '</span><span class="outline-text">' + escapeHtml(shortText(entry.text, 92)) +
      '</span></a></li>';
  }).join('') + '</ol>';
}

function renderEntries(index) {
  if (index.entries.length === 0) {
    return '<article class="semantic-card empty-card"><p>No semantic blocks were extracted. The source binding remains available in the lineage receipt.</p></article>';
  }
  return index.entries.map(function (entry) {
    return '<article class="semantic-card kind-' + escapeHtml(entry.kind) + '" id="' + escapeHtml(entry.entryId) +
      '" data-node-ref="' + escapeHtml(entry.nodeRef || '') + '" tabindex="-1">' +
      '<header><span class="kind-label">' + escapeHtml(entry.label) + '</span><code>' + escapeHtml(entry.entryId) +
      (entry.nodeRef ? ' / ' + escapeHtml(entry.nodeRef) : '') + '</code></header>' +
      '<p class="entry-text">' + escapeHtml(entry.text) + '</p>' +
      '<p class="entry-meta">' + escapeHtml(entry.meta) + '</p></article>';
  }).join('');
}

function renderBrowserSnapshot(bundle) {
  if (!bundle || !bundle.processed || !bundle.structureIndex || !bundle.layout || !bundle.displayList || !bundle.modificationLedger) {
    throw new TypeError('complete structure-view bundle is required');
  }
  const processed = bundle.processed;
  const index = bundle.structureIndex;
  const layout = bundle.layout;
  const displayList = bundle.displayList;
  const ledger = bundle.modificationLedger;
  const embeddedSvg = Svg.renderSvg(displayList, { title: layout.chrome.title }).replace(/^<\?xml[^>]+>\n/, '');
  const rows = [
    digestRow('Source', processed.source.sha256),
    digestRow('Document', processed.documentTree.documentDigest),
    digestRow('Page Model', processed.pageModel.pageModelDigest),
    digestRow('Structure Index', index.structureIndexDigest),
    digestRow('Structure Layout', layout.layoutDigest),
    digestRow('Display List', displayList.displayListDigest),
    digestRow('Modification Ledger', ledger.ledgerDigest)
  ].join('');
  return '<!doctype html>\n' +
    '<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src \'none\'; font-src \'none\'; connect-src \'none\'; media-src \'none\'; object-src \'none\'; frame-src \'none\'; worker-src \'none\'; base-uri \'none\'; form-action \'none\'">\n' +
    '<title>' + escapeHtml(layout.chrome.title) + ' \u2014 AXM Structure Browser</title>\n' +
    '<style>\n' +
    ':root{color-scheme:dark;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#030711;color:#f4f7ff;scroll-behavior:smooth}\n' +
    '*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#11203d 0,#030711 48rem);min-height:100vh}a{color:inherit}.shell{width:min(1480px,calc(100% - 28px));margin:24px auto 48px}\n' +
    '.skip-link{position:fixed;left:12px;top:8px;z-index:10;transform:translateY(-160%);padding:9px 12px;border-radius:8px;background:#72e1c2;color:#07101f;font-weight:800}.skip-link:focus{transform:none}\n' +
    '.notice{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 14px;padding:12px 16px;border:1px solid #294264;border-radius:12px;background:#0e1930}.badge{border:1px solid #366e68;border-radius:999px;padding:5px 9px;color:#72e1c2;font-size:12px;font-weight:700}.held{border-color:#7b6030;color:#f3bd63}.notice p{flex:1 1 360px;margin:0;color:#9fb1cc;font-size:12px;line-height:1.5}\n' +
    '.hero{margin-bottom:14px;padding:24px;border:1px solid #294264;border-radius:16px;background:#0e1930}.eyebrow{margin:0 0 8px;color:#72e1c2;font-size:12px;font-weight:800;letter-spacing:.08em}.hero h1{margin:0;font:800 clamp(24px,4vw,42px)/1.1 inherit}.locator{margin:12px 0 0;color:#9fb1cc;overflow-wrap:anywhere}.summary{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 0;padding:0;list-style:none}.summary li{display:flex;gap:6px;align-items:baseline;padding:7px 10px;border:1px solid #294264;border-radius:9px;background:#111f39}.summary strong{color:#72e1c2}.summary span{color:#9fb1cc;font-size:11px}\n' +
    '.browser-grid{display:grid;grid-template-columns:minmax(230px,300px) minmax(0,1fr);gap:14px;align-items:start}.outline,.semantic-pane,.visual-map,details.lineage{border:1px solid #294264;border-radius:16px;background:#0e1930}.outline{position:sticky;top:14px;max-height:calc(100vh - 28px);overflow:auto;padding:18px}.outline h2,.pane-heading h2{margin:0;font-size:16px}.outline-note,.pane-heading p{margin:7px 0 0;color:#9fb1cc;font-size:12px;line-height:1.5}.outline-list{display:grid;gap:7px;margin:16px 0 0;padding:0;list-style:none}.outline-list a{display:grid;gap:3px;padding:10px;border:1px solid transparent;border-radius:9px;text-decoration:none;background:#111f39}.outline-list a:hover,.outline-list a:focus-visible{border-color:#72e1c2;outline:none}.outline-kind{color:#72e1c2;font-size:10px;font-weight:800;text-transform:uppercase}.outline-text{color:#f4f7ff;font-size:12px;line-height:1.35}\n' +
    '.semantic-pane{padding:18px}.pane-heading{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:end;margin-bottom:12px}.pane-heading p{max-width:620px}.cards{display:grid;gap:10px}.semantic-card{--accent:#79b8ff;scroll-margin-top:16px;padding:16px 18px;border:1px solid #294264;border-left:5px solid var(--accent);border-radius:12px;background:#142642;transition:border-color .15s,background .15s}.semantic-card:target,.semantic-card:focus{border-color:#72e1c2;background:#18304e;outline:2px solid #72e1c255;outline-offset:2px}.semantic-card header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;padding-bottom:9px;border-bottom:1px solid #294264}.kind-label{color:var(--accent);font-size:11px;font-weight:800;text-transform:uppercase}.semantic-card code{color:#9fb1cc;font-size:11px}.entry-text{margin:13px 0 0;font-size:15px;line-height:1.55;overflow-wrap:anywhere}.entry-meta{margin:8px 0 0;color:#9fb1cc;font-size:12px;line-height:1.5;overflow-wrap:anywhere}.kind-heading{--accent:#72e1c2}.kind-landmark{--accent:#69d4ff}.kind-link{--accent:#b5a2ff}.kind-media{--accent:#ff9dc8}.kind-list{--accent:#8bd98b}.kind-table{--accent:#f5cf72}.kind-form{--accent:#ffab7a}\n' +
    '.visual-map,details.lineage{margin-top:14px;padding:12px 16px}.visual-map summary,details.lineage summary{cursor:pointer;color:#72e1c2;font-weight:800}.viewport{margin-top:12px;overflow:auto;border:1px solid #294264;border-radius:12px;background:#07101f}.viewport svg{display:block;width:100%;height:auto;min-width:640px}dl{display:grid;gap:9px;margin:14px 0 0}dl div{display:grid;grid-template-columns:170px 1fr;gap:12px}dt{color:#9fb1cc}dd{margin:0;min-width:0}dd code{word-break:break-all;color:#f4f7ff}.empty{color:#9fb1cc}\n' +
    '@media(max-width:800px){.shell{width:min(100% - 14px,1480px);margin-top:7px}.hero{padding:18px}.browser-grid{grid-template-columns:1fr}.outline{position:static;max-height:none}.summary li{flex:1 1 110px}.semantic-pane{padding:12px}.semantic-card{padding:14px}dl div{grid-template-columns:1fr;gap:3px}}\n' +
    '@media(prefers-reduced-motion:reduce){:root{scroll-behavior:auto}.semantic-card{transition:none}}\n' +
    '</style>\n</head>\n<body>\n<a class="skip-link" href="#document-map">Skip to document map</a>\n<main class="shell">\n' +
    '<section class="notice" aria-label="Experimental boundary"><span class="badge">EXPERIMENTAL</span><span class="badge">OFFLINE</span><span class="badge">DOCUMENT MAP READY</span><span class="badge held">PAGE NAVIGATION HELD</span><span class="badge held">PAGE CODE INERT</span><p>Trusted same-document outline links move only inside this generated snapshot. Original page links, forms, scripts, and external resources remain inert text.</p></section>\n' +
    '<header class="hero"><p class="eyebrow">AXM STRUCTURE BROWSER / SHARED HUMAN + HEADLESS INDEX</p><h1>' + escapeHtml(index.title) + '</h1><p class="locator">' + escapeHtml(index.locator) + '</p><ul class="summary" aria-label="Extracted structure counts">' + renderSummary(index.summary) + '</ul></header>\n' +
    '<div class="browser-grid" data-structure-index-digest="' + escapeHtml(index.structureIndexDigest) + '">\n' +
    '<nav class="outline" id="document-map" aria-label="Generated document map"><h2>Document map</h2><p class="outline-note">Generated from the same digest-bound Structure Index returned by the headless <code>outline</code> command.</p>' + renderOutline(index) + '</nav>\n' +
    '<section class="semantic-pane" aria-labelledby="semantic-heading"><header class="pane-heading"><div><h2 id="semantic-heading">Semantic reading surface</h2><p>Page targets are shown as text. Use the document map to move between generated entries.</p></div><span class="badge">' + escapeHtml(index.entryCount) + ' ENTRIES</span></header><div class="cards">' + renderEntries(index) + '</div></section>\n' +
    '</div>\n' +
    '<details class="visual-map"><summary>Open deterministic visual map</summary><section class="viewport" aria-label="AXM Structure View" data-layout-digest="' + escapeHtml(layout.layoutDigest) + '" data-ledger-digest="' + escapeHtml(ledger.ledgerDigest) + '">\n' + embeddedSvg + '</section></details>\n' +
    '<details class="lineage"><summary>Lineage and reversible-view receipt</summary><dl>' + rows + '</dl></details>\n' +
    '</main>\n</body>\n</html>\n';
}

module.exports = {
  escapeHtml,
  shortText,
  renderSummary,
  renderOutline,
  renderEntries,
  renderBrowserSnapshot
};
