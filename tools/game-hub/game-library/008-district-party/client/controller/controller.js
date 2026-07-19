import { AxmVirtualStick } from './axm-game-night-controls.js';

(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const query = new URLSearchParams(location.search);
  const identity = { room: query.get('room') || 'AXM1', sessionId: query.get('session'), seatId: query.get('seat'), token: query.get('token') };
  const input = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, aimActive: false, action: false, attack: false, fire: false, sprint: false, brake: false, inventoryToggle: false, inventoryPrev: false, inventoryNext: false, inventoryActivate: false };
  const inventorySlotNames = ['MELEE', 'RANGED', 'AMMO', 'SHOES', 'BODY', 'HAT', ...Array.from({ length: 12 }, (_, index) => `BAG ${index + 1}`)];
  const pulseKeys = ['fire', 'inventoryToggle', 'inventoryPrev', 'inventoryNext', 'inventoryActivate'];
  const pulseButtonIds = { fire: 'attack', inventoryToggle: 'inventory-toggle', inventoryPrev: 'inventory-prev', inventoryNext: 'inventory-next', inventoryActivate: 'inventory-activate' };
  const pulseGeneration = Object.fromEntries(pulseKeys.map((key) => [key, 0]));
  let seq = 0, lastActor = null, lastWorld = null, sending = false, stateFailures = 0, inventoryWasOpen = false;
  let moveStick = null, aimStick = null;

  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  async function jsonFetch(path, options) {
    const response = await fetch(path, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || data.reason || `HTTP ${response.status}`);
    return data;
  }

  async function bootstrap() {
    if (!identity.sessionId || !identity.seatId || !identity.token) throw new Error('This controller link is missing its local seat identity. Return to the host join board.');
    const p = new URLSearchParams({ roomCode: identity.room, sessionId: identity.sessionId, seatId: identity.seatId, token: identity.token });
    const info = await jsonFetch(`/api/controller-info?${p}`);
    const player = info.player || info;
    $('player-name').textContent = player.displayName || identity.seatId;
    $('party-label').textContent = `${(player.partyId || 'party_a').replace('_', ' ').toUpperCase()} · ${identity.seatId.toUpperCase()}`;
    $('identity').textContent = `${identity.room} · ${identity.seatId} · host validated`;
    if (Number.isSafeInteger(player.acceptedSeq)) seq = Math.max(seq, player.acceptedSeq);
    $('connection').textContent = 'Connected'; $('connection').classList.add('live');
  }

  async function sendInput() {
    if (sending || !identity.sessionId) return;
    sending = true;
    const outboundInput = { ...input };
    const sentPulses = pulseKeys.filter((key) => outboundInput[key]).map((key) => [key, pulseGeneration[key]]);
    try {
      await jsonFetch('/api/input', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomCode: identity.room, sessionId: identity.sessionId, seatId: identity.seatId, token: identity.token, seq: ++seq, input: outboundInput }) });
      $('connection').textContent = 'Connected'; $('connection').classList.add('live');
    } catch (e) { $('connection').textContent = 'Input rejected'; $('connection').classList.remove('live'); }
    finally {
      input.action = false; $('action').classList.remove('pressed');
      sentPulses.forEach(([key, generation]) => {
        if (pulseGeneration[key] !== generation) return;
        input[key] = false;
        $(pulseButtonIds[key]).classList.remove('pressed');
      });
      sending = false;
      if (pulseKeys.some((key) => input[key])) queueMicrotask(sendInput);
    }
  }

  async function pollState() {
    try {
      const p = new URLSearchParams({ roomCode: identity.room, sessionId: identity.sessionId, view: 'controller', party: 'all' });
      const state = await jsonFetch(`/api/state?${p}`);
      const world = state.world || state;
      lastWorld = world;
      lastActor = (world.actors || []).find((a) => a.seatId === identity.seatId);
      if (lastActor) updateReadout(lastActor, world);
      stateFailures = 0;
    } catch (e) {
      if (++stateFailures > 2) { $('connection').textContent = 'Reconnecting'; $('connection').classList.remove('live'); }
    }
  }

  function updateReadout(actor, world) {
    const mission = world.mission || {};
    const economy = world.economy || {};
    const saveComputer = world.groupSaveComputer || {};
    const groupSaveOpen = saveComputer.open === true;
    const controlsGroupSave = groupSaveOpen && saveComputer.controlActorId === actor.id;
    const externalSeat = actor.controller === 'human' || actor.controller === 'adapter';
    $('health').textContent = `${Math.max(0, Math.round(actor.health ?? 0))}/${actor.maxHealth || 100}`;
    $('shield').textContent = `${Math.max(0, Math.round(actor.shield ?? 0))}`;
    $('money').textContent = formatCredits(actor.walletCents);
    $('party-money').textContent = formatCredits(economy.partyFunds?.[actor.partyId] || 0);
    const driving = Boolean(actor.currentVehicleId);
    $('mode').textContent = driving ? (actor.vehicleSeat === 'driver' ? 'DRIVING' : 'PASSENGER') : 'ON FOOT';
    const respawnLeft = actor.respawnAtTick ? 'RESPAWNING' : null;
    $('life-state').textContent = actor.alive === false ? (respawnLeft || 'DOWNED') : (driving ? 'IN VEHICLE' : 'ACTIVE');
    const menuLocked = groupSaveOpen || ['board', 'countdown', 'results'].includes(mission.status);
    $('move-stick-label').textContent = controlsGroupSave
      ? 'SELECT SLOT · LEFT SAVE · RIGHT LOAD'
      : groupSaveOpen ? 'PARTY SAVE PAUSED'
      : ['board', 'results'].includes(mission.status)
      ? 'SELECT OPTION'
      : actor.vehicleSeat === 'driver' ? 'STEER · THROTTLE' : driving ? 'RIDING' : 'MOVE';
    $('aim-stick-label').textContent = groupSaveOpen
      ? 'SAVE COMPUTER · AIM PAUSED'
      : menuLocked
      ? 'AIM PAUSED'
      : actor.vehicleSeat === 'driver' ? 'RELEASE · FIRE FORWARD' : 'AIM · RELEASE TO FIRE';
    $('controller-mission-title').textContent = (mission.title || mission.mode || 'Party House').replaceAll('_', ' ').toUpperCase();
    const inventoryOpen = actor.inventoryOpen === true || actor.inventory?.open === true;
    updateInventoryMode(actor, inventoryOpen, { groupSaveOpen, controlsGroupSave, menuLocked, externalSeat });
    if (!externalSeat) {
      $('connection').textContent = 'Host AI owns saved seat';
      $('connection').classList.remove('live');
      $('mission-hint').textContent = 'This missing saved player was replaced by Host AI when the fixed-roster save loaded.';
    } else if (controlsGroupSave) $('mission-hint').textContent = saveComputer.message || 'Choose one of nine local group save slots.';
    else if (groupSaveOpen) $('mission-hint').textContent = 'Another player is using the Party House save computer. The city is paused.';
    else if (actor.tether?.returnToParty || actor.tether?.level === 'hard') $('mission-hint').textContent = actor.tether?.movementBlocked ? 'HARD RANGE — move back toward your party.' : 'RETURN TO PARTY — you are leaving shared-screen range.';
    else if (inventoryOpen) $('mission-hint').textContent = 'Inventory open — movement and combat are paused for this player.';
    else if (actor.tether?.level === 'soft') $('mission-hint').textContent = 'STAY CLOSE — the shared camera is widening toward its safe range.';
    else if (actor.regeneration?.insideBase) $('mission-hint').textContent = 'PARTY BASE — health regenerates 10 HP/s here; shield does not regenerate.';
    else if (mission.status === 'board') $('mission-hint').textContent = mission.hint || 'Mission board — move up/down, ACTION to choose.';
    else if (mission.status === 'countdown') $('mission-hint').textContent = mission.hint || 'Mission countdown — the whole party will teleport together.';
    else if (mission.phase === 'results' || mission.status === 'results') $('mission-hint').textContent = mission.hint || `Results break · Party score ${mission.partyScore ?? mission.score ?? 0}`;
    else if (actor.carryingPackageId) $('mission-hint').textContent = 'Package secured. Reach a glowing delivery zone.';
    else $('mission-hint').textContent = mission.hint || `Collect at depot · ${mission.deliveries ?? 0}/${mission.deliveryGoal ?? 5} delivered`;
  }

  function formatCredits(cents) {
    const value = Math.max(0, Math.min(99_999_999, Math.round(Number(cents) || 0))) / 100;
    return `DC ${new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
  }

  function inventoryItems(inventory = {}) {
    const equipped = inventory.equipped || inventory.equipment || {};
    return [equipped.melee, equipped.ranged, equipped.ammo, equipped.shoes, equipped.body, equipped.hat, ...Array.from({ length: 12 }, (_, index) => inventory.bag?.[index] ?? null)];
  }

  function inventorySelectedIndex(inventory = {}) {
    if (Number.isInteger(inventory.selectedIndex)) return Math.max(0, Math.min(17, inventory.selectedIndex));
    const cursor = inventory.cursor || {};
    if (cursor.container === 'bag' && Number.isInteger(cursor.index)) return Math.max(6, Math.min(17, cursor.index + 6));
    if (cursor.container === 'equipment') {
      const equipmentIndex = ['melee', 'ranged', 'ammo', 'shoes', 'body', 'hat'].indexOf(cursor.slot);
      if (equipmentIndex >= 0) return equipmentIndex;
    }
    return 0;
  }

  function itemLabel(item) {
    if (!item) return 'EMPTY';
    if (typeof item === 'string') return item;
    const name = item.displayName || item.name || item.itemId || item.id || 'ITEM';
    const quantity = Number.isFinite(item.quantity) ? ` ×${Math.max(0, item.quantity)}` : '';
    return `${name}${quantity}`;
  }

  function updateInventoryMode(actor, inventoryOpen, menu = {}) {
    const inventory = actor.inventory || {};
    const selectedIndex = inventorySelectedIndex(inventory);
    const selected = itemLabel(inventoryItems(inventory)[selectedIndex]);
    $('inventory-state').textContent = inventoryOpen ? `open · ${selectedIndex + 1}/18` : 'closed';
    $('inventory-selection').textContent = `${inventorySlotNames[selectedIndex]} · ${selected}`;
    $('inventory-controls').classList.toggle('hidden', !inventoryOpen);
    $('inventory-toggle').classList.toggle('open', inventoryOpen || menu.controlsGroupSave);
    $('inventory-toggle').querySelector('strong').textContent = menu.controlsGroupSave ? 'CLOSE COMPUTER' : 'INVENTORY';
    document.body.classList.toggle('inventory-open', inventoryOpen);
    moveStick?.setEnabled(menu.externalSeat !== false && !inventoryOpen && (!menu.groupSaveOpen || menu.controlsGroupSave));
    aimStick?.setEnabled(menu.externalSeat !== false && !inventoryOpen && !menu.menuLocked);
    $('action').disabled = menu.externalSeat === false || inventoryOpen || (menu.groupSaveOpen && !menu.controlsGroupSave);
    ['attack', 'sprint', 'brake'].forEach((id) => { $(id).disabled = menu.externalSeat === false || inventoryOpen || menu.groupSaveOpen; });
    $('inventory-toggle').disabled = menu.externalSeat === false || (menu.groupSaveOpen && !menu.controlsGroupSave);
    if (inventoryOpen) {
      if (!inventoryWasOpen) keys.clear();
      resetPlayInput();
    }
    inventoryWasOpen = inventoryOpen;
  }

  function resetPlayInput() {
    Object.assign(input, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, aimActive: false, action: false, attack: false, fire: false, sprint: false, brake: false });
    moveStick?.reset();
    aimStick?.reset();
    ['action', 'attack', 'sprint', 'brake'].forEach((id) => $(id).classList.remove('pressed'));
  }

  moveStick = new AxmVirtualStick({
    element: $('stick'),
    base: $('stick-base'),
    knob: $('stick-knob'),
    onChange: (state) => {
      input.moveX = state.x;
      input.moveY = state.y;
    },
  });
  aimStick = new AxmVirtualStick({
    element: $('aim-stick'),
    base: $('aim-stick-base'),
    knob: $('aim-stick-knob'),
    onChange: (state) => {
      input.aimActive = state.active === true;
      if (state.active && state.magnitude > 0) {
        input.aimX = state.x;
        input.aimY = state.y;
      }
    },
    onRelease: (state) => {
      input.aimActive = false;
      if (state.cancelled) return;
      if (state.magnitude > 0) {
        input.aimX = state.x;
        input.aimY = state.y;
      }
      navigator.vibrate?.(8);
      triggerPulse('fire');
    },
  });

  function bindHold(id, key) {
    const el = $(id);
    const set = (value) => { input[key] = value; el.classList.toggle('pressed', value); };
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); set(true); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((name) => el.addEventListener(name, () => set(false)));
  }
  bindHold('action', 'action'); bindHold('sprint', 'sprint'); bindHold('brake', 'brake');

  function triggerPulse(key) {
    pulseGeneration[key] += 1;
    input[key] = true;
    $(pulseButtonIds[key]).classList.add('pressed');
    sendInput();
  }

  function bindPulse(id, key) {
    $(id).addEventListener('pointerdown', (event) => { event.preventDefault(); triggerPulse(key); });
  }
  bindPulse('inventory-toggle', 'inventoryToggle');
  bindPulse('attack', 'fire');
  bindPulse('inventory-prev', 'inventoryPrev');
  bindPulse('inventory-next', 'inventoryNext');
  bindPulse('inventory-activate', 'inventoryActivate');

  const keys = new Set();
  function applyKeys() {
    if (lastActor && (lastActor.inventoryOpen === true || lastActor.inventory?.open === true)) { resetPlayInput(); return; }
    const saveComputer = lastWorld?.groupSaveComputer || {};
    if (saveComputer.open) {
      const controls = saveComputer.controlActorId === lastActor?.id && ['human', 'adapter'].includes(lastActor?.controller);
      input.moveX = controls ? (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) : 0;
      input.moveY = controls ? (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0) : 0;
      input.aimX = 0; input.aimY = 0; input.aimActive = false;
      input.action = controls && keys.has('KeyE'); input.attack = false; input.fire = false; input.sprint = false; input.brake = false;
      return;
    }
    input.moveX = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    input.moveY = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0);
    input.aimX = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
    input.aimY = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
    input.aimActive = Math.hypot(input.aimX, input.aimY) > 0;
    input.action = keys.has('KeyE'); input.attack = keys.has('Space'); input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight'); input.brake = keys.has('ControlLeft') || keys.has('ControlRight');
  }
  addEventListener('keydown', (e) => {
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter'].includes(e.code)) e.preventDefault();
    const inventoryKey = { KeyI: 'inventoryToggle', BracketLeft: 'inventoryPrev', BracketRight: 'inventoryNext', Enter: 'inventoryActivate' }[e.code];
    if (inventoryKey) { if (!e.repeat) triggerPulse(inventoryKey); return; }
    if (e.repeat && e.code === 'KeyE') return;
    keys.add(e.code); applyKeys();
  });
  addEventListener('keyup', (e) => { keys.delete(e.code); applyKeys(); });
  addEventListener('blur', () => {
    keys.clear();
    Object.assign(input, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, aimActive: false, action: false, attack: false, fire: false, sprint: false, brake: false, inventoryToggle: false, inventoryPrev: false, inventoryNext: false, inventoryActivate: false });
    moveStick.reset();
    aimStick.reset();
    pulseKeys.forEach((key) => $(pulseButtonIds[key]).classList.remove('pressed'));
  });

  bootstrap().catch((e) => { $('connection').textContent = 'Invalid link'; $('mission-hint').textContent = e.message; });
  setInterval(sendInput, 50); setInterval(pollState, 250); pollState();
})();
