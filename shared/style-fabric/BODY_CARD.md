# AXM Style Fabric — Body Card

**Status:** WORKING / TEST  
**Canon:** No  
**Automatic platform integration:** No

## What it is

A shared presentation layer that lets humans and machine users create one skin pack and apply it to any game that declares compatible semantic skin slots.

The v0.5 creator includes 25 editable preskins, deterministic two-preskin
fusion, palette harmonies, expanded materials, patterns, geometry, and
character appearance choices. Thirty-three semantic surfaces, 16 molds, a
deterministic mold maker, seven isolated game-skin organs, and four performance
profiles prepare the same presentation contract for future games. A full
33-surface Test Chamber, isolated surface editor, and adapter conformance lab
make coverage and adoption evidence visible before any game integration. Character
Forge is the character-focused organ inside the wider Style Fabric, not a
second privileged skin path.

## What it can see

- A skin pack the user explicitly imports.
- Raster images the user explicitly selects.
- The presentation-slot contract supplied by a game.
- Its own bundled preskin catalog.
- Its own local browser library.

## What it can change

- The temporary preview.
- Presentation values exposed by a consenting game adapter.
- A local skin file or browser-library entry when the user chooses Save or Export.

## What it cannot change

- Gameplay truth, physics, damage, score, inputs, networking, permissions, or executable game code.
- Existing AXM Foundation, Game Hub, games, Asset Vault, or Creative Studio files.
- Canon or promotion status.

## What it sends

Nothing by default. The reference implementation has no network route. Export creates a local file. A future hosted provider must be installed separately and pass its own consent and policy gate.

## What it stores

Only skin packs deliberately saved into the browser’s local IndexedDB library. Removing browser storage removes that local library. Exported files remain wherever the user saved them.

## Offline status

Fully offline after extraction. The package has no runtime dependencies and loads no remote fonts, scripts, images, APIs, or analytics.

## Risks

- A skin can still make a game unreadable, visually overwhelming, or inaccessible.
- Two individually readable preskins can produce a poor fusion; the resolved
  preview and game-owned cue protections remain required.
- Huge images can consume memory.
- Copyright and license claims supplied by creators are not magically verified.
- A game adapter may implement mappings incorrectly; the Style Fabric validator cannot prove third-party adapter behavior.
- Conformance proof checkboxes record declared observations; they do not
  automatically certify a renderer or replace game-specific tests.

## Rollback / turn off

Each runtime apply operation receives a rollback token. The CSS reference adapter restores the prior values. Games must preserve their own defaults and implement rollback before they can claim adapter conformance.
