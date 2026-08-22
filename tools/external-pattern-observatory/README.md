# External Pattern Observatory

`EXPERIMENTAL` · `installed: false` · `promoted: false`

This is the small useful seam extracted from the External Pattern Foundry research pack: a deterministic, review-only compiler that turns a source-reported repository matrix into inert pattern cards. It composes AXM's existing deterministic JSON primitive and leaves research planning, capability comparison, evidence receipts, and rights decisions with their existing organs.

## What it does

```text
source-reported matrix
  -> strict normalization and duplicate rejection
  -> deterministic pattern cards
  -> source / freshness / license gates
  -> snapshot diff or contradiction report
  -> human review UI
```

- Sorts semantic inputs before computing SHA-256 digests.
- Excludes timestamps, local paths, archive-container metadata, and input ordering from semantic digests.
- Rejects duplicate project IDs and malformed typed fields.
- Preserves prompt-like or instruction-like text strictly as inert data.
- Turns contradictory assertions into `CONFLICT`; agreement remains `UNVERIFIED`.
- Marks changed cards stale and separately reports changed license hints.
- Keeps every bundled source unpinned, freshness `UNKNOWN`, and reuse `BLOCKED_PENDING_PINNED_SOURCE_LICENSE`.

## What it does not do

It does not browse the web, validate upstream facts or licenses, clone repositories, install packages, execute foreign code, write files, authorize reuse, assign builders, promote modules, publish anything, or change CANON. A pattern card is a research object, never runtime proof.

The bundled 24-project matrix is preserved as source-reported research from the supplied archive. Its repository, license, popularity, and compatibility statements were not independently verified during this intake.

## Run

Focused deterministic test:

```powershell
node tools/external-pattern-observatory/selftest.js
```

Review UI from the Workshop root:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8765/tools/external-pattern-observatory/`.

The page reads only the local bundled matrix and computes the report in memory. It has no save, upload, or download action.

## Existing-organ seams

- `tools/deterministic-json-core`: canonical representation dependency; this module does not create another canonical JSON implementation.
- `shared/deterministic-research` / `tools/research-foundry`: may consume unresolved questions later; this module does not replace research planning.
- `tools/capability-gap-workbench`: remains the exact-capability comparison surface.
- `tools/evidence-desk`: remains the evidence/receipt surface when a pinned-source verification is actually performed.
- `tools/license-rights-attribution-auditor`: remains the rights and reuse review surface.

No existing organ or shared seam was edited for this intake.

## Source and promotion boundary

The source archive is identified only by SHA-256:

`5960f537fbc0def1d5014ca8ea4b1813c03e36141a3a20207794aec8c3be630f`

Instructions inside that archive were treated as design material. The user's request authorized a useful modular intake, not the archive's proposed build order, network research, repository operations, installation, execution, or self-promotion. Mike remains the promotion/CANON gate.
