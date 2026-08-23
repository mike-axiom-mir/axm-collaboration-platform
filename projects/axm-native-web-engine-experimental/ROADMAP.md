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
- Separate bounded Search Executor with explicit network-authority gate, fixed
  Brave/Kagi endpoints, exact SearXNG endpoint allowlist, secret redaction,
  timeout/response limits, no redirects, and execution receipts.

Gate status: focused fixtures, deterministic goldens/examples, local schema
identity checks, independent Draft 2020-12 validation, source manifest,
bounds/refusal tests, static Structure View inspection, bounded local-shell
interaction evidence, search-adapter/fusion fixtures, and injected-transport
search-execution tests pass. Status remains `EXPERIMENTAL`.

## Next cheapest hardening step

- Run local intake verification from a clean checkout.
- Add selected tokenizer/tree conformance cases and a fuzz/resource plan.
- Add live provider-response drift fixtures for the search adapters without
  committing credentials or raw private query history.
- Add DNS/address policy before trusting non-loopback SearXNG endpoints.
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

## Search execution broker — partial

Implemented:

- normalized `axm.web.search-query/v1` contract;
- SearXNG, Brave Search API, and Kagi Search API request adapters;
- credential-reference-only plans (no key values);
- deterministic provider selection / explicit provider lists;
- normalized provider result sets;
- HTTP(S)-only result URL normalization with common tracking-parameter removal;
- deterministic Reciprocal Rank Fusion with provider-agreement metadata and a
  bounded per-domain cap;
- separate `axm.web.search-execution/v1` executor/receipt;
- explicit `EXPLICIT_ALLOW` / `--allow-network` execution gate;
- maximum three provider requests per plan;
- fixed Brave/Kagi endpoints and exact SearXNG endpoint allowlist;
- secret resolution only into outbound headers, never receipts/results;
- no redirects, cookies, or credential forwarding;
- bounded timeout and JSON response bytes;
- `require-all` and explicit `best-effort` failure modes;
- transparent estimated external API cost per attempted provider.

Still held:

- automatic search from the normal human Browser Shell;
- background/continuous search;
- live provider compatibility certification beyond fixture shapes;
- provider quota/rate-limit orchestration and automatic retry policy;
- comprehensive DNS-rebinding/private-address policy for remote SearXNG;
- result-page fetching/opening;
- treating provider output as verified truth.

Gate before broader exposure: live provider fixtures, credential non-leak tests,
DNS/address threat review, visible provider/cost disclosures, and explicit host
policy for whether the normal browser may invoke search. Search execution does
not grant arbitrary page navigation.

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
