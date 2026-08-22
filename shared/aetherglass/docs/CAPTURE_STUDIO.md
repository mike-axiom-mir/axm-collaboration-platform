# Capture Studio — v7

Capture Studio prepares a local interface for documentation or visual recording. It does not itself capture pixels.

## Profiles

- `documentation`: quiet, readable, motion-free technical state
- `showcase-still`: luxury depth with interaction and movement stopped
- `proof-record`: opaque, high-contrast evidence state
- `device-frame`: framing guides for viewport evidence
- `print-ready`: print-oriented route

## Evidence returned

`ready()` reports local font status, image completeness, running animation count when available, viewport dimensions, device pixel ratio, and horizontal overflow. It explicitly marks:

- `contentRead: false`
- `screenshotTaken: false`
- `gpuDeterminismProven: false`
- `localOnly: true`
- `telemetry: false`

## Ownership

Capture Studio snapshots the engine and particle field, tracks only selectors it temporarily hides, owns its guide overlay, and restores values it still owns. A platform change made after capture preparation survives the tested restoration route. Pre-existing capture/freeze classes are preserved.
