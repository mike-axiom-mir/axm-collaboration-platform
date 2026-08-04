# Static SVG Adapter

Run from the package root:

```bash
python adapters/static/render_recipe_to_svg.py examples/recipes/command-dashboard.axmrecipe.json --output dist/command-dashboard.svg
```

The adapter has no third-party Python dependency. It resolves derived and composite modules against `catalog/default-catalog.json`, applies quality fallbacks, parameter defaults and bounds, exclusive groups, and composition budgets, then creates a layered SVG approximation.

Dynamic interaction and exact CSS blending are intentionally not claimed. Unsupported interactions are reported in the SVG instead of being silently counted as rendered output.
