'use strict';

const path = require('node:path');
const { atomicWriteJson, ensureDir, listJson, readJson, safeId } = require('./storage');
const { seedFromText, deterministicPick } = require('../shared/rng');

function iso() { return new Date().toISOString(); }

function validateWorld(world) {
  if (!world || typeof world !== 'object' || Array.isArray(world)) throw new Error('world-object-required');
  if (world.schema !== 'axm.circuitseed-world-save/v1' || world.schemaVersion !== 1) throw new Error('world-schema-incompatible');
  if (!world.worldId || safeId(world.worldId) !== world.worldId) throw new Error('world-id-invalid');
  if (!Number.isInteger(world.version) || world.version < 1) throw new Error('world-version-invalid');
  for (const field of ['story','settlement','routes','npcState','economy','conditions','instability','resourcesRecovered','localRules']) {
    if (!world[field] || typeof world[field] !== 'object' || Array.isArray(world[field])) throw new Error('world-field-invalid-' + field);
  }
  if (!Array.isArray(world.worldEvents) || !Array.isArray(world.physicalShops)) throw new Error('world-event-lists-invalid');
  return world;
}

function createWorldSave(id = 'local-world', seedText = null) {
  const createdAt = iso();
  const worldSeed = seedFromText(seedText || id + ':' + createdAt);
  return {
    schema: 'axm.circuitseed-world-save/v1', schemaVersion: 1, worldId: safeId(id) || 'local-world', version: 1,
    createdAt, updatedAt: createdAt, worldSeed,
    story: { chapter: 1, stageIndex: 0, completedStages: [], choices: {}, rootSignalState: 'fragmented' },
    settlement: { name: 'Lumen Yard', buildings: ['shared-workshop','return-beacon'], stallSlots: 4, improvements: [] },
    routes: { relayborn: 'unstable', threadwild: 'partly-mapped', corewild: 'contained-boundary', hiddenRoutes: [] },
    npcState: {},
    economy: { demand: { repair: 1, map: 1, translate: 1 }, transactions: [], localOnly: true, centralEconomy: false },
    conditions: {
      dayPhase: deterministicPick(worldSeed, 'day', ['first-light','signal-noon','long-glow','quiet-cycle']),
      weather: deterministicPick(worldSeed, 'weather', ['clear-current','thread-mist','signal-rain','static-wind']),
      signalPressure: 18,
      expeditionModifier: deterministicPick(worldSeed, 'modifier', ['quiet-lattice','signal-storm','open-circuit','root-echo'])
    },
    instability: { relay: 30, thread: 36, core: 48 },
    resourcesRecovered: {}, pointsResolved: [], worldEvents: [], physicalShops: [], localRules: { breakPenalty: false, businessDecayWhileAway: false, aiFillDefault: false },
    lastSafeSnapshot: null
  };
}

class WorldStore {
  constructor(root) { this.root = ensureDir(root); this.snapshotRoot = ensureDir(path.join(root, 'snapshots')); }
  file(id) { const safe = safeId(id); if (!safe) throw new Error('invalid-world-id'); return path.join(this.root, safe + '.json'); }
  get(id) { const world = readJson(this.file(id)); return world ? validateWorld(world) : null; }
  list() {
    return listJson(this.root).map(validateWorld).map(world => ({
      worldId: world.worldId, version: world.version, updatedAt: world.updatedAt,
      stageIndex: world.story?.stageIndex || 0, chapter: world.story?.chapter || 1,
      settlement: world.settlement?.name || 'Unknown settlement'
    })).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  getOrCreate(id, seedText) { const current = this.get(id); if (current) return current; const world = createWorldSave(id, seedText); atomicWriteJson(this.file(world.worldId), world, { backup: false }); return world; }
  save(world, expectedVersion) {
    const current = this.get(world.worldId); if (!current) throw new Error('world-not-found');
    if (Number.isInteger(expectedVersion) && current.version !== expectedVersion) { const e = new Error('world-version-conflict'); e.code = 'WORLD_CONFLICT'; throw e; }
    const next = JSON.parse(JSON.stringify(world)); next.version = current.version + 1; next.updatedAt = iso();
    const snapshotName = safeId(next.worldId) + '-v' + current.version + '-' + Date.now() + '.json';
    atomicWriteJson(path.join(this.snapshotRoot, snapshotName), current, { backup: false });
    next.lastSafeSnapshot = snapshotName;
    atomicWriteJson(this.file(next.worldId), next);
    return next;
  }
  mutate(id, mutator) { const current = this.get(id); if (!current) throw new Error('world-not-found'); const draft = JSON.parse(JSON.stringify(current)); mutator(draft); return this.save(draft, current.version); }
}

module.exports = { WorldStore, createWorldSave, validateWorld };
