const ACTION_ID = /^[A-Z][A-Z0-9_]*$/;
const ACTION_TYPES = new Set(['digital','axis1','axis2','trigger','pointer','text']);
const BEHAVIORS = new Set(['tap','hold','double-tap','toggle','repeat','continuous']);

export class ActionRegistry {
  constructor(definitions = []) {
    this.actions = new Map();
    for (const definition of definitions) this.register(definition);
  }

  register(definition) {
    const errors = validateActionDefinition(definition);
    if (errors.length) throw new Error(`Invalid action ${definition?.id || '<unknown>'}: ${errors.join('; ')}`);
    if (this.actions.has(definition.id)) throw new Error(`Duplicate action: ${definition.id}`);
    this.actions.set(definition.id, structuredClone(definition));
    return this;
  }

  has(id) { return this.actions.has(id); }

  get(id) {
    const found = this.actions.get(id);
    if (!found) throw new Error(`Unknown action: ${id}`);
    return structuredClone(found);
  }

  list() { return [...this.actions.values()].map(value => structuredClone(value)); }

  static fromDocument(document) {
    if (!document || !Array.isArray(document.actions)) throw new Error('Action document must contain an actions array');
    return new ActionRegistry(document.actions);
  }
}

export function validateActionDefinition(action) {
  const errors = [];
  if (!action || typeof action !== 'object' || Array.isArray(action)) return ['definition must be an object'];
  if (!ACTION_ID.test(String(action.id || ''))) errors.push('id must use UPPER_SNAKE_CASE');
  if (!String(action.name || '').trim()) errors.push('name is required');
  if (!ACTION_TYPES.has(action.type)) errors.push('unsupported type');
  if (!action.range || !Number.isFinite(action.range.min) || !Number.isFinite(action.range.max)) errors.push('range min/max are required');
  else if (action.range.min >= action.range.max) errors.push('range min must be less than max');
  if (!Array.isArray(action.behavior) || !action.behavior.length) errors.push('behavior is required');
  else {
    if (new Set(action.behavior).size !== action.behavior.length) errors.push('behavior entries must be unique');
    for (const behavior of action.behavior) if (!BEHAVIORS.has(behavior)) errors.push(`unsupported behavior ${behavior}`);
  }
  if (!Number.isFinite(action.sensitivity) || action.sensitivity <= 0) errors.push('sensitivity must be positive');
  if (!Array.isArray(action.accessibilityAlternatives)) errors.push('accessibilityAlternatives must be an array');
  if (!action.defaultBindings || typeof action.defaultBindings !== 'object' || Array.isArray(action.defaultBindings)) errors.push('defaultBindings must be an object');
  else for (const [device,bindings] of Object.entries(action.defaultBindings)) if (!Array.isArray(bindings) || bindings.some(binding=>typeof binding !== 'string')) errors.push(`defaultBindings.${device} must be a string array`);
  if (action.deadZone) {
    if (!Number.isFinite(action.deadZone.inner) || !Number.isFinite(action.deadZone.outer)) errors.push('deadZone inner/outer must be numbers');
    else if (action.deadZone.inner < 0 || action.deadZone.outer > 1 || action.deadZone.inner >= action.deadZone.outer) errors.push('deadZone must satisfy 0 <= inner < outer <= 1');
  }
  return errors;
}
