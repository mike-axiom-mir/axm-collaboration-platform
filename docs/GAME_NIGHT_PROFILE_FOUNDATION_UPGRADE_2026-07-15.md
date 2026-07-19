# Game Night + profile foundation upgrade

Date: 2026-07-15

## Outcome

Game Night now uses one durable result boundary and the optional shared profile uses one portable receipt boundary. Badge pictures are replaceable presentation assets; unlock truth is not stored in the artwork or inferred from whatever screen happens to be open.

## Truth boundaries

- Four seats are visible by default. Seats 5–8 are an explicit optional second group.
- A shared screen never occupies a player seat.
- Human and AI seats stay visible in the same lobby and use declared controller actions.
- Starting, replacing or stopping a runtime does not count as a game played.
- Only an explicitly finished result may emit a `game-played` receipt.
- Receipt retries are safe through stable dedupe keys.
- Unknown contributor names are ignored; they are never silently credited to the local human.
- Profile tracking remains opt-in and can be paused without deleting history.
- Achievements never grant permissions, purchases, authority or system access.
- Post-game wisdom is never automatic. A person explicitly chooses discard, next match, private note or shared wisdom.

## Product surfaces

- Featured Game Night shelf: 003 Robo Pong Cross, 006 Lumenwake, 007 LUX-5 and 008 District Party.
- Named QR/controller route for every ready human, with same-network guidance.
- Generic post-game Bondfire page with objective evidence, separate human/AI perspectives and explicit wisdom promotion.
- Inactive Nostalgia Lab theme seed, ready for user-supplied authorized visuals.

## Verification

- Shared profile self-test and discovery seam review.
- Game Night self-test and 22-seam discovery review.
- Game packages, asset proposal handoff and external-script syntax checks.
- Browser verification of the 7-game shelf, four default seats and eight-seat optional expansion.
