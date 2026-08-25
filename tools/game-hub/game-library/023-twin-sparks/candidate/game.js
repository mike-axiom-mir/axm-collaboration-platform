'use strict';

const CONFIG = Object.freeze({"schema":"axm.local-coop-action-game-config/v1","title":"Twin Sparks: Reactor Run","seed":220825,"difficulty":"STANDARD","arena":{"width":960,"height":544,"margin":32,"reactor":{"x":480,"y":272,"radius":42,"health":100},"playerSpawns":[{"id":"p1","x":360,"y":272},{"id":"p2","x":600,"y":272}],"enemySpawns":[{"x":84,"y":72},{"x":888,"y":79},{"x":886,"y":472},{"x":72,"y":465},{"x":480,"y":64},{"x":480,"y":480}],"obstacles":[{"x":262,"y":164,"radius":32},{"x":698,"y":164,"radius":32},{"x":262,"y":380,"radius":32},{"x":698,"y":380,"radius":32}],"enemyCounts":[4,6,8]},"rules":{"fixedTick":true,"waves":3,"entityCap":18,"playerHealth":3,"playerSpeed":3,"dashDistance":28,"dashCooldownTicks":48,"attackRange":62,"attackCooldownTicks":16,"reviveRange":74,"reviveHoldTicks":36,"enemySpeed":1.15,"projectileSpeed":12,"projectileLifetimeTicks":46,"projectileCap":24,"linkRange":260,"linkedDamage":2,"repairCoreCap":6,"repairCoreHeal":12,"repairCorePickupRange":30,"nextWaveDelayTicks":42},"inputs":{"p1":{"move":["KeyW","KeyA","KeyS","KeyD"],"attackOrRevive":"KeyF","dash":"KeyG"},"p2":{"move":["ArrowUp","ArrowLeft","ArrowDown","ArrowRight"],"attackOrRevive":"KeyK","dash":"KeyL"},"shared":{"startOrRestart":"Enter","pause":"Escape"}},"prebuild":{"schema":"axm.game-prebuild-plan/v1","planDigest":"sha256:824956d7a1461d17adccb49979947dd589eb2f8d938f468b5052734caaf0b980","snapshotDigest":"sha256:3d1841059888680072866b00810780ee8a2baeb02b45f60f585eb0c75984e8c4","appliedRepairs":["projectile-spawn-and-swept-collision-v1","combat-silhouette-separation-v1","asset-declaration-truth-ceiling-v1","reduced-motion-gameplay-cue-v1"],"assetRoutes":[{"id":"arena-background","handId":"raster-texture","state":"PLANNED_FROM_DECLARATION","artifactProduced":false},{"id":"player-and-enemy-silhouettes","handId":"pixel-sprite","state":"PLANNED_FROM_DECLARATION","artifactProduced":false},{"id":"hud-and-controls","handId":"ui-component","state":"PLANNED_FROM_DECLARATION","artifactProduced":false},{"id":"arena-effects","handId":"portable-visual-fx","state":"PLANNED_FROM_DECLARATION","artifactProduced":false},{"id":"cross-surface-treatment","handId":"visual-treatment-composer","state":"PLANNED_FROM_DECLARATION","artifactProduced":false},{"id":"combat-motion","handId":"deterministic-animation-fabric","state":"PLANNED_FROM_DECLARATION","artifactProduced":false},{"id":"combat-audio-future-route","handId":"deterministic-audio-fabric","state":"PLANNED_FROM_DECLARATION","artifactProduced":false}]},"visual":{"stylePresetId":"arcade-neon-circuit","treatmentId":"aetherglass-cinematic","effectIds":["glow","gradientBorder","scanlines","spotlight","vignette"],"palette":{"background":"#050812","surface":"#10192a","text":"#f6fbff","mutedText":"#aebbd2","p1":"#25e6ff","p2":"#7f5cff","enemy":"#ff3fae","highlight":"#dffcff","repair":"#63ff9e","reactor":"#ffd166"},"minimumTextContrast":4.5,"reducedMotionFallback":true,"preserveGameplayCues":true},"experience":{"schema":"axm.game-experience-flow-plan/v1","planDigest":"sha256:0e338f899e65d9e250a5bed884eb66bdecf64e24d3fdfa26579f8ad7ad838222","defaultSceneId":"LOBBY","sceneIds":["LOBBY","MISSION_INTRO","ACTIVE_PLAY","WAVE_TRANSITION","WARDEN_INTRO","PAUSED","VICTORY","DEFEAT"],"reviewSurface":"COLLAPSIBLE_REVIEW_DRAWER","holdTicks":{"missionIntro":24,"wardenIntro":24}},"session":{"persistence":"SESSION_ONLY","network":"DISABLED","players":2},"authority":"NONE"});
const AXM_COOP_FACTORY = function runtimeFactory(CONFIG) {
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
    let previousPhase = 'READY';
    let previousWave = 1;
    let missionIntroUntilTick = -1;
    let wardenIntroUntilTick = -1;

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

    function directExperience(state) {
      if (state.phase === 'READY') return 'LOBBY';
      if (state.phase === 'PAUSED') return 'PAUSED';
      if (state.phase === 'VICTORY') return 'VICTORY';
      if (state.phase === 'DEFEAT') return 'DEFEAT';
      if (previousPhase === 'READY' && state.phase === 'RUNNING') missionIntroUntilTick = state.tick + CONFIG.experience.holdTicks.missionIntro;
      if (state.wave > previousWave && state.wave === 3) wardenIntroUntilTick = state.tick + CONFIG.experience.holdTicks.wardenIntro;
      if (!state.enemies.length && state.clearedTicks > 0) return 'WAVE_TRANSITION';
      if (state.tick < wardenIntroUntilTick) return 'WARDEN_INTRO';
      if (state.tick < missionIntroUntilTick) return 'MISSION_INTRO';
      return 'ACTIVE_PLAY';
    }

    function presentExperience(state) {
      const sceneId = directExperience(state);
      const overlay = byId('scene-overlay');
      const banner = byId('transition-banner');
      const blocking = ['LOBBY', 'PAUSED', 'VICTORY', 'DEFEAT'].includes(sceneId);
      const bannerCopy = {
        MISSION_INTRO: ['REACTOR LINKED', 'Stay close for amplified twin bolts.'],
        WAVE_TRANSITION: ['SECTOR CLEAR', state.wave >= 3 ? 'Hold the line. Final result incoming.' : 'Repair, regroup, and face the next signal.'],
        WARDEN_INTRO: ['WARDEN SIGNAL', 'Final wave. Break its shell and recover the core.']
      }[sceneId];
      const blockingCopy = {
        LOBBY: ['TWIN SPARKS', 'Two pilots. One reactor. Three waves.', 'START MISSION'],
        PAUSED: ['LINK SUSPENDED', 'The deterministic simulation is paused.', 'RESUME MISSION'],
        VICTORY: ['REACTOR STABLE', 'Shared victory · P1 ' + state.players[0].score + ' · P2 ' + state.players[1].score, 'RETURN TO LOBBY'],
        DEFEAT: ['REACTOR LOST', 'Shared defeat · protect the core and revive each other.', 'RETURN TO LOBBY']
      }[sceneId];
      overlay.hidden = !blocking;
      if (blockingCopy) {
        byId('scene-title').textContent = blockingCopy[0];
        byId('scene-copy').textContent = blockingCopy[1];
        byId('start').textContent = blockingCopy[2];
      }
      banner.hidden = !bannerCopy;
      if (bannerCopy) { byId('transition-title').textContent = bannerCopy[0]; byId('transition-copy').textContent = bannerCopy[1]; }
      doc.body.dataset.scene = sceneId;
      byId('scene-name').textContent = sceneId.replace(/_/g, ' ');
      win.AXM_GAME_EXPERIENCE_STATE = Object.freeze({
        schema: CONFIG.experience.schema,
        planDigest: CONFIG.experience.planDigest,
        sceneId,
        disclosure: blocking ? 'MISSION_GATE' : bannerCopy ? 'TRANSITION_CUE' : 'PLAYER_RELEVANT_ONLY',
        reviewDrawerOpen: byId('review-drawer').open,
        authority: 'NONE'
      });
      previousPhase = state.phase;
      previousWave = state.wave;
    }

    function render() {
      const state = engine.snapshot();
      context.clearRect(0, 0, A.width, A.height);
      drawBackground(state); drawLink(state); A.obstacles.forEach(drawObstacle); drawReactor(state);
      state.projectiles.forEach(drawProjectile); state.enemies.forEach((item) => drawEnemy(item, state));
      state.players.forEach((item, index) => drawPlayer(item, index, state)); state.repairCores.forEach((item) => drawRepairCore(item, state));
      byId('wave').textContent = String(state.wave) + '/3';
      byId('reactor-health').textContent = String(state.reactor.health);
      byId('enemy-count').textContent = String(state.enemies.length);
      byId('link-state').textContent = state.linked ? 'LINKED ×2' : 'SEPARATED';
      state.players.forEach((item) => { byId(item.id + '-health').textContent = item.down ? 'DOWN' : String(item.hp); byId(item.id + '-score').textContent = String(item.score); });
      byId('status').textContent = state.message;
      byId('pause').textContent = state.phase === 'PAUSED' ? 'Resume' : 'Pause';
      canvas.setAttribute('aria-label', 'Twin Reactor arena. ' + state.phase + ', wave ' + state.wave + ', reactor ' + state.reactor.health + ', twin link ' + (state.linked ? 'active' : 'separated') + ', P1 ' + (state.players[0].down ? 'down' : state.players[0].hp + ' health') + ' at ' + Math.round(state.players[0].x) + ',' + Math.round(state.players[0].y) + ', P2 ' + (state.players[1].down ? 'down' : state.players[1].hp + ' health') + ' at ' + Math.round(state.players[1].x) + ',' + Math.round(state.players[1].y) + ', ' + state.enemies.length + ' enemies, ' + state.projectiles.length + ' bolts, ' + state.repairCores.length + ' repair cores.');
      presentExperience(state);
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
      else if (event.code === 'Enter') { const state = engine.snapshot(); if (state.phase === 'DEFEAT' || state.phase === 'VICTORY') engine.reset(); else engine.start(); render(); event.preventDefault(); }
      else if (event.code === 'Escape') { engine.pause(); render(); event.preventDefault(); }
    });
    doc.addEventListener('keyup', (event) => { if (map[event.code]) { held[map[event.code]] = false; event.preventDefault(); } });
    byId('start').addEventListener('click', () => { const state = engine.snapshot(); if (state.phase === 'DEFEAT' || state.phase === 'VICTORY') engine.reset(); else engine.start(); render(); });
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
};
(function(root){const api=AXM_COOP_FACTORY(CONFIG);if(typeof module==='object'&&module.exports)module.exports=api;if(root&&root.document){root.AXM_COOP_GAME=api;const boot=()=>api.mount(root.document,root);if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();}})(typeof window==='object'?window:null);
