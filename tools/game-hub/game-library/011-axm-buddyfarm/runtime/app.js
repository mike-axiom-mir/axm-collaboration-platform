(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const core = window.BuddyFarmCore;
  const motion = window.BuddyFarmMotion;
  const query = new URLSearchParams(location.search);
  const localPlayer = query.get('player') || 'p1';
  const views = document.getElementById('views');
  const canvases = new Map();
  let packet = null;
  const postingPlayers = new Set();
  let lastKeyAt = 0;
  let actionHoldStarted = 0;
  let visualClock = 0;
  let lastVisualFrame = 0;
  let fullMap = query.get('map') === 'full';
  const gamepadStates = new Map();
  const actorVisuals = new Map();
  const workVisuals = new Map();
  const substrateImages = new Map();
  let audioContext = null;

  const palette = {
    grass: ['#79ae55', '#72a64f', '#82b75d', '#6fa04b'],
    darkGrass: '#3e7746',
    soil: '#8a5540',
    wetSoil: '#5b493d',
    fence: '#dcc98d',
    path: '#d5be7c',
    wall: '#f0dcaa',
    roof: '#bf6f54',
    ink: '#183528',
    water: '#65b8bd'
  };

  function hash(x, y, salt) {
    let value = Math.imul(x + 19 + salt, 374761393) ^ Math.imul(y + 71, 668265263);
    value = (value ^ (value >>> 13)) * 1274126177;
    return (value ^ (value >>> 16)) >>> 0;
  }

  function actorSort(a, b) {
    return Number(a.id.replace(/\D/g, '')) - Number(b.id.replace(/\D/g, ''));
  }

  function ensureViews(state) {
    const actors = Object.values(state.actors).sort(actorSort);
    if (canvases.has('shared')) return;
    views.replaceChildren();
    canvases.clear();
    const root = document.createElement('article');
    root.className = 'player-view shared-view';
    root.dataset.player = 'shared';
    root.innerHTML = '<canvas aria-label="One shared BuddyFarm world"></canvas>' +
      '<div class="view-label"><i></i><span></span><em></em></div><div class="scene-label"></div><div class="action-hint"></div>';
    views.appendChild(root);
    canvases.set('shared', {
      root,
      canvas: root.querySelector('canvas'),
      name: root.querySelector('.view-label span'),
      kind: root.querySelector('.view-label em'),
      scene: root.querySelector('.scene-label'),
      hint: root.querySelector('.action-hint')
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function tileInfo(canvas, actor, overview) {
    const width = Math.max(320, canvas.clientWidth || 640);
    const height = Math.max(320, canvas.clientHeight || 520);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const sceneBounds = core.WORLD[actor.scene] || core.WORLD.farm;
    const tile = overview
      ? Math.max(.75, Math.min(width / sceneBounds.width, height / sceneBounds.height))
      : Math.max(30, Math.min(48, Math.floor(Math.min(width / 14, height / 11))));
    const cols = Math.ceil(width / tile) + 2;
    const rows = Math.ceil(height / tile) + 2;
    const startX = overview ? -Math.floor((width - sceneBounds.width * tile) / (2 * tile)) : actor.x - Math.floor(cols / 2);
    const startY = overview ? -Math.floor((height - sceneBounds.height * tile) / (2 * tile)) : actor.y - Math.floor(rows / 2);
    return { ctx, width, height, tile, cols, rows, startX, startY };
  }

  function screenPoint(info, x, y) {
    return { x: (x - info.startX) * info.tile, y: (y - info.startY) * info.tile };
  }

  function drawGrassTile(info, x, y) {
    const point = screenPoint(info, x, y);
    const variant = hash(x, y, 3) % palette.grass.length;
    info.ctx.fillStyle = palette.grass[variant];
    info.ctx.fillRect(point.x, point.y, info.tile + 1, info.tile + 1);
    const speck = hash(x, y, 17);
    if (speck % 7 === 0) {
      info.ctx.fillStyle = '#d9ee89aa';
      info.ctx.fillRect(point.x + info.tile * .2, point.y + info.tile * .55, 2, 5);
      info.ctx.fillRect(point.x + info.tile * .15, point.y + info.tile * .5, 4, 2);
    } else if (speck % 11 === 0) {
      info.ctx.fillStyle = '#496f3e88';
      info.ctx.fillRect(point.x + info.tile * .7, point.y + info.tile * .25, 2, 7);
    }
  }

  function activeWorldChunk(worldView, x, y) {
    if (!worldView || !worldView.grid) return null;
    const column = Math.floor(x / worldView.grid.chunkWidth);
    const row = Math.floor(y / worldView.grid.chunkHeight);
    return worldView.chunks.find(chunk => chunk.column === column && chunk.row === row) || null;
  }

  function drawTransparentSubstrates(info, worldView) {
    if (!worldView || !Array.isArray(worldView.chunks)) return;
    worldView.chunks.forEach(chunk => {
      const substrate = chunk.substrate;
      if (!substrate || !substrate.url) return;
      let image = substrateImages.get(substrate.url);
      if (!image) {
        image = new Image();
        image.decoding = 'async';
        image.onload = () => render();
        image.src = substrate.url;
        substrateImages.set(substrate.url, image);
      }
      if (!image.complete || !image.naturalWidth) return;
      const point = screenPoint(info, chunk.bounds.x, chunk.bounds.y);
      info.ctx.drawImage(image, point.x, point.y, chunk.bounds.width * info.tile, chunk.bounds.height * info.tile);
    });
  }

  function drawFogTile(info, x, y) {
    const point = screenPoint(info, x, y);
    info.ctx.fillStyle = '#07110de8';
    info.ctx.fillRect(point.x, point.y, info.tile + 1, info.tile + 1);
    if (info.tile > 20 && hash(x, y, 81) % 5 === 0) {
      info.ctx.fillStyle = '#91a79a33';
      info.ctx.fillRect(point.x + info.tile * .46, point.y + info.tile * .46, 2, 2);
    }
  }

  function plotUnlocked(state, index) {
    return index < state.farm.unlockedPlots;
  }

  function drawPlots(info, state) {
    core.WORLD.plots.forEach((plot, index) => {
      const a = screenPoint(info, plot.x, plot.y);
      const unlocked = plotUnlocked(state, index);
      const w = plot.width * info.tile;
      const h = plot.height * info.tile;
      info.ctx.save();
      info.ctx.fillStyle = unlocked ? '#d9f0950b' : '#173a2cb0';
      info.ctx.fillRect(a.x, a.y, w, h);
      info.ctx.strokeStyle = unlocked ? '#f4e0a6bb' : '#7a9b7e88';
      info.ctx.lineWidth = unlocked ? 3 : 2;
      info.ctx.setLineDash(unlocked ? [] : [8, 8]);
      info.ctx.strokeRect(a.x + 2, a.y + 2, w - 4, h - 4);
      info.ctx.setLineDash([]);
      for (let x = 0; x <= plot.width; x += 2) {
        info.ctx.fillStyle = unlocked ? palette.fence : '#607868';
        info.ctx.fillRect(a.x + x * info.tile - 2, a.y - 4, 5, 10);
        info.ctx.fillRect(a.x + x * info.tile - 2, a.y + h - 6, 5, 10);
      }
      info.ctx.font = '700 10px ui-monospace, monospace';
      info.ctx.fillStyle = unlocked ? '#fff0b8' : '#a1b8a3';
      info.ctx.fillText(unlocked ? plot.name.toUpperCase() : plot.name.toUpperCase() + ' · ' + plot.cost + ' TOKENS', a.x + 8, a.y + 16);
      info.ctx.restore();
      if (!unlocked && plot.sign) drawSign(info, plot.sign.x, plot.sign.y, plot.cost);
    });
  }

  function drawSign(info, x, y, cost) {
    const p = screenPoint(info, x, y);
    const t = info.tile;
    info.ctx.fillStyle = '#5b3a28';
    info.ctx.fillRect(p.x + t * .45, p.y + t * .36, t * .1, t * .62);
    info.ctx.fillStyle = '#e0b86f';
    info.ctx.fillRect(p.x + t * .12, p.y + t * .13, t * .76, t * .42);
    info.ctx.strokeStyle = '#563927';
    info.ctx.strokeRect(p.x + t * .12, p.y + t * .13, t * .76, t * .42);
    info.ctx.fillStyle = '#3c2b1e';
    info.ctx.font = '700 ' + Math.max(9, t * .2) + 'px ui-monospace,monospace';
    info.ctx.textAlign = 'center';
    info.ctx.fillText(String(cost), p.x + t / 2, p.y + t * .42);
    info.ctx.textAlign = 'start';
  }

  function drawCells(info, state) {
    Object.values(state.farm.cells).forEach(cell => {
      const p = screenPoint(info, cell.x, cell.y);
      const t = info.tile;
      info.ctx.fillStyle = cell.watered ? palette.wetSoil : palette.soil;
      info.ctx.fillRect(p.x + 3, p.y + 3, t - 6, t - 6);
      info.ctx.strokeStyle = cell.watered ? '#89bcc0aa' : '#c88d68aa';
      info.ctx.lineWidth = 1;
      for (let line = 0; line < 3; line += 1) {
        const yy = p.y + 10 + line * ((t - 18) / 2);
        info.ctx.beginPath(); info.ctx.moveTo(p.x + 7, yy); info.ctx.lineTo(p.x + t - 7, yy); info.ctx.stroke();
      }
      if (!cell.crop) return;
      const growth = Number(cell.growth || 0);
      const phase = (hash(cell.x, cell.y, 41) % 628) / 100;
      const sway = motion.windSway(visualClock, { amp: 3.2, freq: .45, gust: .22, phase });
      info.ctx.save();
      info.ctx.translate(p.x + t * .5, p.y + t * .74);
      info.ctx.rotate(sway * Math.PI / 180);
      if (growth === 0) {
        // A planted seed is deliberately tiny: it must not read as harvest-ready.
        info.ctx.fillStyle = '#4c3427';
        info.ctx.beginPath(); info.ctx.ellipse(0, 0, t * .18, t * .07, 0, 0, Math.PI * 2); info.ctx.fill();
        info.ctx.fillStyle = '#78c85e';
        info.ctx.beginPath(); info.ctx.ellipse(-t * .04, -t * .1, t * .08, t * .04, -.55, 0, Math.PI * 2); info.ctx.fill();
      } else if (growth === 1) {
        // First morning: a visible green sprout, still no orange harvest body.
        info.ctx.fillStyle = '#2c6d3b';
        info.ctx.fillRect(-Math.max(1, t * .025), -t * .27, Math.max(2, t * .05), t * .27);
        info.ctx.fillStyle = '#58ad4f';
        info.ctx.beginPath(); info.ctx.ellipse(-t * .08, -t * .25, t * .12, t * .055, -.5, 0, Math.PI * 2); info.ctx.fill();
        info.ctx.beginPath(); info.ctx.ellipse(t * .08, -t * .26, t * .12, t * .055, .5, 0, Math.PI * 2); info.ctx.fill();
      } else {
        // Second watered morning: only now does the orange harvest body appear.
        info.ctx.fillStyle = '#2c6d3b';
        info.ctx.fillRect(-Math.max(1, t * .04), -t * .43, Math.max(2, t * .08), t * .43);
        info.ctx.fillStyle = '#ffb250';
        info.ctx.beginPath(); info.ctx.arc(0, -t * .16, t * .22, 0, Math.PI * 2); info.ctx.fill();
        info.ctx.fillStyle = '#4b9b49';
        info.ctx.beginPath(); info.ctx.ellipse(-t * .12, -t * .4, t * .18, t * .075, -.5, 0, Math.PI * 2); info.ctx.fill();
        info.ctx.beginPath(); info.ctx.ellipse(t * .12, -t * .41, t * .18, t * .075, .5, 0, Math.PI * 2); info.ctx.fill();
      }
      info.ctx.restore();
      if (cell.watered) {
        info.ctx.fillStyle = '#b9f1ffaa'; info.ctx.beginPath(); info.ctx.arc(p.x + t * .75, p.y + t * .25, 3, 0, Math.PI * 2); info.ctx.fill();
      }
    });
  }

  function drawHouseExterior(info) {
    const house = core.WORLD.houseExterior;
    const p = screenPoint(info, house.x, house.y);
    const t = info.tile;
    const w = house.width * t;
    const h = house.height * t;
    info.ctx.fillStyle = '#18332455'; info.ctx.fillRect(p.x + 12, p.y + h - 6, w, t * .5);
    info.ctx.fillStyle = palette.wall; info.ctx.fillRect(p.x + t * .7, p.y + t * 2.8, w - t * 1.4, h - t * 2.8);
    info.ctx.fillStyle = '#7e473d'; info.ctx.fillRect(p.x + t * .35, p.y + t * 1.3, w - t * .7, t * 2.1);
    info.ctx.fillStyle = palette.roof;
    info.ctx.beginPath(); info.ctx.moveTo(p.x, p.y + t * 2.5); info.ctx.lineTo(p.x + w / 2, p.y); info.ctx.lineTo(p.x + w, p.y + t * 2.5); info.ctx.closePath(); info.ctx.fill();
    info.ctx.strokeStyle = '#7d443d'; info.ctx.lineWidth = 4; info.ctx.stroke();
    const door = screenPoint(info, house.door.x, house.door.y);
    info.ctx.fillStyle = '#6c402d'; info.ctx.fillRect(door.x, door.y, t, t);
    info.ctx.strokeStyle = '#ffe5a899'; info.ctx.lineWidth = 2; info.ctx.strokeRect(door.x + 2, door.y + 2, t - 4, t - 2);
    info.ctx.fillStyle = '#f8d572'; info.ctx.fillRect(door.x + t * .72, door.y + t * .48, Math.max(3, t * .1), Math.max(3, t * .1));
    [[2, 4.1], [7, 4.1]].forEach(pair => {
      info.ctx.fillStyle = '#5ea6b6'; info.ctx.fillRect(p.x + pair[0] * t, p.y + pair[1] * t, t, t * .9);
      info.ctx.strokeStyle = '#fff3c8'; info.ctx.lineWidth = 3; info.ctx.strokeRect(p.x + pair[0] * t, p.y + pair[1] * t, t, t * .9);
    });
    info.ctx.fillStyle = '#fff1bd'; info.ctx.font = '800 ' + Math.max(12, t * .36) + 'px system-ui'; info.ctx.textAlign = 'center';
    info.ctx.fillText('BUDDY HOUSE', p.x + w / 2, p.y + t * 3.25); info.ctx.textAlign = 'start';
    const doorPath = screenPoint(info, core.WORLD.portals.farmDoor.approach.x, core.WORLD.portals.farmDoor.approach.y);
    info.ctx.fillStyle = palette.path; info.ctx.fillRect(doorPath.x, doorPath.y, t, t * 4);
    info.ctx.fillStyle = '#fff0a922'; info.ctx.fillRect(doorPath.x + 3, doorPath.y + 3, t - 6, t - 6);
  }

  function drawWorldOverview(info, state, worldView) {
    info.ctx.fillStyle = '#08130f';
    info.ctx.fillRect(0, 0, info.width, info.height);
    const chunks = worldView && worldView.overview || [];
    chunks.forEach(chunk => {
      const x = chunk.column * (worldView.grid.chunkWidth || 32);
      const y = chunk.row * (worldView.grid.chunkHeight || 32);
      const point = screenPoint(info, x, y);
      const width = worldView.grid.chunkWidth * info.tile;
      const height = worldView.grid.chunkHeight * info.tile;
      info.ctx.fillStyle = chunk.explored ? '#4e7548' : '#0a1611';
      info.ctx.fillRect(point.x, point.y, width, height);
      info.ctx.strokeStyle = chunk.explored ? '#b9df8d66' : '#6f837733';
      info.ctx.lineWidth = 1;
      info.ctx.strokeRect(point.x + .5, point.y + .5, width - 1, height - 1);
      if (!chunk.explored && width > 30) {
        info.ctx.fillStyle = '#74887b44';
        info.ctx.font = '700 9px ui-monospace,monospace';
        info.ctx.textAlign = 'center';
        info.ctx.fillText('BLANK', point.x + width / 2, point.y + height / 2 + 3);
      }
    });
    const starter = core.WORLD.starterDistrict;
    const marker = screenPoint(info, starter.x, starter.y);
    info.ctx.fillStyle = '#ffdb6a44';
    info.ctx.fillRect(marker.x, marker.y, starter.width * info.tile, starter.height * info.tile);
    info.ctx.strokeStyle = '#ffe997';
    info.ctx.lineWidth = 2;
    info.ctx.strokeRect(marker.x, marker.y, starter.width * info.tile, starter.height * info.tile);
    info.ctx.fillStyle = '#fff0b8';
    info.ctx.font = '800 10px ui-monospace,monospace';
    info.ctx.fillText('STARTER FARM', marker.x + 5, marker.y + 13);
  }

  function drawFarm(info, state, worldView, overview) {
    if (overview) {
      drawWorldOverview(info, state, worldView);
      return;
    }
    info.ctx.fillStyle = palette.darkGrass; info.ctx.fillRect(0, 0, info.width, info.height);
    drawTransparentSubstrates(info, worldView);
    for (let y = info.startY; y <= info.startY + info.rows; y += 1) {
      for (let x = info.startX; x <= info.startX + info.cols; x += 1) {
        if (x < 0 || y < 0 || x >= core.WORLD.farm.width || y >= core.WORLD.farm.height) continue;
        const chunk = activeWorldChunk(worldView, x, y);
        if (chunk && chunk.explored) drawGrassTile(info, x, y);
        else drawFogTile(info, x, y);
      }
    }
    drawPlots(info, state);
    drawCells(info, state);
    drawHouseExterior(info);
  }

  function drawRoomBase(info, scene) {
    const bounds = core.WORLD[scene];
    const topLeft = screenPoint(info, 0, 0);
    const t = info.tile;
    info.ctx.fillStyle = scene === 'house' ? '#3b211d' : '#171f21'; info.ctx.fillRect(0, 0, info.width, info.height);
    info.ctx.fillStyle = scene === 'house' ? '#d7a66c' : '#596267';
    info.ctx.fillRect(topLeft.x, topLeft.y, bounds.width * t, bounds.height * t);
    for (let y = 0; y < bounds.height; y += 1) {
      for (let x = 0; x < bounds.width; x += 1) {
        const p = screenPoint(info, x, y);
        const edge = x === 0 || y === 0 || x === bounds.width - 1 || y === bounds.height - 1;
        if (edge) {
          info.ctx.fillStyle = scene === 'house' ? '#67423a' : '#303c3f';
          info.ctx.fillRect(p.x, p.y, t + 1, t + 1);
        } else if (scene === 'house') {
          info.ctx.strokeStyle = '#b77e5466'; info.ctx.strokeRect(p.x, p.y, t, t);
        } else {
          info.ctx.strokeStyle = '#83909455'; info.ctx.strokeRect(p.x, p.y, t, t);
        }
      }
    }
  }

  function drawTravelApproach(info, portal, label) {
    if (!portal || !portal.approach) return;
    const target = screenPoint(info, portal.x, portal.y);
    const approach = screenPoint(info, portal.approach.x, portal.approach.y);
    const t = info.tile;
    info.ctx.save();
    info.ctx.strokeStyle = '#ffe08cbb';
    info.ctx.lineWidth = 2;
    info.ctx.setLineDash([Math.max(3, t * .12), Math.max(3, t * .1)]);
    info.ctx.strokeRect(approach.x + 4, approach.y + 4, t - 8, t - 8);
    info.ctx.setLineDash([]);
    info.ctx.fillStyle = '#fff0aa';
    info.ctx.beginPath();
    info.ctx.moveTo(approach.x + t * .5, approach.y + t * .28);
    info.ctx.lineTo(target.x + t * .5, target.y + t * .72);
    info.ctx.stroke();
    info.ctx.font = '800 ' + Math.max(8, t * .18) + 'px ui-monospace,monospace';
    info.ctx.textAlign = 'center';
    info.ctx.fillText(label, target.x + t * .5, target.y + t * .92);
    info.ctx.restore();
  }

  function drawHouseInterior(info) {
    drawRoomBase(info, 'house');
    const t = info.tile;
    let p = screenPoint(info, 3, 2);
    info.ctx.fillStyle = '#325f69'; info.ctx.fillRect(p.x, p.y, t * 2, t);
    info.ctx.fillStyle = '#f4e7bd'; info.ctx.fillRect(p.x + 3, p.y + 3, t * .7, t * .35);
    p = screenPoint(info, 9, 2);
    info.ctx.fillStyle = '#885b36'; info.ctx.fillRect(p.x, p.y, t * 2, t);
    info.ctx.fillStyle = '#dac786'; info.ctx.fillRect(p.x + 6, p.y + 7, t * 1.6, 5);
    p = screenPoint(info, 11, 2);
    info.ctx.fillStyle = '#273539'; info.ctx.fillRect(p.x + 5, p.y + 5, t - 10, t - 10);
    for (let n = 0; n < 4; n += 1) { info.ctx.strokeStyle = '#b3c6b7'; info.ctx.beginPath(); info.ctx.moveTo(p.x + 8, p.y + 8 + n * 7); info.ctx.lineTo(p.x + t - 8, p.y + 8 + n * 7); info.ctx.stroke(); }
    p = screenPoint(info, 6, 8);
    info.ctx.fillStyle = '#643b2c'; info.ctx.fillRect(p.x, p.y, t, t);
    info.ctx.fillStyle = '#ffe186'; info.ctx.font = '700 10px ui-monospace,monospace'; info.ctx.fillText('EXIT', p.x + 8, p.y + t * .58);
    drawTravelApproach(info, core.WORLD.portals.houseStairs, 'CELLAR');
    drawTravelApproach(info, core.WORLD.portals.houseExit, 'OUT');
  }

  function drawCellar(info) {
    drawRoomBase(info, 'cellar');
    const t = info.tile;
    [[2, 3], [3, 3], [8, 4], [9, 4]].forEach(([x, y]) => {
      const p = screenPoint(info, x, y);
      info.ctx.fillStyle = '#805238'; info.ctx.beginPath(); info.ctx.ellipse(p.x + t / 2, p.y + t / 2, t * .36, t * .45, 0, 0, Math.PI * 2); info.ctx.fill();
      info.ctx.strokeStyle = '#d3a66e'; info.ctx.lineWidth = 3; info.ctx.beginPath(); info.ctx.moveTo(p.x + t * .18, p.y + t * .5); info.ctx.lineTo(p.x + t * .82, p.y + t * .5); info.ctx.stroke();
    });
    const stairs = screenPoint(info, 6, 1);
    info.ctx.fillStyle = '#1c2629'; info.ctx.fillRect(stairs.x + 4, stairs.y + 4, t - 8, t - 8);
    for (let n = 0; n < 4; n += 1) { info.ctx.strokeStyle = '#c5d0c1'; info.ctx.beginPath(); info.ctx.moveTo(stairs.x + 7, stairs.y + 9 + n * 7); info.ctx.lineTo(stairs.x + t - 7, stairs.y + 9 + n * 7); info.ctx.stroke(); }
    drawTravelApproach(info, core.WORLD.portals.cellarStairs, 'UP');
  }

  function visualActor(actor, now) {
    const walk = actor.walkState || {
      sequence: actor.steps,
      direction: actor.facing,
      from: { x: actor.x, y: actor.y },
      to: { x: actor.x, y: actor.y },
      durationMs: core.WALK_DURATION_MS || 150
    };
    let record = actorVisuals.get(actor.id);
    if (!record || record.scene !== actor.scene || record.sequence !== walk.sequence) {
      record = {
        scene: actor.scene,
        sequence: walk.sequence,
        startedAt: now,
        from: Object.assign({}, walk.from),
        to: Object.assign({}, walk.to),
        direction: walk.direction,
        durationMs: walk.durationMs || core.WALK_DURATION_MS || 150,
        previousProgress: 0,
        footstepPlayed: false,
        hasDistance: walk.from.x !== walk.to.x || walk.from.y !== walk.to.y
      };
      actorVisuals.set(actor.id, record);
    }
    const position = motion.interpolateGridMove(record.from, record.to, now - record.startedAt, record.durationMs);
    if (
      actor.id === localPlayer
      && record.hasDistance
      && !record.footstepPlayed
      && motion.crossedFootstep(record.previousProgress, position.progress)
    ) {
      record.footstepPlayed = true;
      playFootstepSound(actor);
    }
    record.previousProgress = position.progress;
    return Object.assign({}, actor, {
      x: position.x,
      y: position.y,
      _moving: position.moving,
      _walkPose: motion.walkCycle(record.direction, position.progress)
    });
  }

  function enableAudio() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    if (!audioContext) audioContext = new AudioCtor();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  }

  function playFootstepSound(actor) {
    if (!audioContext || audioContext.state !== 'running') return;
    const startedAt = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(actor.scene === 'cellar' ? 78 : 92, startedAt);
    oscillator.frequency.exponentialRampToValueAtTime(48, startedAt + .045);
    gain.gain.setValueAtTime(.025, startedAt);
    gain.gain.exponentialRampToValueAtTime(.0001, startedAt + .05);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startedAt);
    oscillator.stop(startedAt + .052);
  }

  function workVisual(actor, now) {
    const work = actor.workState || { sequence: 0, kind: 'idle', target: null };
    let record = workVisuals.get(actor.id);
    if (!record || record.sequence !== work.sequence || record.scene !== actor.scene) {
      record = { sequence: work.sequence, scene: actor.scene, startedAt: now, kind: work.kind, target: work.target };
      workVisuals.set(actor.id, record);
    }
    return Object.assign({}, record, { pulse: motion.workPulse(now - record.startedAt, 460) });
  }

  function drawActor(info, actor, focus) {
    const p = screenPoint(info, actor.x, actor.y);
    const bob = actor._moving
      ? { dy: -Math.sin(actor._walkPose.progress * Math.PI) * info.tile * .06 }
      : motion.idleBob(visualClock, { amp: 1.6, freq: .7, phase: Number(actor.id.replace(/\D/g, '') || 0) * .8 });
    p.y += bob.dy;
    const t = info.tile;
    const recipe = actor.appearance || core.BUDDY_RECIPES[actor.id] || core.BUDDY_RECIPES.p3;
    const pose = actor._walkPose || motion.walkCycle(actor.facing, 1);
    const swingSign = pose.frame === 0 ? -1 : pose.frame === 2 ? 1 : 0;
    const swing = swingSign * pose.stride * t * .08;
    const horizontal = pose.direction === 'left' || pose.direction === 'right';
    const leftBootY = p.y + t * .71 + (horizontal ? 0 : swing);
    const rightBootY = p.y + t * .71 - (horizontal ? 0 : swing);
    const lateralLean = horizontal ? (pose.direction === 'left' ? -t * .035 : t * .035) : 0;
    info.ctx.save();
    if (focus) {
      info.ctx.fillStyle = '#fff2a733';
      info.ctx.beginPath();
      info.ctx.arc(p.x + t / 2, p.y + t * .72, t * .46, 0, Math.PI * 2);
      info.ctx.fill();
    }
    info.ctx.fillStyle = '#18312a66';
    info.ctx.beginPath();
    info.ctx.ellipse(p.x + t / 2, p.y + t * .86, t * .31, t * .11, 0, 0, Math.PI * 2);
    info.ctx.fill();
    if (actor._moving && pose.footstepContact) {
      info.ctx.fillStyle = '#e8d9a177';
      info.ctx.beginPath();
      info.ctx.arc(p.x + t * .36, p.y + t * .9, t * .09, 0, Math.PI * 2);
      info.ctx.arc(p.x + t * .64, p.y + t * .9, t * .06, 0, Math.PI * 2);
      info.ctx.fill();
    }
    info.ctx.fillStyle = recipe.boots;
    info.ctx.fillRect(p.x + t * .27 + lateralLean, leftBootY, t * .18, t * .2);
    info.ctx.fillRect(p.x + t * .55 + lateralLean, rightBootY, t * .18, t * .2);
    info.ctx.fillStyle = recipe.shirt;
    info.ctx.fillRect(p.x + t * .25 + lateralLean, p.y + t * .36, t * .5, t * .43);
    info.ctx.fillStyle = recipe.trim;
    info.ctx.fillRect(p.x + t * .25 + lateralLean, p.y + t * .62, t * .5, Math.max(2, t * .07));
    info.ctx.fillStyle = '#f0bd8d';
    info.ctx.beginPath();
    info.ctx.arc(p.x + t / 2 + lateralLean, p.y + t * .27, t * .21, 0, Math.PI * 2);
    info.ctx.fill();
    info.ctx.fillStyle = recipe.hair;
    if (pose.direction === 'up') {
      info.ctx.beginPath();
      info.ctx.arc(p.x + t / 2 + lateralLean, p.y + t * .25, t * .21, 0, Math.PI * 2);
      info.ctx.fill();
    } else {
      info.ctx.beginPath();
      info.ctx.arc(p.x + t / 2 + lateralLean, p.y + t * .2, t * .21, Math.PI, Math.PI * 2);
      info.ctx.fill();
      info.ctx.fillStyle = '#24312c';
      if (pose.direction === 'down') {
        info.ctx.fillRect(p.x + t * .42 + lateralLean, p.y + t * .27, Math.max(2, t * .04), Math.max(2, t * .045));
        info.ctx.fillRect(p.x + t * .56 + lateralLean, p.y + t * .27, Math.max(2, t * .04), Math.max(2, t * .045));
      } else {
        const eyeX = pose.direction === 'left' ? .36 : .62;
        info.ctx.fillRect(p.x + t * eyeX + lateralLean, p.y + t * .27, Math.max(2, t * .045), Math.max(2, t * .05));
      }
    }
    info.ctx.fillStyle = '#6c4b2f';
    const satchelX = pose.direction === 'left' ? .65 : .18;
    info.ctx.fillRect(p.x + t * satchelX + lateralLean, p.y + t * .48, t * .17, t * .21);
    info.ctx.strokeStyle = recipe.trim;
    info.ctx.lineWidth = Math.max(1, t * .035);
    info.ctx.beginPath();
    info.ctx.moveTo(p.x + t * .33, p.y + t * .38);
    info.ctx.lineTo(p.x + t * .69, p.y + t * .66);
    info.ctx.stroke();
    info.ctx.fillStyle = '#f8f3d2';
    info.ctx.font = '700 9px ui-monospace,monospace';
    info.ctx.textAlign = 'center';
    info.ctx.fillText(actor.name.slice(0, 10), p.x + t / 2, p.y + 2);
    info.ctx.textAlign = 'start';
    info.ctx.restore();
  }

  function drawOverviewActor(info, actor, focus) {
    const point = screenPoint(info, actor.x, actor.y);
    const recipe = actor.appearance || core.BUDDY_RECIPES[actor.id] || core.BUDDY_RECIPES.p3;
    info.ctx.fillStyle = focus ? '#fff7b2' : recipe.shirt;
    info.ctx.beginPath();
    info.ctx.arc(point.x + info.tile / 2, point.y + info.tile / 2, Math.max(3, info.tile * 1.4), 0, Math.PI * 2);
    info.ctx.fill();
    info.ctx.strokeStyle = '#12261d';
    info.ctx.lineWidth = 1;
    info.ctx.stroke();
  }

  function drawWorkFeedback(info, actor, now) {
    const feedback = workVisual(actor, now);
    if (!feedback.target || !feedback.pulse.active || feedback.kind === 'idle') return;
    const point = screenPoint(info, feedback.target.x, feedback.target.y);
    const t = info.tile;
    const labels = { prepare: 'PREP', plant: 'PLANT', water: 'WATER', harvest: 'HARVEST' };
    const colors = { prepare: '#d39464', plant: '#c9ec7c', water: '#8bd9e8', harvest: '#ffd36c' };
    info.ctx.save();
    info.ctx.globalAlpha = feedback.pulse.alpha;
    info.ctx.strokeStyle = colors[feedback.kind] || '#fff0a9';
    info.ctx.lineWidth = Math.max(2, t * .06);
    info.ctx.beginPath();
    info.ctx.arc(point.x + t / 2, point.y + t / 2, t * .35 * feedback.pulse.scale, 0, Math.PI * 2);
    info.ctx.stroke();
    info.ctx.fillStyle = colors[feedback.kind] || '#fff0a9';
    info.ctx.font = '900 ' + Math.max(9, t * .2) + 'px ui-monospace,monospace';
    info.ctx.textAlign = 'center';
    info.ctx.fillText(labels[feedback.kind] || feedback.kind.toUpperCase(), point.x + t / 2, point.y + t * .08);
    info.ctx.restore();
  }

  function drawTarget(info, actor) {
    const target = core.targetFor(actor);
    const p = screenPoint(info, target.x, target.y);
    info.ctx.strokeStyle = '#fff0a9cc'; info.ctx.lineWidth = 2; info.ctx.strokeRect(p.x + 5, p.y + 5, info.tile - 10, info.tile - 10);
  }

  function hintFor(state, actor) {
    const target = core.targetFor(actor);
    if (actor.scene === 'farm') {
      if (target.x === core.WORLD.portals.farmDoor.x && target.y === core.WORLD.portals.farmDoor.y) return 'Hold E 0.2 sec · enter Buddy House';
      const next = core.WORLD.plots[state.farm.unlockedPlots];
      if (next && next.sign && target.x === next.sign.x && target.y === next.sign.y) return 'E · open ' + next.name + ' (' + next.cost + ' growth tokens)';
      const plot = core.unlockedPlotAt(state, target.x, target.y);
      if (plot) {
        const cell = state.farm.cells[core.cellKey(target.x, target.y)];
        if (!cell || !cell.tilled) return 'F · work · prepare this grass tile';
        if (!cell.crop) return 'F · work · plant from the shared seed pouch';
        if (cell.growth >= 2) return 'F · work · harvest Buddy Carrot';
        return cell.watered ? 'Watered · sleep for a new morning' : 'F · work · water this crop';
      }
      return 'Explore one shared 12,288×8,192 world or return to the starter farm';
    }
    if (actor.scene === 'house') {
      if (target.x === core.WORLD.portals.houseExit.x && target.y === core.WORLD.portals.houseExit.y) return 'Hold E 0.2 sec · go outside';
      if (target.x === core.WORLD.portals.houseStairs.x && target.y === core.WORLD.portals.houseStairs.y) return 'Hold E 0.2 sec · descend to the cellar';
      if (target.x === 3 && target.y === 2) return 'E · sleep until morning';
      return 'The bed advances every crop by one watered day';
    }
    if (target.x === core.WORLD.portals.cellarStairs.x && target.y === core.WORLD.portals.cellarStairs.y) return 'Hold E 0.2 sec · return upstairs';
    return 'The cellar is ready for future storage and crafting';
  }

  function renderShared(state, record) {
    const actors = Object.values(state.actors).sort(actorSort);
    const focus = state.actors[localPlayer] || actors.find(actor => actor.type === 'human') || actors[0];
    if (!focus) return;
    const present = actors.filter(actor => actor.scene === focus.scene);
    const now = visualClock * 1000;
    const visualActors = present.map(actor => visualActor(actor, now));
    const camera = visualActors.reduce((value, actor) => ({
      x: value.x + actor.x / present.length,
      y: value.y + actor.y / present.length
    }), { x: 0, y: 0 });
    camera.x = Math.round(camera.x);
    camera.y = Math.round(camera.y);
    camera.scene = focus.scene;
    const overview = fullMap && focus.scene === 'farm';
    const info = tileInfo(record.canvas, camera, overview);
    info.ctx.clearRect(0, 0, info.width, info.height);
    if (focus.scene === 'farm') drawFarm(info, state, packet.worldView, overview);
    else if (focus.scene === 'house') drawHouseInterior(info);
    else drawCellar(info);
    visualActors.forEach(actor => {
      if (overview) drawOverviewActor(info, actor, actor.id === localPlayer);
      else drawActor(info, actor, actor.id === localPlayer);
    });
    if (!overview) {
      present.forEach(actor => drawWorkFeedback(info, actor, now));
      present.filter(actor => actor.type !== 'ai').forEach(actor => drawTarget(info, actor));
    }
    record.name.textContent = actors.map(actor => actor.name).join(' + ');
    record.kind.textContent = 'ONE SHARED WORLD';
    const elsewhere = actors.length - present.length;
    const sceneName = focus.scene === 'farm' ? 'Blank-world farm' : focus.scene === 'house' ? 'Buddy House' : 'Cellar';
    const exploredCount = state.exploration && state.exploration.exploredChunks ? state.exploration.exploredChunks.length : 0;
    record.scene.textContent = overview
      ? 'FULL MAP · 12,288×8,192 · ' + exploredCount + '/96 CHUNKS EXPLORED'
      : sceneName + ' · ' + present.length + '/' + actors.length + ' here' + (elsewhere ? ' · ' + elsewhere + ' nearby room' : '');
    record.hint.textContent = overview ? 'Transparent blank substrate · fog hides unexplored chunks · press M to return' : hintFor(state, focus);
  }

  function render(now) {
    if (!packet) return;
    visualClock = (Number.isFinite(now) ? now : performance.now()) / 1000;
    const state = packet.state;
    ensureViews(state);
    document.getElementById('day').textContent = state.day;
    document.getElementById('weather').textContent = String(state.weather || 'soft sun').replace(/-/g, ' ').toUpperCase();
    document.getElementById('seeds').textContent = state.inventory.seeds;
    document.getElementById('carrots').textContent = state.inventory.buddyCarrots;
    document.getElementById('tokens').textContent = state.farm.growthTokens;
    document.getElementById('plots').textContent = state.farm.unlockedPlots + ' / ' + core.WORLD.plots.length;
    document.getElementById('message').textContent = state.message;
    renderShared(state, canvases.get('shared'));
  }

  async function refresh() {
    try {
      const response = await fetch('/api/state', { cache: 'no-store' });
      const value = await response.json();
      if (!response.ok || !value.ok) throw new Error(value.error || 'farm state unavailable');
      packet = value;
      render();
    } catch (error) {
      document.getElementById('message').textContent = 'BuddyFarm reconnecting: ' + error.message;
    }
  }

  async function action(value, requestedPlayer) {
    const playerId = requestedPlayer || localPlayer;
    if (postingPlayers.has(playerId) || !packet || !packet.state.actors[playerId]) return;
    postingPlayers.add(playerId);
    try {
      const response = await fetch('/api/action', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ player: playerId, action: value })
      });
      const result = await response.json();
      if (result.state) packet = { state: result.state, world: result.world || core.WORLD, worldView: result.worldView };
      if (result.result && result.result.reason === 'hold-required' && packet) packet.state.message = 'Hold Action for 0.2 seconds to travel.';
      render();
    } finally { postingPlayers.delete(playerId); }
  }

  const moveKeys = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
  window.addEventListener('keydown', event => {
    const now = performance.now();
    if (moveKeys[event.key] || event.key === 'e' || event.key === 'E' || event.key === 'f' || event.key === 'F' || event.key === ' ') enableAudio();
    if ((event.key === 'm' || event.key === 'M') && !event.repeat) {
      event.preventDefault();
      fullMap = !fullMap;
      updateMapToggle();
      render();
      return;
    }
    if (now - lastKeyAt < 75) return;
    const direction = moveKeys[event.key];
    if (direction) { event.preventDefault(); lastKeyAt = now; action({ type: 'move', direction }); }
    else if ((event.key === 'e' || event.key === 'E') && !event.repeat) { event.preventDefault(); actionHoldStarted = now; }
    else if (event.key === 'f' || event.key === 'F' || event.key === ' ') { event.preventDefault(); lastKeyAt = now; action({ type: 'work' }); }
  });
  window.addEventListener('keyup', event => {
    if (event.key !== 'e' && event.key !== 'E') return;
    event.preventDefault();
    const holdMs = actionHoldStarted ? Math.round(performance.now() - actionHoldStarted) : 0;
    actionHoldStarted = 0;
    action({ type: 'action', holdMs });
  });

  document.getElementById('reset').addEventListener('click', async () => {
    if (!confirm('Restart this temporary BuddyFarm safe slice?')) return;
    const response = await fetch('/api/reset', { method: 'POST' });
    const result = await response.json();
    if (result.state) packet = { state: result.state, world: result.world || core.WORLD, worldView: result.worldView };
    render();
  });

  function updateMapToggle() {
    const button = document.getElementById('map-toggle');
    if (!button) return;
    button.textContent = fullMap ? 'Close full map' : 'Full map';
    button.setAttribute('aria-pressed', String(fullMap));
  }

  document.getElementById('map-toggle').addEventListener('click', () => {
    fullMap = !fullMap;
    updateMapToggle();
    render();
  });

  window.addEventListener('resize', render);

  function gamepadAssignments(pads) {
    if (!packet || !pads.length) return [];
    const playerIds = core.gamepadPlayerIds(packet.state.actors, localPlayer, pads.length);
    return playerIds.map((playerId, index) => ({ pad: pads[index], playerId }));
  }

  function buttonPressed(gamepad, index) {
    return !!(gamepad.buttons[index] && gamepad.buttons[index].pressed);
  }

  function stateForPad(pad) {
    if (!gamepadStates.has(pad.index)) {
      gamepadStates.set(pad.index, { actionDown: false, actionStarted: 0, workDown: false, lastMoveAt: 0 });
    }
    return gamepadStates.get(pad.index);
  }

  function updateGamepadStatus(assignments) {
    const status = document.getElementById('gamepads');
    if (!status) return;
    if (!assignments.length) {
      status.textContent = 'Pair a Bluetooth pad, then press a button';
      return;
    }
    status.textContent = assignments.map(({ pad, playerId }) => `PAD ${pad.index + 1} \u2192 ${playerId.toUpperCase()}`).join(' \u00b7 ');
  }

  function pollAssignedGamepad(now, pad, playerId) {
    const state = stateForPad(pad);
    let direction = null;
    const x = Number(pad.axes[0] || 0), y = Number(pad.axes[1] || 0);
    if (buttonPressed(pad, 12) || y < -.55) direction = 'up';
    else if (buttonPressed(pad, 13) || y > .55) direction = 'down';
    else if (buttonPressed(pad, 14) || x < -.55) direction = 'left';
    else if (buttonPressed(pad, 15) || x > .55) direction = 'right';
    if (direction && now - state.lastMoveAt > 145) {
      state.lastMoveAt = now;
      action({ type: 'move', direction }, playerId);
    }
    const actionPressed = buttonPressed(pad, 0);
    const workPressed = buttonPressed(pad, 2);
    if (direction || actionPressed || workPressed) enableAudio();
    if (actionPressed && !state.actionDown) {
      state.actionDown = true;
      state.actionStarted = now;
    } else if (!actionPressed && state.actionDown) {
      const holdMs = Math.round(now - state.actionStarted);
      state.actionDown = false;
      state.actionStarted = 0;
      action({ type: 'action', holdMs }, playerId);
    }
    if (workPressed && !state.workDown) action({ type: 'work' }, playerId);
    state.workDown = workPressed;
  }

  function pollGamepad(now) {
    const pads = navigator.getGamepads
      ? Array.from(navigator.getGamepads()).filter(Boolean).sort((a, b) => a.index - b.index)
      : [];
    const assignments = gamepadAssignments(pads);
    updateGamepadStatus(assignments);
    assignments.forEach(({ pad, playerId }) => pollAssignedGamepad(now, pad, playerId));
    const liveIndexes = new Set(pads.map(pad => pad.index));
    Array.from(gamepadStates.keys()).forEach(index => { if (!liveIndexes.has(index)) gamepadStates.delete(index); });
    if (!document.hidden && packet && now - lastVisualFrame >= 100) {
      lastVisualFrame = now;
      render(now);
    }
    requestAnimationFrame(pollGamepad);
  }

  updateMapToggle();
  refresh();
  setInterval(refresh, 800);
  requestAnimationFrame(pollGamepad);
})();
