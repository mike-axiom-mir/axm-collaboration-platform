# Deterministic AI-Native Use

The machine-native door is a data contract, not a privileged automation path.

## Structured route

1. Produce an `axm.style-intent` object matching `contracts/ai-style-intent.schema.json`.
2. Call `compileStyleIntent(intent)`.
3. Validate the returned skin.
4. Preview or submit it as a proposal.
5. A permitted user approves apply.

The same canonical intent produces the same skin bytes. The compiler does not use the clock, network, model identity, hidden memory, or random system state. Variation comes only from the recorded seed.

## Preskin route

Machine users can call `applyPreskin`, `blendPreskins`, or
`chooseDeterministicPreskin`. Those helpers output an ordinary visible
`axm.style-intent`; they do not bypass the compiler, validator, proposal gate,
or game adapter.

## Phrase route

The creator includes a deliberately bounded phrase grammar. Recognized words map to visible recipe keywords. For example:

`dark luxurious neon paper, cyan and violet, reduced motion`

Unrecognized words are reported, not silently hallucinated into capabilities.

## Machine intent example

```json
{
  "type": "axm.style-intent",
  "version": "1.0",
  "name": "Midnight Paper Circuit",
  "seed": "mike-001",
  "scope": ["global"],
  "keywords": ["dark", "neon", "paper", "luxury"],
  "intensity": 0.78,
  "pattern": {
    "kind": "paper-fiber",
    "strength": 0.55,
    "scale": 1.2
  },
  "geometry": {
    "cornerRoundness": 0.42,
    "silhouetteExaggeration": 0.58,
    "detailDensity": 0.64
  },
  "accessibility": {
    "highContrast": true,
    "reducedMotion": false,
    "minimumTextContrast": 4.5
  }
}
```

## Honest boundary

This module deterministically converts declared style intent into tokens and materials. It does not generate finished sprite sheets, infer copyrighted styles, or prove that an image model is deterministic. External image generation can later provide candidate raster assets, but those assets still enter through provenance, hashing, validation, and human review.
