'use strict';

const fs = require('fs');
const path = require('path');
const U = require('./operations-utils');
const Multiworld = require('./multiworld-state-service');

const SCHEMA = 'axm.living-world-state/v1';
function initialWorld() { return { schema: SCHEMA, worldId: 'living-globe', owner: 'living-world-state-server', revision: 0, createdAt: U.now(), updatedAt: U.now(), facts: { season: 'temperate', day: 1 }, entities: [], journal: [], lastSnapshotId: null }; }

function create(options) {
  const stateDir = path.join(options.stateRoot, 'living-world-state-server'), stateFile = path.join(stateDir, 'world.json'), snapshotsDir = path.join(stateDir, 'snapshots'), auditFile = path.join(stateDir, 'audit.jsonl');
  const namedWorlds = Multiworld.create(options);
  function read() { const state = U.loadJson(stateFile, null); if (state && state.schema === SCHEMA) return state; const seed = initialWorld(); write(seed); return seed; }
  function write(state) { state.updatedAt = U.now(); U.atomicJson(stateFile, state); }
  function audit(event) { U.appendJsonl(auditFile, Object.assign({ at: U.now() }, event)); }
  function digest(state) { const view = U.clone(state); delete view.journal; return U.sha256(JSON.stringify(view)); }
  function snapshot(actor, reason, sourceState) {
    const world = U.clone(sourceState || read()), id = U.uid('world-snapshot'), file = path.join(snapshotsDir, id + '.json'), record = { schema: 'axm.living-world-snapshot/v1', id, worldId: world.worldId, revision: world.revision, owner: world.owner, reason: String(reason || 'manual snapshot').slice(0, 300), actor: String(actor || 'local-user').slice(0, 120), createdAt: U.now(), worldDigest: digest(world), world };
    U.atomicJson(file, record); if (!sourceState) { world.lastSnapshotId = id; write(world); } audit({ type: 'snapshot', id, revision: world.revision, digest: record.worldDigest, actor: record.actor }); return Object.assign({}, record, { world: undefined, file: path.relative(options.root, file).replace(/\\/g, '/') });
  }
  function validateEntity(raw) {
    const body = raw || {}, id = U.cleanId(body.id, 'entity id'), kind = U.cleanId(body.kind || 'object', 'entity kind'), data = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? U.clone(body.data) : {};
    const encoded = JSON.stringify(data); if (encoded.length > 50000) throw new Error('world entity exceeds 50 KB'); if (/(?:password|secret|token|privateKey)/i.test(Object.keys(data).join(' '))) throw new Error('secret-like world entity field refused'); return { id, kind, data };
  }
  function normalizeOps(raw) {
    const list = Array.isArray(raw) ? raw : []; if (!list.length || list.length > 50) throw new Error('world patch needs 1 to 50 operations');
    return list.map(item => {
      const type = String(item && item.type || '');
      if (type === 'upsert-entity') return { type, entity: validateEntity(item.entity) };
      if (type === 'remove-entity') return { type, id: U.cleanId(item.id, 'entity id') };
      if (type === 'set-fact') { const key = U.cleanId(item.key, 'fact key'), value = item.value; if (JSON.stringify(value).length > 10000) throw new Error('world fact exceeds 10 KB'); return { type, key, value: U.clone(value) }; }
      throw new Error('world operation is not allowlisted');
    });
  }
  function apply(input, actor) {
    const body = input || {}, world = read(), expected = Number(body.expectedRevision); if (!Number.isInteger(expected)) throw new Error('expectedRevision is required'); if (expected !== world.revision) throw new Error('world revision conflict: expected ' + expected + ', current ' + world.revision); if (body.owner && body.owner !== world.owner) throw new Error('world ownership cannot be changed by a patch');
    const ops = normalizeOps(body.operations), before = digest(world), changes = [];
    for (const op of ops) {
      if (op.type === 'upsert-entity') { const index = world.entities.findIndex(x => x.id === op.entity.id), next = Object.assign({}, op.entity, { updatedAt: U.now() }); if (index >= 0) world.entities[index] = next; else world.entities.push(Object.assign({ createdAt: U.now() }, next)); changes.push({ type: op.type, id: op.entity.id }); }
      else if (op.type === 'remove-entity') { const beforeCount = world.entities.length; world.entities = world.entities.filter(x => x.id !== op.id); if (world.entities.length === beforeCount) throw new Error('world entity not found: ' + op.id); changes.push({ type: op.type, id: op.id }); }
      else { world.facts[op.key] = op.value; changes.push({ type: op.type, key: op.key }); }
    }
    world.revision += 1; const event = { schema: 'axm.living-world-change/v1', id: U.uid('world-change'), revision: world.revision, previousDigest: before, actor: String(actor || 'local-user').slice(0, 120), source: String(body.source || 'direct-explicit-patch').slice(0, 120), changes, at: U.now() }; world.journal.push(event); world.journal = world.journal.slice(-1000); event.worldDigest = digest(world); write(world); audit({ type: 'patch', revision: world.revision, actor: event.actor, source: event.source, digest: event.worldDigest, changes: changes.length }); return { world: publicWorld(world), event };
  }
  function publicWorld(world) { const state = U.clone(world || read()); return Object.assign(state, { digest: digest(state), etag: 'W/"world-' + state.revision + '-' + digest(state).slice(0, 12) + '"' }); }
  function changes(since) { const world = read(), revision = Math.max(-1, Number(since) || 0); return { schema: 'axm.living-world-changes/v1', worldId: world.worldId, fromRevision: revision, toRevision: world.revision, changes: world.journal.filter(x => x.revision > revision), resyncRequired: world.journal.length > 0 && revision < world.journal[0].revision - 1 }; }
  function listSnapshots() { if (!fs.existsSync(snapshotsDir)) return []; return fs.readdirSync(snapshotsDir).filter(x => x.endsWith('.json')).map(name => { const item = U.loadJson(path.join(snapshotsDir, name), null); return item ? { id: item.id, revision: item.revision, owner: item.owner, reason: item.reason, actor: item.actor, createdAt: item.createdAt, worldDigest: item.worldDigest } : null; }).filter(Boolean).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)); }
  function previewRestore(id, actor) { const snapshotFile = path.join(snapshotsDir, U.cleanId(id, 'snapshot id') + '.json'), item = U.loadJson(snapshotFile, null); if (!item || item.schema !== 'axm.living-world-snapshot/v1') throw new Error('world snapshot not found'); const current = read(), preview = { schema: 'axm.world-restore-preview/v1', id: U.uid('world-restore-preview'), snapshotId: item.id, fromRevision: current.revision, toRevision: item.revision, currentDigest: digest(current), snapshotDigest: item.worldDigest, entityDelta: item.world.entities.length - current.entities.length, actor: String(actor || 'local-user').slice(0, 120), createdAt: U.now(), expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() }; U.atomicJson(path.join(stateDir, 'restore-previews', preview.id + '.json'), preview); return preview; }
  function restore(previewId, confirmation, actor) { if (confirmation !== 'RESTORE LIVING WORLD') throw new Error('exact world restore confirmation is required'); const preview = U.loadJson(path.join(stateDir, 'restore-previews', U.cleanId(previewId, 'preview id') + '.json'), null); if (!preview || Date.parse(preview.expiresAt) <= Date.now()) throw new Error('world restore preview not found or expired'); const current = read(); if (digest(current) !== preview.currentDigest) throw new Error('world changed after restore preview'); snapshot(actor, 'automatic pre-restore safety snapshot', current); const item = U.loadJson(path.join(snapshotsDir, preview.snapshotId + '.json'), null); if (!item || digest(item.world) !== item.worldDigest) throw new Error('world snapshot digest is invalid'); const restored = U.clone(item.world); restored.revision = current.revision + 1; restored.owner = 'living-world-state-server'; restored.journal = current.journal.concat({ schema: 'axm.living-world-change/v1', id: U.uid('world-change'), revision: restored.revision, previousDigest: preview.currentDigest, actor: String(actor || 'local-user').slice(0, 120), source: 'snapshot-restore', changes: [{ type: 'restore-snapshot', snapshotId: item.id }], at: U.now(), worldDigest: item.worldDigest }).slice(-1000); write(restored); audit({ type: 'restore', snapshotId: item.id, revision: restored.revision, actor }); return publicWorld(restored); }
  function status() { const world = publicWorld(read()); return { schema: SCHEMA, world: { worldId: world.worldId, owner: world.owner, revision: world.revision, digest: world.digest, entities: world.entities.length, facts: Object.keys(world.facts).length, updatedAt: world.updatedAt }, snapshots: listSnapshots(), synchronization: { mode: 'revision-poll', conflictDetection: 'expected-revision', journalLimit: 1000 }, automaticReset: false }; }
  function isNamed(worldId) { return worldId && String(worldId) !== 'living-globe'; }
  function listWorlds() {
    const legacy = publicWorld(read());
    return [{ worldId: legacy.worldId, owner: legacy.owner, revision: legacy.revision, entities: legacy.entities.length, facts: Object.keys(legacy.facts).length, updatedAt: legacy.updatedAt, digest: legacy.digest, compatibilitySlot: true }].concat(namedWorlds.list());
  }
  function multiStatus() {
    const legacy = status(), worlds = listWorlds();
    return Object.assign({}, legacy, { multiworld: true, defaultWorldId: 'living-globe', worldCount: worlds.length, worlds });
  }
  return {
    status: multiStatus,
    get: worldId => isNamed(worldId) ? namedWorlds.get(worldId) : publicWorld(read()),
    changes: (since, worldId) => isNamed(worldId) ? namedWorlds.changes(since, worldId) : changes(since),
    apply: (input, actor) => isNamed(input && input.worldId) ? namedWorlds.apply(input, actor) : apply(input, actor),
    snapshot: (actor, reason, worldId) => isNamed(worldId) ? namedWorlds.snapshot(actor, reason, worldId) : snapshot(actor, reason),
    listSnapshots: worldId => isNamed(worldId) ? namedWorlds.listSnapshots(worldId) : listSnapshots(),
    previewRestore: (id, actor, worldId) => isNamed(worldId) ? namedWorlds.previewRestore(id, actor, worldId) : previewRestore(id, actor),
    restore: (previewId, confirmation, actor, worldId) => isNamed(worldId) ? namedWorlds.restore(previewId, confirmation, actor, worldId) : restore(previewId, confirmation, actor),
    createWorld: namedWorlds.createWorld,
    listWorlds,
    normalizeOps,
    stateFile,
    auditFile,
    namedWorlds
  };
}

module.exports = { SCHEMA, initialWorld, create, CREATE_SCHEMA: Multiworld.CREATE_SCHEMA };
