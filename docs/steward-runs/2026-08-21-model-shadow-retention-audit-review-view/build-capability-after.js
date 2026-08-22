#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const requirements = JSON.parse(fs.readFileSync(path.join(dir, 'CAPABILITY_REQUIREMENTS.json'), 'utf8'));
const before = JSON.parse(fs.readFileSync(path.join(dir, 'CAPABILITY_INVENTORY_BEFORE.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.resolve(dir, '../../../tools/review-inbox/module.contract.json'), 'utf8'));
const alreadyAvailable = new Set(before.capabilities.filter(item => item.status === 'available').map(item => item.id));
const provided = new Set(contract.provides);
const capabilities = requirements.requirements.flatMap(requirement => requirement.capabilities).map(id => {
  const inherited = alreadyAvailable.has(id);
  const local = provided.has(id);
  const available = inherited || local;
  return {
    id,
    status: available ? 'available' : 'unknown',
    constraints: inherited
      ? ['available before v3.0; exact inherited constraint remains in the before inventory']
      : local
        ? ['TEST browser presentation on caller-selected Review Inbox data; direct v0.3 contract evidence only; coordinated global tools-index refresh remains open']
        : ['not implemented or proven by this bounded read-only view']
  };
});
const output = {
  schema: 'axm.capability-inventory/v1',
  observedAt: '2026-08-21T06:30:00.000Z',
  capabilities
};
fs.writeFileSync(path.join(dir, 'CAPABILITY_INVENTORY_AFTER.json'), JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log('PASS wrote after inventory for ' + capabilities.length + ' capabilities');
