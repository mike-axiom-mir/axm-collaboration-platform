# Schema Identity Observatory focused test report

Status: `PASS` for the focused fixture and live Workshop checks. Candidate status remains `EXPERIMENTAL`.

- 24 focused checks passed.
- The fixture proves unique identity, identical reuse, divergent same-ID bodies, local-definition presence, no-local-definition observation, future prefix retention, invalid JSON isolation, UTF-8 BOM tolerance with a visible format note, exclusions, symlink refusal, stable fingerprinting, TTL state, no absolute-path leak, and no source writes.
- Live scan at `2026-07-26T21:52:05.167Z` read bounded Workshop JSON and emitted fingerprint `3b9184223bc5c9e196dfc0b3359be08991fd0d8a06cf1bc868c39eef109a3427`.
- Live result: 107 definition occurrences / 107 unique `$id` values, zero repeated or divergent definition groups, 187 reference occurrences / 79 unique reference values, zero parse failures, and two UTF-8 BOM format notes.
- The 78 reference values with no local `$id` definition are observations only; they are not called invalid.
- Browser visual judgment is `NOT_RUN`.
- No schema validation, registry lookup, compatibility decision, repair, adapter, staging, installation, permission change, promotion, or CANON change occurred.
