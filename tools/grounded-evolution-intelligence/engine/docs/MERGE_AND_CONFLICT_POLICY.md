# Merge and Conflict Policy

Records with the same identity are merged only through explicit deterministic rules.

- Equal value: retain one value and all source evidence.
- Additive arrays: union by stable value while retaining source attribution.
- Different versions: preserve both version observations and compute current status separately.
- Conflicting scalar values: mark CONFLICTED; do not choose silently.
- Newer timestamp alone is not enough to erase older evidence.
- Steward resolution creates a decision event and keeps the conflict history.
- No automatic canon: a high-confidence proposal remains a proposal until accepted.
