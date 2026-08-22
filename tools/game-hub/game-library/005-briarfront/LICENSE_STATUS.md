# License and asset status

Status: **TEST**  
Steam distribution decision: **NOT CLEARED — HUMAN REVIEW REQUIRED**

This ledger records package evidence; it is not a legal clearance or a claim that every file may be distributed commercially.

## Observed runtime content

- No shipped raster art, audio recordings, font files, or 3D model files were found in the runtime. The forest, actors, effects, and sounds are assembled procedurally in local source.
- Both `runtime/briarfront-client.html` and the preserved `runtime/grafthold-source.html` import Three.js 0.160.0 from `cdnjs.cloudflare.com`.
- The package does not contain a local Three.js build, source receipt, or license notice.
- Screenshots under `evidence/` are QA evidence, not runtime media or approved Steam store assets.

## Missing evidence and required decision

- The CDN dependency must be replaced with a pinned local copy before the offline Steam build is approved.
- The matching upstream license and copyright notice must be preserved in the shipped package, and the vendored file hash/source must be recorded.
- Mike must confirm ownership or distribution authority for the preserved Grafthold source and the active Briarfront code, copy, names, and branding.
- A depot allowlist should exclude QA evidence unless it is intentionally selected and separately approved as store material.

Until the dependency, notice, and source-ownership points are signed off, this game may remain in local TEST builds but is not cleared for a public Steam depot.
