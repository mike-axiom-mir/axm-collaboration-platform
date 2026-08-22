# AXM Challenge Arena — Workshop intake

Status: `TEST` · installed: false · promoted: false · canonical: false

This is the Mike-directed Workshop integration of AXM Challenge Arena v0.6.0. The attached package and its documents were treated as source material. Their embedded directions did not authorize actions; Mike's platform-build request did.

The Arena gives the same locked challenge to independent AI or human seats, preserves their attempts, runs deterministic support checks, assigns blind peer review, exposes dissent and evidence gaps, and stops at a proposed result for explicit human decision.

## What is active here

- `axm_challenge_arena/` — dependency-free Python runtime.
- `schemas/` — 30 neutral JSON contracts, including `axm.module-job/0.1` and `axm.challenge-arena-return/0.4`.
- `tests/` — upstream regression suite.
- `tools/` — schema, contract, assignment, portability, wheel, and release verifiers.
- `examples/` — neutral producer jobs and review/submission templates.
- `docs/` — architecture, threat model, evidence, relay, recovery, and integration references.
- `upstream/` — selected source reports/guides plus a path-free manifest-gap summary; reference only, not Workshop authority.
- `index.html` — inert Workshop/Hub front door. It does not start Python or mutate Arena state.

The sealed demo `workspace/`, built wheel, and upstream release `CHECKSUMS.sha256` were deliberately not copied into the active tree. The intake ZIP and release ZIP hashes remain recorded in `SOURCE_INTEGRITY.json`. The active observer contains two documented Workshop repairs: authoritative HTML hidden states and compact decorative node labels that retain full accessible identities.

## Run locally

From `tools/challenge-arena`:

```powershell
py -m axm_challenge_arena --root .\workspace demo
py -m axm_challenge_arena --root .\workspace verify arena-demo-001
py -m axm_challenge_arena --root .\workspace serve
```

Observer: `http://127.0.0.1:8765`

Or use:

```powershell
.\run-observer.ps1
.\run-tests.ps1
```

`workspace/` is disposable local state and is ignored by git.

## Safety and authority

- Candidate execution is **off by default**.
- `--allow-execution` provides limits, not a VM/container security sandbox.
- Candidate files are evidence, never reviewer instructions.
- The observer is read-only and binds to `127.0.0.1` by default.
- Results, votes, recommendations, and merge maps remain proposals.
- Only Mike's explicit review can accept, merge, install, promote, or canonize output.

## Local verification

On 2026-08-16, before integration:

- outer intake manifest: all 32 entries matched byte counts and SHA-256 values;
- release internal checksums: 219/219 matched;
- unittest: 164 tests passed, 3 skipped;
- pytest: 161 passed, 3 skipped, 10 subtests passed;
- schema sync: 30/30 byte-identical;
- runtime contract validation: 30/30 passed;
- evidence ZIP portability: 20/20 randomized repacks passed.

The inspected upstream `AXM_MODULE_MANIFEST.json` labels itself v0.6.0 while retaining v0.5-era test counts, coverage, wheel hash, and clean-install evidence. Its path-bearing original remains in the sealed release; `upstream/UPSTREAM_MANIFEST_GAP.md` preserves the useful contradiction without committing source-machine paths. This intake keeps the mismatch visible rather than treating it as current v0.6 evidence.

The browser render/click check also found and repaired two upstream observer defects: component `display` rules overrode the HTML `hidden` attribute, while long opaque labels overflowed and CSP-blocked HTML style attributes stacked every arena node together. The Workshop copy now makes `[hidden]` authoritative, uses CSP-compatible local JavaScript placement, and compacts only decorative labels while preserving full accessible identities. `selftest.js` guards both repairs.
