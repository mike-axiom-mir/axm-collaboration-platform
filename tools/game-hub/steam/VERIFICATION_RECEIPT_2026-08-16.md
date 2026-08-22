# AXM Local GameHub Steam preparation receipt

Status: **TEST / HOLD**

Date: 16 August 2026

Scope: one Windows Steam application containing the AXM Local GameHub and its
installed local game library

## Implemented lane

- Added a dedicated Steam-mode presentation that keeps all 19 installed games
  in one GameHub while hiding Workshop-only worlds, authoring inbox, and Hub
  navigation.
- Added a dedicated loopback shell server. It serves only approved GameHub and
  shared presentation/profile-client assets and proxies only `/game-api`.
- Added Steam-distribution enforcement inside the GameHub service so direct LAN
  access cannot create or accept asset-authoring handoffs.
- Added the Windows launch target, machine-readable product/gate plan,
  readiness audit, SteamPipe examples, onboarding checklist, store-copy draft,
  disclosure worksheet, asset/QA matrix, and live visual receipt.
- Redirected the GameHub result ledger to the player's local application-data
  directory for this launch path.
- Added ten exact-dimension Steam art candidates derived from two
  provenance-recorded generated key-art sources plus a deterministic local
  wordmark/icon pipeline. These remain TEST and human-unapproved.
- Added five 1920×1080 screenshot candidates derived only from observed live
  game frames. A manifest records source/candidate hashes, runtime routes, and
  the interaction observed for each capture.
- Added missing license-status ledgers for Pong Duet, Pong Cross, Briarfront,
  and Living Globe. The ledgers expose unresolved generated-art, CDN,
  source-ownership, and packaging questions instead of claiming clearance.
- Added an explicit 19-game depot content contract and deterministic external
  staging builder with symlink, forbidden-path, machine-path, secret-pattern,
  per-file hash, and whole-content digest checks.
- Routed the Steam GameHub's per-game state under local application data and
  taught District Party to accept a separate storage root for its group saves.
- Removed the dead Workshop back-link from Steam mode and prevented lobby
  polling/readiness requests from racing the launch roster.
- Integrated Brace Room with the universal Xbox/Brawl gamepad profile for four
  stable local seats, visible readiness/unsupported/disconnect guidance, and
  keyboard/phone fallback. A labeled browser QA harness exercises the real
  mapping loop without claiming physical-device evidence.
- Integrated Pong Cross with the same universal profile while preserving its
  edge-relative geometry: P1/P2 use the horizontal axis and P3/P4 the vertical
  axis. Held-pad heartbeats renew the server lease, and AI/adapter/unused seats
  refuse shared-screen pad ownership.
- Migrated Bonk & Bolt from its legacy P2-only pad path to the same universal
  profile with stable P1/P2 indices, standard-only movement and combat actions,
  visible unsupported/disconnect/unassigned states, Menu pause/resume, and
  preserved keyboard/mouse fallback.
- Migrated Buddyfarm from its legacy one-pad-to-P2 route to the universal
  profile. Pad indices now bind ordered human seats without taking AI seats;
  A/RT preserves Action tap/hold travel, X preserves Work, View opens the map,
  Menu opens controls, and keyboard/phone fallback remains visible.

No Steam account, payment, App ID, Depot ID, upload, Valve approval, or release
action was performed or claimed.

## Scripted evidence

All repository-required commands from `AGENTS.md` passed:

- `node verify.js`: 0 failures, 38 warnings in the latest checkpoint.
- Hub, route, graft, skin, and verify-plus selftests: PASS.
- HTML script syntax: 55 PASS, 0 FAIL.
- Tool Forge package/selftests and Evidence Desk selftest: PASS.

Game and workspace evidence:

- Steam art draft selftest: PASS · 10/10 image dimensions, transparent logo,
  and five separate gameplay screenshots.
- Steam screenshot draft selftest: PASS · five live-game frames, 1920×1080,
  hashes and interactions recorded.
- Steam shell, shell-server, and readiness selftests: PASS.
- Steam depot selftest: PASS · 777 current staged files · 19 games · isolated
  staged launch · external state/result routes · unchanged content digest ·
  exact temporary cleanup.
- `npm run test:workspaces`: PASS.
- Game package verifier: 19 folders, 0 failures, 37 preserved warnings. Brace
  Room, Pong Cross, Bonk & Bolt and Buddyfarm missing-gamepad-mapping warnings
  are closed; their physical controller gates remain pending.
- Bonk & Bolt: 138 package checks, 253 systems checks, 25 visual-polish checks
  and all 31 Node tests passed after the controller and concurrent low-poly
  visual lanes settled together.
- Buddyfarm: playtest-recovery and preserved low-poly Three.js selftests passed,
  plus 7 universal-gamepad tests covering mapping, edges, refusal and runtime
  evidence boundaries.
- District Party: 225 focused Node tests passed. Its optional Playwright browser-smoke
  test remained UNRUN because that optional package was unavailable.
- Latest concurrently edited Lumenwake selftest and balance selftest: PASS;
  HTML compilation remained 55 PASS.
- `git diff --check` on the two touched tracked seams: no whitespace errors;
  Git reported only the repository's LF-to-CRLF checkout warning.
- During construction, the first screenshot-manifest selftest used the wrong
  base directory for raw-frame hashes, and the first post-ledger readiness
  selftest still expected fewer than 19 rights ledgers. Both assertions were
  corrected to match the evidence contract and their final reruns passed.

## Isolated depot evidence

- A fresh candidate outside the Workshop contained 19 games, 764 declared
  files, and 159,142,693 payload bytes. Its content SHA-256 was
  `2485ea92ae807c00e45a013e5eb37cb4168301fa49f5058c274ececda13714b6`.
- The safety scan and a separate manifest verification passed before launch.
- The bundled staged runtime started the dedicated Steam shell and GameHub.
  District Party started through the staged service; its nine-slot save route
  and external data-root configuration were observed. The repeatable selftest
  then ended the session, verified the external result ledger and unchanged
  payload digest, and removed its exact temporary tree.
- A direct browser journey showed the TEST notice, 19 games, no worlds, and no
  dead Workshop exit. Bonk & Bolt entered active Human/Panzer play, accepted
  keyboard movement, and restored the saved Kettlewick world in the corrected
  candidate.
- An earlier staged journey reproduced a ready/launch synchronization race.
  The corrected candidate kept launch/polling behind the readiness boundary
  and reached `ROOM AXM1 · LIVE` immediately after confirmation.
- The final candidate verified again at the same hash after play. This is local
  TEST evidence, not a Steam-client install or approved shipping build.

## Live evidence

- The real Steam launch target started the dedicated shell and GameHub service,
  identified both health endpoints, and rendered `AXM Local GameHub` at
  `ONLINE · 19 GAMES` with a visible TEST notice.
- The Steam selector contained 19 game options and zero world options.
- Workshop Hub, root server file, and profile routes returned 404. Asset
  authoring returned 403 through both the shell and direct GameHub port.
- One earlier bounded District Party journey reached active play, recovered
  from a full-map overlay, and carried one named controller ACTION to the
  authoritative shared screen.
- Brace Room's labeled simulated-standard-pad route reached active play through
  A, moved P1 from x=237.307 to x=443.961 through left-stick-right, paused and
  resumed through Menu, surfaced a non-standard mapping, restored fallback on
  disconnect, and replayed through A. This is browser-integration evidence,
  not a physical-controller pass.
- Pong Cross's labeled two-pad route moved horizontal P1 x=500→848 and vertical
  P3 y=500→848, held both leases beyond 2.5 seconds, reached a visible outcome,
  rematched and fired power through A, paused/resumed through Menu, restored
  disconnect fallback, and refused P3 pad ownership when P3 was Host AI.
- Bonk & Bolt's labeled two-pad route moved P1 x=0.000→4.348 and independently
  moved P2 x=2.000→-2.302. Both seats attacked through A, while P1 entered dodge
  through B and special impact through X. Menu paused/resumed, unsupported and
  disconnect states restored keyboard fallback, and a solo route left pad 2
  visibly unassigned instead of taking another seat. The query-free route hid
  the harness, its controller guide rendered without clipping, and browser logs
  were empty.
- Buddyfarm's labeled two-pad route moved P1 x=18→22 and independently moved P2
  x=19→14. X prepared a field tile, A tap stayed contextual, a 260 ms A hold
  entered Buddy House, View opened the full map, and Menu opened/closed the
  readable controls guide. Non-standard P1, an unassigned third pad and full
  disconnect remained visible with keyboard/phone fallback. The query-free
  route hid the harness and browser logs were empty.
- Five live runtimes were captured after entering actual play: Pong Duet's
  active Shattered Line chapter, District Party's Party House mission board,
  Living Globe's running world with Palace stewardship controls, Bonk & Bolt's
  3D Kettlewick adventure, and Hexbound's running rooftop skirmish with an
  active map anomaly and rival scheme.
- All five candidate frames were visually inspected after their deterministic
  1920×1080 resize. They are draft evidence, not final-store approval.
- Physical phone portrait behavior, clean-machine Steam install, Steam-client
  handoff, and library-wide hardware QA remain unproved.
- Pong Cross verification port 18813 was closed after the labeled simulation.
- Bonk & Bolt verification port 18814 was closed after the labeled simulation.
- Temporary ports 8789 and 8790 were closed after verification.
- Isolated depot ports 18889, 18890, and 8814 were also closed; four generated
  depot trees were removed from the system temporary directory after their
  manifests and receipts were recorded. Those disposable copies are not
  recoverable, but the staging builder and content contract reproduce them.

## Open release gates

The readiness verdict remains **HOLD**:

- 0 of 10 final Steam images and 0 of 5 final gameplay screenshots exist. The
  separate draft lane now passes 10/10 graphics and 5/5 gameplay screenshots.
- Standardized rights evidence now exists for 19 of 19 packages with a REVIEW
  verdict. This is an inventory result, not a legal conclusion; the new
  ledgers deliberately preserve unresolved blockers.
- 0 of 19 human/Valve gates are signed off.
- Release track, exact shipping game list, pricing, content survey, AI/casino/
  violence disclosures, clean Windows install, physical controls, store
  review, build review, Coming Soon period, and final human release decision
  remain open.

If the fee is paid Tuesday, 18 August 2026, the conditional earliest date from
the 30-day waiting rule alone is 17 September 2026. It is not a promised
release date.

## Shared-workspace note

The branch and worktree were already heavily modified. This task used
`tools/game-hub/steam/` as its owned lane and made narrow additive edits to
`tools/game-hub/index.html`, `tools/game-hub/game-night.js`, and
`tools/game-hub/game-hub-server.js`. Concurrent work was observed in game
packages 004, 005, 006, 009, and 014; it was preserved. In particular, 009 and
014 changed between isolated candidate builds, so only the exact recorded hash
identifies the live-tested snapshot. Package 011 was active while the quiet 003
lane was selected and was left untouched. The final scoped 003 snapshot found
0 active files, 0 active shared seams, and 0 cautions. The broader workspace may
remain globally moving; no foreign package change was reverted or overwritten
by the Steam lane.

During the later Bonk & Bolt checkpoint, its concurrent low-poly visual pass
settled and passed alongside the controller lane. Mirrorshift 015 and Small Odds
017 then resumed their own runtime edits during successive 774-file depot
rebuilds. Each isolated candidate was internally stable through launch, but its
content hash described only that exact moving-workspace snapshot; no final
shipping hash is claimed. Those foreign edits were preserved, and the readiness
verdict remained HOLD at 19 games, 0 structural failures and 37 warnings after
Buddyfarm's migration. The current isolated 777-file checkpoint produced digest
`06b7526904a790b9a5e5101a9c2bd60827e73a3be4a0ed356e685b81f2bb4468`;
it is verification evidence, not a final shipping hash.
