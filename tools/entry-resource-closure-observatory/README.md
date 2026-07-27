# AXM Entry Resource Closure Observatory

Integrated `TEST` module. It inspects the manifest-declared human HTML
entry of each top-level Workshop module. v0.2 keeps the original direct
metadata-only closure and adds a separately bounded transitive static graph.

## What it owns

- parsing quoted `src`, `href`, `poster`, and `data` attributes on `script`,
  `link`, `img`, `source`, `audio`, `video`, and `object` tags;
- resolving safe local paths against the HTML entry or Workshop root;
- distinguishing present files, missing static targets, unsafe paths, refused
  symlinks, remote URLs, inline/runtime schemes, fragments, encoded paths, and
  visibly dynamic references;
- following local HTML, CSS, and JavaScript text nodes through quoted HTML
  references, CSS `@import`/`url()` patterns, JavaScript import/export literals,
  literal dynamic imports, literal workers, and `importScripts`;
- hashing text nodes and recording directed cycles, depth/file/byte limits, and
  unresolved graph edges;
- freshness and source-scope receipts.

The direct v1 map reads manifests and declared HTML entry markup, then uses
metadata only for referenced files. The v0.2 graph reads bounded local HTML,
CSS, and JavaScript text bodies for hashing and textual pattern extraction.
Binary resource bodies are never read. A missing static target is not a claim
that a runtime route cannot serve that URL.

## Preserved adjacent owners

Dual Door Observatory retains door declaration and presence mapping. Browser,
LAN and Hardware QA Lab retains runtime loading and visual judgment. The
Workshop HTML syntax test retains inline-script compilation checks. Source
Connector and explicit network owners retain retrieval. Technical Glasses
retains readiness.

## Run

```text
node entry-resource-closure-cli.js --root /path/to/axm-workshop
node entry-resource-closure-cli.js --root /path/to/axm-workshop --output current-entry-resource-closure-map.json --browser-output current-entry-resource-closure-map.js --quiet
node entry-resource-graph-cli.js --root /path/to/axm-workshop --output current-entry-resource-graph.json --browser-output current-entry-resource-graph.js --quiet
node selftest.js --workshop-root /path/to/axm-workshop
node graph-selftest.js --workshop-root /path/to/axm-workshop
```

No file is written unless an output path is explicit. Syntax trees, `srcset`,
unquoted attributes, dynamic expressions, bare-package resolution, network
resources, browser behavior, rendering, execution, decoding, readiness, and
visual quality remain outside the graph.
