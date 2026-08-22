#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const requirements = JSON.parse(fs.readFileSync(path.join(dir, 'CAPABILITY_REQUIREMENTS.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.resolve(dir, '../../../shared/model-shadow-retention-audit-review-request/module.contract.json'), 'utf8'));
const provided = new Set(contract.provides);
const capabilities = requirements.requirements.flatMap(requirement => requirement.capabilities).map(id => ({
  id,
  status: provided.has(id) ? 'available' : 'unknown',
  constraints: provided.has(id)
    ? ['TEST data-only bridge on caller-presented local state; exact limits remain in the v2.9 module contract']
    : ['not implemented or proven by this bounded local bridge']
}));
const output = {
  schema: 'axm.capability-inventory/v1',
  observedAt: '2026-08-21T06:00:00.000Z',
  capabilities
};
fs.writeFileSync(path.join(dir, 'CAPABILITY_INVENTORY_AFTER.json'), JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log('PASS wrote after inventory for ' + capabilities.length + ' capabilities');
