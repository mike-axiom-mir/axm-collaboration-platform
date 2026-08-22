#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const prefix = 'model.shadow.retention-audit-review-outcome-transition-settlement-history-pairwise-observer.';
const required = [
  ['upstream-v38-current-frontier', 'model.shadow.retention-audit-review-outcome-transition-settlement-pairwise-observer.current-settled-head-comparison'],
  ['double-complete-history-capture', prefix + 'two-v37-complete-local-history-double-capture'],
  ['triple-full-chain-inspect', prefix + 'three-v37-full-chain-inspections-per-side'],
  ['artifact-self-digest-recheck', prefix + 'canonical-artifact-self-digest-recheck'],
  ['stable-history-commitment', prefix + 'stable-complete-history-commitment'],
  ['normalized-event-projection', prefix + 'normalized-proposal-settlement-event-projection'],
  ['intermediate-held-coverage', prefix + 'intermediate-held-outcome-coverage'],
  ['exact-artifact-replay', prefix + 'exact-complete-artifact-history-replay'],
  ['matching-normalized-history', prefix + 'matching-complete-normalized-history'],
  ['right-prefix-extension', prefix + 'right-complete-history-prefix-extension'],
  ['left-prefix-extension', prefix + 'left-complete-history-prefix-extension'],
  ['earliest-divergence', prefix + 'earliest-normalized-event-divergence'],
  ['source-identity-hold', prefix + 'source-identity-mismatch-hold'],
  ['history-observation-hold', prefix + 'typed-history-observation-hold'],
  ['fresh-process-rebuild', prefix + 'fresh-process-exact-rebuild'],
  ['read-only-roots', prefix + 'read-only-source-and-settlement-roots'],
  ['same-snapshot-hidden-history', prefix + 'same-head-hidden-held-history-counterexample'],
  ['transient-reversion-nonexclusion', prefix + 'transient-mutation-reversion-nonexclusion'],
  ['joint-replacement-counterexample', prefix + 'joint-pair-replacement-counterexample'],
  ['minimization-bounds', prefix + 'data-minimization-resource-boundary'],
  ['closed-schema', prefix + 'closed-receipt-schema'],
  ['authority-none', prefix + 'authority-none']
];
const optional = [
  ['live-v36-source-currentness', prefix + 'live-v36-source-recapture-and-entry-currentness'],
  ['authenticated-independent-roots', prefix + 'authenticated-independent-root-controllers'],
  ['external-retention', prefix + 'external-retention-or-independent-custody'],
  ['atomic-current-history', prefix + 'atomic-current-complete-history-snapshot-or-later-currentness'],
  ['protected-monotonic-state', prefix + 'protected-monotonic-state-or-rollback-prevention'],
  ['global-consistency', prefix + 'withheld-history-exclusion-global-uniqueness-or-consistent-log'],
  ['trusted-time', prefix + 'externally-trusted-observation-time'],
  ['external-reconciliation', prefix + 'authenticated-external-reconciliation-or-settlement-resolution'],
  ['independent-schema-validation', prefix + 'independent-draft-2020-12-validation'],
  ['provider-evaluation', prefix + 'provider-execution-or-evaluation'],
  ['benefit-learning', prefix + 'human-benefit-or-learning-proof'],
  ['consequential-authority', prefix + 'execution-adoption-promotion-merge-or-canon-authority']
];
const requirements = { schema: 'axm.capability-requirements/v1', requirements: required.map(([id, capability]) => ({ id, required: true, capabilities: [capability] })).concat(optional.map(([id, capability]) => ({ id, required: false, capabilities: [capability] }))) };
const before = {
  schema: 'axm.capability-inventory/v1', observedAt: '2026-08-21T16:00:00.000Z',
  capabilities: [{
    id: required[0][1], status: 'available',
    constraints: ['committed v3.8 TEST compares current snapshots and latest settlement receipts but explicitly leaves complete proposal and settlement history comparison false']
  }]
};
const routes = {
  schema: 'axm.evidence-routes/v1', status: 'TEST', routes: [
    {
      claimId: 'complete-local-history-admission', kind: 'persistence',
      primarySurface: 'three v3.7 full-chain inspections two canonical complete-history captures and per-artifact self-digest checks on each side',
      passCondition: 'a side is admitted only when all snapshots and both complete captures are present equal self-digest-valid and count/reference-consistent',
      counterevidence: 'the sequential observations are not an atomic filesystem snapshot and cannot exclude adversarial mutation and reversion',
      observedEvidence: 'absent invalid changing capture-invalid and snapshot-mismatched roots receive distinct executed side observations', verdict: 'PASS'
    },
    {
      claimId: 'complete-normalized-history-comparison', kind: 'deterministic behavior',
      primarySurface: 'all seven pairwise classification fixtures over complete ordered proposal and settlement event digests',
      passCondition: 'compatible admitted histories distinguish exact artifact replay normalized equality either prefix direction and earliest divergence',
      counterevidence: 'normalization deliberately omits local ids times and local binding references and proves no global history order',
      observedEvidence: 'all classifications execute and first divergence retains only event index kind sequence and content digests', verdict: 'PASS'
    },
    {
      claimId: 'same-snapshot-hidden-held-history-counterexample', kind: 'behavioral',
      primarySurface: 'two valid v3.7 roots with one different intermediate held settlement and otherwise identical local artifacts',
      passCondition: 'v3.8 exact snapshot replay coexists with a v3.9 first-settlement complete-history divergence',
      counterevidence: 'withheld roots and jointly replaced pairs remain outside the presented comparison',
      observedEvidence: 'the roots share one exact v3.7 snapshot reference final head and counts while v3.9 locates different held-source classifications', verdict: 'PASS'
    },
    {
      claimId: 'read-only-minimized-commitment-and-schema', kind: 'technical',
      primarySurface: 'tree digests fresh-process rebuild closed schema runtime static scan and receipt omission assertions',
      passCondition: 'observation writes no root bytes and emits bounded commitments without raw records paths packages keys signatures or private content',
      counterevidence: 'the observer still reads caller-owned local files and an independent Draft 2020-12 meta-validator is unavailable',
      observedEvidence: 'before-after tree digests match fresh-process build and verify pass and every non-null receipt object matches a closed local schema shape', verdict: 'PASS'
    },
    {
      claimId: 'atomicity-custody-globality-benefit-and-authority-boundary', kind: 'authorization',
      primarySurface: 'truth object schema contract README frontier audit and static runtime checks',
      passCondition: 'artifacts explicitly deny atomicity later currentness authenticated independence external custody globality trusted time benefit learning consequential action and CANON',
      counterevidence: 'callers control both roots and observation time and Mike Tobi or AXM has not merged reconciled or canonized this TEST material',
      observedEvidence: 'closed truth fixes negative claims and runtime performs no write network provider evaluation reconciliation or Foundation mutation', verdict: 'PASS'
    }
  ]
};
for (const [name, value] of [['CAPABILITY_REQUIREMENTS.json', requirements], ['CAPABILITY_INVENTORY_BEFORE.json', before], ['EVIDENCE_ROUTES.json', routes]]) fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', 'utf8');
console.log('PASS wrote capability requirements baseline and five evidence routes');
