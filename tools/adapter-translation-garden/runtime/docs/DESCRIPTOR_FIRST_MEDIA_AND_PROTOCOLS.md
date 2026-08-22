# Descriptor-First Media, Protocol, and Offline Growth

Runs 16–25 deliberately separate **understanding and planning** from **execution**.

- Media modules describe color, alpha, audio, video, document, scene, and archive changes without claiming codec support.
- The migration module emits a reviewable plan and never touches data.
- Protocol modules build envelopes, bindings, state transitions, and normalized errors without opening servers, sockets, brokers, or subprocesses.
- Offline modules build deterministic queue, integrity, sequence, and representation decisions without sending or storing anything.

This boundary lets AXM later connect a proven native implementation behind the same small contract without making the current prototypes pretend to be complete runtimes.
