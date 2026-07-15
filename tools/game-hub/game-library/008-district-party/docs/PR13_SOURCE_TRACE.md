# PR 13 source trace — AXM District Party

Status: **VERIFIED READ-ONLY SOURCE TRACE**  
Inspected: 2026-07-13 (Europe/Amsterdam)  
Repository: `mike-axiom-mir/axm-collaboration-platform`  
Pull request: **#13 — Stage consolidated AXM workspaces for next milestone**  
PR state at inspection: **OPEN · DRAFT · NOT MERGED**  
PR head branch: `agent/axm-consolidated-workspaces-next`  
PR head SHA used: **`33a87549259d8b4a7ce4753ee1fab49e0ee8091d`**  
Base: `main` at `cda6b0629968cd7f276283ad7362cfdafb64926e`

Every content claim below was checked against the exact PR head SHA through read-only GitHub connector file reads. No repository checkout was created. No GitHub mutation tool was called.

## Important scope note

PR 13 contains one commit and 203 changed files. Of the requested Game Hub paths, `tools/game-hub/index.html` appears in PR 13's changed-file list. The other requested paths are present at the PR head but were inherited unchanged from its base. This trace describes the **complete tree at the live PR head**, not only the PR diff.

GitHub's repository-search connector returned zero results for all 13 requested literal searches and cannot be pinned to a commit ref. That search result is therefore **not used as absence evidence**. Exact-SHA file reads are the authority here; they directly verify nearly all requested seams.

## Requested file inventory

| Requested path | At PR head | Blob SHA | Relevant evidence | PR 13 changed-file list |
|---|---:|---|---|---:|
| `tools/game-hub/index.html` | VERIFIED | `ddf0ad6140c29b8847460a5588b7c49579189c14` | Lines 20–75; inline `loadParty`, `buildSeats`, `renderQueue`, `submitParty`, `launch`, `qrInto`, `showJoin`, `openScreen` | YES |
| `tools/game-hub/axm-foundation.js` | VERIFIED | `7f4ac73ac8712c651888279f681c4d17873996fb` | Header identifies browser foundation bundle v1.4.1: local store, wisdom, identity, connection, gate, friction, tool and orchestrator pieces | NO |
| `tools/game-hub/game-hub-server.js` | VERIFIED | `f0a279f34137028e08792e1f9206ee2a5066c8dc` | `startGameRuntime` lines 75–119; `/game/start` and response lines 217–265; `/input` and `/game/end` lines 267–278 | NO |
| `tools/game-hub/game-engine/engine-core.js` | VERIFIED | `34838a6706ac4788ea096d9614537a13072fb305` | Constants and state lines 1–64; seat/selection/session lines 73–169; input/tick/end lines 171–222 | NO |
| `tools/game-hub/game-engine/ENGINE_DEFAULTS.json` | VERIFIED | `d417d325d364dd2db16e0b0d874ce03d3244972b` | `max_lobby_seats`, `default_visible_seats`, `transport_v0`, `rules` | NO |
| `tools/game-hub/game-engine/ENGINE_STATE_TEMPLATE.json` | VERIFIED | `6cb966fa0f74f1b79944f7d4a1a003e072f53ca1` | `lobby.max_seats`, `selection.selected_players`, `input_buffer`, `rules` | NO |
| `tools/game-hub/game-library/002-robo-pong/game.manifest.json` | VERIFIED | `6194227e7f1328bdcb1abaa2ea3d0acae09a14c9` | `allowed_seat_types`, `launch.*`, `join.*`, `session.passes_seat_map` | NO |
| `tools/game-hub/game-library/003-robo-pong-cross/game.manifest.json` | VERIFIED | `125bc4b16dad962d8a37d9bc68648989be942d19` | `max_players: 4`, `allowed_seat_types`, `launch.*`, `join.*` | NO |
| `tools/game-hub/game-library/004-relaybound/game.manifest.json` | VERIFIED | `cc1df1fe33a5f868ae8572234d8540ee1783c18e` | `allowed_seat_types`, `launch.*`, `join.*`, `rules` | NO |
| `tools/game-hub/game-library/005-briarfront/game.manifest.json` | VERIFIED | `56d5e06d9e27dbcb2f2f9f3b520ea0fefe8c5730` | `max_players: 4`, `allowed_seat_types`, `launch.*`, `join.*` | NO |

Additional supporting file: `tools/game-hub/vendor/qrcode.js` exists at the same head, blob `76889b589ec831dd9b791601f6592793356ce9cd`. The Game Hub loads this local file; it does not call a remote QR service.

## Concrete seam search

| Requested seam | Exact-head evidence | Result |
|---|---|---|
| `qrcode` | `index.html` loads `vendor/qrcode.js`; `qrInto()` calls `qrcode(0,'M')`, adds the LAN URL and creates a data URL | VERIFIED |
| `controller_urls` | `game-hub-server.js` `/game/start` maps every selected player to a controller record; only `human` entries receive local/LAN URLs. `index.html` filters this array to humans | VERIFIED |
| `spectator_url` | Server returns `spectator_url: runtime.spectatorUrl`; `showJoin()` and `openScreen` consume it | VERIFIED |
| `player=screen` | All four requested game manifests define a `spectator_client_entry` using `player=screen`; 002 and 003 also include `room=AXM1` | VERIFIED |
| `openScreen` | `index.html` has the shared-screen button and a handler that opens the returned `spectator_url` with the session query | VERIFIED |
| `AXM_PLAYERS_JSON` | `startGameRuntime()` sets `AXM_PLAYERS_JSON: JSON.stringify(selectedPlayers || [])` in the child runtime environment | VERIFIED |
| `MAX_SEATS` | `engine-core.js` declares `MAX_SEATS = 8` and creates the default table with that length | VERIFIED |
| `max_lobby_seats` | `ENGINE_DEFAULTS.json` declares `max_lobby_seats: 8` | VERIFIED |
| `local_authoritative_state` | Declared true in `ENGINE_DEFAULTS.json` and `engine-core.js`; engine state, input buffer, tick and session lifecycle live in the host process | VERIFIED AS FOUNDATION DIRECTION |
| `clients_send_input_intentions` | Declared true in defaults/core; `queueInput()` accepts a seat-tagged input object into the host buffer and rejects non-playing seats | VERIFIED AS FOUNDATION DIRECTION |
| `allowed_seat_types` | All four manifests list `human`, `adapter`, `ai`; `selectPlayersByReadyOrder()` enforces the manifest list | VERIFIED |
| `game.manifest.json` | `listGames()` reads this exact filename under each game directory; all four requested manifests exist | VERIFIED |
| `room=AXM1` | Manifest launch routes and server-generated controller URLs use `AXM1`; `/game/start` returns `room_code: 'AXM1'` | VERIFIED |

Repository-search connector literal results: **0 hits for every term above**. Because exact-head reads contain the terms, the zero-hit search outcome is a connector indexing/ref limitation, not a source absence finding.

## Known source truths — claim-by-claim gate

### 1. Four visible party slots in the current Game Hub interface

- **Result:** VERIFIED.
- **Source:** `tools/game-hub/index.html`, lines 20–75: “Four seats”, `loadParty()` requires four slots, `syncSlots()` loops 0–3, and `renderQueue()` renders four labels. `engine-core.js` lines 3–7 sets `DEFAULT_VISIBLE_SEATS = 4` while retaining eight total seats.
- **Inherited by city:** keep the visible first release at seats 1–4.
- **Added locally:** city actors, Party A assignment and game-specific lobby settings. Do not replace the Hub.

### 2. Human and AI/adapter seat choices

- **Result:** VERIFIED WITH UI NUANCE.
- **Source:** `index.html` `buildSeats()` visibly offers `human` and `adapter`, with adapter labelled “AI”. `engine-core.js` `assignSeat()` separately accepts `human`, `adapter`, and `ai`. Each requested manifest allows all three.
- **Inherited by city:** preserve the exact selected type and visible identity.
- **Added locally:** normalize all three values distinctly; do not silently convert `adapter` or `ai` to `human`.

### 3. Ready-order selection

- **Result:** VERIFIED.
- **Source:** `engine-core.js` `readySeat()` assigns `ready_order`; `selectPlayersByReadyOrder()` sorts eligible seats and slices by manifest capacity. The Hub's `readyOrder` UI mirrors this direction.
- **Inherited by city:** use the Foundation-selected array/order as launch truth.
- **Added locally:** no independent competing seat-selection system.

### 4. Individual controller URLs returned after launch

- **Result:** VERIFIED.
- **Source:** `game-hub-server.js` `/game/start`, lines 217–265, creates `controllerUrls` from the full `players` array and returns `controller_urls`.
- **Inherited by city:** one URL record per selected seat; human entries get controller links, AI/adapter entries retain identity but no human link.
- **Added locally:** room/session/seat token validation and the city controller route. A selected `adapter` still receives no human URL/QR; v0.1.7 adds a non-QR semantic input binding and party-screen-bounded observation endpoint for the Workshop to consume.

### 5. Named QR codes for human controller links

- **Result:** VERIFIED.
- **Source:** `index.html` `showJoin()` filters `type === 'human'`, builds a named card from `player`, `name`, and `seat_id`; `qrInto()` encodes `lan_url` with bundled `vendor/qrcode.js`.
- **Inherited by city:** named-seat, same-private-Wi-Fi QR flow; no fake QR for AI seats.
- **Added locally:** city controller URL includes room, session and assigned seat/token.

### 6. Separate shared/spectator screen route

- **Result:** VERIFIED.
- **Source:** each manifest has `launch.spectator_client_entry`; the server returns it separately from `client_url`; `openScreen` opens it without assigning a seat.
- **Inherited by city:** screen is a non-player rendering client.
- **Added locally:** first-class `party_a`, reserved `party_b`, and `all` screen roles plus a persistent waiting receiver. These party-specific routes are not present in the inspected Hub files.

### 7. Local room code

- **Result:** VERIFIED.
- **Source:** all manifests declare `join.room_code: "AXM1"`; `/game/start` returns `room_code: 'AXM1'` and embeds `room=AXM1` in controller routes.
- **Inherited by city:** default local room `AXM1`.
- **Added locally:** validate the room and active session server-side.

### 8. Foundation with eight maximum seats

- **Result:** VERIFIED.
- **Source:** `engine-core.js` lines 3–7 declares eight max, four default-visible and four optional; `createDefaultSeatTable()` creates all eight. Both engine JSON files agree.
- **Inherited by city:** arrays, protocols and normalizer must tolerate eight selected records.
- **Added locally:** `party_a` for slots 1–4 and `party_b` for 5–8 through one central mapper.
- **Nuance:** current Hub UI submits only seats 1–4, and every requested game manifest has `max_players` 2 or 4. This is an eight-seat Foundation capacity, not evidence of tested eight-player gameplay.

### 9. Local authoritative state

- **Result:** VERIFIED AS A FOUNDATION CONTRACT, NOT AS A COMPLETE CITY SIMULATION.
- **Source:** `engine-core.js` owns the state object, session, input buffer, tick and end/reset flow. Defaults/core set `local_authoritative_state: true`.
- **Inherited by city:** host owns city truth; clients send intentions.
- **Added locally:** positions, health, vehicles, projectiles, AI, mission state, scores and damage permissions remain server-owned.

### 10. Clients send input intentions

- **Result:** VERIFIED AS A FOUNDATION CONTRACT.
- **Source:** `queueInput()` rejects non-running/non-playing seats, stamps session/seat/tick and buffers `input`; `engineTick()` consumes the buffer. Server exposes `POST /input`.
- **Inherited by city:** seat-tagged input packets and host tick loop.
- **Added locally:** stronger room/session/token validation, rate/shape checks and actor-specific application. Current generic `/input` accepts a seat ID but does not implement a session-seat token association.

### 11. Full selected-player array supplied through `AXM_PLAYERS_JSON`

- **Result:** VERIFIED.
- **Source:** `startGameRuntime()` receives `selectedPlayers` from `session.selected_players` and passes the complete array via `AXM_PLAYERS_JSON`.
- **Inherited by city:** parse this array first; retain `seat_id`, `slot`, `type`, `display_name`, `adapter_id`.
- **Added locally:** normalize to city actor IDs and party IDs without truncating to four convenience variables.

### 12. Legacy convenience names expose P1–P4

- **Result:** VERIFIED.
- **Source:** `startGameRuntime()` derives `seat1` through `seat4` and exports `AXM_P1_NAME`…`AXM_P4_NAME` in addition to the full JSON array.
- **Inherited by city:** may accept these only as backward-compatible fallbacks.
- **Added locally:** never use them to reconstruct the complete selected roster.

## Minimal compatibility contract for the local city module

The source supports a small adapter rather than a new Workshop:

1. Accept the exact selected array from `AXM_PLAYERS_JSON`.
2. Preserve `seat_id`, numeric `slot`, `type`, `display_name`, and `adapter_id`.
3. Map slot 1–4 to `party_a` and 5–8 to `party_b` in one function. The current engine internally calls these groups `team_a` and `team_b`, but `toPublicSeat()` omits `group`; the city must derive its own stable `partyId` from `slot`.
4. Continue Foundation launch-manifest semantics: local child server entry, local client entry, distinct non-seat screen entry, readiness path, fixed local port and `local_only_default`.
5. Return individual controller records and a distinct party-screen URL. Generate QR only for selected human seats.
6. Treat the screen as render-only. Route all input through server validation and the authoritative host loop.
7. On end, expose an honest result summary and return the display receiver to waiting/lobby state.

## Source gaps the local prototype must add

These were **not found in the inspected Game Hub contract** and must not be described as inherited:

- Party-specific display routes (`party_a`, `party_b`, `all`) and a persistent waiting/redirect receiver.
- A session-seat controller token/association; the generic current endpoint validates playing seat state but not a token.
- City world, multi-actor party camera, party tether, pedestrians, vehicles/passenger shooting, combat, inventory, wallets, central party-aware damage rules, safe zones, mission board/group teleport/results, Supply Sweep, Hold the Relay, Courier Chaos, voluntary chaos, Neon Rivals and forgiving justice.
- A city game manifest and actual launch from the real Game Hub.
- Physical phone connection evidence or eight-player runtime evidence.

## Honest compatibility risks carried forward

- `game-hub-server.js` labels every selection longer than two players as mode `four-player`; that name is not generic for eight seats.
- The Game Hub UI explicitly operates on four slots and four play labels. That is correct for v0.1 visibility but cannot be reused as an eight-seat simulation limit.
- Convenience environment names stop at P4. Only `AXM_PLAYERS_JSON` is roster-complete.
- `toPublicSeat()` does not include the engine's internal `group`, so party assignment must be derived from slot in the adapter.
- Existing manifests expose a spectator screen, not the requested persistent party-screen receiver.
- Current controller URLs include room/player; the Hub adds `session` client-side. The city must validate room, session, seat and token on the host.

## Read-only action record

Connector reads performed:

- `github_get_pr_info`
- `github_get_repo`
- `github_list_pr_changed_filenames`
- `github_fetch_file` at exact head SHA
- `github_search` for the 13 literal seams (all returned no indexed hits; treated as non-authoritative)
- `github_fetch_pr_file_patch` for the one requested path changed by PR 13: `tools/game-hub/index.html`

GitHub mutation calls: **NONE**  
Clone/fetch/checkout: **NONE**  
Branch/commit/push/PR update: **NONE**

This verifies that this inspection performed no GitHub write. It does not claim that no unrelated actor changed GitHub after the inspection timestamp.
