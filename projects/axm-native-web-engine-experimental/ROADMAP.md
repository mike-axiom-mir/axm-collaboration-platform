# Roadmap with evidence gates

This roadmap does not authorize installation or promotion.

## Phase 1.1 — harden the offline semantic proof

- Add a selected tokenizer/tree-builder conformance matrix.
- Expand malformed and adversarial fixtures with declared resource budgets.
- Add a real JSON Schema validator or an independently reviewed validator.
- Decide whether the production core moves to Rust now or after the CSS/layout
  contracts stabilize. Record the decision and migration/equivalence tests.

Gate: exact fixture matrix, independent manifest verification, fuzz plan, and
no loss of Source Record / Document Tree / Page Model separation.

## Phase 2 — CSS and layout

- CSS tokenizer/parser subset.
- Selector matching, cascade provenance, inheritance, and computed style.
- Site styles and AXM/user overrides remain distinguishable.
- Block/inline box generation and deterministic Layout Tree serialization.
- Add `headless layout` without creating a visual fork.

Gate: golden layout fixtures, cascade provenance tests, limits, and explicit
unsupported CSS matrix.

## Phase 3 — display list and first visual body

- Renderer-neutral display commands.
- CPU renderer first if it gives the smallest inspectable proof.
- Text, solid backgrounds, borders, raster images, clipping, and scrolling.
- Visual and offscreen pixel modes consume the same display-list producer.

Gate: visual/reference evidence plus proof that semantic/headless and visual
report the same core digest and source lineage.

## Phase 4 — brokered network intake

- Explicit URL request contract, HTTP/HTTPS adapter, redirects, MIME, encoding,
  resource budgets, and provenance receipts.
- No provider key or Workshop authority in the content route.
- Define isolation honestly before public hostile input is enabled.

Gate: redirect/size/timeout/encoding/hostile-URL corpus, exact authority review,
and visible declaration of every boundary not yet isolated.

## Phase 5 — navigation

- One-page lifecycle, links, history, back/forward/reload, address surface.
- Tabs only after lifecycle cleanup and isolation evidence are solid.

## Phase 6 — AXM representation proof

- Site View / AXM Minimal Structure View.
- Reversible Modification Ledger with before/after digests and provenance.
- Same semantic Page Model in both modes.

## Phase 7 — bounded Workshop seams

- Explicit Discovery/Evidence handoffs.
- Optional Hub home surface and QA integration.
- Package/intake receipts and user-reviewed installation route.

Search providers, JavaScript, WebAssembly, service workers, broad media, WebRTC,
WebGPU, DRM, extensions, and full modern-web compatibility each require their
own later capability and risk decision.
