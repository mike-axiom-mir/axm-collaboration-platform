'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_LIMIT = 64 * 1024 * 1024;

function normalizePath(value) {
  return path.resolve(String(value || ''));
}

function samePath(left, right) {
  const a = normalizePath(left);
  const b = normalizePath(right);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function fail(message) {
  const error = new Error(message);
  error.code = 'AXM_PLAIN_FILE_REFUSAL';
  throw error;
}

function assertPlainParent(file) {
  const target = normalizePath(file);
  const directory = path.dirname(target);
  let stat;
  try {
    stat = fs.lstatSync(directory);
  } catch (error) {
    fail('plain-file parent is unavailable: ' + (error.code || error.message));
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    fail('plain-file parent must be a real directory');
  }
  const real = fs.realpathSync.native(directory);
  if (!samePath(real, directory)) {
    fail('plain-file parent may not traverse a symbolic link or junction');
  }
  return { target, directory };
}

function inspectDestination(file, allowMissing) {
  const target = normalizePath(file);
  try {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      fail('plain-file target must be a regular file');
    }
    return stat;
  } catch (error) {
    if (allowMissing && error && error.code === 'ENOENT') return null;
    if (error && error.code === 'AXM_PLAIN_FILE_REFUSAL') throw error;
    fail('plain-file target inspection failed: ' + (error.code || error.message));
  }
}

function read(file, options) {
  options = options || {};
  const maximum = Number.isSafeInteger(options.maxBytes) && options.maxBytes > 0
    ? options.maxBytes
    : DEFAULT_LIMIT;
  const { target } = assertPlainParent(file);
  const before = inspectDestination(target, options.allowMissing === true);
  if (!before) return null;
  if (before.size > maximum) fail('plain-file target exceeds the read limit');

  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
  let descriptor;
  try {
    descriptor = fs.openSync(target, flags);
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.size > maximum) fail('plain-file opened target is not an allowed regular file');
    const data = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < data.length) {
      const count = fs.readSync(descriptor, data, offset, data.length - offset, offset);
      if (!count) break;
      offset += count;
    }
    if (offset !== data.length) fail('plain-file read ended before the declared file size');
    const after = inspectDestination(target, false);
    if (before.dev !== after.dev || before.ino !== after.ino || opened.dev !== after.dev || opened.ino !== after.ino) {
      fail('plain-file target changed during read');
    }
    return data;
  } finally {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch (_) {}
    }
  }
}

function writeAtomic(file, content, options) {
  options = options || {};
  const data = Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(String(content), 'utf8');
  const maximum = Number.isSafeInteger(options.maxBytes) && options.maxBytes > 0
    ? options.maxBytes
    : DEFAULT_LIMIT;
  if (data.length > maximum) fail('plain-file write exceeds the allowed limit');

  const { target, directory } = assertPlainParent(file);
  inspectDestination(target, true);
  const temporary = path.join(
    directory,
    '.' + path.basename(target) + '.tmp-' + process.pid + '-' + crypto.randomBytes(12).toString('hex')
  );
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    let offset = 0;
    while (offset < data.length) {
      offset += fs.writeSync(descriptor, data, offset, data.length - offset, offset);
    }
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;

    assertPlainParent(target);
    inspectDestination(target, true);
    fs.renameSync(temporary, target);
    const finalStat = inspectDestination(target, false);
    if (finalStat.size !== data.length) fail('plain-file atomic write size mismatch');
  } catch (error) {
    try { fs.rmSync(temporary, { force: true }); } catch (_) {}
    throw error;
  } finally {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch (_) {}
    }
  }
  return target;
}

function appendAtomic(file, content, options) {
  options = options || {};
  const maximum = Number.isSafeInteger(options.maxBytes) && options.maxBytes > 0
    ? options.maxBytes
    : DEFAULT_LIMIT;
  const addition = Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(String(content), 'utf8');
  const existing = read(file, { allowMissing: true, maxBytes: maximum });
  const current = existing || Buffer.alloc(0);
  if (current.length + addition.length > maximum) fail('plain-file append exceeds the allowed limit');
  return writeAtomic(file, Buffer.concat([current, addition]), { maxBytes: maximum });
}

module.exports = {
  DEFAULT_LIMIT,
  samePath,
  assertPlainParent,
  inspectDestination,
  read,
  writeAtomic,
  appendAtomic
};
