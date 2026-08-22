'use strict';

const http = require('http');

const GAME_ID = '012-pulse-choir';
const HANDBACK_SCHEMA = 'axm.pulse-choir-hub-handback/v1';
const RESULT_SCHEMA = 'axm.pulse-choir-show-result/v1';
const MAX_PAYLOAD_BYTES = 64 * 1024;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function configuration(env) {
  const source = env || process.env;
  const configured = String(source.AXM_GAME_HUB_CALLBACK_URL || '');
  if (source.AXM_MANAGED_BY_GAME_HUB !== '1' || !configured) {
    return { schema: HANDBACK_SCHEMA, available: false, reason: 'not-managed' };
  }
  try {
    const base = new URL(configured);
    if (base.protocol !== 'http:' || !LOOPBACK_HOSTS.has(base.hostname)) {
      return { schema: HANDBACK_SCHEMA, available: false, reason: 'callback-not-loopback' };
    }
    return {
      schema: HANDBACK_SCHEMA,
      available: true,
      endpoint: new URL('/game/end', base).toString(),
      hubUrl: new URL('/', base).toString()
    };
  } catch (_) {
    return { schema: HANDBACK_SCHEMA, available: false, reason: 'callback-invalid' };
  }
}

function summarize(state, env) {
  const show = state && state.show || {};
  const history = Array.isArray(show.history) ? show.history : [];
  const lastRound = history.length ? history[history.length - 1] : null;
  return {
    schema: RESULT_SCHEMA,
    source: GAME_ID,
    sessionId: String((env || process.env).AXM_GAME_SESSION_ID || 'standalone').slice(0, 120),
    status: 'returned-to-game-hub',
    completedRounds: Number(show.completedRounds || 0),
    nightTotal: Number(show.totalScore || 0),
    bestScore: Number(show.bestScore || 0),
    bestRank: String(show.bestRank || 'WARM-UP'),
    totalActsCleared: Number(show.totalActsCleared || 0),
    lastRound: clone(lastRound),
    next: clone(show.next || null)
  };
}

function notify(config, summary, options) {
  const settings = options || {};
  const transport = settings.http || http;
  const timeoutMs = Number(settings.timeoutMs || 1200);
  if (!config || !config.available) return Promise.resolve({ ok: false, reason: 'managed-handback-unavailable' });
  const payload = JSON.stringify({ summary, reflect: false, confirmed_finish: true });
  if (Buffer.byteLength(payload, 'utf8') > MAX_PAYLOAD_BYTES) return Promise.resolve({ ok: false, reason: 'handback-payload-too-large' });
  return new Promise(resolve => {
    let settled = false;
    const finish = receipt => {
      if (settled) return;
      settled = true;
      resolve(receipt);
    };
    const endpoint = new URL(config.endpoint);
    const request = transport.request(endpoint, {
      method: 'POST',
      timeout: timeoutMs,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload)
      }
    }, response => {
      response.resume();
      response.once('end', () => finish({
        ok: response.statusCode >= 200 && response.statusCode < 300,
        statusCode: response.statusCode
      }));
    });
    request.once('timeout', () => request.destroy(new Error('handback-timeout')));
    request.once('error', error => finish({ ok: false, reason: String(error && error.message || 'handback-error').slice(0, 120) }));
    request.end(payload);
  });
}

module.exports = {
  GAME_ID,
  HANDBACK_SCHEMA,
  MAX_PAYLOAD_BYTES,
  RESULT_SCHEMA,
  configuration,
  notify,
  summarize
};
