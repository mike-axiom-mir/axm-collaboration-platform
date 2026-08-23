'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const tokens = fs.readFileSync(path.join(__dirname, 'hub-tokens.css'), 'utf8');
const modern = fs.readFileSync(path.join(__dirname, 'modern-ui.css'), 'utf8');

assert.ok(
  /\.sentient-signal-field\s*\{[^}]*position\s*:\s*fixed[^}]*inset\s*:\s*0[^}]*pointer-events\s*:\s*none/s.test(tokens),
  'decorative signal canvas must stay outside shell grid layout',
);
assert.ok(
  /body\[data-mode="simple"\]\s+\.technical-card:not\(\.growth-home-card\)/.test(tokens),
  'simple mode may hide secondary technical cards without hiding the Observatory home card',
);
assert.equal(
  /body\[data-mode="simple"\]\s+#growthNavBtn\s*\{[^}]*display\s*:\s*none/s.test(modern),
  false,
  'Workshop Observatory navigation remains reachable in simple mode',
);

console.log('Hub layout fallback selftest: PASS · shell stays whole and Observatory stays reachable');
