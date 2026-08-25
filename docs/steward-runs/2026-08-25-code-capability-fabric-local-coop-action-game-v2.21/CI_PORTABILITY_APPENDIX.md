# Steward-run appendix — cross-host city projection repair

Status: `TEST` follow-up; candidate game bytes unchanged

Technical repair commit: `ddef61f0242d08aa698a1cd23b75a10314d566fe`

## Observed contradiction

The first PR 71 `city-map` run failed. The same generated views passed locally but GitHub computed different city projection digests. This was not relabelled as a harmless CI problem.

Root cause: city projection sorting inherited the host's default locale. The Windows steward host resolved `String.localeCompare` as `en-GB`; the Ubuntu GitHub runner resolved it as `en-US`. The newly added hyphenated capability identifiers made that latent difference observable.

## Repair

- Pinned city-map host and pure-core ordering to explicit `en-US` collation.
- Rebuilt the existing city, schema, and twin projections from the repaired deterministic boundary.
- Did not change the game recipe, generated candidate packet, or final `game.js` bytes.

## Post-repair local evidence

- city-map selftest: `33` assertions PASS;
- city generated-view check: PASS, graph `5bad180d70d39dc397b9f1a8f332df7ddc886cc87b803371feb158e628569722`;
- schema generated-view check: PASS, registry `b6d003f1dc75742bcefef2748367e9061973ee8a637f8bd179d14be96208953c`;
- twin generated-view check: PASS, twin `dac4d53133f8ee9c0d3d40b87f58853735eed18a991fd7d91277418a6de9a927`;
- all ten required `AGENTS.md` commands rerun after the repair: PASS / `VERIFIED_WITH_LIMITS`;
- `verify.js`: `0 FAIL · 25 warn`, spine `b618c5762240070c`.

The browser game journey was not repeated because the candidate and its game script remained byte-identical. The prior exact output evidence still binds to `game.js` SHA-256 `f38402c41637cf94371cfe76e6d21ce4fffa466b9f8c469959f7a855f2f38799`.

## Authority boundary

This repair only makes a read-only derived registry deterministic across the two observed hosts. It grants no candidate execution, installation, integration, publication, promotion, learning, or CANON authority.
