# AXM Workshop Census Observatory

This integrated `TEST` module is installed and registered without new permissions or CANON authority.

## Why it exists

AXM has several legitimate inventory scopes. A top-level Hub tool, a recursive manifest, a shared organ, a game package, and a world are all modular bodies, but they are not interchangeable units. This candidate makes each scope explicit and refuses arithmetic against an old count whose scope is unknown.

It does not decide whether growth is good. It supplies evidence for a steward and Mike's merge gate.

## Deterministic scan

From this candidate directory:

```text
node census-cli.js --root /path/to/axm-workshop-v4
```

Generate portable JSON and the standalone browser snapshot only when wanted:

```text
node census-cli.js --root /path/to/axm-workshop-v4 --output current-census.json --browser-output current-census.js
```

Compare a same-scope old count:

```text
node census-cli.js --root /path/to/axm-workshop-v4 --scope hub-registered-tools --count 81
```

If an older number was called only “modules,” leave the scope unnamed. The correct result is `NOT_COMPARABLE`, not a guessed growth delta.

## Scope definitions

- `hub-registered-tools`: top-level, non-template `tools/<folder>/manifest.json` entries.
- `tool-directories`: all top-level directories under `tools/`, with template folders still visible.
- `hub-tools-with-declared-contracts`: registered tools whose declared contract path is safe and present.
- `recursive-manifest-files`: all active-source `manifest.json` files after exclusions.
- `recursive-module-contract-files`: all active-source `module.contract.json` files after exclusions.
- `shared-top-level-bodies`: top-level `shared/` bodies excluding templates and the vendor dependency zone.
- `world-directories`: top-level non-template `worlds/` directories.
- `game-packages`: recursive `game.manifest.json` files.
- `asset-zones`: top-level non-template `assets/` directories.

The scanner excludes generated exports, backups, logs, state, local data, dependencies, caches, coverage, and Git internals. It does not follow symlinks.

## Verification

```text
node selftest.js /path/to/axm-workshop-v4
node build-bundle.js
```

`module-bundle.json` is a later-intake artifact for the existing Neutral Modular Intake / Module Installer flow. Creating the bundle does not stage or install it.

## Smallest next intake test

Have the Module Installer inspect the exact bundle without staging it. The merge gate should then decide whether this inventory seam belongs in the live Workshop, whether its scope definitions match Mike's intent, and whether a Hub route is worth adding. A passing inspection is evidence, not promotion.
