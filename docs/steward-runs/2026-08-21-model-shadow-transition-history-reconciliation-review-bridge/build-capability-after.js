#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const root = path.resolve(dir, '../../..');
const requirements = JSON.parse(fs.readFileSync(path.join(dir, 'CAPABILITY_REQUIREMENTS.json'), 'utf8'));
const before = JSON.parse(fs.readFileSync(path.join(dir, 'CAPABILITY_INVENTORY_BEFORE.json'), 'utf8'));
const upstream = JSON.parse(fs.readFileSync(path.join(root, 'shared/model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer/module.contract.json'), 'utf8'));
const bridge = JSON.parse(fs.readFileSync(path.join(root, 'shared/model-shadow-retention-audit-review-outcome-transition-settlement-history-reconciliation-review-request/module.contract.json'), 'utf8'));
const inbox = JSON.parse(fs.readFileSync(path.join(root, 'tools/review-inbox/module.contract.json'), 'utf8'));
const inherited = new Map(before.capabilities.filter(item => item.status === 'available').map(item => [item.id, item.constraints]));
const provided = new Set(upstream.provides.concat(bridge.provides, inbox.provides));
const capabilities = requirements.requirements.flatMap(item => item.capabilities).map(id => {
  if (inherited.has(id)) return { id, status:'available', constraints:inherited.get(id) };
  if (provided.has(id)) return { id, status:'available', constraints:['TEST data-only reconciliation-review artifact and fail-closed typed UI over caller-presented v3.9 divergence; no live submission identity reconciliation globality consequential authority benefit or learning'] };
  return { id, status:'unknown', constraints:['not implemented or proven by this bounded v4.0 bridge and typed read-only review view'] };
});
const output = { schema:'axm.capability-inventory/v1', observedAt:'2026-08-21T18:30:00.000Z', capabilities };
fs.writeFileSync(path.join(dir, 'CAPABILITY_INVENTORY_AFTER.json'), JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log('PASS wrote after inventory for ' + capabilities.length + ' capabilities');
