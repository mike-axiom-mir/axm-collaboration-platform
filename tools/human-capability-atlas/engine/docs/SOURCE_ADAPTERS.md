# Source Adapter Architecture

## Goal

Allow the Atlas to read heterogeneous capability manifests while keeping each original declaration unchanged and traceable.

## Deterministic flow

```text
file discovery
  -> format detection
  -> candidate extraction
  -> field mapping
  -> source-schema validation
  -> normalized source output
  -> Capability Card build
  -> ingestion report
```

## Adapter IDs

### `normalized-source-v1`

Used when `capability_id` and `machine_name` already exist. The record is copied and enriched with source provenance.

### `generic-manifest-v1`

Used for common aliases such as:

- `id`, `capabilityId`, `key` -> `capability_id`
- `name`, `machineName`, `slug` -> `machine_name`
- `title`, `display_name` -> `human_name`
- `summary`, `whatItDoes`, `purpose` -> `description`
- `why`, `benefit`, `value` -> `why_it_matters`

The exact mapping appears in `adapter_trace.field_mappings`.

## Stable-ID rule

- A direct ID field is accepted as known.
- The key of an ID-keyed registry may be used as an inferred capability ID, with the inference recorded.
- A list record without any stable ID is rejected.
- The adapter never invents an ID from array position.

## Machine-name rule

Preference order:

1. explicit machine-name alias;
2. slug derived from an explicit human display name, recorded as inference;
3. stable capability ID reused as machine name, recorded as inference;
4. otherwise reject.

## Source provenance

Every accepted normalized source records:

- original file location;
- original file SHA-256;
- JSON pointer;
- JSONL line where applicable;
- adapter ID and version;
- detected format and confidence;
- field mappings;
- inferences;
- warnings.

The generated Capability Card preserves the original hash and location rather than replacing them with the normalized intermediate file's hash.

## Failure behavior

Unrecognized files and rejected records are never silently dropped. They appear in the ingestion report and repair files. Strict mode can stop at the first failure; normal mode continues so one malformed record cannot hide the rest of a large registry.

## Adding a new explicit adapter

Only add an adapter after a real manifest shape is observed. Add:

1. a minimal source fixture;
2. an expected normalized result;
3. positive detection test;
4. false-positive test;
5. provenance test;
6. malformed-record test;
7. changelog entry.

Do not broaden generic detection merely to raise the accepted count. Precision and source truth are more important than apparent coverage.
