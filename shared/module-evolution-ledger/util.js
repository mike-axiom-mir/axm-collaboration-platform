'use strict';

const crypto = require('crypto');

class LedgerError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'LedgerError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function fail(code, message, details) {
  throw new LedgerError(code, message, details);
}

function canonicalize(value, location = '$') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('INVALID_VALUE', `Non-finite number at ${location}`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => canonicalize(item, `${location}[${index}]`));
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    fail('INVALID_VALUE', `Only JSON values and plain objects are allowed at ${location}`);
  }
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] === undefined) fail('INVALID_VALUE', `Undefined value at ${location}.${key}`);
    result[key] = canonicalize(value[key], `${location}.${key}`);
  }
  return result;
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function clone(value) {
  return JSON.parse(canonicalStringify(value));
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function digestValue(value) {
  return sha256(canonicalStringify(value));
}

function requireDigest(value, label = 'digest') {
  const normalized = String(value || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) fail('INVALID_DIGEST', `${label} must be a lowercase SHA-256 digest`);
  return normalized;
}

function requireId(value, label = 'id') {
  const normalized = String(value || '');
  if (!/^[a-z0-9][a-z0-9._:-]{0,127}$/i.test(normalized)) fail('INVALID_ID', `${label} is not a bounded identifier`);
  return normalized;
}

function requireModuleId(value) {
  const normalized = String(value || '');
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(normalized)) fail('INVALID_MODULE_ID', 'moduleId must be a lowercase Workshop module identifier');
  return normalized;
}

function requireText(value, label, max = 512) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > max) fail('INVALID_TEXT', `${label} must contain 1-${max} characters`);
  return normalized;
}

function requireIsoTime(value, label = 'time') {
  const normalized = String(value || '');
  const parsed = Date.parse(normalized);
  if (!normalized || !Number.isFinite(parsed)) fail('INVALID_TIME', `${label} must be an ISO timestamp`);
  return new Date(parsed).toISOString();
}

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function parseSemver(value) {
  const normalized = String(value || '');
  const match = SEMVER.exec(normalized);
  if (!match) fail('INVALID_SEMVER', `Invalid semantic version: ${normalized || '<empty>'}`);
  const prerelease = match[4] ? match[4].split('.').map(part => (/^\d+$/.test(part) ? Number(part) : part)) : [];
  return { raw: normalized, major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease };
}

function compareSemver(aValue, bValue) {
  const a = typeof aValue === 'string' ? parseSemver(aValue) : aValue;
  const b = typeof bValue === 'string' ? parseSemver(bValue) : bValue;
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  if (!a.prerelease.length && !b.prerelease.length) return 0;
  if (!a.prerelease.length) return 1;
  if (!b.prerelease.length) return -1;
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    if (a.prerelease[index] === undefined) return -1;
    if (b.prerelease[index] === undefined) return 1;
    if (a.prerelease[index] === b.prerelease[index]) continue;
    const aNumber = typeof a.prerelease[index] === 'number';
    const bNumber = typeof b.prerelease[index] === 'number';
    if (aNumber && !bNumber) return -1;
    if (!aNumber && bNumber) return 1;
    return a.prerelease[index] < b.prerelease[index] ? -1 : 1;
  }
  return 0;
}

function bumpKind(fromValue, toValue) {
  const from = parseSemver(fromValue);
  const to = parseSemver(toValue);
  if (compareSemver(to, from) <= 0) fail('NON_FORWARD_VERSION', `${toValue} must be greater than ${fromValue}`);
  if (to.major !== from.major) return 'major';
  if (to.minor !== from.minor) return 'minor';
  return 'patch';
}

function boundedJson(value, label, maxBytes = 64 * 1024) {
  const serialized = canonicalStringify(value);
  if (Buffer.byteLength(serialized, 'utf8') > maxBytes) fail('VALUE_TOO_LARGE', `${label} exceeds ${maxBytes} bytes`);
  return JSON.parse(serialized);
}

module.exports = {
  LedgerError,
  fail,
  canonicalStringify,
  clone,
  sha256,
  digestValue,
  requireDigest,
  requireId,
  requireModuleId,
  requireText,
  requireIsoTime,
  parseSemver,
  compareSemver,
  bumpKind,
  boundedJson
};
