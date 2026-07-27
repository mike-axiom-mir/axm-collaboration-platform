# AXM Neural Visual seam

This seam keeps AI-dependent visual generation separate from deterministic
editing. Neural providers accept an exact `axm.neural-visual-request/v1` and may
return only a digest-bound `axm.neural-visual-result/v1`. A proposed image is a
candidate layer, never visual approval or canon.

`axm.visual-stack-draft/v1` is the human/machine editing envelope. It may stack
deterministic and neural layers, but exports a deterministic
`axm.raster-composition/v1` recipe for the bounded Raster Compositor Hand.

No provider is bundled. Without an explicitly connected AI provider the Neural
Room must report `WAITING_FOR_PROVIDER`; it must not fake generation. Raw image
bytes remain in memory or explicit downloads and are not silently archived.
