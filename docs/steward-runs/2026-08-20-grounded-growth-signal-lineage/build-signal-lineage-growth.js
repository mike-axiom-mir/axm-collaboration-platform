#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Gap = require('../../../shared/ai-native-hands/capability-gap-hand');
const Lineage = require('../../../shared/grounded-growth-signal-lineage/grounded-growth-signal-lineage');
const Cycle = require('../../../shared/verified-capability-loop/verified-capability-loop');
const Growth = require('../../../shared/grounded-growth-outcomes/grounded-growth-outcomes');
const Current = require('../../../shared/grounded-growth-current-state/grounded-growth-current-state');
const Participation = require('../2026-08-19-grounded-growth-participation-frontier/build-current-participation-frontier');

const ROOT = path.resolve(__dirname, '../../..');
const LANE = 'docs/steward-runs/2026-08-20-grounded-growth-signal-lineage';
const DISPOSITION_PATH = 'docs/steward-runs/2026-08-19-public-baseline-research-run/RESEARCH_DISPOSITION.json';
const PRIOR_PORTFOLIO = 'docs/steward-runs/2026-08-19-portable-verification-grounded-growth/CURRENT_PORTFOLIO.json';
const PRIOR_CURRENT_STATE = 'docs/steward-runs/2026-08-19-portable-verification-grounded-growth/CURRENT_STATE_RECEIPT.json';
const PARTICIPATION_RECEIPT = 'docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/CURRENT_PARTICIPATION_FRONTIER_RECEIPT.json';
const LINEAGE_AT = '2026-08-20T00:24:00.000Z';
const EVALUATION_AT = '2026-08-20T00:25:00.000Z';
const CANDIDATE_AT = '2026-08-20T00:26:00.000Z';
const PROOF_AT = '2026-08-20T00:27:00.000Z';
const CYCLE_AT = '2026-08-20T00:28:00.000Z';
const OUTCOME_AT = '2026-08-20T00:29:00.000Z';
const PORTFOLIO_AT = '2026-08-20T00:30:00.000Z';
const CURRENT_AT = '2026-08-20T00:31:00.000Z';

const CANDIDATE_SOURCE_FILES = [
  'shared/grounded-growth-signal-lineage/grounded-growth-signal-lineage.js',
  'shared/grounded-growth-signal-lineage/grounded-growth-signal-lineage-receipt.schema.json',
  'shared/grounded-growth-signal-lineage/module.contract.json',
  'shared/grounded-growth-signal-lineage/README.md',
  'shared/grounded-growth-signal-lineage/selftest.js'
];

const EVIDENCE_SOURCE_DEFS = [
  ['shared/evidence-retention/evidence-retention-service.js', 'evidence-retention-service', 'CURRENT_TECHNICAL_SOURCE'],
  ['shared/evidence-retention/selftest.js', 'evidence-retention-selftest', 'FOCUSED_TECHNICAL_PROOF'],
  ['shared/portable-baseline-capsule/portable-baseline-capsule.js', 'portable-baseline-capsule-core', 'CURRENT_TECHNICAL_SOURCE'],
  ['shared/portable-baseline-capsule/selftest.js', 'portable-baseline-capsule-selftest', 'FOCUSED_TECHNICAL_PROOF'],
  ['shared/verified-capability-loop/verified-capability-loop.js', 'verified-capability-loop-core', 'CURRENT_TECHNICAL_SOURCE'],
  ['shared/verified-capability-loop/selftest.js', 'verified-capability-loop-selftest', 'FOCUSED_TECHNICAL_PROOF'],
  ['shared/ai-native-hands/evidence-router-hand.js', 'evidence-router-hand', 'CURRENT_TECHNICAL_SOURCE'],
  ['shared/ai-native-hands/selftest.js', 'ai-native-hands-selftest', 'FOCUSED_TECHNICAL_PROOF'],
  ['shared/visual-proof/visual-proof.js', 'visual-proof-core', 'CURRENT_TECHNICAL_SOURCE'],
  ['shared/visual-proof/selftest.js', 'visual-proof-selftest', 'FOCUSED_TECHNICAL_PROOF'],
  ['shared/baseline-simulation-lab/baseline-simulation-lab.js', 'baseline-simulation-lab-core', 'CURRENT_TECHNICAL_SOURCE'],
  ['shared/baseline-simulation-lab/selftest.js', 'baseline-simulation-lab-selftest', 'FOCUSED_TECHNICAL_PROOF'],
  [PARTICIPATION_RECEIPT, 'current-participation-frontier', 'OPTIONAL_HUMAN_ROUTE_NOT_EVIDENCE']
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function schemaFor(relativePath) {
  const extension = path.extname(relativePath).toLowerCase();
  if (extension === '.json') return 'application/json';
  if (extension === '.js') return 'text/javascript';
  return 'text/markdown';
}

function fileRef(relativePath, id, schema) {
  return {
    id: id || ('file:' + relativePath.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()),
    schema: schema || schemaFor(relativePath),
    sha256: Growth.sha256(fs.readFileSync(path.join(ROOT, relativePath)))
  };
}

function evidenceFileRef(definition) {
  const [relativePath, id, role] = definition;
  return { ...fileRef(relativePath, id), role };
}

function internalRef(id, schema, digest) {
  return { id, schema, sha256: digest };
}

function selfDigestValid(receipt, field) {
  const payload = clone(receipt);
  const declared = payload[field];
  delete payload[field];
  return declared === Growth.sha256(payload);
}

function gapReports() {
  const requirements = readJson(LANE + '/CAPABILITY_REQUIREMENTS.json').requirements;
  const before = readJson(LANE + '/CAPABILITY_INVENTORY_BEFORE.json').capabilities;
  const after = readJson(LANE + '/CAPABILITY_INVENTORY_AFTER.json').capabilities;
  return { before: Gap.compare(requirements, before), after: Gap.compare(requirements, after) };
}

function claimBinding(portfolio, outcomeId, claimId) {
  const outcome = portfolio.outcomes.find((item) => item.outcomeId === outcomeId);
  if (!outcome) throw new Error('missing current outcome ' + outcomeId);
  const claim = outcome.claims.find((item) => item.id === claimId);
  if (!claim) throw new Error('missing current claim ' + claimId);
  return {
    outcomeId: outcome.outcomeId,
    receiptDigest: outcome.receiptDigest,
    claimId: claim.id,
    beneficiary: claim.beneficiary,
    admittedVerdict: claim.admittedVerdict,
    proofSurface: claim.proofSurface
  };
}

function currentInput() {
  const disposition = readJson(DISPOSITION_PATH);
  const portfolio = readJson(PRIOR_PORTFOLIO);
  assert.ok(Growth.verifyPortfolio(portfolio).pass, 'prior nine-outcome portfolio must verify');
  const evidenceSources = EVIDENCE_SOURCE_DEFS.map(evidenceFileRef);
  return {
    lineageId: 'current-grounded-growth-signal-lineage-20260820',
    generatedAt: LINEAGE_AT,
    disposition,
    dispositionRef: {
      id: 'public-baseline-research-disposition',
      schema: disposition.schema,
      sha256: Lineage.sha256(disposition)
    },
    portfolio,
    evidenceSources,
    signalLinks: [
      {
        signalId: 'signal:registered-output-closure',
        state: 'CURRENT_TECHNICAL_EVIDENCE',
        evidenceRefIds: ['evidence-retention-service', 'evidence-retention-selftest'],
        outcomeBindings: [
          claimBinding(portfolio, 'grounded-growth-verification-evolution-ai-workflow-20260819', 'verification-source-evolution-system-effect'),
          claimBinding(portfolio, 'grounded-growth-verification-evolution-ai-workflow-20260819', 'verification-source-evolution-ai-workflow-benefit')
        ],
        requiredEvent: null,
        notes: 'Current registered-source closure and later source-evolution evidence carry this signal without treating byte lineage as correctness.'
      },
      {
        signalId: 'signal:portable-baseline-identity',
        state: 'CURRENT_TECHNICAL_EVIDENCE',
        evidenceRefIds: ['portable-baseline-capsule-core', 'portable-baseline-capsule-selftest'],
        outcomeBindings: [
          claimBinding(portfolio, 'grounded-growth-baseline-ai-workflow-20260819', 'baseline-no-new-stop-system-effect'),
          claimBinding(portfolio, 'grounded-growth-baseline-ai-workflow-20260819', 'baseline-change-gated-ai-workflow-benefit')
        ],
        requiredEvent: null,
        notes: 'The current portable-baseline capability and its latest Grounded Growth outcome carry exact identity and change-gated routing.'
      },
      {
        signalId: 'signal:same-cycle-linkage',
        state: 'CURRENT_TECHNICAL_EVIDENCE',
        evidenceRefIds: ['verified-capability-loop-core', 'verified-capability-loop-selftest'],
        outcomeBindings: [],
        requiredEvent: null,
        notes: 'The pure Verified Capability Loop keeps the lifecycle chain exact; a linked receipt remains evidence plumbing rather than outcome proof.'
      },
      {
        signalId: 'signal:semantic-first-visual-escalation',
        state: 'CURRENT_TECHNICAL_EVIDENCE',
        evidenceRefIds: ['evidence-router-hand', 'ai-native-hands-selftest', 'visual-proof-core', 'visual-proof-selftest'],
        outcomeBindings: [],
        requiredEvent: null,
        notes: 'Current Evidence Router and Visual Proof sources keep structural evidence separate from native visual and interaction evidence.'
      },
      {
        signalId: 'signal:human-comprehension-comparison',
        state: 'WAITING_VOLUNTARY_HUMAN_EVIDENCE',
        evidenceRefIds: ['current-participation-frontier'],
        outcomeBindings: [],
        requiredEvent: 'VOLUNTARY_HUMAN_NATIVE_EVIDENCE',
        notes: 'An answer-free optional route exists, but no person opted in and no human benefit is claimed.'
      },
      {
        signalId: 'signal:no-new-information-stop',
        state: 'CURRENT_TECHNICAL_EVIDENCE',
        evidenceRefIds: ['baseline-simulation-lab-core', 'baseline-simulation-lab-selftest'],
        outcomeBindings: [
          claimBinding(portfolio, 'grounded-growth-baseline-ai-workflow-20260819', 'baseline-no-new-stop-system-effect'),
          claimBinding(portfolio, 'grounded-growth-baseline-ai-workflow-20260819', 'baseline-change-gated-ai-workflow-benefit')
        ],
        requiredEvent: null,
        notes: 'The bounded lab and latest baseline outcome preserve the zero-generation stop until declared new information arrives.'
      }
    ],
    proposalLinks: [
      {
        proposalId: 'proposal:recursive-research-daemon',
        state: 'REJECTED_NO_ACTION',
        evidenceRefIds: [],
        notes: 'No daemon, background model loop, or recursive authority is introduced.'
      },
      {
        proposalId: 'proposal:cross-model-majority-truth',
        state: 'REJECTED_NO_ACTION',
        evidenceRefIds: [],
        notes: 'Model agreement remains corroboration context and never becomes proof authority.'
      },
      {
        proposalId: 'proposal:central-simulation-database-global-score',
        state: 'REJECTED_NO_ACTION',
        evidenceRefIds: [],
        notes: 'No central score or database is created by this derived receipt.'
      },
      {
        proposalId: 'proposal:automatic-builder-or-promoter',
        state: 'REJECTED_NO_ACTION',
        evidenceRefIds: [],
        notes: 'Candidate build, install, promotion, merge, and CANON authority remain external.'
      },
      {
        proposalId: 'proposal:new-evidence-plane',
        state: 'REJECTED_REDUNDANT_NO_ACTION',
        evidenceRefIds: ['evidence-retention-service', 'evidence-router-hand', 'visual-proof-core'],
        notes: 'Existing evidence organs are referenced instead of creating a competing authority plane.'
      },
      {
        proposalId: 'proposal:signal-link-ledger',
        state: 'DEFERRED_NO_ACTION',
        evidenceRefIds: [],
        notes: 'This machine-derived audit is not the deferred human-facing ledger and claims no human usefulness.'
      }
    ]
  };
}

function buildLineage() {
  return Lineage.build(currentInput());
}

function decisionForBuild(input) {
  try {
    Lineage.build(input);
    return 'CONTINUE';
  } catch (error) {
    const message = error.message;
    if (/every accepted signal|accepted signal lacks lineage|every rejected or deferred proposal|proposal lacks lineage/.test(message)) return 'HOLD_INCOMPLETE_LINEAGE';
    if (/outcome digest mismatch|unknown outcome claim|outside the current portfolio/.test(message)) return 'HOLD_STALE_OUTCOME';
    if (/unknown evidence source/.test(message)) return 'HOLD_UNKNOWN_EVIDENCE';
    if (/unknown human signal|voluntary-human wait/.test(message)) return 'REFUSE_SYNTHETIC_HUMAN_CLOSURE';
    if (/proposal state does not preserve/.test(message)) return 'REFUSE_PROPOSAL_STATE_DRIFT';
    if (/disposition reference does not bind/.test(message)) return 'HOLD_SOURCE_DRIFT';
    return 'HOLD_UNCLASSIFIED';
  }
}

function shortcutDecision(input) {
  const signalIds = new Set(input.disposition.acceptedSignals.map((item) => item.id));
  const proposalIds = new Set(input.disposition.rejectedOrDeferred.map((item) => item.id));
  return signalIds.size === 6 && proposalIds.size === 6 ? 'CONTINUE' : 'HOLD_INCOMPLETE_LINEAGE';
}

function caseDefinitions() {
  return [
    { id: 'exact-current-lineage', mutation: 'NONE', expected: 'CONTINUE', mutate: (input) => input },
    { id: 'accepted-signal-link-omitted', mutation: 'REMOVE_SIGNAL_LINK', expected: 'HOLD_INCOMPLETE_LINEAGE', mutate: (input) => { input.signalLinks.pop(); return input; } },
    { id: 'proposal-link-omitted', mutation: 'REMOVE_PROPOSAL_LINK', expected: 'HOLD_INCOMPLETE_LINEAGE', mutate: (input) => { input.proposalLinks.pop(); return input; } },
    { id: 'stale-outcome-digest', mutation: 'REPLACE_OUTCOME_DIGEST', expected: 'HOLD_STALE_OUTCOME', mutate: (input) => { input.signalLinks[0].outcomeBindings[0].receiptDigest = 'sha256:' + '0'.repeat(64); return input; } },
    { id: 'unknown-evidence-reference', mutation: 'REPLACE_EVIDENCE_ID', expected: 'HOLD_UNKNOWN_EVIDENCE', mutate: (input) => { input.signalLinks[1].evidenceRefIds = ['missing-source']; return input; } },
    { id: 'synthetic-human-technical-closure', mutation: 'CONVERT_HUMAN_WAIT_TO_TECHNICAL', expected: 'REFUSE_SYNTHETIC_HUMAN_CLOSURE', mutate: (input) => { input.signalLinks[4].state = 'CURRENT_TECHNICAL_EVIDENCE'; input.signalLinks[4].requiredEvent = null; return input; } },
    { id: 'rejected-proposal-state-drift', mutation: 'CHANGE_REJECTED_TO_DEFERRED', expected: 'REFUSE_PROPOSAL_STATE_DRIFT', mutate: (input) => { input.proposalLinks[0].state = 'DEFERRED_NO_ACTION'; return input; } },
    { id: 'changed-disposition-behind-old-reference', mutation: 'ALTER_DISPOSITION_STATEMENT', expected: 'HOLD_SOURCE_DRIFT', mutate: (input) => { input.disposition.acceptedSignals[0].statement += ' altered'; return input; } }
  ];
}

function buildCases() {
  const cases = caseDefinitions().map((definition) => {
    const input = definition.mutate(clone(currentInput()));
    const baselineDecision = shortcutDecision(input);
    const candidateDecision = decisionForBuild(input);
    return {
      id: definition.id,
      inputMutation: definition.mutation,
      expectedDecision: definition.expected,
      baselineDecision,
      candidateDecision,
      baselineCorrect: baselineDecision === definition.expected,
      candidateCorrect: candidateDecision === definition.expected
    };
  });
  const result = {
    schema: 'axm.signal-lineage-workflow-case-set/v1',
    version: '0.1.0',
    caseSetId: 'signal-lineage-grounded-steward-cases-20260820',
    generatedAt: EVALUATION_AT,
    fixturePolicy: 'Developer-visible frozen adversarial cases derived from the current Workshop disposition and lineage boundaries; not independently blinded or statistically sampled.',
    cases,
    caseSetDigest: null
  };
  const payload = clone(result);
  delete payload.caseSetDigest;
  result.caseSetDigest = Growth.sha256(payload);
  return result;
}

function buildEvaluation(cases) {
  const baselineCorrect = cases.cases.filter((item) => item.baselineCorrect).length;
  const candidateCorrect = cases.cases.filter((item) => item.candidateCorrect).length;
  const result = {
    schema: 'axm.ai-workflow-evaluation/v1',
    version: '0.1.0',
    evaluationId: 'signal-lineage-grounded-steward-evaluation-20260820',
    generatedAt: EVALUATION_AT,
    beneficiary: 'AI_WORKFLOW',
    workflow: 'Bounded stewardship routing for research signal coverage, current evidence lineage, voluntary-human unknowns, proposal non-actions, and source drift.',
    proofSurface: 'AI_WORKFLOW_EVALUATION',
    fixturePolicy: cases.fixturePolicy,
    inputRefs: [
      internalRef(cases.caseSetId, cases.schema, cases.caseSetDigest),
      currentInput().dispositionRef,
      fileRef('shared/grounded-growth-signal-lineage/grounded-growth-signal-lineage.js', 'grounded-growth-signal-lineage-core')
    ],
    baseline: {
      policyId: 'ID_AND_COUNT_ONLY_SHORTCUT',
      description: 'The shortcut confirms that six signal IDs and six proposal IDs exist but does not check per-item lineage, digests, evidence targets, human boundaries, or proposal state.',
      correctDecisions: baselineCorrect,
      totalDecisions: cases.cases.length,
      unsupportedOrUnsafeDecisions: cases.cases.length - baselineCorrect
    },
    outcome: {
      policyId: 'EXACT_SIGNAL_LINEAGE_GUARD',
      description: 'The guard exact-binds every item to current evidence or an explicit human/non-action state and refuses stale, missing, synthetic, or authority-inflating substitutions.',
      correctDecisions: candidateCorrect,
      totalDecisions: cases.cases.length,
      unsupportedOrUnsafeDecisions: cases.cases.length - candidateCorrect,
      newlyCorrectedDecisions: candidateCorrect - baselineCorrect
    },
    cases: clone(cases.cases),
    verdict: candidateCorrect === cases.cases.length ? 'PASS' : 'FAIL',
    limitations: [
      'The cases were visible while the guard was developed and are not an independently blinded, statistical, or provider benchmark.',
      'No language model was invoked; this evaluates a deterministic guard for an AI-assisted workflow, not model weights, intelligence, or generalization.',
      'The current source set is exact only in native rebuild mode; detached integrity holds source truth and currentness at UNKNOWN.',
      'No human comparison ran, so human usefulness and benefit remain NOT_RUN.'
    ],
    truth: {
      modelInvoked: false,
      modelWeightsChanged: false,
      modelGeneralizationClaimed: false,
      humanParticipant: false,
      humanBenefitClaimed: false,
      automaticExecution: false,
      automaticPromotion: false,
      automaticCanon: false
    },
    receiptDigest: null
  };
  const payload = clone(result);
  delete payload.receiptDigest;
  result.receiptDigest = Growth.sha256(payload);
  return result;
}

function buildCandidate(lineage, cases, evaluation, gaps) {
  const candidate = {
    schema: 'axm.grounded-growth-signal-lineage-candidate/v1',
    version: '0.1.0',
    candidateId: 'grounded-growth-signal-lineage-candidate-20260820',
    generatedAt: CANDIDATE_AT,
    status: 'EXPERIMENTAL',
    capabilityId: 'growth.knowledge-signal-lineage.verify',
    sourceRefs: CANDIDATE_SOURCE_FILES.map((file) => fileRef(file)),
    evidenceRefs: [
      internalRef(lineage.lineageId, lineage.schema, lineage.receiptDigest),
      internalRef(cases.caseSetId, cases.schema, cases.caseSetDigest),
      internalRef(evaluation.evaluationId, evaluation.schema, evaluation.receiptDigest),
      Growth.reference(gaps.after, { id: 'signal-lineage-capability-gap-after', schema: gaps.after.schema })
    ],
    boundaries: {
      exactLineageIsHumanBenefit: false,
      detachedIntegrityIsSourceTruth: false,
      deferredHumanLedgerImplemented: false,
      installed: false,
      permissionGranted: false,
      promoted: false,
      merged: false,
      canon: false,
      foundationMutation: false
    },
    candidateDigest: null
  };
  const payload = clone(candidate);
  delete payload.candidateDigest;
  candidate.candidateDigest = Growth.sha256(payload);
  return candidate;
}

function candidateRef(candidate) {
  return internalRef(candidate.candidateId, candidate.schema, candidate.candidateDigest);
}

function buildProof(candidate, lineage, cases, evaluation) {
  const native = Lineage.verify(lineage, currentInput());
  const portable = Lineage.verifyPortable(lineage);
  const sourceRefsCurrent = candidate.sourceRefs.every((reference, index) => {
    const relativePath = CANDIDATE_SOURCE_FILES[index];
    return reference.sha256 === Growth.sha256(fs.readFileSync(path.join(ROOT, relativePath)));
  });
  const allExpected = evaluation.outcome.correctDecisions === evaluation.outcome.totalDecisions
    && evaluation.cases.every((item) => item.candidateCorrect);
  const pass = native.pass && portable.pass && sourceRefsCurrent && allExpected
    && lineage.coverage.acceptedSignals === 6 && lineage.coverage.proposalLinks === 6
    && lineage.coverage.currentTechnicalSignals === 5
    && lineage.coverage.waitingVoluntaryHumanSignals === 1
    && lineage.decision.autonomousActionCount === 0;
  const proof = {
    schema: 'axm.grounded-growth-signal-lineage-proof/v1',
    version: '0.1.0',
    proofId: 'grounded-growth-signal-lineage-proof-20260820',
    generatedAt: PROOF_AT,
    status: 'TEST',
    subjectRef: candidateRef(candidate),
    verdict: pass ? 'PASS_WITH_DECLARED_LIMITS' : 'FAIL',
    checks: {
      nativeExactRebuild: native.pass,
      detachedIntegrity: portable.pass,
      detachedSourceTruth: portable.sourceTruth,
      candidateSourceRefsCurrent: sourceRefsCurrent,
      acceptedSignalsCovered: lineage.coverage.signalLinks,
      proposalsCovered: lineage.coverage.proposalLinks,
      technicalSignals: lineage.coverage.currentTechnicalSignals,
      waitingHumanSignals: lineage.coverage.waitingVoluntaryHumanSignals,
      workflowCases: cases.cases.length,
      workflowExpectedDecisions: evaluation.outcome.correctDecisions,
      workflowBaselineCorrect: evaluation.baseline.correctDecisions,
      workflowCandidateCorrect: evaluation.outcome.correctDecisions
    },
    limitations: clone(evaluation.limitations),
    authority: {
      availabilityGranted: false,
      humanDecisionMade: false,
      participationStarted: false,
      installed: false,
      permissionGranted: false,
      promoted: false,
      merged: false,
      canon: false,
      foundationMutation: false
    },
    proofDigest: null
  };
  const payload = clone(proof);
  delete payload.proofDigest;
  proof.proofDigest = Growth.sha256(payload);
  return proof;
}

function proofRef(proof) {
  return internalRef(proof.proofId, proof.schema, proof.proofDigest);
}

function buildCycle(candidate, proof, gaps) {
  return Cycle.build({
    cycleId: 'cycle-grounded-growth-signal-lineage-20260820',
    capabilityId: candidate.capabilityId,
    generatedAt: CYCLE_AT,
    baseline: {
      kind: 'grounded-growth-current-state',
      identity: 'nine outcomes plus a six-signal and six-proposal disposition without exact per-item current lineage closure',
      receiptRef: fileRef(PRIOR_CURRENT_STATE, 'prior-nine-outcome-current-state')
    },
    need: {
      id: 'need-exact-research-signal-lineage',
      statement: 'Every retained signal and rejected or deferred proposal needs an exact current evidence or non-action lineage so future AI stewardship cannot silently forget, overclaim, or activate it.',
      sourceRef: currentInput().dispositionRef,
      directionRef: fileRef(LANE + '/EVIDENCE_ROUTES.md', 'signal-lineage-evidence-routes')
    },
    gap: {
      state: 'OPEN',
      reason: 'The knowledge frontier preserved counts and disposition identity but did not prove an exact current lineage row for each of the twelve items.',
      reportRef: Growth.reference(gaps.before, { id: 'signal-lineage-capability-gap-before', schema: gaps.before.schema }),
      existingCapabilityRef: null
    },
    provenance: [...candidate.sourceRefs, ...candidate.evidenceRefs],
    candidate: {
      strategy: 'COMPOSE',
      status: 'EXPERIMENTAL',
      artifactRef: candidateRef(candidate),
      sourceMutationPerformed: true,
      installed: false,
      promoted: false,
      canon: false
    },
    verification: {
      verdict: proof.verdict === 'PASS_WITH_DECLARED_LIMITS' ? 'PASS' : 'FAIL',
      subjectDigest: candidate.candidateDigest,
      receiptRef: proofRef(proof),
      evidenceAuthority: 'MIXED',
      limitations: proof.limitations
    },
    decision: null,
    availability: null,
    refresh: {
      trigger: 'NEW_INFORMATION',
      checkedAt: CYCLE_AT,
      due: false,
      reason: 'Rebuild when the research disposition, evidence source bytes, portfolio, human evidence state, case set, or verifier changes.'
    }
  });
}

function closure(id, refs) {
  const coveredDigests = Array.from(new Set(refs.map((item) => item.sha256))).sort();
  return {
    state: 'CURRENT',
    checkedAt: OUTCOME_AT,
    receiptRef: Growth.reference({ id, coveredDigests }, { id, schema: 'axm.evidence-closure-receipt/v1' }),
    coveredDigests
  };
}

function buildOutcome(candidate, proof, cycle, lineage, cases, evaluation) {
  const candidateReference = candidateRef(candidate);
  const proofReference = proofRef(proof);
  const cycleReference = internalRef(cycle.cycleId, cycle.schema, cycle.receiptDigest);
  const lineageReference = internalRef(lineage.lineageId, lineage.schema, lineage.receiptDigest);
  const casesReference = internalRef(cases.caseSetId, cases.schema, cases.caseSetDigest);
  const evaluationReference = internalRef(evaluation.evaluationId, evaluation.schema, evaluation.receiptDigest);
  const evidenceRefs = [candidateReference, proofReference, cycleReference, lineageReference, casesReference, evaluationReference];
  const systemBaseline = Growth.reference({
    acceptedSignals: 6,
    proposals: 6,
    perItemCurrentLineage: false,
    authorityBoundaryPerItem: false
  }, { id: 'signal-lineage-count-only-system-baseline', schema: 'axm.signal-lineage-system-baseline/v1' });
  const systemOutcome = Growth.reference({
    acceptedSignalsCovered: lineage.coverage.signalLinks,
    proposalsCovered: lineage.coverage.proposalLinks,
    technicalSignals: lineage.coverage.currentTechnicalSignals,
    waitingHumanSignals: lineage.coverage.waitingVoluntaryHumanSignals,
    autonomousActions: lineage.decision.autonomousActionCount
  }, { id: 'signal-lineage-exact-system-outcome', schema: 'axm.signal-lineage-system-outcome/v1' });
  const aiBaseline = Growth.reference(evaluation.baseline, {
    id: 'signal-lineage-ai-workflow-baseline',
    schema: 'axm.ai-workflow-evaluation-baseline/v1'
  });
  const aiOutcome = Growth.reference(evaluation.outcome, {
    id: 'signal-lineage-ai-workflow-outcome',
    schema: 'axm.ai-workflow-evaluation-outcome/v1'
  });
  return Growth.buildOutcome({
    outcomeId: 'grounded-growth-signal-lineage-20260820',
    generatedAt: OUTCOME_AT,
    cycleReceipt: cycle,
    interventionRef: candidateReference,
    previousOutcomeRef: null,
    noNewInformation: false,
    informationRefs: evidenceRefs,
    claims: [
      {
        id: 'signal-lineage-system-effect',
        beneficiary: 'SHARED_SYSTEM',
        statement: 'The exact current research disposition is covered by six signal lineage rows and six proposal non-action rows: five signals bind current technical evidence, one remains waiting for voluntary human-native evidence, and no row grants autonomous action.',
        kind: 'DETERMINISTIC_BEHAVIOR',
        verdict: 'PASS',
        proofSurface: 'FOCUSED_RUNTIME',
        baselineRef: systemBaseline,
        outcomeRef: systemOutcome,
        evidenceRefs,
        evidenceClosure: closure('signal-lineage-system-effect-closure', [systemBaseline, systemOutcome, ...evidenceRefs]),
        limitations: proof.limitations
      },
      {
        id: 'signal-lineage-human-benefit',
        beneficiary: 'HUMAN',
        statement: 'A person understands the research disposition more clearly or makes better stewardship decisions using exact signal lineage.',
        kind: 'WORKFLOW_OUTCOME',
        verdict: 'NOT_RUN',
        proofSurface: 'NOT_RUN',
        baselineRef: null,
        outcomeRef: null,
        evidenceRefs: [],
        evidenceClosure: null,
        limitations: ['No voluntary representative human comparison or scoped judgment was run.']
      },
      {
        id: 'signal-lineage-ai-workflow-benefit',
        beneficiary: 'AI_WORKFLOW',
        statement: 'On eight bounded Workshop lineage cases, exact signal lineage makes all eight expected continue, hold, or refuse decisions while an ID-and-count-only shortcut makes one of eight correct and admits seven unsupported or unsafe continuations.',
        kind: 'WORKFLOW_OUTCOME',
        verdict: 'PASS',
        proofSurface: 'AI_WORKFLOW_EVALUATION',
        baselineRef: aiBaseline,
        outcomeRef: aiOutcome,
        evidenceRefs,
        evidenceClosure: closure('signal-lineage-ai-workflow-closure', [aiBaseline, aiOutcome, ...evidenceRefs]),
        limitations: proof.limitations
      }
    ],
    refresh: {
      checkedAt: OUTCOME_AT,
      due: false,
      reason: 'Rebuild when the disposition, exact evidence sources, prior portfolio, case set, verifier, or beneficiary evidence changes.'
    }
  });
}

function buildPortfolio(outcome) {
  const prior = readJson(PRIOR_PORTFOLIO);
  assert.ok(Growth.verifyPortfolio(prior).pass, 'prior nine-outcome portfolio must verify');
  return Growth.buildPortfolio({
    portfolioId: 'axm-grounded-growth-current-signal-lineage-20260820',
    generatedAt: PORTFOLIO_AT,
    outcomes: [...prior.outcomes, outcome]
  });
}

function effectiveClaims(portfolio) {
  return portfolio.latest.flatMap((latest) => {
    const outcome = portfolio.outcomes.find((item) => item.receiptDigest === latest.effectiveReceiptDigest);
    if (!outcome) throw new Error('effective outcome missing for ' + latest.capabilityId);
    return outcome.claims;
  });
}

function buildSummary(lineage, cases, evaluation, candidate, proof, cycle, outcome, portfolio, currentState, gaps) {
  const verdicts = {};
  effectiveClaims(portfolio).forEach((claim) => {
    const key = claim.beneficiary + ':' + claim.admittedVerdict;
    verdicts[key] = (verdicts[key] || 0) + 1;
  });
  const summary = {
    schema: 'axm.grounded-growth-signal-lineage-summary/v1',
    generatedAt: CURRENT_AT,
    lineageRef: internalRef(lineage.lineageId, lineage.schema, lineage.receiptDigest),
    caseSetRef: internalRef(cases.caseSetId, cases.schema, cases.caseSetDigest),
    evaluationRef: internalRef(evaluation.evaluationId, evaluation.schema, evaluation.receiptDigest),
    candidateRef: candidateRef(candidate),
    proofRef: proofRef(proof),
    cycleRef: internalRef(cycle.cycleId, cycle.schema, cycle.receiptDigest),
    outcomeRef: internalRef(outcome.outcomeId, outcome.schema, outcome.receiptDigest),
    portfolioRef: internalRef(portfolio.portfolioId, portfolio.schema, portfolio.portfolioDigest),
    currentStateRef: internalRef(currentState.receiptId, currentState.schema, currentState.receiptDigest),
    lineage: {
      acceptedSignals: lineage.coverage.acceptedSignals,
      currentTechnicalSignals: lineage.coverage.currentTechnicalSignals,
      waitingVoluntaryHumanSignals: lineage.coverage.waitingVoluntaryHumanSignals,
      proposals: lineage.coverage.proposalLinks,
      rejectedOrRedundantProposals: lineage.coverage.rejectedOrRedundantProposals,
      deferredProposals: lineage.coverage.deferredProposals,
      autonomousActions: lineage.decision.autonomousActionCount,
      humanBenefitEstablished: false
    },
    evaluation: {
      cases: evaluation.outcome.totalDecisions,
      baselineCorrect: evaluation.baseline.correctDecisions,
      candidateCorrect: evaluation.outcome.correctDecisions,
      unsupportedBefore: evaluation.baseline.unsupportedOrUnsafeDecisions,
      unsupportedAfter: evaluation.outcome.unsupportedOrUnsafeDecisions,
      independentHeldOut: false
    },
    growth: {
      priorOutcomes: 9,
      currentOutcomes: portfolio.summary.outcomeCount,
      priorCapabilityChains: 5,
      currentCapabilityChains: portfolio.summary.capabilityCount,
      outcomeState: outcome.state,
      effectiveBeneficiaryVerdicts: verdicts,
      sharedSystemPass: verdicts['SHARED_SYSTEM:PASS'] || 0,
      aiWorkflowPass: verdicts['AI_WORKFLOW:PASS'] || 0,
      humanPass: verdicts['HUMAN:PASS'] || 0,
      humanNotRun: verdicts['HUMAN:NOT_RUN'] || 0
    },
    participation: {
      state: currentState.participationBinding.state,
      protectedCapabilityIds: currentState.participationBinding.protectedCapabilityIds,
      affectedProtectedCapabilityIds: currentState.participationBinding.affectedProtectedCapabilityIds,
      optionalReviewCandidates: currentState.participationBinding.optionalReviewCandidates,
      humanEvidencePresent: currentState.participationBinding.humanEvidencePresent,
      humanBenefitEstablished: currentState.participationBinding.humanBenefitEstablished
    },
    capabilityGap: {
      before: gaps.before.overall,
      after: gaps.after.overall,
      requiredMissingAfter: gaps.after.missingCapabilities.length,
      nativeHumanBenefit: gaps.after.requirements.find((item) => item.id === 'native-human-benefit').status,
      independentHeldOut: gaps.after.requirements.find((item) => item.id === 'independent-held-out-evaluation').status,
      detachedSourceTruth: gaps.after.requirements.find((item) => item.id === 'detached-source-truth').status
    },
    decision: currentState.decision,
    truth: {
      priorOutcomeBytesPreserved: true,
      exactLineageIsHumanBenefit: false,
      humanBenefitEstablished: false,
      modelLearningClaimed: false,
      broadGeneralizationClaimed: false,
      detachedSourceTruthClaimed: false,
      deferredHumanLedgerImplemented: false,
      participationStarted: false,
      installed: false,
      promoted: false,
      merged: false,
      canonized: false,
      foundationMutation: false
    },
    summaryDigest: null
  };
  const payload = clone(summary);
  delete payload.summaryDigest;
  summary.summaryDigest = Growth.sha256(payload);
  return summary;
}

function build() {
  const gaps = gapReports();
  const lineage = buildLineage();
  const cases = buildCases();
  const evaluation = buildEvaluation(cases);
  const candidate = buildCandidate(lineage, cases, evaluation, gaps);
  const proof = buildProof(candidate, lineage, cases, evaluation);
  assert.strictEqual(proof.verdict, 'PASS_WITH_DECLARED_LIMITS', 'signal-lineage proof must pass');
  const cycle = buildCycle(candidate, proof, gaps);
  const outcome = buildOutcome(candidate, proof, cycle, lineage, cases, evaluation);
  const portfolio = buildPortfolio(outcome);
  const participationFrontier = Participation.build();
  const recordedParticipation = readJson(PARTICIPATION_RECEIPT);
  assert.strictEqual(Growth.stableStringify(participationFrontier), Growth.stableStringify(recordedParticipation), 'participation frontier source must rebuild exactly');
  const currentStateInput = {
    receiptId: 'current-grounded-growth-signal-lineage-20260820',
    generatedAt: CURRENT_AT,
    participationFrontierReceipt: participationFrontier,
    participationFrontierInput: Participation.currentInput(),
    latestPortfolio: portfolio
  };
  const currentState = Current.build(currentStateInput);
  const summary = buildSummary(lineage, cases, evaluation, candidate, proof, cycle, outcome, portfolio, currentState, gaps);
  return { gaps, lineage, cases, evaluation, candidate, proof, cycle, outcome, portfolio, currentStateInput, currentState, summary };
}

function recorded() {
  return {
    gapBefore: readJson(LANE + '/CAPABILITY_GAP_BEFORE.json'),
    gapAfter: readJson(LANE + '/CAPABILITY_GAP_AFTER.json'),
    lineage: readJson(LANE + '/CURRENT_SIGNAL_LINEAGE_RECEIPT.json'),
    cases: readJson(LANE + '/SIGNAL_LINEAGE_CASES.json'),
    evaluation: readJson(LANE + '/SIGNAL_LINEAGE_AI_WORKFLOW_EVALUATION.json'),
    candidate: readJson(LANE + '/SIGNAL_LINEAGE_CANDIDATE.json'),
    proof: readJson(LANE + '/SIGNAL_LINEAGE_PROOF.json'),
    cycle: readJson(LANE + '/VERIFIED_CAPABILITY_CYCLE.json'),
    outcome: readJson(LANE + '/GROUNDED_GROWTH_OUTCOME.json'),
    portfolio: readJson(LANE + '/CURRENT_PORTFOLIO.json'),
    currentState: readJson(LANE + '/CURRENT_STATE_RECEIPT.json'),
    summary: readJson(LANE + '/CURRENT_SUMMARY.json')
  };
}

function loadRecordedCurrentRoute() {
  const current = recorded();
  const currentStateInput = {
    receiptId: 'current-grounded-growth-signal-lineage-20260820',
    generatedAt: CURRENT_AT,
    participationFrontierReceipt: readJson(PARTICIPATION_RECEIPT),
    participationFrontierInput: Participation.currentInput(),
    latestPortfolio: current.portfolio
  };
  const check = Current.verify(current.currentState, currentStateInput);
  if (!check.pass) {
    throw new Error('recorded signal-lineage current route is invalid: ' + check.errors.join('; '));
  }
  return { ...current, currentStateInput };
}

function checkRecorded() {
  const current = build();
  const expected = {
    gapBefore: current.gaps.before,
    gapAfter: current.gaps.after,
    lineage: current.lineage,
    cases: current.cases,
    evaluation: current.evaluation,
    candidate: current.candidate,
    proof: current.proof,
    cycle: current.cycle,
    outcome: current.outcome,
    portfolio: current.portfolio,
    currentState: current.currentState,
    summary: current.summary
  };
  assert.strictEqual(Growth.stableStringify(recorded()), Growth.stableStringify(expected), 'recorded signal-lineage artifacts differ from exact rebuild');
  return current;
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(__dirname, name), JSON.stringify(value, null, 2) + '\n');
}

function write() {
  const current = build();
  writeJson('CAPABILITY_GAP_BEFORE.json', current.gaps.before);
  writeJson('CAPABILITY_GAP_AFTER.json', current.gaps.after);
  writeJson('CURRENT_SIGNAL_LINEAGE_RECEIPT.json', current.lineage);
  writeJson('SIGNAL_LINEAGE_CASES.json', current.cases);
  writeJson('SIGNAL_LINEAGE_AI_WORKFLOW_EVALUATION.json', current.evaluation);
  writeJson('SIGNAL_LINEAGE_CANDIDATE.json', current.candidate);
  writeJson('SIGNAL_LINEAGE_PROOF.json', current.proof);
  writeJson('VERIFIED_CAPABILITY_CYCLE.json', current.cycle);
  writeJson('GROUNDED_GROWTH_OUTCOME.json', current.outcome);
  writeJson('CURRENT_PORTFOLIO.json', current.portfolio);
  writeJson('CURRENT_STATE_RECEIPT.json', current.currentState);
  writeJson('CURRENT_SUMMARY.json', current.summary);
  return current;
}

if (require.main === module) {
  try {
    const result = process.argv.includes('--write') ? write()
      : process.argv.includes('--check-recorded') ? checkRecorded()
        : build();
    process.stdout.write(JSON.stringify({
      lineage: result.lineage.state,
      signals: result.lineage.coverage.signalLinks,
      proposals: result.lineage.coverage.proposalLinks,
      evaluation: result.evaluation.outcome.correctDecisions + '/' + result.evaluation.outcome.totalDecisions,
      proof: result.proof.verdict,
      cycle: result.cycle.state,
      outcome: result.outcome.state,
      outcomes: result.portfolio.summary.outcomeCount,
      capabilityChains: result.portfolio.summary.capabilityCount,
      systemPass: result.summary.growth.sharedSystemPass,
      aiWorkflowPass: result.summary.growth.aiWorkflowPass,
      humanPass: result.summary.growth.humanPass,
      reviewCandidates: result.currentState.decision.reviewableActionCount,
      currentState: result.currentState.receiptDigest
    }, null, 2) + '\n');
  } catch (error) {
    process.stderr.write((error.stack || error.message) + '\n');
    process.exitCode = 1;
  }
}

module.exports = {
  ROOT,
  LANE,
  DISPOSITION_PATH,
  PRIOR_PORTFOLIO,
  PRIOR_CURRENT_STATE,
  PARTICIPATION_RECEIPT,
  CANDIDATE_SOURCE_FILES,
  EVIDENCE_SOURCE_DEFS,
  readJson,
  fileRef,
  selfDigestValid,
  gapReports,
  currentInput,
  buildLineage,
  decisionForBuild,
  shortcutDecision,
  buildCases,
  buildEvaluation,
  buildCandidate,
  buildProof,
  buildCycle,
  buildOutcome,
  buildPortfolio,
  build,
  recorded,
  loadRecordedCurrentRoute,
  checkRecorded,
  write
};
