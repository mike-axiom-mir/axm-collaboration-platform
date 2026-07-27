'use strict';

const crypto = require('crypto');

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : canonical(value), 'utf8');
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function text(value, max, label) {
  const result = String(value == null ? '' : value).trim();
  ensure(result.length > 0, (label || 'text') + ' required');
  ensure(result.length <= (max || 200), (label || 'text') + ' too long');
  return result;
}

function finite(value, label) {
  const number = Number(value);
  ensure(Number.isFinite(number), (label || 'value') + ' must be finite');
  return number;
}

function boundedArray(value, min, max, label) {
  ensure(Array.isArray(value), (label || 'array') + ' required');
  ensure(value.length >= min && value.length <= max, (label || 'array') + ' length outside ' + min + '..' + max);
  return value;
}

function receiptId(prefix, body) {
  return prefix + '-' + sha256(body).slice(0, 24);
}

function jsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

module.exports = { clone, canonical, sha256, ensure, text, finite, boundedArray, receiptId, jsonBytes };
