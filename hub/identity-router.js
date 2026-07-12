(function (root, factory) {
  var api = factory(root || {});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMIdentityRouter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  var registryOverride = null;
  var routes = {
    studio: { ai1: 'nova', ai2: 'gemini-local', nova: 'nova', gemini: 'gemini-local' },
    'duo-test': { primary: 'nova', reviewer: 'gemini-local' }
  };

  function registry() { return registryOverride || root.AXMIdentityRegistry; }
  function configure(opts) { opts = opts || {}; if (opts.registry) registryOverride = opts.registry; return api; }
  function register(toolId, map) {
    if (!String(toolId || '').trim()) throw new Error('tool id required');
    if (!map || typeof map !== 'object') throw new Error('identity route map required');
    routes[toolId] = Object.assign({}, routes[toolId] || {}, map);
    return api;
  }
  function resolve(toolId, slot) {
    var map = routes[toolId];
    var identityId = map && map[slot];
    if (!identityId) throw new Error('no identity route for ' + toolId + ':' + slot);
    return identityId;
  }
  function ask(toolId, slot, prompt, opts) {
    var r = registry();
    if (!r || typeof r.ask !== 'function') return Promise.reject(new Error('identity registry unavailable'));
    var identityId = resolve(toolId, slot);
    return Promise.resolve(r.ask(identityId, prompt, opts || {})).then(function (result) {
      if (result) { result.identityId = identityId; result.toolId = toolId; result.slot = slot; }
      return result;
    });
  }
  function snapshot() { return JSON.parse(JSON.stringify(routes)); }

  var api = { configure: configure, register: register, resolve: resolve, ask: ask, snapshot: snapshot };
  return api;
});
