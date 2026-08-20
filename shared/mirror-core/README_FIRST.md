# AXM Mirror Core — local prototype

Original package status: WORKING TEST · STANDALONE FOUNDATION-COMPATIBILITY HARNESS.

AXM live integration: installed as a `FOUNDATION_CANDIDATE` behind the permanent service plane. Its runtime is explicit-start only, and no live Workshop or living-world apply adapter is enabled. The package's own discovery descriptor remains honestly frozen to its original standalone PR13 compatibility claim.

AXM Mirror Core is the versioned underlay that lets separate systems describe selected entities, propose a bounded change, review it, apply it through an adapter, verify the result, detect conflicts, preserve evidence, and roll back where the adapter genuinely supports rollback.

It is not the living world, a renderer, a physics engine, VR, a company simulator, a general game engine, or permission to control real projects or machines.

## Start

Windows:

    START_MIRROR_CORE.bat

Any platform with Node.js 20 or newer:

    npm start

Dashboard:

    http://127.0.0.1:8799

The service binds to 127.0.0.1 by default. It performs no telemetry and needs no internet at runtime.

## Run the deterministic demonstration

    npm run demo

The demo resets isolated local state, imports the authorised mock-world snapshot, creates a world-to-platform proposal, records human review, applies it, verifies it, rejects a separate platform-to-world proposal, blocks a deliberately stale proposal, rolls back the approved application, and verifies the journal hash chain.

## Run checks

    npm test
    npm run test:browser
    npm run verify

Browser automation is reported separately because an installed browser may not exist on every machine.

Foundation compatibility harness:

    npm run foundation:harness

## Review flow

1. Open Proposals.
2. Inspect actor, source, target, evidence, requested permission, exact operations, preview diff, risk, reversibility, and conflicts.
3. Validate and submit the packet.
4. Start review.
5. Approve, reject, or request amendment.
6. An approved packet still needs an active adapter connection, matching consent, an authorised applying actor, unchanged authority, and unchanged target preconditions.
7. Apply, verify, or roll back from the visible controls.

Reject is kept beside Approve. Approval never silently performs the change.

Rollback is conditional. It is offered only when the adapter supports it, the applying actor still has permission and consent, the pre-snapshot exists, and the target revision has not changed since application. Rollback creates new history; it never erases the original decision or receipt.

## Adapter separation

The mock world, mock platform, and bounded safe-file fixture remain separate native stores behind explicit adapter contracts. Registration means an adapter is available, not connected or authorised. A future world connects by publishing a versioned descriptor, receiving a specific consent receipt, exporting only selected authorised entities, and applying only operations that have survived review and current precondition checks. See `docs/ADAPTER_GUIDE.md` and `docs/FUTURE_WORLD_INTEGRATION.md`.

## Shared controls boundary

Incoming Game Hub shared controls are not reimplemented here. Mirror Core includes versioned compatibility schemas for party sessions, visible seat bindings, common control surfaces, seat-bound action intentions, and seat-scoped observations. Live game input stays an ephemeral shared-controls concern; durable cross-system changes stay Mirror Change Packets. See docs/SHARED_CONTROLS_COMPATIBILITY.md.

## GitHub boundary

The AXM Foundation repository and PR 13 were inspected read-only at commit 33a87549259d8b4a7ce4753ee1fab49e0ee8091d. This package was created separately. No branch, commit, push, PR change, or repository working-tree change was made.
# Deterministic JSON boundary

Mirror Core routes canonical serialization, cloning, and atomic JSON writes
through `tools/deterministic-json-core`. Unsupported or lossy state is refused
before persistence. Store mutators may still return no value; that is handled as
control flow rather than serialized JSON.
