'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('./base-refresh-core');

const FIXED_COMMIT_ENV = {
  GIT_AUTHOR_NAME:'AXM Deterministic Base Refresher',
  GIT_AUTHOR_EMAIL:'base-refresh@axm.invalid',
  GIT_COMMITTER_NAME:'AXM Deterministic Base Refresher',
  GIT_COMMITTER_EMAIL:'base-refresh@axm.invalid'
};

function defaultRunner(command, args, options) {
  const result = childProcess.spawnSync(command, args, {
    encoding:'utf8',
    windowsHide:true,
    shell:false,
    timeout:options && options.timeout || 120000,
    maxBuffer:8 * 1024 * 1024,
    env:Object.assign({}, process.env, options && options.env || {})
  });
  return {
    status:result.error ? -1 : result.status,
    stdout:String(result.stdout || ''),
    stderr:String(result.stderr || result.error && result.error.message || '')
  };
}

function publicError(error) {
  return String(error && (error.message || error) || 'unknown base-refresh failure')
    .replace(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*/gi, '[private-key-redacted]')
    .replace(/\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, '[credential-redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]{24,}\b/g, '[credential-redacted]')
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[credential-redacted]')
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, '[credential-redacted]')
    .replace(/https:\/\/[^\s/@:]+:[^\s/@]+@/gi, 'https://[credential-redacted]@')
    .replace(/[A-Za-z]:\\(?:Users|AXM_ACTIVE|AXM_MIRROR_LOCAL)\\[^\s]+/gi, '[local-path]')
    .replace(/\/(?:home|Users)\/[^/\s]+\/[^\s]*/g, '[local-path]')
    .replace(/[\r\n]+/g, ' ')
    .slice(0,1000);
}

function cleanOutput(value) {
  return publicError(String(value || '')).slice(-1000);
}

function tryRun(runner, command, args, options) {
  try {
    return runner(command, args, options || {}) || { status:-1, stdout:'', stderr:'runner returned no result' };
  } catch (error) {
    return { status:-1, stdout:'', stderr:String(error.message || error) };
  }
}

function checked(runner, command, args, label, options) {
  const result = tryRun(runner, command, args, options);
  if (result.status !== 0) throw new Error(label + ' failed: ' + cleanOutput(result.stderr || result.stdout));
  return String(result.stdout || '').trim();
}

function isInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative !== '' && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
}

function safeRemoteName(value) {
  const text = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,60}$/.test(text)) throw new TypeError('checkpoint remote name is unsafe');
  return text;
}

function remoteIdentity(value) {
  const text = String(value || '').trim();
  let candidate = null;
  if (/^https:\/\/github\.com\//i.test(text)) candidate = text.replace(/^https:\/\//i, '').replace(/\.git$/i, '');
  else {
    const match = text.match(/^git@github\.com:([^\s]+)$/i);
    if (match) candidate = 'github.com/' + match[1].replace(/\.git$/i, '');
  }
  return candidate ? Core.repositoryIdentity(candidate) : null;
}

function parseRemoteRows(output) {
  const rows = new Map();
  String(output || '').split(/\r?\n/).filter(Boolean).forEach(line => {
    const match = line.match(/^([a-f0-9]{40,64})\s+refs\/heads\/(.+)$/i);
    if (match) rows.set(match[2], match[1].toLowerCase());
  });
  return rows;
}

function relation(runner, repositoryRoot, ancestor, descendant) {
  const result = tryRun(runner, 'git', ['-C', repositoryRoot, 'merge-base', '--is-ancestor', ancestor, descendant], { timeout:30000 });
  return { known:result.status === 0 || result.status === 1, value:result.status === 0 };
}

function inspectHost(options) {
  const runner = options.runner || defaultRunner;
  const repositoryRoot = fs.realpathSync(path.resolve(options.repositoryRoot));
  const publishRoot = fs.realpathSync(path.resolve(options.publishRoot));
  const checkpoint = options.checkpoint || {};
  const remoteName = safeRemoteName(checkpoint.repository && checkpoint.repository.remoteName || 'origin');
  const expectedBranch = Core.branchName(checkpoint.repository && checkpoint.repository.branch);
  const expectedIdentity = Core.repositoryIdentity(checkpoint.repository && checkpoint.repository.identity);
  const checkpointBase = String(checkpoint.repository && checkpoint.repository.baseCommit || '').toLowerCase();
  const checkpointHead = String(checkpoint.repository && checkpoint.repository.headCommit || '').toLowerCase();
  const gitProbe = tryRun(runner, 'git', ['--version'], { timeout:10000 });
  const facts = {
    publishLaneVerified:isInside(publishRoot, repositoryRoot),
    gitAvailable:gitProbe.status === 0,
    remoteQuerySucceeded:false,
    objectPreparationSucceeded:false,
    objectFetched:false,
    clean:false,
    branch:null,
    headCommit:null,
    repositoryIdentity:null,
    remoteMainCommit:null,
    remoteBranchCommit:null,
    baseRelationKnown:false,
    baseIsAncestorOfRemoteMain:false,
    remoteMainIsAncestorOfHead:false,
    headIsAncestorOfRemoteMain:false,
    mergeAnalysisSucceeded:false,
    conflictDetected:false,
    plannedMergeTree:null,
    plannedCommitTimestamp:null
  };
  if (!facts.gitAvailable) return facts;
  const top = fs.realpathSync(checked(runner, 'git', ['-C', repositoryRoot, 'rev-parse', '--show-toplevel'], 'Git top-level inspection'));
  if (top.toLowerCase() !== repositoryRoot.toLowerCase()) throw new Error('repositoryRoot must be the exact Git working-copy root');
  facts.branch = checked(runner, 'git', ['-C', repositoryRoot, 'branch', '--show-current'], 'Git branch inspection');
  facts.headCommit = checked(runner, 'git', ['-C', repositoryRoot, 'rev-parse', 'HEAD'], 'Git head inspection').toLowerCase();
  facts.clean = checked(runner, 'git', ['-C', repositoryRoot, 'status', '--porcelain=v1', '-z'], 'Git worktree inspection') === '';
  const remoteUrl = checked(runner, 'git', ['-C', repositoryRoot, 'remote', 'get-url', remoteName], 'Git remote inspection');
  facts.repositoryIdentity = remoteIdentity(remoteUrl);
  if (facts.repositoryIdentity !== expectedIdentity) return facts;

  const queried = tryRun(runner, 'git', ['-C', repositoryRoot, 'ls-remote', '--heads', remoteName, 'refs/heads/main', 'refs/heads/' + expectedBranch], { timeout:60000 });
  if (queried.status !== 0) return facts;
  const rows = parseRemoteRows(queried.stdout);
  facts.remoteMainCommit = rows.get('main') || null;
  facts.remoteBranchCommit = rows.get(expectedBranch) || null;
  facts.remoteQuerySucceeded = true;
  if (!Core.isSha(facts.remoteMainCommit)) return facts;

  let object = tryRun(runner, 'git', ['-C', repositoryRoot, 'cat-file', '-e', facts.remoteMainCommit + '^{commit}']);
  if (object.status !== 0) {
    const fetched = tryRun(runner, 'git', ['-C', repositoryRoot, 'fetch', '--no-tags', '--no-write-fetch-head', remoteName, facts.remoteMainCommit], { timeout:5 * 60 * 1000 });
    if (fetched.status !== 0) return facts;
    facts.objectFetched = true;
    object = tryRun(runner, 'git', ['-C', repositoryRoot, 'cat-file', '-e', facts.remoteMainCommit + '^{commit}']);
  }
  facts.objectPreparationSucceeded = object.status === 0;
  if (!facts.objectPreparationSucceeded || !Core.isSha(checkpointBase) || !Core.isSha(checkpointHead)) return facts;

  const baseRelation = relation(runner, repositoryRoot, checkpointBase, facts.remoteMainCommit);
  const mainInHead = relation(runner, repositoryRoot, facts.remoteMainCommit, checkpointHead);
  const headInMain = relation(runner, repositoryRoot, checkpointHead, facts.remoteMainCommit);
  facts.baseRelationKnown = baseRelation.known;
  facts.baseIsAncestorOfRemoteMain = baseRelation.value;
  facts.remoteMainIsAncestorOfHead = mainInHead.value;
  facts.headIsAncestorOfRemoteMain = headInMain.value;

  const needsAnalysis = facts.remoteMainCommit !== checkpointBase && !facts.remoteMainIsAncestorOfHead && !facts.headIsAncestorOfRemoteMain;
  if (!needsAnalysis) {
    facts.mergeAnalysisSucceeded = true;
    return facts;
  }
  const headTimestamp = Number(checked(runner, 'git', ['-C', repositoryRoot, 'show', '-s', '--format=%ct', checkpointHead], 'feature-head timestamp inspection'));
  const mainTimestamp = Number(checked(runner, 'git', ['-C', repositoryRoot, 'show', '-s', '--format=%ct', facts.remoteMainCommit], 'remote-main timestamp inspection'));
  facts.plannedCommitTimestamp = Math.max(headTimestamp, mainTimestamp) + 1;
  const merged = tryRun(runner, 'git', ['-C', repositoryRoot, 'merge-tree', '--write-tree', checkpointHead, facts.remoteMainCommit], { timeout:120000 });
  facts.mergeAnalysisSucceeded = merged.status === 0 || merged.status === 1;
  facts.conflictDetected = merged.status === 1;
  const firstLine = String(merged.stdout || '').split(/\r?\n/, 1)[0].trim().toLowerCase();
  facts.plannedMergeTree = Core.isSha(firstLine) ? firstLine : null;
  return facts;
}

function inspectApplied(runner, repositoryRoot, plan) {
  const headCommit = checked(runner, 'git', ['-C', repositoryRoot, 'rev-parse', 'HEAD'], 'post-refresh head inspection').toLowerCase();
  const headTree = checked(runner, 'git', ['-C', repositoryRoot, 'rev-parse', 'HEAD^{tree}'], 'post-refresh tree inspection').toLowerCase();
  const parents = checked(runner, 'git', ['-C', repositoryRoot, 'show', '-s', '--format=%P', 'HEAD'], 'post-refresh parent inspection').split(/\s+/).filter(Boolean).map(value => value.toLowerCase());
  const identity = checked(runner, 'git', ['-C', repositoryRoot, 'show', '-s', '--format=%s%n%an%n%ae%n%at%n%cn%n%ce%n%ct', 'HEAD'], 'post-refresh identity inspection').split(/\r?\n/);
  const branch = checked(runner, 'git', ['-C', repositoryRoot, 'branch', '--show-current'], 'post-refresh branch inspection');
  const clean = checked(runner, 'git', ['-C', repositoryRoot, 'status', '--porcelain=v1', '-z'], 'post-refresh worktree inspection') === '';
  const rows = parseRemoteRows(checked(runner, 'git', ['-C', repositoryRoot, 'ls-remote', '--heads', plan.repository.remoteName, 'refs/heads/main', 'refs/heads/' + plan.repository.branch], 'post-refresh remote inspection', { timeout:60000 }));
  const contains = relation(runner, repositoryRoot, plan.repository.remoteMainCommit, headCommit);
  return {
    branch,
    headCommit,
    headTree,
    parents,
    subject:identity[0] || null,
    authorName:identity[1] || null,
    authorEmail:identity[2] || null,
    authorTimestamp:identity[3] || null,
    committerName:identity[4] || null,
    committerEmail:identity[5] || null,
    committerTimestamp:identity[6] || null,
    clean,
    remoteMainCommit:rows.get('main') || null,
    remoteBranchCommit:rows.get(plan.repository.branch) || null,
    remoteMainIsAncestorOfHead:contains.known && contains.value,
    remoteWritePerformed:false
  };
}

function recoveryFacts(runner, repositoryRoot, plan) {
  let head = null, branch = null, clean = false;
  try { head = checked(runner, 'git', ['-C', repositoryRoot, 'rev-parse', 'HEAD'], 'recovery head inspection').toLowerCase(); } catch (_) {}
  try { branch = checked(runner, 'git', ['-C', repositoryRoot, 'branch', '--show-current'], 'recovery branch inspection'); } catch (_) {}
  try { clean = checked(runner, 'git', ['-C', repositoryRoot, 'status', '--porcelain=v1', '-z'], 'recovery worktree inspection') === ''; } catch (_) {}
  return { head, branch, clean, restored:!!plan && head === plan.repository.checkpointHeadCommit && branch === plan.repository.branch && clean };
}

function applyExact(options) {
  const runner = options.runner || defaultRunner;
  const plan = options.plan;
  if (options.confirmation !== Core.CONFIRMATION) {
    return Core.buildOutcomeReceipt({ state:'REFUSED', plan, error:'exact base-refresh confirmation is required', recovery:'Rebuild or re-read the plan; no merge was attempted.' });
  }
  if (Core.verifyPlan(plan).state !== 'PASS' || !plan || plan.state !== 'READY') {
    return Core.buildOutcomeReceipt({ state:'REFUSED', plan, error:'a verified READY base-refresh plan is required', recovery:'Resolve the typed hold and build a fresh plan.' });
  }
  const repositoryRoot = fs.realpathSync(path.resolve(options.repositoryRoot));
  try {
    const facts = inspectHost(options);
    const current = Core.buildPlan({ checkpoint:options.checkpoint, verification:options.verification, facts });
    if (current.planDigest !== plan.planDigest) throw new Error('base-refresh plan is stale; rebuild after current local and remote facts are observed');
    const message = 'AXM deterministic base refresh: main@' + plan.repository.remoteMainCommit;
    const deterministicDate = new Date(plan.analysis.plannedCommitTimestamp * 1000).toISOString();
    const merged = tryRun(runner, 'git', [
      '-c', 'commit.gpgSign=false',
      '-c', 'merge.autoStash=false',
      '-C', repositoryRoot,
      'merge', '--no-ff', '--no-edit', '--no-verify', '--no-gpg-sign', '-m', message,
      plan.repository.remoteMainCommit
    ], { timeout:5 * 60 * 1000, env:Object.assign({}, FIXED_COMMIT_ENV, { GIT_AUTHOR_DATE:deterministicDate, GIT_COMMITTER_DATE:deterministicDate }) });
    if (merged.status !== 0) {
      const aborted = tryRun(runner, 'git', ['-C', repositoryRoot, 'merge', '--abort'], { timeout:60000 });
      const recovered = recoveryFacts(runner, repositoryRoot, plan);
      if (recovered.restored) {
        return Core.buildOutcomeReceipt({
          state:'ROLLED_BACK', plan, attempted:true,
          result:{ branch:recovered.branch, previousHead:plan.repository.checkpointHeadCommit, remoteMainCommit:plan.repository.remoteMainCommit, localMergeCommit:null },
          checks:[{ id:'old-head-restored', pass:recovered.head === plan.repository.checkpointHeadCommit }, { id:'branch-restored', pass:recovered.branch === plan.repository.branch }, { id:'worktree-clean', pass:recovered.clean }],
          error:publicError(merged.stderr || merged.stdout),
          recovery:aborted.status === 0
            ? 'The failed merge was aborted and the exact checkpointed branch state was restored. Resolve the refusal separately and rebuild the plan.'
            : 'The merge was refused before an abortable merge state remained; exact checkpointed HEAD, branch, and cleanliness were independently re-proved. Resolve the refusal and rebuild the plan.'
        });
      }
      return Core.buildOutcomeReceipt({
        state:'RECOVERY_REQUIRED', plan, attempted:true,
        result:{ branch:recovered.branch, previousHead:plan.repository.checkpointHeadCommit, remoteMainCommit:plan.repository.remoteMainCommit, localMergeCommit:recovered.head },
        checks:[{ id:'old-head-restored', pass:recovered.head === plan.repository.checkpointHeadCommit }, { id:'branch-restored', pass:recovered.branch === plan.repository.branch }, { id:'worktree-clean', pass:recovered.clean }],
        error:publicError(merged.stderr || merged.stdout),
        recovery:'Stop. The merge failed and exact automatic restoration was not proven. Preserve this receipt and inspect the worktree before any reset or push.'
      });
    }
    return Core.buildSuccessReceipt({ plan, observed:inspectApplied(runner, repositoryRoot, plan) });
  } catch (error) {
    const recovered = recoveryFacts(runner, repositoryRoot, plan);
    return Core.buildOutcomeReceipt({
      state:recovered.restored ? 'REFUSED' : 'RECOVERY_REQUIRED', plan, attempted:false,
      result:{ branch:recovered.branch, previousHead:plan.repository.checkpointHeadCommit, remoteMainCommit:plan.repository.remoteMainCommit, localMergeCommit:recovered.head },
      checks:[{ id:'checkpoint-head-still-exact', pass:recovered.head === plan.repository.checkpointHeadCommit }, { id:'branch-still-exact', pass:recovered.branch === plan.repository.branch }, { id:'worktree-clean', pass:recovered.clean }],
      error:publicError(error),
      recovery:recovered.restored ? 'No merge was applied. Rebuild from fresh facts.' : 'Stop. Preserve this receipt and inspect the local feature worktree before any push or reset.'
    });
  }
}

module.exports = {
  FIXED_COMMIT_ENV,
  defaultRunner,
  publicError,
  isInside,
  remoteIdentity,
  parseRemoteRows,
  inspectHost,
  applyExact,
  recoveryFacts
};
