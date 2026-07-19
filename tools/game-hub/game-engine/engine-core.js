'use strict';

const DEFAULT_TICK_RATE = 30;
const DEFAULT_FPS = 30;
const MAX_SEATS = 8;
const DEFAULT_VISIBLE_SEATS = 4;
const OPTIONAL_EXTRA_SEATS = 4;
const NON_PLAYING_SEAT_TYPES = new Set(['empty', 'closed', 'spectator']);

function nowIso() {
  return new Date().toISOString();
}

function createSeat(slot) {
  const team = slot <= 4 ? 'team_a' : 'team_b';
  return {
    id: `seat_${slot}`,
    slot,
    group: team,
    visible_by_default: slot <= DEFAULT_VISIBLE_SEATS,
    type: 'empty',
    display_name: '',
    connection: null,
    adapter_id: null,
    ready: false,
    ready_order: null,
    play_status: 'lobby'
  };
}

function createDefaultSeatTable() {
  return Array.from({ length: MAX_SEATS }, (_, i) => createSeat(i + 1));
}

function createEngineState() {
  return {
    engine_id: 'axm-game-engine-v0',
    status: 'lobby',
    tick_rate: DEFAULT_TICK_RATE,
    fps: DEFAULT_FPS,
    tick: 0,
    created_at: nowIso(),
    updated_at: nowIso(),
    lobby: {
      default_visible_seats: DEFAULT_VISIBLE_SEATS,
      optional_extra_seats: OPTIONAL_EXTRA_SEATS,
      max_seats: MAX_SEATS,
      seats: createDefaultSeatTable()
    },
    session: {
      session_id: null,
      phase: 'LOBBY',
      selected_game: null,
      selected_players: [],
      skipped_players: [],
      started_at: null,
      ended_at: null
    },
    input_buffer: [],
    result_summary: null,
    rules: {
      local_authoritative_state: true,
      clients_send_input_intentions: true,
      no_hidden_ai: true,
      visible_adapter_seats: true,
      return_to_lobby_after_game: true
    }
  };
}

function getSeat(state, seatId) {
  return state.lobby.seats.find(seat => seat.id === seatId) || null;
}

function assignSeat(state, seatId, patch) {
  const seat = getSeat(state, seatId);
  if (!seat) throw new Error(`Unknown seat: ${seatId}`);
  const allowedTypes = new Set(['empty', 'human', 'adapter', 'ai', 'spectator', 'closed', 'skip', 'next-round']);
  if (patch.type && !allowedTypes.has(patch.type)) throw new Error(`Invalid seat type: ${patch.type}`);
  const typeChanged = patch.type && patch.type !== seat.type;
  Object.assign(seat, patch, { updated_at: nowIso() });
  /* A seat identity/type change invalidates its old consent. In particular,
     an emptied seat may never retain a ghost ready flag that another game
     later interprets as a player. The host must ready the new occupant. */
  if (typeChanged || NON_PLAYING_SEAT_TYPES.has(seat.type)) {
    seat.ready = false;
    seat.ready_order = null;
    seat.play_status = 'lobby';
  }
  state.updated_at = nowIso();
  return seat;
}

function readySeat(state, seatId, ready) {
  const seat = getSeat(state, seatId);
  if (!seat) throw new Error(`Unknown seat: ${seatId}`);
  if (ready && NON_PLAYING_SEAT_TYPES.has(seat.type)) {
    throw new Error(`Seat cannot ready while type is ${seat.type}: ${seatId}`);
  }
  seat.ready = !!ready;
  if (seat.ready && seat.ready_order === null) {
    const currentOrders = state.lobby.seats.map(s => s.ready_order).filter(n => Number.isInteger(n));
    seat.ready_order = currentOrders.length ? Math.max(...currentOrders) + 1 : 1;
  }
  if (!seat.ready) {
    seat.ready_order = null;
    seat.play_status = 'lobby';
  }
  state.updated_at = nowIso();
  return seat;
}

function isEligiblePlayerSeat(seat, allowedSeatTypes) {
  if (!seat.ready) return false;
  if (seat.type === 'closed' || seat.type === 'empty' || seat.type === 'spectator') return false;
  return allowedSeatTypes.includes(seat.type);
}

function selectPlayersByReadyOrder(state, gameManifest) {
  const maxPlayers = Number(gameManifest.max_players || 4);
  const allowedSeatTypes = Array.isArray(gameManifest.allowed_seat_types)
    ? gameManifest.allowed_seat_types
    : ['human', 'adapter', 'ai'];

  const eligible = state.lobby.seats
    .filter(seat => isEligiblePlayerSeat(seat, allowedSeatTypes))
    .sort((a, b) => (a.ready_order || 999999) - (b.ready_order || 999999));

  const selected = eligible.slice(0, maxPlayers);
  const skipped = eligible.slice(maxPlayers);

  for (const seat of state.lobby.seats) {
    if (selected.includes(seat)) seat.play_status = 'playing';
    else if (skipped.includes(seat)) seat.play_status = 'next-round';
    else if (seat.ready) seat.play_status = 'lobby-ready';
    else seat.play_status = 'lobby';
  }

  state.session.selected_players = selected.map(toPublicSeat);
  state.session.skipped_players = skipped.map(toPublicSeat);
  state.updated_at = nowIso();

  return {
    selected_players: state.session.selected_players,
    skipped_players: state.session.skipped_players
  };
}

function toPublicSeat(seat) {
  return {
    seat_id: seat.id,
    slot: seat.slot,
    type: seat.type,
    display_name: seat.display_name,
    adapter_id: seat.adapter_id || null
  };
}

function startSession(state, gameManifest) {
  if (state.session && state.session.phase === 'RUNNING') {
    throw new Error('A game session is already running. End it before starting another.');
  }
  const minPlayers = Number(gameManifest.min_players || 1);
  const maxPlayers = Number(gameManifest.max_players || 4);
  const allowedSeatTypes = Array.isArray(gameManifest.allowed_seat_types)
    ? gameManifest.allowed_seat_types
    : ['human', 'adapter', 'ai'];
  const eligibleCount = state.lobby.seats.filter(seat => isEligiblePlayerSeat(seat, allowedSeatTypes)).slice(0, maxPlayers).length;
  if (eligibleCount < minPlayers) {
    throw new Error(`Not enough ready players. Need ${minPlayers}, got ${eligibleCount}.`);
  }
  const selection = selectPlayersByReadyOrder(state, gameManifest);
  state.status = 'running';
  state.tick = 0;
  state.session = Object.assign(state.session, {
    session_id: `session-${Date.now()}`,
    phase: 'RUNNING',
    selected_game: {
      game_id: gameManifest.game_id,
      name: gameManifest.name,
      version: gameManifest.version || '0.1.0'
    },
    started_at: nowIso(),
    ended_at: null
  });
  state.result_summary = null;
  state.updated_at = nowIso();
  return state.session;
}

function queueInput(state, inputPacket) {
  if (state.session.phase !== 'RUNNING') throw new Error('Cannot queue input when session is not running.');
  const seat = getSeat(state, inputPacket.seat_id);
  if (!seat || seat.play_status !== 'playing') throw new Error('Input rejected: seat is not playing.');
  state.input_buffer.push({
    session_id: state.session.session_id,
    seat_id: inputPacket.seat_id,
    tick: state.tick,
    input: inputPacket.input || {},
    received_at: nowIso()
  });
  return { queued: true, buffer_size: state.input_buffer.length };
}

function engineTick(state, gameStep) {
  if (state.session.phase !== 'RUNNING') return state;
  state.tick += 1;
  const inputs = state.input_buffer.splice(0, state.input_buffer.length);
  if (typeof gameStep === 'function') {
    gameStep(state, inputs);
  }
  state.updated_at = nowIso();
  return state;
}

function endSession(state, summary) {
  state.status = 'lobby';
  state.session.phase = 'ENDED';
  state.session.ended_at = nowIso();
  state.result_summary = Object.assign({
    session_id: state.session.session_id,
    game_id: state.session.selected_game ? state.session.selected_game.game_id : null,
    status: 'ended',
    duration_ticks: state.tick,
    ended_at: nowIso()
  }, summary || {});
  for (const seat of state.lobby.seats) {
    if (seat.play_status === 'playing' || seat.play_status === 'next-round') {
      seat.play_status = 'lobby';
      seat.ready = false;
      seat.ready_order = null;
    }
  }
  state.session.phase = 'LOBBY';
  state.session.selected_game = null;
  state.session.selected_players = [];
  state.session.skipped_players = [];
  state.tick = 0;
  state.updated_at = nowIso();
  return state.result_summary;
}

module.exports = {
  DEFAULT_TICK_RATE,
  DEFAULT_FPS,
  MAX_SEATS,
  DEFAULT_VISIBLE_SEATS,
  OPTIONAL_EXTRA_SEATS,
  NON_PLAYING_SEAT_TYPES,
  createEngineState,
  assignSeat,
  readySeat,
  selectPlayersByReadyOrder,
  startSession,
  queueInput,
  engineTick,
  endSession
};
