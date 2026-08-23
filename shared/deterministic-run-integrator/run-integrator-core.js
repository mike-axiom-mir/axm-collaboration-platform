'use strict';

const crypto = require('node:crypto');
const DeterministicJson = require('../../tools/deterministic-json-core');

const POLICY_SCHEMA = 'axm.deterministic-run-integration-policy/v1';
const PLAN_SCHEMA = 'axm.deterministic-run-integration-plan/v1';
const PLAN_VERIFICATION_SCHEMA = 'axm.deterministic-run-integration-plan-verification/v1';
const RECEIPT_SCHEMA = 'axm.deterministic-run-integration-receipt/v1';
const RECEIPT_VERIFICATION_SCHEMA = 'axm.deterministic-run-integration-receipt-verification/v1';
const POLICY_VERSION = 'axm-deterministic-run-integrator-policy/0.1';
const BEGIN_CONFIRMATION = 'CREATE EXACT ISOLATED RUN LANE';
const APPLY_CONFIRMATION = 'SEAL AND FAST-FORWARD EXACT RUN';

const DEFAULT_FORBIDDEN_PATHS = Object.freeze([
  '.codex-remote-attachments/',
  'backups/',
  'bridge/bridge-token.txt',
  'bridge/bridge.log',
  'cache/',
  'docs/steward-runs/',
  'exports/',
  'intakes/',
  'local-data/',
  'logs/',
  'projects/',
  'runtime/',
  'sessions/',
  'state/',
  'tmp/',
  'tools/ai-habitat/runtime/'
]);

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(value) {
  return crypto.createHash('sha256').update(DeterministicJson.canonicalJson(value)).digest('hex');
}

function isSha(value) {
  return /^[a-f0-9]{40,64}$/.test(String(value || '').toLowerCase());
}

function isDigest(value) {
  return /^[a-f0-9]{64}$/.test(String(value || '').toLowerCase());
}

function runId(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(text) || text.includes('..')) {
    throw new TypeError('runId must be a bounded lowercase identifier');
  }
  return text;
}

function branchName(value, label) {
  const text = String(value || '').trim();
  if (!/^(?:codex|agent)\/[A-Za-z0-9][A-Za-z0-9._/-]{0,180}$/.test(text)
      || text.includes('..') || text.includes('//') || text.includes('@{') || text.endsWith('.lock')) {
    throw new TypeError((label || 'branch') + ' must use a safe codex/ or agent/ prefix');
  }
  if (/^(?:codex|agent)\/(?:main|master)$/i.test(text)) {
    throw new TypeError((label || 'branch') + ' cannot name main or master');
  }
  return text;
}

function laneBranchFor(value) {
  return 'codex/run/' + runId(value);
}

function repositoryPath(value, label) {
  let text = String(value || '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (!text || text.includes('\0') || text.startsWith('/') || /^[A-Za-z]:/.test(text)) {
    throw new TypeError((label || 'path') + ' must be repository-relative');
  }
  const pieces = text.split('/');
  if (pieces.some(piece => !piece || piece === '.' || piece === '..')) {
    throw new TypeError((label || 'path') + ' contains an unsafe segment');
  }
  return text;
}

function policyPath(value, label) {
  const source = String(value || '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
  const directory = source.endsWith('/');
  const normalized = repositoryPath(directory ? source.slice(0, -1) : source, label);
  return normalized + (directory ? '/' : '');
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizePolicy(input) {
  const source = copy(input || {});
  if (source.schema !== POLICY_SCHEMA) throw new TypeError('policy schema is invalid');
  const normalizedRunId = runId(source.runId);
  const targetBranch = branchName(source.targetBranch, 'targetBranch');
  if (!Array.isArray(source.allowedPaths) || source.allowedPaths.length < 1 || source.allowedPaths.length > 100) {
    throw new TypeError('allowedPaths must contain 1 to 100 explicit paths');
  }
  const allowedPaths = uniqueSorted(source.allowedPaths.map((value, index) => policyPath(value, 'allowedPaths[' + index + ']')));
  const additionalForbidden = Array.isArray(source.additionalForbiddenPaths)
    ? source.additionalForbiddenPaths.map((value, index) => policyPath(value, 'additionalForbiddenPaths[' + index + ']'))
    : [];
  const forbiddenPaths = uniqueSorted(DEFAULT_FORBIDDEN_PATHS.concat(additionalForbidden));
  const maxFiles = source.maxFiles == null ? 1000 : Number(source.maxFiles);
  const maxBytes = source.maxBytes == null ? 100 * 1024 * 1024 : Number(source.maxBytes);
  if (!Number.isSafeInteger(maxFiles) || maxFiles < 1 || maxFiles > 10000) throw new TypeError('maxFiles is outside the supported range');
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 2 * 1024 * 1024 * 1024) throw new TypeError('maxBytes is outside the supported range');
  return {
    schema: POLICY_SCHEMA,
    policyVersion: POLICY_VERSION,
    runId: normalizedRunId,
    targetBranch,
    laneBranch: laneBranchFor(normalizedRunId),
    allowedPaths,
    forbiddenPaths,
    allowDeletes: source.allowDeletes === true,
    maxFiles,
    maxBytes
  };
}

function matchesRule(path, rule) {
  return rule.endsWith('/') ? path.startsWith(rule) : path === rule;
}

function pathAllowed(path, policy) {
  return policy.allowedPaths.some(rule => matchesRule(path, rule));
}

function pathForbidden(path, policy) {
  const lower = path.toLowerCase();
  const base = lower.split('/').pop();
  if (base === '.env' || base.startsWith('.env.') || base.endsWith('.local.json') || base.endsWith('.local.txt')) return true;
  return policy.forbiddenPaths.some(rule => matchesRule(lower, rule.toLowerCase()));
}

function blocker(code, detail) {
  return Object.assign({ code }, detail || {});
}

function uniqueBlockers(rows) {
  return Array.from(new Map(rows.map(row => [row.code + '\0' + DeterministicJson.canonicalJson(row), row])).values());
}

function stableChange(row) {
  const path = repositoryPath(row.path, 'changed path');
  return {
    path,
    fromPath: row.fromPath ? repositoryPath(row.fromPath, 'changed fromPath') : null,
    status: String(row.status || ''),
    deleted: row.deleted === true,
    conflicted: row.conflicted === true,
    symlink: row.symlink === true,
    sizeBytes: Number.isSafeInteger(row.sizeBytes) && row.sizeBytes >= 0 ? row.sizeBytes : 0,
    sha256: row.deleted === true ? null : (isDigest(row.sha256) ? String(row.sha256).toLowerCase() : null),
    gitBlobId: row.deleted === true ? null : (isSha(row.gitBlobId) ? String(row.gitBlobId).toLowerCase() : null),
    gitMode: row.deleted === true ? null : (/^100(?:644|755)$/.test(String(row.gitMode || '')) ? String(row.gitMode) : null),
    gitFilter: row.gitFilter ? String(row.gitFilter).slice(0, 200) : null,
    sensitiveSignals: uniqueSorted(Array.isArray(row.sensitiveSignals) ? row.sensitiveSignals.map(String) : [])
  };
}

function buildPlan(input) {
  const blockers = [];
  let policy = null;
  try { policy = normalizePolicy(input && input.policy); }
  catch (error) { blockers.push(blocker('POLICY_INVALID', { detail: String(error.message || error).slice(0, 300) })); }
  const facts = input && input.facts || {};
  const changes = [];
  try {
    (Array.isArray(facts.changes) ? facts.changes : []).forEach(row => changes.push(stableChange(row)));
    changes.sort((left, right) => left.path.localeCompare(right.path) || left.status.localeCompare(right.status));
  } catch (error) {
    blockers.push(blocker('CHANGE_SET_INVALID', { detail: String(error.message || error).slice(0, 300) }));
  }

  if (facts.gitAvailable !== true) blockers.push(blocker('GIT_UNAVAILABLE'));
  if (facts.sameRepository !== true) blockers.push(blocker('LANE_REPOSITORY_MISMATCH'));
  if (facts.laneRegistered !== true) blockers.push(blocker('LANE_NOT_REGISTERED'));
  if (facts.laneOutsideTarget !== true) blockers.push(blocker('LANE_MUST_BE_OUTSIDE_TARGET'));
  if (facts.targetClean !== true) blockers.push(blocker('TARGET_WORKTREE_DIRTY'));
  if (facts.targetDetached === true) blockers.push(blocker('TARGET_DETACHED'));
  if (facts.statusParseErrors > 0) blockers.push(blocker('STATUS_PARSE_ERROR', { count: facts.statusParseErrors }));

  if (policy) {
    if (facts.targetBranch !== policy.targetBranch) blockers.push(blocker('TARGET_BRANCH_MISMATCH'));
    if (facts.laneBranch !== policy.laneBranch) blockers.push(blocker('LANE_BRANCH_MISMATCH'));
    if (!isSha(facts.targetHead) || !isSha(facts.laneHead)) blockers.push(blocker('HEAD_COMMIT_INVALID'));
    else if (facts.targetHead !== facts.laneHead) blockers.push(blocker('TARGET_DRIFT', { targetHead: facts.targetHead, laneBase: facts.laneHead }));
    if (!changes.length) blockers.push(blocker('RUN_HAS_NO_CHANGES'));
    if (changes.length > policy.maxFiles) blockers.push(blocker('FILE_LIMIT_EXCEEDED', { observed: changes.length, maximum: policy.maxFiles }));
    const totalBytes = changes.reduce((sum, row) => sum + row.sizeBytes, 0);
    if (totalBytes > policy.maxBytes) blockers.push(blocker('BYTE_LIMIT_EXCEEDED', { observed: totalBytes, maximum: policy.maxBytes }));
    changes.forEach(row => {
      if (!pathAllowed(row.path, policy)) blockers.push(blocker('PATH_OUTSIDE_POLICY', { path: row.path }));
      if (pathForbidden(row.path, policy)) blockers.push(blocker('FORBIDDEN_PRIVATE_PATH', { path: row.path }));
      if (row.fromPath) blockers.push(blocker('RENAME_OR_COPY_NOT_SUPPORTED', { path: row.path, fromPath: row.fromPath }));
      if (row.deleted && !policy.allowDeletes) blockers.push(blocker('DELETION_NOT_ALLOWED', { path: row.path }));
      if (row.conflicted) blockers.push(blocker('CONFLICTED_CHANGE', { path: row.path }));
      if (row.symlink) blockers.push(blocker('SYMLINK_CHANGE_REFUSED', { path: row.path }));
      if (row.gitFilter) blockers.push(blocker('GIT_FILTER_NOT_SUPPORTED', { path: row.path, filter: row.gitFilter }));
      if (!row.deleted && !row.sha256) blockers.push(blocker('CONTENT_DIGEST_MISSING', { path: row.path }));
      if (!row.deleted && !row.symlink && !row.gitFilter && !row.gitBlobId) blockers.push(blocker('GIT_BLOB_ID_MISSING', { path: row.path }));
      if (!row.deleted && !row.symlink && !row.gitFilter && !row.gitMode) blockers.push(blocker('GIT_MODE_MISSING', { path: row.path }));
      row.sensitiveSignals.forEach(signal => blockers.push(blocker('SENSITIVE_CONTENT', { path: row.path, signal })));
    });
  }

  const stableBlockers = uniqueBlockers(blockers);
  const state = stableBlockers.length ? 'HELD' : 'READY';
  const totalBytes = changes.reduce((sum, row) => sum + row.sizeBytes, 0);
  const stable = {
    schema: PLAN_SCHEMA,
    policyVersion: POLICY_VERSION,
    state,
    action: state === 'READY' ? 'SEAL_FAST_FORWARD_AND_CLEAN' : 'NONE',
    policy,
    repository: policy && isSha(facts.targetHead) && isSha(facts.laneHead) ? {
      targetBranch: policy.targetBranch,
      targetHead: String(facts.targetHead).toLowerCase(),
      laneBranch: policy.laneBranch,
      laneHead: String(facts.laneHead).toLowerCase()
    } : null,
    changes,
    summary: { files: changes.length, bytes: totalBytes, blockers: stableBlockers.length },
    effectsIfExplicitlyAuthorized: {
      isolatedRunCommit: state === 'READY',
      localTargetFastForward: state === 'READY',
      integratedLaneCleanup: state === 'READY',
      arbitraryCommandExecution: false,
      remoteWrite: false,
      mainBranchWrite: false,
      historyRewrite: false,
      forceUpdate: false,
      promotion: false,
      canon: false,
      roots: false
    },
    blockers: stableBlockers
  };
  return Object.assign({}, stable, { planDigest: digest(stable) });
}

function verifyPlan(plan) {
  const checks = [];
  const check = (id, pass) => checks.push({ id, pass: pass === true });
  let claimed = null;
  try {
    const stable = copy(plan);
    claimed = String(stable.planDigest || '').toLowerCase();
    delete stable.planDigest;
    check('schema', stable.schema === PLAN_SCHEMA);
    check('digest-format', isDigest(claimed));
    check('digest-match', claimed === digest(stable));
    check('state-consistency', (stable.state === 'READY' && stable.action === 'SEAL_FAST_FORWARD_AND_CLEAN' && stable.blockers.length === 0)
      || (stable.state === 'HELD' && stable.action === 'NONE' && stable.blockers.length > 0));
    check('ready-has-changes', stable.state !== 'READY' || (stable.summary.files > 0 && stable.changes.length === stable.summary.files));
    check('authority-closed', stable.effectsIfExplicitlyAuthorized
      && stable.effectsIfExplicitlyAuthorized.arbitraryCommandExecution === false
      && stable.effectsIfExplicitlyAuthorized.remoteWrite === false
      && stable.effectsIfExplicitlyAuthorized.mainBranchWrite === false
      && stable.effectsIfExplicitlyAuthorized.historyRewrite === false
      && stable.effectsIfExplicitlyAuthorized.forceUpdate === false
      && stable.effectsIfExplicitlyAuthorized.promotion === false
      && stable.effectsIfExplicitlyAuthorized.canon === false
      && stable.effectsIfExplicitlyAuthorized.roots === false);
  } catch (_) {
    check('parseable-plan', false);
  }
  const stable = {
    schema: PLAN_VERIFICATION_SCHEMA,
    planDigest: isDigest(claimed) ? claimed : null,
    state: checks.every(row => row.pass) ? 'PASS' : 'FAIL',
    checks
  };
  return Object.assign({}, stable, { verificationDigest: digest(stable) });
}

function buildReceipt(input) {
  const checks = Array.isArray(input.checks) ? input.checks.map(row => ({ id: String(row.id), pass: row.pass === true })) : [];
  const state = String(input.state || 'REFUSED');
  const stable = {
    schema: RECEIPT_SCHEMA,
    phase: String(input.phase || 'UNKNOWN'),
    state,
    planDigest: input.planDigest && isDigest(input.planDigest) ? String(input.planDigest).toLowerCase() : null,
    result: input.result || null,
    checks,
    blockers: Array.isArray(input.blockers) ? copy(input.blockers) : [],
    error: input.error ? String(input.error).slice(0, 1000) : null,
    recovery: String(input.recovery || 'Re-inspect exact local state and build a fresh plan.'),
    authority: {
      remoteWrite: false,
      mainBranchWrite: false,
      historyRewrite: false,
      forceUpdate: false,
      promotion: false,
      canon: false,
      roots: false
    }
  };
  return Object.assign({}, stable, { receiptDigest: digest(stable) });
}

function verifyReceipt(receipt) {
  const checks = [];
  const check = (id, pass) => checks.push({ id, pass: pass === true });
  let claimed = null;
  try {
    const stable = copy(receipt);
    claimed = String(stable.receiptDigest || '').toLowerCase();
    delete stable.receiptDigest;
    check('schema', stable.schema === RECEIPT_SCHEMA);
    check('digest-format', isDigest(claimed));
    check('digest-match', claimed === digest(stable));
    check('known-phase', ['BEGIN', 'APPLY'].includes(stable.phase));
    check('known-state', ['PASS', 'HELD', 'REFUSED', 'RECOVERY_REQUIRED'].includes(stable.state));
    check('pass-check-consistency', stable.state !== 'PASS' || (stable.checks.length > 0 && stable.checks.every(row => row.pass === true)));
    check('authority-closed', stable.authority && Object.values(stable.authority).every(value => value === false));
  } catch (_) {
    check('parseable-receipt', false);
  }
  const stable = {
    schema: RECEIPT_VERIFICATION_SCHEMA,
    receiptDigest: isDigest(claimed) ? claimed : null,
    state: checks.every(row => row.pass) ? 'PASS' : 'FAIL',
    checks
  };
  return Object.assign({}, stable, { verificationDigest: digest(stable) });
}

module.exports = {
  POLICY_SCHEMA,
  PLAN_SCHEMA,
  PLAN_VERIFICATION_SCHEMA,
  RECEIPT_SCHEMA,
  RECEIPT_VERIFICATION_SCHEMA,
  POLICY_VERSION,
  BEGIN_CONFIRMATION,
  APPLY_CONFIRMATION,
  DEFAULT_FORBIDDEN_PATHS,
  digest,
  isSha,
  isDigest,
  runId,
  branchName,
  laneBranchFor,
  repositoryPath,
  normalizePolicy,
  pathAllowed,
  pathForbidden,
  buildPlan,
  verifyPlan,
  buildReceipt,
  verifyReceipt
};
