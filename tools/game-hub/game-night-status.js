(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMGameNightStatus = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  function classifyBootFailure(error, attempts) {
    const status = Number(error && error.status) || 0;
    const route = String(error && error.route || '');
    const message = String(error && error.message || '');
    if (status === 423 || /safe mode/i.test(message)) return 'SAFE MODE · GAME RUNTIMES DISABLED';
    if (status === 404 && route) return 'GAME SERVICE ROUTE MISSING · RESTART AXM FULL';
    if (Number(attempts) >= 3) return 'GAME SERVICE OFFLINE · RESTART AXM FULL';
    return 'RECONNECTING · STARTING GAME SERVICE';
  }

  return Object.freeze({ classifyBootFailure });
});
