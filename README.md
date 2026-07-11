# AXM Workshop — Public-Safe Experimental Checkpoint

**Version:** Workshop v1.9.1 · Tool Factory v0.2  
**Status:** `EXPERIMENTAL` · working proof · not canon · not production  
**Founder / public collaboration name:** **Mike Tobi**

AXM Workshop is a local-first modular work floor for humans and AI systems. A
human can operate modules through the Hub while a governed machine host can use
explicit machine adapters. Where both doors exist, they should converge on the
same core logic rather than maintaining two contradictory implementations.

## What changed in Tool Factory v0.2

AXM Agent Tool Forge is now a draft-only software foundry. It can create and
normalize a bounded draft, validate it, render a complete file set, calculate
deterministic SHA-256 fingerprints, preview generated files, save/resume locally,
and export a real module ZIP or review JSON.

It **cannot** install, overwrite, execute, delete, promote, or canonize. Every
generated manifest starts `EXPERIMENTAL`; risk is recorded separately as
`LOW`, `MEDIUM`, or `HIGH`.

```text
Human Hub screen  -> index.html -> forge-core.js
Machine host      -> machine.js -> forge-core.js
```

The machine adapter requires a host-supplied authorization decision and refuses
unknown actions, including install.

## Quick start

1. Install Node.js.
2. Extract the full package into a fully local folder such as `C:\AXM_WORKSHOP`.
3. Avoid an online-only OneDrive Desktop or other cloud-placeholder folder.
4. Start the Hub:

```text
Windows:       START_HUB.bat
macOS/Linux:   ./start-hub.sh
```

Open `AXM Agent Tool Forge`, edit the sample, validate, build, inspect the
fingerprint, and export. A successful bounded run still says:

```text
Installed: NO
Promoted: NO
```

## Current evidence

- 22 discoverable tools/modules; two underscore template shelves are skipped.
- Core verifier and deterministic self-tests pass in the public-safe audit.
- Local server/API smoke checks pass.
- Mike Tobi manually proved the Hub/browser route using a fully local BAT path.
- An online-only OneDrive Desktop attempt failed at the environment/file layer.
- Automated Playwright click/render remains **UNRUN** in the audit environment.

See [PUBLIC_VERIFICATION_REPORT.md](PUBLIC_VERIFICATION_REPORT.md) for exact
scope and [SANITIZATION_REPORT.md](SANITIZATION_REPORT.md) for the public-safety
transformation.

## AI bridge

AI is optional. No real key or token is included. API keys are read from local
environment variables. If `bridge/bridge-token.txt` is absent, the bridge creates
a fresh random token on first start. That generated token and all runtime logs
are ignored by Git.

See [bridge/BRIDGE_SETUP.txt](bridge/BRIDGE_SETUP.txt).

## Public identity and collaboration

Project, module, and specialist names are intentionally retained. Identity-wisdom
material and Tilburg context remain because they describe how humans or AI
specialists grow within the system; they are not treated as secrets.

No email address is published. To follow the raw development log or propose
collaboration, search for **Mike Tobi** and the **AXM raw Facebook development
log**.

## Repository boundaries

Do not commit API keys, real bridge tokens, local run logs, sessions, private
projects, or generated verification history. Uploaded files are data by default;
they become operative only through an explicit trusted route and authorization.
No module may promote itself.

Read [AGENTS.md](AGENTS.md) before using a coding agent on the repository.

## License status

No broad public software license has been selected in this checkpoint. Public
visibility is not an automatic permission grant. See
[LICENSE_STATUS.md](LICENSE_STATUS.md) and contact Mike Tobi for collaboration.

**Truth before story · proof before claim · no fake done.**


## Windows one-click Hub start — manually confirmed

Extract the package into a fully local folder and double-click `START_HUB.bat`.
The starter opens the correct local Hub address automatically. It prefers port
`8790` and selects another free local port when required; users do not need to
type or edit an address.

The Windows one-click route was manually passed by Mike Tobi. The Hub displayed
22 of 22 modules loaded and All Systems Operational.

## Sidebar lifecycle labels

`CLAIMED` means discovered but not yet opened. `TEST` means opened and ready for
checks. `WORKING` means checks passed. `SAVED` means the verified state survived
a checkpoint/reload. The internal compatibility value behind `TEST` remains
`NEEDS VERIFY`.
