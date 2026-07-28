# AXM Workshop integration receipt

- Upstream: AXM CSS Skin Fabric Organ Pack 0.2.0 WORKING
- Source archive: `AXM_CSS_SKIN_FABRIC_ORGAN_PACK_v0_2_0_2026-07-28.zip`
- Source archive SHA-256: `78BD8CD44261DC676C72C4F942D9DFCFDB5B19F68DB7D2078C6EBB29B349D6A6`
- Upstream files covered by `FILE_MANIFEST.json`: 98
- Workshop route: `/shared/css-skin-fabric/index.html`
- First platform adapter: `/hub/css-skin-fabric-adapter.css`
- Rollback Git checkpoint: `c66412b`

The pack now owns the shared interface token, component, accessibility,
compatibility and responsive foundation. The Hub adapter maps those semantic
tokens onto the existing shell variables without changing Hub data, routing,
permissions or module behavior.

One intake repair was required in both installed copies: the packaged Python
validator compared POSIX registry paths with native Windows backslashes. The
comparison now normalizes paths with `Path.as_posix()`. No CSS, registry,
component or visual-source bytes were changed.

The existing Sentient Atrium imagery remains a bounded identity layer. On
narrow screens it no longer owns layout, and navigation starts closed so the
work surface cannot be obscured.
