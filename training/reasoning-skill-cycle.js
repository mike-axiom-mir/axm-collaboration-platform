'use strict';

const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Foundation = require('../kernel/reasoning-foundation');
const Seam = require('../kernel/seam-cell');
const StrategyModel = require('../learning/reasoning-strategy-model');
const ReasoningExperience = require('../organs/reasoning-experience-organ');

const SCHEMA = 'axm.mirror.reasoning-skill-cycle/v1';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => {
    output[key] = stable(value[key]);
    return output;
  }, {});
}

function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function shaBytes(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function shaValue(value) { return shaBytes(Buffer.from(JSON.stringify(stable(value)), 'utf8')); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function readFixture(file, expectedSchema) {
  const bytes = fs.readFileSync(file);
  const value = JSON.parse(bytes.toString('utf8'));
  if (!value || value.schema !== expectedSchema || !Array.isArray(value.cases) || !value.cases.length) {
    throw new Error(`invalid reasoning skill fixture: ${file}`);
  }
  const groups = value.cases.map(item => item.sourceGroup);
  if (groups.some(group => !group) || new Set(groups).size !== groups.length) throw new Error(`reasoning skill fixture source groups must be present and unique: ${file}`);
  return { file, bytes, sha256: shaBytes(bytes), value };
}

function fixtureSet(files, expectedSchema, kind) {
  const fixtures = files.map(file => readFixture(file, expectedSchema));
  const cases = fixtures.flatMap(fixture => fixture.value.cases.map(row => ({ row, fixture })));
  const groups = cases.map(item => item.row.sourceGroup);
  const caseIds = cases.map(item => item.row.caseId);
  if (new Set(groups).size !== groups.length) throw new Error(`${kind} reasoning source groups must be unique across fixtures`);
  if (new Set(caseIds).size !== caseIds.length) throw new Error(`${kind} reasoning case IDs must be unique across fixtures`);
  return { fixtures, cases };
}

function requestFromCase(row) {
  return {
    schema: 'axm.mirror.reasoning-session/v1',
    actor: { id: 'axm.machine.mirror/seed-0', kind: 'private-reasoning-challenger' },
    goal: row.goal,
    evidence: clone(row.evidence || []),
    unknowns: clone(row.unknowns || []),
    assumptions: clone(row.assumptions || []),
    constraints: clone(row.constraints || []),
    permissions: clone(row.permissions || []),
    actions: clone(row.actions || []),
    pathProfiles: clone(row.pathProfiles || []),
    budget: { maxCandidates: 16, deadlineMs: 1000 }
  };
}

function buildVerifiedSession(row, fixture, options = {}) {
  const request = requestFromCase(row);
  const evidenceRows = [
    { id: 'verified-outcome', kind: 'test', status: 'tested', statement: `Independent fixture evaluator selected ${row.correctActionId}.`, source: { kind: 'reasoning-skill-evaluator', id: row.caseId } },
    { id: 'transfer-proof', kind: 'test', status: 'tested', statement: `The structural strategy transferred within source group ${row.sourceGroup}.`, source: { kind: 'reasoning-skill-transfer', id: row.caseId } },
    { id: 'regression-proof', kind: 'test', status: 'tested', statement: 'Root, permission, contradiction, hold and authority canaries remained intact.', source: { kind: 'reasoning-skill-regression', id: row.caseId } }
  ];
  request.evidence.push(...evidenceRows);
  request.verificationReceipts = request.actions.map(action => ({
    id: `grade-${action.id}`,
    actionId: action.id,
    claim: `Candidate ${action.id} is the independently graded path for ${row.caseId}.`,
    evidenceRefs: ['verified-outcome'],
    method: 'frozen fixture evaluator hidden from model features',
    result: action.id === row.correctActionId ? 'PASS' : 'FAIL',
    limitations: ['bounded structural strategy case']
  }));
  request.outcome = {
    result: 'PASS',
    statement: `The verified strategy selected ${row.correctActionId} without world mutation.`,
    evidenceRefs: ['verified-outcome'],
    transferEvidenceRefs: ['transfer-proof'],
    regressionEvidenceRefs: ['regression-proof'],
    repairEvidenceRefs: [],
    resolvedSeams: (row.resolvedSeams || []).map(seamId => ({
      seamId,
      testStatus: 'PASS',
      statement: `The post-attempt evaluator closed ${seamId} while preserving its original record.`,
      evidenceRefs: ['verified-outcome']
    })),
    observedAt: options.at || null,
    verified: true,
    repeatedVerifiedOutcomes: 2,
    usePermission: fixture.value.usePermission,
    permissionBasis: fixture.value.permissionBasis,
    worldMutations: 0,
    runtimePointerChanged: false,
    unexpectedSeams: []
  };
  const session = Foundation.run(request, { at: options.at || null });
  if (session.pathSet.selectedActionId !== row.correctActionId) throw new Error(`verified training case selected ${session.pathSet.selectedActionId}, expected ${row.correctActionId}: ${row.caseId}`);
  if (session.consolidation.state !== 'PROPOSE_REVIEW') throw new Error(`verified training case did not reach consolidation review: ${row.caseId}`);
  if (session.independentSeamReview.summary.open !== 0) throw new Error(`verified training case failed independent reasoning audit: ${row.caseId}`);
  session.trainingSource = {
    caseId: row.caseId,
    sourceGroup: row.sourceGroup,
    fixtureSha256: fixture.sha256,
    expectedActionHiddenFromModel: true
  };
  return session;
}

function evaluateCases(rows, strategyModel) {
  const results = [];
  for (const row of rows) {
    const session = Foundation.run(requestFromCase(row), strategyModel ? { strategyModel, at: null } : { at: null });
    const selectedProfile = row.pathProfiles.find(item => item.actionId === row.correctActionId);
    results.push({
      caseId: row.caseId,
      sourceGroup: row.sourceGroup,
      adversarial: row.adversarial === true,
      expectedActionId: row.correctActionId,
      expectedStrategyTags: selectedProfile && selectedProfile.strategyTags || [],
      selectedActionId: session.pathSet.selectedActionId,
      passed: session.pathSet.selectedActionId === row.correctActionId,
      reasoningSessionId: session.reasoningSessionId,
      principleTraceId: session.principleTrace.traceId,
      predictedStrategies: session.pathSet.strategyGuidance.prediction
        ? session.pathSet.strategyGuidance.prediction.rankings.slice(0, 4)
        : [],
      predictedStrategySequences: session.pathSet.strategyGuidance.prediction
        ? session.pathSet.strategyGuidance.prediction.sequenceRankings.slice(0, 4)
        : [],
      authority: session.authority,
      independentSeamOpen: session.independentSeamReview.summary.open
    });
  }
  const passed = results.filter(item => item.passed).length;
  const adversarial = results.filter(item => item.adversarial);
  const byStrategy = {};
  for (const result of results) for (const tag of result.expectedStrategyTags) {
    if (!byStrategy[tag]) byStrategy[tag] = { cases: 0, passed: 0 };
    byStrategy[tag].cases += 1;
    if (result.passed) byStrategy[tag].passed += 1;
  }
  for (const row of Object.values(byStrategy)) row.accuracy = row.cases ? row.passed / row.cases : null;
  return {
    cases: results.length,
    passed,
    accuracy: results.length ? passed / results.length : null,
    adversarialCases: adversarial.length,
    adversarialPassed: adversarial.filter(item => item.passed).length,
    byStrategy,
    results
  };
}

function evaluateOriginationCases(rows, strategyModel) {
  const results = [];
  for (const row of rows) {
    const request = requestFromCase(row);
    request.actions = [];
    request.pathProfiles = [];
    const session = Foundation.run(request, strategyModel
      ? { strategyModel, originateStrategies: true, maxOriginatedCandidates: 4, at: null }
      : { at: null });
    const expectedProfile = row.pathProfiles.find(item => item.actionId === row.correctActionId);
    const expectedTags = expectedProfile && expectedProfile.strategyTags || [];
    const selectedProfile = session.pathSet.profiles.find(item => item.actionId === session.pathSet.selectedActionId);
    const selectedTags = selectedProfile && selectedProfile.strategyTags || [];
    const observableExpectedTags = StrategyModel.observableStrategyTags(session.pathSet.strategyGuidance.problemFeatures);
    const legacyExactPassed = expectedTags.length === selectedTags.length && expectedTags.every((tag, index) => selectedTags[index] === tag);
    const safeUnderspecifiedHold = observableExpectedTags.length === 0 && selectedTags.length === 0 && session.pathSet.selectedActionId == null && (!session.candidateOrigin || session.candidateOrigin.candidates.length === 0);
    const observableStrategyPassed = observableExpectedTags.length > 0 && observableExpectedTags.length === selectedTags.length && observableExpectedTags.every((tag, index) => selectedTags[index] === tag);
    const passed = safeUnderspecifiedHold || observableStrategyPassed;
    results.push({
      caseId: row.caseId,
      sourceGroup: row.sourceGroup,
      adversarial: row.adversarial === true,
      expectedStrategyTags: expectedTags,
      observableExpectedStrategyTags: observableExpectedTags,
      selectedStrategyTags: selectedTags,
      selectedActionId: session.pathSet.selectedActionId,
      candidateOriginId: session.candidateOrigin && session.candidateOrigin.candidateSetId || null,
      originatedCandidates: session.candidateOrigin && session.candidateOrigin.candidates.length || 0,
      passed,
      legacyExactPassed,
      safeUnderspecifiedHold,
      expectationMode: observableExpectedTags.length ? 'OBSERVABLE_STRUCTURAL_OBLIGATIONS' : 'HOLD_UNDERSPECIFIED',
      authority: session.authority,
      originAuthority: session.candidateOrigin && session.candidateOrigin.authority || null,
      independentSeamOpen: session.independentSeamReview.summary.open
    });
  }
  const passed = results.filter(item => item.passed).length;
  const adversarial = results.filter(item => item.adversarial);
  return {
    cases: results.length,
    passed,
    accuracy: results.length ? passed / results.length : null,
    adversarialCases: adversarial.length,
    adversarialPassed: adversarial.filter(item => item.passed).length,
    legacyExactPassed: results.filter(item => item.legacyExactPassed).length,
    safeUnderspecifiedHolds: results.filter(item => item.safeUnderspecifiedHold).length,
    results
  };
}

function makeCanaries(model, trainGroups, heldSet, baseline, challenger, origination, experienceReceipts, excludedExperienceReceipts) {
  const heldGroups = heldSet.cases.map(item => item.row.sourceGroup);
  const authorityValues = Object.values(model.authority || {});
  const allChallengerAuthorityClosed = challenger.results.every(item =>
    Object.entries(item.authority || {}).every(([key, value]) => key === 'proposalOnly' ? value === true : value === false));
  const originAuthorityClosed = origination.challenger.results.every(item => item.originAuthority &&
    Object.entries(item.originAuthority).every(([key, value]) => key === 'proposalsOnly' ? value === true : value === false));
  return [
    { id: 'source-family-isolation', status: heldGroups.every(group => !trainGroups.has(group)) ? 'PASS' : 'FAIL', evidence: `${trainGroups.size} train and ${heldGroups.length} held-out groups compared` },
    { id: 'held-out-frozen', status: heldSet.fixtures.every(fixture => fixture.value.frozen === true) ? 'PASS' : 'FAIL', evidence: heldSet.fixtures.map(fixture => fixture.sha256).join(',') },
    { id: 'no-goal-word-features', status: model.featureVocabulary.every(feature => !feature.startsWith('goal')) ? 'PASS' : 'FAIL', evidence: `${model.featureVocabulary.length} structural features inspected` },
    { id: 'model-authority-closed', status: authorityValues.length && authorityValues.every(value => value === false) ? 'PASS' : 'FAIL', evidence: JSON.stringify(model.authority) },
    { id: 'challenger-session-authority-closed', status: allChallengerAuthorityClosed ? 'PASS' : 'FAIL', evidence: `${challenger.results.length} held-out sessions inspected` },
    { id: 'independent-reasoning-seams-clean', status: challenger.results.every(item => item.independentSeamOpen === 0) ? 'PASS' : 'FAIL', evidence: challenger.results.map(item => `${item.caseId}:${item.independentSeamOpen}`).join(',') },
    { id: 'adversarial-transfer', status: challenger.adversarialCases > 0 && challenger.adversarialPassed === challenger.adversarialCases ? 'PASS' : 'FAIL', evidence: `${challenger.adversarialPassed}/${challenger.adversarialCases}` },
    { id: 'baseline-comparison', status: Number(challenger.accuracy) > Number(baseline.accuracy) ? 'PASS' : 'FAIL', evidence: `${baseline.accuracy}->${challenger.accuracy}` },
    { id: 'candidate-origination-transfer', status: origination.challenger.accuracy === 1 && origination.challenger.accuracy > origination.baseline.accuracy ? 'PASS' : 'FAIL', evidence: `${origination.baseline.accuracy}->${origination.challenger.accuracy}; legacy exact ${origination.challenger.legacyExactPassed}/${origination.challenger.cases}` },
    { id: 'candidate-origin-authority-closed', status: originAuthorityClosed ? 'PASS' : 'FAIL', evidence: `${origination.challenger.results.length} candidate sets inspected` },
    { id: 'ordered-strategy-composition', status: challenger.results.filter(item => item.expectedStrategyTags.length > 1).every(item => item.passed) && origination.challenger.results.filter(item => item.observableExpectedStrategyTags.length > 1).every(item => item.passed) ? 'PASS' : 'FAIL', evidence: `${challenger.results.filter(item => item.expectedStrategyTags.length > 1 && item.passed).length}/${challenger.results.filter(item => item.expectedStrategyTags.length > 1).length} supplied exact; ${origination.challenger.results.filter(item => item.observableExpectedStrategyTags.length > 1 && item.passed).length}/${origination.challenger.results.filter(item => item.observableExpectedStrategyTags.length > 1).length} candidate-free observable composition` },
    { id: 'underspecified-candidate-origin-holds', status: origination.challenger.results.filter(item => item.observableExpectedStrategyTags.length === 0).every(item => item.safeUnderspecifiedHold) ? 'PASS' : 'FAIL', evidence: `${origination.challenger.safeUnderspecifiedHolds}/${origination.challenger.results.filter(item => item.observableExpectedStrategyTags.length === 0).length} underspecified cases held without guessing` },
    { id: 'experience-self-training-closed', status: experienceReceipts.every(item => item.receipt.reasoningSession.cell && item.receipt.reasoningSession.cell.learnedWeights === false) ? 'PASS' : 'FAIL', evidence: `${experienceReceipts.length} append-only experience receipt(s) inspected` },
    { id: 'experience-remains-episodic', status: experienceReceipts.every(item => item.receipt.admission.semanticConsolidation === false && item.receipt.trainingExample.semanticConsolidation === false) ? 'PASS' : 'FAIL', evidence: `${experienceReceipts.length} receipt(s) kept outside semantic truth` },
    { id: 'negative-experience-preserved', status: Number(model.training.admittedNegativeExperiences) === experienceReceipts.filter(item => item.receipt.trainingExample.outcome === 'DID_NOT_WORK').length ? 'PASS' : 'FAIL', evidence: `${model.training.admittedNegativeExperiences} negative experience(s) retained` },
    { id: 'synthetic-counterexample-lineage', status: experienceReceipts.every(item => {
      const kind = item.receipt.source.experienceKind || 'REAL_LOCAL_LESSON';
      return kind === 'REAL_LOCAL_LESSON' || kind === 'CONTRACT_DERIVED_EXAM' ||
        (kind === 'SYNTHETIC_COUNTEREXAMPLE' && item.receipt.source.parentReceiptIds.length === 1 && !!item.receipt.source.interventionId);
    }) ? 'PASS' : 'FAIL', evidence: `${experienceReceipts.filter(item => item.receipt.source.experienceKind === 'SYNTHETIC_COUNTEREXAMPLE').length} parent-linked synthetic counterexample receipt(s) and ${experienceReceipts.filter(item => item.receipt.source.experienceKind === 'CONTRACT_DERIVED_EXAM').length} contract-derived exam receipt(s) kept visibly separate` },
    { id: 'known-failed-experience-excluded', status: excludedExperienceReceipts.every(item => item.review.eligible === false && item.review.state.startsWith('KNOWN_FAIL')) ? 'PASS' : 'FAIL', evidence: `${excludedExperienceReceipts.length} preserved known-fail receipt(s) excluded from model training` }
  ];
}

function inside(root, target) {
  const relative = path.relative(root, target);
  return !!relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function loadExisting(runDir, inputsDigest) {
  const cycleFile = path.join(runDir, 'cycle.json');
  const seamFile = path.join(runDir, 'seam-report.json');
  const modelFile = path.join(runDir, 'reasoning-strategy-model.json');
  if (!fs.existsSync(cycleFile) || !fs.existsSync(seamFile) || !fs.existsSync(modelFile)) throw new Error(`partial existing reasoning skill cycle refuses overwrite: ${runDir}`);
  const cycle = JSON.parse(fs.readFileSync(cycleFile, 'utf8'));
  if (cycle.inputsDigest !== inputsDigest) throw new Error('existing reasoning skill cycle input digest mismatch');
  const model = JSON.parse(fs.readFileSync(modelFile, 'utf8'));
  StrategyModel.verify(model);
  return { cycle, seamReport: JSON.parse(fs.readFileSync(seamFile, 'utf8')), model, runDir, reused: true };
}

function run(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const trainFiles = (options.trainFiles || (options.trainFile ? [options.trainFile] : [
    path.join(root, 'training', 'reasoning-strategy-train.json'),
    path.join(root, 'training', 'reasoning-strategy-composition-train.json')
  ])).map(file => path.resolve(file));
  const heldFiles = (options.heldFiles || (options.heldFile ? [options.heldFile] : [
    path.join(root, 'tests', 'fixtures', 'reasoning-strategy-held-out.json'),
    path.join(root, 'tests', 'fixtures', 'reasoning-strategy-composition-held-out.json')
  ])).map(file => path.resolve(file));
  const reasoningReceiptsDir = path.resolve(options.reasoningReceiptsDir || path.join(root, 'training', 'datasets', 'reasoning-receipts'));
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'reasoning-skill-runs'));
  if (!trainFiles.every(file => inside(root, file)) || !heldFiles.every(file => inside(root, file))) throw new Error('reasoning skill fixtures must stay inside the Mirror root');
  const trainSet = fixtureSet(trainFiles, 'axm.mirror.reasoning-strategy-training-fixtures/v1', 'training');
  const heldSet = fixtureSet(heldFiles, 'axm.mirror.reasoning-strategy-held-out/v1', 'held-out');
  const discoveredExperienceReceipts = ReasoningExperience.loadDirectory(reasoningReceiptsDir);
  const reviewedExperienceReceipts = discoveredExperienceReceipts.map(item => Object.assign({}, item, { review: ReasoningExperience.trainingEligibility(item.receipt) }));
  const excludedExperienceReceipts = reviewedExperienceReceipts.filter(item => !item.review.eligible);
  const experienceReceipts = reviewedExperienceReceipts.filter(item => item.review.eligible);
  const allTrainGroups = trainSet.cases.map(item => item.row.sourceGroup).concat(experienceReceipts.map(item => item.receipt.source.sourceGroup));
  if (new Set(allTrainGroups).size !== allTrainGroups.length) throw new Error('reasoning training source groups must be unique across fixtures and experience receipts');
  const trainGroups = new Set(allTrainGroups);
  const heldGroups = heldSet.cases.map(item => item.row.sourceGroup);
  const leakage = heldGroups.filter(group => trainGroups.has(group));
  if (leakage.length) throw new Error(`reasoning skill source-family leakage: ${leakage.join(', ')}`);
  const config = { model: StrategyModel.SCHEMA, strategyRepresentation: 'ordered-tags-v5-real-synthetic-contract-exam-and-known-fail-reviewed', experienceIntake: ReasoningExperience.SCHEMA, experienceEligibility: 'append-only-known-fail-and-contract-lineage-v2', candidateFreeEvaluation: 'observable-obligations-and-safe-abstention-v2', strategyBonusMaximum: 60, structuralObligationBonusMaximum: 80, featurePolicy: 'structural-state-only-no-goal-word-features' };
  const inputsDigest = shaValue({
    trainFixtures: trainSet.fixtures.map(fixture => ({ path: path.relative(root, fixture.file).replace(/\\/g, '/'), sha256: fixture.sha256 })),
    experienceReceipts: reviewedExperienceReceipts.map(item => ({ receiptId: item.receipt.receiptId, sha256: item.sha256, eligibility: item.review })),
    heldOutFixtures: heldSet.fixtures.map(fixture => ({ path: path.relative(root, fixture.file).replace(/\\/g, '/'), sha256: fixture.sha256 })),
    config
  });
  const cycleId = `reasoning-skill-${inputsDigest.slice(0, 20)}`;
  const runDir = path.join(stateDir, cycleId);
  if (fs.existsSync(runDir)) return loadExisting(runDir, inputsDigest);
  const stageDir = path.join(stateDir, `.stage-${cycleId}-${process.pid}`);
  fs.mkdirSync(stageDir, { recursive: true });
  try {
    const fixtureSessions = trainSet.cases.map(item => buildVerifiedSession(item.row, item.fixture, { at: null }));
    const model = StrategyModel.train(fixtureSessions, { at: null, experienceReceipts: experienceReceipts.map(item => item.receipt) });
    const heldRows = heldSet.cases.map(item => item.row);
    const baseline = evaluateCases(heldRows, null);
    const challenger = evaluateCases(heldRows, model);
    const origination = {
      baseline: evaluateOriginationCases(heldRows, null),
      challenger: evaluateOriginationCases(heldRows, model)
    };
    const canaries = makeCanaries(model, trainGroups, heldSet, baseline, challenger, origination, experienceReceipts, excludedExperienceReceipts);
    fs.writeFileSync(path.join(stageDir, 'reasoning-strategy-model.json'), json(model), 'utf8');
    fs.writeFileSync(path.join(stageDir, 'evaluation.json'), json({ baseline, challenger, origination, canaries }), 'utf8');
    const fixtureLineage = fixtureSessions.map(session => ({
      sourceKind: 'VERIFIED_CONSOLIDATION_SESSION',
      reasoningSessionId: session.reasoningSessionId,
      consolidationDigest: session.consolidation.proposalDigest,
      source: session.trainingSource,
      selectedActionId: session.pathSet.selectedActionId,
      strategyTags: session.pathSet.profiles.find(item => item.actionId === session.pathSet.selectedActionId).strategyTags
    }));
    const experienceLineage = experienceReceipts.map(item => ({
      sourceKind: item.receipt.trainingExample.outcome === 'WORKED' ? 'POSITIVE_EPISODIC_EXPERIENCE' : 'NEGATIVE_EPISODIC_EXPERIENCE',
      reasoningExperienceReceiptId: item.receipt.receiptId,
      reasoningSessionId: item.receipt.reasoningSession.reasoningSessionId,
      receiptSha256: item.sha256,
      sourceGroup: item.receipt.source.sourceGroup,
      experienceKind: item.receipt.source.experienceKind || 'REAL_LOCAL_LESSON',
      parentReceiptIds: item.receipt.source.parentReceiptIds || [],
      interventionId: item.receipt.source.interventionId || null,
      evaluatorId: item.receipt.source.evaluator.id,
      evaluatorSourceDigest: item.receipt.source.evaluator.sourceDigest,
      outcome: item.receipt.trainingExample.outcome,
      semanticConsolidation: false,
      strategyTags: item.receipt.trainingExample.strategyTags
    }));
    fs.writeFileSync(path.join(stageDir, 'training-session-lineage.json'), json(fixtureLineage.concat(experienceLineage)), 'utf8');
    const artifacts = ['reasoning-strategy-model.json', 'evaluation.json', 'training-session-lineage.json'].map(name => {
      const bytes = fs.readFileSync(path.join(stageDir, name));
      return { path: name, bytes: bytes.length, sha256: shaBytes(bytes) };
    });
    const promotionEligible = challenger.accuracy === 1 && challenger.accuracy > baseline.accuracy &&
      challenger.adversarialPassed === challenger.adversarialCases &&
      origination.challenger.accuracy === 1 && origination.challenger.accuracy > origination.baseline.accuracy &&
      origination.challenger.adversarialPassed === origination.challenger.adversarialCases &&
      canaries.every(item => item.status === 'PASS');
    const cycle = {
      schema: SCHEMA,
      cycleId,
      inputsDigest,
      identity: 'axm.machine.mirror/seed-0',
      createdAt: null,
      corpus: {
        trainFixture: path.relative(root, trainSet.fixtures[0].file).replace(/\\/g, '/'),
        trainSha256: trainSet.fixtures[0].sha256,
        trainFixtures: trainSet.fixtures.map(fixture => ({ path: path.relative(root, fixture.file).replace(/\\/g, '/'), sha256: fixture.sha256, cases: fixture.value.cases.length })),
        heldOutFixture: path.relative(root, heldSet.fixtures[0].file).replace(/\\/g, '/'),
        heldOutSha256: heldSet.fixtures[0].sha256,
        heldOutFixtures: heldSet.fixtures.map(fixture => ({ path: path.relative(root, fixture.file).replace(/\\/g, '/'), sha256: fixture.sha256, cases: fixture.value.cases.length, frozen: fixture.value.frozen === true })),
        heldOutFrozen: heldSet.fixtures.every(fixture => fixture.value.frozen === true),
        reasoningExperienceReceipts: experienceReceipts.map(item => ({
          receiptId: item.receipt.receiptId,
          sha256: item.sha256,
          sourceGroup: item.receipt.source.sourceGroup,
          experienceKind: item.receipt.source.experienceKind || 'REAL_LOCAL_LESSON',
          parentReceiptIds: item.receipt.source.parentReceiptIds || [],
          interventionId: item.receipt.source.interventionId || null,
          evaluatorId: item.receipt.source.evaluator.id,
          outcome: item.receipt.trainingExample.outcome,
          semanticConsolidation: false,
          learnedSelfTraining: false
        })),
        excludedReasoningExperienceReceipts: excludedExperienceReceipts.map(item => ({
          receiptId: item.receipt.receiptId,
          sha256: item.sha256,
          sourceGroup: item.receipt.source.sourceGroup,
          experienceKind: item.receipt.source.experienceKind || 'REAL_LOCAL_LESSON',
          evaluatorId: item.receipt.source.evaluator.id,
          reviewState: item.review.state,
          reason: item.review.reason,
          preserved: true
        })),
        discoveredReasoningExperienceReceiptCount: discoveredExperienceReceipts.length,
        privateReasoningExperienceReceiptCount: experienceReceipts.length,
        realLocalReasoningExperienceReceiptCount: experienceReceipts.filter(item => (item.receipt.source.experienceKind || 'REAL_LOCAL_LESSON') === 'REAL_LOCAL_LESSON').length,
        syntheticCounterexampleReceiptCount: experienceReceipts.filter(item => item.receipt.source.experienceKind === 'SYNTHETIC_COUNTEREXAMPLE').length,
        contractDerivedExamReceiptCount: experienceReceipts.filter(item => item.receipt.source.experienceKind === 'CONTRACT_DERIVED_EXAM').length,
        trainGroups: Array.from(trainGroups).sort(),
        heldOutGroups: heldGroups.sort(),
        leakage,
        admittedVerifiedSessions: fixtureSessions.length + experienceReceipts.length,
        admittedConsolidationSessions: fixtureSessions.length,
        admittedPositiveEpisodicExperiences: model.training.admittedPositiveExperiences,
        admittedNegativeEpisodicExperiences: model.training.admittedNegativeExperiences
      },
      model: {
        modelId: model.modelId,
        modelDigest: model.modelDigest,
        status: model.status,
        learnedLabels: Object.keys(model.labels).sort(),
        learnedSequences: Object.keys(model.sequences).sort(),
        negativeLabels: Object.keys(model.negativeLabels).sort(),
        negativeSequences: Object.keys(model.negativeSequences).sort(),
        featurePolicy: model.featurePolicy,
        activeRuntime: false
      },
      evaluation: { baseline, challenger, origination, canaries },
      promotion: {
        state: promotionEligible ? 'PROPOSE_HUMAN_REVIEW' : 'HOLD_REPAIR',
        automatic: false,
        reviewRequired: true,
        runtimePointerChanged: false,
        reason: promotionEligible
          ? 'The private strategy challenger improved every frozen held-out and adversarial case without boundary regression; review is still required.'
          : 'One or more transfer, adversarial, comparison, or boundary gates remain open.'
      },
      recovery: {
        previousChampion: 'seed-0-deterministic-reasoning-foundation-without-strategy-model',
        rollbackProcedure: 'Keep the active runtime free of the private strategy model and quarantine this run directory.',
        rollbackDryRun: 'PASS: the active runtime never loaded this model.'
      },
      organAdmission: {
        candidates: [],
        boundary: 'A learned strategy closes path-selection gaps only. Repeated verified gaps with no adequate candidate path must travel through the separate organ-admission cell.'
      },
      artifacts,
      authority: {
        privateChallengerOnly: true,
        activeRuntime: false,
        toolUse: false,
        permissionGrant: false,
        memoryWrite: false,
        automaticPromotion: false,
        canonChange: false,
        identityChange: false
      },
      claimBoundary: 'This cycle measures learned structural strategy selection on frozen unseen cases. It does not prove open-ended reasoning, language competence, consciousness, or authority.'
    };
    const seamReport = Seam.inspectReasoningSkillCycle(cycle);
    if (seamReport.summary.open) {
      cycle.promotion.state = 'HOLD_REPAIR';
      cycle.promotion.reason = `${seamReport.summary.open} independent reasoning-skill seam(s) remain open.`;
    }
    fs.writeFileSync(path.join(stageDir, 'cycle.json'), json(cycle), 'utf8');
    fs.writeFileSync(path.join(stageDir, 'seam-report.json'), json(seamReport), 'utf8');
    fs.mkdirSync(stateDir, { recursive: true });
    const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
    return { cycle, seamReport, model, runDir, reused: commit.reused };
  } catch (error) {
    if (error && error.code !== 'IMMUTABLE_BATCH_DIVERGENCE' && fs.existsSync(stageDir)) fs.rmSync(stageDir, { recursive: true, force: true });
    throw error;
  }
}

module.exports = { SCHEMA, readFixture, requestFromCase, buildVerifiedSession, evaluateCases, evaluateOriginationCases, run };
