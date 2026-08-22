(function () {
  'use strict';

  const Core = window.HearthgateCore;
  if (!Core) throw new Error('HearthgateCore did not load');

  const threeCanvas = document.getElementById('game3d');
  const stage3d = window.HearthgateThree ? window.HearthgateThree.create(threeCanvas) : { available: false, render: function () {} };
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: true });
  ctx.imageSmoothingEnabled = false;

  const $ = id => document.getElementById(id);
  const ui = {
    title: $('titleOverlay'), build: $('buildOverlay'), help: $('helpOverlay'), pause: $('pauseOverlay'), over: $('gameOverOverlay'), prep: $('prepBanner'),
    toast: $('toast'), rebuild: $('rebuildBanner'), buildingGrid: $('buildingGrid'), buildTitle: $('buildTitle'), buildDescription: $('buildDescription'),
    wave: $('waveValue'), time: $('timeValue'), chapter: $('chapterValue'), score: $('scoreValue'),
    wallets: [
      { root: $('northWallet'), label: $('northWalletLabel'), gold: $('northGoldValue'), metal: $('northMetalValue'), goldRate: $('northGoldRate'), metalRate: $('northMetalRate') },
      { root: $('southWallet'), gold: $('southGoldValue'), metal: $('southMetalValue'), goldRate: $('southGoldRate'), metalRate: $('southMetalRate') }
    ],
    blueprintEffect: $('blueprintEffect'), hearthValue: $('hearthValue'), hearthHealth: $('hearthHealth'),
    gateLevel: $('gateLevel'), gateCost: $('gateCost'), blueprintName: $('blueprintName'), wardens: $('wardenStatus'), padReadiness: $('padReadiness'),
    resultLine: $('resultLine'), resultStats: $('resultStats')
  };

  const PLOTS = Core.BUILDING_SLOTS;
  const BLUEPRINTS = Object.keys(Core.BUILDING_TYPES);
  const WHEEL_CHOICES = ['forge', 'ballista', 'market', 'alchemist'];
  const keys = new Set();
  const pointer = { x: 560, y: 250, active: false, down: false, plotCandidate: null };
  const padMemory = [{ buttons: [], aimActive: false }, { buttons: [], aimActive: false }];
  const app = {
    state: Core.createState({ mode: 'single' }),
    launch: { defaultGameMode: 'single', players: [] },
    remoteInputs: [{}, {}],
    remoteStatus: [false, false],
    remoteEverConnected: [false, false],
    remoteEdgeMemory: [{}, {}],
    remoteEdgeInitialized: [false, false],
    remoteBuildHeld: [false, false],
    padStatus: [false, false],
    buildWheels: [null, null],
    buildMoveLocks: [0, 0],
    remotePollBusy: false,
    paused: false,
    muted: false,
    reducedMotion: false,
    highContrast: false,
    blueprint: 0,
    buildSlot: null,
    lastFrame: performance.now(),
    uiClock: 0,
    seenEvent: 0,
    toastTimer: 0,
    gameOverShown: false,
    audio: null
  };

  async function pollRemoteInputs() {
    if (app.remotePollBusy || document.hidden) return;
    app.remotePollBusy = true;
    try {
      const response = await fetch('/api/input', { cache: 'no-store' });
      if (!response.ok) throw new Error(`phone input HTTP ${response.status}`);
      const payload = await response.json();
      for (let index = 0; index < 2; index += 1) {
        const player = `p${index + 1}`;
        const packet = payload.inputs && payload.inputs[player];
        const wasConnected = app.remoteStatus[index];
        app.remoteStatus[index] = Boolean(packet);
        if (!packet) {
          app.remoteInputs[index] = {};
          app.remoteBuildHeld[index] = false;
          if (app.buildWheels[index] && app.buildWheels[index].source === 'phone') cancelBuildWheel(index);
          if (wasConnected) showToast(`Phone ${index + 1} disconnected - keyboard/gamepad still works.`, 'danger');
          continue;
        }
        app.remoteInputs[index] = {
          moveX: Number(packet.moveX) || 0,
          moveY: Number(packet.moveY) || 0,
          aimX: Number(packet.aimX) || 0,
          aimY: Number(packet.aimY) || 0,
          fire: Boolean(packet.fire),
          buildHeld: Boolean(packet.buildHeld),
          firePulse: Boolean(app.remoteInputs[index].firePulse),
          preserveAim: true
        };
        if (!wasConnected) {
          showToast(`Phone ${index + 1} linked to ${index ? 'South' : 'North'}.`, 'good');
          app.remoteEverConnected[index] = true;
        }
        const previous = app.remoteEdgeMemory[index];
        const next = packet.edges || {};
        const hasEdgeBaseline = app.remoteEdgeInitialized[index];
        const increased = key => hasEdgeBaseline && Number(next[key] || 0) > Number(previous[key] || 0);
        const side = index === 0 ? 'north' : 'south';
        const fireEdge = increased('fire');
        const titleOpen = !ui.title.hidden;
        const overOpen = !ui.over.hidden;
        const pausedAtStart = app.paused;
        const buildHeld = Boolean(packet.buildHeld);
        if (fireEdge && Math.hypot(Number(packet.fireAimX) || 0, Number(packet.fireAimY) || 0) > 0.24) {
          app.remoteInputs[index].aimX = Number(packet.fireAimX) || 0;
          app.remoteInputs[index].aimY = Number(packet.fireAimY) || 0;
        }
        if (titleOpen) {
          if (fireEdge) startGame(recommendedControllerMode());
          else if (increased('upgrade')) startGame('single');
          else if (increased('repair')) startGame('coop');
        } else if (overOpen && fireEdge) {
          startGame(app.state.mode);
        } else if (pausedAtStart && fireEdge) {
          setPaused(false);
        } else if (app.state.status === 'running') {
          if (fireEdge) app.remoteInputs[index].firePulse = true;
          if (increased('volley')) towerCommand('volley', side);
          if (increased('upgrade')) towerCommand('upgrade', side);
          if (increased('repair')) towerCommand('repair', side);
          if (increased('fortify') || increased('blueprint')) controllerFortify();
          if (increased('build') || (buildHeld && !app.remoteBuildHeld[index])) beginControllerBuild(index, 'phone');
          if (increased('pause')) setPaused();
          if (increased('back') && anyPanelOpen()) closePanels();
        }
        updateBuildWheel(index, Number(packet.moveX) || 0, Number(packet.moveY) || 0, buildHeld, 'phone');
        app.remoteBuildHeld[index] = buildHeld;
        app.remoteEdgeMemory[index] = Object.assign({}, next);
        app.remoteEdgeInitialized[index] = true;
      }
    } catch (_) {
      for (let index = 0; index < 2; index += 1) {
        if (app.remoteStatus[index]) showToast(`Phone ${index + 1} link lost - reconnecting.`, 'danger');
        app.remoteStatus[index] = false;
        app.remoteInputs[index] = {};
        app.remoteBuildHeld[index] = false;
        if (app.buildWheels[index] && app.buildWheels[index].source === 'phone') cancelBuildWheel(index);
      }
    } finally { app.remotePollBusy = false; }
  }

  function deadzone(value, threshold) {
    const t = threshold || 0.18;
    const n = Number(value) || 0;
    if (Math.abs(n) <= t) return 0;
    return Math.sign(n) * (Math.abs(n) - t) / (1 - t);
  }

  function buttonValue(pad, index) {
    const button = pad && pad.buttons && pad.buttons[index];
    return button ? Math.max(Number(button.value) || 0, button.pressed ? 1 : 0) : 0;
  }

  function buttonEdge(padIndex, pad, index) {
    const current = buttonValue(pad, index) > 0.55;
    const previous = Boolean(padMemory[padIndex].buttons[index]);
    padMemory[padIndex].buttons[index] = current;
    return current && !previous;
  }

  function tone(frequency, duration, type, volume) {
    if (app.muted) return;
    try {
      if (!app.audio) app.audio = new (window.AudioContext || window.webkitAudioContext)();
      if (app.audio.state === 'suspended') app.audio.resume();
      const oscillator = app.audio.createOscillator();
      const gain = app.audio.createGain();
      oscillator.type = type || 'square';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume || 0.025, app.audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, app.audio.currentTime + duration);
      oscillator.connect(gain).connect(app.audio.destination);
      oscillator.start();
      oscillator.stop(app.audio.currentTime + duration);
    } catch (_) {}
  }

  function showToast(message, toneName) {
    ui.toast.textContent = message;
    ui.toast.className = `toast show ${toneName || ''}`;
    clearTimeout(app.toastTimer);
    app.toastTimer = setTimeout(() => { ui.toast.className = 'toast'; }, 1900);
  }

  function resultMessage(result, successText) {
    if (result && result.ok) {
      if (successText) showToast(successText, 'good');
      tone(520, 0.09, 'square', 0.025);
      return true;
    }
    const reason = result && result.reason;
    const ownerLabel = result && Number.isInteger(result.owner) && app.state.mode === 'coop' ? `W${result.owner + 1} needs` : 'Need';
    const messages = {
      gold: `${ownerLabel} ${result.cost} gold.`, metal: `${ownerLabel} ${result.cost} metal.`,
      'metal-team': `Gate fortify needs ${result.perPlayer[0]} north metal + ${result.perPlayer[1]} south metal.`,
      full: 'That tower is already fully repaired.', cooldown: 'Tower volley is recharging.',
      'no-target': 'No target is in tower range.', 'tower-down': 'Rebuild the tower first.',
      occupied: 'That plot is already occupied.', empty: 'Build here first.'
    };
    showToast(messages[reason] || 'That action is not available yet.', 'danger');
    tone(125, 0.12, 'square', 0.018);
    return false;
  }

  function towerCommand(action, side) {
    let result;
    if (action === 'upgrade') result = Core.upgradeTower(app.state, side);
    else if (action === 'repair') result = Core.repairOrRebuild(app.state, side);
    else result = Core.powerShot(app.state, side);
    const verbs = { upgrade: 'Tower damage upgraded.', repair: 'Stonework secured.', volley: 'Gate volley!' };
    resultMessage(result, verbs[action]);
  }

  function rememberBlueprint(type) {
    app.blueprint = Math.max(0, BLUEPRINTS.indexOf(type));
    const spec = Core.BUILDING_TYPES[type];
    ui.blueprintName.textContent = spec.label;
    ui.blueprintEffect.textContent = `LAST PICK · ${spec.tag} · ${spec.cost} M`;
  }

  function nearestPlot(warden) {
    let best = null;
    let distance = Infinity;
    PLOTS.forEach((plot, index) => {
      if (app.state.mode === 'coop' && plot.side !== warden.side) return;
      const d = Math.hypot(plot.x - warden.x, plot.y - warden.y);
      if (d < distance) { distance = d; best = { index, distance }; }
    });
    return best && best.distance <= 92 ? best.index : null;
  }

  function controllerFortify() {
    resultMessage(Core.fortifyGate(app.state), 'Shared gate fortified.');
  }

  function cancelBuildWheel(wardenIndex) {
    if (!app.buildWheels[wardenIndex]) return;
    app.buildWheels[wardenIndex] = null;
    app.buildMoveLocks[wardenIndex] = 0.12;
  }

  function cancelBuildWheels() {
    cancelBuildWheel(0);
    cancelBuildWheel(1);
  }

  function beginControllerBuild(wardenIndex, source) {
    const warden = app.state.wardens[wardenIndex];
    if (!warden) return;
    const slot = nearestPlot(warden);
    if (slot === null) {
      showToast('Move closer to an inner-ward building plot.', 'danger');
      return;
    }
    const existing = app.state.buildings[slot];
    if (existing) {
      const result = Core.upgradeBuilding(app.state, slot);
      const nextLevel = existing.level;
      resultMessage(result, `${Core.BUILDING_TYPES[existing.type].label} level ${nextLevel} · ${Core.buildingSummary(existing.type, nextLevel)}`);
      app.buildMoveLocks[wardenIndex] = 0.12;
      return;
    }
    const fallback = BLUEPRINTS[app.blueprint];
    app.buildWheels[wardenIndex] = { slot, source, selected: fallback, moveX: 0, moveY: 0 };
    tone(310, 0.05, 'square', 0.018);
  }

  function updateBuildWheel(wardenIndex, moveX, moveY, held, source) {
    const wheel = app.buildWheels[wardenIndex];
    if (!wheel || wheel.source !== source) return;
    wheel.moveX = Number(moveX) || 0;
    wheel.moveY = Number(moveY) || 0;
    wheel.selected = Core.buildingChoiceFromVector(wheel.moveX, wheel.moveY, wheel.selected);
    if (held) return;
    app.buildWheels[wardenIndex] = null;
    app.buildMoveLocks[wardenIndex] = 0.18;
    if (app.state.buildings[wheel.slot]) {
      showToast('That plot changed before release.', 'danger');
      return;
    }
    const type = wheel.selected;
    rememberBlueprint(type);
    resultMessage(Core.build(app.state, wheel.slot, type), `${Core.BUILDING_TYPES[type].label} raised · ${Core.buildingSummary(type, 1)}`);
  }

  function closePanels() {
    ui.build.hidden = true;
    ui.help.hidden = true;
    if (!app.paused) ui.pause.hidden = true;
    app.buildSlot = null;
    canvas.focus();
  }

  function openBuild(slot) {
    if (app.state.status !== 'running' || app.paused) return;
    app.buildSlot = slot;
    ui.buildingGrid.innerHTML = '';
    const existing = app.state.buildings[slot];
    if (existing) {
      const spec = Core.BUILDING_TYPES[existing.type];
      const cost = Core.buildingUpgradeCost(existing);
      ui.buildTitle.textContent = `${spec.label} · level ${existing.level} · W${existing.owner + 1}`;
      ui.buildDescription.textContent = `CURRENT: ${Core.buildingSummary(existing.type, existing.level)} · NEXT: ${Core.buildingSummary(existing.type, existing.level + 1)}`;
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'building-option';
      option.style.setProperty('--building', spec.color);
      option.innerHTML = `<span class="building-icon">${spec.icon}</span><span><b>${spec.tag} · UPGRADE TO LEVEL ${existing.level + 1}</b><small>${Core.buildingSummary(existing.type, existing.level + 1)}</small></span><em>${cost} M</em>`;
      option.addEventListener('click', () => {
        if (resultMessage(Core.upgradeBuilding(app.state, slot), `${spec.label} upgraded.`)) closePanels();
      });
      ui.buildingGrid.appendChild(option);
    } else {
      const plot = PLOTS[slot];
      const plotOwner = app.state.mode === 'coop' ? plot.owner : 0;
      ui.buildTitle.textContent = `${plot.side.toUpperCase()} PLOT ${PLOTS.filter(item => item.side === plot.side).indexOf(plot) + 1} · W${plotOwner + 1}`;
      ui.buildDescription.textContent = 'This side pays and owns the result. Choose by exact job and level-one output.';
      BLUEPRINTS.forEach(type => {
        const spec = Core.BUILDING_TYPES[type];
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'building-option';
        option.style.setProperty('--building', spec.color);
        option.innerHTML = `<span class="building-icon">${spec.icon}</span><span><b>${spec.label.toUpperCase()} · ${spec.tag}</b><small>${Core.buildingSummary(type, 1)}</small></span><em>${spec.cost} M</em>`;
        option.addEventListener('click', () => {
          if (resultMessage(Core.build(app.state, slot, type), `${spec.label} raised.`)) closePanels();
        });
        ui.buildingGrid.appendChild(option);
      });
    }
    ui.build.hidden = false;
    ui.buildingGrid.querySelector('button')?.focus();
  }

  function startGame(mode) {
    app.paused = false;
    app.gameOverShown = false;
    Core.startGame(app.state, mode);
    cancelBuildWheels();
    ui.title.hidden = true;
    ui.over.hidden = true;
    ui.pause.hidden = true;
    closePanels();
    app.seenEvent = 0;
    app.lastFrame = performance.now();
    canvas.focus();
    tone(mode === 'coop' ? 392 : 330, 0.13, 'square', 0.035);
  }

  function returnToTitle() {
    const mode = app.state.mode;
    app.state = Core.createState({ mode });
    app.paused = false;
    app.gameOverShown = false;
    cancelBuildWheels();
    ui.pause.hidden = true;
    ui.over.hidden = true;
    ui.build.hidden = true;
    ui.help.hidden = true;
    ui.title.hidden = false;
    $('singleButton').focus();
  }

  function setPaused(force) {
    if (app.state.status !== 'running') return;
    app.paused = typeof force === 'boolean' ? force : !app.paused;
    if (app.paused) cancelBuildWheels();
    ui.pause.hidden = !app.paused;
    if (app.paused) $('resumeButton').focus();
    else { canvas.focus(); app.lastFrame = performance.now(); }
  }

  function anyPanelOpen() {
    return !ui.build.hidden || !ui.help.hidden || !ui.pause.hidden || !ui.over.hidden || !ui.title.hidden;
  }

  function keyboardInput(index) {
    const input = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, fire: false, preserveAim: false };
    if (index === 0) {
      input.moveX = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      input.moveY = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0);
      if (pointer.active) {
        const warden = app.state.wardens[0];
        input.aimX = pointer.x - warden.x;
        input.aimY = pointer.y - warden.y;
        input.preserveAim = true;
      } else if (app.state.mode === 'single') {
        input.aimX = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
        input.aimY = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
      }
      input.fire = keys.has('Space') || pointer.down;
    } else {
      input.moveX = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
      input.moveY = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
      input.aimX = (keys.has('KeyL') ? 1 : 0) - (keys.has('KeyJ') ? 1 : 0);
      input.aimY = (keys.has('KeyK') ? 1 : 0) - (keys.has('KeyI') ? 1 : 0);
      input.fire = keys.has('Enter') || keys.has('Numpad0');
    }
    return input;
  }

  function gamepads() {
    if (!navigator.getGamepads) return [];
    return Array.from(navigator.getGamepads()).filter(Boolean).slice(0, 2);
  }

  function recommendedControllerMode() {
    const launchHasTwoPlayers = Array.isArray(app.launch.players) && app.launch.players.length >= 2;
    return launchHasTwoPlayers || app.padStatus[1] || app.remoteStatus[1] ? 'coop' : (app.launch.defaultGameMode || 'single');
  }

  function pollGamepads() {
    const pads = gamepads();
    app.padStatus = [Boolean(pads[0]), Boolean(pads[1])];
    const readySeats = [0, 1].map(index => Boolean(pads[index] || app.remoteStatus[index]));
    const readyCount = readySeats.filter(Boolean).length;
    if (ui.padReadiness) {
      ui.padReadiness.textContent = readyCount >= 2 ? '2 controllers ready - A starts Two Wardens · X solo · Y co-op' : readyCount === 1 ? '1 controller ready - A starts · X solo · Y co-op' : 'Scan phone QR controllers, connect gamepads, or use keyboard';
      ui.padReadiness.className = `pad-readiness ${readyCount >= 2 ? 'duo' : readyCount === 1 ? 'ready' : ''}`;
    }
    const inputs = [{}, {}];
    pads.forEach((pad, index) => {
      const memory = padMemory[index];
      let moveX = deadzone(pad.axes[0]);
      let moveY = deadzone(pad.axes[1]);
      if (buttonValue(pad, 14) > 0.5) moveX = -1;
      if (buttonValue(pad, 15) > 0.5) moveX = 1;
      if (buttonValue(pad, 12) > 0.5) moveY = -1;
      if (buttonValue(pad, 13) > 0.5) moveY = 1;
      const aimX = deadzone(pad.axes[2]);
      const aimY = deadzone(pad.axes[3]);
      const aimMagnitude = Math.hypot(aimX, aimY);
      const firePulse = memory.aimActive && aimMagnitude < 0.28;
      memory.aimActive = aimMagnitude > 0.55 ? true : aimMagnitude < 0.28 ? false : memory.aimActive;
      inputs[index] = {
        moveX, moveY, aimX, aimY,
        fire: buttonValue(pad, 7) > 0.35 || buttonValue(pad, 0) > 0.55,
        firePulse,
        preserveAim: true
      };

      const side = index === 0 ? 'north' : 'south';
      const aEdge = buttonEdge(index, pad, 0);
      const bEdge = buttonEdge(index, pad, 1);
      const xEdge = buttonEdge(index, pad, 2);
      const yEdge = buttonEdge(index, pad, 3);
      const lbEdge = buttonEdge(index, pad, 4);
      const rbEdge = buttonEdge(index, pad, 5);
      const rbHeld = buttonValue(pad, 5) > 0.55;
      const ltEdge = buttonEdge(index, pad, 6);
      buttonEdge(index, pad, 7);
      const menuEdge = buttonEdge(index, pad, 9);

      if (!ui.title.hidden && xEdge) startGame('single');
      else if (!ui.title.hidden && yEdge) startGame('coop');
      else if (!ui.title.hidden && aEdge) startGame(recommendedControllerMode());
      else if (app.paused && aEdge) setPaused(false);
      else if (app.state.status === 'running') {
        if (bEdge && app.buildWheels[index]) cancelBuildWheel(index);
        else if (bEdge && anyPanelOpen()) closePanels();
        if (xEdge) towerCommand('upgrade', side);
        if (yEdge) towerCommand('repair', side);
        if (lbEdge) controllerFortify();
        if (rbEdge) beginControllerBuild(index, 'pad');
        updateBuildWheel(index, moveX, moveY, rbHeld, 'pad');
        if (ltEdge) towerCommand('volley', side);
        if (menuEdge) setPaused();
      }
    });
    app.buildWheels.forEach((wheel, index) => {
      if (wheel && wheel.source === 'pad' && !pads[index]) cancelBuildWheel(index);
    });
    app.state.wardens.forEach((warden, index) => { warden.connected = Boolean(pads[index] || app.remoteStatus[index]); });
    return inputs;
  }

  function updateInputs(dt, padInputs) {
    const count = app.state.mode === 'coop' ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      let combined = Core.prioritizeControllerInput(keyboardInput(index), padInputs[index], app.padStatus[index]);
      combined = Core.prioritizeControllerInput(combined, app.remoteInputs[index], app.remoteStatus[index]);
      app.buildMoveLocks[index] = Math.max(0, app.buildMoveLocks[index] - dt);
      if (app.buildWheels[index] || app.buildMoveLocks[index] > 0) {
        combined.moveX = 0;
        combined.moveY = 0;
      }
      Core.updateWarden(app.state, index, combined, dt);
      if (app.remoteInputs[index]) app.remoteInputs[index].firePulse = false;
    }
  }

  function processEvents() {
    const events = app.state.events.filter(event => event.id > app.seenEvent).sort((a, b) => a.id - b.id);
    events.forEach(event => {
      app.seenEvent = Math.max(app.seenEvent, event.id);
      showToast(event.text, event.tone);
      if (event.tone === 'danger') tone(98, 0.2, 'sawtooth', 0.03);
      else if (event.tone === 'special') tone(740, 0.12, 'square', 0.025);
    });
  }

  function showGameOver() {
    if (app.gameOverShown) return;
    app.gameOverShown = true;
    ui.resultLine.textContent = `You held Hearthgate for ${Core.formatTime(app.state.time)} through night ${app.state.wave}.`;
    const stats = app.state.stats;
    ui.resultStats.innerHTML = `
      <span><b>${stats.defeated}</b><small>DEFEATED</small></span>
      <span><b>${stats.breached}</b><small>BREACHED</small></span>
      <span><b>${stats.specialsDefeated}</b><small>RELICBACKS</small></span>
      <span><b>${stats.commandersDefeated}</b><small>WARLORDS</small></span>
      <span><b>${app.state.chronicle.receipts.length}/5</b><small>OATHS</small></span>
      <span><b>${app.state.score}</b><small>SCORE</small></span>`;
    ui.over.hidden = false;
    $('againButton').focus();
    tone(92, 0.45, 'triangle', 0.04);
  }

  function updateTowerUi(side) {
    const tower = Core.getTower(app.state, side);
    const cap = side[0].toUpperCase() + side.slice(1);
    const percent = tower.maxHp ? Math.max(0, tower.hp / tower.maxHp * 100) : 0;
    $(`${side}Health`).style.width = `${percent}%`;
    $(`${side}Hp`).textContent = tower.down ? `DOWN · ${tower.rebuildTimer.toFixed(1)}s` : `${Math.ceil(tower.hp)} / ${tower.maxHp}`;
    $(`${side}Level`).textContent = `DMG ${tower.level}`;
    $(`${side}Power`).textContent = tower.powerCooldown > 0 ? `VOLLEY ${tower.powerCooldown.toFixed(1)}s` : 'VOLLEY READY';
    $(`${side}UpgradeCost`).textContent = `${Core.towerUpgradeCost(tower.level)} G`;
    if (tower.down) $(`${side}RepairCost`).textContent = `${Core.rebuildCost(app.state, tower)} M`;
    else if (tower.hp >= tower.maxHp - 0.1) $(`${side}RepairCost`).textContent = 'FULL';
    else {
      const amount = Math.min(tower.maxHp - tower.hp, 58 + app.state.gateLevel * 9);
      $(`${side}RepairCost`).textContent = `${Math.max(12, Math.round(amount * 0.42))} M`;
    }
    $(`${side}Card`).classList.toggle('down', tower.down);
    document.querySelectorAll(`[data-side="${side}"]`).forEach(button => {
      button.setAttribute('aria-label', `${button.dataset.action} ${cap} tower`);
    });
  }

  function updateUi() {
    const state = app.state;
    state.wardens.forEach((warden, index) => {
      canvas.dataset[`p${index + 1}Aim`] = `${warden.aimX.toFixed(2)},${warden.aimY.toFixed(2)}`;
    });
    canvas.dataset.buildings = state.buildings.map(building => building ? `${building.type}:W${building.owner + 1}:L${building.level}` : '-').join('|');
    canvas.dataset.buildWheel = app.buildWheels.map(wheel => wheel ? `${wheel.slot}:${wheel.selected}` : '-').join('|');
    canvas.dataset.chapter = state.chronicle.currentChapterId;
    canvas.dataset.oathReceipts = String(state.chronicle.receipts.length);
    canvas.dataset.oathComplete = String(state.chronicle.completed);
    canvas.dataset.visualAuthority = stage3d.available ? 'hybrid-webgl-canvas' : 'canvas-fallback';
    ui.wave.textContent = state.wave;
    ui.time.textContent = Core.formatTime(state.time);
    ui.chapter.textContent = state.chronicle.completed ? 'ENDLESS VIGIL' : Core.activeSiegeChapter(state).title;
    ui.score.textContent = state.score.toLocaleString();
    ui.wallets.forEach((walletUi, index) => {
      const wallet = state.playerResources[index];
      const income = state.playerIncome[index];
      walletUi.root.hidden = index === 1 && state.mode !== 'coop';
      walletUi.gold.textContent = Math.floor(wallet.gold);
      walletUi.metal.textContent = Math.floor(wallet.metal);
      walletUi.goldRate.textContent = income.gold ? `G +${income.gold}/s` : 'GOLD';
      walletUi.metalRate.textContent = income.metal ? `M +${income.metal}/s` : 'METAL';
    });
    ui.wallets[0].label.textContent = state.mode === 'coop' ? 'W1 NORTH' : 'WARDEN WALLET';
    ui.hearthValue.textContent = `${Math.ceil(state.sanctumHp)} / ${state.sanctumMaxHp}`;
    ui.hearthHealth.style.width = `${state.sanctumHp / state.sanctumMaxHp * 100}%`;
    ui.gateLevel.textContent = state.gateLevel;
    const gateCost = Core.gateUpgradeCost(state.gateLevel);
    ui.gateCost.textContent = state.mode === 'coop' ? `${Math.ceil(gateCost / 2)} + ${Math.floor(gateCost / 2)} M` : `${gateCost} M`;
    const blueprintSpec = Core.BUILDING_TYPES[BLUEPRINTS[app.blueprint]];
    ui.blueprintName.textContent = blueprintSpec.label;
    ui.blueprintEffect.textContent = `LAST PICK · ${blueprintSpec.tag} · ${blueprintSpec.cost} M`;
    ui.prep.hidden = !(state.status === 'running' && state.prepTime > 0);
    if (!ui.prep.hidden) ui.prep.textContent = `SETUP · 4 PLOTS PER SIDE · EACH WALLET PAYS ITS SIDE · ${state.prepTime.toFixed(1)}s`;
    updateTowerUi('north');
    updateTowerUi('south');
    const down = state.towers.filter(tower => tower.down && tower.rebuildTimer > 0);
    ui.rebuild.hidden = down.length === 0;
    if (down.length) {
      ui.rebuild.textContent = down.map(tower => `${tower.side.toUpperCase()} QUICK REBUILD · ${tower.rebuildTimer.toFixed(1)}s · ${Core.rebuildCost(state, tower)} METAL`).join('  |  ');
    }
    const count = state.mode === 'coop' ? 2 : 1;
    ui.wardens.innerHTML = state.wardens.slice(0, count).map((warden, index) => {
      const player = app.launch.players && app.launch.players[index];
      const name = String(player && player.displayName || (index ? 'WARDEN TWO' : 'WARDEN ONE')).toUpperCase();
      const source = app.remoteStatus[index] ? `PHONE ${index + 1}` : app.padStatus[index] ? `GAMEPAD ${index + 1}` : 'KEYS / POINTER';
      return `<span class="warden-chip ${warden.connected ? '' : 'offline'}" style="--warden:${index ? '#85c29a' : '#e9a85e'}">
        <i></i><span><b>${name} · ${warden.side.toUpperCase()}</b><br>${source}</span>
      </span>`;
    }).join('');
  }

  function fillRect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }

  function pixelText(text, x, y, size, color, align) {
    ctx.font = `900 ${size}px ui-monospace, monospace`;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#19131d';
    ctx.fillText(text, Math.round(x + 1), Math.round(y + 1));
    ctx.fillStyle = color || '#f4e4bd';
    ctx.fillText(text, Math.round(x), Math.round(y));
  }

  function drawGround(time) {
    fillRect(0, 0, 960, 540, '#66516642');
    fillRect(0, 85, 430, 370, '#52634e4d');
    fillRect(465, 85, 495, 370, '#5f5b484d');
    for (let x = 12; x < 950; x += 23) {
      for (let y = 92; y < 450; y += 19) {
        const hash = (x * 17 + y * 31) % 11;
        if (hash < 3) fillRect(x + hash, y + (hash % 2) * 3, 2, 2, x < 430 ? '#708064' : '#77705a');
      }
    }
    fillRect(0, 204, 430, 132, '#796c5966');
    fillRect(0, 263, 430, 14, '#66574580');
    for (let x = 8; x < 426; x += 29) {
      fillRect(x, 220 + (x % 3) * 27, 12, 5, '#8b7b63');
      fillRect(x + 10, 292 - (x % 4) * 14, 9, 4, '#665848');
    }
    ctx.lineCap = 'square';
    [[236,184],[236,270],[304,270],[304,356]].forEach((path, index) => {
      ctx.beginPath();
      ctx.moveTo(446, path[0]);
      ctx.quadraticCurveTo(630, path[1], 858, path[1]);
      ctx.strokeStyle = index % 2 ? '#756a5580' : '#7e725a80';
      ctx.lineWidth = 34;
      ctx.stroke();
      ctx.strokeStyle = '#5c5445';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 11]);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    fillRect(0, 82, 960, 5, '#332a38');
    fillRect(0, 455, 960, 7, '#332a38');
    for (let x = 0; x < 960; x += 24) {
      fillRect(x, 72 + (x % 48 ? 3 : 0), 17, 11, '#463847');
      fillRect(x, 462, 18, 12, '#463847');
    }
    if (!app.reducedMotion) {
      const drift = Math.floor(time * 6) % 960;
      fillRect(drift, 101, 2, 2, '#d8bd82');
      fillRect((drift + 371) % 960, 436, 2, 2, '#bd8c68');
    }
  }

  function drawSanctum() {
    fillRect(830, 145, 56, 255, '#342936');
    fillRect(838, 154, 40, 237, '#85715a');
    for (let y = 161; y < 390; y += 18) {
      for (let x = 842 + ((y / 18) % 2) * 8; x < 876; x += 16) fillRect(x, y, 12, 7, '#9b8669');
    }
    fillRect(823, 132, 70, 25, '#442e3c');
    fillRect(831, 121, 54, 16, '#a15d55');
    fillRect(846, 226, 25, 61, '#342533');
    fillRect(851, 236, 15, 51, '#e39a59');
    fillRect(854, 246, 9, 35, '#ffe08a');
    pixelText('HEARTH', 858, 416, 8, '#e8d29f', 'center');
  }

  function drawGateWall() {
    fillRect(401, 87, 64, 368, '#352c38');
    fillRect(407, 93, 52, 356, '#746858');
    for (let y = 96; y < 448; y += 16) {
      for (let x = 410 + ((y / 16) % 2) * 10; x < 458; x += 20) fillRect(x, y, 16, 9, '#8c7d65');
    }
    fillRect(412, 203, 43, 134, '#2b222d');
    fillRect(418, 211, 31, 118, '#4b3341');
    for (let x = 420; x < 449; x += 7) fillRect(x, 215, 3, 110, '#2c222e');
    fillRect(398, 81, 70, 12, '#3e303d');
    fillRect(398, 449, 70, 12, '#3e303d');
  }

  function drawTower(tower, time) {
    const y = tower.side === 'north' ? 202 : 298;
    if (tower.down) {
      fillRect(384, y - 15, 75, 34, '#3c3338');
      fillRect(392, y - 7, 17, 11, '#82715f');
      fillRect(418, y + 3, 23, 9, '#6d5e51');
      fillRect(444, y - 12, 12, 14, '#917c61');
      if (tower.rebuildTimer > 0) pixelText(`${tower.rebuildTimer.toFixed(1)}s`, 431, y - 29, 9, '#ff966f', 'center');
      return;
    }
    const recoil = app.reducedMotion ? 0 : tower.fireClock > 0.78 ? -2 : 0;
    fillRect(382, y - 29, 83, 60, '#2b2330');
    fillRect(388, y - 25, 69, 52, '#8b7960');
    fillRect(393, y - 20, 59, 8, tower.side === 'north' ? '#d78855' : '#6d9b70');
    fillRect(388, y - 36, 69, 13, '#4a3241');
    for (let x = 390; x < 456; x += 15) fillRect(x, y - 43, 10, 12, '#5d3b49');
    fillRect(396, y + 17, 13, 10, '#a29070');
    fillRect(437, y + 17, 13, 10, '#a29070');
    ctx.save();
    ctx.translate(recoil, 0);
    fillRect(364, y - 4, 36, 8, '#382831');
    fillRect(357, y - 2, 16, 4, '#d6b46c');
    ctx.restore();
    pixelText(`L${tower.level}`, 423, y + 2, 8, '#f5dda6', 'center');
  }

  function drawPlot(plot, index, time) {
    const building = app.state.buildings[index];
    const near = app.state.wardens.some(warden => warden.active && (app.state.mode !== 'coop' || warden.side === plot.side) && Math.hypot(plot.x - warden.x, plot.y - warden.y) <= 92);
    const sideSlot = PLOTS.filter(item => item.side === plot.side).indexOf(plot) + 1;
    const plotOwner = app.state.mode === 'coop' ? plot.owner : 0;
    fillRect(plot.x - 28, plot.y - 22, 56, 44, '#443b37');
    for (let x = plot.x - 24; x <= plot.x + 20; x += 12) fillRect(x, plot.y - 18, 8, 36, '#665a48');
    if (!building) {
      ctx.strokeStyle = near ? '#f0d084' : '#a38b65';
      ctx.lineWidth = near ? 3 : 2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(plot.x - 23, plot.y - 17, 46, 34);
      ctx.setLineDash([]);
      pixelText(`W${plotOwner + 1} · P${sideSlot}`, plot.x, plot.y - 12, 6, plotOwner ? '#85c29a' : '#e9a85e', 'center');
      if (near) {
        pixelText('HOLD RB', plot.x, plot.y + 3, 7, '#ffe097', 'center');
      } else pixelText('+', plot.x, plot.y + 2, 14, '#b5a078', 'center');
      pixelText('EMPTY', plot.x, plot.y + 14, 5, '#d4bd91', 'center');
      return;
    }
    const spec = Core.BUILDING_TYPES[building.type];
    fillRect(plot.x - 24, plot.y - 19, 48, 38, '#302831');
    if (building.type === 'forge') {
      fillRect(plot.x - 20, plot.y - 13, 33, 28, '#8e5746');
      fillRect(plot.x + 9, plot.y - 30, 10, 31, '#4a3940');
      fillRect(plot.x + 11, plot.y - 34, 6, 5, '#d08e62');
      fillRect(plot.x - 12, plot.y + 2, 13, 9, '#ef9d55');
    } else if (building.type === 'market') {
      fillRect(plot.x - 22, plot.y - 5, 44, 20, '#765044');
      fillRect(plot.x - 25, plot.y - 18, 50, 14, '#d1a05d');
      for (let x = plot.x - 22; x < plot.x + 24; x += 12) fillRect(x, plot.y - 18, 6, 14, '#8b5362');
    } else if (building.type === 'ballista') {
      fillRect(plot.x - 20, plot.y + 5, 40, 10, '#6a4b3c');
      fillRect(plot.x - 5, plot.y - 15, 10, 23, '#94704c');
      fillRect(plot.x - 24, plot.y - 16, 48, 5, '#c5a765');
      fillRect(plot.x - 30, plot.y - 14, 12, 2, '#ead38e');
    } else {
      fillRect(plot.x - 18, plot.y - 8, 36, 24, '#614159');
      fillRect(plot.x - 9, plot.y - 25, 18, 20, '#9e6d83');
      fillRect(plot.x - 5, plot.y - 21, 10, 11, '#ee8e65');
      if (!app.reducedMotion) fillRect(plot.x + ((Math.floor(time * 9) % 2) ? 2 : -4), plot.y - 30, 3, 3, '#ffcb68');
    }
    fillRect(plot.x - 25, plot.y + 16, 50, 9, spec.color);
    pixelText(`${spec.short} · L${building.level}`, plot.x, plot.y + 20, 6, '#201923', 'center');
  }

  function drawBuildWheels() {
    const offsets = {
      forge: [0, -59],
      ballista: [64, 0],
      market: [0, 59],
      alchemist: [-64, 0]
    };
    app.buildWheels.forEach((wheel, wardenIndex) => {
      if (!wheel) return;
      const plot = PLOTS[wheel.slot];
      const centerX = Core.clamp(plot.x, 92, 868);
      const centerY = Core.clamp(plot.y, 92, 448);
      const ownerColor = wardenIndex ? '#85c29a' : '#e9a85e';
      ctx.save();
      ctx.fillStyle = '#17111de8';
      ctx.strokeStyle = ownerColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 84, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      pixelText('HOLD RB · POINT LEFT STICK', centerX, centerY - 79, 6, '#ffe3a0', 'center');
      WHEEL_CHOICES.forEach(type => {
        const spec = Core.BUILDING_TYPES[type];
        const selected = wheel.selected === type;
        const offset = offsets[type];
        const boxX = centerX + offset[0] - 25;
        const boxY = centerY + offset[1] - 16;
        fillRect(boxX, boxY, 50, 32, selected ? spec.color : '#302735');
        ctx.strokeStyle = selected ? '#fff0ae' : '#725a49';
        ctx.lineWidth = selected ? 3 : 1;
        ctx.strokeRect(Math.round(boxX), Math.round(boxY), 50, 32);
        pixelText(`${spec.icon} ${spec.short}`, centerX + offset[0], centerY + offset[1] - 5, 7, selected ? '#17111d' : '#f4e4bd', 'center');
        pixelText(`${spec.cost} M`, centerX + offset[0], centerY + offset[1] + 7, 6, selected ? '#17111d' : '#a9d1bf', 'center');
      });
      const selected = Core.BUILDING_TYPES[wheel.selected];
      fillRect(centerX - 42, centerY - 18, 84, 36, '#211927');
      pixelText(selected.label.toUpperCase(), centerX, centerY - 7, 7, '#ffe09a', 'center');
      pixelText('RELEASE RB', centerX, centerY + 7, 6, ownerColor, 'center');
      ctx.restore();
    });
  }

  function drawEnemy(enemy, time) {
    const scale = enemy.kind === 'warlord' ? 1.62 : enemy.kind === 'hexer' ? 1.16 : enemy.kind === 'brute' ? 1.35 : enemy.kind === 'relic' ? 1.18 : enemy.kind === 'skitter' ? 0.78 : 1;
    const bob = app.reducedMotion ? 0 : Math.round(Math.sin(enemy.phase) * 2);
    const x = Math.round(enemy.x), y = Math.round(enemy.y + bob);
    const warded = Core.isEnemyWarded(app.state, enemy);
    const commanded = Core.isEnemyCommanded(app.state, enemy);
    if (warded || commanded || enemy.kind === 'hexer' || enemy.kind === 'warlord') {
      ctx.save();
      ctx.strokeStyle = warded || enemy.kind === 'hexer' ? '#65d5c7' : '#dc6b68';
      ctx.lineWidth = enemy.kind === 'warlord' ? 4 : 3;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.ellipse(x, y + 10, enemy.kind === 'warlord' ? 29 : 22, enemy.kind === 'warlord' ? 11 : 8, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = 0.44;
    fillRect(-11, 10, 23, 5, '#2b2230aa');
    const body = enemy.flash > 0 ? '#fff0cf' : enemy.kind === 'warlord' ? '#9b4e55' : enemy.kind === 'hexer' ? '#7c5ba7' : enemy.kind === 'brute' ? '#53604a' : enemy.kind === 'relic' ? '#b98948' : enemy.kind === 'skitter' ? '#4f9b96' : '#74415e';
    fillRect(-8, -6, 17, 19, '#2a202b');
    fillRect(-6, -8, 14, 18, body);
    fillRect(-7, -15, 14, 9, enemy.kind === 'relic' ? '#e9bb58' : '#4b2d43');
    fillRect(-4, -12, 3, 3, '#ffe18d');
    fillRect(4, -12, 3, 3, '#ffe18d');
    fillRect(-7, 10, 5, 7, '#342733');
    fillRect(4, 10, 5, 7, '#342733');
    fillRect(8, -3, 10, 3, enemy.kind === 'relic' ? '#f0ca69' : '#b8a173');
    if (enemy.kind === 'brute') {
      fillRect(-13, -7, 6, 18, '#394136');
      fillRect(9, -7, 6, 18, '#394136');
    }
    if (enemy.kind === 'relic') {
      fillRect(-11, -10, 3, 4, '#ffd86d'); fillRect(9, -10, 3, 4, '#ffd86d');
      fillRect(-2, -19, 4, 5, '#ffd86d');
    }
    if (enemy.kind === 'hexer') {
      fillRect(10, -21, 3, 34, '#8de1d4');
      fillRect(7, -24, 9, 6, '#c18ae0');
    }
    if (enemy.kind === 'warlord') {
      fillRect(-15, -9, 7, 20, '#62313b'); fillRect(9, -9, 7, 20, '#62313b');
      fillRect(-14, -20, 8, 4, '#f0b46a'); fillRect(7, -20, 8, 4, '#f0b46a');
    }
    ctx.restore();
    if (enemy.hp < enemy.maxHp) {
      fillRect(x - 12 * scale, y - 25 * scale, 24 * scale, 3, '#261b27');
      fillRect(x - 12 * scale, y - 25 * scale, 24 * scale * Math.max(0, enemy.hp / enemy.maxHp), 3, enemy.kind === 'relic' ? '#ffd266' : '#d96b6b');
    }
    if (enemy.breached) pixelText('×2', x, y - 29 * scale, 7, '#ff8b6d', 'center');
    else if (warded) pixelText('WARD', x, y - 29 * scale, 6, '#8de1d4', 'center');
    else if (commanded) pixelText('CMD', x, y - 29 * scale, 6, '#ff9b79', 'center');
    const selected = app.state.towers.some(tower => tower.selectedTarget === enemy.id);
    if (selected) {
      ctx.strokeStyle = '#ffe080'; ctx.lineWidth = 2;
      ctx.strokeRect(x - 16 * scale, y - 21 * scale, 32 * scale, 42 * scale);
    }
  }

  function drawWarden(warden, index, time) {
    if (!warden.active) return;
    const color = index ? '#85c29a' : '#e9a85e';
    const bob = app.reducedMotion ? 0 : Math.round(Math.sin(warden.stride) * 2);
    const x = Math.round(warden.x), y = Math.round(warden.y + bob);
    ctx.save();
    ctx.globalAlpha = 0.38;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + warden.aimX * 90, y + warden.aimY * 90); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 0.44;
    fillRect(x - 8, y + 10, 17, 5, '#2a202c99');
    fillRect(x - 7, y - 5, 14, 17, '#2a202d');
    fillRect(x - 5, y - 6, 11, 16, color);
    fillRect(x - 5, y - 14, 10, 9, '#d8ad80');
    fillRect(x - 8, y - 17, 16, 5, index ? '#3f6654' : '#8b5547');
    fillRect(x - 3, y + 10, 4, 7, '#342631');
    fillRect(x + 4, y + 10, 4, 7, '#342631');
    const weaponX = x + warden.aimX * 10;
    const weaponY = y + warden.aimY * 10;
    ctx.strokeStyle = '#f1d28a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(weaponX, weaponY - 2); ctx.stroke();
    ctx.globalAlpha = 1;
    pixelText(`W${index + 1}`, x, y - 24, 7, color, 'center');
    const near = nearestPlot(warden);
    if (near !== null) pixelText('RB BUILD', x, y + 25, 6, '#ffe199', 'center');
    ctx.restore();
  }

  function drawEffects() {
    app.state.projectiles.forEach(projectile => {
      ctx.strokeStyle = projectile.kind === 'power' ? '#ffe07a' : projectile.kind === 'ember' ? '#ed7b62' : projectile.kind === 'warden' ? '#f5d99d' : '#d7b575';
      ctx.lineWidth = projectile.kind === 'power' ? 4 : 2;
      ctx.beginPath(); ctx.moveTo(projectile.fromX, projectile.fromY); ctx.lineTo(projectile.toX, projectile.toY); ctx.stroke();
      fillRect(projectile.toX - 2, projectile.toY - 2, 4, 4, ctx.strokeStyle);
    });
    app.state.particles.forEach(particle => {
      const alpha = Math.max(0, Math.min(1, particle.life));
      ctx.save(); ctx.globalAlpha = alpha;
      const color = particle.kind === 'treasure' ? '#ffd968' : particle.kind === 'ember' ? '#e8775e' : particle.kind === 'breach' ? '#ff765e' : '#e5c393';
      if (particle.kind === 'ember') {
        ctx.strokeStyle = color; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.radius * (1 - alpha * 0.4), 0, Math.PI * 2); ctx.stroke();
      } else {
        for (let i = 0; i < 6; i += 1) {
          const angle = i / 6 * Math.PI * 2;
          fillRect(particle.x + Math.cos(angle) * 18 * (1 - alpha), particle.y + Math.sin(angle) * 18 * (1 - alpha), 3, 3, color);
        }
      }
      ctx.restore();
    });
  }

  function render(timeMs) {
    const time = timeMs / 1000;
    stage3d.render(timeMs, app.state, app.reducedMotion);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGround(time);
    drawSanctum();
    PLOTS.forEach((plot, index) => drawPlot(plot, index, time));
    app.state.enemies.slice().sort((a, b) => a.y - b.y).forEach(enemy => drawEnemy(enemy, time));
    drawGateWall();
    app.state.towers.forEach(tower => drawTower(tower, time));
    app.state.wardens.forEach((warden, index) => drawWarden(warden, index, time));
    drawEffects();
    ctx.fillStyle = '#20132322'; ctx.fillRect(0, 0, 960, 540);
    drawBuildWheels();
    if (app.paused) pixelText('PAUSED', 480, 270, 26, '#ffe3a0', 'center');
  }

  function frame(now) {
    const rawDt = (now - app.lastFrame) / 1000;
    const dt = Math.min(0.05, Math.max(0, rawDt || 0));
    app.lastFrame = now;
    const padInputs = pollGamepads();
    if (app.state.status === 'running' && !app.paused && ui.build.hidden && ui.help.hidden) {
      updateInputs(dt, padInputs);
      Core.step(app.state, dt);
      processEvents();
      if (app.state.status === 'over') showGameOver();
    }
    app.uiClock -= dt;
    if (app.uiClock <= 0) { updateUi(); app.uiClock = 0.1; }
    render(now);
    requestAnimationFrame(frame);
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width * canvas.width,
      y: (event.clientY - rect.top) / rect.height * canvas.height
    };
  }

  canvas.addEventListener('pointermove', event => {
    Object.assign(pointer, canvasPoint(event), { active: true });
  });
  canvas.addEventListener('pointerleave', () => { if (!pointer.down) pointer.active = false; });
  canvas.addEventListener('pointerdown', event => {
    if (app.state.status !== 'running' || app.paused || anyPanelOpen()) return;
    const point = canvasPoint(event);
    Object.assign(pointer, point, { active: true });
    const plot = PLOTS.findIndex(item => Math.hypot(item.x - point.x, item.y - point.y) <= 38);
    if (plot >= 0) {
      pointer.plotCandidate = plot;
      canvas.setPointerCapture?.(event.pointerId);
      return;
    }
    pointer.down = true;
    canvas.setPointerCapture?.(event.pointerId);
    tone(230, 0.03, 'square', 0.008);
  });
  canvas.addEventListener('pointerup', event => {
    if (pointer.plotCandidate !== null) {
      const plot = pointer.plotCandidate;
      pointer.plotCandidate = null;
      canvas.releasePointerCapture?.(event.pointerId);
      openBuild(plot);
      return;
    }
    pointer.down = false;
    canvas.releasePointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointercancel', () => { pointer.down = false; pointer.plotCandidate = null; });

  window.addEventListener('keydown', event => {
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Escape') {
      if (app.buildWheels.some(Boolean)) cancelBuildWheels();
      else if (!ui.build.hidden || !ui.help.hidden) closePanels();
      else if (app.state.status === 'running') setPaused();
    } else if (event.code === 'KeyH') {
      ui.help.hidden = !ui.help.hidden;
      if (!ui.help.hidden) ui.help.querySelector('button').focus(); else canvas.focus();
    } else if (event.code === 'KeyM') {
      app.reducedMotion = !app.reducedMotion;
      document.body.classList.toggle('reduced-motion', app.reducedMotion);
      showToast(`Reduced motion ${app.reducedMotion ? 'on' : 'off'}.`, 'good');
    } else if (event.code === 'KeyC') {
      app.highContrast = !app.highContrast;
      document.body.classList.toggle('high-contrast', app.highContrast);
    } else if (app.state.status === 'running' && !app.paused) {
      if (event.code === 'KeyQ') towerCommand('upgrade', 'north');
      if (event.code === 'KeyE') towerCommand('repair', 'north');
      if (event.code === 'KeyU') towerCommand('upgrade', 'south');
      if (event.code === 'KeyO') towerCommand('repair', 'south');
      if (event.code === 'KeyF') towerCommand('volley', 'north');
      if (event.code === 'KeyP') towerCommand('volley', 'south');
    }
  });
  window.addEventListener('keyup', event => { keys.delete(event.code); });
  window.addEventListener('blur', () => { keys.clear(); pointer.down = false; pointer.plotCandidate = null; cancelBuildWheels(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && app.state.status === 'running' && !app.paused) setPaused(true);
  });
  window.addEventListener('gamepadconnected', event => showToast(`Gamepad ${event.gamepad.index + 1} connected.`, 'good'));
  window.addEventListener('gamepaddisconnected', event => {
    if (event.gamepad.index < 2) cancelBuildWheel(event.gamepad.index);
    showToast(`Gamepad ${event.gamepad.index + 1} disconnected · keyboard fallback active.`, 'danger');
  });

  document.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', () => towerCommand(button.dataset.action, button.dataset.side));
  });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', closePanels));
  $('singleButton').addEventListener('click', () => startGame('single'));
  $('coopButton').addEventListener('click', () => startGame('coop'));
  $('fortifyButton').addEventListener('click', () => resultMessage(Core.fortifyGate(app.state), 'The shared gate grows stronger.'));
  $('helpButton').addEventListener('click', () => { ui.help.hidden = false; ui.help.querySelector('button').focus(); });
  $('pauseButton').addEventListener('click', () => setPaused());
  $('resumeButton').addEventListener('click', () => setPaused(false));
  $('restartButton').addEventListener('click', returnToTitle);
  $('againButton').addEventListener('click', () => startGame(app.state.mode));
  $('titleButton').addEventListener('click', returnToTitle);
  $('soundButton').addEventListener('click', () => {
    app.muted = !app.muted;
    $('soundButton').textContent = app.muted ? '×♪' : '♪';
    $('soundButton').setAttribute('aria-label', app.muted ? 'Enable sound' : 'Mute sound');
    if (!app.muted) tone(440, 0.08, 'square', 0.025);
  });

  const qaRoute = new URLSearchParams(location.search).get('qa');
  if (qaRoute === 'wheel' || qaRoute === 'oath') {
    const qa = document.createElement('div');
    qa.id = 'wheelQaControls';
    qa.setAttribute('aria-label', 'Radial build visual check controls');
    Object.assign(qa.style, { position: 'fixed', left: '0', top: '0', zIndex: '99', opacity: '0.01', display: 'flex' });
    const addQa = (id, action) => {
      const button = document.createElement('button');
      button.id = id;
      button.type = 'button';
      button.textContent = id;
      Object.assign(button.style, { width: '2px', height: '2px', padding: '0', overflow: 'hidden' });
      button.addEventListener('click', action);
      qa.appendChild(button);
    };
    addQa('wheelQaStart', () => startGame('coop'));
    addQa('wheelQaOpen', () => beginControllerBuild(0, 'visual-check'));
    addQa('wheelQaRight', () => updateBuildWheel(0, 1, 0, true, 'visual-check'));
    addQa('wheelQaRelease', () => updateBuildWheel(0, 1, 0, false, 'visual-check'));
    addQa('wheelQaUpgrade', () => beginControllerBuild(0, 'visual-check'));
    addQa('oathQaStart', () => { startGame('single'); app.state.prepTime = 0; updateUi(); });
    addQa('oathQaThreats', () => {
      if (app.state.status !== 'running') startGame('single');
      app.state.prepTime = 0;
      app.state.enemies.length = 0;
      const threats = [
        Core.spawnEnemy(app.state, 'hexer', 'north'), Core.spawnEnemy(app.state, 'raider', 'north'),
        Core.spawnEnemy(app.state, 'warlord', 'south'), Core.spawnEnemy(app.state, 'brute', 'south')
      ];
      threats.forEach((enemy, index) => {
        enemy.x = 185 + (index % 2) * 42;
        enemy.y = index < 2 ? 236 : 304;
      });
      app.state.spawnClock = 9999;
      app.state.nextSurgeAt = 9999;
      updateUi();
    });
    addQa('oathQaComplete', () => {
      if (app.state.status !== 'running') startGame('single');
      app.state.prepTime = 0;
      for (let index = 1; index < Core.SIEGE_CHAPTERS.length; index += 1) {
        app.state.time = index * Core.CONFIG.oathChapterSeconds - 0.05;
        Core.step(app.state, 0.1);
        app.state.enemies.length = 0;
      }
      app.state.time = Core.CONFIG.oathCompleteAt - 0.05;
      Core.step(app.state, 0.1);
      app.state.enemies.length = 0;
      app.state.spawnClock = 9999;
      app.state.nextSurgeAt = 9999;
      updateUi();
    });
    addQa('oathQaFall', () => {
      if (app.state.status !== 'running') return;
      app.state.sanctumHp = 0;
      Core.step(app.state, 0.05);
      updateUi();
      if (app.state.status === 'over') showGameOver();
    });
    document.body.appendChild(qa);
  }

  fetch('/api/launch-config').then(response => response.ok ? response.json() : null).then(config => {
    if (!config) return;
    app.launch = config;
    if (config.defaultGameMode === 'coop') $('coopButton').classList.add('primary');
  }).catch(() => {});

  setInterval(pollRemoteInputs, 50);
  pollRemoteInputs();

  window.__hearthgate = {
    getState: () => Core.snapshot(app.state),
    start: mode => startGame(mode),
    pause: value => setPaused(value),
    command: (action, side) => towerCommand(action, side),
    build: (slot, type) => Core.build(app.state, slot, type),
    openBuildWheel: (player, source) => beginControllerBuild(Number(player) || 0, source || 'debug'),
    moveBuildWheel: (player, x, y, held, source) => updateBuildWheel(Number(player) || 0, x, y, held, source || 'debug'),
    getBuildWheels: () => app.buildWheels.map(wheel => wheel && Object.assign({}, wheel)),
    getRenderer: () => ({ available: stage3d.available, status: threeCanvas && threeCanvas.dataset.status, paletteSteps: threeCanvas && threeCanvas.dataset.paletteSteps }),
    step: seconds => Core.step(app.state, seconds),
    getControlProfile: () => fetch('/control-profile.json').then(response => response.json())
  };

  updateUi();
  render(performance.now());
  requestAnimationFrame(frame);
})();
