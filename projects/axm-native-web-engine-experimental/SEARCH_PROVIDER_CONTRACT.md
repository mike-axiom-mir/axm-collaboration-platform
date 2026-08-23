# AXM Search Provider Contract — swappable research seam

Status: `EXPERIMENTAL`  
Installed: `false`  
Promoted: `false`  
Canon: `false`

This contract separates **search intent**, **provider choice**, **provider response parsing**, and **network execution**.

The search broker in `src/search-broker.js` is deliberately non-executing. It can normalize a query, choose one or more configured providers, construct bounded request descriptors, normalize provider responses supplied to it, and merge normalized result sets. It does not itself send a network request and a search plan explicitly reports `networkExecutionGranted: false`.

## Why a provider seam instead of one default engine

Research quality and privacy goals differ by task. AXM should not make one search company an architectural root.

The first adapters are:

- **SearXNG** — configurable/self-hostable meta-search endpoint; useful as the local/private default when a trusted instance exists.
- **Brave Search API** — fixed API adapter for an independent web index.
- **Kagi Search API** — fixed API adapter for premium search results and account-shaped ranking.

These names are adapters, not endorsements or permanent dependencies. More providers can be added behind the same normalized contracts without changing the browser/session model.

## Normalized query

`axm.web.search-query/v1` bounds the common request surface:

- query: 1–400 characters and no more than 50 whitespace-separated words
- result count: 1–20
- page: 1–10
- language and optional two-letter country
- optional freshness: day / week / month / year
- safe search: off / moderate / strict
- bounded SearXNG categories / engine selectors
- `single` or `federated` mode
- explicit provider, explicit provider list, or `auto`

Provider-specific features outside this intersection stay provider-specific until intentionally modeled. The broker does not silently reinterpret unsupported parameters.

## Provider configuration and secrets

A request plan may contain a **secret reference name**, never the secret value.

Current credential references:

- Brave: `BRAVE_SEARCH_API_KEY` -> `X-Subscription-Token`
- Kagi: `KAGI_API_TOKEN` -> `Authorization: Bot ...`
- SearXNG: no credential in the baseline adapter; endpoint is explicitly configured

The search-plan CLI never reads API-key values. A future network executor must resolve secret references at execution time and must not echo them into receipts, result sets, logs, or browser-visible state.

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

This is a deterministic research convenience, not a truth score. Agreement between search providers can raise discovery confidence but does not make a result factual.

## Provider response normalization

Current parsers accept the known web-result shapes for:

- SearXNG JSON `results[]`
- Brave `web.results[]`
- Kagi Search `data[]` entries with `t === 0`

Normalized results preserve title, HTTP(S) URL, plain-text snippet, optional publication value, provider identity, and provider-specific ranks/engine names where available.

Provider HTML fragments are converted to plain text. Result URLs do not grant navigation authority.

## Explicitly held

This search broker does **not** yet grant or implement:

- arbitrary outbound HTTP/HTTPS execution;
- provider-key storage;
- automatic provider billing/spend authority;
- automatic search from the human Browser Shell;
- result-page fetching or opening;
- redirects, downloads, cookies, or page resource loading;
- treating snippets or provider ranking as verified truth;
- background/continuous research;
- installation, promotion, merge, or canon authority.

The next network step must be a separate bounded executor with endpoint allowlists, time/byte/result budgets, explicit secret resolution, redacted receipts, cancellation/timeouts, and clear cost/network indicators before it is connected to either the normal or headless browser body.

## Headless planning examples

```bash
node scripts/search-plan.js "local-first AI browser" \
  --provider searxng \
  --searxng http://127.0.0.1:8888/search \
  --pretty

node scripts/search-plan.js "browser agent research" \
  --mode federated \
  --searxng http://127.0.0.1:8888/search \
  --brave \
  --kagi \
  --pretty
```

Both commands only build plans. They do not make network requests.
