#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const ROOT = path.resolve(__dirname, '..', '..');
const PARTS = path.join(__dirname, 'bootstrap-parts');
const encoded = fs.readdirSync(PARTS).filter(name => /^part-\d+\.txt$/.test(name)).sort().map(name => fs.readFileSync(path.join(PARTS, name), 'utf8').trim()).join('');
const files = JSON.parse(zlib.gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'));
for (const [relative, content] of Object.entries(files)) {
  const target = path.join(ROOT, relative.replace(/\//g, path.sep));
  fs.mkdirSync(path.dirname(target), { recursive:true });
  fs.writeFileSync(target, content.replace(/\r\n/g, '\n'), 'utf8');
}
fs.rmSync(PARTS, { recursive:true, force:true });
fs.rmSync(__filename, { force:true });
console.log(JSON.stringify({ ok:true, materialized:Object.keys(files).sort() }, null, 2));
