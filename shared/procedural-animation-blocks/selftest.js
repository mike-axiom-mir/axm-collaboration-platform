'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const Blocks = require('./index.js');

(async () => {
  const items = Blocks.list();
  assert.equal(items.length, 10);
  const first = Blocks.create('locomotion-walk');
  const second = Blocks.create('locomotion-walk');
  assert.deepEqual(first, second, 'same block must produce byte-stable governed data');
  assert.equal(first.schema, Blocks.SCHEMA);
  assert.equal(first.compatibility.bounded_rig_animation_clip, 'ADAPTER_REQUIRED');
  assert.equal(first.authority.visual_approval, false);
  assert.throws(() => Blocks.create('unknown-motion'), /Unknown procedural motion block/);

  const animation = await import(pathToFileURL(path.join(__dirname, '..', 'game-animation-foundation', 'animation-spine.mjs')).href);
  const verifier = await import(pathToFileURL(path.join(__dirname, '..', 'game-animation-foundation', 'animation-verifier.mjs')).href);
  const graph = animation.buildHumanoidGameplayGraph(Blocks.gameAnimationDescriptors(), { id: 'procedural-motion-selftest' });
  assert.equal(verifier.verifyAnimationGraph(graph).status, 'PASS');
  assert.equal(graph.human_visual_review.approved, false);
  console.log(`Procedural animation blocks selftest: PASS (${items.length} blocks, ${graph.states.length} semantic states, visual gate open)`);
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
