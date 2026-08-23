# AXM Structure View contract

## Purpose

The Structure View is a reversible, deterministic representation of the
semantic Page Model. It exists to prove that a human-visible body and headless
body can share one engine lineage without pretending to render site CSS or run
site behavior.

## Required lineage

| Stage | Typed contract | Binding |
|---|---|---|
| Input | `axm.web.source-record/v1` | Exact input byte length and SHA-256; bytes preserved in the core. |
| Syntax | `axm.web.document-tree/v1` | Bound to Source Record and Token Stream digests. |
| Semantics | `axm.web.page-model/v1` | Separate semantic extraction bound to the Document Tree. |
| Structure | `axm.web.structure-layout/v1` | Bound to source, document, and Page Model digests. |
| Paint plan | `axm.web.display-list/v1` | Bound to the Structure Layout digest; no active content or external resources. |
| Change receipt | `axm.web.modification-ledger/v1` | Before/after source digests are identical; discard is the reversal operation. |
| File write | `axm.web.artifact-receipt/v1` | Binds output bytes to the same Page Model, layout, Display List, and ledger. |

The `layout`, `display`, `render-svg`, and `browser-snapshot` commands all
call `src/engine.js`. No frontend owns a tokenizer, tree builder, or Page Model
copy.

## Structure Layout

The experimental layout serializes common Page Model structures as ordered,
bounded cards. Ordering follows source node references. Text wraps using a
deterministic monospace estimate; it does not measure host fonts or implement
CSS. Long address/title chrome may be visually elided while the complete value
remains in the typed layout and Source Record.

Default bounds:

- viewport: `1120x760`; allowed width `640..2400`, height `320..2160`;
- semantic items: `512`;
- structure text: `65,536` characters;
- derived canvas height: `32,768` pixels.

Limit failures are typed and visible. They do not silently drop blocks.

## Visual outputs

- SVG: escaped text plus a fixed command vocabulary of rectangles, lines, and
  text. It contains no anchors, scripts, foreign objects, events, or external
  resource references.
- HTML: an inert wrapper around the exact SVG derived from the Display List,
  with a deny-by-default CSP and a visible lineage receipt.

These are static snapshots. No claim is made for live navigation, windowing,
clicking, history, tabs, site CSS, responsive site behavior, page scripts,
remote resources, or pixel identity across host font/rendering stacks.

## Reversal and authority

The Structure View never edits source bytes. Reversal is to discard it and
reparse the caller-supplied bound source. The package receives no network,
provider, Workshop, Foundation, registry, Hub, server, installer, promotion, or
canon authority.
