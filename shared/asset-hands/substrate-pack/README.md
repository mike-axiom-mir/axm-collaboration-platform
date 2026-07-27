# AXM external substrate pack

This pack turns selected `MISSING_SUBSTRATE` claims into exact, locally verifiable capabilities. It does not put third-party runtime bytes in the source tree and never installs anything during a normal Asset Fabric, Studio, server, or test request.

The public lock records the upstream release, exact byte size, SHA-256, licence review state, dependencies, live version probe and capabilities. The local inventory exposes digests and capability state, but no private installation paths.

## Explicit local install

```powershell
node shared/asset-hands/substrate-pack/installer.js install --all --root C:\AXM_MIRROR_LOCAL\substrates\p0-v1 --yes --accept-local-test-license-review
```

Use `status` for a read-only live inventory and `resolve --request godot` (or another request ID) for capability resolution. `offline-renderer` resolves to the exact Blender/Cycles runtime. `cross-renderer-runtime` resolves only when both Godot and Blender pass their probes; that composition proves runtime availability, not asset-level material parity. A failed hash, marker, dependency or live version probe remains unavailable; it is never downgraded to a fixture or claimed as ready.

The live suite also performs two independent fresh-process Cycles CPU renders from the same bounded recipe. The offline renderer passes only when both frames and editable `.blend` sources are created and the decoded floating-point pixel digests agree. Container-byte equality is reported separately because valid PNG metadata may vary without changing rendered pixels. Generated projects and logs are removed from the machine-local job area after their digest-only receipts are produced.

A separate two-process Blender matrix proves the runtime can create and reopen a real AO texture bake, deform a fully weighted mesh through a keyed armature, and advance a baked rigid-body simulation deterministically. These receipts expose `texture-baker`, `rig-runtime` and `simulation-runtime` as available substrates; they do not skip the richer artifact-level review conditions of the corresponding hands.

FFmpeg 8.1.2 is exercised through two bounded fresh-process matrices that mux deterministic FFV1/PCM media, inspect both streams with `ffprobe`, decode exact video and audio budgets, measure EBU R128 loudness, compare decoded digests and reject malformed input. The resulting runtime substrates do not replace audible or human delivery review.

The embroidery lane binds AXM's Tajima DST writer to pyembroidery 1.5.1. Two fresh parser/simulator processes preserve stitch movement and colour changes, enforce the declared machine delta limit and render identical simulations; a truncated counterexample is rejected. A physical test stitch remains an external review surface.

The official 3MF lane uses the 3MF Consortium Editor 1.0.0 beta CLI and its pinned consolidated schemas. AXM ignores the tool's headline result and parses issue records because the upstream CLI can report `Pass` alongside critical `SC_000` schema issues. The live corpus accepts a valid package and rejects an invalid unit from those issue records.

The CAD lane uses CadQuery OCP/Open CASCADE 7.9.3.1.1 to build a valid boolean B-rep, write STEP plus editable B-rep source, reopen STEP in two fresh processes and compare topology, volume and bounds within declared tolerances. It does not expose or claim the untested VTK visualisation surface.

The lock's licence status authorizes local testing only. A human release review must choose and preserve all required notices before any runtime redistribution. Blender, FFmpeg, veraPDF, CadQuery OCP and VTK remain local-install-only pending that review. Source publication does not include downloaded archives or installed runtimes.
