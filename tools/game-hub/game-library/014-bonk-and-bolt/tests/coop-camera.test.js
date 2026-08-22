#!/usr/bin/env node
'use strict';

const assert = require('assert');
const test = require('node:test');
const Camera = require('../runtime/coop-camera.js');

const p = (x, z = 0) => ({ x, z });
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test('solo framing retains the authored perspective camera', () => {
  const frame = Camera.frame(p(4, -7));
  assert.equal(frame.state, 'solo');
  assert.deepEqual(frame.midpoint, p(4, -7));
  assert.deepEqual(frame.offset, Camera.SOLO_OFFSET);
});

test('co-op framing uses the honest player midpoint', () => {
  const frame = Camera.frame(p(-6, 4), p(10, 12));
  assert.deepEqual(frame.midpoint, p(2, 8));
  near(frame.distance, Math.hypot(16, 8));
  assert.equal(frame.state, 'together');
});

test('distance states expose together, wide and regroup bands', () => {
  assert.equal(Camera.stateForDistance(Camera.LIMITS.comfort), 'together');
  assert.equal(Camera.stateForDistance(Camera.LIMITS.comfort + .01), 'wide');
  assert.equal(Camera.stateForDistance(Camera.LIMITS.regroup), 'regroup');
});

test('extreme separation cannot make the camera zoom without limit', () => {
  const edge = Camera.frame(p(0), p(Camera.LIMITS.hard));
  const extreme = Camera.frame(p(0), p(500));
  assert.equal(extreme.framedDistance, Camera.LIMITS.hard);
  assert.deepEqual(extreme.offset, edge.offset);
});

test('movement below the soft edge is unchanged', () => {
  const move = Camera.constrainDelta(p(20), p(0), 3, 2);
  near(move.dx, 3); near(move.dz, 2);
  assert.equal(move.outwardScale, 1);
  assert.equal(move.blocked, false);
});

test('the soft band damps only the outward component', () => {
  const move = Camera.constrainDelta(p(31), p(0), 2, 1.5);
  assert.ok(move.dx > 0 && move.dx < 2);
  near(move.dz, 1.5);
  near(move.outwardScale, .5);
  assert.equal(move.blocked, true);
});

test('the hard edge removes outward travel while preserving inward travel', () => {
  const outward = Camera.constrainDelta(p(Camera.LIMITS.hard), p(0), 2, 0);
  near(outward.dx, 0); near(outward.dz, 0);
  assert.equal(outward.outwardScale, 0);
  const inward = Camera.constrainDelta(p(Camera.LIMITS.hard), p(0), -2, 0);
  near(inward.dx, -2); near(inward.dz, 0);
  assert.equal(inward.blocked, false);
});

test('tangential input remains useful at the hard edge', () => {
  const move = Camera.constrainDelta(p(Camera.LIMITS.hard), p(0), 0, 2);
  assert.ok(Math.abs(move.dz) > 1.9);
  const finalDistance = Math.hypot(Camera.LIMITS.hard + move.dx, move.dz);
  near(finalDistance, Camera.LIMITS.hard, 1e-8);
});

test('the covenant is symmetric for either player', () => {
  const first = Camera.constrainDelta(p(34), p(0), 2, .5);
  const second = Camera.constrainDelta(p(0), p(34), -2, -.5);
  near(first.dx, -second.dx); near(first.dz, -second.dz);
  near(first.outwardScale, second.outwardScale);
});

test('one large dodge cannot cross the hard shared-screen edge', () => {
  const move = Camera.constrainDelta(p(34), p(0), 4.2, 0);
  assert.ok(34 + move.dx <= Camera.LIMITS.hard + 1e-9);
  assert.ok(move.dx > 0);
});
