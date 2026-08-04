# Faction Wonderworks release summary

Session: `faction-wonderworks-release-2026-07-28`  
Release: `0.11.0-faction-wonderworks`  
Manifest SHA-256: `7652004db51b298f27986db447e096140c62b923a3ced9bc5be14a4dc1f29062`

## Outcome

HEXBOUND now gives all eight factions one exclusive two-per-player Wonderwork. Every landmark has a different canvas silhouette and an automatic macro effect; all reuse explored rooftop anchors, inherit the active district charter, and strengthen through mixed-charter wonderweb spread. They add no worker loop and no siege production.

The Commander can commission the active faction Wonderwork from the fifth Expand card or `B`. The rival's forward-expansion scheme establishes its own faction landmark. The human Quartermaster now has a third exact-roof order, **Commission Wonderwork**, with shared-resource payment and match-scoped applied/rejected receipts.

## Verification

- Runtime syntax: 5/5 PASS.
- Deterministic, HTTP, and relay tests: 47/47 PASS.
- Package release contract: 62/62 PASS.
- Live Commander: Shift-Bell Foundry card showed `0/2`, `B`, `145/155`, and its queue/construction pulse contract.
- Live Quartermaster: Minute Market commission returned `#1 APPLIED` and named Shift-Bell Foundry.
- Bounded relay state: `a10` player Wonderwork and `a8` enemy Wonderwork persisted after the match.
- Browser warnings/errors: 0/0 across Commander and Quartermaster proof tabs.

Selected proof frames:

- `evidence/live-wonderworks-commander-2026-07-28.png`
- `evidence/live-wonderworks-quartermaster-2026-07-28.png`

## Decisions preserved

- Limit Wonderworks to two per faction so the macro effects reward spreading without becoming a compulsory all-map spam layer.
- Let charter diversity accelerate or magnify Wonderworks, tying faction identity to the existing expansion web.
- Give the rival the same landmark identity through its readable forward-expansion scheme.
- Preserve `hexbound.coop-command/v2`; add one bounded semantic target value rather than widening the relay into raw world mutation.

## Open seams

The four ordinary district families and four core squad silhouettes are still shared. There is no complete upgrade/technology-age tree, server-authoritative shared world, physical-phone QA, replay/save contract, or hardware performance matrix. The persistent stewardship goal remains active.

The structural seal and segment digest are recorded in `session-faction-wonderworks-release-2026-07-28.seal.json`.
