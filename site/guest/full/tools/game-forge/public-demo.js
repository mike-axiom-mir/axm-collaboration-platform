(function () {
  'use strict';
  var demoActive = false;
  function relayDemoState() {
    var hud = document.getElementById('hudFrame');
    if (hud && hud.contentWindow && hud.src) hud.contentWindow.postMessage({ type: 'axm:demo-session', active: demoActive }, location.origin);
  }
  function adaptPublicDemo() {
    var back = document.querySelector('.brand a');
    var hud = document.getElementById('hudFrame');
    var playtest = document.getElementById('playtestFrame');
    var build = document.getElementById('buildPackage');
    var result = document.getElementById('packageResult');
    if (back) {
      back.href = '../../../index.html';
      back.setAttribute('aria-label', 'Back to public maker room');
    }
    if (hud) {
      hud.dataset.src = '../studio/engine.html?embedded=1&game-forge=1';
      hud.addEventListener('load', relayDemoState);
    }
    if (playtest) playtest.dataset.src = '../../local-required.html';
    if (build) {
      build.disabled = true;
      build.title = 'The package verifier writes a candidate on the local machine and is not available on static GitHub Pages.';
      build.textContent = 'Local Workshop required';
    }
    if (result && !result.textContent.trim()) {
      result.textContent = 'PUBLIC DEMO BOUNDARY\nDesign, map, preview and export are live here. Verified package assembly, installation and QR/LAN playtesting run in local AXM.';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', adaptPublicDemo);
  else adaptPublicDemo();
  window.addEventListener('message', function (event) {
    if (event.origin !== location.origin || !event.data) return;
    if (event.source === window.parent && event.data.type === 'axm:demo-session') {
      demoActive = event.data.active === true;
      relayDemoState();
    }
    if (event.data.type === 'axm:demo-tool-ready') relayDemoState();
  });
}());
