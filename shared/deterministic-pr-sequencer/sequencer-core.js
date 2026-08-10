'use strict';

const crypto = require('node:crypto');
const Checkpoint = require('../deterministic-pr-checkpoint/checkpoint-core');

const POLICY_SCHEMA = 'axm.git-pr-sequence-policy/v1';
const PLAN_SCHEMA = 'axm.git-pr-sequence-plan/v1';
const HANDOFF_SCHEMA = 'axm.git-pr-next-action-handoff/v1';
const POLICY_VERSION = 'axm-deterministic-pr-sequencer-policy/0.1';
const PLATFORM_ACTION = 'PLATFORM_INDEPENDENT_REVIEW_THEN_MERGE_EXACT_IF_ACCEPTED';

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(value) {
  return Checkpoint.canonicalDigest(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isSha(value, length) {
  const expression = length === 64 ? /^[a-f0-9]{64}$/ : /^[a-f0-9]{40}$/;
  return expression.test(String(value || '').toLowerCase());
}

function safeInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > 999999999) throw new TypeError(label + ' must be a positive safe integer');
  return number;
}

function repositoryIdentity(value) {
  let text = String(value || '').trim().toLowerCase().replace(/\.git$/, '');
  if (!text.startsWith('github.com/')) text = 'github.com/' + text;
  const match = text.match(/^github\.com\/([a-z0-9_.-]+)\/([a-z0-9_.-]+)$/i);
  if (!match) throw new TypeError('repository must identify github.com/owner/repository');
  return 'github.com/' + match[1] + '/' + match[2];
}

function repositorySlug(value) {
  return repositoryIdentity(value).slice('github.com/'.length);
}

function safeName(value, label) {
  const text = String(value || '').trim();
  if (!text || text.length > 120 || /[\u0000-\u001f\u007f]/.test(text)) throw new TypeError(label + ' is invalid');
  return text;
}

function safeBranchPrefix(value) {
  const text = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,80}\/$/.test(text) || text.includes('..') || text.includes('//')) throw new TypeError('review branch prefix is invalid');
  return text;
}

function normalizePolicy(value) {
  const source = copy(value);
  if (!source || source.schema !== POLICY_SCHEMA) throw new TypeError('sequence policy schema is invalid');
  const identity = repositoryIdentity(source.repository);
  if (source.baseBranch !== 'main') throw new TypeError('sequence policy baseBranch must be main');
  if (source.mergeMethod !== 'merge') throw new TypeError('sequence policy mergeMethod must preserve the exact head as a merge parent');
  if (!Array.isArray(source.candidates) || source.candidates.length < 1 || source.candidates.length > 50) throw new TypeError('sequence policy requires one to fifty ordered candidates');
  const seen = new Set();
  const candidates = source.candidates.map((row, index) => {
    const number = safeInteger(row && row.number, 'candidate number');
    if (seen.has(number)) throw new TypeError('candidate numbers must be unique');
    seen.add(number);
    const expectedHead = String(row.expectedHead || '').toLowerCase();
    if (!isSha(expectedHead, 40)) throw new TypeError('candidate expectedHead must be a 40-character Git commit');
    const evidenceLevel = String(row.evidenceLevel || 'checkpoint');
    if (!['checkpoint', 'transport'].includes(evidenceLevel)) throw new TypeError('candidate evidenceLevel must be checkpoint or transport');
    if (row.handoffRequired !== true) throw new TypeError('every sequence candidate must require a deterministic handoff');
    return {
      order:index + 1,
      number,
      expectedHead,
      evidenceLevel,
      handoffRequired:true
    };
  });
  if (!Array.isArray(source.requiredChecks) || source.requiredChecks.length < 1 || source.requiredChecks.length > 20) throw new TypeError('sequence policy requires one to twenty GitHub checks');
  const requiredChecks = Array.from(new Set(source.requiredChecks.map(row => safeName(row, 'required check')))).sort();
  if (requiredChecks.length !== source.requiredChecks.length) throw new TypeError('required checks must be unique');
  if (!Array.isArray(source.reviewBranchPrefixes) || source.reviewBranchPrefixes.length < 1 || source.reviewBranchPrefixes.length > 10) throw new TypeError('reviewBranchPrefixes are required');
  const reviewBranchPrefixes = Array.from(new Set(source.reviewBranchPrefixes.map(safeBranchPrefix))).sort();
  const stable = {
    schema:POLICY_SCHEMA,
    policyVersion:POLICY_VERSION,
    id:safeName(source.id, 'policy id'),
    repository:identity,
    slug:repositorySlug(identity),
    baseBranch:'main',
    mergeMethod:'merge',
    candidates,
    requiredChecks,
    reviewBranchPrefixes,
    refuseUnlistedReviewBranches:source.refuseUnlistedReviewBranches !== false,
    selectionLimit:1
  };
  return Object.assign({}, stable, { policyDigest:digest(stable) });
}

function normalizeHandoff(wrapper) {
  if (!wrapper || !wrapper.packet) throw new TypeError('handoff packet wrapper is required');
  const packet = copy(wrapper.packet);
  if (packet.schema !== 'axm.chatgpt-platform-merge-handoff/v1') throw new TypeError('handoff schema is invalid');
  const fileSha256 = String(wrapper.fileSha256 || '').toLowerCase();
  if (!isSha(fileSha256, 64)) throw new TypeError('handoff file digest is invalid');
  const pr = packet.pullRequest || {};
  const evidence = packet.deterministicEvidence || {};
  const routing = packet.routing || {};
  const authority = packet.authority || {};
  const number = safeInteger(pr.number, 'handoff pull request number');
  const headCommit = String(pr.headCommit || '').toLowerCase();
  const baseCommit = String(pr.baseCommit || '').toLowerCase();
  if (!isSha(headCommit, 40) || !isSha(baseCommit, 40)) throw new TypeError('handoff Git commits are invalid');
  if (evidence.checkpointState !== 'READY' || !isSha(evidence.checkpointDigest, 64)) throw new TypeError('handoff checkpoint evidence is invalid');
  if (evidence.verificationState !== 'PASS' || !isSha(evidence.verificationDigest, 64)) throw new TypeError('handoff verification evidence is invalid');
  if (evidence.reviewPacketState !== 'READY' || !isSha(evidence.reviewPacketDigest, 64)) throw new TypeError('handoff review evidence is invalid');
  if (routing.localMergePerformed !== false) throw new TypeError('handoff must report that local merge was not performed');
  if (authority.promotion !== false || authority.canon !== false || authority.roots !== false) throw new TypeError('handoff wider authority must remain closed');
  const transport = packet.transportEvidence || null;
  if (transport && (transport.planState !== 'READY' || !isSha(transport.planDigest, 64) || transport.receiptState !== 'PASS' || !isSha(transport.receiptDigest, 64) || transport.receiptVerificationState !== 'PASS' || !isSha(transport.receiptVerificationDigest, 64) || transport.senderReceiverHeadMatch !== true)) {
    throw new TypeError('handoff transport evidence is invalid');
  }
  return {
    fileSha256,
    repository:repositoryIdentity(packet.repository),
    pullRequest:{
      number,
      url:String(pr.url || ''),
      state:String(pr.state || '').toUpperCase(),
      draft:pr.draft === true,
      mergeable:String(pr.mergeable || '').toUpperCase(),
      mergeState:String(pr.mergeState || '').toUpperCase(),
      baseCommit,
      headCommit
    },
    evidence:{
      checkpointDigest:String(evidence.checkpointDigest).toLowerCase(),
      verificationDigest:String(evidence.verificationDigest).toLowerCase(),
      reviewPacketDigest:String(evidence.reviewPacketDigest).toLowerCase()
    },
    transport:transport ? {
      planDigest:String(transport.planDigest || '').toLowerCase(),
      receiptDigest:String(transport.receiptDigest).toLowerCase(),
      receiptVerificationDigest:String(transport.receiptVerificationDigest).toLowerCase(),
      senderReceiverHeadMatch:true
    } : null,
    authority:{ localMergePerformed:false, promotion:false, canon:false, roots:false }
  };
}

function normalizeCheckRows(rows) {
  return (Array.isArray(rows) ? rows : []).map(row => ({
    name:String(row && row.name || ''),
    status:String(row && row.status || '').toUpperCase(),
    conclusion:String(row && row.conclusion || '').toUpperCase()
  })).filter(row => row.name).sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeObservation(row) {
  if (!row) return null;
  return {
    number:Number(row.number),
    url:String(row.url || ''),
    title:String(row.title || ''),
    state:String(row.state || '').toUpperCase(),
    isDraft:row.isDraft === true,
    mergeable:String(row.mergeable || '').toUpperCase(),
    mergeStateStatus:String(row.mergeStateStatus || '').toUpperCase(),
    headRefName:String(row.headRefName || ''),
    headRefOid:String(row.headRefOid || '').toLowerCase(),
    baseRefName:String(row.baseRefName || ''),
    baseRefOid:String(row.baseRefOid || '').toLowerCase(),
    merged:!!row.mergedAt || String(row.state || '').toUpperCase() === 'MERGED',
    checks:normalizeCheckRows(row.checks || row.statusCheckRollup)
  };
}

function issue(code, detail) {
  return Object.assign({ code }, detail || {});
}

function classifyCandidate(candidate, observation, handoff, policy, remoteMainCommit) {
  const issues = [];
  if (!observation) issues.push(issue('PULL_REQUEST_NOT_FOUND'));
  if (observation && observation.merged) {
    if (observation.headRefOid !== candidate.expectedHead) issues.push(issue('MERGED_HEAD_MISMATCH', { observedHead:observation.headRefOid || null }));
    return {
      order:candidate.order,
      number:candidate.number,
      expectedHead:candidate.expectedHead,
      evidenceLevel:candidate.evidenceLevel,
      intrinsicState:issues.length ? issues[0].code : 'MERGED_EXACT',
      issues,
      observation,
      handoff:handoff || null
    };
  }
  if (observation && observation.state !== 'OPEN') issues.push(issue('PULL_REQUEST_CLOSED_UNMERGED', { observedState:observation.state || null }));
  if (observation && observation.headRefOid !== candidate.expectedHead) issues.push(issue('HEAD_DRIFT', { observedHead:observation.headRefOid || null }));
  if (observation && (observation.baseRefName !== policy.baseBranch || !policy.reviewBranchPrefixes.some(prefix => observation.headRefName.startsWith(prefix)))) issues.push(issue('PULL_REQUEST_ROUTE_MISMATCH'));
  if (candidate.handoffRequired && !handoff) issues.push(issue('HANDOFF_MISSING'));
  if (handoff) {
    if (handoff.repository !== policy.repository) issues.push(issue('HANDOFF_REPOSITORY_MISMATCH'));
    if (handoff.pullRequest.number !== candidate.number) issues.push(issue('HANDOFF_PULL_REQUEST_MISMATCH'));
    if (handoff.pullRequest.headCommit !== candidate.expectedHead) issues.push(issue('HANDOFF_HEAD_MISMATCH'));
    if (handoff.pullRequest.state !== 'OPEN') issues.push(issue('HANDOFF_NOT_OPEN'));
    if (candidate.evidenceLevel === 'transport' && !handoff.transport) issues.push(issue('TRANSPORT_EVIDENCE_MISSING'));
    if (handoff.pullRequest.baseCommit !== remoteMainCommit) issues.push(issue('CHECKPOINT_BASE_DRIFT', { checkpointBase:handoff.pullRequest.baseCommit, remoteMainCommit }));
  }
  if (observation && observation.baseRefOid !== remoteMainCommit) issues.push(issue('OBSERVED_BASE_DRIFT', { observedBase:observation.baseRefOid || null, remoteMainCommit }));
  if (observation) {
    policy.requiredChecks.forEach(name => {
      const rows = observation.checks.filter(row => row.name === name);
      if (rows.length !== 1) issues.push(issue(rows.length ? 'REQUIRED_CHECK_AMBIGUOUS' : 'REQUIRED_CHECK_MISSING', { check:name }));
      else if (rows[0].status !== 'COMPLETED') issues.push(issue('REQUIRED_CHECK_PENDING', { check:name, status:rows[0].status || null }));
      else if (rows[0].conclusion !== 'SUCCESS') issues.push(issue('REQUIRED_CHECK_FAILED', { check:name, conclusion:rows[0].conclusion || null }));
    });
    if (observation.mergeable !== 'MERGEABLE' || observation.mergeStateStatus !== 'CLEAN') issues.push(issue('GITHUB_MERGE_STATE_NOT_CLEAN', { mergeable:observation.mergeable || null, mergeStateStatus:observation.mergeStateStatus || null }));
    if (observation.isDraft) issues.push(issue('DRAFT_REVIEW_REQUIRED'));
  }
  return {
    order:candidate.order,
    number:candidate.number,
    expectedHead:candidate.expectedHead,
    evidenceLevel:candidate.evidenceLevel,
    intrinsicState:issues.length ? issues[0].code : 'READY',
    issues,
    observation,
    handoff:handoff || null
  };
}

function buildPlan(input) {
  const globalIssues = [];
  let policy = null;
  try { policy = normalizePolicy(input && input.policy); }
  catch (error) { globalIssues.push(issue('POLICY_INVALID', { detail:String(error.message || error).slice(0,300) })); }
  const facts = input && input.facts || {};
  if (facts.ghAvailable !== true) globalIssues.push(issue('GITHUB_CLI_UNAVAILABLE'));
  if (facts.ghAuthenticated !== true) globalIssues.push(issue('GITHUB_HOST_SESSION_REQUIRED'));
  if (facts.remoteQuerySucceeded !== true) globalIssues.push(issue('REMOTE_MAIN_QUERY_FAILED'));
  if (facts.prQuerySucceeded !== true) globalIssues.push(issue('PULL_REQUEST_QUERY_FAILED'));
  const remoteMainCommit = String(facts.remoteMainCommit || '').toLowerCase();
  if (!isSha(remoteMainCommit, 40)) globalIssues.push(issue('REMOTE_MAIN_INVALID'));
  if (policy && facts.repositoryIdentity !== policy.repository) globalIssues.push(issue('REMOTE_IDENTITY_MISMATCH'));

  const handoffMap = new Map();
  (Array.isArray(input && input.handoffs) ? input.handoffs : []).forEach(wrapper => {
    try {
      const handoff = normalizeHandoff(wrapper);
      const number = handoff.pullRequest.number;
      if (handoffMap.has(number)) globalIssues.push(issue('MULTIPLE_HANDOFFS', { number }));
      else handoffMap.set(number, handoff);
    } catch (error) {
      globalIssues.push(issue('HANDOFF_INVALID', { detail:String(error.message || error).slice(0,300) }));
    }
  });

  const observations = new Map((Array.isArray(facts.pullRequests) ? facts.pullRequests : []).map(row => {
    const normalized = normalizeObservation(row);
    return [normalized.number, normalized];
  }));
  const candidates = policy ? policy.candidates.map(candidate => classifyCandidate(candidate, observations.get(candidate.number) || null, handoffMap.get(candidate.number) || null, policy, remoteMainCommit)) : [];
  const policyNumbers = new Set(policy ? policy.candidates.map(row => row.number) : []);
  const unlistedOpen = (Array.isArray(facts.openPullRequests) ? facts.openPullRequests : []).map(normalizeObservation).filter(row => row && !policyNumbers.has(row.number) && policy && policy.reviewBranchPrefixes.some(prefix => row.headRefName.startsWith(prefix))).map(row => ({ number:row.number, headRefName:row.headRefName, headRefOid:row.headRefOid, url:row.url }));
  if (policy && policy.refuseUnlistedReviewBranches && facts.openInventoryComplete !== true) globalIssues.push(issue('OPEN_PULL_REQUEST_INVENTORY_INCOMPLETE'));
  if (policy && policy.refuseUnlistedReviewBranches && unlistedOpen.length) globalIssues.push(issue('UNLISTED_REVIEW_PULL_REQUESTS', { numbers:unlistedOpen.map(row => row.number) }));

  const firstIncomplete = candidates.findIndex(row => row.intrinsicState !== 'MERGED_EXACT');
  candidates.forEach((row, index) => {
    if (firstIncomplete >= 0 && index > firstIncomplete && row.intrinsicState === 'MERGED_EXACT') {
      row.issues.unshift(issue('MERGED_OUT_OF_ORDER'));
      row.intrinsicState = 'MERGED_OUT_OF_ORDER';
      globalIssues.push(issue('SEQUENCE_ORDER_VIOLATION', { number:row.number }));
    }
  });
  let next = null;
  candidates.forEach((row, index) => {
    if (row.intrinsicState === 'MERGED_EXACT' && (firstIncomplete < 0 || index < firstIncomplete)) row.sequenceState = 'MERGED_EXACT';
    else if (index === firstIncomplete) row.sequenceState = row.intrinsicState === 'READY' && globalIssues.length === 0 ? 'READY_NEXT' : 'BLOCKED_NEXT';
    else row.sequenceState = 'WAIT_FOR_PREDECESSOR';
  });
  if (firstIncomplete >= 0 && candidates[firstIncomplete] && candidates[firstIncomplete].sequenceState === 'READY_NEXT') {
    const row = candidates[firstIncomplete];
    next = {
      action:PLATFORM_ACTION,
      number:row.number,
      url:row.observation.url,
      title:row.observation.title,
      expectedHead:row.expectedHead,
      checkpointBase:row.handoff.pullRequest.baseCommit,
      checkpointDigest:row.handoff.evidence.checkpointDigest,
      handoffFileSha256:row.handoff.fileSha256,
      mergeMethod:policy.mergeMethod,
      independentReviewRequired:true,
      exactReceiverRecheckRequired:true,
      reprobeAfterAction:true
    };
  }
  const state = candidates.length && firstIncomplete < 0 && globalIssues.length === 0 ? 'COMPLETE' : next ? 'NEXT_READY' : 'HELD';
  const stable = {
    schema:PLAN_SCHEMA,
    policyVersion:POLICY_VERSION,
    state,
    policy:policy ? { id:policy.id, digest:policy.policyDigest, repository:policy.repository, baseBranch:policy.baseBranch, mergeMethod:policy.mergeMethod, requiredChecks:policy.requiredChecks } : null,
    remoteMainCommit:isSha(remoteMainCommit, 40) ? remoteMainCommit : null,
    candidates,
    unlistedOpen,
    next,
    globalIssues,
    summary:{
      candidates:candidates.length,
      mergedExact:candidates.filter(row => row.sequenceState === 'MERGED_EXACT').length,
      readyNext:next ? 1 : 0,
      blockedNext:candidates.filter(row => row.sequenceState === 'BLOCKED_NEXT').length,
      waiting:candidates.filter(row => row.sequenceState === 'WAIT_FOR_PREDECESSOR').length,
      unlistedOpen:unlistedOpen.length
    },
    effects:{ repositoryWrite:false, branchWrite:false, pullRequestWrite:false, readyTransition:false, close:false, merge:false, promotion:false, canon:false, roots:false },
    nextBoundary:'After any external action, discard this plan and rebuild from fresh GitHub receiver state.'
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
    check('digest-format', isSha(claimed, 64));
    check('digest-match', claimed === digest(stable));
    check('state-next-consistency', (stable.state === 'NEXT_READY' && !!stable.next && stable.summary.readyNext === 1) || (stable.state === 'HELD' && stable.next === null) || (stable.state === 'COMPLETE' && stable.next === null && stable.summary.mergedExact === stable.summary.candidates));
    check('single-next', stable.candidates.filter(row => row.sequenceState === 'READY_NEXT').length <= 1);
    check('authority-closed', stable.effects && Object.values(stable.effects).every(value => value === false));
    check('external-action-reprobe', /discard this plan and rebuild/.test(String(stable.nextBoundary || '')));
  } catch (_) {
    check('parseable-plan', false);
  }
  const stable = { schema:'axm.git-pr-sequence-plan-verification/v1', planDigest:isSha(claimed, 64) ? claimed : null, state:checks.every(row => row.pass) ? 'PASS' : 'FAIL', checks };
  return Object.assign({}, stable, { verificationDigest:digest(stable) });
}

function buildPlatformHandoff(plan) {
  const verification = verifyPlan(plan);
  if (verification.state !== 'PASS') throw new TypeError('a verified sequence plan is required');
  const stable = {
    schema:HANDOFF_SCHEMA,
    state:plan.state,
    sequencePlanDigest:plan.planDigest,
    remoteMainCommit:plan.remoteMainCommit,
    next:plan.next ? {
      action:plan.next.action,
      pullRequest:plan.next.number,
      url:plan.next.url,
      expectedHead:plan.next.expectedHead,
      checkpointBase:plan.next.checkpointBase,
      checkpointDigest:plan.next.checkpointDigest,
      mergeMethod:plan.next.mergeMethod,
      instruction:'Independently review the exact head. If accepted, merge only this PR, then stop and request a fresh sequence plan.'
    } : null,
    holds:plan.state === 'HELD' ? {
      global:plan.globalIssues.map(row => row.code),
      frontier:(plan.candidates.find(row => row.sequenceState === 'BLOCKED_NEXT') || { issues:[] }).issues.map(row => row.code)
    } : null,
    authority:{ reviewDecision:false, readyTransition:false, merge:false, branchWrite:false, promotion:false, canon:false, roots:false },
    preparedBy:'Keel/local AXM',
    independentReviewer:'platform Axiom/Mir'
  };
  return Object.assign({}, stable, { handoffDigest:digest(stable) });
}

function verifyPlatformHandoff(packet) {
  const checks = [];
  const check = (id, pass) => checks.push({ id, pass:pass === true });
  let claimed = null;
  try {
    const stable = copy(packet);
    claimed = String(stable.handoffDigest || '').toLowerCase();
    delete stable.handoffDigest;
    check('schema', stable.schema === HANDOFF_SCHEMA);
    check('digest-format', isSha(claimed, 64));
    check('digest-match', claimed === digest(stable));
    check('authority-closed', stable.authority && Object.values(stable.authority).every(value => value === false));
    check('state-next-consistency', (stable.state === 'NEXT_READY' && !!stable.next) || (stable.state !== 'NEXT_READY' && stable.next === null));
  } catch (_) {
    check('parseable-handoff', false);
  }
  const stable = { schema:'axm.git-pr-next-action-handoff-verification/v1', handoffDigest:isSha(claimed, 64) ? claimed : null, state:checks.every(row => row.pass) ? 'PASS' : 'FAIL', checks };
  return Object.assign({}, stable, { verificationDigest:digest(stable) });
}

module.exports = {
  POLICY_SCHEMA,
  PLAN_SCHEMA,
  HANDOFF_SCHEMA,
  POLICY_VERSION,
  PLATFORM_ACTION,
  digest,
  sha256,
  repositoryIdentity,
  repositorySlug,
  normalizePolicy,
  normalizeHandoff,
  normalizeObservation,
  buildPlan,
  verifyPlan,
  buildPlatformHandoff,
  verifyPlatformHandoff
};
