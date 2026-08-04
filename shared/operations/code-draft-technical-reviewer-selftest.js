#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Clone = require('../../tools/mirror-code-clone/mirror-code-clone-kernel');
const ReviewService = require('./review-service');
const TechnicalReviewer = require('./code-draft-technical-reviewer');

function json(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function moduleFixture(root, id, bounded) {
  const moduleRoot = path.join(root, 'tools', id);
  const manifest = {
    id,
    name:id,
    version:'v0.1',
    status:'TEST',
    entry:'index.html',
    type:'local-module',
    uses:[]
  };
  if (bounded) {
    manifest.schema = 'axm.tool-manifest/v1';
    manifest.contract = 'module.contract.json';
    json(path.join(moduleRoot, 'module.contract.json'), {
      schema:'axm.module-contract/v1', id, version:'v0.1',
      provides:['fixture'], consumes:[], permissions:[],
      handoffs:{ emits:[], accepts:[] },
      boundaries:{ writes:[], refuses:['automatic-apply'] },
      lifecycle:{ state_owner:'none', reload:'not-applicable', disconnect:'not-applicable', cleanup:'not-applicable' }
    });
  }
  json(path.join(moduleRoot, 'manifest.json'), manifest);
  fs.writeFileSync(path.join(moduleRoot, 'index.html'), '<!doctype html><title>' + id + '</title>\n');
}

function stage(root, candidateParent, review, moduleId) {
  const plan = Clone.discoverWorkshopDraftPlans(root).find(item => item.moduleId === moduleId);
  assert(plan, 'fixture must expose a bounded draft plan for ' + moduleId);
  const drafted = Clone.stageWorkshopDraft(root, path.join(candidateParent, moduleId), plan);
  const item = review.submit({
    kind:'code-improvement-draft',
    title:'Code draft · ' + moduleId,
    sourceRef:'mirror-code-clone:' + moduleId + ':' + plan.repairClass,
    artifactDigest:drafted.receipt.artifactDigest,
    requiredSeats:2,
    action:{ type:'review-code-draft', moduleId, candidateRoot:drafted.candidateRoot, receiptPath:drafted.receiptPath, automaticApply:false }
  });
  return { plan, drafted, item };
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-code-draft-technical-reviewer-'));
try {
  const root = path.join(temp, 'workshop');
  const stateRoot = path.join(root, 'state');
  fs.mkdirSync(path.join(root, 'tools'), { recursive:true });
  moduleFixture(root, 'unbounded-fixture', false);
  moduleFixture(root, 'bounded-fixture', true);
  moduleFixture(root, 'tampered-fixture', false);
  moduleFixture(root, 'drifted-fixture', false);

  const review = ReviewService.create({ stateRoot });
  const reviewer = TechnicalReviewer.create({ root, reviewService:review });
  const candidates = path.join(temp, 'candidates');

  const held = stage(root, candidates, review, 'unbounded-fixture');
  assert.throws(() => review.vote(held.item.id, { artifactDigest:held.item.artifactDigest, actor:'Pretend machine', actorKind:'machine', verdict:'APPROVE', note:'Caller supplied machine claim.' }), /deterministic technical reviewer/);
  assert.equal(review.get(held.item.id).votes.length, 0, 'caller-supplied machine identity must not consume a seat');
  const heldResult = reviewer.review(held.item.id, held.item.artifactDigest);
  assert.equal(heldResult.assessment.verdict, 'HOLD');
  assert(heldResult.assessment.summary.includes('empty permissions list is not proven safe'));
  assert.equal(heldResult.item.votes[0].actorKind, 'machine');
  assert.equal(heldResult.item.votes[0].technicalReview.schema, TechnicalReviewer.ASSESSMENT_SCHEMA);
  assert.throws(() => review.vote(held.item.id, { artifactDigest:held.item.artifactDigest, actor:'Mike', actorKind:'human', verdict:'APPROVE', note:'I understand the machine HOLD and would keep only after repair.', informedExplanation:true }), /machine HOLD must be repaired/);
  assert.equal(review.get(held.item.id).state, 'HOLD', 'human preference cannot override a machine HOLD');
  assert.equal(review.get(held.item.id).votes.filter(vote => vote.actorKind !== 'machine').length, 0, 'machine HOLD does not consume or request a human seat');

  const approved = stage(root, candidates, review, 'bounded-fixture');
  const approvedResult = reviewer.review(approved.item.id, approved.item.artifactDigest);
  assert.equal(approvedResult.assessment.verdict, 'APPROVE');
  assert.equal(approvedResult.assessment.wholeModuleReady, true);
  assert.equal(approvedResult.item.state, 'PENDING', 'one deterministic machine seat cannot approve alone');
  review.vote(approved.item.id, { artifactDigest:approved.item.artifactDigest, actor:'Mike', actorKind:'human', verdict:'APPROVE', note:'I read the exact candidate explanation and machine result.', informedExplanation:true });
  assert(review.approved(approved.item.id, approved.item.artifactDigest), 'independent informed human seat completes the two-seat review');
  const approvedSource = fs.readFileSync(path.join(root, 'tools', 'bounded-fixture', 'manifest.json'), 'utf8');
  assert(!approvedSource.includes('"permissions"'), 'technical review never edits Workshop source');

  const tampered = stage(root, candidates, review, 'tampered-fixture');
  fs.appendFileSync(path.join(tampered.drafted.candidateRoot, 'tools', 'tampered-fixture', 'manifest.json'), ' ');
  assert.throws(() => reviewer.review(tampered.item.id, tampered.item.artifactDigest), /hash changed after drafting/);
  assert.equal(review.get(tampered.item.id).votes.length, 0, 'tampered candidate stays locked without a machine seat');

  const drifted = stage(root, candidates, review, 'drifted-fixture');
  fs.appendFileSync(path.join(root, 'tools', 'drifted-fixture', 'manifest.json'), ' ');
  assert.throws(() => reviewer.review(drifted.item.id, drifted.item.artifactDigest), /source changed after this candidate was drafted/);
  assert.equal(review.get(drifted.item.id).votes.length, 0, 'source drift stays locked without a stale machine review');

  moduleFixture(root, 'batch-held-fixture', false);
  moduleFixture(root, 'batch-approved-fixture', true);
  const batchHeld = stage(root, candidates, review, 'batch-held-fixture');
  const batchApproved = stage(root, candidates, review, 'batch-approved-fixture');
  const batch = reviewer.reviewPending();
  assert.equal(batch.schema, TechnicalReviewer.BATCH_SCHEMA);
  assert.equal(batch.limit, 25);
  assert.equal(batch.selected, 4, 'batch selects server-owned unchecked items only');
  assert.equal(batch.checked, 2, 'valid candidates are checked even when neighboring candidates refuse');
  assert.equal(batch.approved, 1);
  assert.equal(batch.held, 1);
  assert.equal(batch.retired, 2, 'permanently invalid exact copies are retired from the active queue');
  assert.equal(batch.refused, 0, 'known permanent evidence failures do not remain in a retry loop');
  assert.equal(batch.remainingUnchecked, 0, 'retired exact copies no longer pretend that another check can help');
  assert.equal(batch.automaticApply, false);
  assert.equal(batch.applyAuthority, 'NONE');
  assert.equal(review.get(batchHeld.item.id).votes[0].verdict, 'HOLD');
  assert.equal(review.get(batchApproved.item.id).votes[0].verdict, 'APPROVE');
  assert.equal(review.get(tampered.item.id).state, 'SUPERSEDED');
  assert.equal(review.get(tampered.item.id).votes.length, 0, 'retirement is evidence, not a machine vote');
  assert.equal(review.get(tampered.item.id).technicalRefusal.reasonCode, 'CANDIDATE_DRIFT');
  assert.equal(review.get(drifted.item.id).technicalRefusal.reasonCode, 'SOURCE_DRIFT');
  const repeatedBatch = reviewer.reviewPending();
  assert.equal(repeatedBatch.selected, 0, 'checked and retired exact digests are not reviewed again');
  assert.equal(repeatedBatch.checked, 0);

  console.log('PASS deterministic technical reviewer · exact hashes · bounded batch isolation · stale exact-copy retirement · source unchanged · caller machine spoof refused · HOLD cannot be overridden · no apply authority');
} finally {
  const resolved = path.resolve(temp), prefix = path.resolve(os.tmpdir()) + path.sep;
  if (!resolved.startsWith(prefix) || !path.basename(resolved).startsWith('axm-code-draft-technical-reviewer-')) throw new Error('temporary cleanup boundary refused');
  fs.rmSync(resolved, { recursive:true, force:true });
}
