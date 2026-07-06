============================================================
AXM ASSET NAMESPACE — launcher-base-assets
============================================================

This folder reserves the stable namespace for base launcher visuals and
skin assets that may later be managed by AXM Asset Vault.

Recommended namespace:
  AXM_WORKSHOP/assets/launcher-base-assets/

Purpose:
  - launcher icons
  - tool card cover art
  - fallback visuals
  - AXM UI skin pieces
  - shared visual tokens/assets used by the Workshop shell

Current status:
  Namespace reserved only. The Asset Vault v0.1 stores imported records in
  AXM spine storage. Automatic bootstrap/copy from Vault to this folder is a
  later v0.2/v0.3 step.

Principle:
  The Workshop must be able to wake up with fallback assets even if the Vault
  is missing. The Vault can upgrade/feed the Workshop, but should not become
  the only thing the Workshop needs to open.
============================================================
