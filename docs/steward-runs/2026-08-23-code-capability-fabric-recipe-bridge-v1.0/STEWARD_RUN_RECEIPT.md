# Steward-run receipt

Status: `TEST`

Branch: `codex/code-capability-fabric-recipe-bridge-v1.0`

Base: `ee92c1d8704642eb9b3058493f67404c3bf01100`

Technical commit: `04a3d97f682aebf579429dae344d01c38566d793`

Changed implementation paths: 12 (1,043 insertions, 10 deletions).

## Outcome

The Code Capability Fabric can now consume a strictly validated selection from
the installed 1,000-entry Code Recipe Foundry catalog. Selection is exact and
requester-specified, never automatic or rank-derived. Each packet embeds its
complete sealed request and binds installed pack, recipe-set, syntax-audit,
Foundry-contract, selected-record, snippet, resource, rights, and truth data.

`REFERENCE_ONLY` omits snippet text. `DETACHED_RESEARCH_CONTEXT` includes text
only for non-held installed records with parse-only `SYNTAX_PASS`. Both remain
`RESEARCH_ONLY_HOLD`. The semantic generator binds the packet into candidate
and Review Card lineage but v1 does not use snippet bytes to rewrite candidate
source.

This is Foundry/catalog → Fabric wiring. It is not Code Mirror. RepairBuddy
remains a separate repair experiment and was not changed or called.

## Boundaries and deferred decisions

- no catalog or generated source executed;
- no automatic selection or authenticated-human-selection claim;
- no source/license verification or direct-reuse authorization;
- no provider, Mirror, RepairBuddy, sandbox, workspace, install, integration,
  learning, publication, promotion, or `CANON` action;
- Mike's reuse-rights and future executor decisions remain deferred;
- Mike remains the final merge gate.

## Verification

The new 68-case bridge suite, semantic 104-case suite, materializer 80-case
suite, all 23 Fabric scripts, both Foundry continuity checks, and all ten
AGENTS.md commands passed. Both verifier entry points retained `0 FAIL · 22
warn`. Browser testing was N/A because no visual surface changed.

This receipt proves only the bounded contracts and tested deterministic data
transforms. It does not prove recipe quality, semantic understanding, runtime
behavior, reuse rights, integration, promotion, or `CANON`.
