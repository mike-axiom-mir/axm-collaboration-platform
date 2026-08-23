# Content-derived verification — implementation receipt

Date: 2026-08-09  
Branch: `codex/game-production-runner-v0.1`  
Status: **EXPERIMENTAL**

## Outcome

The runner's verifier interface now exposes copy-returning readers for declared
produced artifacts and direct verified dependency artifacts. This lets an
appointed verifier derive claims from bytes before the runner accepts or writes
an output as verified.

A deterministic documentation Hand and separately identified documentation
verifier with a distinct parsing implementation exercise the seam through three
packages:

1. normalize and preserve a locked brief;
2. render a release-note candidate from the independently readable brief;
3. bind the exact draft digest and intent digest while proving no publication
   occurred.

The verifier ignores executor claim facts. An adversarial replacement executor
returned malformed bytes while declaring every claim true; the run failed after
its bounded attempts. Verifiers that requested an undeclared output or dependency
input also failed, and mutation of a returned byte buffer did not alter the
runner-owned artifact. The two denied-access runs failed closed.

## Truth ceiling

This proves content-derived deterministic verification through a bounded runner
API. Hands and verifiers remain trusted in-process JavaScript and therefore are
not operating-system sandboxed. Structure and exact content coverage do not
prove editorial quality. Nothing was installed, published, promoted, released,
or made CANON.

## Verification

- Game Production Runner core self-test: PASS, 83 checks.
- Game Production Runner CLI self-test: PASS, 42 checks.
- Discovery seam review: PASS, 13 checks.
- Workshop verifier: PASS, 0 FAIL and 38 warnings outside this slice.
- Route, graft, skin, verify-plus, HTML script syntax, Tool Forge package,
  Agent Tool Forge, and Evidence Desk required checks: PASS.
- Hub required check: 3 known clean-base failures (radio source map,
  incremental growth-worker wiring, and responsive command-bar polish). The
  dirty live shared workspace contains a separate builder's repair lane and its
  Hub self-test was observed at 0 FAIL; those foreign changes were not copied or
  committed here.

Atomic claim routing and counterevidence are in `EVIDENCE_ROUTE.json` beside
this receipt.

## Shared-workspace lane

Only the isolated `codex/game-production-runner-v0.1` worktree was edited. The
dirty live Hub/growth lane and the original Workshop runner paths were not
modified.
