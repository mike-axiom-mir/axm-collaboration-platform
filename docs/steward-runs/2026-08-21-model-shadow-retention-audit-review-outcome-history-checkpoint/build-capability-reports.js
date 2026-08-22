#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const comparator = process.argv[2];
if (!comparator || !path.isAbsolute(comparator)) throw new Error('absolute capability comparator path argument is required');
const requirements = path.join(dir, 'CAPABILITY_REQUIREMENTS.json');

for (const phase of ['BEFORE', 'AFTER']) {
  const inventory = path.join(dir, 'CAPABILITY_INVENTORY_' + phase + '.json');
  const result = childProcess.spawnSync('python', [comparator, '--requirements', requirements, '--capabilities', inventory], {
    cwd: path.resolve(dir, '../../..'), encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error('capability comparator failed for ' + phase + ': ' + (result.stderr || result.stdout));
  const parsed = JSON.parse(result.stdout);
  fs.writeFileSync(path.join(dir, 'CAPABILITY_GAP_' + phase + '.json'), JSON.stringify(parsed, null, 2) + '\n', 'utf8');
  console.log('PASS wrote ' + phase.toLowerCase() + ' capability report: ' + parsed.overall);
}
