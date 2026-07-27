# Evidence ledger

Status: accepted against the integrated five-asset P0 runtime on 2026-07-19.

## Automated evidence

- `node selftest.js` passes 17 checks over deterministic native and post sample streams.
- Independent verification recomputes P50, P95, and worst values; checks disjoint warm-up/measurement ranges; and rejects forged percentiles or broken screenshot/timing links.
- Typed `unsupported` GPU timing is allowed; an unavailable extension cannot become a fake zero.

## Live current-machine evidence

- Scene: storefront, animated pedestrian, modular commercial building, hatchback, and foliage; 2,194,352 source bytes and 182,336 embedded or digest-bound local texture bytes.
- Both modes use 30 excluded warm-up frames followed by 90 retained measurement frames.
- Native: CPU P50 1.25ms, P95 1.80ms, worst 2.40ms; GPU P95 1.62ms with 90/90 samples; 53 draws and 11,566 triangles.
- Post-processed: CPU P50 1.40ms, P95 1.76ms, worst 2.00ms; GPU P95 1.77ms with 90/90 samples; 54 draws and 11,567 triangles; one 2,114,600-byte framebuffer upload per frame.
- Shader compilation measured 15.20ms native and 11.20ms post. Profiler bookkeeping calibration is declared as 0.39 microseconds per frame.
- Native worst-state replay: frame 54 / tick 55; PNG `7A9312340FF40EB6DCB0E24D220F86B0815CD5E8E730CA835D350DF2D5C2FC8B`.
- Post worst-state replay: frame 181 / tick 62; PNG `A325EC3FF4E98E9F3A619E7F861672527BD15D590642603677940555A2B2F132`.
- Suite receipt `D884C7063FF94264250DE533F9F4036218A00AF864230ADB570D1D5AB513021E`; independent verifier PASS 10/10; completed progress UI hidden; compact layout and console checks pass.

## Honest boundary

Overdraw remains an explicitly typed draw-and-triangle screen-pressure proxy, not pixel-exact hardware overdraw. Worst images are deterministic replays outside the timing window, so PNG capture cost does not contaminate percentiles.
