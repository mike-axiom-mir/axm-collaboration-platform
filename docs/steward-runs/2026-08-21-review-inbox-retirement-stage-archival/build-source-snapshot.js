#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const commit = 'a71cd29a3c0652279e5f2db1a42067e7b2c632e5';
const parent = 'aafff013093cf0a23a4f49ba6a5c73acdc068238';
const tree = 'db8b749c7597b9af7fa0b901c1f917f6ef149b88';
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
  schema:'axm.product-source-snapshot/v1', status:'TEST', commit, parent, tree, files,
  browserFacingFilesChanged:files.some(item => /\.(?:html|css)$/i.test(item.path) || /(?:^|\/)app\.js$/i.test(item.path)),
  evidenceFilesIncluded:files.some(item => item.path.startsWith('docs/steward-runs/')),
  specialistPackageFilesIncluded:files.some(item => /AXM_MIRROR_SHADOW_SPECIALIST/i.test(item.path)),
  productDigest:null
};
const body = JSON.parse(Core.canonicalJson(receipt));
delete body.productDigest;
receipt.productDigest = sha256(Core.canonicalJson(body));
fs.writeFileSync(path.join(__dirname,'SOURCE_SNAPSHOT.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
process.stdout.write('SOURCE SNAPSHOT ' + files.length + ' files · ' + receipt.productDigest + '\n');
