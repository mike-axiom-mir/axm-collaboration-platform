'use strict';

const Heartbeat = require('./axm-platform-heartbeat-core');

function create(options) {
  if (!options || typeof options.read !== 'function' || typeof options.write !== 'function') throw new Error('Platform Heartbeat read/write adapters required');
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const timersEnabled = options.timers !== false;
  let timer = null;

  function read() {
    try { return Heartbeat.normalize(options.read()); }
    catch (error) { return Heartbeat.createState(); }
  }
  function write(state) {
    const normalized = Heartbeat.normalize(state);
    options.write(normalized);
    return normalized;
  }
  function cancelTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }
  function schedule() {
    cancelTimer();
    if (!timersEnabled) return;
    const state = read();
    if (!state.config.enabled || !state.nextDueAt) return;
    const delay = Math.max(25, Math.min(2147483647, Date.parse(state.nextDueAt) - now()));
    timer = setTimeout(() => { pump(); schedule(); }, delay);
    if (timer && typeof timer.unref === 'function') timer.unref();
  }
  function pump() {
    const result = Heartbeat.advance(read(), now());
    write(result.state);
    if (result.emitted && typeof options.onBeat === 'function') {
      Promise.resolve().then(() => options.onBeat(result.beat)).catch(error => {
        if (typeof options.onBeatError === 'function') options.onBeatError(error);
      });
    }
    return result;
  }
  function status() {
    pump();
    return Heartbeat.status(read(), now());
  }
  function configure(input) {
    const state = write(Heartbeat.configure(read(), input || {}, input && input.actorId || 'unknown', now()));
    schedule();
    return Heartbeat.status(state, now());
  }
  function manual(input) {
    const result = Heartbeat.manualStep(read(), input && input.actorId || 'local-steward', now());
    write(result.state);
    return { beat: result.beat, status: Heartbeat.status(result.state, now()) };
  }
  function preview(input) { return Heartbeat.preview(read(), input && input.count, now()); }
  function close() { cancelTimer(); }

  let initial = read();
  if (initial.config.enabled && !initial.config.resumeAfterRestart) initial = Heartbeat.configure(initial, { enabled: false }, 'restart-safety', now());
  else if (initial.config.enabled && !initial.nextDueAt) initial = Heartbeat.configure(initial, { enabled: true }, 'startup-hourly-rhythm', now());
  write(initial);
  schedule();
  return { VERSION: Heartbeat.VERSION, status, configure, manual, preview, pump, close };
}

module.exports = { create };
