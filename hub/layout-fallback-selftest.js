'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, 'hub-tokens.css'), 'utf8');

assert.ok(
  /\.sentient-signal-field\s*\{[^}]*position\s*:\s*fixed[^}]*inset\s*:\s*0[^}]*pointer-events\s*:\s*none/s.test(css),
  'decorative signal canvas must stay outside shell grid layout',
);

console.log('Hub layout fallback selftest: PASS · decorative canvas cannot reserve a grid row');

