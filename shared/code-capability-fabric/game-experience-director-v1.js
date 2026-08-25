'use strict';

const crypto = require('crypto');
const Core = require('./semantic-candidate-generator-v1');

const VERSION = '1.0.0';
const PLAN_SCHEMA = 'axm.game-experience-flow-plan/v1';
const RECIPE_ID = 'twin-reactor-action-coop';
const SCENE_IDS = Object.freeze([
  'LOBBY', 'MISSION_INTRO', 'ACTIVE_PLAY', 'WAVE_TRANSITION',
  'WARDEN_INTRO', 'PAUSED', 'VICTORY', 'DEFEAT'
]);
const LIMITATIONS = Object.freeze([
  'PLAN_DOES_NOT_PROVE_RENDERING',
  'PLAN_DOES_NOT_PROVE_PLAY_QUALITY',
  'TRANSITION_CADENCE_REQUIRES_LIVE_OBSERVATION',
  'HUMAN_TASTE_REVIEW_REQUIRED',
  'NO_INSTALLATION_OR_PROMOTION_AUTHORITY'
]);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonical(value) { return Core.canonicalJson(value); }
function same(a, b) { return canonical(a) === canonical(b); }
function hashValue(value) {
  return 'sha256:' + crypto.createHash('sha256').update(Buffer.from(canonical(value), 'utf8')).digest('hex');
}

function assertInput(brief, prebuildPlan) {
  if (!brief || brief.schema !== 'axm.game-generation-brief/v1' || brief.recipeId !== RECIPE_ID || !brief.briefDigest) {
    throw new Error('experience director requires the exact sealed co-op brief');
  }
  if (!prebuildPlan || prebuildPlan.schema !== 'axm.game-prebuild-plan/v1' || prebuildPlan.recipeId !== RECIPE_ID || !prebuildPlan.planDigest) {
    throw new Error('experience director requires the exact asset-aware prebuild plan');
  }
  if (prebuildPlan.authority !== 'NONE') throw new Error('experience director input authority must remain NONE');
}

function scene(id, enginePhases, purpose, presentation, primaryAction) {
  return { id, enginePhases, purpose, presentation, primaryAction };
}

function buildPlan(brief, prebuildPlan) {
  assertInput(brief, prebuildPlan);
  const core = {
    schema: PLAN_SCHEMA,
    version: VERSION,
    status: 'TEST',
    recipeId: RECIPE_ID,
    candidateId: 'twin-reactor-coop-native',
    sourceRefs: {
      brief: { id: brief.id, schema: brief.schema, sha256: brief.briefDigest },
      prebuildPlan: { id: brief.id + '-asset-prebuild-plan', schema: prebuildPlan.schema, sha256: prebuildPlan.planDigest }
    },
    intent: {
      mode: 'GAME_FIRST_STAGED_DISCLOSURE',
      promise: 'Move two independent local pilots through one readable shared mission before exposing build-review detail.',
      defaultSceneId: 'LOBBY',
      defaultDisclosure: 'PLAYER_RELEVANT_ONLY'
    },
    scenes: [
      scene('LOBBY', ['READY'], 'Establish the shared objective and both independent control seats.', 'BLOCKING_OVERLAY', 'START_MISSION'),
      scene('MISSION_INTRO', ['RUNNING'], 'Bridge the lobby into play with one bounded mission cue.', 'NON_BLOCKING_BANNER', null),
      scene('ACTIVE_PLAY', ['RUNNING'], 'Keep the arena, objective, player condition, and immediate action legible.', 'ARENA_FIRST', 'PAUSE'),
      scene('WAVE_TRANSITION', ['RUNNING'], 'Turn the bounded inter-wave delay into readable breathing room.', 'NON_BLOCKING_BANNER', null),
      scene('WARDEN_INTRO', ['RUNNING'], 'Announce the final typed threat without leaving the arena.', 'NON_BLOCKING_BANNER', null),
      scene('PAUSED', ['PAUSED'], 'Stop simulation and expose resume or restart without changing bytes.', 'BLOCKING_OVERLAY', 'RESUME'),
      scene('VICTORY', ['VICTORY'], 'Present the one shared successful outcome and both seat scores.', 'BLOCKING_OVERLAY', 'RESTART'),
      scene('DEFEAT', ['DEFEAT'], 'Present the one shared failed outcome and a bounded retry.', 'BLOCKING_OVERLAY', 'RESTART')
    ],
    transitions: [
      { from: 'LOBBY', event: 'START', to: 'MISSION_INTRO', holdTicks: 24 },
      { from: 'MISSION_INTRO', event: 'HOLD_COMPLETE', to: 'ACTIVE_PLAY', holdTicks: 0 },
      { from: 'ACTIVE_PLAY', event: 'WAVE_CLEARED', to: 'WAVE_TRANSITION', holdTicks: 42 },
      { from: 'WAVE_TRANSITION', event: 'NEXT_STANDARD_WAVE', to: 'ACTIVE_PLAY', holdTicks: 0 },
      { from: 'WAVE_TRANSITION', event: 'FINAL_WAVE_SPAWNED', to: 'WARDEN_INTRO', holdTicks: 24 },
      { from: 'WARDEN_INTRO', event: 'HOLD_COMPLETE', to: 'ACTIVE_PLAY', holdTicks: 0 },
      { from: 'ACTIVE_PLAY', event: 'PAUSE', to: 'PAUSED', holdTicks: 0 },
      { from: 'PAUSED', event: 'RESUME', to: 'ACTIVE_PLAY', holdTicks: 0 },
      { from: 'ACTIVE_PLAY', event: 'SHARED_VICTORY', to: 'VICTORY', holdTicks: 0 },
      { from: 'ACTIVE_PLAY', event: 'SHARED_DEFEAT', to: 'DEFEAT', holdTicks: 0 },
      { from: 'VICTORY', event: 'RESTART', to: 'LOBBY', holdTicks: 0 },
      { from: 'DEFEAT', event: 'RESTART', to: 'LOBBY', holdTicks: 0 }
    ],
    disclosure: {
      alwaysVisible: ['shared-objective', 'wave', 'reactor-health', 'hostile-count', 'twin-link', 'both-seat-health'],
      lobbyOnly: ['two-seat-control-summary', 'start-mission'],
      outcomeOnly: ['shared-outcome', 'both-seat-scores', 'restart-mission'],
      onDemand: ['exact-controls', 'asset-capability-lineage', 'prebuild-repairs', 'authority-boundary', 'installation-hold', 'warden-practice'],
      reviewSurface: 'COLLAPSIBLE_REVIEW_DRAWER',
      mayHideTruth: false
    },
    timing: { clock: 'DETERMINISTIC_ENGINE_TICKS', expectedPreviewRateHz: 12, wallClockProof: false },
    accessibility: { keyboardComplete: true, reducedMotionHonored: true, liveStatus: true, focusVisible: true },
    boundaries: {
      permissions: [], networkDomains: [], writes: [], providerCalls: false, executesAssetHands: false,
      installs: false, integrates: false, promotes: false, canonizes: false
    },
    limitations: Array.from(LIMITATIONS),
    truth: { plannedBeforeCandidateSource: true, renderingProven: false, playQualityProven: false, humanAccepted: false },
    authority: 'NONE'
  };
  return { ...core, planDigest: hashValue(core) };
}

function verifyPlan(value, brief, prebuildPlan) {
  try {
    const rebuilt = buildPlan(brief, prebuildPlan);
    return { pass: same(value, rebuilt), errors: same(value, rebuilt) ? [] : ['experience flow plan differs from deterministic rebuild'] };
  } catch (error) {
    return { pass: false, errors: [error.message] };
  }
}

module.exports = { VERSION, PLAN_SCHEMA, RECIPE_ID, SCENE_IDS, LIMITATIONS, clone, hashValue, buildPlan, verifyPlan };
