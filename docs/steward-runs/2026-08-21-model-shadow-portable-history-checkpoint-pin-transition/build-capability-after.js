#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const before = JSON.parse(fs.readFileSync(path.join(dir, 'CAPABILITY_INVENTORY_BEFORE.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.resolve(dir, '../../../shared/model-shadow-history-checkpoint-pin-transition/module.contract.json'), 'utf8'));
const provided = new Set(contract.provides);
const result = {
  capabilities: before.capabilities.map(item => provided.has(item.id) ? {
    id: item.id,
    status: 'available',
    constraints: ['Provided by the uninstalled and unpromoted v2.4 TEST adapter; focused tests cover every closed classification, typed pin drift, successor chaining, fresh-process rebuild, retained-pin joint-pair detection, joint pin-and-pair replacement, and authority boundaries.']
  } : item)
};
const bounded = result.capabilities.filter(item => item.id.startsWith('model.shadow.portable-history-checkpoint-pin-transition.'));
if (bounded.length !== 24 || bounded.some(item => item.status !== 'available')) throw new Error('bounded v2.4 capability after-state is incomplete');
fs.writeFileSync(path.join(dir, 'CAPABILITY_INVENTORY_AFTER.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log('PASS wrote after inventory with ' + result.capabilities.filter(item => item.status === 'available').length + ' available capabilities');
