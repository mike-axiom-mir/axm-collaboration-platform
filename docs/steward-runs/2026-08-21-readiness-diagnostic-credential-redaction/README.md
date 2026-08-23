# Readiness diagnostic recognized-credential redaction v4.7

Status: `TEST`

The exact v4.6 parent redacted machine paths from retained readiness diagnostics
but passed five synthetic recognized credential forms through unchanged. The
current twelve stored failure tails contained no detected instances, so this is
preventive receipt-boundary hardening rather than cleanup of observed secrets.

v4.7 replaces credential-bearing header values, named assignments and command
flags, URI user-info and recognized query values, PEM private-key blocks, and a
bounded set of recognizable token fingerprints with
`<REDACTED_CREDENTIAL>`. Machine-path redaction remains active. Relative paths,
ordinary token/secret prose, non-credential URL context, verdicts, and raw-output
SHA-256 values remain available. Supplied verification results are copied rather
than mutated.

The machine-readable truth flag is deliberately qualified as
`failureDiagnosticsRecognizedCredentialEvidenceRedacted`. The implementation
does not claim arbitrary, encoded, split, novel, or semantically inferred secret
detection, arbitrary-field sanitation, retroactive external-history cleanup, or
historical Git rewriting.

Verification passed 17/17 scoped commands, including all ten AGENTS.md checks,
77 direct privacy assertions, and 255 package-script path controls. An exact
15-file archived product slice passed five commands plus synthetic readiness
ingestion without changing tracked files. Baseline and product tools-index
summaries, source digest, verdicts, output hashes, and all twelve current failure
tails remain exact apart from the new qualified truth declaration. A separate
literal scan over the product and evidence scope retained zero recognized token,
private-key, authorization-value, current-path, or assembled-fixture hits; it
does not prove arbitrary secret absence.

The primary evidence commit independently passed its 215-check selftest and
38-event seal replay from an exact 32-file archive without mutating a source
checkout or shared main.

`npm run test:operations` remains a recorded `FOREIGN_FAILURE`: its unchanged
verification-proof service expects the curated
`intakes/verification-proof-99-v0.1/modules` boundary, which is absent from the
baseline commit, product commit, and workspace. No substitute intake was made.

No browser-facing file changed and no browser render/click test is claimed. No
provider was invoked, no human participation or benefit was inferred, and no
installation, promotion, merge, authority grant, learning, or `CANON` decision
occurred. Incoming specialist ZIP packages were not inspected. Mike Tobi / AXM
remains the merge and `CANON` gate; the broad objective remains active.
