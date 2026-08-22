#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..'));
const OUTPUT = path.resolve(process.argv[3] || path.join(__dirname, 'FABRIC_MERGE_CONSTRUCTION.json'));
const EXPECTED_HEAD = 'c6e7909267f51a6fa14395e46d6917678ef87d06';
const FABRIC = 'a580f6496fa57c84f994447d03e9569119796b49';
const EXPECTED_BRANCH = 'codex/workshop-recovery-fabric-integration-20260822';
const EXPECTED_CONFLICTS = [
  'hub/css-skin-fabric-adapter.css',
  'hub/css-skin-fabric-selftest.js',
  'hub/hub-selftest.js',
  'hub/index.html',
  'package.json',
  'tools/skinner/index.html',
  'tools/skinner/module.contract.json',
  'tools/skinner/selftest.js',
];
const TAKE_FABRIC = [
  'hub/css-skin-fabric-adapter.css',
  'hub/css-skin-fabric-selftest.js',
  'hub/hub-selftest.js',
  'tools/skinner/module.contract.json',
  'tools/skinner/selftest.js',
];
const TAKE_WORKTREE = [
  'hub/index.html',
  'package.json',
  'tools/skinner/index.html',
];

function run(args, options = {}) {
  const result = spawnSync('git', ['-c', `safe.directory=${ROOT.replace(/\\/g, '/')}`, '-C', ROOT, ...args], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: options.env || process.env,
    input: options.input,
  });
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed (${result.status}): ${result.stderr || result.stdout}`);
  }
  return result;
}

function text(args, options = {}) {
  return run(args, options).stdout.trim();
}

const branch = text(['branch', '--show-current']);
const head = text(['rev-parse', 'HEAD']);
if (branch !== EXPECTED_BRANCH) throw new Error(`Expected branch ${EXPECTED_BRANCH}, found ${branch}`);
if (head !== EXPECTED_HEAD) throw new Error(`Expected HEAD ${EXPECTED_HEAD}, found ${head}`);
if (run(['diff', '--cached', '--quiet'], { allowFailure: true }).status !== 0) {
  throw new Error('The real index contains staged changes; refusing low-level merge construction.');
}

const merge = run(['merge-tree', '--write-tree', head, FABRIC], { allowFailure: true });
if (![0, 1].includes(merge.status)) throw new Error(`merge-tree failed: ${merge.stderr || merge.stdout}`);
const lines = merge.stdout.split(/\r?\n/).filter(Boolean);
const unresolvedTree = lines[0];
if (!/^[0-9a-f]{40}$/.test(unresolvedTree)) throw new Error('merge-tree did not return a tree object.');
const observedConflicts = [...new Set(lines
  .filter((line) => /^\d{6} [0-9a-f]{40} [123]\t/.test(line))
  .map((line) => line.split('\t')[1]))].sort();
if (JSON.stringify(observedConflicts) !== JSON.stringify([...EXPECTED_CONFLICTS].sort())) {
  throw new Error(`Conflict set changed: ${JSON.stringify(observedConflicts)}`);
}

const tempIndex = path.join(os.tmpdir(), `axm-fabric-merge-${process.pid}-${Date.now()}.index`);
const tempEnv = { ...process.env, GIT_INDEX_FILE: tempIndex };
const resolutions = [];

try {
  run(['read-tree', unresolvedTree], { env: tempEnv });

  for (const relativePath of TAKE_FABRIC) {
    const entry = text(['ls-tree', FABRIC, '--', relativePath]);
    const match = entry.match(/^(\d{6}) blob ([0-9a-f]{40})\t/);
    if (!match) throw new Error(`Missing Fabric blob for ${relativePath}`);
    run(['update-index', '--add', '--cacheinfo', match[1], match[2], relativePath], { env: tempEnv });
    resolutions.push({ path: relativePath, resolution: 'fabric-tip', blob: match[2] });
  }

  for (const relativePath of TAKE_WORKTREE) {
    const absolutePath = path.join(ROOT, ...relativePath.split('/'));
    const entry = text(['ls-files', '-s', '--', relativePath]);
    const mode = (entry.match(/^(\d{6}) /) || [null, '100644'])[1];
    const blob = text(['hash-object', '-w', '--path', relativePath, absolutePath]);
    run(['update-index', '--add', '--cacheinfo', mode, blob, relativePath], { env: tempEnv });
    resolutions.push({ path: relativePath, resolution: 'preserved-worktree-superset', blob });
  }

  const unmerged = text(['ls-files', '-u'], { env: tempEnv });
  if (unmerged) throw new Error(`Unmerged entries remain:\n${unmerged}`);
  const resolvedTree = text(['write-tree'], { env: tempEnv });
  const message = [
    'merge: integrate completed Code Capability Fabric TEST',
    '',
    'Preserve the canonical visual-fabric history while integrating the completed',
    'provider-neutral Fabric lineage at a580f649. Conflict resolutions retain the',
    'Fabric versions where the dirty checkout matched them exactly and retain the',
    'three evidence-backed local supersets for Hub guidance, package tests, and',
    'Skinner accessibility labels.',
    '',
    'Status remains TEST. No runtime activation, promotion, CANON, or push.',
    '',
  ].join('\n');
  const commit = text(['commit-tree', resolvedTree, '-p', head, '-p', FABRIC], { input: message });
  run(['update-ref', `refs/heads/${branch}`, commit, head]);
  run(['read-tree', commit]);

  const receipt = {
    schema: 'axm-fabric-semantic-merge-construction/v1',
    generatedAt: new Date().toISOString(),
    branch,
    previousHead: head,
    fabricTip: FABRIC,
    mergeBase: text(['merge-base', head, FABRIC]),
    unresolvedTree,
    resolvedTree,
    mergeCommit: commit,
    conflicts: observedConflicts,
    resolutions,
    indexUpdatedWithoutWorktreeCheckout: true,
    runtimeExecuted: false,
    pushed: false,
    promoted: false,
    canonized: false,
  };
  fs.writeFileSync(OUTPUT, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
} finally {
  if (fs.existsSync(tempIndex)) fs.unlinkSync(tempIndex);
}
