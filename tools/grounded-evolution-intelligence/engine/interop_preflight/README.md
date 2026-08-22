# Three-Module Intake Preflight

This preflight exists for the later real intake of Module 1, Module 2, and Module 3.

It is **dry-run only**. It never edits `registry/`, accepts CANON, grants execution, or resolves conflicts by overwrite.

`module3_intake_manifest.template.json` is an example shape only. Its hash fields are not a digest of the final ZIP. Build fresh manifests from the actual package bytes at intake time.

A compatible fixture must pass. A fixture containing the same record ID with a different digest must fail with `CONFLICT_HOLD`.
