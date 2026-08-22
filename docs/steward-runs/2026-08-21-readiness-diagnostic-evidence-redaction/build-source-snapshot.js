#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const BASELINE_COMMIT = 'f9558a2cb1427167c1cf7cc5e42f9fe35f086884';
const FIRST_PRODUCT_COMMIT = '4488f78661073e03d1493dbc1cd93677310aa58c';
const PRODUCT_COMMIT = '0533987856b321d67ede5f6d8a3fd8867f9cfbfb';
const PRODUCT_TREE = '6007cd2fc1143df2f2cf81ecc4639eed28c3274d';

function run(args, encoding) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || 'git failed'));
  return result.stdout;
}
function sha(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }

const observedTree = String(run(['show','-s','--format=%T',PRODUCT_COMMIT])).trim();
if (observedTree !== PRODUCT_TREE) throw new Error('product tree mismatch');
const names = String(run(['diff-tree','--no-commit-id','--name-only','-r',BASELINE_COMMIT,PRODUCT_COMMIT])).split(/\r?\n/).filter(Boolean).sort();
const files = names.map(name => {
  const bytes = run(['show',PRODUCT_COMMIT + ':' + name], null);
  return { path:name, bytes:bytes.length, sha256:sha(bytes) };
});
const snapshot = {
  schema:'axm.source-snapshot/v1',
  status:'TEST',
  baselineCommit:BASELINE_COMMIT,
  firstProductCommit:FIRST_PRODUCT_COMMIT,
  commit:PRODUCT_COMMIT,
  immediateParent:String(run(['show','-s','--format=%P',PRODUCT_COMMIT])).trim(),
  tree:PRODUCT_TREE,
  files,
  productDigest:null
};
const digestBody = JSON.parse(Core.canonicalJson(snapshot));
delete digestBody.productDigest;
snapshot.productDigest = sha(Core.canonicalJson(digestBody));
fs.writeFileSync(path.join(__dirname,'SOURCE_SNAPSHOT.json'), JSON.stringify(snapshot, null, 2) + '\n');
console.log('PASS source snapshot: ' + files.length + ' product files · ' + snapshot.productDigest);
