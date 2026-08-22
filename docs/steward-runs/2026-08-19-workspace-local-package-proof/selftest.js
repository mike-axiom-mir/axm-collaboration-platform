#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const workshopRoot = path.resolve(__dirname, '..', '..', '..');
const packageTest = path.join(workshopRoot, 'tests', 'tool-forge-package-test.js');
const scratchRoot = path.join(workshopRoot, 'state', 'test-scratch', 'agent-tool-forge');
const proofPattern = /^mike\.package-proof-EXPERIMENTAL-.*\.zip$/;
let passed = 0;

function check(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  process.stdout.write('PASS ' + name + '\n');
}

function osTempProofs() {
  return fs.readdirSync(os.tmpdir()).filter(name => proofPattern.test(name)).sort();
}

function transientScratchDirectories() {
  if (!fs.existsSync(scratchRoot)) return [];
  return fs.readdirSync(scratchRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('package-proof-'))
    .map(entry => entry.name)
    .sort();
}

const source = fs.readFileSync(packageTest, 'utf8');
const beforeOsTemp = osTempProofs();
const beforeScratch = transientScratchDirectories();
const run = spawnSync(process.execPath, [packageTest], {
  cwd: workshopRoot,
  encoding: 'utf8',
  windowsHide: true
});

check('required package proof exits zero', run.status === 0);
check('required package proof emits no stderr', run.stderr === '');

let receipt;
try {
  receipt = JSON.parse(run.stdout);
} catch (error) {
  throw new Error('package proof did not emit one JSON receipt: ' + error.message);
}

const afterOsTemp = osTempProofs();
const afterScratch = transientScratchDirectories();
const transientOutput = path.resolve(workshopRoot, receipt.transientPath || '');
const relativeToWorkshop = path.relative(workshopRoot, transientOutput);
const insideWorkshop = relativeToWorkshop !== '' &&
  !path.isAbsolute(relativeToWorkshop) &&
  relativeToWorkshop !== '..' &&
  !relativeToWorkshop.startsWith('..' + path.sep);

check('test source no longer calls the host OS temp route', !source.includes('os.tmpdir') && !source.includes("require('os')"));
check('receipt declares the workspace-local transient route', receipt.route === 'workspace-local-transient');
check('receipt drive matches the current Workshop drive', receipt.workspaceRootDrive === path.parse(workshopRoot).root);
check('current Workshop package proof runs on D drive', path.parse(workshopRoot).root.toUpperCase() === 'D:\\');
check('reported transient output stays inside the Workshop', insideWorkshop);
check('reported transient output is under the owned state scratch lane', transientOutput.startsWith(scratchRoot + path.sep));
check('stored archive was read back byte-for-byte', receipt.writeVerified === true);
check('archive identity is recorded', Number.isInteger(receipt.archiveBytes) && receipt.archiveBytes > 0 && /^[a-f0-9]{64}$/.test(receipt.archiveSha256));
check('package remains explicitly uninstalled', receipt.installed === false);
check('package proof reports cleanup before return', receipt.storageState === 'CLEANED');
check('reported transient output no longer exists', !fs.existsSync(transientOutput));
check('no package-proof scratch directory was left behind', JSON.stringify(afterScratch) === JSON.stringify(beforeScratch));
check('no new matching package proof appeared in OS temp', JSON.stringify(afterOsTemp) === JSON.stringify(beforeOsTemp));
check('expected reviewable package files are present in the receipt', ['README.md', 'axm-foundation.js', 'draft.json', 'index.html', 'machine.js', 'manifest.json'].every(name => receipt.files.includes(name)));

const hostileBeforeOsTemp = osTempProofs();
const hostileBeforeScratch = transientScratchDirectories();
const hostileRun = spawnSync(process.execPath, [packageTest], {
  cwd: os.tmpdir(),
  encoding: 'utf8',
  windowsHide: true,
  env: Object.assign({}, process.env, { TEMP: os.tmpdir(), TMP: os.tmpdir() })
});
check('C-temp working directory and environment cannot redirect the proof', hostileRun.status === 0 && hostileRun.stderr === '');
const hostileReceipt = JSON.parse(hostileRun.stdout);
const hostileOutput = path.resolve(workshopRoot, hostileReceipt.transientPath || '');
check('adversarial launch still reports the D Workshop drive', hostileReceipt.workspaceRootDrive === 'D:\\');
check('adversarial launch still routes under Workshop scratch', hostileOutput.startsWith(scratchRoot + path.sep));
check('adversarial launch cleans its transient output', hostileReceipt.storageState === 'CLEANED' && !fs.existsSync(hostileOutput) && JSON.stringify(transientScratchDirectories()) === JSON.stringify(hostileBeforeScratch));
check('adversarial launch creates no new OS-temp proof ZIP', JSON.stringify(osTempProofs()) === JSON.stringify(hostileBeforeOsTemp));

process.stdout.write('\nWorkspace-local package proof audit: PASS (' + passed + ' checks)\n');
