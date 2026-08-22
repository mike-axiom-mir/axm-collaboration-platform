'use strict';

const examples = {
  'axm.verify.verdict-state-normalizer': {
    construct: { args: [{ ok: 'PASS', skipped: 'NOT_RUN' }], kwargs: {} },
    call: { args: ['ok', 'platform-check'], kwargs: {} }
  },
  'axm.verify.claim-proof-surface-router': {
    construct: { args: [{ 'contract-test': { verifier_id: 'axm.contract', evidence_kind: 'machine', native_authority: true }, 'native-visual': { verifier_id: 'axm.visual', evidence_kind: 'visual', native_authority: true } }], kwargs: {} },
    call: { args: [{ claim_id: 'claim-1', claim_type: 'visual', required_proof_surfaces: ['contract-test', 'native-visual'] }], kwargs: {} }
  },
  'axm.verify.evidence-sufficiency-policy': {
    construct: { args: ['policy-1', 2, ['code', 'visual'], 2], kwargs: {} },
    call: { args: ['claim-1', [{ receipt_id: 'r1', claim_id: 'claim-1', verdict_state: 'PASS', freshness_state: 'FRESH', relevance_state: 'RELEVANT', native_fit_state: 'FIT', proof_surface: 'code', verifier_id: 'v1', independence_state: 'INDEPENDENT' }, { receipt_id: 'r2', claim_id: 'claim-1', verdict_state: 'PASS', freshness_state: 'FRESH', relevance_state: 'RELEVANT', native_fit_state: 'FIT', proof_surface: 'visual', verifier_id: 'v2', independence_state: 'INDEPENDENT' }]], kwargs: {} }
  },
  'axm.verify.proof-freshness-expiry-policy': {
    construct: { args: ['freshness-1', ['artifact', 'environment'], 300], kwargs: {} },
    call: { args: [{ proof_id: 'p1', issued_at: '2026-07-27T20:00:00Z', context: { artifact: 'sha256:abc', environment: { runtime: 'AXM' } } }, { artifact: 'sha256:abc', environment: { runtime: 'AXM' } }, '2026-07-27T20:01:00Z'], kwargs: {} }
  },
  'axm.verify.test-gap-blindspot-detector': {
    construct: { args: [], kwargs: {} },
    call: { args: [[{ requirement_id: 'r1', required_evidence: ['positive', 'negative'], risk_boundaries: ['empty'], needs_native_evidence: true }], [{ requirement_id: 'r1', evidence_type: 'positive', status: 'PASS' }, { requirement_id: 'r1', evidence_type: 'negative', status: 'PASS' }, { requirement_id: 'r1', evidence_type: 'native', status: 'PASS', risk_boundary_id: 'empty' }], [{ fixture_id: 'f1', status: 'FRESH' }], []], kwargs: {} }
  },
  'axm.verify.release-gate-decision-packet': {
    construct: { args: [], kwargs: {} },
    call: { args: [{ artifact: { artifact_id: 'a1', digest: 'sha256:abc' }, required_receipt_ids: ['r1'], receipts: [{ receipt_id: 'r1', verdict_state: 'PASS', fresh: true }], unresolved_conflicts: [], failed_checks: [], limitations: ['device scope'], required_approval_roles: ['steward'], approvals: [{ role: 'steward', decision: 'APPROVE' }], rollback_plan: { plan_id: 'rb1', verified: true } }], kwargs: {} }
  }
};

const el = id => document.getElementById(id);
let modules = [];

function selected() {
  return modules.find(module => module.id === el('organ').value);
}

function renderDetail() {
  const module = selected();
  if (!module) return;
  el('name').textContent = module.name;
  el('seed').textContent = 'SEED ' + String(module.seed).padStart(3, '0') + ' · ' + module.referenceTests + ' TESTS';
  el('purpose').textContent = module.purpose;
  el('operation').textContent = module.primarySymbol + '.' + module.operation;
  el('inputs').textContent = module.inputContract;
  el('boundary').textContent = module.apiExecutable ? module.sideEffects : module.holdReason;
  el('state').textContent = module.apiExecutable ? 'CALLABLE · TEST-HOLD' : 'GUARDED';
  el('state').className = 'chip ' + (module.apiExecutable ? 'ready' : 'guarded');
  el('run').disabled = !module.apiExecutable;
  el('contract').href = module.contractUrl;
  el('intake').href = module.intakeUrl;
  if (examples[module.id]) el('envelope').value = JSON.stringify(examples[module.id], null, 2);
}

function renderOptions(query) {
  const filter = String(query || '').toLowerCase();
  const current = el('organ').value;
  el('organ').replaceChildren(...modules.filter(module => [module.id, module.name, module.family, module.purpose].join(' ').toLowerCase().includes(filter)).map(module => {
    const option = document.createElement('option');
    option.value = module.id;
    option.textContent = String(module.seed).padStart(3, '0') + ' · ' + module.name + (module.apiExecutable ? '' : ' · GUARDED');
    return option;
  }));
  if ([...el('organ').options].some(option => option.value === current)) el('organ').value = current;
  else if (el('organ').options.length) el('organ').selectedIndex = 0;
  renderDetail();
}

async function run() {
  const module = selected();
  if (!module || !module.apiExecutable) return;
  let envelope;
  try { envelope = JSON.parse(el('envelope').value); }
  catch (error) { el('result').textContent = 'Invalid JSON: ' + error.message; return; }
  el('run').disabled = true;
  el('result').textContent = 'Running ' + module.name + '…';
  try {
    const response = await fetch('/api/verification-proof/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ moduleId: module.id, envelope }) });
    const payload = await response.json();
    el('result').textContent = JSON.stringify(payload, null, 2);
  } catch (error) {
    el('result').textContent = 'Run failed: ' + error.message;
  } finally {
    el('run').disabled = !module.apiExecutable;
  }
}

async function start() {
  const response = await fetch('/api/verification-proof/catalog');
  const payload = await response.json();
  modules = payload.modules || [];
  el('callable-count').textContent = payload.apiExecutableCount;
  el('guarded-count').textContent = payload.guardedCount + payload.sourceHeldCount;
  renderOptions('');
  el('featured').replaceChildren(...Object.keys(examples).map(id => {
    const module = modules.find(row => row.id === id);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = module ? module.name : id;
    button.addEventListener('click', () => { el('organ').value = id; renderDetail(); });
    return button;
  }));
}

el('search').addEventListener('input', event => renderOptions(event.target.value));
el('organ').addEventListener('change', renderDetail);
el('run').addEventListener('click', run);
start().catch(error => { el('state').textContent = 'UNAVAILABLE'; el('result').textContent = error.message; });

