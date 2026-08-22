#!/usr/bin/env node
'use strict';

const fs = require('fs');
const ReviewService = require('../operations/review-service');

try {
  const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const service = ReviewService.create({ stateRoot: input.stateRoot });
  const item = service.get(input.itemId);
  if (!item) throw new Error('review item not found in fresh process');
  process.stdout.write(JSON.stringify({ item }));
} catch (error) {
  process.stderr.write((error && error.stack ? error.stack : String(error)) + '\n');
  process.exitCode = 1;
}
