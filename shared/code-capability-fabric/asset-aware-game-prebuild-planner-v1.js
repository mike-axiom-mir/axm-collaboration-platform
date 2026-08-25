'use strict';

const crypto = require('crypto');
const Core = require('./semantic-candidate-generator-v1');
const AssetHandsContract = require('../asset-hands/service.contract.json');
const AssetFabricContract = require('../../tools/asset-fabric/module.contract.json');
const VisualCatalog = require('../asset-hands/visual-capability-catalog.generated.json');

const VERSION = '0.1.0';
const SNAPSHOT_SCHEMA = 'axm.asset-factory-capability-snapshot/v1';
const PLAN_SCHEMA = 'axm.game-prebuild-plan/v1';
const RECIPE_ID = 'twin-reactor-action-coop';
const STYLE_ID = 'arcade-neon-circuit';
const TREATMENT_ID = 'aetherglass-cinematic';
const EFFECT_IDS = ['glow', 'gradientBorder', 'scanlines', 'spotlight', 'vignette'];
const RELEVANT_HANDS = Object.freeze([
  { id: 'deterministic-animation-fabric', operations: ['create', 'edit', 'workflow'], outputs: ['axm.deterministic-animation-recipe/v1', 'axm.deterministic-animation-composition/v1'] },
  { id: 'deterministic-audio-fabric', operations: ['create', 'edit'], outputs: ['axm.deterministic-audio-recipe/v1', 'audio/wav'] },
  { id: 'pixel-sprite', operations: ['create'], outputs: ['image/svg+xml', 'application/json'] },
  { id: 'portable-visual-fx', operations: ['create', 'edit'], outputs: ['text/css', 'image/svg+xml', 'axm.visual-fx-recipe/v1'] },
  { id: 'raster-texture', operations: ['create'], outputs: ['image/png', 'application/json'] },
  { id: 'ui-component', operations: ['create', 'edit'], outputs: ['image/svg+xml', 'axm.ui-component-spec/v1', 'axm.ui-component-recipe/v1'] },
  { id: 'visual-treatment-composer', operations: ['create', 'inspect', 'workflow'], outputs: ['text/css', 'image/svg+xml', 'axm.visual-treatment-recipe/v1'] }
]);
const PRIOR_EVIDENCE = Object.freeze({
  path: 'docs/steward-runs/2026-08-25-code-capability-fabric-local-coop-action-game-v2.21/BROWSER_JOURNEY_RECEIPT.md',
  sha256: 'sha256:ffc9c9e92b35b99bcb7081496f8477c0cf4be5d12ed040c22c1f2888ac3b7e47'
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonical(value) { return Core.canonicalJson(value); }
function hashValue(value) { return 'sha256:' + crypto.createHash('sha256').update(Buffer.from(canonical(value), 'utf8')).digest('hex'); }
function same(a, b) { return canonical(a) === canonical(b); }
function compareText(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function requireEntry(rows, id, label) {
  const found = Array.isArray(rows) ? rows.find((item) => item && item.id === id) : null;
  if (!found) throw new Error(label + ' is absent from the bound Asset Factory catalog: ' + id);
  return clone(found);
}

function sourceRef(id, schema, value, declaredDigest) {
  return { id, schema, sha256: hashValue(value), declaredDigest: declaredDigest || null };
}

function buildCapabilitySnapshot() {
  if (AssetHandsContract.schema !== 'axm.shared-service-contract/v1' || AssetHandsContract.id !== 'asset-hands' || AssetHandsContract.status !== 'TEST') throw new Error('Asset Hands service contract identity drifted');
  if (AssetFabricContract.schema !== 'axm.module-contract/v1' || AssetFabricContract.id !== 'asset-fabric') throw new Error('Asset Fabric module contract identity drifted');
  if (VisualCatalog.schema !== 'axm.visual-capability-catalog/v1' || VisualCatalog.status !== 'EXPERIMENTAL') throw new Error('visual capability catalog identity drifted');
  if (!VisualCatalog.authority || VisualCatalog.authority.candidate_only !== true || VisualCatalog.authority.installed !== false || VisualCatalog.authority.promoted !== false || VisualCatalog.authority.canonical !== false) throw new Error('visual capability catalog authority drifted');
  const builtIn = new Set(AssetHandsContract.builtInHands || []);
  const declaredHands = RELEVANT_HANDS.map((hand) => {
    if (!builtIn.has(hand.id)) throw new Error('required Asset Factory hand is not declared built-in: ' + hand.id);
    return { ...clone(hand), availability: 'DECLARED_BUILT_IN', artifactProduced: false };
  }).sort((a, b) => compareText(a.id, b.id));
  const style = requireEntry(VisualCatalog.style_presets, STYLE_ID, 'style preset');
  const treatment = requireEntry(VisualCatalog.treatment_molds, TREATMENT_ID, 'visual treatment');
  const effects = EFFECT_IDS.map((id) => requireEntry(VisualCatalog.portable_fx_blocks, id, 'portable effect')).sort((a, b) => compareText(a.id, b.id));
  const core = {
    schema: SNAPSHOT_SCHEMA,
    version: VERSION,
    status: 'TEST',
    observed: {
      assetHands: sourceRef('asset-hands', AssetHandsContract.schema, AssetHandsContract),
      assetFabric: sourceRef('asset-fabric', AssetFabricContract.schema, AssetFabricContract),
      visualCatalog: sourceRef('visual-capability-catalog', VisualCatalog.schema, VisualCatalog, 'sha256:' + VisualCatalog.digest)
    },
    catalogInventory: {
      builtInHandsDeclared: AssetHandsContract.builtInHands.length,
      serviceCapabilitiesDeclared: AssetHandsContract.provides.length,
      assetFabricCapabilitiesDeclared: AssetFabricContract.provides.length,
      visualAdaptersDeclared: VisualCatalog.adapters.length,
      aetherFxModulesDeclared: VisualCatalog.aetherfx_modules.length,
      pbrMaterialFamiliesDeclared: VisualCatalog.pbr_material_families.length,
      portableEffectsDeclared: VisualCatalog.portable_fx_blocks.length,
      stylePresetsDeclared: VisualCatalog.style_presets.length,
      treatmentMoldsDeclared: VisualCatalog.treatment_molds.length
    },
    declaredHands,
    selections: {
      style: { id: style.id, name: style.name, source: style.source, intent: clone(style.intent), sha256: hashValue(style) },
      treatment: { id: treatment.id, name: treatment.name, source: treatment.source, constraints: clone(treatment.constraints), palette: clone(treatment.palette), sha256: hashValue(treatment) },
      effects: effects.map((item) => ({ id: item.id, kind: item.kind, source: item.source, css: item.css === true, svg: item.svg === true, tokens: item.tokens === true, sha256: hashValue(item) }))
    },
    truth: {
      declarationsAreAvailabilityProofOnly: true,
      artifactBytesProduced: false,
      visualQualityProven: false,
      providerCodeLoaded: false,
      networkUsed: false,
      workspaceScanned: false
    },
    limitations: [
      'DECLARED_HAND_IS_NOT_PRODUCED_ASSET',
      'CATALOG_SELECTION_IS_NOT_VISUAL_QUALITY_PROOF',
      'AUDIO_ROUTE_DECLARED_BUT_NO_AUDIO_ARTIFACT_PRODUCED',
      'PLAYER_CHOICE_AND_INSTALLATION_REMAIN_SEPARATE'
    ],
    authority: 'NONE'
  };
  return { ...core, snapshotDigest: hashValue(core) };
}

function normalizeSnapshot(snapshot) {
  if (!snapshot || snapshot.schema !== SNAPSHOT_SCHEMA || snapshot.authority !== 'NONE') throw new Error('asset capability snapshot identity mismatch');
  const { snapshotDigest, ...core } = clone(snapshot);
  if (snapshotDigest !== hashValue(core)) throw new Error('asset capability snapshot digest mismatch');
  const expected = buildCapabilitySnapshot();
  if (!same(snapshot, expected)) throw new Error('asset capability snapshot differs from the approved Workshop declarations');
  return clone(snapshot);
}

function buildPrebuildPlan(brief, suppliedSnapshot) {
  if (!brief || brief.recipeId !== RECIPE_ID) throw new Error('asset-aware prebuild planner supports only the exact Twin Reactor co-op recipe');
  const snapshot = normalizeSnapshot(suppliedSnapshot || buildCapabilitySnapshot());
  const available = new Set(snapshot.declaredHands.map((item) => item.id));
  const routes = [
    ['arena-background', 'raster-texture', ['image/png'], 'catalog-informed procedural circuit field'],
    ['player-and-enemy-silhouettes', 'pixel-sprite', ['image/svg+xml'], 'distinct readable combat silhouettes'],
    ['hud-and-controls', 'ui-component', ['axm.ui-component-spec/v1'], 'high-contrast responsive mission HUD'],
    ['arena-effects', 'portable-visual-fx', ['text/css', 'image/svg+xml'], 'glow, vignette, scanlines, spotlight, gradient border'],
    ['cross-surface-treatment', 'visual-treatment-composer', ['axm.visual-treatment-recipe/v1'], 'aetherglass-cinematic treatment constraints'],
    ['combat-motion', 'deterministic-animation-fabric', ['axm.deterministic-animation-recipe/v1'], 'bounded fixed-tick motion cues'],
    ['combat-audio-future-route', 'deterministic-audio-fabric', ['audio/wav'], 'declared route only; no audio artifact in this candidate']
  ].map(([id, handId, outputs, purpose]) => {
    if (!available.has(handId)) throw new Error('prebuild route lacks declared hand: ' + handId);
    return { id, handId, outputs, purpose, state: 'PLANNED_FROM_DECLARATION', artifactProduced: false };
  });
  const repairs = [
    {
      id: 'projectile-spawn-and-swept-collision-v1',
      triggerFacts: ['fixed-tick-projectiles', 'projectile-speed-can-cross-target-width'],
      action: 'CHECK_COLLISION_AT_SPAWN_AND_ALONG_BOUNDED_MOVEMENT_SUBSTEPS',
      state: 'APPLIED_BEFORE_BUILD', evidence: clone(PRIOR_EVIDENCE)
    },
    {
      id: 'combat-silhouette-separation-v1',
      triggerFacts: ['two-player-seats', 'four-enemy-classes', 'shared-arena'],
      action: 'REQUIRE_DISTINCT_SHAPE_COLOR_LABEL_AND_DIRECTION_CUES',
      state: 'APPLIED_BEFORE_BUILD', evidence: { path: 'shared/asset-hands/service.contract.json', sha256: snapshot.observed.assetHands.sha256 }
    },
    {
      id: 'asset-declaration-truth-ceiling-v1',
      triggerFacts: ['asset-catalog-consumed-as-data', 'no-asset-provider-execution'],
      action: 'MARK_ROUTES_PLANNED_AND_ARTIFACTS_UNPRODUCED',
      state: 'APPLIED_BEFORE_BUILD', evidence: { path: 'shared/asset-hands/visual-capability-catalog.generated.json', sha256: snapshot.observed.visualCatalog.sha256 }
    },
    {
      id: 'reduced-motion-gameplay-cue-v1',
      triggerFacts: ['ambient-motion', 'accessibility-required'],
      action: 'FREEZE_DECORATIVE_MOTION_WHILE_PRESERVING_GAMEPLAY_STATE_CUES',
      state: 'APPLIED_BEFORE_BUILD', evidence: { path: 'shared/asset-hands/visual-capability-catalog.generated.json', sha256: snapshot.selections.treatment.sha256 }
    }
  ];
  const core = {
    schema: PLAN_SCHEMA,
    version: VERSION,
    status: 'TEST',
    recipeId: RECIPE_ID,
    snapshotRef: { schema: SNAPSHOT_SCHEMA, sha256: snapshot.snapshotDigest },
    targetCanvas: { medium: 'game-world', width: 960, height: 544, unit: 'px', colourSpace: 'srgb', runtime: 'canvas-2d' },
    visualSystem: {
      stylePresetId: snapshot.selections.style.id,
      treatmentId: snapshot.selections.treatment.id,
      effectIds: snapshot.selections.effects.map((item) => item.id),
      palette: {
        background: snapshot.selections.treatment.palette.background,
        surface: snapshot.selections.treatment.palette.surface,
        text: snapshot.selections.treatment.palette.text,
        mutedText: snapshot.selections.treatment.palette.mutedText,
        p1: snapshot.selections.style.intent.palette.primary,
        p2: snapshot.selections.style.intent.palette.secondary,
        enemy: snapshot.selections.style.intent.palette.accent,
        highlight: snapshot.selections.treatment.palette.highlight,
        repair: '#63ff9e',
        reactor: '#ffd166'
      },
      minimumTextContrast: Math.max(snapshot.selections.style.intent.accessibility.minimumTextContrast, snapshot.selections.treatment.constraints.minimumTextContrast),
      reducedMotionFallback: snapshot.selections.treatment.constraints.reducedMotionFallback === true,
      preserveGameplayCues: snapshot.selections.treatment.constraints.preserveGameplayCues === true
    },
    assetRoutes: routes,
    repairs,
    truth: {
      builtBeforeCandidateBytes: true,
      knownRepairRulesApplied: true,
      assetProviderExecuted: false,
      assetArtifactsProduced: false,
      catalogInformedRendering: true,
      outputQualityProven: false
    },
    authority: 'NONE'
  };
  return { ...core, planDigest: hashValue(core) };
}

function verifyPlan(plan, brief, snapshot) {
  try {
    const expected = buildPrebuildPlan(brief, snapshot);
    return { pass: same(plan, expected), errors: same(plan, expected) ? [] : ['prebuild plan differs from deterministic rebuild'] };
  } catch (error) { return { pass: false, errors: [error.message] }; }
}

module.exports = {
  VERSION, SNAPSHOT_SCHEMA, PLAN_SCHEMA, RECIPE_ID, STYLE_ID, TREATMENT_ID, EFFECT_IDS, RELEVANT_HANDS, PRIOR_EVIDENCE,
  clone, hashValue, buildCapabilitySnapshot, normalizeSnapshot, buildPrebuildPlan, verifyPlan
};
