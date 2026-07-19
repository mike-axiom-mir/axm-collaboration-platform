'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Store = require('../kernel/immutable-batch-store');

function makeStage(root, name, text) {
  const directory = path.join(root, name);
  fs.mkdirSync(path.join(directory, 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'batch.json'), `${text}\n`, 'utf8');
  fs.writeFileSync(path.join(directory, 'sessions', 'one.json'), '{"ok":true}\n', 'utf8');
  return directory;
}

test('identical content-addressed loser reuses winner and removes only its verified stage', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-immutable-store-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const final = path.join(root, 'batch-one');
  const first = makeStage(root, '.stage-first', 'same');
  const second = makeStage(root, '.stage-second', 'same');
  const committed = Store.commitDirectory(first, final);
  assert.equal(committed.reused, false);
  const reused = Store.commitDirectory(second, final);
  assert.equal(reused.state, 'REUSED_IDENTICAL_CONTENT_ADDRESSED_WINNER');
  assert.equal(reused.reused, true);
  assert.equal(reused.loserStageRetained, false);
  assert.equal(fs.existsSync(second), false);
  assert.equal(fs.readFileSync(path.join(final, 'batch.json'), 'utf8'), 'same\n');
});

test('Windows losing rename EPERM verifies and reuses the identical winner', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-immutable-eperm-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const stage = makeStage(root, '.stage-loser', 'same');
  const final = path.join(root, 'batch-race');
  const result = Store.commitDirectory(stage, final, {
    renameSync(source, destination) {
      fs.cpSync(source, destination, { recursive: true, errorOnExist: true });
      const error = new Error('simulated Windows losing rename');
      error.code = 'EPERM';
      throw error;
    }
  });
  assert.equal(result.reused, true);
  assert.equal(result.recoveredFromCode, 'EPERM');
  assert.equal(fs.existsSync(stage), false);
  assert.equal(Store.directoryDigest(final).length, 64);
});

test('transient Windows EPERM without a winner retries only the same bounded rename', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-immutable-transient-eperm-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const stage = makeStage(root, '.stage-transient', 'same');
  const final = path.join(root, 'batch-after-retry');
  let calls = 0;
  const result = Store.commitDirectory(stage, final, {
    retryDelayMs: 0,
    renameSync(source, destination) {
      calls += 1;
      if (calls === 1) {
        const error = new Error('simulated transient scanner lock');
        error.code = 'EPERM';
        throw error;
      }
      fs.renameSync(source, destination);
    }
  });
  assert.equal(result.state, 'COMMITTED_AFTER_TRANSIENT_RENAME_RETRY');
  assert.equal(result.renameAttempts, 2);
  assert.equal(result.recoveredFromCode, 'EPERM');
  assert.equal(fs.existsSync(stage), false);
  assert.equal(fs.readFileSync(path.join(final, 'batch.json'), 'utf8'), 'same\n');
});

test('persistent Windows EPERM without a winner preserves the complete stage', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-immutable-persistent-eperm-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const stage = makeStage(root, '.stage-persistent', 'preserve-me');
  const final = path.join(root, 'batch-never-created');
  let calls = 0;
  assert.throws(() => Store.commitDirectory(stage, final, {
    renameAttempts: 3,
    retryDelayMs: 0,
    renameSync() {
      calls += 1;
      const error = new Error('simulated persistent scanner lock');
      error.code = 'EPERM';
      throw error;
    }
  }), error => error && error.code === 'EPERM');
  assert.equal(calls, 3);
  assert.equal(fs.existsSync(stage), true);
  assert.equal(fs.existsSync(final), false);
  assert.equal(fs.readFileSync(path.join(stage, 'batch.json'), 'utf8'), 'preserve-me\n');
});

test('divergent destination is never overwritten or deleted and loser evidence remains', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-immutable-divergence-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const final = path.join(root, 'batch-divergent');
  const winner = makeStage(root, '.stage-winner', 'winner');
  const loser = makeStage(root, '.stage-loser', 'different');
  Store.commitDirectory(winner, final);
  assert.throws(() => Store.commitDirectory(loser, final), error => error && error.code === 'IMMUTABLE_BATCH_DIVERGENCE');
  assert.equal(fs.existsSync(loser), true);
  assert.equal(fs.readFileSync(path.join(final, 'batch.json'), 'utf8'), 'winner\n');
  assert.equal(fs.readFileSync(path.join(loser, 'batch.json'), 'utf8'), 'different\n');
});

test('broad or cross-parent destructive targets are refused', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-immutable-bounds-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-immutable-other-'));
  t.after(() => fs.rmSync(other, { recursive: true, force: true }));
  const stage = makeStage(root, '.stage-one', 'same');
  assert.throws(() => Store.commitDirectory(stage, path.join(other, 'batch')), /share one parent/);
  assert.throws(() => Store.commitDirectory(path.join(root, 'visible-stage'), path.join(root, 'batch')), /hidden child/);
});
