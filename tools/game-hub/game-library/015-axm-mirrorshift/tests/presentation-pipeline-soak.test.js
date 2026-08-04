#!/usr/bin/env node
'use strict';

const assert = require('assert');
const core = require('../runtime/game-core');

let randomState = 0x15a11ce;
function random() {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState / 4294967296;
}
function angleDelta(target, current) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

const alphas = [0, .2, .4, .6, .8, 1];
let interpolatedSamples = 0;
let snapSamples = 0;
let maximumStep = 0;

for (let route = 0; route < 48; route += 1) {
  let previous = {
    x: 80 + random() * 1120,
    y: 80 + random() * 560,
    heading: random() * Math.PI * 2 - Math.PI
  };
  for (let packet = 1; packet <= 240; packet += 1) {
    const teleport = packet % 80 === 0;
    const distance = teleport ? 260 + random() * 180 : 2 + random() * 34;
    const direction = random() * Math.PI * 2;
    const current = {
      x: previous.x + Math.cos(direction) * distance,
      y: previous.y + Math.sin(direction) * distance,
      heading: previous.heading + (random() - .5) * .75,
      speed: 40 + random() * 260
    };
    const previousReceipt = JSON.stringify(previous);
    const currentReceipt = JSON.stringify(current);
    for (const alpha of alphas) {
      const pose = core.interpolatePresentationPose(previous, current, alpha, 180);
      assert(Number.isFinite(pose.x) && Number.isFinite(pose.y) && Number.isFinite(pose.heading));
      if (teleport) {
        assert.equal(pose.snapped, true);
        assert.equal(pose.interpolated, false);
        assert.equal(pose.x, current.x);
        assert.equal(pose.y, current.y);
        snapSamples += 1;
      } else {
        assert.equal(pose.snapped, false);
        const expectedX = previous.x + (current.x - previous.x) * alpha;
        const expectedY = previous.y + (current.y - previous.y) * alpha;
        const expectedHeading = previous.heading + angleDelta(current.heading, previous.heading) * alpha;
        assert(Math.abs(pose.x - expectedX) < 1e-9);
        assert(Math.abs(pose.y - expectedY) < 1e-9);
        assert(Math.abs(pose.heading - expectedHeading) < 1e-9);
        if (alpha < 1 && alpha > 0) {
          assert.equal(pose.interpolated, true);
          interpolatedSamples += 1;
        }
        maximumStep = Math.max(maximumStep, Math.hypot(current.x - previous.x, current.y - previous.y));
      }
    }
    assert.equal(JSON.stringify(previous), previousReceipt, 'prior authority packet mutated');
    assert.equal(JSON.stringify(current), currentReceipt, 'current authority packet mutated');
    previous = current;
  }
}

assert(interpolatedSamples > 40000, 'held-out interpolation path did not exercise enough samples');
assert(snapSamples >= 800, 'teleport snap safety did not exercise enough samples');
assert(maximumStep < 40, 'ordinary authority packet motion escaped the declared envelope');
assert(Object.isFrozen(core.BASE_STATS), 'presentation work must not loosen the frozen vehicle contract');

console.log('MIRRORSHIFT PRESENTATION PIPELINE SOAK PASS · ' + interpolatedSamples + ' interpolated poses · ' + snapSamples + ' teleport snaps · max ordinary step ' + Math.round(maximumStep * 100) / 100);
