# AXM Discovery Engine × Stance Forge

Status: **EXPERIMENTAL v0.1**

## Install in an AXM Workshop

Extract the package inside the Workshop's `tools/` folder so this file lands
at:

```text
tools/discovery-engine/README.md
```

The local server discovers the module from
`tools/discovery-engine/manifest.json`. Restart or refresh the Workshop, then
open **Hub → Modules → Add → AXM Discovery Engine × Stance Forge**. No separate
registry edit is required. `PUBLIC_MANIFEST.json` is only regenerated when a
combined/public Workshop release is packaged.

This module turns the Discovery Engine prompt and the Physics Stance Forge
loop into one stateful, user-facing workbench:

```text
discover on any subject
→ freeze a provisional candidate
→ optional professional pressure test
→ preserve contradictions, failures, vetoes and proposed revisions
→ human decision
```

## Three power levels

- **Manual**: the complete workflow works without a connected model.
- **Assisted**: one explicit model request produces a proposal which a human
  accepts or rejects.
- **Bounded run**: the user grants a visible subject, role pack, provider pool,
  protocol, cycle count and model-call budget. The module reserves each call
  before dispatch, then schedules work through the existing `AXM.ask` router.
  It pauses on schema errors, expiry, budget exhaustion and real evidence gates,
  saves an exact resume point, and retains every failed, interrupted and retried
  attempt instead of overwriting it.

Manual mode is a fallback, not the design ceiling. Bounded automation may run
all fourteen Physics roles and up to three review cycles. It still produces an
`AI_DRAFT_REQUIRES_REVIEW`; it does not silently turn model material into
evidence or canon.

## Two bounded protocols

- **Compressed team pressure**: eight Discovery passes, one candidate
  synthesis, relevance-gated professional role passes, contradiction/failure
  synthesis and optional Curious Lab Partner commentary. This is useful
  internal review; it is not the full 45 KB experiment loop.
- **Full Stance Forge evidence loop**: adds current-frontier framing, rotating
  role order, contradiction mapping, high-information experiment selection,
  predeclaration, V&V/UQ/evidence prechecks, targeted source leads, bounded
  implementation and provenance plans, controls/canaries, failure attack,
  result-role review, claim audit, stance-integrity review, productivity and
  saturation handling.

The current provider router is text-only. Therefore the full protocol stops at
an **executed evidence gate** instead of pretending a model ran an experiment.
A user imports the observation, command output, raw result or honest `BLOCKED`
record, then explicitly resumes. Evidence-profile controls and Physics canaries
remain `NOT_RUN` until their results are separately recorded.

## Existing infrastructure only

The module uses the canonical `axm-foundation.js` copy and existing:

- `AXM.store` for local project state;
- `AXMGate` for visible user-authorized actions;
- `AXM.ask` / `AXMConnect` for whichever providers are already configured;
- Hub passport and checkpoint services;
- explicit JSON/text export.

It adds no Bridge route, Machine Host, registry, Foundation mutation or hidden
background agent. A provider list such as `bridge:claude, bridge:chatgpt, local`
only addresses options already understood by the current provider router.

## Review packs

- `general-lab`: eleven subject-neutral professional jurisdictions selected
  against an empirical, computational, software, documentary, design,
  normative or mixed evidence profile.
- `physics-stance-forge`: the full fourteen-role v0.3 physics team plus its six
  permanent analytic canaries.

Multiple roles performed by one model are labelled `SINGLE-MODEL MULTI-ROLE ·
NOT INDEPENDENT`. Multiple connected providers are labelled cross-model internal
review, not independent validation.

## Truth boundary

- Names remain provisional; novelty is `UNCHECKED` until a declared search.
- AI citations are source leads until checked.
- The original candidate is snapshotted before review; review proposes a new
  revision and never silently overwrites it.
- Corrected control results append a revision; earlier failure evidence remains
  visible in the project bundle.
- `Curious Lab Partner` commentary is stored separately with
  `maySupportClaims:false`.
- Medical, legal, structural, financial, robotics and other high-stakes outputs
  still require qualified external review.

New, Resume and Import preserve the displaced workspace in a local recovery
slot before replacing the live screen. Reopening from the Hub restores only a
matching, deeply validated session and never starts an AI call.

## Checks

```bash
node tools/discovery-engine/selftest.js
node tests/html-script-syntax-test.js
node verify.js
```

Project-specific bounded passes may live beside the core when their executable
controls are worth preserving. `physical-controller-discovery.js` records the
Shared Controls gamepad-route seams, repairs that can be proven without
hardware, and the still-open physical-device evidence gate.

`asset-hands-discovery.js` applies the SOFTWARE-profile General Evidence Lab to
the shared Target Canvas registry. It preserves a deterministic request matrix,
checks native raster and cutting routes, refuses unsafe or unsupported canvases,
and keeps PDF, animated-raster and 3D gaps visibly blocked.

These checks do not contact a model or execute either source prompt. The core
self-test covers manual use, bounded dispatch reservations, duplicate/out-of-
order refusal, malformed output, stale proposals, full evidence-gate pause and
resume, fourteen-role provenance, controls, abstention, materialization and
report truth boundaries. Browser render/click/reload remains a separate test;
the current Work container has Playwright but no installed Chromium executable.
