<p align="center">
  <img src="site/assets/axm-mark.svg" width="76" alt="AXM Workshop mark">
</p>

<h1 align="center">AXM Workshop</h1>

<p align="center">
  A local-first modular workshop where people and optional AI collaborators can build,<br>
  play, inspect, learn, and create without surrendering their files or authority.
</p>

<p align="center">
  <a href="https://github.com/mike-axiom-mir/axm-collaboration-platform/releases/tag/v0.6.0-experimental"><img alt="Release v0.6.0 experimental" src="https://img.shields.io/badge/release-v0.6.0--experimental-8b5cf6"></a>
  <a href="https://github.com/mike-axiom-mir/axm-collaboration-platform/actions/workflows/public-launch.yml"><img alt="Public launch checks" src="https://github.com/mike-axiom-mir/axm-collaboration-platform/actions/workflows/public-launch.yml/badge.svg?branch=main"></a>
  <img alt="Local first" src="https://img.shields.io/badge/local--first-yes-16a085">
  <img alt="Status experimental" src="https://img.shields.io/badge/status-experimental-f59e0b">
</p>

<p align="center">
  <img src="site/assets/axm-workshop-social-v4.jpg" alt="A modular village of connected AXM creative studios" width="100%">
</p>

> **Public experimental source checkpoint.** AXM is runnable and open for
> evaluation, but it is not production-certified and does not yet carry a broad
> open-source license. Warnings and unproven boundaries remain visible.

## Choose your route

| I want to… | Best route |
|---|---|
| Try a small browser workroom | [Open the public doorway](https://mike-axiom-mir.github.io/axm-collaboration-platform/) |
| Get the latest reviewed source | [Download the exact v0.6.0 tagged source ZIP](https://github.com/mike-axiom-mir/axm-collaboration-platform/archive/refs/tags/v0.6.0-experimental.zip) |
| Read what changed in v0.6.0 | [Open the current prerelease](https://github.com/mike-axiom-mir/axm-collaboration-platform/releases/tag/v0.6.0-experimental) |
| Use the last separately packaged Windows build | [Download v0.3.0 Windows source package](https://github.com/mike-axiom-mir/axm-collaboration-platform/releases/download/v0.3.0-experimental/AXM-Workshop-v0.3.0-experimental-Windows-source.zip) — older than the current source checkpoint |
| Understand what is inside | Read the [Discovery Root](AXM_DISCOVERY_ROOT.md) |
| Inspect current limitations | Read [Public Status](STATUS.md) |
| Help improve AXM | Read [Contributing](CONTRIBUTING.md) |
| Orient an AI collaborator | Begin with [AI Start Here](AI_START_HERE.md) |

> **Release truth:** `v0.6.0-experimental` is the newest reviewed source
> checkpoint. GitHub provides its exact tagged source archives. The older
> `v0.3.0-experimental` release remains the last AXM-created Windows ZIP with a
> separate checksum; it is preserved as a convenience package, not presented as
> the newest code.

## Windows: open the current source

1. Download the exact v0.6.0 tagged source ZIP above.
2. Right-click the ZIP and select **Extract All**.
3. Open the extracted folder.
4. Double-click **`OPEN_AXM_WORKSHOP.cmd`**.
5. Keep the small server window open while using AXM.

If GitHub shows code instead of opening AXM, nothing broke. GitHub previews files
but cannot run a local application; download and extract the complete folder
first.

The older v0.3.0 convenience package is still available for people who need the
previous separately named archive and checksum. It does not contain the newer
v0.6.0 integrations.

### First-launch trust boundary

The Windows launcher uses a compatible Node.js already on the computer when
available. Otherwise it announces a one-time download of pinned Node.js 24.17.0
LTS from `nodejs.org`, verifies SHA-256, and stores it only in AXM's private
`runtime` folder.

No administrator permission, account, API key, AI connection, or `npm install`
is required. The first bootstrap needs an internet connection when no compatible
Node.js runtime is available; later core-Hub starts are local.

See the [Beginner Guide](docs/BEGINNER_GUIDE.md) for troubleshooting and the
exact launch boundary.

## macOS and Linux

A compatible Node.js installation is currently required:

```sh
./start-hub.sh
```

If needed, run `chmod +x start-hub.sh` once. You can also use
`node server.js --open=hub`. A clean first-launch proof for macOS and Linux is
not yet claimed.

## What AXM contains

AXM is organized as a village of bounded systems rather than one opaque app:

| Area | Examples |
|---|---|
| Create | Games, assets, audio, film, motion, spatial work, research and learning |
| Organize | Projects, goals, decisions, knowledge, checkpoints and portable records |
| Collaborate | Distinct human and machine seats with visible authority and review gates |
| Verify | Evidence, readiness, repair, rollback, permissions and truthful status |
| Operate | Local packaging, diagnostics, Heartbeat, Pulse, updating and bounded automation |

The generated discovery spine is the current machine-readable map. Declarations
are navigation data—not blanket runtime proof or authority grants. Explore the
[Capability Map](AXM_CAPABILITY_MAP.md),
[`registry/modules.json`](registry/modules.json),
[`registry/capabilities.jsonl`](registry/capabilities.jsonl), and
[`registry/public-status.json`](registry/public-status.json).

## Current release truth

| Gate | State |
|---|---|
| Latest reviewed source | `v0.6.0-experimental`, published from the reviewed merge commit |
| Deterministic public-safety scan | Pass for the published snapshot |
| Fresh Windows source launch with no Node.js on `PATH` | Pass |
| v0.6.0 archive type | GitHub-generated tagged source archives; no separate AXM package or checksum |
| Last AXM-packaged Windows ZIP | `v0.3.0-experimental` — preserved, but older |
| Offline first launch | Not claimed |
| Clean macOS/Linux first launch | Not yet independently proven |
| Independent first-time-human comprehension test | Not yet run |
| Open RepairBuddy warning baseline | 43 warnings remain visible |
| Production security certification | Not claimed |

The exact evidence and limitations live in [STATUS.md](STATUS.md) and
[`registry/public-status.json`](registry/public-status.json).

## Local and bounded by default

The core Workshop binds to `127.0.0.1`, making it reachable only from the same
device. Public packages exclude local logs, saves, sessions, state, backups,
secrets, private work folders, caches, downloaded runtimes, and raw operational
history.

Optional network bridges and machine permissions are separate capabilities.
Review [Security](SECURITY.md) before enabling LAN access, connectors, or machine
execution.

## Contributing and licensing

- Use the issue templates for reproducible bugs and bounded ideas.
- Read [Contributing](CONTRIBUTING.md) before opening a pull request.
- Never post tokens, passwords, private logs, personal data, or private paths.
- This repository currently has **no broad open-source license grant**. Public
  visibility permits inspection and evaluation, not automatic redistribution
  or commercial reuse. Read [License Status](LICENSE_STATUS.md).

## Maintainer verification

```sh
npm run discovery:verify
npm test
```

The networked Windows proof is intentionally separate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/windows-clean-launch-smoke.ps1
```

<p align="center"><strong>Truth before story · Proof before claim · No fake done</strong></p>
