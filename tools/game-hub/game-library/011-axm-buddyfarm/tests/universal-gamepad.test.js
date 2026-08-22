'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const gamepad = require('../runtime/universal-gamepad');

function pad(options) {
  const settings = options || {};
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  (settings.buttons || []).forEach(index => { buttons[index] = { pressed: true, value: 1 }; });
  return {
    axes: settings.axes || [0, 0, 0, 0],
    buttons,
    connected: true,
    id: settings.id || 'TEST STANDARD PAD',
    index: settings.index || 0,
    mapping: settings.mapping == null ? 'standard' : settings.mapping
  };
}

test('declares the shared universal profile and honest empty states', () => {
  assert.equal(gamepad.PROFILE_ID, 'axm-universal-xbox-brawl-v0.2.1');
  assert.deepEqual(gamepad.sampleStandardGamepad(null), gamepad.emptySample(false, false, ''));
  const unsupported = gamepad.sampleStandardGamepad(pad({ mapping: 'xinput' }));
  assert.equal(unsupported.connected, true);
  assert.equal(unsupported.supported, false);
});

test('left stick uses the declared dead zone and clamps axes', () => {
  assert.deepEqual(
    [gamepad.sampleStandardGamepad(pad({ axes: [0.21, -0.21] })).moveX, gamepad.sampleStandardGamepad(pad({ axes: [0.21, -0.21] })).moveY],
    [0, 0]
  );
  const sample = gamepad.sampleStandardGamepad(pad({ axes: [2, -2] }));
  assert.deepEqual([sample.moveX, sample.moveY], [1, -1]);
});

test('D-pad overrides stick movement', () => {
  const sample = gamepad.sampleStandardGamepad(pad({ axes: [-0.8, 0.8], buttons: [12, 15] }));
  assert.deepEqual([sample.moveX, sample.moveY], [1, -1]);
});

test('A and right trigger share the Action lane with rising edges', () => {
  const first = gamepad.sampleStandardGamepad(pad({ buttons: [0] }));
  assert.equal(first.action, true);
  assert.equal(first.actionEdge, true);
  assert.equal(gamepad.sampleStandardGamepad(pad({ buttons: [0] }), first).actionEdge, false);
  assert.equal(gamepad.sampleStandardGamepad(pad({ buttons: [7] })).action, true);
});

test('X, View and Menu expose Work, map and controls-menu edges', () => {
  const sample = gamepad.sampleStandardGamepad(pad({ buttons: [2, 8, 9] }));
  assert.equal(sample.workEdge, true);
  assert.equal(sample.mapEdge, true);
  assert.equal(sample.menuEdge, true);
  const held = gamepad.sampleStandardGamepad(pad({ buttons: [2, 8, 9] }), sample);
  assert.deepEqual([held.workEdge, held.mapEdge, held.menuEdge], [false, false, false]);
});

test('runtime wiring labels simulation and physical-device boundaries', () => {
  const root = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'runtime', 'app.js'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'runtime', 'index.html'), 'utf8');
  assert.match(app, /gamepadQaEnabled/);
  assert.match(app, /stable|playerIds\[pad\.index\]/);
  assert.match(app, /state\.actionDown = false/);
  assert.match(page, /TEST GAMEPAD SIMULATION/);
  assert.match(page, /not physical-device evidence/);
  assert.match(page, /A \/ RT/);
  assert.match(page, /id="controls-menu"/);
});

test('manifest declares the universal adapter without claiming physical QA', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'game.manifest.json'), 'utf8'));
  assert.equal(manifest.controls.gamepad_profile, gamepad.PROFILE_ID);
  assert.equal(manifest.verification.game_night.physical_gamepad_qa, 'pending');
  assert.ok(manifest.package.required_paths.includes('runtime/universal-gamepad.js'));
  assert.ok(manifest.package.required_paths.includes('tests/universal-gamepad.test.js'));
});
