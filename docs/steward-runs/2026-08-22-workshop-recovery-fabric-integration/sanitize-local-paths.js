#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(process.argv[2]);
const OUTPUT = path.resolve(process.argv[3]);

function git(args) {
  return execFileSync('git', ['-c', `safe.directory=${ROOT.replace(/\\/g, '/')}`, '-C', ROOT, ...args], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

const statusChunks = git(['-c', 'core.quotepath=false', 'status', '--porcelain=v1', '-z', '-uall']).split('\0');
const paths = [];
for (let index = 0; index < statusChunks.length; index += 1) {
  const entry = statusChunks[index];
  if (!entry) continue;
  const status = entry.slice(0, 2);
  paths.push(entry.slice(3).replace(/\\/g, '/'));
  if (status.includes('R') || status.includes('C')) index += 1;
}

const replacements = [
  { id: 'escaped-workshop-root', pattern: /[A-Z]:\\\\AXM_ACTIVE\\\\workshop/gi, replacement: '<AXM_WORKSHOP>' },
  { id: 'windows-workshop-root', pattern: /[A-Z]:\\AXM_ACTIVE\\workshop/gi, replacement: '<AXM_WORKSHOP>' },
  { id: 'slash-workshop-root', pattern: /[A-Z]:\/AXM_ACTIVE\/workshop/gi, replacement: '<AXM_WORKSHOP>' },
  { id: 'escaped-mirror-root', pattern: /[A-Z]:\\\\AXM_ACTIVE\\\\mirror/gi, replacement: '<AXM_MIRROR>' },
  { id: 'windows-mirror-root', pattern: /[A-Z]:\\AXM_ACTIVE\\mirror/gi, replacement: '<AXM_MIRROR>' },
  { id: 'slash-mirror-root', pattern: /[A-Z]:\/AXM_ACTIVE\/mirror/gi, replacement: '<AXM_MIRROR>' },
  { id: 'escaped-axm-local-root', pattern: /[A-Z]:\\\\AXM_ACTIVE/gi, replacement: '<AXM_LOCAL_ROOT>' },
  { id: 'windows-axm-local-root', pattern: /[A-Z]:\\AXM_ACTIVE/gi, replacement: '<AXM_LOCAL_ROOT>' },
  { id: 'slash-axm-local-root', pattern: /[A-Z]:\/AXM_ACTIVE/gi, replacement: '<AXM_LOCAL_ROOT>' },
  { id: 'escaped-user-home', pattern: /[A-Z]:\\\\Users\\\\[^\\\s"']+/gi, replacement: '<USER_HOME>' },
  { id: 'windows-user-home', pattern: /[A-Z]:\\Users\\[^\\\s"']+/gi, replacement: '<USER_HOME>' },
];

const changes = [];
for (const relativePath of [...new Set(paths)]) {
  const absolutePath = path.join(ROOT, ...relativePath.split('/'));
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) continue;
  const buffer = fs.readFileSync(absolutePath);
  if (buffer.length > 10 * 1024 * 1024 || buffer.includes(0)) continue;
  const before = buffer.toString('utf8');
  let after = before;
  const counts = {};
  for (const rule of replacements) {
    let count = 0;
    after = after.replace(rule.pattern, () => {
      count += 1;
      return rule.replacement;
    });
    if (count) counts[rule.id] = count;
  }
  if (after === before) continue;
  fs.writeFileSync(absolutePath, after, 'utf8');
  changes.push({
    path: relativePath,
    beforeSha256: sha256(before),
    afterSha256: sha256(after),
    replacements: counts,
  });
}

const receipt = {
  schema: 'axm-local-path-sanitization/v1',
  generatedAt: new Date().toISOString(),
  valuesExposed: false,
  scope: 'Dirty text files only; local Workshop, mirror, and user-home roots replaced with portable placeholders.',
  changes,
  summary: { changedFiles: changes.length, replacements: changes.reduce((sum, item) => sum + Object.values(item.replacements).reduce((a, b) => a + b, 0), 0) },
};

fs.writeFileSync(OUTPUT, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(receipt.summary)}\n`);
