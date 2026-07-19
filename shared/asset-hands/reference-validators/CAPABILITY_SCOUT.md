# Reference validator capability scout

## Requested outcome

Corroborate important Asset Hand format claims with implementations that are
separate from the writer, bind their evidence to the exact artifact and target
canvas, and expose missing verifier substrate without weakening the request or
the claim.

## Pre-build route

`DEGRADED`: the repository had strong writer-adjacent bounded parsers but no
shared reference-validator registry or receipt envelope. Python 3.12 with lxml
and pypdf is available in the audited development runtime. `usdchecker`, Java,
and W3C EPUBCheck were not installed. Full PDF/X and PDF/UA certification is not
provided by pypdf or Poppler.

## Gap classification

- `CONTRACT`: no common artifact + claim + canvas matching contract.
- `EVIDENCE`: the same module often wrote and inspected a container.
- `SUBSTRATE`: authoritative OpenUSD and EPUB checkers are optional runtimes and
  were absent at audit time.
- `HAND`: no executable reference-validation service or result envelope.

## Cheapest honest route

Add a bounded Node registry with injected external-process runners; use a
separate Python implementation for structural PDF and MusicXML corroboration;
adapt official `usdchecker`, EPUBCheck and MusicXML XSD when installed; keep
conformance claims visibly missing when only structural corroboration exists.

The registry is not a creation hand and receives no authority to modify an
asset. It only emits evidence receipts.
