#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const product = 'fa6f8fd94145ad58c6388bb64b62e5d75c19a46e';
const parent = '5087e5dc6d7744b9814d6b4697a1ae299e44b773';
function git(args, encoding) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('git source read failed');
  return result.stdout;
}
function sha256(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }

const tree = String(git(['rev-parse', product + '^{tree}'])).trim();
const files = String(git(['diff','--name-only',parent,product,'--'])).trim().split(/\r?\n/).filter(Boolean).map(file => {
  const bytes = git(['show', product + ':' + file], null);
  return { path:file.replace(/\\/g, '/'), bytes:bytes.length, sha256:sha256(bytes) };
});
const snapshot = { schema:'axm.source-snapshot/v1', status:'TEST', commit:product, parent, tree, files, productDigest:null };
const body = JSON.parse(Core.canonicalJson(snapshot));
delete body.productDigest;
snapshot.productDigest = sha256(Core.canonicalJson(body));
fs.writeFileSync(path.join(__dirname, 'SOURCE_SNAPSHOT.json'), JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
console.log('SOURCE SNAPSHOT ' + files.length + ' exact product files');
