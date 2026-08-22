# Evidence Route

```text
artifact_exists:
claim: the intake created one self-contained additive leaf without editing an existing shared organ
kind: existence
risk: low
pass_condition: direct inventory shows the new leaf and Git reports only that untracked path for this lane
primary_surface: filesystem and path-scoped Git inspection
counterevidence: edits outside tools/external-pattern-observatory attributable to this intake
secondary_surface_if_needed: shared-workspace rescan
observed_evidence: 20 candidate files under the new leaf; no existing organ was edited by this intake
verdict: PASS
named_seam: the wider Workshop remains heavily dirty and foreign; this verdict is path-scoped

contracts_are_parseable_and_bounded:
claim: manifest, module contract, execution sidecar, schemas, receipt, data, and capability records parse as JSON and declare no permissions/writes
kind: static structure
risk: low
pass_condition: all JSON parses; focused assertions confirm EXPERIMENTAL, installed:false, promoted:false, permissions:[], writes:[], networkBytes:0, writeBytes:0
primary_surface: JSON parsing plus focused static assertions
counterevidence: parse error, missing required local field, requested permission, or declared write/network budget
secondary_surface_if_needed: full Draft 2020-12 JSON Schema validator
observed_evidence: JSON parse PASS; focused static assertions PASS
verdict: PASS for declared local bounds; UNKNOWN for full draft-schema conformance
named_seam: json-schema.draft-2020-12.validate/v1 unavailable (Python jsonschema and Node AJV absent)

compiler_is_deterministic_and_inert:
claim: equal semantic matrix content produces equal digests, prompt-like text remains data, duplicates fail, changes become stale, license changes remain blocked, and contradictions become CONFLICT
kind: deterministic behavior
risk: medium
pass_condition: focused held-input assertions exercise every named behavior and exit zero
primary_surface: Node selftest with known inputs and asserted outputs
counterevidence: digest drift on reorder/timestamp/path changes; executed prompt-like text; accepted duplicate; hidden contradiction; unblocked license change
secondary_surface_if_needed: independent compiler implementation
observed_evidence: focused selftest PASS with 26 assertions
verdict: PASS
named_seam: no independent second implementation; SHA-256 proves normalized content identity, not external truth

review_ui_works_live:
claim: a person can render 24 cards, inspect one, filter the queue coherently, and use the narrow layout without horizontal overflow
kind: interaction journey and visual appearance
risk: medium
pass_condition: live desktop and narrow browser observations complete the named journey with no console errors, fatal UI, clipping, or document overflow
primary_surface: in-app browser semantic snapshots, bounded clicks/typing, screenshots, and width measurements
counterevidence: blank/fatal render, wrong card count, card click without detail, stale hidden selection, clipped state token, or scrollWidth greater than clientWidth
secondary_surface_if_needed: human accessibility/taste review before promotion
observed_evidence: see VISUAL_RECEIPT.md; two observed seams were corrected and rechecked
verdict: PASS
named_seam: taste, screen-reader experience, and broader accessibility remain human/promotion-gate review

external_repository_claims_are_current:
claim: the supplied repository and license statements match exact current upstream sources
kind: factual and authorization
risk: high if used for code or metadata reuse
pass_condition: pinned upstream coordinates, captured source/license digests, independent rights review, and human reuse decision
primary_surface: exact upstream sources plus rights/evidence organs
counterevidence: changed license, edition boundary, missing pin, conflicting source, or restricted reuse
secondary_surface_if_needed: legal review for consequential publication/commercial reuse
observed_evidence: none gathered in this intake; all statements remain SOURCE_REPORTED_UNVERIFIED
verdict: UNKNOWN (non-blocking for inert local pattern review; BLOCKING for reuse)
named_seam: external-source.license.verify-pinned/v1 unavailable and intentionally out of scope
```
