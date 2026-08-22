#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const OperationsApi = require('./operations-api');
const Authority = require('./review-authority-service');

let assertions = 0;
function check(value, label) { assert(value, label); assertions += 1; }
function equal(actual, expected, label) { assert.deepEqual(actual, expected, label); assertions += 1; }
function keyPair() { const pair = crypto.generateKeyPairSync('ed25519'); return { publicKeyPem:pair.publicKey.export({ type:'spki', format:'pem' }).toString(), privateKey:pair.privateKey }; }
function sign(key, envelope) {
  const value = Object.assign({}, envelope, { signatureAlgorithm:'Ed25519', signature:'' });
  value.signature = crypto.sign(null, Buffer.from(Authority.stableStringify(Authority.signingPayload(value))), key.privateKey).toString('base64');
  return value;
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-review-authority-api-'));
let api = null;
(async function main() {
  try {
    const root = path.join(temp, 'workshop'), stateRoot = path.join(root, 'state');
    ['tools','shared','hub','launcher','docs','projects','prompts','assets','worlds','mobile','museum','pocket','skins','state','exports','logs','backups'].forEach(name => fs.mkdirSync(path.join(root, name), { recursive:true }));
    fs.writeFileSync(path.join(root, 'README.md'), 'review authority API fixture\n');
    const submitter = keyPair(), reviewer = keyPair(), kind = 'model-shadow-transition-settlement-history-reconciliation';
    const policy = {
      schema:Authority.POLICY_SCHEMA, policyId:'api-fixture-policy', authorityOrigin:Authority.AUTHORITY_ORIGIN,
      issuedAt:'2026-08-21T09:00:00.000Z', expiresAt:'2026-08-22T09:00:00.000Z', submitterMayReview:false,
      keys:[
        { keyId:'submitter', algorithm:'Ed25519', publicKeyPem:submitter.publicKeyPem, principalDigest:Authority.sha256('api:submitter'), principalKind:'human', roles:['review.submit'], kinds:[kind], enabled:true },
        { keyId:'reviewer', algorithm:'Ed25519', publicKeyPem:reviewer.publicKeyPem, principalDigest:Authority.sha256('api:reviewer'), principalKind:'human', roles:['review.vote'], kinds:[kind], enabled:true }
      ],
      policyDigest:'sha256:' + '0'.repeat(64)
    };
    policy.policyDigest = Authority.policyDigest(policy);
    function send(res, status, payload) { res.resolve({ status, payload }); }
    function readJsonBody(req, max, done) {
      const bytes = Buffer.byteLength(JSON.stringify(req.body || {}));
      if (bytes > max) done(new Error('body limit exceeded')); else done(null, req.body || {});
    }
    api = OperationsApi.create({ root, stateRoot, exportRoot:path.join(root,'exports'), logRoot:path.join(root,'logs'), backupRoot:path.join(root,'backups'), isProductionSession:false, packager:{}, getPort:() => 0, send, readJsonBody, reviewTrustPolicy:policy, reviewOperationLeaseTimeoutMs:0, now:() => Date.parse('2026-08-21T10:15:00.000Z') });
    function call(url, method, body, headers) {
      return new Promise(resolve => {
        const req = { url, method, body:body || {}, headers:headers || {} };
        const res = { resolve };
        const handled = api.handle(req, res, { url });
        if (!handled) resolve({ status:404, payload:{ ok:false, error:'not handled' } });
      });
    }

    const candidate = { kind, title:'Authenticated API fixture', sourceRef:'authority-api:fixture', artifactDigest:crypto.createHash('sha256').update('api-artifact').digest('hex'), summary:'Exact API path fixture.', requiredSeats:1, action:{ type:'inspect', automaticApply:false } };
    const normalized = Authority.normalizeCandidate(candidate);
    const submitEnvelope = sign(submitter, {
      schema:Authority.ENVELOPE_SCHEMA, envelopeId:'api-submit-1', operation:'SUBMIT', policyDigest:policy.policyDigest, keyId:'submitter', issuedAt:'2026-08-21T10:00:00.000Z', expiresAt:'2026-08-21T11:00:00.000Z',
      payload:{ schema:Authority.SUBMIT_SCHEMA, candidateDigest:Authority.sha256(normalized), artifactDigest:candidate.artifactDigest, kind, sourceRef:candidate.sourceRef }
    });
    const missingHeader = await call('/api/reviews/authenticated-submit', 'POST', { candidate, envelope:submitEnvelope });
    equal(missingHeader.status, 400, 'authenticated submit requires its explicit header');
    check(/header required/.test(missingHeader.payload.error), 'missing authenticated submit header is explicit');
    equal(api.services.review.summary().total, 0, 'missing header creates no item');

    const submitted = await call('/api/reviews/authenticated-submit', 'POST', { candidate, envelope:submitEnvelope }, { 'x-axm-review':'authenticated-submit' });
    equal(submitted.status, 200, 'valid signed submission route succeeds');
    equal(submitted.payload.result.authority.submissionAssurance, 'HOST_TRUSTED_KEY_POSSESSION', 'signed submission returns separate authority evidence');
    const item = submitted.payload.result.item;
    equal(item.state, 'PENDING', 'signed submission still begins pending');

    const legacyVote = await call('/api/reviews/vote', 'POST', { id:item.id, artifactDigest:item.artifactDigest, actor:'caller-label', actorKind:'human', verdict:'APPROVE', note:'Attributed only.', confirmation:'REVIEW EXACT DIGEST' }, { 'x-axm-review':'exact-digest-vote' });
    equal(legacyVote.status, 200, 'ordinary attributed vote remains compatible');
    equal(legacyVote.payload.result.state, 'APPROVED', 'ordinary vote can reach legacy APPROVED');
    const heldGet = await call('/api/reviews', 'GET');
    equal(heldGet.status, 200, 'review list returns authority index');
    equal(heldGet.payload.result.operationLease.schema, 'axm.review-operation-lease-status/v1', 'review list returns typed operation-lease status');
    equal(heldGet.payload.result.operationLease.state, 'FREE', 'read-only response observes the mutation path after release');
    equal(heldGet.payload.result.operationLease.truth.cooperatingSingleHostReviewMutationsSerialized, true, 'GET scopes the cooperating single-host serialization claim');
    equal(heldGet.payload.result.operationLease.truth.nonCooperatingExternalWritersExcluded, false, 'GET refuses external-writer exclusion');
    equal(heldGet.payload.result.authority.byReviewId[item.id].authorityState, 'HELD', 'legacy APPROVED remains authority-held');
    equal(heldGet.payload.result.authority.byReviewId[item.id].reasonCode, 'AUTHENTICATED_SEAT_THRESHOLD_NOT_MET', 'GET names missing authenticated threshold');

    const voteEnvelope = sign(reviewer, {
      schema:Authority.ENVELOPE_SCHEMA, envelopeId:'api-vote-1', operation:'VOTE', policyDigest:policy.policyDigest, keyId:'reviewer', issuedAt:'2026-08-21T10:01:00.000Z', expiresAt:'2026-08-21T11:00:00.000Z',
      payload:{ schema:Authority.VOTE_SCHEMA, reviewId:item.id, artifactDigest:item.artifactDigest, kind, sourceRef:item.sourceRef, verdict:'APPROVE', note:'Signed exact-digest review envelope.', informedExplanation:true }
    });
    const missingVoteHeader = await call('/api/reviews/authenticated-vote', 'POST', { envelope:voteEnvelope });
    equal(missingVoteHeader.status, 400, 'authenticated vote requires its explicit header');
    const voted = await call('/api/reviews/authenticated-vote', 'POST', { envelope:voteEnvelope }, { 'x-axm-review':'authenticated-vote' });
    equal(voted.status, 200, 'valid signed vote route succeeds');
    equal(voted.payload.result.authority.authorityState, 'HOST_KEY_AUTHENTICATED_APPROVED', 'signed vote satisfies separate one-seat authority threshold');
    equal(voted.payload.result.authority.truth.executionAuthorized, false, 'authenticated API result grants no execution authority');
    const finalGet = await call('/api/reviews', 'GET');
    equal(finalGet.payload.result.authority.schema, Authority.INDEX_SCHEMA, 'GET exposes the v2 authority index');
    equal(finalGet.payload.result.authority.policy.state, 'READY', 'GET exposes active host policy status');
    equal(finalGet.payload.result.authority.recovery.state, 'CURRENT', 'GET exposes current intent-projection recovery status');
    equal(finalGet.payload.result.authority.recovery.projectedOperations, 2, 'GET reports exact signed submission and vote projections');
    equal(finalGet.payload.result.authority.recovery.truth.browserRecoveryRoute, false, 'GET declares that browser recovery is unavailable');
    equal(finalGet.payload.result.authority.byReviewId[item.id].authorityState, 'HOST_KEY_AUTHENTICATED_APPROVED', 'GET reverifies signed authority after persistence');
    fs.writeFileSync(api.services.review.operationLeaseFile, JSON.stringify({ schema:'axm.review-operation-lease-owner/v1', leaseId:crypto.randomUUID(), processId:process.pid, acquiredAt:'2026-08-21T10:14:00.000Z' }) + '\n');
    const countBeforeBusy = api.services.review.summary().total;
    const busySubmit = await call('/api/reviews', 'POST', { kind:'proposal', title:'Busy fixture', sourceRef:'busy:fixture', artifactDigest:'b'.repeat(64) }, { 'x-axm-review':'explicit-submit' });
    equal(busySubmit.status, 400, 'held operation lease is a bounded client-visible refusal, not a server error');
    check(/lease is held/.test(busySubmit.payload.error), 'held operation refusal names the lease');
    equal(api.services.review.summary().total, countBeforeBusy, 'held operation refusal mutates no review item');
    equal(fs.existsSync(api.services.review.operationLeaseFile), true, 'API refusal never deletes held lease evidence');
    fs.unlinkSync(api.services.review.operationLeaseFile);
    const source = fs.readFileSync(path.join(__dirname, 'operations-api.js'), 'utf8');
    check(!/trusted-review-keys[^\n]*POST|reviewTrustPolicy[^\n]*parsed/.test(source), 'operations API exposes no browser trust-policy write or caller-policy injection');
    check(!/recoverProjection\s*\(/.test(source), 'operations API exposes no browser signed-projection recovery route');
    check(!/review-operation-lease\/(?:release|recover|unlock)|operationLease\.(?:release|recover|unlock)/i.test(source), 'operations API exposes no browser operation-lease release route');
    console.log('PASS Review Authority API: ' + assertions + ' assertions (explicit signed routes and separate GET authority and lease status)');
  } finally {
    if (api) api.stop();
    fs.rmSync(temp, { recursive:true, force:true });
  }
}()).catch(error => { console.error(error.stack || error); process.exitCode = 1; });
