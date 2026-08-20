#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Continuity = require('./verification-snapshot-continuity');

let assertions = 0;
function check(value, message) {
  assertions += 1;
  assert.ok(value, message);
}
function equal(actual, expected, message) {
  assertions += 1;
  assert.strictEqual(actual, expected, message);
}

function historical(options) {
  const opts = options || {};
  const receipt = {
    schema: 'axm.synthetic-verification/v1',
    status: 'TEST',
    sourceRefs: opts.noDerived ? [
      { path: 'shared/example/index.js', sha256: 'sha256:' + '1'.repeat(64) }
    ] : [
      { path: 'shared/example/index.js', sha256: 'sha256:' + '1'.repeat(64) },
      { path: Continuity.MUTABLE_DERIVED_PATH, sha256: 'sha256:' + '2'.repeat(64) }
    ],
    verificationDigest: null
  };
  if (opts.conflicting) {
    receipt.sources = [{ path: 'shared/example/index.js', sha256: 'sha256:' + '9'.repeat(64) }];
  }
  if (opts.noDigest) {
    delete receipt.verificationDigest;
  } else {
    const payload = Continuity.clone(receipt);
    delete payload.verificationDigest;
    receipt.verificationDigest = Continuity.sha256(payload);
    if (opts.badDigest) receipt.verificationDigest = 'sha256:' + '0'.repeat(64);
  }
  return receipt;
}

function input(receipt, options) {
  const opts = options || {};
  const sources = [
    { path: 'shared/example/index.js', sha256: 'sha256:' + (opts.trackedDrift ? '3' : '1').repeat(64) },
    { path: Continuity.MUTABLE_DERIVED_PATH, sha256: 'sha256:' + (opts.derivedExact ? '2' : '4').repeat(64) }
  ];
  if (opts.missingTracked) sources.shift();
  if (opts.extra) sources.push({ path: 'shared/example/extra.js', sha256: 'sha256:' + '5'.repeat(64) });
  return {
    continuityId: 'continuity:synthetic',
    checkedAt: '2026-08-19T20:00:00.000Z',
    historicalReceiptRef: {
      path: 'docs/example/VERIFICATION_RECEIPT.json',
      sha256: Continuity.sha256(Buffer.from(JSON.stringify(receipt), 'utf8'))
    },
    historicalReceipt: receipt,
    currentSources: sources,
    currentDerivedView: {
      path: opts.wrongPath ? 'exports/other.json' : Continuity.MUTABLE_DERIVED_PATH,
      sha256: sources.find(item => item.path === Continuity.MUTABLE_DERIVED_PATH).sha256,
      schema: opts.wrongSchema ? 'axm.other/v1' : Continuity.MUTABLE_DERIVED_SCHEMA,
      verdict: 'VERIFIED_WITH_LIMITS',
      failures: 0,
      holds: 0,
      warningGroups: 2,
      invalidReceipts: 0
    }
  };
}

const exactInput = input(historical(), { derivedExact: true });
const exact = Continuity.build(exactInput);
equal(exact.schema, Continuity.RECEIPT_SCHEMA, 'receipt schema');
equal(exact.status, 'TEST', 'status');
equal(exact.decision.classification, 'CURRENT_SOURCE_SET_EXACT', 'exact classification');
equal(exact.decision.bestAction, 'NO_CONTINUITY_REPAIR_REQUIRED', 'exact action');
equal(exact.historicalReceipt.selfDigest.state, 'VALID', 'historical digest valid');
equal(exact.comparison.trackedSourceDrift.length, 0, 'no tracked drift');
equal(exact.comparison.mutableDerivedView.changed, false, 'derived view exact');
equal(exact.truth.currentBroadVerificationClaimedByThisReceipt, false, 'no current broad claim');
equal(exact.truth.authorityGranted, false, 'no authority');
check(/^sha256:[0-9a-f]{64}$/.test(exact.continuityDigest), 'continuity digest');
check(Continuity.verify(exactInput, exact).pass, 'exact rebuild verifies');

const derived = Continuity.build(input(historical()));
equal(derived.decision.classification, 'MUTABLE_DERIVED_VIEW_DRIFT_ONLY', 'derived-only drift');
equal(derived.comparison.trackedSourceDrift.length, 0, 'derived drift does not create tracked drift');
equal(derived.comparison.mutableDerivedView.changed, true, 'derived change visible');
equal(derived.comparison.mutableDerivedView.historicalBytesAvailable, false, 'historical bytes not invented');
equal(derived.truth.mutableDerivedViewDriftClaimedAsProductPass, false, 'derived drift not product pass');
equal(derived.truth.historicalReceiptRewritten, false, 'history not rewritten');

const tracked = Continuity.build(input(historical(), { trackedDrift: true }));
equal(tracked.decision.classification, 'TRACKED_SOURCE_DRIFT', 'tracked drift remains visible');
equal(tracked.decision.reviewRequired, true, 'tracked drift needs review');
equal(tracked.comparison.trackedSourceDrift.length, 1, 'one tracked drift');
equal(tracked.comparison.trackedSourceDrift[0].path, 'shared/example/index.js', 'drift path');
equal(tracked.truth.trackedSourceDriftClaimedAsHarmless, false, 'drift not called harmless');

const missing = Continuity.build(input(historical(), { missingTracked: true }));
equal(missing.decision.classification, 'HOLD_INCOMPLETE_CURRENT_SOURCE_SET', 'missing source holds');
equal(missing.comparison.missingCurrentPaths.length, 1, 'missing path visible');

const extra = Continuity.build(input(historical(), { extra: true }));
equal(extra.decision.classification, 'HOLD_INCOMPLETE_CURRENT_SOURCE_SET', 'extra source holds');
equal(extra.comparison.extraCurrentPaths.length, 1, 'extra path visible');

const noDigest = Continuity.build(input(historical({ noDigest: true })));
equal(noDigest.decision.classification, 'HOLD_HISTORICAL_SELF_DIGEST_NOT_DECLARED', 'missing self digest holds');
equal(noDigest.historicalReceipt.selfDigest.state, 'NOT_DECLARED', 'missing self digest visible');

const badDigest = Continuity.build(input(historical({ badDigest: true })));
equal(badDigest.decision.classification, 'HOLD_INVALID_HISTORICAL_SELF_DIGEST', 'invalid self digest holds');
equal(badDigest.historicalReceipt.selfDigest.state, 'INVALID', 'invalid self digest visible');

const noDerived = Continuity.build(input(historical({ noDerived: true })));
equal(noDerived.decision.classification, 'HOLD_HISTORICAL_DERIVED_REFERENCE_NOT_DECLARED', 'missing derived boundary holds');

const wrongSchema = Continuity.build(input(historical(), { wrongSchema: true }));
equal(wrongSchema.decision.classification, 'HOLD_DERIVED_VIEW_BOUNDARY', 'wrong derived schema holds');

const wrongPath = Continuity.build(input(historical(), { wrongPath: true }));
equal(wrongPath.decision.classification, 'HOLD_DERIVED_VIEW_BOUNDARY', 'wrong derived path holds');

const conflict = Continuity.build(input(historical({ conflicting: true })));
equal(conflict.decision.classification, 'HOLD_INVALID_SOURCE_EVIDENCE', 'conflicting historical refs hold');
equal(conflict.historicalReceipt.sourceEvidenceErrors.length, 1, 'conflict retained');

const tampered = Continuity.clone(exact);
tampered.decision.classification = 'CURRENT_SOURCE_SET_EXACT_TAMPERED';
equal(Continuity.verify(exactInput, tampered).pass, false, 'tampered continuity receipt fails');
equal(Continuity.stableStringify({ b: 1, a: 2 }), Continuity.stableStringify({ a: 2, b: 1 }), 'stable key ordering');
equal(Continuity.sha256({ b: 1, a: 2 }), Continuity.sha256({ a: 2, b: 1 }), 'stable object digest');

assert.throws(() => Continuity.build({ ...exactInput, surprise: true }), /unsupported field/, 'extra input field rejected'); assertions += 1;
assert.throws(() => Continuity.build({ ...exactInput, checkedAt: 'not-a-date' }), /ISO date-time/, 'invalid time rejected'); assertions += 1;
const unsafe = Continuity.build({
  ...exactInput,
  currentSources: [{ path: '../escape', sha256: 'sha256:' + '1'.repeat(64) }]
});
equal(unsafe.decision.classification, 'HOLD_INVALID_SOURCE_EVIDENCE', 'unsafe path evidence holds');
check(unsafe.currentEvidence.sourceEvidenceErrors.some(item => item.includes('unsafe segment')), 'unsafe path error retained');

console.log('PASS verification snapshot continuity selftest (' + assertions + ' assertions)');
