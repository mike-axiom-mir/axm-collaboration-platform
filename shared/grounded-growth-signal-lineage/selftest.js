#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Cycle = require('../verified-capability-loop/verified-capability-loop');
const Growth = require('../grounded-growth-outcomes/grounded-growth-outcomes');
const Lineage = require('./grounded-growth-signal-lineage');

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}

const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module remains permissionless TEST with no writes');
check(contract.consumes.includes('strict-deterministic-canonical-json') && contract.boundaries.refuses.includes('undefined-or-non-json-representable-state'), 'contract declares strict representation closure');
check(Lineage.stableStringify({ z: 1, a: [true, null] }) === '{"a":[true,null],"z":1}', 'safe canonical bytes remain exact');
assert.throws(() => Lineage.stableStringify({ lost: undefined }), /unsupported undefined/i);
checks += 1;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ref(id, schema, value) {
  return { id, schema, sha256: Lineage.sha256(value) };
}

const at = '2026-08-20T00:20:00.000Z';
const cycle = Cycle.build({
  cycleId: 'cycle-signal-lineage-fixture',
  capabilityId: 'fixture.capability',
  generatedAt: at,
  baseline: {
    kind: 'fixture',
    identity: 'signal-lineage-fixture',
    receiptRef: ref('fixture-baseline', 'axm.fixture/v1', { baseline: true })
  },
  need: {
    id: 'fixture-need',
    statement: 'Preserve an exact signal through current evidence.',
    sourceRef: ref('fixture-need-source', 'axm.fixture/v1', { need: true }),
    directionRef: null
  },
  gap: {
    state: 'NO_GAP',
    reason: 'The fixture reuses one existing capability.',
    reportRef: ref('fixture-gap', 'axm.fixture/v1', { gap: false }),
    existingCapabilityRef: ref('fixture-capability', 'text/javascript', { capability: true })
  },
  provenance: [],
  candidate: null,
  verification: null,
  decision: null,
  availability: null,
  refresh: { trigger: 'NEW_INFORMATION', checkedAt: at, due: false, reason: 'Fixture stays current until its evidence changes.' }
});

const systemEvidence = ref('fixture-system-evidence', 'axm.fixture-evidence/v1', { cases: 2, pass: 2 });
const systemBaseline = ref('fixture-system-baseline', 'axm.fixture/v1', { routed: false });
const systemOutcome = ref('fixture-system-outcome', 'axm.fixture/v1', { routed: true });
const closure = {
  state: 'CURRENT',
  checkedAt: at,
  receiptRef: ref('fixture-closure', 'axm.evidence-closure-receipt/v1', { current: true }),
  coveredDigests: [systemBaseline.sha256, systemOutcome.sha256, systemEvidence.sha256].sort()
};
const outcome = Growth.buildOutcome({
  outcomeId: 'fixture-outcome',
  generatedAt: at,
  cycleReceipt: cycle,
  interventionRef: cycle.gap.existingCapabilityRef,
  previousOutcomeRef: null,
  noNewInformation: false,
  informationRefs: [systemEvidence],
  claims: [
    {
      id: 'fixture-system-claim',
      beneficiary: 'SHARED_SYSTEM',
      statement: 'The fixture routes one technical signal to current evidence.',
      kind: 'DETERMINISTIC_BEHAVIOR',
      verdict: 'PASS',
      proofSurface: 'FOCUSED_RUNTIME',
      baselineRef: systemBaseline,
      outcomeRef: systemOutcome,
      evidenceRefs: [systemEvidence],
      evidenceClosure: closure,
      limitations: ['Fixture evidence proves only the declared deterministic behavior.']
    },
    {
      id: 'fixture-human-claim',
      beneficiary: 'HUMAN',
      statement: 'A person benefits from the fixture lineage.',
      kind: 'WORKFLOW_OUTCOME',
      verdict: 'NOT_RUN',
      proofSurface: 'NOT_RUN',
      baselineRef: null,
      outcomeRef: null,
      evidenceRefs: [],
      evidenceClosure: null,
      limitations: ['No human journey ran.']
    }
  ],
  refresh: { checkedAt: at, due: false, reason: 'Refresh when fixture evidence changes.' }
});
const portfolio = Growth.buildPortfolio({ portfolioId: 'fixture-portfolio', generatedAt: at, outcomes: [outcome] });
const disposition = {
  schema: 'axm.research-disposition/v1',
  dispositionId: 'fixture-disposition',
  acceptedSignals: [
    {
      id: 'signal:technical',
      statement: 'Technical evidence should stay connected to its source signal.',
      stage: 'OBSERVED',
      sourceIds: ['research:fixture'],
      cheapestTest: 'Verify exact lineage.',
      uncertainty: 'Fixture only.',
      solutionAlternatives: ['Wait.'],
      currentDisposition: 'REUSED_EXISTING_REPAIR'
    },
    {
      id: 'signal:human',
      statement: 'Human usefulness requires a voluntary human outcome.',
      stage: 'UNKNOWN',
      sourceIds: ['research:fixture'],
      cheapestTest: 'Run a voluntary comparison.',
      uncertainty: 'No person participated.',
      solutionAlternatives: ['Wait.'],
      currentDisposition: 'WAIT_FOR_VOLUNTARY_EVIDENCE'
    }
  ],
  rejectedOrDeferred: [
    { id: 'proposal:auto', disposition: 'REJECTED', reason: 'No automatic authority.' },
    { id: 'proposal:ledger', disposition: 'DEFERRED', reason: 'Human usefulness is unmeasured.' }
  ],
  truth: { signalsAreProof: false, automaticAction: false }
};
const sourceA = { ...ref('module-source', 'text/javascript', { module: true }), role: 'CURRENT_TECHNICAL_SOURCE' };
const sourceB = { ...ref('human-packet', 'axm.human-packet/v1', { answers: false }), role: 'ANSWER_FREE_HUMAN_ROUTE' };
const input = {
  lineageId: 'fixture-lineage',
  generatedAt: at,
  disposition,
  dispositionRef: ref('fixture-disposition', disposition.schema, disposition),
  portfolio,
  evidenceSources: [sourceA, sourceB],
  signalLinks: [
    {
      signalId: 'signal:technical',
      state: 'CURRENT_TECHNICAL_EVIDENCE',
      evidenceRefIds: ['module-source'],
      outcomeBindings: [{
        outcomeId: outcome.outcomeId,
        receiptDigest: outcome.receiptDigest,
        claimId: 'fixture-system-claim',
        beneficiary: 'SHARED_SYSTEM',
        admittedVerdict: 'PASS',
        proofSurface: 'FOCUSED_RUNTIME'
      }],
      requiredEvent: null,
      notes: 'Current technical evidence is exact-bound.'
    },
    {
      signalId: 'signal:human',
      state: 'WAITING_VOLUNTARY_HUMAN_EVIDENCE',
      evidenceRefIds: ['human-packet'],
      outcomeBindings: [],
      requiredEvent: 'VOLUNTARY_HUMAN_NATIVE_EVIDENCE',
      notes: 'Packet readiness is not a human result.'
    }
  ],
  proposalLinks: [
    { proposalId: 'proposal:auto', state: 'REJECTED_NO_ACTION', evidenceRefIds: [], notes: 'Rejection remains a non-action.' },
    { proposalId: 'proposal:ledger', state: 'DEFERRED_NO_ACTION', evidenceRefIds: [], notes: 'This receipt does not implement a human-facing ledger.' }
  ]
};

const receipt = Lineage.build(input);
check(receipt.state === 'CURRENT_WITH_OPEN_HUMAN_EVIDENCE', 'human evidence remains open');
check(receipt.coverage.acceptedSignals === 2 && receipt.coverage.signalLinks === 2, 'all accepted signals are covered');
check(receipt.coverage.currentTechnicalSignals === 1, 'one technical signal is current');
check(receipt.coverage.waitingVoluntaryHumanSignals === 1, 'one human signal remains waiting');
check(receipt.coverage.proposalLinks === 2, 'all proposals are covered');
check(receipt.decision.autonomousActionCount === 0 && receipt.decision.reviewableActionCount === 0, 'lineage grants no action');
check(receipt.truth.deferredSignalLedgerImplemented === false, 'deferred ledger is not silently implemented');
check(Lineage.verify(receipt, input).pass, 'native exact rebuild passes');
const portable = Lineage.verifyPortable(receipt);
check(portable.pass, 'portable integrity passes');
check(portable.sourceTruth === 'UNKNOWN' && portable.sourceCurrentness === 'UNKNOWN', 'portable mode preserves source unknowns');

const missingSignal = clone(input);
missingSignal.signalLinks.pop();
assert.throws(() => Lineage.build(missingSignal), /every accepted signal/);
checks += 1;

const unknownEvidence = clone(input);
unknownEvidence.signalLinks[0].evidenceRefIds = ['missing-source'];
assert.throws(() => Lineage.build(unknownEvidence), /unknown evidence source/);
checks += 1;

const fakeHumanClosure = clone(input);
fakeHumanClosure.signalLinks[1].state = 'CURRENT_TECHNICAL_EVIDENCE';
fakeHumanClosure.signalLinks[1].requiredEvent = null;
assert.throws(() => Lineage.build(fakeHumanClosure), /unknown human signal/);
checks += 1;

const autoProposal = clone(input);
autoProposal.proposalLinks[0].state = 'DEFERRED_NO_ACTION';
assert.throws(() => Lineage.build(autoProposal), /does not preserve/);
checks += 1;

const staleOutcome = clone(input);
staleOutcome.signalLinks[0].outcomeBindings[0].receiptDigest = 'sha256:' + '0'.repeat(64);
assert.throws(() => Lineage.build(staleOutcome), /outcome digest mismatch/);
checks += 1;

const changedDisposition = clone(input);
changedDisposition.disposition.acceptedSignals[0].statement = 'Changed without changing the bound reference.';
assert.throws(() => Lineage.build(changedDisposition), /does not bind/);
checks += 1;

const missingPortableRow = clone(receipt);
missingPortableRow.signals.pop();
missingPortableRow.coverage.acceptedSignals = 1;
missingPortableRow.coverage.signalLinks = 1;
missingPortableRow.receiptDigest = Lineage.sha256(Object.fromEntries(Object.entries(missingPortableRow).filter(([key]) => key !== 'receiptDigest')));
check(!Lineage.verifyPortable(missingPortableRow).pass, 'portable coverage refuses a removed row after digest recomputation');

const authorityInflation = clone(receipt);
authorityInflation.decision.autonomousActionCount = 1;
authorityInflation.receiptDigest = Lineage.sha256(Object.fromEntries(Object.entries(authorityInflation).filter(([key]) => key !== 'receiptDigest')));
check(!Lineage.verifyPortable(authorityInflation).pass, 'portable authority inflation is refused after digest recomputation');

const proposalAction = clone(receipt);
proposalAction.proposals[0].action = 'EXECUTE';
proposalAction.receiptDigest = Lineage.sha256(Object.fromEntries(Object.entries(proposalAction).filter(([key]) => key !== 'receiptDigest')));
check(!Lineage.verifyPortable(proposalAction).pass, 'portable proposal action is refused after digest recomputation');

const extraField = clone(receipt);
extraField.hiddenAuthority = true;
extraField.receiptDigest = Lineage.sha256(Object.fromEntries(Object.entries(extraField).filter(([key]) => key !== 'receiptDigest')));
check(!Lineage.verifyPortable(extraField).pass, 'portable unknown top-level field is refused');

check(receipt.signals.find((item) => item.signalId === 'signal:human').humanBenefitClaimed === false, 'human waiting row claims no benefit');
check(receipt.proposals.every((item) => item.action === 'NONE' && item.automaticAction === false), 'every proposal remains a non-action');
check(receipt.truth.automaticInstall === false && receipt.truth.automaticCanon === false, 'install and canon authority remain false');
check(receipt.sourceRefs.portfolio.sha256 === portfolio.portfolioDigest, 'receipt binds the exact portfolio digest');
check(receipt.sourceRefs.disposition.sha256 === Lineage.sha256(disposition), 'receipt binds the exact disposition digest');

process.stdout.write('PASS Grounded Growth signal-lineage selftest (' + checks + ' assertions)\n');
