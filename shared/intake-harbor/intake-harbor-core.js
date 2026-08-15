'use strict';

const crypto = require('crypto');
const STEPS = Object.freeze([
  'unpack-into-quarantine', 'inventory', 'secret-private-data-scan', 'schema-validation', 'manifest-contract-compilation',
  'permission-effect-diff', 'static-checks', 'deterministic-self-tests', 'executor-confinement-probe', 'evidence-route',
  'temporary-test-install', 'human-review', 'promotion-proposal', 'explicit-promotion-or-rejection', 'rollback-receipt'
]);

class IntakeError extends Error {
  constructor(code, message, details) { super(message); this.name = 'IntakeError'; this.code = code; this.details = details || null; }
}
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}
function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function validTime(value, field) { if (!Number.isFinite(Date.parse(value))) throw new IntakeError('INVALID_INTAKE_TIME', `${field} must be an ISO-compatible date-time`); return String(value); }
function stateDigest(value) { const { stateDigest: _ignored, ...base } = value; return sha256(canonical(base)); }

function open(input) {
  if (!input || !input.id || !/^[a-f0-9]{64}$/.test(input.packageRefDigest || '')) throw new IntakeError('INVALID_INTAKE', 'Intake requires id and exact artifact ref digest');
  const base = {
    schema: 'axm.intake-state/v1', id: String(input.id), packageRefDigest: input.packageRefDigest, openedAt: validTime(input.openedAt, 'openedAt'),
    steps: STEPS.map((step, index) => ({ index: index + 1, step, state: 'PENDING' })), nextStepIndex: 0, receipts: [], state: 'IN_PROGRESS',
    quarantined: true, trusted: false, installed: false, temporaryInstallObserved: false, promotionApplied: false, externalActionRequired: null, previousStateDigest: null
  };
  return { ...base, stateDigest: stateDigest(base) };
}

function verifyState(value) {
  if (!value || value.schema !== 'axm.intake-state/v1') throw new IntakeError('INVALID_INTAKE_STATE', 'Expected axm.intake-state/v1');
  if (stateDigest(value) !== value.stateDigest) throw new IntakeError('INTAKE_STATE_DRIFT', 'Intake state fields do not match stateDigest');
  if (value.steps.length !== 15 || value.steps.some((row, index) => row.step !== STEPS[index] || row.index !== index + 1)) throw new IntakeError('INTAKE_ROUTE_DRIFT', 'Intake route is not the exact fifteen-step route');
  return true;
}

function stepReceipt(intake, input) {
  const index = intake.nextStepIndex;
  const expected = STEPS[index];
  if (!expected) throw new IntakeError('INTAKE_ALREADY_COMPLETE', 'All fifteen intake steps are already recorded');
  if (!input || input.step !== expected || Number(input.stepIndex) !== index + 1) throw new IntakeError('INTAKE_STEP_ORDER', `Expected step ${index + 1} ${expected}`);
  if (!['PASS', 'FAIL', 'HOLD'].includes(input.state)) throw new IntakeError('INVALID_INTAKE_STEP_STATE', 'Intake step state must be PASS, FAIL, or HOLD');
  if (!input.verifier || !input.summary) throw new IntakeError('INVALID_INTAKE_STEP_RECEIPT', 'Step receipt requires verifier and summary');
  if (input.payload && Object.keys(input.payload).some(key => /secret|token|password|credential|privateValue/i.test(key))) throw new IntakeError('PRIVATE_DATA_IN_RECEIPT', 'Receipt payload may record finding classes/counts, never private values');
  if (expected === 'temporary-test-install' && input.state === 'PASS' && (!input.authorityDecisionRef || !input.rollbackPlanRef)) throw new IntakeError('TEMP_INSTALL_BOUNDARY_MISSING', 'Observed temporary test install requires authority and rollback-plan references');
  if (expected === 'human-review' && input.state === 'PASS' && !String(input.verifier).startsWith('human:')) throw new IntakeError('HUMAN_REVIEW_UNVERIFIED', 'Human review requires a human-labelled verifier; identity remains external');
  if (expected === 'explicit-promotion-or-rejection' && input.state === 'PASS') {
    if (!input.payload || !['PROMOTE', 'REJECT'].includes(input.payload.decision) || !String(input.verifier).startsWith('human:') || !input.authorityDecisionRef) throw new IntakeError('PROMOTION_DECISION_BOUNDARY_MISSING', 'Explicit promotion/rejection requires human-labelled verifier, decision, and authority reference');
  }
  if (expected === 'rollback-receipt' && input.state === 'PASS' && !input.rollbackPlanRef) throw new IntakeError('ROLLBACK_RECEIPT_MISSING', 'Final step requires an exact rollback receipt/plan reference');
  const base = {
    schema: 'axm.intake-step-receipt/v1', intakeId: intake.id, step: expected, stepIndex: index + 1, state: input.state, observedAt: validTime(input.observedAt, 'observedAt'), verifier: String(input.verifier),
    evidenceRefs: Array.from(new Set((input.evidenceRefs || []).map(String))).sort(), summary: String(input.summary), authorityDecisionRef: input.authorityDecisionRef || null,
    rollbackPlanRef: input.rollbackPlanRef || null, payload: input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload) ? input.payload : {}, performedByHarbor: false
  };
  return { ...base, receiptDigest: sha256(canonical(base)) };
}

function advance(intake, input) {
  verifyState(intake);
  if (intake.state !== 'IN_PROGRESS') throw new IntakeError('INTAKE_NOT_ADVANCEABLE', `Intake is ${intake.state}`);
  const receipt = stepReceipt(intake, input);
  const next = JSON.parse(JSON.stringify(intake));
  next.previousStateDigest = intake.stateDigest;
  next.receipts.push(receipt);
  next.steps[intake.nextStepIndex].state = receipt.state;
  next.nextStepIndex += 1;
  if (receipt.step === 'temporary-test-install' && receipt.state === 'PASS') next.temporaryInstallObserved = true;
  if (receipt.state === 'FAIL') next.state = 'FAILED';
  else if (receipt.state === 'HOLD') next.state = 'HOLD';
  else if (receipt.step === 'explicit-promotion-or-rejection') next.externalActionRequired = receipt.payload.decision === 'PROMOTE' ? 'PROMOTION_AUTHORIZED_EXTERNAL_ACTION_REQUIRED' : 'REJECTION_RECORDED';
  if (receipt.step === 'rollback-receipt' && receipt.state === 'PASS') next.state = next.externalActionRequired === 'REJECTION_RECORDED' ? 'COMPLETE_REJECTED' : 'COMPLETE_EXTERNAL_ACTION_REQUIRED';
  next.stateDigest = stateDigest(next);
  return next;
}

function resume(intake) {
  verifyState(intake);
  return { state: intake.state, next: intake.state === 'IN_PROGRESS' ? { index: intake.nextStepIndex + 1, step: STEPS[intake.nextStepIndex] } : null, executesImportedCode: false, installs: false, promotes: false };
}

module.exports = { STEPS, IntakeError, canonical, sha256, open, verifyState, stepReceipt, advance, resume };
