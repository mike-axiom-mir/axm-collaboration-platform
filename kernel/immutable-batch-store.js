'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CELL_ID = 'axm.mirror.immutable-batch-store/v1';
const RETRIABLE_RENAME_CODES = new Set(['EPERM', 'EEXIST', 'ENOTEMPTY', 'EACCES']);
const DEFAULT_RENAME_ATTEMPTS = 4;

function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

function assertBoundedPair(stageDir, finalDir) {
  const stage = path.resolve(stageDir);
  const final = path.resolve(finalDir);
  const parent = path.dirname(final);
  if (path.dirname(stage) !== parent) throw new Error('immutable batch stage and destination must share one parent');
  if (stage === final || stage === parent || final === parent) throw new Error('immutable batch commit requires distinct bounded child directories');
  if (!path.basename(stage).startsWith('.')) throw new Error('immutable batch stage must be a hidden child directory');
  return { stage, final, parent };
}

function inventory(root) {
  const absoluteRoot = path.resolve(root);
  const stat = fs.lstatSync(absoluteRoot);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('immutable batch inventory requires a real directory');
  const rows = [];
  function walk(directory, prefix) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const itemStat = fs.lstatSync(absolute);
      if (itemStat.isSymbolicLink()) throw new Error(`immutable batch symlink refused: ${relative}`);
      if (itemStat.isDirectory()) {
        rows.push({ path: `${relative}/`, type: 'directory' });
        walk(absolute, relative);
      } else if (itemStat.isFile()) {
        const bytes = fs.readFileSync(absolute);
        rows.push({ path: relative, type: 'file', bytes: bytes.length, sha256: sha256(bytes) });
      } else throw new Error(`immutable batch special file refused: ${relative}`);
    }
  }
  walk(absoluteRoot, '');
  return rows;
}

function directoryDigest(root) {
  return sha256(Buffer.from(JSON.stringify(inventory(root))));
}

function sameDirectory(left, right) {
  return directoryDigest(left) === directoryDigest(right);
}

function boundedWait(milliseconds) {
  if (!(milliseconds > 0)) return;
  const signal = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(signal, 0, 0, milliseconds);
}

function reuseIdenticalLoser(stage, final, cause) {
  if (!fs.existsSync(final)) return null;
  if (!sameDirectory(stage, final)) {
    const error = new Error(`content-addressed destination exists with different bytes; loser stage preserved at ${stage}`);
    error.code = 'IMMUTABLE_BATCH_DIVERGENCE';
    error.cause = cause || null;
    throw error;
  }
  let loserStageRetained = false;
  try {
    fs.rmSync(stage, { recursive: true, force: false });
  } catch (error) {
    loserStageRetained = fs.existsSync(stage);
    if (!loserStageRetained) throw error;
  }
  return {
    state: 'REUSED_IDENTICAL_CONTENT_ADDRESSED_WINNER',
    reused: true,
    runDir: final,
    loserStageRetained,
    recoveredFromCode: cause && cause.code || null,
    authority: { divergentOverwrite: false, destinationDelete: false, winnerMutation: false }
  };
}

function commitDirectory(stageDir, finalDir, options = {}) {
  const resolved = assertBoundedPair(stageDir, finalDir);
  if (!fs.existsSync(resolved.stage)) throw new Error(`immutable batch stage absent: ${resolved.stage}`);
  const stageStat = fs.lstatSync(resolved.stage);
  if (!stageStat.isDirectory() || stageStat.isSymbolicLink()) throw new Error('immutable batch stage must be a real directory');
  const already = reuseIdenticalLoser(resolved.stage, resolved.final, null);
  if (already) return already;
  const renameSync = options.renameSync || fs.renameSync;
  const wait = options.wait || boundedWait;
  const attempts = Math.max(1, Math.min(8, Number.isInteger(options.renameAttempts) ? options.renameAttempts : DEFAULT_RENAME_ATTEMPTS));
  const retryDelayMs = Math.max(0, Math.min(250, Number.isFinite(options.retryDelayMs) ? options.retryDelayMs : 15));
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      renameSync(resolved.stage, resolved.final);
      return {
        state: attempt === 1 ? 'COMMITTED_NEW_CONTENT_ADDRESSED_BATCH' : 'COMMITTED_AFTER_TRANSIENT_RENAME_RETRY',
        reused: false,
        runDir: resolved.final,
        loserStageRetained: false,
        renameAttempts: attempt,
        recoveredFromCode: lastError && lastError.code || null,
        authority: { divergentOverwrite: false, destinationDelete: false, winnerMutation: false }
      };
    } catch (error) {
      if (!RETRIABLE_RENAME_CODES.has(error && error.code)) throw error;
      lastError = error;
      const recovered = reuseIdenticalLoser(resolved.stage, resolved.final, error);
      if (recovered) return Object.assign({}, recovered, { renameAttempts: attempt });
      // With no winner, a Windows EPERM/EACCES can be a short-lived file-indexer
      // or scanner lock. Retrying the identical bounded rename does not add
      // overwrite/delete authority. Persistent failure retains the stage.
      if (attempt === attempts) throw error;
      if (!fs.existsSync(resolved.stage)) throw new Error(`immutable batch stage disappeared during rename retry: ${resolved.stage}`);
      wait(retryDelayMs * attempt);
    }
  }
  throw lastError || new Error('immutable batch commit ended without a result');
}

module.exports = { CELL_ID, DEFAULT_RENAME_ATTEMPTS, inventory, directoryDigest, sameDirectory, commitDirectory };
