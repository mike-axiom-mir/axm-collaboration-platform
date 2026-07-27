'use strict';

const Core = require('./core');

function tokens(value) { return Core.list(String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter(item => item.length > 2), 100); }
function related(capabilityId, inventory) {
  const wanted = tokens(capabilityId);
  return inventory.map(item => {
    const shared = tokens(item.id).filter(token => wanted.includes(token));
    return { capabilityId: item.id, providers: item.providers, score: shared.length, status: item.status };
  }).filter(item => item.score > 0 && item.capabilityId !== capabilityId).sort((a, b) => b.score - a.score || a.capabilityId.localeCompare(b.capabilityId)).slice(0, 3);
}
function route(gaps, snapshot) {
  const inventory = new Map(snapshot.capabilities.map(item => [item.id, item]));
  return gaps.map(gap => {
    const exact = inventory.get(gap.capabilityId);
    let routeType = 'BUILD_NEW_BOUNDED_HAND';
    if (gap.gapType === 'AUTHORITY') routeType = 'REQUEST_STEWARD_DECISION';
    else if (gap.status === 'UNKNOWN' || gap.gapType === 'EVIDENCE') routeType = 'VERIFY_BEFORE_BUILD';
    else if (exact && exact.status === 'available') routeType = 'REUSE_DECLARED_PROVIDER';
    else if (exact && exact.status === 'degraded') routeType = 'IMPROVE_EXISTING_CAPABILITY';
    else if (gap.gapType === 'CONTRACT') routeType = 'ADD_VERSIONED_ADAPTER_OR_CONTRACT';
    else if (gap.gapType === 'SUBSTRATE') routeType = 'REQUEST_MINIMUM_SUBSTRATE';
    return {
      schema: 'axm.research-hypothesis/v1',
      id: Core.id('hypothesis', { gap: gap.id, routeType }),
      gapId: gap.id,
      routeType,
      statement: routeType.replace(/_/g, ' ') + ' is the cheapest honest route for ' + gap.capabilityId + '.',
      exactProvider: exact ? { status: exact.status, providers: exact.providers } : null,
      semanticLeads: related(gap.capabilityId, snapshot.capabilities),
      semanticLeadWarning: 'Token overlap is a research lead only and never satisfies an exact capability requirement.',
      verdict: 'HYPOTHESIS',
      automaticBuild: false
    };
  });
}

module.exports = { route };
