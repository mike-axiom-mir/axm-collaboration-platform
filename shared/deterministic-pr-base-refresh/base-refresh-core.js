'use strict';

const Checkpoint = require('../deterministic-pr-checkpoint/checkpoint-core');

const PLAN_SCHEMA = 'axm.git-pr-base-refresh-plan/v1';
const RECEIPT_SCHEMA = 'axm.git-pr-base-refresh-receipt/v1';
const POLICY_VERSION = 'axm-deterministic-pr-base-refresh-policy/0.1';
const CONFIRMATION = 'MERGE EXACT REMOTE MAIN INTO CHECKPOINTED REVIEW BRANCH';

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(value) {
  return Checkpoint.canonicalDigest(value);
}

function isSha(value) {
  return /^[a-f0-9]{40,64}$/.test(String(value || '').toLowerCase());
}

function isDigest(value) {
  return /^[a-f0-9]{64}$/.test(String(value || '').toLowerCase());
}

function branchName(value) {
  const text = String(value || '').trim();
  if (!/^(?:codex|agent)\/[A-Za-z0-9][A-Za-z0-9._/-]{0,180}$/.test(text) || text.includes('..') || text.includes('//') || text.includes('@{') || text.endsWith('.lock')) {
    throw new TypeError('branch must use a safe codex/ or agent/ review prefix');
  }
  return text;
}

function repositoryIdentity(value) {
  const text = String(value || '').trim().toLowerCase().replace(/\.git$/, '');
  const match = text.match(/^github\.com\/([a-z0-9_.-]+)\/([a-z0-9_.-]+)$/i);
  if (!match) throw new TypeError('repository identity must be github.com/owner/repository');
  return 'github.com/' + match[1] + '/' + match[2];
}

function verifyVerification(packet, checkpointDigest) {
  try {
    const source = copy(packet);
    const claimed = String(source.verificationDigest || '').toLowerCase();
    delete source.verificationDigest;
    return source.schema === Checkpoint.VERIFICATION_SCHEMA
      && source.state === 'PASS'
      && source.checkpointDigest === checkpointDigest
      && Array.isArray(source.checks)
      && source.checks.length > 0
      && source.checks.every(row => row && row.pass === true)
      && isDigest(claimed)
      && claimed === digest(source);
  } catch (_) {
    return false;
  }
}

function blocker(code, detail) {
  return Object.assign({ code }, detail || {});
}

function uniqueBlockers(blockers) {
  return Array.from(new Map(blockers.map(row => [row.code + '\0' + JSON.stringify(row), row])).values());
}

function buildPlan(input) {
  const blockers = [];
  const checkpoint = input && input.checkpoint;
  const verification = input && input.verification;
  const facts = input && input.facts || {};
  let checkpointDigest = null;
  let verificationDigest = null;
  let identity = null;
  let branch = null;
  let remoteName = null;
  let oldBase = null;
  let oldHead = null;

  try {
    const checked = Checkpoint.verifyCheckpoint(checkpoint);
    checkpointDigest = checked.checkpointDigest;
    if (checked.state !== 'PASS') blockers.push(blocker('CHECKPOINT_VERIFICATION_FAILED'));
    if (!checkpoint || checkpoint.state !== 'READY' || !checkpoint.summary || checkpoint.summary.blockers !== 0 || !Array.isArray(checkpoint.blockers) || checkpoint.blockers.length) {
      blockers.push(blocker('CHECKPOINT_NOT_READY'));
    }
    identity = repositoryIdentity(checkpoint.repository.identity);
    branch = branchName(checkpoint.repository.branch);
    remoteName = String(checkpoint.repository.remoteName || '').trim();
    oldBase = String(checkpoint.repository.baseCommit || '').toLowerCase();
    oldHead = String(checkpoint.repository.headCommit || '').toLowerCase();
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,60}$/.test(remoteName)) blockers.push(blocker('REMOTE_NAME_INVALID'));
    if (!isSha(oldBase) || !isSha(oldHead)) blockers.push(blocker('CHECKPOINT_GIT_OBJECT_INVALID'));
    if (checkpoint.policy.baseRef !== remoteName + '/main') blockers.push(blocker('BASE_REF_NOT_REMOTE_MAIN'));
    if (checkpoint.repository.clean !== true || checkpoint.repository.dirtyEntryCount !== 0) blockers.push(blocker('CHECKPOINT_WORKTREE_NOT_CLEAN'));
  } catch (error) {
    blockers.push(blocker('CHECKPOINT_INVALID', { detail:String(error.message || error).slice(0,300) }));
  }

  verificationDigest = verification && String(verification.verificationDigest || '').toLowerCase();
  if (!checkpointDigest || !verifyVerification(verification, checkpointDigest)) blockers.push(blocker('VERIFICATION_PACKET_INVALID'));

  if (facts.publishLaneVerified !== true) blockers.push(blocker('PUBLISH_LANE_REQUIRED'));
  if (facts.gitAvailable !== true) blockers.push(blocker('GIT_UNAVAILABLE'));
  if (facts.remoteQuerySucceeded !== true) blockers.push(blocker('REMOTE_QUERY_FAILED'));
  if (facts.objectPreparationSucceeded !== true) blockers.push(blocker('REMOTE_MAIN_OBJECT_UNAVAILABLE'));
  if (facts.clean !== true) blockers.push(blocker('DIRTY_WORKTREE'));
  if (branch && facts.branch !== branch) blockers.push(blocker('LOCAL_BRANCH_MISMATCH'));
  if (oldHead && facts.headCommit !== oldHead) blockers.push(blocker('LOCAL_HEAD_MISMATCH'));
  if (identity && facts.repositoryIdentity !== identity) blockers.push(blocker('REMOTE_IDENTITY_MISMATCH'));
  if (oldHead && facts.remoteBranchCommit !== oldHead) blockers.push(blocker(facts.remoteBranchCommit ? 'REMOTE_BRANCH_HEAD_DRIFT' : 'REMOTE_BRANCH_MISSING'));

  const remoteMain = String(facts.remoteMainCommit || '').toLowerCase();
  if (!isSha(remoteMain)) blockers.push(blocker('REMOTE_MAIN_COMMIT_INVALID'));
  const mainAdvanced = isSha(remoteMain) && isSha(oldBase) && remoteMain !== oldBase;
  if (mainAdvanced && facts.baseRelationKnown !== true) blockers.push(blocker('REMOTE_MAIN_ANCESTRY_UNKNOWN'));
  if (mainAdvanced && facts.baseIsAncestorOfRemoteMain !== true) blockers.push(blocker('REMOTE_MAIN_NOT_DESCENDANT_OF_CHECKPOINT_BASE'));
  if (facts.headIsAncestorOfRemoteMain === true) blockers.push(blocker('FEATURE_HEAD_ALREADY_IN_MAIN'));

  const alreadyContainsMain = facts.remoteMainIsAncestorOfHead === true;
  const needsRefresh = mainAdvanced && !alreadyContainsMain && facts.headIsAncestorOfRemoteMain !== true;
  if (needsRefresh && facts.mergeAnalysisSucceeded !== true) blockers.push(blocker('MERGE_ANALYSIS_FAILED'));
  if (needsRefresh && facts.conflictDetected === true) blockers.push(blocker('MERGE_CONFLICT'));
  if (needsRefresh && !isSha(facts.plannedMergeTree)) blockers.push(blocker('PLANNED_MERGE_TREE_INVALID'));
  if (needsRefresh && (!Number.isSafeInteger(facts.plannedCommitTimestamp) || facts.plannedCommitTimestamp < 1 || facts.plannedCommitTimestamp > 253402300799)) blockers.push(blocker('PLANNED_COMMIT_TIMESTAMP_INVALID'));

  const stableBlockers = uniqueBlockers(blockers);
  let state = 'HELD';
  let action = 'NONE';
  if (!stableBlockers.length && needsRefresh) {
    state = 'READY';
    action = 'CREATE_LOCAL_MERGE_COMMIT';
  } else if (!stableBlockers.length) {
    state = 'NO_CHANGE';
    action = 'RECHECKPOINT_ONLY';
  }
  const stable = {
    schema:PLAN_SCHEMA,
    policyVersion:POLICY_VERSION,
    state,
    action,
    checkpointDigest:isDigest(checkpointDigest) ? checkpointDigest : null,
    verificationDigest:isDigest(verificationDigest) ? verificationDigest : null,
    repository:identity && branch && remoteName && isSha(oldBase) && isSha(oldHead) && isSha(remoteMain) ? {
      identity,
      remoteName,
      baseBranch:'main',
      branch,
      checkpointBaseCommit:oldBase,
      checkpointHeadCommit:oldHead,
      remoteMainCommit:remoteMain,
      remoteBranchCommit:facts.remoteBranchCommit || null,
      plannedMergeTree:needsRefresh && isSha(facts.plannedMergeTree) ? String(facts.plannedMergeTree).toLowerCase() : null
    } : null,
    analysis:{
      mainAdvanced,
      alreadyContainsRemoteMain:alreadyContainsMain,
      featureHeadAlreadyInMain:facts.headIsAncestorOfRemoteMain === true,
      conflictDetected:facts.conflictDetected === true,
      immutableObjectsPrepared:facts.objectPreparationSucceeded === true,
      mergeAnalysisPerformed:facts.mergeAnalysisSucceeded === true,
      plannedCommitTimestamp:needsRefresh && Number.isSafeInteger(facts.plannedCommitTimestamp) ? facts.plannedCommitTimestamp : null
    },
    effectsIfExplicitlyAuthorized:{
      immutableGitObjectPreparation:true,
      localFeatureMergeCommit:state === 'READY',
      featureWorktreeUpdate:state === 'READY',
      remotePush:false,
      pullRequestWrite:false,
      mainBranchWrite:false,
      historyRewrite:false,
      forcePush:false,
      promotion:false,
      canon:false,
      roots:false
    },
    requiredAfterSuccess:[
      'run focused and full verification on the refreshed branch',
      'create a new deterministic PR checkpoint against the new remote main',
      'use the deterministic PR publisher only after the new checkpoint and review packet pass'
    ],
    blockers:stableBlockers
  };
  return Object.assign({}, stable, { planDigest:digest(stable) });
}

function verifyPlan(plan) {
  const checks = [];
  const check = (id, pass) => checks.push({ id, pass:pass === true });
  let claimed = null;
  try {
    const stable = copy(plan);
    claimed = String(stable.planDigest || '').toLowerCase();
    delete stable.planDigest;
    check('schema', stable.schema === PLAN_SCHEMA);
    check('digest-format', isDigest(claimed));
    check('digest-match', claimed === digest(stable));
    check('state-consistency', (stable.state === 'READY' && stable.action === 'CREATE_LOCAL_MERGE_COMMIT' && stable.blockers.length === 0)
      || (stable.state === 'NO_CHANGE' && stable.action === 'RECHECKPOINT_ONLY' && stable.blockers.length === 0)
      || (stable.state === 'HELD' && stable.action === 'NONE' && stable.blockers.length > 0));
    check('ready-tree-bound', stable.state !== 'READY' || isSha(stable.repository && stable.repository.plannedMergeTree));
    check('authority-closed', stable.effectsIfExplicitlyAuthorized
      && stable.effectsIfExplicitlyAuthorized.remotePush === false
      && stable.effectsIfExplicitlyAuthorized.pullRequestWrite === false
      && stable.effectsIfExplicitlyAuthorized.mainBranchWrite === false
      && stable.effectsIfExplicitlyAuthorized.historyRewrite === false
      && stable.effectsIfExplicitlyAuthorized.forcePush === false
      && stable.effectsIfExplicitlyAuthorized.promotion === false
      && stable.effectsIfExplicitlyAuthorized.canon === false
      && stable.effectsIfExplicitlyAuthorized.roots === false);
  } catch (_) {
    check('parseable-plan', false);
  }
  const stable = { schema:'axm.git-pr-base-refresh-plan-verification/v1', planDigest:isDigest(claimed) ? claimed : null, state:checks.every(row => row.pass) ? 'PASS' : 'FAIL', checks };
  return Object.assign({}, stable, { verificationDigest:digest(stable) });
}

function buildSuccessReceipt(input) {
  const plan = input.plan;
  const observed = input.observed || {};
  if (verifyPlan(plan).state !== 'PASS' || plan.state !== 'READY') throw new TypeError('a verified READY base-refresh plan is required');
  const expectedParents = [plan.repository.checkpointHeadCommit, plan.repository.remoteMainCommit];
  const expectedMessage = 'AXM deterministic base refresh: main@' + plan.repository.remoteMainCommit;
  const checks = [
    { id:'branch-unchanged', pass:observed.branch === plan.repository.branch },
    { id:'old-head-is-first-parent', pass:Array.isArray(observed.parents) && observed.parents[0] === expectedParents[0] },
    { id:'remote-main-is-second-parent', pass:Array.isArray(observed.parents) && observed.parents[1] === expectedParents[1] },
    { id:'exactly-two-parents', pass:Array.isArray(observed.parents) && observed.parents.length === 2 },
    { id:'planned-merge-tree-exact', pass:observed.headTree === plan.repository.plannedMergeTree },
    { id:'deterministic-message-exact', pass:observed.subject === expectedMessage },
    { id:'deterministic-author-exact', pass:observed.authorName === 'AXM Deterministic Base Refresher' && observed.authorEmail === 'base-refresh@axm.invalid' },
    { id:'deterministic-committer-exact', pass:observed.committerName === 'AXM Deterministic Base Refresher' && observed.committerEmail === 'base-refresh@axm.invalid' },
    { id:'deterministic-timestamps-exact', pass:observed.authorTimestamp === String(plan.analysis.plannedCommitTimestamp) && observed.committerTimestamp === String(plan.analysis.plannedCommitTimestamp) },
    { id:'worktree-clean', pass:observed.clean === true },
    { id:'remote-review-branch-unchanged', pass:observed.remoteBranchCommit === plan.repository.checkpointHeadCommit },
    { id:'remote-main-still-exact', pass:observed.remoteMainCommit === plan.repository.remoteMainCommit },
    { id:'local-main-contains', pass:observed.remoteMainIsAncestorOfHead === true },
    { id:'no-remote-write', pass:observed.remoteWritePerformed === false }
  ];
  const stable = {
    schema:RECEIPT_SCHEMA,
    state:checks.every(row => row.pass) ? 'PASS' : 'RECOVERY_REQUIRED',
    planDigest:plan.planDigest,
    checkpointDigest:plan.checkpointDigest,
    attempted:true,
    result:{
      branch:observed.branch || null,
      previousHead:plan.repository.checkpointHeadCommit,
      remoteMainCommit:plan.repository.remoteMainCommit,
      localMergeCommit:observed.headCommit || null,
      mergeTree:observed.headTree || null,
      remoteBranchCommit:observed.remoteBranchCommit || null,
      deterministicCommitMetadata:{
        subject:observed.subject || null,
        authorName:observed.authorName || null,
        authorEmail:observed.authorEmail || null,
        authorTimestamp:observed.authorTimestamp || null,
        committerName:observed.committerName || null,
        committerEmail:observed.committerEmail || null,
        committerTimestamp:observed.committerTimestamp || null
      }
    },
    checks,
    recovery:checks.every(row => row.pass) ? 'No recovery required. Verify, re-checkpoint, then publish through the bounded publisher.' : 'Stop. Preserve this receipt and inspect the local feature worktree before any push or reset.',
    authority:{ remotePush:false, pullRequestWrite:false, mainBranchWrite:false, historyRewrite:false, forcePush:false, promotion:false, canon:false, roots:false }
  };
  return Object.assign({}, stable, { receiptDigest:digest(stable) });
}

function buildOutcomeReceipt(input) {
  const plan = input.plan || null;
  const checks = Array.isArray(input.checks) ? input.checks.map(row => ({ id:String(row.id), pass:row.pass === true })) : [];
  const stable = {
    schema:RECEIPT_SCHEMA,
    state:String(input.state || 'REFUSED'),
    planDigest:plan && plan.planDigest || null,
    checkpointDigest:plan && plan.checkpointDigest || null,
    attempted:input.attempted === true,
    result:input.result || null,
    checks,
    recovery:String(input.recovery || 'Rebuild the plan from fresh exact facts.'),
    error:String(input.error || '').slice(0,1000) || null,
    authority:{ remotePush:false, pullRequestWrite:false, mainBranchWrite:false, historyRewrite:false, forcePush:false, promotion:false, canon:false, roots:false }
  };
  return Object.assign({}, stable, { receiptDigest:digest(stable) });
}

function verifyReceipt(receipt) {
  const checks = [];
  const check = (id, pass) => checks.push({ id, pass:pass === true });
  let claimed = null;
  try {
    const stable = copy(receipt);
    claimed = String(stable.receiptDigest || '').toLowerCase();
    delete stable.receiptDigest;
    check('schema', stable.schema === RECEIPT_SCHEMA);
    check('digest-format', isDigest(claimed));
    check('digest-match', claimed === digest(stable));
    check('known-state', ['PASS','ROLLED_BACK','REFUSED','RECOVERY_REQUIRED'].includes(stable.state));
    check('pass-check-consistency', stable.state !== 'PASS' || (stable.checks.length > 0 && stable.checks.every(row => row.pass === true)));
    check('rollback-check-consistency', stable.state !== 'ROLLED_BACK' || (stable.attempted === true && stable.checks.length > 0 && stable.checks.every(row => row.pass === true)));
    check('authority-closed', stable.authority && Object.values(stable.authority).every(value => value === false));
  } catch (_) {
    check('parseable-receipt', false);
  }
  const stable = { schema:'axm.git-pr-base-refresh-receipt-verification/v1', receiptDigest:isDigest(claimed) ? claimed : null, state:checks.every(row => row.pass) ? 'PASS' : 'FAIL', checks };
  return Object.assign({}, stable, { verificationDigest:digest(stable) });
}

module.exports = {
  PLAN_SCHEMA,
  RECEIPT_SCHEMA,
  POLICY_VERSION,
  CONFIRMATION,
  digest,
  isSha,
  branchName,
  repositoryIdentity,
  buildPlan,
  verifyPlan,
  buildSuccessReceipt,
  buildOutcomeReceipt,
  verifyReceipt
};
