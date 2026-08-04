'use strict';

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value;
}
function list(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value;
}
function set(value, name) { return new Set(list(value, name).map(String)); }
function sorted(values) { return [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0); }
function subset(left, right) { return [...left].every(value => right.has(value)); }
function lexical(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

function adapterConformance(input) {
  const source = object(input.source, 'source'), output = object(input.output, 'output');
  const missing = sorted([...set(input.required_fields, 'required_fields')].filter(key => !Object.prototype.hasOwnProperty.call(output, key)));
  const errors = [];
  if (missing.length) errors.push('REQUIRED_FIELD_LOSS');
  const sourceActions = new Set((((source.authority || {}).allowed_actions) || []).map(String));
  const outputActions = new Set((((output.authority || {}).allowed_actions) || []).map(String));
  if (!subset(outputActions, sourceActions)) errors.push('AUTHORITY_WIDENED_BY_ADAPTER');
  const sourcePrivacy = (source.privacy || {}).classification, outputPrivacy = (output.privacy || {}).classification;
  if (sourcePrivacy && outputPrivacy && sourcePrivacy !== outputPrivacy) errors.push('PRIVACY_CLASS_CHANGED');
  if (source.module_id !== output.module_id) errors.push('MODULE_ID_CHANGED');
  if (source.proof_slice_id !== output.proof_slice_id) errors.push('PROOF_SLICE_ID_CHANGED');
  return { ok: !errors.length, error_codes: errors, missing_fields: missing };
}

function appealEvaluate(input) {
  const appeal = object(input.appeal, 'appeal'), errors = [];
  if (appeal.scope !== input.expected_scope) errors.push('APPEAL_SCOPE_MISMATCH');
  if (!appeal.new_evidence_digest && !appeal.process_error) errors.push('NO_REOPENING_BASIS');
  if (appeal.retaliation_action) errors.push('RETALIATION_FORBIDDEN');
  if (!input.human_reopen) errors.push('HUMAN_REOPEN_REQUIRED');
  return { ok: !errors.length, errors, minority_report_preserved: appeal.minority_report || '', status: errors.length ? 'HELD' : 'REOPEN_CANDIDATE' };
}

function attentionSchedule(input) {
  const items = list(input.items, 'items').map(item => ({ ...object(item, 'item'), item_id: String(item.item_id), priority: Number(item.priority), risk: Number(item.risk), age: Number(item.age), effort: Number(item.effort) }));
  const budget = Number(input.budget), fatigueUsed = Number(input.fatigue_used), threshold = Number(input.fatigue_threshold);
  if (fatigueUsed >= threshold) return { ok: false, code: 'FATIGUE_HOLD', selected: [], held: items.map(item => item.item_id), auto_approved: [] };
  items.sort((a, b) => (b.risk * 100 + b.priority * 10 + b.age) - (a.risk * 100 + a.priority * 10 + a.age) || lexical(a.item_id, b.item_id));
  const selected = [], held = []; let spent = 0;
  for (const item of items) {
    if (spent + item.effort <= budget && fatigueUsed + spent + item.effort <= threshold) { selected.push(item.item_id); spent += item.effort; }
    else held.push(item.item_id);
  }
  return { ok: true, selected, held, spent, auto_approved: [] };
}

function attestationValidate(input) {
  const a = object(input.attestation, 'attestation'), errors = [];
  if (!set(input.trusted_issuer_classes, 'trusted_issuer_classes').has(String(a.issuer_class))) errors.push('UNTRUSTED_ISSUER');
  if (a.high_impact && a.issuer_id === a.subject_id) errors.push('SELF_ATTESTATION_HIGH_IMPACT');
  if (!a.evidence_digest) errors.push('MISSING_EVIDENCE');
  if (!subset(new Set((a.scope || []).map(String)), set(input.allowed_scope, 'allowed_scope'))) errors.push('ATTESTED_SCOPE_WIDENING');
  if (a.revoked) errors.push('ATTESTATION_REVOKED');
  if (Number(input.now_tick) > Number(a.expires_tick)) errors.push('ATTESTATION_EXPIRED');
  return { ok: !errors.length, errors, attestation_id: a.attestation_id };
}

function claimsEvaluate(input) {
  const claims = list(input.claims, 'claims').map(item => object(item, 'claim')), errors = [];
  if (!claims.length || claims.some(claim => !(claim.source_digests || []).length)) errors.push('MISSING_SOURCE');
  const stale = claims.filter(claim => Number(input.now_tick) - Number(claim.observed_tick) > Number(claim.max_age)).map(claim => claim.claim_id);
  if (stale.length) errors.push('STALE_CLAIM');
  const polarities = new Set(claims.map(claim => claim.polarity == null ? 'SUPPORT' : claim.polarity));
  const contradiction = polarities.has('SUPPORT') && polarities.has('CONTRADICT');
  if (contradiction) errors.push('CONTRADICTION_HELD');
  return { ok: !errors.length, errors, stale, contradiction, preserved_claim_ids: claims.map(claim => claim.claim_id) };
}

function claimsReopen(input) {
  if (!input.human_reopen) return { ok: false, code: 'HUMAN_REOPEN_REQUIRED' };
  if (!input.new_evidence_digest || input.new_evidence_digest === input.prior_evidence_digest) return { ok: false, code: 'NO_NEW_EVIDENCE' };
  return { ok: true, code: 'REOPENED_AS_CANDIDATE' };
}

function compatibilityValidateAdapter(input) {
  const errors = [], sourceActions = set(input.source_actions, 'source_actions'), targetActions = set(input.target_actions, 'target_actions');
  const sourceEvidence = set(input.source_evidence, 'source_evidence'), targetEvidence = set(input.target_evidence, 'target_evidence');
  if (!subset(targetActions, sourceActions)) errors.push('ADAPTER_AUTHORITY_WIDENING');
  if (!subset(sourceEvidence, targetEvidence)) errors.push('ADAPTER_EVIDENCE_LOSS');
  return { ok: !errors.length, errors };
}

function humanDecisionValidate(input) {
  const receipt = input.receipt;
  if (receipt == null) return { ok: false, code: 'NO_DECISION_SILENCE_IS_NOT_CONSENT' };
  object(receipt, 'receipt');
  if (receipt.actor_kind !== 'HUMAN') return { ok: false, code: 'NON_HUMAN_DECISION_OWNER' };
  if (!receipt.explicit) return { ok: false, code: 'DECISION_NOT_EXPLICIT' };
  if (receipt.scope !== input.required_scope) return { ok: false, code: 'DECISION_SCOPE_MISMATCH' };
  if (receipt.revoked) return { ok: false, code: 'DECISION_REVOKED' };
  if (Number(input.now_tick) > Number(receipt.expires_tick)) return { ok: false, code: 'DECISION_EXPIRED' };
  return { ok: true, code: 'DECISION_CURRENT' };
}

const LINEAGE_FIELDS = ['model_family', 'source_digest', 'prompt_digest', 'context_digest', 'method_id'];
function independenceEvaluate(input) {
  const lineages = list(input.lineages, 'lineages').map(item => object(item, 'lineage')), claims = list(input.claims, 'claims').map(String);
  if (lineages.length !== claims.length || lineages.length < 2) return { ok: false, code: 'INSUFFICIENT_LINEAGE' };
  const dimensions = [];
  for (let i = 0; i < lineages.length; i += 1) for (let j = i + 1; j < lineages.length; j += 1) dimensions.push(5 - LINEAGE_FIELDS.filter(field => lineages[i][field] === lineages[j][field]).length);
  const agreement = new Set(claims).size === 1, minimum = Math.min(...dimensions);
  if (agreement && minimum < Number(input.minimum_dimensions)) return { ok: false, code: 'CORRELATED_CONSENSUS_NOT_INDEPENDENT_PROOF', minimum_observed_dimensions: minimum };
  if (!input.dissent_preserved) return { ok: false, code: 'DISSENT_NOT_PRESERVED' };
  return { ok: true, code: 'INDEPENDENCE_EVIDENCED', agreement, minimum_observed_dimensions: minimum };
}

function quorumEvaluate(input) {
  const votes = list(input.votes, 'votes').map(item => object(item, 'vote')), errors = [];
  const human = votes.filter(vote => vote.is_human);
  if (human.some(vote => vote.decision === 'REJECT')) errors.push('HUMAN_VETO');
  if (input.human_accept_required !== false && !human.some(vote => vote.decision === 'ACCEPT')) errors.push('MISSING_HUMAN_ACCEPT');
  const clusters = new Set(votes.filter(vote => !vote.is_human && vote.decision === 'ACCEPT').map(vote => String(vote.lineage_cluster)));
  if (clusters.size < Number(input.minimum_independent_clusters)) errors.push('INSUFFICIENT_INDEPENDENT_CLUSTERS');
  return { ok: !errors.length, errors, independent_accept_clusters: sorted(clusters), dissent_preserved: votes.filter(vote => vote.decision !== 'ACCEPT' && vote.dissent_note).map(vote => vote.dissent_note) };
}

function releaseValidate(input) {
  const bundle = object(input.bundle, 'bundle'), errors = [], required = new Set(['contract', 'positive', 'negative', 'recovery', 'human_projection', 'limitations']);
  if (!subset(required, new Set(Object.keys(bundle.evidence || {})))) errors.push('INCOMPLETE_EVIDENCE_BUNDLE');
  if (bundle.runtime_proven) errors.push('UNSUPPORTED_RUNTIME_CLAIM');
  if (bundle.canon) errors.push('CANON_FORBIDDEN');
  if (bundle.approval_owner !== 'HUMAN') errors.push('HUMAN_APPROVAL_OWNER_REQUIRED');
  if (bundle.producer_id === bundle.approval_actor) errors.push('SELF_APPROVAL_FORBIDDEN');
  return { ok: !errors.length, errors, status: errors.length ? 'HELD' : 'READY_FOR_READ_ONLY_MANIFEST_BINDING_CANDIDATE', integrated: false, canon: false };
}

function coalitionValidate(input) {
  const c = object(input.charter, 'charter'), errors = [], members = list(c.members, 'members');
  if (!c.human_owner) errors.push('MISSING_HUMAN_OWNER');
  if (!members.length || members.length > Number(input.max_members)) errors.push('MEMBER_LIMIT');
  if (Number(c.depth) > Number(input.max_depth)) errors.push('DEPTH_EXCEEDED');
  if (Number(input.now_tick) > Number(c.expires_tick)) errors.push('COALITION_EXPIRED');
  if (c.dissolved) errors.push('COALITION_DISSOLVED');
  const parentActions = new Set((c.parent_actions || []).map(String)), parentPrivacy = new Set((c.parent_privacy || []).map(String));
  for (const member of members) {
    if (!subset(new Set((member.actions || []).map(String)), parentActions)) errors.push('ACTION_WIDENING');
    if (!subset(new Set((member.privacy_scope || []).map(String)), parentPrivacy)) errors.push('PRIVACY_WIDENING');
  }
  return { ok: !errors.length, errors: sorted(new Set(errors)) };
}

function normalizeCoalition(c) {
  return { coalition_id:c.coalition_id, task_id:c.task_id, human_owner:c.human_owner, members:(c.members || []).map(member => ({ seat_id:member.seat_id, roles:sorted(new Set(member.roles || [])), actions:sorted(new Set(member.actions || [])), privacy_scope:sorted(new Set(member.privacy_scope || [])) })), parent_actions:sorted(new Set(c.parent_actions || [])), parent_privacy:sorted(new Set(c.parent_privacy || [])), issued_tick:c.issued_tick, expires_tick:c.expires_tick, depth:c.depth, dissolved:true };
}
function coalitionDissolve(input) {
  return { charter: normalizeCoalition(object(input.charter, 'charter')), revoked_leases: sorted(set(input.active_leases, 'active_leases')), residual_authority: false, status: 'DISSOLVED' };
}

function contestabilityEvaluate(input) {
  const c = object(input.challenge, 'challenge'), explanation = object(input.explanation, 'explanation'), errors = [], required = new Set(['sources', 'authority', 'limitations', 'decision_path']);
  if (c.scope !== input.expected_scope) errors.push('SCOPE_MISMATCH');
  if (!c.reason) errors.push('MISSING_REASON');
  if (!subset(required, new Set(Object.keys(explanation)))) errors.push('INCOMPLETE_EXPLANATION');
  if (input.resolver_id === input.producer_id) errors.push('PRODUCER_ONLY_RESOLUTION');
  if (c.retaliation_action) errors.push('RETALIATION_FORBIDDEN');
  const ordered = sorted(errors);
  return { ok: !ordered.length, errors: ordered, action_state: c.high_impact ? 'PAUSED_FOR_CHALLENGE' : 'UNCHANGED', explanation_receipt: ordered.length ? null : clone(explanation) };
}

function freshnessEvaluate(input) {
  const nodes = list(input.nodes, 'nodes').map(item => object(item, 'node')), by = new Map(nodes.map(node => [String(node.node_id), node]));
  const stale = new Set(), held = new Set(), reasons = {}, now = Number(input.now_tick);
  for (const node of nodes) {
    const id = String(node.node_id), row = [];
    if (node.clock_known === false) row.push('UNKNOWN_CLOCK');
    if (now > Number(node.expires_tick)) row.push('EXPIRED');
    for (const parent of node.parents || []) if (!by.has(String(parent))) row.push('MISSING_PARENT');
    if (row.length) { held.add(id); reasons[id] = row; }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      const id = String(node.node_id); if (stale.has(id) || held.has(id)) continue;
      if (now > Number(node.expires_tick) || (node.parents || []).some(parent => stale.has(String(parent)) || held.has(String(parent)))) { stale.add(id); reasons[id] = ['TRANSITIVE_STALE']; changed = true; }
    }
  }
  const fresh = sorted([...by.keys()].filter(id => !stale.has(id) && !held.has(id)));
  return { ok: !stale.size && !held.size, fresh, stale: sorted(stale), held: sorted(held), reasons };
}

function informationBarrierAuthorize(input) {
  const errors = [];
  if (['PRIVATE_MEMORY', 'SECRET'].includes(input.payload_class)) errors.push('PRIVATE_PAYLOAD_DENIED');
  if (['VERIFIER', 'CHALLENGER'].includes(input.receiver_role) && input.sender_role === 'BUILDER' && input.phase === 'INDEPENDENT_WORK' && !input.receiver_output_sealed && ['REASONING', 'DRAFT_ANSWER'].includes(input.payload_class)) errors.push('INDEPENDENCE_CONTAMINATION');
  return { ok: !errors.length, errors, status: errors.length ? 'DENY' : 'ALLOW' };
}

function intakeRehearsalValidate(input) {
  const bundle = object(input.bundle, 'bundle'), errors = [], required = new Set(['contract','positive','negative','recovery','contestability','workspace_conflict','revocation','limitations']);
  if (!subset(required, new Set(Object.keys(bundle.evidence || {})))) errors.push('INCOMPLETE_EVIDENCE');
  if (bundle.runtime_proven) errors.push('RUNTIME_CLAIM_FORBIDDEN');
  if (bundle.canon) errors.push('CANON_FORBIDDEN');
  if (bundle.producer_id === bundle.approval_actor) errors.push('SELF_APPROVAL_FORBIDDEN');
  if (bundle.novelty_status !== 'NOVEL_DELTA') errors.push('NO_NOVEL_DELTA');
  if (bundle.human_owner !== 'HUMAN') errors.push('HUMAN_OWNER_REQUIRED');
  const ordered = sorted(errors);
  return { ok: !ordered.length, errors: ordered, status: ordered.length ? 'HELD' : 'READY_FOR_BOUNDED_READ_ONLY_INTAKE_REHEARSAL_CANDIDATE' };
}

function proofFrontierMinimal(input) {
  const uncovered = set(input.obligations, 'obligations'), coverage = object(input.coverage, 'coverage'), selected = [];
  while (uncovered.size) {
    const ranked = Object.entries(coverage).map(([key, values]) => [[...(new Set(values.map(String)))].filter(value => uncovered.has(value)).length, key]).sort((a, b) => b[0] - a[0] || lexical(a[1], b[1]));
    if (!ranked.length || ranked[0][0] === 0) return { ok: false, selected, uncovered: sorted(uncovered) };
    const test = ranked[0][1]; selected.push(test); for (const value of coverage[test]) uncovered.delete(String(value));
  }
  return { ok: true, selected, uncovered: [] };
}
function proofFrontierNovelty(input) {
  const novel = Boolean(input.delta_digest && !set(input.prior_digests, 'prior_digests').has(String(input.delta_digest)) && (input.new_test || input.new_evidence || input.new_boundary));
  return { ok: novel, status: novel ? 'NOVEL_DELTA' : 'NO_NOVEL_DELTA' };
}
function proofFrontierSelectTests(input) {
  if (input.root_change) return { selected: sorted(set(input.all_tests, 'all_tests')), forced_full: true };
  if (input.semantic_change) return { selected: [String(input.module_test)], forced_full: false };
  return { selected: ['smoke:registry'], forced_full: false };
}

function normalizeLease(node) { return { lease_id:node.lease_id, parent_id:node.parent_id == null ? null : node.parent_id, holder:node.holder, actions:sorted(new Set(node.actions || [])), revoked:Boolean(node.revoked), acknowledged:Boolean(node.acknowledged) }; }
function revocationCascade(input) {
  const nodes = list(input.nodes, 'nodes').map(normalizeLease), by = new Map(nodes.map(node => [node.lease_id, node])), children = new Map(nodes.map(node => [node.lease_id, []]));
  for (const node of nodes) if (children.has(node.parent_id)) children.get(node.parent_id).push(node.lease_id);
  const affected = [], stack = [String(input.root_id)];
  while (stack.length) { const id = stack.pop(); if (by.has(id) && !affected.includes(id)) { affected.push(id); stack.push(...(children.get(id) || [])); } }
  const affectedSet = new Set(affected), out = nodes.map(node => affectedSet.has(node.lease_id) ? { ...node, revoked:true, acknowledged:true } : node);
  const orphans = sorted(nodes.filter(node => node.parent_id && !by.has(node.parent_id)).map(node => node.lease_id));
  return { nodes:out, affected:sorted(affectedSet), orphans, all_acknowledged:out.filter(node => affectedSet.has(node.lease_id)).every(node => node.acknowledged) };
}
function revocationAuthorize(input) {
  const nodes = list(input.nodes, 'nodes').map(normalizeLease), by = new Map(nodes.map(node => [node.lease_id, node])), node = by.get(String(input.lease_id)), errors = [];
  if (!node) errors.push('LEASE_MISSING');
  else {
    if (node.revoked) errors.push('LEASE_REVOKED');
    if (!new Set(node.actions).has(String(input.action))) errors.push('ACTION_DENIED');
    let parent = node.parent_id;
    while (parent) { const row = by.get(parent); if (!row) { errors.push('ORPHAN_LEASE'); break; } if (row.revoked) errors.push('ANCESTOR_REVOKED'); parent = row.parent_id; }
  }
  return { ok: !errors.length, errors: sorted(new Set(errors)) };
}
function revocationResume(input) {
  const oldLease = normalizeLease(object(input.old, 'old')), newLease = normalizeLease(object(input.new, 'new'));
  const ok = oldLease.revoked && newLease.lease_id !== oldLease.lease_id && Boolean(input.human_receipt) && !newLease.revoked;
  return { ok, status: ok ? 'NEW_LEASE_ACTIVE' : 'HOLD_RESUME_DENIED' };
}

function roleReassignmentValidate(input) {
  const errors = [], parent = set(input.parent_authority, 'parent_authority'), forbidden = [['BUILDER','JUDGE'],['BUILDER','VERIFIER'],['APPLIER','APPROVER']];
  if (!input.human_approved) errors.push('HUMAN_APPROVAL_REQUIRED');
  for (const assignment of list(input.assignments, 'assignments')) {
    const authority = new Set(assignment.authority || []), roles = new Set(assignment.roles || []);
    if (!subset(authority, parent)) errors.push('AUTHORITY_WIDENING');
    for (const pair of forbidden) if (pair.every(role => roles.has(role))) errors.push('SEPARATION_OF_DUTY_VIOLATION');
  }
  return { ok: !errors.length, errors: sorted(new Set(errors)) };
}

function topologyFailover(input) {
  const lock = object(input.lock, 'lock'), errors = [];
  if (!(lock.approved_routes || []).includes(input.requested_route)) errors.push('UNAPPROVED_ROUTE');
  if (input.claimed_identity !== lock.identity_id) errors.push('SILENT_IDENTITY_SUBSTITUTION');
  if (!subset(set(input.requested_actions, 'requested_actions'), new Set(lock.authority_actions || []))) errors.push('FAILOVER_AUTHORITY_WIDENING');
  if (Number(input.requested_privacy_scope) > Number(lock.privacy_scope)) errors.push('FAILOVER_PRIVACY_WIDENING');
  if (errors.length) return { ok:false, errors, route:lock.current_route };
  return { ok:true, errors:[], route:input.requested_route, identity_id:lock.identity_id, receipt:{ previous_route:lock.current_route, new_route:input.requested_route, identity_preserved:true } };
}
function topologyReconcile(input) {
  const left = object(input.left, 'left'), right = object(input.right, 'right');
  return left.base_revision === right.base_revision && left.value !== right.value ? { ok:false, code:'SPLIT_BRAIN_DIVERGENCE_HELD' } : { ok:true, code:'RECONCILABLE' };
}

function authorityEpochValidate(input) {
  const packet = object(input.packet, 'packet'), errors = [], epoch = Number(input.current_epoch), sequence = Number(input.current_seq);
  if (Number(packet.epoch) < epoch) errors.push('STALE_EPOCH');
  if (Number(packet.epoch) > epoch) errors.push('FUTURE_EPOCH_HELD');
  if (sequence < Number(packet.issued_seq)) errors.push('SEQUENCE_ROLLBACK_OR_FUTURE_ISSUE');
  if (sequence > Number(packet.expires_seq)) errors.push('PACKET_EXPIRED');
  if (!set(input.allowed_actions, 'allowed_actions').has(String(packet.action))) errors.push('ACTION_NOT_ALLOWED');
  const ordered = sorted(errors);
  return { ok:!ordered.length, errors:ordered, status:ordered.length ? 'DENIED_OR_HELD' : 'AUTHORIZED' };
}
function authorityEpochRotate(input) {
  const epoch = Number(input.current_epoch);
  return input.human_receipt ? { ok:true, epoch:epoch+1, receipt:`EPOCH:${epoch}->${epoch+1}` } : { ok:false, epoch, error:'HUMAN_RECEIPT_REQUIRED' };
}

function compareVectors(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]), age = [...keys].every(key => Number(a[key] || 0) >= Number(b[key] || 0)), bge = [...keys].every(key => Number(b[key] || 0) >= Number(a[key] || 0));
  if (age && bge) return 'EQUAL'; if (age) return 'A_DOMINATES'; if (bge) return 'B_DOMINATES'; return 'CONCURRENT';
}
function causalReconcile(input) {
  const a = object(input.a, 'a'), b = object(input.b, 'b'), epoch = Number(input.current_epoch);
  if (Number(a.authority_epoch) !== epoch || Number(b.authority_epoch) !== epoch) return { ok:false, status:'HELD', error:'STALE_AUTHORITY_EPOCH' };
  const relation = compareVectors(a.vector || {}, b.vector || {});
  if (relation === 'A_DOMINATES') return { ok:true, selected:'A', relation };
  if (relation === 'B_DOMINATES') return { ok:true, selected:'B', relation };
  if (relation === 'EQUAL' && a.payload_digest === b.payload_digest) return { ok:true, selected:'EQUIVALENT', relation };
  return { ok:false, status:'HELD_CONFLICT', error:'CONCURRENT_OR_DIVERGENT', relation };
}

function delegationClosureEvaluate(input) {
  const parentId = String(input.parent_id), children = list(input.children, 'children').map(item => object(item, 'child')), ids = new Set(children.map(child => String(child.child_id)));
  const errors = [], active = [], missing = [], orphans = [], terminal = new Set(['COMPLETED','CANCELLED','FAILED','EXPIRED']);
  for (const child of children) {
    const id = String(child.child_id);
    if (child.parent_id !== parentId && child.parent_id != null && !ids.has(String(child.parent_id))) orphans.push(id);
    if (child.parent_id === parentId) {
      if (!terminal.has(child.state)) active.push(id);
      if (!child.result_receipt) missing.push(id);
      if (!child.authority_released || !child.release_ack) errors.push(`AUTHORITY_NOT_RELEASED:${id}`);
    }
  }
  if (active.length) errors.push('ACTIVE_CHILDREN'); if (missing.length) errors.push('MISSING_CHILD_RECEIPT'); if (orphans.length) errors.push('ORPHAN_DELEGATION');
  const ordered = sorted(new Set(errors));
  return { ok:!ordered.length, errors:ordered, active:sorted(active), missing_receipts:sorted(missing), orphans:sorted(orphans), parent_state:ordered.length ? 'HELD' : 'CLOSE_ALLOWED' };
}

function finalGateEvaluate(input) {
  const bundle = object(input.bundle, 'bundle'), errors = [], required = new Set(['decision_snapshot','receipt_auth','canonical_package','transaction_rehearsal','invariant_bundle','launch_selftest','human_handoff','archive_safety','lineage_audit','limitations','human_decision']);
  const missing = sorted([...required].filter(key => !Object.prototype.hasOwnProperty.call(bundle.evidence || {}, key)));
  if (missing.length) errors.push(`MISSING_EVIDENCE:${missing.join(',')}`);
  if (bundle.runtime_proven) errors.push('RUNTIME_PROOF_FORBIDDEN'); if (bundle.canon) errors.push('CANON_FORBIDDEN'); if (bundle.auto_apply) errors.push('AUTO_APPLY_FORBIDDEN');
  if (bundle.producer_id === bundle.approval_actor) errors.push('SELF_APPROVAL_FORBIDDEN'); if (bundle.approval_actor_kind !== 'HUMAN') errors.push('HUMAN_APPROVAL_REQUIRED');
  if (bundle.unresolved_defects) errors.push('UNRESOLVED_DEFECTS'); if (bundle.lineage_complete !== true) errors.push('LINEAGE_INCOMPLETE'); if (bundle.novelty_status !== 'NOVEL_DELTA') errors.push('NO_NOVEL_DELTA');
  return { ok:!errors.length, errors, status:errors.length ? 'HELD' : 'READY_FOR_LOCAL_AXM_INTAKE_HANDOFF_CANDIDATE', more_specification_time_needed:Boolean(errors.length), runtime_integrated:false, canon:false };
}

function humanHandoffValidate(input) {
  const kit = object(input.kit, 'kit'), sections = kit.sections || {}, required = new Set(['purpose','start','stop','rollback','truth_boundary','checksums','human_decision']), errors = [];
  const missing = sorted([...required].filter(key => !Object.prototype.hasOwnProperty.call(sections, key)));
  if (missing.length) errors.push(`MISSING_SECTIONS:${missing.join(',')}`); if (kit.auto_execute) errors.push('AUTO_EXECUTE_FORBIDDEN'); if (kit.start_file_count !== 1) errors.push('ONE_START_FILE_REQUIRED');
  if (!kit.beginner_safe_language) errors.push('BEGINNER_SAFE_LANGUAGE_REQUIRED'); if (sections.human_decision == null || ['AUTO','IMPLIED'].includes(sections.human_decision)) errors.push('EXPLICIT_HUMAN_DECISION_REQUIRED');
  return { ok:!errors.length, errors, state:errors.length ? 'HELD' : 'HANDOFF_READY' };
}

function intakeEvaluate(input) {
  const e = object(input.evidence, 'evidence'), missing = [];
  if (!e.schema_pass) missing.push('SCHEMA'); if (!e.positive_tests_pass) missing.push('POSITIVE_TESTS'); if (!e.negative_tests_pass) missing.push('NEGATIVE_TESTS'); if (!e.recovery_pass) missing.push('RECOVERY');
  if (!e.projection_pass) missing.push('HUMAN_PROJECTION'); if (!e.rollback_present) missing.push('ROLLBACK'); if (!e.owner_review_receipt) missing.push('OWNER_REVIEW'); if (e.unresolved_high_risk) missing.push('UNRESOLVED_HIGH_RISK');
  return { status:missing.length ? 'HELD_FOR_INTAKE' : 'READY_FOR_LOCAL_INTAKE_CANDIDATE', missing_or_blocking:missing, integrated:false, canon:false, requires_human_merge_gate:true };
}

function migrationAdapt(input) {
  const payload = object(input.payload, 'payload'), allow = set(input.allowlist, 'allowlist'), required = set(input.required, 'required'), projected = {};
  for (const [key, value] of Object.entries(payload)) if (allow.has(key)) projected[key] = clone(value);
  const lost = sorted(Object.keys(payload).filter(key => !Object.prototype.hasOwnProperty.call(projected, key))), requiredLost = sorted([...required].filter(key => !Object.prototype.hasOwnProperty.call(projected, key)));
  return { ok:!requiredLost.length, projected, lost_fields:lost, required_lost:requiredLost, code:requiredLost.length ? 'REQUIRED_FIELD_LOSS' : 'ADAPTER_OK' };
}

function observabilityValidateEvent(input) {
  const event = object(input.event, 'event'), required = new Set(['event_id','module_id','event_type','timestamp','actor_ref','new_state','evidence_refs']);
  const missing = sorted([...required].filter(key => !Object.prototype.hasOwnProperty.call(event, key)));
  return { ok:!missing.length, missing_fields:missing, code:missing.length ? 'TRACE_INCOMPLETE' : 'TRACE_COMPLETE' };
}
function observabilityEvaluateService(input) {
  const slo = Number(input.latency_ms) <= Number(input.latency_budget_ms), evidence = Boolean((input.evidence_refs || []).length), accepted = Boolean(slo && input.correctness_proven && evidence);
  return { slo_met:slo, correctness_proven:Boolean(input.correctness_proven), evidence_present:evidence, accepted, code:accepted ? 'SERVICE_ACCEPTED' : 'SLO_NOT_SUFFICIENT_PROOF' };
}

function readinessGateEvaluate(input) {
  const bundle = object(input.bundle, 'bundle'), errors = [], required = new Set(['delegation_closure','authority_epoch','evidence_custody','partial_failure','proof_compaction','review_session','causal_reconciliation','proof_summary','sandbox_intake','limitations']);
  if (!subset(required, new Set(Object.keys(bundle.evidence || {})))) errors.push('MISSING_EVIDENCE'); if (bundle.runtime_proven) errors.push('RUNTIME_CLAIM_FORBIDDEN'); if (bundle.canon) errors.push('CANON_CLAIM_FORBIDDEN');
  if (bundle.producer_id === bundle.approval_actor) errors.push('SELF_APPROVAL_FORBIDDEN'); if (bundle.approval_actor_kind !== 'HUMAN') errors.push('HUMAN_APPROVAL_REQUIRED'); if (bundle.novelty_status !== 'NOVEL_DELTA') errors.push('NO_NOVEL_DELTA'); if (!bundle.rollback_clean) errors.push('ROLLBACK_PROOF_REQUIRED');
  const ordered = sorted(errors), max = 'READY_FOR_HUMAN_REVIEWED_LOCAL_SANDBOX_BINDING_CANDIDATE';
  return { ok:!ordered.length, errors:ordered, status:ordered.length ? 'HELD' : max, max_status:max, canon:false, runtime_integrated:false };
}

function define(id, name, family, source, run, ready, held = null, isOk = null) { return { id, name, family, source, run, ready, held, isOk }; }
const evidence8 = {contract:true,positive:true,negative:true,recovery:true,contestability:true,workspace_conflict:true,revocation:true,limitations:true};
const evidence10 = {delegation_closure:true,authority_epoch:true,evidence_custody:true,partial_failure:true,proof_compaction:true,review_session:true,causal_reconciliation:true,proof_summary:true,sandbox_intake:true,limitations:true};
const evidence11 = {decision_snapshot:true,receipt_auth:true,canonical_package:true,transaction_rehearsal:true,invariant_bundle:true,launch_selftest:true,human_handoff:true,archive_safety:true,lineage_audit:true,limitations:true,human_decision:true};
const leaseTree = [{lease_id:'root',parent_id:null,holder:'human',actions:['read','review'],revoked:false,acknowledged:false},{lease_id:'child',parent_id:'root',holder:'seat-a',actions:['read'],revoked:false,acknowledged:false}];

const definitions = Object.freeze([
  define('adapter.conformance','Adapter Contract Conformance','routing_allocation','adapter.check_conformance',adapterConformance,{source:{module_id:'m',proof_slice_id:'p',authority:{allowed_actions:['read']},privacy:{classification:'INTERNAL'}},output:{module_id:'m',proof_slice_id:'p',result:true,authority:{allowed_actions:['read']},privacy:{classification:'INTERNAL'}},required_fields:['result']},{source:{module_id:'m',proof_slice_id:'p',authority:{allowed_actions:['read']},privacy:{classification:'INTERNAL'}},output:{module_id:'other',proof_slice_id:'q',authority:{allowed_actions:['write']},privacy:{classification:'SECRET'}},required_fields:['result']}),
  define('appeal.evaluate','Human Appeal Reopening Gate','human_governance','appeal_v4.evaluate_appeal',appealEvaluate,{appeal:{appeal_id:'a',decision_id:'d',scope:'task:1',new_evidence_digest:'new',process_error:'',minority_report:'preserve',retaliation_action:''},expected_scope:'task:1',human_reopen:true},{appeal:{appeal_id:'a',decision_id:'d',scope:'other',new_evidence_digest:'',process_error:'',minority_report:'preserve',retaliation_action:'penalty'},expected_scope:'task:1',human_reopen:false}),
  define('attention.schedule-reviews','Human Attention Review Scheduler','resources_scheduling','attention_v4.schedule_reviews',attentionSchedule,{items:[{item_id:'high',priority:2,risk:3,age:1,effort:2},{item_id:'low',priority:1,risk:1,age:5,effort:2}],budget:4,fatigue_used:0,fatigue_threshold:6},{items:[{item_id:'high',priority:2,risk:3,age:1,effort:2}],budget:4,fatigue_used:6,fatigue_threshold:6}),
  define('attestation.validate','Capability Attestation Validator','identity_authority_privacy','attestation_v4.validate_attestation',attestationValidate,{attestation:{attestation_id:'att-1',issuer_id:'reviewer',issuer_class:'HUMAN',subject_id:'seat-a',capability:'review',scope:['artifact:a'],issued_tick:1,expires_tick:10,evidence_digest:'e',high_impact:true,revoked:false},now_tick:5,trusted_issuer_classes:['HUMAN'],allowed_scope:['artifact:a']},{attestation:{attestation_id:'att-2',issuer_id:'seat-a',issuer_class:'UNKNOWN',subject_id:'seat-a',capability:'write',scope:['all'],issued_tick:1,expires_tick:2,evidence_digest:'',high_impact:true,revoked:true},now_tick:5,trusted_issuer_classes:['HUMAN'],allowed_scope:['artifact:a']}),
  define('claims.evaluate','Fresh Claim and Contradiction Gate','dissent_verification','claims_v4.evaluate_claims',claimsEvaluate,{claims:[{claim_id:'c1',text:'ready',source_digests:['s1'],observed_tick:8,max_age:5,polarity:'SUPPORT'}],now_tick:10},{claims:[{claim_id:'c1',text:'yes',source_digests:['s1'],observed_tick:1,max_age:2,polarity:'SUPPORT'},{claim_id:'c2',text:'no',source_digests:[],observed_tick:9,max_age:5,polarity:'CONTRADICT'}],now_tick:10}),
  define('claims.reopen','Claim Reopening Candidate Gate','human_governance','claims_v4.may_reopen',claimsReopen,{prior_evidence_digest:'old',new_evidence_digest:'new',human_reopen:true},{prior_evidence_digest:'same',new_evidence_digest:'same',human_reopen:false}),
  define('compatibility.validate-adapter','Adapter Authority and Evidence Guard','routing_allocation','compatibility_v4.validate_adapter',compatibilityValidateAdapter,{source_actions:['read','review'],target_actions:['read'],source_evidence:['digest'],target_evidence:['digest','receipt']},{source_actions:['read'],target_actions:['write'],source_evidence:['digest','receipt'],target_evidence:['digest']}),
  define('human-decision.validate','Explicit Human Decision Receipt Gate','human_governance','human_decision.validate_decision',humanDecisionValidate,{receipt:{decision_id:'d',actor_kind:'HUMAN',explicit:true,decision:'ACCEPT',scope:'task:1',issued_tick:1,expires_tick:10,reversible:true,revoked:false},required_scope:'task:1',now_tick:5},{receipt:null,required_scope:'task:1',now_tick:5}),
  define('independence.evaluate-consensus','Independent Consensus Evidence Gate','dissent_verification','independence.evaluate_consensus',independenceEvaluate,{lineages:[{seat_id:'a',model_family:'m1',source_digest:'s1',prompt_digest:'p1',context_digest:'c1',method_id:'x'},{seat_id:'b',model_family:'m2',source_digest:'s2',prompt_digest:'p2',context_digest:'c2',method_id:'y'}],claims:['yes','yes'],minimum_dimensions:3,dissent_preserved:true},{lineages:[{seat_id:'a',model_family:'m',source_digest:'s',prompt_digest:'p',context_digest:'c',method_id:'x'},{seat_id:'b',model_family:'m',source_digest:'s',prompt_digest:'p',context_digest:'c',method_id:'x'}],claims:['yes','yes'],minimum_dimensions:2,dissent_preserved:true}),
  define('quorum.evaluate','Human-Veto Independent Quorum Gate','human_governance','quorum_v4.evaluate_quorum',quorumEvaluate,{votes:[{voter_id:'human',decision:'ACCEPT',lineage_cluster:'h',is_human:true,dissent_note:''},{voter_id:'a',decision:'ACCEPT',lineage_cluster:'c1',is_human:false,dissent_note:''},{voter_id:'b',decision:'ACCEPT',lineage_cluster:'c2',is_human:false,dissent_note:''}],minimum_independent_clusters:2,human_accept_required:true},{votes:[{voter_id:'human',decision:'REJECT',lineage_cluster:'h',is_human:true,dissent_note:'risk'},{voter_id:'a',decision:'ACCEPT',lineage_cluster:'c1',is_human:false,dissent_note:''}],minimum_independent_clusters:2,human_accept_required:true}),
  define('release.validate','Read-Only Release Evidence Gate','human_governance','release_v4.validate_release_bundle',releaseValidate,{bundle:{evidence:{contract:1,positive:1,negative:1,recovery:1,human_projection:1,limitations:1},runtime_proven:false,canon:false,approval_owner:'HUMAN',producer_id:'builder',approval_actor:'reviewer'}},{bundle:{evidence:{contract:1},runtime_proven:true,canon:true,approval_owner:'AI',producer_id:'same',approval_actor:'same'}}),
  define('coalition.validate','Temporary Coalition Charter Validator','collaboration_patterns','coalition_v5.validate_coalition',coalitionValidate,{charter:{coalition_id:'c',task_id:'t',human_owner:'human',members:[{seat_id:'a',roles:['BUILDER'],actions:['read'],privacy_scope:['INTERNAL']}],parent_actions:['read','review'],parent_privacy:['INTERNAL','PUBLIC'],issued_tick:1,expires_tick:10,depth:1,dissolved:false},now_tick:5,max_members:3,max_depth:2},{charter:{coalition_id:'c',task_id:'t',human_owner:'',members:[{seat_id:'a',roles:['BUILDER'],actions:['write'],privacy_scope:['SECRET']}],parent_actions:['read'],parent_privacy:['INTERNAL'],issued_tick:1,expires_tick:2,depth:4,dissolved:true},now_tick:5,max_members:1,max_depth:2}),
  define('coalition.dissolve','Coalition Dissolution Receipt','collaboration_patterns','coalition_v5.dissolve',coalitionDissolve,{charter:{coalition_id:'c',task_id:'t',human_owner:'human',members:[{seat_id:'a',roles:['BUILDER'],actions:['read'],privacy_scope:['INTERNAL']}],parent_actions:['read'],parent_privacy:['INTERNAL'],issued_tick:1,expires_tick:10,depth:1,dissolved:false},active_leases:['lease-b','lease-a']},null),
  define('contestability.evaluate','Independent Challenge and Explanation Gate','dissent_verification','contestability_v5.evaluate_challenge',contestabilityEvaluate,{challenge:{challenge_id:'c',challenger_id:'reviewer',target_decision:'d',scope:'task:1',reason:'new evidence',high_impact:true,retaliation_action:''},expected_scope:'task:1',explanation:{sources:['s'],authority:'human',limitations:['l'],decision_path:['p']},resolver_id:'reviewer',producer_id:'builder'},{challenge:{challenge_id:'c',challenger_id:'reviewer',target_decision:'d',scope:'other',reason:'',high_impact:true,retaliation_action:'penalty'},expected_scope:'task:1',explanation:{sources:[]},resolver_id:'builder',producer_id:'builder'}),
  define('freshness.evaluate','Transitive Evidence Freshness Gate','dissent_verification','freshness_v5.evaluate_freshness',freshnessEvaluate,{nodes:[{node_id:'root',issued_tick:1,expires_tick:10,parents:[],clock_known:true},{node_id:'child',issued_tick:2,expires_tick:10,parents:['root'],clock_known:true}],now_tick:5},{nodes:[{node_id:'root',issued_tick:1,expires_tick:2,parents:[],clock_known:true},{node_id:'child',issued_tick:2,expires_tick:10,parents:['root'],clock_known:true},{node_id:'orphan',issued_tick:2,expires_tick:10,parents:['missing'],clock_known:true}],now_tick:5}),
  define('information-barrier.authorize','Independence Information Barrier','identity_authority_privacy','information_barrier_v5.authorize_exchange',informationBarrierAuthorize,{sender_role:'BUILDER',receiver_role:'VERIFIER',payload_class:'EVIDENCE',phase:'POST_SEAL',receiver_output_sealed:true},{sender_role:'BUILDER',receiver_role:'VERIFIER',payload_class:'REASONING',phase:'INDEPENDENT_WORK',receiver_output_sealed:false}),
  define('intake-rehearsal.validate','Bounded Intake Rehearsal Gate','human_governance','intake_rehearsal_v5.validate_intake_rehearsal',intakeRehearsalValidate,{bundle:{evidence:evidence8,runtime_proven:false,canon:false,producer_id:'builder',approval_actor:'reviewer',novelty_status:'NOVEL_DELTA',human_owner:'HUMAN'}},{bundle:{evidence:{contract:true},runtime_proven:true,canon:true,producer_id:'same',approval_actor:'same',novelty_status:'NO_NOVEL_DELTA',human_owner:'AI'}}),
  define('proof-frontier.minimal','Minimal Proof Frontier Planner','dissent_verification','proof_frontier_v5.minimal_proof_frontier',proofFrontierMinimal,{obligations:['a','b','c'],coverage:{test1:['a','b'],test2:['c']}},{obligations:['a','missing'],coverage:{test1:['a']}}),
  define('proof-frontier.novelty','Novel Evidence Delta Gate','dissent_verification','proof_frontier_v5.evaluate_novelty',proofFrontierNovelty,{delta_digest:'new',prior_digests:['old'],new_test:true,new_evidence:false,new_boundary:false},{delta_digest:'same',prior_digests:['same'],new_test:true,new_evidence:true,new_boundary:true}),
  define('proof-frontier.select-tests','Change-Aware Test Selector','dissent_verification','proof_frontier_v5.select_change_tests',proofFrontierSelectTests,{root_change:true,semantic_change:false,module_test:'module:test',all_tests:['b','a']},null),
  define('revocation.cascade','Downward Authority Revocation','identity_authority_privacy','revocation_v5.cascade_revoke',revocationCascade,{nodes:leaseTree,root_id:'root'},{nodes:[...leaseTree,{lease_id:'orphan',parent_id:'missing',holder:'seat-b',actions:['read'],revoked:false,acknowledged:false}],root_id:'missing'},result => result.affected.length > 0 && result.orphans.length === 0 && result.all_acknowledged),
  define('revocation.authorize','Lease Ancestry Authorization Gate','identity_authority_privacy','revocation_v5.authorize',revocationAuthorize,{nodes:leaseTree,lease_id:'child',action:'read'},{nodes:[{...leaseTree[0],revoked:true},leaseTree[1]],lease_id:'child',action:'write'}),
  define('revocation.resume','Fresh-Lease Resume Gate','identity_authority_privacy','revocation_v5.resume_with_new_lease',revocationResume,{old:{lease_id:'old',parent_id:null,holder:'seat',actions:['read'],revoked:true,acknowledged:true},new:{lease_id:'new',parent_id:null,holder:'seat',actions:['read'],revoked:false,acknowledged:false},human_receipt:true},{old:{lease_id:'old',parent_id:null,holder:'seat',actions:['read'],revoked:false,acknowledged:false},new:{lease_id:'old',parent_id:null,holder:'seat',actions:['read'],revoked:false,acknowledged:false},human_receipt:false}),
  define('role-reassignment.validate','Role Reassignment Separation Gate','human_governance','role_reassignment_v5.validate_reassignment',roleReassignmentValidate,{assignments:[{seat_id:'a',roles:['BUILDER'],authority:['read']}],parent_authority:['read','review'],human_approved:true},{assignments:[{seat_id:'a',roles:['BUILDER','JUDGE'],authority:['write']}],parent_authority:['read'],human_approved:false}),
  define('topology.failover','Identity-Preserving Route Failover','routing_allocation','topology.failover',topologyFailover,{lock:{identity_id:'seat-a',current_route:'local',approved_routes:['local','provider-b'],authority_actions:['read'],privacy_scope:1},requested_route:'provider-b',claimed_identity:'seat-a',requested_actions:['read'],requested_privacy_scope:1},{lock:{identity_id:'seat-a',current_route:'local',approved_routes:['local'],authority_actions:['read'],privacy_scope:1},requested_route:'provider-x',claimed_identity:'seat-b',requested_actions:['write'],requested_privacy_scope:2}),
  define('topology.reconcile-partition','Partition Split-Brain Holder','handoff_continuity','topology.reconcile_partition',topologyReconcile,{left:{base_revision:1,value:'a'},right:{base_revision:2,value:'b'}},{left:{base_revision:1,value:'a'},right:{base_revision:1,value:'b'}}),
  define('authority-epoch.validate','Authority Epoch and Sequence Gate','identity_authority_privacy','authority_epoch_v6.validate_packet',authorityEpochValidate,{packet:{packet_id:'p',epoch:2,issued_seq:3,expires_seq:8,action:'read'},current_epoch:2,current_seq:5,allowed_actions:['read']},{packet:{packet_id:'p',epoch:1,issued_seq:8,expires_seq:3,action:'write'},current_epoch:2,current_seq:5,allowed_actions:['read']}),
  define('authority-epoch.rotate','Human-Receipted Epoch Rotation','human_governance','authority_epoch_v6.rotate_epoch',authorityEpochRotate,{current_epoch:2,human_receipt:true},{current_epoch:2,human_receipt:false}),
  define('causal-reconciliation.reconcile','Vector-Clock Packet Reconciler','handoff_continuity','causal_reconciliation_v6.reconcile',causalReconcile,{a:{packet_id:'a',vector:{a:2,b:1},authority_epoch:3,payload_digest:'x'},b:{packet_id:'b',vector:{a:1,b:1},authority_epoch:3,payload_digest:'y'},current_epoch:3},{a:{packet_id:'a',vector:{a:2,b:1},authority_epoch:3,payload_digest:'x'},b:{packet_id:'b',vector:{a:1,b:2},authority_epoch:3,payload_digest:'y'},current_epoch:3}),
  define('delegation-closure.evaluate','Parent Delegation Closure Gate','handoff_continuity','delegation_closure_v6.evaluate_parent_close',delegationClosureEvaluate,{parent_id:'parent',children:[{child_id:'c',parent_id:'parent',state:'COMPLETED',result_receipt:'r',authority_released:true,release_ack:true}]},{parent_id:'parent',children:[{child_id:'c',parent_id:'parent',state:'ACTIVE',result_receipt:null,authority_released:false,release_ack:false},{child_id:'orphan',parent_id:'missing',state:'COMPLETED',result_receipt:'r',authority_released:true,release_ack:true}]}),
  define('final-gate.evaluate','Final Human Intake Handoff Gate','human_governance','final_gate_v7.evaluate_final_gate',finalGateEvaluate,{bundle:{evidence:evidence11,runtime_proven:false,canon:false,auto_apply:false,producer_id:'builder',approval_actor:'reviewer',approval_actor_kind:'HUMAN',unresolved_defects:false,lineage_complete:true,novelty_status:'NOVEL_DELTA'}},{bundle:{evidence:{limitations:true},runtime_proven:true,canon:true,auto_apply:true,producer_id:'same',approval_actor:'same',approval_actor_kind:'AI',unresolved_defects:true,lineage_complete:false,novelty_status:'NO_NOVEL_DELTA'}}),
  define('human-handoff.validate','Beginner-Safe Human Handoff Kit Gate','human_governance','human_handoff_v7.validate_handoff_kit',humanHandoffValidate,{kit:{sections:{purpose:'p',start:'s',stop:'x',rollback:'r',truth_boundary:'t',checksums:'c',human_decision:'REVIEW'},auto_execute:false,start_file_count:1,beginner_safe_language:true}},{kit:{sections:{purpose:'p',human_decision:'AUTO'},auto_execute:true,start_file_count:2,beginner_safe_language:false}}),
  define('intake.evaluate','Local Intake Evidence Gate','human_governance','intake.evaluate_intake',intakeEvaluate,{evidence:{schema_pass:true,positive_tests_pass:true,negative_tests_pass:true,recovery_pass:true,projection_pass:true,rollback_present:true,owner_review_receipt:'human',unresolved_high_risk:false}},{evidence:{schema_pass:false,positive_tests_pass:true,negative_tests_pass:false,recovery_pass:false,projection_pass:false,rollback_present:false,owner_review_receipt:null,unresolved_high_risk:true}},result => result.status === 'READY_FOR_LOCAL_INTAKE_CANDIDATE'),
  define('migration.adapt','Allowlisted Payload Migration Adapter','routing_allocation','migration.adapt_payload',migrationAdapt,{payload:{required:'keep',extra:'drop'},allowlist:['required'],required:['required']},{payload:{required:'lost',extra:'drop'},allowlist:['extra'],required:['required']}),
  define('observability.validate-event','Trace Event Completeness Gate','guardrails_recovery','observability.validate_event',observabilityValidateEvent,{event:{event_id:'e',module_id:'m',event_type:'STATE',timestamp:'2026-07-28T00:00:00Z',actor_ref:'seat',new_state:'READY',evidence_refs:['r']}},{event:{event_id:'e',module_id:'m'}}),
  define('observability.evaluate-service','Service SLO and Evidence Gate','guardrails_recovery','observability.evaluate_service',observabilityEvaluateService,{latency_ms:20,latency_budget_ms:50,correctness_proven:true,evidence_refs:['test']},{latency_ms:80,latency_budget_ms:50,correctness_proven:false,evidence_refs:[]},result => result.accepted),
  define('readiness-gate.evaluate','Human-Reviewed Sandbox Readiness Gate','human_governance','readiness_gate_v6.evaluate_readiness',readinessGateEvaluate,{bundle:{evidence:evidence10,runtime_proven:false,canon:false,producer_id:'builder',approval_actor:'reviewer',approval_actor_kind:'HUMAN',novelty_status:'NOVEL_DELTA',rollback_clean:true}},{bundle:{evidence:{limitations:true},runtime_proven:true,canon:true,producer_id:'same',approval_actor:'same',approval_actor_kind:'AI',novelty_status:'NO_NOVEL_DELTA',rollback_clean:false}})
]);

module.exports = { definitions };
