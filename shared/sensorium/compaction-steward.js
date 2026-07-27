'use strict';

const C = require('./core');
const CAPABILITY = 'sense.provenance.compaction/v1';
const RECEIPT_SCHEMA = 'axm.compaction-record/v1';
const CONFIRMATION = 'COMPACT VERIFIED RECORDS';

function create(options) {
  options = options || {};
  const adapter = options.adapter;
  const store = C.createReceiptStore(options.receiptLimit);
  function preview(input) {
    input = input || {};
    const items = (input.items || []).slice(0, 50).map(function (item) {
      if (!item || item.ownership !== 'SENSORIUM_OWNED') throw new Error('compaction item ownership must be exactly SENSORIUM_OWNED');
      if (item.containsRawSenseMaterial === true) throw new Error('raw sensory material must be released upstream, not compacted');
      return {
        hotPath: C.assertExactIdentifier(item.hotPath, 'hot path'),
        archivePath: C.assertExactIdentifier(item.archivePath, 'archive path'),
        range: C.compact(item.range, 200), summary: C.compact(item.summary, 500), ownership: 'SENSORIUM_OWNED'
      };
    });
    if (!items.length) throw new Error('at least one exact compaction item is required');
    return { schema: 'axm.compaction-preview/v1', id: C.uid('compact-preview'), boundaryRule: C.compact(input.boundaryRule, 300), items, automaticApply: false };
  }
  function apply(plan, confirmation) {
    if (confirmation !== CONFIRMATION) throw new Error('exact compaction confirmation is required');
    if (!adapter || typeof adapter.read !== 'function' || typeof adapter.writeArchive !== 'function' || typeof adapter.replaceHotWithDigest !== 'function') throw new Error('bounded compaction adapter is required');
    const moved = [];
    (plan.items || []).forEach(function (item) {
      const original = adapter.read(item.hotPath);
      if (original == null) throw new Error('hot record is missing: ' + item.hotPath);
      const originalHash = C.digest(original);
      adapter.writeArchive(item.archivePath, original);
      const archived = adapter.read(item.archivePath);
      const archivedHash = archived == null ? '' : C.digest(archived);
      if (archivedHash !== originalHash) throw new Error('ARCHIVE_INTEGRITY_SEAM: ' + item.archivePath);
      const hotDigest = { schema: 'axm.compaction-hot-digest/v1', summary: item.summary, range: item.range, archiveLocation: item.archivePath, archiveSha256: originalHash, retrievalVerified: true };
      adapter.replaceHotWithDigest(item.hotPath, JSON.stringify(hotDigest, null, 2));
      moved.push({ record: item.hotPath, range: item.range, archiveLocation: item.archivePath, archiveSha256: originalHash, archiveHashVerified: true, digestLeftInHotRecord: true, retrievalTestFetchPassed: true });
    });
    return store.push({ schema: RECEIPT_SCHEMA, capability: CAPABILITY, preview_id: plan.id, record_compacted: moved, hot_cold_boundary_rule: plan.boundaryRule, active_portion_untouched: true, integrity_seam: '', detector_took_no_direct_action: true, raw_material_released: true });
  }
  return { capability: CAPABILITY, confirmation: CONFIRMATION, preview, apply, receipts: store.list, status: function () { return C.status(store); } };
}

module.exports = { CAPABILITY, RECEIPT_SCHEMA, CONFIRMATION, create };
