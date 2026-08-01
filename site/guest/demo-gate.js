(function () {
  'use strict';

  var pathParts = location.pathname.split('/').filter(Boolean);
  var toolName = pathParts.length > 1 ? pathParts[pathParts.length - 2] : 'AXM tool';
  var guestUrl = new URL('../../../index.html', location.href);
  guestUrl.searchParams.set('tool', toolName);

  if (window.top === window) {
    location.replace(guestUrl.href);
    return;
  }

  var unlocked = false;
  var overlay = null;
  var style = document.createElement('style');
  style.textContent = [
    '#axmDemoGate{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:rgba(4,10,19,.96);color:#edf8ff;font-family:system-ui,sans-serif;text-align:center}',
    '#axmDemoGate[hidden]{display:none}',
    '#axmDemoGate>div{max-width:560px;padding:28px;border:1px solid rgba(111,228,239,.3);border-radius:18px;background:#0c1727;box-shadow:0 24px 80px rgba(0,0,0,.45)}',
    '#axmDemoGate b{display:block;margin-bottom:10px;color:#6fe4ef;font-size:18px}',
    '#axmDemoGate p{margin:0;color:#9bb0c3;line-height:1.6}',
    'html[data-axm-demo-locked="true"] body>*:not(#axmDemoGate){filter:saturate(.35) brightness(.45)}'
  ].join('');
  document.head.appendChild(style);

  function installOverlay() {
    if (overlay || !document.body) return;
    overlay = document.createElement('div');
    overlay.id = 'axmDemoGate';
    overlay.innerHTML = '<div><b>Timed AXM public workroom</b><p>Enter the 30-active-minute session from the AXM front door to use this full tool. The local Workshop has no demo timer.</p></div>';
    document.body.appendChild(overlay);
    lock();
  }

  function lock() {
    unlocked = false;
    document.documentElement.dataset.axmDemoLocked = 'true';
    if (overlay) overlay.hidden = false;
  }

  function unlock() {
    unlocked = true;
    document.documentElement.dataset.axmDemoLocked = 'false';
    if (overlay) overlay.hidden = true;
  }

  function blockWhenLocked(event) {
    if (unlocked) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  ['pointerdown', 'mousedown', 'touchstart', 'keydown'].forEach(function (type) {
    window.addEventListener(type, blockWhenLocked, true);
  });

  window.addEventListener('message', function (event) {
    if (event.source !== window.parent || event.origin !== location.origin) return;
    if (!event.data || event.data.type !== 'axm:demo-session') return;
    if (event.data.active === true) unlock(); else lock();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installOverlay);
  else installOverlay();

  window.parent.postMessage({ type: 'axm:demo-tool-ready', tool: toolName }, location.origin);
}());
