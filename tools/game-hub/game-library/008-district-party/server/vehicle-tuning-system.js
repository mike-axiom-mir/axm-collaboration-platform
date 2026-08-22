'use strict';

const ENGINE_MAX = 3;
const TIRE_MAX = 3;
const BRAKE_MAX = 2;

const TUNE_PRESETS = Object.freeze([
  Object.freeze({ id: 'balanced', label: 'BALANCED', acceleration: 1, topSpeed: 1, steering: 1, reverse: 1, tractionResponse: 30 }),
  Object.freeze({ id: 'grip', label: 'GRIP', acceleration: 1.04, topSpeed: 0.94, steering: 1.24, reverse: 1.06, tractionResponse: 30 }),
  Object.freeze({ id: 'drift', label: 'DRIFT', acceleration: 1.02, topSpeed: 1.03, steering: 1.42, reverse: 1, tractionResponse: 2.7 }),
  Object.freeze({ id: 'sprint', label: 'SPRINT', acceleration: 1.16, topSpeed: 1.18, steering: 0.84, reverse: 0.9, tractionResponse: 30 }),
]);

const PAINT_PRESETS = Object.freeze([
  Object.freeze({ id: 'factory', label: 'FACTORY SILVER', colour: '#c7d0d4', accent: '#f2fbff' }),
  Object.freeze({ id: 'mint-circuit', label: 'MINT CIRCUIT', colour: '#39d7ad', accent: '#d8fff3' }),
  Object.freeze({ id: 'magenta-night', label: 'MAGENTA NIGHT', colour: '#d86bff', accent: '#ffd9ff' }),
  Object.freeze({ id: 'amber-rally', label: 'AMBER RALLY', colour: '#f0aa3c', accent: '#fff0b5' }),
  Object.freeze({ id: 'redline', label: 'REDLINE', colour: '#ff5664', accent: '#ffd6d9' }),
  Object.freeze({ id: 'teal-wave', label: 'TEAL WAVE', colour: '#35b9c6', accent: '#ccfbff' }),
]);

const BODY_KITS = Object.freeze([
  Object.freeze({ id: 'stock', label: 'STOCK BODY' }),
  Object.freeze({ id: 'street', label: 'STREET KIT' }),
  Object.freeze({ id: 'wide', label: 'WIDE KIT' }),
  Object.freeze({ id: 'rally', label: 'RALLY KIT' }),
]);

const UPGRADE_PRICES = Object.freeze({
  engine: Object.freeze([1400, 2200, 3200]),
  tires: Object.freeze([900, 1500, 2200]),
  brakes: Object.freeze([700, 1200]),
  tuneUnlock: 500,
  body: 700,
  paint: 350,
});

function boundedInteger(value, maximum) {
  return Math.max(0, Math.min(maximum, Math.floor(Number(value) || 0)));
}

function entryById(entries, id) {
  return entries.find((entry) => entry.id === id) || entries[0];
}

function ensureVehicleTuning(vehicle) {
  if (!vehicle || typeof vehicle !== 'object') return null;
  const existing = vehicle.tuning && typeof vehicle.tuning === 'object' ? vehicle.tuning : {};
  vehicle.tuning = {
    engineTier: boundedInteger(existing.engineTier, ENGINE_MAX),
    tireTier: boundedInteger(existing.tireTier, TIRE_MAX),
    brakeTier: boundedInteger(existing.brakeTier, BRAKE_MAX),
    armorTier: Math.max(vehicle.cityArmorInstalled ? 1 : 0, boundedInteger(existing.armorTier, 1)),
    tuneUnlocked: existing.tuneUnlocked === true,
    presetId: entryById(TUNE_PRESETS, existing.presetId).id,
    paintId: entryById(PAINT_PRESETS, existing.paintId).id,
    bodyKitId: entryById(BODY_KITS, existing.bodyKitId).id,
    revision: Math.max(0, Math.floor(Number(existing.revision) || 0)),
    installedByActorIds: Array.isArray(existing.installedByActorIds) ? [...new Set(existing.installedByActorIds.filter(Boolean))] : [],
  };
  return vehicle.tuning;
}

function vehiclePerformance(vehicle) {
  const tuning = ensureVehicleTuning(vehicle);
  const heavy = vehicle?.vehicleClass === 'gang-car';
  const preset = entryById(TUNE_PRESETS, tuning.presetId);
  const baseAcceleration = heavy ? 195 : 210;
  const baseTopSpeed = heavy ? 175 : 190;
  const baseSteering = heavy ? 2.12 : 2.3;
  return {
    acceleration: baseAcceleration * (1 + tuning.engineTier * 0.085) * preset.acceleration,
    topSpeed: baseTopSpeed * (1 + tuning.engineTier * 0.075) * preset.topSpeed,
    reverseAcceleration: 145 * (1 + tuning.brakeTier * 0.12) * preset.reverse,
    reverseSpeed: 80 * (1 + tuning.brakeTier * 0.1),
    steeringRate: baseSteering * (1 + tuning.tireTier * 0.1) * preset.steering,
    brakeRetention: Math.max(0.012, 0.05 * (1 - tuning.brakeTier * 0.28)),
    dragRetention: 0.42,
    tractionResponse: preset.tractionResponse + tuning.tireTier * 2,
    presetId: preset.id,
    presetLabel: preset.label,
  };
}

function nextEntry(entries, currentId) {
  const index = Math.max(0, entries.findIndex((entry) => entry.id === currentId));
  return entries[(index + 1) % entries.length];
}

function quoteVehicleUpgrade(vehicle, optionId, fallbackPrice = 0) {
  const tuning = ensureVehicleTuning(vehicle);
  if (optionId === 'engine-vehicle') return UPGRADE_PRICES.engine[tuning.engineTier] ?? 0;
  if (optionId === 'tires-vehicle') return UPGRADE_PRICES.tires[tuning.tireTier] ?? 0;
  if (optionId === 'brakes-vehicle') return UPGRADE_PRICES.brakes[tuning.brakeTier] ?? 0;
  if (optionId === 'tune-vehicle') return tuning.tuneUnlocked ? 0 : UPGRADE_PRICES.tuneUnlock;
  if (optionId === 'body-vehicle') return UPGRADE_PRICES.body;
  if (optionId === 'paint-vehicle') return UPGRADE_PRICES.paint;
  return Math.max(0, Math.floor(Number(fallbackPrice) || 0));
}

function recordInstaller(tuning, actorId) {
  if (actorId && !tuning.installedByActorIds.includes(actorId)) tuning.installedByActorIds.push(actorId);
  tuning.revision += 1;
}

function upgradeVehiclePart(vehicle, part, actorId = null) {
  const tuning = ensureVehicleTuning(vehicle);
  const rules = {
    engine: { key: 'engineTier', maximum: ENGINE_MAX, label: 'ENGINE' },
    tires: { key: 'tireTier', maximum: TIRE_MAX, label: 'TIRES' },
    brakes: { key: 'brakeTier', maximum: BRAKE_MAX, label: 'BRAKES' },
  };
  const rule = rules[part];
  if (!rule) return { ok: false, reason: 'unknown-vehicle-part' };
  if (tuning[rule.key] >= rule.maximum) return { ok: false, reason: 'vehicle-part-max', part, tier: tuning[rule.key], maximum: rule.maximum };
  tuning[rule.key] += 1;
  recordInstaller(tuning, actorId);
  return { ok: true, part, tier: tuning[rule.key], maximum: rule.maximum, label: rule.label };
}

function cycleTunePreset(vehicle, actorId = null) {
  const tuning = ensureVehicleTuning(vehicle);
  tuning.tuneUnlocked = true;
  const next = nextEntry(TUNE_PRESETS, tuning.presetId);
  tuning.presetId = next.id;
  recordInstaller(tuning, actorId);
  return next;
}

function cycleVehiclePaint(vehicle, actorId = null) {
  const tuning = ensureVehicleTuning(vehicle);
  const next = nextEntry(PAINT_PRESETS, tuning.paintId);
  tuning.paintId = next.id;
  vehicle.style = next.id;
  recordInstaller(tuning, actorId);
  return next;
}

function cycleBodyKit(vehicle, actorId = null) {
  const tuning = ensureVehicleTuning(vehicle);
  const next = nextEntry(BODY_KITS, tuning.bodyKitId);
  tuning.bodyKitId = next.id;
  recordInstaller(tuning, actorId);
  return next;
}

function publicVehicleBuild(vehicle) {
  const tuning = ensureVehicleTuning(vehicle);
  const performance = vehiclePerformance(vehicle);
  const paint = entryById(PAINT_PRESETS, tuning.paintId);
  const bodyKit = entryById(BODY_KITS, tuning.bodyKitId);
  return {
    vehicleId: vehicle.id,
    vehicleClass: vehicle.vehicleClass || 'street-car',
    engineTier: tuning.engineTier,
    engineMaximum: ENGINE_MAX,
    tireTier: tuning.tireTier,
    tireMaximum: TIRE_MAX,
    brakeTier: tuning.brakeTier,
    brakeMaximum: BRAKE_MAX,
    armorTier: tuning.armorTier,
    tuneUnlocked: tuning.tuneUnlocked,
    presetId: performance.presetId,
    presetLabel: performance.presetLabel,
    paintId: paint.id,
    paintLabel: paint.label,
    paintColour: paint.colour,
    paintAccent: paint.accent,
    bodyKitId: bodyKit.id,
    bodyKitLabel: bodyKit.label,
    revision: tuning.revision,
    stats: {
      topSpeed: Math.round(performance.topSpeed),
      acceleration: Math.round(performance.acceleration),
      steering: Number(performance.steeringRate.toFixed(2)),
      braking: tuning.brakeTier,
      health: Math.round(Number(vehicle.maxHealth) || 0),
      currentHealth: Math.round(Number(vehicle.health) || 0),
    },
  };
}

module.exports = {
  BODY_KITS,
  BRAKE_MAX,
  ENGINE_MAX,
  PAINT_PRESETS,
  TIRE_MAX,
  TUNE_PRESETS,
  UPGRADE_PRICES,
  cycleBodyKit,
  cycleTunePreset,
  cycleVehiclePaint,
  ensureVehicleTuning,
  publicVehicleBuild,
  quoteVehicleUpgrade,
  upgradeVehiclePart,
  vehiclePerformance,
};
