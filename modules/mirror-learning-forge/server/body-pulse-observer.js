'use strict';

const ENDPOINT = process.env.AXM_BODY_PULSE_URL || 'http://127.0.0.1:8788/api/body-pulse';
let cache = { at: 0, status: null };

/* Body Pulse samples Windows CPU, memory, GPU thermal and battery state. On
   this laptop the read-only sample can legitimately take over 500 ms, so a
   short network-style timeout made a healthy local body look unavailable. */
async function observe({ maxAgeMs = 5000, timeoutMs = 3000 } = {}) {
  if (Date.now() - cache.at < maxAgeMs) return cache.status;
  try {
    const response = await fetch(ENDPOINT, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error('body pulse status ' + response.status);
    const payload = await response.json();
    cache = { at: Date.now(), status: payload && payload.status || null };
    return cache.status;
  } catch (_error) {
    cache = { at: Date.now(), status: null };
    return null;
  }
}

function resetCache() { cache = { at: 0, status: null }; }

module.exports = { observe, resetCache, ENDPOINT };
