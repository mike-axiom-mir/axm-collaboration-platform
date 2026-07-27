'use strict';

const assert = require('assert');
const Compaction = require('../compaction-steward');
const Runtime = require('../runtime-route');

function memoryAdapter(corrupt) {
  const rows = { hot: 'verified provenance' }, replaced = [];
  return { rows, replaced, read: function (key) { const value = rows[key]; return corrupt && key === 'cold' && value != null ? value + '-corrupt' : value; }, writeArchive: function (key, value) { rows[key] = value; }, replaceHotWithDigest: function (key, value) { rows[key] = value; replaced.push(key); } };
}
async function run() {
  const good = memoryAdapter(false), steward = Compaction.create({ adapter: good });
  const plan = steward.preview({ boundaryRule: 'verified cold records', items: [{ ownership: 'SENSORIUM_OWNED', containsRawSenseMaterial: false, hotPath: 'hot', archivePath: 'cold', range: '1-2', summary: 'two verified receipts' }] });
  const receipt = steward.apply(plan, Compaction.CONFIRMATION);
  assert.equal(receipt.record_compacted[0].archiveHashVerified, true); assert.ok(good.rows.hot.includes('archiveSha256'));
  const bad = memoryAdapter(true), failed = Compaction.create({ adapter: bad }); let integrityHeld = false;
  try { failed.apply(failed.preview({ boundaryRule: 'cold', items: [{ ownership: 'SENSORIUM_OWNED', hotPath: 'hot', archivePath: 'cold', summary: 'x' }] }), Compaction.CONFIRMATION); } catch (error) { integrityHeld = /ARCHIVE_INTEGRITY_SEAM/.test(error.message); }
  assert.equal(integrityHeld, true); assert.equal(bad.rows.hot, 'verified provenance'); assert.equal(bad.replaced.length, 0);
  let ownershipHeld = false, rawHeld = false;
  try { steward.preview({ items: [{ hotPath: 'hot', archivePath: 'cold' }] }); } catch (error) { ownershipHeld = /ownership/.test(error.message); }
  try { steward.preview({ items: [{ ownership: 'SENSORIUM_OWNED', containsRawSenseMaterial: true, hotPath: 'hot', archivePath: 'cold' }] }); } catch (error) { rawHeld = /raw sensory/.test(error.message); }
  assert.equal(ownershipHeld, true); assert.equal(rawHeld, true);
  async function use(n) { const adapter = memoryAdapter(false); return Runtime.invoke('compaction-steward', { boundaryRule: 'cold', confirmation: Compaction.CONFIRMATION, items: [{ ownership: 'SENSORIUM_OWNED', containsRawSenseMaterial: false, hotPath: 'hot', archivePath: 'cold', range: String(n), summary: 'receipt' }] }, { claimId: 'claim-compaction-' + n, seatId: 'seat-test', targetId: 'owned-provenance', adapters: { compaction: adapter } }); }
  const first = await use(1), second = await use(2);
  return { senseId: 'compaction-steward', verdict: 'PASS', positive: receipt, negative: [{ integrityHeld, ownershipHeld, rawHeld }], envelopes: [first.envelope, second.envelope], uses: [0, 0], rawRetainedBytes: 0, rawRetainedItems: 0 };
}

module.exports = { run };
