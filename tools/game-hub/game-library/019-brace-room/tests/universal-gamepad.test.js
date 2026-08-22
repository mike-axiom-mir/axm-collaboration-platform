#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Gamepad = require('../runtime/universal-gamepad');

function pad(options = {}) {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  for (const index of options.buttons || []) buttons[index] = { pressed: true, value: 1 };
  return {
    id: options.id || 'TEST XBOX PAD',
    mapping: options.mapping || 'standard',
    axes: options.axes || [0, 0, 0, 0],
    buttons
  };
}

assert.strictEqual(Gamepad.PROFILE_ID, 'axm-universal-xbox-brawl-v0.2.1');
assert.deepStrictEqual(Gamepad.sampleStandardGamepad(null), {
  connected: false, supported: false, id: '', moveX: 0, moveY: 0,
  action: false, actionEdge: false, pause: false, pauseEdge: false
});

let sample = Gamepad.sampleStandardGamepad(pad({ axes: [-0.8, 0.7, 0, 0] }));
assert.strictEqual(sample.moveX, -0.8, 'left stick X maps to horizontal movement');
assert.strictEqual(sample.moveY, 0.7, 'left stick Y maps to vertical movement');
assert.strictEqual(Gamepad.sampleStandardGamepad(pad({ axes: [0.1, -0.1, 0, 0] })).moveX, 0, 'stick dead zone stays neutral');
assert.strictEqual(Gamepad.sampleStandardGamepad(pad({ buttons: [12, 15] })).moveY, -1, 'D-pad up maps to movement');
assert.strictEqual(Gamepad.sampleStandardGamepad(pad({ buttons: [12, 15] })).moveX, 1, 'D-pad right maps to movement');

sample = Gamepad.sampleStandardGamepad(pad({ buttons: [0] }));
assert.strictEqual(sample.action, true, 'A maps to primary action');
assert.strictEqual(sample.actionEdge, true, 'first A frame emits one action edge');
assert.strictEqual(Gamepad.sampleStandardGamepad(pad({ buttons: [0] }), sample).actionEdge, false, 'held A does not emit repeated edges');
assert.strictEqual(Gamepad.sampleStandardGamepad(pad({ buttons: [7] })).action, true, 'right trigger also maps to primary action');

sample = Gamepad.sampleStandardGamepad(pad({ buttons: [9] }));
assert.strictEqual(sample.pause, true, 'Menu maps to pause');
assert.strictEqual(sample.pauseEdge, true, 'first Menu frame emits one pause edge');
assert.strictEqual(Gamepad.sampleStandardGamepad(pad({ mapping: 'nonstandard' })).supported, false, 'non-standard mappings fail visibly instead of guessing');
assert.strictEqual(Gamepad.strongestAxis(1, -0.4, 0.8), 1, 'keyboard/phone/gamepad merge keeps the strongest input');
assert.strictEqual(Gamepad.strongestAxis(0, -0.9, 0.5), -0.9, 'analog phone input can remain authoritative when stronger');

const packageRoot = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'game.manifest.json'), 'utf8'));
const indexSource = fs.readFileSync(path.join(packageRoot, 'runtime/index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(packageRoot, 'runtime/app.js'), 'utf8');

assert.strictEqual(manifest.controls.gamepad, true, 'manifest advertises gamepad only when the adapter exists');
assert.strictEqual(manifest.controls.gamepad_profile, Gamepad.PROFILE_ID, 'manifest and runtime use the same universal profile');
assert.match(indexSource, /id="gamepad-status"/, 'shared screen exposes live gamepad readiness');
assert.match(indexSource, /TEST GAMEPAD SIMULATION/, 'QA route labels simulated input so it cannot masquerade as device evidence');
assert.ok(indexSource.indexOf('universal-gamepad.js') < indexSource.indexOf('app.js'), 'adapter loads before the game runtime');
assert.match(appSource, /Core\.PLAYER_IDS\.forEach\(function \(id, index\)/, 'pads bind to all four stable seat indexes');
assert.match(appSource, /dataset\.lastGamepadInput/, 'live runtime exposes the most recent mapped gamepad intent for verification');
assert.match(appSource, /gamepadQa === 'simulated-not-physical'|gamepadQa = 'simulated-not-physical'/, 'QA state is explicitly named as non-physical');

console.log('  PASS  universal-gamepad.test.js (24 checks)');
