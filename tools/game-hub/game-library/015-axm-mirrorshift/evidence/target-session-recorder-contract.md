# Target-session recorder capability contract

```text
capability_id: performance.hardware.session-recorder
purpose: Produce a compact, reviewable browser/runtime performance receipt during a representative target-device Mirrorshift session without changing game authority.
inputs and schemas: Opt-in `?perf=1` launch; 2, 10, or 30 minute duration; `axm.render-performance-diagnostics/v1`; `axm.mirrorshift-telemetry/v1`; optional Long Task, JS heap, and Battery browser APIs.
outputs and schemas: Downloadable `axm.target-session-performance/v1` JSON receipt containing bounded histograms, workload segments, interruption/reconnect counters, compact recent transitions, evidence boundaries, and explicit completion status.
side effects: Read-only GET of local telemetry; one extra request-animation-frame observer; bounded in-memory aggregation; user-initiated local JSON download. Authority writes are forbidden and counted as zero.
permissions and consent: Recorder UI exists only behind `?perf=1`; collection begins only after START RECORDING or explicit `perfAutostart=1`; no account, network address, user agent, raw frames, microphone, camera, or external upload.
resource budget: Fixed histograms, at most 64 workload segments, at most 128 recent transition events, one-second client sampling, five-second server sampling, and a hard 30-minute duration ceiling.
failure and recovery behavior: Unsupported APIs are labelled unavailable; telemetry failures are counted; focus, visibility, offline, authority-loss, and recovery transitions are retained; manual/early stop emits `partial` and cannot satisfy the long-soak gate.
compatibility/version contract: Recorder version 0.12.0; input render schema v1; output target-session schema v1; presentation and server-authority contracts remain unchanged.
verification contract: Pure held-out 108,000-frame/30-minute test, package/static assertions, HTTP delivery, live opt-in visual journey, bounded real-time smoke receipt, and no-authority-write assertion.
promotion gate: The recorder hand may be READY after local contract/live verification. `performance.hardware.long-soak`, target 60 fps, thermal/compositor behavior, and perceived motion remain UNKNOWN until a complete 30-minute receipt is joined with an external native profiler and target-display observation.
```

This contract creates the missing measurement hand. It deliberately does not manufacture the external hardware, thermal sensor, display observer, or human judgment needed to close the production gate.
