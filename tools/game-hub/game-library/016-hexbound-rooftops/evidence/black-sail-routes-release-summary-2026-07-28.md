# Black-Sail Anchorage route release summary

Session: `black-sail-routes-release-2026-07-28`  
Release: `0.13.0-black-sail-routes`  
Manifest SHA-256: `bb1d8226efe1de636d3644de319a52d08cbfabddcde8c575da4f196ed0ff7b8e`

## Outcome

Moonwake Corsairs now convert their ordinary Moon Moot into the **Black-Sail Anchorage** at the unchanged 95 Glow, 110 Scrap, 4.8-second construction time, 650 durability, and `X` role key. Completed Anchorages automatically accelerate nearby allied formations that are already following a macro route. The base multiplier is x1.16; mixed nearby charters scale it through the existing bounded wonderweb to x1.232.

The route support is local, same-team, completed-source, living-source, route-only, and non-stacking. Idle, enemy, distant, unfinished, and destroyed cases receive no bonus. Rival Moonwake expansion retains the Wonderwork-first contract and then uses ordinary Anchorages for later forward districts.

The battlefield renders a Moonwake mast, sail, anchor, and `ANCHORAGE` label, then draws a local ring, purple formation arcs, a `SAIL LANE` multiplier, and one formation-level feed receipt while the effect is active. The first live pass exposed repeated per-squad receipts; source-level gating fixed that visual/attention seam before promotion.

## Verification

- Runtime syntax: **5/5 PASS**.
- Deterministic, HTTP, and relay suite: **53/53 PASS**.
- Package release contract: **66/66 PASS**.
- Product JSON release matrix: **7/7 PASS** after seal and curation receipt parsing.
- Fresh restarted health and launcher: `0.13.0-black-sail-routes`, two conversions, Black-Sail route support, Briar Mend, rival conversion use, unchanged browser-host/server-relay authority, and `hexbound.coop-command/v2`.
- Live build: the ordinary card charged 95/110, completed under Pumpkin Night Market, and rendered the distinct conversion silhouette in `evidence/live-black-sail-anchorage-complete-2026-07-28.jpg`.
- Live behavior: four nearby Moonwake crews received one shared two-hop route; the feed emitted one Anchorage receipt and the canvas rendered purple route arcs plus `SAIL LANE x1.16` in `evidence/live-black-sail-route-lane-2026-07-28.jpg`.
- Browser warning/error log: empty.
- Rolling capture was unavailable; exact continuous movement cadence remains **UNKNOWN**. Repeated stills plus semantic polling prove appearance and interaction, not sub-frame timing.

## Decisions preserved

- The conversion changes route tempo rather than adding a worker, production submenu, direct building attack, siege endpoint, or new per-squad command.
- Mixed-charter spread strengthens the existing automatic support instead of multiplying chores.
- Multiple Anchorages choose the strongest eligible source and do not stack.
- The four ordinary role identities remain intact; only Moonwake's Moon Moot presentation and automatic effect change.
- Rival parity is ordered honestly: faction Wonderworks remain the first expansion landmarks.
- `hexbound.coop-command/v2` remains unchanged because the browser host can apply the effect without a new Quartermaster mutation lane.

## Open seams

Six factions still lack a mechanically distinct ordinary-district conversion, and the four core squad silhouettes remain shared. There is no complete upgrade/technology-age tree, server-authoritative shared world, physical-phone QA, replay/save contract, rolling-video cadence capture, or hardware performance matrix. The persistent stewardship goal remains active.

The structural source digest is `95cdd264ae90f174212252ed42d2a786edb4c3f003689a6403a6e1bd8dfc680f`; the seal file SHA-256 is `1b074759536777431b13b77237025cf00d731e828b3a97938fd3a76328d22857`.
