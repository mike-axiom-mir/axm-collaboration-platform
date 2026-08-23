# Known limits — part of the build

Status language here is deliberate. A preserved node is not the same as full
standards behavior.

## Parser and document model

- The tokenizer and tree builder implement a bounded Phase 1 subset, not the
  WHATWG parsing algorithm.
- Only UTF-8 input is accepted. Encoding sniffing and legacy encodings are held.
- Source offsets count JavaScript UTF-16 code units, not UTF-8 bytes.
- Named character references are limited to `amp`, `lt`, `gt`, `quot`, `apos`,
  and `nbsp`; numeric references are supported with invalid-codepoint refusal.
- The tree builder has only a small set of implicit-close rules. Adoption agency
  behavior, foster parenting, foreign content, templates, quirks modes, parser
  scripting hooks, and many error-recovery rules are absent.
- Namespace handling is absent. SVG and MathML remain held elements.
- Source locations describe this subset's tokens; they are not a promise of
  browser-devtools parity.

## Page Model

- Semantic extraction covers common headings, paragraphs, landmarks, links,
  images, lists, basic tables, forms, controls, metadata, and id targets.
- Accessible names are not fully computed. The first slice recognizes explicit
  `aria-label`, `label[for]`, and wrapping labels only where implemented.
- Table span math, header association, form validation, URL resolution,
  microdata, RDFa, Open Graph semantics, and accessibility-tree parity are held.
- Plain text is a deterministic convenience view, not a complete reading-order
  or screen-reader claim.

## Runtime and security

- No HTTP/HTTPS, DNS, redirects, cookies, cache, resource loading, or search.
- No JavaScript or WebAssembly execution. Script bytes are preserved as inert
  raw-text nodes and omitted from visible Page Model text.
- No CSS parsing, cascade, layout, display list, rendering, pixels, window,
  clicking, screenshots, downloads, tabs, or history.
- Node's managed runtime is not an OS sandbox. Process isolation, brokered
  decoders, renderer isolation, and operating-system policy remain held.
- The CLI reads an explicitly supplied local file or standard input. It does not
  establish that a future browser file picker or navigation gate is safe.
- Default limits are 1 MiB source, 100,000 tokens, 128 attributes per element,
  and 256 open tree levels. Those values are experiment defaults, not proven
  production-safe ceilings.

## Evidence ceiling

- Focused deterministic tests and goldens prove behavior only for their inputs.
- No Web Platform Tests ran.
- No differential comparison against established engines ran.
- No fuzzing, sanitizer, memory profiler, dependency advisory scan, browser
  render/click test, Windows test, Android test, or real hostile-web campaign ran.
- Repository-wide tests were not run because the full repository was not
  checked out in this working-chat runtime.
