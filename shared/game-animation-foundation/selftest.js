'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const runtime = await import(pathToFileURL(path.join(__dirname, 'animation-spine.mjs')).href);
  const verifier = await import(pathToFileURL(path.join(__dirname, 'animation-verifier.mjs')).href);
  const clips = [
    { name: 'Human|Idle', duration: 1 }, { name: 'Human|Walk', duration: .8 }, { name: 'Human|Run', duration: .6 },
    { name: 'Human|Punch', duration: .5 }, { name: 'Human|Hit', duration: .3 }, { name: 'Human|Death', duration: .9 },
    { name: 'Human|Standing', duration: .7 }, { name: 'Human|Clapping', duration: 1.2 }
  ];
  const graph = runtime.buildHumanoidGameplayGraph(clips, { id: 'selftest-humanoid' });
  assert.equal(verifier.verifyAnimationGraph(graph).status, 'PASS');
  assert.equal(graph.human_visual_review.approved, false);
  assert.equal(runtime.matchSemanticClips(clips).walk.name, 'Human|Walk');
  function run() {
    const controller = runtime.createAnimationController(graph), trace = [controller.snapshot()];
    controller.setParameter('speed', 1); trace.push(controller.update(16), controller.update(180), controller.update(260));
    controller.setParameter('speed', 0); trace.push(controller.update(16), controller.update(200));
    controller.trigger('emote'); trace.push(controller.update(16), controller.update(1000), controller.update(250));
    return trace;
  }
  const first = run(), second = run();
  assert.deepEqual(first, second, 'same inputs must produce the same animation trace');
  assert(first.some((frame) => frame.state === 'walk'));
  assert(first.flatMap((frame) => frame.events).some((event) => event.id === 'foot-left'));
  assert(first.some((frame) => frame.state === 'emote'));
  assert.equal(first.at(-1).state, 'idle');
  assert(first.some((frame) => frame.transition_started?.duration_ms > 0));
  assert.throws(() => runtime.compileAnimationGraph({ id: 'bad', initial_state: 'missing', states: [{ id: 'idle', clip: 'Idle', duration_ms: 1 }], transitions: [] }), /initial state/);
  const digest = crypto.createHash('sha256').update(JSON.stringify(first)).digest('hex');
  console.log(`Game animation foundation selftest: PASS (${graph.states.length} states, ${graph.transitions.length} transitions, trace ${digest.slice(0, 12)})`);
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
