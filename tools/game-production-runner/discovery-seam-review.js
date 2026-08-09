'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Core = require('../../shared/game-production-runner');

const root = path.resolve(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
const integration = Core.adapters.inspect(root);
let checks = 0;
function ok(value, message) { assert.ok(value, message); checks += 1; }

ok(manifest.id === contract.id && manifest.version === contract.version, 'manifest and contract identity agree');
ok(manifest.status === 'EXPERIMENTAL' && contract.status === 'EXPERIMENTAL', 'status remains experimental');
ok(JSON.stringify(manifest.permissions.slice().sort()) === JSON.stringify(contract.permissions.slice().sort()), 'permissions agree');
ok(contract.boundaries.refuses.includes('native-execution-v0.1'), 'native execution remains refused');
ok(contract.boundaries.refuses.includes('automatic-game-hub-install'), 'Game Hub install remains refused');
ok(integration.checks.every((item) => item.available), 'all tracked read-only AXM seams are present');
ok(integration.native_runtime_probed === false && integration.authority_granted === false, 'discovery grants no runtime authority');
console.log('Game Production Runner discovery seam review passed ' + checks + ' checks.');
