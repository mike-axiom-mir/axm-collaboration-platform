============================================================
AXM ASSET PACK LAB — Workshop tool v0.1
============================================================

Status: TEST branch build
Branch: chatgpt/asset-vault-v0-1

PURPOSE
  Companion module for AXM Asset Vault.
  It creates planning/export manifests for:

  - launcher skin packs
  - command card packs
  - faction card packs
  - comic/info-comic template packs
  - Studio / Layer Forge asset packs
  - game UI packs

WHY SEPARATE FROM ASSET VAULT V0.1
  Asset Vault v0.1 is already the record vault.
  Asset Pack Lab is the pack/template design layer.
  Keeping it as a separate TEST module avoids overloading the first vault
  before Mike Tobi's local device test.

CORE PRINCIPLE
  STABLE SHELL. FLEXIBLE SLOTS. PROTECTED OUTPUT.

WHAT V0.1 CAN DO
  - Build an AXM asset-pack manifest.
  - Build an AXM template-shell manifest.
  - Export manifests through AXMRegistry asset.sink when available.
  - Fall back to /api/export, then browser download.
  - Read the registered template source through AXMRegistry.
  - Show status for AXMAssets, AXMSettings, AXMRegistry, and AXM.status.

NO FAKE DONE
  - Pack installation/copying is not built.
  - Launcher auto-consumption of skin packs is not built.
  - This does not edit images; visual editing remains in Studio / Layer Forge.
  - This does not replace Asset Vault; it prepares pack/template metadata.

PROMOTION TEST
  1. Launch Asset Pack Lab from the Workshop.
  2. Build a launcher-skin pack manifest.
  3. Export it to /exports.
  4. Build a launcher-card template shell.
  5. Export it to /exports.
  6. Refresh Template Library and confirm template.source responds.
  7. Confirm Status tab shows registry and AXMAssets namespace.
============================================================
