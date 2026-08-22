#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Checkpoint = require('./model-shadow-retention-audit-review-outcome-history-checkpoint');

const packagePath = process.argv[2];
if (!packagePath) throw new Error('package path is required');
const value = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
let result;
if (value.action === 'validateCheckpoint') result = Checkpoint.validateCheckpoint(value.checkpoint);
else if (value.action === 'validateAudit') result = Checkpoint.validateAudit(value.audit);
else if (value.action === 'verifyCheckpointOrigin') result = Checkpoint.verifyCheckpointOrigin(value.input, value.checkpoint);
else if (value.action === 'verifyAudit') result = Checkpoint.verifyAudit(value.input, value.audit);
else throw new Error('unsupported action');
process.stdout.write(JSON.stringify({ pass: true, result }));
