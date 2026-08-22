#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const prefix = 'model.shadow.retention-audit-review-outcome-history-checkpoint-anchor-pairwise-ledger.';
const required = [
  ['upstream-v35-forward-classification', 'model.shadow.retention-audit-review-outcome-history-checkpoint-anchor-pairwise.forward-complete-history-prefix'],
  ['exact-v35-forward-gate', prefix + 'exact-v35-forward-transition-gate'],
  ['configured-genesis', prefix + 'explicit-configured-genesis-head'],
  ['anchored-package-head', prefix + 'exact-anchored-package-local-head'],
  ['checkpoint-head', prefix + 'exact-checkpoint-local-head'],
  ['caller-epoch-head', prefix + 'exact-caller-epoch-local-head'],
  ['policy-profile-pins', prefix + 'pinned-anchor-and-witness-policy-profiles'],
  ['exclusive-sequence', prefix + 'exclusive-local-sequence-append'],
  ['canonical-artifacts', prefix + 'canonical-manifest-entry-and-snapshot'],
  ['successful-return-path', prefix + 'successful-record-path-file-fsync-and-postwrite-reload'],
  ['contiguous-reload', prefix + 'contiguous-sequence-reload'],
  ['entry-digest-chain', prefix + 'local-entry-digest-chain'],
  ['fresh-process-inspect', prefix + 'fresh-process-inspect'],
  ['caller-package-rebuild', prefix + 'caller-package-persisted-exact-rebuild'],
  ['stale-head-refusal', prefix + 'stale-local-head-refusal'],
  ['same-previous-refusal', prefix + 'same-previous-second-branch-refusal'],
  ['replay-id-refusal', prefix + 'replay-and-id-reuse-refusal'],
  ['concurrent-contention', prefix + 'concurrent-writer-contention'],
  ['independent-root-counterexample', prefix + 'independent-root-counterexample'],
  ['deletion-rollback-counterexample', prefix + 'deletion-and-rollback-counterexample'],
  ['resource-bounds', prefix + 'aggregate-resource-bounds'],
  ['artifact-minimization', prefix + 'public-artifact-data-minimization'],
  ['closed-schemas', prefix + 'closed-artifact-schemas'],
  ['authority-none', prefix + 'authority-none'],
  ['source-ledger-no-mutation', prefix + 'no-source-ledger-mutation']
];
const optional = [
  ['authenticated-ledger-host-or-actor', prefix + 'authenticated-ledger-host-actor-or-human'],
  ['authenticated-policy-or-origin', prefix + 'authenticated-policy-authority-or-checkpoint-origin'],
  ['external-retention', prefix + 'external-retention-or-independent-custody'],
  ['protected-monotonic-state', prefix + 'protected-monotonic-state-or-rollback-prevention'],
  ['global-consistency', prefix + 'withheld-branch-exclusion-global-transition-uniqueness-or-consistent-log'],
  ['trusted-time-or-epoch', prefix + 'externally-trusted-time-or-epoch'],
  ['directory-hardware-durability', prefix + 'directory-entry-hardware-or-power-loss-durability'],
  ['upstream-rebuild-without-package', prefix + 'upstream-package-rebuild-without-caller-input'],
  ['hold-resolution', prefix + 'retention-hold-resolution-or-remediation'],
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
  schema: 'axm.capability-inventory/v1', observedAt: '2026-08-21T13:00:00.000Z',
  capabilities: [{
    id: required[0][1], status: 'available',
    constraints: ['committed v3.5 TEST upstream classifies exact relative forward history only; it serializes no local head and proves no global uniqueness retention authority or rollback prevention']
  }]
};
const routes = {
  schema: 'axm.evidence-routes/v1', status: 'TEST', routes: [
    {
      claimId: 'exact-forward-admission-and-local-head', kind: 'technical',
      primarySurface: 'v3.6 focused exact rebuild and local-head tests',
      passCondition: 'only an exact v3.5 forward receipt consuming the configured or current anchored-package checkpoint and caller-epoch head can be recorded',
      counterevidence: 'the upstream comparison and caller epoch are relative caller-presented evidence rather than authenticated global history',
      observedEvidence: 'tampered nonforward stale alternate-anchoring profile and epoch inputs fail while two exact consecutive transitions pass', verdict: 'PASS'
    },
    {
      claimId: 'exclusive-persistence-and-reload', kind: 'persistence',
      primarySurface: 'canonical files exclusive sequence creation file fsync fresh-process inspect and postwrite reload',
      passCondition: 'a successful record return follows exclusive create file fsync and exact postwrite reload; reload validates one contiguous digest-chained local branch',
      counterevidence: 'file fsync does not establish directory or hardware durability and a failed fsync may leave an inspectable file',
      observedEvidence: 'fresh-process reload exact caller-package rebuild concurrent writer contention and injected entry-fsync failure all have typed outcomes', verdict: 'PASS'
    },
    {
      claimId: 'local-serialization-not-global-uniqueness', kind: 'behavioral',
      primarySurface: 'same-genesis stale-head race independent-root deletion and rollback fixtures',
      passCondition: 'one preserved caller root refuses a second transition from its consumed local head',
      counterevidence: 'independent roots accept divergent candidates and deleting or restoring earlier bytes reopens another branch',
      observedEvidence: 'all three counterexamples are directly executed and resulting truth keeps globality monotonic protection and rollback prevention false', verdict: 'PASS'
    },
    {
      claimId: 'corruption-resource-and-minimization-boundary', kind: 'technical',
      primarySurface: 'stored-artifact validation source-tree digest checks schemas and static runtime inspection',
      passCondition: 'noncanonical corrupt gapped unexpected or oversized local state fails closed and persisted public artifacts contain only minimized v3.5 receipts and references',
      counterevidence: 'exact upstream rebuild still requires the caller to retain the complete v3.5 package',
      observedEvidence: 'focused corruption resource closed-shape minimization and no-source-mutation assertions pass', verdict: 'PASS'
    },
    {
      claimId: 'authority-retention-benefit-and-canon-boundary', kind: 'authorization',
      primarySurface: 'truth objects contract README frontier audit and counterexample tests',
      passCondition: 'artifacts explicitly deny authenticated authority external retention global consistency trusted time benefit learning consequential action and CANON',
      counterevidence: 'the caller controls confirmation state roots packages and rollback; Mike Tobi or AXM has not merged or canonized this TEST material',
      observedEvidence: 'closed runtime truth and schemas fix all consequential claims false and the module performs no provider execution evaluation install promotion merge or Foundation mutation', verdict: 'PASS'
    }
  ]
};
for (const [name, value] of [['CAPABILITY_REQUIREMENTS.json', requirements], ['CAPABILITY_INVENTORY_BEFORE.json', before], ['EVIDENCE_ROUTES.json', routes]]) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', 'utf8');
}
console.log('PASS wrote capability requirements baseline and five evidence routes');
