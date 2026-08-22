#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Bridge = require('./model-shadow-retention-audit-review-outcome-transition-settlement-history-reconciliation-review-request');

const packageFile = process.argv[2];
const payload = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
process.stdout.write(Bridge.stableStringify(Bridge.buildReviewRequest(payload.input)));
