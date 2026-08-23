# Live trailer visual evidence

Status: `TEST` browser observation, separate from script verification

No raw browser screenshots or recordings were retained. The committed PNGs are renderer proof samples, not substitutes for the live observations below.

## Desktop playback

- Surface: local Workshop trailer player in the Codex in-app Chromium browser.
- Selected source: committed WebM.
- Browser state: `readyState` 4, intrinsic video 640x360, duration 30 seconds, no media error.
- Captions: the English WebVTT text track reported `showing`.
- Action: clicked the visible Replay control.
- Observation: playback was not paused; current time advanced from approximately 2.69 to 8.03 seconds and the visible scene changed from the title to the controls explanation.
- Navigation: the visible `Play the TEST game` link opened the live game route; the game heading and `Watch trailer` return link were present.
- Verdict: PASS.

## Narrow responsive playback

- Viewport: 390x844 CSS pixels.
- Document horizontal extent: 375 pixels within a 390-pixel viewport; no horizontal overflow.
- Rendered video: approximately 305.6x171.9 pixels, preserving its aspect ratio.
- Browser state: duration 30 seconds, `readyState` 4, no media error.
- Verdict: PASS for responsive layout in this Chromium surface.

## Post-render identity check

After the final deterministic rebuild, the player was reloaded against the final committed bytes. The WebM again reported 30 seconds, `readyState` 4, and no media error. Replay advanced to approximately 2.15 seconds while playing.

## Limits

- No physical phone, touchscreen, TV, casting device, VR headset, external display, light controller, gamepad, screen reader, Safari, Firefox, or Edge test was run.
- No audio claim is made; the trailer is intentionally silent with captions.
- No cross-device sender/receiver transport occurred.
- No public publication, marketing campaign, installation, promotion, or CANON action occurred.
