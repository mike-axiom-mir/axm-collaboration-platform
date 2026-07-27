# Evidence ledger

Status: accepted for its stated technical boundary on 2026-07-19.

## Automated evidence

- `node selftest.js` passes 41 checks across the building, vehicle, tree, and animated-pedestrian fixtures.
- The independent verifier checks all four levels, non-increasing triangle cost, per-level error bounds, screen-error-derived transitions, eight atlas views, alpha coverage, deterministic HLOD grouping, source-digest attachment, and explicit target misses.
- Negative and determinism routes are part of the self-test; the verifier does not trust the UI verdict.

## Live browser evidence

- Building: PASS 9/9; 2,006 -> 1,534 -> 1,153 -> 1,080 triangles; normalized shape error 0%, 0.98%, 3.91%, 8.69%; receipt `2535A05396B57C2DBF3CC3993E8F1C47C6666CB36123A1CFB92EF7B0D56036DB`.
- Tree: PASS 9/9; the 16-triangle source is deliberately retained at all four levels as `source-already-minimal`; the far route is an eight-direction impostor; receipt `4F4365BB4C5DDE51367D6EAE65B47E73D8E395867F914F735EA25431284400F1`.
- The technical atlas exposes real direction-dependent silhouettes, alpha coverage, and depth shading. It is explicitly labelled as technical evidence, not textured beauty approval.
- At 780 x 900 the page has no horizontal overflow (`scrollWidth` 765), and the console log is empty.

## Discovery evidence

- Workshop Hub `/api/tools` discovers this folder as `lod-hlod-impostor-builder`, including its actions, accepts, produces, readiness, and human-machine audience metadata.

## Honest boundary

This module proves bounded geometry families, deterministic distance metadata, and a technical impostor atlas. It does not claim that transition pop, textured impostor fidelity, or final art direction is approved; those remain live game and human visual-review claims.
