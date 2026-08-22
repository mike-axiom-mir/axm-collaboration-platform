'use strict';

const Grid = require('../authority-grid/authority-grid-core');

class HandsError extends Error {
  constructor(code, message, details) { super(message); this.name = 'HandsError'; this.code = code; this.details = details || null; }
}

function declaration(input) {
  if (!input || !input.id || !input.substrate) throw new HandsError('INVALID_EXECUTOR_DECLARATION', 'Executor declaration requires id and substrate');
  const effectClasses = Array.from(new Set((input.effectClasses || []).map(String))).sort();
  if (!effectClasses.length || effectClasses.some(value => !Grid.EFFECTS.has(value))) throw new HandsError('INVALID_EXECUTOR_EFFECTS', 'Executor must declare known effect classes');
  const budget = { maxDurationMs: Number(input.budget && input.budget.maxDurationMs), maxResultBytes: Number(input.budget && input.budget.maxResultBytes) };
  if (!(budget.maxDurationMs > 0) || !(budget.maxResultBytes > 0)) throw new HandsError('INVALID_EXECUTOR_BUDGET', 'Executor requires positive maxDurationMs and maxResultBytes');
  const denialProbes = (input.denialProbes || []).map(row => ({ id: String(row.id || ''), state: ['PASS', 'FAIL', 'UNKNOWN'].includes(row.state) ? row.state : 'UNKNOWN', evidence: row.evidence || null }));
  const knownGaps = Array.from(new Set((input.knownGaps || []).map(String))).sort();
  const confinementProven = denialProbes.length > 0 && denialProbes.every(row => row.state === 'PASS' && row.evidence) && knownGaps.length === 0;
  return {
    schema: 'axm.executor-declaration/v1', id: String(input.id), substrate: String(input.substrate), effectClasses, budget,
    denialProbes, knownGaps, cancellation: String(input.cancellation || 'UNDECLARED'), cleanup: String(input.cleanup || 'UNDECLARED'),
    confinement: { state: confinementProven ? 'MEASURED_PASS' : denialProbes.some(row => row.state === 'FAIL') ? 'MEASURED_FAIL' : 'UNPROVEN', substrateLabelIsProof: false, proven: confinementProven }
  };
}

function registry(rows) {
  const byId = new Map();
  for (const raw of rows || []) {
    const row = declaration(raw);
    if (byId.has(row.id)) throw new HandsError('DUPLICATE_EXECUTOR_ID', `Duplicate executor ${row.id}`);
    byId.set(row.id, row);
  }
  return byId;
}

async function dispatch(input) {
  const executor = declaration(input.executor);
  if (typeof input.handler !== 'function') throw new HandsError('MISSING_EXECUTOR_HANDLER', 'A caller-injected handler is required');
  if (typeof input.cleanup !== 'function') throw new HandsError('MISSING_CLEANUP_HANDLER', 'A mandatory cleanup callback is required');
  const request = Grid.effectRequest(input.request);
  if (!executor.effectClasses.includes(request.effectClass)) throw new HandsError('EXECUTOR_EFFECT_MISMATCH', `Executor ${executor.id} does not declare ${request.effectClass}`);
  if (request.effectClass === 'EXECUTE_CONFINED' && !executor.confinement.proven) throw new HandsError('CONFINEMENT_UNPROVEN', 'EXECUTE_CONFINED requires passing denial-probe evidence with no known gaps');
  const verified = Grid.verifyDecision(input.decision, request, input.policy, { now: input.startedAt, consumedDecisionDigests: input.consumedDecisionDigests, verifyDecisionMaker: input.verifyDecisionMaker });
  const consumptionReceipt = Grid.consume(verified, input.consumedDecisionDigests, input.startedAt);
  const startedMs = Date.parse(input.startedAt);
  let state = 'FAILURE';
  let resultDigest = null;
  let partial = null;
  let error = null;
  let cleanupResult = { state: 'NOT_RUN' };
  try {
    if (input.cancellation && input.cancellation.cancelled === true) throw new HandsError('EXECUTION_CANCELLED', 'Cancellation was requested before dispatch');
    const result = await input.handler({ request, executor, cancellation: input.cancellation || { cancelled: false } });
    const serialized = Grid.canonical(result == null ? null : result);
    if (Buffer.byteLength(serialized) > executor.budget.maxResultBytes) throw new HandsError('RESULT_BUDGET_EXCEEDED', 'Executor result exceeds maxResultBytes');
    resultDigest = Grid.sha256(serialized);
    if (result && result.state === 'PARTIAL') { state = 'PARTIAL'; partial = { completed: result.completed || [], failed: result.failed || [], evidence: result.evidence || [] }; }
    else state = 'SUCCESS';
  } catch (caught) {
    state = caught && caught.code === 'EXECUTION_CANCELLED' ? 'CANCELLED' : 'FAILURE';
    error = { code: caught && caught.code || 'EXECUTOR_FAILURE', message: caught && caught.message || String(caught) };
  } finally {
    try { const value = await input.cleanup({ request, executor, state }); cleanupResult = { state: 'PASS', resultDigest: Grid.sha256(Grid.canonical(value == null ? null : value)) }; }
    catch (caught) { cleanupResult = { state: 'FAIL', error: { code: caught && caught.code || 'CLEANUP_FAILURE', message: caught && caught.message || String(caught) } }; if (state === 'SUCCESS') state = 'PARTIAL'; }
  }
  const finishedAt = String(input.finishedAt || new Date().toISOString());
  const durationMs = Date.parse(finishedAt) - startedMs;
  if (!Number.isFinite(durationMs) || durationMs < 0) throw new HandsError('INVALID_EXECUTION_TIME', 'finishedAt must be at or after startedAt');
  if (durationMs > executor.budget.maxDurationMs && state === 'SUCCESS') { state = 'PARTIAL'; partial = { completed: [], failed: ['duration-budget'], evidence: [] }; }
  const base = { schema: 'axm.effect-receipt/v1', state, executorId: executor.id, requestDigest: request.requestDigest, decisionDigest: input.decision.decisionDigest, consumptionReceipt, startedAt: input.startedAt, finishedAt, durationMs, resultDigest, partial, error, cleanup: cleanupResult };
  return { ...base, receiptDigest: Grid.sha256(Grid.canonical(base)) };
}

module.exports = { HandsError, declaration, registry, dispatch };
