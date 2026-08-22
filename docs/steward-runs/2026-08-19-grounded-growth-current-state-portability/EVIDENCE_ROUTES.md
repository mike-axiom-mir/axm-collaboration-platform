# Evidence routes

## `detached-integrity`

- Claim: a copied current-state receipt retains its declared structure and
  self-digest.
- Kind: static structure and deterministic behavior.
- Risk: medium.
- Pass condition: exact top-level and nested fields validate, the digest
  rebuilds, and any byte-level or recomputed structural tamper is refused.
- Primary surface: focused execution over valid and adversarial receipts.
- Counterevidence: malformed references, unsupported fields, invalid counts,
  digest mismatch, or internally contradictory state.
- Secondary surface: strict JSON Schema inspection and a separate CLI process.

## `detached-authority-boundary`

- Claim: a portable receipt cannot manufacture consent or operational authority.
- Kind: authorization.
- Risk: high.
- Pass condition: recomputed receipts with autonomous action, participation,
  install, promotion, merge, `CANON`, or Foundation mutation are refused.
- Primary surface: deterministic allow/deny probes.
- Counterevidence: any authority-inflated receipt returning portable integrity
  pass.
- Secondary surface: module contract and CLI output inspection.

## `detached-source-truth`

- Claim: referenced source receipts are current and true without those sources
  or their exact rebuild inputs.
- Kind: persistence and provenance.
- Risk: high.
- Pass condition: unavailable from a detached receipt alone.
- Primary surface: native source receipt rebuild, not the detached verifier.
- Observed evidence: absent by definition in detached mode.
- Verdict: `UNKNOWN`.
- Named seam: `SOURCE_TRUTH_REQUIRES_NATIVE_REBUILD`.

## `human-benefit`

- Claim: the receipt or verifier benefited a person.
- Kind: workflow outcome and human meaning.
- Risk: high.
- Primary surface: separate voluntary human evidence.
- Observed evidence: none.
- Verdict: `NOT_RUN`.
