'use strict';

const crypto = require('node:crypto');
const Anim = require('../../tools/anim-kit/anim-kit.js');
const Locomotion = require('../../tools/anim-kit/locomotion.js');
const Morph = require('../../tools/anim-kit/morph.js');

const SCHEMA = 'axm.procedural-motion-block/v1';
const VERSION = '1.0.0';

const DEFINITIONS = Object.freeze({
  'idle-bob': { label: 'Idle breathing', family: 'juice', duration_ms: 2200, loop: true, semantic: 'idle', build: () => Anim.Juice.idleBob() },
  'hit-pop': { label: 'Hit pop', family: 'juice', duration_ms: 320, loop: false, semantic: 'hit', build: () => Anim.Juice.hitPop() },
  'land-squash': { label: 'Landing squash', family: 'juice', duration_ms: 260, loop: false, semantic: 'action', build: () => Anim.Juice.landSquash() },
  'screen-shake': { label: 'Seeded screen shake', family: 'camera', duration_ms: 350, loop: false, semantic: null, build: () => Anim.Juice.screenShake({ seed: 1 }) },
  'windup': { label: 'Anticipation windup', family: 'juice', duration_ms: 520, loop: false, semantic: 'action', build: () => Anim.Juice.windup() },
  'locomotion-idle': { label: 'Procedural idle', family: 'locomotion', duration_ms: 2200, loop: true, semantic: 'idle', build: () => Locomotion.channels('idle') },
  'locomotion-walk': { label: 'Procedural walk', family: 'locomotion', duration_ms: 800, loop: true, semantic: 'walk', build: () => Locomotion.channels('walk') },
  'locomotion-run': { label: 'Procedural run', family: 'locomotion', duration_ms: 600, loop: true, semantic: 'run', build: () => Locomotion.channels('run') },
  'respawn-long-reach': { label: 'Respawn: Long Reach', family: 'directed-morph', duration_ms: 1200, loop: false, semantic: 'recover', build: () => Morph.timeline('longReach') },
  'respawn-stilt-legs': { label: 'Respawn: Stilt Legs', family: 'directed-morph', duration_ms: 1200, loop: false, semantic: 'recover', build: () => Morph.timeline('stiltLegs') }
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }

function list() {
  return Object.entries(DEFINITIONS).map(([id, item]) => ({
    id, label: item.label, family: item.family, duration_ms: item.duration_ms, loop: item.loop, semantic: item.semantic
  }));
}

function create(blockId) {
  const definition = DEFINITIONS[blockId];
  if (!definition) throw new Error(`Unknown procedural motion block: ${blockId}`);
  const payload = clone(definition.build());
  const contentDigest = digest({ block_id: blockId, payload });
  return {
    schema: SCHEMA,
    version: VERSION,
    id: `${blockId}-${contentDigest.slice(0, 12)}`,
    block_id: blockId,
    label: definition.label,
    family: definition.family,
    duration_ms: definition.duration_ms,
    loop: definition.loop,
    semantic: definition.semantic,
    source_contract: 'axm.procedural-motion/v1',
    payload,
    digest: `sha256:${contentDigest}`,
    compatibility: {
      game_animation_spine: definition.semantic ? 'READY_AS_SEMANTIC_INPUT' : 'ADAPTER_REQUIRED',
      bounded_rig_animation_clip: 'ADAPTER_REQUIRED',
      css: ['idle-bob', 'hit-pop', 'land-squash', 'screen-shake', 'windup'].includes(blockId) ? 'AVAILABLE_FROM_SOURCE_CLIP' : 'ENGINE_ADAPTER_REQUIRED'
    },
    authority: { automatic_apply: false, visual_approval: false, canonical: false },
    provenance: {
      origin: 'local-generated',
      creator: 'Opus for Mike Tobi / AXM',
      source: 'exports/axm-anim-kit-v0_1.zip',
      source_sha256: '328a4b27224d89fb5ff7d0aee176e05fe48ce0166cd0b169124db0f521241da0'
    }
  };
}

function gameAnimationDescriptors() {
  const aliases = [
    ['locomotion-idle', 'Procedural|Idle'], ['locomotion-walk', 'Procedural|Walk'], ['locomotion-run', 'Procedural|Run'],
    ['windup', 'Procedural|Punch'], ['hit-pop', 'Procedural|Hit'], ['respawn-long-reach', 'Procedural|Death'],
    ['respawn-stilt-legs', 'Procedural|Standing'], ['land-squash', 'Procedural|Clapping']
  ];
  return aliases.map(([block_id, name]) => {
    const item = DEFINITIONS[block_id];
    return { name, duration: item.duration_ms / 1000, block_id, source_contract: 'axm.procedural-motion-block/v1' };
  });
}

module.exports = { SCHEMA, VERSION, list, create, gameAnimationDescriptors };
