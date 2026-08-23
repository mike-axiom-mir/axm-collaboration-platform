# Known limits — part of the build

Status language is deliberate. A preserved node or visible card is not the
same as full standards behavior.

## Parser and document model

- The tokenizer and tree builder are a bounded subset, not the WHATWG parsing
  algorithm.
- Only UTF-8 is accepted. Encoding sniffing and legacy encodings are held.
- Source offsets count JavaScript UTF-16 code units, not UTF-8 bytes.
- Named references are limited to `amp`, `lt`, `gt`, `quot`, `apos`, and
  `nbsp`; numeric references have bounded invalid-codepoint handling.
- Adoption-agency behavior, foster parenting, foreign content, templates,
  quirks modes, parser scripting hooks, namespaces, and many recovery rules are
  absent. SVG and MathML in input remain held elements.

## Page Model

- Extraction covers common headings, paragraphs, landmarks, links, images,
  lists, basic tables, forms, controls, metadata, and id targets.
- Accessible names, table-span math, header association, validation, URL
  resolution, structured data, and accessibility-tree parity are incomplete.
- Plain text is a deterministic convenience view, not a complete reading-order
  or screen-reader claim.

## Structure View and renderer

- Structure Layout is AXM-authored card layout over the semantic Page Model. It
  is not CSS parsing, selector matching, cascade, computed style, box layout,
  site rendering, or page-responsive behavior.
- Node-reference ordering is deterministic for extracted structures, but the
  Page Model does not retain every source node as a visual block.
- Text wrapping uses fixed character estimates. Host rasterizers may substitute
  fonts, so pixel identity across machines is not claimed.
- Title/address chrome can be visually elided to fit; complete values remain in
  typed core output.
- Image URLs become labeled placeholders. Links and form targets become inert
  text. No resource is fetched and nothing can be clicked or submitted.
- SVG and local HTML are static snapshots. There is no live window, scrolling
  controller, focus model, interaction, navigation, tabs, history, download,
  screenshot API, or compositor.

## Runtime and security

- No HTTP/HTTPS, DNS, redirects, cookies, cache, resource loading, or search.
- No JavaScript or WebAssembly execution. Script bytes remain inert raw-text
  nodes and are omitted from visible Page Model text.
- Node's managed runtime is not an OS sandbox. Process/site isolation, brokered
  decoders, renderer isolation, and operating-system policy remain held.
- The CLI reads a caller-supplied local file or standard input. Visual writes
  use a caller-selected file and bounded refusal checks; this is not a general
  safe file-picker or privileged-host proof.
- Defaults are 1 MiB source, 100,000 tokens, 128 attributes per element, 256
  open tree levels, 512 structure items, 65,536 structure-text characters, and
  32,768 derived canvas pixels. They are experimental bounds, not proven
  production-safe ceilings.

## Evidence ceiling

- Focused deterministic tests and goldens prove behavior only for their inputs.
- No Web Platform Tests, differential engine comparison, fuzzing, sanitizers,
  memory profiling, hostile-web campaign, accessibility audit, or real browser
  render/click test ran.
- Static raster inspection covers one wide simple fixture and one narrow
  adversarial fixture. It does not prove motion, interaction, host-independent
  pixels, Windows/Android behavior, or arbitrary pages.
- Repository-wide tests were not run because the full repository was not
  checked out in this working-chat runtime.
