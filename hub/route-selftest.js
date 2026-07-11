#!/usr/bin/env node
/* ============================================================
   AXM ROUTE — route-selftest.js
   Every rule from the design discussion, asserted. Exit 0 = pass.
   Run:  node hub/route-selftest.js
   ============================================================ */
'use strict';
const R = require('./route-core.js');
const out = []; let fails = 0;
function ok(m) { out.push('  PASS  ' + m); }
function bad(m) { out.push('  FAIL  ' + m); fails++; }

/* ---- 1. a tick is not a verification ---- */
(function noFakeDone() {
  const r = R.newRoute('Test', 'prove it', 'mike');
  const s = R.addStep(r, { title: 'unchecked step', who: 'mike' });
  const t = R.setStepState(r, s.id, 'WORKING', 'mike');
  !t.ok ? ok('no-fake-done: cannot mark a checkless step WORKING by ticking') : bad('checkless step ticked to WORKING');

  const forced = R.setStepState(r, s.id, 'WORKING', 'mike', 'no automated check exists yet');
  (forced.ok && forced.step.forced_reason) ? ok('no-fake-done: forcing is allowed but records a reason') : bad('force did not record reason');

  const s2 = R.addStep(r, { title: 'checked step', checks: [{ kind: 'file-exists', path: 'x' }], who: 'mike' });
  R.setStepState(r, s2.id, 'WORKING', 'mike').ok ? ok('no-fake-done: a step WITH a check may pass normally') : bad('checked step blocked');

  const p = R.progress(r);
  (p.verified === 1 && p.claimed_only === 1) ? ok('progress separates VERIFIED from merely CLAIMED') : bad('progress conflates verified and claimed: ' + JSON.stringify(p));
})();

/* ---- 2. a claim without a source is a note ---- */
(function claimsNeedSources() {
  const r = R.newRoute('T', 'g', 'mike');
  const n = R.addNeed(r, { question: 'map size?', who: 'mike' });
  const noSrc = R.addClaim(r, { need_id: n.id, text: '512x512', source_id: null, who: 'nova' });
  !noSrc.ok ? ok('a claim without a source is refused (it is a note)') : bad('sourceless claim accepted');

  const src = R.addSource(r, { kind: 'asserted', who: 'nova-8b-local' });
  const c = R.addClaim(r, { need_id: n.id, text: '512x512', source_id: src.id, who: 'nova' });
  c.ok ? ok('a claim WITH a source is accepted') : bad('sourced claim refused');
  R.validate(r).ok ? ok('validate() passes a well-formed route') : bad('validate rejected a good route');
})();

/* ---- 3. two models = two claims, never merged ---- */
(function noMachineMerge() {
  const r = R.newRoute('T', 'g', 'mike');
  const n = R.addNeed(r, { question: 'player count?', who: 'mike' });
  const s1 = R.addSource(r, { kind: 'asserted', who: 'grok' });
  const s2 = R.addSource(r, { kind: 'asserted', who: 'meta' });
  R.addClaim(r, { need_id: n.id, text: '8 players', source_id: s1.id, who: 'grok' });
  R.addClaim(r, { need_id: n.id, text: '4 players', source_id: s2.id, who: 'meta' });
  R.claimsFor(r, n.id).length === 2 ? ok('update-25: two answers stored as TWO claims, not averaged') : bad('claims were merged');
  R.contestedNeeds(r).length === 1 ? ok('a contested need announces itself (no scheduler)') : bad('contested need not detected');
})();

/* ---- 4. a need is never closed, only currently answered ---- */
(function neverClosed() {
  const r = R.newRoute('T', 'g', 'mike');
  const n = R.addNeed(r, { question: 'engine?', revisit_when: 'a local model can do this', who: 'mike' });
  const src = R.addSource(r, { kind: 'tested', who: 'errol', evidence: 'playtest 2026-07-01' });
  const c1 = R.addClaim(r, { need_id: n.id, text: 'Phaser 3', source_id: src.id, who: 'mike' }).claim;
  R.answerNeed(r, n.id, c1.id, 'mike');
  const nn = r.needs[0];
  (nn.answered_by === c1.id && nn.answered_who === 'mike' && nn.answered_at)
    ? ok('need is ANSWERED_BY someone at a time — not "closed"') : bad('need close semantics wrong');

  /* a better answer arrives later */
  const src2 = R.addSource(r, { kind: 'fetched', who: 'docs', evidence: 'sha 3f2a' });
  const c2 = R.addClaim(r, { need_id: n.id, text: 'Phaser 4', source_id: src2.id, who: 'claude' }).claim;
  R.supersedeClaim(r, c1.id, c2.id, 'v4 released, v3 EOL', 'mike');
  R.answerNeed(r, n.id, c2.id, 'mike');
  (r.needs[0].history && r.needs[0].history.length === 1) ? ok('re-pointing a need keeps the decision HISTORY') : bad('decision history lost');
  const noReason = R.supersedeClaim(r, c2.id, null, '', 'mike');
  !noReason.ok ? ok('supersede without a reason is refused') : bad('reasonless supersede allowed');
  (r.claims.length === 2 && r.claims[0].superseded_by) ? ok('nothing deleted — superseded with a reason') : bad('claim was deleted');
})();

/* ---- 5. a step on a superseded claim is FLAGGED, never auto-failed ---- */
(function staleFlagged() {
  const r = R.newRoute('T', 'g', 'mike');
  const src = R.addSource(r, { kind: 'fetched', who: 'doc' });
  const n = R.addNeed(r, { question: 'q', who: 'mike' });
  const c1 = R.addClaim(r, { need_id: n.id, text: 'old', source_id: src.id, who: 'a' }).claim;
  const c2 = R.addClaim(r, { need_id: n.id, text: 'new', source_id: src.id, who: 'b' }).claim;
  const s = R.addStep(r, { title: 'built on c1', checks: [{ kind: 'claim', claim_id: c1.id }], who: 'mike' });
  R.setStepState(r, s.id, 'WORKING', 'mike');
  R.supersedeClaim(r, c1.id, c2.id, 'better data', 'mike');
  const stale = R.staleSteps(r);
  (stale.length === 1 && stale[0].step_id === s.id) ? ok('stale step is FLAGGED when its claim is superseded') : bad('stale step not flagged');
  r.steps[0].state === 'WORKING' ? ok('stale step is NOT auto-failed (visible, not tyrannical)') : bad('step was auto-failed');
})();

/* ---- 6. closing is chosen, never computed ---- */
(function closingIsChosen() {
  const r = R.newRoute('T', 'g', 'mike');
  const s = R.addStep(r, { title: 'a', checks: [{ kind: 'x' }], who: 'mike' });
  R.setStepState(r, s.id, 'WORKING', 'mike');
  r.route.state === 'living' ? ok('all steps green does NOT close the route') : bad('route auto-closed');
  const noReason = R.setRouteState(r, 'closed', 'mike');
  !noReason.ok ? ok('closing without a reason is refused (it is a decision)') : bad('reasonless close allowed');
  R.setRouteState(r, 'closed', 'mike', 'shipped v1').ok ? ok('closing with a reason works') : bad('close failed');

  /* goal_reached and route_state are independent */
  const r2 = R.newRoute('T2', 'g', 'mike');
  R.setGoalReached(r2, true, 'mike');
  (r2.route.goal_reached === true && r2.route.state === 'living')
    ? ok('goal reached + route still LIVING (independent fields)') : bad('goal_reached forced a close');
  R.setRouteState(r2, 'quiet', 'mike');
  (r2.route.state === 'quiet') ? ok('a route can go QUIET without the goal being reached') : bad('quiet state failed');
})();

/* ---- 7. resume packet: bounded, and warns about source weight ---- */
(function resume() {
  const r = R.newRoute('Village', 'build machine village', 'mike');
  const s = R.addStep(r, { title: 'step one', who: 'mike' });
  for (let i = 0; i < 50; i++) R.addStep(r, { title: 'noise ' + i, who: 'mike' });
  const n = R.addNeed(r, { question: 'which board?', step_id: s.id, who: 'mike' });
  const weak = R.addSource(r, { kind: 'asserted', who: 'nova-8b-local' });
  const strong = R.addSource(r, { kind: 'fetched', who: 'spec.pdf', evidence: 'sha 3f2a' });
  const c1 = R.addClaim(r, { need_id: n.id, text: 'Pi 4', source_id: weak.id, who: 'nova' }).claim;
  const c2 = R.addClaim(r, { need_id: n.id, text: 'Pi 5', source_id: strong.id, who: 'claude' }).claim;
  R.supersedeClaim(r, c1.id, c2.id, 'nova guessed; spec says otherwise', 'mike');

  const p = R.resumePacket(r, s.id);
  (p.current_step && p.current_step.id === s.id) ? ok('resume packet is scoped to ONE step (Nova can read it)') : bad('resume packet unscoped');
  !JSON.stringify(p).includes('noise 40') ? ok('resume packet does not dump all 51 steps') : bad('resume packet dumped everything');
  (p.already_rejected.length === 1 && p.already_rejected[0].why_rejected) ? ok('resume packet carries WHAT WAS REJECTED and why') : bad('rejected paths missing');
  p.live_claims.every(c => c.source_kind) ? ok('every claim in the packet carries its source_kind') : bad('claim without source_kind');
  p.warning ? ok('packet warns a returning model that claims are not equal') : bad('no epistemic warning');
})();

/* ---- 8. settled decisions resist silent re-litigation ---- */
(function settled() {
  const r = R.newRoute('T', 'g', 'mike');
  const st = R.addStep(r, { title: 's', who: 'mike' });
  const n = R.addNeed(r, { question: 'lang?', step_id: st.id, who: 'mike' });
  const src = R.addSource(r, { kind: 'human', who: 'mike' });
  const c = R.addClaim(r, { need_id: n.id, text: 'JS', source_id: src.id, who: 'mike' }).claim;
  R.answerNeed(r, n.id, c.id, 'mike');
  const p = R.resumePacket(r, st.id);
  (p.settled_decisions.length === 1 && p.settled_decisions[0].reopenable === true && p.settled_decisions[0].note)
    ? ok('settled decisions are shown to a returning worker as settled-but-reopenable') : bad('settled decisions not surfaced');
  p.open_needs.length === 0 ? ok('an answered need is not shown as open') : bad('answered need still open');
})();

/* ---- 9. conflict: diagnosis, not a fourth opinion; null is legal ---- */
(function conflict() {
  const r = R.newRoute('T', 'g', 'mike');
  const n = R.addNeed(r, { question: 'tick rate?', who: 'mike' });
  const weak = R.addSource(r, { kind: 'asserted', who: 'grok' });
  const strong = R.addSource(r, { kind: 'tested', who: 'errol', evidence: 'measured' });
  R.addClaim(r, { need_id: n.id, text: '30hz', source_id: weak.id, who: 'grok' });
  R.addClaim(r, { need_id: n.id, text: '60hz', source_id: strong.id, who: 'errol' });
  const d = R.diagnoseConflict(r, n.id, 'meta-ai');
  (d.ok && d.conflict.resolution === 'provenance' && !d.conflict.escalate)
    ? ok('conflict of unequal evidence resolves on PROVENANCE — no human needed') : bad('provenance conflict escalated');
  d.conflict.diagnosis ? ok('conflict output is a DIAGNOSIS, not a fourth claim') : bad('no diagnosis produced');
  r.claims.length === 2 ? ok('cross-check added NO new claim (does not widen the fan)') : bad('cross-check added a claim');

  /* equal footing → genuine fork, escalate, do not vote */
  const r2 = R.newRoute('T', 'g', 'mike');
  const n2 = R.addNeed(r2, { question: 'engine?', who: 'mike' });
  const a = R.addSource(r2, { kind: 'tested', who: 'errol' });
  const b = R.addSource(r2, { kind: 'tested', who: 'ivan' });
  R.addClaim(r2, { need_id: n2.id, text: 'A', source_id: a.id, who: 'errol' });
  R.addClaim(r2, { need_id: n2.id, text: 'B', source_id: b.id, who: 'ivan' });
  const d2 = R.diagnoseConflict(r2, n2.id, 'meta-ai');
  (d2.conflict.escalate && d2.conflict.resolution === null)
    ? ok('equal-evidence disagreement ESCALATES rather than voting') : bad('system voted on a real fork');

  const nullNoNote = R.resolveConflict(r2, d2.conflict.id, 'null', '', 'mike');
  !nullNoNote.ok ? ok('a NULL result requires a note saying why no answer exists') : bad('bare null allowed');
  const nullOk = R.resolveConflict(r2, d2.conflict.id, 'null', 'both valid under different player counts', 'mike');
  nullOk.ok ? ok('NULL is a legal outcome: "no right answer yet"') : bad('null result refused');
})();

/* ---- 10. merge is append-only union; state conflicts go to the gate ---- */
(function merge() {
  const mine = R.newRoute('Shared', 'g', 'mike');
  const s = R.addStep(mine, { title: 'step', checks: [{ kind: 'x' }], who: 'mike' });
  const theirs = JSON.parse(JSON.stringify(mine));
  R.addNote(mine, s.id, 'mike note', 'mike');
  R.addNote(theirs, s.id, 'ivan note', 'ivan');
  R.addStep(theirs, { title: 'ivan step', who: 'ivan' });
  theirs.steps[0].state = 'WORKING';

  const m = R.mergeRoutes(mine, theirs);
  m.ok ? ok('merge accepts the same route from two people') : bad('merge refused');
  m.route.steps.length === 2 ? ok('merge is a UNION — ivan\'s new step kept') : bad('merge lost a step');
  m.route.steps[0].notes.length === 2 ? ok('notes from both sides append (never conflict)') : bad('a note was lost');
  (m.conflicts.length === 1 && m.conflicts[0].kind === 'step_state')
    ? ok('a step-state disagreement is REPORTED, not auto-picked') : bad('state conflict auto-resolved');
  m.route.steps[0].state === 'CLAIMED' ? ok('merge did not silently overwrite my state') : bad('merge overwrote state');

  const other = R.newRoute('Different', 'g', 'x');
  !R.mergeRoutes(mine, other).ok ? ok('merging different routes is refused') : bad('merged unrelated routes');

  /* ids must be globally unique or two people collide on claim_7 */
  const ids = new Set();
  for (let i = 0; i < 500; i++) ids.add(R.uid('claim', 'mike'));
  ids.size === 500 ? ok('ids are collision-free across 500 generations') : bad('id collision: ' + ids.size);
})();

const head = 'AXM ROUTE SELFTEST — ' + new Date().toISOString() + '\n' + fails + ' FAIL\n\n';
console.log(head + out.join('\n') + '\n');
process.exit(fails ? 1 : 0);
