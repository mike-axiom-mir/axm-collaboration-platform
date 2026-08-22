# Material sensory capability scout

## Decision

`REUSE/COMPOSE`, not a new synthesizer. The existing deterministic PBR baker already produced genuine PNG material maps. The useful missing seam was a truthful public edit hand, explicit colour-vs-data sampling semantics, a whole-result byte gate, and a bounded human look-development surface.

## Before

- `pbr-material-bake@1.0.0` create was READY, but the same valid recipe routed as edit returned `MISSING_HAND`.
- Six 512px PNGs totalled 6,295,416 bytes and the serialized result was about 8.43 MiB, so a small request ceiling and at least a 10–12 MiB response ceiling were required.
- Every map carried the same generic legacy `colourSpace`, despite albedo/emissive/preview being colour data and normal/ORM/height being non-colour data.
- The static reference sphere did not prove live PBR viewing, lighting response, channel isolation, A/B comparison, accessibility or human approval.
- Some advertised families legitimately return HOLD at larger sizes; those candidates must remain diagnostic-only.

## Built composition

- Machine side: reused `pbr-material-bake`, upgraded its real create/edit contract, and added `shared/deterministic-material-fabric` as the exact result/sampling/full-SHA gate.
- Human side: this workbench provides a WebGL2 sphere/plane, raw channel isolation, bounded light/camera/tiling/map controls, original/current comparison, allowlisted regeneration, append-only stale review history and non-promoting receipts.
- Host side: same-origin `127.0.0.1`, 256 KiB request ceiling, 12 MiB response ceiling, no host filesystem writes, and prior-candidate preservation on HOLD/FAIL.

## Gaps and ownership

- `HAND-PBR-EDIT-001`: closed at TEST by `pbr-material-bake@1.1.0`; not canon.
- `CONTRACT-PBR-SAMPLING-001`: closed at TEST by exact per-map sampling metadata; legacy `colourSpace` is compatibility-only.
- `CONTRACT-PBR-HOST-BRIDGE-001`: closed at TEST by loopback JSON/form integration, size/origin/type refusal, degraded mode and live browser evidence; not canon.
- `HAND-PBR-SENSORY-001`: closed at TEST by live WebGL2 sphere/plane, channel, A/B, edit, HOLD and review-boundary journeys; not human approval and not canon.
- `EVIDENCE-PBR-SENSORY-001`: real human taste/art-direction decision remains human-required.
- `EVIDENCE-PBR-RENDERER-PARITY-001`: tool-local reference render is not a target engine.
- `EVIDENCE-PBR-DEVICE-001`: representative GPU performance is unknown.
- `EVIDENCE-PBR-ACCESSIBILITY-001`: assistive-technology verification is unknown.
- `EVIDENCE-PBR-CONFORMANCE-001`: no external reference suite was supplied.
- `EVIDENCE-PBR-PHYSICAL-SURFACE-001`: no physical surface or calibrated capture was supplied.

The capability matrices make the required machine/human seam measurable without converting optional physical claims into fake blockers.
