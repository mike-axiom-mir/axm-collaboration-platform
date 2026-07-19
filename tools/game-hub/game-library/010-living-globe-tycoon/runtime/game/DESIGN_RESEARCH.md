# Design research — casual stewardship and a living island

Date checked: 2026-07-18

This note records design analysis, not an asset or text source. v0.10 remains an independent local experiment with original code, typed-economy, tropical-food-web, Palace-errand, shared-infographic and captured-emergence rules, player-seat/co-op systems, characters, jokes and procedural shapes.

## What the Tropico comparison suggests

Official descriptions of Tropico 6 emphasize archipelagos, transport links, citizen needs, political turmoil, election speeches and a humorous dictator fantasy. Tropico 7’s official materials add a faction council, edicts whose availability or consequences depend on political standing, elections and stronger building synergies.

Sources:

- [Tropico 6 — Kalypso Media](https://www.kalypsomedia.com/product-page/tropico-6)
- [Tropico 6 — Steam](https://store.steampowered.com/app/492720/Tropico_6/)
- [Tropico 7 — Steam](https://store.steampowered.com/app/1853440/Tropico_7/)
- [Tropico 7 FAQ — Kalypso Media](https://www.kalypsomedia.com/post/tropico-7-faq)
- [Tropico 7 announcement — Kalypso Media Japan](https://kalypsomedia.co.jp/news/2025-0821/)

The useful lesson is not “add more meters.” It is to give systems a face and a punchline:

- a cabinet voice turns evidence into a memorable prompt;
- factions create understandable pressure without collapsing politics into one victory score;
- edicts make short-term tradeoffs feel like characterful decisions;
- elections provide pacing and consequence without requiring a harsh fail screen;
- state-led dilemmas turn interacting systems into small stories;
- readable headlines make the world’s response noticeable.

v0.10 therefore keeps detailed evidence collapsible. Its default loop is optional Palace errand → five-card shared Brief → one dilemma → optional edict → explicit quarter. Product chains, food-web evidence, captured-pattern evidence, economy books and the AI command audit stay underneath the casual surface.

## What island ecology suggests

NOAA habitat material describes connected mangrove, seagrass and reef systems as nursery areas, water-quality support and shoreline protection. The supplied globe has a freshwater lake, not an ocean, so this build does not pretend it has coral reefs, mangroves, sea turtles or a marine port ecosystem. It translates only the defensible relationship pattern into a lake/reed wetland: sheltered edge habitat supports fish and frogs, filters water and helps absorb runoff.

NOAA’s invasive-lionfish material shows how an introduced predator can alter a food web. FAO material on small-island biodiversity highlights high endemism and vulnerability, including invasive-species pressure associated with transport and trade. v0.10 retains the bounded, fictional interaction widened in v0.8: introduced mesopredators benefit from settlement/road access, available prey and open-dock policy, while native ground life declines under higher predation pressure.

Sources:

- [Florida Keys habitats — NOAA](https://floridakeys.noaa.gov/blueprint/habitats.html)
- [Manell-Geus habitat focus area — NOAA](https://www.habitatblueprint.noaa.gov/habitat-focus-areas/manell-geus-guam/)
- [Impacts of invasive lionfish — NOAA Fisheries](https://www.fisheries.noaa.gov/southeast/ecosystems/impacts-invasive-lionfish)
- [Small-island biodiversity and invasive species — FAO](https://www.fao.org/4/y5203e/y5203e02.htm)

Implemented relationship map:

| Habitat or guild | Declared game relationship | Steward lever |
|---|---|---|
| Flower meadow / farm mosaic | Pollinators raise crop yield | flower corridors, palace garden, buffers |
| Woodland / settlement edge | Bats reduce insect pressure when routes and roosts remain | buffers, fewer fragmenting roads |
| Lake / reed wetland | Water quality changes fish and frog capacity; fish support wading birds | reed habitat, water works, wetland buffers |
| Woodland / meadow ground life | Introduced predators suppress native herbivores | humane biosecurity, conservation edict |
| Connected habitats | Roads reduce connectivity; buffers partially restore it | route review, ecological buffers |
| Settlements and trade | Open docks raise funds/materials but add pollution and invasive risk | temporary edict with visible expiry |

## Realism boundary

The model seeks ecological legibility, not numerical scientific realism. Species values are small-world population/guild indices. Habitat quality and connectivity are 0–100 gameplay measures. Recolonization prevents permanent dead-world states and is declared. Existing visible hares and foxes are labeled proxies rather than being falsely renamed as exact island species.

The comedy also has a boundary: it punches up at palace ego, paperwork and official certainty. It does not caricature real island peoples, accents, religions, ethnicities or political movements.

## Originality and affiliation

Tropico is referenced only for comparative design analysis. This package is unaffiliated with Tropico, Kalypso Media or Limbic Entertainment. No Tropico source code, assets, music, UI, characters, dialogue or copied game text are included.
