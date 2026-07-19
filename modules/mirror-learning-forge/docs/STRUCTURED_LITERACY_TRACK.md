# Structured State & Action Literacy / JSON

## Purpose

JSON is a shared literacy channel. Humans can read it, machines can validate it, modules can exchange it, and the history can be diffed and replayed.

JSON is not wisdom and it is not truth.

## v0.3 skills

1. parse or refuse malformed JSON;
2. check required fields;
3. check field types and enums;
4. detect unsupported VERIFIED/APPROVED-like status;
5. detect permission/action contradictions;
6. detect execution or automatic-promotion claims without receipts;
7. preserve uncertainty around claims;
8. detect instruction-like content hidden in data;
9. normalize and round-trip without silent loss;
10. produce PASS, REPAIR or REJECT with a hashed receipt.

## Required lesson pattern

```json
{
  "claim": "...",
  "evidence_refs": [],
  "uncertainty": "...",
  "next_test": "...",
  "verdict": "HOLD"
}
```

The exact fields may evolve through versioned schemas. The important rule is that structure cannot silently convert confidence into evidence.
