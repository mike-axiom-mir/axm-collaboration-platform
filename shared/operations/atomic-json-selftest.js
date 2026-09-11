#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
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

    console.log('AXM atomic JSON publication self-test: ' + pass + ' checks passed.');
    return pass;
  } finally {
    fs.renameSync = originalRenameSync;
    fs.fsyncSync = originalFsyncSync;
    fs.rmSync(root, { recursive: true, force: true });
  }
}

if (require.main === module) run();

module.exports = { run };
