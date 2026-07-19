#!/usr/bin/env node
'use strict';

const path = require('path');
const suites = [
  './steward-selftest.js',
  './deterministic-replay.test.js',
  './resource-integrity.test.js',
  './emergence-boundary.test.js',
  './emergence-memory.test.js',
  './globe-isolation.test.js'
];

let pass = 0;
let fail = 0;
const results = [];

function test(name, requirement, fn) {
  try {
    fn();
    pass += 1;
    results.push({ name, requirement, status: 'PASS' });
    console.log('PASS [' + requirement + '] ' + name);
  } catch (error) {
    fail += 1;
    results.push({ name, requirement, status: 'FAIL', error: error.stack || error.message });
    console.error('FAIL [' + requirement + '] ' + name + '\n  ' + String(error.stack || error.message).replace(/\n/g, '\n  '));
  }
}

suites.forEach(file => require(path.join(__dirname, file))({ test }));

console.log('\nAXM TYCOON STEWARD HONEST EXAM — ' + pass + ' PASS · ' + fail + ' FAIL');
console.log('Node ' + process.version + ' · dependency-free · browser click test separate');
process.exitCode = fail ? 1 : 0;

module.exports = { results };
