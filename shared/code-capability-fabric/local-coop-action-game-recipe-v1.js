'use strict';

const RECIPE_ID = 'twin-reactor-action-coop';
const WORLD = Object.freeze({ width: 30, height: 17 });
const CANDIDATE = Object.freeze({ id: 'twin-reactor-coop-native', version: 'v0.2', status: 'EXPERIMENTAL' });

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

function buildConfig(brief) {
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
    session: clone(brief.session), authority: 'NONE'
  };
}

function buildProject(brief) {
  const cells = [];
  for (let y = 0; y < WORLD.height; y += 1) {
    for (let x = 0; x < WORLD.width; x += 1) {
      const edge = x === 0 || y === 0 || x === WORLD.width - 1 || y === WORLD.height - 1;
      cells.push({ terrain: edge ? 'wall' : 'ground', height: 0 });
    }
  }
  return {
    schema: 'axm.game-forge-project/v1', id: brief.id, name: brief.title,
    version: '0.2.0', runtimeMode: '2D', status: 'DRAFT', createdAt: null,
    updatedAt: null, capabilityPlan: null,
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
      { id: 'wave-three-warden', type: 'Boss', state: 'DECLARED' }
    ],
    behaviors: [], tests: [], mods: []
  };
}

function runtimeFactory(CONFIG) {
  const R = CONFIG.rules;
  const A = CONFIG.arena;
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

    function drawCircle(x, y, radius, fill, stroke) {
      context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fillStyle = fill; context.fill();
      context.lineWidth = 3; context.strokeStyle = stroke; context.stroke();
    }

    function drawDiamond(x, y, radius, fill, stroke) {
      context.beginPath(); context.moveTo(x, y - radius); context.lineTo(x + radius, y); context.lineTo(x, y + radius); context.lineTo(x - radius, y); context.closePath();
      context.fillStyle = fill; context.fill(); context.lineWidth = 3; context.strokeStyle = stroke; context.stroke();
    }

    function render() {
      const state = engine.snapshot();
      context.clearRect(0, 0, A.width, A.height);
      context.fillStyle = '#07101d'; context.fillRect(0, 0, A.width, A.height);
      context.strokeStyle = '#193c52'; context.lineWidth = 1;
      for (let x = 0; x <= A.width; x += 48) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, A.height); context.stroke(); }
      for (let y = 0; y <= A.height; y += 48) { context.beginPath(); context.moveTo(0, y); context.lineTo(A.width, y); context.stroke(); }
      if (state.linked && !state.players.some((item) => item.down)) {
        context.strokeStyle = '#74f7ff'; context.lineWidth = 7; context.globalAlpha = 0.18;
        context.beginPath(); context.moveTo(state.players[0].x, state.players[0].y); context.lineTo(state.players[1].x, state.players[1].y); context.stroke(); context.globalAlpha = 1;
      }
      A.obstacles.forEach((item) => drawCircle(item.x, item.y, item.radius, '#142b3b', '#315d70'));
      drawCircle(state.reactor.x, state.reactor.y, state.reactor.radius, '#ffd166', '#fff2bd');
      context.fillStyle = '#301f00'; context.font = 'bold 16px system-ui'; context.textAlign = 'center'; context.fillText(String(state.reactor.health), state.reactor.x, state.reactor.y + 6);
      state.projectiles.forEach((item) => { drawCircle(item.x, item.y, item.linked ? 7 : 5, item.owner === 'p1' ? '#39dff2' : '#bd7cff', item.linked ? '#ffffff' : '#a9c5d6'); });
      state.enemies.forEach((item) => {
        const kind = item.kind || 'spark';
        const radius = kind === 'warden' ? 29 : kind === 'brute' ? 19 : kind === 'runner' ? 10 : 13;
        const fill = kind === 'warden' ? '#ff9f43' : kind === 'brute' ? '#ff3d64' : kind === 'runner' ? '#ff7edb' : '#ff5577';
        drawCircle(item.x, item.y, radius, fill, kind === 'warden' ? '#fff0bd' : '#ffd6df');
        if (kind === 'warden') { context.fillStyle = '#fff4cf'; context.font = 'bold 11px system-ui'; context.fillText('WARDEN', item.x, item.y - 38); }
        if ((item.maxHp || 1) > 1) { const width = radius * 1.6; context.fillStyle = '#2c0710'; context.fillRect(item.x - width / 2, item.y + radius + 6, width, 5); context.fillStyle = '#fff0bd'; context.fillRect(item.x - width / 2, item.y + radius + 6, width * item.hp / item.maxHp, 5); }
      });
      state.players.forEach((item, index) => {
        const color = index === 0 ? '#39dff2' : '#bd7cff';
        drawCircle(item.x, item.y, 18, item.down ? '#3c4852' : color, '#ffffff');
        context.fillStyle = '#061018'; context.font = 'bold 13px system-ui'; context.fillText(item.id.toUpperCase(), item.x, item.y + 5);
        if (!item.down) { context.strokeStyle = '#ffffff'; context.lineWidth = 4; context.beginPath(); context.moveTo(item.x + item.facingX * 12, item.y + item.facingY * 12); context.lineTo(item.x + item.facingX * 29, item.y + item.facingY * 29); context.stroke(); }
        if (item.down) { context.strokeStyle = '#ffffff'; context.beginPath(); context.moveTo(item.x - 10, item.y - 10); context.lineTo(item.x + 10, item.y + 10); context.moveTo(item.x + 10, item.y - 10); context.lineTo(item.x - 10, item.y + 10); context.stroke(); }
      });
      state.repairCores.forEach((item) => drawDiamond(item.x, item.y, 12, '#63ff9e', '#e5ffed'));
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
    render(); win.requestAnimationFrame(frame);
    return engine;
  }

  return { createEngine, mount };
}

function gameSource(config) {
  return `'use strict';\n\nconst CONFIG = Object.freeze(${JSON.stringify(config)});\nconst AXM_COOP_FACTORY = ${runtimeFactory.toString()};\n(function(root){const api=AXM_COOP_FACTORY(CONFIG);if(typeof module==='object'&&module.exports)module.exports=api;if(root&&root.document){root.AXM_COOP_GAME=api;const boot=()=>api.mount(root.document,root);if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();}})(typeof window==='object'?window:null);\n`;
}

function styleSource(brief) {
  const theme = brief.theme;
  return `:root{color-scheme:dark;--bg:${theme.background};--panel:${theme.panel};--p1:${theme.player};--p2:#bd7cff;--accent:${theme.accent};--text:${theme.text}}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% -20%,#17334a,var(--bg) 58%);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,sans-serif}.shell{width:min(1320px,96vw);margin:auto;padding:20px}.mast{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:14px}.eyebrow{margin:0;color:var(--accent);font-size:.78rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase}h1{margin:.15em 0;font-size:clamp(2rem,5vw,4rem);line-height:.92}.lede{max-width:760px;color:#bfd0e3}.badge{padding:8px 12px;border:1px solid #5e7690;border-radius:999px;background:#08131f;font-weight:800}.layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:16px}.arena-wrap{position:relative;padding:10px;border:2px solid var(--accent);border-radius:20px;background:#03070c;box-shadow:0 24px 80px #000a}canvas{display:block;width:100%;height:auto;aspect-ratio:960/544;border-radius:12px;background:#07101d;outline:none}.hud{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:10px}.metric,.player-card,.panel{border:1px solid #38536d;border-radius:14px;background:color-mix(in srgb,var(--panel) 90%,black);padding:12px}.metric span,.player-card span{display:block;color:#a9bbcf;font-size:.75rem;text-transform:uppercase;letter-spacing:.08em}.metric strong,.player-card strong{font-size:1.1rem}.players{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}.player-card.p1{border-color:var(--p1)}.player-card.p2{border-color:var(--p2)}.panel h2{margin-top:0}.keys{display:grid;grid-template-columns:1fr 1fr;gap:10px}.keys article{padding:10px;border-radius:12px;background:#07121e}.keys h3{margin:.1em 0 .4em}.keys p{margin:.35em 0;color:#c9d8e7}.legend{display:grid;gap:6px;margin:12px 0;padding:10px;border:1px solid #29475d;border-radius:10px;background:#07121e;color:#c9d8e7;font-size:.84rem}.legend b{color:#fff}.status{min-height:4.5em;padding:12px;border-left:4px solid var(--accent);background:#08131f;border-radius:8px}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.actions button{min-height:48px;border:2px solid #6e8aa6;border-radius:12px;background:#10243a;color:var(--text);font:800 1rem system-ui;cursor:pointer}.actions button:first-child,.actions button:last-child{grid-column:1/3}.actions button:first-child{border-color:var(--accent);background:#443200}.actions button:last-child{border-color:#ff9f43;background:#3a1e0d}.actions button:focus-visible,canvas:focus-visible{outline:4px solid white;outline-offset:3px}.boundary{margin:.8em 0 0;color:#93a9bf;font-size:.85rem}.p1-label{color:var(--p1)}.p2-label{color:var(--p2)}@media(max-width:920px){.mast{align-items:start;flex-direction:column}.layout{grid-template-columns:1fr}.panel{order:-1}.keys{grid-template-columns:1fr 1fr}}@media(max-width:620px){.shell{width:100%;padding:10px}.hud{grid-template-columns:1fr 1fr}.metric:last-child{grid-column:1/3}.keys{grid-template-columns:1fr}h1{font-size:2.25rem}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}\n`;
}

function indexSource(brief) {
  const escape = (value) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const title = escape(brief.title);
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="styles.css"></head><body><main class="shell"><header class="mast"><div><p class="eyebrow">Detached TEST candidate · deterministic patch v0.2</p><h1>${title}</h1><p class="lede">Two players, one keyboard, one reactor. Stay close to link your energy bolts, break distinct spark classes, collect green repair cores, and face the Warden together.</p></div><span class="badge">Offline · session only</span></header><div class="layout"><section aria-labelledby="arena-title"><h2 id="arena-title" class="eyebrow">Action arena</h2><div class="arena-wrap"><canvas id="arena" width="960" height="544" tabindex="0" role="img" aria-label="Twin Reactor action arena preparing"></canvas></div><div class="hud"><div class="metric"><span>Phase</span><strong id="phase">READY</strong></div><div class="metric"><span>Wave</span><strong id="wave">1/3</strong></div><div class="metric"><span>Reactor</span><strong id="reactor-health">100</strong></div><div class="metric"><span>Enemies</span><strong id="enemy-count">0</strong></div><div class="metric"><span>Twin field</span><strong id="link-state">LINKED ×2</strong></div></div></section><aside class="panel"><div class="players"><div class="player-card p1"><span class="p1-label">P1 health</span><strong id="p1-health">3</strong><span>Score <b id="p1-score">0</b></span></div><div class="player-card p2"><span class="p2-label">P2 health</span><strong id="p2-health">3</strong><span>Score <b id="p2-score">0</b></span></div></div><h2>Two-seat controls</h2><div class="keys"><article><h3 class="p1-label">Player 1</h3><p><b>W A S D</b> move</p><p><b>F</b> fire / revive</p><p><b>G</b> dash</p></article><article><h3 class="p2-label">Player 2</h3><p><b>Arrow keys</b> move</p><p><b>K</b> fire / revive</p><p><b>L</b> dash</p></article></div><div class="legend"><span><b>Twin field:</b> stay within range for double-damage bolts.</span><span><b>Green cores:</b> collect them to repair reactor damage.</span><span><b>Warden:</b> the large wave-three spark takes teamwork.</span></div><p><b>Enter</b> start · <b>Escape</b> pause</p><p id="status" class="status" role="status" aria-live="polite">Preparing the deterministic arena.</p><div class="actions"><button id="start" type="button">Start mission</button><button id="pause" type="button">Pause</button><button id="restart" type="button">Restart</button><button id="practice" type="button">Warden practice</button></div><p class="boundary">Practice is a visible TEST route. No network, save data, AI provider, install, promotion, or CANON authority.</p></aside></div></main><script src="game.js"></script></body></html>\n`;
}

module.exports = { RECIPE_ID, WORLD, CANDIDATE, buildArena, buildConfig, buildProject, runtimeFactory, gameSource, styleSource, indexSource };
