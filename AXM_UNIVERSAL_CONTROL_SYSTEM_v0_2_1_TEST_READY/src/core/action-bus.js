import { neutralValue, sanitizeValue, valuesEqual } from './normalization.js';

function magnitude(value) {
  if (value && typeof value === 'object') return Math.hypot(value.x || 0, value.y || 0);
  return Math.abs(Number(value) || 0);
}

/**
 * Shared semantic action bus.
 *
 * v0.2 keeps each source's RAW semantic actions and resolves them through the
 * active context at read/arbitration time. This matters when a context changes
 * while a control is held: MOVE can become NAVIGATE immediately, and the old
 * MOVE state is released rather than becoming stuck.
 */
export class ActionBus {
  constructor(registry, options = {}) {
    this.registry = registry;
    this.contexts = options.contexts || null;
    this.sources = new Map(); // sourceId -> raw action id -> entry
    this.state = new Map();
    this.listeners = new Set();
    this.sequence = 0;
    this.contextUnsubscribe = this.contexts?.subscribe?.(() => this.#recomputeAll()) || null;
  }

  setSourceAction(sourceId, actionId, value, meta = {}) {
    if (!sourceId) throw new Error('sourceId is required');
    if (!this.registry.has(actionId)) throw new Error(`Unknown action: ${actionId}`);
    if (!this.sources.has(sourceId)) this.sources.set(sourceId, new Map());
    const definition = this.registry.get(actionId);
    this.sources.get(sourceId).set(actionId, {
      value: sanitizeValue(definition, value),
      priority: Number.isFinite(meta.priority) ? meta.priority : 0,
      timestamp: Number.isFinite(meta.timestamp) ? meta.timestamp : Date.now(),
      deviceType: meta.deviceType || 'unknown'
    });
    this.#recomputeAll();
  }

  applyFrame(sourceId, frame, meta = {}) {
    if (!sourceId) throw new Error('sourceId is required');
    if (!frame || !Array.isArray(frame.actions)) throw new Error('Input frame requires an actions array');
    if (!this.sources.has(sourceId)) this.sources.set(sourceId, new Map());
    const source = this.sources.get(sourceId);
    const rawSeen = new Set();
    const timestamp = frame.clientSentAt || frame.timestamp || Date.now();

    for (const action of frame.actions) {
      if (!this.registry.has(action.id)) continue;
      rawSeen.add(action.id);
      const definition = this.registry.get(action.id);
      source.set(action.id, {
        value: sanitizeValue(definition, action.value),
        priority: Number.isFinite(meta.priority) ? meta.priority : 0,
        timestamp,
        deviceType: meta.deviceType || 'unknown'
      });
    }

    if (frame.fullState) {
      for (const existingId of [...source.keys()]) {
        if (!rawSeen.has(existingId)) source.delete(existingId);
      }
    }
    this.#recomputeAll();
  }

  releaseSource(sourceId) {
    if (!this.sources.delete(sourceId)) return;
    this.#recomputeAll();
  }

  clear() {
    if (!this.sources.size) return;
    this.sources.clear();
    this.#recomputeAll();
  }

  destroy() {
    this.clear();
    this.contextUnsubscribe?.();
    this.contextUnsubscribe = null;
    this.listeners.clear();
  }

  get(actionId) {
    if (!this.registry.has(actionId)) throw new Error(`Unknown action: ${actionId}`);
    return structuredClone(this.state.get(actionId)?.value ?? neutralValue(this.registry.get(actionId).type));
  }

  isPressed(actionId) { return magnitude(this.get(actionId)) > 0.5; }

  snapshot() {
    const output = {};
    for (const definition of this.registry.list()) output[definition.id] = this.get(definition.id);
    return output;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  #recomputeAll() {
    for (const definition of this.registry.list()) this.#recompute(definition.id);
  }

  #recompute(actionId) {
    const definition = this.registry.get(actionId);
    const candidates = [];

    for (const [sourceId, source] of this.sources.entries()) {
      for (const [rawActionId, entry] of source.entries()) {
        const resolvedId = this.contexts ? this.contexts.resolve(rawActionId) : rawActionId;
        if (resolvedId !== actionId) continue;
        candidates.push({
          sourceId,
          ...entry,
          value: sanitizeValue(definition, entry.value)
        });
      }
    }

    candidates.sort((a, b) => b.priority - a.priority || magnitude(b.value) - magnitude(a.value) || b.timestamp - a.timestamp);
    let value = neutralValue(definition.type);
    let sourceId = null;

    if (definition.type === 'digital') {
      const active = candidates.find(candidate => Boolean(candidate.value));
      if (active) { value = 1; sourceId = active.sourceId; }
    } else {
      const activeCandidates = candidates.filter(candidate => magnitude(candidate.value) > 0.0005);
      if (activeCandidates.length) {
        activeCandidates.sort((a, b) => b.priority - a.priority || magnitude(b.value) - magnitude(a.value) || b.timestamp - a.timestamp);
        value = activeCandidates[0].value;
        sourceId = activeCandidates[0].sourceId;
      }
    }

    const previous = this.state.get(actionId) || { value: neutralValue(definition.type), sourceId: null };
    if (valuesEqual(previous.value, value) && previous.sourceId === sourceId) return;

    this.sequence += 1;
    const event = {
      sequence: this.sequence,
      id: actionId,
      value: structuredClone(value),
      previous: structuredClone(previous.value),
      sourceId,
      previousSourceId: previous.sourceId,
      timestamp: Date.now(),
      phase: magnitude(previous.value) === 0 && magnitude(value) > 0 ? 'pressed'
        : magnitude(previous.value) > 0 && magnitude(value) === 0 ? 'released' : 'changed'
    };
    this.state.set(actionId, { value: structuredClone(value), sourceId });
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(event, snapshot);
  }
}
