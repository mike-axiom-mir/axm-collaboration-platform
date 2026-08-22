'use strict';

const fs = require('fs');
const path = require('path');
const GameOrganism = require('./game-organism');
const Examples = require('./examples');

const REGISTRY_SCHEMA = 'axm.cartoon-3d-game-evidence-registry/v1';
const DEFAULT_REGISTRY = path.resolve(__dirname, 'source-evidence', 'cartoon-3d-run100', 'organ-registry.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unique(values) {
  return [...new Set(values)].sort();
}

function validateRegistry(registry) {
  const errors = [];
  if (!registry || registry.schema !== REGISTRY_SCHEMA) errors.push('registry schema mismatch');
  if (!registry || registry.state !== 'TEST-HOLD') errors.push('registry must remain TEST-HOLD');
  if (!registry || registry.organ_count !== 100 || !Array.isArray(registry.organs) || registry.organs.length !== 100) errors.push('exactly 100 organs required');
  if (!registry || registry.family_count !== 11) errors.push('exactly 11 adapter families required');
  if (!registry || !registry.local_rerun || registry.local_rerun.pass_count !== 100 || registry.local_rerun.fail_count !== 0 || registry.local_rerun.tests_passed !== 3612) errors.push('complete local rerun required');
  const ids = new Set(), runs = new Set(), families = new Set();
  for (const organ of (registry && registry.organs) || []) {
    if (!organ || !organ.id || ids.has(organ.id)) errors.push('duplicate or missing organ id');
    else ids.add(organ.id);
    if (!organ || !Number.isInteger(organ.run) || runs.has(organ.run)) errors.push('duplicate or invalid run');
    else runs.add(organ.run);
    if (organ && organ.family) families.add(organ.family);
    if (!organ || organ.lifecycle !== 'TEST-HOLD' || organ.local_rerun !== 'PASS') errors.push((organ && organ.id || 'organ') + ' is not a passing TEST-HOLD candidate');
    if (!organ || organ.automatic_installation !== false || organ.automatic_promotion !== false || organ.canon !== false) errors.push((organ && organ.id || 'organ') + ' widens authority');
    if (!organ || !organ.adapter || !Array.isArray(organ.adapter.asset_hand_ids) || !organ.adapter.proof_ceiling) errors.push((organ && organ.id || 'organ') + ' lacks an explicit adapter route');
  }
  if (families.size !== 11) errors.push('adapter family coverage mismatch');
  return { pass: errors.length === 0, errors: unique(errors), organCount: ids.size, familyCount: families.size };
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
  return GameOrganism.sealOrgan({
    id: 'axm.game.evidence.cartoon-3d-100',
    version: '0.1.0',
    category: 'evidence',
    title: 'Cartoon 3D 100-organ game evidence',
    description: 'Routes asset, animation, motion, and playtest evidence through 100 locally rerun TEST-HOLD contracts without approving visuals, gameplay, licensing, or release.',
    ports: {
      inputs: [
        { id: 'observations', type: 'game.playtest-observations/v1', required: true, multiple: false },
        { id: 'assets', type: 'game.asset-set/v1', required: true, multiple: false },
        { id: 'animation', type: 'game.animation-state/v1', required: true, multiple: false },
        { id: 'motion', type: 'game.motion-state/v1', required: true, multiple: false }
      ],
      outputs: [
        { id: 'receipt', type: 'axm.verification-receipt/v2', required: true, multiple: false }
      ]
    },
    capabilities: {
      provides: ['game.evidence', 'game.cartoon-3d-evidence'],
      requires: ['game.playtest-observations', 'game.assets', 'game.animation', 'game.motion']
    },
    resource_budget: { cpu_weight: 4, gpu_weight: 0, peak_memory_mb: 96, working_storage_mb: 128 },
    verification: {
      automatic_checks: registry.organs.map((organ) => 'cartoon-3d:' + organ.id + ':local-contract-engine'),
      human_judgments: ['visual-quality', 'gameplay-readability', 'licensing-and-ownership', 'fun', 'release-approval'],
      assurance_ceiling: 'candidate game-evidence plan from locally tested deterministic contracts; no live visual or gameplay approval'
    },
    implementation: {
      kind: 'existing-runtime-reference',
      reference: 'shared/game-organism/source-evidence/cartoon-3d-run100/organ-registry.json',
      status: 'EXPERIMENTAL'
    }
  });
}

function createToonGameEvidenceExample(registry) {
  registry = registry || loadRegistry();
  const base = Examples.createStreetLifeExample();
  const evidence = createEvidenceOrgan(registry);
  const organs = base.organs.filter((organ) => organ.category !== 'evidence').concat(evidence);
  const blueprint = clone(base.blueprint);
  delete blueprint.digest;
  blueprint.id = 'axm.game-organism.toon-evidence-slice';
  blueprint.title = 'Toon Game Evidence Slice';
  const evidenceReference = blueprint.organs.find((reference) => reference.slot_category === 'evidence');
  evidenceReference.organ_id = evidence.id;
  evidenceReference.organ_version = evidence.version;
  evidenceReference.organ_digest = evidence.digest;
  const byCategory = {};
  blueprint.organs.forEach((reference) => { byCategory[reference.slot_category] = reference.instance_id; });
  blueprint.connections.push(
    { from: { instance_id: byCategory.asset, port: 'assets' }, to: { instance_id: byCategory.evidence, port: 'assets' } },
    { from: { instance_id: byCategory.animation, port: 'animation' }, to: { instance_id: byCategory.evidence, port: 'animation' } },
    { from: { instance_id: byCategory.physics, port: 'motion' }, to: { instance_id: byCategory.evidence, port: 'motion' } }
  );
  const sealed = GameOrganism.sealBlueprint(blueprint);
  const organRegistry = GameOrganism.createRegistry(organs);
  return { organs, registry: organRegistry, blueprint: sealed, receipt: GameOrganism.compile(sealed, organRegistry), evidenceOrgan: evidence };
}

function readiness(registry) {
  registry = registry || loadRegistry();
  const checked = validateRegistry(registry);
  return {
    schema: 'axm.cartoon-3d-game-evidence-readiness/v1',
    status: checked.pass ? 'CANDIDATE_READY' : 'HELD',
    organ_count: checked.organCount,
    family_count: checked.familyCount,
    local_tests_passed: checked.pass ? registry.local_rerun.tests_passed : 0,
    candidate_evidence_available: checked.pass,
    execution_started: false,
    live_visual_approved: false,
    gameplay_approved: false,
    licensing_approved: false,
    canonical_game_changed: false,
    automatic_promotion: false,
    errors: checked.errors
  };
}

module.exports = {
  REGISTRY_SCHEMA,
  DEFAULT_REGISTRY,
  validateRegistry,
  loadRegistry,
  createEvidenceOrgan,
  createToonGameEvidenceExample,
  readiness
};
