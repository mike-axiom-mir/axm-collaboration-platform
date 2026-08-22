# Every-Window Assembly release summary

Session: `every-window-assembly-release-2026-07-28`  
Release: `0.18.0-every-window-assembly`  
Manifest SHA-256: `25901e8a30cb5127803c2dfbb0ee16c42ce5e987008b17fc4a015fd1013fae37`

## Outcome

Tin Lantern Republic's ordinary Borough is now the **Every-Window Assembly**, an automatic local formation-shelter conversion that keeps the exact ordinary `Z` key, 80 Glow, 75 Scrap, four-second construction time, 560 durability, passive economy, and +80 cap contract. Every thirteen seconds, a completed living Assembly with a currently visible enemy formation within 520 world units raises exactly five seconds of Civic Cover for nearby player and AI-allied formations.

Civic Cover reduces incoming formation damage by 14%. Existing mixed-charter diversity strengthens that reduction through the capped x1.45 wonderweb to 20.3%; duration and range do not expand. Buildings are never protected. Multiple active Assemblies select the strongest eligible reduction rather than stacking. Dead, distant, hostile, or invalid formations plus unfinished, destroyed, expired, and dynamically out-of-range sources are excluded.

The Assembly adds an expanded civic facade, lit windows, `ASSEMBLY` fascia, an idle window ring, active gold source ring and support arcs, polygon formation shields, `CIVIC COVER` reduction labels, and one source feed receipt. It remains distinct from the `B` Ever-Burning Council Tower: the Assembly shelters local formations under current pressure while the Wonderwork increases cap and sight. Rival Tin follows the existing Wonderwork-first expansion contract and uses Assemblies afterward.

## Verification

- Runtime syntax: **5/5 PASS**.
- Focused faction-district suite: **15/15 PASS**.
- Full Node deterministic, HTTP, and relay suite: **67/67 PASS**.
- Package release contract: **69/69 PASS**.
- Fresh isolated HTTP coverage reports `0.18.0-every-window-assembly`, six conversions, the exact 13/5/520 contract, 0.14 reduction, capped mixed-charter scaling, strongest-only non-stacking, building exclusion, AI-allied benefit, and rival conversion use on health and launcher surfaces.
- Live 1280x720 Properly Serious Tuesday proof: completed inactive `ASSEMBLY` baseline, automatic active cue with one gold source ring, four polygon shields, four `CIVIC COVER 14%` labels, and one four-formation feed receipt, then a settled frame with temporary cover cues cleared.
- Browser warning/error log: empty.
- Native image inspection confirms all three retained JPEGs are 1280x720 with distinct SHA-256 digests.
- Rolling capture was unavailable; repeated same-viewport frames prove the bounded state transition, while exact sub-frame animation cadence remains **UNKNOWN**.

## Decisions preserved

- The Assembly checks current visibility automatically; it adds no manual cover or conversion command and does not bypass fog.
- Only formations are protected, so the mechanic cannot become routine building fortification or siege denial.
- A target must still be within a completed living source's local range when damage resolves; stale pulse membership cannot preserve the reduction.
- Mixed charters scale strength, not duration or range, and multiple sources use the maximum reduction rather than multiplying.
- Player and team-1 AI formations share the reduction, preserving strong-co-op alliance semantics without a protocol change.
- Rival parity comes from the existing faction conversion resolver after Wonderworks, not a special AI-only rule.
- The no-workers/no-routine-siege contract and `hexbound.coop-command/v2` remain unchanged.

## Open seams

Graveyard Shift and Temporal Mischief still lack mechanically distinct ordinary-district conversions. The four core balance families remain shared beneath their 32 faction-role visual variants. There is no complete upgrade/technology-age tree, synchronized server-authoritative world, physical-phone QA, save/replay contract, rolling-video cadence capture, or hardware performance matrix.

The externally owned port-8816 listener is still Node PID `20208`. It serves current v0.18 static assets and the served game data contains `every-window-assembly`, but its in-memory `/health` and `/api/launcher-state` metadata remains v0.14 with three conversions. The environment previously rejected the exact verified restart and the Game Hub exposes no restart-only route. Fresh isolated HTTP tests prove v0.18 metadata; a permitted process restart remains required before claiming fresh live metadata.

One historical non-promoted Faction Formations temporary capture remains at `evidence/visual-temp-faction-formations/clockwork-before-lantern.png`, digest `aa071b3b1ca7f0169abefcd1d0d66c1d43d958a5e5ea63ae9e3607e931a27f45`, because its exact deletion was previously rejected. This session did not broaden or retry that deletion. No current-loop temporary capture remains; the three selected proof frames are intentional retention exceptions.

The next bounded growth route is a seventh ordinary-district conversion for Graveyard Shift or Temporal Mischief on a macro axis that does not duplicate formation tempo, strategic fog, routed movement, district repair, target coordination, formation cover, or either faction's existing doctrine/Wonderwork identity. Preserve ordinary economics, automatic value, capped non-stacking mixed-charter interaction, Wonderwork-first rival parity, and the no-new-command contract.

Structural source digest: `4b4779b5f7c108120bed2635b0110d347886e03f7d5ded7354bb0c184bdbe682`.  
Structural seal file digest: `3e513cb69c146f16b6b22a39d440dad13ba5e2b3f19c5560a979b53a2d85667f`.
