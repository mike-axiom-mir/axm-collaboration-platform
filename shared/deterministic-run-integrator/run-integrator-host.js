'use strict';

const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('./run-integrator-core');

const FIXED_COMMIT_ENV = Object.freeze({
  GIT_AUTHOR_NAME: 'AXM Deterministic Run Integrator',
  GIT_AUTHOR_EMAIL: 'run-integrator@axm.invalid',
  GIT_COMMITTER_NAME: 'AXM Deterministic Run Integrator',
  GIT_COMMITTER_EMAIL: 'run-integrator@axm.invalid'
});

function defaultRunner(command, args, options) {
  const result = childProcess.spawnSync(command, args, {
    cwd: options && options.cwd,
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    timeout: options && options.timeout || 120000,
    maxBuffer: 32 * 1024 * 1024,
    env: Object.assign({}, process.env, options && options.env || {})
  });
  return {
    status: result.error ? -1 : result.status,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || result.error && result.error.message || '')
  };
}

function publicError(error) {
  return String(error && (error.message || error) || 'unknown deterministic run integration failure')
    .replace(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*/gi, '[private-key-redacted]')
    .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, '[credential-redacted]')
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[credential-redacted]')
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, '[credential-redacted]')
    .replace(/https:\/\/[^\s/@:]+:[^\s/@]+@/gi, 'https://[credential-redacted]@')
    .replace(/[A-Za-z]:\\(?:Users|AXM_ACTIVE|AXM_MIRROR_LOCAL)\\[^\s]+/gi, '[local-path]')
    .replace(/\/(?:home|Users)\/[^/\s]+\/[^\s]*/g, '[local-path]')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 1000);
}

function tryRun(runner, command, args, options) {
  try { return runner(command, args, options || {}) || { status: -1, stdout: '', stderr: 'runner returned no result' }; }
  catch (error) { return { status: -1, stdout: '', stderr: String(error.message || error) }; }
}

function checked(runner, command, args, label, options) {
  const result = tryRun(runner, command, args, options);
  if (result.status !== 0) throw new Error(label + ' failed: ' + publicError(result.stderr || result.stdout));
  return String(result.stdout || '').trim();
}

function checkedRaw(runner, command, args, label, options) {
  const result = tryRun(runner, command, args, options);
  if (result.status !== 0) throw new Error(label + ' failed: ' + publicError(result.stderr || result.stdout));
  return String(result.stdout || '');
}

function realRoot(value, label) {
  const resolved = fs.realpathSync(path.resolve(String(value || '')));
  if (!fs.statSync(resolved).isDirectory()) throw new Error((label || 'root') + ' must be a directory');
  return resolved;
}

function samePath(left, right) {
  const normalize = value => path.resolve(value).replace(/[\\/]+$/, '').toLowerCase();
  return normalize(left) === normalize(right);
}

function isInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function git(runner, root, args, label, options) {
  return checked(runner, 'git', ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=.git/axm-hooks-disabled', '-C', root].concat(args), label, options);
}

function gitRaw(runner, root, args, label, options) {
  return checkedRaw(runner, 'git', ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=.git/axm-hooks-disabled', '-C', root].concat(args), label, options);
}

function gitTry(runner, root, args, options) {
  return tryRun(runner, 'git', ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=.git/axm-hooks-disabled', '-C', root].concat(args), options);
}

function exactRepositoryRoot(runner, value) {
  const root = realRoot(value, 'repositoryRoot');
  const top = realRoot(git(runner, root, ['rev-parse', '--show-toplevel'], 'Git top-level inspection'), 'Git top level');
  if (!samePath(root, top)) throw new Error('repositoryRoot must be the exact Git working-copy root');
  return root;
}

function gitCommonDirectory(runner, root) {
  const value = git(runner, root, ['rev-parse', '--git-common-dir'], 'Git common-directory inspection');
  return fs.realpathSync(path.resolve(root, value));
}

function parseStatusZ(output) {
  const parts = String(output || '').split('\0');
  if (parts[parts.length - 1] === '') parts.pop();
  const rows = [];
  const errors = [];
  for (let index = 0; index < parts.length; index += 1) {
    const entry = parts[index];
    if (entry.length < 4 || entry[2] !== ' ') {
      errors.push(entry.slice(0, 200));
      continue;
    }
    const status = entry.slice(0, 2);
    const targetPath = entry.slice(3).replace(/\\/g, '/');
    let fromPath = null;
    if (status.includes('R') || status.includes('C')) {
      fromPath = parts[index + 1] ? parts[index + 1].replace(/\\/g, '/') : null;
      index += 1;
    }
    try {
      rows.push({
        status,
        path: Core.repositoryPath(targetPath, 'Git status path'),
        fromPath: fromPath ? Core.repositoryPath(fromPath, 'Git status source path') : null,
        deleted: status.includes('D'),
        conflicted: ['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(status)
      });
    } catch (error) {
      errors.push(publicError(error));
    }
  }
  return { rows, errors };
}

function statusObservation(runner, root) {
  return parseStatusZ(gitRaw(runner, root, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], 'Git status inspection'));
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sensitiveSignals(buffer) {
  if (buffer.includes(0)) return [];
  const text = buffer.toString('utf8');
  const rows = [];
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(text)) rows.push('PRIVATE_KEY_MATERIAL');
  if (/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/.test(text)) rows.push('OPENAI_KEY_SHAPE');
  if (/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/.test(text)) rows.push('GITHUB_TOKEN_SHAPE');
  if (/Authorization\s*:\s*Bearer\s+[A-Za-z0-9._-]{16,}/i.test(text)) rows.push('AUTHORIZATION_BEARER_VALUE');
  if (/[A-Za-z]:\\(?:Users|AXM_ACTIVE|AXM_MIRROR_LOCAL)\\/i.test(text) || /\/(?:home|Users)\/[^/\s]+\//.test(text)) rows.push('LOCAL_MACHINE_PATH');
  return rows.sort();
}

function chunksForArguments(values, maximumCharacters) {
  const chunks = [];
  let current = [];
  let size = 0;
  values.forEach(value => {
    const length = String(value).length + 1;
    if (current.length && size + length > maximumCharacters) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(value);
    size += length;
  });
  if (current.length) chunks.push(current);
  return chunks;
}

function attributeFilters(runner, root, paths) {
  const found = new Map();
  chunksForArguments(paths, 7000).forEach(chunk => {
    const parts = gitRaw(runner, root, ['check-attr', '-z', 'filter', '--'].concat(chunk), 'Git filter attribute inspection').split('\0');
    if (parts[parts.length - 1] === '') parts.pop();
    if (parts.length % 3 !== 0) throw new Error('Git filter attribute output was malformed');
    for (let index = 0; index < parts.length; index += 3) {
      const file = Core.repositoryPath(parts[index].replace(/\\/g, '/'), 'Git attribute path');
      const value = parts[index + 2];
      if (value !== 'unspecified' && value !== 'unset') found.set(file, value || 'set');
    }
  });
  return found;
}

function parseIndexEntriesZ(output) {
  const found = new Map();
  String(output || '').split('\0').filter(Boolean).forEach(record => {
    const match = /^(\d+) ([a-f0-9]{40,64}) ([0-3])\t([\s\S]+)$/.exec(record);
    if (!match) throw new Error('Git index entry output was malformed');
    const file = Core.repositoryPath(match[4].replace(/\\/g, '/'), 'Git index path');
    if (match[3] === '0') found.set(file, { mode: match[1], objectId: match[2].toLowerCase() });
  });
  return found;
}

function indexEntries(runner, root, paths) {
  const found = new Map();
  chunksForArguments(paths, 7000).forEach(chunk => {
    const rows = parseIndexEntriesZ(gitRaw(runner, root, ['ls-files', '--stage', '-z', '--'].concat(chunk), 'Git index inspection'));
    rows.forEach((value, key) => found.set(key, value));
  });
  return found;
}

function enrichChanges(runner, root, status) {
  const livePaths = status.rows.filter(row => !row.deleted).map(row => row.path);
  const filters = attributeFilters(runner, root, livePaths);
  const existingIndex = indexEntries(runner, root, livePaths);
  const fileModeProbe = gitTry(runner, root, ['config', '--bool', 'core.filemode']);
  const honorsFileMode = fileModeProbe.status === 0 && String(fileModeProbe.stdout || '').trim() === 'true';
  return status.rows.map(row => {
    const full = path.resolve(root, row.path.split('/').join(path.sep));
    if (!isInside(root, full)) throw new Error('status path escaped the lane root');
    if (row.deleted) return Object.assign({}, row, { symlink: false, sizeBytes: 0, sha256: null, gitBlobId: null, gitMode: null, gitFilter: null, sensitiveSignals: [] });
    const stat = fs.lstatSync(full);
    if (!stat.isFile() && !stat.isSymbolicLink()) throw new Error('changed path is not a regular file: ' + row.path);
    const symlink = stat.isSymbolicLink();
    const body = symlink ? Buffer.from(fs.readlinkSync(full), 'utf8') : fs.readFileSync(full);
    const gitFilter = filters.get(row.path) || null;
    const indexed = existingIndex.get(row.path) || null;
    const gitMode = symlink ? null : (honorsFileMode ? ((stat.mode & 0o111) ? '100755' : '100644') : (indexed && indexed.mode || '100644'));
    const gitBlobId = symlink || gitFilter ? null : git(runner, root, ['hash-object', '--filters', '--path=' + row.path, '--', row.path], 'filtered Git blob inspection').toLowerCase();
    return Object.assign({}, row, {
      symlink,
      sizeBytes: body.length,
      sha256: sha256(body),
      gitBlobId,
      gitMode,
      gitFilter,
      sensitiveSignals: sensitiveSignals(body)
    });
  });
}

function parseWorktrees(output) {
  const blocks = String(output || '').trim().split(/\r?\n\r?\n/).filter(Boolean);
  return blocks.map(block => {
    const row = { worktree: null, head: null, branch: null };
    block.split(/\r?\n/).forEach(line => {
      const split = line.indexOf(' ');
      const key = split < 0 ? line : line.slice(0, split);
      const value = split < 0 ? '' : line.slice(split + 1);
      if (key === 'worktree') row.worktree = value;
      if (key === 'HEAD') row.head = value.toLowerCase();
      if (key === 'branch') row.branch = value.replace(/^refs\/heads\//, '');
    });
    return row;
  });
}

function inspectFacts(options) {
  const runner = options.runner || defaultRunner;
  const targetRoot = exactRepositoryRoot(runner, options.repositoryRoot);
  const laneRoot = realRoot(options.laneRoot, 'laneRoot');
  const targetStatus = statusObservation(runner, targetRoot);
  const laneStatus = statusObservation(runner, laneRoot);
  const targetBranch = git(runner, targetRoot, ['branch', '--show-current'], 'target branch inspection');
  const laneBranch = git(runner, laneRoot, ['branch', '--show-current'], 'lane branch inspection');
  const targetHead = git(runner, targetRoot, ['rev-parse', 'HEAD'], 'target head inspection').toLowerCase();
  const laneHead = git(runner, laneRoot, ['rev-parse', 'HEAD'], 'lane head inspection').toLowerCase();
  const targetCommon = gitCommonDirectory(runner, targetRoot);
  const laneCommon = gitCommonDirectory(runner, laneRoot);
  const worktrees = parseWorktrees(git(runner, targetRoot, ['worktree', 'list', '--porcelain'], 'worktree inventory'));
  const laneRegistered = worktrees.some(row => {
    try { return row.worktree && samePath(fs.realpathSync(row.worktree), laneRoot) && row.branch === laneBranch; }
    catch (_) { return false; }
  });
  return {
    gitAvailable: true,
    sameRepository: samePath(targetCommon, laneCommon),
    laneRegistered,
    laneOutsideTarget: !isInside(targetRoot, laneRoot),
    targetClean: targetStatus.rows.length === 0 && targetStatus.errors.length === 0,
    targetDetached: !targetBranch,
    targetBranch,
    targetHead,
    laneBranch,
    laneHead,
    statusParseErrors: laneStatus.errors.length,
    changes: enrichChanges(runner, laneRoot, laneStatus)
  };
}

function buildPlan(options) {
  return Core.buildPlan({ policy: options.policy, facts: inspectFacts(options) });
}

function beginExact(options) {
  const runner = options.runner || defaultRunner;
  let policy;
  try { policy = Core.normalizePolicy(options.policy); }
  catch (error) {
    return Core.buildReceipt({ phase: 'BEGIN', state: 'REFUSED', error: publicError(error), recovery: 'Correct the explicit policy; no worktree was created.' });
  }
  if (options.confirmation !== Core.BEGIN_CONFIRMATION) {
    return Core.buildReceipt({ phase: 'BEGIN', state: 'REFUSED', error: 'exact begin confirmation is required', recovery: 'Re-read the policy and provide the exact confirmation; no worktree was created.' });
  }
  let targetRoot = null;
  let laneRoot = null;
  let baseCommit = null;
  try {
    targetRoot = exactRepositoryRoot(runner, options.repositoryRoot);
    const targetBranch = git(runner, targetRoot, ['branch', '--show-current'], 'target branch inspection');
    baseCommit = git(runner, targetRoot, ['rev-parse', 'HEAD'], 'target head inspection').toLowerCase();
    const targetStatus = statusObservation(runner, targetRoot);
    if (targetBranch !== policy.targetBranch) throw new Error('target branch does not match policy');
    if (targetStatus.rows.length || targetStatus.errors.length) throw new Error('target worktree must be clean before a run lane is created');
    laneRoot = path.resolve(String(options.laneRoot || ''));
    if (!laneRoot || samePath(laneRoot, targetRoot) || isInside(targetRoot, laneRoot)) throw new Error('laneRoot must be an explicit path outside the target worktree');
    if (fs.existsSync(laneRoot)) throw new Error('laneRoot already exists');
    const parent = fs.realpathSync(path.dirname(laneRoot));
    if (!fs.statSync(parent).isDirectory()) throw new Error('laneRoot parent must already exist');
    const branchProbe = gitTry(runner, targetRoot, ['show-ref', '--verify', '--quiet', 'refs/heads/' + policy.laneBranch]);
    if (branchProbe.status === 0) throw new Error('lane branch already exists');
    if (branchProbe.status !== 1) throw new Error('lane branch availability could not be proven');
    git(runner, targetRoot, ['worktree', 'add', '-b', policy.laneBranch, laneRoot, baseCommit], 'isolated run worktree creation', { timeout: 10 * 60 * 1000 });
    const observed = inspectFacts({ repositoryRoot: targetRoot, laneRoot, runner });
    const checks = [
      { id: 'target-remained-clean', pass: observed.targetClean === true },
      { id: 'target-head-remained-exact', pass: observed.targetHead === baseCommit },
      { id: 'lane-registered', pass: observed.laneRegistered === true },
      { id: 'lane-repository-exact', pass: observed.sameRepository === true },
      { id: 'lane-outside-target', pass: observed.laneOutsideTarget === true },
      { id: 'lane-branch-exact', pass: observed.laneBranch === policy.laneBranch },
      { id: 'lane-base-exact', pass: observed.laneHead === baseCommit },
      { id: 'lane-started-clean', pass: observed.changes.length === 0 }
    ];
    return Core.buildReceipt({
      phase: 'BEGIN',
      state: checks.every(row => row.pass) ? 'PASS' : 'RECOVERY_REQUIRED',
      checks,
      result: { runId: policy.runId, targetBranch: policy.targetBranch, laneBranch: policy.laneBranch, baseCommit },
      recovery: checks.every(row => row.pass)
        ? 'Run the authorized builder only inside the isolated lane, then build a fresh integration plan.'
        : 'Stop. Preserve the lane and inspect its registration before any cleanup.'
    });
  } catch (error) {
    const laneExists = laneRoot && fs.existsSync(laneRoot);
    return Core.buildReceipt({
      phase: 'BEGIN',
      state: laneExists ? 'RECOVERY_REQUIRED' : 'REFUSED',
      checks: [{ id: 'target-head-known', pass: Core.isSha(baseCommit) }, { id: 'unproven-lane-absent', pass: !laneExists }],
      error: publicError(error),
      recovery: laneExists ? 'Stop. Preserve and inspect the partially created lane.' : 'No lane was created. Correct the refusal and retry from a clean target.'
    });
  }
}

function sameNames(left, right) {
  const a = Array.from(new Set(left)).sort();
  const b = Array.from(new Set(right)).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function currentTarget(runner, root) {
  const status = statusObservation(runner, root);
  return {
    branch: git(runner, root, ['branch', '--show-current'], 'target branch reinspection'),
    head: git(runner, root, ['rev-parse', 'HEAD'], 'target head reinspection').toLowerCase(),
    clean: status.rows.length === 0 && status.errors.length === 0
  };
}

function applyExact(options) {
  const runner = options.runner || defaultRunner;
  const plan = options.plan;
  if (options.confirmation !== Core.APPLY_CONFIRMATION) {
    return Core.buildReceipt({ phase: 'APPLY', state: 'REFUSED', planDigest: plan && plan.planDigest, error: 'exact apply confirmation is required', recovery: 'No Git mutation was attempted.' });
  }
  if (!plan || plan.state !== 'READY' || Core.verifyPlan(plan).state !== 'PASS') {
    return Core.buildReceipt({ phase: 'APPLY', state: 'REFUSED', planDigest: plan && plan.planDigest, error: 'a verified READY plan is required', recovery: 'Build a fresh plan from exact current state.' });
  }
  let targetRoot;
  let laneRoot;
  let runCommit = null;
  let runTree = null;
  let laneSealed = false;
  let indexPath = null;
  let indexBackup = null;
  try {
    targetRoot = exactRepositoryRoot(runner, options.repositoryRoot);
    laneRoot = realRoot(options.laneRoot, 'laneRoot');
    const fresh = buildPlan({ repositoryRoot: targetRoot, laneRoot, policy: options.policy, runner });
    if (fresh.planDigest !== plan.planDigest || fresh.state !== 'READY') {
      return Core.buildReceipt({ phase: 'APPLY', state: 'HELD', planDigest: plan.planDigest, blockers: fresh.blockers, error: 'integration plan is stale', recovery: 'No Git mutation was attempted. Build a fresh plan.' });
    }

    const policy = Core.normalizePolicy(options.policy);
    const pathspecs = policy.allowedPaths.map(value => value.endsWith('/') ? value.slice(0, -1) : value);
    indexPath = path.resolve(laneRoot, git(runner, laneRoot, ['rev-parse', '--git-path', 'index'], 'lane index path inspection'));
    if (!fs.existsSync(indexPath) || !fs.statSync(indexPath).isFile()) throw new Error('lane index file could not be proven');
    indexBackup = indexPath + '.axm-run-integrator-' + process.pid;
    fs.copyFileSync(indexPath, indexBackup, fs.constants.COPYFILE_EXCL);
    git(runner, laneRoot, ['add', '--all', '--'].concat(pathspecs), 'declared run staging');
    const stagedOutput = gitRaw(runner, laneRoot, ['diff', '--cached', '--name-only', '-z'], 'staged path inspection');
    const staged = stagedOutput ? stagedOutput.split('\0').filter(Boolean).map(value => value.replace(/\\/g, '/')) : [];
    const planned = plan.changes.map(row => row.path);
    if (!staged.length || !sameNames(staged, planned)) {
      fs.copyFileSync(indexBackup, indexPath);
      fs.rmSync(indexBackup, { force: true });
      indexBackup = null;
      return Core.buildReceipt({
        phase: 'APPLY', state: 'HELD', planDigest: plan.planDigest,
        blockers: [{ code: 'STAGED_SET_MISMATCH', plannedCount: planned.length, stagedCount: staged.length }],
        error: 'Git normalization did not produce the exact planned staged path set',
        recovery: 'The lane remains uncommitted. Reinspect generated or line-ending-only changes and build a fresh plan.'
      });
    }
    const stagedIndex = indexEntries(runner, laneRoot, planned);
    const stagedContentExact = plan.changes.every(row => {
      const entry = stagedIndex.get(row.path) || null;
      return row.deleted ? entry === null : !!entry && entry.objectId === row.gitBlobId && entry.mode === row.gitMode;
    });
    if (!stagedContentExact) {
      fs.copyFileSync(indexBackup, indexPath);
      fs.rmSync(indexBackup, { force: true });
      indexBackup = null;
      return Core.buildReceipt({
        phase: 'APPLY', state: 'HELD', planDigest: plan.planDigest,
        blockers: [{ code: 'STAGED_CONTENT_DRIFT' }],
        error: 'the staged Git blob or file mode did not match the exact planned content',
        recovery: 'The original lane index was restored. Reinspect concurrent edits or Git normalization and build a fresh plan.'
      });
    }
    runTree = git(runner, laneRoot, ['write-tree'], 'run tree creation').toLowerCase();
    const baseCommit = plan.repository.laneHead;
    const baseTimestamp = Number(git(runner, laneRoot, ['show', '-s', '--format=%ct', baseCommit], 'base timestamp inspection'));
    if (!Number.isSafeInteger(baseTimestamp) || baseTimestamp < 1) throw new Error('base commit timestamp is invalid');
    const commitTimestamp = baseTimestamp + 1;
    const deterministicDate = new Date(commitTimestamp * 1000).toISOString();
    const subject = 'AXM deterministic run: ' + policy.runId + ' @ ' + plan.planDigest.slice(0, 16);
    runCommit = checked(runner, 'git', ['-c', 'commit.gpgSign=false', '-C', laneRoot, 'commit-tree', runTree, '-p', baseCommit, '-m', subject], 'deterministic run commit creation', {
      env: Object.assign({}, FIXED_COMMIT_ENV, { GIT_AUTHOR_DATE: deterministicDate, GIT_COMMITTER_DATE: deterministicDate })
    }).toLowerCase();
    git(runner, laneRoot, ['update-ref', 'refs/heads/' + policy.laneBranch, runCommit, baseCommit], 'atomic lane branch seal');
    laneSealed = true;
    fs.rmSync(indexBackup, { force: true });
    indexBackup = null;
    const laneAfter = statusObservation(runner, laneRoot);
    if (laneAfter.rows.length || laneAfter.errors.length) throw new Error('sealed lane did not become clean');

    const targetBefore = currentTarget(runner, targetRoot);
    if (targetBefore.branch !== policy.targetBranch || targetBefore.head !== baseCommit || !targetBefore.clean) {
      return Core.buildReceipt({
        phase: 'APPLY', state: 'HELD', planDigest: plan.planDigest,
        checks: [{ id: 'run-lane-sealed-cleanly', pass: true }, { id: 'target-still-exact', pass: false }],
        result: { runId: policy.runId, runCommit, runTree, targetHead: targetBefore.head, lanePreserved: true },
        blockers: [{ code: 'TARGET_DRIFT_AFTER_SEAL' }],
        recovery: 'The exact run is safely committed in its lane. Do not merge manually; refresh and re-verify against the new target.'
      });
    }

    const merged = gitTry(runner, targetRoot, ['merge', '--ff-only', '--no-verify', runCommit], { timeout: 10 * 60 * 1000 });
    const targetAfter = currentTarget(runner, targetRoot);
    if (merged.status !== 0 || targetAfter.head !== runCommit || !targetAfter.clean) {
      return Core.buildReceipt({
        phase: 'APPLY', state: 'RECOVERY_REQUIRED', planDigest: plan.planDigest,
        checks: [{ id: 'run-lane-sealed-cleanly', pass: true }, { id: 'target-fast-forwarded', pass: targetAfter.head === runCommit }, { id: 'target-clean', pass: targetAfter.clean }],
        result: { runId: policy.runId, runCommit, runTree, targetHead: targetAfter.head, lanePreserved: true },
        error: publicError(merged.stderr || merged.stdout),
        recovery: 'Stop. The run lane is preserved. Inspect the target worktree before any further Git action.'
      });
    }

    const removed = gitTry(runner, targetRoot, ['worktree', 'remove', laneRoot], { timeout: 10 * 60 * 1000 });
    const branchDeleted = removed.status === 0
      ? gitTry(runner, targetRoot, ['branch', '-d', policy.laneBranch])
      : { status: -1, stdout: '', stderr: 'lane removal failed' };
    const cleanupPassed = removed.status === 0 && branchDeleted.status === 0 && !fs.existsSync(laneRoot);
    const finalTarget = currentTarget(runner, targetRoot);
    const checks = [
      { id: 'exact-run-tree-committed', pass: Core.isSha(runTree) && Core.isSha(runCommit) },
      { id: 'target-fast-forwarded-exactly', pass: finalTarget.head === runCommit },
      { id: 'target-branch-unchanged', pass: finalTarget.branch === policy.targetBranch },
      { id: 'target-worktree-clean', pass: finalTarget.clean === true },
      { id: 'lane-worktree-removed', pass: removed.status === 0 && !fs.existsSync(laneRoot) },
      { id: 'lane-branch-deleted', pass: branchDeleted.status === 0 }
    ];
    return Core.buildReceipt({
      phase: 'APPLY',
      state: checks.every(row => row.pass) ? 'PASS' : 'RECOVERY_REQUIRED',
      planDigest: plan.planDigest,
      checks,
      result: {
        runId: policy.runId,
        targetBranch: policy.targetBranch,
        previousTargetHead: baseCommit,
        integratedHead: runCommit,
        runTree,
        files: plan.summary.files,
        bytes: plan.summary.bytes,
        cleanupPassed,
        deterministicCommit: {
          subject,
          authorName: FIXED_COMMIT_ENV.GIT_AUTHOR_NAME,
          authorEmail: FIXED_COMMIT_ENV.GIT_AUTHOR_EMAIL,
          timestamp: commitTimestamp
        }
      },
      error: cleanupPassed ? null : publicError(removed.stderr || branchDeleted.stderr),
      recovery: cleanupPassed
        ? 'No cleanup required. Run the declared verification suite and deterministic PR checkpoint before publication.'
        : 'The target is integrated and clean, but lane cleanup was not fully proven. Inspect only the named lane registration and branch.'
    });
  } catch (error) {
    if (!laneSealed && indexBackup && indexPath) {
      try { fs.copyFileSync(indexBackup, indexPath); } catch (_) {}
      try { fs.rmSync(indexBackup, { force: true }); } catch (_) {}
    }
    let target = null;
    try { if (targetRoot) target = currentTarget(runner, targetRoot); } catch (_) {}
    return Core.buildReceipt({
      phase: 'APPLY', state: 'RECOVERY_REQUIRED', planDigest: plan && plan.planDigest,
      checks: [{ id: 'target-clean', pass: !!target && target.clean === true }],
      result: { runCommit, runTree, targetHead: target && target.head || null, lanePreserved: !!laneRoot && fs.existsSync(laneRoot) },
      error: publicError(error),
      recovery: 'Stop. Preserve the run lane and inspect exact target/lane state before any further Git action.'
    });
  }
}

module.exports = {
  FIXED_COMMIT_ENV,
  defaultRunner,
  publicError,
  tryRun,
  checked,
  checkedRaw,
  samePath,
  isInside,
  parseStatusZ,
  statusObservation,
  sensitiveSignals,
  chunksForArguments,
  attributeFilters,
  parseIndexEntriesZ,
  indexEntries,
  parseWorktrees,
  inspectFacts,
  buildPlan,
  beginExact,
  applyExact
};
