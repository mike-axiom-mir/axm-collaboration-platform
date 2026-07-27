# Design QA — Hub profile control and Heartbeat schedule

Date: 2026-07-27  
Reviewer: Codex  
final result: passed

## Evidence

- Source visual truth: private local clipboard capture (not packaged)
- Full Hub before state: `C:\axm workshop\state\visual-audits\2026-07-27-header-profile-label\02-before-full.png`
- Final Hub state: `C:\axm workshop\state\visual-audits\2026-07-27-header-profile-label\04-after-header-final.png`
- Final Heartbeat state: `C:\axm workshop\state\visual-audits\2026-07-27-header-profile-label\06-heartbeat-schedule-anchored.png`
- Final Workshop Update Gate state: `C:\axm workshop\state\visual-audits\2026-07-27-header-profile-label\09-workshop-update-gate-pulse-off-final.png`

## Capture normalization

| Surface | Pixel dimensions | Live CSS viewport/state | Density note |
| --- | ---: | --- | --- |
| User source crop | 157 × 92 | Focused header crop | Clipboard metadata reports about 120 DPI; used as focused truth, not as a full-page geometry target. |
| Hub final | 1280 × 720 | 1280 × 720; Visual System; Shared profile | Browser reported DPR 1.25 while the saved evidence is normalized to the CSS viewport dimensions. |
| Heartbeat final | 1425 × 950 | 1440 × 960 content viewport; CONSERVE; hourly anchored schedule | The saved tab capture excludes the occupied scrollbar edge while preserving the tested desktop layout. |
| Workshop Update Gate final | 1425 × 950 | 1440 × 960 content viewport; updater OFF; CHECK_ONLY selected | The live screen was checked at the same desktop content width as Body Pulse. |

The source was a focused crop, so global page alignment was not inferred from it. The requested header relationship was checked against the crop and then measured in the full implementation.

## Comparison history

### Iteration 1

The visible `COCKPIT` profile label was removed and `EDIT` was placed after the Shared selector. At the constrained 1280-pixel viewport, the presentation control could still become too narrow and let the button escape its border.

- Severity: P2
- Fix: reserve a compact presentation-control width, switch to a two-column selector/button layout at or below 1320 pixels, and hide the redundant `SCREEN` caption at that constrained width.

### Iteration 2

The source crop and final implementation were opened together. The profile label is absent, `EDIT` is immediately adjacent to Shared, and the button remains inside the control.

- Presentation control width: 155.4 CSS px at the tested 1280-pixel viewport
- Selector-to-button gap: 7 CSS px
- Profile label display: `none`
- Button containment: passed
- Horizontal overflow: none

## Required fidelity surfaces

- Typography: Existing Hub and Body Pulse typography, weights, and tracking are retained.
- Spacing and layout: Header hierarchy is tighter without changing neighboring controls; the Heartbeat form follows the existing card grid and responsive behavior.
- Colors and tokens: Existing cyan, green, amber, border, and dark-surface tokens are reused; no new visual language was introduced.
- Image and asset fidelity: No visual asset was replaced, approximated, stretched, or synthesized.
- Copy and content: The redundant `COCKPIT` header text is removed. Heartbeat copy distinguishes `when` from Pulse `how many`, states local time, repetition, coalescing, and the no-immediate-run boundary.

## Heartbeat functional visual check

The Heartbeat extension had no separate source mock, so it was evaluated against the existing Body Pulse design system and the requested behavior.

- Exact local next-run time is visible and editable to the second.
- Rhythm remains independently selectable.
- `Save schedule` is explicit and does not emit a beat.
- Saved state visibly changes from `interval from change` to `anchored`.
- The next beat remains 2026-07-27 07:17:53 Europe/Amsterdam after saving.
- The bounded five-check allow-list and findings-only repair authority remain visible.
- No P0, P1, or P2 visual issue remains.

## Verification

- `npm.cmd run test:heartbeat`: passed sequentially, including 10 Heartbeat core checks, verification bridge checks, 13 Body Pulse core checks, service checks, and dashboard contract checks.
- `node hub\hub-selftest.js`: 0 failures.
- Syntax checks passed for Heartbeat core/service/bridge, Body Pulse UI, and Hub self-test.
- Live API reports Heartbeat `0.2.0`, `scheduleMode: ANCHORED`, hourly cadence, sequence `1`, a passing five-check first window, and time-only authority.
- The first scheduled window completed five useful checks in 2.3 seconds with `5 PASS / 0 FAIL`; the rotating verification deck now contains 28 checks.
- `npm.cmd run test:workshop`: passed, including Heartbeat, updater, Hub, privacy, intake, capability, continuity, orientation, handoff, and discovery checks.

## Workshop Update Gate visual check

The updater extends the same Workshop visual system without implying that staged bytes are already installable.

- OFF and ZERO NETWORK are the dominant status cues.
- Owner controls, current state, the four-step trust path, receipts, and the no-install-authority boundary are visually separated.
- CHECK_ONLY hides the unrelated verified-download confirmation; AUTO_STAGE reveals it.
- The Body Pulse gate visibly reports `disabled · conserve · 1 lease/check` while the updater is off.
- “Check GitHub now” is disabled while the updater is off.
- The four-step path leaves the missing whole-Workshop installer visibly held instead of presenting false completion.
- The 1425-pixel content viewport has no horizontal overflow.
- No P0, P1, or P2 visual issue remains.
