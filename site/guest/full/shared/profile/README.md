# AXM shared profile

The shared profile is a small, local, opt-in activity and achievement record. It is deliberately not an account, permission system, ranking system, or online identity.

## Rules

- Tracking is off by default and starts only after the local human presses **Enable local profile**.
- Humans, AI identities, and machine collaborators use the same member/stat shape: games played, images, sound effects, total assets, eliminations, deaths/hard lessons, games developed, projects completed, code characters, and code purpose moods.
- A team result increments the team total once and each matched participant's contribution once.
- Game Night counts only an explicitly finished result. Starting, replacing or stopping a runtime does not count. Studio counts a produced raster export. Project Room counts a transition to Complete.
- Receipts carry unique dedupe keys, so retries do not inflate totals.
- Image and sound-effect receipts automatically count once toward total assets. A module must not also send a generic `asset-created` receipt for that same output.
- Kill and death totals accept an aggregate count only from one confirmed result receipt with evidence; they are not inferred from screen activity.
- Code characters require an exact positive count plus review evidence. Estimates are refused.
- Every completed coding task may submit one stable `code-task:<actor>:<task>` receipt through
  `AXMProfile.recordCodeTask(...)` or `record-code-task.js`. Retries are safe and cannot
  double-count the same task.
- Code totals do not infer authorship from changed files. When no reviewed task receipt is
  submitted, the profile shows when the last receipt arrived instead of inventing credit.
- Opting out preserves local history but stops all new receipts. Delete removes the entire local file.
- Achievements and reward-item links are reserved for a later reviewed offline/online system.

The profile is stored only in `state/shared-profile/profile.json`. The browser client posts activity receipts to the local Workshop server; it has no cloud route.

Modules may submit stable identity candidates to `/api/profile/receipt`. The host
matches them to opted-in profile members and refuses to guess when no identity
matches. `/api/profile/health` reports whether each declared source has ever
submitted a verified receipt; `WAITING_FOR_RECEIPT` never means synchronized.

## Portable optional infrastructure

The profile is a shared service, not property of the AXM Hub screen. `axm-profile-provider.js`
wraps the pure core with host-supplied local read/write adapters, so another local Hub can use
the same receipt, identity, achievement and review rules without copying this Hub interface.
`profile-service.contract.json` freezes the portable boundary.

The provider is deliberately opt-in. Its reporting-health view says `WAITING_FOR_RECEIPT` when
an application has not reported anything; it never calls that state synchronized and never
infers authorship by scanning a shared project. Each host may replace achievement artwork and
catalog thresholds while preserving the same verified receipt engine.

## Machine-native code task receipt

Connected collaborators can record a reviewed contribution without opening the profile screen:

```powershell
node shared/profile/record-code-task.js --actor codex --mood infrastructure --count 1200 --task navigation-v1 --evidence "Reviewed files and passing self-tests"
```

The exact count is intentionally required. The receipt command never scans unrelated files,
guesses authorship, or counts an entire shared project for one collaborator.

## Achievement emblems

- Five starter milestones plus eight three-tier progressive families derive only from verified profile statistics: code, images, sound effects, total assets, games played, eliminations, hard lessons/deaths, and games developed.
- The first intake provides 24 finished progressive emblems and six reusable special/community/tier templates. New packs append to the catalog without replacing identity history or receipt truth.
- The former `game-night`, `gallery-maker`, and `code-architect` record IDs migrate into their matching progressive thresholds so the page never shows duplicate unlocks for the same work.
- Team unlock state and each human/machine identity unlock are stored separately.
- Stable member IDs own progressive unlocks; one identity cannot borrow another's.
- Emblems use 512 x 512 transparent PNG masters with a 420 x 420 safe area.
- Locked artwork is dark and desaturated. Unlocking restores the original art and
  adds a tier rim/glow.
- Generated artwork belongs under `assets/achievements`; the profile remains
  usable with fallback glyphs until those professional assets exist.
