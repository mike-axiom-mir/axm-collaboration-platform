'use strict';

module.exports = Object.freeze({
  API: Object.freeze({
    health: '/health',
    sessionStart: '/api/session/start',
    sessionRestart: '/api/session/restart',
    sessionEnd: '/api/session/end',
    sessionSettings: '/api/session/settings',
    launcherState: '/api/launcher-state',
    world: '/api/world',
    state: '/api/state',
    input: '/api/input',
    controllerInfo: '/api/controller-info',
  }),
  CLIENT_ROLE: Object.freeze({ controller: 'controller', party: 'party' }),
  INPUT_FIELDS: Object.freeze([
    'moveX', 'moveY', 'aimX', 'aimY', 'aimActive', 'action', 'attack', 'fire', 'sprint', 'brake',
    'inventoryToggle', 'inventoryPrev', 'inventoryNext', 'inventoryActivate',
  ]),
});
