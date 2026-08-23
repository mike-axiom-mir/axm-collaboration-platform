# AXM Search Provider Contract — swappable research seam

Status: `EXPERIMENTAL`  
Installed: `false`  
Promoted: `false`  
Canon: `false`

This contract separates **search intent**, **provider choice**, **network execution**, **provider response parsing**, and **result fusion**.

The Search Broker in `src/search-broker.js` is non-executing: it normalizes queries, chooses providers, constructs bounded request descriptors, normalizes supplied provider responses, and merges normalized result sets. Every plan reports `networkExecutionGranted: false`.

The Search Executor in `src/search-executor.js` is a separate capability. It executes only a digest-valid plan when the caller supplies the exact authority token `EXPLICIT_ALLOW`. It does not grant page navigation, trust result content, install anything, promote anything, or canonize anything.

## Why a provider seam instead of one default engine

Research quality, privacy, independence, and cost differ by task. AXM should not make one search company an architectural root.

The first adapters are:

- **SearXNG** — configurable/self-hostable meta-search endpoint; useful as a local/private default when a trusted instance exists.
- **Brave Search API** — fixed adapter for an independent web index.
- **Kagi Search API** — fixed adapter for premium search results.

These names are adapters, not endorsements or permanent dependencies. More providers can be added behind the same normalized contracts without changing the browser/session model.

## Normalized query

`axm.web.search-query/v1` bounds the common request surface:

- query: 1–400 characters and no more than 50 whitespace-separated words;
- result count: 1–20;
- page: 1–10;
- language and optional two-letter country;
- optional freshness: day / week / month / year;
- safe search: off / moderate / strict;
- bounded SearXNG categories / engine selectors;
- `single` or `federated` mode;
- explicit provider, explicit provider list, or `auto`.

Provider-specific features outside this intersection stay provider-specific until intentionally modeled. The broker does not silently reinterpret unsupported parameters.

## Provider configuration and secrets

A request plan may contain a **secret reference name**, never the secret value.

Current credential references:

- Brave: `BRAVE_SEARCH_API_KEY` -> `X-Subscription-Token`;
- Kagi: `KAGI_API_TOKEN` -> `Authorization: Bot ...`;
- SearXNG: no credential in the baseline adapter; endpoint is explicitly configured.

`search-plan` never reads API-key values. `search-execute` resolves a referenced secret only while materializing the outbound request header. The value is never copied into the execution receipt, normalized result set, plan, or error details.

## Explicit executor gate

Actual outbound requests require:

```text
networkAuthority = EXPLICIT_ALLOW
```

The execution CLI exposes that as `--allow-network`. Without it, execution fails before transport.

Additional boundaries:

- maximum 3 provider requests per plan;
- default timeout 8 seconds per provider; configurable only from 100–60,000 ms;
- default response ceiling 1 MiB per provider; configurable only from 1 KiB–8 MiB;
- redirects are refused (`redirect: error`);
- credentials/cookies are omitted;
- response must be JSON and valid UTF-8;
- fixed-provider endpoints are pinned exactly to Brave `/res/v1/web/search` and Kagi `/api/v1/search`;
- SearXNG execution requires the exact configured endpoint to appear in the executor allowlist;
- no automatic retry;
- `require-all` is the default failure mode; optional `best-effort` preserves provider failures and returns `PARTIAL` only when at least one provider succeeds.

The executor emits `axm.web.search-execution/v1` with provider status, HTTP status for successes, response byte count/digest, normalized result count, provider success/failure lists, cost estimate, result-set digest, and closed authority flags.

## Transparent external API cost estimate

The execution receipt currently estimates the published per-request API price used by the adapter:

- SearXNG: `$0` external API charge in the baseline adapter (self-hosting/infrastructure cost is separate and not claimed as zero);
- Brave Search: `$0.005` per request (`$5 / 1,000`);
- Kagi Search v1: `$0.012` per query (`$12 / 1,000`).

These are descriptive constants, not billing authority. Provider pricing can change and must be reviewed before a cost-sensitive deployment. A failed external request may still be billable, so the receipt treats each attempted provider as potential cost rather than claiming a successful-response-only bill.

## Federated research mode

`federated` mode can plan several configured providers for one normalized query. Provider responses are normalized separately and can then be merged with deterministic Reciprocal Rank Fusion (RRF).

The current merge:

1. accepts only normalized result sets for the same query;
2. canonicalizes HTTP(S) URLs and removes common tracking parameters;
3. rejects non-HTTP(S) result targets and credential-bearing result URLs;
4. combines duplicate URLs across providers;
5. scores each URL with `1 / (k + provider_rank)`, default `k=60`;
6. records provider agreement and original per-provider ranks;
7. applies a bounded per-domain result cap, default 3;
8. returns a new digest-bound normalized result set.

This is a deterministic research convenience, not a truth score. Agreement between search providers can improve discovery diversity but does not make a result factual.

## Provider response normalization

Current parsers accept the known web-result shapes for:

- SearXNG JSON `results[]`;
- Brave `web.results[]`;
- Kagi Search `data[]` entries with `t === 0`.

Normalized results preserve title, HTTP(S) URL, plain-text snippet, optional publication value, provider identity, and provider-specific ranks/engine names where available.

Provider HTML fragments are converted to plain text. Result URLs do not grant navigation authority. Live provider-response drift still needs periodic fixtures because external APIs can evolve independently of AXM.

## Headless examples

Plan without network:

```bash
node scripts/search-plan.js "browser agent research" \
  --mode federated \
  --searxng http://127.0.0.1:8888/search \
  --brave \
  --kagi \
  --pretty
```

Execute only after explicit authorization:

```bash
BRAVE_SEARCH_API_KEY=... \
node scripts/search-execute.js "browser agent research" \
  --provider brave \
  --brave \
  --allow-network \
  --pretty
```

Local/self-hosted SearXNG:

```bash
node scripts/search-execute.js "local-first AI browser" \
  --provider searxng \
  --searxng http://127.0.0.1:8888/search \
  --allow-network \
  --pretty
```

## Explicitly held

The Search Executor still does **not** grant or implement:

- arbitrary URL fetching or arbitrary web navigation;
- redirects;
- provider-key storage;
- automatic/background searches;
- automatic search from the human Browser Shell;
- result-page fetching/opening;
- downloads, cookies, or page resource loading;
- treating snippets, provider agreement, or ranking as verified truth;
- automatic retries, provider failover policy beyond explicit best-effort mode, or quota management;
- comprehensive DNS-rebinding/private-address isolation for remotely configured SearXNG endpoints;
- installation, promotion, merge, or canon authority.

Before connecting search results to page fetching or arbitrary browsing, the separate Brokered Network Intake gate still requires redirect/host/address controls, MIME/encoding policy, stronger hostile-response tests, provenance receipts, and explicit authority review.
