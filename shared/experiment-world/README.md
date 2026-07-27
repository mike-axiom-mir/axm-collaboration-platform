# AXM Experiment World

`axm.experiment-world/v1` is a disposable candidate-world kernel for open-ended creation without authority over canonical Workshop state.

It deliberately separates creative reach from outward authority:

- artifacts may use known kinds or remain an `unknown-capsule`;
- humans and machines receive the same structured sensor-frame shape;
- every change enters an append-only event sequence inside the candidate;
- network, installation, publishing, credentials, outside-filesystem writes, process execution and canonical writes are refused;
- declared intent resource envelopes fail closed but never claim measured hardware telemetry;
- only the internal `candidate-memory` effect is admitted; unknown effects fail closed;
- freezing produces a review candidate, never automatic promotion;
- checkpoints are explicit and digest-bound.

The deterministic pulse planner is a **rehearsal**, not a claim that Mirror is connected or that generative AI ran. A future capability broker may send the same typed intents from Mirror without changing the world contract.

## Schemas

- `axm.experiment-world/v1` - candidate state and artifact graph
- `axm.experiment-intent/v1` - bounded human or machine intent
- `axm.experiment-sensor-frame/v1` - observer view of exact state
- `axm.experiment-checkpoint/v1` - explicit portable checkpoint

## Authority boundary

The world owns only its in-memory/browser-local candidate. It cannot install, publish, promote, execute arbitrary code, use external network access, or change canonical Workshop/Mirror state.
