#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const comparator = process.argv[2];
if (!comparator || !fs.existsSync(comparator)) throw new Error('pass the existing compare_capabilities.py path');
const dir = __dirname;
for (const phase of ['BEFORE','AFTER']) {
  const output = path.join(dir, 'CAPABILITY_GAP_' + phase + '.json');
  if (fs.existsSync(output)) fs.unlinkSync(output);
  const result = childProcess.spawnSync('python', [comparator, '--requirements', path.join(dir, 'CAPABILITY_REQUIREMENTS.json'), '--capabilities', path.join(dir, 'CAPABILITY_INVENTORY_' + phase + '.json'), '--output', output], { encoding:'utf8', windowsHide:true });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || 'capability comparator failed'));
}
console.log('PASS wrote deterministic before and after capability-gap reports');
