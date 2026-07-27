# Code Recipe Foundry

Code Recipe Foundry is a local, non-executing intake and reference module for compact code recipes. It includes a normalized 1,000-entry catalog and can turn another bounded CSV or JSON intake into `axm.code-recipe-pack/v1`, while preserving row-level rejects, source URLs, ranking scope, exact-duplicate evidence, and reviewed-vs-derived family keys.

## Why this exists

The recovered `code_cheats_1000_bundle.zip` contains 1,000 entries in 25 categories, with 40 entries per category. Its JSON and CSV representations match row-for-row. It does **not** match the earlier narrative's 22-stack / 600-family description: the recovered rankings are editorial, popularity was not measured, and no semantic family map was supplied. The Foundry records that mismatch instead of retrofitting the data to the narrative.

Installed catalog status:

- 1,000 source rows structurally represented, with no exact duplicates or rejected rows;
- 937 quick recipes within the six-line contract;
- 62 long-form entries retained as visible review holds rather than shortened;
- one consequential database-role entry retained on hold because its safety note is empty;
- 1,000 mechanical category-plus-title family keys, explicitly not semantic deduplication;
- all snippets remain inert and all source correctness, security, currency, and licensing claims remain unverified.

## Intake fields

CSV headers or JSON object keys may use these canonical names:

`rank,title,snippet,description,primaryLanguage,domain,tags,sourceUrl,popularityIndicator,popularityScope,familyKey`

Common Dutch and snake-case aliases are accepted. JSON may be an array, `{ "recipes": [...] }`, `{ "entries": [...] }`, or an exported `axm.code-recipe-pack/v1`.

`popularityScope` may be `snippet`, `repository`, `ecosystem`, `source`, `not-measured`, or `unknown`. Missing scope remains `unknown` and produces a warning. A missing family key is mechanically derived from the title and marked `DERIVED_TITLE`; that is not semantic deduplication. The installed catalog uses `not-measured` plus `EDITORIAL_NOT_POPULARITY_MEASURED`.

## Bounded behavior

- CSV and JSON only, at most 5 MiB and 5,000 rows.
- Imported snippets are inert text. No `eval`, dynamic module load, command execution, package install, or source-URL fetch exists.
- Invalid rows and exact duplicates remain visible in the intake receipt.
- HTTP(S) source URLs with embedded credentials are refused.
- Structural validation does not verify source contents, licenses, correctness, security, or popularity claims.
- Seven-to-twenty-line snippets may be retained only under the explicit `LONG_FORM_HOLD` intake policy; they cannot be copied as quick recipes.
- Save, clipboard copy, and JSON download require explicit user actions.

The installed catalog is loaded only when the user presses **Load installed catalog**. General intake remains CSV/JSON; the Foundry deliberately does not vendor a spreadsheet library. To rebuild the installed catalog from the original archive:

```powershell
node tools/code-recipe-foundry/bundle-ingest.js --source '%USERPROFILE%\Downloads\code_cheats_1000_bundle.zip' --write
```

The archive reader refuses traversal paths, excessive entry counts, excessive expanded size, high compression ratios, and missing expected entries before compiling anything.

## Parse-only audit and Workshop search

`syntax-audit.js` uses only parsers already present on the host. It parses JavaScript inside an uncalled async function, Python through `ast.parse`, PowerShell through its language parser, and standalone JSON through `JSON.parse`. It never invokes a recipe, imports its modules, runs a command, or installs a missing runtime.

The current host produced 111 `SYNTAX_PASS` results, preserved 63 existing holds, marked 42 context-dependent fragments unsupported, and left 784 entries without a native verifier. A syntax pass proves only that the fragment parsed in the named synthetic context—not that it runs, is correct, is secure, or belongs in another module.

```powershell
node tools/code-recipe-foundry/syntax-audit.js --write
```

Workshop Search & Provenance consumes the pack and audit through a bounded structured adapter. Individual recipes become globally searchable with their source ID, review state, pack digest, and syntax status. Held recipe code is deliberately omitted from the global search projection.

## Verification

```powershell
node tools/code-recipe-foundry/selftest.js
node tools/code-recipe-foundry/discovery-seam-review.js
node verify.js
```

Passing tests establish evidence for a lifecycle decision; they do not grant CANON status.
