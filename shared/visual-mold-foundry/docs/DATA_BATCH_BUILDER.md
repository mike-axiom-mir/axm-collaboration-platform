# DATA BATCH BUILDER — v0.6 schema / v0.9.1 behavior

## Purpose

Data Batch Builder maps structured local rows into repeated governed visual instances.

## Supported intake

- JSON array of row objects;
- JSON object containing a `rows` array;
- comma-delimited text;
- semicolon-delimited text, including common Dutch/European spreadsheet exports;
- tab-delimited text;
- quoted fields and escaped double quotes;
- direct local CSV, TSV, JSON, or text file loading.

## Limits

- 4 MB source intake;
- at most 100 rows;
- at most 100 columns;
- at most 4,000 characters per scalar cell;
- declarative scalar data only;
- no formulas, macros, remote assets, or executable schemes.

An over-limit source is rejected before save or materialization. Nothing beyond a cap is silently sliced or omitted.

## No-silent-loss intake

For an accepted source, the parser records:

- original source-row total;
- accepted row count;
- delimiter;
- every normalized or collision-renamed header;
- fingerprint of accepted rows in the UI-created intake report.

Sources with more than 100 rows or more than 100 distinct columns are rejected. Split them into smaller explicit batches.

Duplicate or normalization-colliding headers receive bounded suffixes such as `title_2`. The rename is reported and each source value remains in a distinct field. Unclosed quoted fields, CSV rows with too few or too many cells, and any scalar cell over 4,000 characters are rejected rather than repaired or truncated.

## Mapping

Columns can map to:

- mold inputs such as title, message, badge, metric, and call to action;
- variant axes such as theme, format, state, motion, and performance.

Mappings are inferred from common column names and remain editable. A mapping that references a missing column fails validation. A batch with no mapped input columns warns that every row will repeat defaults.

## Validation

Rows are coerced by declared input type and checked against the selected mold. Unavailable themes, inactive extensions, overflow, contrast, unsafe values, accepted-data changes, and ordinary mold validation remain visible.

Missing or inactive mold/theme dependencies block approval. An imported current batch package also requires a valid FNV-1a-32 integrity fingerprint before any dependency import or save.

## Lifecycle

```text
DRAFT → APPROVED → ARCHIVED
```

An unchanged approved batch remains approved. A content or mapping change returns it to `DRAFT`. Archiving an approved batch preserves `ARCHIVED`; it is not mistaken for an unapproved content edit.

Persistence failure throws. A failed save is not followed by a success claim, and a surrounding governed transaction rolls back.

## Outputs

- `.axmbatch.json` package with required current-packet integrity on re-import;
- static script-free HTML gallery;
- materialized Project Composer project;
- full workspace backup.

## Examples

- `examples/batch_comma.csv`
- `examples/batch_semicolon.csv`
- `examples/batch_rows.json`

FNV-1a-32 packet integrity is non-cryptographic and collision-prone. It is accidental-corruption evidence only, not a signature or proof of trusted origin.
