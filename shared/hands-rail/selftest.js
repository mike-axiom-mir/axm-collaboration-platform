'use strict';

const assert = require('assert');
const Grid = require('../authority-grid/authority-grid-core');
const Hands = require('./hands-rail-core');
let assertions = 0;
function check(value, message) { assertions += 1; assert.ok(value, message); }
async function expect(code, fn) { let error = null; try { await fn(); } catch (caught) { error = caught; } check(error && error.code === code, `expected ${code}, observed ${error && error.code}`); }
function executor(options) { return { id: 'candidate-writer', substrate: 'injected-test-function', effectClasses: ['WRITE_CANDIDATE', 'EXECUTE_CONFINED'], budget: { maxDurationMs: 1000, maxResultBytes: 4096 }, denialProbes: options && options.proven ? [{ id: 'deny-network', state: 'PASS', evidence: 'fixture:no-network-surface' }] : [], knownGaps: options && options.proven ? [] : ['no measured denial probes'], cancellation: 'cooperative-token', cleanup: 'mandatory-callback' }; }
function request(effectClass) { return Grid.effectRequest({ id: `req-${effectClass}`, principal: 'agent:builder', action: 'write', resource: 'candidate:game-22', effectClass, targetDigest: 'c'.repeat(64), scope: { path: 'candidate/game-22' }, requestedAt: '2026-08-15T10:00:00.000Z', correlationId: 'corr-hands' }); }
function policy(effectClass) { return Grid.policy({ id: 'hands-policy', version: 'v1', decisionMakers: ['human:mike'], rules: [{ principal: 'agent:builder', action: 'write', resource: 'candidate:game-22', effectClass, decision: 'PERMIT', reason: 'bounded selftest' }] }); }
function decision(req, p) { return Grid.decide(req, p, { decidedBy: 'human:mike', decidedAt: '2026-08-15T10:00:01.000Z', expiresAt: '2026-08-15T11:00:00.000Z', oneUse: true }); }

async function run() {
  check(Hands.declaration(executor()).confinement.proven === false, 'substrate label without denial probes is not confinement proof');
  check(Hands.declaration(executor({ proven: true })).confinement.proven === true, 'complete passing denial probes can prove the declared boundary');
  const req = request('WRITE_CANDIDATE');
  const p = policy('WRITE_CANDIDATE');
  const d = decision(req, p);
  const consumed = new Set();
  let cleaned = false;
  const receipt = await Hands.dispatch({ executor: executor(), request: req, policy: p, decision: d, consumedDecisionDigests: consumed, verifyDecisionMaker: () => true, startedAt: '2026-08-15T10:00:02.000Z', finishedAt: '2026-08-15T10:00:02.010Z', handler: async () => ({ wrote: 'candidate-only' }), cleanup: async () => { cleaned = true; return { closed: true }; } });
  check(receipt.state === 'SUCCESS' && cleaned, 'authorized handler succeeds and cleanup runs');
  check(receipt.consumptionReceipt.requestDigest === req.requestDigest, 'effect receipt binds decision consumption');
  await expect('DECISION_ALREADY_USED', () => Hands.dispatch({ executor: executor(), request: req, policy: p, decision: d, consumedDecisionDigests: consumed, verifyDecisionMaker: () => true, startedAt: '2026-08-15T10:00:03.000Z', finishedAt: '2026-08-15T10:00:03.010Z', handler: async () => ({}), cleanup: async () => ({}) }));
  const confined = request('EXECUTE_CONFINED');
  const confinedPolicy = policy('EXECUTE_CONFINED');
  const confinedDecision = decision(confined, confinedPolicy);
  await expect('CONFINEMENT_UNPROVEN', () => Hands.dispatch({ executor: executor(), request: confined, policy: confinedPolicy, decision: confinedDecision, consumedDecisionDigests: new Set(), verifyDecisionMaker: () => true, startedAt: '2026-08-15T10:00:02.000Z', finishedAt: '2026-08-15T10:00:02.010Z', handler: async () => ({}), cleanup: async () => ({}) }));
  const partial = await Hands.dispatch({ executor: executor(), request: req, policy: p, decision: decision(req, p), consumedDecisionDigests: new Set(), verifyDecisionMaker: () => true, startedAt: '2026-08-15T10:00:02.000Z', finishedAt: '2026-08-15T10:00:02.010Z', handler: async () => ({ state: 'PARTIAL', completed: ['one'], failed: ['two'], evidence: ['fixture'] }), cleanup: async () => ({}) });
  check(partial.state === 'PARTIAL' && partial.partial.failed[0] === 'two', 'partial failure remains typed');
  const cancelled = await Hands.dispatch({ executor: executor(), request: req, policy: p, decision: decision(req, p), consumedDecisionDigests: new Set(), verifyDecisionMaker: () => true, cancellation: { cancelled: true }, startedAt: '2026-08-15T10:00:02.000Z', finishedAt: '2026-08-15T10:00:02.010Z', handler: async () => ({}), cleanup: async () => ({}) });
  check(cancelled.state === 'CANCELLED', 'pre-dispatch cancellation is typed and still cleaned');
  process.stdout.write(`hands-rail selftest passed: ${assertions} assertions\n`);
  return assertions;
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run };
