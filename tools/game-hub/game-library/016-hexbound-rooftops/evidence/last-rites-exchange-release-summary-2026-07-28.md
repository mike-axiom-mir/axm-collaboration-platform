# Last-Rites Exchange release summary

Session: `last-rites-exchange-release-2026-07-28`  
Release: `0.19.0-last-rites-exchange`  
Manifest SHA-256: `673bb60932c212ae04a3901180d346d071836014d275040c58be232deb120e21`

## Outcome

Graveyard Shift's ordinary Borough is now the **Last-Rites Exchange**, an automatic local casualty-Essence conversion that keeps the exact ordinary `Z` key, 80 Glow, 75 Scrap, four-second construction time, 560 durability, passive economy, and +80 cap contract. When a formation takes positive casualties within 520 world units, the strongest eligible completed living Exchange pays that formation's side a Wake Dividend equal to 55% of its ordinary casualty Essence.

Existing mixed-charter diversity strengthens the dividend through the capped x1.45 wonderweb to 79.75%. Buildings, malformed or zero-death events, and unfinished, destroyed, hostile, or out-of-range sources are excluded. Multiple Exchanges choose the strongest eligible dividend rather than stacking.

Normal combat and hazard casualties now share one account-aware award path. Player dividends credit shared Essence; rival dividends credit `enemyEssence`. The existing 60-Essence rival ghost audit was factored through one spending helper and can consume both Wake Dividends and Boo stipend income. Wonderwork-first rival expansion remains intact: Graveyard builds its two Wonderworks before resolving ordinary Exchange conversions.

The Exchange adds a bone-ledger, abacus, skull facade, `LAST RITES` fascia, receipt ring and floating slips, plus post-formation dark plaques for `WAKE DIVIDEND +55%` and the exact credited `LAST RITES +0.6 ESS`. Moving those plaques after formation rendering fixed the first live layering seam without changing behavior.

## Verification

- Runtime syntax: **5/5 PASS**.
- Focused faction-district suite: **18/18 PASS**.
- Full Node deterministic, HTTP, and relay suite: **70/70 PASS**.
- Package release contract: **69/69 PASS**.
- Isolated HTTP suite: **4/4 PASS**, reporting v0.19, seven conversions, 520 range, 55% dividend, mixed-charter scaling, strongest-only non-stacking, building exclusion, player/rival parity, and rival dividend spending on health and launcher surfaces.
- Live 1280x720 Mild Tuesday proof: completed inactive `LAST RITES` baseline, automatic active receipt ring and slips with `WAKE DIVIDEND +55%` and `LAST RITES +0.6 ESS`, then a settled frame with temporary cues cleared.
- Browser warning/error log: empty.
- Native image inspection confirms all three retained JPEGs are 1280x720 with distinct SHA-256 digests.
- Rolling capture was unavailable; repeated same-viewport frames prove the bounded state transition, while exact sub-frame animation cadence remains **UNKNOWN**.

## Decisions preserved

- Casualty accounting is event-driven and automatic; there is no corpse-harvest button, worker, or manual district conversion action.
- The casualty formation's side receives the dividend, preventing hostile-account leakage while allowing rival parity.
- Buildings never qualify, keeping the mechanic on formation attrition rather than routine siege or structure farming.
- Mixed charters scale strength, not range, and multiple sources use the maximum dividend rather than multiplying.
- Combat and hazard casualties share the same helper so the account boundary cannot drift between damage paths.
- Rival income is both credited and spendable; parity is not a display-only number.
- The no-workers/no-routine-siege contract and `hexbound.coop-command/v2` remain unchanged.

## Open seams

Temporal Mischief is the only faction still lacking a mechanically distinct ordinary-district conversion. The four core balance families remain shared beneath their 32 faction-role visual variants. There is no complete upgrade/technology-age tree, synchronized server-authoritative world, physical-phone QA, save/replay contract, rolling-video cadence capture, or hardware performance matrix.

The externally owned port-8816 listener is still Node PID `20208`. It serves current v0.19 static assets and its served game data contains `last-rites-exchange`, but its unrestarted in-memory `/health` and `/api/launcher-state` metadata remains v0.14 with three conversions. Fresh isolated HTTP tests prove v0.19 metadata; an allowed process restart remains required before claiming fresh live metadata.

Three current-loop temporary directories remain: `evidence/visual-temp-last-rites-v19`, `evidence/visual-temp-last-rites-v19-guard`, and `evidence/visual-temp-last-rites-v19-story`. Two exact cleanup attempts were policy-rejected, so cleanup is honestly incomplete. They are isolated and are not cited as promotion evidence. The historical non-promoted Faction Formations temporary capture at `evidence/visual-temp-faction-formations/clockwork-before-lantern.png`, digest `aa071b3b1ca7f0169abefcd1d0d66c1d43d958a5e5ea63ae9e3607e931a27f45`, also remains untouched after its earlier denied cleanup.

The next bounded growth route is Temporal Mischief's eighth ordinary-district conversion on a macro axis that does not duplicate formation tempo, strategic fog, routed movement, district repair, target coordination, formation cover, casualty Essence, or Temporal's existing doctrine/Wonderwork identity. Preserve ordinary economics, automatic low-chore value, capped non-stacking mixed-charter interaction, Wonderwork-first rival parity, and the no-new-command contract.

Structural source digest: `42f58380a10525e4ca3dd60dea4f389c80e7dabfb9cf80ad6b4a08645be198b5`.  
Structural seal file digest: `992c9971cf35b1f7620e7a07f51ee5b996e238b55f646cae87bee8ad1942e4c7`.
