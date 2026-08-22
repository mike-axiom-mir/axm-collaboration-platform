#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Possession = require('./model-shadow-review-challenge-transition-local-possession-challenge');

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
if (!input || typeof input !== 'object') throw new Error('child input must be an object');
const service = Possession.createReceiver(input.options);
let output;
if (input.action === 'answer') output = service.answer(input.input);
else if (input.action === 'reload') output = service.reload(input.input);
else throw new Error('child action must be answer or reload');
process.stdout.write(JSON.stringify({ pid: process.pid, output }) + '\n');
