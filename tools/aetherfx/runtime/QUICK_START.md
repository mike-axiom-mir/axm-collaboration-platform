# Quick Start — v1.3

## 1. Launch

Open `OPEN_STUDIO.html`, or use `START_STUDIO.bat` / `START_STUDIO.sh`. The central preview is the resolved output. The Library and Active Stack expose the parts underneath; the right side provides global and selected-module controls.

## 2. Let Guide build a traceable starting point

Press **Guide** and choose:

- outcome or product surface
- mood
- energy level
- device target
- accessibility/protection preferences

The guide creates an ordinary editable recipe. It does not hide or lock the chosen modules.

## 3. Inspect before adding more

- **Graph** shows module relationships and dependency closure.
- **Performance** estimates total load and identifies the largest contributors.
- **Quality** selects a fixed tier; `Auto` adapts the resolved runtime tier without rewriting the recipe.
- **Auto bias** chooses battery, balanced, or quality preference.

## 4. Tune and compound

Add modules from the Library and tune typed controls.

### Derived module

Use `Create → Derived` for one reusable tuned variation. It references the base module rather than duplicating renderer code.

### Composite mold

Use `Create → Composite` for a reusable relationship among enabled layers. Enable **Expose key controls** and choose a limit of 4, 6, 8, or 12. The mold retains child identities, values, dependencies, and explicit bindings. Expanding it restores current promoted values into the children.

## 5. Protect and repair

- `Undo` and `Redo` cover the active session.
- `Snapshot` creates a named rollback point.
- Import and repair actions protect the previous state first.
- Raw recipe review validates the submitted document first and lists any normalization changes before confirmation.
- **Import Review** validates required SHA-256 integrity, cycles, bounds, dependencies, collisions, and licence notices before mutation.
- Sealed package import commits transactionally; any failure leaves the live registry unchanged.
- **Repair** reports missing modules, duplicates, invalid parameters, and exclusive collisions, then applies only the reviewed repair plan.
- Exported files are the durable copy if browser storage is cleared.

## 6. Accessibility and motion safety

- **Reduced motion** removes non-essential animation.
- **Photosensitive safe** suppresses repeating sweeps, flashing-like decoration, and rapid overlays while preserving content structure.
- **High contrast** strengthens separation and focus.
- **Large text** increases preview text size.

## 7. Export or integrate

- Raw recipe JSON
- Sealed recipe/module package
- Standalone local HTML
- Embeddable Web Component
- CSS tokens
- Canonical resolved visual intent
- Adapter target-support report
- Static SVG approximation
- Godot Theme and Unity UI Toolkit starter handoffs

Choose the target profile in Export when you need support status for web, static SVG, Godot Theme, Unity UI Toolkit, or a generic game contract. Every operation is reported as implemented, approximated, contract-only, or unsupported.

## 8. Use the portable runtime or CLI

For use outside the creator UI:

```bash
node integration/runtime/example.mjs
npm run cli -- validate examples/recipes/command-dashboard.axmrecipe.json
npm run cli -- inspect examples/recipes/cinematic-glass-stage.axmrecipe.json --target=godot-theme
```

See `integration/README.md` for practical examples. Before public sharing, explicitly review licence, authorship, consent, and source rights.
