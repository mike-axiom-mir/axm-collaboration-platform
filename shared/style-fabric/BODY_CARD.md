# AXM Style Fabric — Body Card

**Status:** WORKING / TEST  
**Canon:** No  
**Automatic platform integration:** No

## What it is

A shared presentation layer that lets humans and machine users create one skin
pack and apply it to any game that declares compatible semantic skin slots.

The v0.6 creator includes 25 editable preskins, deterministic two-preskin
fusion, palette harmonies, expanded materials, patterns, geometry, and
character appearance choices. Thirty-three semantic surfaces, 16 built-in
molds, Mold Foundry forge/grow APIs, seven isolated game-skin organs, and four
performance profiles prepare the same presentation contract for future games.

Treatment Forge adds three bounded treatment molds. Each visible
mold/seed/profile request produces exactly three distinct deterministic review
drafts. A chosen draft can add ordered effect layers and semantic lighting
while retaining legacy material fields for simpler renderers.

A full 33-surface Test Chamber, isolated surface editor, and adapter
conformance lab make coverage and adoption evidence visible before any game
integration. Character Forge remains the character-focused organ inside the
wider Style Fabric, not a second privileged skin path.

## What it can see

- A skin pack the user explicitly imports.
- Raster images the user explicitly selects.
- The presentation-slot contract supplied by a game.
- Its own bundled preskin catalog.
- Its own bundled semantic and treatment molds.
- Its own local browser library.

## What it can change

- The temporary preview.
- An explicitly selected treatment draft in the current pack data.
- Presentation values exposed by a consenting game adapter.
- A local skin file or browser-library entry when the user chooses Save or Export.

## What it cannot change

- Gameplay truth, physics, damage, score, inputs, networking, permissions, or executable game code.
- Existing AXM Foundation, Game Hub, games, Asset Vault, or Creative Studio files.
- Canon or promotion status.
- A built-in mold, a game contract, or any game without a separate explicit operation.

## What it sends

Nothing by default. The reference implementation has no network route. Export creates a local file. A future hosted provider must be installed separately and pass its own consent and policy gate.

## What it stores

Only skin packs deliberately saved into the browser’s local IndexedDB library. Removing browser storage removes that local library. Exported files remain wherever the user saved them.

## Offline status

Fully offline after extraction. The package has no runtime dependencies and loads no remote fonts, scripts, images, APIs, or analytics.

## Risks

- A skin can still make a game unreadable, visually overwhelming, or inaccessible.
- A deterministic treatment draft is editable visual data, not proof of
  aesthetic quality or renderer fidelity.
- Two individually readable preskins can produce a poor fusion; the resolved
  preview and game-owned cue protections remain required.
- Huge images can consume memory.
- Copyright and license claims supplied by creators are not magically verified.
- A game adapter may implement mappings incorrectly; the Style Fabric validator cannot prove third-party adapter behavior.
- Conformance proof checkboxes record declared observations; they do not
  automatically certify a renderer or replace game-specific tests.

## Admission and runtime boundary

Imported packs pass one admission gate that combines strict structure checks,
embedded-raster verification, and integrity policy. Safe canonicalization and
instance traversal accept only own data properties; accessors, cycles,
inherited values, and prototype-pollution path segments are rejected.

Runtime apply accepts only the exact single-use proposal prepared by that
runtime for its captured adapter contract. Forged, changed, replayed, or
concurrently reused proposals are rejected before the adapter is called.
Approval still requires a visible actor, and presentation authority remains
`ZERO_AUTHORITATIVE_WRITES`.

## Rollback / turn off

Each successful runtime apply operation receives a rollback token. The CSS
reference adapter restores the prior values. Games must preserve their own
defaults and implement rollback before they can claim adapter conformance.
