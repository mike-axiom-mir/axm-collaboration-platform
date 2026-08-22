# AXM Platform Connect

Platform Connect gives a compatible sandboxed AI the parts of AXM that ordinary shared-file access misses: module and capability discovery, Workshop Search, deterministic asset-hand routing and invocation, read-only Platform Heartbeat observation, bounded Holodeck sessions, local API reads/previews, and hashed receipts. Its transport engine is the Platform Courier; its human surface is a small local settings and consent screen.

It runs inside the main AXM Workshop server. Starting the Hub starts this courier; stopping the Hub stops it. No extra Node daemon or public listener is required. If the Hub is off, a sandbox cannot start a Windows process by writing a file, so the local user must start AXM first.

Open `index.html` through the AXM server to choose a compatibility profile, pause or enable the connection, select capability classes, bound receipt retention, grant exact scopes, or revoke access. Profiles do not contain credentials. Claude Platform / Cowork is live-proven; the generic profiles describe the same contract but remain compatibility claims until separately tested.

## Consent and boundaries

Use the settings screen for normal operation. `GRANT_PLATFORM_ACCESS.cmd` and `REVOKE_PLATFORM_ACCESS.cmd` are offline fallbacks; the Claude-named scripts remain as compatibility shortcuts for the original working route. A grant contains only the exact `platform.read` and/or `platform.hands.invoke` scopes selected by the local user.

The courier refuses arbitrary shell commands, remote URLs, secret access, arbitrary paths, and mutation APIs. `api.call` permits GET requests to the current AXM server and only the deterministic preview POST routes declared by the courier catalog. Hand artifacts are written only under `state/axm-platform-courier/artifacts`.

Heartbeat access is observation-only: connected platforms can inspect the live rhythm, next beat and organ bridge but cannot configure or manually trigger it. Holodeck access is limited to courier-owned sessions in the built-in Echo Atrium world. Normal observation remains lightweight structured state. When visual evidence is actually needed, `holodeck.capture` renders that exact verified session state through the local Three.js Screen Deck in a fresh headless Edge profile and returns a PNG, SHA-256, renderer metrics and matching state digest. It cannot navigate to an arbitrary URL, import another world, grant extra actor authority, manipulate the physical world or promote canonical state. Only the newest 20 Holodeck captures are retained.

## Protocol

Write one request to `state/axm-platform-courier/inbox/<id>.json`; read `state/axm-platform-courier/outbox/<id>.response.json`. A request is atomically claimed and removed. Every receipt binds to the request SHA-256 and carries its own SHA-256. The outbox retains at most 500 receipts; this avoids unbounded one-log-per-event growth.

Optional request `client` metadata lets the local user see which provider surface used the courier, its last action, outcome, timestamps and action count. Prompts and payload contents are not copied into that connection ledger.

See `PLATFORM_START_HERE.md` for the provider-neutral protocol, `SONNET_START_HERE.md` for the first proven client, and `COMMAND_CENTRE_SEAM.md` for the shared API that a future Command Centre surface can consume.
