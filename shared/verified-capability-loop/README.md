# AXM Verified Capability Loop

Status: `TEST`

Representation boundary: v0.2 uses the shared strict deterministic JSON core.
Safe JSON keeps the existing canonical bytes; unsupported, cyclic, sparse, or
otherwise non-JSON state is refused instead of being dropped or rewritten.

This is the small connector beneath AXM's human-directed capability cycle:

```text
need -> gap -> source/provenance -> reuse/compose/adapt/build
     -> verify -> human HOLD/CONTINUE/REJECT -> governed availability -> refresh
```

The loop does not perform any stage. It seals one deterministic receipt proving
that every supplied stage refers to the same baseline, capability and exact
candidate digest. Existing organs keep their authority:

| Cycle stage | Current AXM organ |
|---|---|
| Need | Workshop Needs Observatory / Grounded Evolution Intelligence |
| Gap | Capability Gap Workbench |
| Source and provenance | Workshop Search Provenance / Research Foundry / intake receipts |
| Reuse, compose, adapt or build | current capability library / Hand Forge Bridge / Agent Tool Forge / Codex under host authority |
| Verify | specialist verifiers / Verification Spine / live visual proof when the claim is visual |
| Hold or continue | Review Inbox and the human steward |
| Availability and lineage | Modular Intake / Module Installer / Module Evolution Ledger |
| Refresh | Platform Heartbeat under Body Pulse and explicit gates |

The machine-readable receipt shape is
`verified-capability-cycle-receipt.schema.json`.

`PASS` is not enough to make a capability available. A `CONTINUE` decision must
be human, exact-confirmed and bound to the candidate digest. Even then the cycle
reports `READY_FOR_GOVERNED_INTAKE` until a separate availability authority
returns a digest-bound receipt. The connector never installs, executes, grants
permission, promotes, changes CANON, mutates roots or claims model-weight
training.

This is the practical meaning of platform improvement here: verified reusable
capabilities can accumulate for AXM and any connected model, while roots and
human authority remain outside the loop.

Run:

```powershell
node shared/verified-capability-loop/selftest.js
```
