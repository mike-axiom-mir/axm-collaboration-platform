'use strict';

const crypto = require('crypto');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function text(value, limit) { return String(value == null ? '' : value).trim().slice(0, limit || 4000); }
function list(value, limit) {
  return Array.from(new Set((Array.isArray(value) ? value : []).map(item => text(item, 500)).filter(Boolean))).sort().slice(0, limit || 500);
}
function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function digest(value) { return crypto.createHash('sha256').update(stable(value)).digest('hex'); }
function id(prefix, value) { return prefix + '-' + digest(value).slice(0, 16); }
function clamp(value, fallback, min, max) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
}
function assert(condition, message) { if (!condition) throw new Error(message); }

module.exports = { clone, text, list, stable, digest, id, clamp, assert };
