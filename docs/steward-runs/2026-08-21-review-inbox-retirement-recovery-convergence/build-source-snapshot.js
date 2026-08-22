#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const COMMIT = 'ff0b8e3a2040de6f25082e83af83c13b6cff9237';
const PARENT = '8f41d9e039179245d9e7923202d7c82b82158932';
const TREE = '9a9beb9f5f6cc13d6ad73f1ea55cc3d683e65c9c';
function git(args, encoding) { const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:32 * 1024 * 1024 }); if (result.status !== 0) throw new Error('git command failed'); return result.stdout; }
function sha256(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }
const names = String(git(['diff-tree','--no-commit-id','--name-only','-r',PARENT,COMMIT])).split(/\r?\n/).filter(Boolean).sort();
const files = names.map(name => { const bytes = git(['show',COMMIT + ':' + name], null); return { path:name, bytes:bytes.length, sha256:sha256(bytes) }; });
const receipt = { schema:'axm.source-snapshot/v1', status:'TEST', commit:COMMIT, parent:PARENT, tree:TREE, files, productDigest:null };
const body = JSON.parse(Core.canonicalJson(receipt)); delete body.productDigest;
receipt.productDigest = sha256(Buffer.from(Core.canonicalJson(body)));
fs.writeFileSync(path.join(__dirname, 'SOURCE_SNAPSHOT.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log('SOURCE SNAPSHOT ' + files.length + ' product files');
