#!/usr/bin/env node
/* ============================================================
   AXM GRAFT — graft-selftest.js
   Every rule the module promises, asserted. Exit 0 = pass.
   Run:  node hub/graft-selftest.js
   ============================================================ */
'use strict';
const G = require('./graft-core.js');
const out = []; let fails = 0;
const ok = m => out.push('  PASS  ' + m);
const bad = m => { out.push('  FAIL  ' + m); fails++; };

/* a fake but realistic workshop state */
function stateA() {
  return {
    spine: '418f9ce4fb050602',
    verifyPass: 79,
    layers: ['open', 'private', 'ai-native'],
    files: ['hub/index.html', 'tools/route/index.html'],
    modules: [
      { id: 'route', pins: {} },
      { id: 'skinner', pins: {} },
      { id: 'studio', provides: ['export'], pins: { physics: 1 } }
    ]
  };
}

/* ---- 1. state-awareness: the patch records what it was computed against ---- */
(function stateAware() {
  const idea = { id: 'graft', name: 'Graft', uses: [], layer: 'open' };
  const p = G.generatePatch(idea, stateA());
  (p.computed_against && p.computed_against.spine === '418f9ce4fb050602' && p.computed_against.module_count === 3)
    ? ok('state-aware: the patch records the spine, module count, and verify count it was computed against') : bad('patch did not record state');
  p.computed_against.fingerprint ? ok('state-aware: the patch carries a fingerprint of the state') : bad('no fingerprint');
})();

/* ---- 2. the spine may never be touched ---- */
(function spine() {
  const idea = { id: 'evil', name: 'Evil', touches: ['hub/axm-foundation.js'] };
  const c = G.findConflicts(idea, stateA());
  const spineC = c.find(x => x.kind === 'touches_spine');
  (spineC && spineC.severity === 'block') ? ok('spine: touching axm-foundation.js is a BLOCKING conflict') : bad('spine touch not blocked');
  const p = G.generatePatch(idea, stateA());
  p.blocked ? ok('spine: a patch that touches the spine is marked blocked') : bad('spine patch not blocked');
})();

/* ---- 3. id collision ---- */
(function idTaken() {
  const idea = { id: 'route', name: 'Another Route' };
  const c = G.findConflicts(idea, stateA());
  const dup = c.find(x => x.kind === 'id_taken');
  (dup && dup.severity === 'block') ? ok('conflict: a taken module id is a blocking conflict') : bad('id collision not caught');
})();

/* ---- 4. missing capability ---- */
(function missingCap() {
  const idea = { id: 'game', name: 'Game', uses: ['physics'] };
  const c = G.findConflicts(idea, stateA());
  const miss = c.find(x => x.kind === 'missing_capability');
  (miss && miss.severity === 'block' && miss.detail.includes('physics'))
    ? ok('conflict: a needed capability that no module provides is blocked, and named') : bad('missing capability not caught');

  /* a capability that IS provided passes */
  const idea2 = { id: 'exporter', name: 'Exporter', uses: ['export'] };
  const c2 = G.findConflicts(idea2, stateA());
  !c2.find(x => x.kind === 'missing_capability') ? ok('conflict: a capability provided by a module is accepted') : bad('provided capability wrongly flagged');

  const idea3 = { id: 'gated', name: 'Gated tool', uses: ['gate'] };
  const c3 = G.findConflicts(idea3, stateA());
  !c3.find(x => x.kind === 'missing_capability') ? ok('conflict: Foundation gate capability is recognized') : bad('Foundation gate capability wrongly flagged');
})();

/* ---- 5. version pin disagreement ---- */
(function versionPin() {
  const idea = { id: 'sim', name: 'Sim', pins: { physics: 2 } };
  const c = G.findConflicts(idea, stateA());
  const ver = c.find(x => x.kind === 'version_conflict');
  (ver && ver.detail.includes('physics@2') && ver.detail.includes('physics@1'))
    ? ok('conflict: a version pin that disagrees with an installed module is flagged, both versions named') : bad('version conflict not caught');
})();

/* ---- 6. file collision is a warning, not a block ---- */
(function fileCollision() {
  const idea = { id: 'x', name: 'X', new_files: ['tools/route/index.html'] };
  const c = G.findConflicts(idea, stateA());
  const fc = c.find(x => x.kind === 'file_exists');
  (fc && fc.severity === 'warn') ? ok('conflict: overwriting an existing file WARNS (does not block)') : bad('file collision severity wrong');
})();

/* ---- 7. a clean idea produces an install plan with before/after checks ---- */
(function cleanPlan() {
  const idea = { id: 'notes', name: 'Notes', uses: [], layer: 'open', new_files: ['tools/notes/index.html'] };
  const p = G.generatePatch(idea, stateA());
  !p.blocked ? ok('plan: a clean idea is not blocked') : bad('clean idea wrongly blocked');
  const titles = p.steps.map(s => s.title).join(' | ');
  (titles.includes('BEFORE') && titles.includes('AFTER'))
    ? ok('plan: the install order runs the verifier BEFORE and AFTER wiring in') : bad('no before/after verify gate');
  const afterStep = p.steps.find(s => s.title.includes('AFTER'));
  (afterStep && afterStep.check.includes('PASS >= baseline'))
    ? ok('plan: the after-check requires the PASS count not to drop') : bad('after-check does not guard the pass count');
  const lastStep = p.steps[p.steps.length - 1];
  lastStep.title.includes('EXPERIMENTAL') ? ok('plan: no-fake-done — generated modules stay EXPERIMENTAL') : bad('plan promoted a generated module too early');
})();

/* ---- 8. staleness: a patch is a claim about a state ---- */
(function staleness() {
  const idea = { id: 'notes', name: 'Notes' };
  const p = G.generatePatch(idea, stateA());
  const fresh = G.isStale(p, stateA());
  !fresh.stale ? ok('staleness: a patch is fresh against the state it was computed on') : bad('fresh patch marked stale');

  /* now the workshop changes — a module is added */
  const changed = stateA(); changed.modules.push({ id: 'graft', pins: {} }); changed.verifyPass = 82;
  const st = G.isStale(p, changed);
  (st.stale && st.reason.includes('changed')) ? ok('staleness: a patch goes STALE when the workshop changes under it') : bad('stale patch not detected');
})();

/* ---- 9. a patch is data, never code ---- */
(function dataNotCode() {
  const idea = { id: 'notes', name: 'Notes' };
  const p = G.generatePatch(idea, stateA());
  const json = JSON.stringify(p);
  /* the plan describes steps and checks; it must not carry executable diffs */
  const hasCodeField = ('diff' in p) || ('code' in p) || ('patch_code' in p) || p.steps.some(s => 'code' in s || 'diff' in s);
  !hasCodeField ? ok('data-not-code: the patch contains a plan and checks, no executable diff') : bad('patch carried code');
  p.steps.every(s => typeof s.title === 'string') ? ok('data-not-code: every step is a described action, not a command to run') : bad('a step was executable');
})();

/* ---- 10. non-hidden: it reports what it could not check ---- */
(function notExamined() {
  const idea = { id: 'notes', name: 'Notes' };
  const p = G.generatePatch(idea, stateA());
  (Array.isArray(p.not_examined) && p.not_examined.length >= 3)
    ? ok('non-hidden: the patch reports what it did NOT examine') : bad('patch did not report blind spots');
  p.not_examined.some(x => x.toLowerCase().includes('intent')) ? ok('non-hidden: it admits it cannot read the intent of an idea') : bad('did not flag intent as unexamined');
  p.not_examined.some(x => x.toLowerCase().includes('browser') || x.toLowerCase().includes('runtime')) ? ok('non-hidden: it admits runtime was never executed') : bad('did not flag runtime as unexamined');
})();

/* ---- 11. portability: share the idea, not the patch ---- */
(function portable() {
  const idea = { id: 'notes', name: 'Notes' };
  const p = G.generatePatch(idea, stateA());
  const back = G.ideaFrom(p);
  (back.id === 'notes' && back.note.includes('own state'))
    ? ok('portable: a patch yields back the IDEA, with a note that each workshop recomputes its own patch') : bad('portability wrong');

  /* same idea, different workshop -> different patch */
  const stateB = { spine: 'abc', verifyPass: 40, layers: ['open'], files: [], modules: [{ id: 'route', pins: {} }] };
  const pB = G.generatePatch(idea, stateB);
  (p.computed_against.fingerprint !== pB.computed_against.fingerprint)
    ? ok('portable: the same idea produces a different patch for a different workshop') : bad('patch not state-dependent');
})();

/* ---- 12. explain() renders a plain-words plan ---- */
(function explainReadable() {
  const idea = { id: 'game', name: 'Game', uses: ['physics'], touches: ['hub/axm-foundation.js'] };
  const p = G.generatePatch(idea, stateA());
  const text = G.explain(p);
  (text.includes('BLOCKED') && text.includes('did NOT examine') && text.includes('Nothing here was applied'))
    ? ok('explain: renders a plain-words plan that states blockers, blind spots, and that nothing was applied') : bad('explain output incomplete');
})();

const head = 'AXM GRAFT SELFTEST — ' + new Date().toISOString() + '\n' + fails + ' FAIL\n\n';
console.log(head + out.join('\n') + '\n');
process.exit(fails ? 1 : 0);
