#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const requirements = JSON.parse(fs.readFileSync(path.join(dir, 'CAPABILITY_REQUIREMENTS.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.resolve(dir, '../../../shared/model-shadow-retention-audit-observation-ledger/module.contract.json'), 'utf8'));
const provided = new Set(contract.provides);
const capabilities = requirements.requirements.flatMap(requirement => requirement.capabilities).map(id => ({
  id,
  status: provided.has(id) ? 'available' : 'unknown',
  constraints: provided.has(id)
    ? ['TEST implementation on one caller-controlled host; exact limits remain in the module contract']
    : ['not implemented or proven by this bounded local adapter']
}));
const output = {
  schema: 'axm.capability-inventory/v1',
  observedAt: '2026-08-21T05:00:00.000Z',
  capabilities
};
fs.writeFileSync(path.join(dir, 'CAPABILITY_INVENTORY_AFTER.json'), JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log('PASS wrote after inventory for ' + capabilities.length + ' capabilities');
