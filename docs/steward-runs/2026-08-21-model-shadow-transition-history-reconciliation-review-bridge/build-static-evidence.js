#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const v39 = 'model.shadow.retention-audit-review-outcome-transition-settlement-history-pairwise-observer.';
const bridge = 'model.shadow.transition-settlement-history-reconciliation-review.';
const view = 'model.shadow.transition-history-reconciliation-review-view.';
const required = [
  ['upstream-v39-first-divergence', v39 + 'earliest-normalized-event-divergence'],
  ['v39-exact-rebuild', bridge + 'v39-exact-rebuild'],
  ['divergence-only-admission', bridge + 'divergence-only-admission'],
  ['minimized-artifact', bridge + 'minimized-exact-digest-artifact'],
  ['commitments-and-first-divergence', bridge + 'both-history-commitments-and-first-divergence'],
  ['review-candidate-compatible', bridge + 'review-inbox-compatible-candidate'],
  ['explicit-host-route', bridge + 'explicit-host-route-declared'],
  ['data-only-no-submit', bridge + 'data-only-no-submit'],
  ['closed-bounded-artifacts', bridge + 'closed-schemas-and-resource-bounds'],
  ['fresh-process-request-rebuild', bridge + 'fresh-process-exact-rebuild'],
  ['bridge-authority-none', bridge + 'authority-none'],
  ['strict-v40-view', view + 'strict-v40-detection'],
  ['browser-canonical-sha256', view + 'browser-canonical-sha256'],
  ['item-artifact-binding', view + 'item-artifact-digest-binding'],
  ['typed-commitments-and-divergence', view + 'both-history-commitments-and-first-divergence'],
  ['human-readable-summary', view + 'typed-human-readable-summary'],
  ['zero-reconciliation-authority-copy', view + 'zero-reconciliation-and-authority-copy'],
  ['mismatch-failclosed', view + 'mismatch-failclosed'],
  ['pending-invalid-vote-gating', view + 'pending-and-invalid-vote-gating'],
  ['generic-review-nondisruption', view + 'generic-review-nondisruption'],
  ['stale-selection-ignored', view + 'stale-selection-ignored'],
  ['safe-html-escaping', view + 'safe-html-escaping'],
  ['raw-json-preserved', view + 'raw-json-evidence-preserved'],
  ['read-only-view', view + 'read-only-no-new-mutation'],
  ['responsive-layout', view + 'desktop-and-narrow-layout'],
  ['live-browser-journey', view + 'live-browser-exact-and-mismatch-journey'],
  ['focused-corruption-tests', view + 'focused-contract-and-corruption-tests'],
  ['bounded-browser-inspection', view + 'bounded-artifact-inspection']
];
const optional = [
  ['live-host-submission-and-reload', bridge + 'live-host-submission-and-independent-reload'],
  ['authenticated-submitter-reviewer', bridge + 'authenticated-submitter-reviewer-or-real-world-identity'],
  ['actual-human-review', bridge + 'actual-human-review-or-participation'],
  ['authenticated-steward-reconciliation', bridge + 'authenticated-steward-reconciliation'],
  ['divergence-resolution', bridge + 'reconciliation-result-or-divergence-resolution'],
  ['custody-globality-protection', bridge + 'independent-custody-protected-monotonic-global-history'],
  ['provider-evaluation', bridge + 'provider-execution-or-evaluation'],
  ['benefit-learning', bridge + 'human-benefit-or-learning-proof'],
  ['consequential-authority', bridge + 'execution-adoption-promotion-merge-foundation-or-canon-authority'],
  ['independent-schema-validation', bridge + 'independent-draft-2020-12-validation'],
  ['assistive-technology-usability', view + 'assistive-technology-or-human-usability-study']
];
const requirements = { schema:'axm.capability-requirements/v1', requirements:required.map(([id, capability]) => ({ id, required:true, capabilities:[capability] })).concat(optional.map(([id, capability]) => ({ id, required:false, capabilities:[capability] }))) };
const before = {
  schema:'axm.capability-inventory/v1', observedAt:'2026-08-21T18:00:00.000Z',
  capabilities:[{ id:required[0][1], status:'available', constraints:['committed v3.9 TEST exact-rebuilds two caller-presented complete local histories and locates their earliest divergence but emits no review candidate or typed human-facing view'] }]
};
const routes = {
  schema:'axm.evidence-routes/v1', status:'TEST', routes:[
    {
      claimId:'divergence-only-exact-rebuild-admission', kind:'deterministic behavior',
      primarySurface:'v4.0 bridge selftest over current v3.9 caller package and unchanged v3.9 verifyObservation',
      passCondition:'only an exact currently rebuildable COMPLETE_HISTORY_DIVERGES receipt produces a review request',
      counterevidence:'matching replay prefix identity-hold observation-hold stale-root and altered-receipt cases are not reconciliation candidates',
      observedEvidence:'exact divergence passes while exact replay and altered receipt fail with typed codes', verdict:'PASS'
    },
    {
      claimId:'minimized-exact-review-artifact-and-candidate', kind:'technical',
      primarySurface:'closed artifact request schemas canonical self-digests source snapshot and focused binding checks',
      passCondition:'artifact retains both commitment and snapshot references counts common prefix and first divergence while candidate binds its exact digest',
      counterevidence:'full v3.9 receipt complete histories configured paths raw records model output and private context stay omitted',
      observedEvidence:'107 bridge assertions plus fresh-process rebuild and source-root tree digests pass', verdict:'PASS'
    },
    {
      claimId:'review-inbox-shape-compatibility-without-submission', kind:'persistence',
      primarySurface:'task-owned synthetic ReviewService root and data-only submission descriptor',
      passCondition:'unchanged ReviewService accepts and reloads the exact candidate with no votes or discussion',
      counterevidence:'synthetic receiver state proves no live host submission persistence independent process authorization or human participation',
      observedEvidence:'synthetic pending item exact-reloads and is removed while module truth remains reviewSubmittedByModule false', verdict:'PASS'
    },
    {
      claimId:'typed-browser-digest-verification-and-failclosed-gating', kind:'behavioral',
      primarySurface:'browser Web Crypto renderer corruption suite and Inbox selection-revision routing',
      passCondition:'exact item becomes vote-ready only after artifact self-digest and item digest match; malformed mismatch or authority inflation stays HOLD',
      counterevidence:'digest equality proves content equality only and never origin identity review or reconciliation',
      observedEvidence:'191 renderer assertions and 45 Inbox integration assertions pass including generic and prior-v2.9 nondisruption', verdict:'PASS'
    },
    {
      claimId:'live-desktop-and-narrow-review-journey', kind:'visual',
      primarySurface:'bounded read-only localhost harness live DOM screenshots and one-click selection transitions at 1280x720 and 390x844',
      passCondition:'exact view shows both commitments first divergence and boundaries with no overflow; mismatch shows one HOLD and disables vote',
      counterevidence:'synthetic static browser states prove no live submission assistive-technology behavior usability benefit motion or external review',
      observedEvidence:'VISUAL_RECEIPT records PASS exact mismatch legacy generic rapid-selection and narrow-layout observations with no console warnings or errors', verdict:'PASS'
    },
    {
      claimId:'reconciliation-identity-benefit-and-authority-boundary', kind:'authorization',
      primarySurface:'artifact truth request truth action flags schemas contracts UI copy README frontier and runtime static scans',
      passCondition:'every product surface denies approval-as-reconciliation identity globality benefit learning consequential action and CANON',
      counterevidence:'Mike Tobi or AXM has not reviewed reconciled merged promoted or canonized this TEST material',
      observedEvidence:'closed false claims and zero-action fields pass corruption tests; runtime performs no ReviewService import network write provider evaluation or reconciliation', verdict:'PASS'
    }
  ]
};
for (const [name, value] of [['CAPABILITY_REQUIREMENTS.json', requirements], ['CAPABILITY_INVENTORY_BEFORE.json', before], ['EVIDENCE_ROUTES.json', routes]]) fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', 'utf8');
console.log('PASS wrote capability requirements baseline and six evidence routes');
