(function (root) {
  'use strict';
  var query = '';
  try { query = String(root.location && root.location.search || ''); } catch (e) {}
  var requested = /(?:^|[?&])device=phone(?:&|$)/i.test(query);
  var compact = false;
  try {
    compact = !!(root.matchMedia && (root.matchMedia('(max-width: 720px)').matches || root.matchMedia('(pointer: coarse) and (max-width: 900px)').matches));
  } catch (e) {}
  var phone = requested || compact;
  if (!phone || !root.document) return;

  root.document.documentElement.classList.add('axm-phone');
  try {
    if (root.localStorage.getItem('axm.hub.sidebar-collapsed') === null) {
      root.localStorage.setItem('axm.hub.sidebar-collapsed', 'true');
    }
  } catch (e) {}

  root.addEventListener('DOMContentLoaded', function () {
    if (!root.document.body) return;
    root.document.body.dataset.device = 'phone';
    var system = root.document.getElementById('systemStatus');
    if (system) system.title = 'Phone host: the full local workshop is running; host-specific actions explain when a desktop is required.';
  });

  root.AXMDevice = Object.freeze({ kind: 'phone', requested: requested, compact: compact });
})(typeof window !== 'undefined' ? window : this);
