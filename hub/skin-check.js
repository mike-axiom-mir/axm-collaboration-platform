#!/usr/bin/env node
/* ============================================================
   AXM SKIN — skin-check.js
   Review a submitted skin or pack with the SAME gate the hub uses.
   Nothing merges that fails here.
     node hub/skin-check.js exports/skins/daylight.skin.json
     node hub/skin-check.js somebodys.pack.json
   Exit 0 = accepted. Exit 1 = refused, with reasons.
   ============================================================ */
'use strict';
const fs = require('fs');
const S = require('./skin-core.js');

const file = process.argv[2];
if (!file) { console.error('usage: node hub/skin-check.js <skin.json | pack.json>'); process.exit(2); }

let data;
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error('REFUSED: not valid JSON — ' + e.message); process.exit(1); }

function reportSkin(s, label) {
  const a = S.accept(s, null);
  const fp = S.fingerprint(s);
  if (!a.ok) {
    console.log('REFUSED  ' + label + '  (' + a.stage + ' stage)');
    a.errors.forEach(e => console.log('   · ' + e));
    return false;
  }
  console.log('ACCEPTED ' + label);
  console.log('   fingerprint : ' + fp);
  console.log('   changes     : ' + a.changes.length + '  (' + a.changes.map(c => c.key).join(', ') + ')');
  console.log('   author      : ' + (s.author || 'none') + '   (a CLAIM — nothing here verifies identity)');
  (a.warnings || []).forEach(w => console.log('   warn        : ' + w));
  return true;
}

if (data.schema === S.PACK_SCHEMA) {
  const p = S.acceptPack(data);
  console.log('PACK: ' + (data.name || 'unnamed') + '  ·  ' + (data.skins || []).length + ' skin(s)\n');
  (data.skins || []).forEach((s, i) => { reportSkin(s, (s && s.name) || '#' + i); console.log(''); });
  console.log(p.note);
  process.exit(p.refused.length ? 1 : 0);
}

const ok = reportSkin(data, data.name || file);
process.exit(ok ? 0 : 1);
