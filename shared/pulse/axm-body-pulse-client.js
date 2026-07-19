(function (root) {
  'use strict';
  function request(path, method, body, command) {
    return fetch(path, {
      method: method || 'GET',
      headers: Object.assign({ 'content-type': 'application/json' }, command ? { 'x-axm-body-pulse': command } : {}),
      body: body == null ? undefined : JSON.stringify(body)
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (payload) {
        if (!response.ok || payload.ok === false) throw new Error(payload.error || ('Body Pulse HTTP ' + response.status));
        return payload;
      });
    });
  }
  var api = {
    status: function () { return request('/api/body-pulse', 'GET').then(function (payload) { return payload.status; }); },
    register: function (module) { return request('/api/body-pulse/register', 'POST', module, 'explicit-module-config').then(function (payload) { return payload.status; }); },
    setMode: function (mode, actorId) { return request('/api/body-pulse/mode', 'POST', { mode: mode, actorId: actorId || 'mike' }, 'explicit-overall-mode').then(function (payload) { return payload.status; }); },
    goal: function (goal) { return request('/api/body-pulse/goal', 'POST', goal, 'explicit-goal-queue').then(function (payload) { return payload.status; }); },
    deleteGoals: function (goalIds, actorId) { return request('/api/body-pulse/goals/delete', 'POST', { goalIds: goalIds, actorId: actorId || 'local-steward' }, 'explicit-goal-delete').then(function (payload) { return payload.status; }); },
    request: function (moduleId, options) { return request('/api/body-pulse/request', 'POST', Object.assign({ moduleId: moduleId }, options || {}), 'bounded-pulse-request').then(function (payload) { return payload.decision; }); },
    complete: function (leaseId, outcome, summary, effect) { return request('/api/body-pulse/complete', 'POST', { leaseId: leaseId, outcome: outcome || 'COMPLETED', summary: summary || '', effect: effect || 'module-local-candidate-only' }, 'bounded-pulse-complete'); },
    runOnce: async function (moduleId, action, options) {
      var decision = await api.request(moduleId, options);
      if (!decision.granted) return decision;
      try {
        var result = await action(decision.lease);
        await api.complete(decision.lease.leaseId, 'COMPLETED', result && result.summary || 'Bounded module action completed.', result && result.effect || 'module-local-candidate-only');
        return Object.assign({}, decision, { result: result });
      } catch (error) {
        await api.complete(decision.lease.leaseId, 'FAILED', String(error && error.message || error), 'no-promoted-effect');
        throw error;
      }
    }
  };
  root.AXMBodyPulseClient = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
