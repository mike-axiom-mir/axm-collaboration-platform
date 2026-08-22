#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Anchor = require('./model-shadow-history-checkpoint-anchor');

try {
  const value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  let result;
  if (value.action === 'witness') result = Anchor.buildWitness(value.input);
  else if (value.action === 'anchor') result = Anchor.buildAnchoredCheckpoint(value.input);
  else if (value.action === 'audit') result = Anchor.buildAnchoredAudit(value.input);
  else throw new Error('unsupported child action');
  process.stdout.write(JSON.stringify({ pid: process.pid, result }));
} catch (error) {
  process.stderr.write(error.stack || error.message);
  process.exitCode = 1;
}
