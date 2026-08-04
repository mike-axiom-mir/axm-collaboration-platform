'use strict';

const fs = require('fs');
const path = require('path');
const GameOrganism = require('./game-organism');
const Examples = require('./examples');

const REGISTRY_SCHEMA = 'axm.audio-music-run106-game-evidence-registry/v1';
const DEFAULT_REGISTRY = path.resolve(__dirname, '..', '..', 'intakes', 'audio-music-live-run106', 'evidence', 'module-registry.json');
const EXPECTED_STATUS = 'WORKING_CANDIDATE_NOT_CANON_NOT_INTEGRATED';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unique(values) {
  return [...new Set(values)].sort();
}

function validateRegistry(registry) {
  const errors = [];
  if (!registry || registry.schema !== REGISTRY_SCHEMA) errors.push('registry schema mismatch');
  if (!registry || registry.state !== EXPECTED_STATUS) errors.push('registry must remain a non-integrated working candidate');
  if (!registry || registry.run_count !== 106 || !Array.isArray(registry.run_range) || registry.run_range[0] !== 1 || registry.run_range[1] !== 106) errors.push('exact run coverage 01-106 required');
  if (!registry || registry.module_count !== 100 || !Array.isArray(registry.modules) || registry.modules.length !== 100) errors.push('exactly 100 audio modules required');
  if (!registry || registry.family_count !== 10 || !registry.family_routes || Object.keys(registry.family_routes).length !== 10) errors.push('exactly ten family routes required');
  if (!registry || registry.bounded_capability_count !== 400) errors.push('exactly 400 bounded source capabilities required');
  if (!registry || !registry.local_stewardship_regression || registry.local_stewardship_regression.status !== 'PASS' || registry.local_stewardship_regression.checks !== 3373 || registry.local_stewardship_regression.failures.length) errors.push('complete 3373-check local stewardship rerun required');
  const parsed = registry && registry.parsed_artifacts;
  if (!parsed || parsed.wav !== 351 || parsed.midi !== 6 || parsed.musicXml !== 6 || parsed.sqlite !== 8 || parsed.innerZip !== 9) errors.push('offline artifact inventory mismatch');
  if (!parsed || parsed.midiStrictHold !== 1 || parsed.musicXmlStrictHold !== 3) errors.push('strict notation adapter holds must remain visible');
  if (!registry || !registry.later_python_audio_regressions || registry.later_python_audio_regressions.result !== 'BLOCKED_MISSING_DEPENDENCIES') errors.push('later Python audio dependency gap must remain explicit');

  const ids = new Set(), seeds = new Set(), families = new Set(), capabilities = new Set();
  for (const module of (registry && registry.modules) || []) {
    if (!module || !module.id || ids.has(module.id)) errors.push('duplicate or missing module id');
    else ids.add(module.id);
    if (!module || !Number.isInteger(module.seed) || seeds.has(module.seed)) errors.push('duplicate or invalid seed');
    else seeds.add(module.seed);
    if (module) families.add(module.family);
    if (!module || module.status !== EXPECTED_STATUS || module.local_stewardship !== 'PASS') errors.push((module && module.id || 'module') + ' is not a locally passing working candidate');
    if (!module || module.automatic_integration !== false || module.automatic_publication !== false || module.canon !== false) errors.push((module && module.id || 'module') + ' widens authority');
    if (!module || !module.adapter || !Array.isArray(module.adapter.seams) || !module.adapter.proof_ceiling) errors.push((module && module.id || 'module') + ' lacks an explicit adapter route');
    for (const capability of (module && module.capability_ids) || []) capabilities.add(capability);
  }
  if (families.size !== 10) errors.push('family coverage mismatch');
  if (capabilities.size !== 400) errors.push('capability identity coverage mismatch');
  return { pass: errors.length === 0, errors: unique(errors), moduleCount: ids.size, familyCount: families.size, capabilityCount: capabilities.size };
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
  const sourceChecks = registry.modules.map((module) => 'audio-module:' + module.id + ':local-stewardship-pass');
  return GameOrganism.sealOrgan({
    id: 'axm.game.evidence.audio-music-106',
    version: '0.1.0',
    category: 'evidence',
    title: 'Audio, music, and live-performance Run 106 game evidence',
    description: 'Routes 100 locally verified audio contracts and their offline artifacts into a candidate game evidence plan without claiming audible quality, device operation, rights clearance, publication, or release.',
    ports: {
      inputs: [
        { id: 'observations', type: 'game.playtest-observations/v1', required: true, multiple: false },
        { id: 'build', type: 'game.candidate-build/v1', required: true, multiple: false },
        { id: 'timing', type: 'game.animation-state/v1', required: true, multiple: false }
      ],
      outputs: [
        { id: 'receipt', type: 'axm.verification-receipt/v2', required: true, multiple: false }
      ]
    },
    capabilities: {
      provides: ['game.evidence', 'game.audio.evidence', 'game.adaptive-score.evidence', 'game.accessible-audio.evidence'],
      requires: ['game.playtest-observations', 'game.candidate-build', 'game.animation']
    },
    resource_budget: { cpu_weight: 2, gpu_weight: 0, peak_memory_mb: 64, working_storage_mb: 32 },
    verification: {
      automatic_checks: sourceChecks.concat([
        'audio-runs-01-106-source-integrity',
        'audio-1369-retained-digests',
        'audio-3373-stewardship-checks',
        'audio-351-wav-structural-checks',
        'audio-midi-musicxml-sqlite-and-zip-structure',
        'notation-strict-profile-holds-remain-visible',
        'python-audio-dependency-gap-remains-visible',
        'no-install-integration-publication-or-canon-authority'
      ]),
      human_judgments: [
        'audible-quality-and-musical-fit',
        'gameplay-cue-readability-and-mix-balance',
        'performer-and-controller-workflow',
        'hearing-and-multimodal-accessibility',
        'real-device-latency-and-recovery',
        'speaker-room-and-spatial-quality',
        'rights-consent-and-licensing-clearance',
        'publication-and-release-approval'
      ],
      assurance_ceiling: 'offline-source-container-and-stewardship-evidence; no listening, live-runtime, hardware, venue, standards, legal, publication, or release proof'
    },
    implementation: {
      kind: 'existing-runtime-reference',
      reference: 'intakes/audio-music-live-run106/evidence/module-registry.json',
      status: 'AVAILABLE'
    }
  });
}

function createAudioGameEvidenceExample(registry) {
  registry = registry || loadRegistry();
  const base = Examples.createStreetLifeExample();
  const evidence = createEvidenceOrgan(registry);
  const evidenceReference = base.blueprint.organs.find((item) => item.slot_category === 'evidence');
  const assemblyReference = base.blueprint.organs.find((item) => item.slot_category === 'assembly');
  const animationReference = base.blueprint.organs.find((item) => item.slot_category === 'animation');
  if (!evidenceReference || !assemblyReference || !animationReference) throw new Error('base game organism evidence seams are missing');

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
      from: { instance_id: animationReference.instance_id, port: 'animation' },
      to: { instance_id: evidenceReference.instance_id, port: 'timing' }
    }
  ]);
  const blueprint = GameOrganism.sealBlueprint({
    ...clone(base.blueprint),
    id: 'axm.game-organism.street-life-audio-evidence-slice',
    title: 'Street Life Slice with Audio Run 106 Evidence',
    organs: references,
    connections
  });
  const gameRegistry = GameOrganism.createRegistry(organs);
  const receipt = GameOrganism.compile(blueprint, gameRegistry);
  return { organs, registry: gameRegistry, blueprint, receipt, sourceRegistry: clone(registry) };
}

function readiness(registry) {
  registry = registry || loadRegistry();
  const checked = validateRegistry(registry);
  return {
    schema: 'axm.audio-music-run106-readiness/v1',
    candidate_ready: checked.pass,
    module_count: checked.moduleCount,
    family_count: checked.familyCount,
    capability_count: checked.capabilityCount,
    local_stewardship: checked.pass ? 'PASS' : 'FAIL',
    static_offline_artifacts: checked.pass ? 'PASS' : 'FAIL',
    later_python_audio_regressions: registry.later_python_audio_regressions.result,
    strict_notation_adapter_holds: registry.parsed_artifacts.midiStrictHold + registry.parsed_artifacts.musicXmlStrictHold,
    live_audio_runtime_proven: false,
    human_listening_approved: false,
    real_devices_proven: false,
    rights_cleared: false,
    published: false,
    canon: false,
    release_approved: false
  };
}

module.exports = {
  REGISTRY_SCHEMA,
  DEFAULT_REGISTRY,
  validateRegistry,
  loadRegistry,
  createEvidenceOrgan,
  createAudioGameEvidenceExample,
  readiness
};
