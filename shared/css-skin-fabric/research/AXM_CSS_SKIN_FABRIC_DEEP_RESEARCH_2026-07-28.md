# AXM CSS Skin Fabric — Deep Research Report

**Date:** 28 July 2026  
**Language:** English  
**Research base:** English-language primary and official sources: W3C/CSSWG, MDN, WAI/WCAG, web.dev/Chrome, Design Tokens Community Group, Stylelint, and Playwright.

---

## 1. Executive conclusion

AXM is not mainly missing “better CSS tricks.” It is missing a **professional visual production system around CSS**.

The software equivalent of the molds Mike described is:

1. **Design tokens** — controlled raw materials such as color, spacing, typography, radius, glow, blur, depth, and motion.
2. **Layout primitives** — reusable spatial molds such as stack, cluster, grid, sidebar, frame, stage, and split view.
3. **Component molds** — buttons, cards, panels, menus, dialogs, tabs, HUDs, toolbars, inspectors, and status surfaces.
4. **Effect recipes** — glass, luminous edge, hologram, metal, paper, plasma, fog, scanline, energy, luxury frame, and similar finishes.
5. **Theme skins** — semantic remapping of the same components into different visual identities.
6. **A visual quality loop** — screenshot baselines, accessibility checks, performance budgets, browser checks, and rollback.
7. **A constrained mold generator** — creates variations from approved tokens and recipes rather than emitting random CSS.

CSS is now powerful enough to serve as AXM’s **UI material, lighting, layout, skin, and motion language**. It should not be forced to replace raster art, SVG illustration, Canvas, or WebGL. Professionals use CSS as the compositor and control surface around those other media.

---

## 2. The practical body metaphor

- **HTML:** skeleton and semantic organs.
- **CSS:** skin, clothing, material, lighting, depth, spatial arrangement, and visible state.
- **JavaScript:** nerves, behavior, orchestration, and dynamic state.
- **SVG / images / video:** authored visual material.
- **Canvas / WebGL:** heavy 2D or 3D rendering when CSS is no longer the right tool.
- **Design tokens:** standardized material stock.
- **Components and recipes:** molds.
- **Theme engine:** pigments and finishes.
- **Visual regression tests:** mirror and measurement station.
- **Mold generator:** a machine that creates new molds inside controlled limits.

The missing leap is therefore not “learn every CSS property.” It is **turn CSS into a governed visual factory**.

---

## 3. Why strong code can still look visually old

Based on Mike’s description rather than a direct code audit, the likely problem is systemic:

- Each screen or module invents visual values locally.
- Colors, spacing, shadows, borders, and animation do not come from one shared grammar.
- Components respond to the whole viewport rather than the space actually available to them.
- Effects are added as decoration rather than as a consistent material system.
- There is no permanent specimen gallery showing every component and state.
- There is no screenshot-diff gate, so visual regressions are subjective and easy to miss.
- More code compounds capability, but it does not automatically compound visual coherence.

Professional visual quality usually comes from **fewer primitive choices, used more consistently**, followed by controlled skin variation.

---

## 4. What modern CSS can professionally control

### 4.1 Cascade and modularity

Modern CSS provides native tools for controlling the hardest part of large stylesheets:

- `@layer` defines explicit cascade priority.
- `@scope` restricts rules to a DOM subtree without high-specificity selectors.
- Native CSS nesting improves local readability.
- `:where()` gives reusable selectors zero specificity.
- `:is()` groups selectors while retaining calculated specificity.
- `:has()` styles an element based on related descendants or siblings.
- CSS custom properties provide runtime parameters.
- `@property` can type and register custom properties, define inheritance, and make suitable values animate predictably.

This means AXM can define a stable visual contract instead of fighting source order and selector escalation.

### 4.2 Responsive layout

Use:

- **Grid** for two-dimensional page and component structure.
- **Flexbox** for one-dimensional distribution and alignment.
- **Subgrid** for nested alignment across components.
- **Container queries** for components that adapt to their own available space.
- **Media queries** for device, viewport, print, and user preferences.
- `clamp()`, `min()`, and `max()` for fluid but bounded sizing.
- `aspect-ratio` for stable media and card geometry.
- Logical properties such as `padding-inline`, `margin-block`, `inline-size`, and `inset-inline-end` for translation and alternate writing directions.

A professional component should normally adapt to its **container**, not assume that phone, tablet, and desktop are three fixed worlds.

### 4.3 Color and themes

Use:

- Semantic CSS custom properties rather than hardcoded component colors.
- `oklch()` for more controllable perceptual lightness and chroma.
- `color-mix()` for derived borders, hover states, overlays, and tinted surfaces.
- `color-scheme`, `prefers-color-scheme`, `prefers-contrast`, and `forced-colors` for user and operating-system adaptation.
- `light-dark()` where appropriate, with fallbacks when supporting older environments.

The important professional distinction is:

- **Primitive token:** a raw value such as a blue hue.
- **Semantic token:** a purpose such as `--text-primary` or `--surface-raised`.
- **Component token:** a local mapping such as `--button-bg`.

Components should consume semantic or component tokens, not raw palette values.

### 4.4 Materials and effects

CSS can build sophisticated interface materials with:

- Multiple backgrounds and gradients.
- Pseudo-elements for extra visual layers without extra markup.
- `clip-path` for hard shapes.
- CSS masks for soft transparency and alpha-based reveals.
- `filter` and `backdrop-filter` for blur and color processing.
- `mix-blend-mode` and `background-blend-mode` for compositing.
- Box shadows, inset shadows, borders, outlines, and generated highlights.
- Isolation and controlled stacking contexts.

These can produce glass, neon edges, luminous frames, scanlines, metallic reflections, paper cuts, hologram noise, energy fields, and layered depth. The effects must be parameterized and budgeted; uncontrolled blur, large shadows, and constant repaints can damage performance.

### 4.5 Motion

Use:

- CSS transitions for clear state changes.
- Keyframe animations for reusable motion recipes.
- View Transitions for movement between application states or pages.
- Scroll-driven animations where support and purpose justify them.
- Anchor positioning for tooltips, menus, labels, and overlays as progressive enhancement.
- Registered custom properties for animating reusable effect parameters.

Motion should be optional, explain state, and respect `prefers-reduced-motion`. For high performance, prefer animation of `transform` and `opacity`; properties that trigger repeated layout or paint need measurement and restraint.

### 4.6 What CSS should not be forced to do

Do not use CSS as the only engine for:

- Complex painted characters or scenery.
- Large particle fields.
- Real-time simulation.
- Heavy image processing.
- Cinematic 3D worlds.
- Dense generative art that is better represented as SVG, Canvas, video, or WebGL.

CSS should style and composite those systems, not replace them.

---

## 5. Browser maturity strategy as of July 2026

### Production core

Good candidates for the normal AXM baseline include:

- Flexbox and Grid.
- Subgrid.
- Custom properties.
- Cascade layers.
- Container size queries.
- `clamp()` and `aspect-ratio`.
- `:where()`, `:is()`, and `:has()`.
- `color-mix()`.
- Masks, clipping, filters, blend modes, and `backdrop-filter`, with performance checks.

### Modern core with fallback awareness

- `@property` became Baseline 2024.
- `@scope` became Baseline 2025.
- Newer text wrapping controls and some advanced container-query forms may not work on older devices.

Use them, but keep ordinary class-based and static fallbacks where AXM must support older hardware.

### Progressive enhancement

Treat these as enhancements until the exact AXM browser matrix is verified:

- View Transitions, especially advanced and cross-document behavior.
- CSS anchor positioning.
- Scroll-driven animation.
- New CSS custom functions.

### Do not use as the root today

- Native CSS mixins are not supported in browsers at the time of this research.
- The CSS Painting API remains limited/experimental across major browsers.

CSS custom functions are beginning to appear, but browser support is not yet broad enough to make them AXM’s only mold system. Build the current system with custom properties, classes, data attributes, and a build-time recipe compiler. Later, the compiler can emit native functions or mixins when interoperability is strong enough.

---

## 6. Recommended AXM CSS Skin Fabric architecture

```text
axm-visual-system/
├─ contracts/
│  ├─ component-contract.schema.json
│  ├─ effect-recipe.schema.json
│  └─ theme-contract.schema.json
├─ tokens/
│  ├─ primitives.json
│  ├─ semantic.json
│  ├─ components.json
│  ├─ effects.json
│  ├─ motion.json
│  └─ generated-tokens.css
├─ css/
│  ├─ 00-layer-order.css
│  ├─ 01-reset.css
│  ├─ 02-legacy.css
│  ├─ 03-foundation.css
│  ├─ 04-layout.css
│  ├─ 05-components.css
│  ├─ 06-effects.css
│  ├─ 07-states.css
│  ├─ 08-utilities.css
│  └─ 09-overrides.css
├─ themes/
│  ├─ axiom.css
│  ├─ mir.css
│  ├─ axm-luxury.css
│  ├─ paper-play.css
│  └─ high-contrast.css
├─ recipes/
│  ├─ glass-panel.json
│  ├─ luminous-edge.json
│  ├─ hologram-surface.json
│  ├─ luxury-metal.json
│  ├─ paper-cut.json
│  └─ energy-core.json
├─ components/
│  ├─ button/
│  ├─ card/
│  ├─ panel/
│  ├─ dialog/
│  ├─ tabs/
│  ├─ toolbar/
│  ├─ inspector/
│  └─ hud/
├─ gallery/
│  ├─ index.html
│  ├─ fixtures/
│  └─ state-matrix.json
├─ qa/
│  ├─ visual.spec.ts
│  ├─ accessibility.spec.ts
│  ├─ overflow.spec.ts
│  ├─ performance-budget.json
│  └─ baselines/
└─ docs/
   ├─ VISUAL_LANGUAGE.md
   ├─ ADDING_A_COMPONENT.md
   ├─ ADDING_AN_EFFECT_RECIPE.md
   └─ MIGRATION_LOG.md
```

This is modular enough for local intake and does not require rebuilding the platform.

---

## 7. Cascade governance

A single entry stylesheet should declare the full order before other author rules:

```css
@layer reset, vendor, legacy, tokens, foundation, layout,
       components, effects, states, utilities, overrides;
```

Recommended purpose:

- `reset`: predictable browser baseline.
- `vendor`: imported third-party styles at low priority.
- `legacy`: current AXM CSS while migration is in progress.
- `tokens`: visual values and theme mappings.
- `foundation`: typography, body, links, form defaults.
- `layout`: spatial primitives.
- `components`: structural component rules.
- `effects`: optional material and visual recipes.
- `states`: loading, selected, error, success, drag, disabled.
- `utilities`: deliberately small one-purpose helpers.
- `overrides`: reviewed exceptions only.

Important rules:

1. Put all author CSS inside a named layer. Unlayered normal rules override layered normal rules and can silently break the system.
2. Import third-party CSS into a low-priority `vendor` layer.
3. Do not use `!important` casually. Cascade-layer priority reverses for important declarations, which makes undocumented use especially dangerous.
4. Keep selectors low in specificity. Prefer classes, data attributes, and `:where()` over IDs and deep DOM chains.
5. Log every override with a reason and planned removal condition.

---

## 8. Token model

### Primitive tokens

Raw materials:

```css
--hue-cyan: 205;
--space-3: 0.75rem;
--radius-3: 1rem;
--blur-2: 12px;
--duration-fast: 140ms;
```

### Semantic tokens

Meaning:

```css
--surface-canvas: ...;
--surface-raised: ...;
--text-primary: ...;
--text-muted: ...;
--border-subtle: ...;
--accent-primary: ...;
--status-danger: ...;
```

### Component tokens

Local contract:

```css
--button-bg: var(--accent-primary);
--button-text: var(--text-on-accent);
--button-radius: var(--radius-2);
```

### Effect tokens

Controlled finish:

```css
--fx-glow-color: var(--accent-primary);
--fx-glow-strength: 0.42;
--fx-blur: var(--blur-2);
--fx-edge-width: 1px;
--fx-noise-opacity: 0.035;
```

### Motion tokens

```css
--motion-duration-1: 120ms;
--motion-duration-2: 220ms;
--motion-duration-3: 420ms;
--motion-ease-standard: cubic-bezier(.2, .8, .2, 1);
```

### Mode tokens

AXM should support explicit modes such as:

```html
<html
  data-theme="axm-luxury"
  data-density="comfortable"
  data-motion="full"
  data-effects="balanced"
  data-contrast="standard">
```

This allows user agency and low-end-device adaptation without changing component code.

---

## 9. A mold is a contract, not only a class

Each component or effect mold should contain:

- Stable ID and version.
- Purpose and approved use cases.
- Required HTML structure.
- Public CSS variables.
- Internal/private variables.
- Allowed states.
- Container-size behavior.
- Theme compatibility.
- Motion profile.
- Reduced-motion behavior.
- Forced-colors behavior.
- Performance tier.
- Fallback recipe.
- Screenshot fixtures.
- Accessibility requirements.
- Known limitations.
- Source and change log.

Example effect-recipe manifest:

```json
{
  "id": "axm.effect.glass-panel",
  "version": "0.1.0",
  "class": "fx-glass-panel",
  "publicParameters": {
    "--fx-blur": { "type": "length", "min": "0px", "max": "24px" },
    "--fx-opacity": { "type": "number", "min": 0.55, "max": 0.92 },
    "--fx-accent": { "type": "color" }
  },
  "fallback": "axm.effect.solid-panel",
  "performanceTier": "medium",
  "motion": "optional",
  "tests": [
    "320x568",
    "768x1024",
    "1440x900",
    "reduced-motion",
    "forced-colors",
    "keyboard-focus"
  ]
}
```

The generator is only allowed to change declared public parameters inside safe ranges.

---

## 10. Example: one reusable material mold

```css
@property --fx-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

@layer effects {
  .fx-luminous-frame {
    --fx-accent: var(--accent-primary);
    --fx-edge: 1px;
    --fx-glow: 0.28;

    position: relative;
    isolation: isolate;
    overflow: clip;
    border: var(--fx-edge) solid
      color-mix(in oklch, var(--fx-accent) 34%, transparent);
    background:
      linear-gradient(
        145deg,
        color-mix(in oklch, var(--surface-raised) 92%, white 8%),
        var(--surface-raised)
      );
    box-shadow:
      0 1px 0 color-mix(in oklch, white 10%, transparent) inset,
      0 18px 60px color-mix(
        in oklch,
        var(--fx-accent) calc(var(--fx-glow) * 100%),
        transparent
      );
  }

  .fx-luminous-frame::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: conic-gradient(
      from var(--fx-angle),
      transparent,
      color-mix(in oklch, var(--fx-accent) 78%, white),
      transparent 28%
    );
    opacity: 0.26;
    mask: linear-gradient(#000, #000) border-box;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .fx-luminous-frame[data-animate="true"]::before {
    animation: axm-frame-turn 10s linear infinite;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fx-luminous-frame {
    --fx-glow: 0.14;
  }
}

@keyframes axm-frame-turn {
  to { --fx-angle: 1turn; }
}
```

This is one mold. Themes change its tokens; components can opt into it; the generator can vary approved parameters; accessibility and performance modes can reduce it.

---

## 11. The organs AXM should build

### 11.1 Token Foundry

Stores primitive, semantic, component, effect, and motion tokens. Generates CSS and machine-readable output from one source.

### 11.2 Cascade Governor

Owns layer order, specificity rules, imports, override policy, and `!important` exceptions.

### 11.3 Layout Forge

Provides small composable layout primitives:

- Stack.
- Cluster.
- Grid.
- Sidebar.
- Split.
- Frame.
- Reel.
- Stage.
- Center.
- Cover.

### 11.4 Component Mold Registry

Stores structure and states for all reusable UI components.

### 11.5 Material and Effect Lab

Stores parameterized visual recipes with fallback and performance tier.

### 11.6 Theme Composer

Maps semantic tokens to visual identities without rewriting components.

### 11.7 Motion Governor

Defines duration, easing, transition purpose, reduced-motion behavior, and maximum simultaneous animation.

### 11.8 Asset Adapter

Defines how CSS frames, crops, masks, tints, and composes SVG, raster, video, Canvas, and WebGL output.

### 11.9 Accessibility Governor

Checks contrast, focus, target size, reduced motion, forced colors, zoom, text spacing, keyboard flow, and content reflow.

### 11.10 Performance Governor

Tracks stylesheet size, unused CSS, paint-heavy effects, animation properties, large blur radii, excessive layers, and offscreen rendering.

### 11.11 Compatibility Gate

Classifies features as core, enhanced, or experimental and requires fallbacks where necessary.

### 11.12 Visual QA Mirror

Renders every component, theme, state, container size, and user preference into screenshot baselines and diffs.

### 11.13 Mold Breeder

Creates candidate molds only from approved tokens, recipe archetypes, and constraints. It never promotes its own output directly into canon.

---

## 12. Safe self-growing mold loop

1. Select a structural component mold.
2. Select one approved material archetype.
3. Select a theme-compatible token set.
4. Generate constrained parameter variants.
5. Reject duplicates using token and screenshot similarity.
6. Render the specimen matrix.
7. Run overflow, keyboard, reduced-motion, forced-colors, contrast, and screenshot checks.
8. Run performance budgets on a low-end profile.
9. Produce a candidate packet containing code, manifest, screenshots, test results, source lineage, and uncertainty.
10. Require human review before promotion.
11. Create a rollback before replacing any existing recipe.
12. Limit automatic promotion frequency according to AXM’s existing one-version-per-day policy.

This makes the visual library capable of growth without allowing uncontrolled visual drift.

---

## 13. Professional visual rules for AXM

1. **No raw colors inside components.** Use semantic tokens.
2. **No page-specific spacing inventions.** Use the spacing scale.
3. **No effect without a fallback.** Every glass, blur, mask, or animation gets a simpler equivalent.
4. **No hover-only meaning.** Keyboard and touch states must exist.
5. **No hidden focus.** `:focus-visible` must remain obvious.
6. **No component that only works at one viewport.** Test its container range.
7. **No uncontrolled `z-index`.** Use named depth tokens.
8. **No random animation durations.** Use motion tokens.
9. **No permanent `will-change`.** Apply only when measured and needed.
10. **No visual canon without screenshots.** Code review alone is insufficient.
11. **No generator direct-to-production path.** Candidate first, review second.
12. **No silent redesign during migration.** First reproduce current visuals through tokens, then improve deliberately.

---

## 14. Accessibility quality floor

At minimum:

- Normal text contrast should meet WCAG 2.2 AA, generally 4.5:1.
- Large text may use the 3:1 threshold defined by WCAG.
- Meaningful graphical objects and interface-state indicators require 3:1 against adjacent colors.
- Keyboard focus must be clearly visible and sufficiently contrasting.
- Pointer targets should be at least 24 by 24 CSS pixels or satisfy the WCAG spacing exceptions; larger targets remain better for many users.
- Motion caused by interaction must be suppressible for users requesting reduced motion.
- Test forced-colors/high-contrast mode.
- Test 200% zoom and increased text spacing without loss of content or function.
- Do not rely on color alone for state.
- Provide density and effect-reduction controls where possible.

A luxury or futuristic design is not professional if users cannot read, focus, or operate it.

---

## 15. Performance quality floor

- Prefer `transform` and `opacity` for motion.
- Treat layout-changing and paint-heavy animation as exceptional and measured.
- Set dimensions or `aspect-ratio` for media to prevent layout shifts.
- Use `content-visibility: auto` selectively for large offscreen sections, with accessibility testing.
- Avoid shipping unused CSS.
- Keep critical CSS small and avoid unnecessary render-blocking stylesheets.
- Limit simultaneous backdrop blurs and large-radius blurs.
- Avoid animating box shadows, filters, or large masks across many elements without profiling.
- Use DevTools paint flashing and performance traces when effects feel slow.
- Test the effects mode on the slowest supported device, not only the main development laptop.

Recommended AXM effect modes:

- `minimal`: solid surfaces, no blur, no ambient animation.
- `balanced`: moderate glass and glow, motion only for state.
- `cinematic`: richer effects for capable devices or presentation screens.

---

## 16. Automated quality stack

### Stylelint

Use Stylelint with a standard configuration plus AXM-specific conventions. It can catch invalid values, duplicate rules, unsupported patterns, and convention drift. Add custom rules only for truly stable AXM contracts.

Suggested AXM checks:

- Disallow ID selectors in component CSS.
- Limit selector depth.
- Ban unapproved `!important`.
- Require custom properties for color, spacing, radius, motion, and depth.
- Require all files to declare or enter an approved layer.
- Ban raw `z-index` values outside the depth token file.
- Flag transitions using `all`.

### Playwright visual comparisons

Use screenshot baselines for:

- Full pages.
- Individual components.
- Phone, tablet, desktop, and ultrawide.
- Chromium, Firefox, and WebKit projects.
- Default, hover, focus, active, disabled, selected, loading, empty, success, warning, and error.
- Every theme.
- Reduced motion and forced colors where automation permits.

Visual differences should create review artifacts showing expected, actual, and difference images.

### Lighthouse and browser tooling

Use Lighthouse and browser performance tools to check performance, accessibility, unused CSS, render blocking, and main-thread work. These tools support review; they do not replace human visual and keyboard testing.

---

## 17. Migration plan that preserves the current platform

### Phase 0 — Observe, do not redesign

- Capture screenshots of all existing routes, panels, dialogs, and states.
- Record current CSS entry points, frameworks, inline styles, and `!important` use.
- Build a visual specimen gallery from existing components.

### Phase 1 — Add governance without visible change

- Declare cascade layers.
- Place current CSS in `legacy`.
- Add linting and a no-visible-change screenshot baseline.
- Add a migration log.

### Phase 2 — Extract tokens without visible change

- Map current colors, spacing, typography, radii, depth, and motion into tokens.
- Replace duplicated values gradually.
- Keep screenshots matching the original baseline.

### Phase 3 — Extract layout and core components

Start with the repeated parts:

- Button.
- Input.
- Card.
- Panel.
- Dialog.
- Tabs.
- Toolbar.
- Sidebar.
- Status badge.
- Empty/loading/error states.

### Phase 4 — Add effect recipes

Create a small approved first library rather than hundreds of random effects:

- Solid professional surface.
- Soft glass.
- Luminous edge.
- Luxury metal.
- Hologram.
- Paper/play.
- Energy core.
- Accessible high-contrast surface.

### Phase 5 — Add theme skins

Map the same components into:

- Axiom.
- Mir.
- Unified AXM.
- Public-safe neutral.
- Paper/play.
- High contrast.

### Phase 6 — Add automatic visual QA

- Screenshot comparisons.
- Overflow tests.
- Keyboard/focus checks.
- Motion preference checks.
- Performance budgets.

### Phase 7 — Add constrained mold generation

Only after the contracts and tests exist. Otherwise the generator will automate inconsistency.

---

## 18. Framework recommendation

For AXM’s local-first and modular goals:

- Make **native CSS** the source of truth.
- Use custom properties, layers, container queries, Grid/Flex, and data attributes.
- Use CSS Modules or an equivalent build-time scoping adapter when the application framework benefits from it.
- Use Sass only when build-time loops or abstractions provide clear value; do not make Sass-specific behavior the public contract.
- Treat Tailwind or another utility framework as an optional adapter, not the visual root. Utilities do not create art direction or a component contract.
- Avoid runtime CSS-in-JS as the default foundation unless an existing framework makes it necessary.
- Use a small build-time token and recipe generator so the same design data can serve CSS, local tools, documentation, and future engines.

---

## 19. The most important strategic insight

**Do not let every AXM module become visually creative at the lowest level.**

The base should be strict:

- Shared token grammar.
- Shared layout primitives.
- Shared component contracts.
- Shared accessibility and performance gates.

Creativity should happen in interchangeable skins and recipes above that base.

That gives AXM both:

- Strong coherence.
- Very high visual variety.

In Mike’s terms: **compress branches, not roots**. The roots are the contracts and quality gates. The branches are themes, materials, effects, and variations.

---

## 20. Recommended first build target

Build **AXM CSS Skin Fabric v0.1** as a non-destructive wrapper around the current platform with:

- Layer order.
- Token schema and generated CSS.
- Legacy adapter.
- Ten layout primitives.
- Ten core components.
- Eight effect recipes.
- Three themes.
- Specimen gallery.
- Stylelint configuration.
- Playwright screenshot matrix.
- Accessibility and performance modes.
- Mold manifest schema.
- Candidate-only generator stub.
- Rollback and migration log.

This is the smallest build that changes CSS from scattered styling into a reusable visual organ system.

---

## 21. Source index

### Standards and platform structure

- W3C CSS home: https://www.w3.org/Style/CSS/Overview.en.html
- CSS Snapshot 2025: https://drafts.csswg.org/css-2025/
- CSS Functions and Mixins draft: https://drafts.csswg.org/css-mixins/

### Cascade, scoping, parameters, and responsive components

- MDN `@layer`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40layer
- MDN `@scope`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40scope
- MDN nesting: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Nesting/Using
- MDN custom properties: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties
- MDN `@property`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40property
- MDN container queries: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries
- MDN `:has()`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/%3Ahas
- MDN `:where()`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/%3Awhere

### Layout and typography

- MDN Grid: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout
- MDN Subgrid: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Subgrid
- MDN Flexbox: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Basic_concepts
- MDN logical properties: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Logical_properties_and_values
- MDN `clamp()`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/clamp
- MDN variable fonts: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Fonts/Variable_fonts
- MDN text wrapping: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-wrap

### Color, effects, and motion

- MDN `oklch()`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/oklch
- MDN `color-mix()`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/color-mix
- MDN masking: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Masking/Introduction
- MDN `backdrop-filter`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter
- MDN blend modes: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mix-blend-mode
- MDN View Transitions: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
- MDN scroll-driven animation: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations
- MDN anchor positioning: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning
- web.dev animation performance: https://web.dev/articles/animations-guide
- web.dev `content-visibility`: https://web.dev/articles/content-visibility
- MDN CSS performance: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/CSS

### Design tokens and quality tooling

- Design Tokens 2025.10 reports: https://www.designtokens.org/TR/2025.10/
- Stylelint: https://stylelint.io/user-guide/get-started/
- Playwright visual comparisons: https://playwright.dev/docs/test-snapshots
- Lighthouse overview: https://developer.chrome.com/docs/lighthouse/overview

### Accessibility

- WCAG reduced motion technique: https://www.w3.org/WAI/WCAG22/Techniques/css/C39
- WCAG non-text contrast: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- WCAG minimum text contrast technique: https://www.w3.org/WAI/WCAG22/Techniques/general/G18
- WCAG target size: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- WCAG focus appearance: https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html

### Features not ready as the core

- MDN CSS Painting API: https://developer.mozilla.org/en-US/docs/Web/API/CSS_Painting_API
- MDN custom functions and mixins status: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Custom_functions_and_mixins

---

## 22. Action report and uncertainty

**Completed:** Deep research across modern CSS architecture, responsive layout, themes, effects, motion, accessibility, performance, design tokens, linting, visual regression, and emerging native reuse primitives.

**Strong conclusion:** AXM should build a governed CSS Skin Fabric rather than collect isolated CSS effects.

**Not yet verified:** The current AXM repository, framework, CSS file structure, browser target matrix, existing visual debt, and actual performance on Mike’s devices were not inspected in this research task. The migration sequence is therefore architecture-ready but still needs a source audit before exact file changes are made.

**No rewrite is required:** The recommended path starts by preserving screenshots and placing existing CSS behind a legacy adapter, then migrates gradually.
