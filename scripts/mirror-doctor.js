'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const required = [
  'README.md', 'STATUS.json', 'MODEL_BOM.json', 'roots/AXM_ROOTS_v1.json',
  'kernel/state-language.js', 'kernel/principle-cell.js', 'runtime/server.js',
  'contracts/api-contract.json', 'adapters/workshop/mirror-provider.js'
];
const missing = required.filter(file => !fs.existsSync(path.join(ROOT, file)));
const status = JSON.parse(fs.readFileSync(path.join(ROOT, 'STATUS.json'), 'utf8'));
const model = JSON.parse(fs.readFileSync(path.join(ROOT, 'MODEL_BOM.json'), 'utf8'));
const tokenFile = path.join(ROOT, 'state', 'runtime-token.txt');
const pidFile = path.join(ROOT, 'state', 'runtime.pid');

console.log('AXM Mirror Doctor');
console.log(`Identity: ${status.identity || 'missing'}`);
console.log(`Body: ${status.body || 'unknown'}`);
console.log(`Learned weights: ${model.learnedWeights === true ? 'yes' : 'no'}`);
console.log(`Runtime token: ${fs.existsSync(tokenFile) ? 'present (value hidden)' : 'created on first start'}`);
console.log(`Runtime PID: ${fs.existsSync(pidFile) ? fs.readFileSync(pidFile, 'utf8').trim() : 'offline'}`);
if (missing.length) {
  console.error(`Missing required files: ${missing.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Structure: PASS');
}
