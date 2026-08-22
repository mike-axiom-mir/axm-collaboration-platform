#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const prefix = 'model.shadow.retention-audit-review-outcome-transition-settlement-ledger.';
const required = [
  ['upstream-v36-exact-rebuild', 'model.shadow.retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger.caller-package-persisted-exact-rebuild'],
  ['exact-v36-proposal-gate', prefix + 'exact-v36-persisted-entry-proposal-gate'],
  ['distinct-roots', prefix + 'distinct-nonnested-local-roots'],
  ['proposal-bracketing', prefix + 'equal-bracketing-source-observation-before-proposal'],
  ['proposal-no-head-advance', prefix + 'proposal-does-not-advance-settled-head'],
  ['one-pending', prefix + 'one-trailing-pending-proposal'],
  ['separate-confirmation', prefix + 'separate-settlement-confirmation'],
  ['proposal-package-rebuild', prefix + 'exact-proposal-package-rebuild'],
  ['settlement-source-recheck', prefix + 'source-entry-recheck-before-settlement-write'],
  ['settlement-bracketing', prefix + 'equal-bracketing-source-observation-before-settlement'],
  ['typed-source-hold', prefix + 'typed-source-uncertainty-hold'],
  ['settled-only-head', prefix + 'settled-head-derived-only-from-exact-settlements'],
  ['held-head-preservation', prefix + 'held-settlement-preserves-head'],
  ['exclusive-canonical-files', prefix + 'exclusive-canonical-proposal-and-settlement-files'],
  ['successful-return-path', prefix + 'successful-return-path-file-fsync-and-local-reload'],
  ['operation-lock', prefix + 'local-operation-lock'],
  ['contiguous-reload', prefix + 'contiguous-proposal-settlement-reload'],
  ['fresh-process-inspect', prefix + 'fresh-process-inspect'],
  ['caller-package-rebuild', prefix + 'caller-package-persisted-proposal-and-settlement-rebuild'],
  ['concurrent-contention', prefix + 'concurrent-operation-contention'],
  ['independent-root-counterexample', prefix + 'independent-root-counterexample'],
  ['joint-replacement-counterexample', prefix + 'joint-source-and-settlement-replacement-counterexample'],
  ['corruption-fail-closed', prefix + 'corruption-and-sequence-fail-closed'],
  ['resource-bounds', prefix + 'aggregate-resource-bounds'],
  ['artifact-minimization', prefix + 'public-artifact-data-minimization'],
  ['closed-schemas', prefix + 'closed-artifact-schemas'],
  ['source-ledger-no-mutation', prefix + 'no-durable-source-ledger-mutation'],
  ['authority-none', prefix + 'authority-none']
];
const optional = [
  ['authenticated-authority', prefix + 'authenticated-host-actor-human-policy-or-origin'],
  ['external-retention', prefix + 'external-retention-or-independent-custody'],
  ['protected-monotonic-state', prefix + 'protected-monotonic-state-or-rollback-prevention'],
  ['global-consistency', prefix + 'withheld-branch-exclusion-global-transition-uniqueness-or-consistent-log'],
  ['trusted-time', prefix + 'externally-trusted-proposal-or-settlement-time'],
  ['directory-hardware-durability', prefix + 'directory-entry-hardware-or-power-loss-durability'],
  ['atomic-currentness', prefix + 'atomic-source-observation-write-or-postwrite-currentness'],
  ['upstream-rebuild-without-package', prefix + 'upstream-rebuild-without-caller-package'],
  ['external-settlement-resolution', prefix + 'authenticated-external-settlement-or-retention-resolution'],
  ['provider-evaluation', prefix + 'provider-execution-or-evaluation'],
  ['benefit-learning', prefix + 'human-benefit-or-learning-proof'],
  ['consequential-authority', prefix + 'execution-adoption-promotion-merge-or-canon-authority']
];
const requirements = {
  schema: 'axm.capability-requirements/v1',
  requirements: required.map(([id, capability]) => ({ id, required: true, capabilities: [capability] }))
    .concat(optional.map(([id, capability]) => ({ id, required: false, capabilities: [capability] })))
};
const before = {
  schema: 'axm.capability-inventory/v1', observedAt: '2026-08-21T14:00:00.000Z',
  capabilities: [{
    id: required[0][1], status: 'available',
    constraints: ['committed v3.6 TEST source exact-rebuilds one caller-owned local forward-entry ledger; it provides no separate settlement phase external custody global uniqueness protected monotonic state authority or CANON decision']
  }]
};
const routes = {
  schema: 'axm.evidence-routes/v1', status: 'TEST', routes: [
    {
      claimId: 'exact-proposal-gate-without-head-advance', kind: 'technical',
      primarySurface: 'v3.7 exact v3.6 caller-package rebuild source-bracketing and pending-head tests',
      passCondition: 'only an exact persisted v3.6 entry consuming the current local settled head creates one pending proposal and the proposal leaves that head unchanged',
      counterevidence: 'the source observation is prewrite caller-root evidence and is neither authenticated nor atomic with proposal persistence',
      observedEvidence: 'tampered stale overlapping-root and pending-second proposals fail while exact proposal reload retains genesis head', verdict: 'PASS'
    },
    {
      claimId: 'separate-exact-or-held-settlement', kind: 'behavioral',
      primarySurface: 'separate confirmation exact proposal rebuild source recheck and all five observation-classification fixtures',
      passCondition: 'only exact stable source evidence advances the local settled head; absence invalidity change or mismatch writes a typed held receipt and preserves the prior head',
      counterevidence: 'a held receipt resolves no retention review remediation or external settlement and source state may change after the last observation',
      observedEvidence: 'all five source and settlement classifications execute; exact verification and bracketing equality remain independent receipt facts', verdict: 'PASS'
    },
    {
      claimId: 'local-persistence-reload-and-uncertainty', kind: 'persistence',
      primarySurface: 'canonical exclusive files operation lock file fsync fresh-process reload and injected-failure fixtures',
      passCondition: 'successful proposal and settlement returns require exclusive create file fsync and exact local reload of one contiguous proposal-to-settlement sequence',
      counterevidence: 'file fsync proves no directory or hardware durability and a reported failure may still leave an inspectable artifact',
      observedEvidence: 'fresh-process exact rebuild concurrency stale-lock and both proposal and settlement fsync uncertainty paths are executed', verdict: 'PASS'
    },
    {
      claimId: 'local-serialization-minimization-and-counterexamples', kind: 'technical',
      primarySurface: 'independent roots joint replacement source-byte digest corruption bounds minimization and closed-schema checks',
      passCondition: 'the adapter mutates no durable source bytes and persisted state fails closed on tested corruption while retaining only references and minimized observation facts',
      counterevidence: 'independent root pairs can settle divergent candidates and joint caller-root replacement can reopen sequence one',
      observedEvidence: 'both counterexamples and corruption resource minimization and no-source-mutation assertions pass', verdict: 'PASS'
    },
    {
      claimId: 'authority-retention-benefit-and-canon-boundary', kind: 'authorization',
      primarySurface: 'truth objects schemas contract README frontier audit and counterexample tests',
      passCondition: 'artifacts explicitly deny authenticated authority external retention global consistency trusted time atomic currentness benefit learning consequential action and CANON',
      counterevidence: 'the caller controls confirmations roots packages and rollback; Mike Tobi or AXM has not merged or canonized this TEST material',
      observedEvidence: 'runtime truth and schemas keep consequential claims false and the module performs no provider execution evaluation install promotion merge or Foundation mutation', verdict: 'PASS'
    }
  ]
};
for (const [name, value] of [['CAPABILITY_REQUIREMENTS.json', requirements], ['CAPABILITY_INVENTORY_BEFORE.json', before], ['EVIDENCE_ROUTES.json', routes]]) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', 'utf8');
}
console.log('PASS wrote capability requirements baseline and five evidence routes');
