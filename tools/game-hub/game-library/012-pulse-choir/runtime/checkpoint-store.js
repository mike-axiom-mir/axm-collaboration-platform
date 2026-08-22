'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHECKPOINT_SCHEMA = 'axm.pulse-choir-checkpoint/v1';
const STATE_SCHEMA = 'axm.pulse-choir-state/v1';
const SHOW_SCHEMA = 'axm.pulse-choir-show-arc/v1';
const GAME_ID = '012-pulse-choir';
const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_SAVE_INTERVAL_MS = 500;
const MAX_CHECKPOINT_BYTES = 2 * 1024 * 1024;
const VALID_PHASES = new Set(['lobby', 'countdown', 'playing', 'results']);

function finite(value) {
  return Number.isFinite(Number(value));
}

function rosterShape(roster) {
  return (Array.isArray(roster) ? roster : []).map(seat => ({
    id: String(seat.id || ''),
    slot: Number(seat.slot || 0),
    seatId: String(seat.seatId || seat.seat_id || ''),
    name: String(seat.name || seat.display_name || ''),
    type: seat.type === 'ai' ? 'ai' : 'human'
  })).sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id));
}

function rosterFingerprint(roster) {
  return crypto.createHash('sha256').update(JSON.stringify(rosterShape(roster))).digest('hex');
}

function rosterFromState(state) {
  if (!state || !state.players || typeof state.players !== 'object') return [];
  return Object.values(state.players).map(player => ({
    id: player.id,
    slot: Number(String(player.id || '').replace(/\D/g, '')),
    seatId: player.seatId,
    name: player.name,
    type: player.type
  }));
}

function validateState(state, expectedFingerprint) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return 'state-not-object';
  if (state.schema !== STATE_SCHEMA || state.gameId !== GAME_ID) return 'state-schema';
  if (!VALID_PHASES.has(state.phase)) return 'state-phase';
  if (!finite(state.clockMs) || !finite(state.revision) || Number(state.revision) < 0) return 'state-clock';
  if (!state.players || typeof state.players !== 'object' || Array.isArray(state.players)) return 'state-players';
  const players = Object.values(state.players);
  if (!players.length || players.length > 4) return 'state-player-count';
  if (players.some(player => !player || typeof player !== 'object' || !player.id || !finite(player.lastSequence))) return 'state-player-shape';
  if (rosterFingerprint(rosterFromState(state)) !== expectedFingerprint) return 'roster-mismatch';
  if (!state.show || state.show.schema !== SHOW_SCHEMA || !Array.isArray(state.show.history) || state.show.history.length > 6) return 'state-show';
  if (!state.setlist || state.setlist.schema !== 'axm.pulse-choir-live-setlist/v1' || !Array.isArray(state.setlist.acts)) return 'state-setlist';
  if (!Array.isArray(state.beats) || !Array.isArray(state.events) || !Array.isArray(state.inputLedger) || !Array.isArray(state.pulseLedger)) return 'state-lists';
  return null;
}

function shiftDeadline(value, delta) {
  return finite(value) && Number(value) > 0 ? Number(value) + delta : value;
}

function restoreState(state, now) {
  const restored = JSON.parse(JSON.stringify(state));
  const previousClock = Number(restored.clockMs || now);
  const delta = Math.max(0, Number(now) - previousClock);
  restored.phaseEndsAt = shiftDeadline(restored.phaseEndsAt, delta);
  restored.roundEndsAt = shiftDeadline(restored.roundEndsAt, delta);
  restored.nextGlitchAt = shiftDeadline(restored.nextGlitchAt, delta);
  if (restored.harmony) restored.harmony.expiresAt = shiftDeadline(restored.harmony.expiresAt, delta);
  if (restored.core) restored.core.glowUntil = shiftDeadline(restored.core.glowUntil, delta);
  Object.values(restored.players || {}).forEach(player => {
    player.input = { x: 0, y: 0, expiresAt: 0 };
    player.vx = 0;
    player.vy = 0;
    player.pulseBufferedUntil = 0;
    player.stunnedUntil = shiftDeadline(player.stunnedUntil, delta);
    if (player.ai) player.ai.nextDecisionAt = shiftDeadline(player.ai.nextDecisionAt, delta);
  });
  if (restored.sync) {
    restored.sync.openedAt = shiftDeadline(restored.sync.openedAt, delta);
    restored.sync.endsAt = shiftDeadline(restored.sync.endsAt, delta);
    if (Array.isArray(restored.sync.pulses)) {
      restored.sync.pulses.forEach(pulse => { pulse.at = shiftDeadline(pulse.at, delta); });
    }
  }
  if (restored.glitch) {
    restored.glitch.warningUntil = shiftDeadline(restored.glitch.warningUntil, delta);
    restored.glitch.activeUntil = shiftDeadline(restored.glitch.activeUntil, delta);
  }
  if (restored.setlist) {
    restored.setlist.advanceAt = shiftDeadline(restored.setlist.advanceAt, delta);
    (restored.setlist.acts || []).forEach(act => {
      if (act.status === 'active') {
        act.startedAt = shiftDeadline(act.startedAt, delta);
        act.endsAt = shiftDeadline(act.endsAt, delta);
      }
    });
  }
  restored.clockMs = Number(now);
  if (restored.phase === 'playing' && finite(restored.roundEndsAt)) {
    restored.timeLeftMs = Math.max(0, Number(restored.roundEndsAt) - Number(now));
  }
  return restored;
}

function parsePositive(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createCheckpointStore(options) {
  const settings = options || {};
  const env = settings.env || process.env;
  const clock = typeof settings.clock === 'function' ? settings.clock : () => Date.now();
  const fingerprint = rosterFingerprint(settings.roster || []);
  const disabled = settings.disabled === true || /^(?:0|false|off)$/i.test(String(env.PULSE_CHOIR_CHECKPOINT || ''));
  const ttlMs = parsePositive(settings.ttlMs === undefined ? env.PULSE_CHOIR_RECOVERY_TTL_MS : settings.ttlMs, DEFAULT_TTL_MS);
  const saveIntervalMs = parsePositive(settings.saveIntervalMs === undefined ? env.PULSE_CHOIR_SAVE_INTERVAL_MS : settings.saveIntervalMs, DEFAULT_SAVE_INTERVAL_MS);
  const filePath = path.resolve(String(settings.filePath || env.PULSE_CHOIR_STATE_FILE || path.join(env.PULSE_CHOIR_DATA_DIR || path.join(os.tmpdir(), 'axm-pulse-choir'), 'show-' + fingerprint.slice(0, 16) + '.json')));
  const publicState = {
    schema: CHECKPOINT_SCHEMA,
    status: disabled ? 'disabled' : 'fresh',
    restoredAt: null,
    sourceSavedAt: null,
    sourceAgeMs: null,
    lastSavedAt: null,
    lastError: null
  };
  let lastSaveAttemptAt = -Infinity;

  function info() {
    return Object.assign({}, publicState);
  }

  function load() {
    if (disabled) return { state: null, recovery: info() };
    if (!fs.existsSync(filePath)) return { state: null, recovery: info() };
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_CHECKPOINT_BYTES) throw new Error('checkpoint-size');
      const envelope = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!envelope || envelope.schema !== CHECKPOINT_SCHEMA || envelope.gameId !== GAME_ID) throw new Error('checkpoint-schema');
      if (envelope.rosterFingerprint !== fingerprint) {
        publicState.status = 'roster-mismatch';
        return { state: null, recovery: info() };
      }
      if (!finite(envelope.savedAt)) throw new Error('checkpoint-time');
      const ageMs = Number(clock()) - Number(envelope.savedAt);
      if (ageMs > ttlMs) {
        publicState.status = 'expired';
        publicState.sourceSavedAt = Number(envelope.savedAt);
        publicState.sourceAgeMs = ageMs;
        return { state: null, recovery: info() };
      }
      if (ageMs < -5 * 60 * 1000) throw new Error('checkpoint-future');
      const validation = validateState(envelope.state, fingerprint);
      if (validation === 'roster-mismatch') {
        publicState.status = 'roster-mismatch';
        return { state: null, recovery: info() };
      }
      if (validation) throw new Error(validation);
      const now = Number(clock());
      publicState.status = 'restored';
      publicState.restoredAt = now;
      publicState.sourceSavedAt = Number(envelope.savedAt);
      publicState.sourceAgeMs = Math.max(0, ageMs);
      return { state: restoreState(envelope.state, now), recovery: info() };
    } catch (error) {
      publicState.status = error instanceof SyntaxError ? 'corrupt' : 'invalid';
      publicState.lastError = String(error && error.message || 'checkpoint-read-failed').slice(0, 120);
      return { state: null, recovery: info() };
    }
  }

  function save(state, force) {
    if (disabled) return false;
    const now = Number(clock());
    if (!force && now - lastSaveAttemptAt < saveIntervalMs) return false;
    lastSaveAttemptAt = now;
    const validation = validateState(state, fingerprint);
    if (validation) {
      publicState.lastError = validation;
      return false;
    }
    const envelope = {
      schema: CHECKPOINT_SCHEMA,
      gameId: GAME_ID,
      savedAt: now,
      sessionId: String(env.AXM_GAME_SESSION_ID || 'standalone').slice(0, 120),
      rosterFingerprint: fingerprint,
      roster: rosterShape(settings.roster || []),
      state
    };
    const serialized = JSON.stringify(envelope);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_CHECKPOINT_BYTES) {
      publicState.lastError = 'checkpoint-size';
      return false;
    }
    const directory = path.dirname(filePath);
    const temporary = filePath + '.tmp-' + process.pid + '-' + crypto.randomBytes(4).toString('hex');
    try {
      fs.mkdirSync(directory, { recursive: true });
      const descriptor = fs.openSync(temporary, 'wx');
      try {
        fs.writeFileSync(descriptor, serialized, 'utf8');
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
      fs.renameSync(temporary, filePath);
      publicState.lastSavedAt = now;
      publicState.lastError = null;
      return true;
    } catch (error) {
      publicState.lastError = String(error && error.message || 'checkpoint-write-failed').slice(0, 120);
      try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch (_) {}
      return false;
    }
  }

  function clear() {
    if (disabled) return false;
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      publicState.status = 'fresh';
      publicState.restoredAt = null;
      publicState.sourceSavedAt = null;
      publicState.sourceAgeMs = null;
      publicState.lastSavedAt = null;
      publicState.lastError = null;
      lastSaveAttemptAt = -Infinity;
      return true;
    } catch (error) {
      publicState.lastError = String(error && error.message || 'checkpoint-clear-failed').slice(0, 120);
      return false;
    }
  }

  return { clear, filePath, fingerprint, info, load, save, ttlMs };
}

module.exports = {
  CHECKPOINT_SCHEMA,
  DEFAULT_SAVE_INTERVAL_MS,
  DEFAULT_TTL_MS,
  MAX_CHECKPOINT_BYTES,
  createCheckpointStore,
  restoreState,
  rosterFingerprint,
  rosterShape,
  validateState
};
