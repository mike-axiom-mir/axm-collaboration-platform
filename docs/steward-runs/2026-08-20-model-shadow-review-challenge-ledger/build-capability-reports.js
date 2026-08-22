#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));

function compare(requirements, inventory) {
  const capabilities = new Map(inventory.capabilities.map(item => [item.id, item]));
  const routes = requirements.requirements.map(requirement => {
    const groups = { available: [], degraded: [], unknown: [], missing: [] };
    const declaredConstraints = {};
    for (const capabilityId of requirement.capabilities) {
      const capability = capabilities.get(capabilityId);
      const status = capability ? capability.status : 'missing';
      if (!Object.prototype.hasOwnProperty.call(groups, status)) throw new Error('unsupported capability status: ' + status);
      groups[status].push(capabilityId);
      if (capability && capability.constraints && capability.constraints.length) {
        declaredConstraints[capabilityId] = capability.constraints;
      }
    }
    let status;
    if (groups.missing.length) status = requirement.required ? 'BLOCKED' : 'OPTIONAL_MISSING';
    else if (groups.unknown.length) status = requirement.required ? 'UNKNOWN' : 'OPTIONAL_UNKNOWN';
    else if (groups.degraded.length) status = requirement.required ? 'DEGRADED' : 'OPTIONAL_DEGRADED';
    else status = requirement.required ? 'READY' : 'OPTIONAL_READY';
    return {
      id: requirement.id,
      required: requirement.required,
      status,
      available: groups.available,
      degraded: groups.degraded,
      unknown: groups.unknown,
      missing: groups.missing,
      declaredConstraints
    };
  });
  const required = routes.filter(item => item.required);
  const optional = routes.filter(item => !item.required);
  let overall = 'READY';
  if (required.some(item => item.status === 'BLOCKED')) overall = 'BLOCKED';
  else if (required.some(item => item.status === 'UNKNOWN')) overall = 'UNKNOWN';
  else if (required.some(item => item.status === 'DEGRADED') || optional.some(item => item.status !== 'OPTIONAL_READY')) overall = 'DEGRADED';
  const missingCapabilities = Array.from(new Set(required.flatMap(item => item.missing))).sort();
  return {
    schema: 'capability-gap-report/v1',
    overall,
    requirements: routes,
    missingCapabilities,
    proposedHands: missingCapabilities.map(capabilityId => ({
      capabilityId,
      requiredBy: required.filter(item => item.missing.includes(capabilityId)).map(item => item.id),
      contractStatus: 'SPEC_REQUIRED',
      requiredContractFields: [
        'inputs', 'outputs', 'sideEffects', 'permissions', 'resourceBudget',
        'failureRecovery', 'compatibility', 'verification'
      ]
    }))
  };
}

const requirements = read('CAPABILITY_REQUIREMENTS.json');
for (const phase of ['BEFORE', 'AFTER']) {
  const inventory = read('CAPABILITY_INVENTORY_' + phase + '.json');
  const report = compare(requirements, inventory);
  fs.writeFileSync(path.join(__dirname, 'CAPABILITY_GAP_' + phase + '.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log('PASS wrote ' + phase.toLowerCase() + ' capability report: ' + report.overall);
}
