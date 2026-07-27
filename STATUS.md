# AXM Public Status

AXM Workshop is an **experimental public test**. Public-safe, runnable,
understandable, licensed, and production-ready are independent gates.

Current release: [v0.3.0-experimental](https://github.com/mike-axiom-mir/axm-collaboration-platform/releases/tag/v0.3.0-experimental)

| Gate | Current state | Evidence or limitation |
|---|---|---|
| Public-safe publication | **Pass for each published digest** | The deterministic inventory and configured secret/private-path scanner must pass before the exact branch push. |
| Windows source launch | **Pass** | GitHub Actions and receiver-side smoke tests launch from a path with spaces, remove system Node.js from `PATH`, bootstrap the private runtime, and poll `/api/health`. |
| Release archive | **Included** | The prerelease carries a Windows-friendly source ZIP plus its SHA-256 checksum. |
| Bundled runtime | **Not included** | The source archive does not carry Node binaries. |
| Offline first launch | **Not claimed** | First Windows launch needs the network when compatible Node.js is absent. |
| macOS/Linux clean launch | **Not yet independently proven** | A compatible Node.js installation is currently required. |
| First-time-human comprehension | **Not run** | Documentation has been steward-reviewed; an independent beginner trial is still required. |
| Guided Proof One | **Planned** | A narrow creation, verification, controlled-failure, and rollback demonstration is not yet the public default. |
| Production security | **Not claimed** | Localhost binding and public-safety scanning are not a security certification. |
| Broad open-source license | **Not granted** | See [License Status](LICENSE_STATUS.md). |

Machine-readable form: [`registry/public-status.json`](registry/public-status.json).

## Publication acceptance

A public merge requires:

1. internally consistent generated discovery registries;
2. an exact public inventory with zero configured safety blockers;
3. clean Windows launch evidence for the candidate;
4. a reviewable pull request rather than a direct `main` push;
5. receiver evidence that merged `main` contains and launches the reviewed commit.

Current runs are visible in
[GitHub Actions](https://github.com/mike-axiom-mir/axm-collaboration-platform/actions/workflows/public-launch.yml?query=branch%3Amain).
Failed or unrun gates stay visible; they are never renamed `WORKING`.
