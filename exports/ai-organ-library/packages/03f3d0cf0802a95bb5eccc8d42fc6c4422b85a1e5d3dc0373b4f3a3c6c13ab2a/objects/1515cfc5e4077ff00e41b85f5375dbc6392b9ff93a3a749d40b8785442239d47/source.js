'use strict';

const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Foundation = require('../kernel/reasoning-foundation');
const Seam = require('../kernel/seam-cell');
const Frontier = require('../kernel/frontier-cell');
const Experience = require('./reasoning-experience-organ');
const Counterexamples = require('./reasoning-counterexample-organ');

const ORGAN_ID = 'axm.mirror.organ/reasoning-metamorphic-lab-v2';
const SCHEMA = 'axm.mirror.reasoning-metamorphic-probe-batch/v2';
const SUPERSEDED_ORGAN_ID = 'axm.mirror.organ/reasoning-metamorphic-lab-v1';
const EVALUATOR_ID = `${ORGAN_ID}/evaluator`;
const MAX_PARENTS = 8;
const MAX_PROBES_PER_PARENT = 28;

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

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function withoutDigest(value) {
  const copy = clone(value);
  delete copy.batchDigest;
  return copy;
}

function receiptKind(receipt) {
  return receipt.source && receipt.source.experienceKind || 'REAL_LOCAL_LESSON';
}

function atomicProbeDefinitions(receipt) {
  Experience.verify(receipt);
  if (receiptKind(receipt) !== 'REAL_LOCAL_LESSON' || receipt.trainingExample.outcome !== 'WORKED') return [];
  const request = Counterexamples.reconstructRequest(receipt);
  const probes = [
    {
      id: 'reword-human-rendering',
      relation: 'DECISION_INVARIANT',
      description: 'Change human-facing goal, action, and approach wording while preserving every machine decision field.',
      mutatedPaths: ['goal.statement', 'actions[].label', 'pathProfiles[].approach'],
      transform(input) {
        if (input.goal && typeof input.goal === 'object') input.goal.statement = 'Metamorphic rendering with the same machine contract.';
        for (const action of input.actions) action.label = `Metamorphic rendering for ${action.id}.`;
        for (const profile of input.pathProfiles) profile.approach = `Metamorphic approach rendering for ${profile.actionId}.`;
        return input;
      }
    },
    {
      id: 'add-irrelevant-evidence',
      relation: 'DECISION_INVARIANT',
      description: 'Add attributed tested evidence that no action, constraint, contradiction, or outcome references.',
      mutatedPaths: ['evidence[]'],
      transform(input) {
        input.evidence.push({
          id: 'metamorphic-irrelevant-evidence',
          kind: 'test',
          status: 'tested',
          statement: 'Synthetic probe evidence deliberately outside every decision reference.',
          source: { kind: 'reasoning-metamorphic-lab', id: 'irrelevant-evidence' },
          confidence: { low: 1, high: 1, basis: 'Deterministic private invariance probe.' }
        });
        return input;
      }
    },
    {
      id: 'add-nonblocking-unknown',
      relation: 'DECISION_INVARIANT',
      description: 'Add an unrelated explicitly non-blocking unknown.',
      mutatedPaths: ['unknowns[]'],
      transform(input) {
        input.unknowns.push({
          id: 'metamorphic-nonblocking-unknown',
          question: 'Unrelated question that is explicitly non-blocking?',
          blocking: false
        });
        return input;
      }
    },
    {
      id: 'add-unrelated-permission',
      relation: 'DECISION_INVARIANT',
      description: 'Add a permission token that no candidate declares as required.',
      mutatedPaths: ['permissions[]'],
      transform(input) {
        input.permissions = Array.from(new Set(input.permissions.concat(['metamorphic:unrelated-permission']))).sort();
        return input;
      }
    }
  ];
  if (request.evidence.length > 1) probes.push({
    id: 'reverse-evidence-order',
    relation: 'DECISION_INVARIANT',
    description: 'Reverse evidence input order without changing evidence identity or content.',
    mutatedPaths: ['evidence[]:order'],
    transform(input) { input.evidence.reverse(); return input; }
  });
  if (request.actions.length > 1) probes.push({
    id: 'reverse-candidate-order',
    relation: 'DECISION_INVARIANT',
    description: 'Reverse candidate and matching path-profile input order without changing content.',
    mutatedPaths: ['actions[]:order', 'pathProfiles[]:order'],
    transform(input) {
      input.actions.reverse();
      input.pathProfiles.reverse();
      return input;
    }
  });
  if (request.constraints.length > 1) probes.push({
    id: 'reverse-constraint-order',
    relation: 'DECISION_INVARIANT',
    description: 'Reverse constraint input order without changing content.',
    mutatedPaths: ['constraints[]:order'],
    transform(input) { input.constraints.reverse(); return input; }
  });
  return probes;
}

function composeProbe(left, right) {
  const operatorIds = [left.id, right.id].sort();
  return {
    id: `compose--${operatorIds.join('--')}`,
    relation: 'DECISION_INVARIANT',
    description: `Compose two independently declared machine-irrelevant transforms: ${operatorIds.join(' then ')}.`,
    mutatedPaths: Array.from(new Set([].concat(left.mutatedPaths || [], right.mutatedPaths || []))).sort(),
    composition: { depth: 2, operatorIds, generated: true, learnedWeights: false },
    transform(input) {
      let next = input;
      for (const probe of [left, right].sort((a, b) => a.id.localeCompare(b.id))) next = probe.transform(next);
      return next;
    }
  };
}

function probeDefinitions(receipt) {
  const atomic = atomicProbeDefinitions(receipt).map(probe => Object.assign(probe, {
    composition: { depth: 1, operatorIds: [probe.id], generated: false, learnedWeights: false }
  }));
  const composed = [];
  for (let left = 0; left < atomic.length; left += 1) {
    for (let right = left + 1; right < atomic.length; right += 1) composed.push(composeProbe(atomic[left], atomic[right]));
  }
  return atomic.concat(composed).slice(0, MAX_PROBES_PER_PARENT);
}

function evaluatorBasis(parent, probe) {
  return {
    schema: 'axm.mirror.reasoning-metamorphic-evaluator/v2',
    organId: ORGAN_ID,
    parentReceiptId: parent.receiptId,
    parentReceiptDigest: parent.receiptDigest,
    probe: {
      id: probe.id,
      relation: probe.relation,
      description: probe.description,
      mutatedPaths: probe.mutatedPaths,
      composition: clone(probe.composition || { depth: 1, operatorIds: [probe.id], generated: false, learnedWeights: false }),
      expectedDecision: clone(parent.evaluation.observedDecision)
    },
    authority: {
      learnedWeights: false,
      toolUse: false,
      worldAction: false,
      semanticTruthWrite: false,
      trainingOnMatch: false
    }
  };
}

function authorityClosed(session) {
  return session && session.authority && session.authority.proposalOnly === true &&
    Object.entries(session.authority).every(([key, value]) => key === 'proposalOnly' ? value === true : value === false);
}

function verifyProbeSession(session) {
  if (!session || session.schema !== 'axm.mirror.reasoning-session/v1') throw new Error('metamorphic probe requires a reasoning session');
  if (!session.cell || session.cell.learnedWeights !== false || session.cell.status === 'PRIVATE_CHALLENGER') throw new Error('metamorphic probe refuses learned-model self-testing');
  if (!authorityClosed(session)) throw new Error('metamorphic probe session gained authority');
  const independent = Seam.inspectReasoningSession(session, { deliberate: true });
  if (independent.summary.open !== 0) throw new Error('metamorphic probe session failed independent authority or selection review');
  return true;
}

function execute(parent, probe, policy, options = {}) {
  Experience.verify(parent);
  if (receiptKind(parent) !== 'REAL_LOCAL_LESSON') throw new Error('metamorphic probes require a real local parent receipt');
  const basis = evaluatorBasis(parent, probe);
  const basisDigest = digest(basis);
  const request = probe.transform(Counterexamples.reconstructRequest(parent));
  request.sessionId = `metamorphic-${basisDigest.slice(0, 20)}`;
  request.actor = { id: 'axm.machine.mirror/seed-0', kind: 'private-metamorphic-practice' };
  request.budget = { maxCandidates: 8, deadlineMs: 1000 };
  const runFoundation = options.foundationRun || Foundation.run;
  const session = runFoundation(request, { at: null });
  verifyProbeSession(session);
  const expected = clone(parent.evaluation.observedDecision);
  const decision = session.principleTrace.decision;
  const observed = { value: Number(decision.value), actionId: decision.selectedActionId };
  const matched = observed.value === Number(expected.value) && observed.actionId === expected.actionId;
  let experience = null;
  if (!matched) {
    const receipt = Experience.create(session, {
      provider: 'axm-workshop-local',
      sourceGroup: `workshop-metamorphic/${parent.receiptId}/${probe.id}/v2`,
      experienceKind: 'SYNTHETIC_COUNTEREXAMPLE',
      parentReceiptIds: [parent.receiptId],
      interventionId: `metamorphic:${probe.id}`,
      role: 'training',
      policyId: Experience.STANDING_POLICY_ID,
      usePermission: 'allowed',
      permissionBasis: policy,
      evaluator: {
        id: EVALUATOR_ID,
        kind: 'deterministic-metamorphic-evaluator',
        independent: true,
        sourceRef: `metamorphic://${parent.receiptId}/${probe.id}/${basisDigest}`,
        sourceDigest: basisDigest
      }
    }, {
      observedDecisionValue: observed.value,
      observedActionId: observed.actionId,
      expectedDecisionValue: Number(expected.value),
      expectedActionId: expected.actionId,
      behaviorMatched: false,
      outcomeVerified: true,
      statement: `Decision invariance failed for metamorphic probe ${probe.id}; preserve negative evidence and require a repair exam.`,
      worldMutations: 0,
      runtimePointerChanged: false,
      unexpectedSeams: [`metamorphic-invariance-${probe.id}`]
    }, { at: null });
    experience = Experience.store(receipt, options);
  }
  return {
    session,
    result: {
      probeId: probe.id,
      relation: probe.relation,
      composition: clone(probe.composition || { depth: 1, operatorIds: [probe.id], generated: false, learnedWeights: false }),
      parentReceiptId: parent.receiptId,
      parentReceiptDigest: parent.receiptDigest,
      parentSourceGroup: parent.source.sourceGroup,
      expectedDecision: expected,
      observedDecision: observed,
      state: matched ? 'INVARIANT_CONFIRMED' : 'COUNTEREXAMPLE_FOUND',
      behaviorMatched: matched,
      reasoningSessionId: session.reasoningSessionId,
      principleTraceId: session.principleTrace.traceId,
      sessionDigest: digest(session),
      sessionFile: null,
      sessionSha256: null,
      negativeExperienceReceiptId: experience ? experience.receipt.receiptId : null,
      negativeExperienceReceiptDigest: experience ? experience.receipt.receiptDigest : null,
      experienceStorageState: experience ? experience.state : 'EVALUATION_ONLY_NO_TRAINING_RECEIPT',
      semanticConsolidation: false
    }
  };
}

function frontierFor(results) {
  const mismatches = results.filter(item => !item.behaviorMatched);
  if (!mismatches.length) return {
    state: 'NO_UNEXPECTED_SEAM',
    assessment: null,
    repairOperatorCandidates: []
  };
  const assessment = Frontier.inspect({
    subject: {
      id: 'reasoning-metamorphic-invariance',
      statement: 'Evaluate repeated decision changes under transformations declared semantically irrelevant.',
      domain: 'reasoning-foundation'
    },
    observations: mismatches.map(item => ({
      id: item.reasoningSessionId,
      domain: String(item.parentSourceGroup).split('/')[1] || 'local-reasoning',
      statement: `Probe ${item.probeId} changed ${item.expectedDecision.value}/${item.expectedDecision.actionId} to ${item.observedDecision.value}/${item.observedDecision.actionId}.`,
      perspective: 'MACHINE_NATIVE',
      patternTags: [`metamorphic-invariance-${item.probeId}`],
      evidenceRef: item.sessionSha256
    })),
    unexpectedSeams: mismatches.map(item => ({
      id: `metamorphic-invariance-${item.probeId}`,
      statement: `Decision invariance failed for ${item.probeId}.`,
      severity: 'high',
      evidenceRefs: [item.sessionSha256]
    }))
  });
  const byProbe = new Map();
  for (const item of mismatches) {
    if (!byProbe.has(item.probeId)) byProbe.set(item.probeId, []);
    byProbe.get(item.probeId).push(item);
  }
  const repairOperatorCandidates = Array.from(byProbe.entries()).map(([probeId, rows]) => ({
    probeId,
    sourceGroups: Array.from(new Set(rows.map(item => item.parentSourceGroup))).sort(),
    failureSessionIds: rows.map(item => item.reasoningSessionId).sort()
  })).filter(item => item.sourceGroups.length >= 2).map(item => ({
    id: `metamorphic-repair-${digest(item).slice(0, 20)}`,
    state: 'FRONTIER_EXAM_REQUIRED',
    organAdmissionState: 'NOT_SUBMITTED_EVIDENCE_ONLY',
    probeId: item.probeId,
    sourceGroups: item.sourceGroups,
    failureSessionIds: item.failureSessionIds,
    proposedContract: {
      implementationKind: 'HARD_CODED_DETERMINISTIC',
      purpose: `Repair repeated decision non-invariance under ${item.probeId}.`,
      inputSchema: 'axm.mirror.reasoning-session/v1',
      outputSchema: 'axm.mirror.reasoning-metamorphic-repair-receipt/v1',
      requiredTests: ['frozen-held-out', 'counterpattern', 'earlier-capability-regression', 'authority-canaries', 'rollback-dry-run', 'independent-evaluator']
    },
    authority: { writeCode: false, install: false, promote: false, toolUse: false, humanReviewRequired: true }
  }));
  return { state: repairOperatorCandidates.length ? 'REPEATED_GAP_FRONTIER_EXAM_REQUIRED' : 'SINGLE_GAP_MORE_EVIDENCE_REQUIRED', assessment, repairOperatorCandidates };
}

function verifyBatch(batch, runDir) {
  if (!batch || batch.schema !== SCHEMA || !batch.batchId || !batch.inputsDigest || !batch.batchDigest) throw new Error('invalid reasoning metamorphic batch');
  if (batch.batchDigest !== digest(withoutDigest(batch))) throw new Error('reasoning metamorphic batch digest mismatch');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false) throw new Error('reasoning metamorphic organ lineage mismatch');
  if (!batch.authority || Object.values(batch.authority).some(Boolean)) throw new Error('reasoning metamorphic batch gained authority');
  if (!Array.isArray(batch.results) || batch.results.some(item => item.semanticConsolidation !== false)) throw new Error('reasoning metamorphic batch escaped evaluation evidence');
  if (runDir) {
    for (const result of batch.results) {
      const file = path.resolve(runDir, result.sessionFile || '');
      const relative = path.relative(path.resolve(runDir), file);
      if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || !fs.existsSync(file)) throw new Error(`metamorphic probe session is missing: ${result.reasoningSessionId}`);
      const bytes = fs.readFileSync(file);
      if (shaBytes(bytes) !== result.sessionSha256) throw new Error(`metamorphic probe session hash mismatch: ${result.reasoningSessionId}`);
      const session = JSON.parse(bytes.toString('utf8'));
      if (digest(session) !== result.sessionDigest || session.reasoningSessionId !== result.reasoningSessionId) throw new Error(`metamorphic probe session lineage mismatch: ${result.reasoningSessionId}`);
      verifyProbeSession(session);
    }
  }
  return true;
}

function run(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const receiptDirectory = path.resolve(options.directory || path.join(root, 'training', 'datasets', 'reasoning-receipts'));
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'reasoning-metamorphic-runs'));
  const loaded = Experience.loadDirectory(receiptDirectory);
  const parents = loaded.filter(item => receiptKind(item.receipt) === 'REAL_LOCAL_LESSON' && item.receipt.trainingExample.outcome === 'WORKED' && Experience.trainingEligibility(item.receipt).eligible).slice(0, MAX_PARENTS);
  const plans = parents.flatMap(item => probeDefinitions(item.receipt).map(probe => ({ parent: item.receipt, probe }))).slice(0, MAX_PARENTS * MAX_PROBES_PER_PARENT);
  const inputsDigest = digest({
    organ: ORGAN_ID,
    parents: parents.map(item => ({ receiptId: item.receipt.receiptId, receiptDigest: item.receipt.receiptDigest })),
    probes: plans.map(item => evaluatorBasis(item.parent, item.probe))
  });
  const batchId = `reasoning-metamorphic-${inputsDigest.slice(0, 20)}`;
  const runDir = path.join(stateDir, batchId);
  const batchFile = path.join(runDir, 'batch.json');
  if (fs.existsSync(batchFile)) {
    const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    verifyBatch(batch, runDir);
    if (batch.inputsDigest !== inputsDigest) throw new Error('reasoning metamorphic run collision');
    const byId = new Map(loaded.map(item => [item.receipt.receiptId, item.receipt]));
    for (const result of batch.results.filter(item => item.negativeExperienceReceiptId)) {
      const receipt = byId.get(result.negativeExperienceReceiptId);
      if (!receipt || receipt.receiptDigest !== result.negativeExperienceReceiptDigest) throw new Error(`metamorphic negative receipt is missing or changed: ${result.negativeExperienceReceiptId}`);
      if (!Experience.trainingEligibility(receipt).eligible) throw new Error(`metamorphic negative receipt is no longer training-eligible: ${result.negativeExperienceReceiptId}`);
    }
    return { batch, runDir, reused: true };
  }
  const policy = String(options.permissionBasis || Experience.STANDING_POLICY_STATEMENT);
  fs.mkdirSync(stateDir, { recursive: true });
  const stageDir = path.join(stateDir, `.stage-${batchId}-${process.pid}`);
  fs.mkdirSync(path.join(stageDir, 'probes'), { recursive: true });
  const results = [];
  for (const item of plans) {
    const execution = execute(item.parent, item.probe, policy, { root, directory: receiptDirectory, foundationRun: options.foundationRun });
    const probeFileName = `probe-${digest({ parent: item.parent.receiptId, probe: item.probe.id }).slice(0, 20)}.json`;
    const relativeFile = path.join('probes', probeFileName).replace(/\\/g, '/');
    const bytes = Buffer.from(JSON.stringify(stable(execution.session), null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(stageDir, relativeFile), bytes, { flag: 'wx' });
    execution.result.sessionFile = relativeFile;
    execution.result.sessionSha256 = shaBytes(bytes);
    results.push(execution.result);
  }
  const frontier = frontierFor(results);
  const batch = {
    schema: SCHEMA,
    batchId,
    batchDigest: null,
    inputsDigest,
    createdAt: null,
    organ: { id: ORGAN_ID, status: 'TEST_PRIVATE_COMPOSITIONAL_METAMORPHIC_LAB', learnedWeights: false },
    supersedes: {
      organId: SUPERSEDED_ORGAN_ID,
      state: 'SUPERSEDED_ATOMIC_ONLY_VALID_EVIDENCE_PRESERVED',
      reason: 'Version 1 evaluated atomic invariants only. Version 2 adds bounded generated pairwise compositions without invalidating v1 results.'
    },
    sourceReceipts: parents.map(item => ({ receiptId: item.receipt.receiptId, receiptDigest: item.receipt.receiptDigest, experienceKind: receiptKind(item.receipt) })),
    results,
    frontier,
    summary: {
      sourceReceiptCount: parents.length,
      probes: results.length,
      atomicProbes: results.filter(item => item.composition.depth === 1).length,
      composedProbes: results.filter(item => item.composition.depth === 2).length,
      maximumCompositionDepth: 2,
      invariantConfirmed: results.filter(item => item.behaviorMatched).length,
      counterexamplesFound: results.filter(item => !item.behaviorMatched).length,
      negativeReceiptsAppended: results.filter(item => item.experienceStorageState === 'APPENDED_PRIVATE_TRAINING_RECEIPT').length,
      negativeReceiptsReused: results.filter(item => item.negativeExperienceReceiptId && item.experienceStorageState !== 'APPENDED_PRIVATE_TRAINING_RECEIPT').length,
      positiveTrainingReceiptsCreated: 0,
      repairOperatorCandidates: frontier.repairOperatorCandidates.length
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
      identityChange: false,
      trainingOnMatchedProbe: false
    },
    boundary: 'Atomic and automatically composed metamorphic matches remain evaluation-only traces. Only an independently detected mismatch may append negative episodic evidence and open a Frontier exam; no probe can recursively compose beyond depth two, promote itself, or become real-world truth.'
  };
  batch.batchDigest = digest(withoutDigest(batch));
  verifyBatch(batch, stageDir);
  fs.writeFileSync(path.join(stageDir, 'batch.json'), JSON.stringify(stable(batch), null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused };
}

module.exports = { ORGAN_ID, SCHEMA, SUPERSEDED_ORGAN_ID, EVALUATOR_ID, MAX_PARENTS, MAX_PROBES_PER_PARENT, atomicProbeDefinitions, composeProbe, probeDefinitions, evaluatorBasis, execute, frontierFor, verifyProbeSession, verifyBatch, run, digest };
