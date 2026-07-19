'use strict';

const { TICK_RATE } = require('../shared/constants');
const { GROUP_SAVE_SLOT_COUNT, sameRoster } = require('./group-save-store');

const SAVE_COMPUTER_INTERACTION_DISTANCE = 54;
const SAVE_CONFIRM_TICKS = TICK_RATE * 5;

function terminalCentre(terminal) {
  if (!terminal) return null;
  const width = Number(terminal.width ?? terminal.w) || 0;
  const height = Number(terminal.height ?? terminal.h) || 0;
  return {
    x: Number(terminal.x) + width / 2,
    y: Number(terminal.y) + height / 2,
  };
}

function normalizedTerminal(staticMap) {
  const raw = staticMap?.saveTerminals?.[0];
  if (!raw) return null;
  return {
    id: typeof raw.id === 'string' ? raw.id : 'party-house-save-computer',
    label: typeof raw.name === 'string' ? raw.name : 'GROUP SAVE COMPUTER',
    x: Number(raw.x) || 0,
    y: Number(raw.y) || 0,
    width: Math.max(18, Number(raw.width ?? raw.w) || 44),
    height: Math.max(18, Number(raw.height ?? raw.h) || 34),
    interactionDistance: Math.max(30, Number(raw.interactionDistance) || SAVE_COMPUTER_INTERACTION_DISTANCE),
  };
}

function createGroupSaveComputerState(staticMap, catalog = []) {
  const terminal = normalizedTerminal(staticMap);
  const safeCatalog = Array.from({ length: GROUP_SAVE_SLOT_COUNT }, (_, index) => {
    const supplied = catalog.find((entry) => entry.slot === index + 1);
    return supplied ? { ...supplied } : { slot: index + 1, status: 'empty' };
  });
  return {
    available: Boolean(terminal),
    terminal,
    open: false,
    paused: false,
    controlActorId: null,
    operation: 'save',
    selectedSlot: 1,
    navigationHeld: { x: false, y: false },
    confirmation: null,
    busy: false,
    pendingOperation: null,
    catalog: safeCatalog,
    message: terminal ? 'Use ACTION at the Party House computer.' : 'Save computer unavailable on this map.',
    messageUntilTick: 0,
  };
}

function isGroupSaveMenuOpen(world) {
  return world?.groupSaveComputer?.open === true;
}

function isNearSaveTerminal(world, actor) {
  const state = world?.groupSaveComputer;
  const centre = terminalCentre(state?.terminal);
  if (!centre || !actor?.position) return false;
  return Math.hypot(actor.position.x - centre.x, actor.position.y - centre.y)
    <= (state.terminal.interactionDistance || SAVE_COMPUTER_INTERACTION_DISTANCE);
}

function canOpenGroupSaveComputer(world, actor) {
  if (!world?.groupSaveComputer?.available) return { ok: false, reason: 'save-computer-unavailable' };
  if (world.territory?.enabled || world.mode === 'district_dominion') return { ok: false, reason: 'save-computer-coop-only' };
  if (world.mission?.status !== 'base') return { ok: false, reason: 'save-computer-base-only' };
  if (!actor?.alive) return { ok: false, reason: 'actor-not-alive' };
  if (!['human', 'adapter'].includes(actor.controller)) return { ok: false, reason: 'save-computer-external-controller-required' };
  if (!isNearSaveTerminal(world, actor)) return { ok: false, reason: 'save-computer-too-far' };
  return { ok: true };
}

function closeGroupSaveComputer(world, reason = 'closed') {
  const state = world?.groupSaveComputer;
  if (!state) return { ok: false, reason: 'save-computer-unavailable' };
  state.open = false;
  state.paused = false;
  state.busy = false;
  state.controlActorId = null;
  state.confirmation = null;
  state.navigationHeld = { x: false, y: false };
  state.message = reason === 'back' ? 'Save computer closed.' : state.message;
  state.messageUntilTick = world.tick + TICK_RATE * 3;
  for (const actor of Object.values(world.actors || {})) {
    actor.velocity = { x: 0, y: 0 };
  }
  return { ok: true, kind: 'save-computer-closed', reason };
}

function openGroupSaveComputer(world, actor) {
  const check = canOpenGroupSaveComputer(world, actor);
  if (!check.ok) return check;
  const state = world.groupSaveComputer;
  state.open = true;
  state.paused = true;
  state.controlActorId = actor.id;
  state.operation = 'save';
  state.selectedSlot = Math.max(1, Math.min(GROUP_SAVE_SLOT_COUNT, Number(state.selectedSlot) || 1));
  state.navigationHeld = { x: false, y: false };
  state.confirmation = null;
  state.busy = false;
  state.pendingOperation = null;
  state.message = 'LEFT: SAVE · RIGHT: LOAD · UP/DOWN: SLOT · ACTION: SELECT · INVENTORY: CLOSE';
  state.messageUntilTick = 0;
  for (const candidate of Object.values(world.actors || {})) {
    candidate.inventoryOpen = false;
    candidate.velocity = { x: 0, y: 0 };
  }
  return { ok: true, kind: 'save-computer-opened', actorId: actor.id };
}

function rosterForWorld(world) {
  const seatSlots = Object.values(world.actors || {}).map((actor) => Number(actor.slot)).sort((a, b) => a - b);
  return { seatCount: seatSlots.length, seatSlots };
}

function selectedCatalogEntry(state) {
  return state.catalog.find((entry) => entry.slot === state.selectedSlot)
    || { slot: state.selectedSlot, status: 'empty' };
}

function armOrQueueOperation(world, actor) {
  const state = world.groupSaveComputer;
  if (state.busy) return { ok: false, reason: 'save-computer-busy' };
  const operation = state.operation;
  const slot = state.selectedSlot;
  const entry = selectedCatalogEntry(state);
  if (operation === 'load' && entry.status !== 'ready') {
    state.confirmation = null;
    state.message = entry.status === 'corrupt'
      ? `SLOT ${slot} IS CORRUPT · SAVE OVER IT OR CHOOSE ANOTHER SLOT`
      : `SLOT ${slot} IS EMPTY · NOTHING TO LOAD`;
    return { ok: false, reason: entry.status === 'corrupt' ? 'save-corrupt' : 'save-empty' };
  }
  if (operation === 'save' && entry.status === 'ready' && !sameRoster(entry, rosterForWorld(world))) {
    state.confirmation = null;
    state.message = `SLOT ${slot} IS LOCKED TO ${entry.seatCount} SAVED SEATS · USE ANOTHER SLOT`;
    return { ok: false, reason: 'save-roster-locked' };
  }
  const armed = state.confirmation;
  if (!armed || armed.operation !== operation || armed.slot !== slot || world.tick > armed.expiresAtTick) {
    state.confirmation = { operation, slot, armedAtTick: world.tick, expiresAtTick: world.tick + SAVE_CONFIRM_TICKS };
    state.message = operation === 'save'
      ? `${entry.status === 'ready' ? 'OVERWRITE' : 'CREATE'} SLOT ${slot}? PRESS ACTION AGAIN · ROSTER STAYS ${rosterForWorld(world).seatCount} SEATS`
      : `LOAD SLOT ${slot}? PRESS ACTION AGAIN · MISSING CONNECTED SEATS BECOME HOST AI`;
    return { ok: true, kind: 'save-operation-armed', operation, slot };
  }
  state.busy = true;
  state.confirmation = null;
  state.pendingOperation = { operation, slot, requestedByActorId: actor.id, requestedAtTick: world.tick };
  state.message = operation === 'save' ? `SAVING SLOT ${slot}…` : `LOADING SLOT ${slot}…`;
  return { ok: true, kind: 'save-operation-queued', operation, slot };
}

function consumePulse(actor, field) {
  actor.input[field] = false;
  if (actor.pendingPulses) actor.pendingPulses[field] = false;
}

function updateAxisNavigation(world, actor) {
  const state = world.groupSaveComputer;
  const moveX = Number(actor.input?.moveX) || 0;
  const moveY = Number(actor.input?.moveY) || 0;
  if (Math.abs(moveX) < 0.25) state.navigationHeld.x = false;
  if (Math.abs(moveY) < 0.25) state.navigationHeld.y = false;
  if (Math.abs(moveX) >= 0.55 && !state.navigationHeld.x) {
    state.operation = moveX < 0 ? 'save' : 'load';
    state.navigationHeld.x = true;
    state.confirmation = null;
    state.message = state.operation === 'save' ? 'SAVE MODE · ACTION TWICE TO CONFIRM' : 'LOAD MODE · MISSING SAVED SEATS BECOME HOST AI';
  }
  if (Math.abs(moveY) >= 0.55 && !state.navigationHeld.y) {
    const direction = moveY > 0 ? 1 : -1;
    state.selectedSlot = ((state.selectedSlot - 1 + direction + GROUP_SAVE_SLOT_COUNT) % GROUP_SAVE_SLOT_COUNT) + 1;
    state.navigationHeld.y = true;
    state.confirmation = null;
    const entry = selectedCatalogEntry(state);
    state.message = entry.status === 'ready'
      ? `SLOT ${entry.slot} · ${entry.seatCount} SAVED SEATS · ${state.operation.toUpperCase()} MODE`
      : `SLOT ${entry.slot} · ${entry.status.toUpperCase()} · ${state.operation.toUpperCase()} MODE`;
  }
}

function pauseActorsForSaveMenu(world) {
  for (const actor of Object.values(world.actors || {})) {
    actor.velocity = { x: 0, y: 0 };
    actor.input.attack = false;
    actor.input.fire = false;
    actor.input.sprint = false;
    actor.input.brake = false;
    actor.fireQueuedUntilTick = null;
  }
}

function updateGroupSaveComputer(world) {
  const state = world?.groupSaveComputer;
  if (!state?.open) return { open: false };
  const actor = world.actors?.[state.controlActorId];
  if (!actor?.alive) return closeGroupSaveComputer(world, 'controller-unavailable');
  pauseActorsForSaveMenu(world);
  if (actor.input?.inventoryToggle) {
    consumePulse(actor, 'inventoryToggle');
    return closeGroupSaveComputer(world, 'back');
  }
  updateAxisNavigation(world, actor);
  if (actor.input?.action) {
    consumePulse(actor, 'action');
    return armOrQueueOperation(world, actor);
  }
  if (state.confirmation && world.tick > state.confirmation.expiresAtTick) {
    state.confirmation = null;
    state.message = 'CONFIRMATION EXPIRED · PRESS ACTION TO ARM AGAIN';
  }
  return { open: true };
}

function interactWithGroupSaveComputer(world, actor) {
  if (world?.groupSaveComputer?.open) {
    if (world.groupSaveComputer.controlActorId !== actor?.id) return { ok: false, reason: 'save-computer-in-use' };
    return armOrQueueOperation(world, actor);
  }
  return openGroupSaveComputer(world, actor);
}

function publicGroupSaveComputer(state) {
  if (!state) return null;
  return {
    available: state.available === true,
    terminal: state.terminal ? { ...state.terminal } : null,
    open: state.open === true,
    paused: state.paused === true,
    controlActorId: state.controlActorId || null,
    operation: state.operation === 'load' ? 'load' : 'save',
    selectedSlot: Number(state.selectedSlot) || 1,
    confirmation: state.confirmation ? { operation: state.confirmation.operation, slot: state.confirmation.slot } : null,
    busy: state.busy === true,
    catalog: state.catalog.map((entry) => ({ ...entry, seatSlots: entry.seatSlots ? [...entry.seatSlots] : undefined })),
    message: state.message || '',
    messageUntilTick: Number(state.messageUntilTick) || 0,
  };
}

module.exports = {
  SAVE_COMPUTER_INTERACTION_DISTANCE,
  SAVE_CONFIRM_TICKS,
  canOpenGroupSaveComputer,
  closeGroupSaveComputer,
  createGroupSaveComputerState,
  interactWithGroupSaveComputer,
  isGroupSaveMenuOpen,
  isNearSaveTerminal,
  openGroupSaveComputer,
  pauseActorsForSaveMenu,
  publicGroupSaveComputer,
  rosterForWorld,
  terminalCentre,
  updateGroupSaveComputer,
};
