# Grounded-growth frontier audit

Status: `TEST`

## Audited frontier

The v4.5 evidence pass regenerated `tools-index.json` from an ignored local
selftest receipt. Failure tails were bounded but copied verbatim. Exact parent
Git blobs show 12 retained tails and 11 absolute-workspace leaks. The generator
sliced raw stderr/stdout or stored `error.message`; readiness indexing copied
the supplied result object unchanged. The exact path and raw failure text are
not retained in this v4.6 evidence folder.

The separate aggregate operations failure remains environmental/untracked
intake debt. Creating substitute verification modules or weakening that test
would not repair diagnostic privacy, so it was not selected as this seam.

## Implemented seam

`shared/readiness/diagnostic-redaction.js` provides deterministic redaction and
bounded-tail helpers. It replaces configured roots before residual absolute
path patterns so repository-relative suffixes remain useful. It then removes
unknown Windows drive paths, UNC host/share paths, POSIX absolute paths, and
file URLs. It returns a copied verification result rather than changing the
input object.

`generate-tools-index.js` applies the shared helper on timeout, spawn error, and
ordinary selftest failure paths. `daily-verification.js` uses the same helper.
`tool-readiness.js` sanitizes results again at ingestion, which repairs derived
views produced from older local receipts. Raw command output is still reduced
to SHA-256 independently; the digest is not computed over rewritten text.

The current derived index declares the narrow truth field
`failureDiagnosticsMachinePathRedacted: true`. A 27-assertion artifact test
checks every one of its 12 retained failure tails, while the direct suite adds
25 synthetic assertions across known roots, residual paths, preserved useful
context, bounds, and input immutability.

## Evidence and counterevidence

The scoped receipt passed 19/19 commands, 186 focused assertions, 255 package
path controls, and every AGENTS.md command. The clean product archive passed
five commands plus a fresh synthetic readiness-ingestion fixture across 15
byte-unchanged files.

The readiness aggregate passes. The operations aggregate still fails at
`CURATED_VERIFICATION_INTAKE_MISSING`; its service blob and package script are
unchanged, and the intake exists in neither Git tree nor the workspace. That is
preserved as `FOREIGN_FAILURE`, not treated as v4.6 success.

No HTML, CSS, browser app JavaScript, Review Inbox behavior, authority policy,
or Foundation file changed. No live browser rerun is claimed.

## Boundary

This is path redaction for the named diagnostic fields, not general secret or
personal-data detection. It does not scan or retroactively sanitize ignored or
external histories, rewrite prior commits, prove that every repository file is
private-data-free, or remove deliberately documented installation examples.
It grants no execution, adoption, promotion, merge, Foundation, or `CANON`
authority. Mike Tobi / AXM remains the merge and `CANON` gate. The broad
grounded-growth objective remains active.
