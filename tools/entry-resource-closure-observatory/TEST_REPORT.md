# Entry Resource Closure Observatory v0.2 focused test report

Status: `PASS` for 51 focused fixture and live Workshop checks. Candidate remains detached `EXPERIMENTAL`.

- The preserved v0.1 direct-map suite passes 27 checks.
- The v0.2 transitive graph suite passes 24 checks.
- The graph follows bounded static HTML, CSS, JavaScript import/export, literal dynamic import, Worker, SharedWorker, and `importScripts` edges.
- It verifies 81 live modules, 444 nodes, 371 edges, 443 bounded text bodies, and 8,872,051 text bytes.
- Live evidence has 366 present local edges, zero missing edges, five unresolved dynamic edges, zero cycles, zero limit holds, and zero read issues.
- Binary leaves receive metadata only. Styles are not applied, media is not decoded, scripts are not executed, and networks are not fetched.
- An initial over-broad JavaScript import expression stalled on a large vendor source. It was interrupted, bounded to one line, and covered by a large-source regression test before the final evidence was generated.
- Browser visual judgment is `NOT_RUN`.
- No staging, install, permission, rollback, promotion, GitHub, readiness, visual-quality, or CANON claim is made.
