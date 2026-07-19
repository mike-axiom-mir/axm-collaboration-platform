# AXM Workshop

AXM Workshop is a local-first environment where people and optional AI tools
can build, play, inspect, learn, and collaborate through one modular Hub.

> **Public test Workshop:** this repository is experimental. It is shared so
> people can try the current foundation and report real seams; it is not a
> production-certified platform.

Public doorway: [AXM Workshop on GitHub Pages](https://mike-axiom-mir.github.io/axm-collaboration-platform/). The Pages site is a static guide and download route; the Workshop itself runs locally after extraction.

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

The core Hub needs [Node.js LTS](https://nodejs.org/en/download) when a portable
Node runtime is not bundled. You do **not** need `npm install`, an account, an
API key, or an AI connection to open the core Workshop.

See [Beginner Guide](docs/BEGINNER_GUIDE.md) when something does not open.

## macOS and Linux

From the extracted folder, run:

```sh
./start-hub.sh
```

If the file is not executable yet, run `chmod +x start-hub.sh` once. The Hub is
also available with `node server.js --open=hub`.

## What is inside

- **Hub** - one front door for Workshop modules, recent work, health, and
  verification.
- **Build spaces** - tools for games, assets, audio, film and motion, spatial
  work, research, learning, publishing, and project direction.
- **Game spaces** - local games and controller-aware party experiments.
- **Governance** - explicit readiness, review, evidence, permission, and stop
  boundaries rather than silent automation.
- **Machine interfaces** - optional typed routes that let connected AI systems
  inspect and act without becoming the same identity as the human steward.

The live module inventory changes quickly. Open **AI Team > Technical Glasses**
or run `npm run glasses` for the current generated map instead of relying on a
stale number in this README. AI collaborators should begin with
[`AI_START_HERE.md`](AI_START_HERE.md).

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

## Mirror boundary

This public-test branch contains the Workshop's optional connector surfaces so
buttons, adapters, and verification routes remain honest. Mirror's evolving AI
body - private learning state, corpus, weights, organs, and training runtime -
is **not** included in this update and remains isolated on its own development
branch. The core Workshop works without Mirror.

## Privacy, evidence, and licensing

Public packages exclude local logs, saves, sessions, state, backups, secrets,
private work folders, caches, and raw operational history. Public-safe does not
mean production-safe; review [Security](SECURITY.md) before changing network or
machine permissions.

The repository currently has **no broad open-source license grant**. Public
visibility permits reading and evaluation, not automatic redistribution or
commercial reuse. See [License Status](LICENSE_STATUS.md). Included AXM project
art has its own recorded provenance and authorization; it is not silently
labelled CC0.

## Help improve the test Workshop

- Found a bug? Use the **Bug report** issue template.
- Have an idea? Use the **Feature request** template.
- Want to contribute code or a module? Read [Contributing](CONTRIBUTING.md).
- Never post tokens, passwords, private logs, or personal data in an issue.

## Maintainer verification

```sh
npm test
```

Focused foundation checks are documented in [Contributing](CONTRIBUTING.md).
Passing source tests does not replace live visual or controller testing for a
claim about UI or gameplay.

**Truth before story. Proof before claim. No fake done.**
