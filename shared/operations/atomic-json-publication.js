'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCHEMA = 'axm.atomic-json-publication/v1';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function writeAll(fd, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const written = fs.writeSync(fd, bytes, offset, bytes.length - offset, null);
    if (!Number.isInteger(written) || written < 1) throw new Error('atomic JSON staged write made no progress');
    offset += written;
  }
}

function syncDirectory(directory) {
  let fd = null;
  try {
    fd = fs.openSync(directory, 'r');
    fs.fsyncSync(fd);
    return true;
  } catch (_) {
    /* Some supported filesystems and Windows hosts cannot fsync a directory.
       The file was already synced before publication; report the weaker
       directory guarantee instead of pretending the rename did not occur. */
    return false;
  } finally {
    if (fd !== null) try { fs.closeSync(fd); } catch (_) {}
  }
}

function publish(file, value) {
  const json = JSON.stringify(value, null, 2);
  if (typeof json !== 'string') throw new TypeError('atomic JSON publication requires a JSON-serializable value');
  const bytes = Buffer.from(json + '\n', 'utf8');
  const digest = sha256(bytes);
  const directory = path.dirname(file);
  const temp = file + '.tmp-' + process.pid + '-' + crypto.randomBytes(3).toString('hex');
  let fd = null;
  let staged = false;
  let published = false;
  fs.mkdirSync(directory, { recursive: true });
  try {
    fd = fs.openSync(temp, 'wx', 0o600);
    staged = true;
    writeAll(fd, bytes);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(temp, file);
    published = true;
    return {
      schema: SCHEMA,
      bytes: bytes.length,
      sha256: digest,
      fileSynced: true,
      directorySynced: syncDirectory(directory)
    };
  } catch (error) {
    if (fd !== null) try { fs.closeSync(fd); } catch (_) {}
    if (staged && !published) try { fs.rmSync(temp, { force: true }); } catch (_) {}
    throw error;
  }
}

module.exports = { SCHEMA, publish };
