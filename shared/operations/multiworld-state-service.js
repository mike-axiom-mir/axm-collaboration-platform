'use strict';

const fs = require('fs');
const path = require('path');
const U = require('./operations-utils');

const WORLD_SCHEMA = 'axm.living-world-state/v1';
const CREATE_SCHEMA = 'axm.living-world.create/v1';
const CATALOG_SCHEMA = 'axm.living-world-catalog/v1';

function cleanWorldId(value) {
  const id = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9.-]{2,119}$/.test(id) || id.includes('..') || id.endsWith('.')) {
    throw new Error('worldId must use lowercase letters, digits, dots and hyphens');
  }
  return id;
}

function boundedObject(value, label, maxBytes) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const copy = U.clone(value), encoded = JSON.stringify(copy);
  if (encoded.length > maxBytes) throw new Error(label + ' exceeds ' + Math.floor(maxBytes / 1000) + ' KB');
  return copy;
}

function hasSecretField(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasSecretField);
  return Object.entries(value).some(([key, nested]) => /(?:password|secret|token|privatekey|credential)/i.test(key) || hasSecretField(nested));
}

function create(options) {
  const stateDir = path.join(options.stateRoot, 'living-world-state-server');
  const worldsDir = path.join(stateDir, 'named-worlds');
  const catalogFile = path.join(worldsDir, 'catalog.json');
  const auditFile = path.join(stateDir, 'multiworld-audit.jsonl');

  function worldKey(worldId) {
    const id = cleanWorldId(worldId);
    const slug = id.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 56);
    return slug + '-' + U.sha256(id).slice(0, 12);
  }

  function pathsFor(worldId) {
    const id = cleanWorldId(worldId), root = path.join(worldsDir, worldKey(id));
    return {
      id, root,
      worldFile: path.join(root, 'world.json'),
      snapshotsDir: path.join(root, 'snapshots'),
      previewsDir: path.join(root, 'restore-previews')
    };
  }

  function readCatalog() {
    const catalog = U.loadJson(catalogFile, { schema: CATALOG_SCHEMA, version: 1, worlds: [] });
    if (!catalog || catalog.schema !== CATALOG_SCHEMA || !Array.isArray(catalog.worlds)) return { schema: CATALOG_SCHEMA, version: 1, worlds: [] };
    return catalog;
  }

  function writeCatalog(catalog) {
    catalog.updatedAt = U.now();
    U.atomicJson(catalogFile, catalog);
  }

  function audit(event) { U.appendJsonl(auditFile, Object.assign({ at: U.now() }, event)); }

  function digest(state) {
    const view = U.clone(state);
    delete view.journal;
    delete view.digest;
    delete view.etag;
    return U.sha256(JSON.stringify(view));
  }

  function read(worldId) {
    const paths = pathsFor(worldId), state = U.loadJson(paths.worldFile, null);
    if (!state || state.schema !== WORLD_SCHEMA || state.worldId !== paths.id) throw new Error('living world not found: ' + paths.id);
    return state;
  }

  function write(state) {
    const paths = pathsFor(state.worldId);
    state.updatedAt = U.now();
    U.atomicJson(paths.worldFile, state);
  }

  function publicWorld(world) {
    const state = U.clone(world);
    const worldDigest = digest(state);
    return Object.assign(state, { digest: worldDigest, etag: 'W/"world-' + state.revision + '-' + worldDigest.slice(0, 12) + '"' });
  }

  function normalizeFacts(raw) {
    const source = raw === undefined ? {} : boundedObject(raw, 'world facts', 100000);
    const entries = Object.entries(source);
    if (entries.length > 128) throw new Error('world facts exceed 128 entries');
    const facts = {};
    for (const [key, value] of entries) {
      const cleanKey = U.cleanId(key, 'fact key');
      if (JSON.stringify(value).length > 10000) throw new Error('world fact exceeds 10 KB: ' + cleanKey);
      if (hasSecretField(value)) throw new Error('secret-like world fact field refused');
      facts[cleanKey] = U.clone(value);
    }
    return facts;
  }

  function createWorld(input, actor) {
    const body = input || {};
    if (body.schema && body.schema !== CREATE_SCHEMA) throw new Error('living world create schema mismatch');
    const worldId = cleanWorldId(body.worldId);
    if (worldId === 'living-globe') throw new Error('the legacy living-globe world already owns its compatibility slot');
    const paths = pathsFor(worldId);
    if (fs.existsSync(paths.worldFile)) throw new Error('living world already exists: ' + worldId);
    const lineageId = String(body.lineageId || worldId + ':root').trim().slice(0, 240);
    if (!lineageId) throw new Error('lineageId is required');
    const coordinateReference = boundedObject(body.coordinateReference || { type: 'unspecified' }, 'coordinateReference', 20000);
    const metadata = boundedObject(body.metadata || {}, 'world metadata', 50000);
    if (hasSecretField(coordinateReference) || hasSecretField(metadata)) throw new Error('secret-like world metadata field refused');
    const now = U.now();
    const world = {
      schema: WORLD_SCHEMA,
      worldId,
      owner: 'living-world-state-server',
      lineageId,
      seed: body.seed === undefined ? null : U.clone(body.seed),
      coordinateReference,
      metadata,
      revision: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: String(actor || 'local-user').slice(0, 120),
      facts: normalizeFacts(body.facts),
      entities: [],
      journal: [],
      lastSnapshotId: null
    };
    if (JSON.stringify(world.seed).length > 1000) throw new Error('world seed exceeds 1 KB');
    write(world);
    const catalog = readCatalog();
    catalog.worlds.push({ worldId, lineageId, owner: world.owner, createdAt: now, pathKey: worldKey(worldId) });
    catalog.worlds.sort((a, b) => a.worldId.localeCompare(b.worldId));
    writeCatalog(catalog);
    audit({ type: 'world-created', worldId, lineageId, actor: world.createdBy, digest: digest(world) });
    return publicWorld(world);
  }

  function validateEntity(raw) {
    const body = raw || {};
    const id = U.cleanId(body.id, 'entity id'), kind = U.cleanId(body.kind || 'object', 'entity kind');
    const data = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? U.clone(body.data) : {};
    if (JSON.stringify(data).length > 50000) throw new Error('world entity exceeds 50 KB');
    if (hasSecretField(data)) throw new Error('secret-like world entity field refused');
    return { id, kind, data };
  }

  function normalizeOps(raw) {
    const list = Array.isArray(raw) ? raw : [];
    if (!list.length || list.length > 50) throw new Error('world patch needs 1 to 50 operations');
    return list.map(item => {
      const type = String(item && item.type || '');
      if (type === 'upsert-entity') return { type, entity: validateEntity(item.entity) };
      if (type === 'remove-entity') return { type, id: U.cleanId(item.id, 'entity id') };
      if (type === 'set-fact') {
        const key = U.cleanId(item.key, 'fact key'), value = U.clone(item.value);
        if (JSON.stringify(value).length > 10000) throw new Error('world fact exceeds 10 KB');
        if (hasSecretField(value)) throw new Error('secret-like world fact field refused');
        return { type, key, value };
      }
      throw new Error('world operation is not allowlisted');
    });
  }

  function apply(input, actor) {
    const body = input || {}, worldId = cleanWorldId(body.worldId), world = read(worldId);
    const expected = Number(body.expectedRevision);
    if (!Number.isInteger(expected)) throw new Error('expectedRevision is required');
    if (expected !== world.revision) throw new Error('world revision conflict: expected ' + expected + ', current ' + world.revision);
    if (body.owner && body.owner !== world.owner) throw new Error('world ownership cannot be changed by a patch');
    if (body.lineageId && body.lineageId !== world.lineageId) throw new Error('world lineage cannot be changed by a patch');
    const ops = normalizeOps(body.operations), before = digest(world), changes = [], now = U.now();
    for (const op of ops) {
      if (op.type === 'upsert-entity') {
        const index = world.entities.findIndex(entity => entity.id === op.entity.id);
        const next = Object.assign({}, op.entity, { updatedAt: now });
        if (index >= 0) world.entities[index] = Object.assign({}, world.entities[index], next);
        else world.entities.push(Object.assign({ createdAt: now }, next));
        changes.push({ type: op.type, id: op.entity.id, kind: op.entity.kind });
      } else if (op.type === 'remove-entity') {
        const beforeCount = world.entities.length;
        world.entities = world.entities.filter(entity => entity.id !== op.id);
        if (world.entities.length === beforeCount) throw new Error('world entity not found: ' + op.id);
        changes.push({ type: op.type, id: op.id });
      } else {
        world.facts[op.key] = op.value;
        changes.push({ type: op.type, key: op.key });
      }
    }
    world.revision += 1;
    const event = {
      schema: 'axm.living-world-change/v1', id: U.uid('world-change'), worldId,
      revision: world.revision, previousDigest: before,
      actor: String(actor || 'local-user').slice(0, 120),
      source: String(body.source || 'direct-explicit-patch').slice(0, 120),
      changes, at: now
    };
    world.journal.push(event);
    world.journal = world.journal.slice(-1000);
    event.worldDigest = digest(world);
    write(world);
    audit({ type: 'patch', worldId, revision: world.revision, actor: event.actor, source: event.source, digest: event.worldDigest, changes: changes.length });
    return { world: publicWorld(world), event };
  }

  function changes(since, worldId) {
    const id = cleanWorldId(worldId), world = read(id), revision = Math.max(-1, Number(since) || 0);
    return {
      schema: 'axm.living-world-changes/v1', worldId: id,
      lineageId: world.lineageId, fromRevision: revision, toRevision: world.revision,
      changes: world.journal.filter(event => event.revision > revision),
      resyncRequired: world.journal.length > 0 && revision < world.journal[0].revision - 1
    };
  }

  function snapshot(actor, reason, worldId, sourceState) {
    const world = U.clone(sourceState || read(worldId)), paths = pathsFor(world.worldId);
    const id = U.uid('world-snapshot'), file = path.join(paths.snapshotsDir, id + '.json');
    const record = {
      schema: 'axm.living-world-snapshot/v1', id, worldId: world.worldId,
      lineageId: world.lineageId, revision: world.revision, owner: world.owner,
      reason: String(reason || 'manual snapshot').slice(0, 300),
      actor: String(actor || 'local-user').slice(0, 120), createdAt: U.now(),
      worldDigest: digest(world), world
    };
    U.atomicJson(file, record);
    if (!sourceState) { world.lastSnapshotId = id; write(world); }
    audit({ type: 'snapshot', worldId: world.worldId, id, revision: world.revision, digest: record.worldDigest, actor: record.actor });
    return Object.assign({}, record, { world: undefined, file: path.relative(options.root, file).replace(/\\/g, '/') });
  }

  function listSnapshots(worldId) {
    const paths = pathsFor(worldId);
    if (!fs.existsSync(paths.snapshotsDir)) return [];
    return fs.readdirSync(paths.snapshotsDir).filter(name => name.endsWith('.json')).map(name => {
      const item = U.loadJson(path.join(paths.snapshotsDir, name), null);
      return item ? { id: item.id, worldId: item.worldId, lineageId: item.lineageId, revision: item.revision, owner: item.owner, reason: item.reason, actor: item.actor, createdAt: item.createdAt, worldDigest: item.worldDigest } : null;
    }).filter(Boolean).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  function previewRestore(snapshotId, actor, worldId) {
    const paths = pathsFor(worldId), item = U.loadJson(path.join(paths.snapshotsDir, U.cleanId(snapshotId, 'snapshot id') + '.json'), null);
    if (!item || item.schema !== 'axm.living-world-snapshot/v1' || item.worldId !== paths.id) throw new Error('world snapshot not found');
    const current = read(paths.id);
    const preview = {
      schema: 'axm.world-restore-preview/v1', id: U.uid('world-restore-preview'), worldId: paths.id,
      lineageId: current.lineageId, snapshotId: item.id, fromRevision: current.revision, toRevision: item.revision,
      currentDigest: digest(current), snapshotDigest: item.worldDigest,
      entityDelta: item.world.entities.length - current.entities.length,
      actor: String(actor || 'local-user').slice(0, 120), createdAt: U.now(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    };
    U.atomicJson(path.join(paths.previewsDir, preview.id + '.json'), preview);
    return preview;
  }

  function restore(previewId, confirmation, actor, worldId) {
    if (confirmation !== 'RESTORE LIVING WORLD') throw new Error('exact world restore confirmation is required');
    const paths = pathsFor(worldId), preview = U.loadJson(path.join(paths.previewsDir, U.cleanId(previewId, 'preview id') + '.json'), null);
    if (!preview || preview.worldId !== paths.id || Date.parse(preview.expiresAt) <= Date.now()) throw new Error('world restore preview not found or expired');
    const current = read(paths.id);
    if (digest(current) !== preview.currentDigest) throw new Error('world changed after restore preview');
    snapshot(actor, 'automatic pre-restore safety snapshot', paths.id, current);
    const item = U.loadJson(path.join(paths.snapshotsDir, preview.snapshotId + '.json'), null);
    if (!item || item.worldId !== paths.id || digest(item.world) !== item.worldDigest) throw new Error('world snapshot digest is invalid');
    const restored = U.clone(item.world);
    if (restored.lineageId !== current.lineageId) throw new Error('world snapshot lineage mismatch');
    restored.revision = current.revision + 1;
    restored.owner = 'living-world-state-server';
    restored.journal = current.journal.concat({
      schema: 'axm.living-world-change/v1', id: U.uid('world-change'), worldId: paths.id,
      revision: restored.revision, previousDigest: preview.currentDigest,
      actor: String(actor || 'local-user').slice(0, 120), source: 'snapshot-restore',
      changes: [{ type: 'restore-snapshot', snapshotId: item.id }], at: U.now(), worldDigest: item.worldDigest
    }).slice(-1000);
    write(restored);
    audit({ type: 'restore', worldId: paths.id, snapshotId: item.id, revision: restored.revision, actor });
    return publicWorld(restored);
  }

  function list() {
    const catalog = readCatalog();
    return catalog.worlds.map(entry => {
      try {
        const world = read(entry.worldId);
        return { worldId: world.worldId, lineageId: world.lineageId, owner: world.owner, revision: world.revision, entities: world.entities.length, facts: Object.keys(world.facts).length, updatedAt: world.updatedAt, digest: digest(world) };
      } catch (_) {
        return Object.assign({}, entry, { unavailable: true });
      }
    });
  }

  return {
    createWorld, get: worldId => publicWorld(read(worldId)), changes, apply, snapshot, listSnapshots,
    previewRestore, restore, list, normalizeOps, pathsFor, auditFile
  };
}

module.exports = { WORLD_SCHEMA, CREATE_SCHEMA, CATALOG_SCHEMA, cleanWorldId, create };
