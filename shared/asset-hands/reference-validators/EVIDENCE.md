# Reference validator evidence route

Audit date: 2026-07-19. External test substrates remained outside the
repository. No private runtime path or raw command log is part of this receipt.

## `exact-routing-and-missing-state`

- Claim: only a provider matching the exact claim, MIME and target canvas can
  run, and missing substrate remains visible.
- Kind/risk: deterministic behavior; high because an overclaim would upgrade
  artifact trust.
- Pass condition: correct tuples pass; wrong MIME/canvas returns
  `UNSUPPORTED_ARTIFACT`; unknown claim or absent runtime returns
  `MISSING_VALIDATOR`; no lower-assurance provider satisfies a stronger claim.
- Primary evidence: `reference-validators/selftest.js`.
- Counterevidence: pypdf satisfying `pdfx.external-conformance`, or missing
  EPUBCheck returning PASS.
- Verdict: **PASS**.

## `receipt-binding`

- Claim: every executed or missing result binds the finished artifact and target
  canvas without exposing staging paths.
- Kind/risk: transport/static structure; high.
- Pass condition: portable digest plus fresh artifact SHA-256, portable canvas
  digest plus canonical canvas SHA-256, validator/runtime identity and checks
  are present; altered bytes or canvas change the corresponding SHA-256.
- Primary evidence: receipt schema, deterministic tamper tests and public-path
  assertions.
- Verdict: **PASS**.

## `musicxml-second-implementation`

- Claim: generated MusicXML is independently parseable and conforms to the
  official MusicXML 4.0 XSD when that schema substrate is configured.
- Primary evidence: lxml 6.0.2 structural parser and XMLSchema engine.
- Secondary evidence: official W3C MusicXML 4.0 schema snapshot. Audited hashes:
  `musicxml.xsd` `bfe37ed25a9ec00e6f2591d53df260b84efe12aed209ba3ac0a76f9287665a99`,
  `xlink.xsd` `6e601f8eeb41618b50e4c7f944dff754e57ea43b602755470dda24c9c2f6df92`,
  `xml.xsd` `616a3077df5cfc954ac74a75abe9697b95eef7a85dbe09367d995a483e840eb5`.
- Observed counterevidence: the first XSD run rejected AXM's `<velocity>` child
  inside every `<note>`. The writer was corrected to omit the non-schema child;
  its existing structural/timing suite and the official XSD then both passed.
- Verdict: **PASS**.

## `openusd-official-checker`

- Claim: generated USDZ opens and passes rules in an official OpenUSD checker,
  independently of the JavaScript package writer.
- Primary evidence: `usd-core` 26.5
  `pxr.UsdUtils.ComplianceChecker` against a generated five-layer USDZ.
- Counterevidence: a changed root-layer byte with a stale package CRC.
- Observed evidence: the generated package passed; the changed package failed.
- Verdict: **PASS**.

## `pdf-structural-corroboration`

- Claim: generated tagged PDF and bounded PDF/X artifacts are independently
  parseable, and their relevant catalog/page structures are visible to a second
  PDF implementation.
- Primary evidence: pypdf 6.10.0 strict parser.
- Observed evidence: tagged structure tree, marked document and language passed;
  PDF/X output intent/profile reference, identifier, page boxes and font-free
  bounded profile passed.
- Named seam: pypdf is not a PDF/X or PDF/UA certification engine. The stronger
  claims stay `MISSING_VALIDATOR`.
- Verdict: **PASS** for structural corroboration; **MISSING** for external
  certification.

## `epub-authoritative-checker`

- Claim: W3C EPUBCheck can be invoked through the same bounded registry when
  installed.
- Evidence: deterministic provider tests plus the pinned Temurin 21 / W3C
  EPUBCheck 5.3 live corpus. A generated EPUB passes and a digest-bound damaged
  publication fails in separate fresh JVM processes.
- Named seam: the older environment-variable reference provider remains
  optional; the shared substrate inventory is the authoritative installed
  route for the new upgrade registry.
- Verdict: **PASS** for the live generated/damaged corpus on the audited local
  pack; **MISSING_VALIDATOR** remains correct on machines without the exact pack.

## `host-handoff-and-compatibility`

- Claim: optional reference evidence survives Asset Fabric, Studio and generic
  handoffs without making old state require the new field.
- Primary evidence: Asset Fabric state/review tests, Studio handoff/sourceAsset
  tests and broker binding tests.
- Secondary evidence: existing legacy SVG, raster distinction and old saved
  Asset Fabric state tests.
- Verdict: **PASS**.

## `release-gate-2026-07-19`

- Focused completion gate: **PASS**. All 35 executable Asset Hands, legacy SVG,
  non-SVG output distinction, native adapters and reference-validator
  adversaries passed.
- Integration gates: Workshop, Operations and Foundation suites **PASS**.
  The Workspace suite passed through 177 game/world tests before an unrelated
  live Foundation Planet edit exposed a v7 engine schema while its selftest
  still expected v6. Every remaining workspace command was then run separately
  and **PASS**, including Asset Fabric, Studio, handoffs, discovery and global
  HTML syntax.
- Top-level verifier: initially blocked because the concurrently edited
  `tools/ps2-asset-forge` directory did not yet contain its required
  `manifest.json`; after its owner supplied the manifest, the verifier rerun
  completed with **0 FAIL**. No file in either foreign lane was changed by this
  work.
- Publication scan: **PASS**. No private user/download/cache path, Python
  bytecode or credential-like value was found in the release lane; all changed
  JSON files parsed and all 72 local schema references resolved.
- Release interpretation: the Asset Hands v2.5 validator slice and top-level
  verifier are green. The composite repository-wide command is not claimed
  green until the Foundation Planet owner reconciles its v7 engine constant
  with the selftest that still expects v6.

Official references: [OpenUSD toolset](https://openusd.org/dev/toolset.html),
[MusicXML 4.0](https://www.w3.org/2021/06/musicxml40/), and
[W3C EPUBCheck CLI](https://w3c.github.io/epubcheck/docs/cli/).
