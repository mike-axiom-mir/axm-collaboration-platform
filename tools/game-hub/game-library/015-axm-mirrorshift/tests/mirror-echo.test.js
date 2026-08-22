'use strict';

const assert = require('node:assert/strict');
const echoCore = require('../runtime/mirror-echo');
const gameCore = require('../runtime/game-core');

function racer(overrides) {
  return Object.assign({
    id: 'p1', characterId: 'p1', character: 'Mike', vehicle: 'Maker GT',
    color: '#ffad52', accent: '#fff0bd', lap: 0, x: 100, y: 120,
    heading: Math.PI - .1, speed: 180, finishedAt: null
  }, overrides || {});
}

function state(now, racerOverrides, stateOverrides) {
  return Object.assign({
    now, phase: 'racing', mode: 'race', raceStartedAt: 1000, raceLaps: 3, routeDirectionId: 'forward',
    trackId: 'mirror-forge', variantId: 'clear-signal', track: { name: 'Mirror Forge' },
    racers: { p1: racer(racerOverrides) }
  }, stateOverrides || {});
}

assert.equal(echoCore.SCHEMA, 'axm.mirror-echo/v2');
assert.equal(echoCore.MAX_ECHOES, 18);
assert.equal(echoCore.MAX_SAMPLES, 720);

const vault = echoCore.createMirrorEchoVault({ minSampleGapMs: 10 });
for (let index = 0; index <= 6; index += 1) {
  const now = 1000 + index * 200;
  vault.observe(state(now, { x: 100 + index * 25, heading: index === 6 ? -Math.PI + .1 : Math.PI - .1 }));
}
const authorityPacket = state(2200, { lap: 1, x: 250, heading: -Math.PI + .1 });
const authorityBefore = JSON.stringify(authorityPacket);
vault.observe(authorityPacket);
assert.equal(JSON.stringify(authorityPacket), authorityBefore, 'echo capture mutated authority packet');

let best = vault.bestFor('mirror-forge', 'clear-signal');
assert(best);
assert.equal(best.durationMs, 1200);
assert.equal(best.source.character, 'Mike');
assert(best.sampleCount >= 7);
assert(Object.isFrozen(best));
assert(Object.isFrozen(best.samples));

const playback = vault.playback(state(1600));
assert(playback);
assert.equal(playback.changesAuthority, false);
assert(playback.pose.x > 100 && playback.pose.x < 250);
assert(Math.abs(playback.pose.heading) > 3, 'heading interpolation must follow shortest arc across PI');

for (let index = 1; index <= 5; index += 1) {
  vault.observe(state(2200 + index * 180, { lap: 1, x: 250 + index * 20, heading: .2 + index * .05 }));
}
vault.observe(state(3200, { lap: 2, x: 370, heading: .55 }));
best = vault.bestFor('mirror-forge', 'clear-signal');
assert.equal(best.durationMs, 1000, 'faster second lap should replace the incumbent');
assert.equal(vault.snapshot().bestLapsReplaced, 1);

vault.setEnabled(false);
assert.equal(vault.playback(state(2600, { lap: 1 })), null);
assert.equal(vault.summary(state(2600)).enabled, false);
vault.setEnabled(true);
assert.equal(vault.bestFor('mirror-forge', 'redline-gauntlet'), null);

const directional = echoCore.createMirrorEchoVault({ minSampleGapMs: 10 });
for (let index = 0; index <= 6; index += 1) {
  directional.observe(state(5000 + index * 200, { x: 500 - index * 20 }, { raceStartedAt: 5000, routeDirectionId: 'reflection' }));
}
directional.observe(state(6200, { lap: 1, x: 380 }, { raceStartedAt: 5000, routeDirectionId: 'reflection' }));
assert.equal(directional.bestFor('mirror-forge', 'clear-signal', 'forward'), null);
const reflectedBest = directional.bestFor('mirror-forge', 'clear-signal', 'reflection');
assert(reflectedBest);
assert.equal(reflectedBest.routeDirectionId, 'reflection');
assert.equal(directional.playback(state(5600, {}, { raceStartedAt: 5000, routeDirectionId: 'forward' })), null);
assert(directional.playback(state(5600, {}, { raceStartedAt: 5000, routeDirectionId: 'reflection' })));

const bounded = echoCore.createMirrorEchoVault({ maxSamples: 24, minSampleGapMs: 1 });
for (let index = 0; index < 5000; index += 1) {
  bounded.observe(state(1000 + index * 5, { x: index, heading: index / 30 }));
}
const boundedSnapshot = bounded.snapshot(state(26000));
assert.equal(boundedSnapshot.activeCaptures.length, 1);
assert(boundedSnapshot.activeCaptures[0].sampleCount <= 24);
assert(boundedSnapshot.sampleCompactions > 0);

const ignored = echoCore.createMirrorEchoVault();
ignored.observe(state(1000, {}, { mode: 'battle', variantId: null }));
assert.equal(ignored.snapshot().activeCaptures.length, 0);
assert.equal(ignored.snapshot().echoCount, 0);

assert.deepEqual(gameCore.BASE_STATS, { maxSpeed: 260, acceleration: 178, brake: 255, turnRate: 2.45, grip: .985 });
assert.equal(gameCore.METRICS.catchupByRank[3], 1.075);
assert.deepEqual(gameCore.POWERUP_WEIGHTS.map(item => item.weight), [35, 30, 20, 15]);
assert.equal(gameCore.METRICS.shieldMax, 3);

console.log('MIRRORSHIFT MIRROR ECHO PASS - bounded fastest-lap trace - shortest-heading playback - authority unchanged');
