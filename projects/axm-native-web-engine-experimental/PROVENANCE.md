# Provenance

## Build origin

This package was authored as a detached working-chat implementation for Mike /
Axiom-Mir from `AXM_NATIVE_WEB_ENGINE_WORKING_CHAT_HANDOFF_2026-08-23.txt`.

Repository reconnaissance used the connected GitHub repository at exact main
checkpoint `fd6ec98a6a98a6666a980c359730ccec57a8cbe9`. The inspected source blobs
are listed in `RECONNAISSANCE_MAP.md`.

## Code donors

No Chromium, Firefox, WebKit, Servo, Ladybird, or other browser-engine source
was copied into this package. No external npm dependency is used.

The high-level staged architecture follows the working handoff's source-grounded
lessons: source bytes, tokenization/tree construction, semantic representation,
style/layout, display list, and multiple output bodies remain separate. The
Structure Layout, Display List, SVG renderer, HTML snapshot, and ledger in the
second steward pass were authored specifically for this detached package; no
external rendering source or dependency was introduced. Those architecture
references are not evidence that this experimental subset conforms to the named
standards or engines.

## License boundary

This package adds no separate license grant. It remains under the repository's
current `LICENSE_STATUS.md`: public visibility supports inspection and personal
experimental evaluation but is not by itself a broad open-source license.
