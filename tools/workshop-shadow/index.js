'use strict';

const snapshotShadow = require('../sandbox/workshop-shadow-sandbox-v1');

module.exports = Object.assign({}, snapshotShadow, {
  contractRepair: require('../sandbox/workshop-contract-repair-sandbox-v1')
});
