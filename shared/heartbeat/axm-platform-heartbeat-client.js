(function (root) {
  'use strict';
  function request(path, method, body, command) {
    return fetch(path, {
      method: method || 'GET',
      headers: Object.assign({ 'content-type': 'application/json' }, command ? { 'x-axm-heartbeat': command } : {}),
      body: body == null ? undefined : JSON.stringify(body)
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (payload) {
        if (!response.ok || payload.ok === false) throw new Error(payload.error || ('Platform Heartbeat HTTP ' + response.status));
        return payload;
      });
    });
  }
  root.AXMPlatformHeartbeatClient = {
    status: function () { return request('/api/platform-heartbeat', 'GET').then(function (payload) { return payload.status; }); },
    configure: function (config) { return request('/api/platform-heartbeat/config', 'POST', config, 'explicit-heartbeat-config').then(function (payload) { return payload.status; }); },
    manual: function (actorId) { return request('/api/platform-heartbeat/manual', 'POST', { actorId: actorId || 'mike' }, 'explicit-manual-beat'); },
    preview: function (count) { return request('/api/platform-heartbeat/preview', 'POST', { count: count || 5 }, 'heartbeat-preview-only').then(function (payload) { return payload.preview; }); }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
