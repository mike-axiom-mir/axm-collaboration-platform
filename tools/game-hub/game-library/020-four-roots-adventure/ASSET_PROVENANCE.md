# Asset provenance

Version 0.2 uses no downloaded images, fonts, audio, or models. Game visuals
are original HTML and CSS geometry. Narrative and content records were authored
in a bounded AXM steward run and sealed by the provider-neutral deterministic
content generator.

The v0.2.2 trailer frames are original programmatic pixel geometry rendered by
the native Workshop adapter. Forty unique gameplay frames reconstruct the map,
actors, player, roots, quest totals, inventory totals, and messages from exact
states emitted by the byte-bound Four Roots native engine; eight frames remain
an explicit title card. MP4 and WebM encoding reuses the repository's pinned
`wasm-vips` runtime plus AXM's bounded container writers. No asset or media
download, AI provider, external encoder, child process, browser capture, live
player input, or network call was used in the trailer build.

Internal Workshop `TEST` use is recorded under Mike's explicit direction.
Public direct-reuse rights remain on hold pending Mike's separate decision.
