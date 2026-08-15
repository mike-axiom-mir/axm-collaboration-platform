'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const StrategyModel = require('../learning/reasoning-strategy-model');

const ORGAN_ID = 'axm.mirror.organ/reasoning-experience-intake-v5';
const SCHEMA = 'axm.mirror.reasoning-experience-receipt/v5';
const PREVIOUS_ORGAN_ID = 'axm.mirror.organ/reasoning-experience-intake-v4';
const PREVIOUS_SCHEMA = 'axm.mirror.reasoning-experience-receipt/v4';
const V3_ORGAN_ID = 'axm.mirror.organ/reasoning-experience-intake-v3';
const V3_SCHEMA = 'axm.mirror.reasoning-experience-receipt/v3';
const LEGACY_ORGAN_ID = 'axm.mirror.organ/reasoning-experience-intake-v2';
const LEGACY_SCHEMA = 'axm.mirror.reasoning-experience-receipt/v2';
const STANDING_POLICY_ID = 'axm.mirror.standing-local-practice/v1';
const STANDING_POLICY_STATEMENT = 'Mirror may automatically practise on permissioned local Workshop evidence and train private challengers. Runtime, canon, identity and authority promotion remain separately gated.';
const EXPERIENCE_KINDS = new Set(['REAL_LOCAL_LESSON', 'SYNTHETIC_COUNTEREXAMPLE', 'CONTRACT_DERIVED_EXAM']);
const KNOWN_FAIL_EVALUATORS = new Map([
  ['axm.mirror.organ/reasoning-counterexample-lab-v1/evaluator', 'Counterexample lab v1 could leave action reversibility and path-profile reversibility inconsistent. Its receipts remain preserved but are excluded from training.']
]);
const FORBIDDEN_KEYS = /^(chain[-_ ]?of[-_ ]?thought|hidden[-_ ]?reasoning|private[-_ ]?reasoning|scratchpad|internal[-_ ]?monologue)$/i;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => {
    output[key] = stable(value[key]);
    return output;
  }, {});
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function shaBytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function clean(value, maximum = 500) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, maximum);
}

function token(value) {
  return clean(value, 120).toLowerCase().replace(/[^a-z0-9._:/-]/g, '-').replace(/-+/g, '-');
}

function scanForbidden(value, location = 'receipt') {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) throw new Error(`private reasoning field refused at ${location}.${key}`);
    scanForbidden(nested, `${location}.${key}`);
  }
}

function withoutDigest(receipt) {
  const copy = JSON.parse(JSON.stringify(receipt));
  delete copy.receiptDigest;
  return copy;
}

function authorityClosed(session) {
  return session && session.authority && session.authority.proposalOnly === true &&
    Object.entries(session.authority).every(([key, value]) => key === 'proposalOnly' ? value === true : value === false);
}

function deriveStrategyTags(session) {
  return StrategyModel.observableStrategyTags(StrategyModel.extractFeatures(session), {
    includeBoundedAction: true,
    decisionValue: session.principleTrace.decision.value,
    fallback: true
  });
}

function safePrototype(strategyTags) {
  const first = strategyTags[0];
  const kind = first === 'ask-blocking-unknown' ? 'ask'
    : ['respect-missing-permission', 'require-recovery-before-action', 'respect-explicit-prohibition'].includes(first) ? 'hold'
      : 'observe';
  return {
    kind,
    approach: `Apply the reviewable reasoning sequence: ${strategyTags.join(' then ')}.`,
    estimatedCost: 'UNKNOWN',
    informationValue: 0.7,
    reversible: true,
    risk: 'low',
    toolRequestRequired: false,
    failureConditions: ['The structural lesson may not transfer to this problem.'],
    boundary: 'Experience prototypes may originate only non-mutating ask, observe, or hold candidates.'
  };
}

function normalizeEvaluation(session, evaluation, schema = SCHEMA) {
  evaluation = evaluation && typeof evaluation === 'object' ? evaluation : {};
  const decision = session.principleTrace && session.principleTrace.decision || {};
  const observedInput = evaluation.observedDecision && typeof evaluation.observedDecision === 'object' ? evaluation.observedDecision : {};
  const expectedInput = evaluation.expectedDecision && typeof evaluation.expectedDecision === 'object' ? evaluation.expectedDecision : {};
  const observed = {
    value: Number(observedInput.value == null ? evaluation.observedDecisionValue : observedInput.value),
    actionId: clean(observedInput.actionId || evaluation.observedActionId, 200)
  };
  const expected = {
    value: Number(expectedInput.value == null ? evaluation.expectedDecisionValue : expectedInput.value),
    actionId: clean(expectedInput.actionId || evaluation.expectedActionId, 200)
  };
  if (![-1, 0, 1].includes(observed.value) || !observed.actionId || observed.value !== Number(decision.value) || observed.actionId !== clean(decision.selectedActionId, 200)) {
    throw new Error('reasoning experience observed decision does not match the deterministic session');
  }
  if (![-1, 0, 1].includes(expected.value) || !expected.actionId) throw new Error('reasoning experience expected decision is incomplete');
  const decisionMatched = observed.value === expected.value && observed.actionId === expected.actionId;
  const behaviorMatched = evaluation.behaviorMatched === true;
  const outcomeSucceeded = schema === SCHEMA
    ? (typeof evaluation.outcomeSucceeded === 'boolean' ? evaluation.outcomeSucceeded : behaviorMatched)
    : behaviorMatched;
  if (schema === SCHEMA) {
    if (typeof evaluation.decisionMatched === 'boolean' && evaluation.decisionMatched !== decisionMatched) throw new Error('reasoning experience decisionMatched contradicts observed and expected decisions');
    if (behaviorMatched !== (decisionMatched && outcomeSucceeded)) throw new Error('reasoning experience behaviorMatched must bind decision match and observed outcome success');
  } else if (behaviorMatched !== decisionMatched) throw new Error('reasoning experience behaviorMatched contradicts observed and expected decisions');
  if (evaluation.outcomeVerified !== true) throw new Error('reasoning experience outcome requires independent verification');
  if (Number(evaluation.worldMutations) !== 0 || evaluation.runtimePointerChanged !== false) throw new Error('reasoning experience refuses world mutation or runtime-pointer change');
  const unexpectedSeams = (Array.isArray(evaluation.unexpectedSeams) ? evaluation.unexpectedSeams : []).map(item => clean(item, 240)).filter(Boolean);
  const suppliedTags = (Array.isArray(evaluation.strategyTags) ? evaluation.strategyTags : []).map(token).filter(Boolean);
  const requestedLabelSource = clean(evaluation.strategyLabelSource, 80);
  const structuralTags = deriveStrategyTags(session);
  let strategyLabelSource;
  let strategyTags;
  if (requestedLabelSource === 'STRUCTURAL_BOOTSTRAP_ORGAN') {
    if (suppliedTags.length && JSON.stringify(Array.from(new Set(suppliedTags))) !== JSON.stringify(structuralTags)) throw new Error('reasoning experience structural strategy tags do not match the bootstrap organ');
    strategyLabelSource = 'STRUCTURAL_BOOTSTRAP_ORGAN';
    strategyTags = structuralTags;
  } else if (requestedLabelSource === 'INDEPENDENT_EVALUATOR' || suppliedTags.length) {
    if (!suppliedTags.length) throw new Error('independent evaluator strategy labels are missing');
    strategyLabelSource = 'INDEPENDENT_EVALUATOR';
    strategyTags = Array.from(new Set(suppliedTags));
  } else {
    strategyLabelSource = 'STRUCTURAL_BOOTSTRAP_ORGAN';
    strategyTags = structuralTags;
  }
  const normalized = {
    result: behaviorMatched ? 'WORKED' : 'DID_NOT_WORK',
    behaviorMatched,
    outcomeVerified: true,
    observedDecision: observed,
    expectedDecision: expected,
    statement: clean(evaluation.statement, 2000) || `Observed ${observed.value}/${observed.actionId}; expected ${expected.value}/${expected.actionId}.`,
    strategyTags,
    strategyLabelSource,
    worldMutations: 0,
    runtimePointerChanged: false,
    unexpectedSeams
  };
  if (schema === SCHEMA) {
    normalized.decisionMatched = decisionMatched;
    normalized.outcomeSucceeded = outcomeSucceeded;
  }
  return normalized;
}

function assertAdmissible(session, source, evaluation, options = {}) {
  scanForbidden({ session, source, evaluation });
  if (!session || session.schema !== 'axm.mirror.reasoning-session/v1') throw new Error('reasoning experience requires a Reasoning Foundation session');
  if (!session.cell || session.cell.learnedWeights !== false || String(session.cell.status || '').startsWith('PRIVATE_')) throw new Error('reasoning experience refuses private-challenger self-training');
  if (!session.independentSeamReview || Number(session.independentSeamReview.summary && session.independentSeamReview.summary.open) !== 0) throw new Error('reasoning experience requires a clean independent authority and selection audit');
  if (!authorityClosed(session)) throw new Error('reasoning experience authority boundary is not clean');
  const sourceGroup = clean(source && source.sourceGroup, 200);
  const provider = clean(source && source.provider, 160);
  const policyId = clean(source && source.policyId, 200);
  const evaluator = source && source.evaluator && typeof source.evaluator === 'object' ? source.evaluator : {};
  const evaluatorId = clean(evaluator.id, 200);
  const evaluatorSourceRef = clean(evaluator.sourceRef, 1000);
  const evaluatorSourceDigest = clean(evaluator.sourceDigest, 64).toLowerCase();
  const identityId = clean(session.identity && session.identity.id || session.identity, 200);
  const experienceKind = clean(source && source.experienceKind, 80) || 'REAL_LOCAL_LESSON';
  const parentReceiptIds = (Array.isArray(source && source.parentReceiptIds) ? source.parentReceiptIds : []).map(item => clean(item, 80)).filter(Boolean);
  const interventionId = clean(source && source.interventionId, 160) || null;
  if (!sourceGroup || !provider) throw new Error('reasoning experience requires provider and sourceGroup lineage');
  if (provider !== 'axm-workshop-local' || policyId !== STANDING_POLICY_ID) throw new Error('automatic reasoning experience intake is limited to the standing local Workshop policy');
  if (source.role !== 'training') throw new Error('reasoning experience may enter only the training role, never held-out evaluation');
  if (source.usePermission !== 'allowed' || !clean(source.permissionBasis, 1000)) throw new Error('reasoning experience requires explicit allowed use permission and its basis');
  if (!evaluatorId || evaluator.independent !== true || !evaluatorSourceRef || !/^[a-f0-9]{64}$/.test(evaluatorSourceDigest)) throw new Error('reasoning experience requires a named independent evaluator, source reference, and content digest');
  if ([identityId, session.cell.id, session.reasoningSessionId].filter(Boolean).includes(evaluatorId)) throw new Error('reasoning experience evaluator cannot be the learner, cell, or session itself');
  if (!EXPERIENCE_KINDS.has(experienceKind)) throw new Error('reasoning experience kind is not recognized');
  if (experienceKind === 'REAL_LOCAL_LESSON' && (parentReceiptIds.length || interventionId)) throw new Error('real local reasoning experience cannot claim synthetic parent or intervention lineage');
  if (experienceKind === 'SYNTHETIC_COUNTEREXAMPLE' && (parentReceiptIds.length !== 1 || !/^reasoning-experience-[a-f0-9]{24}$/.test(parentReceiptIds[0]) || !interventionId)) {
    throw new Error('synthetic reasoning experience requires one parent receipt and an intervention ID');
  }
  if (experienceKind === 'CONTRACT_DERIVED_EXAM' && (parentReceiptIds.length || interventionId)) {
    throw new Error('contract-derived reasoning exam cannot claim a real parent or synthetic intervention');
  }
  return {
    sourceGroup,
    provider,
    policyId,
    permissionBasis: clean(source.permissionBasis, 1000),
    evaluatorId,
    evaluatorKind: clean(evaluator.kind, 160) || 'independent-evaluator',
    evaluatorSourceRef,
    evaluatorSourceDigest,
    experienceKind,
    parentReceiptIds,
    interventionId,
    evaluation: normalizeEvaluation(session, evaluation, options.schema || SCHEMA)
  };
}

function create(session, source, evaluation, options = {}) {
  source = source || {};
  const admitted = assertAdmissible(session, source, evaluation);
  const features = StrategyModel.extractFeatures(session);
  const trainingExample = {
    outcome: admitted.evaluation.result,
    features,
    strategyTags: admitted.evaluation.strategyTags,
    strategyLabelSource: admitted.evaluation.strategyLabelSource,
    prototype: admitted.evaluation.result === 'WORKED' ? safePrototype(admitted.evaluation.strategyTags) : null,
    semanticConsolidation: false,
    evidenceRole: admitted.evaluation.result === 'WORKED' ? 'POSITIVE_EPISODIC_EXAMPLE' : 'NEGATIVE_EPISODIC_EXAMPLE'
  };
  const receipt = {
    schema: SCHEMA,
    receiptId: null,
    receiptDigest: null,
    organ: { id: ORGAN_ID, status: 'WORKING_PRIVATE_APPEND_ONLY', learnedWeights: false },
    createdAt: clean(options.at, 80) || null,
    source: {
      provider: admitted.provider,
      sourceGroup: admitted.sourceGroup,
      experienceKind: admitted.experienceKind,
      parentReceiptIds: admitted.parentReceiptIds,
      interventionId: admitted.interventionId,
      role: 'training',
      policyId: admitted.policyId,
      evaluator: {
        id: admitted.evaluatorId,
        kind: admitted.evaluatorKind,
        independent: true,
        sourceRef: admitted.evaluatorSourceRef,
        sourceDigest: admitted.evaluatorSourceDigest
      },
      usePermission: 'allowed',
      permissionBasis: admitted.permissionBasis
    },
    reasoningSession: JSON.parse(JSON.stringify(session)),
    evaluation: admitted.evaluation,
    trainingExample,
    admission: {
      state: 'APPROVED_PRIVATE_EPISODIC_TRAINING',
      episodicOutcomeVerified: true,
      semanticConsolidation: false,
      independentSeamOpen: 0,
      deterministicTeacherOnly: true,
      learnedSelfTraining: false,
      appendOnly: true
    },
    authority: {
      privateReceiptAppend: true,
      overwriteReceipt: false,
      toolUse: false,
      worldAction: false,
      permissionGrant: false,
      heldOutMutation: false,
      semanticTruthWrite: false,
      activeModelChange: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'A verified episode may teach a private challenger without becoming repeated semantic truth. This organ cannot train on learned outputs, alter held-out evidence, overwrite receipts, load a model, or promote anything.'
  };
  receipt.receiptId = `reasoning-experience-${digest({ source: receipt.source, evaluation: receipt.evaluation, trainingExample }).slice(0, 24)}`;
  receipt.receiptDigest = digest(withoutDigest(receipt));
  return receipt;
}

function semanticEvaluation(receipt) {
  const evaluation = JSON.parse(JSON.stringify(receipt.evaluation || {}));
  const observed = evaluation.observedDecision || {};
  const expected = evaluation.expectedDecision || {};
  if (typeof evaluation.decisionMatched !== 'boolean') {
    evaluation.decisionMatched = Number(observed.value) === Number(expected.value) && observed.actionId === expected.actionId;
  }
  if (typeof evaluation.outcomeSucceeded !== 'boolean') {
    evaluation.outcomeSucceeded = evaluation.behaviorMatched === true;
  }
  return evaluation;
}

function semanticDigest(receipt) {
  const source = receipt.source || {};
  return digest({
    source: {
      provider: source.provider,
      sourceGroup: source.sourceGroup,
      experienceKind: source.experienceKind || 'REAL_LOCAL_LESSON',
      parentReceiptIds: source.parentReceiptIds || [],
      interventionId: source.interventionId || null,
      role: source.role,
      policyId: source.policyId,
      evaluator: source.evaluator,
      usePermission: source.usePermission
    },
    evaluation: semanticEvaluation(receipt),
    trainingExample: receipt.trainingExample,
    admission: receipt.admission,
    authority: receipt.authority
  });
}

function verify(receipt) {
  if (!receipt || ![SCHEMA, PREVIOUS_SCHEMA, V3_SCHEMA, LEGACY_SCHEMA].includes(receipt.schema)) throw new Error('invalid reasoning experience receipt');
  scanForbidden(receipt);
  if (!receipt.receiptId || !/^reasoning-experience-[a-f0-9]{24}$/.test(receipt.receiptId)) throw new Error('reasoning experience receipt ID missing');
  if (!receipt.receiptDigest || digest(withoutDigest(receipt)) !== receipt.receiptDigest) throw new Error('reasoning experience receipt digest mismatch');
  const admitted = assertAdmissible(receipt.reasoningSession, receipt.source, receipt.evaluation, { schema: receipt.schema });
  const expectedOrganId = receipt.schema === LEGACY_SCHEMA ? LEGACY_ORGAN_ID
    : receipt.schema === V3_SCHEMA ? V3_ORGAN_ID
      : receipt.schema === PREVIOUS_SCHEMA ? PREVIOUS_ORGAN_ID : ORGAN_ID;
  if (!receipt.organ || receipt.organ.id !== expectedOrganId || receipt.organ.learnedWeights !== false) throw new Error('reasoning experience organ lineage mismatch');
  if ([SCHEMA, PREVIOUS_SCHEMA, V3_SCHEMA].includes(receipt.schema) && (receipt.source.experienceKind !== admitted.experienceKind || JSON.stringify(receipt.source.parentReceiptIds) !== JSON.stringify(admitted.parentReceiptIds) || (receipt.source.interventionId || null) !== admitted.interventionId)) {
    throw new Error('reasoning experience source lineage mismatch');
  }
  const features = StrategyModel.extractFeatures(receipt.reasoningSession);
  const expectedExample = {
    outcome: admitted.evaluation.result,
    features,
    strategyTags: admitted.evaluation.strategyTags,
    strategyLabelSource: admitted.evaluation.strategyLabelSource,
    prototype: admitted.evaluation.result === 'WORKED' ? safePrototype(admitted.evaluation.strategyTags) : null,
    semanticConsolidation: false,
    evidenceRole: admitted.evaluation.result === 'WORKED' ? 'POSITIVE_EPISODIC_EXAMPLE' : 'NEGATIVE_EPISODIC_EXAMPLE'
  };
  if (JSON.stringify(stable(receipt.trainingExample)) !== JSON.stringify(stable(expectedExample))) throw new Error('reasoning experience training example lineage mismatch');
  const expectedReceiptId = `reasoning-experience-${digest({ source: receipt.source, evaluation: receipt.evaluation, trainingExample: receipt.trainingExample }).slice(0, 24)}`;
  if (receipt.receiptId !== expectedReceiptId) throw new Error('reasoning experience receipt ID lineage mismatch');
  if (!receipt.admission || receipt.admission.state !== 'APPROVED_PRIVATE_EPISODIC_TRAINING' || receipt.admission.semanticConsolidation !== false || receipt.admission.learnedSelfTraining !== false || receipt.admission.appendOnly !== true) throw new Error('reasoning experience admission boundary is incomplete');
  const authority = receipt.authority || {};
  if (authority.privateReceiptAppend !== true || authority.overwriteReceipt !== false ||
      ['toolUse', 'worldAction', 'permissionGrant', 'heldOutMutation', 'semanticTruthWrite', 'activeModelChange', 'runtimePromotion', 'canonChange', 'identityChange'].some(key => authority[key] !== false)) throw new Error('reasoning experience authority boundary is incomplete');
  return true;
}

function store(receipt, options = {}) {
  verify(receipt);
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const directory = path.resolve(options.directory || path.join(root, 'training', 'datasets', 'reasoning-receipts'));
  const relative = path.relative(root, directory);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('reasoning experience receipts must stay inside the Mirror root');
  fs.mkdirSync(directory, { recursive: true });
  for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.json')).sort()) {
    const existingFile = path.join(directory, name);
    const existing = JSON.parse(fs.readFileSync(existingFile, 'utf8'));
    verify(existing);
    if (existing.source.sourceGroup !== receipt.source.sourceGroup) continue;
    if (semanticDigest(existing) !== semanticDigest(receipt)) throw new Error(`reasoning experience source-group collision refuses silent replacement: ${receipt.source.sourceGroup}`);
    return { state: 'REUSED_EQUIVALENT_SOURCE_GROUP_RECEIPT', file: existingFile, receipt: existing };
  }
  const file = path.join(directory, `${receipt.receiptId}.json`);
  const bytes = JSON.stringify(stable(receipt), null, 2) + '\n';
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error(`reasoning experience receipt collision refuses overwrite: ${file}`);
    return { state: 'REUSED_EQUIVALENT_RECEIPT', file, receipt };
  }
  const stage = path.join(directory, `.stage-${receipt.receiptId}-${process.pid}`);
  fs.writeFileSync(stage, bytes, { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(stage, file);
  return { state: 'APPENDED_PRIVATE_TRAINING_RECEIPT', file, receipt };
}

function loadDirectory(directory) {
  directory = path.resolve(directory);
  if (!fs.existsSync(directory)) return [];
  const loaded = fs.readdirSync(directory).filter(name => name.endsWith('.json')).sort().map(name => {
    const file = path.join(directory, name);
    const bytes = fs.readFileSync(file);
    const receipt = JSON.parse(bytes.toString('utf8'));
    verify(receipt);
    if (name !== `${receipt.receiptId}.json`) throw new Error(`reasoning experience filename does not match receipt ID: ${file}`);
    return { file, sha256: shaBytes(bytes), receipt };
  });
  const groups = loaded.map(item => item.receipt.source.sourceGroup);
  if (new Set(groups).size !== groups.length) throw new Error('reasoning experience source groups must be unique');
  return loaded;
}

function trainingEligibility(receipt) {
  verify(receipt);
  const evaluatorId = receipt.source && receipt.source.evaluator && receipt.source.evaluator.id;
  if (KNOWN_FAIL_EVALUATORS.has(evaluatorId)) return {
    eligible: false,
    state: 'KNOWN_FAIL_SUPERSEDED',
    reason: KNOWN_FAIL_EVALUATORS.get(evaluatorId),
    receiptId: receipt.receiptId,
    evaluatorId
  };
  if ((receipt.source.experienceKind || 'REAL_LOCAL_LESSON') === 'SYNTHETIC_COUNTEREXAMPLE') {
    const selectedActionId = receipt.reasoningSession.principleTrace.decision.selectedActionId;
    const candidate = receipt.reasoningSession.principleTrace.candidates.find(item => item.action.id === selectedActionId);
    const profile = receipt.reasoningSession.pathSet.profiles.find(item => item.actionId === selectedActionId);
    if (candidate && profile && typeof profile.reversible === 'boolean' && profile.reversible !== candidate.action.reversible) return {
      eligible: false,
      state: 'KNOWN_FAIL_FEATURE_LINEAGE',
      reason: 'Synthetic action reversibility and path-profile reversibility disagree.',
      receiptId: receipt.receiptId,
      evaluatorId
    };
  }
  if (receipt.source.experienceKind === 'CONTRACT_DERIVED_EXAM') {
    const source = receipt.source;
    const selected = receipt.reasoningSession.principleTrace.decision;
    const prohibited = receipt.reasoningSession.problemState.constraints.some(item =>
      item.type === 'prohibit-action' && item.actionIds.includes(selected.selectedActionId));
    if (!source.evaluator.id.startsWith('axm.mirror.organ/reasoning-contract-curriculum-v2/evaluator/') ||
        source.evaluator.kind !== 'typed-contract-boundary-evaluator' ||
        !source.evaluator.sourceRef.startsWith('contract-boundary://') || !prohibited ||
        receipt.evaluation.expectedDecision.value !== -1 ||
        !receipt.trainingExample.strategyTags.includes('respect-explicit-prohibition')) return {
      eligible: false,
      state: 'KNOWN_FAIL_CONTRACT_EXAM_LINEAGE',
      reason: 'Contract-derived exam lacks typed boundary, refusal decision, or structural strategy lineage.',
      receiptId: receipt.receiptId,
      evaluatorId
    };
  }
  return { eligible: true, state: 'ADMITTED_EPISODIC_TRAINING', reason: null, receiptId: receipt.receiptId, evaluatorId };
}

module.exports = { ORGAN_ID, SCHEMA, PREVIOUS_ORGAN_ID, PREVIOUS_SCHEMA, V3_ORGAN_ID, V3_SCHEMA, LEGACY_ORGAN_ID, LEGACY_SCHEMA, STANDING_POLICY_ID, STANDING_POLICY_STATEMENT, create, verify, store, loadDirectory, trainingEligibility, deriveStrategyTags, safePrototype, semanticEvaluation, semanticDigest, digest };
