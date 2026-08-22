'use strict';

const crypto = require('crypto');
const EFFECTS = new Set(['NONE', 'OBSERVE_LOCAL', 'READ_PRIVATE', 'WRITE_CANDIDATE', 'EXECUTE_CONFINED', 'EXECUTE_TRUSTED', 'NETWORK_READ', 'NETWORK_WRITE', 'PUBLIC_RELEASE', 'PHYSICAL_ACTUATION', 'PROMOTION', 'CANON_CHANGE', 'ROOT_CHANGE']);

class RouteError extends Error {
  constructor(code, message, details) { super(message); this.name = 'RouteError'; this.code = code; this.details = details || null; }
}
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}
function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function time(value, field) { if (!Number.isFinite(Date.parse(value))) throw new RouteError('INVALID_ROUTE_TIME', `${field} must be an ISO-compatible date-time`); return String(value); }

function compile(input) {
  if (!input || !input.id || !input.version || !input.intent || !/^[a-f0-9]{64}$/.test(input.inputDigest || '')) throw new RouteError('INVALID_ROUTE', 'Route requires id, version, intent, and exact inputDigest');
  const ids = new Set();
  const steps = (input.steps || []).map((raw, index) => {
    const id = String(raw.id || '');
    if (!id) throw new RouteError('INVALID_ROUTE_STEP', `Step ${index} has no id`);
    if (ids.has(id)) throw new RouteError('DUPLICATE_ROUTE_STEP', `Duplicate route step ${id}`);
    ids.add(id);
    if (!EFFECTS.has(raw.effectClass)) throw new RouteError('UNKNOWN_ROUTE_EFFECT', `Step ${id} has unknown effect ${raw.effectClass}`);
    const maxAttempts = Number(raw.maxAttempts == null ? 1 : raw.maxAttempts);
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new RouteError('INVALID_ROUTE_BUDGET', `Step ${id} maxAttempts must be a positive integer`);
    const base = { id, capability: String(raw.capability || ''), effectClass: raw.effectClass, requires: Array.from(new Set((raw.requires || []).map(String))).sort(), claims: Array.from(new Set((raw.claims || []).map(String))).sort(), maxAttempts };
    if (!base.capability) throw new RouteError('INVALID_ROUTE_STEP', `Step ${id} has no capability`);
    return { ...base, stepDigest: sha256(canonical(base)) };
  });
  for (const step of steps) for (const dependency of step.requires) if (!ids.has(dependency)) throw new RouteError('UNRESOLVED_ROUTE_DEPENDENCY', `Step ${step.id} depends on missing step ${dependency}`);
  const visiting = new Set(), visited = new Set(), byId = new Map(steps.map(step => [step.id, step]));
  function visit(id) {
    if (visiting.has(id)) throw new RouteError('ROUTE_CYCLE', `Route contains a dependency cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).requires) visit(dependency);
    visiting.delete(id); visited.add(id);
  }
  for (const id of ids) visit(id);
  steps.sort((a, b) => a.id.localeCompare(b.id));
  const routeBase = { schema: 'axm.route/v1', id: String(input.id), version: String(input.version), intent: String(input.intent), inputDigest: input.inputDigest, steps, started: false, grantsAuthority: false };
  const routeDigest = sha256(canonical(routeBase));
  const planDigest = sha256(canonical(steps.map(step => ({ id: step.id, stepDigest: step.stepDigest, requires: step.requires }))));
  return { ...routeBase, routeDigest, planDigest };
}

function profile(route, input) {
  if (!input || !input.id || input.routeDigest !== route.routeDigest) throw new RouteError('PROFILE_ROUTE_DRIFT', 'Profile must bind the exact route digest');
  const routeIds = new Set(route.steps.map(step => step.id));
  const allowedSteps = Array.from(new Set((input.allowedSteps || []).map(String))).sort();
  if (allowedSteps.some(id => !routeIds.has(id))) throw new RouteError('PROFILE_AUTHORITY_EXPANSION', 'Profile cannot introduce steps');
  const allowed = new Set(allowedSteps);
  const budgetOverrides = {};
  for (const [id, raw] of Object.entries(input.budgetOverrides || {})) {
    if (!allowed.has(id)) throw new RouteError('PROFILE_AUTHORITY_EXPANSION', `Profile budget names inactive or missing step ${id}`);
    const original = route.steps.find(step => step.id === id).maxAttempts;
    const value = Number(raw.maxAttempts);
    if (!Number.isInteger(value) || value < 1 || value > original) throw new RouteError('PROFILE_AUTHORITY_EXPANSION', `Profile cannot increase maxAttempts for ${id}`);
    budgetOverrides[id] = { maxAttempts: value };
  }
  for (const step of route.steps.filter(row => allowed.has(row.id))) for (const dependency of step.requires) if (!allowed.has(dependency)) throw new RouteError('PROFILE_DEPENDENCY_REMOVED', `Profile keeps ${step.id} but removes dependency ${dependency}`);
  const base = { schema: 'axm.route-profile/v1', id: String(input.id), routeDigest: route.routeDigest, allowedSteps, budgetOverrides };
  return { ...base, profileDigest: sha256(canonical(base)) };
}

function stateDigest(value) { const { stateDigest: _ignored, ...base } = value; return sha256(canonical(base)); }

function start(route, input) {
  input = input || {};
  const selectedProfile = input.profile ? profile(route, input.profile) : null;
  const active = new Set(selectedProfile ? selectedProfile.allowedSteps : route.steps.map(step => step.id));
  const states = {};
  const attemptBudgets = {};
  for (const step of route.steps) {
    states[step.id] = { state: active.has(step.id) ? 'PENDING' : 'DISABLED', attempts: 0 };
    attemptBudgets[step.id] = selectedProfile && selectedProfile.budgetOverrides[step.id] ? selectedProfile.budgetOverrides[step.id].maxAttempts : step.maxAttempts;
  }
  const base = { schema: 'axm.route-instance/v1', id: String(input.id || `${route.id}:instance`), routeDigest: route.routeDigest, planDigest: route.planDigest, profileDigest: selectedProfile ? selectedProfile.profileDigest : null, startedAt: time(input.startedAt, 'startedAt'), states, attemptBudgets, receipts: [], previousStateDigest: null, executesSteps: false };
  return { ...base, stateDigest: stateDigest(base) };
}

function verifyInstance(route, instance) {
  if (!instance || instance.schema !== 'axm.route-instance/v1') throw new RouteError('INVALID_ROUTE_INSTANCE', 'Expected axm.route-instance/v1');
  if (instance.routeDigest !== route.routeDigest || instance.planDigest !== route.planDigest) throw new RouteError('ROUTE_INSTANCE_DRIFT', 'Checkpoint binds a different route or plan');
  if (stateDigest(instance) !== instance.stateDigest) throw new RouteError('ROUTE_STATE_DRIFT', 'Checkpoint fields do not match stateDigest');
  return true;
}

function ready(route, instance) {
  verifyInstance(route, instance);
  return route.steps.filter(step => instance.states[step.id].state === 'PENDING' && step.requires.every(id => instance.states[id].state === 'VERIFIED')).map(step => step.id);
}

function stepReceipt(step, input) {
  if (!input || input.stepId !== step.id || input.stepDigest !== step.stepDigest) throw new RouteError('STEP_RECEIPT_DRIFT', `Receipt does not bind exact step ${step.id}`);
  if (!['SUCCESS', 'PARTIAL', 'FAILURE', 'CANCELLED'].includes(input.state)) throw new RouteError('INVALID_STEP_RECEIPT', 'Unknown step effect state');
  if (!['PASS', 'FAIL', 'UNKNOWN', 'STALE'].includes(input.verificationState)) throw new RouteError('INVALID_STEP_RECEIPT', 'Unknown verification state');
  const base = { schema: 'axm.route-step-receipt/v1', stepId: step.id, stepDigest: step.stepDigest, state: input.state, verificationState: input.verificationState, effectReceiptDigest: input.effectReceiptDigest || null, evidenceRefs: Array.from(new Set((input.evidenceRefs || []).map(String))).sort(), completedAt: time(input.completedAt, 'completedAt') };
  return { ...base, receiptDigest: sha256(canonical(base)) };
}

function advance(route, instance, inputReceipt) {
  verifyInstance(route, instance);
  const step = route.steps.find(row => row.id === inputReceipt.stepId);
  if (!step) throw new RouteError('UNKNOWN_ROUTE_STEP', `Unknown route step ${inputReceipt.stepId}`);
  if (!ready(route, instance).includes(step.id)) throw new RouteError('STEP_NOT_READY', `Step ${step.id} cannot advance before dependencies verify`);
  const receipt = stepReceipt(step, inputReceipt);
  const next = JSON.parse(JSON.stringify(instance));
  next.previousStateDigest = instance.stateDigest;
  next.receipts.push(receipt);
  next.states[step.id].attempts += 1;
  if (receipt.state === 'SUCCESS' && receipt.verificationState === 'PASS') next.states[step.id].state = 'VERIFIED';
  else if (receipt.state === 'FAILURE' || receipt.verificationState === 'FAIL') next.states[step.id].state = 'FAILED';
  else next.states[step.id].state = 'HOLD';
  next.stateDigest = stateDigest(next);
  return next;
}

function retry(route, instance, stepId) {
  verifyInstance(route, instance);
  const current = instance.states[stepId];
  if (!current) throw new RouteError('UNKNOWN_ROUTE_STEP', `Unknown route step ${stepId}`);
  if (!['FAILED', 'HOLD'].includes(current.state)) throw new RouteError('STEP_NOT_RETRYABLE', `Step ${stepId} is not failed or held`);
  if (current.attempts >= instance.attemptBudgets[stepId]) throw new RouteError('STEP_ATTEMPT_BUDGET_EXHAUSTED', `Step ${stepId} exhausted its attempt budget`);
  const step = route.steps.find(row => row.id === stepId);
  if (!step.requires.every(id => instance.states[id].state === 'VERIFIED')) throw new RouteError('STEP_NOT_READY', `Step ${stepId} dependencies are not verified`);
  const next = JSON.parse(JSON.stringify(instance));
  next.previousStateDigest = instance.stateDigest;
  next.states[stepId].state = 'PENDING';
  next.stateDigest = stateDigest(next);
  return next;
}

function resume(route, checkpoint) {
  verifyInstance(route, checkpoint);
  const blocked = Object.entries(checkpoint.states).filter(([, value]) => value.state === 'HOLD' || value.state === 'FAILED').map(([id, value]) => ({ id, state: value.state }));
  return { state: blocked.length ? 'BLOCKED' : 'READY', readySteps: ready(route, checkpoint), blocked, checkpoint };
}

module.exports = { RouteError, canonical, sha256, compile, profile, start, verifyInstance, ready, stepReceipt, advance, retry, resume };
