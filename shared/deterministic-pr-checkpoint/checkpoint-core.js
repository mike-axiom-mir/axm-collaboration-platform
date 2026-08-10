'use strict';

const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const DeterministicJson = require('../../tools/deterministic-json-core');

const POLICY_SCHEMA = 'axm.git-pr-scope-policy/v1';
const EVIDENCE_SCHEMA = 'axm.git-pr-evidence-input/v1';
const CHECKPOINT_SCHEMA = 'axm.git-pr-checkpoint/v1';
const VERIFICATION_SCHEMA = 'axm.git-pr-checkpoint-verification/v1';
const REVIEW_METADATA_SCHEMA = 'axm.git-pr-review-metadata/v1';
const REVIEW_PACKET_SCHEMA = 'axm.git-pr-review-packet/v1';
const POLICY_VERSION = 'axm-deterministic-pr-checkpoint-policy/0.1';
const ZERO_DIGEST = '0'.repeat(64);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalDigest(value) {
  return sha256(Buffer.from(DeterministicJson.canonicalJson(value), 'utf8'));
}

function fail(message) {
  throw new TypeError(message);
}

function plainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' must be an object');
  return value;
}

function boundedString(value, label, max) {
  const text = String(value === undefined || value === null ? '' : value).trim();
  if (!text) fail(label + ' is required');
  if (text.length > max) fail(label + ' is too long');
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) fail(label + ' contains control characters');
  return text;
}

function declaredText(value, label, max) {
  const text = boundedString(value, label, max);
  if (scanContent(label, Buffer.from(text, 'utf8')).length) fail(label + ' contains sensitive or machine-local material');
  return text;
}

function stableId(value, label) {
  const text = boundedString(value, label, 120);
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(text)) fail(label + ' must be a stable identifier');
  return text;
}

function positiveInteger(value, label, maximum) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) fail(label + ' must be an integer from 1 to ' + maximum);
  return number;
}

function uniqueSorted(values, label, normalizer) {
  if (values === undefined) return [];
  if (!Array.isArray(values)) fail(label + ' must be an array');
  return Array.from(new Set(values.map((value, index) => normalizer(value, label + '[' + index + ']')))).sort();
}

function repositoryPath(value, label) {
  const text = boundedString(value, label, 500).replace(/\\/g, '/');
  if (text.startsWith('/') || /^[A-Za-z]:\//.test(text)) fail(label + ' must be repository-relative');
  const parts = text.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) fail(label + ' contains an unsafe segment');
  if (/[\r\n]/.test(text)) fail(label + ' contains a line break');
  return text;
}

function repositoryPrefix(value, label) {
  const text = boundedString(value, label, 500).replace(/\\/g, '/').replace(/\/+$/, '');
  return repositoryPath(text, label) + '/';
}

function gitRef(value, label) {
  const text = boundedString(value, label, 240);
  if (text.startsWith('-') || text.includes('..') || text.includes('@{') || /[~^:?*\[\\\s]/.test(text) || text.endsWith('/') || text.endsWith('.lock')) {
    fail(label + ' is not a safe Git ref');
  }
  return text;
}

function normalizePolicy(input) {
  const source = plainObject(input, 'policy');
  if (source.schema !== POLICY_SCHEMA) fail('policy.schema must be ' + POLICY_SCHEMA);
  const policy = {
    schema: POLICY_SCHEMA,
    id: stableId(source.id, 'policy.id'),
    baseRef: gitRef(source.baseRef, 'policy.baseRef'),
    remoteName: stableId(source.remoteName || 'origin', 'policy.remoteName'),
    allowedRemoteHosts: uniqueSorted(source.allowedRemoteHosts || ['github.com'], 'policy.allowedRemoteHosts', (value, label) => boundedString(value, label, 253).toLowerCase()),
    allowedBranchPrefixes: uniqueSorted(source.allowedBranchPrefixes || ['codex/'], 'policy.allowedBranchPrefixes', (value, label) => {
      const prefix = boundedString(value, label, 120);
      if (!/^[A-Za-z0-9._/-]+\/$/.test(prefix) || prefix.includes('..')) fail(label + ' must be a safe branch prefix ending in /');
      return prefix;
    }),
    refusedBranches: uniqueSorted(source.refusedBranches || ['main', 'master'], 'policy.refusedBranches', gitRef),
    allowedPrefixes: uniqueSorted(source.allowedPrefixes, 'policy.allowedPrefixes', repositoryPrefix),
    allowedExactPaths: uniqueSorted(source.allowedExactPaths, 'policy.allowedExactPaths', repositoryPath),
    requiredPrefixes: uniqueSorted(source.requiredPrefixes, 'policy.requiredPrefixes', repositoryPrefix),
    requiredPaths: uniqueSorted(source.requiredPaths, 'policy.requiredPaths', repositoryPath),
    forbiddenPrefixes: uniqueSorted(source.forbiddenPrefixes || ['state/', 'logs/', 'bridge/private/'], 'policy.forbiddenPrefixes', repositoryPrefix),
    forbiddenExactPaths: uniqueSorted(source.forbiddenExactPaths || ['bridge/bridge-token.txt', 'bridge/bridge.log', 'logs/workshop.log'], 'policy.forbiddenExactPaths', repositoryPath),
    requiredEvidenceClaims: uniqueSorted(source.requiredEvidenceClaims, 'policy.requiredEvidenceClaims', stableId),
    allowDeletions: source.allowDeletions === true,
    allowRenames: source.allowRenames === true,
    allowCopies: source.allowCopies === true,
    scanSecrets: source.scanSecrets !== false,
    maxFiles: positiveInteger(source.maxFiles === undefined ? 500 : source.maxFiles, 'policy.maxFiles', 10000),
    maxChangedBytes: positiveInteger(source.maxChangedBytes === undefined ? 50 * 1024 * 1024 : source.maxChangedBytes, 'policy.maxChangedBytes', 1024 * 1024 * 1024),
    maxCommits: positiveInteger(source.maxCommits === undefined ? 100 : source.maxCommits, 'policy.maxCommits', 10000)
  };
  if (!policy.allowedRemoteHosts.length) fail('policy.allowedRemoteHosts must not be empty');
  if (!policy.allowedBranchPrefixes.length) fail('policy.allowedBranchPrefixes must not be empty');
  if (!policy.allowedPrefixes.length && !policy.allowedExactPaths.length) fail('policy must declare at least one allowed path or prefix');
  return policy;
}

function normalizeEvidence(input) {
  if (input === undefined || input === null) return { schema:EVIDENCE_SCHEMA, claims:[] };
  const source = plainObject(input, 'evidence');
  if (source.schema !== EVIDENCE_SCHEMA) fail('evidence.schema must be ' + EVIDENCE_SCHEMA);
  if (!Array.isArray(source.claims)) fail('evidence.claims must be an array');
  if (source.claims.length > 200) fail('evidence.claims exceeds 200 entries');
  const ids = new Set();
  const claims = source.claims.map((raw, index) => {
    const claim = plainObject(raw, 'evidence.claims[' + index + ']');
    const claimId = stableId(claim.claimId, 'evidence.claims[' + index + '].claimId');
    if (ids.has(claimId)) fail('evidence claim id is duplicated: ' + claimId);
    ids.add(claimId);
    const status = boundedString(claim.status, 'evidence.claims[' + index + '].status', 20).toUpperCase();
    if (!['PASS', 'FAIL', 'UNKNOWN'].includes(status)) fail('evidence claim status must be PASS, FAIL, or UNKNOWN');
    const digest = claim.evidenceDigest === null || claim.evidenceDigest === undefined ? null : String(claim.evidenceDigest).trim().toLowerCase();
    if (digest !== null && !/^[a-f0-9]{64}$/.test(digest)) fail('evidenceDigest must be a SHA-256 digest');
    const locator = claim.evidenceLocator === null || claim.evidenceLocator === undefined ? null : repositoryPath(claim.evidenceLocator, 'evidence.claims[' + index + '].evidenceLocator');
    if (status === 'PASS' && (!digest || !locator)) fail('PASS evidence requires a digest and repository-relative locator');
    return {
      claimId,
      status,
      command: declaredText(claim.command, 'evidence.claims[' + index + '].command', 500).replace(/\s+/g, ' '),
      summary: declaredText(claim.summary, 'evidence.claims[' + index + '].summary', 500).replace(/\s+/g, ' '),
      evidenceDigest: digest,
      evidenceLocator: locator,
      proofMode: 'DECLARED_NOT_EXECUTED_BY_CHECKPOINT',
      locatorBinding:status === 'PASS' ? 'UNCHECKED' : 'NOT_APPLICABLE'
    };
  }).sort((left, right) => left.claimId.localeCompare(right.claimId));
  return { schema:EVIDENCE_SCHEMA, claims };
}

function gitRaw(repositoryRoot, args, options) {
  const result = childProcess.spawnSync('git', ['-C', repositoryRoot].concat(args), {
    encoding:null,
    windowsHide:true,
    shell:false,
    timeout:(options && options.timeout) || 30000,
    maxBuffer:64 * 1024 * 1024,
    input:options && options.input
  });
  if (result.error || result.status !== 0) {
    const reason = String(result.stderr || result.stdout || result.error || 'Git command failed').trim().split(/\r?\n/)[0].slice(0,300);
    throw new Error('Git inspection failed: ' + reason);
  }
  return Buffer.from(result.stdout || []);
}

function gitText(repositoryRoot, args) {
  return gitRaw(repositoryRoot, args).toString('utf8').trim();
}

function safeGitPath(value) {
  try { return repositoryPath(value, 'Git path'); }
  catch (_) { return null; }
}

function parseRemote(raw) {
  const text = String(raw || '').trim();
  let host = null;
  let repository = null;
  let credentialBearing = false;
  try {
    if (/^https?:\/\//i.test(text) || /^ssh:\/\//i.test(text)) {
      const parsed = new URL(text);
      host = parsed.hostname.toLowerCase();
      credentialBearing = /^https?:$/i.test(parsed.protocol) && (!!parsed.username || !!parsed.password);
      if (/^ssh:$/i.test(parsed.protocol) && parsed.username && parsed.username !== 'git') credentialBearing = true;
      repository = parsed.pathname.replace(/^\/+/, '').replace(/\.git$/i, '');
    } else {
      const match = text.match(/^(?:git@)?([^:]+):(.+)$/);
      if (match) {
        host = match[1].toLowerCase();
        repository = match[2].replace(/^\/+/, '').replace(/\.git$/i, '');
      }
    }
  } catch (_) {}
  if (!host || !repository || repository.split('/').length !== 2 || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    return { valid:false, credentialBearing, host:null, repository:null };
  }
  return { valid:true, credentialBearing, host, repository:host + '/' + repository };
}

function parseNameStatus(buffer) {
  const tokens = buffer.toString('utf8').split('\0');
  if (tokens[tokens.length - 1] === '') tokens.pop();
  const rows = [];
  for (let index = 0; index < tokens.length;) {
    const rawStatus = tokens[index++];
    if (!rawStatus) continue;
    const status = rawStatus[0];
    if (status === 'R' || status === 'C') {
      if (index + 1 >= tokens.length) fail('Git rename/copy record is incomplete');
      rows.push({ status, score:rawStatus.slice(1) || null, previousPath:tokens[index++], path:tokens[index++] });
    } else {
      if (index >= tokens.length) fail('Git change record is incomplete');
      rows.push({ status, score:null, previousPath:null, path:tokens[index++] });
    }
  }
  return rows;
}

function blobAt(repositoryRoot, ref, relativePath) {
  if (!ref || !relativePath) return null;
  const listing = gitRaw(repositoryRoot, ['ls-tree', '-z', ref, '--', relativePath]).toString('utf8');
  if (!listing) return null;
  const first = listing.split('\0')[0];
  const match = first.match(/^(\d+)\s+(\S+)\s+([a-f0-9]+)\t/);
  if (!match || match[2] !== 'blob') return { unsupported:true, mode:match ? match[1] : null, type:match ? match[2] : null };
  const content = gitRaw(repositoryRoot, ['cat-file', 'blob', match[3]]);
  return {
    mode:match[1],
    gitObject:match[3],
    bytes:content.length,
    sha256:sha256(content),
    content
  };
}

function scanContent(relativePath, content) {
  if (!content || content.length > 2 * 1024 * 1024 || content.includes(0)) return [];
  const text = content.toString('utf8');
  const patterns = [
    ['private-key', new RegExp('-----BEGIN (?:RSA |EC |DSA |OPENSSH )?' + 'PRIVATE KEY-----')],
    ['openai-key', /sk-(?:proj-)?[A-Za-z0-9_-]{24,}/],
    ['github-token', /gh[pousr]_[A-Za-z0-9]{30,}/],
    ['google-api-key', /AIza[0-9A-Za-z_-]{30,}/],
    ['aws-access-key', /AKIA[0-9A-Z]{16}/],
    ['bearer-token', /Authorization\s*:\s*Bearer\s+[A-Za-z0-9._~+\/-]{20,}/i],
    ['private-windows-path', /[A-Za-z]:\\Users\\[A-Za-z0-9._-]+\\/],
    ['private-posix-path', /\/(?:home|Users)\/[A-Za-z0-9._-]+\//]
  ];
  return patterns.filter(row => row[1].test(text)).map(row => ({ code:'SENSITIVE_CONTENT', path:relativePath, rule:row[0] }));
}

function publicBlob(blob) {
  if (!blob) return null;
  if (blob.unsupported) return { mode:blob.mode, type:blob.type, unsupported:true };
  return { mode:blob.mode, gitObject:blob.gitObject, bytes:blob.bytes, sha256:blob.sha256 };
}

function pathMatches(relativePath, prefixes, exactPaths) {
  return exactPaths.includes(relativePath) || prefixes.some(prefix => relativePath.startsWith(prefix));
}

function addBlocker(blockers, code, fields) {
  blockers.push(Object.assign({ code }, fields || {}));
}

function inspectRepository(options) {
  const request = plainObject(options, 'options');
  const policy = normalizePolicy(request.policy);
  const evidence = normalizeEvidence(request.evidence);
  const repositoryRoot = path.resolve(boundedString(request.repositoryRoot, 'options.repositoryRoot', 2000));
  if (!fs.existsSync(repositoryRoot) || !fs.statSync(repositoryRoot).isDirectory()) fail('repositoryRoot must be an existing directory');

  const blockers = [];
  let branch = null;
  let headCommit = null;
  let headTree = null;
  let baseCommit = null;
  let mergeBase = null;
  let repositoryIdentity = null;
  let remoteHost = null;
  let dirtyEntries = 0;
  let commits = [];
  let changes = [];
  let changedBytes = 0;

  try { gitText(repositoryRoot, ['rev-parse', '--git-dir']); }
  catch (_) { fail('repositoryRoot is not a readable Git working tree'); }

  const dirtyRaw = gitRaw(repositoryRoot, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  dirtyEntries = dirtyRaw.length ? dirtyRaw.toString('utf8').split('\0').filter(Boolean).length : 0;
  if (dirtyEntries) addBlocker(blockers, 'DIRTY_WORKTREE', { count:dirtyEntries });

  try { branch = gitText(repositoryRoot, ['symbolic-ref', '--quiet', '--short', 'HEAD']); }
  catch (_) { addBlocker(blockers, 'DETACHED_HEAD'); }
  if (branch) {
    if (scanContent('branch', Buffer.from(branch, 'utf8')).length) {
      addBlocker(blockers, 'SENSITIVE_BRANCH_NAME');
      branch = '(sensitive-branch-withheld)';
    }
    if (policy.refusedBranches.includes(branch)) addBlocker(blockers, 'REFUSED_BRANCH', { branch });
    if (!policy.allowedBranchPrefixes.some(prefix => branch.startsWith(prefix))) addBlocker(blockers, 'BRANCH_OUTSIDE_POLICY', { branch });
  }

  try {
    const remote = parseRemote(gitText(repositoryRoot, ['remote', 'get-url', policy.remoteName]));
    if (remote.credentialBearing) addBlocker(blockers, 'CREDENTIAL_BEARING_REMOTE');
    if (!remote.valid) addBlocker(blockers, 'UNSUPPORTED_REMOTE_FORMAT');
    else {
      repositoryIdentity = remote.repository;
      remoteHost = remote.host;
      if (!policy.allowedRemoteHosts.includes(remote.host)) addBlocker(blockers, 'REMOTE_HOST_OUTSIDE_POLICY', { host:remote.host });
    }
  } catch (_) { addBlocker(blockers, 'MISSING_REMOTE', { remoteName:policy.remoteName }); }

  try { headCommit = gitText(repositoryRoot, ['rev-parse', '--verify', 'HEAD^{commit}']); }
  catch (_) { addBlocker(blockers, 'MISSING_HEAD'); }
  if (headCommit) {
    try { headTree = gitText(repositoryRoot, ['rev-parse', '--verify', 'HEAD^{tree}']); }
    catch (_) { addBlocker(blockers, 'MISSING_HEAD_TREE'); }
  }
  try { baseCommit = gitText(repositoryRoot, ['rev-parse', '--verify', policy.baseRef + '^{commit}']); }
  catch (_) { addBlocker(blockers, 'MISSING_BASE_REF', { baseRef:policy.baseRef }); }

  if (headCommit && baseCommit) {
    const ancestor = childProcess.spawnSync('git', ['-C', repositoryRoot, 'merge-base', '--is-ancestor', baseCommit, headCommit], { windowsHide:true, shell:false, timeout:30000 });
    if (ancestor.status !== 0) addBlocker(blockers, 'BASE_NOT_ANCESTOR', { baseRef:policy.baseRef });
    try { mergeBase = gitText(repositoryRoot, ['merge-base', baseCommit, headCommit]); }
    catch (_) { addBlocker(blockers, 'NO_MERGE_BASE'); }
  }

  if (headCommit && baseCommit && mergeBase) {
    const commitIds = gitText(repositoryRoot, ['rev-list', '--reverse', baseCommit + '..' + headCommit]).split(/\r?\n/).filter(Boolean);
    if (commitIds.length > policy.maxCommits) addBlocker(blockers, 'COMMIT_LIMIT_EXCEEDED', { actual:commitIds.length, maximum:policy.maxCommits });
    commits = commitIds.slice(0, policy.maxCommits + 1).map(commitId => {
      const raw = gitText(repositoryRoot, ['show', '-s', '--format=%H%n%P%n%s', commitId]).split(/\r?\n/);
      let subject = (raw.slice(2).join(' ').trim() || '(no subject)').slice(0,500);
      if (scanContent('commit-subject', Buffer.from(subject, 'utf8')).length) {
        addBlocker(blockers, 'SENSITIVE_COMMIT_SUBJECT', { commit:raw[0] });
        subject = '(sensitive subject withheld)';
      }
      return { commit:raw[0], parents:(raw[1] || '').split(' ').filter(Boolean), subject };
    });

    const rawChanges = parseNameStatus(gitRaw(repositoryRoot, ['diff', '--name-status', '-z', '--no-ext-diff', '--find-renames=50%', baseCommit + '...' + headCommit]));
    if (!rawChanges.length) addBlocker(blockers, 'EMPTY_CHANGESET');
    if (rawChanges.length > policy.maxFiles) addBlocker(blockers, 'FILE_LIMIT_EXCEEDED', { actual:rawChanges.length, maximum:policy.maxFiles });
    for (const raw of rawChanges.slice(0, policy.maxFiles + 1)) {
      const currentPath = safeGitPath(raw.path);
      const previousPath = raw.previousPath ? safeGitPath(raw.previousPath) : null;
      if (!currentPath || (raw.previousPath && !previousPath)) {
        addBlocker(blockers, 'UNSAFE_GIT_PATH');
        continue;
      }
      if (scanContent('git-path', Buffer.from([currentPath, previousPath || ''].join('\n'), 'utf8')).length) {
        addBlocker(blockers, 'SENSITIVE_GIT_PATH');
        continue;
      }
      const beforeRef = raw.status === 'A' ? null : baseCommit;
      const afterRef = raw.status === 'D' ? null : headCommit;
      const beforePath = previousPath || currentPath;
      const before = beforeRef ? blobAt(repositoryRoot, beforeRef, beforePath) : null;
      const after = afterRef ? blobAt(repositoryRoot, afterRef, currentPath) : null;
      if ((before && before.unsupported) || (after && after.unsupported) || (before && before.mode === '120000') || (after && after.mode === '120000')) {
        addBlocker(blockers, 'UNSUPPORTED_GIT_OBJECT', { path:currentPath });
      }
      const scopePaths = [currentPath].concat(previousPath ? [previousPath] : []);
      scopePaths.forEach(relativePath => {
        if (!pathMatches(relativePath, policy.allowedPrefixes, policy.allowedExactPaths)) addBlocker(blockers, 'PATH_OUTSIDE_SCOPE', { path:relativePath });
        if (pathMatches(relativePath, policy.forbiddenPrefixes, policy.forbiddenExactPaths)) addBlocker(blockers, 'FORBIDDEN_PATH', { path:relativePath });
      });
      if (raw.status === 'D' && !policy.allowDeletions) addBlocker(blockers, 'DELETION_NOT_ALLOWED', { path:currentPath });
      if (raw.status === 'R' && !policy.allowRenames) addBlocker(blockers, 'RENAME_NOT_ALLOWED', { path:currentPath, previousPath });
      if (raw.status === 'C' && !policy.allowCopies) addBlocker(blockers, 'COPY_NOT_ALLOWED', { path:currentPath, previousPath });
      if (policy.scanSecrets && after && !after.unsupported) scanContent(currentPath, after.content).forEach(finding => blockers.push(finding));
      const row = { status:raw.status, score:raw.score, path:currentPath, previousPath, before:publicBlob(before), after:publicBlob(after) };
      changedBytes += after && !after.unsupported ? after.bytes : before && !before.unsupported ? before.bytes : 0;
      changes.push(row);
    }
  }

  changes.sort((left, right) => left.path.localeCompare(right.path) || left.status.localeCompare(right.status));
  if (changedBytes > policy.maxChangedBytes) addBlocker(blockers, 'BYTE_LIMIT_EXCEEDED', { actual:changedBytes, maximum:policy.maxChangedBytes });
  const changedPaths = changes.map(change => change.path);
  policy.requiredPaths.forEach(required => {
    if (!changedPaths.includes(required)) addBlocker(blockers, 'REQUIRED_PATH_MISSING', { path:required });
  });
  policy.requiredPrefixes.forEach(required => {
    if (!changedPaths.some(relativePath => relativePath.startsWith(required))) addBlocker(blockers, 'REQUIRED_PREFIX_MISSING', { prefix:required });
  });

  const evidenceById = new Map(evidence.claims.map(claim => [claim.claimId, claim]));
  evidence.claims.forEach(claim => {
    if (claim.status === 'PASS' && headCommit) {
      const evidenceBlob = blobAt(repositoryRoot, headCommit, claim.evidenceLocator);
      if (!evidenceBlob || evidenceBlob.unsupported || evidenceBlob.mode === '120000') {
        claim.locatorBinding = 'MISSING_OR_UNSUPPORTED';
        addBlocker(blockers, 'EVIDENCE_LOCATOR_MISSING_OR_UNSUPPORTED', { claimId:claim.claimId, path:claim.evidenceLocator });
      } else if (evidenceBlob.sha256 !== claim.evidenceDigest) {
        claim.locatorBinding = 'DIGEST_MISMATCH';
        addBlocker(blockers, 'EVIDENCE_DIGEST_MISMATCH', { claimId:claim.claimId, path:claim.evidenceLocator });
      } else if (policy.scanSecrets && scanContent(claim.evidenceLocator, evidenceBlob.content).length) {
        claim.locatorBinding = 'SENSITIVE_CONTENT';
        addBlocker(blockers, 'SENSITIVE_EVIDENCE_CONTENT', { claimId:claim.claimId, path:claim.evidenceLocator });
      } else {
        claim.locatorBinding = 'DIGEST_MATCH';
        claim.proofMode = 'DECLARED_AND_GIT_BLOB_BOUND_NOT_EXECUTED_BY_CHECKPOINT';
      }
    }
    if (claim.status === 'FAIL') addBlocker(blockers, 'DECLARED_EVIDENCE_FAILED', { claimId:claim.claimId });
  });
  policy.requiredEvidenceClaims.forEach(claimId => {
    const claim = evidenceById.get(claimId);
    if (!claim) addBlocker(blockers, 'REQUIRED_EVIDENCE_MISSING', { claimId });
    else if (claim.status !== 'PASS') addBlocker(blockers, 'REQUIRED_EVIDENCE_NOT_PASSING', { claimId, status:claim.status });
  });

  const uniqueBlockers = Array.from(new Map(blockers.map(blocker => [DeterministicJson.canonicalJson(blocker), blocker])).values())
    .sort((left, right) => DeterministicJson.canonicalJson(left).localeCompare(DeterministicJson.canonicalJson(right)));
  const state = uniqueBlockers.length ? 'HELD' : 'READY';
  const body = {
    schema:CHECKPOINT_SCHEMA,
    policyVersion:POLICY_VERSION,
    state,
    policy:{ id:policy.id, digest:canonicalDigest(policy), baseRef:policy.baseRef },
    repository:{
      identity:repositoryIdentity,
      remoteHost,
      remoteName:policy.remoteName,
      branch,
      baseCommit,
      headCommit,
      headTree,
      mergeBase,
      clean:dirtyEntries === 0,
      dirtyEntryCount:dirtyEntries
    },
    commits,
    changes,
    evidence,
    summary:{ commits:commits.length, files:changes.length, changedBytes, blockers:uniqueBlockers.length },
    blockers:uniqueBlockers,
    authority:{ fetch:false, commandExecution:false, repositoryWrite:false, push:false, pullRequestCreation:false, merge:false, promotion:false, canon:false }
  };
  return Object.assign({}, body, { checkpointDigest:canonicalDigest(body) });
}

function verifyCheckpoint(packet) {
  const checks = [];
  const check = (id, pass) => checks.push({ id, pass:!!pass });
  let body = null;
  let expected = null;
  try {
    const source = plainObject(packet, 'checkpoint');
    expected = String(source.checkpointDigest || '').toLowerCase();
    body = JSON.parse(JSON.stringify(source));
    delete body.checkpointDigest;
    check('schema', body.schema === CHECKPOINT_SCHEMA);
    check('digest-format', /^[a-f0-9]{64}$/.test(expected));
    check('digest-match', expected === canonicalDigest(body));
    check('state-blocker-consistency', (body.state === 'READY' && Array.isArray(body.blockers) && body.blockers.length === 0) || (body.state === 'HELD' && Array.isArray(body.blockers) && body.blockers.length > 0));
    check('authority-closed', body.authority && Object.values(body.authority).every(value => value === false));
    const serialized = DeterministicJson.canonicalJson(body);
    check('no-machine-root', !/[A-Za-z]:\\\\(?:Users|AXM_ACTIVE)\\\\/i.test(serialized) && !/\/(?:home|Users)\/[^/]+\//.test(serialized));
    check('repository-object-digests', Array.isArray(body.changes) && body.changes.every(change => ['before','after'].every(side => !change[side] || change[side].unsupported || (/^[a-f0-9]{64}$/.test(change[side].sha256) && /^[a-f0-9]{40,64}$/.test(change[side].gitObject)))));
  } catch (_) {
    check('parseable-checkpoint', false);
  }
  const stable = {
    schema:VERIFICATION_SCHEMA,
    checkpointDigest:/^[a-f0-9]{64}$/.test(expected || '') ? expected : null,
    state:checks.length && checks.every(row => row.pass) ? 'PASS' : 'FAIL',
    checks
  };
  return Object.assign({}, stable, { verificationDigest:canonicalDigest(stable) });
}

function markdownText(value, label, maximum) {
  return declaredText(value, label, maximum).replace(/[`<>]/g, character => ({ '`':'\u02cb', '<':'\u2039', '>':'\u203a' }[character])).replace(/\s+/g, ' ');
}

function normalizeMetadata(input) {
  const source = plainObject(input, 'metadata');
  if (source.schema !== REVIEW_METADATA_SCHEMA) fail('metadata.schema must be ' + REVIEW_METADATA_SCHEMA);
  function rows(name, maximum) {
    if (source[name] === undefined) return [];
    if (!Array.isArray(source[name]) || source[name].length > maximum) fail('metadata.' + name + ' is invalid');
    return source[name].map((value, index) => markdownText(value, 'metadata.' + name + '[' + index + ']', 500));
  }
  return {
    schema:REVIEW_METADATA_SCHEMA,
    title:markdownText(source.title, 'metadata.title', 160),
    summary:markdownText(source.summary, 'metadata.summary', 1000),
    changeNotes:rows('changeNotes', 20),
    riskNotes:rows('riskNotes', 20),
    followUps:rows('followUps', 20)
  };
}

function renderReviewPacket(checkpoint, metadataInput) {
  const verification = verifyCheckpoint(checkpoint);
  if (verification.state !== 'PASS') fail('checkpoint verification must pass before rendering');
  const metadata = normalizeMetadata(metadataInput);
  const lines = [
    metadata.summary,
    '',
    '## Deterministic checkpoint',
    '',
    '- Gate: **' + checkpoint.state + '**',
    '- Checkpoint: `' + checkpoint.checkpointDigest + '`',
    '- Policy: `' + checkpoint.policy.id + '` (`' + checkpoint.policy.digest + '`)',
    '- Branch: `' + (checkpoint.repository.branch || '(detached)') + '`',
    '- Base: `' + checkpoint.policy.baseRef + '` at `' + (checkpoint.repository.baseCommit || ZERO_DIGEST) + '`',
    '- Head: `' + (checkpoint.repository.headCommit || ZERO_DIGEST) + '`',
    '- Scope: ' + checkpoint.summary.commits + ' commit(s), ' + checkpoint.summary.files + ' file(s), ' + checkpoint.summary.changedBytes + ' bound byte(s)',
    '',
    '## Changes',
    ''
  ];
  if (!checkpoint.changes.length) lines.push('- None.');
  checkpoint.changes.slice(0, 80).forEach(change => lines.push('- `' + change.status + '` `' + change.path + '`'));
  if (checkpoint.changes.length > 80) lines.push('- … ' + (checkpoint.changes.length - 80) + ' more paths are bound in the checkpoint packet.');
  if (metadata.changeNotes.length) {
    lines.push('', '## Change notes', '');
    metadata.changeNotes.forEach(note => lines.push('- ' + note));
  }
  lines.push('', '## Evidence', '');
  if (!checkpoint.evidence.claims.length) lines.push('- No evidence receipts were supplied.');
  checkpoint.evidence.claims.forEach(claim => lines.push('- **' + claim.status + '** `' + claim.claimId + '` — ' + claim.summary + (claim.evidenceDigest ? ' (`' + claim.evidenceDigest + '`, ' + claim.locatorBinding + ')' : '')));
  if (metadata.riskNotes.length) {
    lines.push('', '## Risks and boundaries', '');
    metadata.riskNotes.forEach(note => lines.push('- ' + note));
  }
  if (checkpoint.blockers.length) {
    lines.push('', '## Holds', '');
    checkpoint.blockers.forEach(blocker => lines.push('- `' + blocker.code + '`' + (blocker.path ? ' — `' + blocker.path + '`' : '') + (blocker.claimId ? ' — `' + blocker.claimId + '`' : '')));
  }
  if (metadata.followUps.length) {
    lines.push('', '## Follow-ups', '');
    metadata.followUps.forEach(note => lines.push('- ' + note));
  }
  lines.push('', '> This packet is read-only review material. It does not create or merge a PR, promote a module, or change AXM canon.', '');
  const stable = {
    schema:REVIEW_PACKET_SCHEMA,
    state:checkpoint.state,
    title:metadata.title,
    body:lines.join('\n'),
    checkpointDigest:checkpoint.checkpointDigest,
    draftRecommended:true,
    pullRequestCreated:false,
    mergeAuthority:false,
    promotionAuthority:false,
    canonAuthority:false
  };
  return Object.assign({}, stable, { reviewPacketDigest:canonicalDigest(stable) });
}

module.exports = {
  POLICY_SCHEMA,
  EVIDENCE_SCHEMA,
  CHECKPOINT_SCHEMA,
  VERIFICATION_SCHEMA,
  REVIEW_METADATA_SCHEMA,
  REVIEW_PACKET_SCHEMA,
  POLICY_VERSION,
  canonicalDigest,
  normalizePolicy,
  normalizeEvidence,
  inspectRepository,
  verifyCheckpoint,
  renderReviewPacket
};
