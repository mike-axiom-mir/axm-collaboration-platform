'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function ensureDir(directory) { fs.mkdirSync(directory, { recursive: true }); return directory; }
function safeId(value) { return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80); }

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

function atomicWriteJson(file, value, options = {}) {
  ensureDir(path.dirname(file));
  const temp = file + '.tmp-' + process.pid + '-' + crypto.randomBytes(5).toString('hex');
  const text = JSON.stringify(value, null, 2) + '\n';
  fs.writeFileSync(temp, text, { encoding: 'utf8', mode: 0o600 });
  if (options.backup !== false && fs.existsSync(file)) {
    fs.copyFileSync(file, file + '.bak');
  }
  fs.renameSync(temp, file);
  return { file, bytes: Buffer.byteLength(text), sha256: crypto.createHash('sha256').update(text).digest('hex') };
}

function listJson(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json') && !entry.name.endsWith('.recovery.json'))
    .map(entry => readJson(path.join(directory, entry.name)))
    .filter(Boolean);
}

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

function hashObject(value) { return crypto.createHash('sha256').update(canonical(value)).digest('hex'); }

module.exports = { atomicWriteJson, canonical, ensureDir, hashObject, listJson, readJson, safeId };
