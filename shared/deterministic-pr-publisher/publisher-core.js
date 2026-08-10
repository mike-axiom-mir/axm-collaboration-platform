'use strict';

const crypto = require('node:crypto');
const Checkpoint = require('../deterministic-pr-checkpoint/checkpoint-core');

const PLAN_SCHEMA = 'axm.git-pr-publish-plan/v1';
const RECEIPT_SCHEMA = 'axm.git-pr-publish-receipt/v1';
const POLICY_VERSION = 'axm-deterministic-pr-publisher-policy/0.1';
const CONFIRMATION = 'PUBLISH EXACT CHECKPOINTED PR HANDOFF';
const ZERO_SHA = '0'.repeat(40);

const SENSITIVE_PATTERNS = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i],
  ['openai-key', /\bsk-[A-Za-z0-9_-]{24,}\b/],
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['github-fine-grained-token', /\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
  ['authorization-header', /\bauthorization\s*:\s*(?:bearer|token)\s+\S+/i],
  ['private-windows-user-path', /\b[A-Za-z]:\\Users\\[^\\\r\n]+/i],
  ['private-posix-user-path', /(?:^|[\s`'"(])\/(?:home|Users)\/[^/\s]+\//],
  ['axm-machine-path', /\b[A-Za-z]:\\AXM_(?:ACTIVE|MIRROR_LOCAL)\\/i]
];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function digest(value) {
  return Checkpoint.canonicalDigest(value);
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function isSha(value) {
  return /^[a-f0-9]{40,64}$/.test(String(value || '').toLowerCase());
}

function isDigest(value) {
  return /^[a-f0-9]{64}$/.test(String(value || '').toLowerCase());
}

function safeText(value, label, maximum) {
  const text = String(value === undefined || value === null ? '' : value).replace(/\r\n/g, '\n').trim();
  if (!text) throw new TypeError(label + ' is required');
  if (text.length > maximum) throw new TypeError(label + ' is too long');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new TypeError(label + ' contains control characters');
  const finding = SENSITIVE_PATTERNS.find(row => row[1].test(text));
  if (finding) throw new TypeError(label + ' contains sensitive or machine-local material (' + finding[0] + ')');
  return text;
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

function repositorySlug(identity) {
  return repositoryIdentity(identity).slice('github.com/'.length);
}

function normalizedReviewBody(review) {
  const body = safeText(review.body, 'review body', 100000);
  const footer = [
    '',
    '## Platform merge routing',
    '',
    '- Prepared by: Keel / local AXM',
    '- Independent merge review: platform Axiom/Mir',
    '- Local publisher merge authority: **false**',
    '- Promotion authority: **false**',
    '- CANON / roots authority: **false**',
    '',
    'Checkpoint: `' + review.checkpointDigest + '`',
    'Review packet: `' + review.reviewPacketDigest + '`'
  ].join('\n');
  return body + footer;
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

function verifyReview(packet, checkpointDigest) {
  try {
    const source = copy(packet);
    const claimed = String(source.reviewPacketDigest || '').toLowerCase();
    delete source.reviewPacketDigest;
    return source.schema === Checkpoint.REVIEW_PACKET_SCHEMA
      && source.state === 'READY'
      && source.checkpointDigest === checkpointDigest
      && source.pullRequestCreated === false
      && source.mergeAuthority === false
      && source.promotionAuthority === false
      && source.canonAuthority === false
      && isDigest(claimed)
      && claimed === digest(source)
      && !!safeText(source.title, 'review title', 160)
      && !!safeText(source.body, 'review body', 100000);
  } catch (_) {
    return false;
  }
}

function blocker(code, detail) {
  return Object.assign({ code }, detail || {});
}

function buildPlan(input) {
  const blockers = [];
  const checkpoint = input && input.checkpoint;
  const verification = input && input.verification;
  const review = input && input.review;
  const facts = input && input.facts || {};
  let checkpointDigest = null;
  let verificationDigest = null;
  let reviewPacketDigest = null;
  let identity = null;
  let slug = null;
  let branch = null;
  let baseCommit = null;
  let headCommit = null;
  let title = null;
  let body = null;

  try {
    const checked = Checkpoint.verifyCheckpoint(checkpoint);
    checkpointDigest = checked.checkpointDigest;
    if (checked.state !== 'PASS') blockers.push(blocker('CHECKPOINT_VERIFICATION_FAILED'));
    if (!checkpoint || checkpoint.state !== 'READY' || !checkpoint.summary || checkpoint.summary.blockers !== 0 || !Array.isArray(checkpoint.blockers) || checkpoint.blockers.length) {
      blockers.push(blocker('CHECKPOINT_NOT_READY'));
    }
    identity = repositoryIdentity(checkpoint.repository.identity);
    slug = repositorySlug(identity);
    branch = branchName(checkpoint.repository.branch);
    baseCommit = String(checkpoint.repository.baseCommit || '').toLowerCase();
    headCommit = String(checkpoint.repository.headCommit || '').toLowerCase();
    if (!isSha(baseCommit) || !isSha(headCommit)) blockers.push(blocker('CHECKPOINT_GIT_OBJECT_INVALID'));
    if (checkpoint.policy.baseRef !== checkpoint.repository.remoteName + '/main') blockers.push(blocker('BASE_REF_NOT_REMOTE_MAIN'));
    if (checkpoint.repository.clean !== true || checkpoint.repository.dirtyEntryCount !== 0) blockers.push(blocker('CHECKPOINT_WORKTREE_NOT_CLEAN'));
  } catch (error) {
    blockers.push(blocker('CHECKPOINT_INVALID', { detail:String(error.message || error).slice(0,300) }));
  }

  verificationDigest = verification && String(verification.verificationDigest || '').toLowerCase();
  if (!checkpointDigest || !verifyVerification(verification, checkpointDigest)) blockers.push(blocker('VERIFICATION_PACKET_INVALID'));
  reviewPacketDigest = review && String(review.reviewPacketDigest || '').toLowerCase();
  if (!checkpointDigest || !verifyReview(review, checkpointDigest)) blockers.push(blocker('REVIEW_PACKET_INVALID'));

  try {
    title = safeText(review.title, 'review title', 160);
    body = normalizedReviewBody(review);
  } catch (error) {
    blockers.push(blocker('PUBLIC_REVIEW_MATERIAL_REFUSED', { detail:String(error.message || error).slice(0,300) }));
  }

  if (facts.publishLaneVerified !== true) blockers.push(blocker('PUBLISH_LANE_REQUIRED'));
  if (facts.gitAvailable !== true) blockers.push(blocker('GIT_UNAVAILABLE'));
  if (facts.ghAvailable !== true) blockers.push(blocker('GITHUB_CLI_UNAVAILABLE'));
  if (facts.ghAuthenticated !== true) blockers.push(blocker('GITHUB_HOST_SESSION_REQUIRED'));
  if (facts.remoteQuerySucceeded !== true) blockers.push(blocker('REMOTE_QUERY_FAILED'));
  if (facts.prQuerySucceeded !== true) blockers.push(blocker('PULL_REQUEST_QUERY_FAILED'));
  if (facts.clean !== true) blockers.push(blocker('DIRTY_WORKTREE'));
  if (branch && facts.branch !== branch) blockers.push(blocker('LOCAL_BRANCH_MISMATCH'));
  if (headCommit && facts.headCommit !== headCommit) blockers.push(blocker('LOCAL_HEAD_MISMATCH'));
  if (identity && facts.repositoryIdentity !== identity) blockers.push(blocker('REMOTE_IDENTITY_MISMATCH'));
  if (baseCommit && facts.remoteBaseCommit !== baseCommit) blockers.push(blocker('REMOTE_BASE_DRIFT'));
  if (facts.remoteBranchCommit && facts.remoteBranchRelationKnown !== true) blockers.push(blocker('REMOTE_BRANCH_RELATION_UNKNOWN'));
  if (facts.remoteBranchCommit && facts.remoteBranchFastForward !== true && facts.remoteBranchCommit !== headCommit) blockers.push(blocker('REMOTE_BRANCH_NON_FAST_FORWARD'));
  const pullRequests = Array.isArray(facts.pullRequests) ? facts.pullRequests : [];
  if (pullRequests.length > 1) blockers.push(blocker('MULTIPLE_OPEN_PULL_REQUESTS'));
  if (pullRequests.length === 1) {
    const pr = pullRequests[0];
    if (pr.headRefName !== branch || pr.baseRefName !== 'main') blockers.push(blocker('PULL_REQUEST_ROUTE_MISMATCH'));
    if (pr.isDraft !== true) blockers.push(blocker('PULL_REQUEST_NOT_DRAFT'));
  }

  const uniqueBlockers = Array.from(new Map(blockers.map(row => [row.code + '\0' + JSON.stringify(row), row])).values());
  const stable = {
    schema:PLAN_SCHEMA,
    policyVersion:POLICY_VERSION,
    state:uniqueBlockers.length ? 'HELD' : 'READY',
    checkpointDigest:isDigest(checkpointDigest) ? checkpointDigest : null,
    verificationDigest:isDigest(verificationDigest) ? verificationDigest : null,
    reviewPacketDigest:isDigest(reviewPacketDigest) ? reviewPacketDigest : null,
    repository:identity && branch && isSha(baseCommit) && isSha(headCommit) ? {
      identity,
      slug,
      remoteName:String(checkpoint.repository.remoteName),
      baseBranch:'main',
      branch,
      baseCommit,
      headCommit,
      expectedRemoteBranchCommit:facts.remoteBranchCommit || null
    } : null,
    pullRequest:title && body ? {
      action:pullRequests.length === 1 ? 'UPDATE' : 'CREATE',
      number:pullRequests.length === 1 ? Number(pullRequests[0].number) : null,
      title,
      body,
      bodySha256:sha256(Buffer.from(body, 'utf8')),
      draftOnCreate:true
    } : null,
    effectsIfExplicitlyAuthorized:{
      remoteBranchPush:true,
      pullRequestCreateOrUpdate:true,
      merge:false,
      branchDeletion:false,
      promotion:false,
      canon:false,
      roots:false
    },
    blockers:uniqueBlockers
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
    check('state-blocker-consistency', (stable.state === 'READY' && stable.blockers.length === 0) || (stable.state === 'HELD' && stable.blockers.length > 0));
    check('authority-closed', stable.effectsIfExplicitlyAuthorized && stable.effectsIfExplicitlyAuthorized.merge === false && stable.effectsIfExplicitlyAuthorized.branchDeletion === false && stable.effectsIfExplicitlyAuthorized.promotion === false && stable.effectsIfExplicitlyAuthorized.canon === false && stable.effectsIfExplicitlyAuthorized.roots === false);
    check('review-material-bound', !stable.pullRequest || stable.pullRequest.bodySha256 === sha256(Buffer.from(stable.pullRequest.body, 'utf8')));
  } catch (_) {
    check('parseable-plan', false);
  }
  const stable = { schema:'axm.git-pr-publish-plan-verification/v1', planDigest:isDigest(claimed) ? claimed : null, state:checks.every(row => row.pass) ? 'PASS' : 'FAIL', checks };
  return Object.assign({}, stable, { verificationDigest:digest(stable) });
}

function buildReceipt(input) {
  const plan = input.plan;
  const planVerification = verifyPlan(plan);
  if (planVerification.state !== 'PASS' || plan.state !== 'READY') throw new TypeError('a verified READY publish plan is required');
  const transport = input.transport || {};
  const checks = [
    { id:'remote-head-exact', pass:transport.remoteHeadCommit === plan.repository.headCommit },
    { id:'pull-request-received', pass:Number.isSafeInteger(transport.pullRequestNumber) && transport.pullRequestNumber > 0 && /^https:\/\/github\.com\//.test(String(transport.pullRequestUrl || '')) },
    { id:'pull-request-head-exact', pass:transport.pullRequestHeadCommit === plan.repository.headCommit },
    { id:'pull-request-base-commit-exact', pass:transport.pullRequestBaseCommit === plan.repository.baseCommit },
    { id:'pull-request-base-exact', pass:transport.pullRequestBaseBranch === 'main' },
    { id:'pull-request-title-exact', pass:transport.pullRequestTitle === plan.pullRequest.title },
    { id:'pull-request-body-exact', pass:sha256(Buffer.from(String(transport.pullRequestBody || ''), 'utf8')) === plan.pullRequest.bodySha256 },
    { id:'pull-request-open', pass:transport.pullRequestState === 'OPEN' },
    { id:'merge-not-performed', pass:transport.merged === false }
  ];
  const stable = {
    schema:RECEIPT_SCHEMA,
    state:checks.every(row => row.pass) ? 'PASS' : 'FAIL',
    planDigest:plan.planDigest,
    checkpointDigest:plan.checkpointDigest,
    repository:plan.repository,
    action:{ push:input.pushAction, pullRequest:input.pullRequestAction },
    transport:{
      remoteHeadCommit:transport.remoteHeadCommit || null,
      pullRequestNumber:Number(transport.pullRequestNumber) || null,
      pullRequestUrl:transport.pullRequestUrl || null,
      pullRequestHeadCommit:transport.pullRequestHeadCommit || null,
      pullRequestBaseCommit:transport.pullRequestBaseCommit || null,
      pullRequestBaseBranch:transport.pullRequestBaseBranch || null,
      pullRequestState:transport.pullRequestState || null,
      pullRequestDraft:transport.pullRequestDraft === true,
      pullRequestTitle:transport.pullRequestTitle || null,
      pullRequestBodySha256:sha256(Buffer.from(String(transport.pullRequestBody || ''), 'utf8'))
    },
    checks,
    routing:{ preparedBy:'Keel/local AXM', independentMergeReviewer:'platform Axiom/Mir' },
    authority:{ merge:false, branchDeletion:false, promotion:false, canon:false, roots:false }
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
    check('state-check-consistency', (stable.state === 'PASS' && stable.checks.every(row => row.pass)) || (stable.state === 'FAIL' && stable.checks.some(row => !row.pass)));
    check('authority-closed', stable.authority && Object.values(stable.authority).every(value => value === false));
  } catch (_) {
    check('parseable-receipt', false);
  }
  const stable = { schema:'axm.git-pr-publish-receipt-verification/v1', receiptDigest:isDigest(claimed) ? claimed : null, state:checks.every(row => row.pass) ? 'PASS' : 'FAIL', checks };
  return Object.assign({}, stable, { verificationDigest:digest(stable) });
}

module.exports = {
  PLAN_SCHEMA,
  RECEIPT_SCHEMA,
  POLICY_VERSION,
  CONFIRMATION,
  ZERO_SHA,
  digest,
  sha256,
  safeText,
  branchName,
  repositoryIdentity,
  repositorySlug,
  buildPlan,
  verifyPlan,
  buildReceipt,
  verifyReceipt
};
