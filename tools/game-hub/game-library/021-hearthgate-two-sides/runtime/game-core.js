(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HearthgateCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const WORLD = Object.freeze({ width: 960, height: 540, gateX: 430, sanctumX: 858 });
  const SIDES = Object.freeze(['north', 'south']);
  const BUILDING_SLOTS = Object.freeze([
    Object.freeze({ x: 550, y: 148, side: 'north', owner: 0 }),
    Object.freeze({ x: 682, y: 164, side: 'north', owner: 0 }),
    Object.freeze({ x: 550, y: 230, side: 'north', owner: 0 }),
    Object.freeze({ x: 710, y: 238, side: 'north', owner: 0 }),
    Object.freeze({ x: 550, y: 310, side: 'south', owner: 1 }),
    Object.freeze({ x: 710, y: 302, side: 'south', owner: 1 }),
    Object.freeze({ x: 550, y: 392, side: 'south', owner: 1 }),
    Object.freeze({ x: 682, y: 376, side: 'south', owner: 1 })
  ]);
  const BUILDING_TYPES = Object.freeze({
    forge: {
      id: 'forge', label: 'Forge', icon: 'M', cost: 70, tag: 'METAL INCOME', short: '+M',
      description: 'Smelts a steady stream of metal.', color: '#d98959'
    },
    market: {
      id: 'market', label: 'Moon Market', icon: 'G', cost: 85, tag: 'GOLD INCOME', short: '+G',
      description: 'Earns gold between enemy drops.', color: '#eac06c'
    },
    ballista: {
      id: 'ballista', label: 'Ballista Yard', icon: 'B', cost: 95, tag: 'LANE ATTACK', short: 'BOLT',
      description: 'Fires heavy bolts across the inner ward.', color: '#83b36a'
    },
    alchemist: {
      id: 'alchemist', label: 'Ember Lab', icon: 'E', cost: 115, tag: 'BREACH SPLASH', short: 'BOOM',
      description: 'Splash-burns enemies that breach the gate.', color: '#be79a7'
    }
  });

  const CONFIG = Object.freeze({
    sanctumMaxHp: 260,
    rebuildWindow: 10,
    towerBaseHp: 170,
    towerBaseDamage: 22,
    towerFireRate: 0.92,
    towerRange: 310,
    powerShotCooldown: 5,
    wardenSpeed: 142,
    wardenRange: 285,
    wardenDamage: 11,
    wardenFireRate: 0.32,
    prepSeconds: 8,
    baseSpawnInterval: 2.25,
    minimumSpawnInterval: 0.48,
    specialFirstAt: 30,
    specialInterval: 40,
    surgeFirstAt: 22,
    surgeInterval: 28,
    oathChapterSeconds: 72,
    oathCompleteAt: 360,
    hexerWardRadius: 130,
    hexerDamageMultiplier: 0.65,
    warlordCommandRadius: 160,
    warlordSpeedMultiplier: 1.18,
    eventLimit: 7
  });

  const SIEGE_CHAPTERS = Object.freeze([
    Object.freeze({
      id: 'ember-muster', title: 'EMBER MUSTER', cue: 'Learn the two lanes. Raise income before the wall crowds.', accent: '#e9a85e',
      spawnIntervalMultiplier: 1, reward: Object.freeze({ gold: 28, metal: 34 }),
      mix: Object.freeze({ raider: 0.78, skitter: 0.14, brute: 0.08 }),
      formation: Object.freeze([Object.freeze({ kind: 'raider', side: 'north' }), Object.freeze({ kind: 'raider', side: 'south' })])
    }),
    Object.freeze({
      id: 'twin-fang-rush', title: 'TWIN FANG RUSH', cue: 'Skitter packs screen a Hexer. Break the ward before the runners.', accent: '#61c7bd',
      spawnIntervalMultiplier: 0.92, reward: Object.freeze({ gold: 40, metal: 48 }),
      mix: Object.freeze({ raider: 0.48, skitter: 0.34, brute: 0.08, hexer: 0.1 }),
      formation: Object.freeze([Object.freeze({ kind: 'skitter', side: 'north' }), Object.freeze({ kind: 'skitter', side: 'south' }), Object.freeze({ kind: 'hexer', side: 'north' })])
    }),
    Object.freeze({
      id: 'iron-bell-march', title: 'IRON BELL MARCH', cue: 'Brutes arrive under warding bells. Ballistae earn their keep.', accent: '#a7b36a',
      spawnIntervalMultiplier: 0.86, reward: Object.freeze({ gold: 54, metal: 62 }),
      mix: Object.freeze({ raider: 0.42, skitter: 0.14, brute: 0.31, hexer: 0.13 }),
      formation: Object.freeze([Object.freeze({ kind: 'brute', side: 'north' }), Object.freeze({ kind: 'brute', side: 'south' }), Object.freeze({ kind: 'hexer', side: 'south' })])
    }),
    Object.freeze({
      id: 'gilded-eclipse', title: 'GILDED ECLIPSE', cue: 'Relicbacks tempt greed while warded escorts press the breach.', accent: '#f2c164',
      spawnIntervalMultiplier: 0.8, reward: Object.freeze({ gold: 70, metal: 76 }),
      mix: Object.freeze({ raider: 0.34, skitter: 0.17, brute: 0.22, hexer: 0.12, relic: 0.15 }),
      formation: Object.freeze([Object.freeze({ kind: 'relic', side: 'north' }), Object.freeze({ kind: 'relic', side: 'south' }), Object.freeze({ kind: 'hexer', side: 'north' }), Object.freeze({ kind: 'brute', side: 'south' })])
    }),
    Object.freeze({
      id: 'hearthbreaker-oath', title: 'HEARTHBREAKER OATH', cue: 'Twin Warlords command the final procession. Split their auras.', accent: '#d96b6b',
      spawnIntervalMultiplier: 0.9, reward: Object.freeze({ gold: 96, metal: 104 }),
      mix: Object.freeze({ raider: 0.38, skitter: 0.18, brute: 0.24, hexer: 0.1, relic: 0.1 }),
      formation: Object.freeze([Object.freeze({ kind: 'warlord', side: 'north' }), Object.freeze({ kind: 'warlord', side: 'south' }), Object.freeze({ kind: 'brute', side: 'north' }), Object.freeze({ kind: 'brute', side: 'south' }), Object.freeze({ kind: 'skitter', side: 'north' }), Object.freeze({ kind: 'skitter', side: 'south' })])
    })
  ]);

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value, places) {
    const scale = Math.pow(10, places || 0);
    return Math.round(value * scale) / scale;
  }

  function seededRandom(state) {
    state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
    return state.seed / 4294967296;
  }

  function towerMaxHp(gateLevel) {
    return CONFIG.towerBaseHp + (gateLevel - 1) * 62;
  }

  function towerDamage(level) {
    return round(CONFIG.towerBaseDamage * Math.pow(1.43, level - 1), 1);
  }

  function towerUpgradeCost(level) {
    return Math.round(62 * Math.pow(1.58, level - 1));
  }

  function gateUpgradeCost(level) {
    return Math.round(105 * Math.pow(1.48, level - 1));
  }

  function rebuildCost(state, tower) {
    const quick = tower.rebuildTimer > 0;
    return Math.round((quick ? 56 : 118) * (1 + (state.gateLevel - 1) * 0.18));
  }

  function buildingUpgradeCost(building) {
    return Math.round(65 * Math.pow(1.52, building.level - 1));
  }

  function buildingSummary(type, level) {
    const rank = Math.max(1, Number(level) || 1);
    if (type === 'forge') return `+${round(1.15 + rank * 0.72, 1)} metal/sec to owner`;
    if (type === 'market') return `+${round(0.78 + rank * 0.5, 1)} gold/sec to owner`;
    if (type === 'ballista') return `${19 + rank * 12} lane damage every ${round(Math.max(0.48, 1.65 - rank * 0.16), 2)} sec`;
    if (type === 'alchemist') return `${12 + rank * 8} breach splash · ${60 + rank * 8} radius`;
    return '';
  }

  function buildingChoiceFromVector(x, y, fallback) {
    const fallbackType = BUILDING_TYPES[fallback] ? fallback : 'forge';
    const horizontal = Number(x) || 0;
    const vertical = Number(y) || 0;
    if (Math.hypot(horizontal, vertical) < 0.35) return fallbackType;
    if (Math.abs(horizontal) > Math.abs(vertical)) return horizontal > 0 ? 'ballista' : 'alchemist';
    return vertical > 0 ? 'market' : 'forge';
  }

  function ownerForSide(state, side) {
    return state.mode === 'coop' && side === 'south' ? 1 : 0;
  }

  function walletFor(state, owner) {
    const index = state.mode === 'coop' && Number(owner) === 1 ? 1 : 0;
    return state.playerResources[index];
  }

  function syncResourceTotals(state) {
    const count = state.mode === 'coop' ? 2 : 1;
    state.resources.gold = 0;
    state.resources.metal = 0;
    state.income.gold = 0;
    state.income.metal = 0;
    for (let index = 0; index < count; index += 1) {
      state.resources.gold += state.playerResources[index].gold;
      state.resources.metal += state.playerResources[index].metal;
      state.income.gold += state.playerIncome[index].gold;
      state.income.metal += state.playerIncome[index].metal;
    }
  }

  function spend(state, owner, currency, cost) {
    const wallet = walletFor(state, owner);
    if (wallet[currency] < cost) return false;
    wallet[currency] -= cost;
    syncResourceTotals(state);
    return true;
  }

  function sideY(side) {
    return side === 'north' ? 236 : 304;
  }

  function addEvent(state, text, tone) {
    state.events.unshift({ id: ++state.nextEventId, text, tone: tone || 'info', at: state.time });
    if (state.events.length > CONFIG.eventLimit) state.events.length = CONFIG.eventLimit;
  }

  function siegeChapterAt(time) {
    const index = clamp(Math.floor(Math.max(0, Number(time) || 0) / CONFIG.oathChapterSeconds), 0, SIEGE_CHAPTERS.length - 1);
    return SIEGE_CHAPTERS[index];
  }

  function activeSiegeChapter(state) {
    return siegeChapterAt(state && state.time);
  }

  function weightedEnemyKind(state, roll) {
    const mix = activeSiegeChapter(state).mix;
    let cursor = clamp(Number(roll) || 0, 0, 0.999999);
    const kinds = Object.keys(mix);
    for (const kind of kinds) {
      cursor -= mix[kind];
      if (cursor < 0) return kind;
    }
    return kinds[kinds.length - 1] || 'raider';
  }

  function createTower(side, gateLevel) {
    return {
      side,
      level: 1,
      hp: towerMaxHp(gateLevel),
      maxHp: towerMaxHp(gateLevel),
      fireClock: 0,
      powerCooldown: 0,
      down: false,
      rebuildTimer: 0,
      selectedTarget: null,
      shots: 0
    };
  }

  function createWarden(index, mode) {
    const north = index === 0;
    return {
      id: `p${index + 1}`,
      active: index === 0 || mode === 'coop',
      side: north ? 'north' : 'south',
      x: 618,
      y: north ? 218 : 322,
      aimX: -1,
      aimY: 0,
      fireClock: 0,
      stride: 0,
      shots: 0,
      connected: false
    };
  }

  function createState(options) {
    const opts = options || {};
    const gateLevel = 1;
    const mode = opts.mode === 'coop' ? 'coop' : 'single';
    const playerResources = mode === 'coop'
      ? [{ gold: 105, metal: 170 }, { gold: 105, metal: 170 }]
      : [{ gold: 145, metal: 220 }, { gold: 0, metal: 0 }];
    return {
      schema: 'hearthgate-state/v2',
      status: opts.status || 'title',
      mode,
      seed: Number.isInteger(opts.seed) ? opts.seed >>> 0 : 210821,
      time: 0,
      score: 0,
      wave: 1,
      nextEnemyId: 0,
      nextEventId: 0,
      spawnClock: 1.4,
      prepTime: CONFIG.prepSeconds,
      nextSpecialAt: CONFIG.specialFirstAt,
      nextSurgeAt: CONFIG.surgeFirstAt,
      playerResources,
      playerIncome: [{ gold: 0, metal: 0 }, { gold: 0, metal: 0 }],
      resources: { gold: playerResources[0].gold + (mode === 'coop' ? playerResources[1].gold : 0), metal: playerResources[0].metal + (mode === 'coop' ? playerResources[1].metal : 0) },
      income: { gold: 0, metal: 0 },
      gateLevel,
      sanctumHp: CONFIG.sanctumMaxHp,
      sanctumMaxHp: CONFIG.sanctumMaxHp,
      towers: SIDES.map(side => createTower(side, gateLevel)),
      wardens: [createWarden(0, opts.mode), createWarden(1, opts.mode)],
      buildings: BUILDING_SLOTS.map(() => null),
      buildingClocks: BUILDING_SLOTS.map(() => 0),
      enemies: [],
      projectiles: [],
      particles: [],
      events: [],
      chronicle: {
        schema: 'axm.hearthgate-oathbound/v1',
        currentChapterId: SIEGE_CHAPTERS[0].id,
        enteredChapterIds: [],
        formedChapterIds: [],
        clearedChapterIds: [],
        receipts: [],
        completed: false,
        masteryStartedAt: null
      },
      stats: {
        defeated: 0,
        breached: 0,
        specialsDefeated: 0,
        goldEarned: 0,
        metalEarned: 0,
        commandersDefeated: 0,
        rebuilds: 0,
        powerShots: 0,
        longestSeconds: 0
      }
    };
  }

  function startGame(state, mode) {
    if (!state || state.status === 'running') return false;
    const fresh = createState({ mode: mode || state.mode, seed: state.seed });
    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, fresh, { status: 'running' });
    enterChapter(state, 0, false);
    addEvent(state, state.mode === 'coop' ? 'Two wardens take the wall.' : 'One warden commands both sides.', 'good');
    return true;
  }

  function getTower(state, side) {
    return state.towers.find(tower => tower.side === side) || null;
  }

  function enemyHealthAt(time, kind) {
    const bulk = Math.pow(1 + time / 145, 1.42);
    const base = kind === 'warlord' ? 220 : kind === 'hexer' ? 78 : kind === 'brute' ? 105 : kind === 'relic' ? 155 : kind === 'skitter' ? 31 : 48;
    return Math.round(base * bulk);
  }

  function spawnEnemy(state, forcedKind, forcedSide) {
    if (state.enemies.length >= 110) return null;
    const roll = seededRandom(state);
    let kind = forcedKind;
    if (!kind) {
      if (state.time >= state.nextSpecialAt) {
        kind = 'relic';
        state.nextSpecialAt += CONFIG.specialInterval + Math.floor(seededRandom(state) * 13) - 6;
      } else kind = weightedEnemyKind(state, roll);
    }
    const side = forcedSide || (seededRandom(state) < 0.5 ? 'north' : 'south');
    const maxHp = enemyHealthAt(state.time, kind);
    const enemy = {
      id: ++state.nextEnemyId,
      kind,
      side,
      x: -22 - seededRandom(state) * 35,
      y: sideY(side) + (seededRandom(state) - 0.5) * 8,
      targetY: 0,
      hp: maxHp,
      maxHp,
      speed: (kind === 'warlord' ? 28 : kind === 'hexer' ? 38 : kind === 'brute' ? 31 : kind === 'relic' ? 42 : kind === 'skitter' ? 72 : 47) * (1 + Math.min(0.42, state.time / 620)),
      damage: (kind === 'warlord' ? 18 : kind === 'hexer' ? 5 : kind === 'brute' ? 12 : kind === 'relic' ? 8 : kind === 'skitter' ? 4 : 6) * (1 + state.time / 360),
      attackClock: 0.35 + seededRandom(state) * 0.4,
      breached: false,
      dead: false,
      flash: 0,
      phase: seededRandom(state) * Math.PI * 2
    };
    state.enemies.push(enemy);
    if (kind === 'relic') addEvent(state, 'A gilded Relicback approaches — rich rewards!', 'special');
    else if (kind === 'hexer') addEvent(state, `A Hexer wards the ${side} procession — focus the bell!`, 'special');
    else if (kind === 'warlord') addEvent(state, `A Warlord commands the ${side} lane — split the formation!`, 'danger');
    return enemy;
  }

  function isEnemyWarded(state, enemy) {
    if (!enemy || enemy.dead || enemy.kind === 'hexer' || enemy.kind === 'warlord') return false;
    return state.enemies.some(source => !source.dead && source.kind === 'hexer' && source.side === enemy.side && Math.hypot(source.x - enemy.x, source.y - enemy.y) <= CONFIG.hexerWardRadius);
  }

  function isEnemyCommanded(state, enemy) {
    if (!enemy || enemy.dead || enemy.kind === 'warlord') return false;
    return state.enemies.some(source => !source.dead && source.kind === 'warlord' && source.side === enemy.side && Math.hypot(source.x - enemy.x, source.y - enemy.y) <= CONFIG.warlordCommandRadius);
  }

  function chooseTarget(state, tower) {
    const preferred = state.enemies.find(enemy => enemy.id === tower.selectedTarget && !enemy.dead);
    if (preferred && Math.abs(preferred.x - WORLD.gateX) <= CONFIG.towerRange) return preferred;
    const sameSide = state.enemies
      .filter(enemy => !enemy.dead && enemy.side === tower.side && Math.abs(enemy.x - WORLD.gateX) <= CONFIG.towerRange)
      .sort((a, b) => {
        if (a.breached !== b.breached) return a.breached ? -1 : 1;
        return b.x - a.x;
      });
    return sameSide[0] || null;
  }

  function damageEnemy(state, enemy, amount, source) {
    if (!enemy || enemy.dead) return false;
    const wardMultiplier = isEnemyWarded(state, enemy) ? CONFIG.hexerDamageMultiplier : 1;
    enemy.hp -= amount * wardMultiplier;
    enemy.flash = 0.12;
    if (enemy.hp > 0) return false;
    enemy.dead = true;
    const special = enemy.kind === 'relic';
    const gold = enemy.kind === 'warlord' ? 110 : enemy.kind === 'hexer' ? 14 : special ? 68 : enemy.kind === 'brute' ? 18 : enemy.kind === 'skitter' ? 7 : 9;
    const metal = enemy.kind === 'warlord' ? 70 : enemy.kind === 'hexer' ? 6 : special ? 44 : enemy.kind === 'brute' ? 7 : enemy.kind === 'skitter' ? 2 : 3;
    const owner = state.mode === 'coop' && (source === 1 || source === 'p2' || source === 'south') ? 1 : 0;
    const wallet = walletFor(state, owner);
    wallet.gold += gold;
    wallet.metal += metal;
    syncResourceTotals(state);
    state.stats.goldEarned += gold;
    state.stats.metalEarned += metal;
    state.stats.defeated += 1;
    state.score += Math.round(enemy.maxHp + (special ? 240 : 0));
    if (enemy.kind === 'warlord') {
      state.stats.commandersDefeated += 1;
      addEvent(state, `Warlord broken by W${owner + 1}: +${gold} gold, +${metal} metal!`, 'good');
    }
    if (special) {
      state.stats.specialsDefeated += 1;
      addEvent(state, `Relicback felled by W${owner + 1}: +${gold} gold, +${metal} metal!`, 'special');
    }
    state.particles.push({ kind: special ? 'treasure' : 'defeat', x: enemy.x, y: enemy.y, life: 0.7, source });
    return true;
  }

  function grantChapterReward(state, chapter) {
    const count = state.mode === 'coop' ? 2 : 1;
    for (let owner = 0; owner < count; owner += 1) {
      state.playerResources[owner].gold += chapter.reward.gold;
      state.playerResources[owner].metal += chapter.reward.metal;
    }
    state.stats.goldEarned += chapter.reward.gold * count;
    state.stats.metalEarned += chapter.reward.metal * count;
    state.score += (chapter.reward.gold + chapter.reward.metal) * count;
    syncResourceTotals(state);
  }

  function sealChapter(state, index) {
    const chapter = SIEGE_CHAPTERS[index];
    if (!chapter || state.chronicle.clearedChapterIds.includes(chapter.id)) return false;
    grantChapterReward(state, chapter);
    state.chronicle.clearedChapterIds.push(chapter.id);
    state.chronicle.receipts.push({
      id: chapter.id,
      title: chapter.title,
      endedAt: round(Math.min(state.time, (index + 1) * CONFIG.oathChapterSeconds), 1),
      score: state.score,
      defeated: state.stats.defeated,
      breached: state.stats.breached,
      hearthHp: round(state.sanctumHp, 1),
      gateLevel: state.gateLevel,
      reward: { goldPerWarden: chapter.reward.gold, metalPerWarden: chapter.reward.metal }
    });
    addEvent(state, `${chapter.title} SEALED · each warden +${chapter.reward.gold} gold / +${chapter.reward.metal} metal.`, 'good');
    return true;
  }

  function spawnChapterFormation(state, index) {
    const chapter = SIEGE_CHAPTERS[index];
    if (!chapter || state.chronicle.formedChapterIds.includes(chapter.id)) return false;
    state.chronicle.formedChapterIds.push(chapter.id);
    chapter.formation.forEach(member => spawnEnemy(state, member.kind, member.side));
    return true;
  }

  function enterChapter(state, index, withFormation) {
    const chapter = SIEGE_CHAPTERS[index];
    if (!chapter || state.chronicle.enteredChapterIds.includes(chapter.id)) return false;
    state.chronicle.currentChapterId = chapter.id;
    state.chronicle.enteredChapterIds.push(chapter.id);
    if (withFormation !== false) spawnChapterFormation(state, index);
    addEvent(state, `${chapter.title} · ${chapter.cue}`, index === 0 ? 'good' : 'danger');
    return true;
  }

  function advanceChronicle(state) {
    if (!state.chronicle.enteredChapterIds.length) enterChapter(state, 0);
    const targetIndex = Math.min(SIEGE_CHAPTERS.length - 1, Math.floor(state.time / CONFIG.oathChapterSeconds));
    for (let index = 1; index <= targetIndex; index += 1) {
      sealChapter(state, index - 1);
      enterChapter(state, index);
    }
    if (state.time >= CONFIG.oathCompleteAt && !state.chronicle.completed) {
      sealChapter(state, SIEGE_CHAPTERS.length - 1);
      state.chronicle.completed = true;
      state.chronicle.masteryStartedAt = round(state.time, 1);
      state.chronicle.currentChapterId = 'endless-vigil';
      addEvent(state, 'OATHBOUND SIEGE COMPLETE · ENDLESS VIGIL CONTINUES.', 'special');
    }
  }

  function fireTower(state, tower, power) {
    if (!tower || tower.down) return false;
    const target = chooseTarget(state, tower);
    if (!target) return false;
    const damage = towerDamage(tower.level) * (power ? 2.8 : 1);
    damageEnemy(state, target, damage, tower.side);
    tower.shots += 1;
    state.projectiles.push({
      kind: power ? 'power' : 'bolt', side: tower.side,
      fromX: WORLD.gateX - 2, fromY: sideY(tower.side),
      toX: target.x, toY: target.y, life: power ? 0.2 : 0.13
    });
    return true;
  }

  function powerShot(state, side) {
    if (!state || state.status !== 'running') return { ok: false, reason: 'not-running' };
    const tower = getTower(state, side);
    if (!tower || tower.down) return { ok: false, reason: 'tower-down' };
    if (tower.powerCooldown > 0) return { ok: false, reason: 'cooldown' };
    if (!fireTower(state, tower, true)) return { ok: false, reason: 'no-target' };
    tower.powerCooldown = CONFIG.powerShotCooldown;
    state.stats.powerShots += 1;
    return { ok: true };
  }

  function wardenTarget(state, warden) {
    let target = null;
    let best = -Infinity;
    state.enemies.forEach(enemy => {
      if (enemy.dead) return;
      if (state.mode === 'coop' && enemy.side !== warden.side) return;
      const dx = enemy.x - warden.x;
      const dy = enemy.y - warden.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 1 || distance > CONFIG.wardenRange) return;
      const alignment = (dx / distance) * warden.aimX + (dy / distance) * warden.aimY;
      if (alignment < 0.42) return;
      const threat = enemy.breached ? 0.3 : 0;
      const value = alignment * 2.2 + threat - distance / 900;
      if (value > best) { best = value; target = enemy; }
    });
    return target;
  }

  function fireWarden(state, warden) {
    const target = wardenTarget(state, warden);
    if (!target) return false;
    const damage = CONFIG.wardenDamage + Math.floor(state.gateLevel / 2) * 2;
    damageEnemy(state, target, damage, warden.id);
    state.projectiles.push({
      kind: 'warden', side: warden.side,
      fromX: warden.x, fromY: warden.y,
      toX: target.x, toY: target.y, life: 0.12
    });
    warden.shots += 1;
    return true;
  }

  function updateWarden(state, index, input, dt) {
    if (!state || state.status !== 'running') return false;
    const warden = state.wardens[index];
    if (!warden || !warden.active) return false;
    const delta = clamp(Number(dt) || 0, 0, 0.1);
    const controls = input || {};
    let moveX = clamp(Number(controls.moveX) || 0, -1, 1);
    let moveY = clamp(Number(controls.moveY) || 0, -1, 1);
    const moveLength = Math.hypot(moveX, moveY);
    if (moveLength > 1) { moveX /= moveLength; moveY /= moveLength; }
    warden.x = clamp(warden.x + moveX * CONFIG.wardenSpeed * delta, WORLD.gateX + 42, WORLD.sanctumX - 46);
    const minY = state.mode === 'coop' ? (warden.side === 'north' ? 112 : 276) : 112;
    const maxY = state.mode === 'coop' ? (warden.side === 'north' ? 264 : 428) : 428;
    warden.y = clamp(warden.y + moveY * CONFIG.wardenSpeed * delta, minY, maxY);
    warden.stride += Math.hypot(moveX, moveY) * delta * 9;

    const aimX = clamp(Number(controls.aimX) || 0, -1, 1);
    const aimY = clamp(Number(controls.aimY) || 0, -1, 1);
    const aimLength = Math.hypot(aimX, aimY);
    if (aimLength > 0.24) {
      warden.aimX = aimX / aimLength;
      warden.aimY = aimY / aimLength;
    } else if (Math.hypot(moveX, moveY) > 0.24 && !controls.preserveAim) {
      warden.aimX = moveX / Math.max(0.001, Math.hypot(moveX, moveY));
      warden.aimY = moveY / Math.max(0.001, Math.hypot(moveX, moveY));
    }
    warden.fireClock = Math.max(0, warden.fireClock - delta);
    if ((controls.fire || controls.firePulse) && warden.fireClock <= 0) {
      const fired = fireWarden(state, warden);
      warden.fireClock = fired ? CONFIG.wardenFireRate : 0.09;
      return fired;
    }
    return false;
  }

  function prioritizeControllerInput(fallback, controller, connected) {
    if (!connected) return fallback;
    const source = controller || {};
    const result = Object.assign({}, fallback);
    const moveX = Number(source.moveX) || 0;
    const moveY = Number(source.moveY) || 0;
    if (Math.hypot(moveX, moveY) > 0.08) {
      result.moveX = moveX;
      result.moveY = moveY;
    }
    result.aimX = Number(source.aimX) || 0;
    result.aimY = Number(source.aimY) || 0;
    result.fire = Boolean(fallback && fallback.fire || source.fire);
    result.firePulse = Boolean(fallback && fallback.firePulse || source.firePulse);
    result.preserveAim = true;
    return result;
  }

  function cycleTarget(state, side, direction) {
    const tower = getTower(state, side);
    if (!tower || tower.down) return null;
    const targets = state.enemies
      .filter(enemy => !enemy.dead && enemy.side === side && Math.abs(enemy.x - WORLD.gateX) <= CONFIG.towerRange)
      .sort((a, b) => b.x - a.x);
    if (!targets.length) { tower.selectedTarget = null; return null; }
    const current = targets.findIndex(enemy => enemy.id === tower.selectedTarget);
    const next = (current + (direction < 0 ? -1 : 1) + targets.length) % targets.length;
    tower.selectedTarget = targets[next].id;
    return tower.selectedTarget;
  }

  function upgradeTower(state, side) {
    const tower = getTower(state, side);
    if (!tower) return { ok: false, reason: 'unknown-side' };
    if (tower.down) return { ok: false, reason: 'tower-down' };
    const cost = towerUpgradeCost(tower.level);
    const owner = ownerForSide(state, side);
    if (!spend(state, owner, 'gold', cost)) return { ok: false, reason: 'gold', cost, owner };
    tower.level += 1;
    addEvent(state, `${side === 'north' ? 'North' : 'South'} tower reaches damage level ${tower.level}.`, 'good');
    return { ok: true, cost, level: tower.level, owner };
  }

  function fortifyGate(state) {
    const cost = gateUpgradeCost(state.gateLevel);
    if (state.mode === 'coop') {
      const northCost = Math.ceil(cost / 2);
      const southCost = Math.floor(cost / 2);
      if (walletFor(state, 0).metal < northCost || walletFor(state, 1).metal < southCost) return { ok: false, reason: 'metal-team', cost, perPlayer: [northCost, southCost] };
      walletFor(state, 0).metal -= northCost;
      walletFor(state, 1).metal -= southCost;
      syncResourceTotals(state);
    } else if (!spend(state, 0, 'metal', cost)) return { ok: false, reason: 'metal', cost, owner: 0 };
    state.gateLevel += 1;
    const newMax = towerMaxHp(state.gateLevel);
    state.towers.forEach(tower => {
      const gain = newMax - tower.maxHp;
      tower.maxHp = newMax;
      if (!tower.down) tower.hp = Math.min(newMax, tower.hp + gain + 24);
    });
    addEvent(state, `Gate fortified to level ${state.gateLevel}.`, 'good');
    return { ok: true, cost, level: state.gateLevel };
  }

  function repairOrRebuild(state, side) {
    const tower = getTower(state, side);
    const owner = ownerForSide(state, side);
    if (!tower) return { ok: false, reason: 'unknown-side' };
    if (tower.down) {
      const cost = rebuildCost(state, tower);
      if (!spend(state, owner, 'metal', cost)) return { ok: false, reason: 'metal', cost, owner };
      const quick = tower.rebuildTimer > 0;
      tower.down = false;
      tower.rebuildTimer = 0;
      tower.hp = Math.round(tower.maxHp * (quick ? 0.72 : 0.48));
      tower.fireClock = 0.25;
      state.stats.rebuilds += 1;
      addEvent(state, `${side === 'north' ? 'North' : 'South'} tower rebuilt${quick ? ' inside the quick window' : ''}!`, 'good');
      return { ok: true, cost, rebuilt: true, quick, owner };
    }
    if (tower.hp >= tower.maxHp - 0.1) return { ok: false, reason: 'full' };
    const missing = tower.maxHp - tower.hp;
    const amount = Math.min(missing, 58 + state.gateLevel * 9);
    const cost = Math.max(12, Math.round(amount * 0.42));
    if (!spend(state, owner, 'metal', cost)) return { ok: false, reason: 'metal', cost, owner };
    tower.hp += amount;
    addEvent(state, `${side === 'north' ? 'North' : 'South'} tower repaired.`, 'good');
    return { ok: true, cost, repaired: true, owner };
  }

  function build(state, slot, type) {
    const index = Number(slot);
    const spec = BUILDING_TYPES[type];
    if (!Number.isInteger(index) || index < 0 || index >= state.buildings.length) return { ok: false, reason: 'slot' };
    if (!spec) return { ok: false, reason: 'type' };
    if (state.buildings[index]) return { ok: false, reason: 'occupied' };
    const slotSpec = BUILDING_SLOTS[index];
    const owner = ownerForSide(state, slotSpec.side);
    if (!spend(state, owner, 'metal', spec.cost)) return { ok: false, reason: 'metal', cost: spec.cost, owner };
    state.buildings[index] = { type: spec.id, level: 1, shots: 0, owner, side: slotSpec.side };
    state.buildingClocks[index] = 1;
    addEvent(state, `${spec.label} raised inside the gate.`, 'good');
    return { ok: true, cost: spec.cost, owner };
  }

  function upgradeBuilding(state, slot) {
    const index = Number(slot);
    const building = state.buildings[index];
    if (!building) return { ok: false, reason: 'empty' };
    const cost = buildingUpgradeCost(building);
    const owner = Number(building.owner) === 1 ? 1 : 0;
    if (!spend(state, owner, 'metal', cost)) return { ok: false, reason: 'metal', cost, owner };
    building.level += 1;
    addEvent(state, `${BUILDING_TYPES[building.type].label} reaches level ${building.level}.`, 'good');
    return { ok: true, cost, level: building.level, owner };
  }

  function closestEnemy(state, predicate) {
    let chosen = null;
    let score = -Infinity;
    state.enemies.forEach(enemy => {
      if (enemy.dead || (predicate && !predicate(enemy))) return;
      const threat = enemy.breached ? 2000 + enemy.x : enemy.x;
      if (threat > score) { score = threat; chosen = enemy; }
    });
    return chosen;
  }

  function tickBuildings(state, dt) {
    const rates = [{ gold: 0, metal: 0 }, { gold: 0, metal: 0 }];
    state.buildings.forEach((building, index) => {
      if (!building) return;
      const level = building.level;
      const owner = state.mode === 'coop' && Number(building.owner) === 1 ? 1 : 0;
      const slot = BUILDING_SLOTS[index];
      if (building.type === 'forge') {
        rates[owner].metal += 1.15 + level * 0.72;
      } else if (building.type === 'market') {
        rates[owner].gold += 0.78 + level * 0.5;
      } else if (building.type === 'ballista') {
        state.buildingClocks[index] -= dt;
        if (state.buildingClocks[index] <= 0) {
          const target = closestEnemy(state, enemy => state.mode !== 'coop' || enemy.side === slot.side);
          if (target) {
            const damage = 19 + level * 12;
            damageEnemy(state, target, damage, owner);
            state.projectiles.push({ kind: 'ballista', fromX: slot.x, fromY: slot.y, toX: target.x, toY: target.y, life: 0.18 });
            building.shots += 1;
          }
          state.buildingClocks[index] = Math.max(0.48, 1.65 - level * 0.16);
        }
      } else if (building.type === 'alchemist') {
        state.buildingClocks[index] -= dt;
        if (state.buildingClocks[index] <= 0) {
          const target = closestEnemy(state, enemy => enemy.breached && (state.mode !== 'coop' || enemy.side === slot.side));
          if (target) {
            const radius = 60 + level * 8;
            state.enemies.forEach(enemy => {
              if (!enemy.dead && enemy.breached && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= radius) {
                damageEnemy(state, enemy, 12 + level * 8, owner);
              }
            });
            state.particles.push({ kind: 'ember', x: target.x, y: target.y, life: 0.65, radius });
            building.shots += 1;
          }
          state.buildingClocks[index] = Math.max(1.1, 3.1 - level * 0.2);
        }
      }
    });
    rates.forEach((rate, index) => {
      state.playerIncome[index].gold = round(rate.gold, 1);
      state.playerIncome[index].metal = round(rate.metal, 1);
      state.playerResources[index].gold += rate.gold * dt;
      state.playerResources[index].metal += rate.metal * dt;
      state.stats.goldEarned += rate.gold * dt;
      state.stats.metalEarned += rate.metal * dt;
    });
    syncResourceTotals(state);
  }

  function destroyTower(state, tower) {
    if (tower.down) return;
    tower.down = true;
    tower.hp = 0;
    tower.rebuildTimer = CONFIG.rebuildWindow;
    tower.selectedTarget = null;
    addEvent(state, `${tower.side === 'north' ? 'North' : 'South'} tower fell — rebuild within ${CONFIG.rebuildWindow}s!`, 'danger');
  }

  function tickEnemy(state, enemy, dt) {
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.phase += dt * 6;
    const tower = getTower(state, enemy.side);
    const commandedSpeed = enemy.speed * (isEnemyCommanded(state, enemy) ? CONFIG.warlordSpeedMultiplier : 1);
    if (!enemy.breached) {
      if (enemy.x < WORLD.gateX - 24) {
        enemy.x += commandedSpeed * dt;
        enemy.y += (sideY(enemy.side) - enemy.y) * Math.min(1, dt * 4);
      } else if (tower && !tower.down) {
        enemy.attackClock -= dt;
        if (enemy.attackClock <= 0) {
          tower.hp -= enemy.damage;
          enemy.attackClock += enemy.kind === 'brute' ? 0.72 : 0.92;
          state.particles.push({ kind: 'hit', x: WORLD.gateX, y: sideY(enemy.side), life: 0.26 });
          if (tower.hp <= 0) destroyTower(state, tower);
        }
      } else {
        enemy.breached = true;
        enemy.x = WORLD.gateX + 8;
        const lanes = [184, 270, 356];
        enemy.targetY = lanes[Math.floor(seededRandom(state) * lanes.length)];
        enemy.damage *= 2;
        enemy.speed *= 1.08;
        enemy.attackClock = 0.4;
        state.stats.breached += 1;
        state.particles.push({ kind: 'breach', x: WORLD.gateX + 12, y: enemy.y, life: 0.8 });
      }
    } else if (enemy.x < WORLD.sanctumX - 26) {
      enemy.x += commandedSpeed * dt;
      enemy.y += (enemy.targetY - enemy.y) * Math.min(1, dt * 1.8);
    } else {
      enemy.attackClock -= dt;
      if (enemy.attackClock <= 0) {
        state.sanctumHp -= enemy.damage;
        enemy.attackClock += enemy.kind === 'brute' ? 0.75 : 1;
        state.particles.push({ kind: 'sanctum-hit', x: WORLD.sanctumX, y: enemy.y, life: 0.3 });
      }
    }
  }

  function cleanupEffects(state, dt) {
    state.projectiles.forEach(projectile => { projectile.life -= dt; });
    state.particles.forEach(particle => { particle.life -= dt; });
    state.projectiles = state.projectiles.filter(projectile => projectile.life > 0);
    state.particles = state.particles.filter(particle => particle.life > 0);
    state.enemies = state.enemies.filter(enemy => !enemy.dead);
  }

  function step(state, dt) {
    if (!state || state.status !== 'running') return state;
    const delta = clamp(Number(dt) || 0, 0, 0.1);
    if (!delta) return state;
    if (state.prepTime > 0) {
      const before = state.prepTime;
      state.prepTime = Math.max(0, state.prepTime - delta);
      tickBuildings(state, delta);
      cleanupEffects(state, delta);
      if (before > 0 && state.prepTime <= 0) {
        state.spawnClock = 0;
        spawnChapterFormation(state, 0);
        advanceChronicle(state);
        addEvent(state, 'The first enemy line advances!', 'danger');
      }
      return state;
    }
    state.time += delta;
    advanceChronicle(state);
    const previousWave = state.wave;
    state.wave = 1 + Math.floor(state.time / 24);
    if (state.wave !== previousWave) addEvent(state, `Night ${state.wave}: enemy armor and pace rise.`, 'danger');
    state.stats.longestSeconds = Math.max(state.stats.longestSeconds, state.time);

    state.spawnClock -= delta;
    if (state.spawnClock <= 0) {
      spawnEnemy(state);
      const interval = Math.max(CONFIG.minimumSpawnInterval, CONFIG.baseSpawnInterval - state.time / 165);
      state.spawnClock += interval * activeSiegeChapter(state).spawnIntervalMultiplier * (0.78 + seededRandom(state) * 0.44);
    }
    if (state.time >= state.nextSurgeAt) {
      const heavySide = state.wave % 2 ? 'north' : 'south';
      spawnEnemy(state, 'skitter', 'north');
      spawnEnemy(state, 'skitter', 'south');
      spawnEnemy(state, 'brute', heavySide);
      state.nextSurgeAt += Math.max(19, CONFIG.surgeInterval - state.time / 180);
      addEvent(state, `SURGE! Runners on both lanes · brute ${heavySide}.`, 'danger');
    }

    state.towers.forEach(tower => {
      tower.powerCooldown = Math.max(0, tower.powerCooldown - delta);
      if (tower.down) {
        tower.rebuildTimer = Math.max(0, tower.rebuildTimer - delta);
        return;
      }
      tower.fireClock -= delta;
      if (tower.fireClock <= 0) {
        const fired = fireTower(state, tower, false);
        tower.fireClock = fired ? Math.max(0.34, CONFIG.towerFireRate - (tower.level - 1) * 0.055) : 0.12;
      }
    });

    tickBuildings(state, delta);
    state.enemies.forEach(enemy => { if (!enemy.dead) tickEnemy(state, enemy, delta); });
    cleanupEffects(state, delta);
    state.playerResources.forEach(wallet => {
      wallet.gold = Math.max(0, wallet.gold);
      wallet.metal = Math.max(0, wallet.metal);
    });
    syncResourceTotals(state);
    state.sanctumHp = Math.max(0, state.sanctumHp);
    if (state.sanctumHp <= 0) {
      state.status = 'over';
      addEvent(state, `Hearthgate held for ${formatTime(state.time)}.`, 'danger');
    }
    return state;
  }

  function formatTime(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(value / 60);
    return `${minutes}:${String(value % 60).padStart(2, '0')}`;
  }

  function snapshot(state) {
    return {
      status: state.status,
      mode: state.mode,
      time: round(state.time, 1),
      prepTime: round(state.prepTime, 1),
      wave: state.wave,
      score: state.score,
      resources: { gold: Math.floor(state.resources.gold), metal: Math.floor(state.resources.metal) },
      playerResources: state.playerResources.map(wallet => ({ gold: Math.floor(wallet.gold), metal: Math.floor(wallet.metal) })),
      playerIncome: state.playerIncome.map(income => ({ gold: income.gold, metal: income.metal })),
      sanctumHp: round(state.sanctumHp, 1),
      gateLevel: state.gateLevel,
      towers: state.towers.map(tower => ({
        side: tower.side, level: tower.level, hp: round(tower.hp, 1), maxHp: tower.maxHp,
        down: tower.down, rebuildTimer: round(tower.rebuildTimer, 1), powerCooldown: round(tower.powerCooldown, 1)
      })),
      wardens: state.wardens.map(warden => ({
        id: warden.id, active: warden.active, side: warden.side,
        x: round(warden.x, 1), y: round(warden.y, 1),
        aimX: round(warden.aimX, 2), aimY: round(warden.aimY, 2), connected: warden.connected
      })),
      buildings: state.buildings.map(building => building && { type: building.type, level: building.level, owner: building.owner, side: building.side }),
      enemies: state.enemies.map(enemy => ({ id: enemy.id, kind: enemy.kind, side: enemy.side, x: round(enemy.x, 1), y: round(enemy.y, 1), hp: round(enemy.hp, 1), maxHp: enemy.maxHp, breached: enemy.breached, warded: isEnemyWarded(state, enemy), commanded: isEnemyCommanded(state, enemy) })),
      currentChapter: Object.assign({}, activeSiegeChapter(state), { mix: undefined, formation: undefined }),
      chronicle: {
        schema: state.chronicle.schema,
        currentChapterId: state.chronicle.currentChapterId,
        enteredChapterIds: state.chronicle.enteredChapterIds.slice(),
        formedChapterIds: state.chronicle.formedChapterIds.slice(),
        clearedChapterIds: state.chronicle.clearedChapterIds.slice(),
        receipts: state.chronicle.receipts.map(receipt => Object.assign({}, receipt, { reward: Object.assign({}, receipt.reward) })),
        completed: state.chronicle.completed,
        masteryStartedAt: state.chronicle.masteryStartedAt
      },
      stats: Object.assign({}, state.stats)
    };
  }

  return {
    WORLD, SIDES, BUILDING_SLOTS, BUILDING_TYPES, CONFIG, SIEGE_CHAPTERS,
    clamp, createState, startGame, step, spawnEnemy, damageEnemy,
    powerShot, cycleTarget, updateWarden, prioritizeControllerInput, fireWarden, upgradeTower, fortifyGate, repairOrRebuild,
    build, upgradeBuilding, getTower, towerDamage, towerUpgradeCost,
    gateUpgradeCost, rebuildCost, buildingUpgradeCost, buildingSummary, buildingChoiceFromVector, enemyHealthAt, walletFor,
    siegeChapterAt, activeSiegeChapter, isEnemyWarded, isEnemyCommanded,
    formatTime, snapshot
  };
});
