#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const requirements = JSON.parse(fs.readFileSync(path.join(dir, 'CAPABILITY_REQUIREMENTS.json'), 'utf8'));
const before = JSON.parse(fs.readFileSync(path.join(dir, 'CAPABILITY_INVENTORY_BEFORE.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.resolve(dir, '../../../shared/model-shadow-retention-audit-review-outcome-ledger/module.contract.json'), 'utf8'));
const inherited = new Map(before.capabilities.filter(item => item.status === 'available').map(item => [item.id, item.constraints]));
const provided = new Set(contract.provides);
const capabilities = requirements.requirements.flatMap(requirement => requirement.capabilities).map(id => {
  if (inherited.has(id)) return { id, status: 'available', constraints: inherited.get(id) };
  if (provided.has(id)) {
    return {
      id,
      status: 'available',
      constraints: ['TEST caller-owned local filesystem continuity; exact v3.1 rebuild occurs before capture; local full rewrites, external custody, hardware durability, identity, hold resolution, and consequential authority remain unproven']
    };
  }
  return { id, status: 'unknown', constraints: ['not implemented or proven by this bounded v3.2 ledger'] };
});
const output = {
  schema: 'axm.capability-inventory/v1',
  observedAt: '2026-08-21T07:20:00.000Z',
  capabilities
};
fs.writeFileSync(path.join(dir, 'CAPABILITY_INVENTORY_AFTER.json'), JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log('PASS wrote after inventory for ' + capabilities.length + ' capabilities');
