#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..'));
const OUTPUT = path.resolve(process.argv[3] || path.join(__dirname, 'PROVENANCE_MAP.json'));

function git(args, encoding = 'utf8') {
  return execFileSync('git', ['-c', `safe.directory=${ROOT.replace(/\\/g, '/')}`, '-C', ROOT, ...args], {
    encoding,
    maxBuffer: 256 * 1024 * 1024,
  });
}

function blobOid(buffer) {
  return crypto.createHash('sha1').update(`blob ${buffer.length}\0`).update(buffer).digest('hex');
}

function currentPaths() {
  const chunks = git(['-c', 'core.quotepath=false', 'status', '--porcelain=v1', '-z', '-uall']).split('\0');
  const records = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const entry = chunks[index];
    if (!entry) continue;
    const status = entry.slice(0, 2);
    const relativePath = entry.slice(3).replace(/\\/g, '/');
    if (status.includes('R') || status.includes('C')) index += 1;
    const absolutePath = path.join(ROOT, ...relativePath.split('/'));
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) continue;
    const buffer = fs.readFileSync(absolutePath);
    const normalized = Buffer.from(buffer.toString('binary').replace(/\r\n/g, '\n'), 'binary');
    records.push({
      status,
      path: relativePath,
      rawOid: blobOid(buffer),
      normalizedOid: blobOid(normalized),
      exactRefs: [],
      normalizedRefs: [],
    });
  }
  return records;
}

const records = currentPaths();
const byPath = new Map(records.map((record) => [record.path, record]));
const refLines = git(['for-each-ref', '--format=%(refname:short)\t%(objectname)', 'refs/heads', 'refs/remotes/origin'])
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const [ref, commit] = line.split('\t');
    return { ref, commit };
  });
const commits = new Map();
for (const item of refLines) {
  if (!commits.has(item.commit)) commits.set(item.commit, []);
  commits.get(item.commit).push(item.ref);
}

const coverage = {};
for (const [commit, refs] of commits) {
  const tree = git(['ls-tree', '-rz', commit], 'buffer');
  for (const entry of tree.toString('binary').split('\0')) {
    if (!entry) continue;
    const tab = entry.indexOf('\t');
    if (tab < 0) continue;
    const header = entry.slice(0, tab).split(' ');
    const oid = header[2];
    const relativePath = Buffer.from(entry.slice(tab + 1), 'binary').toString('utf8');
    const record = byPath.get(relativePath);
    if (!record) continue;
    if (oid === record.rawOid) {
      record.exactRefs.push(...refs);
      for (const ref of refs) coverage[ref] = (coverage[ref] || 0) + 1;
    } else if (oid === record.normalizedOid) {
      record.normalizedRefs.push(...refs);
      for (const ref of refs) coverage[`${ref} (LF-normalized)`] = (coverage[`${ref} (LF-normalized)`] || 0) + 1;
    }
  }
}

for (const record of records) {
  record.exactRefs.sort();
  record.normalizedRefs.sort();
}

const result = {
  schema: 'axm-workshop-recovery-provenance-map/v1',
  generatedAt: new Date().toISOString(),
  root: '<AXM_WORKSHOP>',
  branch: git(['branch', '--show-current']).trim(),
  head: git(['rev-parse', 'HEAD']).trim(),
  method: 'Exact Git blob identity at the same path across local and origin branch tips; LF-normalized matches are reported separately.',
  summary: {
    dirtyFiles: records.length,
    exactMatchFiles: records.filter((record) => record.exactRefs.length).length,
    normalizedOnlyMatchFiles: records.filter((record) => !record.exactRefs.length && record.normalizedRefs.length).length,
    unmatchedFiles: records.filter((record) => !record.exactRefs.length && !record.normalizedRefs.length).length,
    coverage: Object.entries(coverage).sort((a, b) => b[1] - a[1]),
  },
  files: records,
};

fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
