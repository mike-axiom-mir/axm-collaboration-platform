'use strict';

const crypto = require('crypto');
const AdvancedOperationRuntime = require('./advanced-operation-runtime');
const SimulationOperationRuntime = require('./simulation-operation-runtime');

const CATALOG_SCHEMA = 'axm.ai-team-steward-operation-catalog/v1';
const RESULT_SCHEMA = 'axm.ai-team-steward-operation-result/v1';
const STATUS_SCHEMA = 'axm.ai-team-steward-operation-status/v1';

const ALLOWED_TRANSITIONS = Object.freeze({
  DRAFT: ['VALIDATED', 'CANCELLED'],
  VALIDATED: ['OFFERED', 'HELD', 'CANCELLED'],
  OFFERED: ['DELIVERED', 'REFUSED', 'EXPIRED', 'CANCELLED'],
  DELIVERED: ['ACCEPTED', 'REFUSED', 'EXPIRED', 'CANCELLED'],
  ACCEPTED: ['ACTIVE', 'PAUSED', 'CANCELLED'],
  ACTIVE: ['PAUSED', 'HELD', 'RETURNED', 'FAILED', 'CANCELLED'],
  PAUSED: ['ACTIVE', 'CANCELLED', 'EXPIRED'],
  HELD: ['VALIDATED', 'ACTIVE', 'CANCELLED', 'EXPIRED'],
  RETURNED: ['UNDER_REVIEW', 'FAILED'],
  UNDER_REVIEW: ['RESULT_ACCEPTED', 'RESULT_REJECTED', 'RESULT_PARTIAL'],
  RESULT_PARTIAL: ['ACTIVE', 'CLOSED'],
  RESULT_ACCEPTED: ['MERGE_PROPOSED', 'CLOSED'],
  RESULT_REJECTED: ['CLOSED', 'VALIDATED'],
  MERGE_PROPOSED: ['MERGED', 'CLOSED'],
  MERGED: ['CLOSED'],
  REFUSED: ['CLOSED'],
  EXPIRED: ['CLOSED'],
  FAILED: ['CLOSED', 'VALIDATED'],
  CANCELLED: ['CLOSED'],
  CLOSED: []
});
const TAINT_LEVEL = Object.freeze({ PUBLIC: 0, INTERNAL: 1, PRIVATE: 2, SECRET: 3 });

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value;
}

function list(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value;
}

function integer(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer`);
  return parsed;
}

function uniqueSorted(values) {
  return [...new Set(values.map(String))].sort();
}

function subset(child, parent) {
  const allowed = new Set(parent);
  return child.every(value => allowed.has(value));
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function authorityDelegate(input) {
  const parent = object(input.parent, 'parent');
  const child = object(input.child, 'child');
  const parentActions = list(parent.actions, 'parent.actions').map(String);
  const parentTargets = list(parent.targets, 'parent.targets').map(String);
  const childActions = uniqueSorted(list(child.actions, 'child.actions'));
  const childTargets = uniqueSorted(list(child.targets, 'child.targets'));
  const errors = [];
  if (parent.revoked) errors.push('PARENT_REVOKED');
  if (!subset(childActions, parentActions)) errors.push('AUTHORITY_WIDENING');
  if (!subset(childTargets, parentTargets)) errors.push('TARGET_WIDENING');
  if (integer(child.privacy_scope, 'child.privacy_scope') > integer(parent.privacy_scope, 'parent.privacy_scope')) errors.push('PRIVACY_SCOPE_WIDENING');
  if (integer(child.deadline_tick, 'child.deadline_tick') > integer(parent.deadline_tick, 'parent.deadline_tick')) errors.push('DEADLINE_RESET_OR_EXTENSION');
  if (integer(parent.depth, 'parent.depth') + 1 > integer(parent.max_depth, 'parent.max_depth')) errors.push('DELEGATION_DEPTH_EXCEEDED');
  if (errors.length) return { ok: false, errors, child: null };
  const delegated = {
    lease_id: String(child.lease_id || ''),
    holder: String(child.holder || ''),
    actions: childActions,
    targets: childTargets,
    privacy_scope: integer(child.privacy_scope, 'child.privacy_scope'),
    deadline_tick: integer(child.deadline_tick, 'child.deadline_tick'),
    depth: integer(parent.depth, 'parent.depth') + 1,
    max_depth: integer(parent.max_depth, 'parent.max_depth'),
    revoked: false
  };
  return { ok: true, errors: [], child: delegated, receipt: { parent_lease_id: String(parent.lease_id || ''), child_lease_id: delegated.lease_id, conserved: true } };
}

function handoffTransition(input) {
  const previous = String(input.previous_state || '');
  const requested = String(input.requested_state || '');
  const errors = [];
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_TRANSITIONS, previous)) errors.push('UNKNOWN_PREVIOUS_STATE');
  else if (!ALLOWED_TRANSITIONS[previous].includes(requested)) errors.push('ILLEGAL_STATE_TRANSITION');
  if (['ACCEPTED', 'ACTIVE'].includes(requested) && !input.acceptance_receipt) errors.push('ACCEPTANCE_RECEIPT_REQUIRED');
  if (['RESULT_ACCEPTED', 'RESULT_REJECTED', 'RESULT_PARTIAL'].includes(requested) && !input.review_receipt) errors.push('REVIEW_RECEIPT_REQUIRED');
  if (requested === 'MERGED' && !input.human_decision_receipt) errors.push('HUMAN_MERGE_DECISION_REQUIRED');
  if (['HELD', 'PAUSED', 'FAILED'].includes(previous) && ['ACTIVE', 'VALIDATED'].includes(requested) && !input.resume_authorization) errors.push('RESUME_AUTHORIZATION_REQUIRED');
  const errorCodes = [...new Set(errors)];
  return {
    ok: !errorCodes.length,
    previous_state: previous,
    requested_state: requested,
    error_codes: errorCodes,
    receipt: errorCodes.length ? null : {
      previous_state: previous,
      new_state: requested,
      acceptance_receipt: input.acceptance_receipt || null,
      review_receipt: input.review_receipt || null,
      human_decision_receipt: input.human_decision_receipt || null,
      resume_authorization: input.resume_authorization || null
    }
  };
}

function deadlockDetect(input) {
  const waitFor = object(input.wait_for, 'wait_for');
  const visiting = new Set();
  const visited = new Set();
  function visit(node) {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    const next = Array.isArray(waitFor[node]) ? waitFor[node].map(String) : [];
    for (const target of next) if (visit(target)) return true;
    visiting.delete(node);
    visited.add(node);
    return false;
  }
  const hasCycle = Object.keys(waitFor).some(visit);
  return { ok: !hasCycle, status: hasCycle ? 'DEADLOCK_HELD' : 'CLEAR', has_cycle: hasCycle };
}

function workspaceMerge(input) {
  const current = integer(input.current_revision, 'current_revision');
  const patches = list(input.patches, 'patches');
  const errors = [];
  const pathOwner = new Map();
  const semanticOwner = new Map();
  for (const raw of patches) {
    const patch = object(raw, 'patch');
    const branch = String(patch.branch_id || '');
    if (integer(patch.base_revision, 'patch.base_revision') !== current) errors.push(`STALE_BASE:${branch}`);
    if (!patch.patch_digest) errors.push(`MISSING_DIGEST:${branch}`);
    for (const item of list(patch.paths, 'patch.paths').map(String)) {
      if (pathOwner.has(item)) errors.push(`PATH_CONFLICT:${item}`);
      pathOwner.set(item, branch);
    }
    for (const key of list(patch.semantic_keys, 'patch.semantic_keys').map(String)) {
      if (semanticOwner.has(key)) errors.push(`SEMANTIC_CONFLICT:${key}`);
      semanticOwner.set(key, branch);
    }
  }
  const held = uniqueSorted(errors);
  return { ok: !held.length, errors: held, status: held.length ? 'CONFLICT_HELD' : 'MERGE_PROPOSAL_READY', next_revision: held.length ? current : current + 1, last_write_wins: false };
}

function resourceBudget(input) {
  const limit = integer(input.limit, 'limit');
  const reservations = {};
  const consumed = {};
  const receipts = [];
  function reserved() { return Object.values(reservations).reduce((sum, value) => sum + value, 0); }
  for (const raw of list(input.actions, 'actions')) {
    const action = object(raw, 'action');
    const type = String(action.type || '');
    const child = String(action.child || '');
    if (type === 'reserve') {
      const amount = integer(action.amount, 'action.amount');
      let ok = true, code = 'RESERVED';
      if (amount < 0) { ok = false; code = 'NEGATIVE_RESERVATION'; }
      else if (reserved() - (reservations[child] || 0) + amount > limit) { ok = false; code = 'PARENT_BUDGET_EXCEEDED'; }
      else reservations[child] = amount;
      receipts.push({ type, child, amount, ok, code });
    } else if (type === 'consume') {
      const amount = integer(action.amount, 'action.amount');
      let ok = true, code = 'CONSUMED';
      if (amount < 0 || amount + (consumed[child] || 0) > (reservations[child] || 0)) { ok = false; code = 'CHILD_ENVELOPE_EXCEEDED'; }
      else consumed[child] = (consumed[child] || 0) + amount;
      receipts.push({ type, child, amount, ok, code });
    } else if (type === 'release') {
      const released = reservations[child] || 0;
      delete reservations[child]; delete consumed[child];
      receipts.push({ type, child, released, ok: true, code: 'RELEASED' });
    } else throw new Error('action.type must be reserve, consume, or release');
  }
  return { ok: receipts.every(row => row.ok), receipts, state: { limit, reservations, consumed, reserved: reserved() } };
}

function fairSchedule(input) {
  const queue = list(input.items, 'items').map(item => ({ ...object(item, 'item'), task_id: String(item.task_id || ''), priority: Number(item.priority || 0), age: Number(item.age || 0) }));
  const slots = integer(input.slots, 'slots');
  const schedule = [];
  const rounds = Math.min(slots, queue.length);
  for (let index = 0; index < rounds; index += 1) {
    queue.sort((a, b) => (b.priority + b.age) - (a.priority + a.age) || (a.task_id < b.task_id ? -1 : a.task_id > b.task_id ? 1 : 0));
    schedule.push(queue.shift().task_id);
    queue.forEach(item => { item.age += 1; });
  }
  return { ok: true, schedule };
}

function maxTaint(labels) {
  if (!labels.length) return 'PUBLIC';
  return labels.reduce((best, value) => TAINT_LEVEL[value] > TAINT_LEVEL[best] ? value : best, labels[0]);
}

function privacyFilter(input) {
  if (!Object.prototype.hasOwnProperty.call(TAINT_LEVEL, input.maximum_label)) throw new Error('maximum_label must be PUBLIC, INTERNAL, PRIVATE, or SECRET');
  const allowed = new Set(list(input.allowed_names, 'allowed_names').map(String));
  const included = [], excluded = [], errors = [];
  for (const raw of list(input.fields, 'fields')) {
    const field = object(raw, 'field');
    const name = String(field.name || ''), label = String(field.label || '');
    if (!Object.prototype.hasOwnProperty.call(TAINT_LEVEL, label)) { errors.push('UNKNOWN_TAINT_LABEL'); continue; }
    if (!allowed.has(name) || TAINT_LEVEL[label] > TAINT_LEVEL[input.maximum_label]) excluded.push({ name, reason: 'NOT_REQUIRED_OR_NOT_AUTHORIZED', label });
    else included.push(clone(field));
  }
  return { ok: !errors.length, included, excluded, errors, output_taint: maxTaint(included.map(field => field.label)) };
}

function joinEvaluate(input) {
  const by = new Map();
  for (const raw of list(input.receipts, 'receipts')) { const receipt = object(raw, 'receipt'); by.set(String(receipt.task_id || ''), receipt); }
  const required = new Set(list(input.required_ids, 'required_ids').map(String));
  const missing = [...required].filter(id => !by.has(id)).sort();
  const rejected = [...required].filter(id => by.has(id) && (!by.get(id).accepted || !by.get(id).evidence_digest || !by.get(id).fresh)).sort();
  const ready = !missing.length && !rejected.length;
  return { ok: ready, status: ready ? 'JOIN_READY' : 'PARTIAL_VISIBLE_HELD', missing, rejected, partial_results_preserved: [...by.keys()].sort() };
}

function recoveryPlan(input) {
  const steps = list(input.steps, 'steps').map(raw => {
    const step = object(raw, 'step');
    return { step_id: String(step.step_id || ''), dependencies: list(step.dependencies, 'step.dependencies').map(String), applied: !!step.applied, succeeded: !!step.succeeded, reversible: !!step.reversible };
  });
  const failed = new Set(steps.filter(step => step.applied && !step.succeeded).map(step => step.step_id));
  const dependent = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const step of steps) if (step.applied && step.dependencies.some(id => failed.has(id) || dependent.has(id)) && !dependent.has(step.step_id)) { dependent.add(step.step_id); changed = true; }
  }
  const preserve = [], rollback = [], held = [], receipts = [];
  for (const step of steps) {
    if (!step.applied) continue;
    const affected = failed.has(step.step_id) || dependent.has(step.step_id);
    if (!affected && step.succeeded) { preserve.push(step.step_id); continue; }
    if (step.reversible) { rollback.push(step.step_id); receipts.push(`COMPENSATED:${step.step_id}`); }
    else { held.push(step.step_id); if (input.human_approved_irreversible) receipts.push(`HUMAN_RECOVERY_REQUIRED:${step.step_id}`); }
  }
  const sortedHeld = held.sort();
  return { ok: !sortedHeld.length, preserve: preserve.sort(), rollback: rollback.sort(), held: sortedHeld, compensation_receipts: receipts.sort(), ledger_complete: true, status: sortedHeld.length ? 'HELD_RECOVERY_REQUIRED' : 'RECOVERED' };
}

function leafHash(value) { return sha256(`L:${value}`); }
function pairHash(left, right) { return sha256(`N:${left}:${right}`); }
function buildMerkle(values) {
  if (!values.length) throw new Error('values required');
  let level = values.map(value => leafHash(String(value))), levels = [level.slice()];
  while (level.length > 1) {
    const padded = level.length % 2 ? level.concat(level[level.length - 1]) : level;
    level = [];
    for (let index = 0; index < padded.length; index += 2) level.push(pairHash(padded[index], padded[index + 1]));
    levels.push(level.slice());
  }
  return { root: level[0], levels, leaf_count: values.length };
}
function inclusionProof(tree, index) {
  if (index < 0 || index >= tree.leaf_count) throw new Error('index outside tree');
  const proof = []; let cursor = index;
  for (const level of tree.levels.slice(0, -1)) {
    const padded = level.length % 2 ? level.concat(level[level.length - 1]) : level;
    const sibling = cursor % 2 ? cursor - 1 : cursor + 1;
    proof.push({ hash: padded[sibling], side: sibling < cursor ? 'LEFT' : 'RIGHT' }); cursor = Math.floor(cursor / 2);
  }
  return proof;
}
function verifyProof(value, proof, root) {
  let current = leafHash(String(value));
  for (const row of proof) current = row.side === 'LEFT' ? pairHash(row.hash, current) : pairHash(current, row.hash);
  return current === root;
}
function proofMerkle(input) {
  const values = list(input.values, 'values').map(String);
  const index = integer(input.index, 'index');
  const tree = buildMerkle(values), proof = inclusionProof(tree, index);
  const checkedValue = Object.prototype.hasOwnProperty.call(input, 'verify_value') ? String(input.verify_value) : values[index];
  const verified = verifyProof(checkedValue, proof, tree.root);
  return { ok: verified, status: verified ? 'PROOF_VERIFIED' : 'PROOF_TAMPERED_HELD', root: tree.root, leaf_count: tree.leaf_count, index, proof, verified };
}

function offlineReconcile(input) {
  const local = object(input.local, 'local'), remote = object(input.remote, 'remote');
  if (local.packet_id === remote.packet_id) return { ok: true, code: 'DUPLICATE_REPLAY_SUPPRESSED', winner: 'same_packet' };
  if (local.base_revision === remote.base_revision && local.value !== remote.value) return { ok: false, code: 'DIVERGENT_SAME_BASE_HELD', winner: null };
  if (Number(local.revision || 0) > Number(remote.revision || 0)) return { ok: true, code: 'LOCAL_NEWER', winner: 'local' };
  if (Number(remote.revision || 0) > Number(local.revision || 0)) return { ok: true, code: 'REMOTE_NEWER', winner: 'remote' };
  return { ok: false, code: 'AMBIGUOUS_RECONCILIATION_HELD', winner: null };
}

function compatibilityNegotiate(input) {
  const producer = object(input.producer, 'producer'), consumer = object(input.consumer, 'consumer');
  const errors = [];
  if (integer(producer.major, 'producer.major') !== integer(consumer.major, 'consumer.major')) errors.push('MAJOR_VERSION_MISMATCH');
  if (integer(producer.minor, 'producer.minor') < integer(consumer.minor, 'consumer.minor')) errors.push('PRODUCER_TOO_OLD');
  const sharedCapabilities = list(producer.capabilities, 'producer.capabilities').filter(value => new Set(list(consumer.capabilities, 'consumer.capabilities')).has(value));
  const sharedEvidence = list(producer.evidence_fields, 'producer.evidence_fields').filter(value => new Set(list(consumer.evidence_fields, 'consumer.evidence_fields')).has(value));
  if (!subset(list(input.required_capabilities, 'required_capabilities'), sharedCapabilities)) errors.push('MISSING_REQUIRED_CAPABILITY');
  if (!subset(list(input.required_evidence, 'required_evidence'), sharedEvidence)) errors.push('EVIDENCE_FIELD_LOSS');
  if (producer.deprecated) errors.push('DEPRECATED_SURFACE_OBSERVE_ONLY');
  return { ok: !errors.length, errors, mode: errors.length ? 'HOLD' : 'NORMAL' };
}

function controlsCanAct(input) {
  const state = object(input.state, 'state');
  let ok = true, code = 'ALLOWED';
  if (state.revoked) { ok = false; code = 'AUTHORITY_REVOKED'; }
  else if (state.stopped) { ok = false; code = 'STOP_ACTIVE'; }
  else {
    const now = Date.parse(String(input.now || ''));
    const expires = Date.parse(String(state.expires_at || ''));
    if (!Number.isFinite(now) || !Number.isFinite(expires)) throw new Error('now and state.expires_at must be ISO timestamps');
    if (now >= expires) { ok = false; code = 'AUTHORITY_EXPIRED'; }
  }
  return { ok, code };
}

const DEFINITIONS = Object.freeze([
  { id: 'authority.delegate', name: 'Authority Delegation Conservator', family: 'identity_authority_privacy', source: 'authority_v3.delegate', run: authorityDelegate,
    ready: { parent:{lease_id:'parent',holder:'human',actions:['read','propose'],targets:['artifact:a'],privacy_scope:2,deadline_tick:20,depth:0,max_depth:3,revoked:false},child:{lease_id:'child',holder:'seat-a',actions:['read'],targets:['artifact:a'],privacy_scope:1,deadline_tick:15} },
    held: { parent:{lease_id:'parent',holder:'human',actions:['read'],targets:['artifact:a'],privacy_scope:1,deadline_tick:10,depth:3,max_depth:3,revoked:false},child:{lease_id:'child',holder:'seat-a',actions:['write'],targets:['artifact:b'],privacy_scope:2,deadline_tick:20} } },
  { id: 'handoff.transition', name: 'Handoff Lifecycle Transition', family: 'handoff_continuity', source: 'lifecycle.transition', run: handoffTransition,
    ready:{previous_state:'DELIVERED',requested_state:'ACCEPTED',acceptance_receipt:'receiver-1'}, held:{previous_state:'DELIVERED',requested_state:'ACTIVE'} },
  { id: 'deadlock.detect', name: 'Deadlock and Wait-Cycle Detector', family: 'guardrails_recovery', source: 'concurrency.has_wait_cycle', run: deadlockDetect,
    ready:{wait_for:{'seat-a':['seat-b'],'seat-b':[]}}, held:{wait_for:{'seat-a':['seat-b'],'seat-b':['seat-a']}} },
  { id: 'workspace.merge-proposal', name: 'Workspace Merge Conflict Holder', family: 'artifacts_merge', source: 'workspace_v5.merge_patches', run: workspaceMerge,
    ready:{current_revision:4,patches:[{branch_id:'a',base_revision:4,writer:'seat-a',paths:['a.txt'],semantic_keys:['config:a'],patch_digest:'d1'},{branch_id:'b',base_revision:4,writer:'seat-b',paths:['b.txt'],semantic_keys:['config:b'],patch_digest:'d2'}]}, held:{current_revision:4,patches:[{branch_id:'a',base_revision:4,writer:'seat-a',paths:['a.txt'],semantic_keys:['config:shared'],patch_digest:'d1'},{branch_id:'b',base_revision:4,writer:'seat-b',paths:['b.txt'],semantic_keys:['config:shared'],patch_digest:'d2'}]} },
  { id: 'resource.budget', name: 'Delegated Resource Budget', family: 'resources_scheduling', source: 'resource_tree.BudgetTree', run: resourceBudget,
    ready:{limit:100,actions:[{type:'reserve',child:'a',amount:60},{type:'consume',child:'a',amount:50}]}, held:{limit:100,actions:[{type:'reserve',child:'a',amount:60},{type:'reserve',child:'b',amount:50}]} },
  { id: 'resource.fair-schedule', name: 'Deterministic Fair Scheduler', family: 'resources_scheduling', source: 'resource_tree.fair_schedule', run: fairSchedule,
    ready:{items:[{task_id:'aged',priority:0,age:8},{task_id:'priority',priority:3,age:0}],slots:2}, held:null },
  { id: 'privacy.filter-context', name: 'Privacy and Taint Context Filter', family: 'identity_authority_privacy', source: 'privacy_taint.filter_context', run: privacyFilter,
    ready:{fields:[{name:'goal',label:'INTERNAL',value:'build'},{name:'private',label:'SECRET',value:'hidden'}],maximum_label:'INTERNAL',allowed_names:['goal']}, held:{fields:[{name:'goal',label:'UNDECLARED',value:'build'}],maximum_label:'INTERNAL',allowed_names:['goal']} },
  { id: 'join.evaluate', name: 'Upstream Join Barrier', family: 'collaboration_patterns', source: 'join_barrier_v5.evaluate_join', run: joinEvaluate,
    ready:{required_ids:['a'],receipts:[{task_id:'a',accepted:true,evidence_digest:'d',fresh:true,status:'RETURNED'}]}, held:{required_ids:['a','b'],receipts:[{task_id:'a',accepted:true,evidence_digest:'d',fresh:true,status:'RETURNED'}]} },
  { id: 'recovery.plan', name: 'Partial-Failure Recovery Planner', family: 'guardrails_recovery', source: 'partial_failure_v6.plan_recovery', run: recoveryPlan,
    ready:{steps:[{step_id:'a',dependencies:[],applied:true,succeeded:false,reversible:true},{step_id:'b',dependencies:['a'],applied:true,succeeded:true,reversible:true}]}, held:{steps:[{step_id:'publish',dependencies:[],applied:true,succeeded:false,reversible:false}]} },
  { id: 'proof.merkle', name: 'Proof Compaction and Inclusion Verifier', family: 'dissent_verification', source: 'proof_compaction_v6', run: proofMerkle,
    ready:{values:['contract','positive','negative','recovery'],index:2,verify_value:'negative'}, held:{values:['contract','positive','negative','recovery'],index:2,verify_value:'tampered'} },
  { id: 'offline.reconcile', name: 'Offline Packet Reconciler', family: 'handoff_continuity', source: 'offline.reconcile', run: offlineReconcile,
    ready:{local:{packet_id:'local',base_revision:1,value:'same',revision:2},remote:{packet_id:'remote',base_revision:2,value:'other',revision:1}}, held:{local:{packet_id:'local',base_revision:1,value:'a',revision:1},remote:{packet_id:'remote',base_revision:1,value:'b',revision:1}} },
  { id: 'compatibility.negotiate', name: 'Cross-Provider Contract Negotiator', family: 'routing_allocation', source: 'compatibility_v4.negotiate', run: compatibilityNegotiate,
    ready:{producer:{major:4,minor:2,capabilities:['read'],authority_actions:['read'],evidence_fields:['source_digest'],deprecated:false},consumer:{major:4,minor:1,capabilities:['read'],authority_actions:['read'],evidence_fields:['source_digest'],deprecated:false},required_capabilities:['read'],required_evidence:['source_digest']}, held:{producer:{major:3,minor:0,capabilities:['read'],authority_actions:['read'],evidence_fields:[],deprecated:false},consumer:{major:4,minor:1,capabilities:['read'],authority_actions:['read'],evidence_fields:['source_digest'],deprecated:false},required_capabilities:['read'],required_evidence:['source_digest']} },
  { id: 'controls.can-act', name: 'Stop, Revoke, and Expiry Gate', family: 'human_governance', source: 'controls.can_act', run: controlsCanAct,
    ready:{now:'2026-07-28T00:00:00Z',state:{stopped:false,revoked:false,expires_at:'2026-07-29T00:00:00Z'}}, held:{now:'2026-07-28T00:00:00Z',state:{stopped:false,revoked:true,expires_at:'2026-07-29T00:00:00Z'}} }
]);

function publicDefinition(definition) {
  return { id: definition.id, name: definition.name, family: definition.family, source: definition.source, mode: 'DETERMINISTIC_LOCAL_READ_ONLY', sideEffects: false, authority: 'NONE', examples: { ready: clone(definition.ready), held: definition.held ? clone(definition.held) : null } };
}

function create() {
  const allDefinitions = DEFINITIONS.concat(
    AdvancedOperationRuntime.definitions,
    SimulationOperationRuntime.definitions
  );
  const byId = new Map(allDefinitions.map(definition => [definition.id, definition]));
  if (byId.size !== allDefinitions.length) throw new Error('Duplicate AI Team steward operation id');
  function executeRaw(operationId, input) {
    const definition = byId.get(String(operationId || ''));
    if (!definition) throw new Error('Unknown AI Team steward operation');
    return definition.run(object(input, 'input'));
  }
  function execute(request = {}) {
    const operationId = String(request.operationId || '');
    const definition = byId.get(operationId);
    if (!definition) throw new Error('Unknown AI Team steward operation');
    const result = executeRaw(operationId, request.input);
    const ok = typeof definition.isOk === 'function' ? Boolean(definition.isOk(result)) : result.ok !== false;
    return { ok, schema: RESULT_SCHEMA, operationId, operation: publicDefinition(definition), result, authority: 'NONE', sideEffects: false, automaticExecution: false, truth: { retainedSourceSemanticsExecuted: true, liveAgentExecuted: false, providerOrConnectorContacted: false, workspaceChanged: false, canonChanged: false } };
  }
  function catalog() {
    return { ok: true, schema: CATALOG_SCHEMA, status: 'READY', operationCount: allDefinitions.length, operations: allDefinitions.map(publicDefinition), authority: 'NONE', sideEffects: false, liveAgentExecution: false };
  }
  function parityCases() {
    return allDefinitions.flatMap(definition => [{ operation_id: definition.id, variant: 'READY', input: clone(definition.ready) }].concat(definition.held ? [{ operation_id: definition.id, variant: 'HOLD', input: clone(definition.held) }] : []));
  }
  function status() {
    const cases = parityCases(), results = cases.map(item => ({ ...item, result: executeRaw(item.operation_id, item.input) }));
    return { ok: true, schema: STATUS_SCHEMA, status: 'READY', operationCount: allDefinitions.length, localVectorCount: results.length, operationIds: allDefinitions.map(definition => definition.id), sideEffects: false, authority: 'NONE', liveAgentExecution: false };
  }
  return { catalog, execute, executeRaw, parityCases, status, schemas: { catalog: CATALOG_SCHEMA, result: RESULT_SCHEMA, status: STATUS_SCHEMA } };
}

module.exports = { create, CATALOG_SCHEMA, RESULT_SCHEMA, STATUS_SCHEMA };
