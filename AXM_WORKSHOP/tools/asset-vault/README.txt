============================================================
AXM ASSET VAULT — Workshop tool v0.1
============================================================

Status: TEST branch build
Branch: chatgpt/asset-vault-v0-1

WHAT IT IS
  A local-first vault for AXM visual assets, stickers, command cards,
  game files, launcher skin packs, project references, and AI handoff
  packets.

HOW IT FITS THE CURRENT FOUNDATION
  - Loads the shared Workshop spine from /launcher/axm-foundation.js.
  - Does not carry its own private foundation copy.
  - Saves only through AXM.store.
  - Uses AXMGate.submit for meaningful actions.
  - Uses AXM.ask only for optional AI summaries.
  - Works without AI connected.
  - Writes real exports only through the Workshop /api/export endpoint.

WHAT V0.1 CAN DO
  - Import selected local files into the vault as local browser records.
  - Preview images/audio/video where the browser can display them.
  - Tag assets, assign projects, set status labels.
  - Search/filter by name, tag, project, notes, status.
  - Build AI/human handoff packets from vault records.
  - Export backup JSON by browser download or /exports when running in Workshop.
  - Import backup JSON back into the vault.
  - Export an Action Report to /exports.

NO FAKE DONE
  - Real folder watching/indexing is not built in v0.1.
  - Automatic asset-pack zipping/copying is not built in v0.1.
  - Layer editing/compositing belongs to AXM Studio; this tool stores and indexes assets.
  - Server-side file extraction from the vault is not built yet.

RECOMMENDED TEST
  1. Start AXM Workshop.
  2. Confirm the Asset Vault card appears as TEST.
  3. Launch it.
  4. Import 1 image and 1 text/file asset.
  5. Save vault.
  6. Close and restart Workshop.
  7. Confirm assets remain.
  8. Build a handoff packet.
  9. Export backup/report to /exports.

PROMOTION RULE
  TEST -> WORKING only after launch, import, save/reload, backup export,
  and handoff packet all pass on Mike's machine.
============================================================
