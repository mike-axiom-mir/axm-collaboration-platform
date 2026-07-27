# Hub sidebar glass and status-light QA

## Target

- Reference: private local clipboard capture (not packaged)
- Live proof: `C:\axm workshop\hub\qa\sidebar-glass-status.png`
- Route: `http://127.0.0.1:8788/hub/index.html?qa=sidebar-glass-20260724`
- State: Advanced Hub, left navigation, Create workspace rows visible.

## Visual comparison

- The full navigation row now carries a visibly layered dark-glass body, accent wash, bright upper edge and recessed lower edge instead of ending in a flat legacy panel.
- Pictograms keep their stronger 3D tile treatment and remain the first visual anchor.
- Lifecycle signals preserve the name lane as compact 9 × 9 px power LEDs with a bright core, specular highlight, and colored halo.
- WORKING is green, TEST is blue, HOLD is red, SAVED is cyan, and CANON retains the separate green/gold verified treatment.
- Text remains quieter than icons and status lights, preserving the requested hierarchy.
- The rail remains usable at 230 px and reduced-motion behavior is unchanged.

## Issue check

- P0: none.
- P1: none.
- P2: none remaining for this localized pass.

## Verification

- Live browser render inspected after cache-busted reload.
- Computed row surface reports `blur(11px) saturate(1.28)`.
- Computed WORKING signal reports 9 × 9 px and two visible green halo layers.
- `node hub/hub-selftest.js`: 0 failures.

Final result: **PASSED**.

---

# Complete compact navigation-rail QA

## Target

- Source references: two private local clipboard captures (not packaged).
- Final top proof: `C:\axm workshop\hub\qa\compact-all-sidebar-final.png`.
- Final lower-rail proof: `C:\axm workshop\hub\qa\compact-all-sidebar-bottom-final.png`.
- Composite comparison: `C:\axm workshop\hub\qa\compact-all-sidebar-comparison.png`.
- Route: `http://127.0.0.1:8788/hub/index.html?qa=compact-all-sidebar-final-20260725`.

## Visual check

- Home, Command Center, Mirror Command Deck, Workshop Growth and Visual System now use the same 38 px instrument row and 28 px icon cell as generated modules.
- Workflow doors, `Open this layer`, and the machine-module reveal control use the same compact grammar.
- Status dots remain compact and readable; labels retain ellipsis instead of pushing the rail wider.
- The lower collapse control now lives inside the rail.
- A second 19 x 18 px collapse control sits inside the `AXM / NAVIGATION DECK` header.

## Interaction check

- Header control collapsed the navigation and exposed the same 28 x 44 px reopen tab.
- Reopen restored the full rail and synchronized `aria-expanded` on both controls.
- Module, door and layer-control ownership and click behavior were not changed.

## Verification

- `node hub/hub-selftest.js`: 0 failures.
- `node --check hub/hub-shell.js`: pass.
- `node verify.js`: 0 failures, 37 existing warnings, 1036 indexed capabilities.
- Live desktop visual and bounded interaction verification: pass.

final result: passed

---

# Screen contract and compact module-navigation QA

## Target

- Source reference: private local clipboard capture (257 x 147 px; not packaged).
- Full final proof: `C:\axm workshop\hub\qa\screen-contract-compact-sidebar-final.png` (1280 x 720 px).
- Focused final proof: `C:\axm workshop\hub\qa\screen-contract-module-rows-focus.png` (230 x 147 px).
- Side-by-side comparison: `C:\axm workshop\hub\qa\screen-contract-sidebar-comparison.png`.
- Route: `http://127.0.0.1:8788/hub/index.html?qa=presentation-policy-final2-20260725`.
- State: Advanced Hub navigation with Presentation Spine open, shared Studio profile, generated Create modules visible.

## Architecture contract

- `axm.screen-contract/v1` separates Body -> Behavior -> Presentation -> Screen.
- Body and behavior are not editable through the screen contract.
- Presentation presets expose bounded layer choices by module purpose: fixed, instrument, balanced, operational, creative or expressive.
- The screen has view authority only; it cannot change permissions, runtime behavior, saved work or physical hardware claims.
- The resource policy is capability-first: a host may reduce motion, depth, effects or asset resolution without silently pretending that an unavailable CPU, RAM, GPU or hardware capability still exists.

## Visual comparison

- The initial generated module rows measured 51.6 px high with 36 px icon tiles and read as feature cards rather than navigation instruments.
- Final generated module rows measure 38 px high with 28 px icon tiles, restrained glass depth, single-line truncation and 7 px lifecycle power dots.
- The focused reference/final comparison confirms the module entries now reuse the Navigation Deck material, border rhythm, compact spacing and teal edge language while retaining the module icon and lifecycle truth.
- Active generated-module state was checked live: 38 px height, 56% accent border, 2 px inset accent edge and restrained 18 px glow.

## Interaction check

- The top bar exposes `SCREEN`, Shared/Module mode, resolved profile and an explicit `EDIT` control.
- Creative modules expose surface, depth, motion, density and signal.
- Technical Art Validator resolves to the instrument contract and exposes only density and signal.
- The editor states the boundary in human language: body and behavior stay locked; screen edits are presentation-only.
- Close, module navigation and return to Visual System all worked in the live Hub.

## Issue check

- P0: none.
- P1: none.
- P2 fixed: generated module density did not match the compact Navigation Deck reference.
- P2 fixed: visual editing lacked an explicit typed boundary from behavior and runtime authority.

## Verification

- `node hub/hub-selftest.js`: 0 failures.
- `node tools/presentation-spine/selftest.js`: pass.
- `npm.cmd run verify`: 0 failures, 37 existing warnings, 1036 indexed capabilities.
- Live visual and interaction verification: pass.

final result: passed

---

# Portable presentation-recipe QA

## Target

- Final proof: `C:\axm workshop\hub\qa\presentation-recipe-final.png`
- Route: `http://127.0.0.1:8788/hub/index.html?qa=presentation-recipe-20260725`
- State: Presentation Spine embedded in the Hub, Shared mode, dimensional depth and luminous signal.

## Contract check

- `axm.presentation-recipe/v1` carries only profile plus surface, depth, motion, density and signal choices.
- CSS, HTML, scripts, selectors, behavior, runtime and permission fields are refused.
- Skinner remains the base color/font/asset/layout system; UI-FX remains the low-level effect library.
- Shared mode applies the validated recipe to same-origin module presentation only.
- Module mode removes recipe attributes and restores the creator-owned profile.
- Import, export, explicit apply, reset and deterministic fingerprinting are present.

## Live interaction check

- Changed depth from Raised to Dimensional and signal from Clear to Luminous.
- Applied recipe fingerprint `34028b69b025237d`.
- Reloaded the Hub and confirmed both selections and applied body attributes survived.
- Switched Shared -> Module and confirmed recipe attributes cleared while the original `lab` profile returned.
- Switched Module -> Shared and confirmed the recipe reapplied.
- Corrected the presentation-authority cards so their boundary labels no longer overlap body copy.

## Issue check

- P0: none.
- P1: none.
- P2: none remaining for this recipe pass.

## Verification

- `npm.cmd run verify`: 0 failures, 1034 indexed capabilities.
- Hub selftest: 0 failures.
- Presentation Spine shared selftest: pass.
- Presentation Spine tool selftest: pass.
- Live browser interaction and reload proof: pass.

Final result: **PASSED**.

---

# Shared / module presentation-policy QA

## Target

- Before: `C:\axm workshop\hub\qa\presentation-policy-before.png`
- Final proof: `C:\axm workshop\hub\qa\presentation-policy-final.png`
- Route: `http://127.0.0.1:8788/hub/index.html?qa=presentation-policy-final2-20260725`
- State: Workshop Command Center embedded in the Hub with `LOOK = Shared`, profile `cockpit`.

## Contract check

- Shared presentation is the default for participating modules.
- The visible `LOOK` selector changes only presentation; module behavior, state, data, and permissions remain owned by the module.
- `Module` restores the document's original body/profile state instead of layering shared-host styling over it.
- Per-module choice and the shared profile survive Hub reload.
- A module may declare `moduleVisual: false`; that truthfully disables a module-owned visual mode instead of pretending one exists.

## Live interaction check

- Switched the embedded Command Center from Shared to Module and back to Shared.
- Reloaded the Hub and confirmed Shared plus the `cockpit` profile were restored.
- Waited beyond the eight-second recovery window and confirmed the embedded Command Center remained visible.
- Fixed two false-timeout paths: stale navigation timers and browser hosts that visibly paint a same-origin iframe without delivering a reliable load event.

## Issue check

- P0: none.
- P1: none.
- P2: none remaining for this policy pass.

## Verification

- `node hub/hub-selftest.js`: 0 failures.
- Presentation Spine selftest: pass, 4 profiles and 171 deterministic surface records.
- Presentation Spine tool selftest: pass.
- Workshop Command Center selftest: pass.
- Live browser verification: Shared -> Module -> Shared -> reload, no timeout overlay.

Final result: **PASSED**.
