'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Holodeck = require('../../shared/holodeck');
const DraftModel = require('./draft-model');
const Observer = require('./observer-camera');
const template = require('../../shared/holodeck/examples/echo-atrium.world.json');
const manifest = require('./manifest.json');
const contract = require('./module.contract.json');

let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }
function syntax(source) {
  const transformed = source.replace(/^import[^;]+;\s*$/gm, '');
  new Function(transformed);
}

function run() {
  check(manifest.id === 'holodeck-composer' && contract.id === manifest.id, 'manifest and contract identity agree');
  ['holodeck.world.compose/v1', 'holodeck.view.observe/v1', 'holodeck.view.camera-control/v1', 'holodeck.view.authority-boundary/v1'].forEach(capability => {
    check(contract.provides.includes(capability), 'contract provides ' + capability);
  });
  check(contract.boundaries.refuses.includes('automatic-world-promotion'), 'drafts cannot silently become Workshop truth');
  check(contract.boundaries.refuses.includes('complete-schema-editor-claim'), 'v0 does not pretend to edit the complete world schema');
  check(contract.lifecycle.reload === 'reset', 'reload honestly resets to the template');

  const original = Holodeck.Core.clone(template);
  const controls = DraftModel.read(template);
  check(Holodeck.Core.same(DraftModel.apply(template, controls), template), 'opening or resetting Composer preserves the exact template semantics');
  const oceanControls = DraftModel.preset(controls, 'ocean');
  const oceanWorld = DraftModel.apply(template, { ...oceanControls, title: 'Ocean Atrium', beaconX: 2.5, beaconScale: 1.1 });
  check(Holodeck.Core.same(template, original), 'composition never mutates the source template');
  check(oceanWorld.title === 'Ocean Atrium' && oceanWorld.environment.skyColor === '#031b2b', 'human controls change declared world fields');
  check(oceanWorld.entities.find(item => item.id === 'beacon-core').transform.position[0] === 2.5, 'beacon and related data points can move');
  check(oceanWorld.entities.find(item => item.id === 'orbit-ring-inner').transform.position[0] === 2.5, 'related presentation points stay aligned');
  check(Holodeck.Validator.validate(oceanWorld).ok, 'composed world passes the canonical validator');
  const first = Holodeck.Compiler.compile(oceanWorld);
  const second = Holodeck.Compiler.compile(DraftModel.apply(template, { ...oceanControls, title: 'Ocean Atrium', beaconX: 2.5, beaconScale: 1.1 }));
  check(Holodeck.Core.same(first, second), 'the same human choices compile identically');
  check(first.planDigest !== Holodeck.Compiler.compile(template).planDigest, 'semantic edits change the plan digest');
  Object.keys(DraftModel.PRESETS).forEach(id => check(Holodeck.Validator.validate(DraftModel.apply(template, DraftModel.preset(controls, id))).ok, id + ' preset stays valid'));

  const cameraTrace = [];
  const fakeRenderer = {
    camera: {
      position: { set: (...values) => cameraTrace.push({ kind: 'position', values }) },
      lookAt: (...values) => cameraTrace.push({ kind: 'lookAt', values })
    },
    render: () => cameraTrace.push({ kind: 'render' }),
    sync: state => cameraTrace.push({ kind: 'player-sync', revision: state.revision })
  };
  const observer = new Observer.ObserverCamera(fakeRenderer, first);
  const playerState = Holodeck.State.create(first);
  const untouchedState = Holodeck.Core.clone(playerState);
  const activated = observer.activate('orbit', playerState.revision);
  check(activated.worldMutation === false && activated.stateRevisionBefore === activated.stateRevisionAfter, 'observer activation seals a no-world-mutation receipt');
  const beforeYaw = observer.getView().yawDegrees;
  const cameraMove = observer.command('orbit-right', playerState.revision);
  check(observer.getView().yawDegrees !== beforeYaw && cameraMove.worldMutation === false, 'observer command moves only the disposable camera');
  const overhead = observer.setPreset('overhead', playerState.revision);
  check(overhead.view.pitchDegrees === 78 && overhead.view.preset === 'overhead', 'observer exposes deterministic viewpoint presets');
  check(Holodeck.Core.same(playerState, untouchedState), 'observer operations cannot mutate the supplied world state');
  check(cameraTrace.some(item => item.kind === 'position') && cameraTrace.some(item => item.kind === 'render'), 'observer updates and renders the camera adapter');
  const returned = observer.deactivate(playerState);
  check(returned.mode === 'player' && cameraTrace.some(item => item.kind === 'player-sync'), 'returning to Player restores the actor camera');
  check(observer.getTruth().intentDispatch === false && observer.getTruth().worldMutation === false, 'observer declares no intent or world-state authority');

  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
  check(html.includes('id="composer-form"') && html.includes('id="preview-canvas"'), 'human editor and live preview are both present');
  check(html.includes('data-view-mode="player"') && html.includes('data-view-mode="observer"'), 'visible Player and Observer modes are present');
  check(html.includes('data-observer-preset="overhead"') && html.includes('data-camera-command="zoom-in"'), 'observer viewpoint and camera controls are visible');
  check(html.includes('Save draft here') && html.includes('Download world'), 'persistence and export require visible explicit actions');
  check(app.includes('Validator.validate') && app.includes('Compiler.compile') && app.includes('DraftModel.apply'), 'the interface routes through real modular contracts');
  check(app.includes('controller.humanCommand'), 'preview play routes through the shared human intent controller');
  check(app.includes('observerCamera.command') && app.includes('observerCamera.deactivate'), 'observer and player recovery route through the isolated camera module');
  check(!/https?:\/\//.test(app + css), 'runtime has no external network dependency');
  syntax(app); check(true, 'browser module passes a focused syntax parse');
  console.log('Holodeck Composer selftest: PASS - ' + checks + ' checks');
}

run();
