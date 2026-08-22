#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const dir = __dirname;
const before = JSON.parse(fs.readFileSync(path.join(dir, 'CAPABILITY_INVENTORY_BEFORE.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.resolve(dir, '../../../shared/model-shadow-history-checkpoint-retention-ledger/module.contract.json'), 'utf8'));
const provided = new Set(contract.provides);
const constraints = [
  'Provided by the uninstalled and unpromoted v2.7 TEST adapter; focused tests cover distinct local roots, exact v2.6 origin rebuild, full-checkpoint proposal persistence, separate settlement, forward-only succession, pending and settled audits, rollback and absence detection, fresh-process reload, concurrent writers, corruption, joint replacement, minimization, resource limits, and authority boundaries.'
];
const output = {
  capabilities: before.capabilities.map(item => provided.has(item.id) ? { id: item.id, status: 'available', constraints } : item)
};
fs.writeFileSync(path.join(dir, 'CAPABILITY_INVENTORY_AFTER.json'), JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log('PASS wrote capability inventory after implementation');
