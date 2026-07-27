# Protocol Version Observatory focused test report

Status: `PASS` for the focused fixture and live Workshop checks. Candidate status remains `EXPERIMENTAL`.

- 23 focused checks passed.
- The fixture proves exact trailing `/v...` parsing, non-AXM syntax non-inference, future-prefix retention, multiple-version grouping, mixed unparsed-family state, exact role retention, contract-unknown state, symlink refusal, stable fingerprinting, TTL state, no absolute-path leak, and no source writes.
- Live scan at `2026-07-26T21:47:20.869Z` emitted fingerprint `c9e435ff1ff65bef857c572ee2e67c34b5f805d858cfd244872fbf484a3e5e7e`.
- Live result: 81 modules, 985 declaration occurrences, 741 unique tokens, 173 slash-versioned tokens grouped into 172 exact families, 568 tokens left under unparsed conventions, four future-prefixed occurrences, and zero multiple-version or mixed-family observations.
- Zero multiple-version families is a current bounded observation, not proof that every protocol is compatible or complete.
- Browser visual judgment is `NOT_RUN`.
- No validation, compatibility judgment, version selection, migration, adapter, rewrite, staging, installation, permission change, promotion, or CANON change occurred.
