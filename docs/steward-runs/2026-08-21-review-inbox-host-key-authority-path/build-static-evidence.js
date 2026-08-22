#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const write = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', 'utf8');

const required = [
  ['default-hold', 'review.authority.default-no-policy-hold'],
  ['closed-host-policy', 'review.authority.closed-self-digested-host-policy'],
  ['bounded-policy-and-ledger', 'review.authority.preparse-policy-and-ledger-byte-bounds'],
  ['signed-submit-binding', 'review.authority.ed25519-exact-normalized-candidate-submit'],
  ['signed-vote-binding', 'review.authority.ed25519-exact-item-route-digest-vote'],
  ['policy-key-constraints', 'review.authority.role-kind-enabled-window-constraints'],
  ['replay-refusal', 'review.authority.global-envelope-id-replay-refusal'],
  ['principal-seat-uniqueness', 'review.authority.principal-seat-uniqueness-across-rotated-keys'],
  ['submitter-reviewer-separation', 'review.authority.policy-submitter-reviewer-separation'],
  ['signed-submission-prerequisite', 'review.authority.current-valid-signed-submission-required-for-signed-vote'],
  ['separate-ledger-reload', 'review.authority.separate-public-ledger-fresh-process-reverification'],
  ['policy-and-ledger-failclosed', 'review.authority.policy-replacement-and-ledger-tamper-failclosed'],
  ['legacy-separation', 'review.authority.legacy-approved-never-substitutes-for-host-key-authority'],
  ['explicit-api', 'review.authority.explicit-header-signed-submit-and-vote-api'],
  ['no-browser-policy-write', 'review.authority.no-browser-policy-write-private-key-or-network'],
  ['truth-boundaries', 'review.authority.zero-identity-human-time-reconciliation-and-consequential-authority'],
  ['visible-separate-states', 'review.authority.ui-policy-seat-and-authority-state-separation'],
  ['live-layout', 'review.authority.live-desktop-and-narrow-held-ready-legacy-and-host-key-journeys'],
  ['typed-view-regression', 'review.authority.existing-v29-v40-and-generic-review-nondisruption']
];
const optional = [
  ['real-world-identity', 'review.authority.real-world-identity'],
  ['actual-human-review', 'review.authority.actual-human-participation'],
  ['independent-controller', 'review.authority.independent-controller-proof'],
  ['trusted-time', 'review.authority.externally-trusted-time'],
  ['installed-host-policy', 'review.authority.actual-host-policy-installed-and-live-signed-review'],
  ['atomic-persistence', 'review.authority.atomic-review-and-authentication-persistence'],
  ['protected-storage', 'review.authority.protected-monotonic-storage-and-rollback-prevention'],
  ['external-custody', 'review.authority.external-custody'],
  ['reconciliation', 'review.authority.authenticated-reconciliation-and-divergence-resolution'],
  ['consequential-authority', 'review.authority.execution-adoption-promotion-merge-foundation-or-canon'],
  ['schema-meta-validation', 'review.authority.independent-draft-2020-12-meta-validation'],
  ['human-usability', 'review.authority.assistive-technology-and-human-usability-study'],
  ['benefit-learning', 'review.authority.human-benefit-or-learning-proof']
];
write('CAPABILITY_REQUIREMENTS.json', {
  schema:'axm.capability-requirements/v1',
  requirements:required.map(([id, capability]) => ({ id, required:true, capabilities:[capability] }))
    .concat(optional.map(([id, capability]) => ({ id, required:false, capabilities:[capability] })))
});

const inherited = required.find(([, capability]) => capability.endsWith('existing-v29-v40-and-generic-review-nondisruption'))[1];
write('CAPABILITY_INVENTORY_BEFORE.json', {
  schema:'axm.capability-inventory/v1', observedAt:'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED',
  capabilities:[{ id:inherited, status:'available', constraints:['v4.0 TEST had strict v2.9 and v4.0 typed views plus generic exact-digest review; ordinary actor strings were attribution only and no host-key authority path existed'] }]
});
const boundedConstraint = 'v4.1 TEST proves only possession of configured Ed25519 keys and exact current bindings; no named identity human participation trusted time reconciliation consequential authority benefit learning promotion merge Foundation mutation or CANON';
write('CAPABILITY_INVENTORY_AFTER.json', {
  schema:'axm.capability-inventory/v1', observedAt:'SESSION_ORDER_ONLY_NOT_EXTERNALLY_TRUSTED',
  capabilities:required.map(([, id]) => ({ id, status:'available', constraints:[boundedConstraint] }))
    .concat(optional.map(([, id]) => ({ id, status:'unknown', constraints:['explicitly outside the bounded v4.1 claim and not inferred from passing tests or key possession'] })))
});

write('EVIDENCE_ROUTES.json', {
  schema:'axm.evidence-routes/v1', status:'TEST', routes:[
    { claimId:'host-policy-default-and-key-constraints', kind:'authorization', primarySurface:'ReviewAuthority service closed policy parser and focused key-policy corruption cases', passCondition:'missing invalid expired disabled wrong-role wrong-kind duplicate-key and duplicate-fingerprint policies never produce authority', counterevidence:'the committed example is intentionally expired and no real host trust policy was installed', observedEvidence:'focused authority suite passes and default UI shows NOT_CONFIGURED', verdict:'PASS' },
    { claimId:'signed-exact-submit-and-vote-bindings', kind:'technical', primarySurface:'detached Ed25519 envelopes over canonical normalized candidate and exact current vote fields', passCondition:'valid current signatures bind policy key candidate item route artifact digest verdict note and explanation; mutation attempts and replays fail', counterevidence:'signature verification proves configured-key possession only and the runtime never receives a private key', observedEvidence:'service and API focused suites pass including replay mismatch role kind separation and signed-submission prerequisite cases', verdict:'PASS' },
    { claimId:'reload-and-corruption-failclosed-authority', kind:'persistence', primarySurface:'separate authentication ledger fresh service construction and reassessment', passCondition:'stored signatures reverify after reload while policy replacement malformed ledger signature tamper and expired evidence return held states', counterevidence:'Review Inbox and authentication files are not one transaction and local storage proves neither rollback prevention nor external custody', observedEvidence:'fresh-process revalidation and corruption cases pass; contract refuses atomic/protected/external storage claims', verdict:'PASS' },
    { claimId:'legacy-approved-authority-separation', kind:'behavioral', primarySurface:'unchanged ReviewService plus separate authority index and Review Inbox labels', passCondition:'caller-supplied actor labels may retain legacy behavior but count zero authenticated seats and never substitute for host-key authority', counterevidence:'legacy APPROVED remains possible because compatibility was preserved', observedEvidence:'API and service suites keep legacy APPROVED while authorityState remains HELD', verdict:'PASS' },
    { claimId:'live-held-ready-and-responsive-ui', kind:'visual', primarySurface:'read-only localhost browser journeys at 1280x720 and 390x844', passCondition:'no-policy held ready policy legacy-approved-held and host-key-approved states are visibly distinct without horizontal overflow', counterevidence:'synthetic read-only states prove no real signer review identity assistive-technology compatibility or usability benefit', observedEvidence:'seven frame digests and semantic measurements are retained; zero browser warnings or errors were observed', verdict:'PASS' },
    { claimId:'identity-human-action-and-canon-boundary', kind:'authorization', primarySurface:'authority truth object schemas contract UI README and source scans', passCondition:'all authority views keep identity human trusted-time reconciliation execution adoption permission promotion merge Foundation and CANON claims false', counterevidence:'Mike Tobi or AXM has not reviewed merged promoted or canonized this branch', observedEvidence:'closed false claims and UI boundary copy pass focused checks; no downstream consumer uses authenticatedApproved', verdict:'PASS' }
  ]
});

write('VISUAL_RECEIPT.json', {
  schema:'axm.live-visual-verification/v1', status:'PASS', statusBoundary:'TEST synthetic read-only localhost evidence',
  surfaces:[
    { id:'no-policy-desktop', viewport:'1280x720', sha256:'sha256:2a389f8f9689ed3a036dc70e7c1d43b47b02c68bf196ae7ba6911864777e084f', observed:['NOT_CONFIGURED host-key hold','four cards','zero authenticated seats','vote initially disabled','no horizontal overflow'] },
    { id:'v40-exact-selected', viewport:'1280x720', sha256:'sha256:7b1401b2afd5fb1be690bdae9267d9040c71e64c136e4c71a431800ffe77abe2', observed:['one typed VERIFIED v4.0 view','both commitments and first divergence visible','vote enabled only after exact artifact binding','global authority remains held'] },
    { id:'no-policy-narrow', viewport:'390x844', sha256:'sha256:53c2efd99cfe9665e033a0d789632d4a68718db7eb51e6e7374a36024d2dee96', observed:['one-column layout','static vote panel','authority box and cards fit','document scroll width equals client width 375'] },
    { id:'ready-policy-desktop', viewport:'1280x720', sha256:'sha256:fb2b81bc9749f37ca5d56e241ca0cf798763b5624b4d5a95640668fd94cf7afa', observed:['host-key path ready','two enabled keys','configured-key-possession-only boundary','legacy and host-key cards visible'] },
    { id:'legacy-approved-selected', viewport:'1280x720', sha256:'sha256:a2c2157e357b210882555f5e28c426ffffaffef4ef07877af964ee5843bfafa1', observed:['APPROVED AUTHORITY HELD badge','one attributed seat','zero authenticated seats','AUTHENTICATED_SEAT_THRESHOLD_NOT_MET'] },
    { id:'host-key-approved-selected', viewport:'1280x720', sha256:'sha256:b5d58be8587e6d0755e7bfba0fd2101c311f3173ae6e35b30e73f84352a353d9', observed:['APPROVED HOST KEY badge','one attributed seat','one authenticated seat','execution and reconciliation remain false'] },
    { id:'ready-policy-narrow', viewport:'390x844', sha256:'sha256:eb94af968d2a1d73166d0a8f1fd1092672c73df3a5a505f402a596f95dbb81cb', observed:['long badges wrap inside cards','static vote panel','document has no horizontal overflow'] }
  ],
  interaction:{ writeRoutesAvailable:false, writeRoutesAttempted:false, consoleWarnings:0, consoleErrors:0, rapidSelectionRegression:'covered in inherited v4.0 receipt and focused UI tests' },
  retention:{ screenshotsRetained:false, screenshotBuffersCleared:7, selectedScreenshotDigestsRetained:7, rawBrowserTelemetryRetained:false, browserTabsClosed:1, viewportOverridesReset:1, temporaryV40HarnessRootRemoved:true, harnessServersStopped:2 },
  notProven:['real signed host submission or vote','real-world identity','actual human participation','trusted time','assistive-technology compatibility','human usability or benefit','reconciliation execution adoption promotion merge Foundation mutation or CANON']
});

console.log('PASS wrote capability inputs, six evidence routes, and seven-frame curated visual receipt');
