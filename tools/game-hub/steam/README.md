# AXM Local GameHub — Steam preparation lane

Status: **TEST** · not uploaded · not approved · not released · not CANON

This directory prepares one Steam application named **AXM Local GameHub**. The
application contains the GameHub shell and its installed local game library. It
does not create one Steam application per game.

Tuesday, 18 August 2026 is the planned Steamworks account/onboarding and fee
day. It is not the public launch date. If the app fee is paid that day, the
30-day Steam Direct waiting period makes 17 September 2026 the earliest
possible release date from that rule alone. Valve's store/build reviews, the
minimum two-week Coming Soon period, unresolved GameHub QA, and human release
approval are separate gates and may move the date later.

## What exists now

- `steam-product-plan.json` is the machine-readable product boundary, timeline,
  launch option, asset contract, and owner-gate ledger.
- `steam-readiness.js` checks the 19 installed game packages, preserves their
  warnings, validates the bundled Windows runtime and launch path, checks Steam
  image dimensions, inventories rights evidence, and refuses a false ready
  verdict while human/Valve gates remain open.
- `start-steam-gamehub.js` is a Windows-first Steam launch target. Steam can run
  `runtime\node\node.exe` with this script as its argument. It starts only the
  dedicated Steam shell and GameHub services it owns, verifies both health
  identities, stores the GameHub result ledger under local application data,
  and opens the GameHub route in the default browser.
- `steam-depot-content.json` is the explicit shipping-content contract.
  `build-steam-depot-candidate.js` copies only that contract to a new directory
  outside the Workshop, rejects forbidden paths and high-confidence secret
  patterns, and writes a hash manifest. It never uploads or marks a build live.
- `steam-depot-selftest.js` creates and removes its own temporary depot, starts
  the bundled runtime from that isolated copy, launches District Party through
  the staged GameHub, checks external application-data routing, and proves that
  play did not change the staged payload.
- `steam-shell-server.js` serves only the GameHub's approved public asset
  mounts and the GameHub API proxy. Workshop, Hub, world, profile, and asset
  authoring surfaces are unavailable. The GameHub service independently blocks
  asset proposal/accept mutations when launched in Steam distribution mode.
- The Markdown files in this directory are working worksheets. They contain no
  account credentials, tax data, banking data, or Steam guard codes.
- `VERIFICATION_RECEIPT_2026-08-16.md` records the exact scripted/live evidence,
  remaining HOLD gates, and shared-workspace boundary for this preparation run.
- `assets/draft/` contains a provenance-recorded, human-unapproved 10-image
  Steam art direction. `build-steam-art-drafts.js` recreates the exact crops,
  wordmark composites, icons, and hash manifest when the optional Sharp
  development dependency is available. Generated concept art is never counted
  as a gameplay screenshot.
- `assets/draft/candidate/screenshots/` contains five human-unapproved
  1920×1080 candidates resized from observed live game frames. The separate
  screenshot manifest records each game, local runtime route, performed
  interaction, source/candidate hashes, and the fact that the frame is not a
  generated image. `build-steam-screenshot-drafts.js` rebuilds only those
  deterministic resizes; it does not manufacture gameplay.

The browser launch path is useful TEST infrastructure, not final presentation
approval. A native window wrapper or an explicit human decision to ship the
browser shell remains a required gate.

## Local commands

```powershell
node tools/game-hub/steam/steam-readiness-selftest.js
node tools/game-hub/steam/steam-art-draft-selftest.js
node tools/game-hub/steam/steam-screenshot-draft-selftest.js
node tools/game-hub/steam/steam-depot-selftest.js
node tools/game-hub/steam/steam-readiness.js
node tools/game-hub/steam/steam-readiness.js --json
node tools/game-hub/steam/start-steam-gamehub.js --no-open --exit-after-ready
```

To prepare a reviewable depot without placing it in the repository:

```powershell
$depotRoot = Join-Path $env:TEMP ('axm-steam-depot-' + [guid]::NewGuid().ToString('N'))
$candidate = Join-Path $depotRoot 'candidate'
New-Item -ItemType Directory -Path $candidate | Out-Null
node tools/game-hub/steam/build-steam-depot-candidate.js --output $candidate
node tools/game-hub/steam/build-steam-depot-candidate.js --verify $candidate
```

The output must be new or empty and outside the source workspace. Review its
`AXM_STEAM_DEPOT_MANIFEST.json` before using the SteamPipe examples. Do not put
credentials, payment data, Steam Guard codes, or `steam_appid.txt` into it.

`steam-readiness.js --strict` exits non-zero until every required release gate
passes. The ordinary audit exits non-zero only for a broken plan or regression,
so it can remain useful during preparation.

## Tuesday start

Use [TUESDAY_ONBOARDING.md](TUESDAY_ONBOARDING.md). After Steamworks assigns the
App ID and Depot ID, record only those non-secret numeric IDs in
`steam-product-plan.json`. Keep the legal entity, address, tax, bank, payment,
and personal account details inside Steamworks; do not commit them here.

Use [steamworks/README.md](steamworks/README.md) only after those non-secret IDs
exist and a human has selected the exact candidate hash to upload.

## Current official references

Policy and dimensions were checked on 16 August 2026:

- [Steam Direct onboarding, fee, and waiting period](https://partner.steamgames.com/steamdirect/)
- [Steam release process](https://partner.steamgames.com/doc/store/releasing)
- [Steam review process](https://partner.steamgames.com/doc/store/review_process)
- [Coming Soon requirements](https://partner.steamgames.com/doc/store/coming_soon)
- [Content and generative-AI survey](https://partner.steamgames.com/doc/gettingstarted/contentsurvey)
- [Current graphical asset dimensions](https://partner.steamgames.com/doc/store/assets)
- [Graphical asset rules](https://partner.steamgames.com/doc/store/assets/rules)
- [SteamPipe upload and launch options](https://partner.steamgames.com/doc/sdk/uploading)
