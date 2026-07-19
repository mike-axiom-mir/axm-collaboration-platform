'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');

test('port kit has zero npm dependencies and two distinct reusable profiles', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
  const topDown = JSON.parse(fs.readFileSync(path.join(root, 'profiles', 'top-down-twin-stick.json')));
  const firstPerson = JSON.parse(fs.readFileSync(path.join(root, 'profiles', 'first-person-explore.json')));
  assert.deepEqual(pkg.dependencies, {});
  assert.deepEqual(pkg.devDependencies, {});
  assert.equal(topDown.releaseActions.right, 'fire');
  assert.deepEqual(firstPerson.releaseActions, {});
  assert.equal(firstPerson.vectors.right.xField, 'lookX');
});

test('browser demo loads only bundled local modules and exposes two physical sticks', () => {
  const html = fs.readFileSync(path.join(root, 'examples', 'browser-demo', 'index.html'), 'utf8');
  const demo = fs.readFileSync(path.join(root, 'examples', 'browser-demo', 'demo.mjs'), 'utf8');
  for (const id of ['left-zone', 'left-base', 'left-knob', 'right-zone', 'right-base', 'right-knob']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(demo, /AxmVirtualStick/);
  assert.match(demo, /AxmControllerRuntime/);
  assert.doesNotMatch(`${html}\n${demo}`, /https?:\/\//);
});

test('manifest keeps connected AI separate from optional built-in Host AI', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'BUILD_MANIFEST.json')));
  assert.deepEqual(manifest.controllerKinds, ['human', 'adapter', 'ai']);
  assert.equal(manifest.runtimeDependencies, 0);
  assert.equal(manifest.thirdPartyAssets, 0);
  assert.equal(manifest.githubModified, false);
});

test('dormant physical-controller route changes the hand, not the seat authority', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'BUILD_MANIFEST.json')));
  const route = JSON.parse(fs.readFileSync(path.join(root, 'PHYSICAL_CONTROLLER_ROUTE.json')));
  const bindingSchema = JSON.parse(fs.readFileSync(path.join(root, 'schemas', 'input-source-binding.schema.json')));
  const packetSchema = JSON.parse(fs.readFileSync(path.join(root, 'schemas', 'input-packet.schema.json')));
  assert.deepEqual(manifest.controllerKinds, ['human', 'adapter', 'ai']);
  assert.deepEqual(manifest.inputSources.workingReference, ['phone-touch']);
  assert.equal(route.implemented, false);
  assert.equal(route.coreDecision.gamepadIsControllerType, false);
  assert.equal(route.coreDecision.gamepadIsInputSource, true);
  assert.equal(route.coreDecision.changingInputPreservesSeatIdentity, true);
  assert.equal(route.assignment.gamepadIndexIsPlayerNumber, false);
  assert.equal(route.assignment.partyScreenPollsGamepads, false);
  assert.equal(route.sourceLease.exactlyOneActivePerHumanSeat, true);
  assert.equal(route.sourceLease.rawGamepadIdPersisted, false);
  assert.equal(route.authorityTransitions.connectedAiIsHumanInputSource, false);
  assert.equal(route.disconnect.neutralizeImmediately, true);
  assert.equal(route.disconnect.automaticAiTransfer, false);
  assert.equal(route.truth.hardwareTested, false);
  assert.equal(bindingSchema.title, 'AXM input source binding profile v1');
  assert.deepEqual(packetSchema.dependentRequired.inputSourceBindingId, ['inputSourceEpoch']);
  assert.deepEqual(packetSchema.dependentRequired.inputSourceEpoch, ['inputSourceBindingId']);
});

test('reference host runs the gate, consumes a pulse, and produces an observation', () => {
  const run = spawnSync(process.execPath, [path.join(root, 'examples', 'host', 'reference-host.js')], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  const output = JSON.parse(run.stdout);
  assert.equal(output.accepted.ok, true);
  assert.equal(output.sanitizedInput.claimedHit, undefined);
  assert.equal(output.fireConsumedByHostTick, true);
  assert.equal(output.observation.observationType, 'axm-seat-screen-semantics-v1');
});
