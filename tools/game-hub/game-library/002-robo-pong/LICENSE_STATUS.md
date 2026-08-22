# License and asset status

Status: **TEST**  
Steam distribution decision: **NOT CLEARED — HUMAN REVIEW REQUIRED**

This ledger records package evidence; it is not a legal clearance or a claim that every file may be distributed commercially.

## Observed runtime content

- The launched neon runtime is local JavaScript/CSS/HTML plus three raster arena plates under `runtime/assets/maps/`.
- `README.md` and `design-qa.md` describe the arena plates as generated, project-local raster assets.
- The preserved rollback runtime also contains 19 generated test images under `runtime/assets/processed/`; `asset_manifest_v0_4.json` explicitly calls them non-final test assets.
- No bundled font files were found; the active presentation requests system font families.
- The old rollback notes refer to an optional Phaser file or CDN fallback. No Phaser vendor file or third-party license notice was found in this package, and that rollback client is not the manifest launch target.

## Missing evidence and required decision

- No prompt record, generator/tool identity, creation account, applicable terms, or commercial-use confirmation was found for either generated raster set.
- Repository presence and the word “generated” do not establish distribution rights.
- Before Steam packaging, Mike must either approve a documented rights chain for every shipped raster or replace/exclude the affected files.
- The unused rollback runtime should be excluded from the depot unless its Phaser dependency and notice obligations are separately resolved.
- Human source-ownership confirmation is still required for the local code, copy, names, and branding.

Until those points are signed off, this game may remain in local TEST builds but is not cleared for a public Steam depot.
