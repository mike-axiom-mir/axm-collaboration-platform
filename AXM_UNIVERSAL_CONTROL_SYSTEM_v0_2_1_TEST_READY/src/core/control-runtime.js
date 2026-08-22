import { ActionRegistry } from './action-registry.js';
import { ActionBus } from './action-bus.js';
import { InputContextStack } from './context-stack.js';
import { InputBehaviorEngine } from './input-behavior.js';
import { validateControlProfile } from './profile.js';

/**
 * Small integration facade for AXM games.
 * Games still consume semantic actions, while this object owns the shared
 * registry, visible contexts, behavior timing, and adapter lifecycle.
 */
export class ControlRuntime {
  constructor({ actionsDocument, profile, initialContext, behaviorOptions = {} }) {
    this.registry = ActionRegistry.fromDocument(actionsDocument);
    const errors = validateControlProfile(profile, this.registry);
    if (errors.length) throw new Error(`Invalid control profile: ${errors.join('; ')}`);
    this.profile = structuredClone(profile);
    this.contexts = new InputContextStack(profile.contexts);
    this.bus = new ActionBus(this.registry, { contexts: this.contexts });
    this.behaviors = new InputBehaviorEngine(this.registry, behaviorOptions);
    this.adapters = new Set();
    this.running = false;
    this.unsubscribeBus = this.bus.subscribe(event => this.behaviors.ingest(event));
    this.contexts.replace(initialContext || profile.contexts[0].id);
  }

  addAdapter(adapter) {
    if (!adapter || typeof adapter.start !== 'function' || typeof adapter.stop !== 'function') {
      throw new Error('Adapter must provide start() and stop()');
    }
    this.adapters.add(adapter);
    if (this.running) adapter.start();
    return this;
  }

  removeAdapter(adapter) {
    if (!this.adapters.has(adapter)) return false;
    adapter.stop();
    this.adapters.delete(adapter);
    return true;
  }

  start() {
    if (this.running) return this;
    this.running = true;
    for (const adapter of this.adapters) adapter.start();
    return this;
  }

  stop() {
    if (!this.running) return this;
    this.running = false;
    for (const adapter of this.adapters) adapter.stop();
    return this;
  }

  setContext(contextId) { return this.contexts.replace(contextId); }
  pushContext(contextId) { return this.contexts.push(contextId); }
  popContext(contextId) { return this.contexts.pop(contextId); }
  get(actionId) { return this.bus.get(actionId); }
  isPressed(actionId) { return this.bus.isPressed(actionId); }
  snapshot() { return this.bus.snapshot(); }
  onAction(listener) { return this.bus.subscribe(listener); }
  onBehavior(listener) { return this.behaviors.subscribe(listener); }
  tick(now) { return this.behaviors.tick(now); }

  destroy() {
    this.stop();
    this.unsubscribeBus?.();
    this.bus.destroy();
    this.behaviors.reset();
    this.adapters.clear();
  }
}
