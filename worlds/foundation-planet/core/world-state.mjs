import { PLANET_DEFAULTS } from './planet-model.mjs';

export const WORLD_STATE_SCHEMA = 'axm.foundation-planet.world-state/v2';
export const LEGACY_SAVE_SCHEMA = 'axm.foundation-planet.save/v1';
export const COMPRESSED_WORLD_STATE_STORAGE_SCHEMA =
  'axm.foundation-planet.compressed-world-state-storage/v1';
export const COMPRESSED_WORLD_STATE_ENCODING = 'lzw-uint16-base64';

function bytesToBase64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(
      offset, Math.min(bytes.length, offset + 32_768)));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function compressText(value) {
  const input = new TextEncoder().encode(value);
  if (!input.length) return { data: '', uncompressedBytes: 0 };
  const dictionary = new Map();
  const codes = [];
  let nextCode = 256;
  let prefix = input[0];
  for (let index = 1; index < input.length; index++) {
    const byte = input[index];
    const key = prefix * 256 + byte;
    const known = dictionary.get(key);
    if (known !== undefined) {
      prefix = known;
      continue;
    }
    codes.push(prefix);
    if (nextCode < 65_535) dictionary.set(key, nextCode++);
    else {
      dictionary.clear();
      nextCode = 256;
    }
    prefix = byte;
  }
  codes.push(prefix);
  const encoded = new Uint8Array(codes.length * 2);
  for (let index = 0; index < codes.length; index++) {
    encoded[index * 2] = codes[index] >>> 8;
    encoded[index * 2 + 1] = codes[index] & 255;
  }
  return {
    data: bytesToBase64(encoded),
    uncompressedBytes: input.length
  };
}

function decompressText(data, expectedBytes) {
  const encoded = base64ToBytes(data);
  if (encoded.length % 2 !== 0 || !Number.isSafeInteger(expectedBytes) ||
      expectedBytes < 0) throw new Error('compressed world-state shape');
  if (!encoded.length) {
    if (expectedBytes !== 0) throw new Error('compressed world-state length');
    return '';
  }
  const codes = new Uint16Array(encoded.length / 2);
  for (let index = 0; index < codes.length; index++) {
    codes[index] = encoded[index * 2] * 256 + encoded[index * 2 + 1];
  }
  const prefixes = new Uint16Array(65_535);
  const suffixes = new Uint8Array(65_535);
  const stack = new Uint8Array(65_535);
  const output = new Uint8Array(expectedBytes);
  let outputOffset = 0;
  let nextCode = 256;

  function firstByte(code) {
    let cursor = code;
    while (cursor >= 256) cursor = prefixes[cursor];
    return cursor;
  }

  function emit(code) {
    let cursor = code;
    let length = 0;
    while (cursor >= 256) {
      if (cursor >= nextCode || length >= stack.length) {
        throw new Error('compressed world-state dictionary');
      }
      stack[length++] = suffixes[cursor];
      cursor = prefixes[cursor];
    }
    stack[length++] = cursor;
    if (outputOffset + length > output.length) {
      throw new Error('compressed world-state overflow');
    }
    for (let index = length - 1; index >= 0; index--) {
      output[outputOffset++] = stack[index];
    }
  }

  let previous = codes[0];
  if (previous >= 256) throw new Error('compressed world-state first code');
  emit(previous);
  for (let index = 1; index < codes.length; index++) {
    const code = codes[index];
    if (nextCode >= 65_535) {
      nextCode = 256;
      if (code >= 256) throw new Error('compressed world-state reset');
      emit(code);
      previous = code;
      continue;
    }
    if (code > nextCode) throw new Error('compressed world-state code');
    const first = code === nextCode ? firstByte(previous) : firstByte(code);
    prefixes[nextCode] = previous;
    suffixes[nextCode] = first;
    nextCode++;
    emit(code);
    previous = code;
  }
  if (outputOffset !== output.length) {
    throw new Error('compressed world-state length');
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(output);
}

export function encodeStoredEnvelope(envelope) {
  const text = JSON.stringify(envelope);
  const compressed = compressText(text);
  return JSON.stringify({
    schema: COMPRESSED_WORLD_STATE_STORAGE_SCHEMA,
    encoding: COMPRESSED_WORLD_STATE_ENCODING,
    uncompressedCharacters: text.length,
    uncompressedBytes: compressed.uncompressedBytes,
    data: compressed.data
  });
}

export function decodeStoredEnvelope(value) {
  if (value?.schema !== COMPRESSED_WORLD_STATE_STORAGE_SCHEMA) {
    return { envelope: value, encoding: 'json' };
  }
  if (value.encoding !== COMPRESSED_WORLD_STATE_ENCODING ||
      typeof value.data !== 'string') {
    throw new Error('compressed world-state encoding');
  }
  const text = decompressText(value.data, value.uncompressedBytes);
  if (text.length !== value.uncompressedCharacters) {
    throw new Error('compressed world-state character length');
  }
  return {
    envelope: JSON.parse(text),
    encoding: COMPRESSED_WORLD_STATE_ENCODING
  };
}

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
    this.storageEncoding = 'json';
  }

  load() {
    if (!this.storage) return null;
    try {
      const stored = JSON.parse(this.storage.getItem(this.key) || 'null');
      const decoded = decodeStoredEnvelope(stored);
      const current = decoded.envelope;
      const result = validateSaveEnvelope(current);
      if (result.valid) {
        this.envelope = current;
        this.storageEncoding = decoded.encoding;
        this.loadStatus = decoded.encoding === 'json' ?
          'restored-v2' : 'restored-v2-compressed';
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
    const nextEnvelope = {
      ...base,
      integrity: { algorithm: 'fnv1a32', checksum: checksum(base) }
    };
    let storageEncoding = 'json';
    if (this.storage) {
      try {
        this.storage.setItem(this.key, JSON.stringify(nextEnvelope));
      } catch (uncompressedError) {
        try {
          this.storage.setItem(this.key, encodeStoredEnvelope(nextEnvelope));
          storageEncoding = COMPRESSED_WORLD_STATE_ENCODING;
        } catch (compressedError) {
          compressedError.uncompressedStorageError = uncompressedError;
          throw compressedError;
        }
      }
    }
    this.envelope = nextEnvelope;
    this.storageEncoding = storageEncoding;
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
      storageEncoding: this.storageEncoding,
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
    explicitAttachmentRequired: true,
    losslessCompressedStorageFallback: COMPRESSED_WORLD_STATE_ENCODING,
    failedWritesAreTransactional: true
  };
}
