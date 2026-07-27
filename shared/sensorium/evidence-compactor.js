'use strict';

const C = require('./core');
const Compaction = require('./compaction-steward');

function compact(input, adapter) {
  input = input || {};
  const provenance = (input.provenance || []).slice(0, 50).map(function (item) {
    if (!item || !/^[a-f0-9]{64}$/.test(item.specificReceiptDigest || '') || !/^[a-f0-9]{64}$/.test(item.typedObservationDigest || '')) throw new Error('only sealed receipt provenance may enter evidence compaction');
    if (item.rawPayload || item.frames || item.transcript || item.directoryTree) throw new Error('raw sensory bulk is forbidden');
    return { ownership: 'SENSORIUM_OWNED', containsRawSenseMaterial: false, hotPath: C.assertExactIdentifier(item.hotPath, 'hotPath'), archivePath: C.assertExactIdentifier(item.archivePath, 'archivePath'), range: C.compact(item.range, 200), summary: C.compact(item.summary, 500) };
  });
  const steward = Compaction.create({ adapter });
  const plan = steward.preview({ items: provenance, boundaryRule: C.compact(input.boundaryRule, 300) });
  return steward.apply(plan, Compaction.CONFIRMATION);
}

module.exports = { compact };
