#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const Builder = require('./build-ai-workflow-coverage');

let passed = 0;
function check(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  process.stdout.write('PASS ' + name + '\n');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rebuildOutcome(receipt, overrides) {
  overrides = overrides || {};
  return Growth.buildOutcome({
    outcomeId: receipt.outcomeId,
    generatedAt: receipt.generatedAt,
    cycleReceipt: receipt.cycleReceipt,
    interventionRef: receipt.interventionRef,
    previousOutcomeRef: Object.prototype.hasOwnProperty.call(overrides, 'previousOutcomeRef') ? overrides.previousOutcomeRef : receipt.previousOutcomeRef,
    noNewInformation: receipt.noNewInformation,
    informationRefs: receipt.informationRefs,
    claims: overrides.claims || receipt.claims,
    refresh: receipt.refresh
  });
}

(() => {
  const baselineFixturePath = path.join(__dirname, 'BASELINE_WORKFLOW_CASES.json');
  const packageFixturePath = path.join(__dirname, 'PACKAGE_ROUTE_WORKFLOW_CASES.json');
  const baselineBytesBefore = fs.readFileSync(baselineFixturePath);
  const packageBytesBefore = fs.readFileSync(packageFixturePath);
  const current = Builder.build();
  const recordedSummary = Builder.verifyRecorded();
  const baseline = current.baselineEvaluation;
  const packageRoute = current.packageEvaluation;
  const baselineOutcome = current.baselineOutcome;
  const packageOutcome = current.packageOutcome;
  const portfolio = current.portfolio;
  const summary = current.summary;
  const priorPortfolio = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '2026-08-19-research-ai-workflow-evaluation', 'CURRENT_PORTFOLIO.json'), 'utf8'));

  check('recorded artifacts rebuild exactly from current evidence', recordedSummary.summaryDigest === summary.summaryDigest);
  check('baseline fixtures remain byte-identical after evaluation', baselineBytesBefore.equals(fs.readFileSync(baselineFixturePath)));
  check('package fixtures remain byte-identical after evaluation', packageBytesBefore.equals(fs.readFileSync(packageFixturePath)));
  check('baseline evaluation matches a fresh exact rebuild', Builder.verifyEvaluation(baseline, 'BASELINE_CHANGE_GATE').pass);
  check('package evaluation matches a fresh exact rebuild', Builder.verifyEvaluation(packageRoute, 'PACKAGE_WORKSPACE_ROUTE').pass);
  check('both receipts use the AI workflow proof surface', [baseline, packageRoute].every(item => item.beneficiary === 'AI_WORKFLOW' && item.proofSurface === 'AI_WORKFLOW_EVALUATION'));
  check('both evaluations contain eight representative cases', baseline.cases.length === 8 && packageRoute.cases.length === 8);
  check('change-gated workflow improves from three to eight correct decisions', baseline.baseline.correctDecisions === 3 && baseline.outcome.correctDecisions === 8);
  check('change-gated workflow reduces unsupported unsafe or wasteful decisions from five to zero', baseline.baseline.unsupportedUnsafeOrWastefulDecisions === 5 && baseline.outcome.unsupportedUnsafeOrWastefulDecisions === 0);
  check('workspace-local workflow improves from three to eight correct decisions', packageRoute.baseline.correctDecisions === 3 && packageRoute.outcome.correctDecisions === 8);
  check('workspace-local workflow reduces unsupported unsafe or wasteful decisions from five to zero', packageRoute.baseline.unsupportedUnsafeOrWastefulDecisions === 5 && packageRoute.outcome.unsupportedUnsafeOrWastefulDecisions === 0);
  check('every baseline candidate decision and rule matches its fixture', baseline.cases.every(item => item.candidateCorrect && item.candidateDecision === item.expectedDecision && item.candidateRule === item.expectedRule));
  check('every package candidate decision and rule matches its fixture', packageRoute.cases.every(item => item.candidateCorrect && item.candidateDecision === item.expectedDecision && item.candidateRule === item.expectedRule));
  check('every case binds a current exact source digest', [...baseline.cases, ...packageRoute.cases].every(item => /^sha256:[0-9a-f]{64}$/.test(item.sourceRef.sha256)));
  check('declared baselines are not attributed to named models', !/deepseek|openai|chatgpt|claude|sonnet|grok/i.test(JSON.stringify([baseline.baseline, packageRoute.baseline])));

  check('unchanged baseline stops instead of recursing', baseline.cases.find(item => item.id === 'unchanged-baseline-no-new-information').candidateDecision === 'STOP_NO_NEW_INFORMATION');
  check('repeated agreement does not manufacture new information', baseline.cases.find(item => item.id === 'repeated-model-agreement-without-native-evidence').candidateRule === 'AGREEMENT_IS_NOT_NEW_INFORMATION');
  check('changed baseline without information is held', baseline.cases.find(item => item.id === 'changed-baseline-without-information-reference').candidateDecision === 'HOLD_CHANGED_WITHOUT_INFORMATION');
  check('different subjects are held incomparable', baseline.cases.find(item => item.id === 'different-subject-identities').candidateDecision === 'HOLD_INCOMPARABLE');
  check('new counterexamples and requirements still run bounded work', ['new-counterexample-on-unchanged-baseline', 'new-requirement-on-unchanged-baseline'].every(id => baseline.cases.find(item => item.id === id).candidateDecision === 'RUN_BOUNDED'));

  check('transient proof follows the workspace on both drive layouts', ['d-workspace-with-c-host-temp', 'c-workspace-with-c-host-temp'].every(id => packageRoute.cases.find(item => item.id === id).candidateDecision === 'ROUTE_WORKSPACE_SCRATCH'));
  check('hostile C cwd TEMP and TMP cannot redirect the route decision', packageRoute.cases.find(item => item.id === 'hostile-cwd-temp-and-tmp').candidateRule === 'TRANSIENT_PROOF_IGNORES_HOST_TEMP_REDIRECTION');
  check('user-selected persistent output remains user routed', packageRoute.cases.find(item => item.id === 'user-requested-persistent-download').candidateDecision === 'USE_USER_SELECTED_DESTINATION');
  check('leftover transient state blocks completion', packageRoute.cases.find(item => item.id === 'leftover-workspace-proof-directory').candidateDecision === 'HOLD_FOR_CLEANUP');
  check('workspace path escape blocks completion', packageRoute.cases.find(item => item.id === 'proof-path-escapes-workspace').candidateDecision === 'HOLD_FOR_PATH_ESCAPE');
  check('failed proof blocks completion', packageRoute.cases.find(item => item.id === 'package-proof-process-fails').candidateDecision === 'HOLD_FOR_FAILED_PROOF');

  check('both evaluations claim no model invocation weights or generalization', [baseline, packageRoute].every(item => !item.truth.modelInvoked && !item.truth.modelWeightsChanged && !item.truth.modelGeneralizationClaimed));
  check('both evaluations claim no human participant or human benefit', [baseline, packageRoute].every(item => !item.truth.humanParticipant && !item.truth.humanBenefitClaimed));
  check('both evaluations grant no execution install promotion or CANON authority', [baseline, packageRoute].every(item => !item.truth.automaticExecution && !item.truth.automaticInstall && !item.truth.automaticPromotion && !item.truth.automaticCanon));

  const baselineDecisionTamper = clone(baseline);
  baselineDecisionTamper.cases[0].candidateDecision = 'RUN_BOUNDED';
  check('changed baseline decision breaks evaluation verification', !Builder.verifyEvaluation(baselineDecisionTamper, 'BASELINE_CHANGE_GATE').pass);
  const packageRuleTamper = clone(packageRoute);
  packageRuleTamper.cases[2].candidateRule = 'HOST_TEMP_DEFAULT';
  check('changed package rule breaks evaluation verification', !Builder.verifyEvaluation(packageRuleTamper, 'PACKAGE_WORKSPACE_ROUTE').pass);
  const evaluationDigestTamper = clone(packageRoute);
  evaluationDigestTamper.receiptDigest = 'sha256:' + '0'.repeat(64);
  check('changed evaluation digest breaks exact verification', !Builder.verifyEvaluation(evaluationDigestTamper, 'PACKAGE_WORKSPACE_ROUTE').pass);

  check('both linked outcomes pass the native verifier', [baselineOutcome, packageOutcome].every(outcome => Growth.verifyOutcome(outcome).pass));
  check('both linked outcomes remain candidate-only', [baselineOutcome, packageOutcome].every(outcome => outcome.state === 'CANDIDATE_ONLY'));
  check('baseline outcome points to its exact prior generation', baselineOutcome.previousOutcomeRef.id === 'grounded-growth-baseline-no-new-stop-20260819' && baselineOutcome.previousOutcomeRef.sha256 === priorPortfolio.outcomes.find(item => item.outcomeId === baselineOutcome.previousOutcomeRef.id).receiptDigest);
  check('package outcome points to its exact prior generation', packageOutcome.previousOutcomeRef.id === 'grounded-growth-workspace-local-package-proof-20260819' && packageOutcome.previousOutcomeRef.sha256 === priorPortfolio.outcomes.find(item => item.outcomeId === packageOutcome.previousOutcomeRef.id).receiptDigest);
  check('both outcomes preserve their exact prior capability cycles', baselineOutcome.cycleReceipt.receiptDigest === priorPortfolio.outcomes.find(item => item.outcomeId === baselineOutcome.previousOutcomeRef.id).cycleReceipt.receiptDigest && packageOutcome.cycleReceipt.receiptDigest === priorPortfolio.outcomes.find(item => item.outcomeId === packageOutcome.previousOutcomeRef.id).cycleReceipt.receiptDigest);
  check('both outcomes carry new evaluation information', [baselineOutcome, packageOutcome].every(outcome => !outcome.noNewInformation && outcome.informationRefs.some(ref => ref.schema === 'axm.ai-workflow-evaluation/v1')));
  check('both outcomes preserve admitted system effects', [baselineOutcome, packageOutcome].every(outcome => outcome.claims.some(claim => claim.beneficiary === 'SHARED_SYSTEM' && claim.admittedVerdict === 'PASS')));
  check('both outcomes preserve human evidence as not run', [baselineOutcome, packageOutcome].every(outcome => outcome.claims.some(claim => claim.beneficiary === 'HUMAN' && claim.verdict === 'NOT_RUN' && claim.routeStatus === 'NOT_PROVEN')));
  check('both new AI workflow claims are admitted on the native surface', [baselineOutcome, packageOutcome].every(outcome => { const claim = outcome.claims.find(item => item.beneficiary === 'AI_WORKFLOW'); return claim.admittedVerdict === 'PASS' && claim.routeStatus === 'ADMITTED' && claim.proofSurface === 'AI_WORKFLOW_EVALUATION'; }));
  check('both AI closures cover baseline outcome and every evidence ref', [baselineOutcome, packageOutcome].every(outcome => { const claim = outcome.claims.find(item => item.beneficiary === 'AI_WORKFLOW'); return [claim.baselineRef, claim.outcomeRef, ...claim.evidenceRefs].every(ref => claim.evidenceClosure.coveredDigests.includes(ref.sha256)); }));

  const wrongProofClaims = clone(baselineOutcome.claims);
  wrongProofClaims.find(claim => claim.beneficiary === 'AI_WORKFLOW').proofSurface = 'FOCUSED_RUNTIME';
  const wrongProofOutcome = rebuildOutcome(baselineOutcome, { claims: wrongProofClaims });
  check('component proof cannot replace baseline AI workflow evidence', wrongProofOutcome.state === 'EVIDENCE_HOLD' && wrongProofOutcome.claims.find(claim => claim.beneficiary === 'AI_WORKFLOW').admittedVerdict === 'UNKNOWN');
  const missingClosureClaims = clone(packageOutcome.claims);
  const missingClosureAi = missingClosureClaims.find(claim => claim.beneficiary === 'AI_WORKFLOW');
  missingClosureAi.evidenceClosure.coveredDigests = missingClosureAi.evidenceClosure.coveredDigests.filter(digest => digest !== missingClosureAi.evidenceRefs[0].sha256);
  const missingClosureOutcome = rebuildOutcome(packageOutcome, { claims: missingClosureClaims });
  check('missing evaluation closure creates an evidence hold', missingClosureOutcome.state === 'EVIDENCE_HOLD' && missingClosureOutcome.claims.find(claim => claim.beneficiary === 'AI_WORKFLOW').routeReasons.includes('EVIDENCE_CLOSURE_DOES_NOT_COVER_CLAIM'));
  const humanRelabelClaims = clone(packageOutcome.claims);
  const packageAi = humanRelabelClaims.find(claim => claim.beneficiary === 'AI_WORKFLOW');
  const packageHuman = humanRelabelClaims.find(claim => claim.beneficiary === 'HUMAN');
  packageHuman.verdict = 'PASS';
  packageHuman.proofSurface = 'AI_WORKFLOW_EVALUATION';
  packageHuman.baselineRef = packageAi.baselineRef;
  packageHuman.outcomeRef = packageAi.outcomeRef;
  packageHuman.evidenceRefs = packageAi.evidenceRefs;
  packageHuman.evidenceClosure = packageAi.evidenceClosure;
  const humanRelabelOutcome = rebuildOutcome(packageOutcome, { claims: humanRelabelClaims });
  check('AI workflow proof cannot be relabeled as human benefit', humanRelabelOutcome.state === 'EVIDENCE_HOLD' && humanRelabelOutcome.claims.find(claim => claim.beneficiary === 'HUMAN').admittedVerdict === 'UNKNOWN');

  check('refreshed portfolio passes its native verifier', Growth.verifyPortfolio(portfolio).pass);
  check('portfolio contains seven outcomes for four capability chains', portfolio.summary.outcomeCount === 7 && portfolio.summary.capabilityCount === 4);
  check('the exact prior five-outcome portfolio is preserved', Growth.stableStringify(portfolio.outcomes.slice(0, priorPortfolio.outcomes.length)) === Growth.stableStringify(priorPortfolio.outcomes));
  check('baseline and package chains now point to their later AI outcomes', portfolio.latest.some(item => item.capabilityId === baselineOutcome.capabilityId && item.outcomeId === baselineOutcome.outcomeId) && portfolio.latest.some(item => item.capabilityId === packageOutcome.capabilityId && item.outcomeId === packageOutcome.outcomeId));
  check('all seven outcomes remain candidate-only', portfolio.outcomes.every(outcome => outcome.state === 'CANDIDATE_ONLY'));
  check('portfolio overall remains candidates or unknown effects', portfolio.summary.overall === 'CANDIDATES_OR_UNKNOWN_EFFECTS');
  check('all four current chains have admitted AI workflow outcomes', summary.aiWorkflowBenefitsAdmitted === 4 && summary.truth.allCurrentCapabilityChainsHaveAdmittedAiWorkflowOutcome === true);
  check('no current chain retains an AI workflow evidence need', summary.remainingAiWorkflowNativeEvidenceNeeds.length === 0 && !summary.nextEvidenceNeeds.includes('AI_WORKFLOW_BENEFIT_NATIVE_EVIDENCE'));
  check('human benefit remains zero and the only current evidence need is human-native', summary.humanBenefitsAdmitted === 0 && summary.truth.humanBenefitEstablished === false && JSON.stringify(summary.nextEvidenceNeeds) === JSON.stringify(['HUMAN_BENEFIT_NATIVE_EVIDENCE']));
  check('summary preserves four effective system effects', summary.systemEffectsAdmitted === 4);
  check('summary digest rebuilds exactly', (() => { const payload = clone(summary); delete payload.summaryDigest; return Growth.sha256(payload) === summary.summaryDigest; })());
  check('summary binds the exact refreshed portfolio', summary.portfolioRef.sha256 === portfolio.portfolioDigest);
  check('summary refuses model improvement agreement proof and human substitution', !summary.truth.modelOrWeightImprovementClaimed && !summary.truth.crossModelAgreementTreatedAsProof && !summary.truth.technicalSystemEffectIsHumanBenefit);
  check('summary says the voluntary human gate was untouched', summary.truth.voluntaryHumanGateTouched === false);

  const missingParent = rebuildOutcome(baselineOutcome, { previousOutcomeRef: null });
  check('portfolio refuses missing baseline ancestry', (() => { try { Growth.buildPortfolio({ portfolioId: portfolio.portfolioId, generatedAt: portfolio.generatedAt, outcomes: [...priorPortfolio.outcomes, missingParent, packageOutcome] }); return false; } catch (_) { return true; } })());
  const wrongParentRef = clone(packageOutcome.previousOutcomeRef);
  wrongParentRef.id = baselineOutcome.previousOutcomeRef.id;
  wrongParentRef.sha256 = baselineOutcome.previousOutcomeRef.sha256;
  const crossLinkedPackage = rebuildOutcome(packageOutcome, { previousOutcomeRef: wrongParentRef });
  check('portfolio refuses cross-capability ancestry substitution', (() => { try { Growth.buildPortfolio({ portfolioId: portfolio.portfolioId, generatedAt: portfolio.generatedAt, outcomes: [...priorPortfolio.outcomes, baselineOutcome, crossLinkedPackage] }); return false; } catch (_) { return true; } })());
  const canonTamper = clone(portfolio);
  canonTamper.truth.automaticCanon = true;
  check('portfolio CANON-authority tampering breaks verification', !Growth.verifyPortfolio(canonTamper).pass);
  const outcomeDigestTamper = clone(packageOutcome);
  outcomeDigestTamper.receiptDigest = 'sha256:' + 'f'.repeat(64);
  check('linked outcome digest tampering breaks verification', !Growth.verifyOutcome(outcomeDigestTamper).pass);
  check('no outcome claims model-weight training', portfolio.outcomes.every(outcome => !outcome.truth.modelWeightTrainingClaimed));
  check('no outcome grants execution install promotion CANON or root mutation', portfolio.outcomes.every(outcome => !outcome.truth.automaticExecution && !outcome.truth.automaticInstall && !outcome.truth.automaticPromotion && !outcome.truth.automaticCanon && !outcome.truth.automaticRootMutation));
  check('persistent artifacts contain no personal machine path', !/[A-Z]:\\Users\\|\/home\//i.test(JSON.stringify(current)));
  check('builder is read-only and exposes no filesystem write operation', !/writeFile|appendFile|rmSync|unlinkSync|renameSync|mkdirSync/.test(fs.readFileSync(path.join(__dirname, 'build-ai-workflow-coverage.js'), 'utf8')));

  process.stdout.write('\nAI workflow coverage refresh audit: PASS (' + passed + ' checks)\n');
})()
