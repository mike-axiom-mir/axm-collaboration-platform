# v0.2.1 Test-Ready Change Log

This checkpoint is deliberately narrow: it strengthens and exposes the disconnect/reconnect path before Mike's Saturday test.

## Reliability

- Reconnect queues now coalesce full semantic input state. Only the newest state is retained; an old held direction cannot be replayed as a burst after reconnect.
- Heartbeats are owned by the reconnecting transport and include a client-side heartbeat timeout.
- WebSocket connection attempts have an open timeout and exponential backoff with jitter.
- Phone visibility, page lifecycle, online, and offline events neutralize or wake the controller explicitly.
- A phone wake flushes the newest queued semantic state.
- A deliberate outbound-silence mode allows the real watchdog and reconnect path to be tested without changing router settings.

## Observability

- `/diagnostics` reports connected controllers, last-seen age, resumes, watchdog recoveries, rejected frames, forwarded frames, and recent connection events. It excludes private resume tokens.
- The host page shows connected phones, same-seat resumes, and watchdog recoveries.
- The host can download a JSON live-test report containing measured RTT summaries and event history.
- The phone TEST panel shows transport state, queue size, last pong age, reconnect count, visibility, online state, and frame counts.

## Proof

- Unit proof confirms stale full-state frames are coalesced and only the newest neutral state is flushed.
- Live integration proof deliberately silences a real reconnecting client, observes server watchdog neutralization, verifies same-seat resume, and confirms neutral state after recovery.
- Existing v0.2 tests remain passing.

## Still not claimed

- No exact real-device latency or battery result is claimed before Saturday's physical test.
- Browser behavior under every Android vendor's battery saver is not proven.
- This checkpoint remains a reference/migration build, not a universal production declaration.
