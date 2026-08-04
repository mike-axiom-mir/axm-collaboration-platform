#!/usr/bin/env node
'use strict';

const assert = require('assert');
const test = require('node:test');
const Motion = require('../runtime/motion-system.js');

const classes = ['panzer', 'pun-slinger', 'gear-shepherd'];
const actions = ['attack', 'special', 'dodge'];

test('every hero class exposes every bounded action', () => {
  for (const classId of classes) {
    const profile = Motion.profile(classId);
    for (const action of actions) assert.ok(profile[action], classId + ' ' + action);
  }
});

test('actions progress through anticipation, impact, recovery and settlement', () => {
  for (const classId of classes) for (const action of actions) {
    const duration = Motion.ACTION_TIMING[action].duration;
    assert.equal(Motion.sample(classId, action, duration * .08, false).phase, 'anticipation');
    assert.equal(Motion.sample(classId, action, duration * .4, false).phase, 'impact');
    assert.equal(Motion.sample(classId, action, duration * .78, false).phase, 'recovery');
    const settled = Motion.sample(classId, action, duration, false);
    assert.equal(settled.phase, 'settled');
    assert.equal(settled.done, true);
    assert.equal(settled.weaponRX, Motion.BASE_POSE.weaponRX);
  }
});

test('the three class signatures and attack silhouettes stay distinct', () => {
  const signatures = classes.map(classId => Motion.profile(classId).signature);
  assert.equal(new Set(signatures).size, 3);
  const impacts = classes.map(classId => Motion.sample(classId, 'attack', Motion.ACTION_TIMING.attack.duration * .5, false));
  assert.equal(new Set(impacts.map(pose => pose.weaponRY.toFixed(3))).size, 3);
  assert.equal(new Set(impacts.map(pose => pose.rootY.toFixed(3))).size, 3);
});

test('Panzer reads as a crouch into an overhead pan slam', () => {
  const wind = Motion.sample('panzer', 'attack', .1, false);
  const impact = Motion.sample('panzer', 'attack', .27, false);
  assert.ok(wind.rootY < 1 && wind.weaponPY > Motion.BASE_POSE.weaponPY);
  assert.ok(impact.weaponPZ > .8 && impact.weaponRX > .5);
});

test('Pun-Slinger reads as recoil and a bread fan', () => {
  const wind = Motion.sample('pun-slinger', 'special', .16, false);
  const impact = Motion.sample('pun-slinger', 'special', .45, false);
  assert.ok(wind.weaponRY < -.7 && wind.headRZ < 0);
  assert.ok(impact.weaponRY > 1.4 && impact.cueScale > 1.5);
});

test('Gear Shepherd reads as a conductor command sweep', () => {
  const wind = Motion.sample('gear-shepherd', 'special', .16, false);
  const impact = Motion.sample('gear-shepherd', 'special', .45, false);
  assert.ok(wind.weaponRY > .7 && wind.leftArmRX < -.6);
  assert.ok(impact.weaponRY < -1.4 && impact.leftArmRX > .7);
});

test('reduced motion preserves a static high-contrast cue without pose travel', () => {
  for (const classId of classes) for (const action of actions) {
    const pose = Motion.sample(classId, action, Motion.ACTION_TIMING[action].duration * .5, true);
    assert.equal(pose.phase, 'reduced-cue');
    assert.equal(pose.rootX, 1); assert.equal(pose.rootY, 1); assert.equal(pose.rootZ, 1); assert.equal(pose.rootLift, 0);
    assert.equal(pose.weaponRX, Motion.BASE_POSE.weaponRX); assert.equal(pose.weaponPX, Motion.BASE_POSE.weaponPX);
    assert.ok(pose.cueOpacity >= .72); assert.equal(pose.cueScale, 1);
  }
});

test('unknown identifiers fail safely to the Panzer attack contract', () => {
  const pose = Motion.sample('unknown-class', 'unknown-action', .1, false);
  assert.equal(pose.classId, 'panzer');
  assert.equal(pose.kind, 'attack');
  assert.equal(pose.signature, 'heavy-pan-slam');
});
