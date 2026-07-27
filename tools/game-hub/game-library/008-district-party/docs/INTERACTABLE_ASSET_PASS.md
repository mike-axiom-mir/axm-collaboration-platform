# v0.2.7 interactable-asset pass

## Outcome

The supplied 2026-07-19 archive is preserved unchanged, but it is not loaded wholesale. The source contains 158 individual RGBA PNGs across seven categories. All decode, 157 expose a full transparent-to-opaque alpha range, and several still have visible cleanup defects. Fourteen individually inspected candidates enter runtime.

## Gameplay integration

Five accepted parcel/crate images replace the single presentation used by Courier Chaos and Supply Sweep. The renderer chooses a visual by hashing the host-owned package ID. This gives every package a stable appearance on the ground and while carried without adding mutable client state.

The pass does not change:

- package spawn coordinates;
- claim ownership or simultaneous-claim resolution;
- AI package selection;
- vehicle carrying;
- delivery validation;
- score, reward or mission-completion rules.

Twenty-eight small prop overlays dress eight city areas. Twenty-five are `visual-only`. The centre ATM, centre vending machine and Party House safe are `reserved` and display that word on screen. No purchase, banking, storage, breakable-health or loot interaction is claimed.

## Runtime selection

- 5 parcel/crate variants
- 1 safe preview
- 1 vending preview
- 1 ATM preview
- 1 barrel
- 1 pallet
- 1 dumpster
- 1 bench
- 1 bollard
- 1 trash can

The exact original entry, runtime path, dimensions, SHA-256 and intended use for every accepted file are in `assets/INTERACTABLE_ASSET_MANIFEST.json`.

## Quarantine

`phones_cards_keys_005.png` is a 15×11 partial-alpha fragment and is rejected. `phones_cards_keys_014.png` retains visible checker contamination and is rejected. Three damaged money candidates and the phone/card/key family remain held back. Window and door variants remain source-only until an authoritative breakable-state system exists.

## Asset-factory lesson

The hard part is not only image generation. A reusable local factory needs a deterministic conveyor:

1. one subject per source frame;
2. consistent top-down/oblique camera and light direction;
3. true-alpha extraction;
4. edge and internal-hole inspection;
5. trim, padding and scale normalization;
6. semantic naming and category mapping;
7. duplicate/fragment rejection;
8. automatic contact sheets and in-engine previews;
9. hashes, source lineage and license status;
10. a human acceptance gate before `assets/selected`.

This pass deliberately treats the complete pack as intake material and `assets/selected/interactables/axm_generated` as the promotion boundary.

## License boundary

Mike described the images as test assets made in his own chats. They are accepted for this local AXM prototype under a working permission direction, not labelled CC0. `AXM-RESPONSIBLE-USE-ASSET-DRAFT-0.1` is a project draft and **not legally reviewed or an open-source license**. Public redistribution should wait for explicit final permission text.

## Validation

- Focused interactable suite: **PASS — 6/6**
- Complete suite: **PASS — 176/176**
- CLI lifecycle/static HTTP: **PASS**
- Actual Canvas preview generation: **PASS**
- Automated Chromium browser smoke: see `TEST_REPORT.md`
- Physical phones/displays: **UNTESTED**

