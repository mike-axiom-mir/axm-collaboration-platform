# AXM Output Engine v0.1

The Output Engine is a shared service underneath existing AXM workspaces. It is
not another destination in the Hub.

- PDF generation runs in a browser Web Worker through Comlink.
- Image transforms run in a short-lived Node worker through wasm-vips.
- Cancel or timeout terminates the worker instead of leaving a hidden job alive.
- Every completed job returns an `axm.output-receipt/v1` receipt with engine,
  version, license, bytes, SHA-256, evidence and review state.
- Publish & Library receives every generated artifact as `INBOX`; output creation
  never approves or publishes it.

All bundled dependencies are permissive open source. The service does not use a
trial, subscription, account, remote conversion API or proprietary runtime.
The audited runtime builds and license notices are vendored under
`shared/vendor` so both private and public-safe Workshop packages work offline;
`node_modules` is not required at runtime.
