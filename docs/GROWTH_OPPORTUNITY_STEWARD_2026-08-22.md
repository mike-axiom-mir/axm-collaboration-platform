# Growth opportunity steward note — 2026-08-22

Status: `TEST`

## Why the displayed count was misleading

The observed 16 invalid manifests came from an older Observatory worktree, not
the integrated Workshop body. Most of those records had already been repaired
on the current foundation. The remaining integrated failures were validator
taxonomy drift (`organ` and `gate`) plus one manifest without an explicit kind.

## Repaired in this branch

- accept the declared `organ` and `gate` tool kinds in both runtime and schema
- declare `mirror-code-clone` as `machine-capability`
- provide top-level selftest entrypoints for Game Hub and Shell Guardian
- expose the Observatory runner state through the API
- label the measured source body, timestamp, freshness, and signal categories
- separate blocking, attention, optional opportunity, and context filters
- refresh the generated Workshop index and city registry views

## Current measured boundary

The direct Observatory scan reports 219/219 valid manifests, 219/219 valid
contracts, 219/219 top-level selftests, a current evidence registry, and zero
blocking signal types. Six non-blocking signal types remain:

- exact consumer-only identifiers needing semantic review
- four `WORKING` claims waiting for current local receipts
- optional README coverage
- legacy manifests whose kind is still intentionally undeclared
- provider-only identifiers retained as reuse context
- unresolved public gates retained as release context

Those are not safe bulk edits. Automatically inventing consumers, receipts,
kinds, documentation, or release decisions would make the metric smaller while
making the evidence less truthful.

## Verification

All checks required by `AGENTS.md` passed, including the Hub and route suites.
Focused Observatory, readiness, generator, and wrapper selftests also passed.
A separate live-browser check confirmed the Growth dialog on desktop and a
phone-sized viewport, exercised the Context filter, and found no browser console
warnings or errors.

This note does not grant `CANON`. Mike Tobi remains the merge and canon gate.
