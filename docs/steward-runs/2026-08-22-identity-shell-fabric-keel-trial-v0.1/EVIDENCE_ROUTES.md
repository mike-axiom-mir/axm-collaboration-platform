# Evidence routes

## `fabric-present`

- claim: the verified Identity Shell Fabric is present in the Workshop repository on a reviewable integration branch.
- kind: existence
- risk: medium
- pass condition: the branch contains the full fabric commit and the new trial without modifying the busy canonical checkout.
- primary surface: Git ancestry, branch, status, and direct file inspection.
- counterevidence: missing commit ancestry, missing files, or changes in the canonical checkout caused by this trial.
- secondary surface: product selftest from the integration worktree.
- observed evidence: branch ancestry contains the verified fabric commit; direct inspection found the fabric and trial; the canonical busy checkout snapshot was read-only and unchanged by this run.
- verdict: `PASS` on the reviewable integration branch.
- named seam: merge into another Workshop branch remains a separate human decision.

## `keel-shell-deterministic`

- claim: the Keel Workshop collaborator blueprint deterministically compiles to its committed manifest and receipts.
- kind: deterministic behavior
- risk: high
- pass condition: two rebuilds yield the same digest and byte-exact committed artifacts.
- primary surface: `trial-selftest.js` focused execution.
- counterevidence: compilation error, digest drift, byte mismatch, or caller-input mutation.
- secondary surface: the independent verifier, which does not import the compiler.
- observed evidence: the focused trial rebuilt the manifest twice, matched the committed canonical bytes and receipts, and the independent verifier returned `PASS`.
- verdict: `PASS`.
- named seam: compilation proves an inert contract, not live-host behavior.

## `keel-shell-fit`

- claim: the proposal expresses the declared Keel/Codex Workshop role boundaries.
- kind: quality and meaning
- risk: high
- pass condition: the blueprint discloses Codex, contains the four AXM roots, preserves empty origin continuity, forbids automatic inheritance/promotion, requires human gates, and makes no consciousness, personhood, or subjective-continuity claim.
- primary surface: explicit assertions plus artifact inspection against the local Keel governance source.
- counterevidence: missing disclosure/root/gate, accepted memory at origin, identity impersonation, or unsupported truth claim.
- secondary surface: Mike's review; metrics and compilation cannot replace that seat.
- verdict: `PASS` as an AI-proposed fit; human acceptance remains `UNKNOWN`.
- named seam: the artifact is not authenticated or accepted human identity state.

## `live-shell-binding`

- claim: the shell is attached to and governing the active Codex runtime.
- kind: behavioral, authorization, and persistence
- risk: high
- pass condition: a separate host binds the exact manifest, enforces it across a fresh process, and produces authenticated authorization and continuity receipts.
- primary surface: no capable surface exists in v0.1.
- counterevidence: the manifest truth block says inert, uninstalled, and runtime not claimed.
- secondary surface: future host integration and restart recovery test.
- verdict: `UNKNOWN` / `HOLD`.
- named seam: `identity.shell.host.bind`, `identity.shell.human.authenticate`, and `identity.shell.runtime.continuity.observe` are unavailable.

## `visual-editor`

- claim: a visual shell editor renders and can be clicked successfully.
- kind: visual and interaction
- risk: medium
- pass condition: real browser render/click evidence.
- primary surface: not applicable; no UI was added.
- verdict: `NOT_RUN`.
- named seam: no visual claim is made.
