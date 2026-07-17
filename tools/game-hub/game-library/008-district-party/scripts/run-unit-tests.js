'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const tests = fs.readdirSync(path.join(root, 'tests'))
  .filter((name) => name.endsWith('.test.js') && name !== 'browser-smoke.test.js')
  .sort()
  .map((name) => path.join('tests', name));

if (!tests.length) {
  console.error('No non-browser tests were found.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...tests], { cwd: root, stdio: 'inherit' });
process.exit(result.status == null ? 1 : result.status);
