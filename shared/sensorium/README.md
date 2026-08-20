# AXM Sensorium runtime adapters

The shared core routes exported serialization and cloning through
`tools/deterministic-json-core`, refusing unsupported or lossy JSON state. The
legacy `stable` normalizer remains available to existing bounded adapters.

These are the small executable bodies behind the Sensorium skills. The skill
files remain the judgement procedures; these modules provide bounded, testable
execution contracts for local AI seats and Mirror. The portable TEST pack
currently contains thirteen skills. Twelve have executable Workshop routes; Eye 1
remains an honest host-mediated static-image skill rather than a fake local
vision engine.

Corroboration compares sealed same-claim receipts from distinct seats without
voting or choosing a winner. Interoception deterministically classifies
host-supplied own-seat capacity signals, but its real
`seat.capacity.read/v1` host adapter is still unavailable; that sense remains
`CONTRACT_PASS` with a visible hold rather than a fabricated live reading.

Taint Sniffer is the bounded chemoreception sense for incoming handoffs. It can
compare an expected SHA-256 digest and flag narrow encoding, binary-signature,
instruction-injection-shaped, credential-shaped, and declared-format signals.
It returns only signal codes and digests: no raw excerpt, malware verdict,
automatic block, quarantine, or trust decision. A warning is not guilt, and a
quiet result is not proof of safety.

Eye 3 compares two attributable typed visual observations of the same target.
It reports SAME, CHANGED, APPEARED, and DISAPPEARED fact dimensions without
capturing pixels or guessing why a change happened. Eye 4 applies the Trust
Charter accessibility floor to supplied presentation measurements and reuses
Visual Kernel contrast math. Eye 4 now also accepts the bounded exact-target
browser adapter in `shared/ai-native-hands/computed-style-hand.js`, so it is
`RUNTIME_PASS`. The adapter reads no text content, retains no pixels, mutates
nothing, and returns UNKNOWN for incomplete coverage or complex backgrounds.

Every adapter follows four rules:

1. Authority is injected. Loading a sense grants no filesystem, stream,
   capture, archive, or gate permission.
2. Raw material is bounded and released before a receipt is returned.
3. `status().rawRetainedBytes` and `rawRetainedItems` expose the flat-cost
   invariant to deterministic tests.
4. Receipts are capped at the newest 20. They contain digests, counters and
   typed findings—not frames, transcripts, directory trees, or source files.

The source of truth is [canonical/sensorium.json](canonical/sensorium.json).
It deterministically generates the [registry](registry.json), capability
matrix, portable JSON/Markdown skill pairs, host metadata, bundle manifest,
README, and builder handoff. The completed improvement sequence is
[ROADMAP.md](ROADMAP.md), with [machine-readable status](roadmap-status.json)
and the original [roadmap graph](roadmap.json).

`coordinator.js` composes observations without acting. Adapter negotiation,
freshness, cleanup, session close, evidence compaction, repair routing,
packaging, Technical Glasses feed, and drift-baseline proposals remain separate
modules. The discoverable UI is `tools/sensorium-lab/`; it reads generated
state and is never canonical.

Target verification commands:

```powershell
node shared/sensorium/selftest.js
node tests/sensorium-retention-conformance-test.js
npm run test:sensorium
```

Portable releases, checksums, compatibility, and safety reports are generated
under `exports/sensorium-release/`. Visual laptop/mobile proof is under
`exports/sensorium-visual-proof/`.

The remaining host holds are `WINDOWS_WINDOW_ISOLATION_UNAVAILABLE` and
`SEAT_CAPACITY_ADAPTER_UNAVAILABLE`. Windows capture stays degraded until exact
named-window isolation exists, and Interoception stays contract-proven until a
real host exposes bounded fill-level metrics without context content. Eye 4's
computed-style adapter must still be injected per use; absence on one route is
`COMPUTED_STYLE_ADAPTER_NOT_INJECTED`, not a global capability claim.

`TEST` is not canon. Mike remains the merge gate.
