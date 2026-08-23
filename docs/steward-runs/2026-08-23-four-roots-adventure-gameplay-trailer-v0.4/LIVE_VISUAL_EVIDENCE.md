# Live gameplay trailer visual evidence

Status: `TEST` browser observation, separate from script verification

No raw browser screenshots, video recording, console dump, account data, or machine path was retained. The committed PNGs are renderer proof samples; the observations below are separate live-browser evidence.

## Desktop playback

- Surface: local Workshop trailer player in the Codex in-app Chromium browser.
- Selected source: committed WebM.
- Media state: duration 30 seconds, intrinsic video 640x360, `readyState` 4, no media error.
- Captions: the English WebVTT track reported `showing`.
- Action: clicked the visible Replay control.
- Observation at approximately 7.27 seconds: playback was active and the visible frame showed the real Workshop Crossroads map, player marker and movement trace, actors, 1/6 quests, 0/10 discoveries, and 8 moves.
- Observation at approximately 20.66 seconds: the visible frame had changed to the Continuity Archive map with state 143, 3/6 quests, 7/10 discoveries, and 128 moves.
- Observation at approximately 26.04 seconds: the visible frame had changed to A Door Into Review at the Crossroads with state 222, four ordered roots, 5/6 quests, 10/10 discoveries, and 198 moves.
- Visible labels stated `RECONSTRUCTED FROM EXACT TEST ENGINE STATE` and `NOT SCREEN CAPTURE / NOT LIVE PLAYER INPUT`.
- Navigation: the visible `Play the TEST game` link opened the live game route, whose title was `Four Roots Adventure · AXM TEST`; Back returned to the trailer.
- Browser diagnostics: no warning or error entries were reported.
- Verdict: PASS for live playback and changing gameplay-map presentation.

## Narrow responsive layout

- Viewport: 390x844 CSS pixels.
- Document and body horizontal extent: 375 pixels inside a 390-pixel viewport; no horizontal overflow.
- Rendered video: approximately 305.6x171.9 pixels, with left and right edges inside the viewport.
- Replay and `Play the TEST game` controls remained visible; evidence facts remained present in the semantic snapshot.
- Verdict: PASS for responsive layout in this Chromium surface.

## Observation cadence limit

The browser verifier sampled several visible moments rather than recording the whole 30 seconds. Exact frame-by-frame continuity is covered separately by the 360-sample container tests, forty checkpoint-to-pixel comparisons, and the 228-action state-digest chain. This receipt does not relabel deterministic reconstruction as screen capture or live input.

## Limits

- No physical phone, touchscreen, TV, cast target, VR headset, external display, light controller, gamepad, screen reader, Safari, Firefox, or Edge test was run.
- No audio claim is made; the trailer is intentionally silent with captions.
- No public publication, marketing campaign, installation, promotion, merge, or CANON action occurred.

