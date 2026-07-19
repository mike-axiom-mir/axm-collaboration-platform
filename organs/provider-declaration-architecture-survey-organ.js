'use strict';

const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Foundation = require('../kernel/reasoning-foundation');
const Seam = require('../kernel/seam-cell');
const PatternCell = require('../kernel/provider-declaration-architecture-pattern-cell');
const ResearchExams = require('./provider-declaration-research-exam-organ');
const WorkshopRoot = require('../config/workshop-root');

const ORGAN_ID = 'axm.mirror.organ/provider-declaration-architecture-survey-v1';
const BATCH_SCHEMA = 'axm.mirror.reasoning-provider-declaration-architecture-survey-batch/v1';
const REQUEST_SCHEMA = 'axm.mirror.reasoning-provider-declaration-architecture-survey-request/v1';
const RESPONSE_SCHEMA = 'axm.mirror.reasoning-provider-declaration-architecture-survey-response/v1';
const MAX_RESULTS = 128;
const MAX_DOCUMENTS = 512;
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const SURVEY_CONTRACT = Object.freeze({
  version: 'immutable-research-exam-to-read-only-independent-declaration-pattern-survey-v1',
  sourceRoot: 'Workshop shared subtree read-only',
  fileType: 'JSON documents only',
  maximumDocuments: MAX_DOCUMENTS,
  maximumDocumentBytes: MAX_DOCUMENT_BYTES,
  documentRule: 'assess each document independently and never merge relations across documents',
  hypothesisState: 'UNTESTED',
  completePatternCeiling: 'COMPLETE_CURRENT_RELATION_WITNESS_NOT_ARCHITECTURE_EVALUATED',
  providerInference: false,
  crossDocumentRelationMerge: false,
  architectureSelection: false,
  architectureEvaluation: false,
  providerCandidateBuild: false,
  declarationWrite: false,
  workshopWrite: false,
  liveExecution: false,
  trainingAdmission: false,
  runtimePromotion: false
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => { output[key] = stable(value[key]); return output; }, {});
}
function digest(value) { return crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function without(value, key) { const copy = clone(value); delete copy[key]; return copy; }
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function clean(value, maximum = 500) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum); }
function relative(root, file) { return path.relative(root, file).replace(/\\/g, '/'); }
function inside(root, target) { const rel = path.relative(path.resolve(root), path.resolve(target)); return !!rel && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel); }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }

function sourceLineage() {
  const root = path.resolve(__dirname, '..');
  const files = [
    __filename,
    require.resolve('../kernel/provider-declaration-architecture-pattern-cell'),
    require.resolve('../kernel/reasoning-foundation'),
    require.resolve('../kernel/seam-cell'),
    require.resolve('./provider-declaration-research-exam-organ'),
    path.join(root, 'contracts', 'provider-declaration-architecture-pattern-assessment.schema.json'),
    path.join(root, 'contracts', 'reasoning-provider-declaration-architecture-survey-batch.schema.json'),
    path.join(root, 'contracts', 'reasoning-provider-declaration-architecture-survey-request.schema.json'),
    path.join(root, 'contracts', 'reasoning-provider-declaration-architecture-survey-response.schema.json')
  ];
  return files.map(file => ({ path: relative(root, file), sha256: digest(fs.readFileSync(file)) }));
}

function discoverDocuments(workshopRoot) {
  const root = path.resolve(workshopRoot);
  const sharedRoot = path.join(root, 'shared');
  if (!inside(root, sharedRoot) || !fs.existsSync(sharedRoot) || !fs.statSync(sharedRoot).isDirectory()) throw new Error('provider declaration architecture survey requires a readable Workshop shared directory');
  const documents = [];
  const oversized = [];
  function visit(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      const rel = relative(root, target);
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) {
        if (entry.name.toLowerCase().endsWith('.json')) documents.push({ relativePath: rel, content: Buffer.alloc(0), contentSha256: digest(Buffer.alloc(0)), bytes: 0, symbolic: true, insideRoot: inside(root, target) });
        continue;
      }
      if (stat.isDirectory()) visit(target);
      else if (stat.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        if (stat.size > MAX_DOCUMENT_BYTES) oversized.push({ relativePath: rel, bytes: stat.size, state: 'OVERSIZED_DOCUMENT_REFUSED_NOT_READ' });
        else {
          const content = fs.readFileSync(target);
          documents.push({ relativePath: rel, content, contentSha256: digest(content), bytes: content.length, symbolic: false, insideRoot: inside(root, target) });
        }
      }
      if (documents.length + oversized.length > MAX_DOCUMENTS) throw new Error(`provider declaration architecture survey holds: more than ${MAX_DOCUMENTS} JSON documents`);
    }
  }
  visit(sharedRoot);
  documents.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  oversized.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const receipts = documents.map(item => ({ relativePath: item.relativePath, sha256: item.contentSha256, bytes: item.bytes, symbolic: item.symbolic, insideRoot: item.insideRoot }));
  const inventoryBasis = { rootRelativePath: 'shared', documents: receipts, oversized };
  return { documents, inventory: Object.assign({ schema: 'axm.mirror.provider-declaration-architecture-document-inventory/v1', inventoryDigest: digest(inventoryBasis) }, inventoryBasis) };
}

function hypothesisRequirements(examRequest) {
  return Object.fromEntries(examRequest.architectureHypotheses.map(item => [item.hypothesisId, clone(item.mustDemonstrate)]));
}

function assessDocuments(examRequest, documents) {
  const requirements = hypothesisRequirements(examRequest);
  return documents.map(document => PatternCell.evaluate({
    relativePath: document.relativePath,
    content: document.content,
    contentSha256: document.contentSha256,
    symbolic: document.symbolic,
    insideRoot: document.insideRoot,
    requirementId: examRequest.sourceHand.requirementId,
    demandedSelectors: examRequest.knownRelations.demandedProviderSelectors,
    hypothesisRequirements: requirements
  }));
}

function summarizeHypothesis(hypothesis, assessments) {
  const patterns = assessments.filter(item => item.hypothesisId === hypothesis.hypothesisId);
  const complete = patterns.filter(item => item.completeCurrentRelationWitness);
  const partial = patterns.filter(item => item.state === 'PARTIAL_CURRENT_RELATION_WITNESS');
  let evidenceState = 'NO_RELEVANT_PATTERN_WITNESSED';
  if (complete.length) evidenceState = 'COMPLETE_CURRENT_RELATION_WITNESS_NOT_ARCHITECTURE_EVALUATED';
  else if (partial.length) evidenceState = 'PARTIAL_CURRENT_RELATION_WITNESS';
  else if (patterns.length) evidenceState = 'ARCHITECTURE_PATTERNS_EXIST_NO_CURRENT_REQUIREMENT_WITNESS';
  return {
    hypothesisId: hypothesis.hypothesisId,
    state: 'UNTESTED',
    evidenceState,
    patternCount: patterns.length,
    currentPartialWitnessCount: partial.length,
    currentCompleteWitnessCount: complete.length,
    patternAssessmentDigests: patterns.map(item => item.assessmentDigest),
    architectureSelected: false,
    architectureEvaluated: false
  };
}

function createSurvey(examRequest, documents, inventory) {
  if (!examRequest) return null;
  ResearchExams.createFrontierAssessment(examRequest);
  const assessments = assessDocuments(examRequest, documents);
  const candidateHypotheses = examRequest.architectureHypotheses.filter(item => item.hypothesisId !== 'PRESERVE_UNRESOLVED_NO_ARCHITECTURE_FIT');
  const hypothesisEvidence = candidateHypotheses.map(item => summarizeHypothesis(item, assessments));
  const completePatternWitnesses = hypothesisEvidence.reduce((sum, item) => sum + item.currentCompleteWitnessCount, 0);
  const preserve = examRequest.architectureHypotheses.find(item => item.hypothesisId === 'PRESERVE_UNRESOLVED_NO_ARCHITECTURE_FIT');
  hypothesisEvidence.push({
    hypothesisId: preserve.hypothesisId,
    state: 'UNTESTED',
    evidenceState: completePatternWitnesses === 0 ? 'CONTINUE_UNRESOLVED_NO_COMPLETE_PATTERN_WITNESS' : 'UNRESOLVED_DESPITE_STRUCTURAL_WITNESS_REQUIRES_INDEPENDENT_ARCHITECTURE_EVALUATION',
    patternCount: 0,
    currentPartialWitnessCount: 0,
    currentCompleteWitnessCount: 0,
    patternAssessmentDigests: [],
    architectureSelected: false,
    architectureEvaluated: false
  });
  const relevantPatterns = assessments.filter(item => item.hypothesisId);
  const basis = {
    schema: 'axm.mirror.provider-declaration-architecture-pattern-survey/v1',
    examRequestId: examRequest.examRequestId,
    examRequestDigest: examRequest.examRequestDigest,
    requirementId: examRequest.sourceHand.requirementId,
    demandedProviderSelectors: clone(examRequest.knownRelations.demandedProviderSelectors),
    inventoryDigest: inventory.inventoryDigest,
    documentsAssessed: assessments.length,
    relevantPatterns: relevantPatterns.map(clone),
    hypothesisEvidence,
    completePatternWitnesses,
    crossDocumentRelationMergeUsed: false,
    providerIdentityInferred: false,
    realArchitectureCandidateSupplied: false,
    architectureDecision: 'UNRESOLVED_REQUIRES_ATTRIBUTED_EXECUTOR_REVIEW_AND_REAL_CANDIDATE',
    state: completePatternWitnesses ? 'STRUCTURAL_PATTERN_WITNESS_REQUIRES_INDEPENDENT_ARCHITECTURE_EXPERIMENT' : 'NO_COMPLETE_PATTERN_WITNESS_CONTINUE_UNRESOLVED',
    authority: {
      providerIdentityInference: false,
      crossDocumentRelationMerge: false,
      architectureSelection: false,
      architectureEvaluation: false,
      providerCandidateBuild: false,
      providerContractWrite: false,
      declarationWrite: false,
      workshopWrite: false,
      readinessClaim: false,
      availabilityClaim: false,
      install: false,
      automaticStart: false,
      automaticRepair: false,
      permissionGrant: false,
      liveExecution: false,
      trainingAdmission: false,
      toolUse: false,
      networkUse: false,
      worldAction: false,
      semanticTruthWrite: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'This read-only survey preserves each declaration pattern as separate evidence. It does not merge fields across files, infer a provider, select or evaluate an architecture, write a candidate or declaration, touch Workshop, claim readiness, train, execute, install, or promote.'
  };
  const surveyId = `provider-declaration-architecture-survey-${digest(basis).slice(0, 20)}`;
  const survey = Object.assign({ surveyId, surveyDigest: null }, basis);
  survey.surveyDigest = digest(Object.assign({}, survey, { surveyDigest: null }));
  return survey;
}

function truthfulActionId(sourceResult) {
  const requirementId = sourceResult.gapAssessment.requirementId;
  return sourceResult.researchExamRequest ? `survey-declaration-architecture-patterns-${requirementId}` : `preserve-no-architecture-survey-${requirementId}`;
}

function reasoningInput(sourceResult, survey) {
  const requirementId = sourceResult.gapAssessment.requirementId;
  const truthful = truthfulActionId(sourceResult);
  const select = `select-architecture-from-pattern-count-${requirementId}`;
  const merge = `merge-relations-across-declaration-files-${requirementId}`;
  return {
    schema: 'axm.mirror.reason/v1',
    sessionId: `provider-declaration-architecture-survey-${digest(sourceResult.gapAssessment.assessmentDigest).slice(0, 20)}`,
    actor: { id: 'axm.machine.mirror/seed-0', kind: 'private-read-only-provider-declaration-architecture-survey-organ' },
    goal: 'Measure current typed declaration-pattern evidence without merging documents, inferring a provider, or selecting architecture.',
    evidence: [{
      id: 'research-exam-and-pattern-inventory', kind: 'observation', status: 'observed',
      statement: sourceResult.researchExamRequest ? `${requirementId} has an immutable research exam and ${survey.relevantPatterns.length} independently assessed relevant declaration patterns.` : `${requirementId} has no current provider-declaration research exam.`,
      source: { kind: 'provider-declaration-research-exam-result', id: sourceResult.gapAssessment.assessmentDigest, uri: `sha256:${sourceResult.gapAssessment.assessmentDigest}` },
      confidence: { low: 1, high: 1, basis: 'Content-digested current exam result and read-only per-document inventory.' }
    }],
    unknowns: sourceResult.researchExamRequest ? [{ id: 'real-architecture-fitness', question: 'Which real architecture candidate, if any, passes the independently reviewed executor with complete source evidence?', blocking: true }] : [],
    assumptions: [], constraints: [], permissions: [],
    actions: [
      { id: truthful, kind: 'proposal', label: sourceResult.researchExamRequest ? 'Preserve per-document architecture-pattern evidence with every hypothesis UNTESTED' : 'Preserve no-survey hold because no research exam exists', supportingEvidence: ['research-exam-and-pattern-inventory'], preconditionEvidence: ['research-exam-and-pattern-inventory'], requiredPermissions: [], expectedEffects: ['Pattern evidence or an explicit hold is recorded without architecture selection.'], possibleSideEffects: ['Partial fields could be mistaken for one complete provider declaration.'], reversible: true, recovery: 'Discard the survey view while preserving its source exam and inventory.', risk: 'low' },
      { id: select, kind: 'proposal', label: 'Select the architecture family with the most observed patterns', supportingEvidence: ['research-exam-and-pattern-inventory'], preconditionEvidence: ['research-exam-and-pattern-inventory'], requiredPermissions: [], expectedEffects: ['Pattern frequency would become architecture authority.'], possibleSideEffects: ['Common but incomplete shapes could be selected.'], reversible: false, recovery: 'Reject frequency as fitness and keep every hypothesis UNTESTED.', risk: 'high' },
      { id: merge, kind: 'proposal', label: 'Merge missing relations from different documents into one fictional provider', supportingEvidence: ['research-exam-and-pattern-inventory'], preconditionEvidence: ['research-exam-and-pattern-inventory'], requiredPermissions: [], expectedEffects: ['Separate partial witnesses would appear complete.'], possibleSideEffects: ['Provider identity, implementation, and permission evidence would be fabricated.'], reversible: false, recovery: 'Keep every document assessment independent and preserve missing relations.', risk: 'high' }
    ],
    decomposition: [{ id: 'separate-pattern-from-candidate', question: 'Can reusable schema evidence reduce uncertainty without becoming a provider candidate?', dependsOn: [], cheapestCheck: 'Assess each content-digested document independently against the exam relations.', status: 'ANSWERED', answerEvidenceRefs: ['research-exam-and-pattern-inventory'] }],
    pathProfiles: [
      { actionId: truthful, pathId: `truthful-${requirementId}`, approach: 'Retain every partial and missing relation per source document and leave hypotheses UNTESTED.', requiredEvidence: ['research-exam-and-pattern-inventory'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 1, reversible: true, failureConditions: ['Documents are merged or architecture is selected.'], strategyTags: ['read-only-pattern-survey', 'preserve-source-separation'] },
      { actionId: select, pathId: `frequency-selection-${requirementId}`, approach: 'Use prevalence as architecture fitness.', requiredEvidence: ['research-exam-and-pattern-inventory'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 0, reversible: false, failureConditions: ['No independent architecture experiment exists.'], strategyTags: ['reject-frequency-authority'] },
      { actionId: merge, pathId: `cross-document-merge-${requirementId}`, approach: 'Combine unrelated source fields to close gaps.', requiredEvidence: ['research-exam-and-pattern-inventory'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 0, reversible: false, failureConditions: ['No single source binds all relations.'], strategyTags: ['reject-fictional-completion'] }
    ],
    verificationReceipts: [
      { id: `verify-truthful-${requirementId}`, actionId: truthful, claim: 'The survey preserves source separation and grants no architecture authority.', evidenceRefs: ['research-exam-and-pattern-inventory'], method: 'Compare per-document assessments, hypothesis states, and authority map.', result: 'PASS', limitations: ['Does not test a real architecture candidate.'] },
      { id: `verify-select-${requirementId}`, actionId: select, claim: 'Pattern count proves architecture fitness.', evidenceRefs: ['research-exam-and-pattern-inventory'], method: 'Check required relation completeness and independent execution evidence.', result: 'FAIL', limitations: ['Frequency may inform exploration but cannot select.'] },
      { id: `verify-merge-${requirementId}`, actionId: merge, claim: 'Relations from different documents bind one provider.', evidenceRefs: ['research-exam-and-pattern-inventory'], method: 'Compare content digests and provider identities per document.', result: 'FAIL', limitations: ['A later explicit new declaration could bind them in one source.'] }
    ],
    budget: { maxCandidates: 5, deadlineMs: 1000 }
  };
}

function authorityClosed(session) {
  return session && session.authority && session.authority.proposalOnly === true && Object.entries(session.authority).every(([key, value]) => key === 'proposalOnly' ? value === true : value === false);
}

function verifySession(session, result) {
  if (!session || session.schema !== 'axm.mirror.reasoning-session/v1' || !session.cell || session.cell.learnedWeights !== false || !authorityClosed(session)) throw new Error('provider declaration architecture survey requires an authority-closed deterministic Reasoning Foundation session');
  const independent = Seam.inspectReasoningSession(session, { deliberate: true });
  if (independent.summary.open !== 0) throw new Error('provider declaration architecture survey session failed independent seam review');
  const truthful = session.pathSet.comparisons.find(item => item.actionId === result.expectedDecision.actionId);
  const select = session.pathSet.comparisons.find(item => item.actionId === result.frequencySelectionActionId);
  const merge = session.pathSet.comparisons.find(item => item.actionId === result.crossDocumentMergeActionId);
  if (!truthful || truthful.verificationStatus !== 'PASS' || !truthful.eligible || !select || select.verificationStatus !== 'FAIL' || select.eligible || !merge || merge.verificationStatus !== 'FAIL' || merge.eligible) throw new Error('provider declaration architecture survey discrimination changed');
  return true;
}

function expectedSummary(results, inventory) {
  const surveys = results.filter(item => item.survey).map(item => item.survey);
  return {
    researchExamResultsEvaluated: results.length,
    surveysProposed: surveys.length,
    noExamHolds: results.filter(item => !item.survey).length,
    inventoryDocuments: inventory.documents.length,
    inventoryOversizedDocumentsRefused: inventory.oversized.length,
    relevantPatternAssessments: surveys.reduce((sum, survey) => sum + survey.relevantPatterns.length, 0),
    completeCurrentRelationWitnesses: surveys.reduce((sum, survey) => sum + survey.completePatternWitnesses, 0),
    hypothesesRemainingUntested: surveys.reduce((sum, survey) => sum + survey.hypothesisEvidence.filter(item => item.state === 'UNTESTED').length, 0),
    reasoningDecisionsMatched: results.filter(item => item.behaviorMatched).length,
    frequencySelectionsRejected: results.filter(item => item.frequencySelectionRejected).length,
    crossDocumentMergesRejected: results.filter(item => item.crossDocumentMergeRejected).length,
    providerIdentitiesInferred: 0,
    architecturesSelected: 0,
    architecturesEvaluated: 0,
    providerCandidatesBuilt: 0,
    providerDeclarationsWritten: 0,
    liveExperimentsExecuted: 0,
    workshopFilesChanged: 0,
    trainingReceiptsCreated: 0,
    worldActionsExecuted: 0
  };
}

function verifySurvey(survey, examRequest, documents) {
  if (!survey || survey.surveyDigest !== digest(Object.assign({}, survey, { surveyDigest: null })) || survey.examRequestId !== examRequest.examRequestId || survey.examRequestDigest !== examRequest.examRequestDigest) throw new Error('provider declaration architecture survey digest or exam binding mismatch');
  if (survey.architectureDecision !== 'UNRESOLVED_REQUIRES_ATTRIBUTED_EXECUTOR_REVIEW_AND_REAL_CANDIDATE' || survey.crossDocumentRelationMergeUsed || survey.providerIdentityInferred || survey.realArchitectureCandidateSupplied || survey.hypothesisEvidence.length !== 4 || survey.hypothesisEvidence.some(item => item.state !== 'UNTESTED' || item.architectureSelected || item.architectureEvaluated) || Object.values(survey.authority).some(Boolean)) throw new Error('provider declaration architecture survey boundary changed');
  for (const assessment of survey.relevantPatterns) {
    if (assessment.assessmentDigest !== digest(Object.assign({}, assessment, { assessmentDigest: null })) || !assessment.hypothesisId || Object.values(assessment.authority).some(Boolean)) throw new Error('provider declaration architecture pattern assessment changed');
  }
  if (documents) {
    const expected = createSurvey(examRequest, documents.documents, documents.inventory);
    if (!same(survey, expected)) throw new Error('provider declaration architecture survey no longer matches current document inventory');
  }
  return true;
}

function verifyBatch(batch, runDir, researchDerived, discovered) {
  if (!batch || batch.schema !== BATCH_SCHEMA || batch.batchDigest !== digest(without(batch, 'batchDigest'))) throw new Error('invalid provider declaration architecture survey batch or digest');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false) throw new Error('provider declaration architecture survey identity changed');
  if (!batch.authority || batch.authority.privateEvidenceTraceWrite !== true || Object.entries(batch.authority).some(([key, value]) => key !== 'privateEvidenceTraceWrite' && value !== false)) throw new Error('provider declaration architecture survey authority changed');
  const lineage = sourceLineage();
  if (!same(batch.sourceLineage, lineage)) throw new Error('provider declaration architecture survey source lineage mismatch');
  if (!Array.isArray(batch.results) || batch.results.length > MAX_RESULTS) throw new Error('provider declaration architecture survey result bound changed');
  if (researchDerived) {
    ResearchExams.verifyBatch(researchDerived.batch, researchDerived.runDir, researchDerived.providerDerived);
    if (batch.sourceResearchExamBatch.batchId !== researchDerived.batch.batchId || batch.sourceResearchExamBatch.batchDigest !== researchDerived.batch.batchDigest) throw new Error('provider declaration architecture survey source batch changed');
  }
  if (discovered && !same(batch.inventory, discovered.inventory)) throw new Error('provider declaration architecture survey inventory changed');
  const inputBasis = { organ: ORGAN_ID, surveyContract: SURVEY_CONTRACT, sourceLineage: lineage, sourceResearchExamBatch: batch.sourceResearchExamBatch, inventory: batch.inventory, surveyFoundations: batch.results.map(item => ({ requirementId: item.requirementId, examRequestDigest: item.researchExamRequest ? item.researchExamRequest.examRequestDigest : null, survey: item.survey })) };
  const inputsDigest = digest(inputBasis);
  if (batch.inputsDigest !== inputsDigest || batch.batchId !== `reasoning-provider-declaration-architecture-surveys-${inputsDigest.slice(0, 20)}`) throw new Error('provider declaration architecture survey input lineage mismatch');
  const sourceByRequirement = researchDerived ? new Map(researchDerived.batch.results.map(item => [item.gapAssessment.requirementId, item])) : null;
  for (const result of batch.results) {
    const source = sourceByRequirement && sourceByRequirement.get(result.requirementId);
    if (source && ((source.researchExamRequest == null) !== (result.researchExamRequest == null) || (source.researchExamRequest && !same(source.researchExamRequest, result.researchExamRequest)))) throw new Error('provider declaration architecture survey source result changed');
    if (!!result.survey !== !!result.researchExamRequest) throw new Error('provider declaration architecture survey presence does not follow the source exam');
    if (result.survey) verifySurvey(result.survey, result.researchExamRequest, discovered);
    if (!result.behaviorMatched || !result.frequencySelectionRejected || !result.crossDocumentMergeRejected || result.providerIdentityInferred || result.architectureSelected || result.architectureEvaluated || result.providerCandidateBuilt || result.providerDeclarationWritten || result.liveExperimentExecuted || result.workshopChanged || result.trainingReceiptCreated || result.worldActionExecuted) throw new Error('provider declaration architecture survey result exceeds read-only boundary');
    if (runDir) {
      const sessionFile = path.resolve(runDir, result.sessionFile || '');
      if (!inside(runDir, sessionFile) || !fs.existsSync(sessionFile)) throw new Error(`provider declaration architecture survey session missing: ${result.reasoningSessionId}`);
      const bytes = fs.readFileSync(sessionFile);
      if (digest(bytes) !== result.sessionSha256) throw new Error(`provider declaration architecture survey session hash mismatch: ${result.reasoningSessionId}`);
      const session = JSON.parse(bytes.toString('utf8'));
      if (digest(session) !== result.sessionDigest || session.reasoningSessionId !== result.reasoningSessionId) throw new Error('provider declaration architecture survey session lineage mismatch');
      verifySession(session, result);
    }
  }
  if (!same(batch.summary, expectedSummary(batch.results, batch.inventory))) throw new Error('provider declaration architecture survey summary mismatch');
  return true;
}

function derive(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const workshopRoot = WorkshopRoot.resolve({ workshopRoot: options.workshopRoot });
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'provider-declaration-architecture-survey-runs'));
  if (!inside(root, stateDir)) throw new Error('provider declaration architecture survey private state must stay inside Mirror root');
  const researchDerived = options.researchDerived || ResearchExams.derive(Object.assign({}, options.researchOptions || {}, { root, workshopRoot }));
  ResearchExams.verifyBatch(researchDerived.batch, researchDerived.runDir, researchDerived.providerDerived);
  if (researchDerived.batch.results.length > MAX_RESULTS) throw new Error(`provider declaration architecture survey holds: ${researchDerived.batch.results.length} results exceed ${MAX_RESULTS}`);
  const discovered = discoverDocuments(workshopRoot);
  const foundations = researchDerived.batch.results.map(item => ({
    requirementId: item.gapAssessment.requirementId,
    researchExamRequest: item.researchExamRequest ? clone(item.researchExamRequest) : null,
    survey: item.researchExamRequest ? createSurvey(item.researchExamRequest, discovered.documents, discovered.inventory) : null
  })).sort((a, b) => a.requirementId.localeCompare(b.requirementId));
  const lineage = sourceLineage();
  const sourceResearchExamBatch = { batchId: researchDerived.batch.batchId, batchDigest: researchDerived.batch.batchDigest };
  const inputBasis = { organ: ORGAN_ID, surveyContract: SURVEY_CONTRACT, sourceLineage: lineage, sourceResearchExamBatch, inventory: discovered.inventory, surveyFoundations: foundations.map(item => ({ requirementId: item.requirementId, examRequestDigest: item.researchExamRequest ? item.researchExamRequest.examRequestDigest : null, survey: item.survey })) };
  const inputsDigest = digest(inputBasis);
  const batchId = `reasoning-provider-declaration-architecture-surveys-${inputsDigest.slice(0, 20)}`;
  const runDir = path.join(stateDir, batchId);
  const batchFile = path.join(runDir, 'batch.json');
  if (fs.existsSync(batchFile)) {
    const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    verifyBatch(batch, runDir, researchDerived, discovered);
    return { batch, runDir, reused: true, researchDerived };
  }
  fs.mkdirSync(stateDir, { recursive: true });
  const stageDir = path.join(stateDir, `.s-${digest(batchId).slice(0, 12)}-${process.pid}`);
  fs.mkdirSync(path.join(stageDir, 's'), { recursive: true });
  const sourceByRequirement = new Map(researchDerived.batch.results.map(item => [item.gapAssessment.requirementId, item]));
  const results = foundations.map(foundation => {
    const source = sourceByRequirement.get(foundation.requirementId);
    const session = Foundation.run(reasoningInput(source, foundation.survey), { at: '1970-01-01T00:00:00.000Z' });
    const expectedAction = truthfulActionId(source);
    const frequencySelectionActionId = `select-architecture-from-pattern-count-${foundation.requirementId}`;
    const crossDocumentMergeActionId = `merge-relations-across-declaration-files-${foundation.requirementId}`;
    const select = session.pathSet.comparisons.find(item => item.actionId === frequencySelectionActionId);
    const merge = session.pathSet.comparisons.find(item => item.actionId === crossDocumentMergeActionId);
    const observedDecision = { value: session.principleTrace.decision.value, actionId: session.principleTrace.decision.selectedActionId };
    const sessionFile = path.join('s', `${digest(source.gapAssessment.assessmentDigest).slice(0, 20)}.json`).replace(/\\/g, '/');
    const bytes = Buffer.from(json(session), 'utf8');
    const result = Object.assign({}, foundation, {
      expectedDecision: { value: 1, actionId: expectedAction },
      frequencySelectionActionId,
      crossDocumentMergeActionId,
      observedDecision,
      behaviorMatched: observedDecision.value === 1 && observedDecision.actionId === expectedAction,
      frequencySelectionRejected: !!select && select.verificationStatus === 'FAIL' && select.eligible === false,
      crossDocumentMergeRejected: !!merge && merge.verificationStatus === 'FAIL' && merge.eligible === false,
      reasoningSessionId: session.reasoningSessionId,
      sessionFile,
      sessionSha256: digest(bytes),
      sessionDigest: digest(session),
      providerIdentityInferred: false,
      architectureSelected: false,
      architectureEvaluated: false,
      providerCandidateBuilt: false,
      providerDeclarationWritten: false,
      liveExperimentExecuted: false,
      workshopChanged: false,
      trainingReceiptCreated: false,
      worldActionExecuted: false
    });
    verifySession(session, result);
    fs.writeFileSync(path.join(stageDir, sessionFile), bytes, { flag: 'wx' });
    return result;
  });
  const batch = {
    schema: BATCH_SCHEMA,
    batchId,
    batchDigest: null,
    inputsDigest,
    createdAt: null,
    organ: { id: ORGAN_ID, status: 'TEST_AUTOMATIC_READ_ONLY_PROVIDER_DECLARATION_ARCHITECTURE_PATTERN_SURVEY', learnedWeights: false },
    cell: { id: PatternCell.CELL_ID, schema: PatternCell.SCHEMA, learnedWeights: false },
    surveyContract: SURVEY_CONTRACT,
    sourceLineage: lineage,
    sourceResearchExamBatch,
    inventory: discovered.inventory,
    results,
    summary: expectedSummary(results, discovered.inventory),
    authority: {
      privateEvidenceTraceWrite: true,
      providerIdentityInference: false,
      crossDocumentRelationMerge: false,
      architectureSelection: false,
      architectureEvaluation: false,
      providerCandidateBuild: false,
      providerContractWrite: false,
      declarationWrite: false,
      workshopWrite: false,
      readinessClaim: false,
      availabilityClaim: false,
      install: false,
      automaticStart: false,
      automaticRepair: false,
      permissionGrant: false,
      liveExecution: false,
      trainingAdmission: false,
      toolUse: false,
      networkUse: false,
      worldAction: false,
      semanticTruthWrite: false,
      activeModelChange: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'The organ may read bounded JSON documents under Workshop shared, record content-digested per-document pattern assessments under ignored private state, and preserve missing relations. It cannot merge documents into a provider, infer identity, select or evaluate architecture, build or write a provider, touch Workshop, claim readiness, train, execute, grant, install, or promote.'
  };
  batch.batchDigest = digest(without(batch, 'batchDigest'));
  verifyBatch(batch, stageDir, researchDerived, discovered);
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused, researchDerived };
}

function respond(batchOrDerived, request = {}) {
  const batch = batchOrDerived && batchOrDerived.batch ? batchOrDerived.batch : batchOrDerived;
  verifyBatch(batch);
  if (!request || typeof request !== 'object' || Array.isArray(request) || request.schema !== REQUEST_SCHEMA) throw new Error(`provider declaration architecture survey request must use ${REQUEST_SCHEMA}`);
  const unexpected = Object.keys(request).filter(key => !['schema', 'requirementId', 'limit'].includes(key));
  if (unexpected.length) throw new Error(`unknown critical provider declaration architecture survey query fields: ${unexpected.join(', ')}`);
  const requirementId = request.requirementId == null ? null : clean(request.requirementId, 300);
  const limit = Math.max(1, Math.min(MAX_RESULTS, Number(request.limit) || 20));
  let selected = batch.results;
  let state;
  let reason;
  if (requirementId) {
    selected = selected.filter(item => item.requirementId === requirementId);
    if (!selected.length) {
      state = 'HOLD_UNKNOWN_PROVIDER_DECLARATION_RESEARCH_RESULT';
      reason = 'The current research-exam batch contains no result for that requirement ID.';
    }
  }
  selected = selected.slice(0, limit);
  const surveys = selected.filter(item => item.survey && item.behaviorMatched).map(item => clone(item.survey));
  const holds = selected.filter(item => !item.survey || !item.behaviorMatched).map(item => ({ requirementId: item.requirementId, state: 'HELD_NO_ARCHITECTURE_PATTERN_SURVEY', reason: item.researchExamRequest ? 'Reasoning behavior did not match.' : 'No provider-declaration research exam exists.' }));
  if (!state && surveys.length) {
    state = 'PROPOSED_PROVIDER_DECLARATION_ARCHITECTURE_PATTERN_EVIDENCE';
    reason = 'Read-only per-document pattern evidence reduces structural unknowns while every architecture remains UNTESTED and unselected.';
  } else if (!state && holds.length) {
    state = 'HOLD_NO_RESEARCH_EXAM_TO_SURVEY';
    reason = 'The selected current result has no provider-declaration research exam, so no architecture survey is originated.';
  } else if (!state) {
    state = 'NO_PROVIDER_DECLARATION_RESEARCH_RESULTS';
    reason = 'No current research results are available.';
  }
  const response = {
    schema: RESPONSE_SCHEMA,
    responseDigest: null,
    organId: ORGAN_ID,
    sourceBatchId: batch.batchId,
    request: { requirementId, limit },
    state,
    reason,
    surveys,
    holds,
    architectureSelected: false,
    architectureEvaluated: false,
    providerCandidateBuilt: false,
    providerDeclarationWritten: false,
    authority: clone(batch.authority),
    boundary: batch.boundary
  };
  response.responseDigest = digest(without(response, 'responseDigest'));
  return response;
}

module.exports = {
  ORGAN_ID, BATCH_SCHEMA, REQUEST_SCHEMA, RESPONSE_SCHEMA, MAX_RESULTS, MAX_DOCUMENTS, MAX_DOCUMENT_BYTES, SURVEY_CONTRACT,
  digest, sourceLineage, discoverDocuments, hypothesisRequirements, assessDocuments, summarizeHypothesis, createSurvey,
  truthfulActionId, reasoningInput, verifySession, expectedSummary, verifySurvey, verifyBatch, derive, respond
};
