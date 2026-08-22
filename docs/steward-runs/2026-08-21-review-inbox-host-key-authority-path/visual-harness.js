#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const at = '2026-08-21T10:15:00.000Z';
function item(id, title, digest, actor) {
  return {
    schema:'axm.review-item/v1', id, kind:'proposal', title,
    sourceRef:'review-authority-visual:' + id, artifactDigest:digest,
    summary:actor ? 'Exact digest reached legacy APPROVED from one attributed actor label.' : 'Exact digest has a reverified host-key approval envelope.',
    requiredSeats:1, action:{ type:'inspect-authority-boundary', automaticApply:false }, state:'APPROVED',
    votes:[{ actor:actor || 'host-key:reviewer', actorKind:'human', verdict:'APPROVE', note:actor ? 'Caller-supplied attribution only.' : 'Detached host-key envelope verified.', artifactDigest:digest, at }],
    discussion:[], createdAt:at, updatedAt:at, expiresAt:null
  };
}
const legacy = item('review-legacy-approved', 'Legacy APPROVED · authority must stay held', '2'.repeat(64), 'claimed-reviewer');
const authenticated = item('review-host-key-approved', 'Host-key approval evidence · action still unauthorized', '3'.repeat(64), null);
function truth() {
  return { hostConfiguredPolicyActive:true, submissionKeyPossessionVerified:true, reviewKeyPossessionVerified:true, distinctAuthenticatedPrincipalsVerified:true, realWorldIdentityProven:false, actualHumanParticipationProven:false, trustedTimeProven:false, reconciliationAuthorized:false, executionAuthorized:false, adoptionAuthorized:false, permissionGranted:false, promotionAuthorized:false, mergeAuthorized:false, canonAuthorized:false, foundationMutationAuthorized:false };
}
function view(itemValue, passed) {
  return {
    schema:'axm.review-authority-view/v1', status:'TEST', reviewId:itemValue.id, artifactDigest:itemValue.artifactDigest,
    reviewState:itemValue.state, authorityState:passed ? 'HOST_KEY_AUTHENTICATED_APPROVED' : 'HELD',
    reasonCode:passed ? 'HOST_CONFIGURED_KEY_POSSESSION_THRESHOLD_MET' : 'AUTHENTICATED_SEAT_THRESHOLD_NOT_MET',
    submissionAssurance:passed ? 'HOST_TRUSTED_KEY_POSSESSION' : 'NONE', requiredSeats:1,
    authenticatedApprovalSeats:passed ? 1 : 0, authenticatedHoldSeats:0, authenticatedRejectSeats:0,
    authenticatedPrincipalDigests:passed ? ['sha256:' + '4'.repeat(64)] : [],
    policy:{ state:'READY', schema:'axm.review-trust-policy/v1', policyId:'visual-host-policy', policyDigest:'sha256:' + '5'.repeat(64), authorityOrigin:'HOST_CONFIGURED_LOCAL_TRUST_ROOT', expiresAt:'2026-08-22T09:00:00.000Z', enabledKeys:2, realWorldIdentityProven:false, actualHumanParticipationProven:false, trustedTimeProven:false },
    truth:Object.assign(truth(), passed ? {} : { submissionKeyPossessionVerified:false, reviewKeyPossessionVerified:false, distinctAuthenticatedPrincipalsVerified:false })
  };
}
const items = [legacy, authenticated];
const authority = {
  schema:'axm.review-authority-index/v1', status:'TEST',
  policy:{ state:'READY', schema:'axm.review-trust-policy/v1', policyId:'visual-host-policy', policyDigest:'sha256:' + '5'.repeat(64), authorityOrigin:'HOST_CONFIGURED_LOCAL_TRUST_ROOT', expiresAt:'2026-08-22T09:00:00.000Z', enabledKeys:2, realWorldIdentityProven:false, actualHumanParticipationProven:false, trustedTimeProven:false },
  byReviewId:{ [legacy.id]:view(legacy, false), [authenticated.id]:view(authenticated, true) }
};
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
    const byReviewId = {}; visible.forEach(entry => { byReviewId[entry.id] = authority.byReviewId[entry.id]; });
    const result = {
      items:visible,
      summary:{ total:visible.length, byState:visible.reduce((all, entry) => { all[entry.state] = (all[entry.state] || 0) + 1; return all; }, {}) },
      structuralReview:{ state:'CURRENT', summary:{ contractsValid:0, topLevelSelftests:0, legacyKinds:0 }, reviewCandidates:[] },
      authority:Object.assign({}, authority, { byReviewId })
    };
    res.writeHead(200, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' });
    res.end(JSON.stringify({ ok:true, result })); return;
  }
  if (url.pathname.startsWith('/api/') && req.method !== 'GET') {
    res.writeHead(405, { 'content-type':'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok:false, error:'visual harness is read only' })); return;
  }
  const mapped = files[url.pathname];
  if (!mapped) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type':mapped[1], 'cache-control':'no-store' });
  fs.createReadStream(path.join(ROOT, mapped[0])).pipe(res);
});
server.listen(0, '127.0.0.1', () => process.stdout.write('HARNESS http://127.0.0.1:' + server.address().port + '/tools/review-inbox/index.html\n'));
function shutdown() { server.close(() => process.exit(0)); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
