# Session summary

Status: `TEST`

## Outcome

This session added an uninstalled, unpromoted v1.7 pure adapter after the v1.6
local-possession checkpoint anchor. It refuses exact reuse of a verified public
key fingerprint or declared principal digest across the witness and anchor
layers. It leaves v1.6, the reusable v0.6 separation pattern, shared
registries, Foundation files and incoming specialist packages unchanged.

The receipt retains four domain-separated set digests and seat counts, not raw
key/principal sets. An exact receipt must then drive the unchanged v1.6
continuity audit.

## Decisions and counterevidence

- The old v0.6 separator was reused conceptually, not invoked as a translation
  layer, because its ledger-based anchored-witness contract is incompatible.
- A chain that v1.6 accepts with the same verified key in both layers is refused
  by v1.7.
- A chain that v1.6 accepts with the same declared actor/steward digest in both
  layers is refused by v1.7.
- One synthetic controller can generate distinct keys and declared digests for
  both layers and pass. The adapter therefore proves neither independent
  custody/controllers nor authenticated identity or anti-collusion.
- Policy, anchor/pin, timestamps, receipts and checkpoints remain caller
  presented and caller retained. Detection remains relative, not prevention.
- Public artifacts retain bounded digests/references and omit the tested raw
  keys, signatures, principals, configured party labels and local paths.

## Verification

The first focused v1.7 run passed 189 checks. An immediate lineage run passed
886 checks across v1.7, v1.6, v0.6 separation, v1.5 witness and v1.4
continuity.

The recorded checkpoint passed 35 of 35 commands: 25 focused lineage commands
and all 10 required `AGENTS.md` commands, with 2,407 focused assertions. The
source snapshot binds 133 normalized inputs. The deterministic capability
comparison changed from `BLOCKED` with 10 missing bounded capabilities to
`DEGRADED` with all 12 bounded requirements `READY`; 25 broader identity,
authority, persistence and outcome requirements remain `OPTIONAL_UNKNOWN`.

The first evidence-content selftest then failed because it expected shortened
set-digest domain labels rather than the implementation's exact
`local-possession-*` labels. The assertion was corrected to the four exact
runtime labels before resealing; runtime behavior, recorded verification and
the claim boundary were unchanged. The failure and correction remain durable.
The next content run similarly expected an explicit `length > 0` spelling
instead of the equivalent truthy `length` guards; that assertion was narrowed
to the exact runtime spellings. This second verifier-only failure and correction
also remain durable.
A third content run expected different human-readable labels for the two
focused overlap-refusal cases. Both assertions were aligned with the exact
focused-test labels; the adversarial behavior and recorded checkpoint were
unchanged. This verifier-only failure and correction remain durable as well.

No browser render/click claim applies because the adapter has no visual or
interactive surface.

## Authority and state

No provider was invoked. No human review, identity authentication, independent
custody/controller/signer operation, network transport, other-host delivery,
external retention, protected state, rollback prevention, experiment,
evaluation, adoption, benefit, learning, installation, promotion, merge,
Foundation mutation or `CANON` decision occurred. Mike Tobi remains the merge
and `CANON` gate.

The incoming `AXM_MIRROR_SHADOW_SPECIALIST` package lane was not inspected or
modified.
