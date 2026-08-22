# Integration Guide — AXM Human Capability Atlas

The Atlas should emit or enrich `capability_record` objects only after preserving the original capability ID and source reference.

## Atlas responsibilities

- Explain capability purpose, examples, learning path, common mistakes, and human names.
- Mark every non-source statement as `INFERRED` when it is reasoned rather than directly declared.
- Leave unavailable technical facts `UNKNOWN`.
- Validate against `schemas/capability-interface-contract.schema.json`.

## Interface Intelligence responsibilities

- Treat the Atlas capability record as input, not authority to expand source capability.
- Produce a separate `interface_recommendation` object.
- Preserve evidence, unknowns, and conflicts in its output.

## Merge test

For each file in `fixtures/`, the Atlas should reproduce a schema-valid capability record with the same source identity and information states. Interface Intelligence should then reproduce the expected recommendation pattern/status and beginner restrictions.
