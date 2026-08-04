(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BonkSystems = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SAVE_SCHEMA = 'bonk-bolt-save/v1';
  const STORAGE_KEY = 'bonk-and-bolt-save-v1';
  const FINAL_HOUR = 24;
  const OMEN_HOUR = FINAL_HOUR - 1;
  const GEAR_EFFECTS = Object.freeze({
    springpan: [{ bonkRadius: 1.25 }, { breakfastCrit: 1 }],
    baguette: [{ projectileSpeed: 1.3 }, { breadChains: 1 }],
    accordion: [{ commandDuration: 1.5 }, { specialCooldown: 0.8 }],
    'apology-hammer': [{ bonusKillBolts: 2 }, { recruitHits: 1 }],
    'committee-hat': [{ questBolts: 3 }, { outcomePreview: 1 }],
    'duck-crown': [{ duckOdds: 1.4 }, { duckFullPep: 1 }],
    moonboots: [{ dodgeDistance: 1.3 }, { dodgeShockwave: 1 }],
    'tax-trousers': [{ salvageBonus: 1 }, { retuneDiscount: 3 }],
    'dramatic-spoon': [{ cookZone: 1.2 }, { mealDuration: 1.25 }],
    'honest-compass': [{ markerRange: 90 }, { petRadar: 1 }],
    'panini-passport': [{ paperworkVouchers: 1 }, { breadChains: 1 }],
    'ferry-loafers': [{ riverSpeed: 1.35 }, { dodgeRescue: 1 }],
    'mayor-face': [{ dualBranchDrops: 1 }, { robotJobBonus: 1 }]
  });
  const GEAR_DRAWBACKS = Object.freeze({
    springpan: { aggroRadius: 1.2 },
    baguette: { aggroRadius: 1.25 },
    accordion: { attackCooldown: 1.12 },
    'apology-hammer': { aggroRadius: 1.5 },
    'committee-hat': { panelDelay: 0.65 },
    'duck-crown': { duckInvoice: 4 },
    moonboots: { fishSpeed: 1.15 },
    'tax-trousers': { townAggro: 1.25 },
    'dramatic-spoon': { attackCooldown: 1.12 },
    'honest-compass': { regretMarker: 1 },
    'panini-passport': { moveSpeed: 0.94 },
    'ferry-loafers': { teaBreak: 1 },
    'mayor-face': { townAggro: 1.3 }
  });
  const MULTIPLIER_EFFECTS = new Set(['bonkRadius', 'projectileSpeed', 'commandDuration', 'specialCooldown', 'duckOdds', 'dodgeDistance', 'cookZone', 'mealDuration', 'riverSpeed', 'aggroRadius', 'attackCooldown', 'fishSpeed', 'moveSpeed', 'townAggro']);
  const GEAR_ARGUMENT_IDS = new Set(['factory', 'quiet', 'heckler', 'paradox']);

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function mulberry32(seed) {
    let value = seed >>> 0;
    return function () {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function newSave(options) {
    const settings = options || {};
    return {
      schema: SAVE_SCHEMA,
      createdAt: settings.now || Date.now(),
      lastSavedAt: settings.now || Date.now(),
      seed: Number.isInteger(settings.seed) ? settings.seed : Math.floor(Math.random() * 0x7fffffff),
      hero: {
        name: 'Bix', race: settings.race || null, classId: settings.classId || null,
        level: 1, hp: 100, maxHp: 100, pep: 100, maxPep: 100,
        position: settings.race === 'toon' ? { x: 65, z: 28 } : { x: -62, z: 18 },
        equipment: { weapon: null, hat: null, boots: null, trinket: null },
        inventory: [], ingredients: {}, bolts: 0, stones: 0,
        autoSalvage: 'common', bondedPets: [], downedPets: [], activePet: null,
        petHealth: {}, comedyCharge: false
      },
      coop: { enabled: false, p2Race: 'toon', p2ClassId: 'pun-slinger' },
      world: {
        playSeconds: 0, worldMinute: 8 * 60, day: 1, phase: 'bright', invasion: 0,
        omenStage: 0, ruinStage: 0, resistanceAttempts: 0,
        finaleStarted: false, finaleWon: false, finaleLost: false, specialistBrains: [],
        discovered: ['middle'], fishReleased: 0, robotJobs: 0, villagersHelped: 0,
        pondSpecies: [], pondHarvestDay: 0,
        nextStoneAt: 240 + Math.floor(Math.random() * 300), activeStone: null,
        meals: [], decisions: {}, regionKills: {}, villageFavors: {}, cookRivals: {}, cookRecords: {}, encounterRecords: {}, aftermathReports: {}, originEchoes: {}, enemySerial: 0,
        petCooldowns: {}, petDailyDays: {}, petBuffs: { mossDrop: 0, ledgerRebate: 0 }
      },
      quests: {},
      challenges: {},
      stats: { kills: {}, fishCaught: {}, fishReleased: 0, cookOffs: 0, cook75: 0, cookWins: 0, salvaged: 0, drops: 0, defeats: 0, goldenDucks: 0, bonks: 0, attacks: 0, dodges: 0, retunes: 0, gearArguments: 0, originEchoes: 0 },
      journal: [{ at: settings.now || Date.now(), text: 'Arrived in Patchwork Vale. Nobody has called this a main quest.' }]
    };
  }

  function normalizeSave(candidate) {
    if (!candidate || candidate.schema !== SAVE_SCHEMA) return null;
    const base = newSave({ now: candidate.createdAt || Date.now(), seed: candidate.seed });
    const merged = Object.assign(base, candidate);
    merged.hero = Object.assign(base.hero, candidate.hero || {});
    merged.hero.equipment = Object.assign(base.hero.equipment, merged.hero.equipment || {});
    merged.hero.ingredients = Object.assign({}, merged.hero.ingredients || {});
    merged.hero.bondedPets = Array.isArray(merged.hero.bondedPets) ? Array.from(new Set(merged.hero.bondedPets)) : [];
    merged.hero.downedPets = Array.isArray(merged.hero.downedPets) ? Array.from(new Set(merged.hero.downedPets)) : [];
    merged.hero.petHealth = Object.assign({}, merged.hero.petHealth || {});
    merged.hero.inventory = Array.isArray(merged.hero.inventory) ? merged.hero.inventory : [];
    merged.hero.inventory.forEach(item => {
      if (item.branch !== 'both') item.branch = Number(item.branch) === 1 ? 1 : 0;
      item.retunes = Math.max(0, Number(item.retunes || 0));
      item.argument = GEAR_ARGUMENT_IDS.has(item.argument) ? item.argument : 'factory';
      if (item.origin && typeof item.origin === 'object' && item.origin.id && item.origin.region) {
        item.origin = {
          id: String(item.origin.id), enemyId: String(item.origin.enemyId || item.origin.id), source: String(item.origin.source || 'Unknown nuisance'),
          region: String(item.origin.region), regionId: String(item.origin.regionId || '').toLowerCase(), steward: String(item.origin.steward || 'A local robot'),
          title: String(item.origin.title || 'Origin Echo'), encounterId: item.origin.encounterId ? String(item.origin.encounterId) : null
        };
      } else item.origin = null;
    });
    merged.world = Object.assign(base.world, candidate.world || {});
    merged.world.decisions = Object.assign({}, merged.world.decisions || {});
    merged.world.villageFavors = Object.assign({}, merged.world.villageFavors || {});
    merged.world.cookRivals = Object.assign({}, merged.world.cookRivals || {});
    merged.world.cookRecords = Object.assign({}, merged.world.cookRecords || {});
    merged.world.encounterRecords = Object.fromEntries(Object.entries(merged.world.encounterRecords || {}).map(([id, raw]) => {
      const record = raw && typeof raw === 'object' ? Object.assign({}, raw) : {};
      record.attempts = Math.max(0, Math.floor(Number(record.attempts || 0)));
      record.completions = Math.max(0, Math.floor(Number(record.completions || 0)));
      record.losses = Math.max(0, Math.floor(Number(record.losses || 0)));
      record.assistedWins = Math.max(0, Math.floor(Number(record.assistedWins || 0)));
      record.recoveriesAccepted = Math.max(0, Math.floor(Number(record.recoveriesAccepted || 0)));
      record.won = Boolean(record.won);
      record.recoveryAvailable = Boolean(record.recoveryAvailable);
      record.assistReady = Boolean(record.assistReady);
      return [id, record];
    }));
    merged.world.aftermathReports = Object.fromEntries(Object.entries(merged.world.aftermathReports || {}).map(([id, raw]) => {
      const report = raw && typeof raw === 'object' ? Object.assign({}, raw) : {};
      report.heard = Boolean(report.heard);
      report.versionsHeard = Array.isArray(report.versionsHeard) ? Array.from(new Set(report.versionsHeard.map(String))) : [];
      report.heardCount = Math.max(report.versionsHeard.length, Math.floor(Number(report.heardCount || 0)));
      return [id, report];
    }));
    merged.world.originEchoes = Object.fromEntries(Object.entries(merged.world.originEchoes || {}).map(([id, raw]) => {
      const echo = raw && typeof raw === 'object' ? Object.assign({}, raw) : {};
      echo.found = Boolean(echo.found);
      echo.resolved = Boolean(echo.resolved);
      echo.gearId = echo.gearId ? String(echo.gearId) : null;
      echo.gearName = echo.gearName ? String(echo.gearName) : null;
      echo.itemUid = echo.itemUid ? String(echo.itemUid) : null;
      echo.encounterId = echo.encounterId ? String(echo.encounterId) : null;
      echo.foundAt = Math.max(0, Number(echo.foundAt || 0));
      echo.resolvedAt = Math.max(0, Number(echo.resolvedAt || 0));
      return [id, echo];
    }));
    merged.world.specialistBrains = Array.isArray(merged.world.specialistBrains) ? Array.from(new Set(merged.world.specialistBrains)) : [];
    merged.world.invasion = clamp(Number(merged.world.invasion || 0), 0, 1);
    merged.world.omenStage = Math.max(0, Math.floor(Number(merged.world.omenStage || 0)));
    merged.world.ruinStage = Math.max(0, Math.floor(Number(merged.world.ruinStage || 0)));
    merged.world.resistanceAttempts = Math.max(0, Math.floor(Number(merged.world.resistanceAttempts || 0)));
    merged.world.petCooldowns = Object.assign({}, merged.world.petCooldowns || {});
    merged.world.petDailyDays = Object.assign({}, merged.world.petDailyDays || {});
    merged.world.petBuffs = Object.assign({}, base.world.petBuffs, merged.world.petBuffs || {});
    merged.world.pondSpecies = Array.isArray(merged.world.pondSpecies) ? Array.from(new Set(merged.world.pondSpecies)) : [];
    merged.stats = Object.assign(base.stats, candidate.stats || {});
    merged.stats.kills = Object.assign({}, merged.stats.kills || {});
    merged.stats.gearArguments = Math.max(0, Math.floor(Number(merged.stats.gearArguments || 0)));
    merged.stats.originEchoes = Math.max(0, Math.floor(Number(merged.stats.originEchoes || 0)));
    merged.world.regionKills = Object.assign({}, merged.world.regionKills || {});
    return merged;
  }

  function storyOutcome(save, choiceId, choiceDefs) {
    const definition = choiceDefs && choiceDefs[choiceId];
    const raw = save && save.world && save.world.decisions && save.world.decisions[choiceId];
    if (!definition || raw === undefined || raw === null) return null;
    const needle = String(raw).trim().toLowerCase();
    return definition.options.find(option => option.id === raw || option.label === raw || option.id.toLowerCase() === needle || option.label.toLowerCase() === needle) || null;
  }

  function storyEffects(save, choiceDefs) {
    const result = {
      cookZone: 1, questBolts: 0, riverSpeed: 1, fishYield: 0,
      doodledeanAggro: 1, companionDamage: 1, petDamageTaken: 1, petCooldownRate: 1,
      puddleWarning: 0, rainbowShelters: 0
    };
    if (!choiceDefs) return result;
    const additive = new Set(['questBolts', 'fishYield', 'puddleWarning', 'rainbowShelters']);
    Object.keys(choiceDefs).forEach(choiceId => {
      const outcome = storyOutcome(save, choiceId, choiceDefs);
      if (!outcome || !outcome.effects) return;
      Object.entries(outcome.effects).forEach(([key, value]) => {
        if (!(key in result) || !Number.isFinite(Number(value))) return;
        if (additive.has(key)) result[key] += Number(value);
        else result[key] *= Number(value);
      });
    });
    return result;
  }

  function applyStoryChoice(save, choiceId, optionId, choiceDefs) {
    const definition = choiceDefs && choiceDefs[choiceId];
    if (!save || !definition) return { ok: false, reason: 'missing' };
    const existing = storyOutcome(save, choiceId, choiceDefs);
    if (existing) return { ok: false, reason: 'already-decided', outcome: existing };
    const needle = String(optionId || '').trim().toLowerCase();
    const outcome = definition.options.find(option => option.id.toLowerCase() === needle || option.label.toLowerCase() === needle);
    if (!outcome) return { ok: false, reason: 'invalid-option' };
    save.world.decisions[choiceId] = outcome.id;
    if (choiceId === 'brain') save.world.specialistBrains = [outcome.id];
    save.journal.push({ at: Date.now(), text: 'Chose “' + outcome.label + '”. The world remembers: ' + outcome.consequence });
    return { ok: true, outcome, effects: storyEffects(save, choiceDefs) };
  }

  function stoneCost(count) {
    const held = Math.max(0, Math.floor(Number(count) || 0));
    if (held === 0) return 0;
    if (held === 1) return 1;
    return 2;
  }

  function requirementMet(save, pet) {
    if (!save || !pet) return false;
    if (pet.wantId === 'sunberry-pie') return save.world.meals.some(meal => meal.recipeId === pet.wantId && meal.remaining > 0);
    if (pet.wantId === 'gossip-carp') return Number(save.hero.ingredients['gossip-carp'] || 0) >= Number(pet.count || 1);
    if (pet.wantId === 'cook75') return Number(save.stats.cook75 || 0) > 0;
    if (pet.wantId === 'crabs12') return Number(save.stats.kills.hecklecrab || 0) >= 12;
    if (pet.wantId === 'release4') return Number(save.stats.fishReleased || 0) >= 4;
    if (pet.wantId === 'salvage6') return Number(save.stats.salvaged || 0) >= 6;
    return false;
  }

  function bondPet(save, pet) {
    if (!save || !pet) return { ok: false, reason: 'missing' };
    if (save.hero.bondedPets.includes(pet.id)) return { ok: false, reason: 'already-bonded' };
    if (save.hero.stones < 1) return { ok: false, reason: 'no-stone' };
    if (!requirementMet(save, pet)) return { ok: false, reason: 'want-unmet' };
    const cost = stoneCost(save.hero.stones);
    save.hero.stones -= cost;
    save.hero.bondedPets.push(pet.id);
    save.hero.activePet = pet.id;
    save.hero.petHealth[pet.id] = Number(pet.hp || 60);
    save.hero.downedPets = save.hero.downedPets.filter(id => id !== pet.id);
    save.journal.push({ at: Date.now(), text: pet.name + ' chose to join after you met its very specific terms. ' + cost + ' stone' + (cost === 1 ? '' : 's') + ' vanished.' });
    return { ok: true, cost };
  }

  function selectPet(save, pet) {
    if (!save || !pet || !save.hero.bondedPets.includes(pet.id)) return { ok: false, reason: 'not-bonded' };
    if (save.hero.downedPets.includes(pet.id)) return { ok: false, reason: 'downed' };
    save.hero.activePet = pet.id;
    if (!Number.isFinite(Number(save.hero.petHealth[pet.id]))) save.hero.petHealth[pet.id] = Number(pet.hp || 60);
    return { ok: true, id: pet.id, hp: save.hero.petHealth[pet.id] };
  }

  function damagePet(save, pet, amount) {
    if (!save || !pet || !save.hero.bondedPets.includes(pet.id)) return { ok: false, reason: 'not-bonded' };
    const maxHp = Number(pet.hp || 60);
    const before = clamp(Number(save.hero.petHealth[pet.id] ?? maxHp), 0, maxHp);
    const hp = clamp(before - Math.max(0, Number(amount) || 0), 0, maxHp);
    save.hero.petHealth[pet.id] = hp;
    const downed = hp <= 0;
    if (downed && !save.hero.downedPets.includes(pet.id)) {
      save.hero.downedPets.push(pet.id);
      save.journal.push({ at: Date.now(), text: pet.name + ' was downed. A Golden Duck can rebuild every bonded miniature.' });
    }
    return { ok: true, id: pet.id, before, hp, maxHp, downed };
  }

  function revivePets(save, petList) {
    if (!save || !save.hero) return [];
    const revived = save.hero.downedPets.slice();
    save.hero.bondedPets.forEach(id => {
      const pet = (petList || []).find(entry => entry.id === id);
      save.hero.petHealth[id] = Number(pet && pet.hp || 60);
    });
    save.hero.downedPets = [];
    return revived;
  }

  function triggerPetSpecial(save, pet, context) {
    const details = context || {};
    if (!save || !pet || save.hero.activePet !== pet.id || !save.hero.bondedPets.includes(pet.id)) return { ok: false, reason: 'not-active' };
    if (save.hero.downedPets.includes(pet.id)) return { ok: false, reason: 'downed' };
    const cooldown = Number(save.world.petCooldowns[pet.id] || 0);
    if (cooldown > 0) return { ok: false, reason: 'cooldown', remaining: cooldown };
    if (pet.id === 'crumb32') {
      if (Number(save.world.petDailyDays[pet.id] || 0) === Number(save.world.day || 1)) return { ok: false, reason: 'daily' };
      if (save.hero.bolts < 3) return { ok: false, reason: 'bolts', cost: 3 };
      const pool = (details.gearList || []).filter(gear => gear.rarity !== 'fabled' && (!gear.hybrid || mealActive(save, 'peace-tuna')));
      if (!pool.length) return { ok: false, reason: 'gear-pool' };
      save.hero.bolts -= 3;
      save.world.petDailyDays[pet.id] = save.world.day;
      const serial = Number(save.stats.drops || 0) + Number(save.world.day || 1);
      const gear = pool[serial % pool.length];
      const reward = addGear(save, gear, details.roll || mulberry32((save.seed + serial * 3571) >>> 0));
      save.world.petCooldowns[pet.id] = Number(pet.cooldown || 5);
      return { ok: true, action: 'bake-gear', reward, cost: 3 };
    }
    if (pet.id === 'sprig0') {
      addIngredient(save, 'sunberry', 1); addIngredient(save, 'laughing-leek', 1);
    } else if (pet.id === 'mossboss') save.world.petBuffs.mossDrop = 1;
    else if (pet.id === 'ledgerling') save.world.petBuffs.ledgerRebate = 1;
    save.world.petCooldowns[pet.id] = Number(pet.cooldown || 20);
    const actions = { sprig0: 'spring-garden', ferrybit: 'ferry-charge', sirensue: 'civic-siren', mossboss: 'ranger-audit', ledgerling: 'ledger-rebate' };
    return { ok: true, action: actions[pet.id] || 'companion-action', cooldown: save.world.petCooldowns[pet.id] };
  }

  function consumeMossDrop(save, gearList, roll, context) {
    if (!save || !save.world.petBuffs.mossDrop) return null;
    const pool = (gearList || []).filter(gear => gear.rarity === 'rare' && (!gear.hybrid || mealActive(save, 'peace-tuna')));
    if (!pool.length) return null;
    save.world.petBuffs.mossDrop = 0;
    const rng = roll || mulberry32((save.seed + Number(save.stats.drops || 0) * 6151) >>> 0);
    return addGear(save, pool[Math.floor(rng() * pool.length)], rng, context);
  }

  function addIngredient(save, id, count) {
    const amount = Math.max(1, Math.floor(Number(count) || 1));
    save.hero.ingredients[id] = Number(save.hero.ingredients[id] || 0) + amount;
    return save.hero.ingredients[id];
  }

  function completeVillageFavor(save, favor) {
    if (!save || !favor || !favor.id || !favor.reward) return { ok: false, reason: 'missing' };
    save.world.villageFavors = save.world.villageFavors || {};
    if (save.world.villageFavors[favor.id]) return { ok: false, reason: 'already-helped' };
    const amount = Math.max(1, Math.floor(Number(favor.reward.amount) || 1));
    if (favor.reward.type === 'ingredient' && favor.reward.id) addIngredient(save, favor.reward.id, amount);
    else if (favor.reward.type === 'bolts') save.hero.bolts += amount;
    else return { ok: false, reason: 'invalid-reward' };
    save.world.villageFavors[favor.id] = true;
    save.world.villagersHelped = Number(save.world.villagersHelped || 0) + 1;
    const reward = favor.reward.type === 'bolts' ? amount + ' bolt' + (amount === 1 ? '' : 's') : amount + ' ' + favor.reward.id.replace(/-/g, ' ');
    save.journal.push({ at: Date.now(), text: 'Tiny town favor for ' + favor.name + ': ' + favor.favor + ' Reward: ' + reward + '.' });
    return { ok: true, id: favor.id, reward, villagersHelped: save.world.villagersHelped };
  }

  function beginEncounter(save, encounter) {
    if (!save || !encounter) return { ok: false, reason: 'invalid' };
    save.world.encounterRecords = save.world.encounterRecords || {};
    const previous = save.world.encounterRecords[encounter.id] || { attempts: 0, completions: 0, won: false };
    const assisted = Boolean(previous.assistReady);
    const record = Object.assign({}, previous, { attempts: Number(previous.attempts || 0) + 1, lastStartedAt: Date.now(), lastAttemptAssisted: assisted });
    save.world.encounterRecords[encounter.id] = record;
    return { ok: true, assisted, record };
  }

  function loseEncounter(save, encounter, details) {
    if (!save || !encounter) return { ok: false, reason: 'invalid' };
    save.world.encounterRecords = save.world.encounterRecords || {};
    const previous = save.world.encounterRecords[encounter.id] || { attempts: 0, completions: 0, losses: 0, won: false };
    const assisted = Boolean(details?.assisted || previous.assistReady);
    const firstLoss = Number(previous.losses || 0) === 0;
    const record = Object.assign({}, previous, {
      losses: Number(previous.losses || 0) + 1,
      lastLostAt: Date.now(),
      lastLossProgress: Math.max(0, Math.floor(Number(details?.progress || 0))),
      lastLossAssisted: assisted,
      recoveryAvailable: !previous.assistReady,
      assistReady: Boolean(previous.assistReady)
    });
    save.world.encounterRecords[encounter.id] = record;
    if (firstLoss) save.journal.push({ at: Date.now(), text: 'Lost the authored encounter "' + encounter.title + '". A free cross-town recovery visit is now waiting nearby.' });
    return { ok: true, firstLoss, assisted, record };
  }

  function acceptEncounterRecovery(save, encounter, recovery) {
    if (!save || !encounter || !recovery || recovery.encounterId !== encounter.id) return { ok: false, reason: 'invalid' };
    save.world.encounterRecords = save.world.encounterRecords || {};
    const previous = save.world.encounterRecords[encounter.id];
    if (!previous || (!previous.recoveryAvailable && !previous.assistReady)) return { ok: false, reason: 'not-available' };
    if (previous.assistReady) return { ok: false, reason: 'already-ready', record: previous };
    const record = Object.assign({}, previous, {
      recoveryAvailable: false,
      assistReady: true,
      recoveriesAccepted: Number(previous.recoveriesAccepted || 0) + 1,
      lastRecoveryId: recovery.id,
      lastRecoveryAt: Date.now()
    });
    save.world.encounterRecords[encounter.id] = record;
    save.journal.push({ at: Date.now(), text: recovery.helper + ' arrived from ' + recovery.helperTown + ' with free recovery help: ' + recovery.assist + '.' });
    return { ok: true, record, assist: recovery.assist };
  }

  function winEncounter(save, encounter, details) {
    if (!save || !encounter) return { ok: false, reason: 'invalid' };
    save.world.encounterRecords = save.world.encounterRecords || {};
    const previous = save.world.encounterRecords[encounter.id] || { attempts: 0, completions: 0, won: false };
    const firstWin = !previous.won;
    const assisted = Boolean(details?.assisted || previous.lastAttemptAssisted);
    const record = Object.assign({}, previous, { won: true, completions: Number(previous.completions || 0) + 1, assistedWins: Number(previous.assistedWins || 0) + (assisted ? 1 : 0), lastWonAt: Date.now(), lastWinAssisted: assisted, recoveryAvailable: false, assistReady: false });
    save.world.encounterRecords[encounter.id] = record;
    if (firstWin) save.journal.push({ at: Date.now(), text: 'Won the authored adventure encounter “'+encounter.title+'” in '+encounter.region+'.' });
    return { ok: true, firstWin, assisted, record };
  }

  function aftermathStatus(save, aftermath, choiceDefs) {
    if (!save || !aftermath || !aftermath.id) return { available: false, reason: 'invalid' };
    const quest = save.quests && save.quests[aftermath.questId];
    const available = Boolean(quest && (quest.complete || Number(quest.stage || 0) >= Number(aftermath.readyStage || 2)));
    const outcome = storyOutcome(save, aftermath.choiceId, choiceDefs);
    const version = outcome ? outcome.id : 'pending';
    const report = save.world.aftermathReports?.[aftermath.id] || { heard: false, versionsHeard: [], heardCount: 0 };
    const versionsHeard = Array.isArray(report.versionsHeard) ? report.versionsHeard : [];
    const outcomeCopy = outcome && aftermath.outcomes && aftermath.outcomes[outcome.id];
    return {
      available,
      version,
      outcome,
      report,
      heard: Boolean(report.heard),
      heardCurrent: versionsHeard.includes(version),
      reportCount: Object.values(save.world.aftermathReports || {}).filter(entry => entry && entry.heard).length,
      title: outcomeCopy?.title || aftermath.pendingTitle,
      line: outcomeCopy?.line || aftermath.pendingLine
    };
  }

  function hearAftermath(save, aftermath, choiceDefs) {
    const before = aftermathStatus(save, aftermath, choiceDefs);
    if (!before.available) return { ok: false, reason: before.reason || 'not-ready' };
    save.world.aftermathReports = save.world.aftermathReports || {};
    const previous = save.world.aftermathReports[aftermath.id] || { heard: false, versionsHeard: [], heardCount: 0 };
    const versionsHeard = Array.isArray(previous.versionsHeard) ? Array.from(new Set(previous.versionsHeard.map(String))) : [];
    const firstReport = !previous.heard;
    const firstVersion = !versionsHeard.includes(before.version);
    if (firstVersion) versionsHeard.push(before.version);
    const now = Date.now();
    const report = Object.assign({}, previous, {
      heard: true,
      versionsHeard,
      heardCount: Number(previous.heardCount || 0) + (firstVersion ? 1 : 0),
      firstHeardAt: previous.firstHeardAt || now,
      lastHeardAt: now,
      lastVersion: before.version
    });
    save.world.aftermathReports[aftermath.id] = report;
    if (firstVersion) save.journal.push({ at: now, text: aftermath.witness + ' filed ' + before.title + ': ' + before.line });
    const after = aftermathStatus(save, aftermath, choiceDefs);
    return Object.assign({ ok: true, firstReport, firstVersion }, after, { report });
  }

  function mealActive(save, recipeId) {
    return Boolean(save && save.world && Array.isArray(save.world.meals) && save.world.meals.some(meal => meal.recipeId === recipeId && meal.remaining > 0));
  }

  function releaseFish(save, id) {
    const benefits = {
      'gossip-carp': 'Rumor Current: the pond remembers Gossip Carp and sustains them in its daily basket.',
      'moon-eel': 'Moon Route: the pond remembers Moon Eels and marks their home with a permanent night beacon.',
      'argument-tuna': 'Truce Shoal: the pond remembers Argument Tuna and sustains them without level grinding.'
    };
    if (!save || !benefits[id]) return { ok: false, reason: 'not-a-pond-fish' };
    if (Number(save.hero.ingredients[id] || 0) < 1) return { ok: false, reason: 'missing-fish' };
    save.hero.ingredients[id] -= 1;
    save.stats.fishReleased += 1;
    save.world.fishReleased += 1;
    const newSpecies = !save.world.pondSpecies.includes(id);
    if (newSpecies) save.world.pondSpecies.push(id);
    save.journal.push({ at: Date.now(), text: (newSpecies ? 'Established ' : 'Released another ') + id.replace(/-/g, ' ') + ' in Wobble Pond. ' + benefits[id] });
    return { ok: true, id, newSpecies, benefit: benefits[id], speciesCount: save.world.pondSpecies.length };
  }

  function claimPondHarvest(save) {
    if (!save || !save.world.pondSpecies.length) return { ok: false, reason: 'empty-ecology' };
    if (Number(save.world.pondHarvestDay || 0) >= Number(save.world.day || 1)) return { ok: false, reason: 'already-harvested' };
    const fish = save.world.pondSpecies.slice();
    fish.forEach(id => addIngredient(save, id, 1));
    save.world.pondHarvestDay = save.world.day;
    save.journal.push({ at: Date.now(), text: 'Collected Wobble Pond\'s day ' + save.world.day + ' ecology basket: ' + fish.map(id => id.replace(/-/g, ' ')).join(', ') + '.' });
    return { ok: true, fish, day: save.world.day };
  }

  function useIngredients(save, ids) {
    const need = {};
    ids.forEach(id => { need[id] = (need[id] || 0) + 1; });
    if (Object.keys(need).some(id => Number(save.hero.ingredients[id] || 0) < need[id])) return false;
    Object.keys(need).forEach(id => { save.hero.ingredients[id] -= need[id]; });
    return true;
  }

  function gearArgumentProfile(item) {
    const id = GEAR_ARGUMENT_IDS.has(item && item.argument) ? item.argument : 'factory';
    const rawPower = Math.max(0, Number(item && item.power || 0));
    return {
      id,
      power: id === 'quiet' ? 0 : id === 'heckler' ? rawPower + 2 : id === 'paradox' ? Math.max(0, rawPower - 2) : rawPower,
      branchPasses: id === 'heckler' ? 2 : 1,
      drawbackPasses: id === 'quiet' ? 0 : id === 'heckler' || id === 'paradox' ? 2 : 1,
      bothBranches: id === 'paradox' || item && item.branch === 'both'
    };
  }

  function equipmentCouncilStatus(save, council) {
    const reports = Object.values(save && save.world && save.world.aftermathReports || {});
    const heard = reports.filter(report => report && (report.heard || Array.isArray(report.versionsHeard) && report.versionsHeard.length)).length;
    const required = Math.max(1, Math.floor(Number(council && council.requiredReports || 2)));
    return { heard, required, unlocked: heard >= required };
  }

  function setGearArgument(save, uid, argumentId, council) {
    const item = save && save.hero && save.hero.inventory.find(entry => entry.uid === uid);
    if (!item) return { ok: false, reason: 'missing' };
    const argument = council && Array.isArray(council.arguments) && council.arguments.find(entry => entry.id === argumentId);
    if (!argument || !GEAR_ARGUMENT_IDS.has(argument.id)) return { ok: false, reason: 'invalid' };
    const status = equipmentCouncilStatus(save, council);
    if (!status.unlocked) return { ok: false, reason: 'locked', status };
    if (argument.id === 'paradox' && item.branch === 'both') return { ok: false, reason: 'already-dual', item };
    const previous = GEAR_ARGUMENT_IDS.has(item.argument) ? item.argument : 'factory';
    if (previous === argument.id) return { ok: false, reason: 'unchanged', item, argument };
    item.argument = argument.id;
    save.stats.gearArguments = Number(save.stats.gearArguments || 0) + 1;
    save.journal.push({ at: Date.now(), text: argument.speaker + ' rewired ' + item.name + ' with ' + argument.name + ' for 0 bolts.' });
    return { ok: true, item, argument, previous, cost: 0 };
  }

  function originEchoStatus(save, definition) {
    const record = definition && save && save.world && save.world.originEchoes && save.world.originEchoes[definition.id];
    return { found: Boolean(record && record.found), resolved: Boolean(record && record.resolved), record: record || null, definition: definition || null };
  }

  function originEchoEffects(save, definitions) {
    const result = { formSpeed: 1, heckleWindup: 0, moodPuddleDamage: 1, robotHijackImmunity: 0, gooseStealCap: 2 };
    (definitions || []).forEach(definition => {
      if (!originEchoStatus(save, definition).resolved) return;
      Object.entries(definition.effect || {}).forEach(([key, value]) => {
        if (!(key in result) || !Number.isFinite(Number(value))) return;
        if (key === 'formSpeed' || key === 'moodPuddleDamage') result[key] *= Number(value);
        else if (key === 'gooseStealCap') result[key] = Math.min(result[key], Math.max(0, Math.floor(Number(value))));
        else result[key] += Number(value);
      });
    });
    return result;
  }

  function originParadeStatus(save, definitions) {
    const required = 2;
    const modules = (definitions || []).filter(definition => originEchoStatus(save, definition).resolved);
    return {
      unlocked: modules.length >= required,
      count: modules.length,
      required,
      modules,
      next: modules.length < required ? required - modules.length : 0
    };
  }

  function originParadeRoute(worldMinute, playSeconds) {
    const minute = ((Number(worldMinute) || 0) % 1440 + 1440) % 1440;
    if (minute < 360 || minute >= 1200) return { mode: 'parked', x: -6, z: 30, rotation: Math.PI * 0.58, progress: 0 };
    const progress = ((Math.max(0, Number(playSeconds) || 0) % 220) / 220);
    const phase = progress * Math.PI * 2;
    const dx = -10 * Math.sin(phase), dz = 10 * Math.cos(phase);
    return {
      mode: 'parade',
      x: 8 + 10 * Math.cos(phase),
      z: 22 + 10 * Math.sin(phase),
      rotation: Math.atan2(dx, dz),
      progress
    };
  }

  function resolveOriginEcho(save, definition) {
    if (!save || !definition || !definition.id) return { ok: false, reason: 'missing' };
    const status = originEchoStatus(save, definition);
    if (!status.found) return { ok: false, reason: 'not-found' };
    if (status.resolved) return { ok: false, reason: 'already-resolved', record: status.record, definition };
    status.record.resolved = true;
    status.record.resolvedAt = Date.now();
    save.stats.originEchoes = Number(save.stats.originEchoes || 0) + 1;
    save.journal.push({ at: Date.now(), text: definition.steward + ' settled the ' + definition.title + ' origin echo. Permanent world change: ' + definition.consequence + ' The equipment may be salvaged later without undoing this memory.' });
    return { ok: true, record: status.record, definition, effects: originEchoEffects(save, [definition]), cost: 0 };
  }

  function gearEffects(save) {
    const result = {
      bonkRadius: 1, breakfastCrit: 0, projectileSpeed: 1, breadChains: 0,
      commandDuration: 1, specialCooldown: 1, bonusKillBolts: 0, recruitHits: 0,
      questBolts: 0, outcomePreview: 0, duckOdds: 1, duckFullPep: 0,
      dodgeDistance: 1, dodgeShockwave: 0, fishSpeed: 1, salvageBonus: 0,
      retuneDiscount: 0, cookZone: 1, mealDuration: 1, markerRange: 0,
      petRadar: 0, paperworkVouchers: 0, moveSpeed: 1, riverSpeed: 1,
      dodgeRescue: 0, dualBranchDrops: 0, robotJobBonus: 0, aggroRadius: 1,
      attackCooldown: 1, panelDelay: 0, duckInvoice: 0, townAggro: 1,
      regretMarker: 0, teaBreak: 0, powerBonus: 0
    };
    if (!save || !save.hero) return result;
    const inventory = Array.isArray(save.hero.inventory) ? save.hero.inventory : [];
    const equipped = Object.values(save.hero.equipment || {}).map(uid => inventory.find(item => item.uid === uid)).filter(Boolean);
    const apply = effect => Object.entries(effect || {}).forEach(([key, value]) => {
      if (MULTIPLIER_EFFECTS.has(key)) result[key] *= value;
      else result[key] += value;
    });
    equipped.forEach(item => {
      const profile = gearArgumentProfile(item), branches = GEAR_EFFECTS[item.id] || [], selected = profile.bothBranches ? branches : [branches[Number(item.branch) === 1 ? 1 : 0]];
      result.powerBonus += profile.power;
      for (let pass = 0; pass < profile.branchPasses; pass++) selected.forEach(apply);
      for (let pass = 0; pass < profile.drawbackPasses; pass++) apply(GEAR_DRAWBACKS[item.id]);
    });
    return result;
  }

  function retuneCost(save, uid) {
    const item = save && save.hero && save.hero.inventory.find(entry => entry.uid === uid);
    if (!item || item.branch === 'both') return null;
    if (save.hero.race === 'human' && Number(item.retunes || 0) === 0) return 0;
    return Math.max(2, 8 + Number(item.retunes || 0) * 3 - gearEffects(save).retuneDiscount);
  }

  function retuneGear(save, uid, gearList) {
    const item = save && save.hero && save.hero.inventory.find(entry => entry.uid === uid);
    const definition = item && (gearList || []).find(gear => gear.id === item.id);
    if (!item || !definition) return { ok: false, reason: 'missing' };
    if (item.branch === 'both') return { ok: false, reason: 'already-dual' };
    const cost = retuneCost(save, uid);
    if (save.hero.bolts < cost) return { ok: false, reason: 'bolts', cost };
    save.hero.bolts -= cost;
    item.branch = Number(item.branch) === 1 ? 0 : 1;
    item.choice = definition.choice[item.branch];
    item.retunes = Number(item.retunes || 0) + 1;
    save.stats.retunes = Number(save.stats.retunes || 0) + 1;
    save.journal.push({ at: Date.now(), text: 'Retuned ' + item.name + ' to “' + item.choice + '” for ' + cost + ' bolts.' });
    return { ok: true, item, cost, nextCost: retuneCost(save, uid) };
  }

  function addGear(save, gear, roll, context) {
    const rng = roll || Math.random;
    const branch = gearEffects(save).dualBranchDrops ? 'both' : (rng() < 0.5 ? 0 : 1);
    const origin = context && context.origin && context.origin.id && context.origin.region ? context.origin : null;
    const item = {
      uid: gear.id + '-' + Date.now().toString(36) + '-' + Math.floor(rng() * 9999),
      id: gear.id, name: gear.name, slot: gear.slot, rarity: gear.rarity, power: gear.power,
      branch, choice: branch === 'both' ? gear.choice.join(' + ') : gear.choice[branch], drawback: gear.drawback, salvage: gear.salvage,
      retunes: 0, argument: 'factory', origin: origin ? {
        id: String(origin.id), enemyId: String(origin.enemyId || origin.id), source: String(origin.source || origin.id), region: String(origin.region),
        regionId: String(origin.regionId || '').toLowerCase(), steward: String(origin.steward || 'A local robot'), title: String(origin.title || 'Origin Echo'),
        encounterId: context.encounterId ? String(context.encounterId) : null
      } : null
    };
    const salvageCommon = save.hero.autoSalvage === 'all-oddities' && gear.rarity === 'oddity';
    if (salvageCommon) {
      const ledger = save.world.petBuffs.ledgerRebate ? 2 : 0;
      save.hero.bolts += gear.salvage + gearEffects(save).salvageBonus + ledger;
      if (ledger) save.world.petBuffs.ledgerRebate = 0;
      save.stats.salvaged += 1;
      return { salvaged: true, item };
    }
    save.hero.inventory.push(item);
    save.stats.drops += 1;
    let firstOriginEcho = false;
    if (origin) {
      save.world.originEchoes = save.world.originEchoes || {};
      const existing = save.world.originEchoes[origin.id];
      if (!existing || !existing.found) {
        save.world.originEchoes[origin.id] = {
          found: true, resolved: false, gearId: item.id, gearName: item.name, itemUid: item.uid,
          encounterId: item.origin.encounterId, foundAt: Date.now(), resolvedAt: 0
        };
        firstOriginEcho = true;
        save.journal.push({ at: Date.now(), text: 'Kept ' + item.name + ' from ' + item.origin.source + ' in ' + item.origin.region + '. A gold origin echo now marks ' + item.origin.steward + '\'s ' + item.origin.title + '.' });
      }
    }
    return { salvaged: false, item, firstOriginEcho };
  }

  function salvageGear(save, uid) {
    const index = save.hero.inventory.findIndex(item => item.uid === uid);
    if (index < 0) return null;
    const item = save.hero.inventory[index];
    if (item.rarity === 'fabled') return { blocked: true, item };
    const ledger = save.world.petBuffs.ledgerRebate ? 2 : 0;
    const salvageBonus = gearEffects(save).salvageBonus + ledger;
    save.hero.inventory.splice(index, 1);
    Object.keys(save.hero.equipment).forEach(slot => { if (save.hero.equipment[slot] === uid) save.hero.equipment[slot] = null; });
    save.hero.bolts += item.salvage + salvageBonus;
    if (ledger) save.world.petBuffs.ledgerRebate = 0;
    save.stats.salvaged += 1;
    return { blocked: false, item };
  }

  function equipGear(save, uid) {
    const item = save.hero.inventory.find(entry => entry.uid === uid);
    if (!item) return false;
    save.hero.equipment[item.slot] = uid;
    return true;
  }

  function recordChallenge(save, event, target, amount, challenges, region) {
    const delta = Number(amount || 1);
    (challenges || []).forEach(challenge => {
      if (challenge.event !== event) return;
      if (challenge.target !== 'any' && challenge.target !== 'all' && challenge.target !== target && !(challenge.target === 'gear' && target === 'gear') && !(challenge.target === 'fish' && target === 'fish')) return;
      const state = save.challenges[challenge.id] || { progress: 0, complete: false, claimed: false };
      state.progress = clamp(state.progress + delta, 0, challenge.amount);
      state.complete = state.progress >= challenge.amount;
      save.challenges[challenge.id] = state;
    });
    if (event === 'kill' && region) {
      save.world.regionKills[region] = Number(save.world.regionKills[region] || 0) + delta;
      const regional = save.challenges['regional-bonk'] || { progress: 0, complete: false, claimed: false };
      regional.progress = Object.values(save.world.regionKills).reduce((sum, value) => sum + Math.min(5, value), 0);
      regional.complete = regional.progress >= 25;
      save.challenges['regional-bonk'] = regional;
    }
  }

  function rollDrop(save, gearList, enemyId, context) {
    const kills = Object.values(save.stats.kills).reduce((sum, value) => sum + value, 0);
    const rng = mulberry32((save.seed ^ (kills * 2654435761) ^ String(enemyId || '').length) >>> 0);
    const chance = 0.11 + Math.min(0.08, kills / 1000);
    if (rng() > chance) return null;
    const communityTable = mealActive(save, 'peace-tuna');
    const weighted = gearList.filter(item => (!item.hybrid || communityTable) && (item.rarity !== 'fabled' || rng() > 0.82));
    const gear = weighted[Math.floor(rng() * weighted.length)];
    return gear ? addGear(save, gear, rng, context) : null;
  }

  function fishingReward(save, score, isNight, context) {
    const serial = Object.values(save.stats.fishCaught).reduce((sum, value) => sum + value, 0) + save.stats.goldenDucks;
    const rng = mulberry32((save.seed + serial * 7919 + Math.floor(score * 101)) >>> 0);
    const effects = gearEffects(save);
    const duckChance = context && context.forceDuck ? 1 : (0.035 + (score > 0.92 ? 0.03 : 0)) * effects.duckOdds;
    if (rng() < duckChance) {
      save.stats.goldenDucks += 1;
      const giftRoll = rng();
      const gift = giftRoll < 0.72 ? 'health' : giftRoll < 0.91 ? 'pep' : giftRoll < 0.985 ? 'bolts' : 'special';
      if (gift === 'health') save.hero.hp = save.hero.maxHp;
      if (gift === 'pep' || effects.duckFullPep) save.hero.pep = save.hero.maxPep;
      if (gift === 'bolts') save.hero.bolts += Math.max(0, 25 - effects.duckInvoice);
      const revivedPets = revivePets(save, context && context.petList);
      return { id: 'golden-duck', name: 'Golden Duck', gift, revivedPets };
    }
    const remembered = context && context.pond && Array.isArray(save.world.pondSpecies) ? save.world.pondSpecies : [];
    const pool = remembered.length ? remembered : isNight ? ['moon-eel', 'gossip-carp', 'argument-tuna'] : ['gossip-carp', 'argument-tuna', 'gossip-carp'];
    const id = pool[Math.floor(rng() * pool.length)];
    const story = storyEffects(save, context && context.storyChoices);
    const quantity = 1 + Math.max(0, Math.floor(story.fishYield));
    addIngredient(save, id, quantity);
    save.stats.fishCaught[id] = Number(save.stats.fishCaught[id] || 0) + quantity;
    return { id, name: id.replace(/(^|-)([a-z])/g, (_, dash, letter) => (dash ? ' ' : '') + letter.toUpperCase()), gift: null, quantity };
  }

  function cookLegacy(save, round, rivals) {
    return (rivals || []).reduce((scale, rival) => {
      const record = save && save.world && save.world.cookRivals && save.world.cookRivals[rival.id];
      return record && record.won && rival.legacy && rival.legacy.round === round ? scale * Number(rival.legacy.scale || 1) : scale;
    }, 1);
  }

  function cook(save, recipe, score, context) {
    if (!useIngredients(save, recipe.needs)) return { ok: false, reason: 'ingredients' };
    const finalScore = clamp(Number(score) || 0, 0, 1);
    const quality = finalScore >= 0.9 ? 'legendary' : finalScore >= 0.72 ? 'delicious' : finalScore >= 0.48 ? 'edible' : 'historical mistake';
    const baseDuration = quality === 'historical mistake' ? 25 : quality === 'edible' ? 45 : 60;
    const duration = Math.round(baseDuration * gearEffects(save).mealDuration);
    save.world.meals = save.world.meals.filter(meal => meal.recipeId !== recipe.id);
    save.world.meals.push({ recipeId: recipe.id, effect: recipe.effect, remaining: duration, quality });
    save.stats.cookOffs += 1;
    if (finalScore >= 0.75) save.stats.cook75 += 1;
    const result = { ok: true, quality, duration, score: finalScore };
    const rival = context && context.rival;
    if (rival) {
      const rivalScore = clamp(Number(context.rivalScore ?? rival.score) || 0, 0, 1);
      const previous = save.world.cookRivals[rival.id] || { attempts: 0, won: false, best: 0 };
      const won = finalScore >= rivalScore;
      const firstWin = won && !previous.won;
      save.world.cookRivals[rival.id] = {
        attempts: Number(previous.attempts || 0) + 1,
        won: Boolean(previous.won || won),
        best: Math.max(Number(previous.best || 0), finalScore),
        last: finalScore,
        rivalBest: Math.max(Number(previous.rivalBest || 0), rivalScore)
      };
      save.world.cookRecords[recipe.id] = Math.max(Number(save.world.cookRecords[recipe.id] || 0), finalScore);
      if (won) save.stats.cookWins = Number(save.stats.cookWins || 0) + 1;
      if (firstWin) save.journal.push({ at: Date.now(), text: 'Defeated '+rival.name+' at the Sizzlebank Cook-Off. Permanent kitchen lesson: '+rival.legacy.label+'.' });
      result.duel = { rivalId: rival.id, rivalScore, won, firstWin, legacy: firstWin ? rival.legacy : null };
    }
    return result;
  }

  function omenProgress(save) {
    const hours = Number(save && save.world && save.world.playSeconds || 0) / 3600;
    return clamp((hours - OMEN_HOUR) / (FINAL_HOUR - OMEN_HOUR), 0, 1);
  }

  function omenStage(save) {
    const progress = omenProgress(save);
    if (progress <= 0) return 0;
    if (progress < 0.25) return 1;
    if (progress < 0.5) return 2;
    if (progress < 0.75) return 3;
    if (progress < 1) return 4;
    return 5;
  }

  function ruinStage(save) {
    if (!save || !save.world) return 0;
    const invasion = clamp(Number(save.world.invasion || 0), 0, 1);
    if (!save.world.finaleLost && !(save.world.finaleWon && invasion >= 0.01)) return 0;
    if (invasion < 0.01) return 0;
    if (invasion < 0.3) return 1;
    if (invasion < 0.55) return 2;
    if (invasion < 0.8) return 3;
    if (invasion < 1) return 4;
    return 5;
  }

  function advanceWorld(save, dtSeconds, context) {
    const dt = clamp(Number(dtSeconds) || 0, 0, 1);
    const beforeHours = save.world.playSeconds / 3600;
    const beforeOmenStage = omenStage(save), beforeRuinStage = ruinStage(save);
    save.world.playSeconds += dt;
    save.world.worldMinute = (save.world.worldMinute + dt * 0.4) % 1440;
    save.world.day = 1 + Math.floor(save.world.playSeconds / 3600);
    save.world.meals.forEach(meal => { meal.remaining = Math.max(0, meal.remaining - dt * 0.4); });
    save.world.meals = save.world.meals.filter(meal => meal.remaining > 0);
    const petRate = (mealActive(save, 'moon-noodles') ? 1.25 : 1) * storyEffects(save, context && context.storyChoices).petCooldownRate;
    Object.keys(save.world.petCooldowns).forEach(id => { save.world.petCooldowns[id] = Math.max(0, Number(save.world.petCooldowns[id] || 0) - dt * petRate); });
    const hours = save.world.playSeconds / 3600;
    if (hours >= OMEN_HOUR && save.world.phase === 'bright') save.world.phase = 'omens';
    if (hours >= FINAL_HOUR && !save.world.finaleWon && !save.world.finaleLost) {
      save.world.phase = 'invasion';
      save.world.finaleStarted = true;
    }
    if (save.world.finaleLost && !save.world.finaleWon) {
      save.world.phase = 'ruin';
      save.world.invasion = clamp(save.world.invasion + dt / 3600, 0, 1);
    }
    save.world.omenStage = omenStage(save);
    save.world.ruinStage = ruinStage(save);
    return {
      crossedFinalHour: beforeHours < FINAL_HOUR && hours >= FINAL_HOUR,
      crossedOmenStage: save.world.omenStage > beforeOmenStage,
      crossedRuinStage: save.world.ruinStage > beforeRuinStage,
      omenProgress: omenProgress(save), omenStage: save.world.omenStage,
      ruinStage: save.world.ruinStage, hours
    };
  }

  function formatClock(save) {
    const minute = Math.floor(save.world.worldMinute % 60).toString().padStart(2, '0');
    const hour = Math.floor(save.world.worldMinute / 60).toString().padStart(2, '0');
    return 'DAY ' + save.world.day + ' · ' + hour + ':' + minute;
  }

  function saveToStorage(save, storage) {
    save.lastSavedAt = Date.now();
    (storage || localStorage).setItem(STORAGE_KEY, JSON.stringify(save));
    return save;
  }

  function loadFromStorage(storage) {
    try { return normalizeSave(JSON.parse((storage || localStorage).getItem(STORAGE_KEY))); }
    catch (_) { return null; }
  }

  return {
    FINAL_HOUR, GEAR_DRAWBACKS, GEAR_EFFECTS, OMEN_HOUR, SAVE_SCHEMA, STORAGE_KEY, acceptEncounterRecovery, addGear, addIngredient, advanceWorld, aftermathStatus, applyStoryChoice, beginEncounter, bondPet, claimPondHarvest, clamp, completeVillageFavor, consumeMossDrop, cook, cookLegacy, damagePet,
    equipGear, equipmentCouncilStatus, fishingReward, formatClock, gearArgumentProfile, loadFromStorage, mulberry32, newSave, normalizeSave, omenProgress, omenStage,
    gearEffects, hearAftermath, loseEncounter, mealActive, originEchoEffects, originEchoStatus, originParadeRoute, originParadeStatus, recordChallenge, releaseFish, requirementMet, resolveOriginEcho, retuneCost, retuneGear, revivePets, rollDrop, ruinStage, salvageGear, saveToStorage, selectPet, setGearArgument, stoneCost, storyEffects, storyOutcome, triggerPetSpecial, useIngredients, winEncounter
  };
});
