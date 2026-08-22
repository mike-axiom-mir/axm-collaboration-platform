'use strict';

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function object(value, name) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`); return value; }
function list(value, name) { if (!Array.isArray(value)) throw new Error(`${name} must be an array`); return value; }
function sorted(values) { return [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0); }

const ROOT_RISK_MODULES = new Set(['axm.team.authority-lease','axm.team.private-memory-boundary','axm.team.guardian-tripwire','axm.team.emergency-stop-neutralizer','axm.team.human-merge-gate','axm.team.bounded-collaboration-orchestrator']);
function impactPlan(input) {
  const entries = list(input.entries, 'entries').map(entry => object(entry, 'entry')), changed = new Set(list(input.changed_module_ids, 'changed_module_ids').map(String));
  if (input.changed_root_contract) return { selected_count:entries.length, selected_module_ids:entries.map(entry => entry.module_id), reason:'ROOT_CONTRACT_CHANGED' };
  const byId = new Map(entries.map(entry => [String(entry.module_id), entry])), unknown = sorted([...changed].filter(id => !byId.has(id)));
  if (unknown.length) throw new Error(`Unknown module IDs: ${JSON.stringify(unknown)}`);
  const forceFull = [...changed].some(id => ROOT_RISK_MODULES.has(id) || byId.get(id).risk_tier === 'CRITICAL');
  let selected, reason;
  if (forceFull) { selected = entries.map(entry => entry.module_id); reason = 'ROOT_OR_CRITICAL_CHANGE_FORCES_FULL_SUITE'; }
  else {
    const families = new Set([...changed].map(id => byId.get(id).family)), selectedSet = new Set(changed);
    for (const entry of entries) if (families.has(entry.family) || (entry.dependency_module_ids || []).some(id => changed.has(String(id)))) selectedSet.add(String(entry.module_id));
    selected = sorted(selectedSet); reason = 'SPARSE_FAMILY_AND_DEPENDENCY_IMPACT_CONE';
  }
  return { selected_module_ids:selected, selected_count:selected.length, full_count:entries.length, reason:'SPARSE_DEPENDENCY_AND_RISK_CONE' };
}

const ROOT_KINDS = new Set(['root_policy','authority','privacy','emergency_stop','human_merge_gate','canon_boundary']);
function proofGraphSelect(input) {
  const nodes = new Map(list(input.nodes, 'nodes').map(node => [String(node.node_id), { digest:node.digest, kind:node.kind, fresh:node.fresh !== false }]));
  const edges = new Map(); for (const id of nodes.keys()) edges.set(id, new Set());
  for (const [node, dependencies] of Object.entries(object(input.edges || {}, 'edges'))) edges.set(node, new Set(dependencies.map(String)));
  const changed = new Set(list(input.changed, 'changed').map(String));
  const kinds = new Set([...changed].filter(id => nodes.has(id)).map(id => nodes.get(id).kind));
  if ([...kinds].some(kind => ROOT_KINDS.has(kind))) return { selected:sorted(new Set(input.all_tests || [])), forced_full:true };
  const stale = new Set(changed); let progress = true;
  while (progress) { progress = false; for (const [node, dependencies] of edges) if (!stale.has(node) && [...dependencies].some(id => stale.has(id))) { stale.add(node); progress = true; } }
  return { selected:sorted([...stale].filter(id => id.startsWith('test:'))), forced_full:false };
}
function proofGraphReusable(input) {
  const prior = object(input.prior, 'prior'), current = object(input.current, 'current'), keys = ['contract_digest','test_digest','fixture_digest','validator_digest','source_digest'];
  return keys.every(key => prior[key] === current[key]) && Boolean(prior.passed);
}

function orchestratorDryRun(input) {
  const events = []; const emit = (step, data = {}) => events.push({ sequence:events.length + 1, step, ...data });
  if (input.stopped) return { ok:false, code:'ORCHESTRATOR_STOPPED', events };
  emit('ORIENT',{task_id:input.task_id});
  if (!input.authority_ok) { emit('CONTRACT',{status:'HELD',reason:'AUTHORITY_INVALID'}); return { ok:false, code:'AUTHORITY_INVALID', events }; }
  emit('CONTRACT',{status:'VALIDATED'}); emit('ALLOCATE',{status:'PROPOSED'}); emit('HANDOFF',{status:input.handoff_accepted ? 'ACCEPTED' : 'REFUSED'});
  if (!input.handoff_accepted) return { ok:false, code:'HANDOFF_NOT_ACCEPTED', events };
  emit('WORK',{status:'RETURNED'}); emit('CHALLENGE',{dissent_preserved:true}); emit('VERIFY',{independent:Boolean(input.independent_verification)});
  if (!input.independent_verification) return { ok:false, code:'INDEPENDENT_VERIFICATION_REQUIRED', events };
  emit('MERGE_PROPOSE',{status:'PROPOSAL_ONLY'});
  if (input.orchestrator_self_approval) return { ok:false, code:'ORCHESTRATOR_SELF_APPROVAL_DENIED', events };
  if (!['ACCEPT','REJECT','POSTPONE','REVISE'].includes(input.human_decision)) return { ok:false, code:'EXPLICIT_HUMAN_DECISION_REQUIRED', events };
  emit('HUMAN_DECIDE',{decision:input.human_decision}); emit('CLOSE',{status:input.human_decision === 'ACCEPT' ? 'READY_FOR_LOCAL_INTAKE_CANDIDATE' : 'CLOSED_WITHOUT_MERGE'});
  return { ok:true, code:'DRY_RUN_COMPLETE', events, integrated:false, canon:false, max_status:events[events.length - 1].status };
}

function incidentSimulate(input) {
  const stopped = new Set(), frozen = new Set(), evidence = [], results = [];
  for (const action of list(input.actions, 'actions')) {
    if (action.type === 'trip') {
      for (const id of action.task_tree || []) stopped.add(String(id)); for (const id of action.leases || []) frozen.add(String(id));
      const receipt = { event:'INCIDENT_TRIP', tasks:sorted(new Set(action.task_tree || [])), leases:sorted(new Set(action.leases || [])), reason:action.reason };
      evidence.push(receipt); results.push(receipt);
    } else if (action.type === 'may_act') {
      const ok = !stopped.has(String(action.task_id)) && !frozen.has(String(action.lease_id)); results.push({ type:'may_act', task_id:action.task_id, lease_id:action.lease_id, ok, code:ok ? 'ACTIVE' : 'INCIDENT_STOP_ACTIVE' });
    } else if (action.type === 'restart') {
      if (!action.human_receipt) results.push({ ok:false, code:'HUMAN_RESTART_DECISION_REQUIRED' });
      else if (!action.recovery_checks_passed) results.push({ ok:false, code:'RECOVERY_CHECKS_NOT_PASSED' });
      else if (!action.new_authority_receipt) results.push({ ok:false, code:'NEW_AUTHORITY_RECEIPT_REQUIRED' });
      else {
        for (const id of action.task_tree || []) stopped.delete(String(id)); for (const id of action.leases || []) frozen.delete(String(id));
        const receipt = { event:'INCIDENT_RESTART', human_receipt:action.human_receipt, new_authority_receipt:action.new_authority_receipt };
        evidence.push(receipt); results.push({ ok:true, code:'RESTARTED', receipt });
      }
    } else throw new Error('incident action.type must be trip, may_act, or restart');
  }
  return { ok:results.every(result => result.ok !== false && result.code !== 'INCIDENT_STOP_ACTIVE'), results, state:{ stopped:sorted(stopped), frozen_leases:sorted(frozen), evidence } };
}

function offlineQueue(input) {
  const limit = Number(input.limit), packets = [], ids = new Set(), receipts = [];
  for (const packet of list(input.packets, 'packets')) {
    const packetId = String(packet.packet_id || ''); let ok, code;
    if (!packetId) { ok = false; code = 'PACKET_ID_REQUIRED'; }
    else if (ids.has(packetId)) { ok = true; code = 'DUPLICATE_SUPPRESSED'; }
    else if (packet.authority_expired) { ok = false; code = 'AUTHORITY_EXPIRED_PACKET_HELD'; }
    else if (packets.length >= limit) { ok = false; code = 'OFFLINE_QUEUE_FULL'; }
    else { ids.add(packetId); packets.push(clone(packet)); ok = true; code = 'QUEUED'; }
    receipts.push({ packet_id:packetId, ok, code });
  }
  return { ok:receipts.every(row => row.ok), receipts, packets, ids:sorted(ids) };
}

function artifactCell(input) {
  let revision = Number(input.initial && input.initial.revision || 0), value = input.initial ? clone(input.initial.value) : null;
  let leaseHolder = input.initial && input.initial.lease_holder != null ? input.initial.lease_holder : null, leaseId = input.initial && input.initial.lease_id != null ? input.initial.lease_id : null;
  const idempotency = new Map(), receipts = [];
  for (const action of list(input.actions, 'actions')) {
    if (action.type === 'acquire') {
      let ok = true, code = 'LEASE_ACQUIRED'; if (leaseHolder !== null && leaseHolder !== action.holder) { ok = false; code = 'WRITE_LEASE_CONFLICT'; } else { leaseHolder = action.holder; leaseId = action.lease_id; }
      receipts.push({ type:'acquire', ok, code });
    } else if (action.type === 'release') {
      let ok = true, code = 'LEASE_RELEASED'; if (action.holder !== leaseHolder || action.lease_id !== leaseId) { ok = false; code = 'LEASE_RELEASE_DENIED'; } else { leaseHolder = null; leaseId = null; }
      receipts.push({ type:'release', ok, code });
    } else if (action.type === 'write') {
      let receipt;
      if (idempotency.has(action.idempotency_key)) receipt = clone(idempotency.get(action.idempotency_key));
      else if (action.holder !== leaseHolder || action.lease_id !== leaseId) receipt = { ok:false, code:'WRITE_LEASE_INVALID', revision };
      else if (Number(action.expected_revision) !== revision) receipt = { ok:false, code:'STALE_BASE_REVISION', revision };
      else { revision += 1; value = clone(action.value); receipt = { ok:true, code:'WRITE_APPLIED', revision, idempotency_key:action.idempotency_key }; idempotency.set(action.idempotency_key, clone(receipt)); }
      receipts.push({ type:'write', ...receipt });
    } else throw new Error('artifact action.type must be acquire, release, or write');
  }
  return { ok:receipts.every(row => row.ok), receipts, state:{ revision, value, lease_holder:leaseHolder, lease_id:leaseId, idempotency_keys:sorted(idempotency.keys()) } };
}

function sagaExecute(input) {
  const steps = list(input.steps, 'steps').map(step => ({ name:String(step.name), reversible:step.reversible !== false })), applied = [], receipts = [];
  for (const step of steps) {
    if (!step.reversible && !input.human_irreversible_approval) return { ok:false, status:'HELD', code:'IRREVERSIBLE_WITHOUT_HUMAN', receipts };
    if (step.name === input.fail_at) {
      const compensated = [];
      for (const prior of [...applied].reverse()) if (prior.reversible) {
        if (prior.name === input.compensation_fail_at) return { ok:false, status:'HELD_RECOVERY_REQUIRED', code:'COMPENSATION_FAILED', compensated, receipts };
        compensated.push(prior.name); receipts.push({ type:'COMPENSATED', step:prior.name });
      }
      return { ok:false, status:'ROLLED_BACK', code:'STEP_FAILED', compensated, receipts };
    }
    applied.push(step); receipts.push({ type:'APPLIED_PROPOSAL', step:step.name });
  }
  return { ok:true, status:'PROPOSAL_COMPLETE_NOT_COMMITTED', applied:applied.map(step => step.name), receipts };
}

function define(id,name,family,source,run,ready,held=null,isOk=null){return{id,name,family,source,run,ready,held,isOk};}
const entries=[{module_id:'safe.a',family:'task_contracts',risk_tier:'LOW',dependency_module_ids:[]},{module_id:'safe.b',family:'task_contracts',risk_tier:'MEDIUM',dependency_module_ids:['safe.a']},{module_id:'axm.team.human-merge-gate',family:'human_governance',risk_tier:'CRITICAL',dependency_module_ids:[]}];
const definitions=Object.freeze([
  define('impact.plan','Sparse Change Impact Planner','dissent_verification','impact_cache.impact_plan',impactPlan,{entries,changed_module_ids:['safe.a'],changed_root_contract:false},null),
  define('proof-graph.select-tests','Proof Dependency Test Selector','dissent_verification','proof_graph.ProofGraph.select_tests',proofGraphSelect,{nodes:[{node_id:'source',digest:'s',kind:'module',fresh:true},{node_id:'test:unit',digest:'t',kind:'test',fresh:true}],edges:{'test:unit':['source']},changed:['source'],all_tests:['test:unit','test:all']},null),
  define('proof-graph.reusable-evidence','Evidence Reuse Digest Gate','dissent_verification','proof_graph.reusable_evidence',proofGraphReusable,{prior:{contract_digest:'a',test_digest:'b',fixture_digest:'c',validator_digest:'d',source_digest:'e',passed:true},current:{contract_digest:'a',test_digest:'b',fixture_digest:'c',validator_digest:'d',source_digest:'e'}},{prior:{contract_digest:'a',test_digest:'b',fixture_digest:'c',validator_digest:'d',source_digest:'old',passed:true},current:{contract_digest:'a',test_digest:'b',fixture_digest:'c',validator_digest:'d',source_digest:'new'}},result=>result===true),
  define('orchestrator.dry-run','Bounded Human-AI Orchestrator Dry Run','collaboration_patterns','orchestrator_v3.DryRunOrchestrator.execute',orchestratorDryRun,{task_id:'t',authority_ok:true,handoff_accepted:true,independent_verification:true,human_decision:'ACCEPT',orchestrator_self_approval:false,stopped:false},{task_id:'t',authority_ok:true,handoff_accepted:true,independent_verification:true,human_decision:'ACCEPT',orchestrator_self_approval:true,stopped:false}),
  define('incident.simulate','Incident Stop and Recovery Rehearsal','guardrails_recovery','incident.IncidentController',incidentSimulate,{actions:[{type:'trip',task_tree:['t'],leases:['l'],reason:'test'},{type:'restart',task_tree:['t'],leases:['l'],human_receipt:'human',recovery_checks_passed:true,new_authority_receipt:'new'},{type:'may_act',task_id:'t',lease_id:'l'}]},{actions:[{type:'trip',task_tree:['t'],leases:['l'],reason:'test'},{type:'may_act',task_id:'t',lease_id:'l'},{type:'restart',task_tree:['t'],leases:['l'],human_receipt:null,recovery_checks_passed:false,new_authority_receipt:null}]}),
  define('offline.queue','Bounded Offline Packet Queue','handoff_continuity','offline.BoundedOfflineQueue',offlineQueue,{limit:2,packets:[{packet_id:'a',value:1},{packet_id:'a',value:1},{packet_id:'b',value:2}]},{limit:1,packets:[{packet_id:'',value:0},{packet_id:'expired',authority_expired:true},{packet_id:'a'},{packet_id:'b'}]}),
  define('workspace.artifact-cell','Lease and Compare-and-Swap Artifact Cell','artifacts_merge','concurrency.ArtifactCell',artifactCell,{initial:{revision:0,value:null,lease_holder:null,lease_id:null},actions:[{type:'acquire',holder:'seat-a',lease_id:'l1'},{type:'write',holder:'seat-a',lease_id:'l1',expected_revision:0,value:{x:1},idempotency_key:'k1'},{type:'write',holder:'seat-a',lease_id:'l1',expected_revision:0,value:{x:2},idempotency_key:'k1'},{type:'release',holder:'seat-a',lease_id:'l1'}]},{initial:{revision:1,value:{x:1},lease_holder:'seat-a',lease_id:'l1'},actions:[{type:'acquire',holder:'seat-b',lease_id:'l2'},{type:'write',holder:'seat-b',lease_id:'l2',expected_revision:0,value:{x:2},idempotency_key:'k2'},{type:'release',holder:'seat-b',lease_id:'l2'}]}),
  define('recovery.saga','Compensating Proposal Saga','guardrails_recovery','saga_v4.execute_saga',sagaExecute,{steps:[{name:'prepare',reversible:true},{name:'review',reversible:true}],fail_at:null,human_irreversible_approval:false,compensation_fail_at:null},{steps:[{name:'prepare',reversible:true},{name:'apply',reversible:false}],fail_at:null,human_irreversible_approval:false,compensation_fail_at:null})
]);

module.exports={definitions};
