# Test report — Asset-aware game prebuild v2.22

Status: branch `TEST` · candidate `EXPERIMENTAL`

Technical source commit: `eed88b8c7c616a77228852ab1be71f641b85ab2c`

## Real candidate output

- packet digest: `sha256:6cd68e9cfb308d64fed4803fa19d8addaf0b986aaf8246b5070e3e84bfc9086c`;
- iteration digest: `sha256:d1e2ee43ddd06dca7e6180a2508802aefc4fb9f3cad880f4be93680c6f7e9f7b`;
- `13` files, `103021` source bytes;
- `game.js` SHA-256: `ec6c85250ba1b7d8f744303e21f66ab6e697654d50671207fd102756b7fb0684`;
- snapshot and prebuild-plan records are candidate data, not provider code.

## Focused checks

- Asset Factory snapshot and prebuild planner: `11/11 PASS`;
- deterministic game candidate generator: `12/12 PASS`;
- local co-op recipe, engine behavior, and adversarial checks: `24/24 PASS`;
- disposable candidate sandbox: `13/13 PASS`;
- combined focused result: `60/60 PASS`.

## Required `AGENTS.md` checks

Run against technical source commit `eed88b8c…`:

| Command | Result |
| --- | --- |
| `node verify.js` | PASS — `0 FAIL`, `26 warn`, spine `b618c5762240070c` |
| `node hub/hub-selftest.js` | PASS |
| `node hub/route-selftest.js` | PASS |
| `node hub/graft-selftest.js` | PASS |
| `node hub/skin-selftest.js` | PASS |
| `node hub/verify-plus.js` | `VERIFIED_WITH_LIMITS`; `26` known-open warnings |
| `node tests/html-script-syntax-test.js` | `57 PASS · 0 FAIL` |
| `node tests/tool-forge-package-test.js` | PASS; generated proof package remained uninstalled |
| `node tools/agent-tool-forge/selftest.js` | `17 PASS · 0 FAIL` |
| `node tools/evidence-desk/selftest.js` | `36 PASS · 0 FAIL` |

City/schema/twin projections rebuilt successfully: graph
`00327ec63b379a3f10de1bbb4023b26925ff0d59a286ec55a16a76c71f915c57`,
schema registry
`9966a347774c88db5a1822240c5c45a9adb69ea6225fdc5eabc6ebc23d4162ae`,
and twin
`51e230167fef2be6255d93acac333e386e435a4807d0a895bdcd67fc5d511cf3`.

## Warnings and unproved boundaries

`verify.js` retains `26` visible warnings. They are current Workshop-wide known
open warnings and are not converted into proof by this run.

Not proved or not run:

- fresh v2.22 browser render/click journey, due browser URL-policy refusal;
- human fun, game balance, animation timing, controller/touch, online play, or persistence;
- actual Asset Hand/provider execution or standalone sprite/audio/animation artifacts;
- installation, Workshop integration, publication, promotion, lesson admission, or CANON;
- any AI provider, general executor, or supplied experimental runtime.
