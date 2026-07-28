# Known Limits

## Integration

- No existing AXM game has been modified or connected.
- The demo is a neutral specimen scene, not proof inside the real Game Hub.
- The CSS variable adapter is a reference implementation. Unity, Godot, Canvas, sprite-atlas, 3D/PBR, and custom-engine adapters are contracts/templates only.
- Each existing game still needs semantic slot review and an original-appearance fallback.
- Molds reduce adapter design work but do not discover or rewrite a game's
  internal renderer automatically. Nonstandard slot names require an explicit
  binding map.
- Mold Foundry accepts only semantic surfaces already known to the local slot
  library. It does not inspect a game's renderer, infer internal bindings,
  overwrite built-in molds, publish drafts, or declare CANON.

## Creator

- The bounded phrase interpreter maps known style words; it is not an open-ended language model.
- It does not generate finished sprite sheets, meshes, rigs, animations, fonts, audio, or video.
- Character design currently covers appearance blueprint, material, palette, silhouette, head shape, outfit, accessory, and proportions—not animation or gameplay identity.
- Built-in preskins are renderer-neutral foundations, not handcrafted art
  direction for every individual game.
- Fusion interpolates declared colors and numeric values. It does not use an
  image model to invent transitional sprites, meshes, rigs, or animation.
- Custom raster art is embedded as selected. The browser path does not re-encode or strip EXIF/GPS metadata yet; do not publicly share sensitive photos without a later privacy scrubber.
- The specimen is representative. Only a real game adapter can show final in-game fidelity.
- Test Chamber cards are representative semantic material samples, not
  engine-specific final rendering or bespoke art for each game object.
- Adapter Conformance Lab proof boxes record declared observations. They are
  not automated renderer tests, certification, or evidence that an unconnected
  AXM game already supports skins.
- The layer mixer exposes seven high-level visual organs and 33 semantic
  surfaces. Fine-grained biome regions, individual vehicle parts, fonts,
  audio, animation, rigs, and engine-specific shader graphs remain future
  extensions.
- Seed growth uses a bounded deterministic grammar, not an image model. It
  creates editable recipes and material foundations, not finished bespoke art.
- Treatment Forge produces exactly three deterministic data directions, not
  three rendered image concepts or proof that any direction looks good in a
  particular game.
- Selecting **Apply selected treatment** composes the chosen treatment into the
  current pack data. It is not a game-runtime apply, save, export, publication,
  promotion, or certification operation.
- Enhanced effect stacks and semantic lighting are opt-in renderer features.
  Simpler adapters can use the flat legacy material fields, so visual fidelity
  may differ across renderers.
- Treatment performance profiles bound the declared data. They cannot predict
  actual frame time, power use, GPU-driver behavior, or renderer bugs.

## Format and security

- The portable v1 skin contract shares JSON, not a nested skin ZIP.
- PNG, JPEG, and WebP are allowed. SVG, fonts, audio, video, models, HTML, scripts, arbitrary shaders, and remote asset URLs are denied.
- Header-level raster checks do not replace hardened sandboxed image decoding for a future public host.
- JPEG/WebP dimensions may be reported unresolved for unusual valid encodings; the pack remains warning-scoped, and public hosting needs a full decoder sandbox.
- A license declaration is not proof of ownership.
- SHA-256 proves byte integrity, not safety, authorship, or licensing.
- Local policy can admit an unsigned pack; stricter hosted policy can require
  integrity. Admission verifies declared integrity but does not create trust,
  authorship, moderation, or renderer certification.

## Sharing

- “Upload” currently means importing a selected skin or art file into the local creator.
- Sharing currently means exporting a portable file and giving it to someone.
- There is no network gallery, account system, moderation service, public upload, discovery feed, rating, report, or withdrawal service.
- The hosted share-provider contract and stricter example policy are included but not implemented.

## Runtime and testing

- Requires Node.js 20 or newer for the reference local server and CLI.
- Physical Windows double-click startup was not tested on a Windows machine in this environment.
- The v0.6 cloud-browser loopback preview was inaccessible. Studio structure
  and accessible state wiring can be checked locally, but no v0.6 responsive
  screenshot or live interaction result is claimed in this environment.
- Browser IndexedDB save/load was exposed and inspected, but cross-browser persistence and quota behavior were not exhaustively tested.
- File chooser upload and browser download were not automated in the private browser because those actions create external files; their core serialization and validation paths were tested in Node.
- GPU/driver differences mean screenshots are not promised to be byte-deterministic. Canonical recipes, pack JSON, hashes, and resolver results are deterministic.
- Runtime proposal binding prevents an unprepared, changed, replayed, or
  concurrently reused proposal from reaching the adapter. It does not make an
  adopting adapter correct or safe; each game still owns its implementation,
  protected cues, defaults, apply behavior, and rollback behavior.

## Status

The correct status is **WORKING / TEST**, not CANON, integrated, published, or production-host-ready.
