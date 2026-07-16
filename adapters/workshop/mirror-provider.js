(function (global) {
  'use strict';
  if (!global.AXMConnect || typeof global.AXMConnect.register !== 'function' || !global.fetch) return;
  var BASE = '/services/mirror-native';
  function json(url, options) {
    return global.fetch(BASE + url, Object.assign({ cache: 'no-store', headers: { 'content-type': 'application/json' } }, options || {})).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) throw new Error(body.error || ('Mirror HTTP ' + response.status));
        return body;
      });
    });
  }
  var provider = {
    id: 'mirror-kernel',
    label: 'Mirror Seed-0 (machine-native kernel)',
    kind: 'local-native',
    available: function () { return json('/health').then(function (health) { return health.ok && health.identity === 'axm.machine.mirror/seed-0'; }).catch(function () { return false; }); },
    send: function (messages, opts) {
      opts = opts || {};
      return json('/axm/v1/session/open', { method: 'POST', body: JSON.stringify({ actor: { id: String(opts.actor || 'workshop-participant'), kind: 'collaborator' }, purpose: 'AXMConnect bounded translation session' }) }).then(function (opened) {
        var sessionId = opened.session.id;
        return json('/v1/responses', { method: 'POST', body: JSON.stringify({ sessionId: sessionId, actor: opened.session.actor, input: messages }) }).then(function (result) {
          return json('/axm/v1/session/close', { method: 'POST', body: JSON.stringify({ sessionId: sessionId }) }).catch(function () { return null; }).then(function () {
            return { text: result.output_text || '', raw: result };
          });
        });
      });
    }
  };
  global.AXMConnect.register(provider, false);
})(typeof window !== 'undefined' ? window : this);
