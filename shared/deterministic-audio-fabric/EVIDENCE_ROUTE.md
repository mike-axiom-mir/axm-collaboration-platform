# Deterministic Audio Fabric Evidence Route

Status: `TEST`

This evidence route covers only the shared machine adapter. It neither claims
human sensory completion nor promotes/canonizes the artifacts.

```text
preserved_renderer_emits_genuine_deterministic_wav:
claim: one canonical recipe produces identical mono 44100 Hz signed PCM16 RIFF/WAVE bytes in repeated and fresh Node processes
kind: deterministic artifact behavior
risk: high
pass_condition: exact WAV SHA-256, RIFF/WAVE header fields, byte length, analysis digest, and child-process digest agree
primary_surface: shared/deterministic-audio-fabric/selftest.js
counterevidence: header mismatch, digest drift, different child-process bytes, or a renderer receipt other than RENDERED_UNREVIEWED
observed_evidence: PASS on 2026-08-22
verdict: PASS for the bounded renderer adapter
named_seam: WebAudio identity, external WAV conformance, audible playback, device output, and listening quality remain UNKNOWN

public_asset_hand_create_and_edit_route_is_stable:
claim: Hands.create('deterministic-audio-fabric', brief, {seed}) returns a READY/PASS technical candidate with four exact artifacts, and edit mode regenerates every derived artifact from the recipe source
kind: integration behavior
risk: high
pass_condition: CommonJS load, exact ids/schemas, stable WAV data URL, recipe metadata.schema, validation status, result digest, changed-edit digest, and same-edit replay all pass
primary_surface: shared/asset-hands/deterministic-audio-fabric-selftest.js
counterevidence: provider load failure, missing or unstable field, stale derived artifact, edit without exact recipe schema, or a technical result claiming human review
observed_evidence: PASS on 2026-08-22; the separate TEST workbench's independently rerun core and bounded-host selftests also pass exact create/edit, fresh source digest, same-origin loopback gating, origin/type refusal and degraded mode
verdict: PASS for the Node Asset Hands route
named_seam: CONTRACT-AUDIO-HOST-BRIDGE-001 is CLOSED AT TEST by tools/asset-audio-sensory-workbench/server-selftest.js; physical output and human listening remain separate evidence gaps

schemas_resolve_and_machine_handoff_matches_runtime:
claim: the three new JSON schemas resolve through the shared schema registry and the sensory handoff names the runtime's exact fields and claim boundaries
kind: static contract and integration behavior
risk: medium
pass_condition: schema-contract and sensory-handoff focused tests exit zero
primary_surface: shared/asset-hands/schema-contract-selftest.js and shared/deterministic-audio-fabric/sensory-handoff-selftest.js
counterevidence: unresolved schema, artifact id/schema drift, unsafe edit claim, or omitted listening/accessibility gap
observed_evidence: PASS on 2026-08-22
verdict: PASS for the machine-to-human handoff contract
named_seam: a matching contract is not evidence that the human playback/review surface works

workshop_regression_checks_hold:
claim: the additive seam does not break the ten commands required by AGENTS.md
kind: regression
risk: high
pass_condition: all ten required commands exit zero after the peer declares its lane stable
primary_surface: repository AGENTS.md command list
counterevidence: any nonzero exit or new failure
observed_evidence: PASS on 2026-08-22 after the coordinated STABLE notice; all ten commands exited zero, verify reported 0 FAIL / 18 warnings, and verify-plus reported VERIFIED_WITH_LIMITS; the relevant warning remains the intentionally untouched stale tools index
verdict: PASS for command exits; VERIFIED_WITH_LIMITS remains the honest Workshop-wide spine label
named_seam: the final ownership snapshot found 19 machine-lane files, 18 human-lane files, zero exact-path overlap, and unchanged shared registration seams; the wider 13061-path dirty worktree remains concurrent/user work
```

## Promotion boundary

The implementation remains `TEST`, `installed: false`, `promoted: false`, and
`canonical: false`. Human listening and an explicit Mike Tobi / AXM merge
decision are required for any stronger status.
