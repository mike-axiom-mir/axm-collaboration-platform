# Universal Object Fabric intake — evidence route

## `source-integrity`

- claim: the accepted v0.7.0 source is preserved exactly.
- kind: existence + static integrity.
- risk: medium.
- pass condition: source ZIP SHA-256 equals the signed acceptance value and its closed-world gate covers every declared file.
- primary surface: SHA-256 inspection plus the package intake gate.
- counterevidence: a digest mismatch, missing checksum row, duplicate path, unsafe path, or gate failure.
- observed evidence: ZIP SHA-256 `41c82b063d754ac417af297dcd91f3c54bee239793f1376331231aad64d747a0`; gate `3343/3343`; no failures.
- verdict: PASS-WITH-DECLARED-WARN.
- named seam: full archive extraction requires a short Windows root because 11 historical rollback files exceed legacy path handling under long roots; the exact ZIP is preserved in the intake.

## `game-stage-complete`

- claim: all ten game-safe assets are staged with their required v0.7 sidecars and no manufacturing files.
- kind: static structure + deterministic behavior.
- risk: medium.
- pass condition: ten unique exact identities; 668/668 staged checksums; each resolution row reaches its runtime manifest, Universal Object manifest, Runtime Capsule and visual-skin binding; no STL/3MF.
- primary surface: package staging receipt and independent Workshop self-test.
- counterevidence: duplicate identity, missing sidecar, identity drift, checksum mismatch, unlisted file, STL or 3MF.
- observed evidence: 10 unique identities, 668 checksums, 10 Runtime Capsules, 10 visual-skin bindings, zero manufacturing files.
- verdict: PASS.
- named seam: stage remains `STAGED-NOT-INTEGRATED`; receiving-game work is intentionally separate.

## `exact-resolution`

- claim: the Workshop resolver accepts only exact `asset_id + asset_version` matches.
- kind: deterministic behavior.
- risk: medium.
- pass condition: `AXM-CRATE-001@0.4.0` resolves one record and an unknown version is rejected.
- primary surface: `tools/universal-object-fabric/selftest.js`.
- counterevidence: partial/fallback match, ambiguity, inferred overlay path, or mismatched joined catalog identity.
- observed evidence: exact match passed; missing version and `9.9.9` were rejected; all ten catalog joins passed.
- verdict: PASS.
- named seam: none.

## `workshop-discovery`

- claim: the intake is discoverable as a TEST-status Workshop tool and capability provider.
- kind: static structure.
- risk: low.
- pass condition: valid manifest/contract/self-test in `tools-index.json` and generated public registries, with all eight declared capabilities bound to the tool.
- primary surface: generated index and registry inspection.
- counterevidence: invalid contract, missing entry/self-test, absent module, missing capability provider, or status promotion above TEST.
- observed evidence: 203-tool index generated; module and eight capability rows present; status remains TEST; registry states declarations are not runtime proof and grant no authority.
- verdict: PASS.
- named seam: none.

## `browser-journey`

- claim: the Workshop entrypoint renders, filters, selects an object, preserves warning visibility, and copies the exact resolution record at desktop and narrow viewport.
- kind: visual appearance + interaction journey.
- risk: medium.
- pass condition: 10/10 objects render; filter narrows to three `energy` results; Energy Core selection shows the exact identity and declared warning; copy action yields its exact Runtime Capsule and skin paths; no horizontal overflow at 390×844; no browser console errors/warnings.
- primary surface: in-app browser semantic snapshots, bounded interactions and screenshots.
- counterevidence: blank or clipped catalog, wrong object, hidden warning, bad clipboard identity, horizontal overflow, or console error.
- observed evidence: desktop frame `bef43a4d4d8398ab3bcd08f41a698b2feab7794f1e3d22dca81d62f4accd2bd0`; Energy Core frame `a93b1fa250fa0791033994c69d240cdd46db8ef0d1be41914e753e5605c82a15`; mobile frame `395e4a67545993c32a6c6eff03d73ef3c5e0967cbe84f5a94600c60fe6bcf6b0`; clipboard identity `AXM-ENERGY-CORE-001@0.4.0`; mobile `innerWidth=390`, `scrollWidth=375`; browser warnings/errors `0`.
- verdict: PASS.
- named seam: the main Workshop server could not start because an unrelated existing evidence-retention segment fails its hash chain; the visual check used a loopback-only static server and does not claim the main server path is healthy.
- temporary paths deleted: no screenshot or video files were written; the temporary server was stopped.
- cleanup complete: yes.

## `receiving-engine-runtime`

- required for this intake: no; this remains a receiving-project gate.
- claim: shipped Three.js and Godot helpers execute correctly inside a receiving game.
- kind: runtime behavior.
- risk: medium.
- pass condition: representative receiving projects load an object, select LODs, resolve sockets and apply a portable visual variant under the real engine runtimes.
- primary surface: receiving-game runtime tests.
- counterevidence: loader/import failure, wrong transform, missing material mapping, or engine error.
- observed evidence: helper sources exist and are covered by package/source tests; no receiving game or Godot runtime was executed here.
- verdict: UNKNOWN for receiving-game runtime; DEGRADED capability availability.
- named seam: engine-owned integration remains explicitly unclaimed by the handoff.
