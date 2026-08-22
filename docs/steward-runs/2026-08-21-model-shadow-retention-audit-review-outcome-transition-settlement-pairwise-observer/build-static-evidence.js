#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const prefix = 'model.shadow.retention-audit-review-outcome-transition-settlement-pairwise-observer.';
const required = [
  ['upstream-v37-package-rebuild', 'model.shadow.retention-audit-review-outcome-transition-settlement-ledger.caller-package-persisted-proposal-and-settlement-rebuild'],
  ['two-current-packages', prefix + 'two-v37-current-settlement-package-exact-rebuild'],
  ['bracketing-observation', prefix + 'equal-bracketing-snapshot-observation-per-side'],
  ['pending-noncurrent-hold', prefix + 'pending-and-noncurrent-package-hold'],
  ['source-identity-comparison', prefix + 'source-identity-comparison'],
  ['head-comparison', prefix + 'current-settled-head-comparison'],
  ['exact-replay', prefix + 'presented-frontier-exact-replay'],
  ['matching-head', prefix + 'matching-head-distinct-frontier-classification'],
  ['relative-extension', prefix + 'relative-one-settlement-extension-classification'],
  ['same-epoch-different-heads', prefix + 'same-local-epoch-different-settled-head-classification'],
  ['different-epoch-unresolved', prefix + 'different-local-epoch-head-relation-unresolved'],
  ['source-identity-hold', prefix + 'source-identity-mismatch-hold'],
  ['observation-hold', prefix + 'typed-frontier-observation-hold'],
  ['fresh-process-rebuild', prefix + 'fresh-process-exact-rebuild'],
  ['read-only-roots', prefix + 'read-only-source-and-settlement-roots'],
  ['joint-replacement-counterexample', prefix + 'joint-pair-replacement-counterexample'],
  ['withheld-nonexclusion', prefix + 'withheld-frontier-nonexclusion'],
  ['matching-head-boundary', prefix + 'same-head-without-history-equivalence-boundary'],
  ['minimization-bounds', prefix + 'data-minimization-resource-boundary'],
  ['closed-schema', prefix + 'closed-observation-schema'],
  ['authority-none', prefix + 'authority-none']
];
const optional = [
  ['complete-history-comparison', prefix + 'complete-proposal-and-settlement-history-comparison'],
  ['live-v36-source-currentness', prefix + 'live-v36-source-recapture-and-entry-currentness'],
  ['authenticated-independent-roots', prefix + 'authenticated-independent-root-controllers'],
  ['external-retention', prefix + 'external-retention-or-independent-custody'],
  ['atomic-root-observation', prefix + 'atomic-two-root-observation-or-later-currentness'],
  ['protected-monotonic-state', prefix + 'protected-monotonic-state-or-rollback-prevention'],
  ['global-consistency', prefix + 'withheld-frontier-exclusion-global-uniqueness-or-consistent-log'],
  ['trusted-time', prefix + 'externally-trusted-observation-time'],
  ['external-reconciliation', prefix + 'authenticated-external-reconciliation-or-settlement-resolution'],
  ['independent-schema-validation', prefix + 'independent-draft-2020-12-validation'],
  ['provider-evaluation', prefix + 'provider-execution-or-evaluation'],
  ['benefit-learning', prefix + 'human-benefit-or-learning-proof'],
  ['consequential-authority', prefix + 'execution-adoption-promotion-merge-or-canon-authority']
];
const requirements = { schema: 'axm.capability-requirements/v1', requirements: required.map(([id, capability]) => ({ id, required: true, capabilities: [capability] })).concat(optional.map(([id, capability]) => ({ id, required: false, capabilities: [capability] }))) };
const before = {
  schema: 'axm.capability-inventory/v1', observedAt: '2026-08-21T15:00:00.000Z',
  capabilities: [{
    id: required[0][1], status: 'available',
    constraints: ['committed v3.7 TEST exact-rebuilds one caller-presented current or historical settlement package against one local root; it does not compare two current frontiers or expose co-presented contradictions']
  }]
};
const routes = {
  schema: 'axm.evidence-routes/v1', status: 'TEST', routes: [
    {
      claimId: 'two-current-package-admission', kind: 'technical',
      primarySurface: 'v3.8 per-side bracketing inspect exact v3.7 package rebuild and current-last-receipt tests',
      passCondition: 'a side is admitted only when equal bracketing settlement snapshots contain no pending proposal and the exact-rebuilt package matches the current last receipt and head',
      counterevidence: 'v3.8 does not recapture the live v3.6 source or establish atomicity across the two roots',
      observedEvidence: 'exact absent invalid changing pending tampered and older-but-exact packages all receive distinct executed side observations', verdict: 'PASS'
    },
    {
      claimId: 'bounded-relative-frontier-classification', kind: 'behavioral',
      primarySurface: 'all eight pairwise classification fixtures',
      passCondition: 'compatible admitted frontiers distinguish exact replay matching heads immediate relative extension same-epoch different heads and different-epoch unresolved relation',
      counterevidence: 'latest receipts do not expose complete histories so different epochs are not called a fork and matching heads do not prove matching histories',
      observedEvidence: 'every classification executes including both extension directions and the different-epoch unresolved countercase', verdict: 'PASS'
    },
    {
      claimId: 'read-only-rebuild-and-change-detection', kind: 'persistence',
      primarySurface: 'source and settlement tree digests fresh-process rebuild and changing-root fixture',
      passCondition: 'the observer writes no root bytes and a stable fresh process exact-rebuilds the receipt while a changed bracketing snapshot is held',
      counterevidence: 'a root may change after its final observation and no durable observer state or external receipt is created',
      observedEvidence: 'before-after tree digests match fresh-process build and verify pass and changed snapshots receive ROOT_CHANGED_DURING_CHECK', verdict: 'PASS'
    },
    {
      claimId: 'counterexample-minimization-and-schema-boundary', kind: 'technical',
      primarySurface: 'same-head distinct snapshots withheld contradiction alternate exact pair minimization resource and schema checks',
      passCondition: 'receipt exposes only minimized references heads counts and facts under a closed bounded schema',
      counterevidence: 'a withheld contradictory frontier remains invisible and replacing both presented pairs can produce another exact replay',
      observedEvidence: 'same-head non-equivalence withheld-frontier and joint-pair replacement counterexamples execute and paths packages keys signatures and review material are absent', verdict: 'PASS'
    },
    {
      claimId: 'authority-retention-benefit-and-canon-boundary', kind: 'authorization',
      primarySurface: 'truth object schema contract README frontier audit and static runtime checks',
      passCondition: 'artifacts explicitly deny authenticated independence external custody globality trusted time benefit learning consequential action and CANON',
      counterevidence: 'the caller controls both root pairs packages and observation time; Mike Tobi or AXM has not merged or canonized this TEST material',
      observedEvidence: 'closed truth fixes negative claims and runtime performs no write network provider signing experiment evaluation or Foundation mutation', verdict: 'PASS'
    }
  ]
};
for (const [name, value] of [['CAPABILITY_REQUIREMENTS.json', requirements], ['CAPABILITY_INVENTORY_BEFORE.json', before], ['EVIDENCE_ROUTES.json', routes]]) fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', 'utf8');
console.log('PASS wrote capability requirements baseline and five evidence routes');
