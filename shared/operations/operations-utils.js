'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const EvidenceRetention = require('../evidence-retention/evidence-retention-service');
const AtomicJsonPublication = require('./atomic-json-publication');

function now() { return new Date().toISOString(); }
function uid(prefix) { return String(prefix || 'op') + '-' + Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex'); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function fileSha256(file) { return sha256(fs.readFileSync(file)); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
  catch (_) { return clone(fallback); }
}

function atomicJson(file, value) {
  return AtomicJsonPublication.publish(file, value);
}

function appendJsonl(file, value) {
  const retained = EvidenceRetention.recordForFile(file, value);
  if (retained) return retained;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(value) + '\n', 'utf8');
  return { evidenceClass: 'LEGACY_RAW_APPEND', file };
}

function cleanId(value, label) {
  const id = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(id)) throw new Error((label || 'id') + ' must use lowercase letters, digits and hyphens');
  return id;
}

function safeRelative(value) {
  let rel = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel || rel.includes('\0') || rel.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('unsafe relative path refused');
  if (/^[a-zA-Z]:/.test(rel)) throw new Error('absolute path refused');
  return rel;
}

function resolveUnder(root, relative) {
  const base = path.resolve(root), target = path.resolve(base, safeRelative(relative));
  const prefix = base.endsWith(path.sep) ? base : base + path.sep;
  if (!target.startsWith(prefix)) throw new Error('path escaped its declared root');
  return target;
}

function assertUnder(target, root) {
  const base = path.resolve(root), resolved = path.resolve(target), prefix = base.endsWith(path.sep) ? base : base + path.sep;
  if (resolved !== base && !resolved.startsWith(prefix)) throw new Error('path escaped its declared root');
  return resolved;
}

function copyTree(source, target) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('symbolic links are refused in governed copies');
      copyTree(path.join(source, entry.name), path.join(target, entry.name));
    }
  } else if (stat.isFile()) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  } else throw new Error('unsupported filesystem entry refused');
}

function walk(root, options) {
  const opts = Object.assign({ maxFiles: 20000, maxBytes: 200 * 1024 * 1024, excludedNames: [] }, options || {});
  const excluded = new Set(opts.excludedNames.map(x => String(x).toLowerCase()));
  const files = [];
  let bytes = 0;
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (excluded.has(entry.name.toLowerCase())) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) {
        const stat = fs.statSync(absolute);
        if (files.length >= opts.maxFiles || bytes + stat.size > opts.maxBytes) throw new Error('filesystem scan safety limit exceeded');
        bytes += stat.size;
        files.push({ absolute, relative: path.relative(root, absolute).replace(/\\/g, '/'), bytes: stat.size, modifiedAt: stat.mtime.toISOString() });
      }
    }
  }
  if (fs.existsSync(root)) visit(root);
  return { files, bytes };
}

function readTail(file, maxBytes) {
  const limit = Math.max(1024, Number(maxBytes) || 65536);
  if (!fs.existsSync(file)) return '';
  const stat = fs.statSync(file), start = Math.max(0, stat.size - limit), length = stat.size - start;
  const fd = fs.openSync(file, 'r');
  try { const buf = Buffer.alloc(length); fs.readSync(fd, buf, 0, length, start); return buf.toString('utf8'); }
  finally { fs.closeSync(fd); }
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let bit = 0; bit < 8; bit++) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(value, seed) {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(value), initial = seed === undefined ? 0 : Number(seed) >>> 0;
  let crc = (initial ^ 0xffffffff) >>> 0;
  for (let i = 0; i < input.length; i++) crc = (CRC32_TABLE[(crc ^ input[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

function fileCrc32(file) {
  const fd = fs.openSync(file, 'r'), chunk = Buffer.allocUnsafe(64 * 1024);
  let position = 0, digest = 0;
  try {
    for (;;) {
      const bytes = fs.readSync(fd, chunk, 0, chunk.length, position);
      if (!bytes) break;
      digest = crc32(chunk.subarray(0, bytes), digest); position += bytes;
    }
    return digest >>> 0;
  } finally { fs.closeSync(fd); }
}

function dosDateTime(value) {
  const date = value instanceof Date && Number.isFinite(value.getTime()) ? value : new Date();
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  return {
    date: (((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff,
    time: ((date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)) & 0xffff
  };
}

function writeAll(fd, buffer) {
  let offset = 0;
  while (offset < buffer.length) offset += fs.writeSync(fd, buffer, offset, buffer.length - offset, null);
}

/* Minimal ZIP writer using the standard uncompressed STORE method. It keeps
   asset packaging dependency-free while producing archives understood by
   ordinary ZIP tools. ZIP64 and path escape are deliberately refused. */
function zipDirectory(sourceDir, outputFile, options) {
  const source = path.resolve(sourceDir), output = path.resolve(outputFile), opts = Object.assign({ maxFiles: 65535, maxBytes: 2 * 1024 * 1024 * 1024 }, options || {});
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) throw new Error('ZIP source directory not found');
  assertUnder(source, sourceDir); fs.mkdirSync(path.dirname(output), { recursive: true });
  const scan = walk(source, { maxFiles: Math.min(65535, opts.maxFiles), maxBytes: opts.maxBytes, excludedNames: [] });
  if (scan.files.length > 65535) throw new Error('ZIP64 file count is unsupported');
  const temp = output + '.tmp-' + process.pid + '-' + crypto.randomBytes(3).toString('hex'), central = [];
  let fd = null, archiveOffset = 0;
  try {
    fd = fs.openSync(temp, 'wx');
    for (const item of scan.files) {
      const name = Buffer.from(safeRelative(item.relative), 'utf8'), stat = fs.statSync(item.absolute);
      if (name.length > 65535 || stat.size > 0xffffffff || archiveOffset > 0xffffffff) throw new Error('ZIP64 entry is unsupported');
      const stamp = dosDateTime(stat.mtime), checksum = fileCrc32(item.absolute), localOffset = archiveOffset;
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
      local.writeUInt16LE(stamp.time, 10); local.writeUInt16LE(stamp.date, 12); local.writeUInt32LE(checksum, 14);
      local.writeUInt32LE(stat.size, 18); local.writeUInt32LE(stat.size, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
      writeAll(fd, local); writeAll(fd, name); archiveOffset += local.length + name.length;
      const sourceFd = fs.openSync(item.absolute, 'r'), chunk = Buffer.allocUnsafe(64 * 1024); let position = 0;
      try { for (;;) { const bytes = fs.readSync(sourceFd, chunk, 0, chunk.length, position); if (!bytes) break; writeAll(fd, chunk.subarray(0, bytes)); position += bytes; archiveOffset += bytes; } }
      finally { fs.closeSync(sourceFd); }
      central.push({ name, size: stat.size, checksum, stamp, localOffset });
    }
    const centralOffset = archiveOffset;
    for (const item of central) {
      const header = Buffer.alloc(46);
      header.writeUInt32LE(0x02014b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6); header.writeUInt16LE(0x0800, 8); header.writeUInt16LE(0, 10);
      header.writeUInt16LE(item.stamp.time, 12); header.writeUInt16LE(item.stamp.date, 14); header.writeUInt32LE(item.checksum, 16);
      header.writeUInt32LE(item.size, 20); header.writeUInt32LE(item.size, 24); header.writeUInt16LE(item.name.length, 28); header.writeUInt16LE(0, 30); header.writeUInt16LE(0, 32);
      header.writeUInt16LE(0, 34); header.writeUInt16LE(0, 36); header.writeUInt32LE(0, 38); header.writeUInt32LE(item.localOffset, 42);
      writeAll(fd, header); writeAll(fd, item.name); archiveOffset += header.length + item.name.length;
    }
    const centralSize = archiveOffset - centralOffset;
    if (centralOffset > 0xffffffff || centralSize > 0xffffffff) throw new Error('ZIP64 archive is unsupported');
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(central.length, 8); end.writeUInt16LE(central.length, 10);
    end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(centralOffset, 16); end.writeUInt16LE(0, 20); writeAll(fd, end); archiveOffset += end.length;
    fs.closeSync(fd); fd = null; fs.renameSync(temp, output);
    return { file: output, files: central.length, sourceBytes: scan.bytes, archiveBytes: archiveOffset, method: 'store', requiredThirdPartyDependencies: [] };
  } catch (error) {
    if (fd !== null) try { fs.closeSync(fd); } catch (_) {}
    try { fs.rmSync(temp, { force: true }); } catch (_) {}
    throw error;
  }
}

module.exports = { now, uid, sha256, fileSha256, clone, loadJson, atomicJson, appendJsonl, cleanId, safeRelative, resolveUnder, assertUnder, copyTree, walk, readTail, crc32, fileCrc32, zipDirectory };
