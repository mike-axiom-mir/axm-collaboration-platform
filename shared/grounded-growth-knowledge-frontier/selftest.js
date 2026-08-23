#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Knowledge = require('./grounded-growth-knowledge-frontier');
const Research = require('../research-contribution-intake/research-contribution-intake');
const Capsule = require('../portable-baseline-capsule/portable-baseline-capsule');
const Builder = require('../../docs/steward-runs/2026-08-19-grounded-growth-knowledge-frontier/build-current-knowledge-frontier');
const schema = require('./grounded-growth-knowledge-frontier-receipt.schema.json');
const contract = require('./module.contract.json');

let checks = 0;
function check(condition, label) {
  checks += 1;
  assert.ok(condition, label);
  console.log('PASS ' + label);
}

function checkThrows(fn, pattern, label) {
  checks += 1;
  assert.throws(fn, pattern, label);
  console.log('PASS ' + label);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rebuildAssessment(bundle, source) {
  return Research.buildAssessment({
    assessmentId: source.assessmentId,
    generatedAt: source.generatedAt,
    bundle
  });
}

function rebuildCapsule(source) {
  return Capsule.build({
    capsuleId: source.capsuleId,
    capturedAt: source.capturedAt,
    subject: source.subject,
    contentRef: source.contentRef,
    configRef: source.configRef,
    sourceRefs: source.sourceRefs,
    newInformationRefs: source.newInformationRefs,
    generatedViews: source.generatedViews,
    limitations: source.limitations,
    preservedSourceFields: source.preservedSourceFields,
    extensions: source.extensions,
    adapter: source.adapter
  });
}

check(schema.$id === Knowledge.KNOWLEDGE_FRONTIER_SCHEMA, 'schema identity matches implementation');
check(contract.status === 'TEST' && contract.permissions.length === 0, 'module remains TEST with zero permissions');
check(contract.boundaries.writes.length === 0, 'module performs no writes');
check(contract.boundaries.refuses.includes('cross-model-agreement-as-proof'), 'contract refuses model agreement as proof');
check(contract.boundaries.refuses.includes('research-intake-as-runtime-evidence'), 'contract refuses intake as runtime evidence');
check(contract.boundaries.refuses.includes('planning-readiness-as-candidate-presence'), 'contract refuses planning readiness as candidate presence');
check(contract.boundaries.refuses.includes('ai-workflow-evidence-as-human-benefit'), 'contract refuses AI evidence as human benefit');
check(contract.boundaries.refuses.includes('automatic-canon') && contract.boundaries.refuses.includes('foundation-mutation'), 'contract refuses automatic CANON and Foundation mutation');
check(contract.consumes.includes('strict-deterministic-canonical-json') && contract.boundaries.refuses.includes('undefined-or-non-json-representable-state'), 'contract declares strict representation closure');
check(Knowledge.stableStringify({ z: 1, a: [true, null] }) === '{"a":[true,null],"z":1}', 'safe canonical bytes remain exact');
checkThrows(() => Knowledge.stableStringify({ lost: undefined }), /unsupported undefined/i, 'unsafe canonical state is refused');

const input = Builder.currentInput();
const receipt = Knowledge.buildKnowledgeFrontier(input);
check(Knowledge.verifyKnowledgeFrontier(receipt, input).pass, 'current knowledge frontier verifies by exact rebuild');
check(receipt.status === 'TEST' && receipt.scope === 'CURRENT_GROUNDED_GROWTH_KNOWLEDGE_AI_AND_HUMAN_INPUTS', 'current receipt stays TEST and scoped');
check(receipt.counts.priorLanes === 5 && receipt.counts.totalLanes === 6, 'knowledge frontier adds exactly one lane to the five-lane source');
check(receipt.lanes.slice(0, 5).every((lane, index) => Knowledge.stableStringify(lane) === Knowledge.stableStringify(input.stewardshipFrontierReceipt.lanes[index])), 'all five source lanes remain unchanged');
const lane = receipt.lanes[5];
check(lane.id === 'RESEARCH_CONTRIBUTION_KNOWLEDGE', 'sixth lane is the research contribution lane');
check(lane.state === 'READY_FOR_BASELINE_SIMULATION_PLANNING', 'current contribution is ready only for lab planning');
check(lane.artifactCount === 7 && lane.modelSeatCount === 4, 'knowledge lane carries seven artifacts and four model seats');
check(lane.itemCount === 6 && lane.proposalCount === 6, 'knowledge lane preserves six signals and six proposal dispositions');
check(lane.warningCount === 4 && lane.holdCount === 0, 'knowledge lane preserves four warnings and zero holds');
check(lane.systemEffect.admittedVerdict === 'PASS', 'bounded shared-system effect remains admitted PASS');
check(lane.boundedAiWorkflowEvidence.admittedVerdict === 'PASS' && lane.boundedAiWorkflowEvidence.proofSurface === 'AI_WORKFLOW_EVALUATION', 'bounded AI workflow benefit remains on its native proof surface');
check(lane.humanBenefitEvidence.admittedVerdict === 'NOT_RUN', 'research human benefit remains NOT_RUN');
check(lane.planningIsExecution === false && lane.planningIsCandidatePresence === false, 'planning readiness is neither execution nor candidate presence');
check(lane.agreementIsProof === false, 'knowledge lane gives agreement no proof authority');

check(receipt.knowledgeBinding.assessmentMatchesPortableBaseline, 'assessment binds the exact portable baseline');
check(receipt.knowledgeBinding.assessmentArtifactSetMatchesBaseline, 'assessment binds the exact seven-artifact baseline set');
check(receipt.knowledgeBinding.dispositionContentIdentityMatches, 'baseline and outcome bind identical disposition bytes');
check(receipt.knowledgeBinding.dispositionIdsAliasButDigestMatches, 'different disposition aliases remain explicitly visible');
check(receipt.knowledgeBinding.baselineDispositionId !== receipt.knowledgeBinding.outcomeDispositionId, 'both disposition alias ids remain preserved');
check(receipt.knowledgeBinding.portfolioOutcomeVerifiedNatively, 'portfolio research outcome is verified natively');

check(receipt.counts.researchAiWorkflowPass === 1 && receipt.counts.researchHumanPass === 0, 'AI and human evidence counts remain separate');
check(receipt.balance.technicalKnowledgeIntakeReady === true, 'technical knowledge intake readiness is visible');
check(receipt.balance.boundedResearchAiWorkflowEvidencePresent === true, 'bounded research AI evidence is visible');
check(receipt.balance.researchHumanBenefitEvidencePresent === false, 'human benefit absence remains visible');
check(receipt.balance.researchAttributionComplete === false && receipt.balance.crossModelIndependenceEstablished === false, 'attribution and independence remain incomplete');
check(receipt.balance.groundedGrowthForAiAndHumansEstablished === false, 'shared AI-and-human growth remains unclaimed');
check(receipt.balance.unresolvedEvidence.length === 9, 'all nine distinct current evidence seams remain open');
check(receipt.balance.unresolvedEvidence.includes('RESEARCH_HUMAN_BENEFIT_NATIVE_EVIDENCE'), 'research human evidence seam is explicit');
check(receipt.balance.unresolvedEvidence.includes('RESEARCH_CROSS_MODEL_INDEPENDENCE_EVIDENCE'), 'research independence seam is explicit');

check(receipt.decision.autonomousActionCount === 0 && receipt.decision.reviewableActionCount === 0, 'knowledge readiness manufactures no action');
check(receipt.decision.currentBestAction === 'WAIT_FOR_NEW_EVIDENCE_OR_EXPLICIT_CANDIDATE', 'current best action remains the bounded wait');
check(receipt.decision.externalEventsThatMayChangeFrontier.includes('NEW_DIGEST_BOUND_RESEARCH_CONTRIBUTION'), 'new research contribution is an explicit frontier-changing event');
check(receipt.decision.externalEventsThatMayChangeFrontier.includes('VOLUNTARY_HUMAN_OUTCOME_FOR_RESEARCH_WORKFLOW'), 'voluntary human outcome is an explicit frontier-changing event');
check(receipt.truth.structuralIntakeIsEvidence === false && receipt.truth.planningReadinessIsCandidatePresence === false, 'truth block refuses intake and planning substitution');
check(receipt.truth.aiWorkflowEvidenceIsModelLearning === false && receipt.truth.aiWorkflowEvidenceIsHumanBenefit === false, 'truth block separates AI workflow evidence from learning and human benefit');
check(receipt.truth.sharedGrowthClaimed === false && receipt.truth.modelWeightTrainingClaimed === false, 'truth block claims neither shared growth nor model-weight training');
check(receipt.truth.automaticExecution === false && receipt.truth.automaticPromotion === false && receipt.truth.automaticCanon === false, 'truth block grants no execution promotion or CANON authority');

const tamperedReceipt = clone(receipt);
tamperedReceipt.balance.groundedGrowthForAiAndHumansEstablished = true;
check(!Knowledge.verifyKnowledgeFrontier(tamperedReceipt, input).pass, 'silent shared-growth promotion fails exact verification');

const badStewardship = clone(input);
badStewardship.stewardshipFrontierReceipt.decision.autonomousActionCount = 1;
checkThrows(() => Knowledge.buildKnowledgeFrontier(badStewardship), /stewardship frontier invalid/, 'tampered stewardship frontier is refused');

const badAssessment = clone(input);
badAssessment.researchContributionAssessment.counts.holds = 1;
checkThrows(() => Knowledge.buildKnowledgeFrontier(badAssessment), /research contribution assessment invalid/, 'tampered research assessment is refused');

const badBaseline = clone(input);
badBaseline.baselineCapsule.truth.sourceExecuted = true;
checkThrows(() => Knowledge.buildKnowledgeFrontier(badBaseline), /portable baseline capsule invalid/, 'tampered baseline authority is refused');

const extraBundle = clone(input.researchContributionAssessment.bundle);
extraBundle.artifacts.push({
  id: 'research:extra-artifact', label: 'Extra artifact', mediaType: 'text/plain', bytes: 1,
  sha256: Research.sha256(Buffer.from('x')), reportedSeatIds: []
});
const extraArtifact = clone(input);
extraArtifact.researchContributionAssessment = rebuildAssessment(extraBundle, input.researchContributionAssessment);
checkThrows(() => Knowledge.buildKnowledgeFrontier(extraArtifact), /artifact set does not match/, 'self-consistent extra research artifact is refused by baseline binding');

const otherCapsuleSource = clone(input.baselineCapsule);
const disposition = otherCapsuleSource.extensions.find(item => item.namespace === 'axm.5yff.research-disposition');
disposition.extensionRef.id = 'research:other-disposition';
disposition.extensionRef.sha256 = Research.sha256(Buffer.from('other disposition'));
const otherCapsule = rebuildCapsule(otherCapsuleSource);
const otherBundle = clone(input.researchContributionAssessment.bundle);
otherBundle.baselineRef = Capsule.capsuleReference(otherCapsule);
const otherDisposition = clone(input);
otherDisposition.baselineCapsule = otherCapsule;
otherDisposition.researchContributionAssessment = rebuildAssessment(otherBundle, input.researchContributionAssessment);
checkThrows(() => Knowledge.buildKnowledgeFrontier(otherDisposition), /portfolio must contain exactly one/, 'self-consistent alternate disposition is refused without a matching portfolio outcome');

const heldBundle = clone(input.researchContributionAssessment.bundle);
const observed = heldBundle.signals.find(signal => signal.evidenceStage === 'OBSERVED');
observed.evidenceSourceIds = [];
const heldInput = clone(input);
heldInput.researchContributionAssessment = rebuildAssessment(heldBundle, input.researchContributionAssessment);
const heldReceipt = Knowledge.buildKnowledgeFrontier(heldInput);
check(heldReceipt.lanes[5].state === 'HELD_FOR_EVIDENCE_REPAIR', 'held research intake stays held in the knowledge lane');
check(heldReceipt.decision.currentBestAction === 'WAIT_FOR_RESEARCH_CONTRIBUTION_EVIDENCE_REPAIR', 'held research intake changes only the bounded wait reason');
check(heldReceipt.decision.autonomousActionCount === 0, 'held research intake still grants no autonomous action');
check(heldReceipt.balance.unresolvedEvidence.includes('RESEARCH_CONTRIBUTION_EVIDENCE_REPAIR'), 'held research repair seam remains explicit');

const future = clone(input);
future.generatedAt = '2026-08-19T08:00:00.000Z';
checkThrows(() => Knowledge.buildKnowledgeFrontier(future), /cannot predate source/, 'knowledge frontier cannot predate its sources');

const extraField = clone(input);
extraField.automaticRun = true;
checkThrows(() => Knowledge.buildKnowledgeFrontier(extraField), /unsupported field/, 'undeclared automatic-run field is refused');

console.log('Grounded Growth Knowledge Frontier selftest passed: ' + checks + ' checks.');
