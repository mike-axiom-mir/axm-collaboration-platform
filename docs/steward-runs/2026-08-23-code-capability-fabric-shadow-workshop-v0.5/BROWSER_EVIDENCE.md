# Browser evidence

Status: `PASS` for the claims listed below.

The trusted loopback review shell was rendered in the in-app browser from the
live detached canonical-Workshop draft.

Observed:

- title: `AXM Workshop Shadow Draft · TEST`
- visible headline: `One current snapshot. One detached draft.`
- visible boundary: `Not installed · no source write-back · no candidate execution`
- visible finding: `TOOLS_INDEX_SOURCE_DIGEST_STALE`
- visible counts: 232 tools, 232 valid contracts, 232 top selftests, 2200 capabilities
- the `Show exact boundary controls` disclosure was clicked and opened
- opened controls visibly denied source write-back, candidate execution,
  install, integration, publication, promotion, and CANON; authority was `NONE`
- browser console errors after the final render: 0

The browser client blocked direct navigation to the JSON response. Therefore,
this run does not claim that the candidate-JSON link navigation passed in the
browser. The focused HTTP selftest separately proved that the allowlisted JSON
route returns the exact inert candidate bytes, rejects POST, traversal, and
evidence routes, and starts zero candidate processes.

No screenshot or browser log was retained durably. The bounded claims above are
the curated evidence summary.

