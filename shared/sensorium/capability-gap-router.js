'use strict';

const C = require('./core');
const Adapter = require('./adapter-contract');

function route(input) {
  input = input || {};
  const result = Adapter.negotiate(input, input.adapters || []);
  let routeKind = 'REUSE';
  if (result.state === 'UNKNOWN') routeKind = input.composableCapabilities && input.composableCapabilities.length ? 'COMPOSE' : 'HOLD';
  else if (result.state === 'DEGRADED') routeKind = 'ADAPT';
  else if (result.state === 'BLOCKED') routeKind = 'HOLD';
  return {
    schema: 'axm.sensorium-capability-gap/v1', requestedCapability: C.compact(input.capability, 160), state: result.state,
    route: routeKind, adapterId: result.adapterId, reasons: result.reasons || [],
    cheapestAlternative: result.cheapestAlternative || (routeKind === 'REUSE' ? 'Use the declared adapter within its constraints.' : (routeKind === 'COMPOSE' ? 'Compose the declared available senses and keep the dependent claim UNKNOWN.' : 'Hold the dependent claim until a real adapter or supplied evidence is available.')),
    novelCapability: result.state === 'UNKNOWN', automaticRepair: false, dependencyInstallAttempted: false, authorityInherited: false
  };
}

module.exports = { route };
