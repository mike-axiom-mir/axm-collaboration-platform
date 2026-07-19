(function (root) {
  'use strict';
  function request(path, method, body, action) {
    return fetch(path, { method: method || 'GET', headers: Object.assign({ 'Content-Type':'application/json' }, action ? { 'x-axm-direction':action } : {}), body: body == null ? undefined : JSON.stringify(body) }).then(function (response) { return response.json().then(function (payload) { if (!response.ok || !payload.ok) throw new Error(payload.error || ('Direction request failed: ' + response.status)); return payload; }); });
  }
  root.AXMDirectionClient = {
    status: function () { return request('/api/workshop-direction'); },
    compile: function (input) { return request('/api/workshop-direction/compile', 'POST', input, 'explicit-compile'); },
    commit: function (input) { return request('/api/workshop-direction/commit', 'POST', input, 'explicit-commit'); },
    setStatus: function (directionId, status, actorId) { return request('/api/workshop-direction/status', 'POST', { directionId:directionId, status:status, actorId:actorId || 'local-steward' }, 'explicit-status'); }
  };
})(typeof self !== 'undefined' ? self : this);
