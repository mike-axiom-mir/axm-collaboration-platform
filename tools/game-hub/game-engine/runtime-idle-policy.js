'use strict';

const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

function normalizeIdleTimeout(value, fallback = DEFAULT_IDLE_TIMEOUT_MS) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(50, Math.round(parsed));
}

function createRuntimeIdleWatchdog(options) {
  const config = options || {};
  const now = typeof config.now === 'function' ? config.now : Date.now;
  const timeoutMs = normalizeIdleTimeout(config.timeoutMs);
  const checkEveryMs = normalizeIdleTimeout(
    config.checkEveryMs,
    Math.min(60 * 1000, Math.max(250, Math.floor(timeoutMs / 30)))
  );
  const setIntervalFn = config.setIntervalFn || setInterval;
  const clearIntervalFn = config.clearIntervalFn || clearInterval;
  const onTimeout = typeof config.onTimeout === 'function' ? config.onTimeout : function () {};
  let lastActivityAt = now();
  let lastActivityKind = 'runtime-start';
  let timer = null;
  let timedOut = false;

  function snapshot(at) {
    const observedAt = Number.isFinite(Number(at)) ? Number(at) : now();
    return {
      schema: 'axm.runtime-idle-state/v1',
      timeout_ms: timeoutMs,
      last_activity_at: new Date(lastActivityAt).toISOString(),
      last_activity_kind: lastActivityKind,
      idle_for_ms: Math.max(0, observedAt - lastActivityAt),
      timed_out: timedOut
    };
  }

  function touch(kind) {
    if (timedOut) return false;
    lastActivityAt = now();
    lastActivityKind = String(kind || 'runtime-activity').slice(0, 160);
    return true;
  }

  function stop() {
    if (timer) clearIntervalFn(timer);
    timer = null;
  }

  function check() {
    const receipt = snapshot();
    if (timedOut || receipt.idle_for_ms < timeoutMs) return false;
    timedOut = true;
    stop();
    onTimeout(Object.assign({}, receipt, { timed_out: true }));
    return true;
  }

  function start() {
    if (timer || timedOut) return api;
    timer = setIntervalFn(check, checkEveryMs);
    if (timer && typeof timer.unref === 'function') timer.unref();
    return api;
  }

  const api = { check, snapshot, start, stop, touch, timeoutMs, checkEveryMs };
  return api;
}

module.exports = { DEFAULT_IDLE_TIMEOUT_MS, createRuntimeIdleWatchdog, normalizeIdleTimeout };
