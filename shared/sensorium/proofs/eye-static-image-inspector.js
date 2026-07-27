'use strict';

const assert = require('assert');
const Runtime = require('../runtime-route');
const StaticEye = require('../host-mediated-static-eye');

async function run() {
  const at = '2026-07-22T12:00:00.000Z';
  const pass = StaticEye.wrapSuppliedEvidence({ claim: 'The Files list shows a Builder roadmap link.', targetId: 'known-screenshot', observedAt: at, expectedFacts: ['Builder roadmap'], refutingFacts: ['Delete roadmap'], hostObservation: { observedAt: at, attribution: 'host-static-inspector', visibleFacts: ['Files list', 'Builder roadmap', 'Machine-readable roadmap'], absentFacts: ['Delete roadmap'] } });
  const missing = StaticEye.wrapSuppliedEvidence({ claim: 'A visual fact', targetId: 'missing', observedAt: at });
  const motion = StaticEye.wrapSuppliedEvidence({ claim: 'The page animates', claimKind: 'motion', targetId: 'known-screenshot', observedAt: at, expectedFacts: ['page'], hostObservation: { visibleFacts: ['page'] } });
  assert.equal(pass.verdict, 'PASS'); assert.equal(pass.captureClaimed, false); assert.equal(pass.rawImageRetained, false);
  assert.equal(missing.verdict, 'UNKNOWN'); assert.ok(['MISSING_VISUAL_INPUT','MISSING_VISUAL_CAPTURE'].includes(missing.named_seam));
  assert.equal(motion.verdict, 'UNKNOWN'); assert.equal(motion.named_seam, 'LIVE_CLAIM_REQUIRES_EYE_2');
  const routed = await Runtime.invoke('eye-static-image-inspector', { claim: 'Builder roadmap visible', targetId: 'known-screenshot', observedAt: at, sealedAt: at, expectedFacts: ['Builder roadmap'], hostObservation: { visibleFacts: ['Builder roadmap'], absentFacts: [] } }, { claimId: 'claim-static-eye', seatId: 'seat-test', targetId: 'known-screenshot', backendId: 'host-static', ttlMs: 60000 });
  assert.equal(routed.envelope.verdict, 'PASS'); assert.equal(routed.envelope.rawRetainedBytesAfterSeal, 0);
  return { senseId: 'eye-static-image-inspector', verdict: 'PASS', positive: pass, negative: [missing, motion], envelopes: [routed.envelope], uses: [0, 0], rawRetainedBytes: 0, rawRetainedItems: 0 };
}

module.exports = { run };
