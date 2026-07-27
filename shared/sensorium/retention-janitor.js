'use strict';

const C = require('./core');
const CONFIRMATION = 'RELEASE EXACT SENSORIUM ITEMS';

function preview(items) {
  const exact = (Array.isArray(items) ? items : []).slice(0, 200).map(function (item) {
    if (!item || item.ownership !== 'SENSORIUM_OWNED') throw new Error('janitor item ownership must be SENSORIUM_OWNED');
    return { id: C.assertExactIdentifier(item.id, 'janitor id'), path: item.path ? C.assertExactIdentifier(item.path, 'janitor path') : null, ownership: 'SENSORIUM_OWNED' };
  });
  if (!exact.length) throw new Error('at least one exact Sensorium-owned item is required');
  return { schema: 'axm.sensorium-retention-preview/v1', previewId: 'janitor-' + C.digest(exact).slice(0, 20), items: exact, recursive: false, wildcards: false, automaticApply: false };
}
async function release(plan, adapter, confirmation) {
  if (confirmation !== CONFIRMATION) throw new Error('exact janitor confirmation is required');
  if (!adapter || typeof adapter.releaseExact !== 'function' || typeof adapter.status !== 'function') throw new Error('bounded retention adapter is required');
  const released = [];
  for (const item of plan.items || []) { await adapter.releaseExact(C.clone(item)); released.push({ id: item.id, path: item.path, released: true }); }
  const status = await adapter.status();
  const clean = status.rawRetainedBytes === 0 && status.rawRetainedItems === 0;
  return { schema: 'axm.sensorium-retention-janitor/v1', previewId: plan.previewId, released, rawRetainedBytes: Number(status.rawRetainedBytes), rawRetainedItems: Number(status.rawRetainedItems), cleanupComplete: clean, recursive: false, wildcards: false, verdict: clean ? 'PASS' : 'FAIL' };
}

module.exports = { CONFIRMATION, preview, release };
