'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BAG_SLOT_COUNT,
  EQUIPMENT_SLOTS,
  autoEquipCompatibleAmmo,
  cancelSelection,
  consumeEquippedAmmo,
  createInventory,
  equipFromBag,
  findItemLocation,
  pickupItem,
  placeSelectionAtCursor,
  selectAtCursor,
  setCursor,
  summarizeAmmo,
  swapBagSlots,
  swapLocations,
  unequipToBag,
  validateItem,
} = require('../server/inventory-system');

function item(id, equipSlot, extra = {}) {
  return { id, displayName: `Test ${id}`, equipSlot, ...extra };
}

function ranged(id, ammoType = 'test-energy') {
  return item(id, 'ranged', { ammoType });
}

function ammo(id, quantity, ammoType = 'test-energy') {
  return item(id, 'ammo', { ammoType, quantity });
}

test('new inventory has six named equipment slots and exactly twelve bag slots', () => {
  const inventory = createInventory();
  assert.deepEqual(Object.keys(inventory.equipment), EQUIPMENT_SLOTS);
  assert.equal(inventory.bag.length, BAG_SLOT_COUNT);
  assert.ok(inventory.bag.every((entry) => entry === null));
  assert.equal(inventory.hostOwned, true);
  assert.deepEqual(inventory.cursor, { container: 'bag', index: 0 });
});

test('item validation accepts extension seams and rejects malformed slot, ammo, quantity, and modifiers', () => {
  assert.equal(validateItem(item('valid-body', 'body', {
    abilities: [{ id: 'future-ability', tuning: { scale: 0.25 } }],
    statModifiers: { futureHealth: 12.5 },
  })).ok, true);
  assert.equal(validateItem(null).ok, false);
  assert.ok(validateItem(item('wrong-slot', 'pocket')).errors.includes('invalid-equip-slot'));
  assert.ok(validateItem(item('range-no-ammo-type', 'ranged')).errors.includes('invalid-ammo-type'));
  assert.ok(validateItem(item('ammo-no-quantity', 'ammo', { ammoType: 'test-energy' })).errors.includes('invalid-ammo-quantity'));
  assert.ok(validateItem(ammo('zero-ammo', 0)).errors.includes('invalid-ammo-quantity'));
  assert.ok(validateItem(item('bad-stat', 'hat', { statModifiers: { speed: Number.POSITIVE_INFINITY } }))
    .errors.includes('invalid-stat-modifiers'));
  assert.ok(validateItem(item('unknown-field', 'hat', { clientGrantedPower: true }))
    .errors.includes('unsupported-property'));
});

test('pickup auto-equips every supported slot when its compatible slot is free', () => {
  const inventory = createInventory();
  const items = [
    item('test-melee', 'melee'),
    ranged('test-ranged'),
    ammo('test-ammo', 5),
    item('test-shoes', 'shoes'),
    item('test-body', 'body'),
    item('test-hat', 'hat'),
  ];
  for (const entry of items) {
    const result = pickupItem(inventory, entry);
    assert.equal(result.ok, true);
    assert.equal(result.autoEquipped, true);
    assert.equal(inventory.equipment[entry.equipSlot].id, entry.id);
  }
  assert.ok(inventory.bag.every((entry) => entry === null));
});

test('pickup uses the first free bag slot when equipment is occupied and rejects duplicate IDs', () => {
  const inventory = createInventory();
  pickupItem(inventory, item('first-hat', 'hat'));
  const second = item('second-hat', 'hat', { metadata: { tint: 'test-only' } });
  const result = pickupItem(inventory, second);
  assert.deepEqual(result.location, { container: 'bag', index: 0 });
  assert.equal(result.autoEquipped, false);
  assert.equal(inventory.bag[0].id, 'second-hat');
  second.metadata.tint = 'caller-mutated';
  assert.equal(inventory.bag[0].metadata.tint, 'test-only', 'host inventory keeps a defensive copy');

  const duplicate = pickupItem(inventory, item('second-hat', 'body'));
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, 'duplicate-item-id');
  assert.deepEqual(findItemLocation(inventory, 'second-hat'), { container: 'bag', index: 0 });
});

test('full inventory rejects another pickup without mutating revision or existing items', () => {
  const inventory = createInventory();
  pickupItem(inventory, item('equipped-hat', 'hat'));
  for (let index = 0; index < BAG_SLOT_COUNT; index += 1) {
    pickupItem(inventory, item(`bag-hat-${index}`, 'hat'));
  }
  const revision = inventory.revision;
  const before = inventory.bag.map((entry) => entry.id);
  const result = pickupItem(inventory, item('overflow-hat', 'hat'));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'inventory-full');
  assert.equal(inventory.revision, revision);
  assert.deepEqual(inventory.bag.map((entry) => entry.id), before);
});

test('manual equip swaps the old equipped item into the source bag slot atomically', () => {
  const inventory = createInventory();
  pickupItem(inventory, item('hat-a', 'hat'));
  pickupItem(inventory, item('hat-b', 'hat'));
  const result = equipFromBag(inventory, 0);
  assert.equal(result.ok, true);
  assert.equal(inventory.equipment.hat.id, 'hat-b');
  assert.equal(inventory.bag[0].id, 'hat-a');

  const beforeHat = inventory.equipment.hat.id;
  const wrongSlot = equipFromBag(inventory, 0, 'body');
  assert.equal(wrongSlot.ok, false);
  assert.equal(wrongSlot.reason, 'wrong-equipment-slot');
  assert.equal(inventory.equipment.hat.id, beforeHat);
});

test('manual unequip chooses a free bag slot and rejects an occupied destination', () => {
  const inventory = createInventory();
  pickupItem(inventory, item('shoe-a', 'shoes'));
  pickupItem(inventory, item('hat-a', 'hat'));
  pickupItem(inventory, item('hat-b', 'hat'));
  assert.equal(inventory.bag[0].id, 'hat-b');

  const occupied = unequipToBag(inventory, 'shoes', 0);
  assert.equal(occupied.ok, false);
  assert.equal(occupied.reason, 'bag-slot-occupied');
  assert.equal(inventory.equipment.shoes.id, 'shoe-a');

  const result = unequipToBag(inventory, 'shoes');
  assert.equal(result.ok, true);
  assert.equal(inventory.equipment.shoes, null);
  assert.equal(inventory.bag[1].id, 'shoe-a');
});

test('manual unequip rejects a full bag without removing equipped gear', () => {
  const inventory = createInventory();
  pickupItem(inventory, item('equipped-hat', 'hat'));
  for (let index = 0; index < BAG_SLOT_COUNT; index += 1) {
    pickupItem(inventory, item(`full-bag-hat-${index}`, 'hat'));
  }
  const result = unequipToBag(inventory, 'hat');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'inventory-full');
  assert.equal(inventory.equipment.hat.id, 'equipped-hat');
});

test('bag swap supports moving into an empty slot and rejects invalid indices', () => {
  const inventory = createInventory();
  pickupItem(inventory, item('hat-a', 'hat'));
  pickupItem(inventory, item('hat-b', 'hat'));
  assert.equal(swapBagSlots(inventory, 0, 5).ok, true);
  assert.equal(inventory.bag[0], null);
  assert.equal(inventory.bag[5].id, 'hat-b');
  assert.equal(swapBagSlots(inventory, 5, 12).reason, 'invalid-location');
});

test('cursor selection places an item through the same validated atomic swap path', () => {
  const inventory = createInventory();
  pickupItem(inventory, item('hat-a', 'hat'));
  pickupItem(inventory, item('hat-b', 'hat'));
  setCursor(inventory, { container: 'bag', index: 0 });
  assert.equal(selectAtCursor(inventory).ok, true);
  setCursor(inventory, { container: 'equipment', slot: 'hat' });
  assert.equal(placeSelectionAtCursor(inventory).ok, true);
  assert.equal(inventory.equipment.hat.id, 'hat-b');
  assert.equal(inventory.bag[0].id, 'hat-a');
  assert.equal(inventory.selection, null);
  assert.equal(cancelSelection(inventory).unchanged, true);
});

test('cursor placement detects a stale host selection instead of moving another item', () => {
  const inventory = createInventory();
  pickupItem(inventory, item('hat-a', 'hat'));
  pickupItem(inventory, item('hat-b', 'hat'));
  setCursor(inventory, { container: 'bag', index: 0 });
  selectAtCursor(inventory);
  inventory.bag[0] = item('hat-replaced-by-host', 'hat');
  setCursor(inventory, { container: 'equipment', slot: 'hat' });
  const result = placeSelectionAtCursor(inventory);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'stale-selection');
  assert.equal(inventory.equipment.hat.id, 'hat-a');
  assert.equal(inventory.selection, null);
});

test('equipping a ranged weapon or ammo rejects an incompatible prospective pair without mutation', () => {
  const inventory = createInventory();
  pickupItem(inventory, ranged('range-a', 'type-a'));
  pickupItem(inventory, ammo('ammo-b', 3, 'type-b'));
  assert.equal(inventory.equipment.ammo, null, 'incompatible pickup is safely stored in the bag');
  assert.equal(inventory.bag[0].id, 'ammo-b');
  const result = equipFromBag(inventory, 0);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'incompatible-ammo');
  assert.equal(inventory.equipment.ranged.id, 'range-a');
  assert.equal(inventory.equipment.ammo, null);
  assert.equal(inventory.bag[0].id, 'ammo-b');
});

test('ammo consumption decrements the equipped stack without reloading before depletion', () => {
  const inventory = createInventory();
  pickupItem(inventory, ranged('range-a'));
  pickupItem(inventory, ammo('ammo-a', 3));
  const result = consumeEquippedAmmo(inventory, 1);
  assert.equal(result.ok, true);
  assert.equal(result.remainingQuantity, 2);
  assert.equal(result.autoEquippedItemId, null);
  assert.equal(inventory.equipment.ammo.id, 'ammo-a');
});

test('depleted ammo is removed and the first compatible bag stack auto-equips', () => {
  const inventory = createInventory();
  pickupItem(inventory, ranged('range-a', 'type-a'));
  pickupItem(inventory, ammo('ammo-a-equipped', 1, 'type-a'));
  pickupItem(inventory, ammo('ammo-b-incompatible', 7, 'type-b'));
  pickupItem(inventory, ammo('ammo-a-first-compatible', 5, 'type-a'));
  pickupItem(inventory, ammo('ammo-a-second-compatible', 9, 'type-a'));

  const result = consumeEquippedAmmo(inventory);
  assert.equal(result.ok, true);
  assert.equal(result.depletedItemId, 'ammo-a-equipped');
  assert.equal(result.autoEquippedItemId, 'ammo-a-first-compatible');
  assert.equal(result.remainingQuantity, 5);
  assert.equal(inventory.equipment.ammo.id, 'ammo-a-first-compatible');
  assert.equal(inventory.bag[0].id, 'ammo-b-incompatible');
  assert.equal(inventory.bag[1], null);
  assert.equal(inventory.bag[2].id, 'ammo-a-second-compatible');
});

test('depletion leaves ammo empty when no compatible stack exists', () => {
  const inventory = createInventory();
  pickupItem(inventory, ranged('range-a', 'type-a'));
  pickupItem(inventory, ammo('ammo-a', 1, 'type-a'));
  pickupItem(inventory, ammo('ammo-b', 8, 'type-b'));
  const result = consumeEquippedAmmo(inventory);
  assert.equal(result.ok, true);
  assert.equal(result.autoEquippedItemId, null);
  assert.equal(result.reloadReason, 'no-compatible-ammo');
  assert.equal(inventory.equipment.ammo, null);
  assert.equal(inventory.bag[0].id, 'ammo-b');
});

test('ammo summary reports the provisional built-in sidearm as unlimited without inventing a numeric count', () => {
  const inventory = createInventory();
  assert.deepEqual(summarizeAmmo(inventory), {
    mode: 'provisional-unlimited',
    unlimited: true,
    weaponId: 'pulse-sidearm',
    weaponName: 'Pulse Sidearm',
    ammoType: null,
    loaded: null,
    reserve: null,
    total: null,
  });
});

test('ammo summary totals compatible equipped and bag stacks while ignoring incompatible ammo', () => {
  const inventory = createInventory();
  pickupItem(inventory, ranged('range-a', 'type-a'));
  pickupItem(inventory, ammo('ammo-equipped', 3, 'type-a'));
  pickupItem(inventory, ammo('ammo-reserve-a', 5, 'type-a'));
  pickupItem(inventory, ammo('ammo-incompatible', 100, 'type-b'));
  pickupItem(inventory, ammo('ammo-reserve-b', 7, 'type-a'));
  const before = JSON.stringify(inventory);

  assert.deepEqual(summarizeAmmo(inventory), {
    mode: 'inventory',
    unlimited: false,
    weaponId: 'range-a',
    weaponName: 'Test range-a',
    ammoType: 'type-a',
    loaded: 3,
    reserve: 12,
    total: 15,
  });
  assert.equal(JSON.stringify(inventory), before, 'summary is a pure read and never mutates host inventory');
});

test('ammo summary remains finite and reports zero when a ranged weapon has no compatible ammunition', () => {
  const inventory = createInventory();
  pickupItem(inventory, ranged('range-a', 'type-a'));
  pickupItem(inventory, ammo('ammo-incompatible', 8, 'type-b'));
  assert.deepEqual(summarizeAmmo(inventory), {
    mode: 'inventory',
    unlimited: false,
    weaponId: 'range-a',
    weaponName: 'Test range-a',
    ammoType: 'type-a',
    loaded: 0,
    reserve: 0,
    total: 0,
  });
});

test('ammo consume rejects missing weapon, missing ammo, insufficient quantity, and invalid amount', () => {
  const noWeapon = createInventory();
  pickupItem(noWeapon, ammo('ammo-a', 2));
  assert.equal(consumeEquippedAmmo(noWeapon).reason, 'no-ranged-weapon');

  const noAmmo = createInventory();
  pickupItem(noAmmo, ranged('range-a'));
  assert.equal(consumeEquippedAmmo(noAmmo).reason, 'no-equipped-ammo');

  const insufficient = createInventory();
  pickupItem(insufficient, ranged('range-b'));
  pickupItem(insufficient, ammo('ammo-b', 1));
  assert.equal(consumeEquippedAmmo(insufficient, 2).reason, 'insufficient-ammo');
  assert.equal(insufficient.equipment.ammo.quantity, 1, 'rejected consume is atomic');
  assert.equal(consumeEquippedAmmo(insufficient, 0).reason, 'invalid-consume-amount');
});

test('explicit compatible-ammo helper selects the first matching bag stack only', () => {
  const inventory = createInventory();
  pickupItem(inventory, ranged('range-a', 'type-a'));
  pickupItem(inventory, ammo('ammo-b', 2, 'type-b'));
  pickupItem(inventory, ammo('ammo-a-equipped', 4, 'type-a'));
  pickupItem(inventory, ammo('ammo-a-first-bag', 6, 'type-a'));
  unequipToBag(inventory, 'ammo', 2);
  const result = autoEquipCompatibleAmmo(inventory, 'type-a');
  assert.equal(result.ok, true);
  assert.equal(result.itemId, 'ammo-a-first-bag');
  assert.equal(result.fromBagIndex, 1);
  assert.equal(inventory.equipment.ammo.id, 'ammo-a-first-bag');
  assert.equal(inventory.bag[0].id, 'ammo-b');
  assert.equal(inventory.bag[2].id, 'ammo-a-equipped');
});

test('generic location swap cannot put an item into the wrong equipment slot', () => {
  const inventory = createInventory();
  pickupItem(inventory, item('hat-a', 'hat'));
  pickupItem(inventory, item('hat-b', 'hat'));
  const before = inventory.revision;
  const result = swapLocations(
    inventory,
    { container: 'bag', index: 0 },
    { container: 'equipment', slot: 'body' },
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'wrong-equipment-slot');
  assert.equal(inventory.revision, before);
  assert.equal(inventory.bag[0].id, 'hat-b');
  assert.equal(inventory.equipment.body, null);
});
