import { ScreenDeckController } from '../holodeck-screen-deck/deck-controller.js';

var Core = window.AXMHolodeckCore;
var Validator = window.AXMHolodeckWorldValidator;
var Compiler = window.AXMHolodeckWorldCompiler;
var DraftModel = window.AXMHolodeckDraftModel;
var ObserverCamera = window.AXMHolodeckObserverCamera.ObserverCamera;
var TEMPLATE_URL = '../../shared/holodeck/examples/echo-atrium.world.json';
var STORAGE_KEY = 'axm.holodeck.composer.draft.v1:echo-atrium';
var templateWorld = null;
var draftWorld = null;
var controller = null;
var observerCamera = null;
var viewMode = 'player';
var observerPreset = 'orbit';
var compileTimer = null;
var toastTimer = null;

function element(id) { return document.getElementById(id); }
function numeric(id) { return Number(element(id).value); }

function toast(message, error) {
  var node = element('toast');
  node.textContent = message;
  node.classList.toggle('error', !!error);
  node.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(function () { node.classList.remove('show'); }, 2200);
}

function controls() {
  return {
    title: element('world-title').value,
    objective: element('world-objective').value,
    skyColor: element('sky-color').value,
    groundColor: element('ground-color').value,
    beaconColor: element('beacon-color').value,
    beaconActiveColor: element('beacon-active-color').value,
    accentColor: element('accent-color').value,
    gateColor: element('gate-color').value,
    beaconScale: numeric('beacon-scale'),
    beaconX: numeric('beacon-x'),
    spawnDistance: numeric('spawn-distance'),
    fogFar: numeric('fog-far')
  };
}

function setControlValues(values) {
  element('world-title').value = values.title;
  element('world-objective').value = values.objective;
  element('sky-color').value = values.skyColor;
  element('ground-color').value = values.groundColor;
  element('beacon-color').value = values.beaconColor;
  element('beacon-active-color').value = values.beaconActiveColor;
  element('accent-color').value = values.accentColor;
  element('gate-color').value = values.gateColor;
  element('beacon-scale').value = values.beaconScale;
  element('beacon-x').value = values.beaconX;
  element('spawn-distance').value = values.spawnDistance;
  element('fog-far').value = values.fogFar;
  refreshReadouts();
}

function refreshReadouts() {
  document.querySelectorAll('[data-color-output]').forEach(function (output) {
    output.textContent = element(output.dataset.colorOutput).value.toUpperCase();
  });
  element('beacon-scale-value').textContent = numeric('beacon-scale').toFixed(2) + '×';
  element('beacon-x-value').textContent = numeric('beacon-x').toFixed(2) + ' m';
  element('spawn-distance-value').textContent = numeric('spawn-distance').toFixed(1) + ' m';
  element('fog-far-value').textContent = numeric('fog-far').toFixed(0) + ' m';
}

function updatePlayState(update) {
  var complete = update.frame.objective.status.complete;
  element('preview-revision').textContent = 'REV ' + update.state.revision;
  element('player-position').textContent = 'POS ' + update.state.player.position[0].toFixed(1) + ' / ' + update.state.player.position[2].toFixed(1);
  element('stage-state').textContent = complete ? 'GATE OPEN' : 'READY';
  element('preview-objective').textContent = complete ? update.frame.objective.status.message : update.frame.objective.text;
  var action = null;
  update.frame.nearby.some(function (nearby) {
    if (!nearby.availableActions.length) return false;
    action = nearby.availableActions[0];
    return true;
  });
  element('world-message').textContent = action ? 'Press E · ' + action.label : update.frame.message;
}

function renderObserverStatus(receipt) {
  var state = controller.getState();
  var view = observerCamera.getView();
  element('stage-state').textContent = 'OBSERVING';
  element('world-message').textContent = 'Camera only · world revision ' + state.revision + ' unchanged';
  element('player-position').textContent = 'CAM ' + Math.round(view.yawDegrees) + '° / ' + view.distanceMeters.toFixed(0) + ' m';
  element('preview-revision').textContent = 'REV ' + state.revision;
  document.documentElement.dataset.observerRevision = String(state.revision);
  document.documentElement.dataset.cameraReceipt = receipt ? receipt.receiptDigest : '';
}

function renderViewMode() {
  var observing = viewMode === 'observer';
  document.querySelectorAll('[data-view-mode]').forEach(function (button) { button.classList.toggle('selected', button.dataset.viewMode === viewMode); });
  element('player-copy').hidden = observing;
  element('player-controls').hidden = observing;
  element('observer-copy').hidden = !observing;
  element('observer-controls').hidden = !observing;
  element('preview-canvas').parentElement.classList.toggle('observing', observing);
  document.documentElement.dataset.viewMode = viewMode;
}

function switchViewMode(nextMode) {
  if (!controller || !observerCamera || nextMode === viewMode) return;
  if (nextMode === 'observer') {
    viewMode = 'observer';
    var receipt = observerCamera.activate(observerPreset, controller.getState().revision);
    renderViewMode();
    renderObserverStatus(receipt);
    toast('Observer mode: camera authority only.');
    return;
  }
  viewMode = 'player';
  observerCamera.deactivate(controller.getState());
  renderViewMode();
  updatePlayState({ state: controller.getState(), frame: controller.observe(), receipt: null });
  toast('Player mode restored at the same world revision.');
}

function observerCommand(command) {
  if (!observerCamera || viewMode !== 'observer') return;
  try { renderObserverStatus(observerCamera.command(command, controller.getState().revision)); }
  catch (error) { toast(error.message, true); }
}

function setObserverPreset(name) {
  if (!observerCamera || viewMode !== 'observer') return;
  try {
    observerPreset = name;
    document.querySelectorAll('[data-observer-preset]').forEach(function (button) { button.classList.toggle('selected', button.dataset.observerPreset === name); });
    renderObserverStatus(observerCamera.setPreset(name, controller.getState().revision));
  } catch (error) { toast(error.message, true); }
}

function compileDraft() {
  try {
    refreshReadouts();
    draftWorld = DraftModel.apply(templateWorld, controls());
    var validation = Validator.validate(draftWorld);
    if (!validation.ok) throw new Error(validation.errors.join('; '));
    var plan = Compiler.compile(draftWorld);
    if (controller) controller.destroy();
    controller = new ScreenDeckController(plan, element('preview-canvas'), updatePlayState);
    observerCamera = new ObserverCamera(controller.renderer, plan);
    updatePlayState({ state: controller.getState(), frame: controller.observe(), receipt: null });
    if (viewMode === 'observer') renderObserverStatus(observerCamera.activate(observerPreset, controller.getState().revision));
    renderViewMode();
    element('preview-title').textContent = plan.worldTitle;
    element('plan-digest').textContent = plan.planDigest.slice(0, 12);
    element('node-count').textContent = plan.nodes.length;
    element('rule-count').textContent = plan.interactions.length;
    element('compile-status').textContent = 'COMPILED';
    element('compile-status').parentElement.classList.remove('failed');
    element('loading').hidden = true;
    document.documentElement.dataset.composerReady = 'true';
    document.documentElement.dataset.planDigest = plan.planDigest;
  } catch (error) {
    element('compile-status').textContent = 'NEEDS FIX';
    element('compile-status').parentElement.classList.add('failed');
    element('world-message').textContent = error.message;
    toast(error.message, true);
  }
}

function scheduleCompile() {
  refreshReadouts();
  window.clearTimeout(compileTimer);
  compileTimer = window.setTimeout(compileDraft, 90);
}

function applyPreset(id) {
  setControlValues(DraftModel.preset(controls(), id));
  document.querySelectorAll('[data-preset]').forEach(function (button) { button.classList.toggle('selected', button.dataset.preset === id); });
  compileDraft();
  toast(DraftModel.PRESETS[id].label + ' applied to the draft.');
}

function saveDraft() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draftWorld));
    element('draft-status').textContent = 'Saved this draft explicitly · ' + element('plan-digest').textContent;
    element('draft-status').className = 'saved';
    toast('Draft saved on this device.');
  } catch (error) { toast(error.message, true); }
}

function loadDraft() {
  try {
    var raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('No saved Composer draft exists yet.');
    var candidate = JSON.parse(raw);
    var validation = Validator.validate(candidate);
    if (!validation.ok) throw new Error('Saved draft is invalid: ' + validation.errors.join('; '));
    setControlValues(DraftModel.read(candidate));
    compileDraft();
    element('draft-status').textContent = 'Loaded the explicitly saved draft.';
    element('draft-status').className = 'saved';
    toast('Saved draft loaded.');
  } catch (error) { toast(error.message, true); }
}

function downloadWorld() {
  try {
    var blob = new Blob([JSON.stringify(draftWorld, null, 2) + '\n'], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = (draftWorld.id || 'holodeck-world') + '.world.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast('World draft downloaded.');
  } catch (error) { toast(error.message, true); }
}

function bind() {
  element('composer-form').addEventListener('input', scheduleCompile);
  document.querySelectorAll('[data-preset]').forEach(function (button) {
    button.addEventListener('click', function () { applyPreset(button.dataset.preset); });
  });
  document.querySelectorAll('[data-command]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (!controller) return;
      if (viewMode !== 'player') { toast('Switch to Player to change world history.'); return; }
      try { controller.humanCommand(button.dataset.command); element('preview-canvas').focus(); }
      catch (error) { toast(error.message, true); }
    });
  });
  document.querySelectorAll('[data-view-mode]').forEach(function (button) {
    button.addEventListener('click', function () { switchViewMode(button.dataset.viewMode); });
  });
  document.querySelectorAll('[data-camera-command]').forEach(function (button) {
    button.addEventListener('click', function () { observerCommand(button.dataset.cameraCommand); });
  });
  document.querySelectorAll('[data-observer-preset]').forEach(function (button) {
    button.addEventListener('click', function () { setObserverPreset(button.dataset.observerPreset); });
  });
  element('reset-template').addEventListener('click', function () {
    setControlValues(DraftModel.read(templateWorld));
    document.querySelectorAll('[data-preset]').forEach(function (button) { button.classList.toggle('selected', button.dataset.preset === 'echo'); });
    compileDraft();
    element('draft-status').textContent = 'Template restored. Saved draft was not deleted.';
    element('draft-status').className = '';
    toast('Echo template restored.');
  });
  element('save-draft').addEventListener('click', saveDraft);
  element('load-draft').addEventListener('click', loadDraft);
  element('download-world').addEventListener('click', downloadWorld);
  window.addEventListener('beforeunload', function () { if (controller) controller.destroy(); });
}

async function start() {
  try {
    var response = await fetch(TEMPLATE_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('Echo Atrium template request failed with ' + response.status + '.');
    templateWorld = await response.json();
    var validation = Validator.validate(templateWorld);
    if (!validation.ok) throw new Error('Template is invalid: ' + validation.errors.join('; '));
    setControlValues(DraftModel.read(templateWorld));
    bind();
    compileDraft();
    element('draft-status').textContent = window.localStorage.getItem(STORAGE_KEY) ? 'A saved draft exists. It will load only when you request it.' : 'Edits are temporary until you explicitly save or download.';
  } catch (error) {
    element('compile-status').textContent = 'FAILED';
    element('world-message').textContent = error.message;
    element('loading').innerHTML = '<strong>' + error.message + '</strong>';
    console.error(error);
  }
}

start();
