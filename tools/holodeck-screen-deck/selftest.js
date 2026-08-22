'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Holodeck = require('../../shared/holodeck');
const world = require('../../shared/holodeck/examples/echo-atrium.world.json');
const manifest = require('./manifest.json');
const contract = require('./module.contract.json');
const registry = require('../../shared/holodeck/machine-contracts.json');

let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }
function syntax(source) {
  const transformed = source.replace(/^import[^;]+;\s*$/gm, '').replace(/export\s+class\s+/g, 'class ');
  new Function(transformed);
}

function run() {
  const expected = [
    'holodeck.world.validate/v1', 'holodeck.world.compile/v1', 'holodeck.intent.dispatch/v1',
    'holodeck.sensor.observe/v1', 'holodeck.state.snapshot/v1', 'holodeck.adapter.screen/v1',
    'holodeck.experience.echo-atrium/v1'
  ];
  check(manifest.id === 'holodeck-screen-deck' && contract.id === manifest.id, 'manifest and contract identity agree');
  expected.forEach(capability => check(contract.provides.includes(capability), 'contract provides ' + capability));
  check(registry.machines.length === 10, 'kernel and adapter stay split into ten bounded machines');
  check(contract.boundaries.refuses.includes('actor-kind-as-extra-permission'), 'machine actors receive no hidden authority');
  check(contract.boundaries.refuses.includes('hologram-hardware-claim'), 'screen adapter refuses a hologram hardware claim');
  check(contract.lifecycle.reload === 'reset' && contract.lifecycle.cleanup === 'explicit', 'reload resets and cleanup remains explicit');

  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(__dirname, 'screen-renderer.js'), 'utf8');
  const controller = fs.readFileSync(path.join(__dirname, 'deck-controller.js'), 'utf8');
  check(html.indexOf('core.js') < html.indexOf('world-validator.js') && html.indexOf('persistence.js') < html.indexOf('app.js'), 'browser dependencies load in declared order');
  check(html.includes('SCREEN SIMULATION') && html.includes('No VR or hologram claim'), 'visible UI states the current substrate boundary');
  check(app.includes('window.AXMHolodeckDeck') && app.includes('dispatch: function'), 'machine-facing observation and intent API is exposed');
  check(app.includes('captureProof: function') && app.includes("dataset.courierCapture = captureContext ? 'ready' : 'inactive'"), 'courier capture exposes a state-bound readiness proof');
  check(app.includes("query.get('mode') !== 'courier-capture'") && app.includes("query.get('state')"), 'capture intake is restricted to one explicit local query mode');
  check(controller.includes('loadExternalState(state)') && controller.includes('State.verify(this.plan, state)'), 'external capture state must pass the canonical Holodeck verifier');
  check(html.includes('id="machine-step"') && app.includes("kind: 'machine'") && app.includes("kind: 'TURN'"), 'visible machine probe uses the shared typed intent path');
  check(!renderer.includes('requestAnimationFrame'), 'static world renders only on state or viewport changes');
  check(!/https?:\/\//.test(app + renderer + controller), 'runtime has no external network dependency');
  check(fs.existsSync(path.join(__dirname, '..', '..', 'shared', 'vendor', 'three-r160', 'three.module.js')), 'screen renderer uses the shared local Three.js substrate');
  syntax(app); syntax(renderer); syntax(controller);
  check(true, 'browser modules pass a focused syntax parse');

  const plan = Holodeck.Compiler.compile(world);
  check(plan.nodes.length === 10 && plan.interactions.length === 1, 'screen plan compiles the complete bounded experience');
  check(plan.adapterContract === 'axm.holodeck-render-adapter/v1', 'renderer consumes the replaceable adapter contract');
  console.log('Holodeck Screen Deck selftest: PASS - ' + checks + ' checks');
}

run();
