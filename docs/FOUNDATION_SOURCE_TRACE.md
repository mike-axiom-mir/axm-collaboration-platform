# Foundation source trace — Seed-0 refresh

Original route inspection: public Foundation commit
`627b905a53628ec840abda24ce8410fa5edfe3de`.

Seed-0 live refresh: `C:\axm workshop` on 2026-07-16. The active private
Workshop is not treated as a clean Git source tree, so this record names paths
and observed contracts rather than inventing a commit.

Observed live seams:

- Workshop HTTP runtime: `server.js`, default loopback port 8788.
- Presence read: `GET /api/presence`.
- Presence heartbeat: `POST /api/presence/heartbeat`.
- Collaboration notices: `/api/presence/notices` and `/api/presence/notice`.
- Shared browser provider registry: `launcher/axm-foundation.js`,
  `AXMConnect.register(provider)`.
- Existing game ports: 8792 through 8798.
- Existing Mirror Core service: port 8799, explicit start, live adapters off.
- Shared-controls demo reserves 8808 when deliberately started.
- Static boundary blocks top-level `state`, tokens, logs, backups, bridge, and
  other private runtime directories from browser delivery.

Seed-0 repair to the imported route:

- Port 8798 is no longer available.
- Port 8799 belongs to the separate existing Mirror Core.
- Mirror Native defaults to configurable port 8818.
- Seed-0 uses the Node.js standard library because it is already a verified
  Workshop dependency and permits a zero-install first connection. Learned
  organ training remains language-neutral at the API boundary and may use
  Python/PyTorch later.

No current Workshop file was copied into Mirror. The imported Maccie planning
package is preserved unchanged under `docs/source-route/` with its own hashes.
