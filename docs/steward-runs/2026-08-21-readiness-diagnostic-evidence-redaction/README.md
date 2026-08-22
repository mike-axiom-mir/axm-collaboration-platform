# Readiness diagnostic evidence redaction v4.6

Status: `TEST`

This folder binds the bounded v4.6 seam at product commit
`0533987856b321d67ede5f6d8a3fd8867f9cfbfb` and tree
`6007cd2fc1143df2f2cf81ecc4639eed28c3274d`.

The exact parent `tools-index.json` retained 12 selftest failure tails; 11
contained this checkout's absolute machine path. The receipt records only the
counts and cause, not the leaked path or raw diagnostics.

v4.6 adds a shared diagnostic redactor. Known workspace, home, temporary, and
declared machine roots become portable placeholders. Residual drive-rooted,
UNC, POSIX, and file-URL paths are removed. Relative repository paths, web
URLs, error text, codes, stack line coordinates, and the independent raw-output
digest remain available. The tool-index generator and daily verifier redact at
receipt creation; readiness indexing also sanitizes supplied legacy receipts
without mutating them.

Verification passed 19/19 scoped commands, including all ten AGENTS.md checks,
186 focused assertions, and 255 package-script path controls. A clean archived
15-file product slice passed five commands plus a synthetic readiness-ingestion
check without changing tracked files. The primary evidence commit independently
passed its 169-check selftest and 30-event seal replay from an exact 31-file
archive.

`npm run test:readiness` passes. `npm run test:operations` remains a recorded
`FOREIGN_FAILURE`: its unchanged verification-proof service expects a curated
intake absent from baseline, product, and workspace. That failure was not
hidden, weakened, or converted to success.

This seam covers retained `failureTail` diagnostics, not secrets/tokens,
arbitrary fields, external histories, or a full-repository privacy audit. It
does not rewrite historical Git objects, alter external diagnostics, prove
human benefit, or grant promotion, merge, Foundation, or `CANON` authority.
No browser-facing file changed, so no browser run is claimed. Incoming
`AXM_MIRROR_SHADOW_SPECIALIST` packages were not inspected or modified. Mike
Tobi / AXM remains the merge and `CANON` gate, and the broad grounded-growth
objective remains active.
