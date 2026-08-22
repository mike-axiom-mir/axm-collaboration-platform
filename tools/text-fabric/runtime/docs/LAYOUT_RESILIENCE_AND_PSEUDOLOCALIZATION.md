# Layout Resilience and Pseudo-localization

AXM Text Fabric v1.0 adds a deterministic preflight for failures that often appear only after translation or deployment:

- text expansion
- narrow phone layouts
- one-line HUD limits
- TV and console safe areas
- RTL direction
- long unbroken tokens
- platform viewing-distance floors

## Commands

```bash
python -m axm_text_fabric.cli stress-text "System ready" --mode all --pretty
```

```bash
python -m axm_text_fabric.cli layout-audit examples/request_layout_stress.json --pretty
```

```bash
python -m axm_text_fabric.cli layout-qa ./layout_qa --ids axm_future_core golden_victory --widths 320 768 1280 --force
```

## Important boundary

The layout audit is a deterministic heuristic. It catches brittle layouts early, but exact shaping and line breaks must still be verified in the target engine with the real selected font stack.

## Repair order

1. Increase the available container or allow wrapping.
2. Increase the line budget where the semantic role permits it.
3. Shorten or rewrite copy without changing meaning.
4. Reduce decorative tracking or outline burden.
5. Reduce display scale only while remaining above the platform readability floor.
6. Never silently clip essential text.
