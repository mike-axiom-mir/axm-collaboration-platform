# AXM Native Host Adapters

This directory is the installed-executor boundary for portable Asset Hands transactions. It is additive to Asset Hands and Mirror: existing SVG, raster, print, fabric, game and saved-state flows do not require a native adapter.

The portable `axm.native-bridge-bundle/v1` remains data, approval and target-canvas intent. It cannot contain an executable command or script. A native adapter may run only when all of these remain true:

1. The installed adapter package has a trusted Ed25519 signature and its fixed entrypoint bytes match the signed SHA-256 digest.
2. Package capabilities cover the exact target canvas, MIME type and allowlisted operation set.
3. The staged source bytes, project path, baseline snapshot and dual approval match the exact bundle digests.
4. A write-ahead transaction journal reaches `APPLYING` before the native application can save.
5. A fresh native process reopens and inspects the saved project before `INSPECTED` can be claimed.
6. A partial failure becomes `RECOVERY_REQUIRED`; it is never silently retried or reported as success.
7. Rollback is explicit, baseline-bound, idempotent and blocked if the project changed afterward.

## Blender reference adapter

The reference package supports Blender 4.2 through tested Blender 5.2.x hosts and imports GLB 2.0 into a workspace-confined `.blend` project. The maximum remains exclusive at 5.3 so a future, untested Blender release is refused visibly. `blender/blender-host.py` is a fixed entrypoint. Bundle metadata is written as Blender custom properties, then checked by a separate background Blender invocation.

The driver always records the actual Blender executable SHA-256. An installation can additionally pin an expected executable digest; only an exact match sets `host_executable_digest_verified=true`. Package-signature trust and native-binary checksum trust remain separate claims.

No private signing key is stored here. Installation tooling must seal the package with a trusted local or release key. Tests generate an ephemeral Ed25519 key and prove signature, entrypoint, canvas, source, crash, inspection, rollback and Mirror integration behavior.

`registry.js` is the shared capability-negotiation layer. It grants the existing `native-dcc-adapter` host capability only when a trusted installed package matches application version, target canvas, source MIME and every requested operation. Its visible refusal states are `MISSING_NATIVE_ADAPTER`, `MISSING_NATIVE_CAPABILITY` and `UNSUPPORTED_CANVAS`.

`native-real-blender-selftest.js` is the live reference test. Pass an explicit portable Blender executable with `--blender`, the claimed application version with `--blender-version`, and, when the installation has pinned it, the extracted executable digest with `--blender-sha256`; the runtime itself should remain outside this repository.
