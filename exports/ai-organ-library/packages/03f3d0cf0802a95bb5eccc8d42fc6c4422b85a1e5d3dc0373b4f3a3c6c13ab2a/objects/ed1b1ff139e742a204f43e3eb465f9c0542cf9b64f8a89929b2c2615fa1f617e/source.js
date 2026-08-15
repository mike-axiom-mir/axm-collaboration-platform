'use strict';

const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Foundation = require('../kernel/reasoning-foundation');
const Experience = require('./reasoning-experience-organ');

const ORGAN_ID = 'axm.mirror.organ/reasoning-counterexample-lab-v2';
const SCHEMA = 'axm.mirror.reasoning-counterexample-practice-batch/v2';
const SUPERSEDED_ORGAN_ID = 'axm.mirror.organ/reasoning-counterexample-lab-v1';

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

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function withoutDigest(value) {
  const copy = clone(value);
  delete copy.batchDigest;
  return copy;
}

function receiptKind(receipt) {
  return receipt.source && receipt.source.experienceKind || 'REAL_LOCAL_LESSON';
}

function selectedCandidate(session) {
  const selectedActionId = session.principleTrace && session.principleTrace.decision && session.principleTrace.decision.selectedActionId;
  return (session.principleTrace && session.principleTrace.candidates || []).find(item => item.action && item.action.id === selectedActionId) || null;
}

function reconstructRequest(receipt) {
  const session = receipt.reasoningSession;
  const problem = session.problemState || {};
  const trace = session.principleTrace || {};
  const evidence = clone(trace.epistemic && trace.epistemic.evidence ||
    [].concat(problem.observations || [], problem.assertions || [], problem.derived || [], problem.predictions || []));
  const actions = (trace.candidates || []).map(item => clone(item.action));
  return {
    goal: clone(problem.goal || trace.goal),
    evidence,
    unknowns: clone(problem.unknowns || []),
    assumptions: clone(problem.assumptions || []),
    permissions: clone(problem.permissions || trace.permissions || []),
    constraints: clone(problem.constraints || trace.constraints || []),
    actions,
    pathProfiles: clone(session.pathSet && session.pathSet.profiles || [])
  };
}

function onlyFailedRoots(candidate, allowed) {
  const failed = (candidate && candidate.checks || []).filter(item => Number(item.result) !== 1).map(item => item.root);
  return failed.length > 0 && failed.every(root => allowed.includes(root));
}

function interventionsFor(receipt) {
  Experience.verify(receipt);
  if (receiptKind(receipt) !== 'REAL_LOCAL_LESSON' || receipt.trainingExample.outcome !== 'WORKED') return [];
  const session = receipt.reasoningSession;
  const candidate = selectedCandidate(session);
  if (!candidate) return [];
  const selected = candidate.action;
  const decisionValue = Number(session.principleTrace.decision.value);
  const interventions = [];

  if (decisionValue === 1) {
    const requiredPermissions = Array.from(new Set(selected.requiredPermissions || []));
    if (requiredPermissions.length && requiredPermissions.every(permission => (session.problemState.permissions || []).includes(permission))) {
      interventions.push({
        id: 'remove-declared-permission',
        description: 'Remove the permission explicitly required by the selected action.',
        expectedValue: -1,
        expectedActionId: selected.id,
        transform(request) {
          request.permissions = request.permissions.filter(permission => !requiredPermissions.includes(permission));
          return request;
        }
      });
    }
    const requiredEvidence = Array.from(new Set([].concat(selected.preconditionEvidence || [],
      (session.problemState.constraints || []).filter(item => item.type === 'require-evidence' && (!item.actionIds.length || item.actionIds.includes(selected.id))).flatMap(item => item.evidenceIds || []))));
    const present = new Set([].concat(session.problemState.observations || [], session.problemState.assertions || [], session.problemState.derived || [], session.problemState.predictions || []).map(item => item.id));
    const removable = requiredEvidence.filter(id => present.has(id));
    if (removable.length) {
      interventions.push({
        id: 'withhold-required-evidence',
        description: 'Withhold one required evidence item and expose it as a blocking unknown.',
        expectedValue: 0,
        expectedActionId: selected.id,
        transform(request) {
          const withheld = removable[0];
          request.evidence = request.evidence.filter(item => item.id !== withheld);
          request.unknowns.push({ id: `counterexample-missing-${withheld}`, question: `Is required evidence ${withheld} present?`, blocking: true });
          if (!(selected.preconditionEvidence || []).includes(withheld)) {
            request.constraints.push({ id: `counterexample-require-${withheld}`, type: 'require-evidence', statement: `Counterexample requires ${withheld}.`, actionIds: [selected.id], evidenceIds: [withheld] });
          }
          return request;
        }
      });
    }
    if (!['ask', 'observe', 'hold'].includes(selected.kind) && selected.reversible === true && selected.recovery) {
      interventions.push({
        id: 'remove-recovery-path',
        description: 'Remove the recovery path from an otherwise passing mutating proposal.',
        expectedValue: 0,
        expectedActionId: selected.id,
        transform(request) {
          const action = request.actions.find(item => item.id === selected.id);
          action.reversible = false;
          action.recovery = '';
          const profile = request.pathProfiles.find(item => item.actionId === selected.id);
          if (profile) profile.reversible = false;
          return request;
        }
      });
    }
  }

  if (decisionValue === -1 && onlyFailedRoots(candidate, ['agency-non-domination'])) {
    const requiredPermissions = Array.from(new Set(selected.requiredPermissions || []));
    if (requiredPermissions.length) interventions.push({
      id: 'supply-declared-permission',
      description: 'Supply exactly the permission declared by the refused action and change nothing else.',
      expectedValue: 1,
      expectedActionId: selected.id,
      transform(request) {
        request.permissions = Array.from(new Set(request.permissions.concat(requiredPermissions))).sort();
        return request;
      }
    });
  }

  if (decisionValue === 0 && onlyFailedRoots(candidate, ['repairability'])) {
    interventions.push({
      id: 'supply-bounded-recovery',
      description: 'Add an explicit reversible recovery path to the held proposal.',
      expectedValue: 1,
      expectedActionId: selected.id,
      transform(request) {
        const action = request.actions.find(item => item.id === selected.id);
        action.reversible = true;
        action.recovery = 'Restore the exact pre-intervention checkpoint; no external action is executed in this practice case.';
        const profile = request.pathProfiles.find(item => item.actionId === selected.id);
        if (profile) profile.reversible = true;
        return request;
      }
    });
  }

  if (decisionValue === 0 && onlyFailedRoots(candidate, ['truth-before-story', 'source-integrity'])) {
    const missing = (candidate.checks || []).filter(item => Number(item.result) === 0).flatMap(item => {
      const match = String(item.detail || '').match(/(?:Required evidence missing|Supporting references not found): (.+)$/);
      return match ? match[1].split(',').map(value => value.trim()) : [];
    }).filter(Boolean);
    if (missing.length) interventions.push({
      id: 'supply-required-evidence',
      description: 'Supply the specifically missing evidence and close its blocking unknown.',
      expectedValue: 1,
      expectedActionId: selected.id,
      transform(request) {
        for (const id of Array.from(new Set(missing))) request.evidence.push({
          id,
          kind: 'test',
          status: 'tested',
          statement: `Counterexample laboratory supplies verified evidence ${id}.`,
          source: { kind: 'reasoning-counterexample-lab', id: `supply-${id}` },
          confidence: { low: 1, high: 1, basis: 'Deterministic private counterexample intervention.' }
        });
        request.unknowns = request.unknowns.filter(item => !item.blocking);
        return request;
      }
    });
  }

  if (decisionValue === 0 && onlyFailedRoots(candidate, ['no-silent-rewrite'])) {
    const support = (selected.supportingEvidence || []).find(id => !(session.problemState.contradictions || []).some(pair => pair.includes(id)));
    const actionId = `${selected.id}-discriminate-counterexample`;
    interventions.push({
      id: 'choose-non-mutating-discrimination',
      description: 'Preserve the contradiction and replace promotion with a non-mutating discrimination check.',
      expectedValue: 1,
      expectedActionId: actionId,
      transform(request) {
        request.actions = [{
          id: actionId,
          kind: 'observe',
          label: 'Run a bounded check that can discriminate the preserved conflicting records',
          requiredPermissions: [],
          supportingEvidence: support ? [support] : [],
          preconditionEvidence: [],
          expectedEffects: ['A reviewable discrimination receipt is proposed.'],
          possibleSideEffects: [],
          reversible: true,
          recovery: 'No world mutation occurs.',
          risk: 'low'
        }];
        request.pathProfiles = [{
          actionId,
          approach: 'Preserve both conflicting records and request a bounded discriminating observation.',
          estimatedCost: 'LOW',
          informationValue: 0.9,
          reversible: true,
          strategyTags: ['discriminate-conflict']
        }];
        return request;
      }
    });
  }

  return interventions.slice(0, 3);
}

function evaluatorBasis(parent, intervention) {
  return {
    schema: 'axm.mirror.reasoning-counterexample-evaluator/v2',
    organId: ORGAN_ID,
    parentReceiptId: parent.receiptId,
    parentReceiptDigest: parent.receiptDigest,
    intervention: {
      id: intervention.id,
      description: intervention.description,
      expectedDecision: { value: intervention.expectedValue, actionId: intervention.expectedActionId }
    },
    authority: { learnedWeights: false, toolUse: false, worldAction: false, semanticTruthWrite: false }
  };
}

function execute(parent, intervention, policy, options = {}) {
  const basis = evaluatorBasis(parent, intervention);
  const basisDigest = digest(basis);
  const request = intervention.transform(reconstructRequest(parent));
  request.sessionId = `counterexample-${basisDigest.slice(0, 20)}`;
  request.actor = { id: 'axm.machine.mirror/seed-0', kind: 'private-counterexample-practice' };
  request.budget = { maxCandidates: 8, deadlineMs: 1000 };
  const reasoningSession = Foundation.run(request, { at: null });
  const observed = reasoningSession.principleTrace.decision;
  const behaviorMatched = Number(observed.value) === intervention.expectedValue && observed.selectedActionId === intervention.expectedActionId;
  const receipt = Experience.create(reasoningSession, {
    provider: 'axm-workshop-local',
    sourceGroup: `workshop-counterexample/${parent.receiptId}/${intervention.id}/v2`,
    experienceKind: 'SYNTHETIC_COUNTEREXAMPLE',
    parentReceiptIds: [parent.receiptId],
    interventionId: intervention.id,
    role: 'training',
    policyId: Experience.STANDING_POLICY_ID,
    usePermission: 'allowed',
    permissionBasis: policy,
    evaluator: {
      id: `${ORGAN_ID}/evaluator`,
      kind: 'deterministic-counterexample-evaluator',
      independent: true,
      sourceRef: `counterexample://${parent.receiptId}/${intervention.id}/${basisDigest}`,
      sourceDigest: basisDigest
    }
  }, {
    observedDecisionValue: observed.value,
    observedActionId: observed.selectedActionId,
    expectedDecisionValue: intervention.expectedValue,
    expectedActionId: intervention.expectedActionId,
    behaviorMatched,
    outcomeVerified: true,
    statement: behaviorMatched
      ? `The deterministic foundation satisfied counterexample intervention ${intervention.id}.`
      : `The deterministic foundation violated counterexample intervention ${intervention.id}; preserve negative evidence.`,
    worldMutations: 0,
    runtimePointerChanged: false,
    unexpectedSeams: behaviorMatched ? [] : [`counterexample-mismatch:${intervention.id}`]
  }, { at: null });
  const stored = Experience.store(receipt, options);
  return {
    interventionId: intervention.id,
    parentReceiptId: parent.receiptId,
    expectedDecision: { value: intervention.expectedValue, actionId: intervention.expectedActionId },
    observedDecision: { value: observed.value, actionId: observed.selectedActionId },
    behaviorMatched,
    receiptId: stored.receipt.receiptId,
    receiptDigest: stored.receipt.receiptDigest,
    outcome: stored.receipt.trainingExample.outcome,
    storageState: stored.state,
    semanticConsolidation: false
  };
}

function verifyBatch(batch) {
  if (!batch || batch.schema !== SCHEMA || !batch.batchId || !batch.inputsDigest || !batch.batchDigest) throw new Error('invalid reasoning counterexample batch');
  if (batch.batchDigest !== digest(withoutDigest(batch))) throw new Error('reasoning counterexample batch digest mismatch');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false) throw new Error('reasoning counterexample organ lineage mismatch');
  if (!batch.authority || Object.values(batch.authority).some(Boolean)) throw new Error('reasoning counterexample batch gained authority');
  if (!Array.isArray(batch.results) || batch.results.some(item => item.semanticConsolidation !== false)) throw new Error('reasoning counterexample batch escaped episodic evidence');
  return true;
}

function run(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const receiptDirectory = path.resolve(options.directory || path.join(root, 'training', 'datasets', 'reasoning-receipts'));
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'reasoning-counterexample-runs'));
  const loaded = Experience.loadDirectory(receiptDirectory);
  const priorEvidenceReviews = loaded.map(item => Experience.trainingEligibility(item.receipt)).filter(item => !item.eligible);
  const parents = loaded.filter(item => receiptKind(item.receipt) === 'REAL_LOCAL_LESSON' && item.receipt.trainingExample.outcome === 'WORKED').slice(0, 16);
  const plans = parents.flatMap(item => interventionsFor(item.receipt).map(intervention => ({ parent: item.receipt, intervention }))).slice(0, 32);
  const inputsDigest = digest({
    organ: ORGAN_ID,
    parents: parents.map(item => ({ receiptId: item.receipt.receiptId, receiptDigest: item.receipt.receiptDigest })),
    plans: plans.map(item => evaluatorBasis(item.parent, item.intervention)),
    priorEvidenceReviews
  });
  const batchId = `reasoning-counterexamples-${inputsDigest.slice(0, 20)}`;
  const runDir = path.join(stateDir, batchId);
  const file = path.join(runDir, 'batch.json');
  if (fs.existsSync(file)) {
    const batch = JSON.parse(fs.readFileSync(file, 'utf8'));
    verifyBatch(batch);
    if (batch.inputsDigest !== inputsDigest) throw new Error('reasoning counterexample run collision');
    const byId = new Map(loaded.map(item => [item.receipt.receiptId, item.receipt]));
    for (const result of batch.results) {
      const receipt = byId.get(result.receiptId);
      if (!receipt || receipt.receiptDigest !== result.receiptDigest) throw new Error(`reasoning counterexample batch receipt is missing or changed: ${result.receiptId}`);
      if (!Experience.trainingEligibility(receipt).eligible) throw new Error(`reasoning counterexample batch receipt is no longer training-eligible: ${result.receiptId}`);
    }
    return { batch, runDir, reused: true };
  }
  const policy = String(options.permissionBasis || Experience.STANDING_POLICY_STATEMENT);
  const results = plans.map(item => execute(item.parent, item.intervention, policy, { root, directory: receiptDirectory }));
  const batch = {
    schema: SCHEMA,
    batchId,
    batchDigest: null,
    inputsDigest,
    createdAt: null,
    organ: { id: ORGAN_ID, status: 'TEST_PRIVATE_COUNTEREXAMPLE_LAB', learnedWeights: false },
    sourceReceipts: parents.map(item => ({
      receiptId: item.receipt.receiptId,
      receiptDigest: item.receipt.receiptDigest,
      experienceKind: receiptKind(item.receipt)
    })),
    supersedes: {
      organId: SUPERSEDED_ORGAN_ID,
      receiptEvaluatorId: `${SUPERSEDED_ORGAN_ID}/evaluator`,
      state: 'KNOWN_FAIL_SUPERSEDED',
      reason: 'Version 1 did not keep action and path-profile reversibility synchronized for every intervention.'
    },
    priorEvidenceReviews,
    results,
    summary: {
      sourceReceiptCount: parents.length,
      interventions: results.length,
      worked: results.filter(item => item.outcome === 'WORKED').length,
      didNotWork: results.filter(item => item.outcome === 'DID_NOT_WORK').length,
      appended: results.filter(item => item.storageState === 'APPENDED_PRIVATE_TRAINING_RECEIPT').length,
      reused: results.filter(item => item.storageState !== 'APPENDED_PRIVATE_TRAINING_RECEIPT').length,
      knownFailReceiptsExcluded: priorEvidenceReviews.length
    },
    authority: {
      toolUse: false,
      worldAction: false,
      networkUse: false,
      permissionGrant: false,
      semanticTruthWrite: false,
      heldOutMutation: false,
      activeModelChange: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'Counterexamples are synthetic episodic practice derived from real verified local receipts. They are not real-world outcomes, semantic truth, held-out evidence, or promotion authority.'
  };
  batch.batchDigest = digest(withoutDigest(batch));
  verifyBatch(batch);
  const stageDir = path.join(stateDir, `.stage-${batchId}-${process.pid}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'batch.json'), JSON.stringify(stable(batch), null, 2) + '\n', 'utf8');
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused };
}

module.exports = { ORGAN_ID, SCHEMA, SUPERSEDED_ORGAN_ID, reconstructRequest, interventionsFor, evaluatorBasis, execute, verifyBatch, run };
