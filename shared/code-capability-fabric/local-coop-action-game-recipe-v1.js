'use strict';

const RECIPE_ID = 'twin-reactor-action-coop';
const WORLD = Object.freeze({ width: 30, height: 17 });
const CANDIDATE = Object.freeze({ id: 'twin-reactor-coop-native', version: 'v0.3', status: 'EXPERIMENTAL' });

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function buildArena(seed, difficulty) {
  const spawns = [
    { x: 72 + (seed % 17), y: 72 }, { x: 888, y: 72 + (seed % 19) },
    { x: 888 - (seed % 23), y: 472 }, { x: 72, y: 472 - (seed % 13) },
    { x: 480, y: 64 }, { x: 480, y: 480 }
  ];
  const enemyCounts = difficulty === 'CALM' ? [3, 4, 5] : difficulty === 'BRISK' ? [5, 7, 9] : [4, 6, 8];
  return {
    width: 960, height: 544, margin: 32,
    reactor: { x: 480, y: 272, radius: 42, health: 100 },
    playerSpawns: [{ id: 'p1', x: 360, y: 272 }, { id: 'p2', x: 600, y: 272 }],
    enemySpawns: spawns,
    obstacles: [
      { x: 262, y: 164, radius: 32 }, { x: 698, y: 164, radius: 32 },
      { x: 262, y: 380, radius: 32 }, { x: 698, y: 380, radius: 32 }
    ],
    enemyCounts
  };
}

function buildConfig(brief, prebuildPlan) {
  if (!prebuildPlan || prebuildPlan.schema !== 'axm.game-prebuild-plan/v1' || prebuildPlan.recipeId !== RECIPE_ID || prebuildPlan.authority !== 'NONE') throw new Error('exact asset-aware prebuild plan is required');
  const appliedRepairs = prebuildPlan.repairs.filter((item) => item.state === 'APPLIED_BEFORE_BUILD').map((item) => item.id);
  if (!appliedRepairs.includes('projectile-spawn-and-swept-collision-v1')) throw new Error('projectile integrity repair must be applied before build');
  return {
    schema: 'axm.local-coop-action-game-config/v1', title: brief.title,
    seed: brief.seed, difficulty: brief.difficulty, arena: buildArena(brief.seed, brief.difficulty),
    rules: {
      fixedTick: true, waves: 3, entityCap: 18, playerHealth: 3,
      playerSpeed: 3, dashDistance: 28, dashCooldownTicks: 48,
      attackRange: 62, attackCooldownTicks: 16, reviveRange: 74,
      reviveHoldTicks: 36, enemySpeed: brief.difficulty === 'BRISK' ? 1.45 : brief.difficulty === 'CALM' ? 0.9 : 1.15,
      projectileSpeed: 12, projectileLifetimeTicks: 46, projectileCap: 24,
      linkRange: 260, linkedDamage: 2,
      repairCoreCap: 6, repairCoreHeal: 12, repairCorePickupRange: 30,
      nextWaveDelayTicks: 42
    },
    inputs: {
      p1: { move: ['KeyW', 'KeyA', 'KeyS', 'KeyD'], attackOrRevive: 'KeyF', dash: 'KeyG' },
      p2: { move: ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'], attackOrRevive: 'KeyK', dash: 'KeyL' },
      shared: { startOrRestart: 'Enter', pause: 'Escape' }
    },
    prebuild: {
      schema: prebuildPlan.schema,
      planDigest: prebuildPlan.planDigest,
      snapshotDigest: prebuildPlan.snapshotRef.sha256,
      appliedRepairs,
      assetRoutes: prebuildPlan.assetRoutes.map((item) => ({ id: item.id, handId: item.handId, state: item.state, artifactProduced: item.artifactProduced }))
    },
    visual: clone(prebuildPlan.visualSystem),
    session: clone(brief.session), authority: 'NONE'
  };
}

function buildProject(brief, prebuildPlan) {
  if (!prebuildPlan || prebuildPlan.schema !== 'axm.game-prebuild-plan/v1') throw new Error('game project requires the exact prebuild plan');
  const cells = [];
  for (let y = 0; y < WORLD.height; y += 1) {
    for (let x = 0; x < WORLD.width; x += 1) {
      const edge = x === 0 || y === 0 || x === WORLD.width - 1 || y === WORLD.height - 1;
      cells.push({ terrain: edge ? 'wall' : 'ground', height: 0 });
    }
  }
  return {
    schema: 'axm.game-forge-project/v1', id: brief.id, name: brief.title,
    version: '0.3.0', runtimeMode: '2D', status: 'DRAFT', createdAt: null,
    updatedAt: null, capabilityPlan: { schema: prebuildPlan.schema, sha256: prebuildPlan.planDigest, authority: 'NONE' },
    world: { width: WORLD.width, height: WORLD.height, cells },
    physics: { schema: 'axm.game-physics-config/v1', engine: 'axm-physics-2d', engineVersion: '0.3.1', enabled: false, world: null, updatedAt: null },
    events: { nodes: [], edges: [] },
    systems: [
      { id: 'twin-reactor-shared-objective', type: 'Quest', state: 'DECLARED' },
      { id: 'local-two-seat-input', type: 'Input', state: 'DECLARED' },
      { id: 'partner-revive', type: 'Coop', state: 'DECLARED' },
      { id: 'twin-link-field', type: 'Coop', state: 'DECLARED' },
      { id: 'directional-energy-bolts', type: 'Combat', state: 'DECLARED' },
      { id: 'repair-core-recovery', type: 'Recovery', state: 'DECLARED' },
      { id: 'wave-three-warden', type: 'Boss', state: 'DECLARED' },
      { id: 'asset-factory-capability-snapshot', type: 'AssetPlan', state: 'DECLARED' },
      { id: 'known-repair-prebuild-gate', type: 'RepairPlan', state: 'APPLIED' },
      { id: 'catalog-informed-visual-system', type: 'Presentation', state: 'DECLARED' }
    ],
    behaviors: [], tests: [], mods: []
  };
}

function runtimeFactory(CONFIG) {
  const R = CONFIG.rules;
  const A = CONFIG.arena;
  const V = CONFIG.visual;
  const requiredRepair = 'projectile-spawn-and-swept-collision-v1';
  if (!CONFIG.prebuild || !Array.isArray(CONFIG.prebuild.appliedRepairs) || !CONFIG.prebuild.appliedRepairs.includes(requiredRepair)) throw new Error('PREBUILD_REPAIR_MISSING:' + requiredRepair);
  if (!V || V.stylePresetId !== 'arcade-neon-circuit' || V.treatmentId !== 'aetherglass-cinematic') throw new Error('ASSET_AWARE_VISUAL_PLAN_MISSING');
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const copy = (value) => JSON.parse(JSON.stringify(value));

  function player(source) {
    return {
      id: source.id, x: source.x, y: source.y, hp: R.playerHealth, down: false,
      reviveProgress: 0, attackCooldown: 0, dashCooldown: 0, hurtCooldown: 0,
      facingX: source.id === 'p1' ? 1 : -1, facingY: 0, score: 0, cores: 0
    };
  }

  function enemyFor(index, wave) {
    const spawn = A.enemySpawns[(index + wave + (CONFIG.seed % A.enemySpawns.length)) % A.enemySpawns.length];
    const kind = wave === 3 && index === 0 ? 'warden' : index % 4 === 3 ? 'brute' : index % 3 === 2 ? 'runner' : 'spark';
    const hp = kind === 'warden' ? 8 : kind === 'brute' ? 3 : 1;
    return { id: 'w' + wave + '-e' + index, kind, x: spawn.x, y: spawn.y, hp, maxHp: hp, cooldown: 0, dropsCore: kind === 'brute' || kind === 'warden' };
  }

  function baseState() {
    return {
      schema: 'axm.local-coop-action-visible-state/v1', phase: 'READY', tick: 0,
      wave: 1, clearedTicks: 0, reactor: copy(A.reactor),
      players: A.playerSpawns.map(player), enemies: [], projectiles: [], repairCores: [],
      nextProjectileId: 1, nextCoreId: 1, linked: true, message: 'Press Enter or Start mission.',
      sharedOutcome: 'UNRESOLVED'
    };
  }

  function createEngine(scenario) {
    let state = baseState();

    function spawnWave() {
      const count = A.enemyCounts[state.wave - 1];
      state.enemies = Array.from({ length: count }, (_, index) => enemyFor(index, state.wave)).slice(0, R.entityCap);
      state.clearedTicks = 0;
      state.message = 'Wave ' + state.wave + ' incoming. Protect the reactor together.';
    }

    function loadScenario(name) {
      state = baseState();
      state.phase = 'RUNNING';
      state.message = 'Deterministic verification scenario: ' + name;
      if (name === 'REVIVE') {
        state.players[0].x = 450; state.players[0].y = 272;
        state.players[1].x = 500; state.players[1].y = 272;
        state.players[1].hp = 0; state.players[1].down = true;
      } else if (name === 'REACTOR_LOSS') {
        state.reactor.health = 1;
        state.enemies = [{ id: 'loss-enemy', kind: 'spark', x: state.reactor.x + state.reactor.radius + 2, y: state.reactor.y, hp: 1, maxHp: 1, cooldown: 0, dropsCore: false }];
      } else if (name === 'BOTH_DOWN') {
        state.players.forEach((item) => { item.hp = 0; item.down = true; });
      } else if (name === 'FINAL_WAVE') {
        state.wave = 3;
        state.players[0].x = 410; state.players[0].y = 272;
        state.enemies = [{ id: 'final-enemy', kind: 'spark', x: 452, y: 272, hp: 1, maxHp: 1, cooldown: 0, dropsCore: false }];
      } else if (name === 'FINAL_WAVE_P2') {
        state.wave = 3;
        state.players[1].x = 550; state.players[1].y = 272;
        state.enemies = [{ id: 'final-enemy-p2', kind: 'spark', x: 508, y: 272, hp: 1, maxHp: 1, cooldown: 0, dropsCore: false }];
      } else if (name === 'REPAIR_CORE') {
        state.reactor.health = 64;
        state.players[0].x = 430; state.players[0].y = 272;
        state.repairCores = [{ id: 'repair-core-test', x: 430, y: 272 }];
      } else if (name === 'WARDEN' || name === 'WARDEN_OVERLAP') {
        state.wave = 3;
        state.reactor.health = 76;
        if (name === 'WARDEN_OVERLAP') { state.players[0].x = 480; state.players[0].y = 100; }
        state.enemies = [{ id: 'warden-test', kind: 'warden', x: 480, y: 100, hp: 8, maxHp: 8, cooldown: 0, dropsCore: true }];
      } else if (name === 'LINK_DAMAGE' || name === 'LINK_DAMAGE_SEPARATED') {
        state.players[0].x = 300; state.players[0].y = 272;
        state.players[1].x = name === 'LINK_DAMAGE' ? 440 : 800; state.players[1].y = 272;
        state.enemies = [{ id: 'link-target', kind: 'brute', x: 342, y: 272, hp: 3, maxHp: 3, cooldown: 0, dropsCore: false }];
      } else if (name !== undefined && name !== null && name !== 'DEFAULT') {
        throw new Error('unsupported deterministic scenario');
      }
      return snapshot();
    }

    function start() {
      if (state.phase === 'READY') { state.phase = 'RUNNING'; spawnWave(); }
      else if (state.phase === 'PAUSED') { state.phase = 'RUNNING'; state.message = 'Mission resumed.'; }
      return snapshot();
    }

    function pause() {
      if (state.phase === 'RUNNING') { state.phase = 'PAUSED'; state.message = 'Paused · ' + state.message; }
      else if (state.phase === 'PAUSED') start();
      return snapshot();
    }

    function reset() { state = baseState(); return snapshot(); }

    function movePlayer(item, input, prefix) {
      if (item.down) return;
      let dx = (input[prefix + '-right'] ? 1 : 0) - (input[prefix + '-left'] ? 1 : 0);
      let dy = (input[prefix + '-down'] ? 1 : 0) - (input[prefix + '-up'] ? 1 : 0);
      if (dx && dy) { dx *= 0.707106; dy *= 0.707106; }
      if (dx || dy) { item.facingX = dx; item.facingY = dy; }
      let speed = R.playerSpeed;
      if (input[prefix + '-dash'] && item.dashCooldown === 0) {
        if (!dx && !dy) { dx = item.facingX; dy = item.facingY; }
        speed += R.dashDistance; item.dashCooldown = R.dashCooldownTicks;
      }
      item.x = clamp(item.x + dx * speed, A.margin, A.width - A.margin);
      item.y = clamp(item.y + dy * speed, A.margin, A.height - A.margin);
    }

    function attackOrRevive(item, teammate, input, prefix) {
      if (item.down || !input[prefix + '-attack']) return;
      if (teammate.down && distance(item, teammate) <= R.reviveRange) {
        teammate.reviveProgress += 1;
        state.message = item.id.toUpperCase() + ' is reviving ' + teammate.id.toUpperCase() + ' (' + teammate.reviveProgress + '/' + R.reviveHoldTicks + ').';
        if (teammate.reviveProgress >= R.reviveHoldTicks) {
          teammate.down = false; teammate.hp = 1; teammate.reviveProgress = 0; teammate.hurtCooldown = 90;
          state.message = teammate.id.toUpperCase() + ' revived. Back in the fight together.';
        }
        return;
      }
      if (item.attackCooldown > 0) return;
      item.attackCooldown = R.attackCooldownTicks;
      if (state.projectiles.length >= R.projectileCap) {
        state.message = 'The bounded bolt field is full. Reposition together.';
        return;
      }
      const linked = state.linked;
      state.projectiles.push({
        id: 'bolt-' + state.nextProjectileId++, owner: item.id,
        x: item.x + item.facingX * 22, y: item.y + item.facingY * 22,
        vx: item.facingX * R.projectileSpeed, vy: item.facingY * R.projectileSpeed,
        damage: linked ? R.linkedDamage : 1, linked, ttl: R.projectileLifetimeTicks
      });
      state.message = item.id.toUpperCase() + (linked ? ' fired a linked twin bolt.' : ' fired a solo bolt.');
    }

    function dropRepairCore(enemy) {
      if (!enemy.dropsCore || state.repairCores.length >= R.repairCoreCap) return;
      state.repairCores.push({ id: 'core-' + state.nextCoreId++, x: enemy.x, y: enemy.y });
    }

    function updateProjectiles() {
      for (const bolt of state.projectiles) {
        if (bolt.ttl <= 0) continue;
        const targetAt = () => state.enemies.find((candidate) => candidate.hp > 0 && distance(bolt, candidate) <= (candidate.kind === 'warden' ? 34 : 25));
        let enemy = targetAt();
        if (!enemy) {
          bolt.x += bolt.vx; bolt.y += bolt.vy; bolt.ttl -= 1;
          if (bolt.x < A.margin || bolt.y < A.margin || bolt.x > A.width - A.margin || bolt.y > A.height - A.margin) { bolt.ttl = 0; continue; }
          enemy = targetAt();
        }
        if (!enemy) continue;
        enemy.hp = Math.max(0, enemy.hp - bolt.damage); bolt.ttl = 0;
        if (enemy.hp === 0) {
          const owner = state.players.find((candidate) => candidate.id === bolt.owner);
          if (owner) owner.score += enemy.kind === 'warden' ? 5 : enemy.kind === 'brute' ? 2 : 1;
          dropRepairCore(enemy);
          state.message = enemy.kind === 'warden' ? 'The Warden broke. Collect its repair core!' : bolt.owner.toUpperCase() + ' cleared a ' + enemy.kind + '.';
        } else {
          state.message = enemy.kind === 'warden' ? 'The Warden absorbed ' + bolt.damage + ' damage.' : bolt.owner.toUpperCase() + ' hit a ' + enemy.kind + '.';
        }
      }
      state.projectiles = state.projectiles.filter((bolt) => bolt.ttl > 0).slice(0, R.projectileCap);
    }

    function updateRepairCores() {
      const remaining = [];
      for (const core of state.repairCores) {
        const collector = state.players.find((item) => !item.down && distance(item, core) <= R.repairCorePickupRange);
        if (!collector || state.reactor.health >= 100) { remaining.push(core); continue; }
        const before = state.reactor.health;
        state.reactor.health = Math.min(100, state.reactor.health + R.repairCoreHeal);
        collector.cores += 1;
        state.message = collector.id.toUpperCase() + ' restored the reactor: ' + before + ' → ' + state.reactor.health + '.';
      }
      state.repairCores = remaining.slice(0, R.repairCoreCap);
    }

    function updateEnemies() {
      for (const enemy of state.enemies) {
        if (enemy.hp <= 0) continue;
        enemy.cooldown = Math.max(0, enemy.cooldown - 1);
        const standing = state.players.filter((item) => !item.down);
        let target = state.reactor;
        for (const candidate of standing) {
          if (distance(enemy, candidate) < distance(enemy, target) && distance(enemy, candidate) < 190) target = candidate;
        }
        const dx = target.x - enemy.x, dy = target.y - enemy.y, length = Math.hypot(dx, dy) || 1;
        const speedFactor = enemy.kind === 'runner' ? 1.45 : enemy.kind === 'brute' ? 0.72 : enemy.kind === 'warden' ? 0.58 : 1;
        enemy.x += dx / length * R.enemySpeed * speedFactor; enemy.y += dy / length * R.enemySpeed * speedFactor;
        if (target.id && distance(enemy, target) < 22 && enemy.cooldown === 0 && target.hurtCooldown === 0) {
          target.hp -= 1; target.hurtCooldown = 72; enemy.cooldown = 45;
          if (target.hp <= 0) { target.hp = 0; target.down = true; target.reviveProgress = 0; state.message = target.id.toUpperCase() + ' is down. Their partner can revive them.'; }
        } else if (!target.id && distance(enemy, state.reactor) < state.reactor.radius + 10) {
          const damage = enemy.kind === 'warden' ? 20 : enemy.kind === 'brute' ? 12 : enemy.kind === 'runner' ? 6 : 8;
          state.reactor.health = Math.max(0, state.reactor.health - damage); enemy.hp = 0;
          state.message = 'The reactor took ' + damage + ' damage from a ' + enemy.kind + '.';
        }
      }
      state.enemies = state.enemies.filter((enemy) => enemy.hp > 0).slice(0, R.entityCap);
    }

    function step(input) {
      input = input || {};
      if (state.phase !== 'RUNNING') return snapshot();
      state.tick += 1;
      state.players.forEach((item) => {
        item.attackCooldown = Math.max(0, item.attackCooldown - 1);
        item.dashCooldown = Math.max(0, item.dashCooldown - 1);
        item.hurtCooldown = Math.max(0, item.hurtCooldown - 1);
      });
      movePlayer(state.players[0], input, 'p1'); movePlayer(state.players[1], input, 'p2');
      state.linked = !state.players.some((item) => item.down) && distance(state.players[0], state.players[1]) <= R.linkRange;
      attackOrRevive(state.players[0], state.players[1], input, 'p1');
      attackOrRevive(state.players[1], state.players[0], input, 'p2');
      updateProjectiles();
      updateEnemies();
      updateRepairCores();
      if (state.reactor.health <= 0 || state.players.every((item) => item.down)) {
        state.phase = 'DEFEAT'; state.sharedOutcome = 'DEFEAT'; state.message = 'Shared defeat. Restart and protect each other.';
      } else if (!state.enemies.length) {
        state.clearedTicks += 1;
        if (state.clearedTicks >= R.nextWaveDelayTicks) {
          if (state.wave >= R.waves) {
            state.phase = 'VICTORY'; state.sharedOutcome = 'VICTORY'; state.message = 'Shared victory. Twin Sparks stabilized the reactor.';
          } else { state.wave += 1; spawnWave(); }
        }
      }
      return snapshot();
    }

    function snapshot() { return copy(state); }
    if (scenario) loadScenario(scenario);
    return { start, pause, reset, step, snapshot, loadScenario };
  }

  function mount(doc, win) {
    const canvas = doc.getElementById('arena');
    const context = canvas.getContext('2d');
    const engine = createEngine();
    const held = Object.create(null);
    const map = {
      KeyW: 'p1-up', KeyA: 'p1-left', KeyS: 'p1-down', KeyD: 'p1-right', KeyF: 'p1-attack', KeyG: 'p1-dash',
      ArrowUp: 'p2-up', ArrowLeft: 'p2-left', ArrowDown: 'p2-down', ArrowRight: 'p2-right', KeyK: 'p2-attack', KeyL: 'p2-dash'
    };
    const byId = (id) => doc.getElementById(id);
    const reducedMotion = Boolean(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const P = V.palette;

    function glow(color, blur) { context.shadowColor = color; context.shadowBlur = blur; }
    function clearGlow() { context.shadowColor = 'transparent'; context.shadowBlur = 0; }
    function polygon(points, fill, stroke, width) {
      context.beginPath(); context.moveTo(points[0][0], points[0][1]);
      for (let index = 1; index < points.length; index += 1) context.lineTo(points[index][0], points[index][1]);
      context.closePath(); context.fillStyle = fill; context.fill(); context.lineWidth = width || 2; context.strokeStyle = stroke; context.stroke();
    }
    function regularPolygon(x, y, radius, sides, rotation, fill, stroke, width) {
      const points = [];
      for (let index = 0; index < sides; index += 1) {
        const angle = rotation + index * Math.PI * 2 / sides;
        points.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius]);
      }
      polygon(points, fill, stroke, width);
    }
    function healthBar(x, y, width, ratio, color) {
      context.fillStyle = '#190812'; context.fillRect(x - width / 2, y, width, 6);
      context.fillStyle = color; context.fillRect(x - width / 2, y, Math.max(0, width * ratio), 6);
      context.strokeStyle = '#ffffff66'; context.lineWidth = 1; context.strokeRect(x - width / 2, y, width, 6);
    }

    function drawBackground(state) {
      const tick = reducedMotion ? 0 : state.tick;
      const field = context.createRadialGradient(A.width / 2, A.height / 2, 24, A.width / 2, A.height / 2, 560);
      field.addColorStop(0, '#14284a'); field.addColorStop(0.45, P.surface); field.addColorStop(1, P.background);
      context.fillStyle = field; context.fillRect(0, 0, A.width, A.height);
      context.globalAlpha = 0.34; context.strokeStyle = P.p1; context.lineWidth = 1;
      for (let lane = 0; lane < 11; lane += 1) {
        const y = 28 + lane * 49;
        context.beginPath(); context.moveTo(0, y); context.lineTo(160 + (lane % 3) * 42, y); context.lineTo(202 + (lane % 3) * 42, y + 18); context.lineTo(A.width, y + 18); context.stroke();
      }
      context.strokeStyle = P.p2;
      for (let lane = 0; lane < 9; lane += 1) {
        const x = 38 + lane * 111;
        context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 82 + (lane % 2) * 38); context.lineTo(x + 26, 108 + (lane % 2) * 38); context.lineTo(x + 26, A.height); context.stroke();
      }
      context.globalAlpha = 1;
      for (let index = 0; index < 36; index += 1) {
        const x = (index * 137 + CONFIG.seed * 17) % A.width;
        const y = (index * 71 + CONFIG.seed * 29) % A.height;
        const pulse = 0.35 + ((index + Math.floor(tick / 8)) % 5) * 0.1;
        context.globalAlpha = reducedMotion ? 0.55 : pulse; context.fillStyle = index % 3 === 0 ? P.p2 : P.p1;
        context.fillRect(x, y, index % 4 === 0 ? 3 : 2, index % 4 === 0 ? 3 : 2);
      }
      context.globalAlpha = 1;
      const vignette = context.createRadialGradient(A.width / 2, A.height / 2, 180, A.width / 2, A.height / 2, 580);
      vignette.addColorStop(0, '#00000000'); vignette.addColorStop(1, '#000000b8'); context.fillStyle = vignette; context.fillRect(0, 0, A.width, A.height);
    }

    function drawLink(state) {
      if (!state.linked || state.players.some((item) => item.down)) return;
      const gradient = context.createLinearGradient(state.players[0].x, state.players[0].y, state.players[1].x, state.players[1].y);
      gradient.addColorStop(0, P.p1); gradient.addColorStop(0.5, P.highlight); gradient.addColorStop(1, P.p2);
      context.save(); glow(P.p1, 22); context.strokeStyle = gradient; context.lineWidth = 10; context.globalAlpha = 0.22;
      context.beginPath(); context.moveTo(state.players[0].x, state.players[0].y); context.lineTo(state.players[1].x, state.players[1].y); context.stroke();
      context.lineWidth = 2; context.globalAlpha = 0.92; context.setLineDash([12, 9]); context.stroke(); context.restore();
    }

    function drawObstacle(item, index) {
      context.save(); glow(index % 2 ? P.p2 : P.p1, 12); regularPolygon(item.x, item.y, item.radius, 6, Math.PI / 6, '#111c31', index % 2 ? P.p2 : P.p1, 2);
      clearGlow(); regularPolygon(item.x, item.y, item.radius * 0.62, 6, Math.PI / 6, '#08111f', '#ffffff33', 1);
      context.strokeStyle = index % 2 ? P.p2 : P.p1; context.lineWidth = 2; context.beginPath(); context.moveTo(item.x - 12, item.y); context.lineTo(item.x + 12, item.y); context.moveTo(item.x, item.y - 12); context.lineTo(item.x, item.y + 12); context.stroke(); context.restore();
    }

    function drawReactor(state) {
      const tick = reducedMotion ? 0 : state.tick;
      context.save(); context.translate(state.reactor.x, state.reactor.y); glow(P.reactor, 28);
      const core = context.createRadialGradient(0, 0, 4, 0, 0, state.reactor.radius);
      core.addColorStop(0, '#fffce0'); core.addColorStop(0.38, P.reactor); core.addColorStop(1, '#a95411');
      context.beginPath(); context.arc(0, 0, state.reactor.radius, 0, Math.PI * 2); context.fillStyle = core; context.fill(); context.strokeStyle = '#fff6c9'; context.lineWidth = 3; context.stroke();
      clearGlow(); context.rotate(tick * 0.012); context.strokeStyle = P.p1; context.lineWidth = 4; context.setLineDash([18, 10]); context.beginPath(); context.arc(0, 0, state.reactor.radius + 12, 0, Math.PI * 2); context.stroke();
      context.rotate(-tick * 0.024); context.strokeStyle = P.p2; context.lineWidth = 2; context.setLineDash([7, 13]); context.beginPath(); context.arc(0, 0, state.reactor.radius + 20, 0, Math.PI * 2); context.stroke();
      context.setLineDash([]); context.fillStyle = '#2b1b00'; context.font = '900 16px system-ui'; context.textAlign = 'center'; context.fillText(String(state.reactor.health), 0, 6); context.restore();
    }

    function drawProjectile(item) {
      const length = Math.hypot(item.vx, item.vy) || 1, dx = item.vx / length, dy = item.vy / length;
      const color = item.owner === 'p1' ? P.p1 : P.p2;
      context.save(); glow(item.linked ? P.highlight : color, item.linked ? 18 : 10); context.strokeStyle = color; context.lineWidth = item.linked ? 7 : 4; context.lineCap = 'round';
      context.beginPath(); context.moveTo(item.x - dx * 18, item.y - dy * 18); context.lineTo(item.x + dx * 7, item.y + dy * 7); context.stroke();
      context.fillStyle = P.highlight; context.beginPath(); context.arc(item.x + dx * 7, item.y + dy * 7, item.linked ? 4 : 3, 0, Math.PI * 2); context.fill(); context.restore();
    }

    function drawEnemy(item, state) {
      const kind = item.kind || 'spark';
      context.save(); context.translate(item.x, item.y); const turn = reducedMotion ? 0 : state.tick * (kind === 'runner' ? 0.03 : 0.012); context.rotate(turn); glow(P.enemy, kind === 'warden' ? 30 : 14);
      if (kind === 'runner') {
        polygon([[15, 0], [-10, -10], [-4, 0], [-10, 10]], '#ff7edb', P.highlight, 2);
      } else if (kind === 'brute') {
        regularPolygon(0, 0, 20, 4, Math.PI / 4, '#e52d5a', '#ffd6df', 3); regularPolygon(0, 0, 10, 4, 0, '#4b0e27', P.highlight, 2);
      } else if (kind === 'warden') {
        regularPolygon(0, 0, 31, 8, Math.PI / 8, '#ff8a2a', '#fff0bd', 4); regularPolygon(0, 0, 19, 6, -turn * 2, '#48152d', P.highlight, 2);
        context.strokeStyle = P.enemy; context.lineWidth = 3; context.setLineDash([8, 7]); context.beginPath(); context.arc(0, 0, 39, 0, Math.PI * 2); context.stroke(); context.setLineDash([]);
      } else {
        const spikes = []; for (let point = 0; point < 16; point += 1) { const radius = point % 2 ? 8 : 15; const angle = point * Math.PI / 8; spikes.push([Math.cos(angle) * radius, Math.sin(angle) * radius]); }
        polygon(spikes, '#ff3f8e', '#ffd6ee', 2);
      }
      context.restore();
      if (kind === 'warden') { context.fillStyle = '#fff4cf'; context.font = '900 11px system-ui'; context.textAlign = 'center'; context.fillText('WARDEN', item.x, item.y - 47); }
      if ((item.maxHp || 1) > 1) healthBar(item.x, item.y + (kind === 'warden' ? 45 : 28), kind === 'warden' ? 70 : 38, item.hp / item.maxHp, kind === 'warden' ? P.reactor : P.enemy);
    }

    function drawPlayer(item, index, state) {
      const color = index === 0 ? P.p1 : P.p2;
      const angle = Math.atan2(item.facingY, item.facingX);
      context.save(); context.translate(item.x, item.y); context.rotate(angle); glow(color, item.down ? 0 : 22); context.globalAlpha = item.down ? 0.48 : 1;
      if (index === 0) {
        polygon([[23, 0], [-14, -15], [-8, 0], [-14, 15]], item.down ? '#45505c' : color, P.highlight, 3);
        polygon([[6, 0], [-8, -6], [-8, 6]], '#07101d', P.highlight, 1);
      } else {
        polygon([[22, 0], [2, -15], [-16, -8], [-8, 0], [-16, 8], [2, 15]], item.down ? '#45505c' : color, P.highlight, 3);
        regularPolygon(2, 0, 6, 4, Math.PI / 4, '#07101d', P.highlight, 1);
      }
      if (!item.down && !reducedMotion) { context.fillStyle = index === 0 ? P.p2 : P.p1; context.globalAlpha = 0.6 + (state.tick % 6) * 0.05; polygon([[-13, -5], [-25 - state.tick % 5, 0], [-13, 5]], context.fillStyle, context.fillStyle, 1); }
      context.restore(); context.globalAlpha = 1;
      context.fillStyle = P.highlight; context.font = '900 10px system-ui'; context.textAlign = 'center'; context.fillText(item.id.toUpperCase(), item.x, item.y - 25);
      if (item.down) { context.strokeStyle = '#ffffff'; context.lineWidth = 3; context.beginPath(); context.moveTo(item.x - 11, item.y - 11); context.lineTo(item.x + 11, item.y + 11); context.moveTo(item.x + 11, item.y - 11); context.lineTo(item.x - 11, item.y + 11); context.stroke(); }
    }

    function drawRepairCore(item, state) {
      const pulse = reducedMotion ? 0 : (state.tick % 18) / 18 * Math.PI * 2;
      context.save(); context.translate(item.x, item.y); context.rotate(Math.PI / 4 + pulse * 0.12); glow(P.repair, 22); context.fillStyle = P.repair; context.strokeStyle = '#eafff0'; context.lineWidth = 3; context.fillRect(-10, -10, 20, 20); context.strokeRect(-10, -10, 20, 20); clearGlow(); context.fillStyle = '#10351f'; context.fillRect(-3, -7, 6, 14); context.fillRect(-7, -3, 14, 6); context.restore();
    }

    function render() {
      const state = engine.snapshot();
      context.clearRect(0, 0, A.width, A.height);
      drawBackground(state); drawLink(state); A.obstacles.forEach(drawObstacle); drawReactor(state);
      state.projectiles.forEach(drawProjectile); state.enemies.forEach((item) => drawEnemy(item, state));
      state.players.forEach((item, index) => drawPlayer(item, index, state)); state.repairCores.forEach((item) => drawRepairCore(item, state));
      byId('phase').textContent = state.phase; byId('wave').textContent = String(state.wave) + '/3';
      byId('reactor-health').textContent = String(state.reactor.health);
      byId('enemy-count').textContent = String(state.enemies.length);
      byId('link-state').textContent = state.linked ? 'LINKED ×2' : 'SEPARATED';
      state.players.forEach((item) => { byId(item.id + '-health').textContent = item.down ? 'DOWN' : String(item.hp); byId(item.id + '-score').textContent = String(item.score); });
      byId('status').textContent = state.message;
      byId('pause').textContent = state.phase === 'PAUSED' ? 'Resume' : 'Pause';
      canvas.setAttribute('aria-label', 'Twin Reactor arena. ' + state.phase + ', wave ' + state.wave + ', reactor ' + state.reactor.health + ', twin link ' + (state.linked ? 'active' : 'separated') + ', P1 ' + (state.players[0].down ? 'down' : state.players[0].hp + ' health') + ' at ' + Math.round(state.players[0].x) + ',' + Math.round(state.players[0].y) + ', P2 ' + (state.players[1].down ? 'down' : state.players[1].hp + ' health') + ' at ' + Math.round(state.players[1].x) + ',' + Math.round(state.players[1].y) + ', ' + state.enemies.length + ' enemies, ' + state.projectiles.length + ' bolts, ' + state.repairCores.length + ' repair cores.');
      win.AXM_GAME_VISIBLE_STATE = state;
    }

    let previousFrame = null, accumulatedMs = 0;
    function frame(timestamp) {
      if (previousFrame === null) previousFrame = timestamp;
      const elapsed = Math.max(0, Math.min(100, timestamp - previousFrame)); previousFrame = timestamp;
      accumulatedMs = Math.min(100, accumulatedMs + elapsed);
      if (accumulatedMs >= 1000 / 12) { engine.step(held); accumulatedMs = 0; }
      render(); win.requestAnimationFrame(frame);
    }
    doc.addEventListener('keydown', (event) => {
      if (map[event.code]) { held[map[event.code]] = true; engine.step({ [map[event.code]]: true }); render(); event.preventDefault(); }
      else if (event.code === 'Enter') { const state = engine.snapshot(); if (state.phase === 'DEFEAT' || state.phase === 'VICTORY') engine.reset(); engine.start(); event.preventDefault(); }
      else if (event.code === 'Escape') { engine.pause(); event.preventDefault(); }
    });
    doc.addEventListener('keyup', (event) => { if (map[event.code]) { held[map[event.code]] = false; event.preventDefault(); } });
    byId('start').addEventListener('click', () => { const state = engine.snapshot(); if (state.phase === 'DEFEAT' || state.phase === 'VICTORY') engine.reset(); engine.start(); render(); });
    byId('pause').addEventListener('click', () => { engine.pause(); render(); });
    byId('restart').addEventListener('click', () => { engine.reset(); render(); });
    byId('practice').addEventListener('click', () => { engine.loadScenario('WARDEN'); render(); });
    win.addEventListener('blur', () => { Object.keys(held).forEach((key) => { held[key] = false; }); });
    win.AXM_GAME_INPUT = (action, pressed) => { if (!Object.values(map).includes(action)) return false; held[action] = pressed !== false; return true; };
    win.AXM_GAME_STEP = (ticks) => { const count = Math.max(1, Math.min(240, Number.isSafeInteger(ticks) ? ticks : 1)); for (let index = 0; index < count; index += 1) engine.step(held); render(); return engine.snapshot(); };
    win.AXM_GAME_PUBLIC_STATE = () => engine.snapshot();
    win.AXM_GAME_PREBUILD_RECEIPT = Object.freeze({
      schema: CONFIG.prebuild.schema,
      planDigest: CONFIG.prebuild.planDigest,
      snapshotDigest: CONFIG.prebuild.snapshotDigest,
      repairRuleIds: CONFIG.prebuild.appliedRepairs.slice(),
      plannedAssetHands: CONFIG.prebuild.assetRoutes.map((item) => item.handId),
      assetArtifactsProduced: false,
      authority: 'NONE'
    });
    render(); win.requestAnimationFrame(frame);
    return engine;
  }

  return { createEngine, mount };
}

function gameSource(config) {
  return `'use strict';\n\nconst CONFIG = Object.freeze(${JSON.stringify(config)});\nconst AXM_COOP_FACTORY = ${runtimeFactory.toString()};\n(function(root){const api=AXM_COOP_FACTORY(CONFIG);if(typeof module==='object'&&module.exports)module.exports=api;if(root&&root.document){root.AXM_COOP_GAME=api;const boot=()=>api.mount(root.document,root);if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();}})(typeof window==='object'?window:null);\n`;
}

function styleSource(brief, prebuildPlan) {
  if (!prebuildPlan || prebuildPlan.schema !== 'axm.game-prebuild-plan/v1') throw new Error('styles require the exact prebuild plan');
  const palette = prebuildPlan.visualSystem.palette;
  return `:root{color-scheme:dark;--bg:${palette.background};--surface:${palette.surface};--p1:${palette.p1};--p2:${palette.p2};--enemy:${palette.enemy};--accent:${palette.enemy};--highlight:${palette.highlight};--repair:${palette.repair};--reactor:${palette.reactor};--text:${palette.text};--muted:${palette.mutedText}}*{box-sizing:border-box}body{margin:0;min-height:100vh;overflow-x:hidden;background:radial-gradient(circle at 48% -10%,#182a4e 0,var(--bg) 47%,#020309 100%);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,sans-serif}body:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.16;background-image:linear-gradient(90deg,transparent 49%,var(--p1) 50%,transparent 51%),linear-gradient(transparent 49%,var(--p2) 50%,transparent 51%);background-size:88px 88px;mask-image:linear-gradient(to bottom,#000,transparent 72%)}.shell{position:relative;width:min(1420px,97vw);margin:auto;padding:22px}.mast{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:12px}.title-stack{max-width:850px}.eyebrow{margin:0;color:var(--p1);font-size:.75rem;font-weight:950;letter-spacing:.19em;text-transform:uppercase;text-shadow:0 0 18px color-mix(in srgb,var(--p1) 70%,transparent)}h1{margin:.1em 0;font-size:clamp(2.4rem,6vw,5rem);line-height:.84;letter-spacing:-.06em;text-transform:uppercase;background:linear-gradient(105deg,#fff 5%,var(--p1) 38%,var(--p2) 68%,var(--enemy));background-clip:text;color:transparent;filter:drop-shadow(0 0 24px #25e6ff45)}.lede{max-width:780px;margin:.7em 0;color:#c4d4e8;font-size:1.02rem}.badge{flex:none;padding:9px 14px;border:1px solid var(--p2);border-radius:999px;background:#0a1021cc;box-shadow:inset 0 0 20px #7f5cff18,0 0 22px #7f5cff22;font-weight:900}.asset-strip{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 14px}.asset-strip span{padding:6px 9px;border:1px solid #ffffff26;border-radius:8px;background:#09101dcc;color:var(--muted);font:800 .72rem/1 system-ui;text-transform:uppercase;letter-spacing:.06em}.asset-strip strong{color:var(--highlight)}.layout{display:grid;grid-template-columns:minmax(0,1fr) 350px;gap:16px}.arena-wrap{position:relative;padding:3px;border-radius:22px;background:conic-gradient(from 210deg,var(--p1),var(--p2),var(--enemy),var(--p1));box-shadow:0 28px 100px #000c,0 0 44px #25e6ff1f}.arena-wrap:before{content:"";position:absolute;inset:3px;border-radius:19px;pointer-events:none;z-index:2;box-shadow:inset 0 0 38px #000,inset 0 0 12px var(--p1)}.arena-wrap:after{content:"";position:absolute;inset:3px;border-radius:19px;pointer-events:none;z-index:3;background:repeating-linear-gradient(to bottom,transparent 0,transparent 4px,#ffffff08 5px),radial-gradient(circle at 50% 45%,transparent 45%,#0009 100%);mix-blend-mode:screen;opacity:.55}canvas{position:relative;z-index:1;display:block;width:100%;height:auto;aspect-ratio:960/544;border-radius:19px;background:var(--bg);outline:none}.hud{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:10px}.metric,.player-card,.panel,.build-readout{border:1px solid #ffffff22;border-radius:14px;background:linear-gradient(145deg,#17223bd9,#080d18ed);box-shadow:inset 0 1px #ffffff10,0 12px 32px #0006;backdrop-filter:blur(14px)}.metric{position:relative;overflow:hidden;padding:11px}.metric:before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:linear-gradient(var(--p1),var(--p2))}.metric span,.player-card span{display:block;color:var(--muted);font-size:.7rem;text-transform:uppercase;letter-spacing:.1em}.metric strong,.player-card strong{font-size:1.13rem}.panel{padding:13px}.players{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}.player-card{padding:11px}.player-card.p1{border-color:color-mix(in srgb,var(--p1) 70%,transparent)}.player-card.p2{border-color:color-mix(in srgb,var(--p2) 70%,transparent)}.panel h2{margin:.15em 0 .6em;font-size:1.15rem}.build-readout{margin-bottom:10px;padding:11px;border-color:#63ff9e66}.build-readout strong{display:block;color:var(--repair);font-size:.72rem;letter-spacing:.12em}.build-readout span{display:block;margin-top:4px;color:var(--muted);font-size:.78rem}.keys{display:grid;grid-template-columns:1fr 1fr;gap:8px}.keys article{padding:9px;border:1px solid #ffffff14;border-radius:11px;background:#070d19bb}.keys h3{margin:.1em 0 .35em}.keys p{margin:.3em 0;color:#c9d8e7;font-size:.85rem}.legend{display:grid;gap:6px;margin:10px 0;padding:9px;border:1px solid #29475d;border-radius:10px;background:#060c17c9;color:#c9d8e7;font-size:.8rem}.legend b{color:#fff}.status{min-height:4.2em;margin:.65em 0;padding:11px;border-left:4px solid var(--p1);background:#07111dcc;border-radius:8px;color:#eaf8ff}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button{position:relative;min-height:48px;border:1px solid #ffffff33;border-radius:11px;background:linear-gradient(135deg,#172641,#0b1324);color:var(--text);font:900 .92rem system-ui;cursor:pointer;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease}.actions button:hover{transform:translateY(-1px);border-color:var(--p1);box-shadow:0 0 20px #25e6ff25}.actions button:first-child,.actions button:last-child{grid-column:1/3}.actions button:first-child{border-color:var(--p1);background:linear-gradient(120deg,#06465a,#152656)}.actions button:last-child{border-color:var(--reactor);background:linear-gradient(120deg,#4b2606,#402047)}.actions button:focus-visible,canvas:focus-visible{outline:4px solid white;outline-offset:3px}.boundary{margin:.75em 0 0;color:#8fa2ba;font-size:.75rem}.p1-label{color:var(--p1)}.p2-label{color:var(--p2)}@media(max-width:980px){.mast{align-items:start;flex-direction:column}.layout{grid-template-columns:1fr}.panel{order:-1}.keys{grid-template-columns:1fr 1fr}}@media(max-width:650px){.shell{width:100%;padding:10px}.hud{grid-template-columns:1fr 1fr}.metric:last-child{grid-column:1/3}.keys{grid-template-columns:1fr}.asset-strip span{font-size:.65rem}h1{font-size:2.65rem}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}.arena-wrap:after{background:radial-gradient(circle at 50% 45%,transparent 45%,#0009 100%)}}\n`;
}

function indexSource(brief, prebuildPlan) {
  if (!prebuildPlan || prebuildPlan.schema !== 'axm.game-prebuild-plan/v1') throw new Error('index requires the exact prebuild plan');
  const escape = (value) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const title = escape(brief.title);
  const handCount = prebuildPlan.assetRoutes.length;
  const effectCount = prebuildPlan.visualSystem.effectIds.length;
  const repairCount = prebuildPlan.repairs.length;
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="styles.css"></head><body><main class="shell"><header class="mast"><div class="title-stack"><p class="eyebrow">Asset-aware detached candidate · v0.3</p><h1>${title}</h1><p class="lede">Two pilots defend one reactor inside a catalog-informed neon circuit arena. Distinct silhouettes, layered energy, readable combat classes, and known collision repairs are planned before candidate bytes.</p></div><span class="badge">Offline · session only</span></header><div class="asset-strip" aria-label="Prebuild asset plan"><span><strong>${handCount}</strong> declared asset routes</span><span><strong>${effectCount}</strong> portable FX</span><span><strong>${repairCount}</strong> prebuild repairs</span><span>Neon Circuit × Aetherglass</span></div><div class="layout"><section aria-labelledby="arena-title"><h2 id="arena-title" class="eyebrow">Twin Reactor defense grid</h2><div class="arena-wrap"><canvas id="arena" width="960" height="544" tabindex="0" role="img" aria-label="Twin Reactor action arena preparing"></canvas></div><div class="hud"><div class="metric"><span>Phase</span><strong id="phase">READY</strong></div><div class="metric"><span>Wave</span><strong id="wave">1/3</strong></div><div class="metric"><span>Reactor</span><strong id="reactor-health">100</strong></div><div class="metric"><span>Hostiles</span><strong id="enemy-count">0</strong></div><div class="metric"><span>Twin field</span><strong id="link-state">LINKED ×2</strong></div></div></section><aside class="panel"><div class="build-readout"><strong>PREBUILD PLAN APPLIED</strong><span>Catalog declarations informed this rendering. Asset artifacts themselves were not silently claimed or installed.</span></div><div class="players"><div class="player-card p1"><span class="p1-label">Cyan pilot · P1</span><strong id="p1-health">3</strong><span>Score <b id="p1-score">0</b></span></div><div class="player-card p2"><span class="p2-label">Violet pilot · P2</span><strong id="p2-health">3</strong><span>Score <b id="p2-score">0</b></span></div></div><h2>Two-seat controls</h2><div class="keys"><article><h3 class="p1-label">Player 1</h3><p><b>W A S D</b> move</p><p><b>F</b> fire / revive</p><p><b>G</b> dash</p></article><article><h3 class="p2-label">Player 2</h3><p><b>Arrow keys</b> move</p><p><b>K</b> fire / revive</p><p><b>L</b> dash</p></article></div><div class="legend"><span><b>Twin beam:</b> link for double-damage bolts.</span><span><b>Repair crystal:</b> restore the shared reactor.</span><span><b>Enemy silhouettes:</b> spark, runner, brute, Warden.</span></div><p><b>Enter</b> start · <b>Escape</b> pause</p><p id="status" class="status" role="status" aria-live="polite">Preparing the deterministic arena.</p><div class="actions"><button id="start" type="button">Launch defense</button><button id="pause" type="button">Pause</button><button id="restart" type="button">Restart</button><button id="practice" type="button">Warden showcase</button></div><p class="boundary">The asset plan is advisory candidate data. No network, save data, provider execution, install, promotion, or CANON authority.</p></aside></div></main><script src="game.js"></script></body></html>\n`;
}

module.exports = { RECIPE_ID, WORLD, CANDIDATE, buildArena, buildConfig, buildProject, runtimeFactory, gameSource, styleSource, indexSource };
