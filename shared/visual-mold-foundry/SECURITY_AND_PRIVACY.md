# SECURITY AND PRIVACY — v0.9.1

## Local boundary

The core runs locally and binds only to `127.0.0.1`. The default workspace is port 8765. The launcher reuses that port only when it identifies an existing AXM server; an unrelated occupant is refused instead of causing an automatic origin change.

The HTTP handler accepts local Host names only, disables directory listing, and blocks paths that escape through traversal or symlinks. The core intentionally uses no account, telemetry, CDN, remote font, or cloud storage.

## Browser security headers

Localhost mode sends a restrictive Content Security Policy, Permissions Policy, same-origin resource and opener policies, no-referrer policy, and no-store caching.

Direct-file mode does not receive these HTTP response headers and has a separate browser-storage origin. A non-default port is also a separate origin.

## Persistence boundary

Governed persistence uses required writes: a failed storage write throws, and transactional mutations roll back instead of logging false success. Existing malformed raw values are preserved for explicit audit/reset rather than being silently overwritten.

## Import boundary

Imported JSON is parsed as data. The system rejects unsafe object keys, path-traversal-like values, excessive nesting and collection sizes, executable-looking content, and invalid integrity fingerprints where required.

Current workspace, family, project, batch, safety-capsule, and rescue packets require a valid FNV-1a-32 fingerprint before import or restore. FNV-1a-32 is non-cryptographic and collision-prone: it is accidental-corruption evidence only, not a signature, identity proof, or defense against a malicious author who can rewrite both content and fingerprint.

CSV and JSON batch intake rejects more than 100 rows or 100 columns, ragged CSV rows, and cells longer than 4,000 characters. Header normalization and collision renames are explicit so distinct source values are not silently overwritten.

Quarantined themes are rendered in previews only after declarative theme validation succeeds. Invalid theme records receive a blocked-preview message rather than having unsafe values inserted into preview markup.

## Interaction boundary

Governed actions use the in-app action dialog rather than browser prompt boxes. Destructive actions still require exact explicit confirmation. Closing or cancelling the dialog performs no action. Keyboard focus is contained and restored for dialogs and focus preview, with explicit and Escape exits.

## Restore boundary

Loading a safety capsule changes nothing. Replacement restore requires a valid staged capsule, exact `RESTORE` confirmation, automatic rescue-point creation, and successful post-restore health validation. Rollback snapshots and project revisions also verify their recorded fingerprint before state changes.

Browser storage and the rescue ring share the active browser profile and origin. They are not durable backups; export safety capsules to independent storage.

## Package boundary

Launch diagnostics verify SHA-256 hashes and exact coverage for the defined release-manifest scope. Missing, changed, duplicate, unsafe, symlinked, or unlisted in-scope package files fail diagnostics. Runtime output areas are intentionally excluded from release coverage.

## Downstream boundary

Blender, Godot, ComfyUI, Unity, Unreal, and MaterialX adapters remain scaffolds marked **LOCAL VALIDATION REQUIRED**. Pixel parity and target-engine security are not claimed. Windows Chrome/Edge visual behavior also remains **LOCAL VALIDATION REQUIRED**.
