'use strict';

const MAX_BYTES = 5 * 1024 * 1024;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

function endpoint(baseUrl, focus = 'mirror-route-readiness') {
  const base = new URL(baseUrl || 'http://127.0.0.1:8788');
  if (base.protocol !== 'http:' || !LOOPBACK_HOSTS.has(base.hostname) || base.username || base.password) {
    throw new Error('Technical Glasses observation requires an unauthenticated loopback HTTP Workshop URL');
  }
  const target = new URL('/api/workshop/technical-glasses', base);
  target.searchParams.set('focus', String(focus || 'mirror-route-readiness').slice(0, 160));
  return target;
}

async function observe(options = {}) {
  if (options.snapshot && typeof options.snapshot === 'object') {
    return { snapshot: JSON.parse(JSON.stringify(options.snapshot)), source: 'INJECTED_TYPED_SNAPSHOT', refreshed: false };
  }
  const target = endpoint(options.baseUrl, options.focus);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(250, Math.min(5000, Number(options.timeoutMs) || 2500)));
  let response;
  try {
    response = await fetch(target, { method: 'GET', headers: { accept: 'application/json' }, redirect: 'error', signal: controller.signal });
    if (!response.ok) throw new Error(`Technical Glasses observation returned HTTP ${response.status}`);
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BYTES) throw new Error('Technical Glasses observation exceeds the bounded response size');
    const bytes = await response.text();
    if (Buffer.byteLength(bytes, 'utf8') > MAX_BYTES) throw new Error('Technical Glasses observation exceeds the bounded response size');
    const snapshot = JSON.parse(bytes);
    if (!snapshot || snapshot.schema !== 'axm.technical-glasses/v1' || snapshot.ok !== true || !Array.isArray(snapshot.modules)) {
      throw new Error('Technical Glasses observation is not a valid typed Workshop snapshot');
    }
    return { snapshot, source: target.toString(), refreshed: true };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { MAX_BYTES, endpoint, observe };
