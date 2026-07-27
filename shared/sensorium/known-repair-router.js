'use strict';

const C = require('./core');

function route(input, catalog) {
  input = input || {}; catalog = Array.isArray(catalog) ? catalog : [];
  const signature = C.assertExactIdentifier(input.failureSignature, 'failureSignature');
  const recipe = catalog.find(function (item) { return item.failureSignature === signature && item.approved === true && item.approvedBy === 'Mike'; });
  if (!recipe) return { schema: 'axm.sensorium-known-repair-route/v1', failureSignature: signature, state: 'NOVEL_FAILURE_HOLD', repairBuddyRoute: null, automaticRepair: false, reason: 'No exact human-approved recipe matches this signature.' };
  return { schema: 'axm.sensorium-known-repair-route/v1', failureSignature: signature, state: 'APPROVED_REPLAY_AVAILABLE', repairBuddyRoute: { recipeId: C.assertExactIdentifier(recipe.recipeId, 'recipeId'), recipeDigest: C.digest(recipe), exactSignatureMatch: true }, automaticRepair: false, requiresCurrentAuthority: true, novelDiagnosisAllowed: false };
}
async function dispatch(routeReceipt, repairBuddy, authority) {
  if (!routeReceipt || routeReceipt.state !== 'APPROVED_REPLAY_AVAILABLE') throw new Error('only an exact approved replay may be dispatched');
  if (!authority || authority.allowed !== true || authority.expired === true) throw new Error('current repair authority is required');
  if (!repairBuddy || typeof repairBuddy.replayApproved !== 'function') throw new Error('Repair Buddy adapter is required');
  return repairBuddy.replayApproved(C.clone(routeReceipt.repairBuddyRoute));
}

module.exports = { route, dispatch };
