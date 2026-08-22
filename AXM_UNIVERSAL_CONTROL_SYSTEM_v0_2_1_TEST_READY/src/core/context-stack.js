export class InputContextStack {
  constructor(contexts = []) {
    this.contexts = new Map();
    this.stack = [];
    this.listeners = new Set();
    for (const context of contexts) this.define(context);
  }

  define(context) {
    if (!context?.id) throw new Error('Context id is required');
    if (!context.visibleLabel) throw new Error(`Context ${context.id} requires a visibleLabel`);
    this.contexts.set(context.id, structuredClone(context));
    return this;
  }

  push(id) {
    if (!this.contexts.has(id)) throw new Error(`Unknown context: ${id}`);
    this.stack = this.stack.filter(existing => existing !== id);
    this.stack.push(id);
    this.#emit();
    return this.current();
  }

  pop(id) {
    if (id) this.stack = this.stack.filter(existing => existing !== id);
    else this.stack.pop();
    this.#emit();
    return this.current();
  }

  replace(id) {
    if (!this.contexts.has(id)) throw new Error(`Unknown context: ${id}`);
    this.stack = [id];
    this.#emit();
    return this.current();
  }

  current() {
    const id = this.stack.at(-1);
    return id ? structuredClone(this.contexts.get(id)) : null;
  }

  currentLabel() { return this.current()?.visibleLabel || 'Default controls'; }

  resolve(actionId) {
    const current = this.current();
    if (!current) return actionId;
    if (Array.isArray(current.allowedActions) && !current.allowedActions.includes(actionId) && !current.remap?.[actionId]) return null;
    return current.remap?.[actionId] || actionId;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.current());
    return () => this.listeners.delete(listener);
  }

  #emit() {
    const snapshot = this.current();
    for (const listener of this.listeners) listener(snapshot);
  }
}
