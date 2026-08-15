# AI Organ Archive

Status: **TEST**. This is a passive modular library, not an organ runtime.

The archive copies each `*-organ.js` source into immutable content-addressed
storage and creates a machine-readable part card. It deliberately reads source
as text instead of loading it. A malicious, broken, incomplete, or incompatible
organ can therefore be archived for later examination without being run.

Each part card includes:

- exact source path, SHA-256, bytes and line metrics;
- statically declared organ IDs and schema literals;
- observed dependencies and exported functions;
- parameter names from exported function signatures;
- bounded numeric configuration constants;
- input/output schema role hints;
- authority-sensitive term signals;
- a plain-language description and capability tags;
- provenance for every semantic field: `DECLARED_LITERAL`,
  `STATIC_OBSERVED`, `INFERRED_FILENAME`, or `UNKNOWN`.

## Exact verification receipts

Static reachability and a green test process are different truths. The archive
therefore keeps source cards immutable and adds verification only as a derived
catalog overlay. Explicitly verify one organ with:

```powershell
npm run verify:ai-organ -- --organ organs/example-organ.js
```

The verifier runs only exact public test files that directly `require()` that
organ. It binds the organ bytes, test bytes, public-body inventory, process
result and complete bounded output into an immutable receipt under the
configured archive root. Passing and failing attempts are both preserved.

This command is never automatic. The child process receives a reduced
environment but is not an OS sandbox, so the public test code still has the
local permissions of that process. A green overlay means only that those exact
bytes passed that exact test process. It does not prove universal behavior,
compatibility, safety, quality, runtime admission or CANON.

## Workshop category evidence

The Workshop Verification Spine is a second, separate evidence family. After
the Workshop has produced `exports/verification-spine-report.json`, explicitly
copy and inspect it with:

```powershell
npm run intake:workshop-verification
```

Mirror reads only the Spine registry, receipt schema, category packs, selected
profile and report JSON. It never loads or executes Workshop verifier code and
never writes to the Workshop. Before storing the report, Mirror independently
reproduces the category totals, missing categories, contradictions, failures,
holds, human reviews, warnings and final verdict from the embedded receipts.

An honestly `FAILED` or `HELD` report is a successful evidence intake when its
machine structure reproduces. An internally inconsistent aggregate is stored
as `HOLD_EXTERNAL_CATEGORY_REPORT_INVALID`, not silently repaired. Categories
remain separate and contradictions remain visible; no composite intelligence,
quality, safety, compatibility or readiness score is created.

External claims attach to an archived organ version only when the receipt says
its subject kind is `organ` or `ai-organ` and its subject digest exactly equals
that archived source hash. Even an exact external `PASS` grants no permission,
training admission, runtime admission, promotion, CANON or world authority.

## Safe automatic capture

Starting Mirror normally now performs a catch-up archive scan and keeps the
lightweight deterministic watcher running inside Mirror's existing Node
process. New and changed `organs/*-organ.js` files are therefore archived
without using a reasoning model. Stopping Mirror also stops this watcher. The
watcher never imports, executes, installs, or starts an organ.

The manual commands remain available for maintenance or use while Mirror is
not running.

Run one catch-up scan:

```powershell
node modules/ai-organ-archive/bin/archive-organs.js --once
```

During an organ-building session, explicitly start the watcher:

```powershell
node modules/ai-organ-archive/bin/archive-organs.js --watch
```

The standalone watcher notices later file additions and changes and archives
them without executing them. Stop it with `Ctrl+C`. It does not start with
Windows or the Workshop; the runtime-bound watcher starts and stops with
Mirror.

A builder can seal one completed file directly:

```powershell
node modules/ai-organ-archive/bin/archive-organs.js --file organs/example-organ.js
```

The default archive is `state/ai-organ-archive`, which is excluded from Git.
When the large archive drive is ready, set `AXM_AI_ORGAN_ARCHIVE_ROOT` to its
chosen directory. Source code and archive history then remain separated without
changing this module.

## Storage model

- `objects/<archiveObjectId>/source.js` — exact archived bytes.
- `objects/<archiveObjectId>/part-card.json` — deterministic metadata.
- `receipts/receipt-*/receipt.json` — append-only change receipts.
- `catalogs/catalog-<digest>.json` — preserved derived catalog snapshots.
- `CURRENT.json` — replaceable pointer to the latest derived catalog.
- `verification-receipts/organ-verification-*/` — immutable explicit test
  process receipt plus exact bounded output.
- `verification-spine-intakes/workshop-spine-intake-*/` stores one immutable
  Workshop category-report copy plus Mirror's independent intake receipt.

Old object versions and catalog snapshots are not overwritten. `CURRENT.json`
is only a convenience pointer and never becomes evidence or CANON authority.

## Known limit

Static inspection cannot prove what code actually does. It can expose useful
parts and likely connection surfaces for a future drag-and-drop system, but
runtime compatibility still requires contracts, tests, permission checks and a
separate review gate.

## Experimental specialist Mirrors

The archive can now fork a **separate experimental specialist lineage** from
Mirror's archived public body. It does not copy Mirror's private state, learned
checkpoints, permissions, or runtime. Settings may name bounded
`requiredOrganSourcePaths`; these are explicit composition seeds, not inferred
semantic-fitness claims. The planner then searches several organ body plans for
static metadata that fits a direction, closes exact current-catalog local-organ
dependencies within the declared cap, preserves each generation, and chooses
one only as the next candidate for an isolated exam. Required, direction-selected
and dependency-closure parts stay visibly distinct. No candidate is assembled
or executed by this module.

Copy `specialist-settings.example.json`, give the clone its own ID and
direction, then either drag that JSON onto `CREATE_SPECIALIST_MIRROR.bat` or run:

```powershell
node modules/ai-organ-archive/bin/archive-organs.js --create-specialist path/to/settings.json
```

List specialist lineages:

```powershell
node modules/ai-organ-archive/bin/archive-organs.js --list-specialists
```

`english-learner-mirror.settings.json` is the first real specialist settings
file. It creates a separate dormant lineage intended for slow English
interpretation research. After the lineage exists, one explicit permissioned
lesson can be supplied with:

```powershell
npm run learn:english-clone -- --lesson training/english-learner-seed-lesson.json
```

The teaching organ stores clone-private content-addressed lessons, model
snapshots and cycles. It accepts one lesson per command, keeps TRAIN and
HELD_OUT source groups separate, and preserves corrections by supersession.
It never starts the specialist body or turns its learned association model into
Mirror's active language authority.

Run the explicit structural examiner for the current specialist generation:

```powershell
npm run examine:specialist-mirror-structure -- --specialist english-learner-mirror
```

The examiner independently rebuilds exact required-organ resolution,
dependency closure, graph state and static metrics from the bound catalog. It
stores one private content-addressed exam and exact replay writes nothing. A
pass proves structural reconstruction only, not English ability, semantic fit,
compatibility, assembly readiness or runtime safety.

When `autoRecomposeOnNewArchiveVersion` is enabled, a later archive scan that
captures a new organ version also creates a new composition generation. This
is supplied automatically by a normal running Mirror, or by an explicit scan
while Mirror is stopped. Specialist bodies themselves remain dormant and are
never started by archive recomposition.

Each current archived organ can now be projected into a **dormant organ
component**. The component binds the exact archive object, catalog, source path,
source digest and measured source bytes. Only declared schema literals become
typed input/output hints. Filename tags remain advisory, while CPU, GPU, peak
memory, working storage and native runtime stay `UNKNOWN_NOT_MEASURED`.

Run the explicit projector with:

```powershell
npm run project:dormant-organ-components
```

The content-addressed projection is private state and replays without another
write. It is metadata about an organ, not the executable organ itself.

Specialist candidates now include a static component graph. Exact local organ
`require()` references become dependency edges only when the exact current
catalog path resolves. Transitive exact dependencies are added while capacity
remains; a closure that exceeds the cap is a typed hold. Absent organ references,
escaped paths, dependency cycles and multiple providers for one declared schema
also become visible holds. Exact schema equality is only a proposed route; it
is not compatibility proof and nothing is connected automatically.

Graph v2 reports both directions of an incomplete route: inputs with no
provider and outputs with no selected consumer. An unconsumed output is visible
evidence, not automatic incompatibility, and the archive never invents a
consumer from filenames, descriptions, or capability tags.

Workshop world substrates are outside this archive's identity boundary. A
Planet physics file, Holodeck tool, or other cross-root/non-`*-organ.js`
artifact does not become a Mirror AI organ because it contains words such as
`world`, `physics`, `authority`, or a matching schema literal. Even a valid
Mirror organ carrying those labels remains dormant metadata with world action
set to false until a separately reviewed adapter and permission route exists.

Specialist generation v2 binds the generation ID to the composition algorithm
and the exact generation, component, projection, graph, and dependency-closure
protocol versions. Changing one of those protocols therefore creates a new
immutable generation. The earlier generation is preserved rather than silently
reinterpreted or overwritten.

`requiredHands` and `requiredModules` remain unresolved until equally typed hand
and module catalogs exist. There is no automatic return path to Mirror: a useful
specialist discovery remains in its own lineage unless a separate future review
and import system is deliberately built.

## Purpose shelves without purpose prisons

The current catalog adds one **primary browsing shelf** plus any number of
**use fields** and **functional roles** to every organ. For example, one organ
may appear under reasoning, memory, learning and verification at the same time.
The primary shelf only makes a long list easier to browse; it is not the organ's
exclusive identity.

These labels are deterministic inferences from public static metadata and stay
`INFERRED_UNCONFIRMED`. They never prove semantic fitness, behavior,
compatibility, safety, quality, permission, runtime readiness or CANON. Future
human or machine review may supersede a label without rewriting the immutable
organ source object.

## Portable library for another builder

The private content-addressed archive lives under the Mirror root, normally at
`C:\AXM_MIRROR_LOCAL\state\ai-organ-archive`. A task opened on
`C:\axm workshop` will not find that path by looking for a relative
`state/ai-organ-archive` folder.

Double-click the easy root shortcut `C:\AXM_MIRROR_LOCAL\EXPORT_MIRROR_ORGAN_LIBRARY.bat`
to produce one shareable ZIP. The same launcher is also preserved beside this
module as `EXPORT_PORTABLE_ORGAN_LIBRARY.bat`. Alternatively, run:
or run:

```powershell
npm.cmd run export:organ-library:zip
```

The result is written beneath
`C:\AXM_MIRROR_LOCAL\exports\ai-organ-library`. It contains only current public
organ source plus bounded static metadata. Each source is stored once under
`objects/`; non-exclusive `categories/*.json` files only reference those exact
objects. `INDEX.md` is the beginner-readable map and `library.json` is the full
machine index.

The export excludes private Mirror state, specialist memories, checkpoints,
historical organ versions, archive receipts, raw verification output, logs,
tokens and secrets. Receiving the ZIP grants no execution, installation,
connection, training, permission, promotion or CANON authority.
