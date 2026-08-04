# Mirror learning Heartbeat evidence route

## lane-off-now

- claim: The prepared lane is not active now.
- kind: authorization and current state
- risk: high
- pass condition: packaged bridge config is false, no live Workshop state file has enabled it, and the Pulse seat remains disabled.
- primary surface: direct persisted-state inspection
- counterevidence: `mirror-learning.json` contains `enabled: true`, or Body Pulse reports the module enabled.
- secondary surface: focused bridge execution with a scheduled beat.
- observed evidence: `state/platform-heartbeat/mirror-learning.json` is absent; persisted `mirror-learning-forge.enabled` is false; the bridge self-test made zero Mirror calls while disabled.
- verdict: PASS
- named seam: the currently running Hub must be restarted later to load the new code, but restart is not activation because the package default remains false.

## shared-hourly-cadence

- claim: The bridge uses the shared hourly Heartbeat and has no private timer.
- kind: deterministic timing behavior
- risk: medium
- pass condition: only scheduled beats are accepted, attempts inside 3,599 seconds are held, and the module defines no timer.
- primary surface: focused deterministic self-test with injected clock.
- counterevidence: a manual beat admits a lesson, a second lesson enters within the rolling hour, or the bridge contains `setInterval`/`setTimeout`.
- secondary surface: static source inspection.
- observed evidence: the self-test passed manual-beat refusal and the one-hour cap; the bridge contains no private timer.
- verdict: PASS
- named seam: cadence is checked only while the Workshop server is running; missed beats do not create a burst.

## independent-gates

- claim: The lane cannot enable Pulse or Mirror lesson intake by itself.
- kind: authorization
- risk: high
- pass condition: explicit lane configuration changes only the lane flag; disabled Pulse holds before any Mirror request; opted-out/unavailable feed holds before any lesson ingest.
- primary surface: denied-state execution assertions.
- counterevidence: bridge registration changes `mirror-learning-forge.enabled`, calls Mirror while Pulse is disabled, or changes action-feed settings.
- secondary surface: source inspection for mutation endpoints and adapters.
- observed evidence: the self-test proved Pulse-disabled short-circuit before Mirror access; the bridge has no Pulse registration call and receives only action-feed status/ingest adapters, not settings authority.
- verdict: PASS
- named seam: a human must separately opt in the lane, the Pulse module, and Mirror's private feed before later use.

## reviewed-clone-only

- claim: Only dual-reviewed exact-digest Code Clone outcomes can become lesson receipts.
- kind: transport and authorization
- risk: high
- pass condition: item kind, state, two distinct approval actors, vote digests, candidate digest and no-auto-apply action all match before a receipt is sent.
- primary surface: focused held-out review fixture and asserted receiver payload.
- counterevidence: pending, single-seat, wrong-digest or automatic-apply candidates pass eligibility.
- secondary surface: Review Inbox contract inspection.
- observed evidence: the passing fixture required two independent exact-digest votes; the transmitted action contained the digest and excluded candidate paths and code.
- verdict: PASS
- named seam: this is private corpus admission only, not evidence of learning improvement.

## protected-bodies

- claim: The prepared bridge cannot rewrite original Mirror or Code Clone.
- kind: authorization and static structure
- risk: high
- pass condition: no filesystem mutation path exists; output authority fields are all `NONE`; only receipt metadata is sent to the existing private action-feed intake.
- primary surface: source capability inspection.
- counterevidence: any file-write primitive, original-Mirror path, candidate-path transport, apply call, training call or promotion call in the bridge.
- secondary surface: focused payload assertion and persisted-state inspection.
- observed evidence: the bridge has zero filesystem mutation or Mirror-home references; its self-test rejects candidate-path leakage and asserts source/apply/training/promotion authority `NONE`.
- verdict: PASS
- named seam: when explicitly enabled later, the existing Mirror action feed writes a reviewed private episode under its own separate opt-in contract; it does not alter original roots, runtime, weights or CANON.
