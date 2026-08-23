# Roadmap with evidence gates

This roadmap records sequence; it grants no installation or promotion authority.

## Completed experimental slice — offline semantics + AXM Structure View

- Digest-bound local source, tokenizer/tree subset, separate Page Model.
- Headless semantic, structure-layout, and Display List outputs.
- Shared semantic Structure Index, compact headless outline, and responsive
  human document map over one digest lineage.
- Source-ordered bounded Structure Layout with no CSS/site-rendering claim.
- Renderer-neutral rectangle/line/text Display List.
- Inert SVG and HTML snapshots consuming that Display List.
- Trusted same-document outline anchors; original page targets remain inert.
- Reversible Modification Ledger and explicit artifact receipts.
- Explicit local multi-page bundle over the same per-page Structure Index
  lineage.
- Deterministic headless session actions, bounded history, back/forward,
  allowlist-only address navigation, focus/scroll entry state, and source-
  reparsing reload receipts.
- Ephemeral `127.0.0.1` human Browser Shell using the same server-owned session
  state machine, with a capability path and hash-bound trusted controller.
- Provider-neutral Search Broker contracts for normalized search queries,
  non-executing request plans, normalized results, and deterministic federated
  result fusion over SearXNG / Brave / Kagi adapters.

Gate status: focused fixtures, deterministic goldens/examples, local schema
identity checks, independent Draft 2020-12 validation, source manifest,
bounds/refusal tests, static Structure View inspection, bounded local-shell
interaction evidence, search-adapter fixtures, and search-fusion tests pass.
Status remains `EXPERIMENTAL`.

## Next cheapest hardening step

- Run local intake verification from a clean checkout.
- Add selected tokenizer/tree conformance cases and a fuzz/resource plan.
- Add provider-response drift fixtures for the search adapters.
- Decide whether to migrate the core to Rust now or after style/layout contracts
  stabilize; preserve exact cross-implementation fixtures and digests where the
  contract allows.

Gate: clean local reproduction, declared fixture matrix, independent schema
validation, fuzz/resource plan, provider-drift evidence, and no loss of Source
Record / Document Tree / Page Model separation.

## Site style and layout — held

- CSS tokenizer/parser subset.
- Selector matching, cascade provenance, inheritance, and computed style.
- Site styles and AXM/user overrides remain distinguishable.
- Block/inline box generation and deterministic site Layout Tree.

Gate: golden CSS/layout fixtures, cascade provenance tests, resource limits,
and explicit unsupported matrix. The current Structure Layout does not satisfy
this gate.

## Search execution broker — partial / network execution held

Implemented without execution authority:

- normalized `axm.web.search-query/v1` contract;
- SearXNG, Brave Search API, and Kagi Search API request adapters;
- credential-reference-only plans (no key values);
- deterministic provider selection / explicit provider lists;
- normalized provider result sets;
- HTTP(S)-only result URL normalization with common tracking-parameter removal;
- deterministic Reciprocal Rank Fusion with provider-agreement metadata and a
  bounded per-domain cap.

Still held before either human or headless browser can actually search:

- the outbound network executor itself;
- explicit endpoint allowlists / SearXNG endpoint trust policy;
- credential resolution and redacted execution receipts;
- timeout, cancellation, response-byte, query-count, and spend budgets;
- provider error/rate-limit normalization and retry policy;
- visible human/AI disclosure of which providers were queried and what each
  query cost or exposed externally;
- result-page fetching/opening.

Gate: transport threat review, provider fixtures, credential non-leak tests,
endpoint/redirect/size/timeout refusal corpus, cost/network receipts, and an
explicit user/host authority decision. Search planning alone grants none of
this authority.

## Brokered network intake — held

- Explicit URL request contract, HTTP/HTTPS adapter, redirects, MIME, encoding,
  resource budgets, and provenance receipts.
- No provider key or Workshop authority in the content route.
- Define real isolation before public hostile input is enabled.

Gate: redirect/size/timeout/encoding/hostile-URL corpus, authority review, and a
visible declaration of every boundary not yet isolated.

## Navigation and live browser shell — partial

- Explicitly bundled local pages now have a process-owned lifecycle, resolved
  links, history, back/forward, source-reparsing reload, an allowlist-only
  address surface, stable entry focus/scroll state, and explicit shutdown.
- The trusted loopback human shell and headless `session` command act on the
  same session object and typed transition trace.
- The shell has bounded shell-only visual themes, density/text controls,
  focus-reading mode, metadata visibility, and semantic-entry filtering.
- Still held: native file-picker authorization, restore after process loss,
  downloads, editable page controls, richer accessibility behavior, compositor
  ownership, crash containment, and post-commit lifecycle fault containment.
- Tabs only after lifecycle cleanup and isolation evidence are solid.

The generated static document map remains separate: it navigates only between
entries inside one already-derived snapshot and owns no page lifecycle.

## Bounded Workshop seams — held

- Explicit Discovery/Evidence handoffs.
- Optional Hub home surface and QA integration.
- Package/intake receipts and user-reviewed installation route.

JavaScript, WebAssembly, service workers, broad media, WebRTC, WebGPU, DRM,
extensions, and full modern-web compatibility each require a separate later
capability and risk decision.
