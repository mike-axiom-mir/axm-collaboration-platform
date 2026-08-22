#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const path = require('path');

const suites = [
  'game-night-selftest.js',
  'game-package-verifier-selftest.js',
  'asset-handoff-selftest.js',
  'game-runtime-port-selftest.js',
  'game-engine/runtime-idle-integration-selftest.js',
  'universal-control-policy-selftest.js',
  'game-experience-recovery-selftest.js'
];

suites.forEach(relative => {
  childProcess.execFileSync(process.execPath, [path.join(__dirname, relative)], {
    cwd: __dirname,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true
  });
});

console.log('Game Hub selftest: PASS · ' + suites.length + ' bounded core suites');
