# AXM Branch Module Return Gate

Status: `TEST`

This is the Workshop's one-way valve for useful pieces made in larger or dependency-heavy branches. A branch can propose one bounded module; the gate accepts it only when the selected folder is structurally self-contained and can be represented as the Workshop's existing `axm.modular-piece-package/v1` format.

Passing means **ready for governed intake review**. It does not mean installed, executed, promoted, visually approved, runtime-proven, merged, pushed, permissioned, or `CANON`.

## Branch-side preparation

Put the proposed portable module in a dedicated folder. Copy `templates/axm-branch-return.template.json` to `axm-branch-return.json`, then list every file in that folder exactly. The folder must include:

- `axm-branch-return.json`
- `manifest.json` using `axm.tool-manifest/v1`
- `module.contract.json` using `axm.module-contract/v1`
- the manifest entry
- a declared self-test

The portability declaration must match the module's Workshop capabilities and permissions. External packages, package-manager installs, remote runtime services, branch runtimes, native binaries, host commands, absolute paths, links/junctions, secret-like files, undeclared files, and escaping or missing resource references are refused.

Node built-ins and explicitly declared Workshop contracts are allowed. The gate reads bytes and JSON, performs bounded static checks, and never runs the candidate self-test. Execution remains the governed installer's responsibility after exact-digest human review.

## Commands

From this module folder:

```powershell
node intake-cli.js inspect --source "D:\path\to\portable-module"
node intake-cli.js pack --source "D:\path\to\portable-module" --out "D:\path\to\proposal.package.json"
node intake-cli.js verify --package "D:\path\to\proposal.package.json" --receipt "D:\path\to\proposal.package.json.receipt.json"
node selftest.js
```

Outputs use create-new semantics: an existing package, receipt, or inspection file is never overwritten. A repeated build from identical input produces identical package bytes and the same package digest; receipt timestamps are intentionally operational metadata and may differ.

## Deterministic route

1. A human or branch builder selects one dedicated candidate folder.
2. This gate verifies paths, declared files, contracts, dependencies, local references, sizes and exact file hashes without executing code.
3. `pack` emits an inert `axm.modular-piece-package/v1` plus an authority receipt.
4. The existing `shared/modular-intake` service re-inspects and quarantines the exact digest.
5. Existing dual-seat review and the governed module installer remain mandatory before activation.

No reverse dependency is created: the Workshop receives copied module bytes and provenance, not a live link to the source branch.

## Honest limits

The scan is structural and deliberately conservative. Static checks cannot prove behavior, quality, security, accessibility, performance or visual correctness. A pass only proves that this exact selected byte set met the declared portability contract and is compatible with the next governed intake step.

