#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');
const ROOT = path.resolve(__dirname, '../../..');
const EVIDENCE_PREFIX = 'docs/steward-runs/2026-08-21-review-inbox-operation-lease/';

function git(args, encoding) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || 'git command failed'));
  return result.stdout;
}
const commit = String(process.argv[2] || git(['rev-parse','HEAD'])).trim();
const parent = String(git(['rev-parse',commit + '^'])).trim();
const tree = String(git(['rev-parse',commit + '^{tree}'])).trim();
const changed = String(git(['diff-tree','--no-commit-id','--name-only','-r',parent,commit])).split(/\r?\n/).filter(Boolean);
if (changed.some(file => /AXM_MIRROR_SHADOW_SPECIALIST/i.test(file))) throw new Error('excluded specialist ZIP lane appeared in the product commit');
const files = changed.filter(file => !file.startsWith(EVIDENCE_PREFIX)).sort().map(file => {
  const bytes = git(['show',commit + ':' + file], null);
  return { path:file.replace(/\\/g,'/'), bytes:bytes.length, sha256:'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex') };
});
if (!files.length) throw new Error('source snapshot found no product files');
const snapshot = {
  schema:'axm.normalized-source-snapshot/v1', status:'TEST', commit, parent, tree,
  exclusions:[EVIDENCE_PREFIX + '**', 'incoming AXM_MIRROR_SHADOW_SPECIALIST ZIP packages'],
  files, productDigest:null
};
const payload = JSON.parse(Core.canonicalJson(snapshot)); delete payload.productDigest;
snapshot.productDigest = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex');
fs.writeFileSync(path.join(__dirname, 'SOURCE_SNAPSHOT.json'), JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
console.log('PASS source snapshot ' + files.length + ' product files ' + snapshot.productDigest);
