# Known limits — Circuitseed v0.2.0 director's cut alpha candidate

## Status gate

- **ALPHA CANDIDATE / WORKING:** fresh 1280x720 local browser evidence now covers the title, Lumen Yard entry/movement/scan, journey menu/resume, and the reversible blocker set. It does not cover every region, the complete codex/evolution/shop/order flows, Hub lobby/result pixels, controller/disconnect presentation, physical devices, or a complete human playthrough, so no broader label or canon claim is made.
- **UNVERIFIED PLAY DURATION:** the chapter has ten integrated authored stages and replay paths, but the 60–120 minute first-play target has not been timed with a human or traversed through rendered browser play in this environment.
- **NOT PRODUCTION-READY:** no security, performance, device, accessibility or balance certification is claimed.

## Presentation and devices

- **PARTIAL — rendered browser pass:** `evidence/2026-08-16-low-poly-three-pass-01/VISUAL_RECEIPT.md` and `evidence/2026-08-16-blocking-overlay-escape/RECEIPT.md` provide local 1280x720 pixels and typed interaction observations for the bounded paths above. Relayborn, Threadwild, Corewild, full inventory/journal/Signal Board, complete profile import/export/conflict, Hub lobby/result, controller/disconnect, responsive and physical-device journeys remain unobserved.
- **UNTESTED — physical phone controller:** touch/pointer math and HTTP packets are automated; handset comfort, Wi-Fi latency and safe-area layout need a phone.
- **UNTESTED — eight physical people/devices:** one-to-eight layouts and local multi-client semantics are automated. Eight simultaneous physical controllers are not.
- **UNTESTED — Windows batch/firewall flow:** the retained browser receipts did not exercise the batch or firewall path.
- **PARTIAL — audio:** procedural cues and ambience exist; subjective mix, accessibility and long-session comfort are untested.
- **NO QR YET:** the controller link is shown as a local URL. The manifest reports QR support false.
- **MANAGED RETURN ENDS THE CHILD:** returning a result to the Game Hub intentionally stops port 8799. The launch helper must be run again for another managed session.

## Content and balance

- **PARTIAL — authored chapter depth:** the ten-stage chapter, ten Memory Echoes, sixteen optional Field Requests, and expanded item/trade loop connect, but dialogue density, route pacing, encounter tuning, and human reward cadence remain early.
- **PARTIAL — procedural variation:** seed, conditions, modifier, demand and state-derived mission vary. The authored map bones do not regenerate.
- **PARTIAL — Circuitkin presentation:** 30 distinct designs, a status-aware Field Codex, 20 individual/10 Confluence progression, active-companion choice, growth cards, design-specific procedural emblems, deterministic field geometry, and dual-core specialist forms exist. Only the active companion receives live field rendering; bespoke animation sets, illustrated portrait galleries, and physical-device visual inspection remain future work.
- **UNTESTED — collection/evolution balance:** automated tests prove that one profile can connect all 20 individuals and evolve all 10 specialists without consuming parents. Human discovery pacing, trust thresholds, route readability, and specialist power balance still need local play.
- **PARTIAL — tactical simulation:** original actions, support roles, recovery and friendly 1v1/2v2 logic work. Human competitive balance is untested.
- **UNTESTED — archive/request pacing:** automated tests prove ten unique scan-derived echoes, recipe/keepsake grants, sixteen profile-derived requests, one-time claims, and portable receipts. Human discoverability, emotional pacing, and reward balance are untested.
- **PARTIAL — business:** three paths, ten recipes, nine orders, demand, reputation, live missing-input guidance, and safe open/closed state work. There is no central economy or public market.

## Integration

- **LOCAL GAME HUB EXTENSION:** the older active Workshop lacked PR #14's managed child lifecycle and package verifier. This build adds the exact PR #14 verifier and a narrow backed-up lifecycle extension. It does not import or merge PR #14.
- **UNTESTED — real connected Workshop AI:** simulated adapter packets prove the same gate and observation boundary. No actual local/cloud AI consumed the binding here.
- **SEMANTIC OBSERVATION:** adapter vision is bounded structured screen semantics, not pixels or video.
- **NO LIVING GLOBE INTEGRATION:** documentation only.
- **NO MIRROR LIVE LOOP:** documentation only; controller traffic never enters Mirror.
- **NO FULL ROUTER:** the portable game-local contract and import/export seam exist; account/permission/community infrastructure does not.

## Local threat model

- The game is for a trusted local machine/private LAN, not public hosting.
- Local HTTP has no TLS and the server is not an internet authentication product.
- The render-only party route is intentionally viewable on the trusted local runtime.
- The host screen receives participant bindings so it can present phone links. A connected adapter must receive only its own binding.
