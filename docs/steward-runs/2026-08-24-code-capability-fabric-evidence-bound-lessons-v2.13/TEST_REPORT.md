# Test report

Status: `TEST`

Exact technical source: `8190df1e31914718a5f46ab69983a0dc72175035`

## Focused steward verification

```powershell
node shared/code-capability-fabric/selftest-capability-lesson-steward-v1.js
```

Result: `PASS` — 74 checks.

Coverage includes exact schema identities and closed objects, output/schema
field agreement, fourteen catalog lanes, allowed and forbidden lesson content,
deterministic rebuilds, byte-bound lineage, no private/process retention,
four-root order and verdicts, authority and resource ceilings, rights holds,
contradictions and unknowns, fixed and held-out failures, candidate-reference
identity aliases, duplicate goals/evidence, cross-suite goal overlap, stale and
future evidence, expiry, semantic duplicates, exact patch versions, derived-ID
overflow, bounded semantic versions, rehashed lifecycle forgeries, and the
absence of filesystem/process/network executors.

JavaScript parse checks, authored JSON parse checks, cached diff whitespace,
and an authored-path secret/machine-state scan also passed.

## Fabric continuity

- Every recursive `shared/code-capability-fabric/**/selftest*.js`: `PASS` —
  51/51 entry points.
- 102-language Creation Session Planner: `PASS` — 61 checks, included above.
- `node tests/capability-fabric-package-test.js`: `PASS` — 102 checks.
- `node tests/city-map-gate-test.js`: `PASS` — 33 assertions.
- `node shared/city-graph/selftest.js`: `PASS` — 33 assertions.
- City graph read-only drift check: `PASS` — graph
  `26e03be76f3babf534490a4f11957da8ebf764b1919360f541441c1031774649`.
- Schema registry read-only drift check: `PASS` — registry
  `f35ca98bc0555f418f02c2bf64f2e771c72f18ae2c5e8f9c0da32c4efc8818c3`,
  923 identities, 755 unresolved sockets preserved.
- Twin read-only drift check: `PASS` — twin
  `5cdf40068789038034839e3d848e54e34b7367c2c7107b36d4c6c2aa052bf2ba`.

The package continuity suite uses its existing trusted test host to execute
seven exact fixture selftests from disjoint disposable copies. It did not
execute either supplied v0.1/v0.2 experimental runtime and is not evidence for
a general disposable executor.

## Required `AGENTS.md` checks

Final run: all ten exited `0`.

1. `node verify.js`
2. `node hub/hub-selftest.js`
3. `node hub/route-selftest.js`
4. `node hub/graft-selftest.js`
5. `node hub/skin-selftest.js`
6. `node hub/verify-plus.js`
7. `node tests/html-script-syntax-test.js`
8. `node tests/tool-forge-package-test.js`
9. `node tools/agent-tool-forge/selftest.js`
10. `node tools/evidence-desk/selftest.js`

`verify.js`: `0 FAIL · 25 warn`; the 25 existing warnings remain visible:
20 game evidence gaps, one legacy `UNDECLARED` manifest-kind migration, and
four promotion claims needing current selftest evidence. `verify-plus` ended
`VERIFIED_WITH_LIMITS`; Foundation and game each retain one warning, while all
three module claims pass.

An earlier required-check attempt correctly failed because the City graph had
been regenerated before its schema-registry and twin dependants. The official
schema and twin compilers repaired those derived views. The final run above is
the result claimed.

## Unrun or not claimed

- Independent Draft 2020-12 meta-schema validation: `NOT_RUN`; neither Ajv nor
  Python `jsonschema` was installed, and no dependency was installed for this
  run. JSON parsing, closed-object inspection, record/schema field agreement,
  manual exact validators, and City schema discovery did pass.
- Browser render/click: `NOT_APPLICABLE`; no visual surface changed.
- Supplied experimental runtimes and general repaired sandbox executor:
  `NOT_RUN` and not authorized by this rung.
- Provider/network behavior: `NOT_RUN`.
- Rights-authority authentication and Tier-3 admission: `NOT_RUN` / absent.
- Installation, canonical integration, publication of generated artifacts,
  model training, physical actuation, promotion, merge, and CANON: `NOT_RUN`.
