'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function now() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return String(prefix || 'id') + ':' + Date.now().toString(36) + ':' +
    crypto.randomBytes(5).toString('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach(function (key) {
      out[key] = stableValue(value[key]);
    });
    return out;
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  const input = typeof value === 'string' ? value : stableStringify(value);
  return crypto.createHash('sha256').update(input).digest('hex');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (fallback !== undefined) return clone(fallback);
    throw error;
  }
}

function renameAtomicWithRetry(source, destination) {
  const retryable = new Set(['EPERM', 'EACCES', 'EBUSY']);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      fs.renameSync(source, destination);
      return;
    } catch (error) {
      if (!retryable.has(error && error.code) || attempt === 7) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5 * (attempt + 1));
    }
  }
}

function atomicWriteJson(file, value) {
  ensureDir(path.dirname(file));
  const temp = file + '.tmp-' + process.pid + '-' + crypto.randomBytes(3).toString('hex');
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  renameAtomicWithRetry(temp, file);
  return file;
}

function atomicWriteText(file, value) {
  ensureDir(path.dirname(file));
  const temp = file + '.tmp-' + process.pid + '-' + crypto.randomBytes(3).toString('hex');
  fs.writeFileSync(temp, String(value), { mode: 0o600 });
  renameAtomicWithRetry(temp, file);
  return file;
}

function getPath(root, dotted) {
  const parts = Array.isArray(dotted) ? dotted : String(dotted || '').split('.').filter(Boolean);
  let value = root;
  for (const part of parts) {
    if (value == null || typeof value !== 'object' || !(part in value)) return undefined;
    value = value[part];
  }
  return value;
}

function setPath(root, dotted, value) {
  const parts = Array.isArray(dotted) ? dotted : String(dotted || '').split('.').filter(Boolean);
  if (!parts.length) throw new Error('field path required');
  let target = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!target[part] || typeof target[part] !== 'object' || Array.isArray(target[part])) target[part] = {};
    target = target[part];
  }
  target[parts[parts.length - 1]] = clone(value);
  return root;
}

function deletePath(root, dotted) {
  const parts = Array.isArray(dotted) ? dotted : String(dotted || '').split('.').filter(Boolean);
  if (!parts.length) return false;
  let target = root;
  for (let i = 0; i < parts.length - 1; i++) {
    target = target && target[parts[i]];
    if (!target || typeof target !== 'object') return false;
  }
  return delete target[parts[parts.length - 1]];
}

function isInside(root, candidate) {
  const base = path.resolve(root);
  const target = path.resolve(candidate);
  return target === base || target.startsWith(base + path.sep);
}

function deepEqual(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function safeText(value, max) {
  const text = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return max ? text.slice(0, max) : text;
}

module.exports = {
  clone,
  now,
  makeId,
  stableStringify,
  sha256,
  ensureDir,
  readJson,
  atomicWriteJson,
  atomicWriteText,
  getPath,
  setPath,
  deletePath,
  isInside,
  deepEqual,
  safeText
};
