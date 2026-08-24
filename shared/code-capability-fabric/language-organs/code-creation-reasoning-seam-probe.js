'use strict';

const crypto = require('crypto');

const ENGINE_CLASSES = new Set(['DETERMINISTIC', 'NEURAL', 'HYBRID']);
const MECHANISM_CLASSES = new Set([
  'DETERMINISTIC_RULE',
  'NEURAL_DECISION_SUMMARY',
  'HYBRID_HANDOFF',
  'EXTERNAL_OBSERVATION'
]);
const FRESHNESS_CLASSES = new Set(['CURRENT', 'STALE', 'UNKNOWN']);
const POLARITIES = new Set(['SUPPORTS', 'CONTRADICTS', 'NEUTRAL', 'UNKNOWN']);
const COMMITMENT_CLASSES = new Set(['NONE', 'LOW', 'MEDIUM', 'HIGH']);
const FORBIDDEN_EFFECTS = new Set([
  'TOOL_EXECUTION',
  'SOURCE_WORKSPACE_MUTATION',
  'NETWORK',
  'INSTALL',
  'DEPLOYMENT',
  'ADMISSION',
  'SELECTION',
  'PROMOTION',
  'MERGE',
  'CANON'
]);
const RAW_INNER_REASONING_FIELDS = new Set([
  'chainOfThought',
  'rawChainOfThought',
  'hiddenChainOfThought',
  'internalActivations',
  'hiddenState',
  'logits',
  'rawPrompt',
  'rawResponse',
  'rawSource'
]);
const AUTHORITY = Object.freeze({
  sourceWorkspaceRead: false,
  sourceWorkspaceMutation: false,
  reasoningControl: false,
  toolExecution: false,
  network: false,
  install: false,
  admission: false,
  selection: false,
  deployment: false,
  promotion: false,
  merge: false,
  canon: false
});

function canon(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canon(value[key])}`).join(',')}}`;
}

function hash(value) {
  return crypto.createHash('sha256').update(canon(value)).digest('hex');
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function digestCurrent(record, digestField) {
  if (!record || !record[digestField]) return false;
  const core = { ...record };
  const expected = core[digestField];
  delete core[digestField];
  return hash(core) === expected;
}

function clean(value, fallback = '') {
  const normalized = String(value == null ? '' : value).trim();
  return normalized || fallback;
}

function cleanId(value, fallback = '') {
  const normalized = clean(value, fallback).replace(/[^a-zA-Z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function strings(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => clean(item)).filter(Boolean))];
}

function containsRawInnerReasoning(value, path = '$') {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = containsRawInnerReasoning(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  for (const [key, child] of Object.entries(value)) {
    if (RAW_INNER_REASONING_FIELDS.has(key)) return `${path}.${key}`;
    const found = containsRawInnerReasoning(child, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

function normalizeEvidence(item = {}) {
  const freshness = String(item.freshness || 'UNKNOWN').toUpperCase();
  const polarity = String(item.polarity || 'UNKNOWN').toUpperCase();
  return {
    evidenceDigest: clean(item.evidenceDigest),
    rootEvidenceDigest: clean(item.rootEvidenceDigest || item.evidenceDigest),
    sourceClass: clean(item.sourceClass, 'UNKNOWN').toUpperCase(),
    claimKey: clean(item.claimKey) || null,
    polarity: POLARITIES.has(polarity) ? polarity : 'UNKNOWN',
    freshness: FRESHNESS_CLASSES.has(freshness) ? freshness : 'UNKNOWN',
    claimedIndependent: item.claimedIndependent === true
  };
}

function normalizeRule(rule = {}) {
  return {
    ref: clean(rule.ref) || null,
    conditionDigest: clean(rule.conditionDigest) || null,
    selectedBranch: clean(rule.selectedBranch) || null,
    reasonCodes: strings(rule.reasonCodes).sort()
  };
}

function normalizeBoundary(boundary) {
  if (!boundary) return null;
  return {
    metric: clean(boundary.metric) || null,
    comparator: clean(boundary.comparator) || null,
    threshold: Number.isFinite(boundary.threshold) ? boundary.threshold : null,
    observedValue: Number.isFinite(boundary.observedValue) ? boundary.observedValue : null,
    neighborEvidenceDigests: strings(boundary.neighborEvidenceDigests).sort()
  };
}

function normalizeCost(cost = {}) {
  return {
    workUnits: Number.isFinite(cost.workUnits) && cost.workUnits >= 0 ? cost.workUnits : null,
    latencyMs: Number.isFinite(cost.latencyMs) && cost.latencyMs >= 0 ? cost.latencyMs : null,
    externalCalls: Number.isSafeInteger(cost.externalCalls) && cost.externalCalls >= 0 ? cost.externalCalls : null
  };
}

function normalizeStep(step, index) {
  const mechanismClass = String(step.mechanismClass || '').toUpperCase();
  const commitmentClass = String(step.commitmentClass || 'NONE').toUpperCase();
  const rule = normalizeRule(step.rule);
  const decisionSummary = clean(step.decisionSummary) || null;
  let rationaleStatus = 'WHY_RECEIPT_PRESENT';
  if (mechanismClass === 'DETERMINISTIC_RULE' && (!rule.ref || !rule.conditionDigest || !rule.selectedBranch || !rule.reasonCodes.length)) {
    rationaleStatus = 'DETERMINISTIC_WHY_RECEIPT_INCOMPLETE';
  } else if (mechanismClass === 'NEURAL_DECISION_SUMMARY' && !decisionSummary) {
    rationaleStatus = 'NEURAL_DECISION_SUMMARY_MISSING';
  } else if (mechanismClass === 'HYBRID_HANDOFF' && !decisionSummary) {
    rationaleStatus = 'HYBRID_HANDOFF_SUMMARY_MISSING';
  }
  return {
    stepId: cleanId(step.stepId, `step-${String(index + 1).padStart(3, '0')}`),
    sequence: Number.isSafeInteger(step.sequence) ? step.sequence : index + 1,
    stage: clean(step.stage, 'UNDECLARED_STAGE').toUpperCase(),
    operationKey: clean(step.operationKey, 'UNDECLARED_OPERATION'),
    mechanismClass: MECHANISM_CLASSES.has(mechanismClass) ? mechanismClass : 'EXTERNAL_OBSERVATION',
    dependsOnStepIds: strings(step.dependsOnStepIds).sort(),
    inputDigests: strings(step.inputDigests).sort(),
    outputDigests: strings(step.outputDigests).sort(),
    evidence: (Array.isArray(step.evidence) ? step.evidence : []).map(normalizeEvidence).sort((a, b) => a.evidenceDigest.localeCompare(b.evidenceDigest)),
    rule,
    decisionSummary,
    alternatives: strings(step.alternatives).sort(),
    assumptions: strings(step.assumptions).sort(),
    uncertainties: strings(step.uncertainties).sort(),
    preservedUncertaintyRefs: strings(step.preservedUncertaintyRefs).sort(),
    counterevidenceSought: step.counterevidenceSought === true,
    boundary: normalizeBoundary(step.boundary),
    commitmentClass: COMMITMENT_CLASSES.has(commitmentClass) ? commitmentClass : 'NONE',
    declaredEffects: strings(step.declaredEffects).map(effect => effect.toUpperCase()).sort(),
    cost: normalizeCost(step.cost),
    rationaleStatus
  };
}

function createTrace(input = {}) {
  const rawPath = containsRawInnerReasoning(input);
  if (rawPath) {
    return deepFreeze({
      schema: 'axm.code.creation-reasoning-trace.v1',
      result: 'RAW_PRIVATE_INNER_REASONING_REFUSED',
      refusedPath: rawPath,
      acceptedInstead: ['typed rule receipts', 'decision summaries', 'alternatives', 'uncertainties', 'evidence links', 'input and output digests'],
      authority: 'NONE'
    });
  }
  const projectId = cleanId(input.projectId);
  const creationId = cleanId(input.creationId);
  const engineClass = String(input.engineClass || '').toUpperCase();
  if (!projectId || !creationId || !input.taskDigest || !input.directionSha256 || !input.traceEvidenceDigest || !ENGINE_CLASSES.has(engineClass)) {
    return deepFreeze({
      schema: 'axm.code.creation-reasoning-trace.v1',
      result: 'CREATION_TRACE_IDENTITY_OR_EVIDENCE_REQUIRED',
      allowedEngineClasses: [...ENGINE_CLASSES].sort(),
      authority: 'NONE'
    });
  }
  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    return deepFreeze({ schema: 'axm.code.creation-reasoning-trace.v1', result: 'CREATION_TRACE_STEPS_REQUIRED', authority: 'NONE' });
  }
  const invalidMechanisms = input.steps.map(step => String(step && step.mechanismClass || '').toUpperCase()).filter(mechanism => !MECHANISM_CLASSES.has(mechanism));
  if (invalidMechanisms.length) {
    return deepFreeze({
      schema: 'axm.code.creation-reasoning-trace.v1',
      result: 'CREATION_TRACE_MECHANISM_CLASS_INVALID',
      invalidMechanisms: [...new Set(invalidMechanisms)].sort(),
      allowedMechanismClasses: [...MECHANISM_CLASSES].sort(),
      authority: 'NONE'
    });
  }
  const steps = input.steps.map(normalizeStep).sort((a, b) => a.sequence - b.sequence || a.stepId.localeCompare(b.stepId));
  const stepIds = steps.map(step => step.stepId);
  const sequences = steps.map(step => step.sequence);
  if (new Set(stepIds).size !== stepIds.length || new Set(sequences).size !== sequences.length || sequences.some((sequence, index) => sequence !== index + 1)) {
    return deepFreeze({ schema: 'axm.code.creation-reasoning-trace.v1', result: 'CREATION_TRACE_STEP_ID_OR_SEQUENCE_INVALID', authority: 'NONE' });
  }
  const position = new Map(steps.map((step, index) => [step.stepId, index]));
  const dependencyProblems = [];
  for (const [index, step] of steps.entries()) {
    for (const dependency of step.dependsOnStepIds) {
      if (!position.has(dependency)) dependencyProblems.push({ stepId: step.stepId, dependency, code: 'DEPENDENCY_MISSING' });
      else if (position.get(dependency) >= index) dependencyProblems.push({ stepId: step.stepId, dependency, code: 'DEPENDENCY_NOT_PRIOR' });
    }
  }
  if (dependencyProblems.length) {
    return deepFreeze({
      schema: 'axm.code.creation-reasoning-trace.v1',
      result: 'CREATION_TRACE_DEPENDENCY_GRAPH_INVALID',
      dependencyProblems,
      authority: 'NONE'
    });
  }
  const gaps = steps.filter(step => step.rationaleStatus !== 'WHY_RECEIPT_PRESENT');
  const core = {
    schema: 'axm.code.creation-reasoning-trace.v1',
    version: '1.0.0',
    result: gaps.length ? 'CREATION_REASONING_TRACE_READY_WITH_WHY_GAPS' : 'CREATION_REASONING_TRACE_READY',
    projectId,
    creationId,
    taskDigest: String(input.taskDigest),
    directionSha256: String(input.directionSha256),
    batchSha256: input.batchSha256 == null ? null : String(input.batchSha256),
    draftId: input.draftId == null ? null : String(input.draftId),
    draftRevisionSha256: input.draftRevisionSha256 == null ? null : String(input.draftRevisionSha256),
    engineClass,
    traceEvidenceDigest: String(input.traceEvidenceDigest),
    steps,
    finalOutputDigests: strings(input.finalOutputDigests).sort(),
    whyGapStepIds: gaps.map(step => step.stepId),
    truth: {
      traceIsSuppliedObservationNotAutomaticInstrumentation: true,
      missingStepIsNotProofStepDidNotOccur: true,
      deterministicRuleReceiptIsNotIndependentRuntimeProof: true,
      neuralDecisionSummaryIsNotHiddenCausalAccess: true,
      recognizedRawPrivateInnerReasoningFieldsStored: false,
      decisionSummaryMustBeExternallyPreparedNotRawInnerTrace: true,
      analysisGrantsNoAuthority: true
    },
    authority: AUTHORITY
  };
  return deepFreeze({ ...core, traceSha256: hash(core) });
}

function validTrace(trace) {
  return !!trace &&
    trace.schema === 'axm.code.creation-reasoning-trace.v1' &&
    ['CREATION_REASONING_TRACE_READY', 'CREATION_REASONING_TRACE_READY_WITH_WHY_GAPS'].includes(trace.result) &&
    digestCurrent(trace, 'traceSha256');
}

function makeFinding(code, findingClass, stepIds, evidenceDigests, explanation, falsification, notClaim) {
  const normalizedSteps = strings(stepIds).sort();
  const normalizedEvidence = strings(evidenceDigests).sort();
  const identity = { code, stepIds: normalizedSteps, evidenceDigests: normalizedEvidence };
  return {
    findingId: `finding:${hash(identity).slice(0, 20)}`,
    code,
    class: findingClass,
    stepIds: normalizedSteps,
    evidenceDigests: normalizedEvidence,
    explanation,
    falsification,
    notClaim
  };
}

function evidenceDigestsForSteps(steps) {
  return strings(steps.flatMap(step => step.evidence.map(item => item.evidenceDigest))).sort();
}

function createSeamCandidate(code, findings) {
  const recipes = {
    ADD_TYPED_WHY_RECEIPT: {
      changeHypothesis: 'Add a typed rule receipt or decision summary at the observed transition.',
      invariant: 'Do not request or retain private chain-of-thought.',
      cheapestCountertest: 'Replay the same fixture and check whether the transition becomes evidence-addressable.',
      failureSignal: 'The added summary cannot be bound to the step inputs, output, rule or evidence.'
    },
    GROUP_SHARED_ROOT_AS_ONE_EVIDENCE_FAMILY: {
      changeHypothesis: 'Count several derived views from one root as one evidence family until an independent root is supplied.',
      invariant: 'Preserve every view and every contradiction; change only the independence claim.',
      cheapestCountertest: 'Add one genuinely independent root and compare whether the branch choice changes.',
      failureSignal: 'The supposedly independent observation resolves to the same root provenance.'
    },
    ROUTE_OR_TEST_UNUSED_SPECIALIST_OUTPUT: {
      changeHypothesis: 'Route the specialist output into an explicit consumer or test whether it can be omitted without changing the creation result.',
      invariant: 'Do not silently delete the specialist or its negative observations.',
      cheapestCountertest: 'Run a paired fixture with and without the observed specialist output while retaining identical downstream checks.',
      failureSignal: 'Removal changes a required output, catches a fault, or loses contradictory evidence.'
    },
    CACHE_OR_REUSE_EXACT_SUBPATH: {
      changeHypothesis: 'Reuse an exact digest-bound subpath when operation, inputs, rule and decision summary are identical.',
      invariant: 'Freshness, provenance, tool version and requested output identity must remain exact.',
      cheapestCountertest: 'Replay one duplicate subpath and compare output digests plus verification observations.',
      failureSignal: 'Any output, freshness, provenance or verifier observation diverges.'
    },
    EXPOSE_HIDDEN_INPUT_OR_NONDETERMINISM: {
      changeHypothesis: 'Expose the missing input, seed, state or runtime condition that explains divergent deterministic outputs.',
      invariant: 'Do not force outputs to match or discard either divergent observation.',
      cheapestCountertest: 'Replay both receipts with every declared input and environment digest held equal.',
      failureSignal: 'Outputs still diverge while every causally relevant input is demonstrably identical.'
    },
    PROBE_DETERMINISTIC_BOUNDARY_NEIGHBORS: {
      changeHypothesis: 'Test values immediately around the deterministic branch threshold before trusting the seam.',
      invariant: 'The production rule is not changed by the probe.',
      cheapestCountertest: 'Evaluate one fixture below, at and above the recorded threshold.',
      failureSignal: 'Neighbor behavior is discontinuous, unstable or contradicts the rule explanation.'
    },
    MOVE_DISCRIMINATOR_BEFORE_HIGH_COMMITMENT: {
      changeHypothesis: 'Move a cheap discriminating verification observation before a high-commitment creation step.',
      invariant: 'Preserve final verification depth and do not treat early evidence as correctness.',
      cheapestCountertest: 'Compare commitment exposure and final verification outcomes on the same fixture.',
      failureSignal: 'The early discriminator rejects useful paths or fails to predict the later observation.'
    },
    ADD_COUNTEREVIDENCE_SEARCH_BEFORE_COMMITMENT: {
      changeHypothesis: 'Ask for one falsifying observation before a high-commitment creation transition.',
      invariant: 'Counterevidence remains evidence, not automatic rejection authority.',
      cheapestCountertest: 'Supply a known counterexample fixture and observe whether the path exposes it before commitment.',
      failureSignal: 'The new check adds work without exposing a distinct failure family.'
    },
    PRESERVE_UNCERTAINTY_ACROSS_HANDOFF: {
      changeHypothesis: 'Carry typed uncertainty references across the neural/deterministic creation handoff.',
      invariant: 'Uncertainty is not converted into confidence, truth or a stop command.',
      cheapestCountertest: 'Replay a missing-evidence fixture and inspect whether the downstream rule can still see the uncertainty.',
      failureSignal: 'The handoff drops, rewrites or overstates the upstream uncertainty.'
    },
    KEEP_AUTHORITY_OUTSIDE_REASONING_PROBE: {
      changeHypothesis: 'Remove action effects from the observed reasoning step and route any real action through its existing authority gate.',
      invariant: 'The probe remains read-only and non-authoritative.',
      cheapestCountertest: 'Verify that probe output cannot mutate, execute, install, select, promote, merge or change CANON.',
      failureSignal: 'A probe result directly changes external state or an authority-bearing pointer.'
    }
  };
  const recipe = recipes[code];
  if (!recipe) return null;
  const sourceFindingIds = findings.map(finding => finding.findingId).sort();
  const core = {
    schema: 'axm.code.creation-reasoning-seam-candidate.v1',
    seamCode: code,
    sourceFindingIds,
    ...recipe,
    expectedObservation: 'A paired trial may reveal improvement, regression, no change or conflict; no outcome is predeclared.',
    autoApply: false,
    authority: 'NONE'
  };
  return { ...core, seamCandidateSha256: hash(core) };
}

function analyzeTrace({ trace } = {}) {
  if (!validTrace(trace)) {
    return deepFreeze({ schema: 'axm.code.creation-reasoning-analysis.v1', result: 'CURRENT_CREATION_REASONING_TRACE_REQUIRED', authority: 'NONE' });
  }
  const steps = trace.steps;
  const findings = [];
  const whyMap = steps.map(step => ({
    stepId: step.stepId,
    mechanismClass: step.mechanismClass,
    rationaleStatus: step.rationaleStatus,
    why: step.mechanismClass === 'DETERMINISTIC_RULE'
      ? { claimClass: 'SUPPLIED_EXACT_RULE_RECEIPT', rule: step.rule }
      : step.mechanismClass === 'NEURAL_DECISION_SUMMARY'
        ? { claimClass: 'REPORTED_DECISION_SUMMARY_NOT_INNER_CAUSAL_PROOF', decisionSummary: step.decisionSummary, alternatives: step.alternatives }
        : step.mechanismClass === 'HYBRID_HANDOFF'
          ? { claimClass: 'REPORTED_HANDOFF_SUMMARY', decisionSummary: step.decisionSummary }
          : { claimClass: 'EXTERNAL_OBSERVATION', decisionSummary: step.decisionSummary }
  }));

  for (const step of steps) {
    if (step.rationaleStatus !== 'WHY_RECEIPT_PRESENT') {
      findings.push(makeFinding(
        'WHY_RECEIPT_MISSING_OR_INCOMPLETE', 'EVIDENCE_GAP', [step.stepId], evidenceDigestsForSteps([step]),
        `${step.mechanismClass} transition lacks its required typed why surface.`,
        'Bind the missing rule fields or concise decision summary to the same step receipt.',
        'This does not prove the transition had no reason.'
      ));
    }
    const stale = step.evidence.filter(item => item.freshness !== 'CURRENT');
    if (stale.length) {
      findings.push(makeFinding(
        'STALE_OR_UNKNOWN_EVIDENCE_AT_TRANSITION', 'EVIDENCE_GAP', [step.stepId], stale.map(item => item.evidenceDigest),
        'The transition used evidence whose current-state relation is stale or unknown.',
        'Supply a current observation from the same evidence route and compare the branch.',
        'Stale evidence is not automatically false.'
      ));
    }
    const forbidden = step.declaredEffects.filter(effect => FORBIDDEN_EFFECTS.has(effect));
    if (forbidden.length) {
      findings.push(makeFinding(
        'UNEXPECTED_AUTHORITY_EFFECT_IN_REASONING_STEP', 'AUTHORITY_SEAM', [step.stepId], evidenceDigestsForSteps([step]),
        `The reasoning receipt declares action effects outside probe authority: ${forbidden.join(', ')}.`,
        'Separate the reasoning observation from an independently gated action request.',
        'This finding does not grant, revoke or exercise authority.'
      ));
    }
    if (step.mechanismClass === 'DETERMINISTIC_RULE' && step.boundary && step.boundary.neighborEvidenceDigests.length === 0) {
      findings.push(makeFinding(
        'DETERMINISTIC_DECISION_BOUNDARY_UNPROBED', 'OPTIMIZATION_HYPOTHESIS', [step.stepId], evidenceDigestsForSteps([step]),
        `The rule selected a branch at ${step.boundary.metric || 'an unnamed metric'} without recorded neighboring fixtures.`,
        'Evaluate the same rule immediately below, at and above the recorded boundary.',
        'The missing neighbor receipt does not prove the rule is weak.'
      ));
    }
  }

  const evidenceByClaim = new Map();
  const evidenceByRoot = new Map();
  for (const step of steps) {
    for (const item of step.evidence) {
      if (item.claimKey) {
        if (!evidenceByClaim.has(item.claimKey)) evidenceByClaim.set(item.claimKey, []);
        evidenceByClaim.get(item.claimKey).push({ step, item });
      }
      if (item.rootEvidenceDigest) {
        if (!evidenceByRoot.has(item.rootEvidenceDigest)) evidenceByRoot.set(item.rootEvidenceDigest, []);
        evidenceByRoot.get(item.rootEvidenceDigest).push({ step, item });
      }
    }
  }
  for (const [claimKey, rows] of evidenceByClaim) {
    const polarities = new Set(rows.map(row => row.item.polarity));
    if (polarities.has('SUPPORTS') && polarities.has('CONTRADICTS')) {
      findings.push(makeFinding(
        'CONTRADICTORY_EVIDENCE_PRESERVED', 'OBSERVATION', rows.map(row => row.step.stepId), rows.map(row => row.item.evidenceDigest),
        `Supplied evidence for ${claimKey} contains both supporting and contradicting observations.`,
        'Resolve provenance and replay a discriminating fixture; do not average the conflict away.',
        'The probe does not decide which observation is true.'
      ));
    }
  }
  for (const [root, rows] of evidenceByRoot) {
    const distinct = new Set(rows.map(row => row.item.evidenceDigest));
    if (distinct.size > 1 && rows.some(row => row.item.claimedIndependent)) {
      findings.push(makeFinding(
        'SHARED_ROOT_NOT_INDEPENDENT_CORROBORATION', 'OBSERVATION', rows.map(row => row.step.stepId), [...distinct],
        `Several evidence views declared as independent resolve to the same root ${root}.`,
        'Add a separately rooted observation and compare it without deleting the derived views.',
        'Multiple views may still be useful; they are not independent roots.'
      ));
    }
  }

  const consumedOutputs = new Set(trace.finalOutputDigests);
  for (const step of steps) for (const digest of step.inputDigests) consumedOutputs.add(digest);
  for (const step of steps) {
    const unconsumed = step.outputDigests.filter(digest => !consumedOutputs.has(digest));
    if (unconsumed.length && step.stage.includes('SPECIALIST')) {
      findings.push(makeFinding(
        'UNCONSUMED_SPECIALIST_OUTPUT', 'OPTIMIZATION_HYPOTHESIS', [step.stepId], unconsumed,
        'A specialist produced an output with no recorded downstream consumer or final-output binding.',
        'Bind the output to a consumer or run an omission trial with the same final verification.',
        'Unconsumed in this trace does not prove uselessness.'
      ));
    }
  }

  const signatureGroups = new Map();
  const deterministicReceiptGroups = new Map();
  for (const step of steps) {
    const signature = hash({
      stage: step.stage,
      operationKey: step.operationKey,
      mechanismClass: step.mechanismClass,
      inputDigests: step.inputDigests,
      rule: step.rule,
      decisionSummary: step.decisionSummary,
      outputDigests: step.outputDigests
    });
    if (!signatureGroups.has(signature)) signatureGroups.set(signature, []);
    signatureGroups.get(signature).push(step);
    if (step.mechanismClass === 'DETERMINISTIC_RULE') {
      const receiptSignature = hash({
        stage: step.stage,
        operationKey: step.operationKey,
        inputDigests: step.inputDigests,
        rule: step.rule
      });
      if (!deterministicReceiptGroups.has(receiptSignature)) deterministicReceiptGroups.set(receiptSignature, []);
      deterministicReceiptGroups.get(receiptSignature).push(step);
    }
  }
  for (const group of deterministicReceiptGroups.values()) {
    const outputs = new Set(group.map(step => canon(step.outputDigests)));
    if (group.length > 1 && outputs.size > 1) {
      findings.push(makeFinding(
        'DETERMINISTIC_SAME_RECEIPT_DIVERGENT_OUTPUT', 'EVIDENCE_GAP', group.map(step => step.stepId), evidenceDigestsForSteps(group),
        'Identical declared deterministic inputs and rule receipts produced different output-digest sets.',
        'Expose seeds, hidden state and environment digests, then replay both paths with every declared input held equal.',
        'The probe cannot tell whether the divergence is hidden input, nondeterminism or a receipt defect.'
      ));
    }
  }
  for (const group of signatureGroups.values()) {
    if (group.length > 1) {
      findings.push(makeFinding(
        'EXACT_REASONING_SUBPATH_REPEATED', 'OPTIMIZATION_HYPOTHESIS', group.map(step => step.stepId), evidenceDigestsForSteps(group),
        'The same operation, mechanism, inputs and why receipt appear more than once in the supplied creation trace.',
        'Replay one occurrence through an exact digest-bound reuse path and compare every output and verifier observation.',
        'Repeated structure may be intentional and is not automatically waste.'
      ));
    }
  }

  const firstHighCommitment = steps.find(step => step.commitmentClass === 'HIGH');
  const laterDiscriminator = firstHighCommitment && steps.find(step => step.sequence > firstHighCommitment.sequence && /VERIF|CHECK|TEST|ADMISSION/.test(step.stage));
  if (firstHighCommitment && laterDiscriminator) {
    findings.push(makeFinding(
      'VERIFICATION_DISCRIMINATOR_AFTER_HIGH_COMMITMENT', 'OPTIMIZATION_HYPOTHESIS', [firstHighCommitment.stepId, laterDiscriminator.stepId], evidenceDigestsForSteps([firstHighCommitment, laterDiscriminator]),
      'A discriminating verification observation occurs only after a high-commitment creation transition.',
      'Move only the cheapest discriminating observation earlier and compare commitment exposure plus final checks.',
      'Late verification is not inherently wrong and early checks are not correctness proof.'
    ));
  }
  if (firstHighCommitment) {
    const prior = steps.filter(step => step.sequence <= firstHighCommitment.sequence);
    if (!prior.some(step => step.counterevidenceSought || step.evidence.some(item => item.polarity === 'CONTRADICTS'))) {
      findings.push(makeFinding(
        'COUNTEREVIDENCE_SEARCH_NOT_RECORDED_BEFORE_HIGH_COMMITMENT', 'EVIDENCE_GAP', [firstHighCommitment.stepId], evidenceDigestsForSteps(prior),
        'No falsifying observation or explicit counterevidence search is recorded before the first high-commitment transition.',
        'Replay a known counterexample fixture before commitment and record whether it changes the path.',
        'Absence from this supplied trace does not prove no counterevidence was considered.'
      ));
    }
  }

  for (const step of steps.filter(item => item.mechanismClass === 'HYBRID_HANDOFF')) {
    const parents = steps.filter(parent => step.dependsOnStepIds.includes(parent.stepId));
    const upstreamUncertainty = strings(parents.flatMap(parent => parent.uncertainties));
    if (upstreamUncertainty.length && step.preservedUncertaintyRefs.length === 0) {
      findings.push(makeFinding(
        'UNCERTAINTY_NOT_PRESERVED_ACROSS_CREATION_HANDOFF', 'EVIDENCE_GAP', [step.stepId, ...parents.map(parent => parent.stepId)], evidenceDigestsForSteps([step, ...parents]),
        'An upstream creation step recorded uncertainty, but the hybrid handoff has no typed preservation reference.',
        'Bind uncertainty references across the handoff and replay a missing-evidence fixture.',
        'This does not prove the downstream machinery ignored uncertainty internally.'
      ));
    }
  }

  findings.sort((a, b) => a.code.localeCompare(b.code) || a.findingId.localeCompare(b.findingId));
  const seamMap = {
    WHY_RECEIPT_MISSING_OR_INCOMPLETE: 'ADD_TYPED_WHY_RECEIPT',
    SHARED_ROOT_NOT_INDEPENDENT_CORROBORATION: 'GROUP_SHARED_ROOT_AS_ONE_EVIDENCE_FAMILY',
    UNCONSUMED_SPECIALIST_OUTPUT: 'ROUTE_OR_TEST_UNUSED_SPECIALIST_OUTPUT',
    EXACT_REASONING_SUBPATH_REPEATED: 'CACHE_OR_REUSE_EXACT_SUBPATH',
    DETERMINISTIC_SAME_RECEIPT_DIVERGENT_OUTPUT: 'EXPOSE_HIDDEN_INPUT_OR_NONDETERMINISM',
    DETERMINISTIC_DECISION_BOUNDARY_UNPROBED: 'PROBE_DETERMINISTIC_BOUNDARY_NEIGHBORS',
    VERIFICATION_DISCRIMINATOR_AFTER_HIGH_COMMITMENT: 'MOVE_DISCRIMINATOR_BEFORE_HIGH_COMMITMENT',
    COUNTEREVIDENCE_SEARCH_NOT_RECORDED_BEFORE_HIGH_COMMITMENT: 'ADD_COUNTEREVIDENCE_SEARCH_BEFORE_COMMITMENT',
    UNCERTAINTY_NOT_PRESERVED_ACROSS_CREATION_HANDOFF: 'PRESERVE_UNCERTAINTY_ACROSS_HANDOFF',
    UNEXPECTED_AUTHORITY_EFFECT_IN_REASONING_STEP: 'KEEP_AUTHORITY_OUTSIDE_REASONING_PROBE'
  };
  const seamCandidates = [];
  for (const code of [...new Set(findings.map(finding => seamMap[finding.code]).filter(Boolean))].sort()) {
    const sourceCodes = new Set(Object.entries(seamMap).filter(([, seamCode]) => seamCode === code).map(([findingCode]) => findingCode));
    const candidate = createSeamCandidate(code, findings.filter(finding => sourceCodes.has(finding.code)));
    if (candidate) seamCandidates.push(candidate);
  }
  const mechanismCounts = Object.fromEntries([...MECHANISM_CLASSES].sort().map(mechanism => [mechanism, steps.filter(step => step.mechanismClass === mechanism).length]));
  const core = {
    schema: 'axm.code.creation-reasoning-analysis.v1',
    version: '1.0.0',
    result: 'CREATION_REASONING_SEAMS_OBSERVED_NOT_JUDGED',
    projectId: trace.projectId,
    creationId: trace.creationId,
    taskDigest: trace.taskDigest,
    directionSha256: trace.directionSha256,
    traceSha256: trace.traceSha256,
    engineClass: trace.engineClass,
    stepCount: steps.length,
    mechanismCounts,
    whyMap,
    findings,
    seamCandidates,
    truth: {
      analysisTargetsCreationMachineryNotWaldo: true,
      findingsAreNotGroundTruth: true,
      seamCandidateIsNotOptimizationProof: true,
      noWinnerCalculated: true,
      noReasoningChangeApplied: true,
      contradictoryAndNegativeEvidencePreserved: true,
      neuralSummaryIsNotPrivateChainOfThought: true
    },
    authority: AUTHORITY
  };
  return deepFreeze({ ...core, analysisSha256: hash(core) });
}

function compareTraces({ leftTrace, rightTrace, leftAnalysis = null, rightAnalysis = null } = {}) {
  if (!validTrace(leftTrace) || !validTrace(rightTrace)) {
    return deepFreeze({ schema: 'axm.code.creation-reasoning-comparison.v1', result: 'TWO_CURRENT_CREATION_TRACES_REQUIRED', authority: 'NONE' });
  }
  if (leftTrace.projectId !== rightTrace.projectId || leftTrace.taskDigest !== rightTrace.taskDigest || leftTrace.directionSha256 !== rightTrace.directionSha256) {
    return deepFreeze({ schema: 'axm.code.creation-reasoning-comparison.v1', result: 'CREATION_TRACE_COMPARISON_SCOPE_MISMATCH', authority: 'NONE' });
  }
  const left = leftAnalysis && leftAnalysis.traceSha256 === leftTrace.traceSha256 && digestCurrent(leftAnalysis, 'analysisSha256') ? leftAnalysis : analyzeTrace({ trace: leftTrace });
  const right = rightAnalysis && rightAnalysis.traceSha256 === rightTrace.traceSha256 && digestCurrent(rightAnalysis, 'analysisSha256') ? rightAnalysis : analyzeTrace({ trace: rightTrace });
  const metrics = trace => ({
    stepCount: trace.steps.length,
    totalWorkUnits: trace.steps.reduce((sum, step) => sum + (step.cost.workUnits || 0), 0),
    totalLatencyMs: trace.steps.reduce((sum, step) => sum + (step.cost.latencyMs || 0), 0),
    externalCalls: trace.steps.reduce((sum, step) => sum + (step.cost.externalCalls || 0), 0)
  });
  const core = {
    schema: 'axm.code.creation-reasoning-comparison.v1',
    version: '1.0.0',
    result: 'CREATION_REASONING_PATHS_COMPARED_NO_WINNER',
    projectId: leftTrace.projectId,
    taskDigest: leftTrace.taskDigest,
    directionSha256: leftTrace.directionSha256,
    left: {
      creationId: leftTrace.creationId,
      traceSha256: leftTrace.traceSha256,
      engineClass: leftTrace.engineClass,
      metrics: metrics(leftTrace),
      findingCodes: left.findings.map(finding => finding.code)
    },
    right: {
      creationId: rightTrace.creationId,
      traceSha256: rightTrace.traceSha256,
      engineClass: rightTrace.engineClass,
      metrics: metrics(rightTrace),
      findingCodes: right.findings.map(finding => finding.code)
    },
    sharedFinalOutputDigests: leftTrace.finalOutputDigests.filter(digest => rightTrace.finalOutputDigests.includes(digest)),
    truth: {
      fewerStepsIsNotAutomaticallyBetter: true,
      lowerLatencyIsNotAutomaticallyHigherQuality: true,
      comparisonDoesNotRankOrSelect: true,
      differentFindingCountIsNotAQualityScore: true
    },
    authority: AUTHORITY
  };
  return deepFreeze({ ...core, comparisonSha256: hash(core) });
}

function createOptimizationTrial({ trace, seamCandidate, metricContracts = [] } = {}) {
  if (!validTrace(trace) || !seamCandidate || seamCandidate.schema !== 'axm.code.creation-reasoning-seam-candidate.v1' || !digestCurrent(seamCandidate, 'seamCandidateSha256')) {
    return deepFreeze({ schema: 'axm.code.creation-reasoning-optimization-trial.v1', result: 'CURRENT_TRACE_AND_SEAM_CANDIDATE_REQUIRED', authority: 'NONE' });
  }
  const metrics = (Array.isArray(metricContracts) ? metricContracts : []).map(metric => ({
    metricId: cleanId(metric.metricId),
    desiredDirection: ['MINIMIZE', 'MAXIMIZE', 'PRESERVE'].includes(String(metric.desiredDirection || '').toUpperCase()) ? String(metric.desiredDirection).toUpperCase() : 'PRESERVE',
    evidenceRoute: clean(metric.evidenceRoute),
    invariant: clean(metric.invariant) || null
  })).filter(metric => metric.metricId && metric.evidenceRoute);
  if (!metrics.length) {
    return deepFreeze({ schema: 'axm.code.creation-reasoning-optimization-trial.v1', result: 'TRIAL_METRIC_CONTRACT_REQUIRED', authority: 'NONE' });
  }
  const core = {
    schema: 'axm.code.creation-reasoning-optimization-trial.v1',
    version: '1.0.0',
    result: 'CREATION_REASONING_OPTIMIZATION_TRIAL_READY_NOT_RUN',
    projectId: trace.projectId,
    taskDigest: trace.taskDigest,
    baselineTraceSha256: trace.traceSha256,
    seamCandidateSha256: seamCandidate.seamCandidateSha256,
    seamCode: seamCandidate.seamCode,
    metricContracts: metrics,
    requiredObservations: ['baseline and candidate trace receipts', 'metric evidence digests', 'negative and contradictory outcomes', 'invariant observations'],
    truth: {
      trialIsNotExecutionPermission: true,
      candidatePathNotCreatedHere: true,
      metricContractDoesNotPredeclareWinner: true,
      regressionMustRemainVisible: true,
      noAutomaticTuningOrSelfModification: true
    },
    authority: AUTHORITY
  };
  return deepFreeze({ ...core, trialSha256: hash(core) });
}

function recordTrialObservation({ trial, baselineTrace, candidateTrace, metricObservations = [] } = {}) {
  if (!trial || trial.schema !== 'axm.code.creation-reasoning-optimization-trial.v1' || !digestCurrent(trial, 'trialSha256') || !validTrace(baselineTrace) || !validTrace(candidateTrace)) {
    return deepFreeze({ schema: 'axm.code.creation-reasoning-trial-observation.v1', result: 'CURRENT_TRIAL_AND_TRACES_REQUIRED', authority: 'NONE' });
  }
  if (trial.baselineTraceSha256 !== baselineTrace.traceSha256 || baselineTrace.projectId !== candidateTrace.projectId || baselineTrace.taskDigest !== candidateTrace.taskDigest || baselineTrace.directionSha256 !== candidateTrace.directionSha256) {
    return deepFreeze({ schema: 'axm.code.creation-reasoning-trial-observation.v1', result: 'TRIAL_TRACE_BINDING_MISMATCH', authority: 'NONE' });
  }
  const contractById = new Map(trial.metricContracts.map(contract => [contract.metricId, contract]));
  const observations = [];
  for (const item of Array.isArray(metricObservations) ? metricObservations : []) {
    const metricId = cleanId(item.metricId);
    const contract = contractById.get(metricId);
    if (!contract || !item.evidenceDigest || !Number.isFinite(item.baselineValue) || !Number.isFinite(item.candidateValue)) continue;
    let relation = 'UNCHANGED';
    if (contract.desiredDirection === 'MINIMIZE') relation = item.candidateValue < item.baselineValue ? 'IMPROVED' : item.candidateValue > item.baselineValue ? 'REGRESSED' : 'UNCHANGED';
    if (contract.desiredDirection === 'MAXIMIZE') relation = item.candidateValue > item.baselineValue ? 'IMPROVED' : item.candidateValue < item.baselineValue ? 'REGRESSED' : 'UNCHANGED';
    if (contract.desiredDirection === 'PRESERVE') relation = item.candidateValue === item.baselineValue ? 'PRESERVED' : 'CHANGED_REVIEW_REQUIRED';
    observations.push({
      metricId,
      desiredDirection: contract.desiredDirection,
      baselineValue: item.baselineValue,
      candidateValue: item.candidateValue,
      relation,
      evidenceDigest: String(item.evidenceDigest),
      note: item.note == null ? null : String(item.note)
    });
  }
  const complete = trial.metricContracts.every(contract => observations.some(observation => observation.metricId === contract.metricId));
  if (!complete) {
    return deepFreeze({
      schema: 'axm.code.creation-reasoning-trial-observation.v1',
      result: 'TRIAL_METRIC_EVIDENCE_INCOMPLETE',
      missingMetricIds: trial.metricContracts.filter(contract => !observations.some(observation => observation.metricId === contract.metricId)).map(contract => contract.metricId),
      authority: 'NONE'
    });
  }
  const relations = new Set(observations.map(observation => observation.relation));
  const mixed = relations.has('IMPROVED') && (relations.has('REGRESSED') || relations.has('CHANGED_REVIEW_REQUIRED'));
  const core = {
    schema: 'axm.code.creation-reasoning-trial-observation.v1',
    version: '1.0.0',
    result: mixed ? 'MIXED_CREATION_REASONING_OBSERVATIONS_PRESERVED_NO_WINNER' : 'CREATION_REASONING_OBSERVATIONS_PRESERVED_NO_WINNER',
    projectId: baselineTrace.projectId,
    taskDigest: baselineTrace.taskDigest,
    trialSha256: trial.trialSha256,
    baselineTraceSha256: baselineTrace.traceSha256,
    candidateTraceSha256: candidateTrace.traceSha256,
    observations,
    mixed,
    truth: {
      metricsNotAveragedIntoScore: true,
      improvementDoesNotEraseRegression: true,
      negativeAndContradictoryResultsPreserved: true,
      noWinnerCalculated: true,
      noOptimizationApplied: true
    },
    authority: AUTHORITY
  };
  return deepFreeze({ ...core, trialObservationSha256: hash(core) });
}

function snapshot() {
  const core = {
    schema: 'axm.code.creation-reasoning-seam-probe-snapshot.v1',
    version: '1.0.0',
    target: 'CODE_CREATION_REASONING_PATHS',
    supportedEngineClasses: [...ENGINE_CLASSES].sort(),
    whySurfaces: {
      deterministic: 'RULE_CONDITION_BRANCH_REASON_RECEIPT',
      neural: 'REPORTED_DECISION_SUMMARY_NOT_PRIVATE_CHAIN_OF_THOUGHT',
      hybrid: 'TYPED_HANDOFF_WITH_UNCERTAINTY_PRESERVATION'
    },
    outputs: ['OBSERVATIONS', 'EVIDENCE_GAPS', 'SEAM_CANDIDATES', 'PAIRED_TRIAL_CANDIDATES'],
    authority: 'NONE'
  };
  return deepFreeze({ ...core, snapshotSha256: hash(core) });
}

module.exports = Object.freeze({
  ENGINE_CLASSES: Object.freeze([...ENGINE_CLASSES].sort()),
  MECHANISM_CLASSES: Object.freeze([...MECHANISM_CLASSES].sort()),
  createTrace,
  analyzeTrace,
  compareTraces,
  createOptimizationTrial,
  recordTrialObservation,
  snapshot
});
