import { ScreenDeckRenderer } from './screen-renderer.js';

var Core = window.AXMHolodeckCore;
var State = window.AXMHolodeckStateMachine;
var Intents = window.AXMHolodeckIntentDispatcher;
var Sensor = window.AXMHolodeckSensorFrame;
var Persistence = window.AXMHolodeckPersistence;

var HUMAN_ACTOR = { id: 'screen-pilot', kind: 'human', name: 'Screen pilot' };

export class ScreenDeckController {
  constructor(plan, canvas, onChange) {
    this.plan = plan;
    this.state = State.create(plan);
    this.renderer = new ScreenDeckRenderer(canvas, plan);
    this.renderer.sync(this.state);
    this.onChange = typeof onChange === 'function' ? onChange : function () {};
    this.storageKey = 'axm.holodeck.snapshot.v1:' + plan.worldId + ':' + plan.worldDigest;
  }

  _humanIntent(kind, payload) {
    var sequence = Number(this.state.actorSequences[HUMAN_ACTOR.id] || 0) + 1;
    return { schema: Intents.INTENT_SCHEMA, actor: HUMAN_ACTOR, sequence: sequence, kind: kind, payload: payload || {} };
  }

  humanCommand(command) {
    var routes = {
      'forward': ['MOVE', { forward: 1, meters: 0.8 }],
      'back': ['MOVE', { forward: -1, meters: 0.8 }],
      'strafe-left': ['MOVE', { strafe: -1, meters: 0.8 }],
      'strafe-right': ['MOVE', { strafe: 1, meters: 0.8 }],
      'turn-left': ['TURN', { degrees: -15 }],
      'turn-right': ['TURN', { degrees: 15 }],
      'interact': ['INTERACT', {}]
    };
    var route = routes[command];
    if (!route) throw new Error('Unknown Screen Deck command: ' + command);
    return this.dispatch(this._humanIntent(route[0], route[1]));
  }

  dispatch(intent) {
    var result = Intents.dispatch(this.plan, this.state, intent);
    this.state = result.state;
    this.renderer.sync(this.state);
    var observation = this.observe({ id: intent.actor.id, kind: intent.actor.kind, name: intent.actor.name });
    this.onChange({ state: this.getState(), frame: observation, receipt: Core.clone(result.receipt), renderer: this.renderer.metrics() });
    return { state: this.getState(), frame: observation, receipt: Core.clone(result.receipt) };
  }

  observe(actor) {
    return Sensor.observe(this.plan, this.state, actor || { id: 'screen-observer', kind: 'machine', name: 'Screen observer' });
  }

  save() {
    var snapshot = Persistence.create(this.plan, this.state, 'Explicit Screen Deck snapshot');
    window.localStorage.setItem(this.storageKey, JSON.stringify(snapshot));
    return Core.clone(snapshot);
  }

  restore() {
    var raw = window.localStorage.getItem(this.storageKey);
    if (!raw) throw new Error('No explicit snapshot exists for this world version.');
    this.state = Persistence.restore(this.plan, JSON.parse(raw));
    this.renderer.sync(this.state);
    var observation = this.observe();
    this.onChange({ state: this.getState(), frame: observation, receipt: null, renderer: this.renderer.metrics() });
    return this.getState();
  }

  reset() {
    this.state = State.create(this.plan);
    this.renderer.sync(this.state);
    var observation = this.observe();
    this.onChange({ state: this.getState(), frame: observation, receipt: null, renderer: this.renderer.metrics() });
    return this.getState();
  }

  hasSnapshot() { return window.localStorage.getItem(this.storageKey) != null; }
  getPlan() { return Core.clone(this.plan); }
  getState() { return Core.clone(this.state); }
  destroy() { this.renderer.destroy(); }
}
