# Design QA — AXM Pong: Duet

Final result: **passed**

## Source truth and implementation evidence

- Visual target: `evidence/design/shattered-line-reference.png` (1487 × 1058).
- Live desktop implementation: `evidence/design/duet-shattered-live-stable-1440x1024.png` (1440 × 1024, shared-screen story co-op, Shattered Line, running state).
- Combined fidelity pass: `evidence/design/duet-shattered-comparison.png`.
- Setup state: `evidence/design/duet-setup-1440x1024.png`.
- Tablet evidence: `evidence/design/duet-tablet-900x1024.png`, supplemented by measured browser geometry at a 900 × 1024 CSS viewport.
- Phone controller: `evidence/design/duet-controller-p1-390x844.png` (390 × 843 capture, P1 controller).

## Comparison findings

- **Layout and imagery:** Passed. The implementation preserves the reference hierarchy: thin status rail, full-height glass arena, cyan/magenta split defense, amber Warden edge, central neon ball, and a compact mission rail. The generated environment plate is used as a real raster asset rather than reconstructed with CSS or SVG.
- **Typography and copy:** Passed. Monospaced display treatment, condensed status labels, clear chapter naming, and short co-op instructions remain readable at desktop and tablet sizes. Dynamic outcome copy clearly distinguishes ready, running, paused, victory, and defeat.
- **Color and surfaces:** Passed. Cyan, magenta, mint, and amber roles match the reference; dark Aetherglass surfaces and restrained borders retain the darker light-based direction without generic rounded-card drift.
- **Interaction states:** Passed. Arena selection, start, pause/resume, rematch, next chapter, keyboard input, and phone power/movement controls are present and connected to server-authoritative state. Browser console check returned no warnings or errors.
- **Accessibility:** Passed. Controls are semantic buttons with visible keyboard focus, regions are labelled, the canvas has an accessible label, reduced-motion and increased-contrast media rules exist, and phone tap targets are 92 CSS px tall in the verified layout.

## Fix history

1. The first phone pass revealed that the hidden arena still occupied the controller's main row, pushing the useful panel below the viewport.
2. `runtime/neon-pong-duet.css` was corrected so player view removes the arena from layout, gives the controller panel the full middle row, and keeps the movement deck in a dedicated bottom row.
3. The 390 × 844 controller geometry and live screenshot were rechecked after the fix. No clipping or overlap remained.

## Intentional differences

- The reference includes decorative side score callouts; the implementation keeps score/mission information in one readable bottom rail to leave more of the live playfield visible.
- Live paddles, ball trails, powers, mission values, and outcome state are rendered dynamically over the image plate, so exact object positions differ from the static target by design.
