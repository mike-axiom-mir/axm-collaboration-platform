#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const U = require('./operations-utils');

function stagedFiles(file) {
  const prefix = path.basename(file) + '.tmp-';
  return fs.readdirSync(path.dirname(file)).filter(name => name.startsWith(prefix));
}

function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-atomic-json-'));
  const target = path.join(root, 'state', 'current.json');
  const originalRenameSync = fs.renameSync;
  const originalFsyncSync = fs.fsyncSync;
  const originalWriteSync = fs.writeSync;
  const originalRandomBytes = crypto.randomBytes;
  let pass = 0;

  function check(value, label) {
    assert(value, label);
    pass += 1;
    console.log('PASS ' + label);
  }

  try {
    U.atomicJson(target, { revision: 1, value: 'before' });
    const before = fs.readFileSync(target, 'utf8');
    check(before === '{\n  "revision": 1,\n  "value": "before"\n}\n', 'atomic JSON preserves the established pretty-printed byte contract');

    fs.renameSync = () => {
      const error = new Error('injected publication interruption');
      error.code = 'AXM_TEST_RENAME_INTERRUPTED';
      throw error;
    };
    assert.throws(
      () => U.atomicJson(target, { revision: 2, value: 'after' }),
      /injected publication interruption/,
    );
    fs.renameSync = originalRenameSync;
    check(fs.readFileSync(target, 'utf8') === before, 'failed publication preserves the prior canonical state bytes');
    check(stagedFiles(target).length === 0, 'failed publication removes its private staged file');

    const events = [];
    fs.fsyncSync = fd => {
      events.push(fs.fstatSync(fd).isDirectory() ? 'directory-sync' : 'file-sync');
      return originalFsyncSync(fd);
    };
    fs.renameSync = (source, destination) => {
      events.push('rename');
      return originalRenameSync(source, destination);
    };
    const receipt = U.atomicJson(target, { revision: 3, value: 'committed' });
    fs.fsyncSync = originalFsyncSync;
    fs.renameSync = originalRenameSync;
    check(events[0] === 'file-sync' && events[1] === 'rename', 'file data is synced before the canonical pathname changes');
    check(events[2] === 'directory-sync', 'the parent directory is synced after publication on this filesystem');
    check(receipt && receipt.schema === 'axm.atomic-json-publication/v1' && receipt.directorySynced === true, 'publication returns bounded durability evidence');
    check(JSON.parse(fs.readFileSync(target, 'utf8')).revision === 3, 'the committed canonical state is complete JSON');
    check(stagedFiles(target).length === 0, 'successful publication leaves no staged file');

    fs.writeSync = (fd, buffer, offset, length, position) =>
      originalWriteSync(fd, buffer, offset, Math.min(length, 3), position);
    U.atomicJson(target, { revision: 4, value: 'short writes are completed' });
    fs.writeSync = originalWriteSync;
    check(JSON.parse(fs.readFileSync(target, 'utf8')).revision === 4, 'short filesystem writes are completed before publication');

    let writes = 0;
    fs.writeSync = (fd, buffer, offset, length, position) => {
      if (writes++ === 0) return originalWriteSync(fd, buffer, offset, Math.min(length, 3), position);
      throw new Error('injected staged-write interruption');
    };
    const beforeInterruptedWrite = fs.readFileSync(target, 'utf8');
    assert.throws(
      () => U.atomicJson(target, { revision: 5, value: 'must not publish' }),
      /injected staged-write interruption/,
    );
    fs.writeSync = originalWriteSync;
    check(fs.readFileSync(target, 'utf8') === beforeInterruptedWrite, 'interrupted staged writes cannot replace canonical state');
    check(stagedFiles(target).length === 0, 'interrupted staged writes are cleaned after handled failure');

    const fixedSuffix = Buffer.from('a1b2c3', 'hex');
    const occupiedStage = target + '.tmp-' + process.pid + '-a1b2c3';
    fs.writeFileSync(occupiedStage, 'foreign staged bytes', { flag: 'wx' });
    crypto.randomBytes = size => size === 3 ? fixedSuffix : originalRandomBytes(size);
    const beforeCollision = fs.readFileSync(target, 'utf8');
    assert.throws(() => U.atomicJson(target, { revision: 6 }), error => error && error.code === 'EEXIST');
    crypto.randomBytes = originalRandomBytes;
    check(fs.readFileSync(target, 'utf8') === beforeCollision, 'an occupied stage pathname cannot redirect publication');
    check(fs.readFileSync(occupiedStage, 'utf8') === 'foreign staged bytes', 'an occupied staged file is never overwritten or removed');

    assert.throws(() => U.atomicJson(target, undefined), /JSON-serializable value/);
    check(fs.readFileSync(target, 'utf8') === beforeCollision, 'a non-JSON top-level value is refused before state mutation');

    fs.fsyncSync = fd => {
      if (fs.fstatSync(fd).isDirectory()) throw new Error('directory sync unsupported');
      return originalFsyncSync(fd);
    };
    const weakerReceipt = U.atomicJson(target, { revision: 7, value: 'file-synced' });
    fs.fsyncSync = originalFsyncSync;
    check(weakerReceipt.directorySynced === false && weakerReceipt.fileSynced === true, 'unsupported directory sync is reported without denying the completed rename');
    check(JSON.parse(fs.readFileSync(target, 'utf8')).revision === 7, 'weaker directory evidence still identifies the published complete state');

    console.log('AXM atomic JSON publication self-test: ' + pass + ' checks passed.');
    return pass;
  } finally {
    fs.renameSync = originalRenameSync;
    fs.fsyncSync = originalFsyncSync;
    fs.writeSync = originalWriteSync;
    crypto.randomBytes = originalRandomBytes;
    fs.rmSync(root, { recursive: true, force: true });
  }
}

if (require.main === module) run();

module.exports = { run };
