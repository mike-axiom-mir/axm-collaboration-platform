#!/usr/bin/env node
'use strict';

const fs = require('fs');
const PinTransition = require('./model-shadow-history-checkpoint-pin-transition');

try {
  const value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  process.stdout.write(JSON.stringify({
    pid: process.pid,
    genesisPin: PinTransition.buildGenesisPin(value.genesisInput),
    transition: PinTransition.buildTransition(value.transitionInput)
  }));
} catch (error) {
  process.stderr.write(error.stack || error.message);
  process.exitCode = 1;
}
