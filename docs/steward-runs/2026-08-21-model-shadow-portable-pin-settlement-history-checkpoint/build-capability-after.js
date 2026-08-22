#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const before = JSON.parse(fs.readFileSync(path.join(dir, 'CAPABILITY_INVENTORY_BEFORE.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.resolve(dir, '../../../shared/model-shadow-portable-pin-settlement-history-checkpoint/module.contract.json'), 'utf8'));
const provided = new Set(contract.provides);
const result = {
  capabilities: before.capabilities.map(item => provided.has(item.id) ? {
    id: item.id,
    status: 'available',
    constraints: ['Provided by the uninstalled and unpromoted v2.6 TEST adapter; focused tests cover complete deduplicated package reconstruction, equal bracketing snapshots, pending and settled checkpoints, all seven audit classifications, fresh processes, durable-byte identity, transient-lock truth, joint replacement, minimization, and authority boundaries.']
  } : item)
};
const bounded = result.capabilities.filter(item => item.id.startsWith('model.shadow.portable-pin-settlement-history-checkpoint.'));
if (bounded.length !== 24 || bounded.some(item => item.status !== 'available')) throw new Error('bounded v2.6 capability after-state is incomplete');
fs.writeFileSync(path.join(dir, 'CAPABILITY_INVENTORY_AFTER.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log('PASS wrote after inventory with ' + result.capabilities.filter(item => item.status === 'available').length + ' available capabilities');
