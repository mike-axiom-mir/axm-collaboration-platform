# AXM Exposure Search — EXPERIMENTAL

Exposure Search adds a bounded Shodan-backed internet-exposure research surface to the AXM browser.

It is deliberately **discovery-only**:

- Shodan `/shodan/host/count` and `/shodan/host/search` only
- no Shodan scan endpoint
- no automatic host-detail drill-down
- no socket connection to returned systems
- no credential testing
- no exploit execution
- no bundled vulnerable-target / “dork” directory
- no raw banner rendering by default
- first search page only, maximum 20 normalized asset rows
- explicit network authority required for every execution

## Configuration

```js
const host = await LocalBrowserHost.createLocalBrowserHost(session, {
  exposureLab: true,
  exposureConfig: {
    searchConfig: {
      shodan: {
        enabled: true,
        secretEnv: 'SHODAN_API_KEY'
      }
    },
    networkAuthority: 'EXPLICIT_ALLOW'
  }
});

console.log(host.exposureLabUrl);
```

The Shodan API key is a **secret reference** in the plan. The value is materialized only into the outbound Shodan request query string at the executor boundary because that is the API transport required by Shodan. The secret value is not copied into plans, normalized result sets, receipts, UI state, or errors.

## Modes

### Count / facets

Uses Shodan host count. This returns totals and optional bounded facets without asset rows.

Supported AXM facet names:

- `country`
- `org`
- `asn`
- `port`
- `product`
- `os`

At most 3 facets are accepted per request.

### First-page assets

Uses Shodan host search, fixed to page 1 and a maximum of 20 normalized rows. AXM requests an explicit safe metadata field set and omits the raw Shodan banner body from its normalized result contract.

Normalized fields include IP, port, transport, product/version, organization/ISP/ASN, hostnames/domains, coarse location labels, timestamp, OS, CPEs and tags.

## Query syntax

Exposure Search passes the user-entered search expression to Shodan, including normal Shodan `filter:value` syntax.

AXM does **not** ship an exploit-oriented query pack or saved-query directory. The browser treats every returned record as untrusted discovery metadata, not permission to access the system described by that record.

## Authority model

Exposure Search never grants:

- active scanning
- target connection
- authentication attempts
- credential testing
- exploitation
- arbitrary navigation
- installation, promotion, or canon

Those are separate capabilities and remain held.
