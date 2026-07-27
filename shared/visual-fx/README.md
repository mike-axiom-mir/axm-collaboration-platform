# AXM Portable Visual FX

Fifteen local, dependency-free visual-effect generators created by Opus for
Mike Tobi / AXM and admitted as a TEST capability. Each effect emits plain
tokens plus CSS and, where a truthful equivalent exists, SVG definitions or
filters.

The forms are portable contracts, not universal execution. CSS needs a
compatible HTML/CSS host; SVG filters need a compatible renderer; game shaders,
native apps and operating-system themes need explicit adapters that map the
tokens into their own runtime. No effect applies itself and no generated
preview grants visual approval.

The intake replaces counter-based SVG identifiers with content-derived stable
identifiers. Equal effect parameters now produce byte-identical results inside
the same process as well as across fresh processes.

Honest limits:

- `grain` uses SVG `feTurbulence`; the packaged ImageMagick proof did not render
  that primitive, so browser rendering is the applicable visual proof.
- `conicGradient` has CSS and token forms but no native SVG equivalent.
- `frostedGlass` requires a live backdrop for the CSS effect. A generic SVG blur
  is not treated as proof of equivalent backdrop behavior.
- Visual quality remains a human judgment.

Run `node selftest.js` for determinism, catalog, boundary and provider checks.
