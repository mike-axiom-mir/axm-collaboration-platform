'use strict';

const crypto = require('crypto');
const DeterministicJson = require('../../tools/deterministic-json-core');

function clone(value) { return JSON.parse(DeterministicJson.canonicalJson(value)); }
function now(value) { return String(value || new Date().toISOString()); }
function compact(value, maximum) {
  const out = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  return maximum && out.length > maximum ? out.slice(0, Math.max(0, maximum - 3)) + '...' : out;
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    return Object.keys(value).sort().reduce(function (out, key) {
      if (value[key] !== undefined) out[key] = stable(value[key]);
      return out;
    }, {});
  }
  return value;
}
function stableStringify(value) { return DeterministicJson.canonicalJson(value); }
function digest(value) {
  const material = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : stableStringify(value));
  return crypto.createHash('sha256').update(material).digest('hex');
}
function uid(prefix) { return compact(prefix || 'sense', 40) + '-' + Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex'); }
function byteLength(value) { return Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value || null)); }

function createReceiptStore(limit) {
  limit = Math.max(1, Math.min(20, Number(limit) || 20));
  let rows = [];
  return {
    push(receipt) { rows = rows.concat([clone(receipt)]).slice(-limit); return clone(receipt); },
    list() { return clone(rows); },
    latest() { return rows.length ? clone(rows[rows.length - 1]) : null; },
    status() { return { receiptCount: rows.length, receiptLimit: limit }; }
  };
}

function status(store, extra) {
  return Object.assign({ rawRetainedBytes: 0, rawRetainedItems: 0 }, store.status(), extra || {});
}

function assertExactIdentifier(value, label) {
  value = compact(value, 500);
  if (!value) throw new Error((label || 'identifier') + ' is required');
  if (/[*?\[\]]/.test(value)) throw new Error((label || 'identifier') + ' must be exact; wildcards are forbidden');
  return value;
}

module.exports = { clone, now, compact, stable, stableStringify, digest, uid, byteLength, createReceiptStore, status, assertExactIdentifier };
