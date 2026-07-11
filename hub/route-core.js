/* ============================================================
   AXM ROUTE — route-core.js
   The roadmap format and its pure operations. The FILE is the product;
   the module is only an editor for it. Everything here is pure so the
   same logic runs in the browser module and in node under test.

   Shape (route.json):
     route   { id, title, goal, state, created, updated, requires[] }
     steps[] { id, title, state, checks[], depends_on[], notes[],
               superseded_by, reason }
     needs[] { id, question, step_id, answered_by, revisit_when, quiet }
     claims[]{ id, need_id, text, source, superseded_by, reason }
     sources[]{ id, kind, who, at, evidence }   kind: fetched|asserted|tested|human
     handoffs[]{ id, who, at, took, left_open, changed }
     conflicts[]{ id, need_id, claim_ids[], diagnosis, resolution, at, by }

   RULES ENFORCED HERE (not just documented):
     - a need is never "closed", only currently ANSWERED (by whom, when)
     - a claim without a source is a NOTE, and never counts as an answer
     - nothing is deleted; things are SUPERSEDED with a reason
     - a step resting on a superseded claim is FLAGGED, never auto-failed
     - closing a route is a human DECISION, never derived from checkboxes
     - conflicts may resolve to NULL ("no right answer yet")
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.AXMRoute = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SCHEMA = 'axm.route/v1';

  /* Same lifecycle vocabulary as hub modules — one language, not two. */
  const STEP_STATES = ['CLAIMED', 'NEEDS VERIFY', 'WORKING', 'SAVED CHECKPOINT', 'TEST-HOLD', 'CANON CANDIDATE'];
  /* A route's own life. goal_reached is SEPARATE from route_state on purpose:
     a goal can be reached and the route stay living; a goal can be unreached
     and the route go quiet. Neither is derived from the steps. */
  const ROUTE_STATES = ['living', 'quiet', 'closed'];
  /* Source kinds carry epistemic weight. A returning model must be able to
     tell a spec sheet from a small model's guess. */
  const SOURCE_KINDS = ['fetched', 'tested', 'human', 'asserted'];

  function nowISO() { return new Date().toISOString(); }
  /* globally-unique ids: two collaborators must never collide on claim_7 */
  function uid(prefix, who) {
    const r = Math.random().toString(36).slice(2, 8);
    return prefix + '_' + (who || 'anon').replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase() + '_' + Date.now().toString(36) + r;
  }

  function newRoute(title, goal, who) {
    return {
      schema: SCHEMA,
      route: { id: uid('route', who), title: title || 'Untitled route', goal: goal || '',
               state: 'living', goal_reached: false, created: nowISO(), updated: nowISO(),
               requires: [], author: who || 'anon' },
      steps: [], needs: [], claims: [], sources: [], handoffs: [], conflicts: []
    };
  }

  /* ---------------- steps ---------------- */
  function addStep(r, { title, checks, depends_on, who }) {
    const s = { id: uid('step', who), title: title, state: 'CLAIMED',
                checks: checks || [], depends_on: depends_on || [], notes: [],
                superseded_by: null, reason: null, created: nowISO() };
    r.steps.push(s); r.route.updated = nowISO(); return s;
  }
  /* A step with NO checks can never be more than CLAIMED by ticking.
     "done" must be earned by a check, or explicitly forced with a reason. */
  function setStepState(r, stepId, state, who, force) {
    const s = r.steps.find(x => x.id === stepId);
    if (!s) return { ok: false, error: 'no such step' };
    if (STEP_STATES.indexOf(state) < 0) return { ok: false, error: 'illegal state' };
    const beyondClaimed = STEP_STATES.indexOf(state) > 0;
    if (beyondClaimed && !s.checks.length && !force)
      return { ok: false, error: 'step has no check — a tick is a claim, not a verification. Add a check, or force with a reason.' };
    s.state = state; s.state_by = who || 'anon'; s.state_at = nowISO();
    if (force) s.forced_reason = force;
    r.route.updated = nowISO();
    return { ok: true, step: s };
  }
  function addNote(r, stepId, text, who) {   /* notes append; they never conflict */
    const s = r.steps.find(x => x.id === stepId); if (!s) return null;
    const n = { id: uid('note', who), text: text, by: who || 'anon', at: nowISO() };
    s.notes.push(n); r.route.updated = nowISO(); return n;
  }
  /* Plans drift. Do not delete a step — supersede it, with a reason. */
  function supersedeStep(r, stepId, newStepId, reason, who) {
    const s = r.steps.find(x => x.id === stepId);
    if (!s) return { ok: false, error: 'no such step' };
    if (!reason || !String(reason).trim()) return { ok: false, error: 'supersede needs a reason' };
    s.superseded_by = newStepId; s.reason = reason; s.superseded_by_who = who || 'anon'; s.superseded_at = nowISO();
    r.route.updated = nowISO(); return { ok: true, step: s };
  }

  /* ---------------- sources & claims ---------------- */
  function addSource(r, { kind, who, evidence }) {
    const k = SOURCE_KINDS.indexOf(kind) >= 0 ? kind : 'asserted';
    const s = { id: uid('src', who), kind: k, who: who || 'anon', at: nowISO(), evidence: evidence || null };
    r.sources.push(s); return s;
  }
  /* A claim MUST cite a source. Without one it is a note, not a claim. */
  function addClaim(r, { need_id, text, source_id, who }) {
    if (!source_id || !r.sources.find(s => s.id === source_id))
      return { ok: false, error: 'a claim without a source is a note, not a claim' };
    const c = { id: uid('claim', who), need_id: need_id, text: text, source: source_id,
                by: who || 'anon', at: nowISO(), superseded_by: null, reason: null };
    r.claims.push(c); r.route.updated = nowISO(); return { ok: true, claim: c };
  }
  /* Two models answering the same need produce TWO claims. Never merged.
     (update-25 lesson: machine-merge compresses toward the generic average.) */
  function claimsFor(r, needId) { return r.claims.filter(c => c.need_id === needId); }
  function liveClaimsFor(r, needId) { return claimsFor(r, needId).filter(c => !c.superseded_by); }

  /* ---------------- needs ---------------- */
  function addNeed(r, { question, step_id, revisit_when, who }) {
    const n = { id: uid('need', who), question: question, step_id: step_id || null,
                answered_by: null, answered_at: null, answered_who: null,
                revisit_when: revisit_when || null, quiet: false, created: nowISO() };
    r.needs.push(n); r.route.updated = nowISO(); return n;
  }
  /* A need is never closed — only CURRENTLY ANSWERED, by someone, at a time.
     Re-pointing it later is normal and keeps the whole decision history. */
  function answerNeed(r, needId, claimId, who) {
    const n = r.needs.find(x => x.id === needId); if (!n) return { ok: false, error: 'no such need' };
    const c = r.claims.find(x => x.id === claimId); if (!c) return { ok: false, error: 'no such claim' };
    if (c.need_id !== needId) return { ok: false, error: 'claim does not answer this need' };
    const prev = n.answered_by;
    n.answered_by = claimId; n.answered_at = nowISO(); n.answered_who = who || 'anon';
    n.history = n.history || []; if (prev) n.history.push({ was: prev, replaced_at: nowISO(), by: who || 'anon' });
    r.route.updated = nowISO();
    return { ok: true, need: n, previous: prev };
  }
  function supersedeClaim(r, claimId, newClaimId, reason, who) {
    const c = r.claims.find(x => x.id === claimId);
    if (!c) return { ok: false, error: 'no such claim' };
    if (!reason || !String(reason).trim()) return { ok: false, error: 'supersede needs a reason' };
    c.superseded_by = newClaimId; c.reason = reason; c.superseded_who = who || 'anon'; c.superseded_at = nowISO();
    r.route.updated = nowISO(); return { ok: true, claim: c };
  }
  /* Steps rest on claims. If a claim is superseded, SAY SO — never auto-fail
     the step. Better answers arriving must not silently invalidate work,
     and must not be discovered by accident either. */
  function shakyStes(r) { return staleSteps(r); }   /* alias guard */
  function staleSteps(r) {
    const out = [];
    r.steps.forEach(s => {
      const restsOn = (s.checks || []).filter(k => k.claim_id).map(k => k.claim_id);
      const bad = restsOn.filter(cid => { const c = r.claims.find(x => x.id === cid); return c && c.superseded_by; });
      if (bad.length) out.push({ step_id: s.id, title: s.title, superseded_claims: bad });
    });
    return out;
  }
  /* Needs the human/AI should see: unanswered, not quiet. Plus those whose
     wake condition fired. A need with no wake condition is a permanently
     curious question — legal, and shown as such. */
  function openNeeds(r) { return r.needs.filter(n => !n.answered_by && !n.quiet); }

  /* ---------------- route state (chosen, never computed) ---------------- */
  function setRouteState(r, state, who, reason) {
    if (ROUTE_STATES.indexOf(state) < 0) return { ok: false, error: 'illegal route state' };
    if (state === 'closed' && !(reason && String(reason).trim()))
      return { ok: false, error: 'closing is a decision — it needs a reason' };
    r.route.state = state; r.route.state_by = who || 'anon'; r.route.state_at = nowISO();
    if (reason) r.route.state_reason = reason;
    r.route.updated = nowISO(); return { ok: true };
  }
  function setGoalReached(r, reached, who) {
    r.route.goal_reached = !!reached; r.route.goal_by = who || 'anon'; r.route.goal_at = nowISO();
    r.route.updated = nowISO(); return { ok: true };
  }
  /* Progress is REPORTED, never used to close anything. */
  function progress(r) {
    const live = r.steps.filter(s => !s.superseded_by);
    const done = live.filter(s => ['WORKING', 'SAVED CHECKPOINT', 'CANON CANDIDATE'].indexOf(s.state) >= 0);
    const verified = done.filter(s => (s.checks || []).length && !s.forced_reason);
    return { steps: live.length, done: done.length, verified: verified.length,
             claimed_only: done.length - verified.length, open_needs: openNeeds(r).length };
  }

  /* ---------------- handoff + resume packet ---------------- */
  /* The workers are transient; the route is the memory they don't have. */
  function recordHandoff(r, { who, took, left_open, changed }) {
    const h = { id: uid('hand', who), who: who || 'anon', at: nowISO(),
                took: took || null, left_open: left_open || [], changed: changed || [] };
    r.handoffs.push(h); r.route.updated = nowISO(); return h;
  }
  /* BOUNDED projection. Nova (8B) cannot read a 300-step route. A fresh
     Claude must not re-litigate week one. So: the current step, its needs,
     live claims WITH source kind, what was already rejected and why, and the
     settled decisions it must not silently reopen. */
  function resumePacket(r, stepId) {
    const step = stepId ? r.steps.find(s => s.id === stepId)
                        : r.steps.find(s => !s.superseded_by && s.state === 'CLAIMED') || r.steps[0];
    const needs = r.needs.filter(n => !n.quiet && (!step || n.step_id === step.id || !n.step_id));
    const claimView = c => {
      const src = r.sources.find(s => s.id === c.source) || {};
      return { id: c.id, text: c.text, by: c.by, source_kind: src.kind, source_who: src.who,
               evidence: src.evidence || null, superseded: !!c.superseded_by };
    };
    const rejected = r.claims.filter(c => c.superseded_by)
      .map(c => ({ claim: c.text, why_rejected: c.reason, by: c.superseded_who }));
    const settled = r.needs.filter(n => n.answered_by).map(n => {
      const c = r.claims.find(x => x.id === n.answered_by) || {};
      return { question: n.question, decided: c.text, by: n.answered_who, at: n.answered_at,
               reopenable: true, note: 'settled — reopen deliberately, and it will be logged' };
    });
    return {
      schema: SCHEMA, route_id: r.route.id, title: r.route.title, goal: r.route.goal,
      route_state: r.route.state, goal_reached: r.route.goal_reached,
      requires: r.route.requires,
      current_step: step ? { id: step.id, title: step.title, state: step.state, checks: step.checks,
                             notes: step.notes.slice(-5) } : null,
      open_needs: needs.filter(n => !n.answered_by).map(n => ({ id: n.id, question: n.question, revisit_when: n.revisit_when })),
      live_claims: needs.flatMap(n => liveClaimsFor(r, n.id)).map(claimView),
      already_rejected: rejected,
      settled_decisions: settled,
      stale_steps: staleSteps(r),
      last_handoff: r.handoffs[r.handoffs.length - 1] || null,
      warning: 'Claims are not equal. Check source_kind before trusting one.'
    };
  }

  /* ---------------- conflict ---------------- */
  /* A contested need = two or more LIVE claims and no settled decision.
     The trigger announces itself; nothing needs to schedule it. */
  function contestedNeeds(r) {
    return r.needs.filter(n => !n.answered_by && liveClaimsFor(r, n.id).length > 1);
  }
  /* A cross-check must produce a DIFFERENT KIND of artifact than the thing it
     checks: not a fourth opinion, but a diagnosis of WHY they differ.
     Most conflicts die here on provenance alone — no human needed. */
  const CONFLICT_RESOLUTIONS = ['provenance', 'underspecified', 'fork', 'null'];
  function diagnoseConflict(r, needId, reviewer) {
    const live = liveClaimsFor(r, needId);
    if (live.length < 2) return { ok: false, error: 'not contested' };
    const kinds = live.map(c => (r.sources.find(s => s.id === c.source) || {}).kind || 'asserted');
    const rank = { fetched: 3, tested: 3, human: 2, asserted: 1 };
    const best = Math.max.apply(null, kinds.map(k => rank[k] || 1));
    const worst = Math.min.apply(null, kinds.map(k => rank[k] || 1));
    const c = { id: uid('conf', reviewer), need_id: needId, claim_ids: live.map(x => x.id),
                at: nowISO(), by: reviewer || 'reviewer', diagnosis: null, resolution: null, escalate: false };
    if (best > worst) {
      /* one side cited evidence, the other asserted from memory. Resolves itself. */
      const strongIdx = kinds.indexOf(Object.keys(rank).find(k => rank[k] === best));
      c.resolution = 'provenance';
      c.diagnosis = 'Claims differ in evidence quality: ' + kinds.join(' vs ') + '. The evidenced claim stands until challenged with equal evidence.';
      c.suggests = live[strongIdx >= 0 ? strongIdx : 0].id;
    } else {
      /* equal footing — this is real disagreement. Do not vote. */
      c.resolution = null; c.escalate = true;
      c.diagnosis = 'Both claims rest on ' + kinds[0] + ' evidence of equal weight. This is a genuine fork or the need is underspecified. No right answer is computable here.';
    }
    r.conflicts.push(c); r.route.updated = nowISO();
    return { ok: true, conflict: c };
  }
  /* A conflict may legitimately end in NULL: "these disagree, the reason is
     legitimate, and there is no right answer yet." Most systems cannot say
     this, so they force a pick. This one does not. */
  function resolveConflict(r, conflictId, resolution, note, who) {
    const c = r.conflicts.find(x => x.id === conflictId);
    if (!c) return { ok: false, error: 'no such conflict' };
    if (CONFLICT_RESOLUTIONS.indexOf(resolution) < 0) return { ok: false, error: 'illegal resolution' };
    if (resolution === 'null' && !(note && String(note).trim()))
      return { ok: false, error: 'a null result needs a note saying why no answer exists yet' };
    c.resolution = resolution; c.note = note || null; c.resolved_by = who || 'anon'; c.resolved_at = nowISO();
    r.route.updated = nowISO(); return { ok: true, conflict: c };
  }

  /* ---------------- merge (append-only union) ---------------- */
  /* Ivan sends his copy back. Union, never replace: keep both sides' history.
     Globally-unique ids make this safe. State fields can conflict — those are
     reported for the human gate, never auto-picked. */
  function mergeRoutes(mine, theirs) {
    if (!theirs || theirs.route.id !== mine.route.id) return { ok: false, error: 'different routes' };
    const out = JSON.parse(JSON.stringify(mine));
    const conflicts = [];
    ['steps', 'needs', 'claims', 'sources', 'handoffs', 'conflicts'].forEach(coll => {
      const have = new Set(out[coll].map(x => x.id));
      (theirs[coll] || []).forEach(item => { if (!have.has(item.id)) out[coll].push(item); });
    });
    /* notes append inside steps too */
    out.steps.forEach(s => {
      const t = (theirs.steps || []).find(x => x.id === s.id); if (!t) return;
      const have = new Set(s.notes.map(n => n.id));
      (t.notes || []).forEach(n => { if (!have.has(n.id)) s.notes.push(n); });
      if (t.state !== s.state) conflicts.push({ kind: 'step_state', id: s.id, mine: s.state, theirs: t.state });
    });
    (theirs.needs || []).forEach(t => {
      const n = out.needs.find(x => x.id === t.id); if (!n) return;
      if (t.answered_by && n.answered_by && t.answered_by !== n.answered_by)
        conflicts.push({ kind: 'need_answer', id: n.id, mine: n.answered_by, theirs: t.answered_by });
    });
    out.route.updated = nowISO();
    return { ok: true, route: out, conflicts: conflicts,
             note: conflicts.length ? 'Union complete. State conflicts are for the merge gate — nothing was auto-picked.' : 'Union complete, no state conflicts.' };
  }

  function validate(r) {
    const errs = [];
    if (!r || r.schema !== SCHEMA) errs.push('bad or missing schema');
    if (!r.route || !r.route.id) errs.push('missing route id');
    if (r.route && ROUTE_STATES.indexOf(r.route.state) < 0) errs.push('illegal route state');
    (r.claims || []).forEach(c => { if (!r.sources.find(s => s.id === c.source)) errs.push('claim ' + c.id + ' has no source'); });
    (r.needs || []).forEach(n => { if (n.answered_by && !r.claims.find(c => c.id === n.answered_by)) errs.push('need ' + n.id + ' answered by missing claim'); });
    return { ok: errs.length === 0, errors: errs };
  }

  return { SCHEMA, STEP_STATES, ROUTE_STATES, SOURCE_KINDS, CONFLICT_RESOLUTIONS,
           newRoute, uid, addStep, setStepState, addNote, supersedeStep,
           addSource, addClaim, claimsFor, liveClaimsFor,
           addNeed, answerNeed, supersedeClaim, staleSteps, openNeeds,
           setRouteState, setGoalReached, progress,
           recordHandoff, resumePacket, contestedNeeds, diagnoseConflict, resolveConflict,
           mergeRoutes, validate };
});
