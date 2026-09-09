# Modular Workshop Packager

Creates verified archives under `exports/workshop-packages`. It never uploads a
package and never changes Workshop source files.

## Five package modes

### Full local backup

Copies the current Workshop except prior exports. Treat this archive as
private: it may contain local logs, backups, state, access tokens or private
reports.

### Public-safe Workshop

Copies the whole shareable Workshop. It excludes exports, backups, logs, saves,
top-level runtime state, local AI settings, repository metadata, dependency
folders, secrets, private previews and private-labelled reports. Nested game
runtime folders remain because they are game content, not body-level runtime
state.

Local relay credentials such as `bridge-token.txt` and `bridge_token.txt` are
always excluded even when they sit beside a packageable nested runtime.
Package-manager and login credential files such as `.npmrc`, `.netrc`,
`_netrc`, `.pypirc`, `.git-credentials`, and common private SSH identity
filenames are also always excluded, regardless of their contents or nesting.

Only exact reviewed intake dependencies are included in a public snapshot:
`intakes/ai-team-collaboration-runs-01-101-v1` supplies AI Team Steward's
100-seed harness, while `intakes/universal-object-fabric-v0.7.0-2026-07-28`
supplies the hash-bound game stage used by Universal Object Fabric. The latter's
redundant 29 MB source ZIP is omitted while its acceptance receipt and staged
files remain. Sibling intakes stay local, and normal secret/private-folder rules
still apply inside both reviewed lanes.

Generated distributions, root working/intake packs, archive-review folders,
nested rollback archives, coverage output and language caches are also kept out
of public source snapshots. They remain available locally; exclusion is a
publication boundary, not deletion or evidence erasure.

The Windows beginner launcher may download a pinned private Node.js runtime on
first use. That top-level `runtime` folder and `AXM_START_REPORT.txt` are local
runtime material and remain excluded from every public-safe inventory.

### Offline Windows candidate

Builds the complete public-safe Workshop and then injects a locally prepared,
approved Node runtime before the ZIP is created. The runtime must pass its
per-file SHA-256 manifest and include both its Node license and provenance
record. Synthetic fixtures are refused.

The candidate contains:

- `AXM_OFFLINE_FIRST.json`, which forces the launcher onto the bundled-runtime
  path and disables downloads and system-runtime fallback;
- `RUNTIME_MANIFEST.json` plus `runtime/node`;
- `OPEN_AXM_SAFE_MODE.cmd` and `PROVE_AXM_OFFLINE.cmd`;
- a candidate-bound clean-device matrix, beginner launch guide and public truth
  draft that keep physical proof and publication authority false until tested.

Restore verification rechecks every file, verifies the runtime again and boots
the restored Hub with the runtime from inside the candidate.

### Modular collaboration slice

Packages one or more selected boundaries while preserving their exact
Workshop-relative paths. The catalog exposes:

- modules and parent modules;
- individual games;
- worlds;
- shared systems;
- additional explicitly typed relative paths.

Private paths, traversal, absolute paths and symbolic links are refused. The
packager deliberately does **not** guess dependency closure. If a module needs a
shared system, select both. The manifest records that boundary so a collaborator
knows exactly what was and was not supplied.

#### Build-on round trip

A modular package is also the human-friendly sender for current-build collaboration:

1. Select the module to improve and any additional read-only context it needs.
2. Create **Current build-on ZIP**.
3. Share that ZIP with a platform, another AI, or a human. No GitHub checkout is required.
4. The ZIP includes `BUILD_ON_GUIDE.md`, a tracked build-on export ID, and a `PACKAGE_MANIFEST.json` base ledger with every original file digest.
5. Ask the collaborator to preserve the top folder, change only one selected module, and return it as a ZIP.
6. Feed the returned ZIP into **Governed Installer & Update Manager**.

The receiver exact-compares the original module ledger with the live Workshop before staging and again before apply. It refuses stale bases and changed context, keeps exactly one previous generation, and runs the installed module self-test when available. The export grants no install or promotion authority.

### GitHub delta

After the user explicitly presses the delta button, the planner reads the
selected public GitHub commit/tree through the GitHub REST API. It compares Git
blob hashes against the current public-safe local files and packages only files
that are new or changed. A module/world/game selection may limit the comparison;
an empty selection compares the complete public-safe Workshop.

Files present in the baseline but absent locally are written to
`removed_paths` in `PACKAGE_MANIFEST.json`. They are advisory only. Applying a
delta overlays its changed/new files; deletion always remains a separate,
explicit steward decision.

The default baseline is:

```text
mike-axiom-mir/axm-collaboration-platform @ main
```

A branch, tag or commit SHA may be supplied instead. A private repository is
not silently accessed. An optional `GITHUB_TOKEN` environment variable may be
used by advanced users for an authorized API request, but its value is never
written to output or logs.

## Public-safety gate

Public, modular and delta modes share one gate:

- sensitive names and private folders are removed;
- common private-key, API-key, Discord-webhook and machine-path patterns are
  scanned;
- a finding refuses and removes the ZIP;
- the refusal receipt records only paths and rule names, never secret values.

## Restore evidence

Every package is extracted into a temporary folder, and each manifest entry is
checked for path safety, byte size and SHA-256 digest.

- Whole-Workshop archives additionally run the beginner-launch test, the AXM
  verifier and a restored Hub health check.
- Modular and delta archives run scoped structural and digest verification.
- Temporary restore copies are deleted; a compact `*.RESTORE_TEST.json` receipt
  remains beside the ZIP.

This distinction is intentional: a partial module ZIP cannot honestly prove a
complete Hub boot, but it can prove that its declared files restore exactly.

## Evidence

```powershell
node tools/workshop-packager/selftest.js
node tools/workshop-packager/mobile-selftest.js
node tools/workshop-packager/credential-boundary-selftest.js
node tools/workshop-packager/return-interoperability-selftest.js <modular-package.zip>
```
