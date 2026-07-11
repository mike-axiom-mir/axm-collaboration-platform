============================================================
AXM ASSET VAULT — Workshop tool v0.1
============================================================

Status: TEST branch build
Branch: chatgpt/asset-vault-v0-1

WHAT IT IS
  A local-first vault for AXM visual assets, stickers, command cards,
  game files, launcher skin packs, project references, launcher-card
  metadata, and AI/human handoff packets.

HOW IT FITS THE CURRENT FOUNDATION
  - Loads the shared Workshop spine from /launcher/axm-foundation.js.
  - Loads the shared asset librarian from /launcher/axm-assets.js.
  - Loads global defaults from /launcher/axm-settings.js.
  - Loads the shared registry from /launcher/axm-registry.js.
  - Does not carry its own private foundation copy.
  - Saves through AXM.store.
  - Uses AXMGate.submit for meaningful actions.
  - Uses AXM.ask only for optional AI summaries.
  - Works without AI connected.
  - Registers a tool-local Asset Vault records connector while this page is open.
  - Routes exports through AXMRegistry when available.
  - Keeps direct /api/export and browser download as backup routes.

WHAT V0.1 CAN DO
  - Import selected local files into the vault as local browser records.
  - Preview images/audio/video where the browser can display them.
  - Tag assets, assign projects, set status labels.
  - Search/filter by name, tag, project, notes, status.
  - Edit asset detail records.
  - Build AI/human handoff packets from vault records.
  - Choose handoff templates: visual skin, game asset, repair, GitHub PR,
    or general asset handoff.
  - Store launcher-card metadata and pick an image asset as cover candidate.
  - Export a launcher-card metadata packet for later Workshop integration.
  - Export backup JSON by browser download or /exports when running in Workshop.
  - Import backup JSON back into the vault.
  - Export an Action Report to /exports.
  - Export an Issue Report template for repair/testing.

NO FAKE DONE
  - Real folder watching/indexing is not built in v0.1.
  - Automatic asset-pack zipping/copying is not built in v0.1.
  - Workshop launcher now reads static manifest.card metadata.
  - Vault-exported card packets are not automatically installed yet.
  - Layer editing/compositing belongs to AXM Studio; this tool stores and indexes assets.
  - Direct file extraction from the vault is not built yet.

RECOMMENDED TEST
  1. Start AXM Workshop.
  2. Confirm the Asset Vault card appears as TEST.
  3. Launch it.
  4. Import 1 image and 1 text/file asset.
  5. Save vault.
  6. Close and restart Workshop.
  7. Confirm assets remain.
  8. Update an asset record.
  9. Use the image as launcher cover candidate.
 10. Build a visual-skin handoff packet.
 11. Export backup/report/card packet to /exports.

PROMOTION RULE
  TEST -> WORKING only after launch, import, save/reload, backup export,
  handoff packet, launcher-card metadata, and issue/action reports all pass
  on Mike Tobi's machine.
============================================================
