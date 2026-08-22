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
function loadSchema(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')); }
function exactSchemaKeys(value, schema, label) {
  assert.equal(schema.additionalProperties, false, label + ' schema must be closed');
  assert.deepEqual(Object.keys(value).sort(), schema.required.slice().sort(), label + ' runtime keys must equal required schema keys');
  assertions += 2;
}
function pair() { const keys = crypto.generateKeyPairSync('ed25519'); return { publicKeyPem:keys.publicKey.export({ type:'spki', format:'pem' }).toString(), privateKey:keys.privateKey }; }
function policyKey(id, keys, principal, roles, kinds) { return { keyId:id, algorithm:'Ed25519', publicKeyPem:keys.publicKeyPem, principalDigest:Authority.sha256('principal:' + principal), principalKind:'human', roles:roles.slice(), kinds:kinds.slice(), enabled:true }; }
function policy(keys) {
  const value = { schema:Authority.POLICY_SCHEMA, policyId:'projection-recovery-fixture', authorityOrigin:Authority.AUTHORITY_ORIGIN, issuedAt:'2026-08-21T09:00:00.000Z', expiresAt:'2026-08-22T09:00:00.000Z', submitterMayReview:false, keys, policyDigest:'sha256:' + '0'.repeat(64) };
  value.policyDigest = Authority.policyDigest(value); return value;
}
function sign(key, fields) {
  const envelope = Object.assign({ schema:Authority.ENVELOPE_SCHEMA, issuedAt:'2026-08-21T10:00:00.000Z', expiresAt:'2026-08-21T11:00:00.000Z', signatureAlgorithm:'Ed25519', signature:'' }, fields);
  envelope.signature = crypto.sign(null, Buffer.from(Authority.stableStringify(Authority.signingPayload(envelope))), key.privateKey).toString('base64'); return envelope;
}
function signedSubmit(keys, trust, candidate, id) {
  return sign(keys, { envelopeId:id, operation:'SUBMIT', policyDigest:trust.policyDigest, keyId:'submitter', payload:{ schema:Authority.SUBMIT_SCHEMA, candidateDigest:Authority.sha256(Authority.normalizeCandidate(candidate)), artifactDigest:candidate.artifactDigest, kind:candidate.kind, sourceRef:candidate.sourceRef } });
}
function signedVote(keys, trust, item, id, note) {
  return sign(keys, { envelopeId:id, operation:'VOTE', policyDigest:trust.policyDigest, keyId:'reviewer', payload:{ schema:Authority.VOTE_SCHEMA, reviewId:item.id, artifactDigest:item.artifactDigest, kind:item.kind, sourceRef:item.sourceRef, verdict:'APPROVE', note, informedExplanation:true } });
}
function candidate(kind, suffix) {
  return { kind, title:'Recover exact signed projection ' + suffix, sourceRef:'projection-recovery:' + suffix, artifactDigest:crypto.createHash('sha256').update('projection-' + suffix).digest('hex'), summary:'Signed intent is durable before the ordinary Review Inbox projection.', requiredSeats:1, action:{ type:'inspect-projection-recovery', automaticApply:false } };
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-review-projection-recovery-'));
try {
  const fixedNow = Date.parse('2026-08-21T10:15:00.000Z'), kind = 'proposal';
  const submitter = pair(), reviewer = pair();
  const trust = policy([policyKey('submitter', submitter, 'submitter', ['review.submit'], [kind]), policyKey('reviewer', reviewer, 'reviewer', ['review.vote'], [kind])]);

  const stateRoot = path.join(temp, 'intent-first'), baseReview = Review.create({ stateRoot });
  const submitCandidate = candidate(kind, 'submit-interruption'), submitIntent = signedSubmit(submitter, trust, submitCandidate, 'recovery-submit-intent');
  let submitProjectionCalled = 0;
  const failingSubmitReview = Object.assign({}, baseReview, { submitReserved(value, id) {
    submitProjectionCalled += 1;
    const ledger = JSON.parse(fs.readFileSync(path.join(stateRoot, 'review-inbox', 'authentication.json'), 'utf8'));
    check(ledger.operations.some(operation => operation.envelope.envelopeId === submitIntent.envelopeId && operation.reviewId === id), 'signed submission intent exists before the failing ordinary projection is called');
    throw new Error('simulated submission projection interruption');
  } });
  const failingSubmitAuthority = Authority.create({ stateRoot, reviewService:failingSubmitReview, reviewTrustPolicy:trust, now:() => fixedNow });
  throws(() => failingSubmitAuthority.submit(submitCandidate, submitIntent), /simulated submission projection interruption/, 'submission projection interruption is surfaced');
  equal(submitProjectionCalled, 1, 'ordinary submission projection was attempted exactly once');
  equal(baseReview.summary().total, 0, 'failed projection creates no ordinary Review Inbox item');
  const pendingSubmit = failingSubmitAuthority.projectionStatus();
  equal(pendingSubmit.state, 'RECOVERY_REQUIRED', 'durable unprojected submission is visibly recovery-required');
  equal(pendingSubmit.pendingOperations, 1, 'recovery view counts one pending submission');
  equal(pendingSubmit.operations[0].reasonCode, 'SIGNED_SUBMISSION_PROJECTION_PENDING', 'recovery view types the pending submission');
  const duplicatePendingSubmit = signedSubmit(submitter, trust, submitCandidate, 'duplicate-pending-submit-intent');
  throws(() => failingSubmitAuthority.submit(submitCandidate, duplicatePendingSubmit), /exact candidate already has a signed submission intent/, 'second envelope cannot create a competing pending intent for the same exact candidate');
  equal(JSON.parse(fs.readFileSync(failingSubmitAuthority.ledgerFile, 'utf8')).operations.length, 1, 'duplicate pending submission refusal preserves the first intent only');
  throws(() => failingSubmitAuthority.recoverProjection(submitIntent.envelopeId, 'RECOVER'), /exact signed review projection recovery confirmation/, 'recovery requires exact host-local confirmation');
  equal(baseReview.summary().total, 0, 'wrong recovery confirmation mutates nothing');

  const resumedReview = Review.create({ stateRoot }), resumedAuthority = Authority.create({ stateRoot, reviewService:resumedReview, reviewTrustPolicy:trust, now:() => fixedNow });
  const recoveredSubmit = resumedAuthority.recoverProjection(submitIntent.envelopeId, Authority.RECOVERY_CONFIRMATION);
  equal(recoveredSubmit.result, 'PROJECTED', 'explicit recovery projects the already signed submission');
  check(/^review-auth-[a-f0-9]{64}$/.test(recoveredSubmit.item.id), 'recovered submission uses its precommitted deterministic review id');
  equal(resumedAuthority.projectionStatus().state, 'CURRENT', 'submission recovery closes the pending projection');
  equal(resumedAuthority.recoverProjection(submitIntent.envelopeId, Authority.RECOVERY_CONFIRMATION).result, 'ALREADY_PROJECTED', 'repeated recovery is idempotent observation');
  equal(JSON.parse(fs.readFileSync(resumedAuthority.ledgerFile, 'utf8')).operations.length, 1, 'submission recovery does not append or rewrite signed intent evidence');

  const voteIntent = signedVote(reviewer, trust, recoveredSubmit.item, 'recovery-vote-intent', 'Recover this exact signed vote projection.');
  let voteProjectionCalled = 0;
  const failingVoteReview = Object.assign({}, resumedReview, { vote(id, input) {
    voteProjectionCalled += 1;
    const ledger = JSON.parse(fs.readFileSync(resumedAuthority.ledgerFile, 'utf8'));
    check(ledger.operations.some(operation => operation.envelope.envelopeId === voteIntent.envelopeId), 'signed vote intent exists before the failing ordinary vote projection is called');
    throw new Error('simulated vote projection interruption');
  } });
  const failingVoteAuthority = Authority.create({ stateRoot, reviewService:failingVoteReview, reviewTrustPolicy:trust, now:() => fixedNow });
  throws(() => failingVoteAuthority.vote(voteIntent), /simulated vote projection interruption/, 'vote projection interruption is surfaced');
  equal(voteProjectionCalled, 1, 'ordinary vote projection was attempted exactly once');
  equal(resumedReview.get(recoveredSubmit.item.id).votes.length, 0, 'failed vote projection creates no ordinary attributed vote');
  const pendingVoteView = failingVoteAuthority.assess(resumedReview.get(recoveredSubmit.item.id));
  equal(pendingVoteView.reasonCode, 'AUTHENTICATED_VOTE_PROJECTION_PENDING', 'authority stays held on a durable pending vote projection');
  equal(pendingVoteView.projectionState, 'PENDING', 'authority view exposes pending projection state');
  equal(pendingVoteView.pendingProjectionEnvelopeIds, [voteIntent.envelopeId], 'authority view identifies the exact pending envelope');
  equal(pendingVoteView.authenticatedApprovalSeats, 0, 'unprojected signed vote fills no authenticated approval seat');
  equal(failingVoteAuthority.projectionStatus().pendingOperations, 1, 'global recovery view counts the pending vote');

  const finalReview = Review.create({ stateRoot }), finalAuthority = Authority.create({ stateRoot, reviewService:finalReview, reviewTrustPolicy:trust, now:() => fixedNow });
  const recoveredVote = finalAuthority.recoverProjection(voteIntent.envelopeId, Authority.RECOVERY_CONFIRMATION);
  equal(recoveredVote.result, 'PROJECTED', 'explicit recovery projects the already signed vote');
  equal(recoveredVote.item.state, 'APPROVED', 'recovered one-seat vote reaches only legacy approved state');
  equal(recoveredVote.authority.authorityState, 'HOST_KEY_AUTHENTICATED_APPROVED', 'matching durable intent and projection satisfy separate host-key authority');
  equal(finalAuthority.projectionStatus().pendingOperations, 0, 'vote recovery leaves no pending operation');
  equal(finalAuthority.recoverProjection(voteIntent.envelopeId, Authority.RECOVERY_CONFIRMATION).result, 'ALREADY_PROJECTED', 'repeated vote recovery creates no duplicate vote');
  equal(finalReview.get(recoveredSubmit.item.id).votes.length, 1, 'idempotent vote recovery retains one ordinary projection');
  const finalLedger = JSON.parse(fs.readFileSync(finalAuthority.ledgerFile, 'utf8'));
  equal(finalLedger.operations.length, 2, 'intent-first ledger contains exactly one submission and one vote');
  throws(() => finalAuthority.recoverProjection('missing-envelope', Authority.RECOVERY_CONFIRMATION), /intent not found/, 'unknown recovery intent is refused');
  equal(recoveredVote.truth.crossFileAtomicityProven, false, 'successful recovery still proves no cross-file atomicity');
  equal(recoveredVote.truth.executionAuthorized, false, 'successful recovery grants no execution authority');

  const ledgerSchema = loadSchema('review-authentication-ledger.schema.json');
  const viewSchema = loadSchema('review-authority-view.schema.json');
  const indexSchema = loadSchema('review-authority-index.schema.json');
  const statusSchema = loadSchema('review-projection-recovery-status.schema.json');
  const resultSchema = loadSchema('review-projection-recovery-result.schema.json');
  [ledgerSchema, viewSchema, indexSchema, statusSchema, resultSchema].forEach(schema => equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', schema.$id + ' declares the exact JSON Schema dialect'));
  equal(ledgerSchema.$id, Authority.LEDGER_SCHEMA, 'ledger schema identity matches the service constant');
  equal(viewSchema.$id, Authority.VIEW_SCHEMA, 'authority-view schema identity matches the service constant');
  equal(indexSchema.$id, Authority.INDEX_SCHEMA, 'authority-index schema identity matches the service constant');
  equal(statusSchema.$id, Authority.RECOVERY_STATUS_SCHEMA, 'recovery-status schema identity matches the service constant');
  equal(resultSchema.$id, Authority.RECOVERY_RESULT_SCHEMA, 'recovery-result schema identity matches the service constant');
  exactSchemaKeys(finalLedger, ledgerSchema, 'v2 ledger');
  exactSchemaKeys(finalLedger.operations[0], ledgerSchema.properties.operations.items, 'v2 ledger operation');
  const finalStatus = finalAuthority.projectionStatus();
  exactSchemaKeys(finalStatus, statusSchema, 'recovery status');
  exactSchemaKeys(finalStatus.truth, statusSchema.properties.truth, 'recovery status truth');
  exactSchemaKeys(finalStatus.operations[0], statusSchema.properties.operations.items, 'recovery status operation');
  exactSchemaKeys(recoveredVote, resultSchema, 'recovery result');
  exactSchemaKeys(recoveredVote.truth, resultSchema.properties.truth, 'recovery result truth');
  exactSchemaKeys(recoveredVote.authority, viewSchema, 'authority view');
  exactSchemaKeys(recoveredVote.authority.truth, viewSchema.properties.truth, 'authority view truth');
  exactSchemaKeys(finalAuthority.assessAll(finalReview.list()), indexSchema, 'authority index');

  const legacyRoot = path.join(temp, 'legacy-migration'), legacyReview = Review.create({ stateRoot:legacyRoot });
  const legacyCandidate = candidate(kind, 'legacy-v1'), legacyItem = legacyReview.submit(legacyCandidate);
  const legacySubmitEnvelope = signedSubmit(submitter, trust, legacyCandidate, 'legacy-submit-envelope');
  const legacyNote = 'Legacy v1 exact signed vote remains reverified.';
  const legacyVoteEnvelope = signedVote(reviewer, trust, legacyItem, 'legacy-vote-envelope', legacyNote);
  legacyReview.vote(legacyItem.id, { actor:'host-key:reviewer', actorKind:'human', verdict:'APPROVE', note:legacyNote, artifactDigest:legacyItem.artifactDigest, informedExplanation:true });
  const verifiedAt = '2026-08-21T10:15:00.000Z';
  const legacyLedger = { schema:Authority.LEGACY_LEDGER_SCHEMA, records:[{ reviewId:legacyItem.id, submission:{ envelope:legacySubmitEnvelope, candidateDigest:Authority.sha256(Authority.normalizeCandidate(legacyCandidate)), itemBinding:{ id:legacyItem.id, kind:legacyItem.kind, sourceRef:legacyItem.sourceRef, artifactDigest:legacyItem.artifactDigest }, proof:{ verifiedAt } }, votes:[{ envelope:legacyVoteEnvelope, voteBinding:{}, proof:{ verifiedAt } }] }] };
  fs.mkdirSync(path.join(legacyRoot, 'review-inbox'), { recursive:true });
  fs.writeFileSync(path.join(legacyRoot, 'review-inbox', 'authentication.json'), JSON.stringify(legacyLedger, null, 2) + '\n');
  const legacyAuthority = Authority.create({ stateRoot:legacyRoot, reviewService:legacyReview, reviewTrustPolicy:trust, now:() => fixedNow });
  equal(legacyAuthority.assess(legacyReview.get(legacyItem.id)).authorityState, 'HOST_KEY_AUTHENTICATED_APPROVED', 'v1 finalized evidence remains readable and reverified');
  const migratedCandidate = candidate(kind, 'migration-write');
  legacyAuthority.submit(migratedCandidate, signedSubmit(submitter, trust, migratedCandidate, 'migration-submit-envelope'));
  const migratedLedger = JSON.parse(fs.readFileSync(legacyAuthority.ledgerFile, 'utf8'));
  equal(migratedLedger.schema, Authority.LEDGER_SCHEMA, 'next signed mutation migrates v1 evidence to v2 intent format');
  equal(migratedLedger.operations.length, 3, 'migration preserves two legacy operations and adds one new intent');
  check(migratedLedger.operations.some(operation => operation.envelope.envelopeId === legacySubmitEnvelope.envelopeId && operation.reviewId === legacyItem.id), 'migration preserves legacy submission binding');
  equal(legacyAuthority.assess(legacyReview.get(legacyItem.id)).authorityState, 'HOST_KEY_AUTHENTICATED_APPROVED', 'migrated legacy authority remains exact after v2 write');
  equal(legacyAuthority.projectionStatus().state, 'CURRENT', 'migrated and new signed intents all match ordinary projections');

  const source = fs.readFileSync(path.join(__dirname, 'review-authority-service.js'), 'utf8');
  check(source.indexOf('writeLedger(state);') < source.indexOf('review.submitReserved(candidate, reviewId)'), 'source order persists submission intent before projection');
  check(source.indexOf('writeLedger(state);', source.indexOf('function vote(')) < source.indexOf('review.vote(item.id', source.indexOf('function vote(')), 'source order persists vote intent before projection');
  check(!/authenticated-recover|projection-recover[^\n]*\/api\//.test(fs.readFileSync(path.join(__dirname, 'operations-api.js'), 'utf8')), 'operations API exposes no signed-projection recovery route');
  console.log('PASS Review Projection Recovery: ' + assertions + ' assertions (intent-first persistence, explicit recovery, v1 continuity, zero action authority)');
} finally {
  fs.rmSync(temp, { recursive:true, force:true });
}
