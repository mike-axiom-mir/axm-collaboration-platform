#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Anchor = require('./model-shadow-retention-audit-review-outcome-history-checkpoint-anchor');

const request = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let result;
if (request.action === 'witness') result = Anchor.buildWitness(request.input);
else if (request.action === 'anchor') result = Anchor.buildAnchoredCheckpoint(request.input);
else if (request.action === 'audit') result = Anchor.buildAnchoredAudit(request.input);
else throw new Error('unsupported child action');
process.stdout.write(JSON.stringify({ pid: process.pid, result }));
