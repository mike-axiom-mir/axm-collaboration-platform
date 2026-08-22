'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_WRITE_ATTEMPTS = 5;
const DEFAULT_WRITE_BACKOFF_MS = 25;
const TRANSIENT_WRITE_CODES = new Set(['EACCES', 'EBUSY', 'EMFILE', 'ENFILE', 'EPERM', 'ETXTBSY', 'UNKNOWN']);
let writeSequence = 0;

function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
function missingPathError(error) { return error && error.code === 'ENOENT'; }
function transientWriteError(error) { return Boolean(error && TRANSIENT_WRITE_CODES.has(error.code || 'UNKNOWN')); }
function temporaryPath(outputPath, attempt) {
  writeSequence += 1;
  return outputPath + '.tmp-' + process.pid + '-' + Date.now() + '-' + writeSequence + '-' + attempt;
}
function diagnosticError(error, outputPath, attempt, attempts) {
  const code = error && error.code ? error.code : 'UNKNOWN';
  const errno = error && error.errno !== undefined ? error.errno : 'UNKNOWN';
  const syscall = error && error.syscall ? error.syscall : 'UNKNOWN';
  const errorPath = error && error.path ? error.path : 'UNKNOWN';
  const message = 'Sensorium output write failed after ' + attempt + '/' + attempts + ' attempt(s): ' +
    'code=' + code + ' errno=' + errno + ' syscall=' + syscall + ' target=' + outputPath + ' errorPath=' + errorPath + '. ' +
    'Repair hint: verify the parent directory is writable, close any process holding the target, then rerun the command.';
  const wrapped = new Error(message);
  wrapped.code = code;
  wrapped.errno = errno;
  wrapped.syscall = syscall;
  wrapped.path = outputPath;
  wrapped.errorPath = errorPath;
  wrapped.attempts = attempt;
  wrapped.retryCount = Math.max(0, attempt - 1);
  wrapped.cause = error;
  return wrapped;
}
async function preflightOutput(outputPath, io) {
  const directory = path.dirname(outputPath);
  const directoryState = await io.stat(directory);
  if (!directoryState.isDirectory()) {
    const error = new Error('Sensorium output parent path is not a directory: ' + directory);
    error.code = 'ENOTDIR'; error.syscall = 'stat'; error.path = directory;
    throw error;
  }
  await io.access(directory, fs.constants.W_OK);
  try {
    const outputState = await io.stat(outputPath);
    if (!outputState.isFile()) {
      const error = new Error('Sensorium output target is not a file: ' + outputPath);
      error.code = 'EISDIR'; error.syscall = 'stat'; error.path = outputPath;
      throw error;
    }
    await io.access(outputPath, fs.constants.W_OK);
  } catch (error) {
    if (!missingPathError(error)) throw error;
  }
}
async function removeTemporary(io, tempPath) {
  try { await io.unlink(tempPath); } catch (error) { if (!missingPathError(error)) return error; }
  return null;
}
async function writePayload(outputPath, payload, options) {
  options = options || {};
  const io = options.io || fs.promises;
  const attempts = Number.isInteger(options.writeAttempts) && options.writeAttempts > 0 ? options.writeAttempts : DEFAULT_WRITE_ATTEMPTS;
  const backoffMs = Number.isFinite(options.writeBackoffMs) && options.writeBackoffMs >= 0 ? options.writeBackoffMs : DEFAULT_WRITE_BACKOFF_MS;
  const delay = options.delay || wait;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const tempPath = temporaryPath(outputPath, attempt);
    try {
      await preflightOutput(outputPath, io);
      await io.writeFile(tempPath, payload, { encoding: 'utf8', flag: 'wx' });
      await io.rename(tempPath, outputPath);
      return;
    } catch (error) {
      lastError = error;
      const cleanupError = await removeTemporary(io, tempPath);
      if (cleanupError) error.cleanupError = cleanupError;
      if (!transientWriteError(error) || attempt === attempts) throw diagnosticError(error, outputPath, attempt, attempts);
      await delay(backoffMs * Math.pow(2, attempt - 1));
    }
  }
  throw diagnosticError(lastError, outputPath, attempts, attempts);
}

module.exports = { writePayload, preflightOutput, transientWriteError };
