# Roadmap with evidence gates

This roadmap records sequence; it grants no installation or promotion authority.

## Completed experimental slice — offline semantics + AXM Structure View

- Digest-bound local source, tokenizer/tree subset, separate Page Model.
- Headless semantic, structure-layout, and Display List outputs.
- Source-ordered bounded Structure Layout with no CSS/site-rendering claim.
- Renderer-neutral rectangle/line/text Display List.
- Inert SVG and HTML snapshots consuming that Display List.
- Reversible Modification Ledger and explicit artifact receipts.

Gate status: focused fixtures, deterministic goldens/examples, local schema
identity checks, source manifest, bounds/refusal tests, and two static visual
inspections pass. Status remains `EXPERIMENTAL`.

## Next cheapest hardening step

- Run local intake verification from a clean checkout.
- Add an independently reviewed JSON Schema validator.
- Add selected tokenizer/tree conformance cases and a fuzz plan.
- Decide whether to migrate the core to Rust now or after style/layout contracts
  stabilize; preserve exact cross-implementation fixtures and digests where the
  contract allows.

Gate: clean local reproduction, declared fixture matrix, independent schema
validation, fuzz/resource plan, and no loss of Source Record / Document Tree /
Page Model separation.

## Site style and layout — held

- CSS tokenizer/parser subset.
- Selector matching, cascade provenance, inheritance, and computed style.
- Site styles and AXM/user overrides remain distinguishable.
- Block/inline box generation and deterministic site Layout Tree.

Gate: golden CSS/layout fixtures, cascade provenance tests, resource limits,
and explicit unsupported matrix. The current Structure Layout does not satisfy
this gate.

## Brokered network intake — held

- Explicit URL request contract, HTTP/HTTPS adapter, redirects, MIME, encoding,
  resource budgets, and provenance receipts.
- No provider key or Workshop authority in the content route.
- Define real isolation before public hostile input is enabled.

Gate: redirect/size/timeout/encoding/hostile-URL corpus, authority review, and a
visible declaration of every boundary not yet isolated.

## Navigation and live browser shell — held

- One-page lifecycle, links, history, back/forward/reload, address surface.
- Focus, input, scrolling, cleanup, and failure recovery.
- Tabs only after lifecycle cleanup and isolation evidence are solid.

## Bounded Workshop seams — held

- Explicit Discovery/Evidence handoffs.
- Optional Hub home surface and QA integration.
- Package/intake receipts and user-reviewed installation route.

Search providers, JavaScript, WebAssembly, service workers, broad media, WebRTC,
WebGPU, DRM, extensions, and full modern-web compatibility each require a
separate later capability and risk decision.
