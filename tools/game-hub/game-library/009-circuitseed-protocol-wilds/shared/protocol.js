'use strict';

module.exports = Object.freeze({
  schema: 'axm.circuitseed-local-protocol/v1',
  intentProtocol: 'axm-semantic-input-v1',
  observationProtocol: 'axm-seat-screen-semantics-v1',
  endpoints: Object.freeze({
    health: '/health', bootstrap: '/api/bootstrap', sessionStart: '/api/session/start',
    join: '/api/session/join', leave: '/api/session/leave', reconnect: '/api/session/reconnect',
    input: '/api/input', observation: '/api/adapter-observation', state: '/api/state',
    profileList: '/api/profiles', profileExport: '/api/profile/export', profileImport: '/api/profile/import',
    craft: '/api/craft', shop: '/api/shop', encounter: '/api/encounter',
    specialize: '/api/circuitkin/specialize', result: '/api/result'
  })
});
