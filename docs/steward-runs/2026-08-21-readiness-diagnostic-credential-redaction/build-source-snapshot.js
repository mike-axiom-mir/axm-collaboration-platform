#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const BASELINE_COMMIT = 'd8e6644ce9d5bfd54fd0f122ebd9ebccbb2f7849';
const PRODUCT_COMMIT = '7b146a36d3e05041954050c7d5d5cd74440f6b50';
const PRODUCT_TREE = 'a27d5fcb82b614d5e9ca7fc5f7a3624ac81234a6';
function git(args, encoding) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('git read failed');
  return result.stdout;
}
function sha(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }
if (String(git(['show','-s','--format=%T',PRODUCT_COMMIT])).trim() !== PRODUCT_TREE) throw new Error('product tree mismatch');
const names = String(git(['diff-tree','--no-commit-id','--name-only','-r',BASELINE_COMMIT,PRODUCT_COMMIT])).split(/\r?\n/).filter(Boolean).sort();
const files = names.map(name => { const bytes = git(['show',PRODUCT_COMMIT + ':' + name], null); return { path:name, bytes:bytes.length, sha256:sha(bytes) }; });
const snapshot = { schema:'axm.source-snapshot/v1', status:'TEST', baselineCommit:BASELINE_COMMIT, commit:PRODUCT_COMMIT, immediateParent:String(git(['show','-s','--format=%P',PRODUCT_COMMIT])).trim(), tree:PRODUCT_TREE, files, productDigest:null };
const body = JSON.parse(JSON.stringify(snapshot)); delete body.productDigest;
snapshot.productDigest = sha(JSON.stringify(body));
fs.writeFileSync(path.join(__dirname, 'SOURCE_SNAPSHOT.json'), JSON.stringify(snapshot, null, 2) + '\n');
console.log('PASS source snapshot: ' + files.length + ' product files · ' + snapshot.productDigest);

