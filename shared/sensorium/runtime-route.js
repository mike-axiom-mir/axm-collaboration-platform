'use strict';

const path = require('path');
const C = require('./core');
const Envelope = require('./receipt-envelope');
const registry = require('./registry.json');

function row(id) {
  const found = (registry.senses || []).find(function (sense) { return sense.id === id; });
  if (!found) throw new Error('unknown Sensorium sense: ' + id);
  return found;
}
function moduleFor(route) { return require(path.resolve(__dirname, route.module)); }
function verdictFor(route, receipt, input) {
  if (input && ['PASS','FAIL','UNKNOWN'].indexOf(input.verdict) >= 0) return input.verdict;
  if (['PASS','FAIL','UNKNOWN'].indexOf(receipt.verdict) >= 0) return receipt.verdict;
  if (route.id === 'time-sense-ttl-verifier') return receipt.status === 'LIVE' ? 'PASS' : 'UNKNOWN';
  if (route.id === 'touch-environment-probe') return receipt.safe_to_proceed_as_contracted ? 'PASS' : (receipt.mismatches && receipt.mismatches.length ? 'FAIL' : 'UNKNOWN');
  if (route.id === 'handoff-continuity-steward') return receipt.chain_intact && receipt.access_state_reread_from_gates ? 'PASS' : 'UNKNOWN';
  if (route.id === 'compaction-steward') return receipt.integrity_seam ? 'FAIL' : 'PASS';
  if (route.id === 'drift-detector-ambient') return receipt.verdict === 'NO_DRIFT_OBSERVED' ? 'PASS' : (receipt.verdict === 'DRIFT_FLAGGED' ? 'FAIL' : 'UNKNOWN');
  if (route.id === 'corroboration-triangulator') return receipt.agreement === 'CONVERGENT' ? 'PASS' : (receipt.agreement === 'DIVERGENT' ? 'FAIL' : 'UNKNOWN');
  if (route.id === 'interoception-capacity-gauge') return receipt.state === 'UNKNOWN' ? 'UNKNOWN' : 'PASS';
  if (route.id === 'taint-sniffer') return receipt.state === 'NO_TAINT_SIGNAL' ? 'PASS' : (receipt.state === 'TAINT_SIGNALLED' ? 'FAIL' : 'UNKNOWN');
  if (route.id === 'eye-change-differ') return receipt.verdict === 'INCOMPARABLE' ? 'UNKNOWN' : receipt.verdict;
  if (route.id === 'eye-accessibility-inspector') return receipt.verdict;
  return 'UNKNOWN';
}
function seamsFor(receipt) {
  return ['named_seam','hearing_seam','environment_seam','continuity_seam','integrity_seam'].map(function (key) { return C.compact(receipt[key], 160); }).filter(Boolean)
    .concat((receipt.unknown_environment_hold || []).map(function (hold) { return C.compact(hold.kind || hold, 160); }))
    .concat((receipt.possible_drift || []).map(function (hold) { return C.compact(hold, 160); }))
    .concat((receipt.namedSeams || []).map(function (hold) { return C.compact(hold, 160); }))
    .concat((receipt.divergenceAxis || []).map(function (hold) { return C.compact(hold, 160); })).slice(0, 20);
}
async function execute(route, input, adapters) {
  input = input || {}; adapters = adapters || {};
  if (route.id === 'eye-static-image-inspector') return moduleFor(route).wrapSuppliedEvidence(input);
  if (route.id === 'eye-live-visual-verifier') {
    if (typeof adapters.captureFrame !== 'function') {
      return { schema: route.specificReceiptSchema, capability: route.capability, openedAt: C.now(input.observedAt), sealedAt: C.now(input.sealedAt || input.observedAt), verdict: 'UNKNOWN', typed_observation: 'No visual capture adapter was supplied.', named_seam: 'MISSING_VISUAL_CAPTURE', framesObserved: 0, evictedFrames: 0, bufferDigest: C.digest([]), temporaryFramesDeleted: 0, temporaryBytesReleased: 0, cleanupComplete: true, rawVideoArchive: false };
    }
    const Eye = moduleFor(route);
    const eye = Eye.create({ captureFrame: adapters.captureFrame, maxFrames: input.maxFrames || 8, maxBytes: input.maxBytes || 4000000 });
    const count = Math.max(1, Math.min(Number(input.frameCount) || 2, input.maxFrames || 8));
    for (let index = 0; index < count; index += 1) await eye.captureNow();
    const sealed = await eye.seal({ verdict: input.verdict || 'UNKNOWN', typed_observation: C.compact(input.typedObservation || 'Host visual interpretation required.', 500), named_seam: C.compact(input.namedSeam, 160) });
    return eye.cleanup(sealed);
  }
  const mod = moduleFor(route);
  const options = Object.assign({}, input.options || {});
  if (route.id === 'ears-stream-listener') options.readWindow = adapters.readWindow;
  if (route.id === 'touch-environment-probe' && adapters.environment) options.adapter = adapters.environment;
  if (route.id === 'handoff-continuity-steward' && adapters.continuityStore) options.store = adapters.continuityStore;
  if (route.id === 'compaction-steward') options.adapter = adapters.compaction;
  if (route.id === 'interoception-capacity-gauge') options.readCapacity = adapters.readSeatCapacity;
  if (route.id === 'eye-accessibility-inspector') options.readComputedStyles = adapters.readComputedStyles;
  const instance = mod[route.factory](options);
  if (route.id === 'time-sense-ttl-verifier') {
    const stamped = input.stamped || instance.stamp(input);
    return instance.check(stamped, { at: input.at, reverified: input.reverified, decisionTtlMs: input.decisionTtlMs });
  }
  if (route.id === 'compaction-steward') {
    const preview = instance.preview(input);
    return instance.apply(preview, input.confirmation);
  }
  return await instance[route.operation](input);
}
async function invoke(id, input, context) {
  input = input || {}; context = context || {};
  const route = row(id);
  const specificReceipt = await execute(route, input, context.adapters);
  const status = route.executorStatus === 'HOST_MEDIATED' ? { rawRetainedBytes: 0, rawRetainedItems: 0 } : { rawRetainedBytes: 0, rawRetainedItems: 0 };
  const envelope = Envelope.create({
    claimId: context.claimId || input.claimId || 'claim-unassigned', senseId: route.id, capability: route.capability,
    seatId: context.seatId || input.seatId || 'seat-unknown', targetId: context.targetId || input.targetId || input.source || 'target-unknown',
    backendId: context.backendId || input.backendId || route.routeType.toLowerCase(), observedAt: input.observedAt || specificReceipt.observedAt || specificReceipt.observed_at || specificReceipt.window_start || specificReceipt.openedAt,
    sealedAt: input.sealedAt || specificReceipt.sealedAt || specificReceipt.window_end || specificReceipt.written_at || specificReceipt.observedAt,
    ttlMs: context.ttlMs || input.ttlMs, freshnessStatus: context.freshnessStatus, verdict: verdictFor(route, specificReceipt, input),
    namedSeams: seamsFor(specificReceipt), typedObservation: specificReceipt.typed_observation || specificReceipt,
    specificReceiptSchema: specificReceipt.schema, specificReceipt, authorityLeaseId: context.authorityLeaseId || null,
    rawRetainedBytesAfterSeal: status.rawRetainedBytes, rawRetainedItemsAfterSeal: status.rawRetainedItems, cleanupComplete: specificReceipt.cleanupComplete !== false
  });
  return { schema: 'axm.sensorium-route-result/v1', routeId: route.id, claimId: envelope.claimId, specificReceipt, envelope };
}

module.exports = { invoke, execute, verdictFor, seamsFor, row };
