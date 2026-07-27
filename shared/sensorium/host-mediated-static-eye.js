'use strict';

const C = require('./core');
const CAPABILITY = 'visual.inspect.static/v1';
const RECEIPT_SCHEMA = 'axm.static-eye-observation/v1';

function matches(facts, patterns) {
  const haystack = (facts || []).map(function (fact) { return C.compact(fact, 300).toLowerCase(); });
  return (patterns || []).filter(function (pattern) {
    const needle = C.compact(pattern, 300).toLowerCase();
    return needle && haystack.some(function (fact) { return fact.indexOf(needle) >= 0; });
  });
}
function wrapSuppliedEvidence(input) {
  input = input || {};
  const liveClaim = input.claimKind === 'live' || input.claimKind === 'motion' || input.claimKind === 'temporal';
  const host = input.hostObservation;
  if (!host || !Array.isArray(host.visibleFacts)) {
    return {
      schema: RECEIPT_SCHEMA, capability: CAPABILITY, claim: C.compact(input.claim, 500), observedAt: C.now(input.observedAt),
      targetId: C.compact(input.targetId, 200), verdict: 'UNKNOWN', typed_observation: 'No attributable host static-image observation was supplied.',
      visibleFactDigests: [], absentFactDigests: [], named_seam: input.captureMissing ? 'MISSING_VISUAL_CAPTURE' : 'MISSING_VISUAL_INPUT',
      captureClaimed: false, motionClaimed: false, rawImageRetained: false, cleanupComplete: true
    };
  }
  const visible = host.visibleFacts.slice(0, 40).map(function (fact) { return C.compact(fact, 300); }).filter(Boolean);
  const absent = (host.absentFacts || []).slice(0, 40).map(function (fact) { return C.compact(fact, 300); }).filter(Boolean);
  const expected = matches(visible, input.expectedFacts || []);
  const refuting = matches(visible, input.refutingFacts || []);
  let verdict = refuting.length ? 'FAIL' : ((input.expectedFacts || []).length && expected.length === (input.expectedFacts || []).length ? 'PASS' : 'UNKNOWN');
  let seam = verdict === 'UNKNOWN' ? 'STATIC_EVIDENCE_INCONCLUSIVE' : '';
  if (liveClaim) { verdict = 'UNKNOWN'; seam = 'LIVE_CLAIM_REQUIRES_EYE_2'; }
  return {
    schema: RECEIPT_SCHEMA, capability: CAPABILITY, claim: C.compact(input.claim, 500), observedAt: C.now(input.observedAt || host.observedAt),
    targetId: C.compact(input.targetId, 200), verdict,
    typed_observation: liveClaim ? 'One supplied image cannot prove a live or motion claim.' : (verdict === 'PASS' ? 'The supplied typed static observation supports the claim.' : (verdict === 'FAIL' ? 'The supplied typed static observation refutes the claim.' : 'The supplied typed static observation is inconclusive.')),
    visibleFactDigests: visible.map(C.digest), absentFactDigests: absent.map(C.digest), named_seam: seam,
    hostObservationDigest: C.digest({ visible, absent, attribution: C.compact(host.attribution, 200) }), captureClaimed: false, motionClaimed: false,
    rawImageRetained: false, cleanupComplete: true
  };
}

module.exports = { CAPABILITY, RECEIPT_SCHEMA, wrapSuppliedEvidence };
