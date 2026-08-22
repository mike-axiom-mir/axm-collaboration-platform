# AXM Asset Sensory Workbench

Status: **TEST**. Authority: candidate-only.

This standalone local workbench is the human-side partner for AXM's
deterministic asset machinery. It lets a person experience and alter a bounded
visual-motion candidate while the machine-facing composition, digests, derived
artifacts and validation remain exact.

It does not install, promote, canonize, publish or aesthetically approve an
asset. It currently supports one modality: **visual motion**.

## Open it

Start the Workshop and open:

```text
http://127.0.0.1:8788/tools/asset-sensory-workbench/
```

The page creates a real `deterministic-animation-fabric` Asset Hand result. It
accepts that result only when the hand/version, `READY`, validation `PASS` and
candidate-only authority agree. It labels the hand's filmstrip as a static
proof, then uses the editable composition for the actual bounded player.

## One source, two editing paths

Human controls and machine calls use the same `core.js` edit allowlist:

- horizontal and vertical motion amplitude;
- integer cycle ticks;
- symmetric rotation range;
- presentation fill, background and stroke.

Each edit records actor kind, channel, previous value, parent digest and result
digest. An unknown field returns `MISSING_EDIT_CAPABILITY`. The workbench sends
the edited composition through the public Asset Hand edit route and replaces
the bake, CSS, atlas, manifest, filmstrip and technical receipt with the newly
emitted set. It refuses schema, canonical-digest, result or regeneration drift.

Viewer speed, zoom, high contrast and reduced motion are deliberately separate
from source edits. Reduced motion uses the explicit
`disable-transform-motion` viewer strategy. The receipt carries a
`viewer_state_digest` over those adaptations. Changing any viewer state or
source field makes the earlier judgment stale, disables its download and keeps
the old judgment in append-only review history.

## Human evidence is not machine validation

The human seat may record `ACCEPT_FOR_TEST`, `REVISE` or `REJECT` plus a sensory
impression and note. The resulting
`axm.asset-human-sensory-review-receipt/v1` binds:

- the original Asset Hand result and source artifact;
- current composition and bake digests;
- every deterministic edit;
- exact viewer adaptations;
- reviewer observation;
- this local browser runtime's declared evidence ceiling.

`ACCEPT_FOR_TEST` is not promotion, canonization or publication. A technical
`PASS` is never converted into human approval.

## Evidence and limits

See [CAPABILITY_SCOUT.md](CAPABILITY_SCOUT.md) for the typed capability map,
[EVIDENCE_ROUTE.md](EVIDENCE_ROUTE.md) for claim-by-claim verification and
[COLLABORATION_RECEIPT.md](COLLABORATION_RECEIPT.md) for the cross-task lane
handoff.

Known gaps remain:

- wall-clock frame pacing and dropped-frame evidence;
- screen-reader and assistive-technology journeys;
- Mike Tobi's aesthetic and intended-use judgment;
- audio generation/playback validation;
- spatial 3D, camera, depth and renderer-parity review;
- an ephemeral rolling visual capture hand.

## Focused checks

```powershell
node tools/asset-sensory-workbench/selftest.js
node --check tools/asset-sensory-workbench/core.js
node --check tools/asset-sensory-workbench/app.js
```

Browser render/click verification is separate. Source compilation and Node
selftests do not prove the rendered experience.
