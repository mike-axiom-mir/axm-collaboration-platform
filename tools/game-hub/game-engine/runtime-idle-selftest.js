'use strict';

const assert = require('assert');
const { DEFAULT_IDLE_TIMEOUT_MS, createRuntimeIdleWatchdog, normalizeIdleTimeout } = require('./runtime-idle-policy');

function run() {
  let assertions = 0;
  let now = 1000;
  let intervalCallback = null;
  let timeoutReceipt = null;
  const timer = { unref() {} };
  const watchdog = createRuntimeIdleWatchdog({
    timeoutMs: 1000,
    checkEveryMs: 100,
    now: () => now,
    setIntervalFn: callback => { intervalCallback = callback; return timer; },
    clearIntervalFn: () => {},
    onTimeout: receipt => { timeoutReceipt = receipt; }
  });

  assert.equal(DEFAULT_IDLE_TIMEOUT_MS, 30 * 60 * 1000); assertions++;
  assert.equal(normalizeIdleTimeout('1800000'), 1800000); assertions++;
  assert.equal(normalizeIdleTimeout('bad'), DEFAULT_IDLE_TIMEOUT_MS); assertions++;
  watchdog.start();
  assert.equal(typeof intervalCallback, 'function'); assertions++;
  now = 1750;
  assert.equal(watchdog.check(), false); assertions++;
  assert.equal(watchdog.touch('human-input'), true); assertions++;
  now = 2600;
  assert.equal(watchdog.check(), false); assertions++;
  now = 2750;
  assert.equal(watchdog.check(), true); assertions++;
  assert.equal(timeoutReceipt.last_activity_kind, 'human-input'); assertions++;
  assert.equal(timeoutReceipt.idle_for_ms, 1000); assertions++;
  assert.equal(watchdog.touch('late-input'), false); assertions++;
  return { assertions };
}

if (require.main === module) {
  const result = run();
  console.log(`PASS runtime idle policy: ${result.assertions} assertions`);
}

module.exports = { run };
