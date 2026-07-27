# AXM Workshop

AXM Workshop is a local-first environment where people and optional AI tools
can build, play, inspect, learn, and collaborate through one modular Hub.

> **Public test Workshop:** this repository is experimental. It is shared so
> people can try the current foundation and inspect its evidence; it is not a
> production-certified platform.

Start with the [AXM Discovery Root](AXM_DISCOVERY_ROOT.md) for a human-readable
map, or [`registry/public-status.json`](registry/public-status.json) for the
machine-readable release boundary. Current technical facts come from generated
registries and Technical Glasses, not from a remembered module count.

## Start in five minutes (Windows)

1. Select **Code > Download ZIP** on GitHub.
2. Right-click the downloaded ZIP and select **Extract All**.
3. Open the extracted folder.
4. Double-click **`OPEN_AXM_WORKSHOP.cmd`**.
5. Leave the small server window open. AXM opens the Hub in your browser when
   it is ready.

If clicking a launcher on GitHub only shows its code, nothing broke: GitHub can
preview files, but it cannot run a local application. Download and extract the
complete folder first.

The launcher uses a compatible Node.js already on the computer when available.
Otherwise, on Windows x64 or ARM64, it clearly announces a one-time download of
the pinned Node.js 24.17.0 LTS runtime from `nodejs.org`, verifies its SHA-256,
and installs it only inside this Workshop's private `runtime` folder. No
administrator permission, `npm install`, account, API key, or AI connection is
required. The first bootstrap needs an internet connection; later core Hub
starts are local. See [Beginner Guide](docs/BEGINNER_GUIDE.md) for repairs and
the exact trust boundary.

## macOS and Linux

From the extracted folder, run:

```sh
./start-hub.sh
```

If the file is not executable yet, run `chmod +x start-hub.sh` once. A compatible
Node.js installation is currently required on macOS and Linux. The Hub is also
available with `node server.js --open=hub`.

## What AXM contains

- **Creation systems** for games, assets, audio, film, motion, spatial work,
  research, learning, publishing, and project direction.
- **Playable worlds** and controller-aware local game experiments.
- **Evidence, repair, and governance** with explicit readiness, verification,
  rollback, permission, and stop boundaries.
- **Human-machine collaboration** through typed, optional interfaces that do
  not collapse human and machine identity or authority.
- **Local operations and delivery** for packaging, diagnostics, heartbeat,
  updating, source review, and bounded automation.

Explore the [capability map](AXM_CAPABILITY_MAP.md), generated
[`registry/modules.json`](registry/modules.json), or line-oriented
[`registry/capabilities.jsonl`](registry/capabilities.jsonl). AI collaborators
should begin with [`AI_START_HERE.md`](AI_START_HERE.md).

## Launcher choices

- `OPEN_AXM_WORKSHOP.cmd` - recommended Windows beginner route; core Hub only.
- `RUN_AXM_ALL.bat` - compatibility alias for the same beginner route.
- `START_AXM_FULL.bat` - advanced route; attempts optional local services that
  are actually installed.
- `start-hub.sh` - recommended macOS/Linux core route.
- `start-full.sh` - advanced macOS/Linux route.

The Workshop binds to `127.0.0.1` by default, so it is reachable only from the
same device. Deliberately exposing it to a LAN or the internet requires a
separate authentication and security review.

## Current truth and proof

The exact public gates and known limitations live in [STATUS.md](STATUS.md).
Source assertions, a real Windows launch smoke test, and public-safety scanning
are separate proofs; passing one does not silently pass the others.

Public packages exclude local logs, saves, sessions, state, backups, secrets,
private work folders, caches, downloaded runtimes, and raw operational history.
Public-safe does not mean production-safe; review [Security](SECURITY.md) before
changing network or machine permissions.

The repository currently has **no broad open-source license grant**. Public
visibility permits reading and evaluation, not automatic redistribution or
commercial reuse. See [License Status](LICENSE_STATUS.md).

## Help improve the test Workshop

- Found a bug? Use the **Bug report** issue template.
- Have an idea? Use the **Feature request** issue template.
- Want to contribute? Read [Contributing](CONTRIBUTING.md).
- Never post tokens, passwords, private logs, or personal data in an issue.

## Maintainer verification

```sh
npm run discovery:verify
npm test
```

The networked clean-Windows launch proof is intentionally separate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/windows-clean-launch-smoke.ps1
```

**Truth before story. Proof before claim. No fake done.**
