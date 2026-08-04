# AXM Hub front-platform audit

Date: 2026-07-28  
Scope: Hub Home opening state, desktop at 1280×720 and phone at 390×844, including phone navigation and the internal Home scroll.

## Goal

Make the front platform read as one coherent system instead of three stacked presentation concepts, while preserving the existing navigation, tools, data, and accessibility structure.

## Before

### 1. Desktop opening — fragmented

Evidence: `01b-current-desktop-viewport.png`

- The top ribbon, navigation spine, full-screen vortex hero, and utility cards each used a different composition language.
- The large hero consumed the opening view and made the workbench look like a second page below it.
- An additional “02 / WORKBENCH” treatment reinforced the page-within-a-page effect.

### 2. Phone opening — blocked

Evidence: `02b-current-mobile-viewport.png`

- The sidebar was marked collapsed, but its presentation layer still occupied 320 px of a 390 px viewport.
- Decorative navigation art covered the Home content, leaving only a narrow strip usable.

## Intervention

- Assigned one stylesheet—the Fabric adapter—as the visual owner of the platform shell.
- Removed the superseded vortex layer from the page load and suppressed presentation-only signal canvases.
- Rebuilt the hero as a bounded introduction on the same canvas as search, quick lanes, workbench cards, continuity, and handoff.
- Standardized the major sections around the same max width, gutters, border color, radius, surface depth, and spacing rhythm.
- Removed the workbench pseudo-heading that made the card area look like another page.
- Added a named container to the Home surface and a rem-based container-query enhancement, while retaining media-query fallbacks.
- Made the collapsed phone navigation truly zero-width and moved its 44×44 px reopen control away from the headline.
- Added accessible names to the two receipt inputs flagged by the static accessibility audit.

## After

### 3. Desktop opening — healthy

Evidence: `03-unified-desktop.png`

- Header, navigation, hero, search, lanes, and cards now share one restrained semantic surface language.
- The workbench begins in the opening viewport and reads as the continuation of Home.
- Existing status data and the 101-tool inventory remain visible.

### 4. Phone opening and navigation — healthy

Evidence: `04-unified-mobile.png`, `05-mobile-navigation-open.png`

- Home occupies the full phone viewport when navigation is closed.
- The reopen control remains reachable without covering the primary heading.
- Opening and closing the navigation produces a bounded 320 px drawer and restores the platform to zero-width navigation when closed.

### 5. Phone workbench — healthy

Evidence: `06-unified-mobile-workbench.png`

- The internal Home scroll reaches the workbench normally.
- Search, quick lanes, and cards remain in the same continuous visual system.

## Verification

- `hub/css-skin-fabric-selftest.js`: PASS
- `hub/sentient-atrium-selftest.js`: PASS, 36 checks
- `hub/hub-selftest.js`: PASS, 0 failures
- `hub/skin-selftest.js`: PASS, 0 failures
- `tests/html-script-syntax-test.js`: PASS, 55 pages
- Static accessibility audit for `hub/index.html`: PASS after the two accessible-name fixes
- Live phone interaction: navigation open/close and Home scroll verified

This pass does not claim a complete screen-reader journey, a formal contrast certification, or full keyboard-only regression coverage.

## CSS reference principles

The implementation uses Josh W. Comeau’s guidance as principles rather than as a visual template: container-aware composition, rem-based responsive thresholds, and progressive enhancement with a harmless fallback.

- https://www.joshwcomeau.com/css/container-queries-unleashed/
- https://www.joshwcomeau.com/css/surprising-truth-about-pixels-and-accessibility/
- https://www.joshwcomeau.com/css/browser-support/
