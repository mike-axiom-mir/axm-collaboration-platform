# Known limits

- This is a local prototype and compatibility harness, not an installed AXM Foundation service.
- JSON Schemas are accompanied by deliberately small built-in validators; the runtime does not claim complete JSON Schema Draft 2020-12 implementation.
- JSON atomic writes protect individual state-file replacement, but this is not a multi-process transactional database.
- The append-only journal hash chain is locally tamper-evident. It is not external notarisation, immutability, or proof against a machine owner rewriting every file.
- Mock adapters prove the adapter contract. They do not prove compatibility with a future world, production platform, game, company system, device, or physics solver.
- Snapshot rollback is allowed only when the adapter supports it and the post-apply revision has not changed. It is not a universal undo system.
- Field-level auto-merge is limited to clearly independent fields. Same-field changes require review.
- The safe-file adapter is confined to its configured fixture root and supports only JSON document fixtures. It is not a general filesystem bridge.
- Shared-controls schemas are compatibility contracts only. Mirror Core does not run a game input loop, decide team balance, create default AI players, or provide AI with screen state.
- A bounded semantic observation is not accepted as seat-equivalent merely because it is convenient; the future shared-controls service must prove that every exposed field was visible to that seat.
- Real accounting, payroll, employee monitoring, secrets, medical data, customer identities, machine control, physical construction decisions, and automatic live-project writes remain out of scope.
- The current PR 13 Game Hub manifest describes eight engine seats, while its visible lobby still hardcodes four occupants and its module contract remains older. This build treats the incoming shared-controls update as a future seam rather than freezing those temporary defaults.
- The Playwright smoke script is implemented, but no Chromium executable existed in the build environment, so rendered browser assertions are UNRUN rather than passed.
- Windows batch launchers were not executed on native Windows; their underlying Node/npm entry points were tested on Linux.
