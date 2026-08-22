============================================================
AXM REASONING SHELL v0.2 - BRANCH DOCUMENTATION
BRANCH ONLY - NOT CANON - NOT FOUNDATION - INHERITS FROM THE
BACKBONE, DOES NOT OWN IT - SUGGESTION, NOT TRUTH
============================================================

FILE MAP

index.html                 module UI and explicit action wiring
reasoning-shell-core.js    deterministic format:1 session logic
profiles.json              one real profile and six labeled placeholders
manifest.json              authority and discovery declaration
module.contract.json       capability, write, refusal, and lifecycle boundary
selftest.js                held-out core, contract, profile, and markup checks

BUILT FLOW

task + condition -> gated session start -> one gated AXM.ask step
(or honest manual mode) -> gated human checkpoint -> accepted step
or fail-closed repair route with a non-empty rejection_reason ->
gated after-action -> optional gated tweak PROPOSAL with status
always proposal -> explicit persisted session -> separately gated
explicit export.

The shell-off condition receives the task, prior accepted steps,
and generic output format only. It receives no profile system frame
and no repair context. Local comparison accepts exactly one shell-on
export followed by one shell-off export and reports recorded counts.

SAFETY RULES

- Every state-changing shell action submits to AXMGate and honors deny.
- No automatic step loop, session start, profile mutation, tweak apply,
  export, promotion, or CANON action exists.
- A denied tweak proposal is removed before the after-action is saved.
- A failed session save does not enable export.
- Export is explicit and revokes its temporary object URL.
- The local comparison is read-only and does not rate model quality.
- Same-origin profiles.json is the only direct fetch. Model transport,
  when selected, remains owned by AXM.ask.

EVIDENCE

The deterministic core self-test proves prompt separation, route
validation, proposal-only after-actions, exact condition pairing,
profile shape, manifest/contract validity, gate-action wiring, script
syntax, and definite static form naming.

NOT PROVEN

- No real-model effectiveness or learning-improvement claim.
- No proof that a human checkpoint is correct or fatigue-free.
- No proof that placeholder profiles improve any model.
- No rendered usability, screen-reader, or visual-quality approval.
- No registry connector integration beyond the existing AXM.ask seam.

STOP CRITERIA

Stop and flag if a change needs autonomous looping, compute allocation,
new sandbox authority, direct internet access, gate/registry mutation,
shared shell-only directories, profile auto-tuning, or authority over
other modules. None is granted here.
============================================================
