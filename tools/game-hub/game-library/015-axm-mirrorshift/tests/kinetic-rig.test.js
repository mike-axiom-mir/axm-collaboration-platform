'use strict';

const assert = require('node:assert/strict');
const core = require('../runtime/game-core');

const characterIds = core.RACERS.map(racer => racer.id);
const rigs = Object.values(core.KINETIC_RIGS);

assert(Object.isFrozen(core.KINETIC_RIGS));
assert.equal(rigs.length, 4);
assert.equal(new Set(rigs.map(rig => rig.id)).size, 4);
assert.equal(new Set(rigs.map(rig => rig.motion)).size, 4);
rigs.forEach(rig => {
  assert(Object.isFrozen(rig));
  assert.equal(rig.changesPerformance, false);
});

const authority = core.createInitialState([], { now: 0 });
const authorityBefore = JSON.stringify(authority);
const authorityPose = core.vehicleAnimationPose(authority.racers.p1, 1234, 0, false);
assert.equal(authorityPose.schema, 'axm.vehicle-animation-pose/v1');
assert.equal(authorityPose.changesPerformance, false);
assert.equal(JSON.stringify(authority), authorityBefore, 'presentation pose mutated authority state');

const baseActor = {
  characterId: 'p1',
  speed: 150,
  input: { throttle: 1, brake: 0, steer: .7 },
  drifting: false,
  driftDirection: 0,
  boostUntil: 0,
  spinUntil: 0,
  offRoad: false
};
const stateActors = [
  Object.assign({}, baseActor, { speed: 0, input: { throttle: 0, brake: 0, steer: 0 } }),
  baseActor,
  Object.assign({}, baseActor, { input: { throttle: 0, brake: 1, steer: 0 } }),
  Object.assign({}, baseActor, { drifting: true, driftDirection: 1 }),
  Object.assign({}, baseActor, { boostUntil: 2000 }),
  Object.assign({}, baseActor, { spinUntil: 2000 })
];
assert.deepEqual(stateActors.map(actor => core.vehicleAnimationPose(actor, 1000, 1000, false).state), [
  'idle', 'drive', 'brake', 'drift', 'boost', 'impact'
]);

const identityPoses = characterIds.map((characterId, index) => core.vehicleAnimationPose(
  Object.assign({}, baseActor, { characterId }),
  1800 + index * 37,
  1800,
  false
));
assert.equal(new Set(identityPoses.map(pose => pose.rigId)).size, 4);
assert.equal(new Set(identityPoses.map(pose => pose.motion)).size, 4);

const fullPose = core.vehicleAnimationPose(Object.assign({}, baseActor, { offRoad: true, drifting: true, driftDirection: -1 }), 2917, 1000, false);
const reducedPose = core.vehicleAnimationPose(Object.assign({}, baseActor, { offRoad: true, drifting: true, driftDirection: -1 }), 2917, 1000, true);
assert.equal(reducedPose.reducedMotion, true);
assert.equal(reducedPose.wheelSpin, 0);
assert.equal(reducedPose.signaturePhase, .5);
assert(Math.abs(reducedPose.bodyLift) <= Math.abs(fullPose.bodyLift) * .121 + .0001);
assert(Math.abs(reducedPose.bodyRoll) <= Math.abs(fullPose.bodyRoll) * .121 + .0001);
assert(Math.abs(reducedPose.noseShift) <= Math.abs(fullPose.noseShift) * .121 + .0001);

const numericFields = ['bodyLift', 'bodyRoll', 'noseShift', 'wheelSpin', 'wheelSteer', 'frontTravel', 'rearTravel', 'signaturePhase', 'energy'];
const states = new Set();
let poses = 0;
for (let sample = 0; sample < 27000; sample += 1) {
  characterIds.forEach((characterId, characterIndex) => {
    const frameNow = sample * (1000 / 60) + characterIndex * 3;
    const stateNow = frameNow;
    const actor = {
      characterId,
      speed: (sample * 37 + characterIndex * 71) % 352,
      input: {
        throttle: (sample % 11) / 10,
        brake: sample % 17 === 0 ? 1 : 0,
        steer: Math.sin(sample * .19 + characterIndex)
      },
      drifting: sample % 13 < 3,
      driftDirection: sample % 2 ? 1 : -1,
      boostUntil: sample % 29 < 4 ? stateNow + 500 : 0,
      spinUntil: sample % 97 < 2 ? stateNow + 260 : 0,
      offRoad: sample % 31 < 3
    };
    const pose = core.vehicleAnimationPose(actor, frameNow, stateNow, false);
    numericFields.forEach(field => assert(Number.isFinite(pose[field]), field + ' must stay finite'));
    assert(Math.abs(pose.bodyLift) <= 6.5);
    assert(Math.abs(pose.bodyRoll) <= .2);
    assert(Math.abs(pose.noseShift) <= 2);
    assert(Math.abs(pose.wheelSteer) <= .34);
    assert(Math.abs(pose.frontTravel) <= 1.5);
    assert(Math.abs(pose.rearTravel) <= 1.1);
    assert(pose.signaturePhase >= 0 && pose.signaturePhase <= 1);
    assert(pose.energy >= 0 && pose.energy <= 1);
    assert.equal(pose.changesPerformance, false);
    states.add(pose.state);
    poses += 1;
  });
}

assert.equal(poses, 108000);
assert.deepEqual([...states].sort(), ['boost', 'brake', 'drift', 'drive', 'idle', 'impact']);
assert.deepEqual(core.BASE_STATS, { maxSpeed: 260, acceleration: 178, brake: 255, turnRate: 2.45, grip: .985 });
assert.equal(core.METRICS.catchupByRank[3], 1.075);
assert.deepEqual(core.POWERUP_WEIGHTS.map(item => item.weight), [35, 30, 20, 15]);
assert.equal(core.METRICS.shieldMax, 3);

console.log('MIRRORSHIFT KINETIC RIG PASS · ' + poses + ' bounded poses · 4 identity rigs · reduced motion clamped · authority unchanged');
