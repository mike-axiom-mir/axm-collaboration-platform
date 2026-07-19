'use strict';

const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Foundation = require('../kernel/reasoning-foundation');
const Seam = require('../kernel/seam-cell');
const EvidenceCell = require('../kernel/provider-implementation-evidence-cell');
const ArchitectureSurveys = require('./provider-declaration-architecture-survey-organ');
const WorkshopRoot = require('../config/workshop-root');

const ORGAN_ID = 'axm.mirror.organ/provider-declaration-implementation-evidence-survey-v1';
const BATCH_SCHEMA = 'axm.mirror.reasoning-provider-declaration-implementation-evidence-survey-batch/v1';
const REQUEST_SCHEMA = 'axm.mirror.reasoning-provider-declaration-implementation-evidence-survey-request/v1';
const RESPONSE_SCHEMA = 'axm.mirror.reasoning-provider-declaration-implementation-evidence-survey-response/v1';
const MAX_RESULTS = 128;
const MAX_DOCUMENTS = 512;
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const SURVEY_CONTRACT = Object.freeze({
  version: 'architecture-survey-to-static-selector-source-evidence-v1',
  sourceRoot: 'Workshop shared subtree read-only',
  fileType: 'JavaScript source text only',
  maximumDocuments: MAX_DOCUMENTS,
  maximumDocumentBytes: MAX_DOCUMENT_BYTES,
  sourceRule: 'record exact demanded selector string literals and conservative export, registration, and test syntax without executing source',
  evidenceCeiling: 'SELECTOR_SOURCE_WITNESS_NOT_PROVIDER_BINDING',
  providerInference: false,
  outerRequirementBinding: false,
  implementationSelection: false,
  architectureSelection: false,
  architectureEvaluation: false,
  sourceExecution: false,
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
    require.resolve('../kernel/provider-implementation-evidence-cell'),
    require.resolve('../kernel/reasoning-foundation'),
    require.resolve('../kernel/seam-cell'),
    require.resolve('./provider-declaration-architecture-survey-organ'),
    path.join(root, 'contracts', 'provider-implementation-evidence-assessment.schema.json'),
    path.join(root, 'contracts', 'reasoning-provider-declaration-implementation-evidence-survey-batch.schema.json'),
    path.join(root, 'contracts', 'reasoning-provider-declaration-implementation-evidence-survey-request.schema.json'),
    path.join(root, 'contracts', 'reasoning-provider-declaration-implementation-evidence-survey-response.schema.json')
  ];
  return files.map(file => ({ path: relative(root, file), sha256: digest(fs.readFileSync(file)) }));
}

function discoverSources(workshopRoot) {
  const root = path.resolve(workshopRoot);
  const sharedRoot = path.join(root, 'shared');
  if (!inside(root, sharedRoot) || !fs.existsSync(sharedRoot) || !fs.statSync(sharedRoot).isDirectory()) throw new Error('provider implementation evidence survey requires a readable Workshop shared directory');
  const documents = [];
  const oversized = [];
  function visit(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      const rel = relative(root, target);
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) {
        if (entry.name.toLowerCase().endsWith('.js')) documents.push({ relativePath: rel, content: Buffer.alloc(0), contentSha256: digest(Buffer.alloc(0)), bytes: 0, symbolic: true, insideRoot: inside(root, target) });
        continue;
      }
      if (stat.isDirectory()) visit(target);
      else if (stat.isFile() && entry.name.toLowerCase().endsWith('.js')) {
        if (stat.size > MAX_DOCUMENT_BYTES) oversized.push({ relativePath: rel, bytes: stat.size, state: 'OVERSIZED_SOURCE_REFUSED_NOT_READ' });
        else {
          const content = fs.readFileSync(target);
          documents.push({ relativePath: rel, content, contentSha256: digest(content), bytes: content.length, symbolic: false, insideRoot: inside(root, target) });
        }
      }
      if (documents.length + oversized.length > MAX_DOCUMENTS) throw new Error(`provider implementation evidence survey holds: more than ${MAX_DOCUMENTS} JavaScript sources`);
    }
  }
  visit(sharedRoot);
  documents.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  oversized.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const receipts = documents.map(item => ({ relativePath: item.relativePath, sha256: item.contentSha256, bytes: item.bytes, symbolic: item.symbolic, insideRoot: item.insideRoot }));
  const inventoryBasis = { rootRelativePath: 'shared', documents: receipts, oversized };
  return { documents, inventory: Object.assign({ schema: 'axm.mirror.provider-implementation-source-inventory/v1', inventoryDigest: digest(inventoryBasis) }, inventoryBasis) };
}

function assessSources(architectureSurvey, documents) {
  const demandedSelectors = Array.isArray(architectureSurvey && architectureSurvey.demandedProviderSelectors) ? architectureSurvey.demandedProviderSelectors : [];
  if (!demandedSelectors.length) return [];
  return documents.map(document => EvidenceCell.evaluate({
    relativePath: document.relativePath,
    content: document.content,
    contentSha256: document.contentSha256,
    symbolic: document.symbolic,
    insideRoot: document.insideRoot,
    demandedSelectors
  }));
}

function createEvidenceSurvey(architectureSurvey, documents, inventory) {
  if (!architectureSurvey) return null;
  const assessments = assessSources(architectureSurvey, documents);
  const selectorSources = assessments.filter(item => item.exactSelectorLiterals.length > 0);
  const selectorCoverage = architectureSurvey.demandedProviderSelectors.map(selector => {
    const matches = selectorSources.filter(item => item.exactSelectorLiterals.includes(selector));
    return { selector, sourceWitnesses: matches.length, sourceAssessmentDigests: matches.map(item => item.assessmentDigest), providerBindingEstablished: false, implementationSelected: false };
  });
  const basis = {
    schema: 'axm.mirror.provider-declaration-implementation-evidence-survey/v1',
    sourceArchitectureSurveyId: architectureSurvey.surveyId,
    sourceArchitectureSurveyDigest: architectureSurvey.surveyDigest,
    requirementId: architectureSurvey.requirementId,
    demandedProviderSelectors: clone(architectureSurvey.demandedProviderSelectors),
    inventoryDigest: inventory.inventoryDigest,
    sourcesAssessed: assessments.length,
    selectorSources: selectorSources.map(clone),
    selectorCoverage,
    architectureHypotheses: architectureSurvey.hypothesisEvidence.map(item => ({ hypothesisId: item.hypothesisId, state: 'UNTESTED', architectureSelected: false, architectureEvaluated: false })),
    providerIdentityInferred: false,
    outerRequirementBound: false,
    implementationSelected: false,
    sourceExecuted: false,
    realProviderCandidateSupplied: false,
    architectureDecision: 'UNRESOLVED_REQUIRES_EXPLICIT_PROVIDER_BINDING_AND_REVIEWED_CANDIDATE',
    state: !(architectureSurvey.demandedProviderSelectors || []).length ? 'NOT_APPLICABLE_NO_DEMANDED_PROVIDER_SELECTOR' : selectorSources.length ? 'SELECTOR_SOURCE_WITNESSES_REQUIRE_EXPLICIT_PROVIDER_BINDING' : 'NO_SELECTOR_SOURCE_WITNESS_CONTINUE_UNRESOLVED',
    authority: {
      providerIdentityInference: false,
      outerRequirementBinding: false,
      implementationSelection: false,
      architectureSelection: false,
      architectureEvaluation: false,
      sourceExecution: false,
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
    boundary: 'Exact selector literals and conservative source-shape signals are implementation evidence only. They do not bind a source to the outer provider requirement, infer provider identity, select or execute an implementation, choose or evaluate architecture, write Workshop, claim readiness, train, grant, install, or promote.'
  };
  const evidenceSurveyId = `provider-declaration-implementation-evidence-survey-${digest(basis).slice(0, 20)}`;
  const survey = Object.assign({ evidenceSurveyId, evidenceSurveyDigest: null }, basis);
  survey.evidenceSurveyDigest = digest(Object.assign({}, survey, { evidenceSurveyDigest: null }));
  return survey;
}

function truthfulActionId(sourceResult) {
  return sourceResult.survey ? `preserve-selector-source-evidence-${sourceResult.requirementId}` : `preserve-no-implementation-evidence-survey-${sourceResult.requirementId}`;
}

function reasoningInput(sourceResult, evidenceSurvey) {
  const requirementId = sourceResult.requirementId;
  const truthful = truthfulActionId(sourceResult);
  const infer = `infer-provider-from-selector-source-${requirementId}`;
  const select = `select-most-frequent-selector-source-${requirementId}`;
  const sourceCount = evidenceSurvey ? evidenceSurvey.selectorSources.length : 0;
  return {
    schema: 'axm.mirror.reason/v1',
    sessionId: `provider-implementation-evidence-${digest(sourceResult.survey ? sourceResult.survey.surveyDigest : requirementId).slice(0, 20)}`,
    actor: { id: 'axm.machine.mirror/seed-0', kind: 'private-read-only-provider-implementation-evidence-survey-organ' },
    goal: 'Locate exact demanded-selector source evidence without executing source, inferring a provider, or selecting an implementation.',
    evidence: [{
      id: 'architecture-survey-and-source-inventory', kind: 'observation', status: 'observed',
      statement: sourceResult.survey ? `${requirementId} has a current architecture survey and ${sourceCount} content-digested JavaScript sources with exact demanded-selector literals.` : `${requirementId} has no current provider-declaration architecture survey.`,
      source: { kind: 'provider-declaration-architecture-survey-result', id: sourceResult.survey ? sourceResult.survey.surveyDigest : digest(requirementId), uri: sourceResult.survey ? `sha256:${sourceResult.survey.surveyDigest}` : null },
      confidence: { low: 1, high: 1, basis: 'Content-digested current architecture-survey result and bounded static lexical source inventory.' }
    }],
    unknowns: sourceResult.survey ? [{ id: 'outer-provider-binding', question: 'Which explicit typed declaration binds any selector-bearing source to the outer provider requirement and permissions?', blocking: true }] : [],
    assumptions: [], constraints: [], permissions: [],
    actions: [
      { id: truthful, kind: 'proposal', label: sourceResult.survey ? 'Preserve exact selector-source witnesses without provider or implementation selection' : 'Preserve no-survey hold', supportingEvidence: ['architecture-survey-and-source-inventory'], preconditionEvidence: ['architecture-survey-and-source-inventory'], requiredPermissions: [], expectedEffects: ['Static implementation evidence or an explicit hold remains source-separated and nonauthoritative.'], possibleSideEffects: ['A selector match could be mistaken for an outer provider declaration.'], reversible: true, recovery: 'Discard the evidence view while preserving source hashes.', risk: 'low' },
      { id: infer, kind: 'proposal', label: 'Infer provider identity and outer requirement binding from a selector literal', supportingEvidence: ['architecture-survey-and-source-inventory'], preconditionEvidence: ['architecture-survey-and-source-inventory'], requiredPermissions: [], expectedEffects: ['A source match would become provider authority.'], possibleSideEffects: ['Tests, reports, and unrelated implementations could be misbound.'], reversible: false, recovery: 'Require one explicit typed provider declaration instead.', risk: 'high' },
      { id: select, kind: 'proposal', label: 'Select the source with the most selector mentions as the implementation', supportingEvidence: ['architecture-survey-and-source-inventory'], preconditionEvidence: ['architecture-survey-and-source-inventory'], requiredPermissions: [], expectedEffects: ['Mention frequency would become implementation authority.'], possibleSideEffects: ['A test or report could outrank an implementation.'], reversible: false, recovery: 'Preserve every source witness and require explicit review-bound binding.', risk: 'high' }
    ],
    decomposition: [{ id: 'separate-source-witness-from-provider-binding', question: 'Can exact source evidence reduce implementation uncertainty without declaring a provider?', dependsOn: [], cheapestCheck: 'Extract exact demanded-selector string literals and conservative source-shape signals without code execution.', status: 'ANSWERED', answerEvidenceRefs: ['architecture-survey-and-source-inventory'] }],
    pathProfiles: [
      { actionId: truthful, pathId: `truthful-${requirementId}`, approach: 'Retain all content-digested matches and their missing provider binding.', requiredEvidence: ['architecture-survey-and-source-inventory'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 1, reversible: true, failureConditions: ['Source is executed or a provider is inferred.'], strategyTags: ['static-selector-evidence', 'preserve-provider-unknown'] },
      { actionId: infer, pathId: `provider-inference-${requirementId}`, approach: 'Treat selector occurrence as provider identity.', requiredEvidence: ['architecture-survey-and-source-inventory'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 0, reversible: false, failureConditions: ['No explicit outer requirement binding exists.'], strategyTags: ['reject-selector-provider-inference'] },
      { actionId: select, pathId: `frequency-selection-${requirementId}`, approach: 'Rank source files by mention count.', requiredEvidence: ['architecture-survey-and-source-inventory'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 0, reversible: false, failureConditions: ['Frequency does not distinguish implementation, test, or report.'], strategyTags: ['reject-source-frequency-authority'] }
    ],
    verificationReceipts: [
      { id: `verify-truthful-${requirementId}`, actionId: truthful, claim: 'The evidence survey preserves provider and implementation unknowns.', evidenceRefs: ['architecture-survey-and-source-inventory'], method: 'Inspect source assessments, authority map, and zero-execution state.', result: 'PASS', limitations: ['Static syntax does not prove runtime behavior or provider binding.'] },
      { id: `verify-infer-${requirementId}`, actionId: infer, claim: 'Selector occurrence proves provider identity.', evidenceRefs: ['architecture-survey-and-source-inventory'], method: 'Look for one explicit outer requirement declaration.', result: 'FAIL', limitations: ['A later typed declaration could supply the missing binding.'] },
      { id: `verify-select-${requirementId}`, actionId: select, claim: 'Mention frequency proves implementation ownership.', evidenceRefs: ['architecture-survey-and-source-inventory'], method: 'Compare implementation, test, and report contexts.', result: 'FAIL', limitations: ['Frequency may help navigation but has no authority.'] }
    ],
    budget: { maxCandidates: 5, deadlineMs: 1000 }
  };
}

function authorityClosed(session) {
  return session && session.authority && session.authority.proposalOnly === true && Object.entries(session.authority).every(([key, value]) => key === 'proposalOnly' ? value === true : value === false);
}

function verifySession(session, result) {
  if (!session || session.schema !== 'axm.mirror.reasoning-session/v1' || !session.cell || session.cell.learnedWeights !== false || !authorityClosed(session)) throw new Error('provider implementation evidence survey requires an authority-closed deterministic Reasoning Foundation session');
  const independent = Seam.inspectReasoningSession(session, { deliberate: true });
  if (independent.summary.open !== 0) throw new Error('provider implementation evidence survey session failed independent seam review');
  const truthful = session.pathSet.comparisons.find(item => item.actionId === result.expectedDecision.actionId);
  const infer = session.pathSet.comparisons.find(item => item.actionId === result.providerInferenceActionId);
  const select = session.pathSet.comparisons.find(item => item.actionId === result.frequencySelectionActionId);
  if (!truthful || truthful.verificationStatus !== 'PASS' || !truthful.eligible || !infer || infer.verificationStatus !== 'FAIL' || infer.eligible || !select || select.verificationStatus !== 'FAIL' || select.eligible) throw new Error('provider implementation evidence survey discrimination changed');
  return true;
}

function expectedSummary(results, inventory) {
  const surveys = results.filter(item => item.evidenceSurvey).map(item => item.evidenceSurvey);
  return {
    architectureSurveyResultsEvaluated: results.length,
    evidenceSurveysProposed: surveys.length,
    noArchitectureSurveyHolds: results.filter(item => !item.evidenceSurvey).length,
    inventorySources: inventory.documents.length,
    inventoryOversizedSourcesRefused: inventory.oversized.length,
    selectorBearingSources: surveys.reduce((sum, survey) => sum + survey.selectorSources.length, 0),
    demandedSelectorsWitnessed: surveys.reduce((sum, survey) => sum + survey.selectorCoverage.filter(item => item.sourceWitnesses > 0).length, 0),
    exportAndRegistrationSources: surveys.reduce((sum, survey) => sum + survey.selectorSources.filter(item => item.classification === 'SELECTOR_BEARING_EXPORT_AND_REGISTRATION_SOURCE').length, 0),
    testSources: surveys.reduce((sum, survey) => sum + survey.selectorSources.filter(item => item.classification === 'SELECTOR_BEARING_TEST_SOURCE').length, 0),
    reasoningDecisionsMatched: results.filter(item => item.behaviorMatched).length,
    providerInferencesRejected: results.filter(item => item.providerInferenceRejected).length,
    frequencySelectionsRejected: results.filter(item => item.frequencySelectionRejected).length,
    providerIdentitiesInferred: 0,
    outerRequirementsBound: 0,
    implementationsSelected: 0,
    sourcesExecuted: 0,
    architecturesSelected: 0,
    architecturesEvaluated: 0,
    providerCandidatesBuilt: 0,
    providerDeclarationsWritten: 0,
    workshopFilesChanged: 0,
    trainingReceiptsCreated: 0,
    worldActionsExecuted: 0
  };
}

function verifyEvidenceSurvey(survey, architectureSurvey, discovered) {
  if (!survey || survey.evidenceSurveyDigest !== digest(Object.assign({}, survey, { evidenceSurveyDigest: null })) || survey.sourceArchitectureSurveyId !== architectureSurvey.surveyId || survey.sourceArchitectureSurveyDigest !== architectureSurvey.surveyDigest) throw new Error('provider implementation evidence survey digest or architecture-survey binding mismatch');
  if (survey.providerIdentityInferred || survey.outerRequirementBound || survey.implementationSelected || survey.sourceExecuted || survey.realProviderCandidateSupplied || survey.architectureHypotheses.some(item => item.state !== 'UNTESTED' || item.architectureSelected || item.architectureEvaluated) || Object.values(survey.authority).some(Boolean)) throw new Error('provider implementation evidence survey boundary changed');
  for (const assessment of survey.selectorSources) {
    if (assessment.assessmentDigest !== digest(Object.assign({}, assessment, { assessmentDigest: null })) || !assessment.exactSelectorLiterals.length || assessment.providerIdentityBound || assessment.outerRequirementBound || assessment.implementationSelected || assessment.sourceExecuted || Object.values(assessment.authority).some(Boolean)) throw new Error('provider implementation source assessment changed');
  }
  if (discovered) {
    const expected = createEvidenceSurvey(architectureSurvey, discovered.documents, discovered.inventory);
    if (!same(survey, expected)) throw new Error('provider implementation evidence survey no longer matches current source inventory');
  }
  return true;
}

function verifyBatch(batch, runDir, architectureDerived, discovered) {
  if (!batch || batch.schema !== BATCH_SCHEMA || batch.batchDigest !== digest(without(batch, 'batchDigest'))) throw new Error('invalid provider implementation evidence survey batch or digest');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false) throw new Error('provider implementation evidence survey identity changed');
  if (!batch.authority || batch.authority.privateEvidenceTraceWrite !== true || Object.entries(batch.authority).some(([key, value]) => key !== 'privateEvidenceTraceWrite' && value !== false)) throw new Error('provider implementation evidence survey authority changed');
  const lineage = sourceLineage();
  if (!same(batch.sourceLineage, lineage)) throw new Error('provider implementation evidence survey source lineage mismatch');
  if (!Array.isArray(batch.results) || batch.results.length > MAX_RESULTS) throw new Error('provider implementation evidence survey result bound changed');
  if (architectureDerived) {
    ArchitectureSurveys.verifyBatch(architectureDerived.batch, architectureDerived.runDir, architectureDerived.researchDerived);
    if (batch.sourceArchitectureSurveyBatch.batchId !== architectureDerived.batch.batchId || batch.sourceArchitectureSurveyBatch.batchDigest !== architectureDerived.batch.batchDigest) throw new Error('provider implementation evidence survey source batch changed');
  }
  if (discovered && !same(batch.inventory, discovered.inventory)) throw new Error('provider implementation evidence survey inventory changed');
  const inputBasis = { organ: ORGAN_ID, surveyContract: SURVEY_CONTRACT, sourceLineage: lineage, sourceArchitectureSurveyBatch: batch.sourceArchitectureSurveyBatch, inventory: batch.inventory, evidenceFoundations: batch.results.map(item => ({ requirementId: item.requirementId, sourceArchitectureSurveyDigest: item.sourceArchitectureSurvey ? item.sourceArchitectureSurvey.surveyDigest : null, evidenceSurvey: item.evidenceSurvey })) };
  const inputsDigest = digest(inputBasis);
  if (batch.inputsDigest !== inputsDigest || batch.batchId !== `reasoning-provider-declaration-implementation-evidence-surveys-${inputsDigest.slice(0, 20)}`) throw new Error('provider implementation evidence survey input lineage mismatch');
  const sourceByRequirement = architectureDerived ? new Map(architectureDerived.batch.results.map(item => [item.requirementId, item])) : null;
  for (const result of batch.results) {
    const source = sourceByRequirement && sourceByRequirement.get(result.requirementId);
    if (source && ((source.survey == null) !== (result.sourceArchitectureSurvey == null) || (source.survey && !same(source.survey, result.sourceArchitectureSurvey)))) throw new Error('provider implementation evidence survey source result changed');
    if (!!result.evidenceSurvey !== !!result.sourceArchitectureSurvey) throw new Error('provider implementation evidence survey presence does not follow source architecture survey');
    if (result.evidenceSurvey) verifyEvidenceSurvey(result.evidenceSurvey, result.sourceArchitectureSurvey, discovered);
    if (!result.behaviorMatched || !result.providerInferenceRejected || !result.frequencySelectionRejected || result.providerIdentityInferred || result.outerRequirementBound || result.implementationSelected || result.sourceExecuted || result.architectureSelected || result.architectureEvaluated || result.providerCandidateBuilt || result.providerDeclarationWritten || result.workshopChanged || result.trainingReceiptCreated || result.worldActionExecuted) throw new Error('provider implementation evidence survey result exceeds static read-only boundary');
    if (runDir) {
      const sessionFile = path.resolve(runDir, result.sessionFile || '');
      if (!inside(runDir, sessionFile) || !fs.existsSync(sessionFile)) throw new Error(`provider implementation evidence survey session missing: ${result.reasoningSessionId}`);
      const bytes = fs.readFileSync(sessionFile);
      if (digest(bytes) !== result.sessionSha256) throw new Error(`provider implementation evidence survey session hash mismatch: ${result.reasoningSessionId}`);
      const session = JSON.parse(bytes.toString('utf8'));
      if (digest(session) !== result.sessionDigest || session.reasoningSessionId !== result.reasoningSessionId) throw new Error('provider implementation evidence survey session lineage mismatch');
      verifySession(session, result);
    }
  }
  if (!same(batch.summary, expectedSummary(batch.results, batch.inventory))) throw new Error('provider implementation evidence survey summary mismatch');
  return true;
}

function derive(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const workshopRoot = WorkshopRoot.resolve({ workshopRoot: options.workshopRoot });
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'provider-declaration-implementation-evidence-survey-runs'));
  if (!inside(root, stateDir)) throw new Error('provider implementation evidence survey private state must stay inside Mirror root');
  const architectureDerived = options.architectureDerived || ArchitectureSurveys.derive(Object.assign({}, options.architectureOptions || {}, { root, workshopRoot }));
  ArchitectureSurveys.verifyBatch(architectureDerived.batch, architectureDerived.runDir, architectureDerived.researchDerived);
  if (architectureDerived.batch.results.length > MAX_RESULTS) throw new Error(`provider implementation evidence survey holds: ${architectureDerived.batch.results.length} results exceed ${MAX_RESULTS}`);
  const discovered = discoverSources(workshopRoot);
  const foundations = architectureDerived.batch.results.map(item => ({
    requirementId: item.requirementId,
    sourceArchitectureSurvey: item.survey ? clone(item.survey) : null,
    evidenceSurvey: item.survey ? createEvidenceSurvey(item.survey, discovered.documents, discovered.inventory) : null
  })).sort((a, b) => a.requirementId.localeCompare(b.requirementId));
  const lineage = sourceLineage();
  const sourceArchitectureSurveyBatch = { batchId: architectureDerived.batch.batchId, batchDigest: architectureDerived.batch.batchDigest };
  const inputBasis = { organ: ORGAN_ID, surveyContract: SURVEY_CONTRACT, sourceLineage: lineage, sourceArchitectureSurveyBatch, inventory: discovered.inventory, evidenceFoundations: foundations.map(item => ({ requirementId: item.requirementId, sourceArchitectureSurveyDigest: item.sourceArchitectureSurvey ? item.sourceArchitectureSurvey.surveyDigest : null, evidenceSurvey: item.evidenceSurvey })) };
  const inputsDigest = digest(inputBasis);
  const batchId = `reasoning-provider-declaration-implementation-evidence-surveys-${inputsDigest.slice(0, 20)}`;
  const runDir = path.join(stateDir, batchId);
  const batchFile = path.join(runDir, 'batch.json');
  if (fs.existsSync(batchFile)) {
    const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    verifyBatch(batch, runDir, architectureDerived, discovered);
    return { batch, runDir, reused: true, architectureDerived };
  }
  fs.mkdirSync(stateDir, { recursive: true });
  const stageDir = path.join(stateDir, `.s-${digest(batchId).slice(0, 12)}-${process.pid}`);
  fs.mkdirSync(path.join(stageDir, 's'), { recursive: true });
  const sourceByRequirement = new Map(architectureDerived.batch.results.map(item => [item.requirementId, item]));
  const results = foundations.map(foundation => {
    const source = sourceByRequirement.get(foundation.requirementId);
    const reasoningSource = { requirementId: foundation.requirementId, survey: foundation.sourceArchitectureSurvey };
    const session = Foundation.run(reasoningInput(reasoningSource, foundation.evidenceSurvey), { at: '1970-01-01T00:00:00.000Z' });
    const expectedAction = truthfulActionId(reasoningSource);
    const providerInferenceActionId = `infer-provider-from-selector-source-${foundation.requirementId}`;
    const frequencySelectionActionId = `select-most-frequent-selector-source-${foundation.requirementId}`;
    const infer = session.pathSet.comparisons.find(item => item.actionId === providerInferenceActionId);
    const select = session.pathSet.comparisons.find(item => item.actionId === frequencySelectionActionId);
    const observedDecision = { value: session.principleTrace.decision.value, actionId: session.principleTrace.decision.selectedActionId };
    const sourceDigest = source.survey ? source.survey.surveyDigest : digest(source.requirementId);
    const sessionFile = path.join('s', `${digest(sourceDigest).slice(0, 20)}.json`).replace(/\\/g, '/');
    const bytes = Buffer.from(json(session), 'utf8');
    const result = Object.assign({}, foundation, {
      expectedDecision: { value: 1, actionId: expectedAction },
      providerInferenceActionId,
      frequencySelectionActionId,
      observedDecision,
      behaviorMatched: observedDecision.value === 1 && observedDecision.actionId === expectedAction,
      providerInferenceRejected: !!infer && infer.verificationStatus === 'FAIL' && infer.eligible === false,
      frequencySelectionRejected: !!select && select.verificationStatus === 'FAIL' && select.eligible === false,
      reasoningSessionId: session.reasoningSessionId,
      sessionFile,
      sessionSha256: digest(bytes),
      sessionDigest: digest(session),
      providerIdentityInferred: false,
      outerRequirementBound: false,
      implementationSelected: false,
      sourceExecuted: false,
      architectureSelected: false,
      architectureEvaluated: false,
      providerCandidateBuilt: false,
      providerDeclarationWritten: false,
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
    organ: { id: ORGAN_ID, status: 'TEST_AUTOMATIC_STATIC_PROVIDER_IMPLEMENTATION_EVIDENCE_SURVEY', learnedWeights: false },
    cell: { id: EvidenceCell.CELL_ID, schema: EvidenceCell.SCHEMA, learnedWeights: false },
    surveyContract: SURVEY_CONTRACT,
    sourceLineage: lineage,
    sourceArchitectureSurveyBatch,
    inventory: discovered.inventory,
    results,
    summary: expectedSummary(results, discovered.inventory),
    authority: {
      privateEvidenceTraceWrite: true,
      providerIdentityInference: false,
      outerRequirementBinding: false,
      implementationSelection: false,
      architectureSelection: false,
      architectureEvaluation: false,
      sourceExecution: false,
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
    boundary: 'The organ may statically read bounded JavaScript sources under Workshop shared and record content-digested exact demanded-selector witnesses under ignored private state. It cannot execute source, bind a source to the outer provider requirement, infer provider identity, select an implementation or architecture, build or write a provider, touch Workshop, claim readiness, train, grant, install, or promote.'
  };
  batch.batchDigest = digest(without(batch, 'batchDigest'));
  verifyBatch(batch, stageDir, architectureDerived, discovered);
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused, architectureDerived };
}

function respond(batchOrDerived, request = {}) {
  const batch = batchOrDerived && batchOrDerived.batch ? batchOrDerived.batch : batchOrDerived;
  verifyBatch(batch);
  if (!request || typeof request !== 'object' || Array.isArray(request) || request.schema !== REQUEST_SCHEMA) throw new Error(`provider implementation evidence survey request must use ${REQUEST_SCHEMA}`);
  const unexpected = Object.keys(request).filter(key => !['schema', 'requirementId', 'limit'].includes(key));
  if (unexpected.length) throw new Error(`unknown critical provider implementation evidence survey query fields: ${unexpected.join(', ')}`);
  const requirementId = request.requirementId == null ? null : clean(request.requirementId, 300);
  const limit = Math.max(1, Math.min(MAX_RESULTS, Number(request.limit) || 20));
  let selected = batch.results;
  let state;
  let reason;
  if (requirementId) {
    selected = selected.filter(item => item.requirementId === requirementId);
    if (!selected.length) {
      state = 'HOLD_UNKNOWN_PROVIDER_DECLARATION_ARCHITECTURE_SURVEY_RESULT';
      reason = 'The current architecture-survey batch contains no result for that requirement ID.';
    }
  }
  selected = selected.slice(0, limit);
  const evidenceSurveys = selected.filter(item => item.evidenceSurvey && item.behaviorMatched).map(item => clone(item.evidenceSurvey));
  const holds = selected.filter(item => !item.evidenceSurvey || !item.behaviorMatched).map(item => ({ requirementId: item.requirementId, state: 'HELD_NO_PROVIDER_IMPLEMENTATION_EVIDENCE_SURVEY', reason: item.sourceArchitectureSurvey ? 'Reasoning behavior did not match.' : 'No provider-declaration architecture survey exists.' }));
  if (!state && evidenceSurveys.length) {
    state = 'PROPOSED_PROVIDER_IMPLEMENTATION_SOURCE_EVIDENCE';
    reason = 'Static exact-selector source evidence reduces implementation uncertainty without provider binding, source execution, or implementation selection.';
  } else if (!state && holds.length) {
    state = 'HOLD_NO_ARCHITECTURE_SURVEY_TO_INSPECT';
    reason = 'The selected result has no provider-declaration architecture survey, so no implementation evidence survey is originated.';
  } else if (!state) {
    state = 'NO_PROVIDER_DECLARATION_ARCHITECTURE_SURVEY_RESULTS';
    reason = 'No current architecture-survey results are available.';
  }
  const response = {
    schema: RESPONSE_SCHEMA,
    responseDigest: null,
    organId: ORGAN_ID,
    sourceBatchId: batch.batchId,
    request: { requirementId, limit },
    state,
    reason,
    evidenceSurveys,
    holds,
    providerIdentityInferred: false,
    outerRequirementBound: false,
    implementationSelected: false,
    sourceExecuted: false,
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
  digest, sourceLineage, discoverSources, assessSources, createEvidenceSurvey, truthfulActionId, reasoningInput,
  verifySession, expectedSummary, verifyEvidenceSurvey, verifyBatch, derive, respond
};
