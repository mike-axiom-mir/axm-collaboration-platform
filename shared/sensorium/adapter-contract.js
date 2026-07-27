'use strict';

const C = require('./core');
const SCHEMA = 'axm.sensorium-host-adapter/v1';
const STATES = ['READY', 'DEGRADED', 'BLOCKED', 'UNKNOWN'];
const OPERATIONS = ['open', 'observe', 'seal', 'release', 'status'];

function validate(adapter) {
  const errors = [];
  if (!adapter || adapter.schema !== SCHEMA) errors.push('wrong schema');
  if (!adapter) return { ok: false, errors };
  ['adapterId','version','targetIsolation'].forEach(function (key) { if (!C.compact(adapter[key])) errors.push('missing ' + key); });
  if (!Array.isArray(adapter.capabilities) || !adapter.capabilities.length) errors.push('capabilities must be non-empty');
  if (!Array.isArray(adapter.constraints)) errors.push('constraints must be an array');
  if (!adapter.resourceBudget || typeof adapter.resourceBudget !== 'object') errors.push('resourceBudget is required');
  if (typeof adapter.authorityRequired !== 'boolean') errors.push('authorityRequired must be boolean');
  if (!Array.isArray(adapter.operations) || OPERATIONS.some(function (operation) { return adapter.operations.indexOf(operation) < 0; })) errors.push('all lifecycle operations are required');
  if (adapter.autoInstall === true) errors.push('autoInstall is forbidden');
  return { ok: errors.length === 0, errors };
}
function negotiate(request, adapters) {
  request = request || {}; adapters = Array.isArray(adapters) ? adapters : [];
  const capability = C.assertExactIdentifier(request.capability, 'requested capability');
  const candidates = adapters.filter(function (adapter) { return Array.isArray(adapter.capabilities) && adapter.capabilities.indexOf(capability) >= 0; });
  if (!candidates.length) return { schema: 'axm.sensorium-adapter-negotiation/v1', capability, state: 'UNKNOWN', adapterId: null, reasons: ['No declared host adapter exposes the capability.'], cheapestAlternative: request.cheapestAlternative || 'Supply typed evidence or choose a dependent claim that does not need this sense.', dependencyInstallAttempted: false, authorityInherited: false };
  const adapter = candidates[0], checked = validate(adapter);
  if (!checked.ok) return { schema: 'axm.sensorium-adapter-negotiation/v1', capability, state: 'BLOCKED', adapterId: adapter.adapterId || null, reasons: checked.errors, cheapestAlternative: 'Repair the adapter contract without installing dependencies.', dependencyInstallAttempted: false, authorityInherited: false };
  const reasons = [];
  let state = 'READY';
  if (adapter.authorityRequired && !request.authorityLeaseId) { state = 'BLOCKED'; reasons.push('A current exact authority lease is required.'); }
  if (request.authorityExpiresAt && Date.parse(request.authorityExpiresAt) <= Date.parse(request.at || new Date().toISOString())) { state = 'BLOCKED'; reasons.push('The supplied authority lease is expired.'); }
  if (request.targetIsolation === 'EXACT_WINDOW' && adapter.targetIsolation !== 'EXACT_WINDOW') { state = state === 'BLOCKED' ? state : 'DEGRADED'; reasons.push('Exact named-window isolation is unavailable.'); }
  if (adapter.constraints.indexOf('WINDOWS_WINDOW_ISOLATION_UNAVAILABLE') >= 0) { state = state === 'BLOCKED' ? state : 'DEGRADED'; reasons.push('WINDOWS_WINDOW_ISOLATION_UNAVAILABLE'); }
  if (request.repeated === true && (!Number.isFinite(Number(adapter.resourceBudget.maxBytes)) || !Number.isFinite(Number(adapter.resourceBudget.minimumCadenceMs)) || !Number.isFinite(Number(adapter.resourceBudget.maxThermalC)))) { state = state === 'BLOCKED' ? state : 'DEGRADED'; reasons.push('Repeated observation requires declared memory, cadence, and thermal budgets.'); }
  return { schema: 'axm.sensorium-adapter-negotiation/v1', capability, state, adapterId: adapter.adapterId, adapterVersion: adapter.version, constraints: adapter.constraints.slice(), resourceBudget: C.clone(adapter.resourceBudget), authorityLeaseId: request.authorityLeaseId || null, authorityInherited: false, reasons, dependencyInstallAttempted: false };
}

module.exports = { SCHEMA, STATES, OPERATIONS, validate, negotiate };
