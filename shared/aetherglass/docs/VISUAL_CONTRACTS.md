# Visual Contracts — v5

A visual contract is portable JSON describing a proposed composition. Validation is read-only.

## Policies

### production-safe

Allows cinematic depth while warning about unusually high intensity, glow, or field density.

### workspace

Restricts intensity, glow, and particle density for long working sessions.

### showcase

Allows stronger presentation effects. Other accessibility and performance routes remain available.

### low-power

Requires a disabled particle field and restrained quality/motion choices.

### accessibility

Requires reduced/off motion, opaque surfaces, high contrast, and a disabled particle field.

## Example

```json
{
  "module": "axm.visual.composition",
  "version": "5.0.0",
  "label": "Quiet Proof",
  "policy": "workspace",
  "tokenPack": "quiet-crystal",
  "scene": "quiet-operations",
  "budget": "workspace",
  "engine": {
    "intensity": 0.76,
    "glowStrength": 0.48,
    "motion": "reduced",
    "parallax": false
  },
  "field": {
    "preset": "off",
    "density": 0
  },
  "surfaces": [
    {
      "target": "#review-panel",
      "recipe": "clean-room"
    }
  ]
}
```

## Fingerprints

The contract fingerprint is deterministic: unchanged normalized contracts produce the same identifier, and changed contracts produce a different identifier. It is useful for change tracking and review logs.

It is **not** a cryptographic signature and does not prove authorship, authenticity, or tamper resistance.

## Selector impact

Selectors are syntax-checked and locally counted. The report shows how many targets each surface instruction would reach. Counting targets is not approval. The Workbench still requires an explicit approved application.

## Contract comparison

`contracts.compare(before, after)` returns exact changed paths and values. This can support a human review gate before a revised visual direction is accepted.
