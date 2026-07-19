'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const IdentityBundle = require('./identity-bundle');
const ReasoningFoundation = require('../../../kernel/reasoning-foundation');
const Seam = require('../../../kernel/seam-cell');
const AutomaticGrowth = require('../../../training/automatic-growth');
const Curriculum = require('../../../training/workshop-steward-curriculum');
const LearningCycle = require('../../../training/learning-cycle');
const ReasoningSkillCycle = require('../../../training/reasoning-skill-cycle');
const ReasoningExperience = require('../../../organs/reasoning-experience-organ');
const ReasoningContractCurriculum = require('../../../organs/reasoning-contract-curriculum-organ');
const ReasoningHandoffGraph = require('../../../organs/reasoning-handoff-graph-organ');
const ReasoningRouteReadiness = require('../../../organs/reasoning-route-readiness-organ');
const ReasoningReadinessHands = require('../../../organs/reasoning-readiness-hand-organ');
const ReasoningReadinessProbeAffordances = require('../../../organs/reasoning-readiness-probe-affordance-organ');
const ProviderDeclarationHands = require('../../../organs/provider-declaration-hand-organ');
const ProviderDeclarationResearchExams = require('../../../organs/provider-declaration-research-exam-organ');
const ProviderDeclarationArchitectureSurvey = require('../../../organs/provider-declaration-architecture-survey-organ');
const ProviderDeclarationImplementationEvidenceSurvey = require('../../../organs/provider-declaration-implementation-evidence-survey-organ');
const ProviderDeclarationBindingExperimentPlanner = require('../../../organs/provider-declaration-binding-experiment-planner-organ');
const ProviderDeclarationResearchExecutorBuilder = require('../../../organs/provider-declaration-research-executor-builder-organ');
const ReasoningReadinessProbeBuilder = require('../../../organs/reasoning-readiness-probe-builder-organ');
const ReasoningCounterexamples = require('../../../organs/reasoning-counterexample-organ');
const ReasoningMetamorphic = require('../../../organs/reasoning-metamorphic-organ');
const WorkshopRoot = require('../../../config/workshop-root');

const MIRROR_ROOT = path.resolve(__dirname, '..', '..', '..');
const STAGES = ['context', 'analysis', 'reasoning', 'seam', 'lesson', 'training', 'judgement'];

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function now() { return new Date().toISOString(); }
function makeId(prefix) { return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`; }
function clean(value, max = 500) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }
function clamp(value, min, max, fallback) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }

function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.stage-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, file);
}

function config(options = {}) {
  const root = path.resolve(options.root || MIRROR_ROOT);
  return {
    root,
    workshopRoot: WorkshopRoot.resolve({ workshopRoot: options.workshopRoot, config: options.config, configRoot: MIRROR_ROOT }),
    stateDir: path.resolve(options.stateDir || path.join(root, 'state', 'native-learning-shell')),
    approvedEpisodesDir: path.resolve(options.approvedEpisodesDir || path.join(root, 'training', 'datasets', 'episodes')),
    reasoningReceiptsRoot: path.resolve(options.reasoningReceiptsRoot || root),
    reasoningReceiptsDir: path.resolve(options.reasoningReceiptsDir || path.join(root, 'training', 'datasets', 'reasoning-receipts')),
    tokenTrainingStateDir: path.resolve(options.tokenTrainingStateDir || path.join(root, 'state', 'training-runs')),
    reasoningSkillStateDir: path.resolve(options.reasoningSkillStateDir || path.join(root, 'state', 'reasoning-skill-runs')),
    contractCurriculumStateDir: path.resolve(options.contractCurriculumStateDir || path.join(root, 'state', 'reasoning-contract-curriculum-runs')),
    handoffGraphStateDir: path.resolve(options.handoffGraphStateDir || path.join(root, 'state', 'reasoning-handoff-graph-runs')),
    routeReadinessStateDir: path.resolve(options.routeReadinessStateDir || path.join(root, 'state', 'reasoning-route-readiness-runs')),
    routeReadinessSnapshot: options.routeReadinessSnapshot || null,
    readinessHandStateDir: path.resolve(options.readinessHandStateDir || path.join(root, 'state', 'reasoning-readiness-hand-runs')),
    readinessProbeAffordanceStateDir: path.resolve(options.readinessProbeAffordanceStateDir || path.join(root, 'state', 'reasoning-readiness-probe-affordance-runs')),
    providerDeclarationHandStateDir: path.resolve(options.providerDeclarationHandStateDir || path.join(root, 'state', 'provider-declaration-hand-runs')),
    providerDeclarationResearchExamStateDir: path.resolve(options.providerDeclarationResearchExamStateDir || path.join(root, 'state', 'provider-declaration-research-exam-runs')),
    providerDeclarationArchitectureSurveyStateDir: path.resolve(options.providerDeclarationArchitectureSurveyStateDir || path.join(root, 'state', 'provider-declaration-architecture-survey-runs')),
    providerDeclarationImplementationEvidenceSurveyStateDir: path.resolve(options.providerDeclarationImplementationEvidenceSurveyStateDir || path.join(root, 'state', 'provider-declaration-implementation-evidence-survey-runs')),
    providerDeclarationBindingExperimentStateDir: path.resolve(options.providerDeclarationBindingExperimentStateDir || path.join(root, 'state', 'provider-declaration-binding-experiment-runs')),
    providerDeclarationResearchExecutorBuilderStateDir: path.resolve(options.providerDeclarationResearchExecutorBuilderStateDir || path.join(root, 'state', 'provider-declaration-research-executor-builder-runs')),
    readinessProbeBuilderStateDir: path.resolve(options.readinessProbeBuilderStateDir || path.join(root, 'state', 'reasoning-readiness-probe-builder-runs')),
    counterexampleStateDir: path.resolve(options.counterexampleStateDir || path.join(root, 'state', 'reasoning-counterexample-runs')),
    metamorphicStateDir: path.resolve(options.metamorphicStateDir || path.join(root, 'state', 'reasoning-metamorphic-runs'))
  };
}

function lessonMap(cfg) {
  return new Map(Curriculum.lessonDefinitions(cfg.workshopRoot).map(lesson => [lesson.id, lesson]));
}

function catalog(options = {}) {
  const cfg = config(options);
  return Array.from(lessonMap(cfg).values()).map(lesson => ({
    id: lesson.id,
    module: lesson.module,
    goal: lesson.goal,
    expectedValue: lesson.expectedValue,
    expectedAction: lesson.expectedAction,
    expectedSeams: lesson.expectedSeams,
    contract: path.relative(cfg.workshopRoot, lesson.contractFile).replace(/\\/g, '/')
  }));
}

function sessionDir(cfg, sessionId) { return path.join(cfg.stateDir, 'sessions', sessionId); }
function sessionFile(cfg, sessionId) { return path.join(sessionDir(cfg, sessionId), 'session.json'); }

function readSession(sessionId, options = {}) {
  const cfg = config(options);
  const file = sessionFile(cfg, clean(sessionId, 160));
  if (!fs.existsSync(file)) throw new Error('learning-shell session not found');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveSession(cfg, session, event) {
  session.updatedAt = now();
  if (event) {
    const record = Object.assign({ schema: 'axm.mirror.learning-shell-event/v1', at: session.updatedAt, sessionId: session.id }, event);
    fs.mkdirSync(sessionDir(cfg, session.id), { recursive: true });
    fs.appendFileSync(path.join(sessionDir(cfg, session.id), 'events.jsonl'), JSON.stringify(record) + '\n', 'utf8');
    session.eventCount = Number(session.eventCount || 0) + 1;
  }
  atomicJson(sessionFile(cfg, session.id), session);
  return clone(session);
}

function writeArtifact(cfg, session, stage, value) {
  const file = path.join(sessionDir(cfg, session.id), `${stage}.json`);
  atomicJson(file, value);
  const bytes = fs.readFileSync(file);
  const record = {
    stage,
    path: path.relative(cfg.root, file).replace(/\\/g, '/'),
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length
  };
  session.artifacts[stage] = record;
  return record;
}

function readArtifact(session, stage, options = {}) {
  const cfg = config(options);
  const ref = session.artifacts && session.artifacts[stage];
  if (!ref) return null;
  const file = path.resolve(cfg.root, ref.path);
  if (!file.startsWith(cfg.stateDir + path.sep)) throw new Error('artifact path escaped learning-shell state');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeTuning(input = {}) {
  return {
    vocabSize: Math.round(clamp(input.vocabSize, 128, 4096, 512)),
    minFrequency: Math.round(clamp(input.minFrequency, 1, 20, 2)),
    order: Math.round(clamp(input.order, 1, 6, 3)),
    smoothingAlpha: clamp(input.smoothingAlpha, 0.0001, 10, 0.05)
  };
}

function normalizeModules(input = {}) {
  const modules = {};
  STAGES.forEach(stage => { modules[stage] = input[stage] !== false; });
  modules.context = true;
  return modules;
}

function createSession(input = {}, options = {}) {
  const cfg = config(options);
  const lessons = lessonMap(cfg);
  const lessonId = clean(input.lessonId || Array.from(lessons.keys())[0], 160);
  if (!lessons.has(lessonId)) throw new Error(`unknown learning-shell lesson: ${lessonId}`);
  const id = makeId('learning-shell');
  const session = {
    schema: 'axm.mirror.learning-shell-session/v1',
    id,
    identity: 'axm.machine.mirror/seed-0',
    status: 'READY',
    createdAt: now(),
    updatedAt: null,
    currentStage: null,
    nextStage: STAGES[0],
    completedStages: [],
    lessonId,
    selection: {
      reasoningProfile: clean(input.reasoningProfile || 'small-local-model', 120),
      specialistMask: clean(input.specialistMask || '', 200) || null,
      promptPack: clean(input.promptPack || '', 200) || null
    },
    tuning: normalizeTuning(input.tuning),
    modules: normalizeModules(input.modules),
    autoAdmitVerifiedLesson: input.autoAdmitVerifiedLesson !== false,
    artifacts: {},
    summaries: {},
    eventCount: 0,
    authority: { tools: false, externalNetwork: false, runtimePromotion: false, canonPromotion: false, identityMutation: false }
  };
  return saveSession(cfg, session, { type: 'session-created', lessonId, tuning: session.tuning, modules: session.modules });
}

function tuneSession(sessionId, input = {}, options = {}) {
  const cfg = config(options);
  const session = readSession(sessionId, options);
  if (session.completedStages.includes('training')) throw new Error('training tuning is frozen after the training stage');
  if (input.tuning) session.tuning = normalizeTuning(Object.assign({}, session.tuning, input.tuning));
  if (input.modules) session.modules = normalizeModules(Object.assign({}, session.modules, input.modules));
  if (input.selection) {
    session.selection = Object.assign({}, session.selection, {
      reasoningProfile: clean(input.selection.reasoningProfile || session.selection.reasoningProfile, 120),
      specialistMask: clean(input.selection.specialistMask || '', 200) || null,
      promptPack: clean(input.selection.promptPack || '', 200) || null
    });
  }
  return saveSession(cfg, session, { type: 'session-tuned', tuning: session.tuning, modules: session.modules, selection: session.selection });
}

function contractEvidence(lesson) {
  if (!fs.existsSync(lesson.contractFile)) throw new Error(`Workshop contract missing: ${lesson.contractFile}`);
  const bytes = fs.readFileSync(lesson.contractFile);
  const contractSha = crypto.createHash('sha256').update(bytes).digest('hex');
  const contract = JSON.parse(bytes.toString('utf8'));
  return {
    contract,
    contractSha,
    evidence: {
      id: 'module-contract', kind: 'rule', status: 'observed',
      statement: `${lesson.module} declares ${JSON.stringify(contract.boundaries && contract.boundaries.refuses || contract.truths || {})}`.slice(0, 4000),
      source: { kind: 'local-module-contract', id: lesson.id, uri: `file://${lesson.contractFile.replace(/\\/g, '/')}` },
      confidence: { low: 1, high: 1, basis: `Exact local bytes sha256:${contractSha}` }
    }
  };
}

function hold(session, cfg, stage, reason) {
  session.status = 'HOLD';
  session.currentStage = stage;
  session.nextStage = stage;
  session.summaries[stage] = { state: 'HOLD', reason };
  return saveSession(cfg, session, { type: 'stage-held', stage, reason });
}

function stageContext(cfg, session, lesson) {
  const bundle = IdentityBundle.build({ mirrorRoot: cfg.root, workshopRoot: cfg.workshopRoot });
  const selectedProfile = bundle.reasoning.profiles.find(item => item.id === session.selection.reasoningProfile) || null;
  const selectedSpecialist = bundle.specialists.masks.find(item => item.id === session.selection.specialistMask) || null;
  const selectedPrompt = bundle.promptPacks.find(item => item.id === session.selection.promptPack) || null;
  const artifact = {
    schema: 'axm.mirror.learning-shell-context/v1',
    identityBundle: bundle,
    lesson: { id: lesson.id, module: lesson.module, goal: lesson.goal, contractFile: lesson.contractFile },
    selected: { reasoningProfile: selectedProfile, specialistMask: selectedSpecialist, promptPack: selectedPrompt },
    truth: 'Profiles, masks and prompts are inspectable advisory inputs. The deterministic kernel does not secretly execute their prose.'
  };
  return { artifact, summary: { bundleDigest: bundle.bundleDigest, roots: (bundle.roots.roots || []).length, wisdomEntries: bundle.wisdom.memories.length, skills: bundle.skills.length, reasoningProfiles: bundle.reasoning.profiles.length, specialistMasks: bundle.specialists.masks.length, promptPacks: bundle.promptPacks.length, optedInProfileLinked: bundle.profile.linked } };
}

function stageAnalysis(cfg, session, lesson) {
  const linked = contractEvidence(lesson);
  const request = lesson.build(linked.evidence);
  const artifact = {
    schema: 'axm.mirror.analysis-draft/v1',
    subject: { lessonId: lesson.id, module: lesson.module, contractSha256: linked.contractSha },
    selectedReasoningProfile: session.selection.reasoningProfile,
    selectedSpecialistMask: session.selection.specialistMask,
    selectedPromptPack: session.selection.promptPack,
    advisoryInputsAppliedToKernel: false,
    goal: lesson.goal,
    evidenceInventory: request.evidence || [],
    unknowns: request.unknowns || [],
    constraints: request.constraints || [],
    permissions: request.permissions || [],
    candidates: request.actions || [],
    request,
    boundary: 'This stage organizes supplied state. It is an inspectable analysis artifact, not hidden chain-of-thought and not a decision.'
  };
  return { artifact, summary: { contractSha256: linked.contractSha, evidence: artifact.evidenceInventory.length, unknowns: artifact.unknowns.length, constraints: artifact.constraints.length, permissions: artifact.permissions.length, candidates: artifact.candidates.length } };
}

function stageReasoning(cfg, session) {
  const analysis = readArtifact(session, 'analysis', cfg);
  if (!analysis || !analysis.request) throw new Error('reasoning requires the analysis artifact');
  const foundation = ReasoningFoundation.run(Object.assign({}, analysis.request, {
    schema: 'axm.mirror.reasoning-session/v1',
    sessionId: session.id,
    actor: { id: 'axm.machine.mirror/seed-0', kind: 'machine-collaborator', displayName: 'Mirror' },
    goal: analysis.goal,
    budget: { maxCandidates: 8, deadlineMs: 1000 }
  }));
  const trace = foundation.principleTrace;
  return {
    artifact: foundation,
    summary: {
      reasoningSessionId: foundation.reasoningSessionId,
      traceId: trace.traceId,
      decision: trace.decision.value,
      selectedActionId: foundation.pathSet.selectedActionId,
      conflicts: (foundation.problemState.contradictions || []).length,
      candidates: foundation.pathSet.comparisons.length,
      openReasoningSeams: foundation.seams.map(item => item.id),
      memoryWrites: foundation.memoryRoute.writesPerformed.length,
      authority: foundation.authority
    }
  };
}

function stageSeam(cfg, session) {
  const reasoning = readArtifact(session, 'reasoning', cfg);
  const trace = reasoning && reasoning.principleTrace;
  if (!trace) throw new Error('seam review requires the native reasoning foundation and Principle trace');
  const report = Seam.inspectTrace(trace, { shellSessionId: session.id, deliberate: true });
  return { artifact: report, summary: { reportId: report.reportId, open: report.summary.open, closed: report.summary.closed, seamIds: report.seams.map(item => item.id) } };
}

function admitReasoningExperience(cfg, session, lesson, reasoning, linked, verification, policy) {
  if (!session.autoAdmitVerifiedLesson) return { state: 'NOT_REQUESTED', receiptId: null, file: null };
  const evaluatorBasis = {
    schema: 'axm.mirror.learning-shell-curriculum-evaluator/v1',
    lessonId: lesson.id,
    contractSha256: linked.contractSha,
    expectedValue: lesson.expectedValue,
    expectedAction: lesson.expectedAction,
    expectedSeams: lesson.expectedSeams.slice().sort()
  };
  const evaluatorDigest = crypto.createHash('sha256').update(JSON.stringify(evaluatorBasis)).digest('hex');
  const behaviorMatched = verification.expectedDecisionMatched && !verification.unexpectedSeams.length && !verification.missingExpectedSeams.length;
  const receipt = ReasoningExperience.create(reasoning, {
    provider: 'axm-workshop-local',
    sourceGroup: `workshop-reasoning/${lesson.id}/${linked.contractSha.slice(0, 16)}`,
    experienceKind: 'REAL_LOCAL_LESSON',
    parentReceiptIds: [],
    interventionId: null,
    role: 'training',
    policyId: policy.policy.standingLearningPermission.policyId,
    usePermission: 'allowed',
    permissionBasis: policy.policy.standingLearningPermission.statement,
    evaluator: {
      id: `learning-shell-curriculum-evaluator/${lesson.id}`,
      kind: 'deterministic-curriculum-evaluator',
      independent: true,
      sourceRef: `curriculum://${lesson.id}/${linked.contractSha}`,
      sourceDigest: evaluatorDigest
    }
  }, {
    observedDecisionValue: reasoning.principleTrace.decision.value,
    observedActionId: reasoning.principleTrace.decision.selectedActionId,
    expectedDecisionValue: lesson.expectedValue,
    expectedActionId: lesson.expectedAction,
    behaviorMatched,
    outcomeVerified: true,
    statement: behaviorMatched
      ? `${lesson.module} produced the expected decision and seam set under the content-digested curriculum evaluator.`
      : `${lesson.module} differed from the expected decision or seam set; preserve this as negative episodic evidence.`,
    worldMutations: 0,
    runtimePointerChanged: false,
    unexpectedSeams: verification.unexpectedSeams.concat(verification.missingExpectedSeams.map(id => `missing:${id}`))
  }, { at: null });
  const stored = ReasoningExperience.store(receipt, { root: cfg.reasoningReceiptsRoot, directory: cfg.reasoningReceiptsDir });
  return {
    state: stored.state,
    receiptId: stored.receipt.receiptId,
    receiptDigest: stored.receipt.receiptDigest,
    outcome: stored.receipt.trainingExample.outcome,
    strategyTags: stored.receipt.trainingExample.strategyTags,
    semanticConsolidation: false,
    file: stored.file
  };
}

function stageLesson(cfg, session, lesson) {
  const reasoning = readArtifact(session, 'reasoning', cfg);
  const trace = reasoning && reasoning.principleTrace;
  if (!trace) throw new Error('lesson admission requires the native reasoning foundation and Principle trace');
  const seamReport = readArtifact(session, 'seam', cfg);
  const linked = contractEvidence(lesson);
  const observedSeams = seamReport.seams.map(item => item.id);
  const unexpectedSeams = observedSeams.filter(id => !lesson.expectedSeams.includes(id));
  const missingExpectedSeams = lesson.expectedSeams.filter(id => !observedSeams.includes(id));
  const expectedDecisionMatched = trace.decision.value === lesson.expectedValue && trace.decision.selectedActionId === lesson.expectedAction;
  const candidate = Curriculum.makeEpisode(lesson, trace, seamReport, lesson.contractFile, linked.contractSha);
  const policy = AutomaticGrowth.loadPolicy(path.join(cfg.root, 'training', 'TRAINING_POLICY.json'));
  const reasoningExperience = admitReasoningExperience(cfg, session, lesson, reasoning, linked, { expectedDecisionMatched, unexpectedSeams, missingExpectedSeams }, policy);
  const artifact = {
    schema: 'axm.mirror.learning-shell-lesson/v1',
    candidate,
    verification: { expectedDecisionMatched, unexpectedSeams, missingExpectedSeams },
    admission: { requested: session.autoAdmitVerifiedLesson, state: 'CANDIDATE', episodeFile: null },
    reasoningExperience
  };
  if (!expectedDecisionMatched || unexpectedSeams.length || missingExpectedSeams.length) {
    artifact.admission.state = 'HOLD_BEHAVIOR_MISMATCH';
    return { artifact, summary: { state: artifact.admission.state, expectedDecisionMatched, unexpectedSeams, missingExpectedSeams }, held: true };
  }
  if (!session.autoAdmitVerifiedLesson) return { artifact, summary: { state: 'CANDIDATE_REVIEW_ONLY', expectedDecisionMatched }, held: true };

  const episodeDir = cfg.approvedEpisodesDir;
  fs.mkdirSync(episodeDir, { recursive: true });
  const existing = Curriculum.existingEpisodeByGroup(episodeDir, candidate.groupId);
  if (existing) {
    artifact.admission = { requested: true, state: 'REUSED_EQUIVALENT_APPROVED_LESSON', episodeFile: existing.file, episodeId: existing.episode.episodeId, episodeDigest: existing.episode.digest };
  } else {
    const approved = AutomaticGrowth.approvePracticeEpisode(candidate, {
      at: now(), explicitSession: true, expectedDecisionMatched: true, outcomeVerified: true,
      worldMutations: 0, networkCalls: 0, runtimePointerChanged: false, unexpectedSeams,
      behavior: `${lesson.module} returned the expected bounded training decision inside the native learning shell`
    }, policy);
    const episodeFile = path.join(episodeDir, `${approved.episodeId}.json`);
    if (fs.existsSync(episodeFile)) throw new Error(`learning shell refuses to overwrite ${episodeFile}`);
    fs.writeFileSync(episodeFile, JSON.stringify(approved, null, 2) + '\n', 'utf8');
    artifact.admission = { requested: true, state: 'ADMITTED_PRIVATE_PRACTICE', episodeFile, episodeId: approved.episodeId, episodeDigest: approved.digest };
  }
  return { artifact, summary: { state: artifact.admission.state, episodeId: artifact.admission.episodeId, expectedDecisionMatched, worldMutations: 0, runtimePointerChanged: false } };
}

function stageTraining(cfg, session) {
  const lesson = readArtifact(session, 'lesson', cfg);
  if (!lesson || !lesson.admission || !['ADMITTED_PRIVATE_PRACTICE', 'REUSED_EQUIVALENT_APPROVED_LESSON'].includes(lesson.admission.state)) {
    throw new Error('training requires a verified approved or equivalent private lesson');
  }
  const contractCurriculum = ReasoningContractCurriculum.derive({
    root: cfg.reasoningReceiptsRoot,
    workshopRoot: cfg.workshopRoot,
    directory: cfg.reasoningReceiptsDir,
    stateDir: cfg.contractCurriculumStateDir
  });
  const handoffGraph = ReasoningHandoffGraph.derive({
    root: cfg.reasoningReceiptsRoot,
    workshopRoot: cfg.workshopRoot,
    stateDir: cfg.handoffGraphStateDir
  });
  const routeReadiness = ReasoningRouteReadiness.derive({
    root: cfg.reasoningReceiptsRoot,
    workshopRoot: cfg.workshopRoot,
    handoffDerived: handoffGraph,
    stateDir: cfg.routeReadinessStateDir,
    snapshot: cfg.routeReadinessSnapshot
  });
  const readinessHands = ReasoningReadinessHands.derive({
    root: cfg.reasoningReceiptsRoot,
    workshopRoot: cfg.workshopRoot,
    handoffDerived: handoffGraph,
    readinessDerived: routeReadiness,
    stateDir: cfg.readinessHandStateDir
  });
  const readinessProbeAffordances = ReasoningReadinessProbeAffordances.derive({
    root: cfg.reasoningReceiptsRoot,
    workshopRoot: cfg.workshopRoot,
    handDerived: readinessHands,
    stateDir: cfg.readinessProbeAffordanceStateDir
  });
  const providerDeclarationHands = ProviderDeclarationHands.derive({
    root: cfg.reasoningReceiptsRoot,
    workshopRoot: cfg.workshopRoot,
    affordanceDerived: readinessProbeAffordances,
    stateDir: cfg.providerDeclarationHandStateDir
  });
  const providerDeclarationResearchExams = ProviderDeclarationResearchExams.derive({
    root: cfg.reasoningReceiptsRoot,
    workshopRoot: cfg.workshopRoot,
    providerDerived: providerDeclarationHands,
    stateDir: cfg.providerDeclarationResearchExamStateDir
  });
  const providerDeclarationResearchExecutors = ProviderDeclarationResearchExecutorBuilder.derive({
    root: cfg.reasoningReceiptsRoot,
    workshopRoot: cfg.workshopRoot,
    researchDerived: providerDeclarationResearchExams,
    recipes: [],
    stateDir: cfg.providerDeclarationResearchExecutorBuilderStateDir
  });
  const providerDeclarationArchitectureSurveys = ProviderDeclarationArchitectureSurvey.derive({
    root: cfg.reasoningReceiptsRoot,
    workshopRoot: cfg.workshopRoot,
    researchDerived: providerDeclarationResearchExams,
    stateDir: cfg.providerDeclarationArchitectureSurveyStateDir
  });
  const providerDeclarationImplementationEvidenceSurveys = ProviderDeclarationImplementationEvidenceSurvey.derive({
    root: cfg.reasoningReceiptsRoot,
    workshopRoot: cfg.workshopRoot,
    architectureDerived: providerDeclarationArchitectureSurveys,
    stateDir: cfg.providerDeclarationImplementationEvidenceSurveyStateDir
  });
  const providerDeclarationBindingExperiments = ProviderDeclarationBindingExperimentPlanner.derive({
    root: cfg.reasoningReceiptsRoot,
    workshopRoot: cfg.workshopRoot,
    implementationDerived: providerDeclarationImplementationEvidenceSurveys,
    stateDir: cfg.providerDeclarationBindingExperimentStateDir
  });
  const readinessProbeCandidates = ReasoningReadinessProbeBuilder.derive({
    root: cfg.reasoningReceiptsRoot,
    workshopRoot: cfg.workshopRoot,
    handDerived: readinessHands,
    recipes: [],
    stateDir: cfg.readinessProbeBuilderStateDir
  });
  const counterexamples = ReasoningCounterexamples.run({
    root: cfg.reasoningReceiptsRoot,
    directory: cfg.reasoningReceiptsDir,
    stateDir: cfg.counterexampleStateDir
  });
  const metamorphic = ReasoningMetamorphic.run({
    root: cfg.reasoningReceiptsRoot,
    directory: cfg.reasoningReceiptsDir,
    stateDir: cfg.metamorphicStateDir
  });
  const result = LearningCycle.run(Object.assign({
    root: cfg.root,
    approvedEpisodesDir: cfg.approvedEpisodesDir,
    stateDir: cfg.tokenTrainingStateDir
  }, session.tuning));
  const reasoningSkill = ReasoningSkillCycle.run({
    root: cfg.root,
    reasoningReceiptsDir: cfg.reasoningReceiptsDir,
    stateDir: cfg.reasoningSkillStateDir
  });
  const contractHeldOut = ReasoningContractCurriculum.evaluateHeldOut(contractCurriculum, reasoningSkill.model, {
    root: cfg.reasoningReceiptsRoot,
    workshopRoot: cfg.workshopRoot,
    directory: cfg.reasoningReceiptsDir
  });
  const artifact = {
    schema: 'axm.mirror.learning-shell-training-result/v1',
    cycle: result.cycle,
    seamReport: result.seamReport,
    runDir: result.runDir,
    reused: result.reused,
    reasoningSkillCycle: reasoningSkill.cycle,
    reasoningSkillSeamReport: reasoningSkill.seamReport,
    reasoningStrategyModel: reasoningSkill.model,
    reasoningSkillRunDir: reasoningSkill.runDir,
    reasoningSkillReused: reasoningSkill.reused,
    reasoningContractCurriculumBatch: contractCurriculum.batch,
    reasoningContractCurriculumRunDir: contractCurriculum.runDir,
    reasoningContractCurriculumReused: contractCurriculum.reused,
    reasoningContractHeldOutEvaluation: contractHeldOut.evaluation,
    reasoningContractHeldOutRunDir: contractHeldOut.runDir,
    reasoningContractHeldOutReused: contractHeldOut.reused,
    reasoningHandoffGraphBatch: handoffGraph.batch,
    reasoningHandoffGraphRunDir: handoffGraph.runDir,
    reasoningHandoffGraphReused: handoffGraph.reused,
    reasoningRouteReadinessBatch: routeReadiness.batch,
    reasoningRouteReadinessRunDir: routeReadiness.runDir,
    reasoningRouteReadinessReused: routeReadiness.reused,
    reasoningRouteReadinessObservation: routeReadiness.observation,
    reasoningReadinessHandBatch: readinessHands.batch,
    reasoningReadinessHandRunDir: readinessHands.runDir,
    reasoningReadinessHandReused: readinessHands.reused,
    reasoningReadinessProbeAffordanceBatch: readinessProbeAffordances.batch,
    reasoningReadinessProbeAffordanceRunDir: readinessProbeAffordances.runDir,
    reasoningReadinessProbeAffordanceReused: readinessProbeAffordances.reused,
    reasoningProviderDeclarationHandBatch: providerDeclarationHands.batch,
    reasoningProviderDeclarationHandRunDir: providerDeclarationHands.runDir,
    reasoningProviderDeclarationHandReused: providerDeclarationHands.reused,
    reasoningProviderDeclarationResearchExamBatch: providerDeclarationResearchExams.batch,
    reasoningProviderDeclarationResearchExamRunDir: providerDeclarationResearchExams.runDir,
    reasoningProviderDeclarationResearchExamReused: providerDeclarationResearchExams.reused,
    reasoningProviderDeclarationResearchExecutorBatch: providerDeclarationResearchExecutors.batch,
    reasoningProviderDeclarationResearchExecutorRunDir: providerDeclarationResearchExecutors.runDir,
    reasoningProviderDeclarationResearchExecutorReused: providerDeclarationResearchExecutors.reused,
    reasoningProviderDeclarationArchitectureSurveyBatch: providerDeclarationArchitectureSurveys.batch,
    reasoningProviderDeclarationArchitectureSurveyRunDir: providerDeclarationArchitectureSurveys.runDir,
    reasoningProviderDeclarationArchitectureSurveyReused: providerDeclarationArchitectureSurveys.reused,
    reasoningProviderDeclarationImplementationEvidenceSurveyBatch: providerDeclarationImplementationEvidenceSurveys.batch,
    reasoningProviderDeclarationImplementationEvidenceSurveyRunDir: providerDeclarationImplementationEvidenceSurveys.runDir,
    reasoningProviderDeclarationImplementationEvidenceSurveyReused: providerDeclarationImplementationEvidenceSurveys.reused,
    reasoningProviderDeclarationBindingExperimentBatch: providerDeclarationBindingExperiments.batch,
    reasoningProviderDeclarationBindingExperimentRunDir: providerDeclarationBindingExperiments.runDir,
    reasoningProviderDeclarationBindingExperimentReused: providerDeclarationBindingExperiments.reused,
    reasoningReadinessProbeCandidateBatch: readinessProbeCandidates.batch,
    reasoningReadinessProbeCandidateRunDir: readinessProbeCandidates.runDir,
    reasoningReadinessProbeCandidateReused: readinessProbeCandidates.reused,
    reasoningCounterexampleBatch: counterexamples.batch,
    reasoningCounterexampleRunDir: counterexamples.runDir,
    reasoningCounterexampleReused: counterexamples.reused,
    reasoningMetamorphicBatch: metamorphic.batch,
    reasoningMetamorphicRunDir: metamorphic.runDir,
    reasoningMetamorphicReused: metamorphic.reused,
    authority: { privateChallengerOnly: true, runtimePointerChanged: false, canonChanged: false, identityChanged: false, toolsGranted: false }
  };
  return { artifact, summary: {
    tokenCycleId: result.cycle.cycleId,
    tokenState: result.cycle.promotion.state,
    tokenReused: result.reused,
    trainingTokens: result.cycle.corpus.trainingTokenCount,
    baselineTestPerplexity: result.cycle.evaluation.baseline.testPerplexity,
    challengerTestPerplexity: result.cycle.evaluation.challenger.testPerplexity,
    tokenOpenSeams: result.seamReport.seams.filter(item => item.status === 'OPEN').map(item => item.id),
    reasoningSkillCycleId: reasoningSkill.cycle.cycleId,
    reasoningSkillState: reasoningSkill.cycle.promotion.state,
    reasoningSkillReused: reasoningSkill.reused,
    reasoningContractCurriculumBatchId: contractCurriculum.batch.batchId,
    reasoningContractCurriculumBatchReused: contractCurriculum.reused,
    reasoningContractEligibleContracts: contractCurriculum.batch.summary.eligibleContracts,
    reasoningContractPrivateTrainingExams: contractCurriculum.batch.summary.privateTrainingExams,
    reasoningContractHeldOutExams: contractCurriculum.batch.summary.heldOutEvaluationExams,
    reasoningContractBoundariesPreserved: contractCurriculum.batch.summary.boundaryPreserved,
    reasoningContractBoundaryMismatches: contractCurriculum.batch.summary.boundaryMismatches,
    reasoningContractHeldOutEvaluationId: contractHeldOut.evaluation.evaluationId,
    reasoningContractHeldOutChallengerPassed: contractHeldOut.evaluation.summary.challengerPassed,
    reasoningContractHeldOutChallengerFailed: contractHeldOut.evaluation.summary.challengerFailed,
    reasoningContractHeldOutTrainingReceipts: contractHeldOut.evaluation.summary.trainingReceiptsCreated,
    reasoningContractSplitLeakage: contractHeldOut.evaluation.splitLeakage,
    reasoningHandoffGraphBatchId: handoffGraph.batch.batchId,
    reasoningHandoffGraphBatchReused: handoffGraph.reused,
    reasoningHandoffEligibleContracts: handoffGraph.batch.summary.eligibleContracts,
    reasoningHandoffManifestBindingsPassed: handoffGraph.batch.summary.manifestBindingsPassed,
    reasoningHandoffManifestBindingsFailed: handoffGraph.batch.summary.manifestBindingsFailed,
    reasoningHandoffUndeclaredContractFiles: handoffGraph.batch.summary.undeclaredContractFiles,
    reasoningHandoffExactEdges: handoffGraph.batch.summary.exactCrossModuleEdges,
    reasoningHandoffDirectRoutes: handoffGraph.batch.summary.directRoutes,
    reasoningHandoffComposedRoutes: handoffGraph.batch.summary.composedDepthTwoRoutes,
    reasoningHandoffExactRoutesSelected: handoffGraph.batch.summary.exactRoutesSelected,
    reasoningHandoffRouteMismatches: handoffGraph.batch.summary.routeSelectionMismatches,
    reasoningHandoffUnboundDecoysRejected: handoffGraph.batch.summary.unboundDecoysRejected,
    reasoningHandoffTrainingReceipts: handoffGraph.batch.summary.trainingReceiptsCreated,
    reasoningHandoffWorldActions: handoffGraph.batch.summary.worldActionsExecuted,
    reasoningRouteReadinessBatchId: routeReadiness.batch.batchId,
    reasoningRouteReadinessBatchReused: routeReadiness.reused,
    reasoningRouteReadinessGraphRoutes: routeReadiness.batch.summary.graphRoutes,
    reasoningRouteReadinessGraphModules: routeReadiness.batch.summary.graphModules,
    reasoningRouteReadinessRequirements: routeReadiness.batch.summary.readinessRequirements,
    reasoningRouteReadinessReadyRoutes: routeReadiness.batch.summary.readyRoutes,
    reasoningRouteReadinessAvailableRoutes: routeReadiness.batch.summary.availableRoutes,
    reasoningRouteReadinessNeedsActionRoutes: routeReadiness.batch.summary.needsActionRoutes,
    reasoningRouteReadinessBlockedRoutes: routeReadiness.batch.summary.blockedRoutes,
    reasoningRouteReadinessClassificationMismatches: routeReadiness.batch.summary.classificationMismatches,
    reasoningRouteReadinessTrainingReceipts: routeReadiness.batch.summary.trainingReceiptsCreated,
    reasoningRouteReadinessWorldActions: routeReadiness.batch.summary.worldActionsExecuted,
    reasoningReadinessHandBatchId: readinessHands.batch.batchId,
    reasoningReadinessHandBatchReused: readinessHands.reused,
    reasoningReadinessUnknownRequirementIds: readinessHands.batch.summary.unknownRequirementIds,
    reasoningReadinessMissingProbeHandRequests: readinessHands.batch.summary.missingProbeHandRequests,
    reasoningReadinessUnknownInspectionHolds: readinessHands.batch.summary.unknownInspectionHolds,
    reasoningReadinessHandImpactedRoutes: readinessHands.batch.summary.impactedManifestBoundRoutes,
    reasoningReadinessHandClassificationMismatches: readinessHands.batch.summary.classificationMismatches,
    reasoningReadinessHandCodeFilesGenerated: readinessHands.batch.summary.codeFilesGenerated,
    reasoningReadinessHandProbesInstalled: readinessHands.batch.summary.probesInstalled,
    reasoningReadinessHandServicesStartedOrRepaired: readinessHands.batch.summary.servicesStartedOrRepaired,
    reasoningReadinessHandTrainingReceipts: readinessHands.batch.summary.trainingReceiptsCreated,
    reasoningReadinessHandWorldActions: readinessHands.batch.summary.worldActionsExecuted,
    reasoningReadinessProbeAffordanceBatchId: readinessProbeAffordances.batch.batchId,
    reasoningReadinessProbeAffordanceBatchReused: readinessProbeAffordances.reused,
    reasoningReadinessProbeAffordanceHandsAssessed: readinessProbeAffordances.batch.summary.handRequestsAssessed,
    reasoningReadinessProbeAffordanceFoundationServiceReviewPackets: readinessProbeAffordances.batch.summary.exactFoundationServiceReviewPackets,
    reasoningReadinessProbeAffordanceReviewPackets: readinessProbeAffordances.batch.summary.reviewPacketsProposed,
    reasoningReadinessProbeAffordanceNoProviderHolds: readinessProbeAffordances.batch.summary.noProviderHolds,
    reasoningReadinessProbeAffordanceAmbiguousProviderHolds: readinessProbeAffordances.batch.summary.ambiguousProviderHolds,
    reasoningReadinessProbeAffordanceNameInferencesRejected: readinessProbeAffordances.batch.summary.nameInferenceCandidatesRejected,
    reasoningReadinessProbeAffordanceFalseReadyRejected: readinessProbeAffordances.batch.summary.falseReadyCandidatesRejected,
    reasoningReadinessProbeAffordanceHumanReviews: readinessProbeAffordances.batch.summary.humanReviewsCreated,
    reasoningReadinessProbeAffordanceRecipesSealed: readinessProbeAffordances.batch.summary.recipesSealed,
    reasoningReadinessProbeAffordanceCandidatesBuilt: readinessProbeAffordances.batch.summary.candidatesBuilt,
    reasoningReadinessProbeAffordanceLiveExecutions: readinessProbeAffordances.batch.summary.liveProbesExecuted,
    reasoningReadinessProbeAffordanceWorkshopFilesChanged: readinessProbeAffordances.batch.summary.workshopFilesChanged,
    reasoningProviderDeclarationHandBatchId: providerDeclarationHands.batch.batchId,
    reasoningProviderDeclarationHandBatchReused: providerDeclarationHands.reused,
    reasoningProviderDeclarationAffordanceAssessments: providerDeclarationHands.batch.summary.affordanceAssessmentsEvaluated,
    reasoningProviderDeclarationHandsProposed: providerDeclarationHands.batch.summary.providerDeclarationHandsProposed,
    reasoningProviderDeclarationsPresentNoGap: providerDeclarationHands.batch.summary.declarationsPresentNoGap,
    reasoningProviderDeclarationNoConsumerDemandHolds: providerDeclarationHands.batch.summary.noConsumerDemandHolds,
    reasoningProviderDeclarationAmbiguousProviderHolds: providerDeclarationHands.batch.summary.ambiguousProviderHolds,
    reasoningProviderDeclarationInferencesRejected: providerDeclarationHands.batch.summary.providerInferenceCandidatesRejected,
    reasoningProviderDeclarationFalseAvailableRejected: providerDeclarationHands.batch.summary.falseAvailableCandidatesRejected,
    reasoningProviderDeclarationCandidateFiles: providerDeclarationHands.batch.summary.declarationCandidateFilesGenerated,
    reasoningProviderDeclarationsWritten: providerDeclarationHands.batch.summary.providerDeclarationsWritten,
    reasoningProviderDeclarationLiveExecutions: providerDeclarationHands.batch.summary.liveProbesExecuted,
    reasoningProviderDeclarationWorkshopFilesChanged: providerDeclarationHands.batch.summary.workshopFilesChanged,
    reasoningProviderDeclarationResearchExamBatchId: providerDeclarationResearchExams.batch.batchId,
    reasoningProviderDeclarationResearchExamBatchReused: providerDeclarationResearchExams.reused,
    reasoningProviderDeclarationResearchHandResults: providerDeclarationResearchExams.batch.summary.providerDeclarationHandResultsEvaluated,
    reasoningProviderDeclarationResearchExamsProposed: providerDeclarationResearchExams.batch.summary.researchExamRequestsProposed,
    reasoningProviderDeclarationResearchDeclarationsPresentNoExam: providerDeclarationResearchExams.batch.summary.declarationsPresentNoExam,
    reasoningProviderDeclarationResearchHolds: providerDeclarationResearchExams.batch.summary.noConsumerDemandResearchHolds + providerDeclarationResearchExams.batch.summary.ambiguousProviderResearchHolds,
    reasoningProviderDeclarationResearchFrontierExamRequired: providerDeclarationResearchExams.batch.summary.frontierExamRequired,
    reasoningProviderDeclarationResearchProviderBuildsRejected: providerDeclarationResearchExams.batch.summary.providerBuildCandidatesRejected,
    reasoningProviderDeclarationResearchFalseResolutionsRejected: providerDeclarationResearchExams.batch.summary.falseResolutionCandidatesRejected,
    reasoningProviderDeclarationResearchArchitecturesSelected: providerDeclarationResearchExams.batch.summary.architecturesSelected,
    reasoningProviderDeclarationResearchExecutorsBuilt: providerDeclarationResearchExams.batch.summary.examExecutorsBuilt,
    reasoningProviderDeclarationResearchFixtureFiles: providerDeclarationResearchExams.batch.summary.fixtureFilesGenerated,
    reasoningProviderDeclarationResearchProviderCandidates: providerDeclarationResearchExams.batch.summary.providerCandidatesBuilt,
    reasoningProviderDeclarationResearchDeclarationsWritten: providerDeclarationResearchExams.batch.summary.providerDeclarationsWritten,
    reasoningProviderDeclarationResearchLiveExperiments: providerDeclarationResearchExams.batch.summary.liveExperimentsExecuted,
    reasoningProviderDeclarationResearchWorkshopFilesChanged: providerDeclarationResearchExams.batch.summary.workshopFilesChanged,
    reasoningProviderDeclarationResearchExecutorBatchId: providerDeclarationResearchExecutors.batch.batchId,
    reasoningProviderDeclarationResearchExecutorBatchReused: providerDeclarationResearchExecutors.reused,
    reasoningProviderDeclarationResearchExecutorReviewedRecipes: providerDeclarationResearchExecutors.batch.summary.reviewedRecipes,
    reasoningProviderDeclarationResearchExecutorCandidatesBuilt: providerDeclarationResearchExecutors.batch.summary.executorCandidatesBuilt,
    reasoningProviderDeclarationResearchExecutorCandidateFiles: providerDeclarationResearchExecutors.batch.summary.candidateFilesGenerated,
    reasoningProviderDeclarationResearchExecutorFixtureCases: providerDeclarationResearchExecutors.batch.summary.fixtureCasesExecuted,
    reasoningProviderDeclarationResearchExecutorArchitecturesSelected: providerDeclarationResearchExecutors.batch.summary.architecturesSelected,
    reasoningProviderDeclarationResearchExecutorArchitecturesEvaluated: providerDeclarationResearchExecutors.batch.summary.architecturesEvaluated,
    reasoningProviderDeclarationResearchExecutorProviderCandidates: providerDeclarationResearchExecutors.batch.summary.providerCandidatesBuilt,
    reasoningProviderDeclarationResearchExecutorWorkshopFilesChanged: providerDeclarationResearchExecutors.batch.summary.workshopFilesChanged,
    reasoningProviderDeclarationResearchExecutorTrainingReceipts: providerDeclarationResearchExecutors.batch.summary.trainingReceiptsCreated,
    reasoningProviderDeclarationArchitectureSurveyBatchId: providerDeclarationArchitectureSurveys.batch.batchId,
    reasoningProviderDeclarationArchitectureSurveyBatchReused: providerDeclarationArchitectureSurveys.reused,
    reasoningProviderDeclarationArchitectureSurveyResearchResults: providerDeclarationArchitectureSurveys.batch.summary.researchExamResultsEvaluated,
    reasoningProviderDeclarationArchitectureSurveysProposed: providerDeclarationArchitectureSurveys.batch.summary.surveysProposed,
    reasoningProviderDeclarationArchitectureSurveyDocuments: providerDeclarationArchitectureSurveys.batch.summary.inventoryDocuments,
    reasoningProviderDeclarationArchitectureSurveyRelevantPatterns: providerDeclarationArchitectureSurveys.batch.summary.relevantPatternAssessments,
    reasoningProviderDeclarationArchitectureSurveyCompleteWitnesses: providerDeclarationArchitectureSurveys.batch.summary.completeCurrentRelationWitnesses,
    reasoningProviderDeclarationArchitectureSurveyHypothesesUntested: providerDeclarationArchitectureSurveys.batch.summary.hypothesesRemainingUntested,
    reasoningProviderDeclarationArchitectureSurveyFrequencySelectionsRejected: providerDeclarationArchitectureSurveys.batch.summary.frequencySelectionsRejected,
    reasoningProviderDeclarationArchitectureSurveyCrossDocumentMergesRejected: providerDeclarationArchitectureSurveys.batch.summary.crossDocumentMergesRejected,
    reasoningProviderDeclarationArchitectureSurveyArchitecturesSelected: providerDeclarationArchitectureSurveys.batch.summary.architecturesSelected,
    reasoningProviderDeclarationArchitectureSurveyArchitecturesEvaluated: providerDeclarationArchitectureSurveys.batch.summary.architecturesEvaluated,
    reasoningProviderDeclarationArchitectureSurveyProviderCandidates: providerDeclarationArchitectureSurveys.batch.summary.providerCandidatesBuilt,
    reasoningProviderDeclarationArchitectureSurveyWorkshopFilesChanged: providerDeclarationArchitectureSurveys.batch.summary.workshopFilesChanged,
    reasoningProviderDeclarationArchitectureSurveyTrainingReceipts: providerDeclarationArchitectureSurveys.batch.summary.trainingReceiptsCreated,
    reasoningProviderDeclarationImplementationEvidenceSurveyBatchId: providerDeclarationImplementationEvidenceSurveys.batch.batchId,
    reasoningProviderDeclarationImplementationEvidenceSurveyBatchReused: providerDeclarationImplementationEvidenceSurveys.reused,
    reasoningProviderDeclarationImplementationEvidenceArchitectureResults: providerDeclarationImplementationEvidenceSurveys.batch.summary.architectureSurveyResultsEvaluated,
    reasoningProviderDeclarationImplementationEvidenceSurveysProposed: providerDeclarationImplementationEvidenceSurveys.batch.summary.evidenceSurveysProposed,
    reasoningProviderDeclarationImplementationEvidenceSources: providerDeclarationImplementationEvidenceSurveys.batch.summary.inventorySources,
    reasoningProviderDeclarationImplementationEvidenceSelectorSources: providerDeclarationImplementationEvidenceSurveys.batch.summary.selectorBearingSources,
    reasoningProviderDeclarationImplementationEvidenceSelectorsWitnessed: providerDeclarationImplementationEvidenceSurveys.batch.summary.demandedSelectorsWitnessed,
    reasoningProviderDeclarationImplementationEvidenceProviderInferencesRejected: providerDeclarationImplementationEvidenceSurveys.batch.summary.providerInferencesRejected,
    reasoningProviderDeclarationImplementationEvidenceFrequencySelectionsRejected: providerDeclarationImplementationEvidenceSurveys.batch.summary.frequencySelectionsRejected,
    reasoningProviderDeclarationImplementationEvidenceProvidersInferred: providerDeclarationImplementationEvidenceSurveys.batch.summary.providerIdentitiesInferred,
    reasoningProviderDeclarationImplementationEvidenceOuterRequirementsBound: providerDeclarationImplementationEvidenceSurveys.batch.summary.outerRequirementsBound,
    reasoningProviderDeclarationImplementationEvidenceImplementationsSelected: providerDeclarationImplementationEvidenceSurveys.batch.summary.implementationsSelected,
    reasoningProviderDeclarationImplementationEvidenceSourcesExecuted: providerDeclarationImplementationEvidenceSurveys.batch.summary.sourcesExecuted,
    reasoningProviderDeclarationImplementationEvidenceWorkshopFilesChanged: providerDeclarationImplementationEvidenceSurveys.batch.summary.workshopFilesChanged,
    reasoningProviderDeclarationImplementationEvidenceTrainingReceipts: providerDeclarationImplementationEvidenceSurveys.batch.summary.trainingReceiptsCreated,
    reasoningProviderDeclarationBindingExperimentBatchId: providerDeclarationBindingExperiments.batch.batchId,
    reasoningProviderDeclarationBindingExperimentBatchReused: providerDeclarationBindingExperiments.reused,
    reasoningProviderDeclarationBindingExperimentImplementationResults: providerDeclarationBindingExperiments.batch.summary.implementationEvidenceResultsEvaluated,
    reasoningProviderDeclarationBindingExperimentMatrices: providerDeclarationBindingExperiments.batch.summary.experimentMatricesProposed,
    reasoningProviderDeclarationBindingExperimentCandidateSources: providerDeclarationBindingExperiments.batch.summary.candidateSourceWitnesses,
    reasoningProviderDeclarationBindingExperimentValidationWitnesses: providerDeclarationBindingExperiments.batch.summary.validationOnlyWitnesses,
    reasoningProviderDeclarationBindingExperimentHypotheses: providerDeclarationBindingExperiments.batch.summary.architectureHypothesesRepresented,
    reasoningProviderDeclarationBindingExperimentFrames: providerDeclarationBindingExperiments.batch.summary.experimentFramesProposed,
    reasoningProviderDeclarationBindingExperimentFrameSelectionsRejected: providerDeclarationBindingExperiments.batch.summary.frameSelectionsRejected,
    reasoningProviderDeclarationBindingExperimentPermissionCopiesRejected: providerDeclarationBindingExperiments.batch.summary.permissionCopiesRejected,
    reasoningProviderDeclarationBindingExperimentFramesSelected: providerDeclarationBindingExperiments.batch.summary.framesSelected,
    reasoningProviderDeclarationBindingExperimentProvidersInferred: providerDeclarationBindingExperiments.batch.summary.providerIdentitiesInferred,
    reasoningProviderDeclarationBindingExperimentPermissionsInferred: providerDeclarationBindingExperiments.batch.summary.permissionsInferred,
    reasoningProviderDeclarationBindingExperimentSourcesExecuted: providerDeclarationBindingExperiments.batch.summary.sourcesExecuted,
    reasoningProviderDeclarationBindingExperimentProviderCandidates: providerDeclarationBindingExperiments.batch.summary.providerCandidatesBuilt,
    reasoningProviderDeclarationBindingExperimentWorkshopFilesChanged: providerDeclarationBindingExperiments.batch.summary.workshopFilesChanged,
    reasoningProviderDeclarationBindingExperimentTrainingReceipts: providerDeclarationBindingExperiments.batch.summary.trainingReceiptsCreated,
    reasoningReadinessProbeCandidateBatchId: readinessProbeCandidates.batch.batchId,
    reasoningReadinessProbeCandidateBatchReused: readinessProbeCandidates.reused,
    reasoningReadinessProbeReviewedRecipes: readinessProbeCandidates.batch.summary.reviewedRecipes,
    reasoningReadinessProbeCandidatesBuilt: readinessProbeCandidates.batch.summary.candidatesBuilt,
    reasoningReadinessProbeCandidateCodeFiles: readinessProbeCandidates.batch.summary.candidateCodeFilesGenerated,
    reasoningReadinessProbeFixtureSuitesPassed: readinessProbeCandidates.batch.summary.fixtureSuitesPassed,
    reasoningReadinessProbeFixtureSuitesFailed: readinessProbeCandidates.batch.summary.fixtureSuitesFailed,
    reasoningReadinessProbeProbesInstalled: readinessProbeCandidates.batch.summary.probesInstalled,
    reasoningReadinessProbeLiveExecutions: readinessProbeCandidates.batch.summary.liveProbesExecuted,
    reasoningReadinessProbeWorkshopFilesChanged: readinessProbeCandidates.batch.summary.workshopFilesChanged,
    reasoningReadinessProbeTrainingReceipts: readinessProbeCandidates.batch.summary.trainingReceiptsCreated,
    reasoningReadinessProbeWorldActions: readinessProbeCandidates.batch.summary.worldActionsExecuted,
    reasoningCounterexampleBatchId: counterexamples.batch.batchId,
    reasoningCounterexampleBatchReused: counterexamples.reused,
    reasoningCounterexampleInterventions: counterexamples.batch.summary.interventions,
    reasoningCounterexampleWorked: counterexamples.batch.summary.worked,
    reasoningCounterexampleDidNotWork: counterexamples.batch.summary.didNotWork,
    reasoningMetamorphicBatchId: metamorphic.batch.batchId,
    reasoningMetamorphicBatchReused: metamorphic.reused,
    reasoningMetamorphicProbes: metamorphic.batch.summary.probes,
    reasoningMetamorphicAtomicProbes: metamorphic.batch.summary.atomicProbes,
    reasoningMetamorphicComposedProbes: metamorphic.batch.summary.composedProbes,
    reasoningMetamorphicMaximumCompositionDepth: metamorphic.batch.summary.maximumCompositionDepth,
    reasoningMetamorphicInvariantConfirmed: metamorphic.batch.summary.invariantConfirmed,
    reasoningMetamorphicCounterexamplesFound: metamorphic.batch.summary.counterexamplesFound,
    reasoningMetamorphicPositiveTrainingReceipts: metamorphic.batch.summary.positiveTrainingReceiptsCreated,
    reasoningMetamorphicFrontierState: metamorphic.batch.frontier.state,
    reasoningExperienceReceiptCount: reasoningSkill.cycle.corpus.privateReasoningExperienceReceiptCount,
    realLocalReasoningExperiences: reasoningSkill.cycle.corpus.realLocalReasoningExperienceReceiptCount,
    syntheticReasoningCounterexamples: reasoningSkill.cycle.corpus.syntheticCounterexampleReceiptCount,
    contractDerivedReasoningExams: reasoningSkill.cycle.corpus.contractDerivedExamReceiptCount,
    positiveReasoningExperiences: reasoningSkill.cycle.corpus.admittedPositiveEpisodicExperiences,
    negativeReasoningExperiences: reasoningSkill.cycle.corpus.admittedNegativeEpisodicExperiences,
    baselineReasoningAccuracy: reasoningSkill.cycle.evaluation.baseline.accuracy,
    challengerReasoningAccuracy: reasoningSkill.cycle.evaluation.challenger.accuracy,
    originatedReasoningAccuracy: reasoningSkill.cycle.evaluation.origination.challenger.accuracy,
    originatedReasoningLegacyExact: reasoningSkill.cycle.evaluation.origination.challenger.legacyExactPassed,
    originatedReasoningSafeUnderspecifiedHolds: reasoningSkill.cycle.evaluation.origination.challenger.safeUnderspecifiedHolds,
    reasoningSkillOpenSeams: reasoningSkill.seamReport.seams.filter(item => item.status === 'OPEN').map(item => item.id),
    runtimePointerChanged: false
  } };
}

function stageJudgement(cfg, session) {
  const training = readArtifact(session, 'training', cfg);
  if (!training || !training.cycle) throw new Error('judgement requires a completed training artifact');
  const report = Seam.inspectLearningCycle(training.cycle, { shellSessionId: session.id, deliberate: true });
  const reasoningSkillReport = Seam.inspectReasoningSkillCycle(training.reasoningSkillCycle, { shellSessionId: session.id, deliberate: true });
  const open = report.seams.filter(item => item.status === 'OPEN');
  const reasoningSkillOpen = reasoningSkillReport.seams.filter(item => item.status === 'OPEN');
  const tokenVerdict = open.length ? 'HOLD_REPAIR' : 'PROPOSE_HUMAN_REVIEW';
  const reasoningSkillVerdict = reasoningSkillOpen.length ? 'HOLD_REPAIR' : 'PROPOSE_HUMAN_REVIEW';
  const verdict = open.length || reasoningSkillOpen.length ? 'HOLD_REPAIR' : 'PROPOSE_HUMAN_REVIEW';
  const artifact = {
    schema: 'axm.mirror.learning-shell-judgement/v1',
    verdict,
    tokenVerdict,
    reasoningSkillVerdict,
    report,
    reasoningSkillReport,
    nextRepairs: open.map(item => ({ track: 'token-language', id: item.id, severity: item.severity, repairHint: item.repairHint, disconfirmingCheck: item.disconfirmingCheck }))
      .concat(reasoningSkillOpen.map(item => ({ track: 'reasoning-skill', id: item.id, severity: item.severity, repairHint: item.repairHint, disconfirmingCheck: item.disconfirmingCheck }))),
    claimBoundary: 'This judgement may hold or propose review. It cannot promote weights, identity, wisdom, permissions, canon or tool authority.'
  };
  return { artifact, summary: { verdict, tokenVerdict, reasoningSkillVerdict, openSeams: open.map(item => item.id), reasoningSkillOpenSeams: reasoningSkillOpen.map(item => item.id), runtimePromotion: false, humanReviewRequired: true } };
}

function runNext(sessionId, input = {}, options = {}) {
  const cfg = config(options);
  let session = readSession(sessionId, options);
  if (session.status === 'COMPLETE') return session;
  if (input.tuning || input.modules || input.selection) session = tuneSession(sessionId, input, options);
  const stage = session.nextStage || STAGES.find(item => !session.completedStages.includes(item));
  if (!stage) { session.status = 'COMPLETE'; return saveSession(cfg, session, { type: 'session-complete' }); }
  const lesson = lessonMap(cfg).get(session.lessonId);
  if (!lesson) return hold(session, cfg, stage, 'configured lesson is no longer available');
  if (session.modules[stage] === false) {
    session.completedStages.push(stage);
    session.summaries[stage] = { state: 'SKIPPED_BY_SESSION_CONFIGURATION' };
    session.nextStage = STAGES[STAGES.indexOf(stage) + 1] || null;
    return saveSession(cfg, session, { type: 'stage-skipped', stage });
  }
  session.status = 'RUNNING';
  session.currentStage = stage;
  saveSession(cfg, session, { type: 'stage-started', stage });
  try {
    const handlers = { context: stageContext, analysis: stageAnalysis, reasoning: stageReasoning, seam: stageSeam, lesson: stageLesson, training: stageTraining, judgement: stageJudgement };
    const result = handlers[stage](cfg, session, lesson);
    writeArtifact(cfg, session, stage, result.artifact);
    session.summaries[stage] = result.summary;
    if (result.held) return hold(session, cfg, stage, result.summary.state || 'stage held');
    session.completedStages.push(stage);
    session.nextStage = STAGES[STAGES.indexOf(stage) + 1] || null;
    session.currentStage = stage;
    session.status = session.nextStage ? 'READY' : 'COMPLETE';
    return saveSession(cfg, session, { type: 'stage-complete', stage, summary: result.summary });
  } catch (error) {
    return hold(session, cfg, stage, clean(error.message || error, 1000));
  }
}

function runAll(sessionId, input = {}, options = {}) {
  let session = readSession(sessionId, options);
  let guard = 0;
  while (session.status !== 'COMPLETE' && session.status !== 'HOLD' && guard < STAGES.length + 2) {
    session = runNext(sessionId, guard === 0 ? input : {}, options);
    guard += 1;
  }
  return session;
}

function listSessions(options = {}) {
  const cfg = config(options);
  const base = path.join(cfg.stateDir, 'sessions');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => {
    try { return readSession(entry.name, options); } catch (_) { return null; }
  }).filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

module.exports = { STAGES, catalog, createSession, readSession, listSessions, tuneSession, runNext, runAll, readArtifact, normalizeTuning, normalizeModules };
