# AXM reference validators

Reference validators are shared evidence tools, not creation hands. They do not
edit artifacts, choose a design, approve publication or upgrade the authority of
the hand that created an asset.

The registry matches all four inputs before execution:

`exact claim + artifact MIME + target-canvas medium + installed verifier`

It never substitutes a lower assurance level. A pypdf structural parse can
satisfy `pdfx.bounded-structure`; it cannot satisfy
`pdfx.external-conformance`. If an exact provider or its runtime is absent, the
result is a visible `MISSING_VALIDATOR` receipt.

## Installed provider contracts

| Provider | Exact claim | Assurance | Runtime |
|---|---|---|---|
| `python-pypdf-structure` | `pdfx.bounded-structure`, `pdf.tagged-structure` | Structural corroboration, not PDF/X or PDF/UA certification | Python + pypdf |
| `python-lxml-musicxml-structure` | `musicxml.structure` | Separate libxml2-backed structural parse | Python + lxml |
| `python-lxml-w3c-musicxml-xsd` | `musicxml.w3c-xsd` | MusicXML 4.0 schema conformance | Python + lxml + configured official schema root |
| `python-openusd-compliance-checker` | `openusd.usdchecker` | Official OpenUSD `UsdUtils.ComplianceChecker` | Python + `usd-core` |
| `openusd-usdchecker` | `openusd.usdchecker` | Official OpenUSD command-line checker | `usdchecker` executable |
| `w3c-epubcheck` | `epub.w3c-epubcheck` | Official EPUB conformance checker | W3C EPUBCheck command + Java |

The two OpenUSD providers express the same claim. The registry prefers the
official Python API when both are installed and records the exact provider and
runtime version that actually ran.

## Configuration

Nothing is downloaded or installed automatically. A host can configure:

- `AXM_REFERENCE_PYTHON`: Python executable;
- `AXM_REFERENCE_PYTHONPATH`: optional package root, for example a separately
  managed `usd-core` installation;
- `AXM_MUSICXML_XSD`: official `musicxml.xsd` with `xml.xsd` and `xlink.xsd`
  beside it;
- `AXM_USDCHECKER`: official `usdchecker` executable;
- `AXM_EPUBCHECK`: W3C EPUBCheck command.

Equivalent constructor options are available for hosts that do not use process
environment configuration. Commands are invoked without a shell, with bounded
time/output and an isolated temporary artifact that is deleted after the run.
Receipts contain no staging path and declare `network_used: false`.

## Receipts and handoffs

`axm.reference-validation-receipt/v1` binds:

- the portable artifact digest and a fresh SHA-256 of the exact finished bytes;
- the portable target-canvas digest and a canonical SHA-256 of that canvas;
- exact claim and assurance scope;
- validator identity, version, implementation and independence basis;
- runtime availability/version and the executed checks.

`axm.asset-verification-envelope/v1` binds a group of receipts to the immutable
Asset Hand result ID and digest. `attachEnvelope()` adds that envelope only as an
optional `reference_validation` property on a clone. Old records remain valid;
Asset Fabric, Studio and the shared handoff broker preserve the optional field.

## Verification

Portable deterministic checks:

```text
node shared/asset-hands/reference-validators/selftest.js
```

Real Python checks, with optional authoritative validators:

```text
node shared/asset-hands/reference-validators/real-runtime-selftest.js \
  --python <python> \
  [--python-path <usd-core-root>] \
  [--musicxml-xsd <musicxml.xsd>] \
  [--usdchecker <usdchecker>] \
  [--epubcheck <epubcheck>]
```

The real-runtime test is deliberately not in portable `npm test`: public clones
must not depend on a private machine path or silently install native validators.
