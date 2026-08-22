#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const scenario = String(process.argv[2] || 'current').toLowerCase();
if (!['current','recovery','held'].includes(scenario)) throw new Error('scenario must be current, recovery, or held');
const at = '2026-08-21T10:15:00.000Z';
const digest = value => value.repeat(64);

function item(id, title, artifactDigest, state, votes) {
  return {
    schema:'axm.review-item/v1', id, kind:'proposal', title,
    sourceRef:'review-projection-visual:' + id, artifactDigest,
    summary:'Exact local fixture for the bounded ' + scenario + ' projection state.',
    requiredSeats:1, action:{ type:'inspect-projection-recovery', automaticApply:false }, state,
    votes:votes || [], discussion:[], createdAt:at, updatedAt:at, expiresAt:null
  };
}
function truth(overrides) {
  return Object.assign({
    hostConfiguredPolicyActive:true, authenticationIntentPersisted:true, reviewProjectionVerified:true,
    submissionKeyPossessionVerified:true, reviewKeyPossessionVerified:false, distinctAuthenticatedPrincipalsVerified:false,
    automaticRecovery:false, browserRecoveryRoute:false, crossFileAtomicityProven:false, multiProcessSerializationProven:false,
    rollbackPreventionProven:false, externalCustodyProven:false, realWorldIdentityProven:false,
    actualHumanParticipationProven:false, trustedTimeProven:false, reconciliationAuthorized:false,
    executionAuthorized:false, adoptionAuthorized:false, permissionGranted:false, promotionAuthorized:false,
    mergeAuthorized:false, canonAuthorized:false, foundationMutationAuthorized:false
  }, overrides || {});
}
function view(itemValue, state, reason, pendingIds, approved) {
  return {
    schema:'axm.review-authority-view/v2', status:'TEST', reviewId:itemValue.id, artifactDigest:itemValue.artifactDigest,
    reviewState:itemValue.state, authorityState:approved ? 'HOST_KEY_AUTHENTICATED_APPROVED' : 'HELD', reasonCode:reason,
    projectionState:state, pendingProjectionEnvelopeIds:pendingIds || [],
    submissionAssurance:state === 'NONE' ? 'NONE' : 'HOST_TRUSTED_KEY_POSSESSION', requiredSeats:1,
    authenticatedApprovalSeats:approved ? 1 : 0, authenticatedHoldSeats:0, authenticatedRejectSeats:0,
    authenticatedPrincipalDigests:approved ? ['sha256:' + digest('4')] : [],
    policy:policy,
    truth:truth(approved ? { reviewKeyPossessionVerified:true, distinctAuthenticatedPrincipalsVerified:true } : state === 'INVALID' ? { reviewProjectionVerified:false } : {})
  };
}
function operation(envelopeId, reviewId, operationKind, state, reasonCode, recoveryAvailable) {
  return { envelopeId, operation:operationKind, reviewId, state, reasonCode, recoveryAvailable };
}
function recovery(state, reasonCode, operations) {
  return {
    schema:'axm.review-projection-recovery-status/v1', status:'TEST', state, reasonCode,
    totalOperations:operations.length,
    projectedOperations:operations.filter(value => value.state === 'PROJECTED').length,
    supersededOperations:operations.filter(value => value.state === 'SUPERSEDED').length,
    pendingOperations:operations.filter(value => value.state === 'PENDING').length,
    blockedOperations:operations.filter(value => value.state === 'BLOCKED').length,
    invalidOperations:operations.filter(value => value.state === 'INVALID').length,
    operations, operationsTruncated:false, confirmationRequired:'RECOVER SIGNED REVIEW PROJECTION',
    truth:{ automaticRecovery:false, browserRecoveryRoute:false, explicitHostConfirmationRequired:true,
      crossFileAtomicityProven:false, multiProcessSerializationProven:false, rollbackPreventionProven:false,
      externalCustodyProven:false, realWorldIdentityProven:false, actualHumanParticipationProven:false,
      executionAuthorized:false, reconciliationAuthorized:false, canonAuthorized:false }
  };
}

const policy = { state:'READY', schema:'axm.review-trust-policy/v1', policyId:'visual-host-policy',
  policyDigest:'sha256:' + digest('5'), authorityOrigin:'HOST_CONFIGURED_LOCAL_TRUST_ROOT',
  expiresAt:'2026-08-22T09:00:00.000Z', enabledKeys:2, realWorldIdentityProven:false,
  actualHumanParticipationProven:false, trustedTimeProven:false };
let items, byReviewId, recoveryView;
if (scenario === 'current') {
  const legacy = item('review-legacy-approved', 'Legacy approval · authority remains held', digest('2'), 'APPROVED',
    [{ actor:'claimed-reviewer', actorKind:'human', verdict:'APPROVE', note:'Caller-supplied attribution only.', artifactDigest:digest('2'), at }]);
  const authenticated = item('review-host-key-current', 'Host-key projection current · action still unauthorized', digest('3'), 'APPROVED',
    [{ actor:'host-key:reviewer', actorKind:'human', verdict:'APPROVE', note:'Detached signed intent and ordinary projection match.', artifactDigest:digest('3'), at }]);
  items = [legacy, authenticated];
  byReviewId = {
    [legacy.id]:view(legacy, 'NONE', 'AUTHENTICATED_SUBMISSION_MISSING', [], false),
    [authenticated.id]:view(authenticated, 'PROJECTED', 'HOST_CONFIGURED_KEY_POSSESSION_THRESHOLD_MET', [], true)
  };
  recoveryView = recovery('CURRENT', 'ALL_CURRENT_SIGNED_INTENTS_PROJECTED', [
    operation('current-submit', authenticated.id, 'SUBMIT', 'PROJECTED', 'EXACT_REVIEW_ITEM_PRESENT', false),
    operation('current-vote', authenticated.id, 'VOTE', 'PROJECTED', 'EXACT_REVIEW_VOTE_PRESENT', false)
  ]);
} else if (scenario === 'recovery') {
  const pending = item('review-host-key-pending', 'Signed vote projection interrupted · recovery required', digest('6'), 'PENDING', []);
  items = [pending];
  byReviewId = { [pending.id]:view(pending, 'PENDING', 'AUTHENTICATED_VOTE_PROJECTION_PENDING', ['pending-vote'], false) };
  recoveryView = recovery('RECOVERY_REQUIRED', 'SIGNED_PROJECTION_PENDING', [
    operation('pending-submit', pending.id, 'SUBMIT', 'PROJECTED', 'EXACT_REVIEW_ITEM_PRESENT', false),
    operation('pending-vote', pending.id, 'VOTE', 'PENDING', 'SIGNED_VOTE_PROJECTION_PENDING', true)
  ]);
} else {
  const invalid = item('review-host-key-invalid', 'Authentication projection evidence invalid · authority held', digest('7'), 'PENDING', []);
  items = [invalid];
  byReviewId = { [invalid.id]:view(invalid, 'INVALID', 'AUTHENTICATED_VOTE_EVIDENCE_INVALID', [], false) };
  recoveryView = recovery('HELD', 'INVALID_SIGNED_PROJECTION_EVIDENCE', [
    operation('invalid-submit', invalid.id, 'SUBMIT', 'INVALID', 'SUBMISSION_INTENT_OR_PROJECTION_INVALID', false)
  ]);
}
const authority = { schema:'axm.review-authority-index/v2', status:'TEST', policy, recovery:recoveryView, byReviewId };

const files = {
  '/tools/review-inbox/index.html':['tools/review-inbox/index.html','text/html; charset=utf-8'],
  '/tools/review-inbox/app.js':['tools/review-inbox/app.js','application/javascript; charset=utf-8'],
  '/tools/review-inbox/review-inbox.css':['tools/review-inbox/review-inbox.css','text/css; charset=utf-8'],
  '/tools/review-inbox/retention-audit-review-view.js':['tools/review-inbox/retention-audit-review-view.js','application/javascript; charset=utf-8'],
  '/tools/review-inbox/history-reconciliation-review-view.js':['tools/review-inbox/history-reconciliation-review-view.js','application/javascript; charset=utf-8'],
  '/tools/deterministic-json-core/index.js':['tools/deterministic-json-core/index.js','application/javascript; charset=utf-8'],
  '/shared/operations/operations-client.js':['shared/operations/operations-client.js','application/javascript; charset=utf-8'],
  '/shared/operations/operations-ui.css':['shared/operations/operations-ui.css','text/css; charset=utf-8']
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/') { res.writeHead(302, { location:'/tools/review-inbox/index.html' }); res.end(); return; }
  if (url.pathname === '/api/reviews' && req.method === 'GET') {
    const state = url.searchParams.get('state');
    const visible = state ? items.filter(entry => entry.state === state) : items;
    const visibleAuthority = {}; visible.forEach(entry => { visibleAuthority[entry.id] = byReviewId[entry.id]; });
    const result = {
      items:visible,
      summary:{ total:visible.length, byState:visible.reduce((all, entry) => { all[entry.state] = (all[entry.state] || 0) + 1; return all; }, {}) },
      structuralReview:{ state:'CURRENT', summary:{ contractsValid:0, topLevelSelftests:0, legacyKinds:0 }, reviewCandidates:[] },
      authority:Object.assign({}, authority, { byReviewId:visibleAuthority })
    };
    res.writeHead(200, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' });
    res.end(JSON.stringify({ ok:true, result })); return;
  }
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(405, { 'content-type':'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok:false, error:'visual harness is read only' })); return;
  }
  const mapped = files[url.pathname];
  if (!mapped) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type':mapped[1], 'cache-control':'no-store' });
  fs.createReadStream(path.join(ROOT, mapped[0])).pipe(res);
});
server.listen(0, '127.0.0.1', () => process.stdout.write('HARNESS ' + scenario + ' http://127.0.0.1:' + server.address().port + '/tools/review-inbox/index.html\n'));
function shutdown() { server.close(() => process.exit(0)); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
