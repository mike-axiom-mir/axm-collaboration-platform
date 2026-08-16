# AXM Public Status

AXM Workshop is an **experimental public test**. Public-safe, runnable,
understandable, licensed, packaged, and production-ready are independent gates.

Latest reviewed source: [v0.6.0-experimental](https://github.com/mike-axiom-mir/axm-collaboration-platform/releases/tag/v0.6.0-experimental)

Last separately packaged Windows build:
[v0.3.0-experimental](https://github.com/mike-axiom-mir/axm-collaboration-platform/releases/tag/v0.3.0-experimental) — preserved for convenience, but older
than the current source checkpoint.

| Gate | Current state | Evidence or limitation |
|---|---|---|
| Public-safe publication | **Pass for each published digest** | The deterministic inventory and configured secret/private-path scanner must pass before the exact branch push. |
| Latest reviewed source | **Published** | `v0.6.0-experimental` targets the reviewed merge commit and was verified after GitHub created the prerelease. |
| Tagged source archives | **Available** | GitHub provides ZIP and TAR archives for the exact v0.6.0 tag. AXM did not attach a separate custom package or checksum to this release. |
| Windows source launch | **Pass** | GitHub Actions launched the exact combined source from a path with spaces, removed system Node.js from `PATH`, bootstrapped the private runtime, and polled `/api/health`. |
| Separately packaged Windows archive | **Older build available** | v0.3.0 carries an AXM-named Windows source ZIP and SHA-256 file. It is not the newest source. |
| Bundled runtime | **Not included** | Neither the current tagged source nor the older source package carries Node binaries. |
| Offline first launch | **Not claimed** | First Windows launch needs the network when compatible Node.js is absent. |
| macOS/Linux clean launch | **Not yet independently proven** | A compatible Node.js installation is currently required. |
| First-time-human comprehension | **Not run** | Documentation has been steward-reviewed; an independent beginner trial is still required. |
| Guided Proof One | **Planned** | A narrow creation, verification, controlled-failure, and rollback demonstration is not yet the public default. |
| RepairBuddy warning baseline | **43 warnings remain open** | The complete-warning delta adds orientation; it does not acknowledge, suppress, or automatically repair the warnings. |
| Production security | **Not claimed** | Localhost binding and public-safety scanning are not a security certification. |
| Broad open-source license | **Not granted** | See [License Status](LICENSE_STATUS.md). |

Machine-readable public gates:
[`registry/public-status.json`](registry/public-status.json).

Machine-readable release/download distinction:
[`site/public-package.json`](site/public-package.json).

## Publication acceptance

A public merge requires:

1. internally consistent generated discovery registries;
2. an exact public inventory with zero configured safety blockers;
3. clean Windows launch evidence for the candidate;
4. a reviewable pull request rather than a direct `main` push;
5. receiver evidence that merged `main` contains and launches the reviewed
   commit.

Current runs are visible in
[GitHub Actions](https://github.com/mike-axiom-mir/axm-collaboration-platform/actions/workflows/public-launch.yml?query=branch%3Amain).
Failed or unrun gates stay visible; they are never renamed `WORKING`.
