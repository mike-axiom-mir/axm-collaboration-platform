const DEFAULTS = {
  version: '0.2.0',
  global: {
    leftHanded: false,
    oneHandedMode: 'off',
    reducedMotion: false,
    highContrast: false,
    vibrationEnabled: true,
    vibrationStrength: 0.65,
    holdToggleMode: 'game-default',
    stickSize: 150,
    buttonSize: 66,
    opacity: 0.82,
    sensitivity: 1,
    deadZone: 0.12,
    floatingSticks: true,
    snapDirections: 0
  },
  devices: {},
  games: {}
};

export class SettingsStore {
  // Keep the v0.1 storage key so upgrading does not silently discard layouts.
  constructor(storage = globalThis.localStorage, key = 'axm.controls.settings.v0.1') {
    this.storage = storage;
    this.key = key;
    this.data = this.#load();
  }

  getGlobal() { return structuredClone(this.data.global); }
  getDevice(deviceId) { return structuredClone(this.data.devices[deviceId] || {}); }
  getGame(gameId) { return structuredClone(this.data.games[gameId] || {}); }

  effective(deviceId, gameId) {
    return sanitizeEffective(deepMerge({}, this.data.global, this.data.devices[deviceId] || {}, this.data.games[gameId] || {}));
  }

  updateGlobal(patch) { this.data.global = deepMerge({}, this.data.global, patch); return this.#save(); }
  updateDevice(deviceId, patch) { this.data.devices[deviceId] = deepMerge({}, this.data.devices[deviceId] || {}, patch); return this.#save(); }
  updateGame(gameId, patch) { this.data.games[gameId] = deepMerge({}, this.data.games[gameId] || {}, patch); return this.#save(); }

  resetGlobal() { this.data.global = structuredClone(DEFAULTS.global); return this.#save(); }
  resetDevice(deviceId) { delete this.data.devices[deviceId]; return this.#save(); }
  resetGame(gameId) { delete this.data.games[gameId]; return this.#save(); }
  resetAll() { this.data = structuredClone(DEFAULTS); return this.#save(); }

  export() { return structuredClone(this.data); }
  import(document) {
    if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('settings import must be an object');
    this.data = migrateDocument(document);
    return this.#save();
  }

  #load() {
    try {
      const parsed = JSON.parse(this.storage?.getItem(this.key) || 'null');
      return parsed ? migrateDocument(parsed) : structuredClone(DEFAULTS);
    } catch { return structuredClone(DEFAULTS); }
  }

  #save() {
    this.data.version = DEFAULTS.version;
    this.storage?.setItem(this.key, JSON.stringify(this.data));
    return structuredClone(this.data);
  }
}

function migrateDocument(document) {
  const merged = deepMerge({}, DEFAULTS, document);
  merged.version = DEFAULTS.version;
  if (!merged.devices || typeof merged.devices !== 'object' || Array.isArray(merged.devices)) merged.devices = {};
  if (!merged.games || typeof merged.games !== 'object' || Array.isArray(merged.games)) merged.games = {};
  merged.global = sanitizeEffective(merged.global || {});
  return merged;
}

function sanitizeEffective(settings) {
  const output=deepMerge({},settings);
  output.stickSize=clampNumber(output.stickSize,100,230,DEFAULTS.global.stickSize);
  output.buttonSize=clampNumber(output.buttonSize,48,100,DEFAULTS.global.buttonSize);
  output.opacity=clampNumber(output.opacity,.25,1,DEFAULTS.global.opacity);
  output.sensitivity=clampNumber(output.sensitivity,.35,2,DEFAULTS.global.sensitivity);
  output.deadZone=clampNumber(output.deadZone,0,.45,DEFAULTS.global.deadZone);
  output.vibrationStrength=clampNumber(output.vibrationStrength,0,1,DEFAULTS.global.vibrationStrength);
  output.snapDirections=[0,4,8].includes(Number(output.snapDirections))?Number(output.snapDirections):0;
  output.oneHandedMode=['off','left','right'].includes(output.oneHandedMode)?output.oneHandedMode:'off';
  output.holdToggleMode=['game-default','hold-to-toggle','toggle-to-hold'].includes(output.holdToggleMode)?output.holdToggleMode:'game-default';
  for(const key of ['leftHanded','reducedMotion','highContrast','vibrationEnabled','floatingSticks']) output[key]=Boolean(output[key]);
  if (!output.layout || typeof output.layout!=='object' || Array.isArray(output.layout)) output.layout={};
  return output;
}

function clampNumber(value,min,max,fallback){
  const number=Number(value);
  return Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback;
}
function deepMerge(target, ...sources) {
  for (const source of sources) {
    for (const [key, value] of Object.entries(source || {})) {
      if (value && typeof value === 'object' && !Array.isArray(value)) target[key] = deepMerge({}, target[key] || {}, value);
      else target[key] = structuredClone(value);
    }
  }
  return target;
}
