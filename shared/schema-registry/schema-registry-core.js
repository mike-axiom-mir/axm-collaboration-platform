'use strict';

const crypto = require('crypto');

const REGISTRY_SCHEMA = 'axm.schema-registry/v1';
const COMPATIBILITY_SCHEMA = 'axm.schema-compatibility/v1';
const IGNORED_ANNOTATIONS = new Set(['$id', '$schema', '$comment', 'title', 'description', 'examples', 'default', 'deprecated', 'readOnly', 'writeOnly']);

class SchemaRegistryError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'SchemaRegistryError';
    this.code = code;
    this.details = details || null;
  }
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}

function sha256(value) {
  return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value)).digest('hex');
}

function semanticSchema(value) {
  if (Array.isArray(value)) return value.map(semanticSchema);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (!IGNORED_ANNOTATIONS.has(key)) out[key] = semanticSchema(value[key]);
  }
  return out;
}

function family(id) {
  return String(id).replace(/\/v\d+(?:\.\d+){0,2}(?:[-+][A-Za-z0-9.-]+)?$/, '');
}

function major(id) {
  const match = String(id).match(/\/v(\d+)(?:\.|$)/);
  return match ? Number(match[1]) : null;
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new SchemaRegistryError('INVALID_SCHEMA_ENTRY', 'Schema entry must be an object');
  const id = String(entry.id || entry.value && entry.value.$id || '').trim();
  if (!id) throw new SchemaRegistryError('MISSING_SCHEMA_ID', 'Schema entry has no $id');
  const value = entry.value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SchemaRegistryError('INVALID_SCHEMA_VALUE', `Schema ${id} is not an object`);
  if (value.$id && value.$id !== id) throw new SchemaRegistryError('SCHEMA_ID_DRIFT', `Entry id ${id} disagrees with document $id ${value.$id}`);
  const digest = entry.sha256 || sha256(canonical(value));
  return {
    id,
    family: family(id),
    major: major(id),
    path: entry.path || null,
    sha256: digest,
    semanticDigest: sha256(canonical(semanticSchema(value))),
    dialect: value.$schema || null,
    value
  };
}

function normalizeAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') throw new SchemaRegistryError('INVALID_ADAPTER', 'Adapter declaration must be an object');
  const id = String(adapter.id || '').trim();
  const from = String(adapter.from || '').trim();
  const to = String(adapter.to || '').trim();
  if (!id || !from || !to) throw new SchemaRegistryError('INVALID_ADAPTER', 'Adapter requires id, from, and to');
  if (!Array.isArray(adapter.losses)) throw new SchemaRegistryError('UNDECLARED_ADAPTER_LOSS', `Adapter ${id} must declare a losses array, including [] when lossless`);
  return { id, from, to, losses: Array.from(new Set(adapter.losses.map(String))).sort(), executable: false };
}

function createRegistry(entries, adapters) {
  const byId = new Map();
  for (const raw of entries || []) {
    const entry = normalizeEntry(raw);
    if (byId.has(entry.id)) {
      const first = byId.get(entry.id);
      if (first.sha256 !== entry.sha256 || first.semanticDigest !== entry.semanticDigest) {
        throw new SchemaRegistryError('DUPLICATE_SCHEMA_ID', `Schema id ${entry.id} has byte- or meaning-distinct definitions`, { first: first.path, second: entry.path });
      }
      continue;
    }
    byId.set(entry.id, entry);
  }
  const adapterRows = (adapters || []).map(normalizeAdapter).sort((a, b) => a.id.localeCompare(b.id));
  const adapterIds = new Set();
  for (const row of adapterRows) {
    if (adapterIds.has(row.id)) throw new SchemaRegistryError('DUPLICATE_ADAPTER_ID', `Duplicate adapter id ${row.id}`);
    adapterIds.add(row.id);
    if (!byId.has(row.from) || !byId.has(row.to)) throw new SchemaRegistryError('UNRESOLVED_ADAPTER_SCHEMA', `Adapter ${row.id} references an unknown schema`, row);
  }
  return { byId, adapters: adapterRows };
}

function resolve(registry, id) {
  const entry = registry.byId.get(id);
  return entry ? { state: 'RESOLVED', entry } : { state: 'UNRESOLVED', id };
}

function compatibility(registry, sourceId, targetId) {
  const source = registry.byId.get(sourceId);
  const target = registry.byId.get(targetId);
  const base = { schema: COMPATIBILITY_SCHEMA, source: sourceId, target: targetId, losses: [], adapter: null };
  if (!source || !target) return { ...base, state: 'UNKNOWN', basis: ['one-or-both-schema-identities-unresolved'] };
  if (source.id === target.id && source.sha256 === target.sha256) return { ...base, state: 'EXACT', basis: ['same-id', 'same-content-digest'] };
  if (source.semanticDigest === target.semanticDigest) return { ...base, state: 'STRUCTURALLY_EQUIVALENT', basis: ['annotation-free-schema-digests-match'] };
  const adapter = registry.adapters.find(row => row.from === sourceId && row.to === targetId);
  if (adapter) return { ...base, state: 'ADAPTER_REQUIRED', basis: ['explicit-adapter-declaration', 'adapter-not-executed'], losses: adapter.losses, adapter: adapter.id };
  if (source.family !== target.family) return { ...base, state: 'INCOMPATIBLE', basis: ['different-schema-families', 'no-explicit-adapter'] };
  return {
    ...base,
    state: 'UNKNOWN',
    basis: [
      source.major === target.major ? 'same-major-is-not-proof' : 'version-change-is-not-proof',
      'semantic-structures-differ',
      'no-explicit-adapter'
    ]
  };
}

function compile(input) {
  if (!input || typeof input !== 'object') throw new SchemaRegistryError('INVALID_INPUT', 'Registry input is required');
  const registry = createRegistry(input.entries, input.adapters);
  const entries = Array.from(registry.byId.values()).sort((a, b) => a.id.localeCompare(b.id)).map(({ value, ...row }) => row);
  const unresolvedSockets = Array.from(new Set((input.unresolvedSockets || []).map(String))).sort();
  const base = {
    schema: REGISTRY_SCHEMA,
    graphDigest: String(input.graphDigest || ''),
    entries,
    adapters: registry.adapters,
    unresolvedSockets,
    truth: {
      fullJsonSchemaValidator: false,
      versionLabelProvesCompatibility: false,
      adapterDeclarationExecutesAdapter: false,
      undeclaredLossAllowed: false,
      automaticMigration: false,
      automaticRewrite: false,
      authorityGranted: false
    }
  };
  return { ...base, registryDigest: sha256(canonical(base)) };
}

module.exports = {
  REGISTRY_SCHEMA,
  COMPATIBILITY_SCHEMA,
  SchemaRegistryError,
  canonical,
  sha256,
  semanticSchema,
  family,
  major,
  normalizeEntry,
  normalizeAdapter,
  createRegistry,
  resolve,
  compatibility,
  compile
};
