'use strict';

const { TICK_RATE } = require('../shared/constants');
const { clamp } = require('../shared/validation');
const { pickupItem, validateInventory } = require('./inventory-system');
const { createHostileNpc } = require('./npc-factory');
const { pointBlocked } = require('./spatial-index');

const BASE_ACTOR_HEALTH = 100;
const DROP_PICKUP_RADIUS = 48;

const GEAR_CATALOG = Object.freeze({
  pulseRepeater: Object.freeze({
    baseId: 'pulse-repeater-mk2', displayName: 'Pulse Repeater MK II', equipSlot: 'ranged', ammoType: 'pulse-cell',
    statModifiers: Object.freeze({ damage: 7, cooldownTicks: 7, projectileSpeed: 430, projectileRadius: 3, pelletCount: 1, spreadRadians: 0, pierce: 0 }),
    metadata: Object.freeze({ gearKey: 'pulseRepeater', tier: 1, rarity: 'uncommon', visualStyle: 'repeater', primary: '#72f0cc', accent: '#e8fff7' }),
  }),
  scatterBlaster: Object.freeze({
    baseId: 'scatter-blaster', displayName: 'Lantern Scatter Blaster', equipSlot: 'ranged', ammoType: 'scatter-shell',
    statModifiers: Object.freeze({ damage: 4, cooldownTicks: 15, projectileSpeed: 330, projectileRadius: 4, pelletCount: 3, spreadRadians: 0.17, pierce: 0 }),
    metadata: Object.freeze({ gearKey: 'scatterBlaster', tier: 2, rarity: 'rare', visualStyle: 'scatter', primary: '#ffbd62', accent: '#fff0c7' }),
  }),
  arcCarbine: Object.freeze({
    baseId: 'arc-carbine', displayName: 'Undercity Arc Carbine', equipSlot: 'ranged', ammoType: 'arc-cell',
    statModifiers: Object.freeze({ damage: 10, cooldownTicks: 12, projectileSpeed: 520, projectileRadius: 3, pelletCount: 1, spreadRadians: 0, pierce: 1 }),
    metadata: Object.freeze({ gearKey: 'arcCarbine', tier: 3, rarity: 'epic', visualStyle: 'arc', primary: '#9b8cff', accent: '#f1edff' }),
  }),
  streetWeave: Object.freeze({
    baseId: 'street-weave', displayName: 'Street Weave Armor', equipSlot: 'body',
    statModifiers: Object.freeze({ maxHealthBonus: 25, damageReduction: 0.12 }),
    metadata: Object.freeze({ gearKey: 'streetWeave', tier: 1, rarity: 'uncommon', visualStyle: 'weave', primary: '#5fe0b7', accent: '#d9fff2' }),
  }),
  riotPlate: Object.freeze({
    baseId: 'riot-plate', displayName: 'Rivalbreaker Riot Plate', equipSlot: 'body',
    statModifiers: Object.freeze({ maxHealthBonus: 40, damageReduction: 0.22 }),
    metadata: Object.freeze({ gearKey: 'riotPlate', tier: 2, rarity: 'rare', visualStyle: 'plate', primary: '#ff806f', accent: '#ffe2d8' }),
  }),
  rivalGuardVest: Object.freeze({
    baseId: 'rival-guard-vest', displayName: 'Recovered Rival Guard Vest', equipSlot: 'body',
    statModifiers: Object.freeze({ maxHealthBonus: 18, damageReduction: 0.1 }),
    metadata: Object.freeze({ gearKey: 'rivalGuardVest', tier: 1, rarity: 'salvaged', visualStyle: 'rival-vest', primary: '#ff6f86', accent: '#ffd8df' }),
  }),
  kineticBoots: Object.freeze({
    baseId: 'kinetic-boots', displayName: 'Kinetic Street Boots', equipSlot: 'shoes',
    statModifiers: Object.freeze({ moveSpeedMultiplier: 1.12 }),
    metadata: Object.freeze({ gearKey: 'kineticBoots', tier: 1, rarity: 'rare', visualStyle: 'kinetic', primary: '#6de8ff', accent: '#e0fbff' }),
  }),
});

const ARMORY_GEAR = Object.freeze({
  'sidearm-mk2': Object.freeze({ gearKey: 'pulseRepeater', ammo: 48, tierField: 'weaponTier', tier: 1 }),
  'scatter-blaster': Object.freeze({ gearKey: 'scatterBlaster', ammo: 24, tierField: 'weaponTier', tier: 2 }),
  'arc-carbine': Object.freeze({ gearKey: 'arcCarbine', ammo: 20, tierField: 'weaponTier', tier: 3 }),
  'armor-lining': Object.freeze({ gearKey: 'streetWeave', ammo: 0, tierField: 'armorTier', tier: 1 }),
  'riot-plate': Object.freeze({ gearKey: 'riotPlate', ammo: 0, tierField: 'armorTier', tier: 2 }),
  'kinetic-boots': Object.freeze({ gearKey: 'kineticBoots', ammo: 0, tierField: null, tier: 1 }),
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function itemGearKey(item) { return item?.metadata?.gearKey || null; }

function inventoryItems(actor) {
  const inventory = actor?.inventory;
  if (!inventory) return [];
  return [...Object.values(inventory.equipment || {}), ...(inventory.bag || [])].filter(Boolean);
}

function actorOwnsGear(actor, gearKey) {
  return inventoryItems(actor).some((item) => itemGearKey(item) === gearKey);
}

function createGearItem(gearKey, suffix = 'item') {
  const source = GEAR_CATALOG[gearKey];
  if (!source) return null;
  const safeSuffix = String(suffix).replace(/[^a-zA-Z0-9._-]/g, '-').slice(-30) || 'item';
  const item = {
    id: `${source.baseId}:${safeSuffix}`.slice(0, 64),
    displayName: source.displayName,
    equipSlot: source.equipSlot,
    statModifiers: { ...source.statModifiers },
    metadata: { ...source.metadata },
  };
  if (source.ammoType) item.ammoType = source.ammoType;
  return item;
}

function createAmmoItem(ammoType, quantity, suffix = 'ammo') {
  const safeType = String(ammoType || 'pulse-cell').replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 30);
  const safeSuffix = String(suffix).replace(/[^a-zA-Z0-9._-]/g, '-').slice(-24) || 'ammo';
  return {
    id: `${safeType}-pack:${safeSuffix}`.slice(0, 64),
    displayName: `${safeType.replaceAll('-', ' ').toUpperCase()} PACK`,
    equipSlot: 'ammo',
    ammoType: safeType,
    quantity: Math.max(1, Math.min(9999, Math.round(Number(quantity) || 1))),
    metadata: { gearKey: 'ammoPack', rarity: 'supply', visualStyle: 'ammo', primary: '#ffda79', accent: '#fff5cf' },
  };
}

function firstFreeBag(inventory) { return inventory.bag.findIndex((item) => item === null); }

function stashEquipped(inventory, slot) {
  const item = inventory.equipment[slot];
  if (!item) return { ok: true };
  const index = firstFreeBag(inventory);
  if (index < 0) return { ok: false, reason: 'inventory-full' };
  inventory.bag[index] = item;
  inventory.equipment[slot] = null;
  return { ok: true, index };
}

function stageGearInstall(actor, gearKey, ammoQuantity = 0, suffix = 'purchase') {
  const source = GEAR_CATALOG[gearKey];
  if (!source) return { ok: false, reason: 'unknown-gear' };
  if (!validateInventory(actor?.inventory).ok) return { ok: false, reason: 'malformed-inventory' };
  const inventory = clone(actor.inventory);
  if (source.equipSlot === 'ranged' && inventory.equipment.ammo?.ammoType !== source.ammoType) {
    const stashAmmo = stashEquipped(inventory, 'ammo');
    if (!stashAmmo.ok) return stashAmmo;
  }
  const stash = stashEquipped(inventory, source.equipSlot);
  if (!stash.ok) return stash;
  const item = createGearItem(gearKey, suffix);
  const pickup = pickupItem(inventory, item);
  if (!pickup.ok) return pickup;
  if (source.equipSlot === 'ranged' && ammoQuantity > 0) {
    const ammo = createAmmoItem(source.ammoType, ammoQuantity, suffix);
    const ammoPickup = pickupItem(inventory, ammo);
    if (!ammoPickup.ok) return ammoPickup;
  }
  const check = validateInventory(inventory);
  return check.ok ? { ok: true, inventory, item } : check;
}

function gearSummaryForActor(actor) {
  const ranged = actor?.inventory?.equipment?.ranged || null;
  const body = actor?.inventory?.equipment?.body || null;
  const shoes = actor?.inventory?.equipment?.shoes || null;
  const ownedItems = inventoryItems(actor);
  const hasCatalogArmor = ownedItems.some((item) => item.equipSlot === 'body' && itemGearKey(item));
  const hasCatalogWeapon = ownedItems.some((item) => item.equipSlot === 'ranged' && itemGearKey(item));
  const abstractArmorBonus = body || hasCatalogArmor ? 0 : (Math.max(0, Number(actor?.cityUpgrades?.armorTier) || 0) > 0 ? 25 : 0);
  const fallbackWeaponTier = hasCatalogWeapon ? 0 : Math.max(0, Number(actor?.cityUpgrades?.weaponTier) || 0);
  const weapon = ranged ? {
    id: ranged.id,
    name: ranged.displayName,
    gearKey: itemGearKey(ranged),
    tier: Number(ranged.metadata?.tier) || fallbackWeaponTier,
    ammoType: ranged.ammoType || null,
    damage: Math.max(1, Number(ranged.statModifiers?.damage) || 5),
    cooldownTicks: Math.max(4, Number(ranged.statModifiers?.cooldownTicks) || 10),
    projectileSpeed: Math.max(120, Number(ranged.statModifiers?.projectileSpeed) || 360),
    projectileRadius: Math.max(2, Number(ranged.statModifiers?.projectileRadius) || 4),
    pelletCount: Math.max(1, Math.min(5, Math.round(Number(ranged.statModifiers?.pelletCount) || 1))),
    spreadRadians: Math.max(0, Math.min(0.5, Number(ranged.statModifiers?.spreadRadians) || 0)),
    pierce: Math.max(0, Math.min(2, Math.round(Number(ranged.statModifiers?.pierce) || 0))),
    visualStyle: ranged.metadata?.visualStyle || 'pulse',
    primary: ranged.metadata?.primary || '#72f0cc',
    accent: ranged.metadata?.accent || '#e8fff7',
  } : {
    id: 'pulse-sidearm', name: fallbackWeaponTier ? 'Pulse Sidearm MK II' : 'Pulse Sidearm', gearKey: 'provisionalSidearm',
    tier: fallbackWeaponTier, ammoType: null, damage: 5 + fallbackWeaponTier * 2,
    cooldownTicks: Math.max(7, 10 - fallbackWeaponTier), projectileSpeed: 360, projectileRadius: 4,
    pelletCount: 1, spreadRadians: 0, pierce: 0, visualStyle: 'pulse', primary: '#74e8c4', accent: '#e8fff7',
  };
  const healthBonus = Math.max(0, Number(body?.statModifiers?.maxHealthBonus) || abstractArmorBonus);
  const damageReduction = clamp(Number(body?.statModifiers?.damageReduction) || 0, 0, 0.5);
  const moveSpeedMultiplier = clamp(Number(shoes?.statModifiers?.moveSpeedMultiplier) || 1, 0.75, 1.35);
  return {
    weapon,
    body: body ? { id: body.id, name: body.displayName, gearKey: itemGearKey(body), visualStyle: body.metadata?.visualStyle || 'armor', primary: body.metadata?.primary || '#59e0b8', accent: body.metadata?.accent || '#d9fff2' } : null,
    shoes: shoes ? { id: shoes.id, name: shoes.displayName, gearKey: itemGearKey(shoes), visualStyle: shoes.metadata?.visualStyle || 'boots', primary: shoes.metadata?.primary || '#6de8ff', accent: shoes.metadata?.accent || '#e0fbff' } : null,
    maxHealthBonus: healthBonus,
    damageReduction,
    moveSpeedMultiplier,
  };
}

function syncActorGearStats(actor) {
  if (!actor) return null;
  const summary = gearSummaryForActor(actor);
  const previousMax = Math.max(1, Number(actor.maxHealth) || BASE_ACTOR_HEALTH);
  const nextMax = BASE_ACTOR_HEALTH + summary.maxHealthBonus;
  actor.maxHealth = nextMax;
  if (nextMax > previousMax && actor.alive !== false) actor.health = Math.min(nextMax, Math.max(0, Number(actor.health) || 0) + (nextMax - previousMax));
  else actor.health = Math.min(nextMax, Math.max(0, Number(actor.health) || 0));
  actor.gearSummary = summary;
  return summary;
}

function installArmoryGear(world, actor, optionId) {
  const purchase = ARMORY_GEAR[optionId];
  if (!purchase) return { ok: false, reason: 'unknown-gear-option' };
  if (actorOwnsGear(actor, purchase.gearKey)) return { ok: false, reason: 'owned', message: `${GEAR_CATALOG[purchase.gearKey].displayName} is already in your loadout or pack.` };
  const suffix = `${actor.id}-${world.combatGear.nextItemNumber++}`;
  const staged = stageGearInstall(actor, purchase.gearKey, purchase.ammo, suffix);
  if (!staged.ok) return { ...staged, message: 'Make room in your 12-slot pack before fitting this gear.' };
  actor.inventory = staged.inventory;
  actor.cityUpgrades ||= { weaponTier: 0, armorTier: 0, vipPass: false };
  if (purchase.tierField) actor.cityUpgrades[purchase.tierField] = Math.max(Number(actor.cityUpgrades[purchase.tierField]) || 0, purchase.tier);
  const summary = syncActorGearStats(actor);
  return {
    ok: true,
    itemId: staged.item.id,
    gearKey: purchase.gearKey,
    message: `${staged.item.displayName} equipped${purchase.ammo ? ` with ${purchase.ammo} rounds` : ''}.`,
    gearSummary: summary,
  };
}

function canInstallArmoryGear(actor, optionId) {
  const purchase = ARMORY_GEAR[optionId];
  if (!purchase) return { ok: false, reason: 'unknown-gear-option' };
  if (actorOwnsGear(actor, purchase.gearKey)) return { ok: false, reason: 'owned' };
  return stageGearInstall(actor, purchase.gearKey, purchase.ammo, 'preview');
}

function canRefillAmmo(actor) {
  const ranged = actor?.inventory?.equipment?.ranged;
  if (!ranged?.ammoType) return { ok: false, reason: 'no-finite-weapon' };
  const equipped = actor.inventory.equipment.ammo;
  if (equipped?.ammoType === ranged.ammoType && Number(equipped.quantity) < 9999) return { ok: true };
  return firstFreeBag(actor.inventory) >= 0 ? { ok: true } : { ok: false, reason: 'inventory-full' };
}

function refillAmmo(world, actor, quantity = 30) {
  const check = canRefillAmmo(actor);
  if (!check.ok) return check;
  const ranged = actor.inventory.equipment.ranged;
  const equipped = actor.inventory.equipment.ammo;
  if (equipped?.ammoType === ranged.ammoType) {
    equipped.quantity = Math.min(9999, equipped.quantity + quantity);
    actor.inventory.revision += 1;
    return { ok: true, quantity, ammoType: ranged.ammoType, message: `${quantity} ${ranged.ammoType.replaceAll('-', ' ')} rounds loaded.` };
  }
  const item = createAmmoItem(ranged.ammoType, quantity, `${actor.id}-${world.combatGear.nextItemNumber++}`);
  const pickup = pickupItem(actor.inventory, item);
  return pickup.ok ? { ...pickup, quantity, ammoType: ranged.ammoType, message: `${quantity} ${ranged.ammoType.replaceAll('-', ' ')} rounds added.` } : pickup;
}

function initializeCombatGear(world) {
  world.gearDrops ||= {};
  world.combatGear ||= {
    version: 1,
    nextItemNumber: 1,
    nextDropNumber: 1,
    drills: { party_a: null, party_b: null },
    counters: { dropsCreated: 0, dropsCollected: 0, drillsCompleted: 0 },
  };
  for (const actor of Object.values(world.actors || {})) syncActorGearStats(actor);
  return world.combatGear;
}

function dropProfile(role) {
  if (role === 'blocker') return { rewardKind: 'armor-cache', label: 'RIVAL ARMOR CACHE', accent: '#ff806f', visualStyle: 'shield' };
  if (role === 'sapper') return { rewardKind: 'tech-cache', label: 'SAPPER TECH CACHE', accent: '#a58cff', visualStyle: 'tech' };
  if (role === 'skirmisher') return { rewardKind: 'ammo-cache', label: 'PULSE AMMO CACHE', accent: '#ffcf68', visualStyle: 'ammo' };
  return { rewardKind: 'quick-charge', label: 'QUICK CHARGE', accent: '#65e8b8', visualStyle: 'charge' };
}

function spawnCombatDrop(world, npc) {
  initializeCombatGear(world);
  if (!npc?.hostile || npc.kind === 'crew' || npc.lootDropped) return null;
  npc.lootDropped = true;
  const id = `combat-drop-${world.combatGear.nextDropNumber++}`;
  const profile = dropProfile(npc.role);
  const drop = {
    id,
    kind: 'combat-gear-drop',
    sourceNpcId: npc.id,
    sourceRole: npc.role,
    position: { ...npc.position },
    radius: 12,
    createdAtTick: world.tick,
    expiresAtTick: world.tick + TICK_RATE * 35,
    ...profile,
  };
  world.gearDrops[id] = drop;
  world.combatGear.counters.dropsCreated += 1;
  return drop;
}

function nearestCombatDrop(world, actor, radius = DROP_PICKUP_RADIUS) {
  let nearest = null;
  for (const drop of Object.values(world.gearDrops || {})) {
    const distance = Math.hypot(drop.position.x - actor.position.x, drop.position.y - actor.position.y);
    if (distance <= radius && (!nearest || distance < nearest.distance)) nearest = { drop, distance };
  }
  return nearest?.drop || null;
}

function collectCombatDrop(world, actor) {
  const drop = nearestCombatDrop(world, actor);
  if (!drop) return { ok: false, reason: 'combat-drop-not-in-range' };
  let message = '';
  if (drop.rewardKind === 'ammo-cache') {
    const refill = canRefillAmmo(actor).ok ? refillAmmo(world, actor, 14) : null;
    if (refill?.ok) message = `Recovered ${refill.quantity} ${refill.ammoType.replaceAll('-', ' ')} rounds.`;
    else { actor.walletCents += 250; message = 'No matching finite weapon - cache salvaged for DC 2,50.'; }
  } else if (drop.rewardKind === 'armor-cache') {
    if (!actor.inventory.equipment.body && !actorOwnsGear(actor, 'rivalGuardVest')) {
      const staged = stageGearInstall(actor, 'rivalGuardVest', 0, `${actor.id}-${world.combatGear.nextItemNumber++}`);
      if (!staged.ok) return { ...staged, message: 'Make room before collecting the recovered vest.' };
      actor.inventory = staged.inventory;
      syncActorGearStats(actor);
      message = 'Recovered Rival Guard Vest equipped: +18 HP and 10% protection.';
    } else {
      actor.health = Math.min(actor.maxHealth, actor.health + 25);
      actor.walletCents += 150;
      message = 'Armor patched for 25 HP and spare plate sold for DC 1,50.';
    }
  } else if (drop.rewardKind === 'tech-cache') {
    if (!actorOwnsGear(actor, 'kineticBoots')) {
      const staged = stageGearInstall(actor, 'kineticBoots', 0, `${actor.id}-${world.combatGear.nextItemNumber++}`);
      if (!staged.ok) return { ...staged, message: 'Make room before collecting the kinetic boots.' };
      actor.inventory = staged.inventory;
      syncActorGearStats(actor);
      message = 'Recovered Kinetic Street Boots equipped: +12% movement speed.';
    } else { actor.walletCents += 350; message = 'Duplicate sapper tech salvaged for DC 3,50.'; }
  } else {
    actor.health = Math.min(actor.maxHealth, actor.health + 15);
    actor.walletCents += 100;
    message = 'Quick Charge restored 15 HP and yielded DC 1,00.';
  }
  delete world.gearDrops[drop.id];
  world.combatGear.counters.dropsCollected += 1;
  actor.cityMessage = message;
  actor.cityMessageUntilTick = world.tick + TICK_RATE * 6;
  world.effects.push({ id: `effect-loot-${drop.id}`, kind: 'gear-collected', position: { ...drop.position }, partyId: actor.partyId, expiresAtTick: world.tick + 24 });
  return { ok: true, kind: 'combat-drop', dropId: drop.id, rewardKind: drop.rewardKind, message };
}

function safeDrillPosition(world, preferred, fallback) {
  if (!pointBlocked(world, preferred)) return preferred;
  for (let radius = 24; radius <= 120; radius += 24) {
    for (let index = 0; index < 8; index += 1) {
      const angle = index / 8 * Math.PI * 2;
      const point = { x: preferred.x + Math.cos(angle) * radius, y: preferred.y + Math.sin(angle) * radius };
      if (!pointBlocked(world, point)) return point;
    }
  }
  return { ...fallback };
}

function startCombatDrill(world, actor) {
  initializeCombatGear(world);
  const previous = world.combatGear.drills[actor.partyId];
  if (previous?.status === 'active' && previous.enemyIds.some((id) => world.npcs[id]?.alive)) {
    return { ok: false, reason: 'drill-active', message: 'Your mixed-role combat drill is already active outside.' };
  }
  for (const id of previous?.enemyIds || []) if (world.npcs[id]?.source === 'combat-drill') delete world.npcs[id];
  const roles = ['rusher', 'skirmisher', 'blocker', 'sapper'];
  const offsets = [{ x: -110, y: 85 }, { x: 115, y: 80 }, { x: -120, y: -95 }, { x: 120, y: -100 }];
  const serial = `drill-${actor.partyId}-${world.tick}`;
  const enemyIds = roles.map((role, index) => {
    const preferred = { x: actor.position.x + offsets[index].x, y: actor.position.y + offsets[index].y };
    const position = safeDrillPosition(world, preferred, actor.position);
    const id = `${serial}-${role}`;
    const npc = createHostileNpc({ id, role, position, source: 'combat-drill', kind: 'rival' });
    npc.drillPartyId = actor.partyId;
    world.npcs[id] = npc;
    return id;
  });
  world.combatGear.drills[actor.partyId] = { id: serial, status: 'active', ownerActorId: actor.id, enemyIds, startedAtTick: world.tick, completedAtTick: null };
  actor.cityMessage = 'Mixed-role drill active: CHARGER, STRAFER, SHIELD and SAPPER.';
  actor.cityMessageUntilTick = world.tick + TICK_RATE * 8;
  return { ok: true, kind: 'combat-drill', action: 'started', enemyIds, message: actor.cityMessage };
}

function updateCombatDrills(world) {
  for (const [partyId, drill] of Object.entries(world.combatGear.drills || {})) {
    if (!drill || drill.status !== 'active') continue;
    const living = drill.enemyIds.filter((id) => world.npcs[id]?.alive);
    if (living.length) continue;
    drill.status = 'complete';
    drill.completedAtTick = world.tick;
    const actor = world.actors[drill.ownerActorId] || Object.values(world.actors).find((entry) => entry.partyId === partyId);
    if (actor) {
      actor.walletCents += 800;
      actor.cityMessage = 'Combat drill cleared - DC 8,00 bonus. Collect any remaining drops.';
      actor.cityMessageUntilTick = world.tick + TICK_RATE * 8;
      world.effects.push({ id: `effect-drill-${drill.id}`, kind: 'combat-drill-complete', partyId, position: { ...actor.position }, expiresAtTick: world.tick + 45 });
    }
    world.combatGear.counters.drillsCompleted += 1;
  }
}

function updateCombatGear(world) {
  initializeCombatGear(world);
  for (const actor of Object.values(world.actors || {})) syncActorGearStats(actor);
  for (const drop of Object.values(world.gearDrops || {})) if (world.tick >= drop.expiresAtTick) delete world.gearDrops[drop.id];
  updateCombatDrills(world);
  return world.combatGear;
}

module.exports = {
  ARMORY_GEAR,
  BASE_ACTOR_HEALTH,
  DROP_PICKUP_RADIUS,
  GEAR_CATALOG,
  actorOwnsGear,
  canInstallArmoryGear,
  canRefillAmmo,
  collectCombatDrop,
  createAmmoItem,
  createGearItem,
  gearSummaryForActor,
  initializeCombatGear,
  installArmoryGear,
  nearestCombatDrop,
  refillAmmo,
  spawnCombatDrop,
  startCombatDrill,
  syncActorGearStats,
  updateCombatGear,
};
