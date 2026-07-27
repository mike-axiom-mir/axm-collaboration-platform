import { ScreenDeckController } from './deck-controller.js';

var Core = window.AXMHolodeckCore;
var Validator = window.AXMHolodeckWorldValidator;
var Compiler = window.AXMHolodeckWorldCompiler;
var controller = null;
var toastTimer = null;
var MACHINE_ACTOR = { id: 'screen-deck-ai', kind: 'machine', name: 'Screen Deck AI' };

function element(id) { return document.getElementById(id); }

function toast(message, error) {
  var node = element('toast');
  node.textContent = message;
  node.classList.toggle('error', !!error);
  node.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(function () { node.classList.remove('show'); }, 2400);
}

function nearbyAction(frame) {
  for (var index = 0; index < frame.nearby.length; index += 1) {
    if (frame.nearby[index].availableActions.length) return { entity: frame.nearby[index], action: frame.nearby[index].availableActions[0] };
  }
  return null;
}

function renderUpdate(update) {
  var state = update.state;
  var frame = update.frame;
  var complete = frame.objective.status.complete;
  var prompt = nearbyAction(frame);
  element('revision').textContent = state.revision;
  element('position-readout').textContent = 'POS ' + state.player.position[0].toFixed(1) + ' / ' + state.player.position[2].toFixed(1) + ' · HEAD ' + String(Math.round(state.player.headingDegrees)).padStart(3, '0') + '°';
  element('deck-status').textContent = complete ? 'GATE OPEN' : 'READY';
  element('deck-status').parentElement.classList.add('ready');
  element('objective').textContent = complete ? frame.objective.status.message : frame.objective.text;
  element('interaction-prompt').textContent = prompt ? 'Press E · ' + prompt.action.label : frame.message;
  element('interaction-prompt').classList.toggle('ready', !!prompt);
  element('sensor-summary').textContent = frame.nearby.length + ' nearby entities · tick ' + frame.tick + ' · ' + (complete ? 'objective complete' : 'objective open') + ' · structured state, not camera pixels';
  element('sensor-json').textContent = JSON.stringify(frame, null, 2);
  if (update.receipt) {
    var human = update.receipt.actor.kind === 'human' ? 'Human' : update.receipt.actor.kind === 'machine' ? 'Machine' : 'Service';
    document.documentElement.dataset.lastActorKind = update.receipt.actor.kind;
    element('last-actor').textContent = human + ' · ' + update.receipt.kind + ' · revision ' + update.receipt.revision;
    toast(human + ' intent ' + update.receipt.status.toLowerCase().replace(/_/g, ' ') + ' · revision ' + update.receipt.revision, update.receipt.status.indexOf('REFUSED') === 0);
  }
}

function command(name) {
  if (!controller) return;
  try { controller.humanCommand(name); }
  catch (error) { toast(error.message, true); }
}

function bindControls() {
  document.querySelectorAll('[data-command]').forEach(function (button) {
    button.addEventListener('click', function () { command(button.dataset.command); element('deck-canvas').focus(); });
  });
  element('machine-step').addEventListener('click', function () {
    try {
      var state = controller.getState();
      var sequence = Number(state.actorSequences[MACHINE_ACTOR.id] || 0) + 1;
      controller.dispatch({
        schema: window.AXMHolodeckIntentDispatcher.INTENT_SCHEMA,
        actor: MACHINE_ACTOR,
        sequence: sequence,
        kind: 'TURN',
        payload: { degrees: 15 }
      });
      element('deck-canvas').focus();
    } catch (error) { toast(error.message, true); }
  });
  window.addEventListener('keydown', function (event) {
    if (!controller || ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(event.target.tagName) >= 0) return;
    var routes = { KeyW:'forward', KeyS:'back', KeyA:'strafe-left', KeyD:'strafe-right', ArrowLeft:'turn-left', ArrowRight:'turn-right', KeyE:'interact' };
    if (!routes[event.code] || event.repeat) return;
    event.preventDefault();
    command(routes[event.code]);
  });
  element('save-state').addEventListener('click', function () {
    try {
      var snapshot = controller.save();
      element('save-status').textContent = 'Saved revision ' + snapshot.revision + ' · ' + snapshot.snapshotDigest.slice(0, 12);
      element('save-status').className = 'ok';
      toast('Explicit local snapshot saved.');
    } catch (error) {
      element('save-status').textContent = error.message;
      element('save-status').className = 'error';
      toast(error.message, true);
    }
  });
  element('restore-state').addEventListener('click', function () {
    try {
      var state = controller.restore();
      element('save-status').textContent = 'Restored explicit snapshot at revision ' + state.revision + '.';
      element('save-status').className = 'ok';
      toast('Explicit local snapshot restored.');
    } catch (error) {
      element('save-status').textContent = error.message;
      element('save-status').className = 'error';
      toast(error.message, true);
    }
  });
  element('reset-state').addEventListener('click', function () {
    var state = controller.reset();
    element('save-status').textContent = 'Deck reset to compiled initial state at revision ' + state.revision + '. Saved snapshot was not deleted.';
    element('save-status').className = '';
    toast('Local deck state reset.');
  });
}

async function start() {
  try {
    element('loading-detail').textContent = 'Loading Echo Atrium world data…';
    var response = await fetch('../../shared/holodeck/examples/echo-atrium.world.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('World data request failed with ' + response.status + '.');
    var world = await response.json();
    var validation = Validator.validate(world);
    if (!validation.ok) throw new Error('World validation failed: ' + validation.errors.join('; '));
    element('loading-detail').textContent = 'Compiling renderer-neutral deck plan…';
    var plan = Compiler.compile(world);
    controller = new ScreenDeckController(plan, element('deck-canvas'), renderUpdate);
    element('world-version').textContent = world.version + ' · ' + world.schema;
    element('world-title').textContent = plan.worldTitle;
    element('world-description').textContent = plan.worldDescription;
    element('entity-count').textContent = plan.nodes.length;
    element('action-count').textContent = plan.interactions.length;
    element('plan-digest').textContent = plan.planDigest.slice(0, 8);
    element('objective').textContent = plan.narrative.objective;
    bindControls();
    var initial = { state: controller.getState(), frame: controller.observe(), receipt: null, renderer: controller.renderer.metrics() };
    renderUpdate(initial);
    element('loading').hidden = true;
    element('deck-canvas').focus();
    element('save-status').textContent = controller.hasSnapshot() ? 'An explicit snapshot exists. It will not restore until requested.' : 'Nothing is saved or restored automatically.';
    window.AXMHolodeckDeck = Object.freeze({
      version: '0.1.0',
      getPlan: function () { return controller.getPlan(); },
      getState: function () { return controller.getState(); },
      observe: function (actor) { return controller.observe(actor); },
      dispatch: function (intent) { return controller.dispatch(Core.clone(intent)); },
      truth: Object.freeze({ screenSimulation: true, vr: false, hologramHardware: false, physicalManipulator: false, extraMachineAuthority: false })
    });
    document.documentElement.dataset.deckApi = 'ready';
  } catch (error) {
    element('loading-detail').textContent = error.message;
    element('deck-status').textContent = 'FAILED';
    element('deck-status').parentElement.classList.add('error');
    console.error(error);
  }
}

start();
