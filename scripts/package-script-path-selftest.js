#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const references = [];
Object.entries(pkg.scripts || {}).forEach(([script, command]) => {
  const matches = String(command).matchAll(/(?:^|\s)([^\s&|"']+\.(?:js|mjs|cjs))(?:\s|$)/g);
  for (const match of matches) references.push({ script, file: match[1] });
});
const missing = references.filter(item => {
  if (!item.file.includes('*')) return !fs.existsSync(path.resolve(root, item.file));
  const folder = path.dirname(item.file), expression = new RegExp('^' + path.basename(item.file).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  try { return !fs.readdirSync(path.resolve(root, folder)).some(name => expression.test(name)); }
  catch (error) { return true; }
});
assert.equal(missing.length, 0, 'package scripts reference missing files: ' + missing.map(item => item.script + '=' + item.file).join(', '));
console.log('package script path selftest: PASS (' + references.length + ' file references)');
