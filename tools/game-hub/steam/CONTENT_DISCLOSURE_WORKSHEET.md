# Steam content disclosure worksheet

Status: **TEST worksheet** · not legal advice · human answers required

Steam currently requires its Content Survey before store/build review. Valve
compares the answers with both the build and store page. This worksheet points
to likely review areas; it does not answer on behalf of the rights holder.

## Generative AI

- **Pre-generated content:** treat this as likely **yes** until every shipped
  artwork, sound, narrative, localization, and other player-visible asset has a
  source record proving otherwise. Describe the tools and the classes of
  shipped output accurately.
- **Live-generated content:** answer from the frozen shipping build. GameHub can
  expose visible AI/adapter seats, but that does not by itself prove a
  generative service ships or runs. If an external or local generative model
  can create player-visible content while the app runs, disclose it and the
  guardrails. If the shipping build contains only deterministic built-in AI,
  do not mislabel that as live generative AI.
- Preserve source and rights evidence. Valve's survey does not replace the
  promise that shipped content is legal and non-infringing.

## Simulated casino content

`007-casino-alpha` is an installed free-play casino and slot simulation. Review
the complete reachable build, screenshots, store copy, regional rating prompts,
and any gambling-related survey questions. Confirm through human inspection
that the shipping route has no real-money wagering, cash-out, purchased casino
currency, external gambling link, or hidden transaction route before making
that claim.

## Combat, harm, and mature themes

The library includes shooters, melee/combat systems, vehicle damage, strategic
warfare, enemies, player defeat, and other stylized harm. Review at least these
packages in the actual shipping build: `005`, `008`, `009`, `013`, `014`,
`015`, `016`, `018`, and `021`. Survey answers must cover all uploaded content,
including content that is not reachable from the default shelf.

## Network and player expectations

- Ordinary gameplay is local-first. Do not claim Internet multiplayer.
- Same-Wi-Fi phone control exposes a LAN server intentionally. Verify the join,
  identity, disconnect, and host boundaries on a clean network.
- Connected AI/adapter seats must remain optional and visible. Describe any
  external service, account, cost, privacy behavior, and guardrail if it is
  retained in the shipping build.

## Human sign-off record

Record only non-private decisions here after review:

- Shipping game list frozen: `NO`
- Pre-generated AI disclosure approved: `NO`
- Live-generated AI answer approved: `NO`
- Casino/gambling classification approved: `NO`
- Violence/mature-content answers approved: `NO`
- Network/privacy wording approved: `NO`
- Rights holder confirms authority for every shipped asset: `NO`
