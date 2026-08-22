#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Loop = require('../verified-capability-loop/verified-capability-loop');
const Growth = require('./grounded-growth-outcomes');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

const at = '2026-08-19T05:00:00.000Z';
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'grounded-growth-outcome.schema.json'), 'utf8'));
const portfolioSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'grounded-growth-portfolio.schema.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
check(schema.$id === Growth.OUTCOME_SCHEMA, 'outcome schema identity matches the implementation');
check(portfolioSchema.$id === Growth.PORTFOLIO_SCHEMA, 'portfolio schema identity matches the implementation');
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module contract stays TEST with no permissions or writes');

function availableCycle(refreshDue) {
  const candidateRef = Loop.reference({ candidate: 'beneficiary outcome adapter' }, { id: 'candidate', schema: 'text/javascript' });
  const verificationRef = Loop.reference({ checks: 12, result: 'PASS' }, { id: 'verification', schema: 'axm.focused-test-receipt/v1' });
  return Loop.build({
    cycleId: 'cycle-grounded-growth',
    capabilityId: 'growth.beneficiary-outcome/v1',
    generatedAt: at,
    baseline: {
      kind: 'git-and-worktree',
      identity: 'bounded selftest fixture',
      receiptRef: Loop.reference({ baseline: 'fixture' }, { id: 'baseline', schema: 'axm.baseline-observation/v1' })
    },
    need: {
      id: 'need-beneficiary-outcome',
      statement: 'Capability availability must not be mistaken for demonstrated benefit.',
      sourceRef: Loop.reference({ need: 'grounded growth' }, { id: 'need', schema: 'axm.workshop-need/v1' })
    },
    gap: {
      state: 'OPEN',
      reason: 'No beneficiary-specific outcome receipt exists.',
      reportRef: Loop.reference({ missing: 'beneficiary outcome' }, { id: 'gap', schema: 'axm.capability-gap-report/v1' })
    },
    provenance: [Loop.reference({ source: 'current workshop' }, { id: 'provenance', schema: 'axm.source-provenance/v1' })],
    candidate: {
      strategy: 'ADAPT', status: 'EXPERIMENTAL', artifactRef: candidateRef,
      sourceMutationPerformed: true, installed: false, promoted: false, canon: false
    },
    verification: {
      verdict: 'PASS', subjectDigest: candidateRef.sha256, receiptRef: verificationRef,
      evidenceAuthority: 'MIXED', limitations: ['The fixture proves receipt behavior, not a real beneficiary outcome.']
    },
    decision: {
      verdict: 'CONTINUE', actorKind: 'HUMAN', actorId: 'mike', candidateDigest: candidateRef.sha256,
      confirmation: 'CONTINUE VERIFIED CAPABILITY',
      decisionRef: Loop.reference({ verdict: 'CONTINUE', candidate: candidateRef.sha256 }, { id: 'decision', schema: 'axm.review-decision/v1' })
    },
    availability: {
      status: 'AVAILABLE', candidateDigest: candidateRef.sha256, authorityId: 'fixture-availability-authority',
      receiptRef: Loop.reference({ available: candidateRef.sha256 }, { id: 'availability', schema: 'axm.module-availability-receipt/v1' })
    },
    refresh: {
      trigger: 'NEW_INFORMATION', checkedAt: at, due: refreshDue === true,
      reason: refreshDue ? 'Fixture baseline changed.' : 'Fixture baseline is current.'
    }
  });
}

function candidateCycle() {
  const available = availableCycle(false);
  return Loop.build({
    cycleId: available.cycleId,
    capabilityId: available.capabilityId,
    generatedAt: available.generatedAt,
    baseline: available.baseline,
    need: available.need,
    gap: available.gap,
    provenance: available.provenance,
    candidate: available.candidate,
    verification: available.verification,
    decision: null,
    availability: null,
    refresh: available.refresh
  });
}

function ref(id, value, schemaName) {
  return Growth.reference(value, { id, schema: schemaName || 'axm.test-evidence/v1' });
}

function closure(state) {
  const covered = [
    ref('claim-baseline', { before: 'baseline' }).sha256,
    ref('claim-outcome', { after: 'outcome' }).sha256,
    ref('claim-evidence', { observed: true }).sha256
  ];
  return {
    state: state || 'CURRENT',
    checkedAt: at,
    receiptRef: ref('evidence-closure', { state: state || 'CURRENT', covered }, 'axm.evidence-closure-receipt/v1'),
    coveredDigests: covered
  };
}

function claim(input) {
  return Object.assign({
    id: 'claim-' + String(input.beneficiary || 'system').toLowerCase(),
    statement: 'The declared beneficiary completed the representative outcome with the candidate.',
    kind: 'WORKFLOW_OUTCOME',
    verdict: 'PASS',
    baselineRef: ref('claim-baseline', { before: 'baseline' }),
    outcomeRef: ref('claim-outcome', { after: 'outcome' }),
    evidenceRefs: [ref('claim-evidence', { observed: true })],
    evidenceClosure: closure('CURRENT'),
    limitations: ['Selftest evidence is synthetic and proves routing only.']
  }, input);
}

function outcome(extra) {
  return Growth.buildOutcome(Object.assign({
    outcomeId: 'outcome-grounded-growth-1',
    generatedAt: at,
    cycleReceipt: availableCycle(false),
    informationRefs: [ref('new-information', { signal: 'new beneficiary evidence' })],
    claims: [],
    refresh: { checkedAt: at, due: false, reason: 'Fixture evidence is current.' }
  }, extra || {}));
}

const unknown = outcome();
check(unknown.state === 'AVAILABLE_EFFECT_UNKNOWN', 'an available capability is not automatically a growth outcome');
check(unknown.nextEvidenceNeeds.includes('HUMAN_BENEFIT_NATIVE_EVIDENCE') && unknown.nextEvidenceNeeds.includes('AI_WORKFLOW_BENEFIT_NATIVE_EVIDENCE'), 'unknown outcome names both missing beneficiary proof routes');

const system = outcome({ claims: [claim({
  id: 'claim-system', beneficiary: 'SHARED_SYSTEM', kind: 'DETERMINISTIC_BEHAVIOR', proofSurface: 'FOCUSED_RUNTIME'
})] });
check(system.state === 'SYSTEM_EFFECT_ONLY', 'focused runtime proof establishes a shared-system effect only');
check(system.growthClaim.includes('BENEFICIARY_OUTCOMES_UNKNOWN'), 'system effect does not become human or AI benefit');

const candidate = outcome({ cycleReceipt: candidateCycle(), claims: [claim({
  id: 'claim-candidate-system', beneficiary: 'SHARED_SYSTEM', kind: 'DETERMINISTIC_BEHAVIOR', proofSurface: 'FOCUSED_RUNTIME'
})] });
check(candidate.state === 'CANDIDATE_ONLY', 'verified candidate evidence does not become installed Workshop growth');

const badHumanRoute = outcome({ claims: [claim({ beneficiary: 'HUMAN', proofSurface: 'FOCUSED_RUNTIME' })] });
check(badHumanRoute.state === 'EVIDENCE_HOLD', 'deterministic runtime proof cannot substitute for a human outcome');
check(badHumanRoute.claims[0].admittedVerdict === 'UNKNOWN', 'held human PASS is demoted to UNKNOWN');

const human = outcome({ claims: [claim({ beneficiary: 'HUMAN', proofSurface: 'REPRESENTATIVE_USER_JOURNEY' })] });
check(human.state === 'HUMAN_GROWTH_ONLY', 'human-native journey evidence establishes human growth only');

const badAiRoute = outcome({ claims: [claim({ beneficiary: 'AI_WORKFLOW', proofSurface: 'INDEPENDENT_RUNTIME' })] });
check(badAiRoute.state === 'EVIDENCE_HOLD', 'component runtime proof cannot substitute for an AI-workflow outcome');

const ai = outcome({ claims: [claim({ beneficiary: 'AI_WORKFLOW', proofSurface: 'AI_WORKFLOW_EVALUATION' })] });
check(ai.state === 'AI_WORKFLOW_GROWTH_ONLY', 'representative AI-workflow evidence establishes AI-workflow growth only');

const shared = outcome({ claims: [
  claim({ id: 'claim-human', beneficiary: 'HUMAN', proofSurface: 'REPRESENTATIVE_USER_JOURNEY' }),
  claim({ id: 'claim-ai', beneficiary: 'AI_WORKFLOW', proofSurface: 'HELD_OUT_EVALUATION' })
] });
check(shared.state === 'GROUNDED_SHARED_GROWTH', 'separate native human and AI evidence establishes grounded shared growth');
check(shared.truth.modelWeightTrainingClaimed === false && shared.truth.automaticCanon === false, 'shared growth claims neither model training nor CANON authority');

const heldClosure = outcome({ claims: [claim({
  beneficiary: 'HUMAN', proofSurface: 'REPRESENTATIVE_USER_JOURNEY', evidenceClosure: closure('HELD')
})] });
check(heldClosure.state === 'EVIDENCE_HOLD', 'held evidence closure prevents a beneficiary PASS');

const unrelatedClosure = outcome({ claims: [claim({
  beneficiary: 'HUMAN',
  proofSurface: 'REPRESENTATIVE_USER_JOURNEY',
  evidenceClosure: {
    state: 'CURRENT',
    checkedAt: at,
    receiptRef: ref('unrelated-closure', { current: true }, 'axm.evidence-closure-receipt/v1'),
    coveredDigests: [ref('unrelated-source', { current: true }).sha256]
  }
})] });
check(unrelatedClosure.state === 'EVIDENCE_HOLD', 'an unrelated current closure cannot freshen a beneficiary claim');

const regression = outcome({ claims: [claim({
  beneficiary: 'AI_WORKFLOW', proofSurface: 'AI_WORKFLOW_EVALUATION', verdict: 'FAIL'
})] });
check(regression.state === 'REGRESSION_HOLD', 'a native beneficiary FAIL becomes a regression hold');

const refresh = outcome({ cycleReceipt: availableCycle(true) });
check(refresh.state === 'REFRESH_REQUIRED', 'changed capability evidence reopens beneficiary outcomes');

const tampered = JSON.parse(JSON.stringify(shared));
tampered.state = 'AVAILABLE_EFFECT_UNKNOWN';
check(!Growth.verifyOutcome(tampered).pass, 'tampered derived outcome state fails verification');
check(Growth.verifyOutcome(shared).pass, 'fresh grounded-growth outcome verifies deterministically');

assert.throws(() => outcome({ noNewInformation: true, informationRefs: [], claims: [] }), /previous outcome/);
checks += 1; console.log('PASS no-new-information cannot erase ancestry');
assert.throws(() => outcome({ claims: [claim({ id: 'duplicate', beneficiary: 'HUMAN', proofSurface: 'HUMAN_OBSERVATION' }), claim({ id: 'duplicate', beneficiary: 'AI_WORKFLOW', proofSurface: 'HELD_OUT_EVALUATION' })] }), /unique/);
checks += 1; console.log('PASS duplicate claim identities are refused');

const noNew = outcome({
  outcomeId: 'outcome-grounded-growth-2',
  generatedAt: '2026-08-19T06:00:00.000Z',
  previousOutcomeRef: { id: shared.outcomeId, schema: Growth.OUTCOME_SCHEMA, sha256: shared.receiptDigest },
  noNewInformation: true,
  informationRefs: [],
  claims: []
});
check(noNew.state === 'NO_NEW_INFORMATION', 'unchanged evidence creates no new growth claim');

const portfolio = Growth.buildPortfolio({
  portfolioId: 'portfolio-grounded-growth',
  generatedAt: '2026-08-19T06:00:01.000Z',
  outcomes: [shared, noNew]
});
check(portfolio.summary.outcomeCount === 2 && portfolio.summary.capabilityCount === 1, 'portfolio preserves both generations without double-counting capability identity');
check(portfolio.latest[0].state === 'NO_NEW_INFORMATION' && portfolio.latest[0].effectiveState === 'GROUNDED_SHARED_GROWTH', 'latest no-new receipt preserves the last substantive outcome');
check(portfolio.summary.overall === 'GROUNDED_SHARED_GROWTH_PRESENT', 'no-new check does not erase or manufacture the effective portfolio state');
check(Growth.verifyPortfolio(portfolio).pass, 'fresh longitudinal portfolio verifies deterministically');

const changedNoNew = outcome({
  outcomeId: 'outcome-grounded-growth-changed-no-new',
  generatedAt: '2026-08-19T06:00:02.000Z',
  cycleReceipt: availableCycle(true),
  previousOutcomeRef: { id: shared.outcomeId, schema: Growth.OUTCOME_SCHEMA, sha256: shared.receiptDigest },
  noNewInformation: true,
  informationRefs: [],
  claims: []
});
assert.throws(() => Growth.buildPortfolio({ portfolioId: 'changed-no-new', generatedAt: at, outcomes: [shared, changedNoNew] }), /changed capability cycle|due refresh/);
checks += 1; console.log('PASS no-new-information cannot hide a changed capability cycle');

const regressionFirst = outcome({
  outcomeId: 'outcome-regression-1',
  claims: [claim({ beneficiary: 'AI_WORKFLOW', proofSurface: 'AI_WORKFLOW_EVALUATION', verdict: 'FAIL' })]
});
const regressionNoNew = outcome({
  outcomeId: 'outcome-regression-2',
  generatedAt: '2026-08-19T06:00:03.000Z',
  previousOutcomeRef: { id: regressionFirst.outcomeId, schema: Growth.OUTCOME_SCHEMA, sha256: regressionFirst.receiptDigest },
  noNewInformation: true,
  informationRefs: [],
  claims: []
});
const regressionPortfolio = Growth.buildPortfolio({ portfolioId: 'regression-carry', generatedAt: '2026-08-19T06:00:04.000Z', outcomes: [regressionFirst, regressionNoNew] });
check(regressionPortfolio.summary.overall === 'HOLD' && regressionPortfolio.latest[0].effectiveState === 'REGRESSION_HOLD', 'no-new-information cannot hide an earlier regression hold');

const brokenAncestry = JSON.parse(JSON.stringify(noNew));
brokenAncestry.previousOutcomeRef.sha256 = 'sha256:' + '0'.repeat(64);
brokenAncestry.receiptDigest = Growth.buildOutcome({
  outcomeId: brokenAncestry.outcomeId,
  generatedAt: brokenAncestry.generatedAt,
  cycleReceipt: brokenAncestry.cycleReceipt,
  previousOutcomeRef: brokenAncestry.previousOutcomeRef,
  noNewInformation: true,
  informationRefs: [],
  claims: [],
  refresh: brokenAncestry.refresh
}).receiptDigest;
assert.throws(() => Growth.buildPortfolio({ portfolioId: 'broken', generatedAt: at, outcomes: [shared, brokenAncestry] }), /ancestry mismatch/);
checks += 1; console.log('PASS portfolio refuses a skipped or mismatched outcome parent');

console.log('\nGrounded Growth Outcomes selftest: PASS (' + checks + ' checks)');
