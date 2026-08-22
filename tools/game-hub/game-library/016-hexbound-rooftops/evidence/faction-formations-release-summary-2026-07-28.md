# Faction Formations release summary

Session: `faction-formations-release-2026-07-28`  
Release: `0.15.0-faction-formations`  
Manifest SHA-256: `9cfc08ec19f573c621bd8f9e423ca193f0396d90ab7aad9e13b9e7dd88d535f7`

## Outcome

All eight factions now field a readable core army architecture without changing the macro simulation. Eight faction kits combine with four core role contracts to produce **32 deterministic visual variants**. Clockwork uses copper `XII` picket standards and cog caps; Boo uses notched `FILE` banners and spectral file hoods; Moonwake uses long `MOON` pennants and tricorns; Thorn uses `CROWN` gonfalons and briar crowns; Graveyard uses square `III` union standards and skull helms; Lantern uses double-tailed `WIN` civic banners and window helmets; the Mob uses ragged `!` flags and patch caps; Temporal uses split `T+1` standards, hourglass visors, and offset echoes.

The four ordinary roles stay readable at army scale. Mobs press in a wedge, Hexbows stand in firing ranks, Brooms use a loose diamond, and Lanterns form a compact glowing wall. A squad remains one selectable logical object even though its fighters carry the treatment. Signature regiments keep their existing specialized identities.

This is presentation-only. Exact core members, Glow, Scrap, training time, speed, range, damage, durability, and sight values are locked in the new regression suite. No worker, resource chore, individual-fighter command, direct routine building attack, siege unit, co-op command, or protocol version was added.

## Verification

- Runtime syntax: **5/5 PASS**.
- New focused faction-formation suite: **5/5 PASS**.
- Deterministic, HTTP, and relay suite: **61/61 PASS**.
- Package release contract: **69/69 PASS**.
- Final product/evidence JSON matrix: **20/20 PASS**.
- Static/runtime contract: a freshly instantiated test server reports `0.15.0-faction-formations`, 8 kits, 4 role silhouettes, 32 visual variants, and balance-neutral presentation.
- Live visual matrix: **8/8 factions PASS** at 1280x720 on Rooftops at the End of Tuesday, Mildly Inconvenient, auto-scout disabled, one completed Lantern formation, five selected squads, matched zoom, and one shared army move. Selected frames and digests are in `evidence/faction-formations-visual-receipt-2026-07-28.json`.
- Browser warning/error log: empty.
- Rolling capture was unavailable; repeated stills and semantic state prove composition and appearance, while exact sub-frame motion cadence remains **UNKNOWN**.

## Decisions preserved

- Faction identity is data-driven through `FORMATION_KITS`; role identity is data-driven through `FORMATION_ROLES`.
- The 8×4 combination is derived, not hand-coded as 32 balance objects.
- Formation presentation returns `null` for signature or unknown units instead of erasing their established identity.
- Standards are deliberately large enough to read at macro zoom; fighter headgear supports rather than replaces the banner signal.
- Role geometry changes rendering positions only. Simulation position, selection, pathing, attack, and casualty logic remain squad-level.
- The no-workers/no-routine-siege contract remains explicit in the manifest and package checks.
- `hexbound.coop-command/v2` remains unchanged because this release adds no semantic order.

## Open seams

Five factions still lack a mechanically distinct ordinary-district conversion. The four core unit families and their balance remain shared even though their faction presentation is no longer generic. There is no complete upgrade/technology-age tree, synchronized server-authoritative world, physical-phone QA, save/replay contract, rolling-video cadence capture, or hardware performance matrix.

The local port-8816 listener is externally owned and still reports v0.14 health metadata because the environment rejected the verified restart operation and the Game Hub has no restart-only route. It served the current v0.15 static assets for the entire live matrix, and the isolated HTTP test proved the new server metadata; a process restart remains required before claiming fresh live `/health` metadata.

The environment also rejected deletion of the exact tracked temporary `evidence/visual-temp-faction-formations/clockwork-before-lantern.png`. It remains isolated as `TEMPORARY_CAPTURE`, digest `aa071b3b1ca7f0169abefcd1d0d66c1d43d958a5e5ea63ae9e3607e931a27f45`, and is not cited as promotion evidence. Cleanup must be retried only through an allowed exact-path deletion seam.

The next bounded growth route is one ordinary-district conversion for a faction that still lacks one, with unchanged ordinary economics, automatic macro value, rival parity after its Wonderworks, deterministic boundaries, and one live behavior proof. Clockwork Borough infrastructure is the leading candidate; do not widen into worker micro, routine siege, or a new co-op protocol.

The structural source digest and seal digest are recorded in the curation receipt generated from this segment.
