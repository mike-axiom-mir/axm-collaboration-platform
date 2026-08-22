#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const commit = 'c64dd671c0c4bed1f798a546de879b48c8ac93cc';
const parent = '0ac8c4d6b3aa30636a17955ea67c79dfcff45efa';
const tree = '18eca92357ec1aace6f9b0c0ee6e1a8c5df2c8a8';
function git(args, encoding) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('git source snapshot command failed');
  return result.stdout;
}
function sha256(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }

const changed = String(git(['diff','--name-only',parent,commit,'--'])).trim().split(/\r?\n/).filter(Boolean).sort();
const files = changed.map(file => {
  const bytes = git(['show',commit + ':' + file], null);
  return { path:file, bytes:bytes.length, sha256:sha256(bytes) };
});
const receipt = {
  schema:'axm.product-source-snapshot/v1',
  status:'TEST',
  commit, parent, tree,
  files,
  browserFacingFilesChanged:files.some(item => /\.(?:html|css)$/i.test(item.path) || /(?:^|\/)app\.js$/i.test(item.path)),
  evidenceFilesIncluded:files.some(item => item.path.startsWith('docs/steward-runs/')),
  productDigest:null
};
const body = JSON.parse(Core.canonicalJson(receipt));
delete body.productDigest;
receipt.productDigest = sha256(Core.canonicalJson(body));
fs.writeFileSync(path.join(__dirname,'SOURCE_SNAPSHOT.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
process.stdout.write('SOURCE SNAPSHOT ' + files.length + ' files · ' + receipt.productDigest + '\n');
