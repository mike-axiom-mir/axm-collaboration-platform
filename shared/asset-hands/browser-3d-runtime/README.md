# AXM Browser 3D Runtime

Pinned, local browser decoders shared by 3D creation modules. The runtime adds
`KHR_texture_basisu` and `EXT_meshopt_compression` support to the existing
Three.js r160 viewer without modifying the older PS2 Asset Forge vendor tree.

The manifest binds every runtime byte to its package version, npm integrity
record, file size, SHA-256 digest, and MIT license. Runtime consumers must check
the manifest before claiming decoder support. No CDN or live network fallback
is allowed.

`loaders/KTX2Loader.js` expects the bare module name `three`; browser consumers must
map that name to their matching local Three.js r160 module with an import map.
The Basis transcoder path must end in `/basis/`.
