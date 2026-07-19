'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { partyIdForSlot } = require('../foundation-adapter/party-mapper');
const { FUND_MAX_CENTS, normalizeCents } = require('./economy-system');
const { createInventory, validateInventory } = require('./inventory-system');

const GROUP_SAVE_FORMAT = 'AXM_GROUP_SAVE_V1';
const GROUP_SAVE_SCHEMA_VERSION = 1;
const GROUP_SAVE_SLOT_COUNT = 9;
const GROUP_SAVE_FILE_MAX_BYTES = 256 * 1024;
const GROUP_SAVE_ROSTER_MAX = 8;

class GroupSaveError extends Error {
  constructor(message, code = 'GROUP_SAVE_ERROR', details = null) {
    super(message);
    this.name = 'GroupSaveError';
    this.code = code;
    this.details = details;
  }
}

function assertSaveSlot(slot) {
  const value = Number(slot);
  if (!Number.isInteger(value) || value < 1 || value > GROUP_SAVE_SLOT_COUNT) {
    throw new GroupSaveError(`Save slot must be between 1 and ${GROUP_SAVE_SLOT_COUNT}.`, 'INVALID_SAVE_SLOT');
  }
  return value;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanInventoryForSave(inventory) {
  if (!validateInventory(inventory).ok) return createInventory();
  const saved = cloneJson(inventory);
  saved.hostOwned = true;
  saved.cursor = { container: 'bag', index: 0 };
  saved.selection = null;
  return saved;
}

function cleanRivalGangForSave(rivalGang = {}) {
  return {
    id: typeof rivalGang.id === 'string' ? rivalGang.id.slice(0, 64) : 'neon-rivals',
    enabled: rivalGang.enabled !== false,
    pressure: Math.max(0, Math.min(100, Math.round(Number(rivalGang.pressure) || 0))),
    progress: Math.max(0, Math.min(1_000_000, Math.round(Number(rivalGang.progress) || 0))),
    territoryProgress: Math.max(0, Math.min(1_000_000, Math.round(Number(rivalGang.territoryProgress) || 0))),
  };
}

function createGroupSaveSnapshot(world, slot, options = {}) {
  const saveSlot = assertSaveSlot(slot);
  const actors = Object.values(world?.actors || {}).sort((a, b) => Number(a.slot) - Number(b.slot));
  if (actors.length < 1 || actors.length > GROUP_SAVE_ROSTER_MAX) {
    throw new GroupSaveError('A group save requires between one and eight active seat actors.', 'INVALID_SAVE_ROSTER');
  }
  const seatSlots = actors.map((actor) => Number(actor.slot));
  if (seatSlots.some((value) => !Number.isInteger(value) || value < 1 || value > GROUP_SAVE_ROSTER_MAX)
    || new Set(seatSlots).size !== seatSlots.length) {
    throw new GroupSaveError('The active world has an invalid or duplicate seat roster.', 'INVALID_SAVE_ROSTER');
  }
  const now = typeof options.now === 'string' ? options.now : new Date().toISOString();
  const partyDistribution = actors.reduce((counts, actor) => {
    const partyId = partyIdForSlot(actor.slot);
    counts[partyId] = (counts[partyId] || 0) + 1;
    return counts;
  }, { party_a: 0, party_b: 0 });
  return {
    format: GROUP_SAVE_FORMAT,
    schemaVersion: GROUP_SAVE_SCHEMA_VERSION,
    slot: saveSlot,
    createdAt: now,
    updatedAt: now,
    buildVersion: String(options.buildVersion || 'unknown').slice(0, 96),
    mode: world.mode === 'district_dominion' ? 'district_dominion' : 'coop_adventure',
    roster: {
      seatCount: seatSlots.length,
      seatSlots,
      partyDistribution,
    },
    perSeat: actors.map((actor) => ({
      slot: Number(actor.slot),
      partyId: partyIdForSlot(actor.slot),
      walletCents: normalizeCents(actor.walletCents),
      inventory: cleanInventoryForSave(actor.inventory),
      career: {
        deliveries: Math.max(0, Math.round(Number(actor.career?.deliveries) || 0)),
        missionsCompleted: Math.max(0, Math.round(Number(actor.career?.missionsCompleted) || 0)),
      },
    })),
    group: {
      partyFunds: {
        party_a: normalizeCents(world.economy?.partyFunds?.party_a),
        party_b: normalizeCents(world.economy?.partyFunds?.party_b),
      },
      lifetimePartyIncome: {
        party_a: normalizeCents(world.economy?.lifetimePartyIncome?.party_a),
        party_b: normalizeCents(world.economy?.lifetimePartyIncome?.party_b),
      },
      rivalGang: cleanRivalGangForSave(world.rivalGang),
    },
  };
}

function validateGroupSave(rawSave, expectedSlot = null) {
  const errors = [];
  if (!rawSave || typeof rawSave !== 'object' || Array.isArray(rawSave)) {
    return { ok: false, errors: ['save-must-be-an-object'] };
  }
  if (rawSave.format !== GROUP_SAVE_FORMAT) errors.push('unsupported-format');
  if (rawSave.schemaVersion !== GROUP_SAVE_SCHEMA_VERSION) errors.push('unsupported-schema-version');
  let slot;
  try { slot = assertSaveSlot(rawSave.slot); } catch { errors.push('invalid-save-slot'); }
  if (expectedSlot !== null && slot !== Number(expectedSlot)) errors.push('slot-file-mismatch');
  if (!['coop_adventure', 'district_dominion'].includes(rawSave.mode)) errors.push('invalid-mode');
  if (typeof rawSave.createdAt !== 'string' || !Number.isFinite(Date.parse(rawSave.createdAt))) errors.push('invalid-created-at');
  if (typeof rawSave.updatedAt !== 'string' || !Number.isFinite(Date.parse(rawSave.updatedAt))) errors.push('invalid-updated-at');

  const seatCount = Number(rawSave.roster?.seatCount);
  const seatSlots = rawSave.roster?.seatSlots;
  if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > GROUP_SAVE_ROSTER_MAX) errors.push('invalid-seat-count');
  if (!Array.isArray(seatSlots) || seatSlots.length !== seatCount
    || seatSlots.some((value) => !Number.isInteger(value) || value < 1 || value > GROUP_SAVE_ROSTER_MAX)
    || new Set(seatSlots || []).size !== (seatSlots || []).length) errors.push('invalid-seat-slots');
  if (Array.isArray(seatSlots) && !seatSlots.every((value, index) => index === 0 || seatSlots[index - 1] < value)) {
    errors.push('seat-slots-not-sorted');
  }
  const expectedDistribution = { party_a: 0, party_b: 0 };
  for (const savedSlot of Array.isArray(seatSlots) ? seatSlots : []) {
    const partyId = partyIdForSlot(savedSlot);
    if (partyId) expectedDistribution[partyId] += 1;
  }
  if (rawSave.roster?.partyDistribution?.party_a !== expectedDistribution.party_a
    || rawSave.roster?.partyDistribution?.party_b !== expectedDistribution.party_b) errors.push('invalid-party-distribution');

  if (!Array.isArray(rawSave.perSeat) || rawSave.perSeat.length !== seatCount) {
    errors.push('invalid-seat-progress');
  } else {
    const progressSlots = new Set();
    for (const progress of rawSave.perSeat) {
      if (!progress || typeof progress !== 'object' || Array.isArray(progress)) {
        errors.push('invalid-seat-progress-entry');
        continue;
      }
      if (!Number.isInteger(progress.slot) || !seatSlots?.includes(progress.slot) || progressSlots.has(progress.slot)) {
        errors.push('invalid-seat-progress-slot');
      }
      progressSlots.add(progress.slot);
      if (progress.partyId !== partyIdForSlot(progress.slot)) errors.push('invalid-seat-progress-party');
      if (!Number.isInteger(progress.walletCents) || progress.walletCents < 0 || progress.walletCents > FUND_MAX_CENTS) {
        errors.push('invalid-seat-wallet');
      }
      if (!validateInventory(progress.inventory).ok) errors.push('invalid-seat-inventory');
      if (progress.career && (
        !Number.isInteger(progress.career.deliveries) || progress.career.deliveries < 0
        || !Number.isInteger(progress.career.missionsCompleted) || progress.career.missionsCompleted < 0
      )) errors.push('invalid-seat-career');
    }
  }

  for (const collection of [rawSave.group?.partyFunds, rawSave.group?.lifetimePartyIncome]) {
    if (!collection || !['party_a', 'party_b'].every((partyId) => (
      Number.isInteger(collection[partyId]) && collection[partyId] >= 0 && collection[partyId] <= FUND_MAX_CENTS
    ))) errors.push('invalid-group-funds');
  }
  if (!rawSave.group?.rivalGang || typeof rawSave.group.rivalGang !== 'object') errors.push('invalid-rival-progress');

  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function applyGroupSaveToWorld(world, save) {
  const check = validateGroupSave(save, save.slot);
  if (!check.ok) throw new GroupSaveError('The selected group save failed validation.', 'INVALID_GROUP_SAVE', check.errors);
  const progressBySlot = new Map(save.perSeat.map((entry) => [entry.slot, entry]));
  for (const actor of Object.values(world.actors)) {
    const progress = progressBySlot.get(Number(actor.slot));
    if (!progress) throw new GroupSaveError(`Save data for seat_${actor.slot} is missing.`, 'SAVE_ROSTER_MISMATCH');
    actor.walletCents = normalizeCents(progress.walletCents);
    actor.inventory = cleanInventoryForSave(progress.inventory);
    actor.inventoryOpen = false;
    actor.career = {
      deliveries: Math.max(0, Math.round(Number(progress.career?.deliveries) || 0)),
      missionsCompleted: Math.max(0, Math.round(Number(progress.career?.missionsCompleted) || 0)),
    };
  }
  world.economy.partyFunds = {
    party_a: normalizeCents(save.group.partyFunds.party_a),
    party_b: normalizeCents(save.group.partyFunds.party_b),
  };
  world.economy.lifetimePartyIncome = {
    party_a: normalizeCents(save.group.lifetimePartyIncome.party_a),
    party_b: normalizeCents(save.group.lifetimePartyIncome.party_b),
  };
  world.economy.recentTransactions = [];
  world.rivalGang = { ...world.rivalGang, ...cleanRivalGangForSave(save.group.rivalGang) };
  world.loadedGroupSave = {
    slot: save.slot,
    seatCount: save.roster.seatCount,
    seatSlots: [...save.roster.seatSlots],
    loadedAt: new Date().toISOString(),
  };
  return world;
}

function checksumFor(save) {
  return crypto.createHash('sha256').update(JSON.stringify(save)).digest('hex');
}

function sameRoster(first, second) {
  return first?.seatCount === second?.seatCount
    && Array.isArray(first?.seatSlots)
    && Array.isArray(second?.seatSlots)
    && first.seatSlots.length === second.seatSlots.length
    && first.seatSlots.every((slot, index) => slot === second.seatSlots[index]);
}

function summaryFor(slot, result) {
  if (!result || result.status !== 'ready') {
    return { slot, status: result?.status === 'corrupt' ? 'corrupt' : 'empty' };
  }
  const save = result.save;
  return {
    slot,
    status: 'ready',
    mode: save.mode,
    seatCount: save.roster.seatCount,
    seatSlots: [...save.roster.seatSlots],
    partyDistribution: { ...save.roster.partyDistribution },
    createdAt: save.createdAt,
    updatedAt: save.updatedAt,
    totalPersonalFundsCents: save.perSeat.reduce((sum, entry) => Math.min(FUND_MAX_CENTS, sum + entry.walletCents), 0),
    partyFunds: { ...save.group.partyFunds },
  };
}

class GroupSaveStore {
  constructor(options = {}) {
    if (!options.projectRoot && !options.storageDirectory) {
      throw new GroupSaveError('GroupSaveStore requires a project root or storage directory.', 'SAVE_STORAGE_REQUIRED');
    }
    this.directory = path.resolve(options.storageDirectory || path.join(options.projectRoot, 'local-data', 'group-saves'));
  }

  slotPath(slot) {
    return path.join(this.directory, `save-slot-${assertSaveSlot(slot)}.json`);
  }

  readSlot(slot) {
    const saveSlot = assertSaveSlot(slot);
    const filePath = this.slotPath(saveSlot);
    let stats;
    try { stats = fs.lstatSync(filePath); } catch (error) {
      if (error.code === 'ENOENT') return { slot: saveSlot, status: 'empty' };
      return { slot: saveSlot, status: 'corrupt', error: 'unreadable-save' };
    }
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size < 2 || stats.size > GROUP_SAVE_FILE_MAX_BYTES) {
      return { slot: saveSlot, status: 'corrupt', error: 'unsafe-or-oversized-save' };
    }
    try {
      const envelope = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const save = envelope?.save;
      const check = validateGroupSave(save, saveSlot);
      if (envelope?.format !== GROUP_SAVE_FORMAT || typeof envelope.checksum !== 'string'
        || checksumFor(save) !== envelope.checksum || !check.ok) {
        return { slot: saveSlot, status: 'corrupt', error: 'invalid-save-integrity' };
      }
      return { slot: saveSlot, status: 'ready', save };
    } catch {
      return { slot: saveSlot, status: 'corrupt', error: 'malformed-save-json' };
    }
  }

  catalog() {
    return Array.from({ length: GROUP_SAVE_SLOT_COUNT }, (_, index) => {
      const slot = index + 1;
      return summaryFor(slot, this.readSlot(slot));
    });
  }

  writeSlot(slot, rawSave) {
    const saveSlot = assertSaveSlot(slot);
    const save = cloneJson(rawSave);
    save.slot = saveSlot;
    const existing = this.readSlot(saveSlot);
    if (existing.status === 'ready') {
      if (!sameRoster(existing.save.roster, save.roster)) {
        throw new GroupSaveError(
          `Save slot ${saveSlot} is locked to its original ${existing.save.roster.seatCount}-seat roster.`,
          'SAVE_ROSTER_LOCKED',
          { slot: saveSlot, seatSlots: existing.save.roster.seatSlots },
        );
      }
      save.createdAt = existing.save.createdAt;
    }
    save.updatedAt = new Date().toISOString();
    const check = validateGroupSave(save, saveSlot);
    if (!check.ok) throw new GroupSaveError('Group save failed validation and was not written.', 'INVALID_GROUP_SAVE', check.errors);
    const envelope = { format: GROUP_SAVE_FORMAT, checksum: checksumFor(save), save };
    const serialized = `${JSON.stringify(envelope, null, 2)}\n`;
    if (Buffer.byteLength(serialized) > GROUP_SAVE_FILE_MAX_BYTES) {
      throw new GroupSaveError('Group save exceeds the local size limit.', 'SAVE_TOO_LARGE');
    }
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const temporaryPath = path.join(this.directory, `.save-slot-${saveSlot}-${process.pid}-${Date.now()}.tmp`);
    try {
      fs.writeFileSync(temporaryPath, serialized, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      fs.renameSync(temporaryPath, this.slotPath(saveSlot));
    } finally {
      try { fs.unlinkSync(temporaryPath); } catch { /* Atomic rename or failed creation leaves nothing to remove. */ }
    }
    return { ok: true, slot: saveSlot, save, summary: summaryFor(saveSlot, { status: 'ready', save }) };
  }
}

module.exports = {
  GROUP_SAVE_FILE_MAX_BYTES,
  GROUP_SAVE_FORMAT,
  GROUP_SAVE_ROSTER_MAX,
  GROUP_SAVE_SCHEMA_VERSION,
  GROUP_SAVE_SLOT_COUNT,
  GroupSaveError,
  GroupSaveStore,
  applyGroupSaveToWorld,
  assertSaveSlot,
  checksumFor,
  cleanInventoryForSave,
  createGroupSaveSnapshot,
  sameRoster,
  summaryFor,
  validateGroupSave,
};
