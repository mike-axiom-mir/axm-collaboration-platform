import { PLANET_DEFAULTS } from './planet-model.mjs';

export const WORLD_STATE_SCHEMA = 'axm.foundation-planet.world-state/v2';
export const LEGACY_SAVE_SCHEMA = 'axm.foundation-planet.save/v1';

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      if (value[key] !== undefined) result[key] = stableValue(value[key]);
      return result;
    }, {});
  }
  return value;
}

export function canonicalJson(value) { return JSON.stringify(stableValue(value)); }

export function checksum(value) {
  const text = typeof value === 'string' ? value : canonicalJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function validateSaveEnvelope(envelope) {
  if (!envelope || envelope.schema !== WORLD_STATE_SCHEMA) return { valid: false, reason: 'schema' };
  if (envelope.worldId !== PLANET_DEFAULTS.id || envelope.seed !== PLANET_DEFAULTS.seed) return { valid: false, reason: 'world-identity' };
  if (!Number.isSafeInteger(envelope.revision) || envelope.revision < 0) return { valid: false, reason: 'revision' };
  if (!envelope.payload || typeof envelope.payload !== 'object') return { valid: false, reason: 'payload' };
  const expected = checksum({
    schema: envelope.schema,
    worldId: envelope.worldId, seed: envelope.seed, lineageId: envelope.lineageId,
    revision: envelope.revision, parentRevision: envelope.parentRevision,
    payload: envelope.payload, journal: envelope.journal || []
  });
  if (expected !== envelope.integrity?.checksum) return { valid: false, reason: 'checksum' };
  return { valid: true, reason: null };
}

export function migrateLegacySave(legacy) {
  if (!legacy || legacy.schema !== LEGACY_SAVE_SCHEMA) return null;
  const { schema: _schema, ...payload } = legacy;
  return {
    payload,
    migration: { from: LEGACY_SAVE_SCHEMA, preserved: true }
  };
}

function actionRecord(action, revision) {
  const kind = String(action?.kind || 'checkpoint').slice(0, 64);
  const actor = String(action?.actor || 'foundation-planet').slice(0, 96);
  const coordinate = action?.coordinate && Number.isFinite(action.coordinate.lat) && Number.isFinite(action.coordinate.lon)
    ? { lat: action.coordinate.lat, lon: action.coordinate.lon }
    : null;
  return {
    schema: 'axm.foundation-planet.world-event/v1',
    id: `${PLANET_DEFAULTS.id}:${revision}`,
    revision, kind, actor, coordinate,
    details: action?.details && typeof action.details === 'object' ? stableValue(action.details) : null
  };
}

export class WorldStateStore {
  constructor(options = {}) {
    this.storage = options.storage === undefined ? globalThis.localStorage : options.storage;
    this.key = options.key || 'AXM_FOUNDATION_PLANET_SAVE_V2';
    this.legacyKey = options.legacyKey || 'AXM_FOUNDATION_PLANET_SAVE_V1';
    this.maxJournal = Math.max(8, Math.min(256, Number(options.maxJournal || 96)));
    this.envelope = null;
    this.loadStatus = 'empty';
  }

  load() {
    if (!this.storage) return null;
    try {
      const current = JSON.parse(this.storage.getItem(this.key) || 'null');
      const result = validateSaveEnvelope(current);
      if (result.valid) {
        this.envelope = current;
        this.loadStatus = 'restored-v2';
        return current;
      }
      const legacy = JSON.parse(this.storage.getItem(this.legacyKey) || 'null');
      const migrated = migrateLegacySave(legacy);
      if (migrated) {
        this.loadStatus = 'migrated-v1';
        this.commit(migrated.payload, {
          kind: 'migrate-save', actor: 'foundation-planet',
          details: migrated.migration
        }, { expectedRevision: 0, forceInitial: true });
        return this.envelope;
      }
    } catch (_) {
      this.loadStatus = 'invalid';
    }
    return null;
  }

  commit(payload, action = {}, options = {}) {
    if (!payload || typeof payload !== 'object') throw new TypeError('world-state payload must be an object');
    const currentRevision = this.envelope?.revision || 0;
    const expectedRevision = options.expectedRevision;
    if (Number.isSafeInteger(expectedRevision) && expectedRevision !== currentRevision) {
      const error = new Error(`revision conflict: expected ${expectedRevision}, current ${currentRevision}`);
      error.code = 'REVISION_CONFLICT';
      throw error;
    }
    const revision = currentRevision + 1;
    const lineageId = this.envelope?.lineageId || `${PLANET_DEFAULTS.id}:${PLANET_DEFAULTS.seed}:root`;
    const journal = [...(this.envelope?.journal || []), actionRecord(action, revision)].slice(-this.maxJournal);
    const base = {
      schema: WORLD_STATE_SCHEMA,
      worldId: PLANET_DEFAULTS.id,
      seed: PLANET_DEFAULTS.seed,
      lineageId,
      revision,
      parentRevision: currentRevision,
      payload: stableValue(payload),
      journal
    };
    this.envelope = {
      ...base,
      integrity: { algorithm: 'fnv1a32', checksum: checksum(base) }
    };
    if (this.storage) this.storage.setItem(this.key, JSON.stringify(this.envelope));
    return this.envelope;
  }

  payload() { return this.envelope?.payload || null; }

  descriptor() {
    return {
      schema: WORLD_STATE_SCHEMA,
      backend: this.storage ? 'browser-local-v2' : 'memory-v2',
      lineageId: this.envelope?.lineageId || `${PLANET_DEFAULTS.id}:${PLANET_DEFAULTS.seed}:root`,
      revision: this.envelope?.revision || 0,
      parentRevision: this.envelope?.parentRevision ?? null,
      checksum: this.envelope?.integrity?.checksum || null,
      journalLength: this.envelope?.journal?.length || 0,
      optimisticConcurrency: true,
      authoritativeSharedHost: false,
      authoritativeHostSeam: 'named-world-host-v1',
      loadStatus: this.loadStatus
    };
  }
}

export function worldStateDescription() {
  return {
    schema: WORLD_STATE_SCHEMA,
    revisioned: true,
    checksummed: true,
    eventJournal: true,
    optimisticConcurrency: true,
    legacyMigration: LEGACY_SAVE_SCHEMA,
    authoritativeSharedHost: false,
    authoritativeHostSeam: 'named-world-host-v1',
    explicitAttachmentRequired: true
  };
}
