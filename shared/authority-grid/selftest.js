'use strict';

const assert = require('assert');
const Grid = require('./authority-grid-core');
let assertions = 0;
function check(value, message) { assertions += 1; assert.ok(value, message); }
function expect(code, fn) { let error = null; try { fn(); } catch (caught) { error = caught; } check(error && error.code === code, `expected ${code}, observed ${error && error.code}`); }
function request(effectClass) { return Grid.effectRequest({ id: 'request-1', principal: 'agent:builder', action: 'write', resource: 'candidate:game-22', effectClass, targetDigest: 'a'.repeat(64), scope: { path: 'candidate/game-22' }, requestedAt: '2026-08-15T08:00:00.000Z', correlationId: 'corr-1' }); }
function policy(version) { return Grid.policy({ id: 'test-policy', version, decisionMakers: ['human:mike', 'ai:helper'], rules: [{ id: 'allow-candidate', principal: 'agent:builder', action: 'write', resource: 'candidate:game-22', effectClass: 'WRITE_CANDIDATE', decision: 'PERMIT', reason: 'bounded candidate write' }, { id: 'allow-network', principal: 'agent:builder', action: 'write', resource: 'candidate:game-22', effectClass: 'NETWORK_WRITE', decision: 'PERMIT', reason: 'test only' }], defaultDecision: 'DENY' }); }

function run() {
  const req = request('WRITE_CANDIDATE');
  check(req.requestDigest === Grid.effectRequest(req).requestDigest, 'request normalization is deterministic');
  const p1 = policy('v1');
  const decision = Grid.decide(req, p1, { id: 'decision-1', decidedBy: 'human:mike', decidedAt: '2026-08-15T08:01:00.000Z', expiresAt: '2026-08-15T09:00:00.000Z' });
  check(decision.decision === 'PERMIT', 'matching explicit rule permits');
  const verified = Grid.verifyDecision(decision, req, p1, { now: '2026-08-15T08:02:00.000Z', consumedDecisionDigests: new Set(), verifyDecisionMaker: () => true });
  check(verified.state === 'AUTHORIZED_EXACT', 'exact fresh decision validates');
  expect('DECISION_MAKER_UNVERIFIED', () => Grid.verifyDecision(decision, req, p1, { now: '2026-08-15T08:02:00.000Z', consumedDecisionDigests: new Set() }));
  const changedTarget = { ...req, targetDigest: 'b'.repeat(64) };
  expect('DECISION_SCOPE_DRIFT', () => Grid.verifyDecision(decision, changedTarget, p1, { now: '2026-08-15T08:02:00.000Z', verifyDecisionMaker: () => true }));
  expect('STALE_DECISION', () => Grid.verifyDecision(decision, req, policy('v2'), { now: '2026-08-15T08:02:00.000Z', verifyDecisionMaker: () => true }));
  expect('DECISION_EXPIRED', () => Grid.verifyDecision(decision, req, p1, { now: '2026-08-15T09:00:00.000Z', verifyDecisionMaker: () => true }));
  const deniedRequest = request('EXECUTE_CONFINED');
  const denied = Grid.decide(deniedRequest, p1, { decidedBy: 'human:mike', decidedAt: '2026-08-15T08:01:00.000Z', expiresAt: '2026-08-15T09:00:00.000Z' });
  check(denied.decision === 'DENY', 'capability without matching rule is denied');
  expect('AUTHORITY_DENIED', () => Grid.verifyDecision(denied, deniedRequest, p1, { now: '2026-08-15T08:02:00.000Z' }));
  const high = request('NETWORK_WRITE');
  const aiHigh = Grid.decide(high, p1, { decidedBy: 'ai:helper', decidedAt: '2026-08-15T08:01:00.000Z', expiresAt: '2026-08-15T09:00:00.000Z' });
  check(aiHigh.decision === 'HOLD', 'AI decision-maker cannot release high-risk authority');
  const highPermit = Grid.decide(high, p1, { decidedBy: 'human:mike', decidedAt: '2026-08-15T08:01:00.000Z', expiresAt: '2026-08-15T09:00:00.000Z' });
  check(highPermit.oneUse === true, 'high-risk permit is one-use');
  const consumed = new Set();
  const highVerified = Grid.verifyDecision(highPermit, high, p1, { now: '2026-08-15T08:02:00.000Z', consumedDecisionDigests: consumed, verifyDecisionMaker: () => true });
  const consumption = Grid.consume(highVerified, consumed, '2026-08-15T08:02:01.000Z');
  check(consumption.oneUse && consumed.has(highPermit.decisionDigest), 'one-use decision consumption is recorded');
  expect('DECISION_ALREADY_USED', () => Grid.verifyDecision(highPermit, high, p1, { now: '2026-08-15T08:03:00.000Z', consumedDecisionDigests: consumed, verifyDecisionMaker: () => true }));
  const selfPolicy = Grid.policy({ id: 'self', version: 'v1', decisionMakers: ['ai:self'], rules: [{ principal: 'ai:self', decision: 'PERMIT' }] });
  const selfReq = Grid.effectRequest({ ...req, principal: 'ai:self' });
  check(Grid.decide(selfReq, selfPolicy, { decidedBy: 'ai:self', decidedAt: '2026-08-15T08:01:00.000Z', expiresAt: '2026-08-15T09:00:00.000Z' }).decision === 'HOLD', 'AI self-authorization is held');
  process.stdout.write(`authority-grid selftest passed: ${assertions} assertions\n`);
  return assertions;
}

if (require.main === module) run();
module.exports = { run, request, policy };
