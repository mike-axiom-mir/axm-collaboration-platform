#!/usr/bin/env node
/* ============================================================
   AXM SKIN — skin-assets.js
   The designer's spec sheet. Generated from ASSET_SLOTS in skin-core.js,
   so it can never drift from what the gate actually accepts.
     node hub/skin-assets.js          human-readable
     node hub/skin-assets.js --json   machine-readable
   ============================================================ */
'use strict';
const S = require('./skin-core.js');
const spec = S.assetSpec();

if (process.argv.includes('--json')) { console.log(JSON.stringify(spec, null, 2)); process.exit(0); }

console.log('AXM SKIN — ASSET SLOTS');
console.log('======================');
console.log(spec.length + ' slots. EVERY ONE IS OPTIONAL.');
console.log('A skin with zero assets is a complete skin — the shell renders without them.');
console.log('A missing asset leaves the hub plainer. It can never break it.\n');
console.log('Author at @2x. Vector (svg) where offered — it survives every screen.');
console.log('Assets live in the Asset Vault and are referenced as vault:<id>.');
console.log('A skin may not point at a URL. Local-first.\n');

spec.forEach(s => {
  console.log('  ' + s.slot);
  console.log('    size    : ' + s.w + ' x ' + s.h + '   (' + s.dpi + ')');
  console.log('    format  : ' + s.format);
  console.log('    where   : ' + s.where);
  console.log('    note    : ' + s.note);
  console.log('');
});

console.log('WHAT A SKIN CANNOT DO WITH AN ASSET');
console.log('  · use a slot that does not exist  -> refused, legal slots named');
console.log('  · load one from the internet      -> refused, vault: only');
console.log('  · hide a warning behind one       -> the readability floor still applies');
console.log('    to --gold, --red and --muted over --panel, whatever image is under them.');
console.log('');
console.log('MISSING ASSETS ARE ANNOUNCED, NEVER SILENT');
console.log('  Import a skin that references vault:nebula_bg when you do not have it and');
console.log('  the hub says so, applies the rest, and leaves that part plain.');
