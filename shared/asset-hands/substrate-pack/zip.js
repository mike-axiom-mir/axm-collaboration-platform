'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MAX_ENTRIES = 50000;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;

function safeRelative(name) {
  const value = String(name || '').replace(/\\/g, '/');
  if (!value || value.includes('\0') || value.startsWith('/') || /^[A-Za-z]:/.test(value)) throw new Error('ZIP entry path is unsafe');
  const parts = value.split('/').filter(Boolean);
  if (parts.some((part) => part === '.' || part === '..')) throw new Error('ZIP traversal entry refused: ' + value);
  return parts.join('/');
}

function inside(root, relative) {
  const base = path.resolve(root);
  const target = path.resolve(base, relative);
  if (target !== base && !target.startsWith(base + path.sep)) throw new Error('ZIP extraction escaped destination');
  return target;
}

function endRecord(buffer) {
  const minimum = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error('ZIP end record missing');
}

function list(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('ZIP buffer required');
  const end = endRecord(buffer);
  const count = buffer.readUInt16LE(end + 10);
  const centralOffset = buffer.readUInt32LE(end + 16);
  if (count > MAX_ENTRIES) throw new Error('ZIP entry budget exceeded');
  const entries = [];
  let cursor = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('ZIP central directory is malformed');
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const size = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const external = buffer.readUInt32LE(cursor + 38);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = safeRelative(buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8'));
    const unixMode = (external >>> 16) & 0xffff;
    if ((unixMode & 0xf000) === 0xa000) throw new Error('ZIP symbolic links are refused: ' + name);
    if (![0, 8].includes(method)) throw new Error('unsupported ZIP compression method ' + method + ': ' + name);
    entries.push({ name, method, compressedSize, size, localOffset, directory: /\/$/.test(buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8')) });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (entries.reduce((sum, entry) => sum + entry.size, 0) > MAX_TOTAL_BYTES) throw new Error('ZIP expanded-byte budget exceeded');
  return entries;
}

function extractBuffer(buffer, destination, options) {
  options = options || {};
  const strip = String(options.stripPrefix || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const entries = list(buffer);
  const written = [];
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of entries) {
    let relative = entry.name;
    if (strip) {
      if (relative === strip) continue;
      if (!relative.startsWith(strip + '/')) continue;
      relative = relative.slice(strip.length + 1);
    }
    if (!relative) continue;
    const target = inside(destination, relative);
    if (entry.directory) { fs.mkdirSync(target, { recursive: true }); continue; }
    if (buffer.readUInt32LE(entry.localOffset) !== 0x04034b50) throw new Error('ZIP local header is malformed: ' + entry.name);
    const nameLength = buffer.readUInt16LE(entry.localOffset + 26);
    const extraLength = buffer.readUInt16LE(entry.localOffset + 28);
    const start = entry.localOffset + 30 + nameLength + extraLength;
    const compressed = buffer.subarray(start, start + entry.compressedSize);
    const bytes = entry.method === 0 ? Buffer.from(compressed) : zlib.inflateRawSync(compressed, { maxOutputLength: Math.max(1, entry.size) });
    if (bytes.length !== entry.size) throw new Error('ZIP expanded size mismatch: ' + entry.name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { flag: 'wx' });
    written.push({ relative: relative.replace(/\\/g, '/'), bytes: bytes.length });
  }
  return written;
}

function extractFile(archive, destination, options) {
  return extractBuffer(fs.readFileSync(archive), destination, options);
}

module.exports = { MAX_ENTRIES, MAX_TOTAL_BYTES, safeRelative, list, extractBuffer, extractFile };
