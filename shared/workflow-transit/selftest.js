'use strict';

const assert = require('assert');
const Transit = require('./workflow-transit-core');
let assertions = 0;
function check(value, message) { assertions += 1; assert.ok(value, message); }
function expect(code, fn) { let error = null; try { fn(); } catch (caught) { error = caught; } check(error && error.code === code, `expected ${code}, observed ${error && error.code}`); }
function source() { return { id: 'build-game', version: 'v1', intent: 'build a bounded candidate game', inputDigest: 'a'.repeat(64), steps: [{ id: 'compile', capability: 'game.compile', effectClass: 'WRITE_CANDIDATE', requires: [], claims: ['candidate-created'], maxAttempts: 2 }, { id: 'verify', capability: 'game.verify', effectClass: 'OBSERVE_LOCAL', requires: ['compile'], claims: ['candidate-runs'], maxAttempts: 1 }] }; }
function receipt(route, id, state, verificationState) { const step = route.steps.find(row => row.id === id); return { stepId: id, stepDigest: step.stepDigest, state, verificationState, effectReceiptDigest: 'b'.repeat(64), evidenceRefs: ['artifact:' + 'c'.repeat(64)], completedAt: '2026-08-15T12:01:00.000Z' }; }

function run() {
  const route = Transit.compile(source());
  check(route.started === false && route.grantsAuthority === false, 'compiled route remains inert data');
  check(Transit.compile({ ...source(), generatedAt: 'later', localPath: 'C:\\other' }).planDigest === route.planDigest, 'same locked route reproduces plan digest');
  expect('DUPLICATE_ROUTE_STEP', () => Transit.compile({ ...source(), steps: [source().steps[0], source().steps[0]] }));
  expect('UNRESOLVED_ROUTE_DEPENDENCY', () => Transit.compile({ ...source(), steps: [{ ...source().steps[0], requires: ['missing'] }] }));
  expect('ROUTE_CYCLE', () => Transit.compile({ ...source(), steps: [{ ...source().steps[0], requires: ['verify'] }, source().steps[1]] }));
  const narrowed = Transit.profile(route, { id: 'compile-only', routeDigest: route.routeDigest, allowedSteps: ['compile'], budgetOverrides: { compile: { maxAttempts: 1 } } });
  check(narrowed.allowedSteps.length === 1, 'domain profile can narrow route');
  expect('PROFILE_AUTHORITY_EXPANSION', () => Transit.profile(route, { id: 'bad', routeDigest: route.routeDigest, allowedSteps: ['compile', 'verify', 'publish'], budgetOverrides: {} }));
  expect('PROFILE_AUTHORITY_EXPANSION', () => Transit.profile(route, { id: 'bad-budget', routeDigest: route.routeDigest, allowedSteps: ['compile', 'verify'], budgetOverrides: { compile: { maxAttempts: 3 } } }));
  const instance = Transit.start(route, { id: 'run-1', startedAt: '2026-08-15T12:00:00.000Z' });
  check(Transit.ready(route, instance).join(',') === 'compile', 'only dependency-free step starts ready');
  expect('STEP_NOT_READY', () => Transit.advance(route, instance, receipt(route, 'verify', 'SUCCESS', 'PASS')));
  const held = Transit.advance(route, instance, receipt(route, 'compile', 'SUCCESS', 'UNKNOWN'));
  check(held.states.compile.state === 'HOLD' && Transit.resume(route, held).state === 'BLOCKED', 'successful but unverified work cannot be skipped on resume');
  const retried = Transit.retry(route, held, 'compile');
  check(retried.states.compile.state === 'PENDING', 'held work can retry within its locked budget');
  const narrowInstance = Transit.start(route, { id: 'narrow-run', profile: narrowed, startedAt: '2026-08-15T12:00:00.000Z' });
  const narrowHeld = Transit.advance(route, narrowInstance, receipt(route, 'compile', 'SUCCESS', 'UNKNOWN'));
  expect('STEP_ATTEMPT_BUDGET_EXHAUSTED', () => Transit.retry(route, narrowHeld, 'compile'));
  const compiled = Transit.advance(route, instance, receipt(route, 'compile', 'SUCCESS', 'PASS'));
  check(compiled.states.compile.state === 'VERIFIED' && Transit.ready(route, compiled)[0] === 'verify', 'verified dependency unlocks next step');
  const finished = Transit.advance(route, compiled, receipt(route, 'verify', 'SUCCESS', 'PASS'));
  check(Object.values(finished.states).every(row => row.state === 'VERIFIED'), 'all steps complete only with verification PASS');
  const tampered = { ...finished, states: { ...finished.states, verify: { state: 'VERIFIED', attempts: 99 } } };
  expect('ROUTE_STATE_DRIFT', () => Transit.resume(route, tampered));
  process.stdout.write(`workflow-transit selftest passed: ${assertions} assertions\n`);
  return assertions;
}

if (require.main === module) run();
module.exports = { run };
