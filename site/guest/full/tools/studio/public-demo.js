(function () {
  'use strict';

  var localOnlyIds = [
    'runDuet', 'loadNovaAsset', 'loadGeminiAsset',
    'brain1', 'brain2', 'hbToggle', 'freeBtn',
    'gameAssetTarget', 'gameAssetName', 'stageGameAsset',
    'wisdomFileBtn', 'askDraw'
  ];

  function markLocalOnly() {
    var back = document.querySelector('a[href="/hub/index.html"]');
    if (back) {
      back.href = '../../../index.html';
      back.setAttribute('aria-label', 'Back to public maker room');
    }
    var duet = document.getElementById('duetPanel');
    if (duet) duet.hidden = true;

    localOnlyIds.forEach(function (id) {
      var node = document.getElementById(id);
      if (!node) return;
      node.disabled = true;
      node.title = 'Available in local AXM; the public room has no machine or provider bridge.';
    });

    var right = document.querySelector('.right');
    if (!right || document.getElementById('publicStudioBoundary')) return;
    var notice = document.createElement('div');
    notice.id = 'publicStudioBoundary';
    notice.className = 'block';
    notice.style.borderColor = 'rgba(56,214,236,.45)';
    notice.innerHTML = '<p class="ct">30-minute public Studio</p>' +
      '<div style="font-size:10px;color:var(--muted);line-height:1.5">The complete browser canvas, layer, vector, animation and export engines are active. AI/model bridges and Game Hub installation are intentionally local-only.</div>';
    right.insertBefore(notice, right.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markLocalOnly, { once: true });
  } else {
    markLocalOnly();
  }
}());
