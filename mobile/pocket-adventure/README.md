# AXM Pocket Adventure

`EXPERIMENTAL` · standalone mobile intake · `installed: false` · `promoted: false`

Pocket Adventure is a content-free, single-file phone adventure engine. A player
opens `index.html`, taps **TAKE IN**, and selects one of the intact ZIP packs from
`packs/`. The engine validates and stores the chosen world in IndexedDB; visible
scene art is loaded lazily as local Blob URLs.

This is deliberately separate from AXM Platform, Pocket, Hub, and Game Hub. The
intake adds no registry entry, route, shared dependency, server, network access,
tracking, cloud sync, installation action, promotion, or Foundation change.

## Included worlds

| Pack | Scenes | Choices | Items | Hooks | Notes |
|---|---:|---:|---:|---:|---|
| Compatibility Check | 2 | 4 | 1 | 1 | Small engine/import check |
| The Roads Between 001 | 60 | 151 | 7 | 4 | Original multiverse route |
| The Roads Between 002 — Casual | 60 | 142 | 7 | 4 | Lighter wandering route |
| The Roads Between 003 — Strange Routes | 60 | 145 | 7 | 4 | Older art, refreshed story logic |
| Route Zero — Lantern Market | 60 | 194 | 8 | 5 | Fresh boards and denser choices |

The four full worlds contain 240 scenes, 632 choices, 29 items, and 17 declared
hooks. These are structural counts, not a claim that every route has been human
play-tested.

## Local use

1. Keep the pack ZIPs intact.
2. Put `index.html` and the desired ZIP packs on the phone.
3. Open `index.html` in a Chromium-based browser.
4. Tap **TAKE IN** and select a ZIP directly.
5. Keep the original ZIP files as the recoverable source of the artwork.

Browser storage is origin-specific. Moving or renaming the HTML, using another
browser, or clearing site data can expose a different or empty IndexedDB store.
There is no cloud backup.

## Intake corrections

The supplied Casual and Strange Routes ZIPs used DEFLATE and omitted explicit
base-world defaults even though the source contract asks for STORE and a complete
manifest shape. The staged copies were mechanically normalized:

- all ZIP entries now use STORE;
- `dependencies` is explicitly `[]`;
- `builtFromStateHash` is explicitly `null`;
- `generation.sequence` is explicitly `0`;
- `installPolicy` is explicitly append-only with stale intake disabled.

Their `content/world.json` and every image byte remain unchanged and still match
the original manifest SHA-256 values. Exact original and normalized archive
digests are recorded in `INTAKE_RECEIPT.json`.

## Verification boundaries

`node selftest.js` independently checks the engine's static local-only boundary,
ZIP structure/compression, content and asset hashes, manifest defaults, entity
IDs, and the principal world/scene/location/item/hook/asset references.

A desktop or emulated phone browser journey does not prove real Android/iPhone
file-origin persistence, long-session stability, battery behavior, accessibility,
or the quality of every story branch. Those remain explicit evidence seams.

The attempted local render/click journey on 2026-08-15 was not completed: the
Codex in-app browser-control kernel stopped before page selection because its
kernel-assets path was missing. The local HTTP server did start, but that alone
does not prove rendering, interaction, or IndexedDB restoration. See
`VISUAL_RECEIPT.md` for the bounded claim ledger.
