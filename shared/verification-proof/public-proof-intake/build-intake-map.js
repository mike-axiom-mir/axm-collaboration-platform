#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const REGISTRY = path.join(ROOT, 'intakes', 'public-proof-runs-01-39-v0.40.0-handoff', 'AXM_PUBLIC_PROOF_SIMPLE_LOCAL_INTAKE_HANDOFF_2026-07-28', '03_REFERENCE', '01_FINAL_REGISTRY_v0_40_0.json');
const TOOLS_INDEX = path.join(ROOT, 'tools-index.json');
const BATCH1_MAP = path.join(ROOT, 'shared', 'verification-proof', 'public-proof-batch1', 'integration-map.json');
const OUTPUT = path.join(__dirname, 'intake-map.json');
const STOP = new Set(['and', 'only', 'axm', 'public', 'proof', 'demo', 'demonstration', 'tool', 'module', 'local', 'system', 'state', 'status', 'record', 'contract', 'profile', 'route', 'result', 'schema', 'truth', 'identity', 'versioned', 'with', 'from', 'into', 'used', 'using', 'each', 'without', 'through', 'which', 'that', 'this', 'under', 'before', 'after']);

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function tokens(value) {
  return new Set(String(value || '').toLowerCase().match(/[a-z0-9]+/g)?.filter(token => token.length > 2 && !STOP.has(token)) || []);
}
function intersection(left, right) { return [...left].filter(item => right.has(item)); }
function jaccard(left, right) {
  const union = new Set([...left, ...right]);
  return union.size ? intersection(left, right).length / union.size : 0;
}
function round(value) { return Math.round(value * 1000) / 1000; }

const registry = readJson(REGISTRY);
const index = readJson(TOOLS_INDEX);
const reviewedBatch1 = fs.existsSync(BATCH1_MAP) ? readJson(BATCH1_MAP) : { seeds: [] };
const reviewedOwners = new Map(reviewedBatch1.seeds.map(seed => [seed.id, seed.owner]));
const tools = index.tools.map(tool => {
  const contract = tool.contract || {};
  const nameTokens = tokens([tool.id, tool.name].join(' '));
  const capabilityTokens = tokens([...(contract.provides || []), ...(contract.consumes || [])].join(' '));
  return { id: tool.id, name: tool.name, status: tool.status, nameTokens, allTokens: new Set([...nameTokens, ...capabilityTokens]) };
});

const seeds = registry.seeds.map(seed => {
  const contract = seed.strengthened_contract;
  const state = seed.growth_layers.run_39.state;
  const eligible = state === 'ELIGIBLE_FOR_REAL_METADATA_OVERLAP_SCAN_NOT_INTEGRATION';
  const titleTokens = tokens(seed.title);
  const semanticTokens = tokens([
    seed.title,
    seed.source.source_purpose,
    ...(contract.existing_axm_integration_targets || []),
    ...(contract.owns || []),
    contract.primary_output && contract.primary_output.relative_path
  ].join(' '));
  const candidates = tools.map(tool => {
    const shared = intersection(semanticTokens, tool.allTokens);
    const signals = [];
    let score = shared.length * 2 + jaccard(titleTokens, tool.nameTokens) * 12 + jaccard(semanticTokens, tool.allTokens) * 8;
    for (const target of contract.existing_axm_integration_targets || []) {
      const targetTokens = tokens(target);
      const similarity = jaccard(targetTokens, tool.nameTokens);
      if (similarity >= 0.5 || (targetTokens.size && intersection(targetTokens, tool.nameTokens).length === targetTokens.size)) {
        score += 20;
        signals.push('INTEGRATION_TARGET_NAME_MATCH:' + target);
      }
    }
    if (jaccard(titleTokens, tool.nameTokens) >= 0.35) signals.push('TITLE_TOKEN_MATCH');
    if (shared.length) signals.push('SEMANTIC_TOKENS:' + shared.sort().slice(0, 8).join(','));
    return { module_id: tool.id, name: tool.name, status: tool.status, score: round(score), signals };
  }).filter(row => row.score >= 2).sort((a, b) => b.score - a.score || a.module_id.localeCompare(b.module_id)).slice(0, 5);
  const best = candidates[0];
  const reviewedOwner = reviewedOwners.get(seed.id) || null;
  const evidenceBackedBest = best && best.signals.some(signal => signal.startsWith('INTEGRATION_TARGET_NAME_MATCH:') || signal === 'TITLE_TOKEN_MATCH');
  const recommendedOwner = reviewedOwner || (seed.steward_label !== 'NEW' && evidenceBackedBest ? best.module_id : null);
  const overlapStrength = reviewedOwner ? 'REVIEWED_BATCH1' : !best ? 'NONE' : evidenceBackedBest && best.score >= 20 ? 'STRONG' : evidenceBackedBest ? 'MODERATE' : 'WEAK';
  return {
    id: seed.id,
    seed_number: seed.seed_number,
    title: seed.title,
    family: seed.family,
    source_purpose: seed.source.source_purpose,
    priority: seed.local_intake.priority,
    wave: seed.local_intake.wave,
    complexity: seed.local_intake.complexity,
    source_decision: seed.steward_label,
    intake_state: state,
    eligible,
    implementation_decision: eligible ? 'LOCAL_CONTRACT_READY' : 'HOLD_ENFORCED',
    hold_blockers: seed.growth_layers.run_11.root_research_blockers || [],
    dependencies: contract.required_seed_dependencies || [],
    required_inputs: contract.required_inputs || [],
    primary_output: contract.primary_output,
    schema_file: seed.id.replace(/^axm\.proof\./, '') + '.run-packet.schema.json',
    fixture_strategy: seed.local_intake.priority === 'P0_CONTRACT_OR_GUARD'
      ? 'PRESERVED_RUN02_FOUR_CLASS'
      : eligible ? 'DETERMINISTIC_SYNTHETIC_VALID_AND_BLOCKED' : 'NONE_HELD',
    contract_custodian: 'verification-proof-lab',
    recommended_existing_owner: recommendedOwner,
    overlap_strength: overlapStrength,
    overlap_candidates: candidates,
    unresolved: seed.unresolved
  };
});

const result = {
  schema: 'axm.public-proof.local-intake-map/v1',
  version: 'v0.1.0',
  source_registry: path.relative(ROOT, REGISTRY).replace(/\\/g, '/'),
  source_registry_sha256: sha256(REGISTRY),
  tools_index_sha256: sha256(TOOLS_INDEX),
  source_tools_index_digest: index.sourceDigest,
  metadata_only: true,
  contains_private_paths: false,
  contains_source_code: false,
  counts: {
    seeds: seeds.length,
    eligible: seeds.filter(seed => seed.eligible).length,
    held: seeds.filter(seed => !seed.eligible).length,
    eligible_p0: seeds.filter(seed => seed.eligible && seed.priority === 'P0_CONTRACT_OR_GUARD').length,
    eligible_p1: seeds.filter(seed => seed.eligible && seed.priority === 'P1_CAPABILITY').length,
    extend_existing: seeds.filter(seed => seed.eligible && seed.source_decision === 'EXTEND_EXISTING').length,
    adapter_between_existing: seeds.filter(seed => seed.eligible && seed.source_decision === 'ADAPTER_BETWEEN_EXISTING').length,
    new_contracts: seeds.filter(seed => seed.eligible && seed.source_decision === 'NEW').length
  },
  truth: {
    local_contract_layer_only: true,
    runtime_proof: false,
    publication: false,
    canon: false,
    automatic_activation: false
  },
  seeds
};

fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log('public proof intake map: ' + result.counts.eligible + ' eligible · ' + result.counts.held + ' held · ' + result.counts.seeds + ' total');
