# Web adapter

Use the CLI output's `adapter.variables` as CSS custom properties on a wrapper. The provided stylesheet keeps the plate separate from the glyph layer so blur and opacity do not soften the text itself.

Recommended HTML:

```html
<span class="axm-text-plate">
  <span class="axm-text">Mission complete</span>
</span>
```
