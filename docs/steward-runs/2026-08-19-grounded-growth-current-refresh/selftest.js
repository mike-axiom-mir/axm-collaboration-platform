#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const CapabilityLoop = require('../../../shared/verified-capability-loop/verified-capability-loop');
const Builder = require('./build-current-portfolio');

let passed = 0;
function check(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  process.stdout.write('PASS ' + name + '\n');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rebuildOutcome(receipt, claims) {
  return Growth.buildOutcome({
    outcomeId: receipt.outcomeId,
    generatedAt: receipt.generatedAt,
    cycleReceipt: receipt.cycleReceipt,
    interventionRef: receipt.interventionRef,
    previousOutcomeRef: receipt.previousOutcomeRef,
    noNewInformation: receipt.noNewInformation,
    informationRefs: receipt.informationRefs,
    claims: claims || receipt.claims,
    refresh: receipt.refresh
  });
}

(async () => {
  const current = await Builder.build();
  const recordedSummary = await Builder.verifyRecorded();
  const portfolio = current.portfolio;
  const outcomes = portfolio.outcomes;
  const newer = outcomes.filter(outcome => outcome.outcomeId !== 'grounded-growth-output-availability-20260819');

  check('recorded artifacts rebuild exactly from current evidence', recordedSummary.summaryDigest === current.summary.summaryDigest);
  check('current portfolio passes its native verifier', Growth.verifyPortfolio(portfolio).pass);
  check('portfolio contains four outcomes for four capabilities', portfolio.summary.outcomeCount === 4 && portfolio.summary.capabilityCount === 4);
  check('portfolio preserves the prior source-closure outcome', outcomes.some(outcome => outcome.outcomeId === 'grounded-growth-output-availability-20260819'));
  check('portfolio adds the baseline lab outcome', outcomes.some(outcome => outcome.outcomeId === 'grounded-growth-baseline-no-new-stop-20260819'));
  check('portfolio adds the public research replay outcome', outcomes.some(outcome => outcome.outcomeId === 'grounded-growth-public-research-replay-20260819'));
  check('portfolio adds the workspace-local package proof outcome', outcomes.some(outcome => outcome.outcomeId === 'grounded-growth-workspace-local-package-proof-20260819'));
  check('every outcome passes the native outcome verifier', outcomes.every(outcome => Growth.verifyOutcome(outcome).pass));
  check('every embedded capability cycle passes its native verifier', outcomes.every(outcome => CapabilityLoop.verify(outcome.cycleReceipt).pass));
  check('all four outcomes remain candidate-only', outcomes.every(outcome => outcome.state === 'CANDIDATE_ONLY'));
  check('portfolio refuses to relabel candidate effects as beneficiary growth', portfolio.summary.overall === 'CANDIDATES_OR_UNKNOWN_EFFECTS');

  const baseline = current.outcomes.baselineLab;
  const research = current.outcomes.publicResearchReplay;
  const packageRoute = current.outcomes.workspaceLocalPackageProof;
  check('baseline lab reuses an existing capability without an improvement claim', baseline.cycleReceipt.state === 'REUSE_EXISTING' && baseline.cycleReceipt.improvementClaim === 'NOT_ESTABLISHED');
  check('research replay reuses the bounded run envelope without an improvement claim', research.cycleReceipt.state === 'REUSE_EXISTING' && research.cycleReceipt.improvementClaim === 'NOT_ESTABLISHED');
  check('package route remains a verified candidate awaiting a human steward', packageRoute.cycleReceipt.state === 'AWAITING_STEWARD' && packageRoute.cycleReceipt.improvementClaim === 'VERIFIED_CANDIDATE_ONLY');
  check('package candidate remains experimental and uninstalled', packageRoute.cycleReceipt.candidate.status === 'EXPERIMENTAL' && packageRoute.cycleReceipt.candidate.installed === false);
  check('package candidate remains unpromoted and non-canonical', packageRoute.cycleReceipt.candidate.promoted === false && packageRoute.cycleReceipt.candidate.canon === false);
  check('package candidate has no fabricated steward decision or availability', packageRoute.cycleReceipt.stewardDecision === null && packageRoute.cycleReceipt.availability === null);

  const claims = outcomes.flatMap(outcome => outcome.claims);
  check('all four bounded shared-system effects are admitted PASS', claims.filter(claim => claim.beneficiary === 'SHARED_SYSTEM' && claim.admittedVerdict === 'PASS').length === 4);
  check('no human benefit is admitted', claims.filter(claim => claim.beneficiary === 'HUMAN' && claim.admittedVerdict === 'PASS').length === 0);
  check('every human claim remains NOT_RUN', claims.filter(claim => claim.beneficiary === 'HUMAN').every(claim => claim.verdict === 'NOT_RUN' && claim.routeStatus === 'NOT_PROVEN'));
  check('only the previously held-out AI workflow result remains admitted', claims.filter(claim => claim.beneficiary === 'AI_WORKFLOW' && claim.admittedVerdict === 'PASS').length === 1);
  check('all three newer AI-workflow claims remain NOT_RUN', newer.flatMap(outcome => outcome.claims).filter(claim => claim.beneficiary === 'AI_WORKFLOW').every(claim => claim.verdict === 'NOT_RUN'));
  check('all admitted claims use current evidence closure', claims.filter(claim => claim.routeStatus === 'ADMITTED').every(claim => claim.evidenceClosure.state === 'CURRENT'));
  check('all admitted closures cover baseline, outcome, and evidence digests', claims.filter(claim => claim.routeStatus === 'ADMITTED').every(claim => [claim.baselineRef, claim.outcomeRef, ...claim.evidenceRefs].every(ref => claim.evidenceClosure.coveredDigests.includes(ref.sha256))));
  check('no claim is held by a mismatched proof route', claims.every(claim => claim.routeStatus !== 'HOLD'));

  check('summary reports four admitted system effects', current.summary.systemEffectsAdmitted === 4);
  check('summary reports zero admitted human benefits', current.summary.humanBenefitsAdmitted === 0 && current.summary.truth.humanBenefitEstablished === false);
  check('summary preserves one prior AI-workflow benefit without inventing a new one', current.summary.aiWorkflowBenefitsAdmitted === 1 && current.summary.truth.newAiWorkflowBenefitEstablished === false);
  check('summary retains both beneficiary evidence needs', JSON.stringify(current.summary.nextEvidenceNeeds) === JSON.stringify(['AI_WORKFLOW_BENEFIT_NATIVE_EVIDENCE', 'HUMAN_BENEFIT_NATIVE_EVIDENCE']));
  const summaryPayload = clone(current.summary);
  delete summaryPayload.summaryDigest;
  check('summary digest rebuilds exactly', Growth.sha256(summaryPayload) === current.summary.summaryDigest);
  check('portfolio reference binds the exact portfolio digest', current.summary.portfolioRef.sha256 === portfolio.portfolioDigest);

  const humanRouteTamper = clone(packageRoute.claims);
  const humanClaim = humanRouteTamper.find(claim => claim.beneficiary === 'HUMAN');
  humanClaim.verdict = 'PASS';
  humanClaim.proofSurface = 'FOCUSED_RUNTIME';
  humanClaim.baselineRef = packageRoute.claims[0].baselineRef;
  humanClaim.outcomeRef = packageRoute.claims[0].outcomeRef;
  humanClaim.evidenceRefs = packageRoute.claims[0].evidenceRefs;
  humanClaim.evidenceClosure = packageRoute.claims[0].evidenceClosure;
  const heldHumanOutcome = rebuildOutcome(packageRoute, humanRouteTamper);
  check('deterministic proof cannot be relabeled as human benefit', heldHumanOutcome.state === 'EVIDENCE_HOLD' && heldHumanOutcome.claims.find(claim => claim.beneficiary === 'HUMAN').admittedVerdict === 'UNKNOWN');

  const aiRouteTamper = clone(research.claims);
  const aiClaim = aiRouteTamper.find(claim => claim.beneficiary === 'AI_WORKFLOW');
  aiClaim.verdict = 'PASS';
  aiClaim.proofSurface = 'FOCUSED_RUNTIME';
  aiClaim.baselineRef = research.claims[0].baselineRef;
  aiClaim.outcomeRef = research.claims[0].outcomeRef;
  aiClaim.evidenceRefs = research.claims[0].evidenceRefs;
  aiClaim.evidenceClosure = research.claims[0].evidenceClosure;
  const heldAiOutcome = rebuildOutcome(research, aiRouteTamper);
  check('component proof cannot be relabeled as AI-workflow benefit', heldAiOutcome.state === 'EVIDENCE_HOLD' && heldAiOutcome.claims.find(claim => claim.beneficiary === 'AI_WORKFLOW').admittedVerdict === 'UNKNOWN');

  const closureTamper = clone(baseline.claims);
  closureTamper[0].evidenceClosure.coveredDigests = closureTamper[0].evidenceClosure.coveredDigests.filter(digest => digest !== closureTamper[0].outcomeRef.sha256);
  const heldClosureOutcome = rebuildOutcome(baseline, closureTamper);
  check('missing native closure coverage creates an evidence hold', heldClosureOutcome.state === 'EVIDENCE_HOLD' && heldClosureOutcome.claims[0].routeReasons.includes('EVIDENCE_CLOSURE_DOES_NOT_COVER_CLAIM'));

  const toolDecisionTamper = clone(packageRoute.cycleReceipt);
  toolDecisionTamper.stewardDecision = {
    verdict: 'CONTINUE',
    actorKind: 'TOOL',
    actorId: 'keel',
    candidateDigest: toolDecisionTamper.candidate.artifactRef.sha256,
    confirmation: 'CONTINUE VERIFIED CAPABILITY',
    decisionRef: toolDecisionTamper.verification.receiptRef
  };
  check('tool-authored steward decision is refused', !CapabilityLoop.verify(toolDecisionTamper).pass);

  const authorityTamper = clone(portfolio);
  authorityTamper.truth.automaticCanon = true;
  check('portfolio authority tampering breaks verification', !Growth.verifyPortfolio(authorityTamper).pass);
  const omissionTamper = clone(portfolio);
  omissionTamper.outcomes = omissionTamper.outcomes.filter(outcome => outcome.outcomeId !== packageRoute.outcomeId);
  check('silently omitting a recorded later outcome breaks the exact portfolio receipt', !Growth.verifyPortfolio(omissionTamper).pass);
  const digestTamper = clone(research);
  digestTamper.receiptDigest = 'sha256:' + '0'.repeat(64);
  check('outcome digest tampering is refused', !Growth.verifyOutcome(digestTamper).pass);

  check('research replay retains agreement-not-proof', current.summary.truth.crossModelAgreementTreatedAsProof === false && research.claims[0].limitations.some(value => value.includes('independence remain unknown')));
  check('no outcome claims model-weight training', outcomes.every(outcome => outcome.truth.modelWeightTrainingClaimed === false));
  check('no outcome grants execution, promotion, CANON, or root mutation', outcomes.every(outcome => outcome.truth.automaticExecution === false && outcome.truth.automaticPromotion === false && outcome.truth.automaticCanon === false && outcome.truth.automaticRootMutation === false));
  check('portfolio grants no automatic execution, promotion, or CANON', portfolio.truth.automaticExecution === false && portfolio.truth.automaticPromotion === false && portfolio.truth.automaticCanon === false);
  check('persistent portfolio contains no personal machine path', !/[A-Z]:\\Users\\|\/home\//i.test(JSON.stringify(portfolio)));
  check('builder is read-only and exposes no write operation', !/writeFile|appendFile|rmSync|unlinkSync|renameSync/.test(fs.readFileSync(path.join(__dirname, 'build-current-portfolio.js'), 'utf8')));

  process.stdout.write('\nGrounded growth current refresh audit: PASS (' + passed + ' checks)\n');
})().catch(error => {
  process.stderr.write((error.stack || error.message) + '\n');
  process.exitCode = 1;
});
