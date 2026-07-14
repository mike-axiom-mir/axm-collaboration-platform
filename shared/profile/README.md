# AXM shared profile

The shared profile is a small, local, opt-in activity record. It is deliberately not an account, permission system, ranking system, or online identity.

## Rules

- Tracking is off by default and starts only after the local human presses **Enable local profile**.
- Humans, AI identities, and machine collaborators use the same member/stat shape.
- A team result increments the team total once and each matched participant's contribution once.
- Game Hub counts a successfully started runtime session. Studio counts a produced raster export. Project Room counts a transition to Complete.
- Receipts carry unique dedupe keys, so retries do not inflate totals.
- Code characters require an exact positive count plus review evidence. Estimates are refused.
- Opting out preserves local history but stops all new receipts. Delete removes the entire local file.
- Achievements and reward-item links are reserved for a later reviewed offline/online system.

The profile is stored only in `state/shared-profile/profile.json`. The browser client posts activity receipts to the local Workshop server; it has no cloud route.
