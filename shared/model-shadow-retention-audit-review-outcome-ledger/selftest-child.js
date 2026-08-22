#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Ledger = require('./model-shadow-retention-audit-review-outcome-ledger');

const packagePath = process.argv[2];
if (!packagePath) throw new Error('package path is required');
const value = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const service = Ledger.createService(value.serviceOptions);
let result;
if (value.action === 'capture') result = service.capture(value.input);
else if (value.action === 'inspect') result = service.inspect();
else if (value.action === 'read') result = service.read(value.sequence);
else if (value.action === 'readAll') result = service.readAll();
else if (value.action === 'verify') result = service.verifyPersisted(value.record);
else throw new Error('unsupported action');
process.stdout.write(JSON.stringify({ pass: true, result }));
