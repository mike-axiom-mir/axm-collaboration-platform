export const LAYER_SCHEMA = 'axm.foundation-planet.layers/v1';

export const LAYER_DEFINITIONS = Object.freeze([
  { id: 'terrain', label: 'Terrain substrate', category: 'physical', defaultEnabled: true, mutable: false },
  { id: 'hydrology', label: 'Oceans & water', category: 'physical', defaultEnabled: true },
  { id: 'groundwater', label: 'Groundwater state', category: 'physical', defaultEnabled: true },
  { id: 'geology', label: 'Geology outcrops', category: 'physical', defaultEnabled: true },
  { id: 'atmosphere', label: 'Atmosphere', category: 'conditions', defaultEnabled: true },
  { id: 'clouds', label: 'Cloud field', category: 'conditions', defaultEnabled: true },
  { id: 'weather', label: 'Local weather', category: 'conditions', defaultEnabled: true },
  { id: 'cryosphere', label: 'Snow & sea ice', category: 'conditions', defaultEnabled: true },
  { id: 'vegetation', label: 'Vegetation', category: 'living', defaultEnabled: true },
  { id: 'fauna', label: 'Fauna', category: 'living', defaultEnabled: true },
  { id: 'decomposers', label: 'Soil & decomposers', category: 'living', defaultEnabled: true }
]);

const clone = value => JSON.parse(JSON.stringify(value));

export class LayerSystem extends EventTarget {
  constructor(options = {}) {
    super();
    this.storageKey = options.storageKey || 'AXM_FOUNDATION_PLANET_LAYERS_V1';
    this.storage = options.storage === undefined ? globalThis.localStorage : options.storage;
    this.state = Object.fromEntries(LAYER_DEFINITIONS.map(layer => [layer.id, layer.defaultEnabled]));
    this.restore();
  }

  definition(id) { return LAYER_DEFINITIONS.find(layer => layer.id === id) || null; }
  enabled(id) { return this.state[id] !== false; }

  set(id, enabled, reason = 'human-control') {
    const definition = this.definition(id);
    if (!definition) throw new Error(`Unknown planet layer: ${id}`);
    if (definition.mutable === false && enabled === false) return false;
    const next = enabled === true;
    if (this.state[id] === next) return false;
    this.state[id] = next;
    this.persist();
    this.dispatchEvent(new CustomEvent('change', { detail: { id, enabled: next, reason, snapshot: this.snapshot() } }));
    return true;
  }

  setLiving(enabled, reason = 'human-life-master-control') {
    let changed = false;
    LAYER_DEFINITIONS.filter(layer => layer.category === 'living').forEach(layer => {
      if (this.state[layer.id] !== (enabled === true)) {
        this.state[layer.id] = enabled === true;
        changed = true;
      }
    });
    if (changed) {
      this.persist();
      this.dispatchEvent(new CustomEvent('change', { detail: { id: 'living:*', enabled: enabled === true, reason, snapshot: this.snapshot() } }));
    }
    return changed;
  }

  livingEnabled() {
    return LAYER_DEFINITIONS.filter(layer => layer.category === 'living').some(layer => this.enabled(layer.id));
  }

  snapshot() {
    return { schema: LAYER_SCHEMA, layers: clone(this.state), livingMaster: this.livingEnabled() };
  }

  restore() {
    if (!this.storage || typeof this.storage.getItem !== 'function') return;
    try {
      const saved = JSON.parse(this.storage.getItem(this.storageKey) || 'null');
      if (!saved || saved.schema !== LAYER_SCHEMA || !saved.layers) return;
      LAYER_DEFINITIONS.forEach(layer => {
        if (layer.mutable !== false && typeof saved.layers[layer.id] === 'boolean') this.state[layer.id] = saved.layers[layer.id];
      });
    } catch (_) {}
  }

  persist() {
    if (!this.storage || typeof this.storage.setItem !== 'function') return;
    try { this.storage.setItem(this.storageKey, JSON.stringify(this.snapshot())); } catch (_) {}
  }
}
