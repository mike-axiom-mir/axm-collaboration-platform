#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Authority = require('./review-authority-service');
const Review = require('./review-service');

let assertions = 0;
function check(value, label) { assert(value, label); assertions += 1; }
function equal(actual, expected, label) { assert.deepEqual(actual, expected, label); assertions += 1; }
function throws(fn, pattern, label) { assert.throws(fn, pattern, label); assertions += 1; }
function pair() {
  const keys = crypto.generateKeyPairSync('ed25519');
  return { publicKeyPem:keys.publicKey.export({ type:'spki', format:'pem' }).toString(), privateKey:keys.privateKey };
}
function policyKey(id, keys, principal, roles, kinds, kind) {
  return { keyId:id, algorithm:'Ed25519', publicKeyPem:keys.publicKeyPem, principalDigest:Authority.sha256('principal:' + principal), principalKind:kind || 'human', roles:roles.slice(), kinds:kinds.slice(), enabled:true };
}
function makePolicy(keys, values) {
  const policy = Object.assign({
    schema:Authority.POLICY_SCHEMA,
    policyId:'fixture-host-review-policy',
    authorityOrigin:Authority.AUTHORITY_ORIGIN,
    issuedAt:'2026-08-21T09:00:00.000Z',
    expiresAt:'2026-08-22T09:00:00.000Z',
    submitterMayReview:false,
    keys:keys,
    policyDigest:'sha256:' + '0'.repeat(64)
  }, values || {});
  policy.policyDigest = Authority.policyDigest(policy);
  return policy;
}
function signEnvelope(key, fields) {
  const envelope = Object.assign({
    schema:Authority.ENVELOPE_SCHEMA,
    issuedAt:'2026-08-21T10:00:00.000Z',
    expiresAt:'2026-08-21T11:00:00.000Z',
    signatureAlgorithm:'Ed25519',
    signature:''
  }, fields);
  envelope.signature = crypto.sign(null, Buffer.from(Authority.stableStringify(Authority.signingPayload(envelope)), 'utf8'), key.privateKey).toString('base64');
  return envelope;
}
function submitEnvelope(key, policy, candidate, id) {
  return signEnvelope(key, {
    envelopeId:id,
    operation:'SUBMIT',
    policyDigest:policy.policyDigest,
    keyId:'submitter',
    payload:{ schema:Authority.SUBMIT_SCHEMA, candidateDigest:Authority.sha256(Authority.normalizeCandidate(candidate)), artifactDigest:candidate.artifactDigest, kind:candidate.kind, sourceRef:candidate.sourceRef }
  });
}
function voteEnvelope(keyId, key, policy, item, id, verdict, note) {
  return signEnvelope(key, {
    envelopeId:id,
    operation:'VOTE',
    policyDigest:policy.policyDigest,
    keyId,
    payload:{ schema:Authority.VOTE_SCHEMA, reviewId:item.id, artifactDigest:item.artifactDigest, kind:item.kind, sourceRef:item.sourceRef, verdict:verdict || 'APPROVE', note:note || 'Exact artifact and authority boundary reviewed.', informedExplanation:true }
  });
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-review-authority-'));
try {
  const stateRoot = path.join(temp, 'state');
  const fixedNow = Date.parse('2026-08-21T10:15:00.000Z');
  const review = Review.create({ stateRoot });
  const missing = Authority.create({ stateRoot, reviewService:review, now:() => fixedNow });
  equal(missing.policyStatus().state, 'NOT_CONFIGURED', 'default service has no trusted review key policy');
  equal(missing.assess(null).reasonCode, 'REVIEW_ITEM_MISSING', 'missing item stays held');
  check(!fs.existsSync(missing.policyFile), 'authority observation does not create a policy');

  const submitter = pair(), reviewerA = pair(), reviewerB = pair(), reviewerARotation = pair(), wrongRole = pair(), wrongKind = pair();
  const kind = 'model-shadow-transition-settlement-history-reconciliation';
  const keys = [
    policyKey('submitter', submitter, 'submitter', ['review.submit'], [kind]),
    policyKey('reviewer-a', reviewerA, 'reviewer-a', ['review.vote'], [kind]),
    policyKey('reviewer-b', reviewerB, 'reviewer-b', ['review.vote'], [kind]),
    policyKey('reviewer-a-rotation', reviewerARotation, 'reviewer-a', ['review.vote'], [kind]),
    policyKey('wrong-role', wrongRole, 'wrong-role', ['review.submit'], [kind]),
    policyKey('wrong-kind', wrongKind, 'wrong-kind', ['review.vote'], ['another-kind'])
  ];
  const policy = makePolicy(keys);
  const authority = Authority.create({ stateRoot, reviewService:review, reviewTrustPolicy:policy, now:() => fixedNow });
  const status = authority.policyStatus();
  equal(status.state, 'READY', 'valid injected host policy is ready: ' + (status.reason || 'no refusal'));
  equal(status.enabledKeys, 6, 'ready policy reports enabled public keys');
  equal(status.realWorldIdentityProven, false, 'host policy does not prove real-world identity');
  equal(status.actualHumanParticipationProven, false, 'host policy does not prove human participation');
  check(!JSON.stringify(policy).includes('PRIVATE KEY'), 'host policy contains no private key material');

  const invalidDigestPolicy = JSON.parse(JSON.stringify(policy));
  invalidDigestPolicy.policyDigest = 'sha256:' + 'f'.repeat(64);
  throws(() => Authority.normalizePolicy(invalidDigestPolicy, fixedNow), /digest mismatch/, 'altered policy digest is refused');
  const expiredPolicy = makePolicy(keys, { expiresAt:'2026-08-21T10:00:00.000Z' });
  throws(() => Authority.normalizePolicy(expiredPolicy, fixedNow), /expired/, 'expired host policy is refused');
  const duplicateFingerprint = makePolicy([keys[0], Object.assign({}, keys[1], { keyId:'duplicate-fingerprint', publicKeyPem:keys[0].publicKeyPem })]);
  throws(() => Authority.normalizePolicy(duplicateFingerprint, fixedNow), /fingerprints must be unique/, 'duplicate public key cannot impersonate another trust seat');

  const candidate = {
    kind,
    title:'Reconcile two exact transition histories',
    sourceRef:'model-shadow-history-reconciliation:fixture',
    artifactDigest:crypto.createHash('sha256').update('exact-history-divergence').digest('hex'),
    summary:'Two complete local history commitments diverge at one exact normalized event.',
    requiredSeats:2,
    action:{ type:'inspect-history-divergence', automaticApply:false, reconciliationAuthority:false }
  };
  throws(() => Authority.normalizeCandidate(Object.assign({}, candidate, { hiddenAuthority:true })), /unknown fields/, 'authenticated candidate rejects undeclared fields');
  throws(() => Authority.normalizeCandidate(Object.assign({}, candidate, { expiresAt:'not-a-time' })), /expiresAt is invalid/, 'authenticated candidate rejects invalid expiry instead of normalizing it away');
  throws(() => Authority.normalizeCandidate(Object.assign({}, candidate, { action:['not-an-action-object'] })), /action must be an object/, 'authenticated candidate rejects ambiguous action shape');
  const signedSubmit = submitEnvelope(submitter, policy, candidate, 'submit-envelope-1');
  const badSignature = JSON.parse(JSON.stringify(signedSubmit));
  badSignature.signature = Buffer.alloc(64, 7).toString('base64');
  throws(() => authority.submit(candidate, badSignature), /signature is invalid/, 'invalid submission signature is refused before Review Inbox mutation');
  equal(review.summary().total, 0, 'invalid signed submission creates no review item');
  const wrongCandidate = JSON.parse(JSON.stringify(candidate)); wrongCandidate.title = 'Changed after signing';
  throws(() => authority.submit(wrongCandidate, signedSubmit), /candidate digest mismatch/, 'submission signature binds the normalized candidate');
  equal(review.summary().total, 0, 'candidate mismatch creates no review item');

  const submitted = authority.submit(candidate, signedSubmit);
  equal(submitted.item.state, 'PENDING', 'valid host-key submission enters the ordinary exact-digest queue');
  equal(submitted.authority.submissionAssurance, 'HOST_TRUSTED_KEY_POSSESSION', 'submission assurance is separate from review state');
  equal(submitted.authority.reasonCode, 'REVIEW_ITEM_NOT_APPROVED', 'authenticated submission alone grants no approval');
  equal(submitted.authority.projectionState, 'PROJECTED', 'durable signed submission intent matches its ordinary Review Inbox projection');
  equal(submitted.authority.truth.authenticationIntentPersisted, true, 'authority view distinguishes durable signed intent');
  equal(submitted.authority.truth.reviewProjectionVerified, true, 'authority view verifies the current ordinary projection separately');
  equal(submitted.authority.truth.crossFileAtomicityProven, false, 'intent-first projection does not claim cross-file atomicity');
  equal(submitted.authority.truth.actualHumanParticipationProven, false, 'signed submission proves no human participation');
  throws(() => authority.submit(candidate, signedSubmit), /already used|already has/, 'submission envelope replay is refused');
  equal(review.summary().total, 1, 'replay does not duplicate the review item');

  const forgedSubmitterVote = signEnvelope(submitter, {
    envelopeId:'submitter-self-vote', operation:'VOTE', policyDigest:policy.policyDigest, keyId:'submitter',
    payload:{ schema:Authority.VOTE_SCHEMA, reviewId:submitted.item.id, artifactDigest:submitted.item.artifactDigest, kind, sourceRef:candidate.sourceRef, verdict:'APPROVE', note:'Submitter attempts to review its own item.', informedExplanation:true }
  });
  throws(() => authority.vote(forgedSubmitterVote), /lacks the required role|separates submitter/, 'submitter cannot fill a separated review seat');
  const wrongRoleVote = voteEnvelope('wrong-role', wrongRole, policy, submitted.item, 'wrong-role-vote');
  throws(() => authority.vote(wrongRoleVote), /lacks the required role/, 'submit-only key cannot cast a vote');
  const wrongKindVote = voteEnvelope('wrong-kind', wrongKind, policy, submitted.item, 'wrong-kind-vote');
  throws(() => authority.vote(wrongKindVote), /not enabled for this review kind/, 'review key is scoped to declared review kinds');
  const wrongDigestVote = voteEnvelope('reviewer-a', reviewerA, policy, submitted.item, 'wrong-digest-vote');
  wrongDigestVote.payload.artifactDigest = 'f'.repeat(64);
  wrongDigestVote.signature = crypto.sign(null, Buffer.from(Authority.stableStringify(Authority.signingPayload(wrongDigestVote)), 'utf8'), reviewerA.privateKey).toString('base64');
  throws(() => authority.vote(wrongDigestVote), /artifact digest mismatch/, 'vote signature cannot authorize another artifact digest');

  review.vote(submitted.item.id, { actor:'claimed-reviewer-one', actorKind:'human', verdict:'APPROVE', artifactDigest:candidate.artifactDigest, note:'Caller-supplied label only.' });
  review.vote(submitted.item.id, { actor:'claimed-reviewer-two', actorKind:'human', verdict:'APPROVE', artifactDigest:candidate.artifactDigest, note:'Second caller-supplied label only.' });
  check(review.approved(submitted.item.id, candidate.artifactDigest), 'legacy attributed labels can still reach legacy APPROVED');
  const legacyOnly = authority.assess(review.get(submitted.item.id));
  equal(legacyOnly.authorityState, 'HELD', 'legacy APPROVED does not become authenticated authority');
  equal(legacyOnly.reasonCode, 'AUTHENTICATED_SEAT_THRESHOLD_NOT_MET', 'authority view names the missing authenticated seats');
  equal(legacyOnly.authenticatedApprovalSeats, 0, 'free-form actor labels count as zero authenticated seats');

  const legacyCandidate = Object.assign({}, candidate, { sourceRef:'model-shadow-history-reconciliation:legacy-only', artifactDigest:crypto.createHash('sha256').update('legacy-only').digest('hex') });
  const legacyItem = review.submit(legacyCandidate);
  const signedLegacyVote = voteEnvelope('reviewer-a', reviewerA, policy, legacyItem, 'legacy-item-signed-vote');
  throws(() => authority.vote(signedLegacyVote), /requires a current valid authenticated submission/, 'signed vote cannot upgrade an item without valid signed submission evidence');
  equal(review.get(legacyItem.id).votes.length, 0, 'rejected signed legacy vote creates no attributed vote');

  const voteA = voteEnvelope('reviewer-a', reviewerA, policy, submitted.item, 'vote-envelope-a');
  const afterA = authority.vote(voteA);
  equal(afterA.authority.authorityState, 'HELD', 'one authenticated reviewer cannot fill two required seats');
  equal(afterA.authority.authenticatedApprovalSeats, 1, 'first authenticated principal fills one seat');
  throws(() => authority.vote(voteA), /already used/, 'vote envelope replay is refused');
  const voteB = voteEnvelope('reviewer-b', reviewerB, policy, submitted.item, 'vote-envelope-b');
  const afterB = authority.vote(voteB);
  equal(afterB.authority.authorityState, 'HOST_KEY_AUTHENTICATED_APPROVED', 'two distinct host-policy principals satisfy the authenticated threshold');
  equal(afterB.authority.authenticatedApprovalSeats, 2, 'authenticated authority counts distinct principal digests');
  equal(afterB.authority.truth.realWorldIdentityProven, false, 'threshold still proves no real-world identity');
  equal(afterB.authority.truth.reconciliationAuthorized, false, 'authenticated review does not authorize reconciliation');
  equal(afterB.authority.truth.executionAuthorized, false, 'authenticated review does not authorize execution');
  check(authority.authenticatedApproved(submitted.item.id, candidate.artifactDigest), 'exact authenticated approval query passes only for exact digest');
  check(!authority.authenticatedApproved(submitted.item.id, 'f'.repeat(64)), 'authenticated approval query refuses another digest');

  const reloaded = Authority.create({ stateRoot, reviewService:Review.create({ stateRoot }), reviewTrustPolicy:policy, now:() => fixedNow });
  equal(reloaded.assess(Review.create({ stateRoot }).get(submitted.item.id)).authorityState, 'HOST_KEY_AUTHENTICATED_APPROVED', 'fresh service process reverifies stored signatures and item bindings');
  const replacementPolicy = makePolicy(keys, { policyId:'replacement-host-policy' });
  const replaced = Authority.create({ stateRoot, reviewService:Review.create({ stateRoot }), reviewTrustPolicy:replacementPolicy, now:() => fixedNow });
  equal(replaced.assess(Review.create({ stateRoot }).get(submitted.item.id)).reasonCode, 'AUTHENTICATED_SUBMISSION_INVALID', 'jointly changed current policy does not validate older envelopes');

  const duplicateCandidate = Object.assign({}, candidate, { sourceRef:'model-shadow-history-reconciliation:duplicate-principal', artifactDigest:crypto.createHash('sha256').update('duplicate-principal').digest('hex') });
  const duplicateSubmit = authority.submit(duplicateCandidate, submitEnvelope(submitter, policy, duplicateCandidate, 'submit-envelope-duplicate'));
  authority.vote(voteEnvelope('reviewer-a', reviewerA, policy, duplicateSubmit.item, 'duplicate-principal-a'));
  const outOfOrderVote = signEnvelope(reviewerARotation, {
    envelopeId:'duplicate-principal-older', operation:'VOTE', policyDigest:policy.policyDigest, keyId:'reviewer-a-rotation', issuedAt:'2026-08-21T09:59:00.000Z',
    payload:{ schema:Authority.VOTE_SCHEMA, reviewId:duplicateSubmit.item.id, artifactDigest:duplicateSubmit.item.artifactDigest, kind, sourceRef:duplicateSubmit.item.sourceRef, verdict:'APPROVE', note:'Older signed order must not replace current intent.', informedExplanation:true }
  });
  const operationsBeforeOlderVote = JSON.parse(fs.readFileSync(authority.ledgerFile, 'utf8')).operations.length;
  throws(() => authority.vote(outOfOrderVote), /must be later in signed order/, 'older valid signed vote is refused before supersession persistence');
  equal(JSON.parse(fs.readFileSync(authority.ledgerFile, 'utf8')).operations.length, operationsBeforeOlderVote, 'out-of-order vote refusal leaves the intent ledger unchanged');
  const duplicateResult = authority.vote(voteEnvelope('reviewer-a-rotation', reviewerARotation, policy, duplicateSubmit.item, 'duplicate-principal-rotation'));
  equal(duplicateResult.item.state, 'APPROVED', 'two key labels can reach legacy APPROVED');
  equal(duplicateResult.authority.authorityState, 'HELD', 'two keys for one declared principal cannot fill two authenticated seats');
  equal(duplicateResult.authority.authenticatedApprovalSeats, 1, 'rotated keys collapse to one principal seat');

  const ledger = JSON.parse(fs.readFileSync(authority.ledgerFile, 'utf8'));
  equal(ledger.schema, Authority.LEDGER_SCHEMA, 'authentication evidence persists in a separate typed ledger');
  equal(ledger.version, 2, 'authentication ledger uses intent-first v2 format');
  check(Array.isArray(ledger.operations) && ledger.operations.length === 6, 'ledger retains six signed intents before or with their ordinary projections');
  check(JSON.stringify(ledger).includes('signature'), 'ledger retains detached public signature evidence for reload verification');
  check(!JSON.stringify(ledger).includes('PRIVATE KEY'), 'authentication ledger retains no private key material');
  const recoveryCurrent = authority.projectionStatus();
  equal(recoveryCurrent.state, 'CURRENT', 'all normal signed intents have matching projections');
  equal(recoveryCurrent.projectedOperations, 5, 'recovery view counts five current exact projected operations');
  equal(recoveryCurrent.supersededOperations, 1, 'recovery view preserves one older same-principal vote as superseded');
  throws(() => authority.recoverProjection('duplicate-principal-a', Authority.RECOVERY_CONFIRMATION), /superseded signed vote projection/, 'explicit recovery cannot replay an older superseded vote');
  equal(recoveryCurrent.truth.automaticRecovery, false, 'recovery observation grants no automatic mutation');
  const saved = fs.readFileSync(authority.ledgerFile, 'utf8');
  const tampered = JSON.parse(saved);
  tampered.operations.find(operation => operation.envelope.envelopeId === 'vote-envelope-a').envelope.signature = Buffer.alloc(64, 9).toString('base64');
  fs.writeFileSync(authority.ledgerFile, JSON.stringify(tampered, null, 2) + '\n');
  equal(authority.assess(review.get(submitted.item.id)).reasonCode, 'AUTHENTICATED_VOTE_EVIDENCE_INVALID', 'tampered stored vote evidence fails closed');
  fs.writeFileSync(authority.ledgerFile, saved);

  const reversedSupersession = JSON.parse(saved);
  const olderVote = reversedSupersession.operations.find(operation => operation.envelope.envelopeId === 'duplicate-principal-a');
  const newerVote = reversedSupersession.operations.find(operation => operation.envelope.envelopeId === 'duplicate-principal-rotation');
  olderVote.supersededBy = null;
  newerVote.supersededBy = olderVote.envelope.envelopeId;
  fs.writeFileSync(authority.ledgerFile, JSON.stringify(reversedSupersession, null, 2) + '\n');
  equal(authority.assess(review.get(duplicateSubmit.item.id)).reasonCode, 'AUTHENTICATED_VOTE_EVIDENCE_INVALID', 'unsigned supersession pointers cannot reverse signed vote order');
  equal(authority.projectionStatus().state, 'HELD', 'reversed same-principal supersession chain holds global recovery status');
  fs.writeFileSync(authority.ledgerFile, saved);

  const missingUpdatedAt = JSON.parse(saved);
  delete missingUpdatedAt.updatedAt;
  fs.writeFileSync(authority.ledgerFile, JSON.stringify(missingUpdatedAt, null, 2) + '\n');
  equal(authority.assess(review.get(submitted.item.id)).reasonCode, 'AUTHENTICATION_LEDGER_INVALID', 'v2 ledger missing its required update timestamp fails closed');
  fs.writeFileSync(authority.ledgerFile, saved);

  fs.writeFileSync(authority.ledgerFile, JSON.stringify({ schema:Authority.LEDGER_SCHEMA, version:2, operations:'not-an-array' }) + '\n');
  equal(authority.assess(review.get(submitted.item.id)).reasonCode, 'AUTHENTICATION_LEDGER_INVALID', 'malformed authentication ledger fails closed without breaking review observation');
  fs.writeFileSync(authority.ledgerFile, saved);

  const late = Authority.create({ stateRoot, reviewService:Review.create({ stateRoot }), reviewTrustPolicy:policy, now:() => Date.parse('2026-08-21T11:30:00.000Z') });
  equal(late.assess(Review.create({ stateRoot }).get(submitted.item.id)).reasonCode, 'AUTHENTICATED_SUBMISSION_INVALID', 'expired envelopes no longer provide current authority');
  const source = fs.readFileSync(path.join(__dirname, 'review-authority-service.js'), 'utf8');
  check(!/\bfetch\s*\(|XMLHttpRequest|https?:\/\//.test(source), 'authority verifier opens no network or provider');
  check(!/generateKeyPair|generateKey|privateKey/.test(source), 'authority verifier never generates or requests private keys');
  check(source.includes("path.join(stateRoot, 'review-inbox', 'trusted-review-keys.json')"), 'trust root comes from an explicit host-local path');
  check(source.includes("fs.statSync(policyFile).size > MAX_POLICY_BYTES"), 'host policy byte limit is checked before file parsing');
  check(source.indexOf('writeLedger(state);') < source.indexOf('review.submitReserved(candidate, reviewId)'), 'signed submission intent is persisted before ordinary item projection');
  check(source.indexOf('writeLedger(state);', source.indexOf('function vote(')) < source.indexOf('review.vote(item.id', source.indexOf('function vote(')), 'signed vote intent is persisted before ordinary vote projection');
  check(!/\/api\//.test(source), 'authority service exposes no browser recovery route');

  console.log('PASS Review Authority: ' + assertions + ' assertions (host-configured key possession, separated attributed votes, fail-closed authority)');
} finally {
  fs.rmSync(temp, { recursive:true, force:true });
}
