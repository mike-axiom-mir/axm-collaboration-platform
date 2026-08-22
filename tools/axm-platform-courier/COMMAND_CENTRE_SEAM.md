# Platform Connect → Command Centre seam

Command Centre does not need a second courier daemon. It can consume the same local API used by this settings module:

- `GET /api/platform-connect` — status, provider profiles, exact consent scopes, settings and bounded recent-connection metadata.
- `POST /api/platform-connect/settings` — requires header `x-axm-platform-connect: save-exact-settings` and confirmation `SAVE PLATFORM CONNECT SETTINGS`.
- `POST /api/platform-connect/consent` — requires header `x-axm-platform-connect: grant-exact-scopes` and confirmation `GRANT AXM PLATFORM ACCESS`.
- `POST /api/platform-connect/revoke` — requires header `x-axm-platform-connect: revoke-platform-access` and confirmation `REVOKE AXM PLATFORM ACCESS`.

The connection ledger stores provider/surface/session labels, action count, last action, outcome and timestamps only. It does not retain prompts or payload contents. Command Centre should preserve that boundary and expose mutation controls only after a local human action.

Provider profiles are compatibility descriptions, not credentials. `anthropic-platform` is the first live-proven profile; the generic and local profiles are contract-ready but must not be presented as independently verified until a real end-to-end run exists.
