#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

let failed = 0;
for (const file of ['engine.html', '../asset-vault/index.html']) {
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const scripts = source.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi);
  let count = 0;
  try {
    for (const match of scripts) { new Function(match[1]); count++; }
    console.log('PASS ' + file + ' · ' + count + ' inline script(s) compile');
  } catch (error) {
    failed++;
    console.error('FAIL ' + file + ' · ' + error.message);
  }
}
if (failed) process.exit(1);
