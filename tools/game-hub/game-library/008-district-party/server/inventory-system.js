'use strict';

const EQUIPMENT_SLOTS = Object.freeze(['melee', 'ranged', 'ammo', 'shoes', 'body', 'hat']);
const EQUIPMENT_SLOT_SET = new Set(EQUIPMENT_SLOTS);
const BAG_SLOT_COUNT = 12;
const ITEM_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/;
const AMMO_TYPE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,47}$/;
const ITEM_PROPERTY_SET = new Set([
  'id', 'displayName', 'equipSlot', 'ammoType', 'quantity', 'abilities', 'statModifiers', 'metadata',
]);

function emptyEquipment() {
  return Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, null]));
}

function createInventory() {
  return {
    hostOwned: true,
    revision: 0,
    equipment: emptyEquipment(),
    bag: Array(BAG_SLOT_COUNT).fill(null),
    cursor: { container: 'bag', index: 0 },
    selection: null,
  };
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneJsonValue(value) {
  if (Array.isArray(value)) return value.map(cloneJsonValue);
  if (isPlainObject(value)) {
    const clone = Object.create(null);
    for (const [key, entry] of Object.entries(value)) clone[key] = cloneJsonValue(entry);
    return clone;
  }
  return value;
}

function validateJsonValue(value, depth = 0) {
  if (depth > 8) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 64 && value.every((entry) => validateJsonValue(entry, depth + 1));
  if (!isPlainObject(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= 64 && entries.every(([key, entry]) => (
    key.length > 0 && key.length <= 80 && validateJsonValue(entry, depth + 1)
  ));
}

function validateItem(rawItem) {
  const errors = [];
  if (!isPlainObject(rawItem)) return { ok: false, errors: ['item-must-be-an-object'] };

  if (typeof rawItem.id !== 'string' || !ITEM_ID_PATTERN.test(rawItem.id)) errors.push('invalid-id');
  if (typeof rawItem.displayName !== 'string' || rawItem.displayName.trim().length < 1 || rawItem.displayName.trim().length > 80) {
    errors.push('invalid-display-name');
  }
  if (!EQUIPMENT_SLOT_SET.has(rawItem.equipSlot)) errors.push('invalid-equip-slot');
  if (Object.keys(rawItem).some((key) => !ITEM_PROPERTY_SET.has(key))) errors.push('unsupported-property');

  if (rawItem.abilities !== undefined) {
    if (!Array.isArray(rawItem.abilities) || rawItem.abilities.length > 32
      || !rawItem.abilities.every((ability) => isPlainObject(ability) && validateJsonValue(ability))) {
      errors.push('invalid-abilities');
    }
  }

  if (rawItem.statModifiers !== undefined) {
    if (!isPlainObject(rawItem.statModifiers)
      || Object.keys(rawItem.statModifiers).length > 64
      || !Object.values(rawItem.statModifiers).every((value) => typeof value === 'number' && Number.isFinite(value))) {
      errors.push('invalid-stat-modifiers');
    }
  }

  if (rawItem.metadata !== undefined && (!isPlainObject(rawItem.metadata) || !validateJsonValue(rawItem.metadata))) {
    errors.push('invalid-metadata');
  }

  if (rawItem.equipSlot === 'ammo' || rawItem.equipSlot === 'ranged') {
    if (typeof rawItem.ammoType !== 'string' || !AMMO_TYPE_PATTERN.test(rawItem.ammoType)) errors.push('invalid-ammo-type');
  } else if (rawItem.ammoType !== undefined
    && (typeof rawItem.ammoType !== 'string' || !AMMO_TYPE_PATTERN.test(rawItem.ammoType))) {
    errors.push('invalid-ammo-type');
  }

  if (rawItem.equipSlot === 'ammo') {
    if (!Number.isSafeInteger(rawItem.quantity) || rawItem.quantity < 1 || rawItem.quantity > 9999) {
      errors.push('invalid-ammo-quantity');
    }
  } else if (rawItem.quantity !== undefined
    && (!Number.isSafeInteger(rawItem.quantity) || rawItem.quantity < 1 || rawItem.quantity > 9999)) {
    errors.push('invalid-quantity');
  }

  return { ok: errors.length === 0, errors };
}

function normalizeItem(rawItem) {
  const result = validateItem(rawItem);
  if (!result.ok) return { ok: false, reason: 'malformed-item', errors: result.errors };
  const item = {
    id: rawItem.id,
    displayName: rawItem.displayName.trim(),
    equipSlot: rawItem.equipSlot,
  };
  if (rawItem.ammoType !== undefined) item.ammoType = rawItem.ammoType;
  if (rawItem.quantity !== undefined) item.quantity = rawItem.quantity;
  if (rawItem.abilities !== undefined) item.abilities = cloneJsonValue(rawItem.abilities);
  if (rawItem.statModifiers !== undefined) item.statModifiers = cloneJsonValue(rawItem.statModifiers);
  if (rawItem.metadata !== undefined) item.metadata = cloneJsonValue(rawItem.metadata);
  return { ok: true, item };
}

function validateInventory(inventory) {
  if (!isPlainObject(inventory) || !isPlainObject(inventory.equipment)
    || !Array.isArray(inventory.bag) || inventory.bag.length !== BAG_SLOT_COUNT) {
    return { ok: false, reason: 'malformed-inventory' };
  }
  if (!EQUIPMENT_SLOTS.every((slot) => Object.hasOwn(inventory.equipment, slot))) {
    return { ok: false, reason: 'malformed-inventory' };
  }
  const itemIds = new Set();
  const inspectItem = (item, expectedSlot = null) => {
    if (item === null) return null;
    const itemCheck = validateItem(item);
    if (!itemCheck.ok || (expectedSlot && item.equipSlot !== expectedSlot)) return 'malformed-inventory-item';
    if (itemIds.has(item.id)) return 'duplicate-inventory-item';
    itemIds.add(item.id);
    return null;
  };
  for (const slot of EQUIPMENT_SLOTS) {
    const reason = inspectItem(inventory.equipment[slot], slot);
    if (reason) return { ok: false, reason };
  }
  for (const item of inventory.bag) {
    const reason = inspectItem(item);
    if (reason) return { ok: false, reason };
  }
  if (!compatibleRangedAndAmmo(inventory.equipment.ranged, inventory.equipment.ammo)) {
    return { ok: false, reason: 'incompatible-equipped-ammo' };
  }
  return { ok: true };
}

function normalizeLocation(location) {
  if (!isPlainObject(location)) return null;
  if (location.container === 'equipment' && EQUIPMENT_SLOT_SET.has(location.slot)) {
    return { container: 'equipment', slot: location.slot };
  }
  if (location.container === 'bag' && Number.isInteger(location.index)
    && location.index >= 0 && location.index < BAG_SLOT_COUNT) {
    return { container: 'bag', index: location.index };
  }
  return null;
}

function locationKey(location) {
  return location.container === 'equipment' ? `equipment:${location.slot}` : `bag:${location.index}`;
}

function getItemAt(inventory, rawLocation) {
  const location = normalizeLocation(rawLocation);
  if (!location || !validateInventory(inventory).ok) return undefined;
  return location.container === 'equipment'
    ? inventory.equipment[location.slot]
    : inventory.bag[location.index];
}

function setItemAt(inventory, location, item) {
  if (location.container === 'equipment') inventory.equipment[location.slot] = item;
  else inventory.bag[location.index] = item;
}

function findItemLocation(inventory, itemId) {
  if (!validateInventory(inventory).ok || typeof itemId !== 'string') return null;
  for (const slot of EQUIPMENT_SLOTS) {
    if (inventory.equipment[slot]?.id === itemId) return { container: 'equipment', slot };
  }
  const index = inventory.bag.findIndex((item) => item?.id === itemId);
  return index < 0 ? null : { container: 'bag', index };
}

function firstFreeBagIndex(inventory) {
  if (!validateInventory(inventory).ok) return -1;
  return inventory.bag.findIndex((item) => item === null);
}

function compatibleRangedAndAmmo(ranged, ammo) {
  return !ranged || !ammo || ranged.ammoType === ammo.ammoType;
}

/**
 * Build a read-only ammunition view for HUD/state serialization.
 *
 * The provisional sidearm deliberately remains unlimited until a real ranged
 * item is equipped. Once ranged equipment exists, only ammo stacks with its
 * ammoType count. This function never writes to, normalizes, or repairs the
 * authoritative inventory it receives.
 */
function summarizeAmmo(inventory) {
  const ranged = inventory?.equipment?.ranged;
  if (!ranged) {
    return {
      mode: 'provisional-unlimited',
      unlimited: true,
      weaponId: 'pulse-sidearm',
      weaponName: 'Pulse Sidearm',
      ammoType: null,
      loaded: null,
      reserve: null,
      total: null,
    };
  }

  const ammoType = typeof ranged.ammoType === 'string' ? ranged.ammoType : null;
  const equippedAmmo = inventory?.equipment?.ammo;
  const loaded = ammoType && equippedAmmo?.equipSlot === 'ammo'
    && equippedAmmo.ammoType === ammoType
    && Number.isSafeInteger(equippedAmmo.quantity) && equippedAmmo.quantity > 0
    ? equippedAmmo.quantity
    : 0;
  const reserve = ammoType && Array.isArray(inventory?.bag)
    ? inventory.bag.slice(0, BAG_SLOT_COUNT).reduce((total, item) => (
      item?.equipSlot === 'ammo'
      && item.ammoType === ammoType
      && Number.isSafeInteger(item.quantity)
      && item.quantity > 0
        ? total + item.quantity
        : total
    ), 0)
    : 0;

  return {
    mode: 'inventory',
    unlimited: false,
    weaponId: typeof ranged.id === 'string' ? ranged.id : null,
    weaponName: typeof ranged.displayName === 'string' ? ranged.displayName : 'Ranged Weapon',
    ammoType,
    loaded,
    reserve,
    total: loaded + reserve,
  };
}

function itemFitsEquipmentSlot(item, slot) {
  return item === null || (isPlainObject(item) && item.equipSlot === slot);
}

function canEquipItem(inventory, item, slot = item?.equipSlot) {
  if (!EQUIPMENT_SLOT_SET.has(slot) || !itemFitsEquipmentSlot(item, slot)) {
    return { ok: false, reason: 'wrong-equipment-slot' };
  }
  const ranged = slot === 'ranged' ? item : inventory.equipment.ranged;
  const ammo = slot === 'ammo' ? item : inventory.equipment.ammo;
  if (!compatibleRangedAndAmmo(ranged, ammo)) return { ok: false, reason: 'incompatible-ammo' };
  return { ok: true };
}

function incrementRevision(inventory) {
  inventory.revision = Number.isSafeInteger(inventory.revision) ? inventory.revision + 1 : 1;
}

function pickupItem(inventory, rawItem) {
  const stateCheck = validateInventory(inventory);
  if (!stateCheck.ok) return stateCheck;
  const normalized = normalizeItem(rawItem);
  if (!normalized.ok) return normalized;
  const item = normalized.item;
  if (findItemLocation(inventory, item.id)) return { ok: false, reason: 'duplicate-item-id', itemId: item.id };

  if (inventory.equipment[item.equipSlot] === null && canEquipItem(inventory, item).ok) {
    inventory.equipment[item.equipSlot] = item;
    incrementRevision(inventory);
    return {
      ok: true,
      itemId: item.id,
      autoEquipped: true,
      location: { container: 'equipment', slot: item.equipSlot },
      revision: inventory.revision,
    };
  }

  const index = firstFreeBagIndex(inventory);
  if (index < 0) return { ok: false, reason: 'inventory-full', itemId: item.id };
  inventory.bag[index] = item;
  incrementRevision(inventory);
  return {
    ok: true,
    itemId: item.id,
    autoEquipped: false,
    location: { container: 'bag', index },
    revision: inventory.revision,
  };
}

function prospectiveEquipment(inventory, locationA, itemAAfter, locationB, itemBAfter) {
  const next = { ...inventory.equipment };
  if (locationA.container === 'equipment') next[locationA.slot] = itemAAfter;
  if (locationB.container === 'equipment') next[locationB.slot] = itemBAfter;
  return next;
}

function swapLocations(inventory, rawLocationA, rawLocationB) {
  const stateCheck = validateInventory(inventory);
  if (!stateCheck.ok) return stateCheck;
  const locationA = normalizeLocation(rawLocationA);
  const locationB = normalizeLocation(rawLocationB);
  if (!locationA || !locationB) return { ok: false, reason: 'invalid-location' };
  if (locationKey(locationA) === locationKey(locationB)) {
    return { ok: true, unchanged: true, revision: inventory.revision };
  }

  const itemA = getItemAt(inventory, locationA);
  const itemB = getItemAt(inventory, locationB);
  if (itemA == null && itemB == null) return { ok: false, reason: 'both-locations-empty' };
  if (locationA.container === 'equipment' && !itemFitsEquipmentSlot(itemB, locationA.slot)) {
    return { ok: false, reason: 'wrong-equipment-slot' };
  }
  if (locationB.container === 'equipment' && !itemFitsEquipmentSlot(itemA, locationB.slot)) {
    return { ok: false, reason: 'wrong-equipment-slot' };
  }

  const nextEquipment = prospectiveEquipment(inventory, locationA, itemB, locationB, itemA);
  if (!compatibleRangedAndAmmo(nextEquipment.ranged, nextEquipment.ammo)) {
    return { ok: false, reason: 'incompatible-ammo' };
  }

  setItemAt(inventory, locationA, itemB ?? null);
  setItemAt(inventory, locationB, itemA ?? null);
  incrementRevision(inventory);
  return {
    ok: true,
    from: locationA,
    to: locationB,
    revision: inventory.revision,
  };
}

function equipFromBag(inventory, bagIndex, requestedSlot = null) {
  const stateCheck = validateInventory(inventory);
  if (!stateCheck.ok) return stateCheck;
  const location = normalizeLocation({ container: 'bag', index: bagIndex });
  if (!location) return { ok: false, reason: 'invalid-location' };
  const item = getItemAt(inventory, location);
  if (!item) return { ok: false, reason: 'bag-slot-empty' };
  const slot = requestedSlot || item.equipSlot;
  if (slot !== item.equipSlot || !EQUIPMENT_SLOT_SET.has(slot)) {
    return { ok: false, reason: 'wrong-equipment-slot' };
  }
  return swapLocations(inventory, location, { container: 'equipment', slot });
}

function unequipToBag(inventory, slot, requestedBagIndex = null) {
  const stateCheck = validateInventory(inventory);
  if (!stateCheck.ok) return stateCheck;
  if (!EQUIPMENT_SLOT_SET.has(slot)) return { ok: false, reason: 'invalid-equipment-slot' };
  const item = inventory.equipment?.[slot];
  if (!item) return { ok: false, reason: 'equipment-slot-empty' };
  const automaticDestination = requestedBagIndex === null || requestedBagIndex === undefined;
  let index = automaticDestination ? firstFreeBagIndex(inventory) : requestedBagIndex;
  if (!Number.isInteger(index) || index < 0 || index >= BAG_SLOT_COUNT) {
    return { ok: false, reason: automaticDestination && index < 0 ? 'inventory-full' : 'invalid-location' };
  }
  if (inventory.bag[index] !== null) return { ok: false, reason: 'bag-slot-occupied' };
  return swapLocations(inventory, { container: 'equipment', slot }, { container: 'bag', index });
}

function swapBagSlots(inventory, firstIndex, secondIndex) {
  return swapLocations(
    inventory,
    { container: 'bag', index: firstIndex },
    { container: 'bag', index: secondIndex },
  );
}

function setCursor(inventory, rawLocation) {
  const stateCheck = validateInventory(inventory);
  if (!stateCheck.ok) return stateCheck;
  const location = normalizeLocation(rawLocation);
  if (!location) return { ok: false, reason: 'invalid-location' };
  inventory.cursor = location;
  incrementRevision(inventory);
  return { ok: true, cursor: { ...location }, revision: inventory.revision };
}

function selectAtCursor(inventory) {
  const stateCheck = validateInventory(inventory);
  if (!stateCheck.ok) return stateCheck;
  const location = normalizeLocation(inventory.cursor);
  if (!location) return { ok: false, reason: 'invalid-cursor' };
  const item = getItemAt(inventory, location);
  if (!item) return { ok: false, reason: 'empty-selection' };
  inventory.selection = { location: { ...location }, itemId: item.id };
  incrementRevision(inventory);
  return { ok: true, selection: cloneJsonValue(inventory.selection), revision: inventory.revision };
}

function cancelSelection(inventory) {
  const stateCheck = validateInventory(inventory);
  if (!stateCheck.ok) return stateCheck;
  if (!inventory.selection) return { ok: true, unchanged: true, revision: inventory.revision };
  inventory.selection = null;
  incrementRevision(inventory);
  return { ok: true, revision: inventory.revision };
}

function placeSelectionAtCursor(inventory) {
  const stateCheck = validateInventory(inventory);
  if (!stateCheck.ok) return stateCheck;
  if (!inventory.selection) return { ok: false, reason: 'nothing-selected' };
  const source = normalizeLocation(inventory.selection.location);
  const destination = normalizeLocation(inventory.cursor);
  const selectedItem = source ? getItemAt(inventory, source) : null;
  if (!source || !selectedItem || selectedItem.id !== inventory.selection.itemId) {
    inventory.selection = null;
    incrementRevision(inventory);
    return { ok: false, reason: 'stale-selection', revision: inventory.revision };
  }
  const result = swapLocations(inventory, source, destination);
  if (result.ok) {
    inventory.selection = null;
    incrementRevision(inventory);
    result.revision = inventory.revision;
  }
  return result;
}

function autoEquipCompatibleAmmo(inventory, requestedAmmoType = null) {
  const stateCheck = validateInventory(inventory);
  if (!stateCheck.ok) return stateCheck;
  const ammoType = requestedAmmoType ?? inventory.equipment.ranged?.ammoType;
  if (inventory.equipment.ammo) {
    return { ok: false, reason: 'ammo-slot-occupied' };
  }
  if (typeof ammoType !== 'string' || !AMMO_TYPE_PATTERN.test(ammoType)) {
    return { ok: false, reason: 'invalid-ammo-type' };
  }
  const index = inventory.bag.findIndex((item) => (
    item?.equipSlot === 'ammo' && item.ammoType === ammoType && Number.isSafeInteger(item.quantity) && item.quantity > 0
  ));
  if (index < 0) return { ok: false, reason: 'no-compatible-ammo' };
  const item = inventory.bag[index];
  inventory.bag[index] = null;
  inventory.equipment.ammo = item;
  incrementRevision(inventory);
  return {
    ok: true,
    itemId: item.id,
    fromBagIndex: index,
    quantity: item.quantity,
    revision: inventory.revision,
  };
}

function consumeEquippedAmmo(inventory, amount = 1) {
  const stateCheck = validateInventory(inventory);
  if (!stateCheck.ok) return stateCheck;
  if (!Number.isSafeInteger(amount) || amount < 1) return { ok: false, reason: 'invalid-consume-amount' };
  const ranged = inventory.equipment.ranged;
  if (!ranged) return { ok: false, reason: 'no-ranged-weapon' };
  const ammo = inventory.equipment.ammo;
  if (!ammo) return { ok: false, reason: 'no-equipped-ammo' };
  if (ammo.ammoType !== ranged.ammoType) return { ok: false, reason: 'incompatible-ammo' };
  if (!Number.isSafeInteger(ammo.quantity) || ammo.quantity < amount) {
    return { ok: false, reason: 'insufficient-ammo', available: ammo.quantity || 0 };
  }

  ammo.quantity -= amount;
  incrementRevision(inventory);
  if (ammo.quantity > 0) {
    return {
      ok: true,
      consumed: amount,
      depletedItemId: null,
      autoEquippedItemId: null,
      remainingQuantity: ammo.quantity,
      revision: inventory.revision,
    };
  }

  const depletedItemId = ammo.id;
  inventory.equipment.ammo = null;
  incrementRevision(inventory);
  const reload = autoEquipCompatibleAmmo(inventory, ranged.ammoType);
  return {
    ok: true,
    consumed: amount,
    depletedItemId,
    autoEquippedItemId: reload.ok ? reload.itemId : null,
    remainingQuantity: reload.ok ? inventory.equipment.ammo.quantity : 0,
    reloadReason: reload.ok ? null : reload.reason,
    revision: inventory.revision,
  };
}

module.exports = {
  AMMO_TYPE_PATTERN,
  BAG_SLOT_COUNT,
  EQUIPMENT_SLOTS,
  autoEquipCompatibleAmmo,
  cancelSelection,
  canEquipItem,
  compatibleRangedAndAmmo,
  consumeEquippedAmmo,
  createInventory,
  equipFromBag,
  findItemLocation,
  firstFreeBagIndex,
  getItemAt,
  normalizeItem,
  normalizeLocation,
  pickupItem,
  placeSelectionAtCursor,
  selectAtCursor,
  setCursor,
  summarizeAmmo,
  swapBagSlots,
  swapLocations,
  unequipToBag,
  validateInventory,
  validateItem,
};
