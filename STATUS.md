# AXM Public Status

This repository is an **EXPERIMENTAL public test Workshop**. Public-safe,
runnable, understandable, and proven are independent gates.

| Gate | Current state | Evidence or limitation |
|---|---|---|
| Public-safe | Verify at publication | The deterministic source inventory and secret/private-path scanner must pass for the exact outgoing digest. |
| Windows source launch | Test | `tests/windows-clean-launch-smoke.ps1` copies into a path with spaces, removes system Node from `PATH`, invokes the real launcher, bootstraps the pinned runtime, and polls `/api/health`. |
| Bundled runtime | Not included | Public source does not carry Node binaries. First Windows launch downloads and verifies a pinned official archive when Node is absent. |
| Offline first launch | Not claimed | A future signed release package may provide this; the source ZIP does not. |
| macOS/Linux clean launch | Not yet independently proven | A compatible Node installation is currently required. |
| First-time human comprehension | Not run | The documentation is improved, but an independent beginner trial is still required. |
| Guided Proof One | Planned | A narrow creation, verification, controlled-failure, and rollback demonstration is not yet the public default. |
| Production security | Not claimed | Localhost binding and public-safety scanning are not a production security certification. |
| Broad open-source license | Not granted | See `LICENSE_STATUS.md`. |

Machine-readable form: [`registry/public-status.json`](registry/public-status.json).

## Publication acceptance

A public merge needs, at minimum:

1. regenerated and internally consistent discovery registries;
2. exact public inventory with zero configured safety blockers;
3. Windows clean-launch receipt for the candidate;
4. reviewable branch and pull request rather than a direct main push;
5. receiver evidence that merged `main` contains and launches the reviewed
   commit.

Failed or unrun gates remain visible. They are not relabelled `WORKING`.
