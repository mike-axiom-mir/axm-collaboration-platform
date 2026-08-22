'use strict';

const assert = require('assert');
const Harbor = require('./intake-harbor-core');
let assertions = 0;
function check(value, message) { assertions += 1; assert.ok(value, message); }
function expect(code, fn) { let error = null; try { fn(); } catch (caught) { error = caught; } check(error && error.code === code, `expected ${code}, observed ${error && error.code}`); }
function receipt(step, index, overrides) { return { step, stepIndex: index, state: 'PASS', observedAt: `2026-08-15T14:${String(index).padStart(2, '0')}:00.000Z`, verifier: step === 'human-review' || step === 'explicit-promotion-or-rejection' ? 'human:mike' : 'fixture-verifier', evidenceRefs: [`artifact:evidence-${index}`], summary: `${step} fixture passed`, authorityDecisionRef: step === 'temporary-test-install' || step === 'explicit-promotion-or-rejection' ? `decision:${index}` : null, rollbackPlanRef: step === 'temporary-test-install' || step === 'rollback-receipt' ? `rollback:${index}` : null, payload: step === 'explicit-promotion-or-rejection' ? { decision: 'PROMOTE' } : {}, ...overrides }; }

function run() {
  let state = Harbor.open({ id: 'intake-1', packageRefDigest: 'a'.repeat(64), openedAt: '2026-08-15T14:00:00.000Z' });
  check(state.steps.length === 15 && state.quarantined && !state.trusted && !state.installed, 'intake opens inert in exact fifteen-step quarantine');
  expect('INTAKE_STEP_ORDER', () => Harbor.advance(state, receipt(Harbor.STEPS[1], 2)));
  expect('PRIVATE_DATA_IN_RECEIPT', () => Harbor.advance(state, receipt(Harbor.STEPS[0], 1, { payload: { secretValue: 'do-not-store' } })));
  for (let index = 0; index < Harbor.STEPS.length; index += 1) {
    const step = Harbor.STEPS[index];
    if (step === 'temporary-test-install') expect('TEMP_INSTALL_BOUNDARY_MISSING', () => Harbor.advance(state, receipt(step, index + 1, { authorityDecisionRef: null })));
    if (step === 'rollback-receipt') expect('ROLLBACK_RECEIPT_MISSING', () => Harbor.advance(state, receipt(step, index + 1, { rollbackPlanRef: null })));
    state = Harbor.advance(state, receipt(step, index + 1));
  }
  check(state.state === 'COMPLETE_EXTERNAL_ACTION_REQUIRED', 'promotion decision completes only with external action required');
  check(state.receipts.length === 15 && state.nextStepIndex === 15, 'all fifteen ordered receipts are retained');
  check(state.temporaryInstallObserved && !state.installed, 'external temporary-install observation never becomes Harbor install authority');
  check(state.externalActionRequired.includes('PROMOTION') && state.promotionApplied === false, 'Harbor records promotion authorization but never applies it');
  check(state.receipts.every(row => row.performedByHarbor === false), 'Harbor performs none of the recorded checks or effects');
  check(Harbor.resume(state).executesImportedCode === false, 'resume never executes imported code');
  const tampered = { ...state, installed: true };
  expect('INTAKE_STATE_DRIFT', () => Harbor.resume(tampered));
  process.stdout.write(`intake-harbor selftest passed: ${assertions} assertions\n`);
  return assertions;
}

if (require.main === module) run();
module.exports = { run };
