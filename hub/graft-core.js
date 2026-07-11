/* ============================================================
   AXM GRAFT — graft-core.js
   Turn a structured idea into a RECOMMENDED integration patch for THIS
   workshop, as it actually is right now. Never auto-applies. Produces a
   plan a human (or a cross-check) inspects before anything is built.

   A graft that does not take should FAIL VISIBLY, not poison the host.

   The three honest ideas this is built on:
     1. A PATCH IS A ROUTE WITH A FINGERPRINT.
        Reuse route-core's steps/checks/claims/supersede/merge-gate. Do not
        invent a second format. A patch step with no check can only be
        CLAIMED — no-fake-done, for free.
     2. A PATCH IS A CLAIM ABOUT A SYSTEM STATE, SO IT GOES STALE.
        It is computed_against a spine hash + module set + verify count.
        If the workshop changed since, the patch must refuse or loudly flag.
     3. A PATCH IS DATA, NEVER CODE.
        v0.1 produces a PLAN: files touched, order, checks that must pass
        before and after, and conflicts found. It contains no executable
        diff. The human writes the code. The human is the gate.

   Everything here is pure. `readState` is injected the facts it needs
   (manifests, spine, verify output) so it runs under node test with no
   filesystem, and in the browser against the live hub.
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.AXMGraft = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SCHEMA = 'axm.graft/v1';

  /* The spine must never be touched by a generated patch. */
  const PROTECTED = ['axm-foundation.js'];
  /* Capabilities a workshop may declare. A patch that needs one not present
     is a conflict, not a step. */
  function knownCapabilities(state) {
    /* Public Foundation capabilities. Keep this deterministic and shared by
       browser + Node Graft. A declaration is still not a permission grant. */
    const caps = new Set(['storage', 'wisdom', 'identity', 'ai', 'gate', 'export',
                          'files', 'network', 'bridge', 'friction', 'hub']);
    (state.modules || []).forEach(m => (m.provides || []).forEach(c => caps.add(c)));
    return caps;
  }

  /* ---- a fingerprint of the workshop state a patch was computed against.
     If any of these change, the patch is stale. ---- */
  function stateFingerprint(state) {
    const ids = (state.modules || []).map(m => m.id).sort().join(',');
    const stable = [state.spine || '?', state.verifyPass || 0, ids].join('|');
    let h = 5381;
    for (let i = 0; i < stable.length; i++) h = ((h << 5) + h + stable.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(8, '0');
  }

  /* ---- normalise an "idea" into what Graft needs to reason about ----
     An idea is the structured output of research/design: a name, an id it
     wants, the capabilities and permissions it needs, the layer it targets,
     new files it introduces, and any physics/core version it pins. */
  function normalizeIdea(idea) {
    return {
      id: idea.id || null,
      name: idea.name || 'Untitled idea',
      wants_id: idea.id || null,
      uses: idea.uses || [],
      permissions: idea.permissions || [],
      layer: idea.layer || 'open',
      new_files: idea.new_files || [],
      touches: idea.touches || [],
      pins: idea.pins || {},            /* e.g. { physics: 2 } */
      audience: idea.audience || 'human'
    };
  }

  /* ============================================================
     CONFLICT DETECTION — the valuable half. Any model can emit
     "step 1: make a folder". Only a STATE-AWARE module can say why a
     patch will not take.
     ============================================================ */
  function findConflicts(idea, state) {
    const i = normalizeIdea(idea);
    const conflicts = [];
    const caps = knownCapabilities(state);
    const ids = new Set((state.modules || []).map(m => m.id));

    /* id collision */
    if (i.wants_id && ids.has(i.wants_id))
      conflicts.push({ kind: 'id_taken', severity: 'block',
        detail: 'A module with id "' + i.wants_id + '" already exists. Choose another id.' });

    /* undeclared capability */
    i.uses.forEach(u => {
      const bare = String(u).split('@')[0];
      if (!caps.has(bare))
        conflicts.push({ kind: 'missing_capability', severity: 'block',
          detail: 'Needs capability "' + bare + '" — no installed module or foundation provides it. Build or install it first.' });
    });

    /* spine / protected files */
    i.touches.forEach(f => {
      if (PROTECTED.some(p => String(f).endsWith(p)))
        conflicts.push({ kind: 'touches_spine', severity: 'block',
          detail: 'Refused: "' + f + '" is the spine. A generated patch may never modify it.' });
    });

    /* file collisions with existing files */
    i.new_files.forEach(f => {
      if ((state.files || []).indexOf(f) >= 0)
        conflicts.push({ kind: 'file_exists', severity: 'warn',
          detail: 'File "' + f + '" already exists. The patch would overwrite it — confirm that is intended.' });
    });

    /* version pin disagreement */
    Object.keys(i.pins).forEach(cap => {
      const want = i.pins[cap];
      (state.modules || []).forEach(m => {
        const pinned = (m.pins || {})[cap];
        if (pinned != null && pinned !== want)
          conflicts.push({ kind: 'version_conflict', severity: 'warn',
            detail: 'This idea pins ' + cap + '@' + want + ', but module "' + m.id + '" pins ' + cap + '@' + pinned + '. They must agree or cross a declared boundary.' });
      });
    });

    /* permission the layer cannot grant — layers never grant anything, so
       this is always a passport concern, surfaced for the human */
    if (i.permissions.length)
      conflicts.push({ kind: 'permissions_declared', severity: 'info',
        detail: 'Declares permissions: ' + i.permissions.join(', ') + '. These come from the module passport, not the layer. Confirm each is justified.' });

    /* layer existence */
    const layers = (state.layers || ['open', 'private', 'ai-native']);
    if (layers.indexOf(i.layer) < 0)
      conflicts.push({ kind: 'unknown_layer', severity: 'warn',
        detail: 'Target layer "' + i.layer + '" does not exist yet. It would need to be created first.' });

    return conflicts;
  }

  /* ============================================================
     PATCH GENERATION — a plan, not a diff. The steps are ordered so each
     one can be checked before the next. Each step carries a check where a
     check is possible; steps that are decisions carry none and can only be
     CLAIMED (route-core enforces this downstream).
     ============================================================ */
  function generatePatch(idea, state) {
    const i = normalizeIdea(idea);
    const conflicts = findConflicts(idea, state);
    const blockers = conflicts.filter(c => c.severity === 'block');

    const steps = [];
    const step = (title, check, note) => steps.push({ title, check: check || null, note: note || null });

    /* if there are blockers, the patch is a REPAIR plan, not an install plan */
    if (blockers.length) {
      step('Resolve ' + blockers.length + ' blocking conflict(s) before integration', null,
           'Graft will not plan an install over a blocked state. Fix these first, then recompute.');
      blockers.forEach(b => step('BLOCKER: ' + b.detail, null, b.kind));
    } else {
      /* the honest install order */
      step('Confirm the target layer "' + i.layer + '" exists or create it',
           'layer "' + i.layer + '" present');
      if (i.uses.length)
        step('Confirm capabilities are present: ' + i.uses.join(', '),
             'each declared capability resolves');
      step('Create the module folder tools/' + (i.wants_id || 'new-module') + '/',
           'folder exists');
      step('Write manifest.json (id, name, version, status=EXPERIMENTAL, entry, uses, permissions)',
           'manifest parses and declares uses as an array');
      i.new_files.forEach(f => step('Add file: ' + f, 'file exists: ' + f));
      step('Run the verifier BEFORE wiring in — capture the baseline',
           'verify.js exit 0, note the PASS count');
      step('Add the module to the registry / added-set',
           'module appears in the sidebar');
      step('Run the verifier AFTER — PASS count must not drop',
           'verify.js exit 0 and PASS >= baseline');
      step('Open the hub in a browser and load the module once',
           'module renders, no blank screen');
      step('Keep status EXPERIMENTAL until isolated browser and verifier evidence exists', null,
           'no-fake-done: a generated package is not yet TEST or WORKING');
    }

    return {
      schema: SCHEMA,
      idea: { id: i.wants_id, name: i.name },
      computed_against: {
        spine: state.spine || '?',
        verify_pass: state.verifyPass || 0,
        module_count: (state.modules || []).length,
        fingerprint: stateFingerprint(state),
        at: new Date().toISOString()
      },
      conflicts,
      blocked: blockers.length > 0,
      steps,
      not_examined: [
        'the INTENT of the idea — Graft reads structure, not purpose',
        'runtime behaviour inside the browser (never executed here)',
        'whether the idea is a GOOD idea — only whether it fits',
        'anything the manifests do not declare'
      ]
    };
  }

  /* ============================================================
     STALENESS — a patch is a claim about a state. If the workshop changed,
     the patch is a proposal about a workshop that no longer exists.
     ============================================================ */
  function isStale(patch, currentState) {
    const now = stateFingerprint(currentState);
    const then = patch.computed_against && patch.computed_against.fingerprint;
    if (then !== now) {
      return { stale: true,
        reason: 'The workshop changed since this patch was computed (state ' + then + ' -> ' + now + '). Recompute before using it.',
        was: then, now: now };
    }
    return { stale: false };
  }

  /* A patch is portable as an IDEA, not as a patch. Two workshops with
     different module sets get different patches from the same idea. So what
     you share is the idea; each workshop recomputes its own patch. */
  function ideaFrom(patch) {
    return { note: 'Share the IDEA, not the patch. Each workshop computes its own patch against its own state.',
             id: patch.idea.id, name: patch.idea.name };
  }

  /* Render a patch as a human-readable plan (plain words, for a non-technical
     builder). Non-hidden: it says what it could not check. */
  function explain(patch) {
    const L = [];
    L.push('GRAFT — integration plan for "' + patch.idea.name + '"');
    L.push('computed against spine ' + patch.computed_against.spine +
           ', ' + patch.computed_against.module_count + ' modules, ' +
           patch.computed_against.verify_pass + ' checks passing');
    L.push('state fingerprint: ' + patch.computed_against.fingerprint);
    L.push('');
    if (patch.blocked) L.push('THIS PATCH IS BLOCKED. Fix the blockers, then recompute.');
    if (patch.conflicts.length) {
      L.push('What Graft found:');
      patch.conflicts.forEach(c => L.push('  [' + c.severity.toUpperCase() + '] ' + c.detail));
      L.push('');
    }
    L.push('Recommended order (each step checkable before the next):');
    patch.steps.forEach((s, n) => {
      L.push('  ' + (n + 1) + '. ' + s.title);
      if (s.check) L.push('       check: ' + s.check);
      if (s.note) L.push('       note:  ' + s.note);
    });
    L.push('');
    L.push('What Graft did NOT examine (a clean patch is not a safe patch):');
    patch.not_examined.forEach(x => L.push('  - ' + x));
    L.push('');
    L.push('Nothing here was applied. This is a plan for a human to inspect,');
    L.push('cross-check, and build. Graft does not touch your workshop.');
    return L.join('\n');
  }

  return { SCHEMA, PROTECTED, knownCapabilities, stateFingerprint,
           normalizeIdea, findConflicts, generatePatch, isStale, ideaFrom, explain };
});
