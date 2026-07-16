'use strict';

const http = require('http');

function assertLoopback(url) {
  const parsed = new URL(url);
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) throw new Error('Workshop heartbeat must remain loopback-only');
  return parsed;
}

function postJson(url, body, timeoutMs) {
  const parsed = assertLoopback(url);
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body));
    const request = http.request({
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname,
      method: 'POST',
      timeout: timeoutMs || 1200,
      headers: { 'content-type': 'application/json', 'content-length': payload.length }
    }, response => {
      response.resume();
      response.on('end', () => response.statusCode >= 200 && response.statusCode < 300 ? resolve(true) : reject(new Error(`Workshop heartbeat HTTP ${response.statusCode}`)));
    });
    request.on('timeout', () => request.destroy(new Error('Workshop heartbeat timed out')));
    request.on('error', reject);
    request.end(payload);
  });
}

function startWorkshopHeartbeat(options = {}) {
  const workshopUrl = String(options.workshopUrl || 'http://127.0.0.1:8788').replace(/\/$/, '');
  const intervalMs = Math.max(5000, Math.min(60000, Number(options.intervalMs) || 10000));
  let timer = null;
  let stopped = false;
  let last = { state: 'not-sent', ok: false, at: null, error: null };

  async function beat(state) {
    if (stopped) return false;
    const at = new Date().toISOString();
    try {
      await postJson(`${workshopUrl}/api/presence/heartbeat`, {
        id: 'mirror-kernel',
        name: 'Mirror',
        kind: 'machine',
        state: state || 'idle',
        location: 'Mirror Seed-0 · machine-native reasoning kernel',
        ttlMs: Math.max(15000, intervalMs * 3)
      }, 1200);
      last = { state: state || 'idle', ok: true, at, error: null };
      return true;
    } catch (error) {
      last = { state: 'workshop-unavailable', ok: false, at, error: String(error.message || error).slice(0, 300) };
      return false;
    }
  }

  beat('active');
  timer = setInterval(() => beat('idle'), intervalMs);
  if (timer.unref) timer.unref();
  return {
    beat,
    status: () => ({ ...last }),
    stop: () => { stopped = true; if (timer) clearInterval(timer); timer = null; }
  };
}

module.exports = { assertLoopback, postJson, startWorkshopHeartbeat };
