'use strict';

const fs = require('fs');
const path = require('path');
const GameOrganism = require('./game-organism');
const Examples = require('./examples');

const REGISTRY_SCHEMA = 'axm.sim-living-run102-game-evidence-registry/v1';
const EXPECTED_STATE = 'STATIC_WORKING_CANDIDATE_NOT_RUNTIME_NOT_CANON';
const DEFAULT_REGISTRY = path.resolve(__dirname, '..', '..', 'intakes', 'sim-living-run102', 'evidence', 'module-registry.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unique(values) {
  return [...new Set(values)].sort();
}

function validateRegistry(registry) {
  const errors = [];
  if (!registry || registry.schema !== REGISTRY_SCHEMA) errors.push('registry schema mismatch');
  if (!registry || registry.state !== EXPECTED_STATE) errors.push('registry must remain a static non-runtime candidate');
  if (!registry || registry.module_count !== 100 || !Array.isArray(registry.modules) || registry.modules.length !== 100) errors.push('exactly 100 source module blueprints required');
  if (!registry || registry.family_count !== 10 || !registry.family_routes || Object.keys(registry.family_routes).length !== 10) errors.push('exactly ten family routes required');
  if (!registry || registry.operation_count !== 400) errors.push('exactly 400 planned operations required');
  if (!registry || registry.required_edge_count !== 366 || registry.optional_hook_count !== 128) errors.push('source dependency counts mismatch');
  if (!registry || !Array.isArray(registry.run_range) || registry.run_range[0] !== 3 || registry.run_range[1] !== 102 || registry.run_count_per_module !== 100) errors.push('exact steward coverage Runs 03-102 required');
  if (!registry || !registry.source_truth_status || Object.values(registry.source_truth_status).some((value) => value !== false)) errors.push('source truth flags must all remain false');
  if (!registry || !registry.legacy_index_holds || registry.legacy_index_holds.modules_affected !== 100 || registry.legacy_index_holds.module_manifest_last_static_run !== 72 || registry.legacy_index_holds.steward_index_last_run !== 42 || registry.legacy_index_holds.package_final_handoff_run !== 102) errors.push('legacy summary-index holds must remain visible');
  if (!registry || !Array.isArray(registry.exact_live_module_id_matches) || registry.exact_live_module_id_matches.length !== 0) errors.push('source modules cannot be treated as direct live registrations');
  if (!registry || !Array.isArray(registry.exact_live_operation_id_matches) || registry.exact_live_operation_id_matches.length !== 0) errors.push('source operations cannot be treated as direct live capabilities');

  const ids = new Set();
  const seeds = new Set();
  const families = new Set();
  let operations = 0;
  let requiredEdges = 0;
  let optionalHooks = 0;
  for (const module of (registry && registry.modules) || []) {
    if (!module || !module.id || ids.has(module.id)) errors.push('duplicate or missing module id');
    else ids.add(module.id);
    if (!module || !Number.isInteger(module.seed) || seeds.has(module.seed)) errors.push('duplicate or invalid seed');
    else seeds.add(module.seed);
    if (module) families.add(module.family);
    if (!module || module.status !== 'WORKING_CANDIDATE' || module.version !== '0.2.0-candidate') errors.push((module && module.id || 'module') + ' source status widened');
    if (!module || !Array.isArray(module.operation_ids) || module.operation_ids.length !== 4) errors.push((module && module.id || 'module') + ' operation plan mismatch');
    else operations += module.operation_ids.length;
    requiredEdges += Array.isArray(module && module.required_provider_ids) ? module.required_provider_ids.length : 0;
    optionalHooks += Array.isArray(module && module.optional_provider_ids) ? module.optional_provider_ids.length : 0;
    if (!module || !module.truth_scores || Object.values(module.truth_scores).some((value) => value !== 0)) errors.push((module && module.id || 'module') + ' truth score widened');
    if (!module || module.automatic_integration !== false || module.automatic_world_mutation !== false || module.automatic_publication !== false || module.canon !== false) errors.push((module && module.id || 'module') + ' widens authority');
    if (!module || !module.adapter || !Array.isArray(module.adapter.seams) || !module.adapter.proof_ceiling) errors.push((module && module.id || 'module') + ' lacks a bounded family route');
    if (!module || !Array.isArray(module.mandatory_holds) || !Array.isArray(module.proof_debt) || !module.proof_debt.includes('implementation absent')) errors.push((module && module.id || 'module') + ' hides implementation proof debt');
  }
  if (families.size !== 10) errors.push('family coverage mismatch');
  if (operations !== 400) errors.push('operation identity coverage mismatch');
  if (requiredEdges !== 366) errors.push('required edge coverage mismatch');
  if (optionalHooks !== 128) errors.push('optional hook coverage mismatch');
  return {
    pass: errors.length === 0,
    errors: unique(errors),
    moduleCount: ids.size,
    familyCount: families.size,
    operationCount: operations,
    requiredEdges,
    optionalHooks
  };
}

function loadRegistry(file) {
  const registry = JSON.parse(fs.readFileSync(file || DEFAULT_REGISTRY, 'utf8'));
  const checked = validateRegistry(registry);
  if (!checked.pass) throw new Error(checked.errors.join('; '));
  return registry;
}

function createEvidenceOrgan(registry) {
  registry = registry || loadRegistry();
  const checked = validateRegistry(registry);
  if (!checked.pass) throw new Error(checked.errors.join('; '));
  const moduleChecks = registry.modules.map((module) => 'sim-living-module:' + module.id + ':static-blueprint-and-holds-present');
  return GameOrganism.sealOrgan({
    id: 'axm.game.evidence.sim-living-102',
    version: '0.1.0',
    category: 'evidence',
    title: 'Simulation and Living Systems Run 102 game evidence',
    description: 'Routes 100 hash-verified static living-system contracts into a candidate game evidence plan without representing them as executable simulation modules or granting world-state, scientific, safety, publication, or release authority.',
    ports: {
      inputs: [
        { id: 'observations', type: 'game.playtest-observations/v1', required: true, multiple: false },
        { id: 'build', type: 'game.candidate-build/v1', required: true, multiple: false },
        { id: 'rules', type: 'game.rules/v1', required: true, multiple: false }
      ],
      outputs: [
        { id: 'receipt', type: 'axm.verification-receipt/v2', required: true, multiple: false }
      ]
    },
    capabilities: {
      provides: ['game.evidence', 'game.simulation-design.evidence', 'game.living-world-design.evidence', 'game.systems-proof-debt.evidence'],
      requires: ['game.playtest-observations', 'game.candidate-build', 'game.rules']
    },
    resource_budget: { cpu_weight: 2, gpu_weight: 0, peak_memory_mb: 64, working_storage_mb: 32 },
    verification: {
      automatic_checks: moduleChecks.concat([
        'sim-living-source-archive-integrity',
        'sim-living-30625-manifest-digests',
        'sim-living-30372-json-and-5000-jsonl-records',
        'sim-living-100-modules-400-operations',
        'sim-living-366-edge-acyclic-graph',
        'sim-living-runs-03-102-static-artifact-coverage',
        'sim-living-legacy-index-holds-remain-visible',
        'sim-living-zero-runtime-truth-scores',
        'no-install-world-mutation-publication-or-canon-authority'
      ]),
      human_judgments: [
        'living-system-gameplay-fit-and-fun',
        'world-rule-coherence-and-player-agency',
        'fictional-economy-and-social-system-fairness',
        'accessibility-and-human-factors',
        'scientific-safety-and-predictive-nonclaim-clarity',
        'representative-runtime-performance-and-stability',
        'authoritative-world-state-owner-and-migration-approval',
        'publication-canon-and-release-approval'
      ],
      assurance_ceiling: 'static-source-contract-and-candidate-composition-evidence; no executable simulation, behavioral correctness, scientific validity, safety, performance, world-state integration, publication, or release proof'
    },
    implementation: {
      kind: 'existing-runtime-reference',
      reference: 'intakes/sim-living-run102/evidence/module-registry.json',
      status: 'AVAILABLE'
    }
  });
}

function createSimLivingGameEvidenceExample(registry) {
  registry = registry || loadRegistry();
  const base = Examples.createStreetLifeExample();
  const evidence = createEvidenceOrgan(registry);
  const evidenceReference = base.blueprint.organs.find((item) => item.slot_category === 'evidence');
  const assemblyReference = base.blueprint.organs.find((item) => item.slot_category === 'assembly');
  const rulesReference = base.blueprint.organs.find((item) => item.slot_category === 'world-rules');
  if (!evidenceReference || !assemblyReference || !rulesReference) throw new Error('base game organism simulation evidence seams are missing');

  const organs = base.organs.map((organ) => organ.category === 'evidence' ? evidence : organ);
  const references = base.blueprint.organs.map((reference) => reference.instance_id === evidenceReference.instance_id ? {
    instance_id: reference.instance_id,
    slot_category: 'evidence',
    organ_id: evidence.id,
    organ_version: evidence.version,
    organ_digest: evidence.digest
  } : clone(reference));
  const connections = base.blueprint.connections.map(clone).concat([
    {
      from: { instance_id: assemblyReference.instance_id, port: 'build' },
      to: { instance_id: evidenceReference.instance_id, port: 'build' }
    },
    {
      from: { instance_id: rulesReference.instance_id, port: 'rules' },
      to: { instance_id: evidenceReference.instance_id, port: 'rules' }
    }
  ]);
  const blueprint = GameOrganism.sealBlueprint({
    ...clone(base.blueprint),
    id: 'axm.game-organism.street-life-sim-living-evidence-slice',
    title: 'Street Life Slice with Simulation Living Run 102 Evidence',
    organs: references,
    connections
  });
  const gameRegistry = GameOrganism.createRegistry(organs);
  const receipt = GameOrganism.compile(blueprint, gameRegistry);
  return { organs, registry: gameRegistry, blueprint, receipt, sourceRegistry: clone(registry), evidenceOrgan: evidence };
}

function readiness(registry) {
  registry = registry || loadRegistry();
  const checked = validateRegistry(registry);
  return {
    schema: 'axm.sim-living-run102-readiness/v1',
    candidate_evidence_ready: checked.pass,
    module_count: checked.moduleCount,
    family_count: checked.familyCount,
    planned_operation_count: checked.operationCount,
    required_edge_count: checked.requiredEdges,
    static_source_integrity: checked.pass ? 'PASS' : 'FAIL',
    static_blueprint_graph: checked.pass ? 'PASS' : 'FAIL',
    legacy_summary_index_holds: checked.pass ? 2 : null,
    executable_source_modules_proven: false,
    behavioral_fixtures_executed: false,
    representative_performance_measured: false,
    authoritative_world_integration_approved: false,
    scientific_or_safety_validity_proven: false,
    human_gameplay_approved: false,
    published: false,
    canon: false,
    release_approved: false
  };
}

module.exports = {
  REGISTRY_SCHEMA,
  EXPECTED_STATE,
  DEFAULT_REGISTRY,
  validateRegistry,
  loadRegistry,
  createEvidenceOrgan,
  createSimLivingGameEvidenceExample,
  readiness
};
