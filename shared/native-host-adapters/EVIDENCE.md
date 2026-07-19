# Native host adapter evidence route

Audit date: 2026-07-19. This receipt separates static, deterministic, authorization, recovery and real-host claims. The portable Blender runtime used for live verification remained outside the repository.

## `package-trust`

- Claim: an installed adapter package is accepted only when its identity, capabilities and fixed entrypoint are bound to a trusted Ed25519 signature and matching SHA-256 digests.
- Kind/risk: authorization and static structure; high.
- Pass condition: a correctly signed package passes; changed capabilities, an unknown key or changed entrypoint bytes fail.
- Primary surface: `package-codec.js` plus the ephemeral-key package tests.
- Counterevidence: any tampered or untrusted package registers successfully.
- Observed evidence: `node --test --test-concurrency=1 shared/native-host-adapters/tests/*.test.js` passed the signed-package and tamper cases.
- Verdict: **PASS**.
- Named seam: a package signature authenticates the adapter package, not the Blender executable. The driver records the executable digest separately and only labels it verified when an installation pins an expected digest.

## `canvas-routing`

- Claim: native capability is granted only when an installed signed package covers the requested application version, target-canvas constraints, source MIME and every operation.
- Kind/risk: deterministic behavior; high.
- Pass condition: the Blender request returns `MATCHED`; an unsupported canvas returns `UNSUPPORTED_CANVAS`; an absent adapter returns `MISSING_NATIVE_ADAPTER`; neither refusal grants `native-dcc-adapter`.
- Primary surface: shared registry tests with complete target-canvas constraint checks.
- Counterevidence: wildcard or degraded routing hides a mismatch.
- Observed evidence: the registry-selection test passed, including visible refusal states and host-profile capability denial.
- Verdict: **PASS**.
- Named seam: only the Blender reference package is installed by this build; other host names remain missing capability.

## `native-apply-inspect`

- Claim: the reference adapter can import an Asset Hand GLB into a real Blender project and verify it by reopening the saved `.blend` in another Blender process.
- Kind/risk: native runtime behavior and persistence; high.
- Pass condition: the first process saves a `.blend`; a fresh process finds matching source/change metadata and real mesh facts; source, project, inspection and package digests bind the receipt.
- Primary surface: official portable Blender 4.4.3 executing `native-real-blender-selftest.js`.
- Secondary surface: deterministic fake-driver tests assert the same state machine and receipt bindings.
- Counterevidence: no saved project, no mesh, digest mismatch, same-process-only inspection, or a missing receipt.
- Observed evidence: Blender archive SHA-256 matched the published value `60a9703b07f2cf42509f699ccdec4f5ede71c1932f6c14329f0e14c023e27d5c`; the live test passed GLB import, fresh-process inspection, exact receipt and rollback.
- Verdict: **PASS**.
- Named seam: this proves Blender 4.4.3 on the tested Windows portable runtime, not every Blender 4.x build or another operating system.

## `crash-and-rollback`

- Claim: partial work is visible, recoverable and never reported as success; rollback is idempotent and refuses to erase later edits.
- Kind/risk: persistence and destructive-state safety; high.
- Pass condition: crashes before prepare commit and after native save become `RECOVERY_REQUIRED`; partial native failure does the same; explicit rollback restores the exact baseline; a repeated rollback is stable; an externally changed project blocks rollback.
- Primary surface: fault-injected deterministic tests and on-disk transaction journals.
- Secondary surface: real Blender test creates then rolls back the `.blend`.
- Counterevidence: success from a partial state, a missing recovery record, silent retry, non-idempotent rollback, or removal after an external edit.
- Observed evidence: all crash, partial-failure, idempotence and post-edit cases passed; the real Blender project returned to its absent-project baseline.
- Verdict: **PASS**.
- Named seam: automatic crash-process restart was not simulated by terminating Node itself; the durable write-ahead states and explicit recovery path were exercised through injected failures.

## `mirror-authorization`

- Claim: Mirror can use the adapter without granting it implicit authority.
- Kind/risk: authorization; high.
- Pass condition: additional native adapters start disconnected, receive no built-in reset/auto-consent, require explicit consent and approval, run direct inspection during verify, and roll back using the exact adapter receipt.
- Primary surface: end-to-end Mirror integration test.
- Secondary surface: the complete 35-test Mirror suite and build-manifest verification.
- Counterevidence: auto-connect on reset, apply without consent/approval, or rollback without the exact transaction identity.
- Observed evidence: the integration test and all 35 Mirror tests passed; Mirror build verification passed all checks.
- Verdict: **PASS**.
- Named seam: Mirror directly trusts the configured runtime object and local trust store; it does not discover or install packages automatically.

## `portable-receipt-honesty`

- Claim: a portable Asset Hand never upgrades a pasted host report into its own cryptographic or independent verification claim.
- Kind/risk: claim quality; high.
- Pass condition: the complete host receipt is preserved, but its state is `HOST_REPORTED_INSPECTED`, portable cryptographic verification remains false, and an explicit warning records the unauthenticated trust-store seam.
- Primary surface: native-bridge hand tests and schema validation.
- Counterevidence: `independently_verified_application=true` or `cryptographic_signature_verified=true` solely from receipt fields.
- Observed evidence: native adapter and native bridge tests passed the separated runtime/Mirror versus portable-hand claims.
- Verdict: **PASS**.
- Named seam: authenticating portable host receipts would require a separate signed-receipt trust contract; this build deliberately does not invent one.

## `compatibility`

- Claim: old Asset Fabric state, SVG/raster distinction, existing hands, Studio handoffs and Mirror workflows remain usable.
- Kind/risk: deterministic compatibility; high.
- Pass condition: targeted legacy and integration suites pass without changing old required fields.
- Primary surface: Asset Hands schema/native/hardening tests, Asset Fabric selftest, Studio selftest and discovery review, and Mirror suite.
- Counterevidence: old saved state unreadable, raster treated as SVG, native adapter auto-routed without capability, or old Mirror rollback broken.
- Observed evidence: Asset Fabric `28 PASS / 0 FAIL`; Asset Hands hardening `20 PASS / 0 FAIL`; Studio and Mirror suites passed. The first broad run met a concurrent Foundation Planet v6/self-test v5 mismatch; workspace evidence showed that foreign lane actively changing. After its builder completed the v6 self-test update, the focused Foundation Planet suite passed 2,500+ assertions and a fresh complete `npm test` exited 0.
- Verdict: **PASS**.
- Named seam: the temporary broad-suite failure belonged to an actively moving Foundation Planet lane. This build did not edit or repair it; the final full-suite snapshot used the completed foreign update.
