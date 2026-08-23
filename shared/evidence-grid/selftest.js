'use strict';

const assert = require('assert');
const Grid = require('./evidence-grid-core');
let assertions = 0;
function check(value, message) { assertions += 1; assert.ok(value, message); }
function expect(code, fn) { let error = null; try { fn(); } catch (caught) { error = caught; } check(error && error.code === code, `expected ${code}, observed ${error && error.code}`); }
function sample(id, status, overrides) { return Grid.receipt({ id, claim: 'game.launches', subjectDigest: 'a'.repeat(64), status, observedAt: '2026-08-15T13:00:00.000Z', expiresAt: '2026-08-15T14:00:00.000Z', verifier: 'fixture-verifier/v1', sourceSnapshot: 'source-1', correlationId: 'corr-1', evidenceRefs: ['artifact:' + 'b'.repeat(64)], payloadSchema: 'axm.game-launch-proof/v1', payload: { observedFrames: 3 }, ...overrides }); }

function run() {
  const pass = sample('pass-1', 'PASS');
  check(Grid.verifyReceipt(pass), 'receipt digest verifies');
  check(pass.payloadSchema === 'axm.game-launch-proof/v1' && pass.grantsAuthority === false, 'domain payload schema survives without authority');
  check(Grid.freshness(pass, { currentSourceSnapshot: 'source-1', now: '2026-08-15T13:30:00.000Z' }).state === 'PASS', 'current receipt retains status');
  check(Grid.freshness(pass, { currentSourceSnapshot: 'source-2', now: '2026-08-15T13:30:00.000Z' }).state === 'STALE', 'source drift makes receipt stale');
  check(Grid.freshness(pass, { currentSourceSnapshot: 'source-1', now: '2026-08-15T14:00:00.000Z' }).state === 'STALE', 'expiry makes receipt stale');
  expect('RECEIPT_DIGEST_DRIFT', () => Grid.verifyReceipt({ ...pass, status: 'FAIL' }));
  const fail = sample('fail-1', 'FAIL');
  const summary = Grid.summarize([pass, fail], { currentSourceSnapshot: 'source-1', now: '2026-08-15T13:30:00.000Z' });
  check(summary.conflicts.length === 1 && summary.claims[0].status === 'CONFLICT', 'contradictory receipts remain an explicit conflict');
  const unknown = Grid.summarize([sample('unknown-1', 'UNKNOWN')], { currentSourceSnapshot: 'source-1', now: '2026-08-15T13:30:00.000Z' });
  check(unknown.unknown.length === 1, 'unknown does not collapse to pass');
  const baseline = Grid.warningBaseline({ sourceSnapshot: 'base-1', verifierVersion: 'v1', warnings: ['a', 'b'] });
  const current = { baselineSourceSnapshot: 'base-1', sourceSnapshot: 'head-1', verifierVersion: 'v1', warnings: ['b', 'c'] };
  const delta = Grid.warningDelta(baseline, current);
  check(delta.state === 'CURRENT' && delta.added[0] === 'c' && delta.resolved[0] === 'a', 'source-bound warning delta is exact');
  check(Grid.warningDelta(baseline, { ...current, verifierVersion: 'v2' }).state === 'STALE', 'verifier-version drift marks baseline stale');
  expect('WARNING_BASELINE_DRIFT', () => Grid.warningDelta({ ...baseline, warnings: ['changed'] }, current));
  expect('BASELINE_RENEWAL_UNAUTHORIZED', () => Grid.warningDelta(baseline, { ...current, renewBaseline: true }));
  check(Grid.warningDelta(baseline, { ...current, renewBaseline: true, renewalAuthorityDecisionRef: 'decision:' + 'd'.repeat(64) }).renewalAuthorityDecisionRef !== null, 'baseline renewal retains authority decision reference');
  process.stdout.write(`evidence-grid selftest passed: ${assertions} assertions\n`);
  return assertions;
}

if (require.main === module) run();
module.exports = { run };
