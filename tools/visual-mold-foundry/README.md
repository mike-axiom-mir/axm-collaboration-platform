# AXM Visual Mold Foundry — Workshop intake

This is the bounded AXM Workshop door for the byte-identical Visual Mold Foundry v0.9.1 package at `shared/visual-mold-foundry/`.

- Workshop route: `/tools/visual-mold-foundry/`
- Protected application route: `/shared/visual-mold-foundry/app/index.html`
- Source ZIP SHA-256: `3579955D69755ABB1BB1536B8A998FA041CDB1E65B796DC86CA2FBBD80FCA404`
- Preserved archive: `backups/intake-sources/AXM_VISUAL_MOLD_FOUNDRY_v0.9.1_HARDENED_LOCAL_INTAKE.zip`
- Upstream manifest: 149 protected files
- Upstream release state: `VERIFIED_AUTOMATED_WITH_LOCAL_VALIDATION_REMAINING`

The Workshop adds no files inside the protected upstream package and does not merge its registries into CANON. Its 32 protected molds, six protected themes, 148 semantic tokens, 58 organ contracts and 38 starter presets stay authoritative inside the Foundry. Local themes, extensions, projects, batches and other growth keep the package's quarantine and explicit-approval lifecycle.

The manifest and module contract expose the useful local handoffs: mold, theme, token, project, batch, workspace, safety-capsule, PNG, WebP, SVG, HTML and CSS outputs. Preparing a Workshop handoff does not import or approve an artifact automatically.

The browser Studio is the reference runtime. Blender, Godot, ComfyUI, Unity, Unreal and MaterialX outputs remain data-only mapping scaffolds with local target-tool validation required.

## Verification receipt

- Archive path preflight: PASS — 188 ZIP entries, no unsafe or duplicate paths.
- Preserved archive byte equality: PASS.
- Protected upstream SHA-256 manifest: PASS — 149 files.
- Registry, schema, security, recovery, batch, project, static-link, HTTP and JavaScript checks: PASS.
- Upstream packaged diagnostic run in the bundled Windows Python: 56 PASS, 2 FAIL, 1 SKIP. The two failures are the standalone same-port reuse and foreign-port refusal subprocess tests, which timed out because this Python/Windows socket environment permitted a second bind; Chromium browser smoke was unavailable. The Workshop integration does not use the standalone port launcher.
- In-app browser Workshop route: PASS — desktop and 390×844 responsive layouts, dark/light themes, Atlas, Editor, Proof, Project, Batch, Recovery and Status views, Hub embedding, and browser console (zero warnings/errors).
- Full Windows Chrome or Edge visual inspection: pending at intake time.

Accordingly, the Workshop tool remains `TEST`. The intake does not repeat the upstream release's fully green automated claim for this machine.
