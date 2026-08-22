# Storycraft — v7

Storycraft is the optional presentation layer above the existing visual, production, and authoring architecture. It is designed for onboarding, demonstrations, proof reviews, public showcases, and guided explanation.

## Trust model

Storycraft separates three responsibilities:

1. **Focus Director** points at a reviewed element and displays supplied narrative copy in an owned overlay.
2. **Journey Director** sequences finite, allowlisted steps. It can request existing blueprints and cues but cannot execute arbitrary code or control navigation.
3. **Capture Studio** prepares a deterministic-looking frame but never claims to capture or upload the screen.

All mutation paths require explicit approval. Preview paths report impact and perform zero mutation.

## Journey schema

A journey is portable JSON with a label and a finite `steps` array. A step may reference an allowlisted target selector, supplied title/copy, focus style/alignment, an existing composition blueprint, an existing finite cue, a duration, and capture preparation. Unknown fields are rejected.

The maximum journey length is 24 steps. Timers are finite. Stop, replacement, completion, and destroy clear owned timers and restore coordinated state where ownership is unchanged.

## Built-in journeys

- `axiom-awakening`: orientation → relationship → authorship → restraint → possibility → return
- `proof-path`: preview and contract discipline
- `living-workshop`: modular system relationships
- `public-showcase`: finite presentation route
- `quiet-onboarding`: low-pressure introduction

## Explicit limits

- No target text read
- No semantic or emotional inference
- No automatic navigation
- No background journey loop
- No arbitrary JavaScript in journey JSON
- No screenshot or upload claim
