#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Continuity = require('./model-shadow-review-challenge-transition-local-possession-continuity');

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
if (!input || typeof input !== 'object') throw new Error('child input must be an object');
if (input.action === 'capture') {
  process.stdout.write(JSON.stringify({ pid: process.pid, snapshot: Continuity.captureState(input.options) }) + '\n');
} else if (input.action === 'captureAndAudit') {
  const snapshot = Continuity.captureState(input.options);
  const audit = Continuity.buildAudit({
    auditId: input.auditId,
    checkedAt: input.checkedAt,
    priorCheckpoint: input.priorCheckpoint,
    currentSnapshot: snapshot
  });
  process.stdout.write(JSON.stringify({ pid: process.pid, snapshot, audit }) + '\n');
} else {
  throw new Error('child action must be capture or captureAndAudit');
}
