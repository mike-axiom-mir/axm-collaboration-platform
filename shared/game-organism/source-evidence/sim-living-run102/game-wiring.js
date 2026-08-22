'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const Atlas = require('../../../../shared/game-capability-atlas/atlas');
const ExperimentWorld = require('../../../../shared/experiment-world/experiment-world');
const MultiworldState = require('../../../../shared/operations/multiworld-state-service');
const VerificationSpine = require('../../../../shared/verification-spine/verification-spine');
const GameForge = require('../../../../tools/game-forge/game-forge-core');
const SimLiving = require('../../sim-living-evidence');

const ROOT = __dirname;
const EVIDENCE_DIR = path.join(ROOT, 'evidence');
const DEFAULT_CREATED_AT = '2026-07-27T22:50:28.3603483Z';
const OUTPUT_FILES = Object.freeze({
  mapping: 'game-system-wiring-map.json',
  atlas: 'game-capability-plan.json',
  forge: 'game-forge-project.json',
  experiment: 'experiment-world-checkpoint.json',
  world: 'world-state-patch-preview.json',
  verification: 'verification-spine-bundle.json',
  organism: 'game-organism-assembly-receipt.json',
  receipt: 'game-wiring-receipt.json'
});

const FAMILY_CATEGORY_ROUTES = Object.freeze({
  1: ['01', '02', '18', '20'],
  2: ['02', '07', '12', '18'],
  3: ['11', '12', '14', '20'],
  4: ['02', '11', '14', '18'],
  5: ['11', '12', '14', '19'],
  6: ['10', '11', '12', '17'],
  7: ['10', '11', '17', '20'],
  8: ['01', '02', '11', '20'],
  9: ['03', '17', '18', '20'],
  10: ['11', '18', '19', '20']
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      if (value[key] !== undefined) out[key] = stable(value[key]);
      return out;
    }, {});
  }
  return value;
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function fileDigest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function readinessStatus(module) {
  if (module.readiness_class === 'FOUNDATION_OWNER_INTEGRATION_HOLD') return 'HELD_OWNER';
  if (module.readiness_class === 'RESEARCH_OR_SEMANTIC_ADAPTER_HOLD') return 'HELD_RESEARCH';
  return 'PROPOSED_STATIC';
}

function buildAtlasRoute(registry, createdAt) {
  const catalog = require('../../../../shared/game-capability-atlas/catalog.json');
  const checked = Atlas.validate(catalog);
  if (!checked.pass) throw new Error('Game Capability Atlas is invalid: ' + checked.errors.join('; '));

  const categoryRows = Object.fromEntries(catalog.categories.map((row) => [row.id, row]));
  const firstByCategory = {};
  catalog.modules.forEach((row) => {
    if (!firstByCategory[row.category]) firstByCategory[row.category] = row;
  });

  const mappings = registry.modules.map((module) => {
    const targetCategories = FAMILY_CATEGORY_ROUTES[module.family];
    const atlasMatches = targetCategories.map((category) => {
      const result = Atlas.search(catalog, {
        category,
        query: module.name + ' ' + module.family_name,
        limit: 1
      })[0];
      const row = result ? result.module : firstByCategory[category];
      return {
        moduleId: row.id,
        title: row.title,
        category,
        categoryTitle: categoryRows[category].title,
        score: result ? result.score : 0,
        matchMode: result ? 'TERM_MATCH_WITHIN_FAMILY_CATEGORY' : 'FAMILY_CATEGORY_FALLBACK'
      };
    });
    atlasMatches.sort((left, right) => right.score - left.score || left.moduleId.localeCompare(right.moduleId));
    return {
      sourceModuleId: module.id,
      sourceName: module.name,
      sourceSeed: module.seed,
      family: module.family,
      readinessClass: module.readiness_class,
      wiringStatus: readinessStatus(module),
      executionWave: module.execution_wave,
      firstPilotOperation: module.first_pilot_operation,
      targetSeams: clone(module.adapter.seams),
      targetCategories: targetCategories.slice(),
      atlasMatches,
      truth: {
        semanticEquivalenceProven: false,
        sourceRuntimeAvailable: false,
        automaticInstall: false
      }
    };
  });

  const selectedIds = [];
  function select(id) {
    if (selectedIds.length < 100 && selectedIds.indexOf(id) < 0) selectedIds.push(id);
  }
  mappings.forEach((row) => select(row.atlasMatches[0].moduleId));
  mappings.forEach((row) => row.atlasMatches.forEach((match) => select(match.moduleId)));

  const plan = Atlas.buildPlan(catalog, {
    moduleIds: selectedIds,
    projectId: 'sim-living-run102-game-candidate',
    projectName: 'Simulation Living Systems Run 102 game candidate',
    goal: 'Turn the validated static living-systems corpus into bounded game implementation and evidence work without treating its blueprints as executable modules.',
    createdAt
  });
  plan.wiring = {
    schema: 'axm.sim-living-atlas-wiring-summary/v1',
    sourceModulesMapped: mappings.length,
    selectedAtlasModules: selectedIds.length,
    mappingArtifact: OUTPUT_FILES.mapping,
    mappingRule: 'term match inside explicit family-to-category routes; fallback is category relevance only',
    semanticEquivalenceProven: false,
    sourceRuntimeAvailable: false
  };

  return {
    mapping: {
      schema: 'axm.sim-living-game-system-wiring-map/v1',
      state: 'STATIC_HANDOFF_READY_RUNTIME_HELD',
      createdAt,
      sourceRegistry: 'module-registry.json',
      sourceModules: mappings.length,
      mappings,
      truth: {
        atlasIsPlanningKnowledge: true,
        mappingsAreImplementationLeads: true,
        mappingsAreRuntimeAdapters: false,
        semanticEquivalenceProven: false,
        automaticInstall: false,
        canon: false
      }
    },
    plan
  };
}

function buildForgeProject(registry, capabilityPlan, createdAt) {
  const project = GameForge.blankProject(
    'sim-living-run102-wiring-candidate',
    'Simulation Living Systems Run 102 wiring candidate',
    '2D'
  );
  project.createdAt = createdAt;
  project.updatedAt = createdAt;
  project.capabilityPlan = clone(capabilityPlan);
  project.systems = registry.modules.map((module) => ({
    id: 'sim-living-' + String(module.seed).padStart(3, '0'),
    type: 'Simulation Living Static Blueprint',
    name: module.name,
    createdAt,
    data: {
      sourceModuleId: module.id,
      status: readinessStatus(module),
      implementation: 'ABSENT',
      runtimeEnabled: false,
      family: module.family,
      executionRole: module.execution_role,
      executionWave: module.execution_wave,
      firstPilotOperation: module.first_pilot_operation,
      plannedOperations: clone(module.operation_ids),
      requiredProviderIds: clone(module.required_provider_ids),
      optionalProviderIds: clone(module.optional_provider_ids),
      targetSeams: clone(module.adapter.seams),
      mandatoryHolds: clone(module.mandatory_holds)
    }
  }));
  project.tests = [
    { id: 'source-integrity', name: 'Source integrity', result: 'PASS', runtime: 'static intake validator', evidence: '30625 manifest digests and ZIP CRCs validated', createdAt },
    { id: 'static-blueprint-graph', name: 'Static blueprint graph', result: 'PASS', runtime: 'static graph validator', evidence: '100 modules, 400 operations, 366 required edges, no cycle', createdAt },
    { id: 'module-runtime', name: 'Source module runtime', result: 'MISSING_VALIDATOR', runtime: 'not implemented', evidence: 'source implementation is absent', createdAt },
    { id: 'authoritative-world-application', name: 'Authoritative world application', result: 'HELD', runtime: 'not applied', evidence: 'owner, world ID, revision, migration and approval intentionally absent', createdAt },
    { id: 'human-game-and-release-review', name: 'Human game and release review', result: 'HUMAN_REVIEW', runtime: 'not performed', evidence: 'gameplay, fairness, accessibility, safety, publication, CANON and release remain human-gated', createdAt }
  ];
  project.truth = {
    candidateOnly: true,
    sourceModulesRepresented: 100,
    sourceModulesExecuted: 0,
    runtimePackageChanged: false,
    authoritativeWorldChanged: false,
    canonicalGameChanged: false,
    automaticPromotion: false,
    humanReleaseRequired: true
  };
  project.documentDigestAlgorithm = 'sha256-stable-json';
  project.documentDigest = digest(project);
  return project;
}

function applyExperimentIntent(state, intent) {
  const result = ExperimentWorld.applyIntent(state, intent);
  if (!result.ok) throw new Error('Experiment World refused ' + intent.id + ': ' + result.refusal.code + ' ' + result.refusal.message);
  return result;
}

function buildExperimentCheckpoint(registry, createdAt) {
  let world = ExperimentWorld.create({
    id: 'sim-living-run102-wiring',
    title: 'Sim Living Run 102 candidate shoebox',
    goal: 'Preserve and inspect all 100 static living-system blueprints as candidate artifacts without executing code, using the network, or changing canonical Workshop state.',
    mode: 'directed',
    createdAt,
    budgets: { timeMinutes: 20, storageMb: 50, computePercent: 20, maxArtifacts: 150, maxForks: 1 }
  });

  registry.modules.forEach((module) => {
    const createResult = applyExperimentIntent(world, {
      schema: ExperimentWorld.INTENT_SCHEMA,
      id: 'sim-living-artifact-' + String(module.seed).padStart(3, '0'),
      type: 'artifact.create',
      actor: { id: 'sim-living-static-bridge', kind: 'machine' },
      effects: ['candidate-memory'],
      resource: { timeMinutes: 0.05, storageMb: 0.02, computePercent: 1 },
      artifact: {
        kind: 'sim-living-blueprint',
        title: module.name,
        summary: 'Static source blueprint ' + module.id + '; implementation and behavioral runtime proof are absent.',
        facets: {
          sourceModuleId: module.id,
          sourceSeed: module.seed,
          family: module.family,
          readinessClass: module.readiness_class,
          wiringStatus: readinessStatus(module),
          executionWave: module.execution_wave,
          plannedOperations: clone(module.operation_ids),
          executable: false,
          authoritative: false
        }
      }
    });
    world = createResult.state;
    const evidenceResult = applyExperimentIntent(world, {
      schema: ExperimentWorld.INTENT_SCHEMA,
      id: 'sim-living-evidence-' + String(module.seed).padStart(3, '0'),
      type: 'evidence.record',
      actor: { id: 'sim-living-static-bridge', kind: 'machine' },
      sourceIds: [createResult.artifact.id],
      effects: ['candidate-memory'],
      resource: { timeMinutes: 0.02, storageMb: 0.01, computePercent: 1 },
      evidence: {
        claim: 'Static blueprint and mandatory holds are present in the validated Run 102 registry.',
        verdict: 'STATIC_PASS',
        surface: 'module-registry.json'
      }
    });
    world = evidenceResult.state;
  });

  const frozen = applyExperimentIntent(world, {
    schema: ExperimentWorld.INTENT_SCHEMA,
    id: 'freeze-sim-living-wiring-candidate',
    type: 'experiment.freeze',
    actor: { id: 'sim-living-static-bridge', kind: 'machine' },
    effects: ['candidate-memory'],
    resource: { timeMinutes: 0, storageMb: 0, computePercent: 0 }
  });
  const checkpoint = ExperimentWorld.checkpoint(frozen.state);
  ExperimentWorld.restore(checkpoint);
  return checkpoint;
}

function buildWorldStatePreview(registry, createdAt) {
  // Creating this service object resolves the receiver's pure operation normalizer.
  // No read, createWorld, apply, snapshot, previewRestore, restore, or write method is called.
  const receiver = MultiworldState.create({ stateRoot: path.join(ROOT, '.non-writing-world-preview') });
  const operations = registry.modules.map((module) => ({
    type: 'upsert-entity',
    entity: {
      id: 'sim-living-' + String(module.seed).padStart(3, '0'),
      kind: 'simulation-blueprint',
      data: {
        sourceModuleId: module.id,
        name: module.name,
        family: module.family,
        readinessClass: module.readiness_class,
        wiringStatus: readinessStatus(module),
        executionWave: module.execution_wave,
        firstPilotOperation: module.first_pilot_operation,
        plannedOperations: clone(module.operation_ids),
        runtimeEnabled: false,
        authoritative: false,
        canon: false
      }
    }
  }));
  const batches = [operations.slice(0, 50), operations.slice(50)].map((batch, index) => ({
    sequence: index + 1,
    moduleCount: batch.length,
    schemaValidation: 'PASS',
    operations: receiver.normalizeOps(batch)
  }));
  return {
    schema: 'axm.sim-living-world-patch-preview/v1',
    state: 'RECEIVER_VALIDATED_NOT_APPLIED',
    createdAt,
    receiver: 'shared/operations/multiworld-state-service.js#normalizeOps',
    receiverSchema: MultiworldState.WORLD_SCHEMA,
    worldId: null,
    expectedRevision: null,
    owner: null,
    lineageId: null,
    source: 'sim-living-run102-static-bridge',
    moduleCount: registry.modules.length,
    batchCount: batches.length,
    maximumReceiverBatchSize: 50,
    batches,
    receiverValidation: 'PASS',
    applyCalled: false,
    stateReadCalled: false,
    worldCreated: false,
    snapshotCreated: false,
    rollbackPreviewCreated: false,
    truth: {
      operationShapeAccepted: true,
      semanticAndUnitCompatibilityProven: false,
      authoritativeStateOwnerKnown: false,
      migrationApproved: false,
      worldMutated: false,
      canon: false
    }
  };
}

function buildVerificationBundle(registry, createdAt, sourceRegistryDigest) {
  const transport = VerificationSpine.createReceipt({
    id: 'sim-living-run102-static-handoffs',
    verifier: { id: 'sim-living-static-game-bridge', version: '1.0.0', category: 'game' },
    subject: { id: 'sim-living-run102', kind: 'static-blueprint-corpus', version: '0.2.0-candidate', digest: sourceRegistryDigest },
    target_profile: 'living-world-experimental',
    claims: registry.modules.map((module) => ({
      id: 'transport.module-' + String(module.seed).padStart(3, '0'),
      status: 'PASS',
      required: true,
      risk: 'low',
      summary: module.id + ' is represented in each bounded static handoff.',
      evidence: [
        { kind: 'atlas-mapping', detail: OUTPUT_FILES.mapping },
        { kind: 'game-forge-document', detail: OUTPUT_FILES.forge },
        { kind: 'experiment-checkpoint', detail: OUTPUT_FILES.experiment },
        { kind: 'world-operation-shape', detail: OUTPUT_FILES.world }
      ],
      limitations: ['transport and contract shape only; no source runtime execution or authoritative application']
    })),
    limitations: ['Static sender/receiver evidence cannot prove behavioral or semantic correctness.'],
    created_at: createdAt
  });
  const runtime = VerificationSpine.createReceipt({
    id: 'sim-living-run102-runtime-proof-debt',
    verifier: { id: 'sim-living-runtime-proof-gate', version: '1.0.0', category: 'game' },
    subject: { id: 'sim-living-run102', kind: 'static-blueprint-corpus', version: '0.2.0-candidate', digest: sourceRegistryDigest },
    target_profile: 'living-world-experimental',
    claims: registry.modules.map((module) => ({
      id: 'runtime.module-' + String(module.seed).padStart(3, '0'),
      status: 'MISSING_VALIDATOR',
      required: true,
      risk: module.readiness_class.includes('HOLD') ? 'high' : 'medium',
      summary: module.id + ' has no source implementation or behavioral validator.',
      evidence: [{ kind: 'source-truth-status', detail: 'implemented=0; runtime_tested=0; implementation absent' }],
      limitations: clone(module.proof_debt)
    })),
    limitations: ['Implementation, representative workloads, domain validation and human game review are absent.'],
    created_at: createdAt
  });
  [transport, runtime].forEach((receipt) => {
    const check = VerificationSpine.validateReceipt(receipt);
    if (!check.pass) throw new Error('Verification receipt invalid: ' + check.errors.join('; '));
  });
  const report = VerificationSpine.resolveReceipts([transport, runtime], {
    id: 'living-world-experimental',
    name: 'Living World Experimental',
    required_categories: ['game'],
    conflict_rules: []
  });
  if (report.verdict !== 'HELD') throw new Error('Runtime proof debt must hold the verification report');
  return {
    schema: 'axm.sim-living-verification-bundle/v1',
    state: 'STATIC_TRANSPORT_PASS_RUNTIME_HELD',
    createdAt,
    receipts: [transport, runtime],
    report,
    truth: {
      staticTransportClaimsPassed: 100,
      runtimeValidatorsMissing: 100,
      behavioralRuntimeProven: false,
      authoritativeApplicationProven: false,
      humanReleaseRequired: true
    }
  };
}

function buildArtifacts(options) {
  options = options || {};
  const createdAt = options.createdAt || DEFAULT_CREATED_AT;
  const registryFile = options.registryFile || SimLiving.DEFAULT_REGISTRY;
  const registry = SimLiving.loadRegistry(registryFile);
  const sourceRegistryDigest = fileDigest(registryFile);
  const atlasRoute = buildAtlasRoute(registry, createdAt);
  const forge = buildForgeProject(registry, atlasRoute.plan, createdAt);
  const experiment = buildExperimentCheckpoint(registry, createdAt);
  const world = buildWorldStatePreview(registry, createdAt);
  const verification = buildVerificationBundle(registry, createdAt, sourceRegistryDigest);
  const organism = SimLiving.createSimLivingGameEvidenceExample(registry).receipt;

  const outputs = {
    mapping: atlasRoute.mapping,
    atlas: atlasRoute.plan,
    forge,
    experiment,
    world,
    verification,
    organism
  };
  const outputDigests = Object.fromEntries(Object.entries(outputs).map(([key, value]) => [key, {
    file: OUTPUT_FILES[key],
    sha256StableJson: digest(value)
  }]));
  const receipt = {
    schema: 'axm.sim-living-run102-game-wiring-receipt/v1',
    state: 'STATIC_GAME_HANDOFFS_READY_RUNTIME_AND_AUTHORITY_HELD',
    createdAt,
    source: {
      registry: 'module-registry.json',
      registryFileSha256: sourceRegistryDigest,
      archiveSha256: registry.archive_sha256,
      modules: registry.module_count,
      families: registry.family_count,
      plannedOperations: registry.operation_count
    },
    routes: {
      gameCapabilityAtlas: { sourceModulesMapped: atlasRoute.mapping.mappings.length, selectedPlanItems: atlasRoute.plan.items.length, status: 'READY_STATIC_PLAN' },
      gameForge: { proposedSystems: forge.systems.length, status: 'READY_DRAFT_PROJECT' },
      experimentWorld: { candidateBlueprintArtifacts: experiment.world.artifacts.filter((item) => item.kind === 'sim-living-blueprint').length, status: experiment.world.status },
      livingWorldState: { receiverValidatedOperations: world.batches.reduce((sum, batch) => sum + batch.operations.length, 0), batches: world.batchCount, applyCalled: world.applyCalled, status: world.state },
      verificationSpine: { atomicClaims: verification.report.claim_count, verdict: verification.report.verdict, missingRuntimeValidators: verification.truth.runtimeValidatorsMissing },
      gameOrganism: { verdict: organism.verdict, executionStarted: organism.truth.executionStarted, canonicalGameChanged: organism.truth.canonicalGameChanged }
    },
    outputDigests,
    capabilityStatus: {
      staticGameSystemWiring: 'READY',
      sourceModuleRuntime: 'OPTIONAL_GAP',
      authoritativeWorldIntegration: 'OPTIONAL_GAP',
      humanGameAndReleaseAcceptance: 'OPTIONAL_GAP'
    },
    authority: {
      automaticInstallation: false,
      automaticMerge: false,
      automaticWorldMutation: false,
      automaticPromotion: false,
      automaticPublication: false,
      canon: false,
      authoritativeWorldState: false,
      scientificOrSafetyAuthority: false,
      humanReleaseApproval: false
    },
    holds: [
      'All source module implementations and behavioral validators remain absent.',
      'Atlas matches are planning leads inside explicit family categories, not proof of semantic equivalence.',
      'World operation shapes pass the receiver normalizer, but world ID, revision, owner, lineage, semantic/unit mapping, migration, rollback and approval are intentionally absent.',
      'Scientific validity, safety, representative performance, fairness, accessibility, gameplay quality, publication, CANON and release remain unproven and human-gated.'
    ]
  };
  outputs.receipt = receipt;
  return outputs;
}

function writeArtifacts(outputDir, options) {
  const target = outputDir || EVIDENCE_DIR;
  const artifacts = buildArtifacts(options);
  fs.mkdirSync(target, { recursive: true });
  Object.entries(OUTPUT_FILES).forEach(([key, name]) => {
    fs.writeFileSync(path.join(target, name), JSON.stringify(artifacts[key], null, 2) + '\n', 'utf8');
  });
  return artifacts;
}

module.exports = {
  DEFAULT_CREATED_AT,
  EVIDENCE_DIR,
  FAMILY_CATEGORY_ROUTES,
  OUTPUT_FILES,
  buildArtifacts,
  buildAtlasRoute,
  buildExperimentCheckpoint,
  buildForgeProject,
  buildVerificationBundle,
  buildWorldStatePreview,
  digest,
  writeArtifacts
};

if (require.main === module) {
  const artifacts = writeArtifacts();
  const receipt = artifacts.receipt;
  console.log(
    'Sim Living game wiring: PASS - ' +
    receipt.routes.gameCapabilityAtlas.sourceModulesMapped + ' modules mapped, ' +
    receipt.routes.gameForge.proposedSystems + ' Game Forge systems, ' +
    receipt.routes.experimentWorld.candidateBlueprintArtifacts + ' frozen experiment artifacts, ' +
    receipt.routes.livingWorldState.receiverValidatedOperations + ' world operations receiver-validated without apply, verification ' +
    receipt.routes.verificationSpine.verdict
  );
}
