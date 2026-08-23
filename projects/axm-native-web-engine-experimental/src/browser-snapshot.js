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

function renderBrowserSnapshot(bundle) {
  if (!bundle || !bundle.processed || !bundle.layout || !bundle.displayList || !bundle.modificationLedger) {
    throw new TypeError('complete structure-view bundle is required');
  }
  const processed = bundle.processed;
  const layout = bundle.layout;
  const displayList = bundle.displayList;
  const ledger = bundle.modificationLedger;
  const embeddedSvg = Svg.renderSvg(displayList, { title: layout.chrome.title }).replace(/^<\?xml[^>]+>\n/, '');
  const rows = [
    digestRow('Source', processed.source.sha256),
    digestRow('Document', processed.documentTree.documentDigest),
    digestRow('Page Model', processed.pageModel.pageModelDigest),
    digestRow('Structure Layout', layout.layoutDigest),
    digestRow('Display List', displayList.displayListDigest),
    digestRow('Modification Ledger', ledger.ledgerDigest)
  ].join('');
  return '<!doctype html>\n' +
    '<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src \'none\'; font-src \'none\'; connect-src \'none\'; media-src \'none\'; object-src \'none\'; frame-src \'none\'; worker-src \'none\'; base-uri \'none\'; form-action \'none\'">\n' +
    '<title>' + escapeHtml(layout.chrome.title) + ' — AXM Structure Browser</title>\n' +
    '<style>\n' +
    ':root{color-scheme:dark;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#030711;color:#f4f7ff}\n' +
    '*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#11203d 0,#030711 48rem);min-height:100vh}\n' +
    '.shell{width:min(1184px,calc(100% - 28px));margin:24px auto 48px}.notice{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 12px;padding:12px 16px;border:1px solid #294264;border-radius:12px;background:#0e1930}\n' +
    '.badge{border:1px solid #366e68;border-radius:999px;padding:5px 9px;color:#72e1c2;font-size:12px;font-weight:700}.held{border-color:#7b6030;color:#f3bd63}.notice p{margin:0;color:#9fb1cc;font-size:12px;line-height:1.5}\n' +
    '.viewport{overflow:auto;border:1px solid #294264;border-radius:16px;background:#07101f;box-shadow:0 24px 70px #0008}.viewport svg{display:block;width:100%;height:auto;min-width:640px}\n' +
    'details{margin-top:14px;border:1px solid #294264;border-radius:12px;background:#0e1930;padding:12px 16px}summary{cursor:pointer;color:#72e1c2;font-weight:700}dl{display:grid;gap:9px;margin:14px 0 0}dl div{display:grid;grid-template-columns:160px 1fr;gap:12px}dt{color:#9fb1cc}dd{margin:0;min-width:0}code{word-break:break-all;color:#f4f7ff}\n' +
    '@media(max-width:700px){.shell{width:min(100% - 14px,1184px);margin-top:7px}dl div{grid-template-columns:1fr;gap:3px}}\n' +
    '</style>\n</head>\n<body>\n<main class="shell">\n' +
    '<section class="notice" aria-label="Experimental boundary"><span class="badge">EXPERIMENTAL</span><span class="badge">OFFLINE</span><span class="badge held">SITE VIEW HELD</span><span class="badge held">NAVIGATION HELD</span><p>Derived structure only. Original bytes remain unchanged; page code and external resources are inert.</p></section>\n' +
    '<section class="viewport" aria-label="AXM Structure View" data-layout-digest="' + escapeHtml(layout.layoutDigest) + '" data-ledger-digest="' + escapeHtml(ledger.ledgerDigest) + '">\n' + embeddedSvg + '</section>\n' +
    '<details><summary>Lineage and reversible-view receipt</summary><dl>' + rows + '</dl></details>\n' +
    '</main>\n</body>\n</html>\n';
}

module.exports = { escapeHtml, renderBrowserSnapshot };
