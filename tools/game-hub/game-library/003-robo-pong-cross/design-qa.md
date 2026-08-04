# Design QA — AXM Pong: Cross

Final result: **passed**

## Source truth and implementation evidence

- Cathedral target: `evidence/design/cathedral-cross-reference.png` (1487 × 1058).
- Cathedral implementation: `evidence/design/cross-cathedral-live-1440x1024.png` (1440 × 1024, 3-player co-op, running state).
- Cathedral comparison: `evidence/design/cross-cathedral-comparison.png`.
- Relay target: `evidence/design/relay-protocol-reference.png` (1487 × 1058).
- Relay implementation: `evidence/design/cross-relay-live-stable-1440x1024.png` (1440 × 1024, 3-player co-op, running state).
- Relay comparison: `evidence/design/cross-relay-comparison.png`.
- Setup states: `evidence/design/cross-cathedral-setup-1440x1024.png` and `evidence/design/cross-relay-setup-1440x1024.png`.
- Tablet evidence: `evidence/design/cross-tablet-900x1024.png` (900 × 1024).
- Phone controller: `evidence/design/cross-controller-p1-390x844-viewport.png` (390 × 843 capture, P1 controller).

## Comparison findings

- **Layout and imagery:** Passed. Cathedral keeps the four-edge chamber and Relay keeps the diamond arena. Both use purpose-built raster environment plates with live canvas paddles, ball, trail, Warden prism, and HUD layered above them.
- **Typography and copy:** Passed. The compact AXM rail, seat count, arena name, co-op objective, controller identity, and ability state are readable and consistent with the source direction.
- **Color and surfaces:** Passed. Player colors remain stable by edge; mint communicates co-op progress, coral communicates the Warden, and the actual Aetherglass v7.1 visual and lighting systems supply the glass/light treatment.
- **Viewport resilience:** Passed at 1440 × 1024, 900 × 1024, and 390 × 844. Tablet mode deliberately collapses the secondary navigation while preserving the live status and pause control. The square arena and mission rail stay inside the viewport.
- **Interaction states:** Passed. Arena choice, start, pause/resume, 3-player sealed-edge behavior, 4-player second-ball behavior, co-op relay/Warden flow, versus elimination, shared-screen keyboard routes, and phone control routes are present. Browser console checks returned no warnings or errors.
- **Accessibility:** Passed. Semantic buttons and labelled regions are keyboard reachable, focus is visible, controller tap targets are 92 CSS px tall, the canvas has an accessible label, and reduced-motion/increased-contrast variants are provided.

## Fix history

1. The first mobile pass showed an empty full-screen arena reserving the controller's middle row.
2. `runtime/neon-pong-cross.css` was corrected to remove the arena from player-view layout and allocate distinct controller and control-deck rows.
3. The controller was recaptured at 390 × 844 and re-measured: the panel fits between y=63 and y=723, and the control deck occupies y=732 through y=844 without overlap.

## Intentional differences

- The static targets contain decorative numeric score pods; the implementation places authoritative life, core, Warden, relay, and arena data in the bottom rail or controller strip so the values can change cleanly during play.
- The 3-player co-op presentation includes a live fourth-edge Warden, while 3-player versus seals that edge. Four-player co-op moves the Warden to the central prism; four-player versus activates all four human edges and the echo ball.
