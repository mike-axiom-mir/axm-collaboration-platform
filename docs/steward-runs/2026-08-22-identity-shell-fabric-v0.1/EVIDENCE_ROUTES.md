# Claim-to-evidence routes

Status: `EXPERIMENTAL`

## `shell-static-contracts`

- Claim: the leaf contains strict, versioned contracts for identity, continuity, adapters, bodies, resources, blueprint, manifest, lineage, build/gaps, and human decisions.
- Kind/risk: static structure / medium.
- Pass condition: every declared schema parses, refuses undeclared object fields, and matches an executable strict normalizer exercised by fixtures.
- Primary surface: direct file and schema inspection.
- Counterevidence: missing schema, parse failure, open object shape, or fixture/normalizer mismatch.
- Secondary surface: focused schema inventory assertions in the selftest.
- Observed evidence: 11 public artifact schemas parsed; the selftest confirmed every public schema closes its root object; executable normalizers rejected extra/missing fields and coercion.
- Verdict: `PASS` for the declared v0.1 static contract scope.

## `shell-determinism`

- Claim: identical canonical inputs produce byte-identical manifests and digests.
- Kind/risk: deterministic behavior / high.
- Pass condition: repeated compilation and a rebuild verifier produce the same canonical result and manifest digest; altered results fail.
- Primary surface: focused execution with known inputs.
- Counterevidence: digest drift, input mutation, nondeterministic metadata, or replay accepting altered output.
- Secondary surface: independent manifest verifier and fresh-process focused test.
- Observed evidence: repeated compile and exact rebuild produced manifest digest `sha256:70e751d14cc655feb58fe279e24c1936353aa280ff971e71b5a673f8f12bfebf`; altered results failed; independent verifier returned `PASS`.
- Verdict: `PASS` for deterministic v0.1 compilation.

## `shell-authority-boundaries`

- Claim: component attachment cannot expand identity scope, permissions, resources, network, memory authority, actuation, inheritance, promotion, or CANON.
- Kind/risk: authorization / high.
- Pass condition: allowed inert attachments compile; denied expansion attempts fail with typed codes; UNKNOWN ceilings return HOLD.
- Primary surface: allowed/denied boundary tests.
- Counterevidence: any unauthorized compiled manifest or automatic authority truth flag.
- Secondary surface: independent manifest verifier over embedded descriptors and envelope totals.
- Observed evidence: focused denied tests covered permission, network, resource, memory, actuation, automatic inheritance, promotion, and CANON expansion; independent verifier checked embedded descriptor totals and truth flags.
- Verdict: `PASS` for the inert v0.1 authority boundary.

## `shell-continuity-lineage`

- Claim: accepted state reconstructs from ordered exact receipts; candidate memory remains candidate; forks, migrations, reconstruction, rollback, succession, and retirement stay distinct.
- Kind/risk: persistence and authorization / high.
- Pass condition: exact chains reconstruct, tampering/reordering/rollback mismatch fails, fork id reuse fails, hidden neural swaps fail, and succession without exact human-decision evidence returns HOLD.
- Primary surface: focused receipt reconstruction and lineage tests.
- Counterevidence: altered history accepted, candidate memory silently accepted, fork id reused, or succession made effective.
- Secondary surface: digest inspection of lineage/continuity sections in the independent verifier.
- Observed evidence: focused tests covered accepted reconstruction, candidate separation, altered/reordered history, rollback mismatch, fork id reuse, migration and reconstruction, disclosed adapter/body swaps, succession HOLD, and non-effective succession/retirement proposals.
- Verdict: `PASS` for the declared receipt and proposal semantics. Real human authorship authentication remains an explicit external gap.

## `shell-portable-private-export`

- Claim: exported manifests are canonical provider-independent JSON without machine paths, secrets, chats, sessions, raw prompts, hidden reasoning, or personal email-shaped data.
- Kind/risk: static structure and privacy / high.
- Pass condition: canonical export/import is byte exact and adversarial private/path/secret fields are refused.
- Primary surface: focused export/import and redaction tests.
- Counterevidence: non-canonical import accepted or forbidden data present in export.
- Secondary surface: independent recursive export scan.
- Observed evidence: canonical export/import was byte exact; machine paths, private-chat fields, email-shaped data, UUID-shaped session/record ids, non-canonical bytes, and digest substitution were refused; independent export scan passed.
- Verdict: `PASS` for the declared static export policy.

## `shell-runtime-absence`

- Claim: v0.1 does not load adapters, invoke models, use network/filesystem, actuate bodies, install, promote, or canonize.
- Kind/risk: behavior and authorization / high.
- Pass condition: source dependency inspection shows only deterministic JSON and crypto in the compiler; output truth flags remain false; adversarial self-promotion fails.
- Primary surface: source/dependency inspection plus focused output assertions.
- Counterevidence: runtime import, I/O path, provider call, actuation interface, or authority-bearing output.
- Secondary surface: independent verifier.
- Observed evidence: dependency inspection found only Node crypto and the Workshop deterministic JSON core in compiler/verifier; focused and independent tests rejected runtime/actuation/promotion truth expansion.
- Verdict: `PASS` for absence of runtime surfaces in this leaf. No general claim is made about the wider Workshop.

## `shell-visual-editor`

- Claim: none. Phase 2 visual authoring was intentionally held; compilation remains the authority.
- Kind/risk: visual / medium.
- Pass condition: not applicable.
- Primary surface: real browser render/click would be required for any future claim.
- Verdict: `NOT_RUN`.
