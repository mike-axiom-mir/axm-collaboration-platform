# AXM Auto Tech Factory Map

Status: **working architecture map / not canon**  
Scope: public-facing source map for the modular AXM build system.  
Rule: **automated build is allowed; automated release is not allowed.**

This file captures the current module/factory direction so AXM does not spread across loose chat backups, sandbox files, or disconnected branches. It belongs in the repo as a stable map that can be updated by normal pull-request flow.

---

## 1. Core boundary

AXM may automate creating candidates:

- tools
- modules
- templates
- assets
- tests
- patches
- games
- entertainment systems
- workflow helpers

AXM may **not** automatically decide what reaches users.

Promotion path:

```text
SEED
-> GENERATED ALPHA
-> MIKE TOBI REVIEW
-> AI CROSSCHECK
-> TWEAK / REPAIR
-> POLISH
-> WORKING ALPHA
-> REAL USE PERIOD
-> FEEDBACK + REPAIR
-> MERGEGATE
-> CANON CANDIDATE
-> CANON only if explicitly approved
```

Hard rules:

- no fake done
- no silent rewrite
- no automatic canon
- no automatic user-facing release
- no patch applying by the same tool that generated the patch

---

## 2. Current public foundation modules

### AXM Workshop / local-first shell

Role: local workspace where AXM tools, files, bridge logic, logs, modules, and AI connections live.

Needs:

- stable launcher
- verifier
- module loader
- clear local folder map
- beginner-safe error recovery

### Bridge module

Role: controlled route for AI helpers to connect to the local foundation/workshop.

Rules:

- no hidden access
- no secrets in public repo
- bridge tokens stay private/local
- logs stay local/private unless intentionally shared
- AI acts only through allowed permissions

### AI helper rules / AGENTS layer

Role: tells AI collaborators how to work in the repo.

Core:

- Mike Tobi is founder/tester/direction-setter/MergeGate
- AI output is material until reviewed/tested/accepted
- use branches and pull requests
- explain what changed, why, how tested, and what remains untested
- do not silently rewrite main
- do not commit real secrets

### Agent routing module

Role: separates AI/helper responsibilities so one body does not try to do everything.

Known/future role types:

- Verifier
- Bridge
- Studio
- Template
- Docs
- Research Scout
- Tool Module Agent
- DeepSeek reasoning body
- Hermes/local shell body
- Claude maintainer/reviewer
- ChatGPT/Axiom-Mir architect/repair
- Fable scout/builder
- Grok/Wildcard short sprint scout
- Patch Builder
- Patch Apply Gate

### Tool lifecycle module

Role: prevents prototypes becoming sacred or fake-finished.

Labels:

- draft
- accept for test
- working
- known fail
- retired
- removed
- needs review
- canon only when explicitly approved

---

## 3. Tool/module candidates already in motion

### Prompt Vault

Status: draft PR / needs review.

Role: stores reusable prompts, command cards, AI handoff prompts, repair prompts, test prompts, and model-specific routing prompts.

Future:

- prompt versioning
- status labels
- source links
- model-fit tags
- safe/unsafe notes
- export to txt/markdown

### Asset Vault

Status: draft PR / needs review.

Role: stores reusable visual/design/game assets.

Future:

- asset metadata
- source/permission tracking
- reuse tags
- template connection
- transparency support
- export packs

### Local AI / Game Modules + Game Hub + Hermes Wrapper

Status: draft PR / needs inspection.

Role: turns local AI and games into modules inside the workshop.

Core idea:

```text
local AI
-> Hermes module
-> base reasoning shell
-> AXM workshop/tools/logs/files
```

Hermes is a shell/body socket, not the safety itself. Safety depends on the chosen model, permissions, watchdog, logs, review, and rollback.

### Game Hub / LAN shell

Status: working seed from earlier builds / needs hub connection.

Role: reusable local LAN game shell where laptop hosts and phones join on same Wi-Fi.

Future:

- module loader
- local stats
- room/lobby
- QR links
- optional AI night host
- game module templates

### Graphic Studio / Visual Design Tool

Status: existing direction / needs hub integration.

Role: visual/design tool where humans and AI co-create with visible tools, templates, screenshots, logs, stickers, transparency, and reusable design wisdom.

### Template System

Status: core architecture / needs module form.

Rule: **outer stable, inner flexible**.

Outer stable:

- borders
- sizing
- page numbers
- signatures
- style rules
- export defaults
- safety margins

Inner flexible:

- content
- factions
- comic pages
- reaction cards
- visual logs
- info comics
- tool cards

---

## 4. Factory modules to add

### Wisdom Notes / Repair Memory

Role: stores lessons from failures, tests, repairs, and successful builds.

Core loop:

```text
direction
-> output
-> cross-check
-> repair
-> wisdom note
-> template update
-> better next output
```

### Full Tool Generator Module

Status: claimed/scout-built by Fable direction / needs inspection.

Role: AI connects to the module and builds full tool candidates automatically from a tool request/spec.

Generated tool requirements:

- one folder
- manifest
- entry point
- README
- install/run steps
- feature list
- known limits
- test checklist
- Action Report
- status label
- no hidden network behavior
- no auto-release
- no auto-canon

### Grounded Auto Tech Factory

Role: general factory that uses AXM’s evolution loop to create tool/module candidates.

Factory fuel:

- templates
- assets
- wisdom notes
- repair logs
- research notes
- prior module maps
- test checklists
- patch history
- model routing notes
- user feedback

Factory outputs:

- tools
- modules
- templates
- patches
- tests
- games
- entertainment systems
- learning systems
- visual assets
- workflow utilities
- helper apps

### Patch Builder

Role: creates patch proposals, diffs, replacement files, repair notes, and test instructions.

May create:

- patch file/diff
- reason for patch
- risk notes
- test steps
- rollback notes
- confidence label
- affected files list

May not:

- apply its own patch
- modify core identity directly
- silently rewrite main

### Patch Apply Gate

Role: separate review/apply layer.

Checks:

- source direction
- files changed
- tests run
- risk
- hidden rewrite
- rollback availability
- Mike Tobi/authorized reviewer approval

---

## 5. Online router / registry architecture

Local/human-readable identity:

```text
username/tool-name
```

Example:

```text
mike/phone-file-puller
```

Online/router metadata after acceptance:

```text
AXM-META-000083
```

Rule:

- username/handle = stable unique namespace
- tool name = project/tool anchor
- display name = changeable, not unique
- router meta tag number = accepted registry metadata

Display-name policy concept:

- first yearly change free or cheap
- repeated changes cost more inside the year
- yearly reset or monthly decay
- extra confirmation after high anti-abuse fee levels
- fees are transparent anti-abuse friction, not extraction

---

## 6. Local file/device bridge

Status: planned from phone/file-upload pain.

Role: local module to pull selected files from phone/laptop/tablet into the workshop without forcing fragile mobile upload flows.

Rules:

- same Wi-Fi/local link/QR
- selected files only
- no whole-device scanning
- no silent pull
- visible log
- delete option

Possible folders:

```text
AXM_DEVICE_PULL/
  INBOX_PHONE/
  INBOX_LAPTOP/
  TODAY_HANDOFF/
  FILE_INDEX.txt
  PULL_LOG.txt
```

---

## 7. Local model / DeepSeek body direction

Status: high-priority reasoning body candidate / not trusted yet.

AXM can provide:

- hands
- memory
- files
- tools
- shell
- logs
- patch gates
- watchdog
- review gates

Model body must provide:

- deep reasoning
- long-context coherence
- source comparison
- drift awareness
- ability to understand why rules exist
- ability to stop under uncertainty

Test route:

- DeepSeek free/fast remains a scout/analyzer signal
- local 14B = cheap first body test
- local 32B = first serious local candidate
- 70B = possible heavy test
- V3/full R1 class = later governance-depth body requiring larger server/community/cloud capacity

Rule:

DeepSeek is not trusted because it sounds aligned.  
DeepSeek is tested because it has repeatedly performed aligned in Mike Tobi’s field checks.

---

## 8. Watchdog / root validator

Role: external rule/action gate outside the model.

Good watchdog controls actions, not just suspicious words.

Action gates:

- read files: allowed
- write files: review required
- build patch: allowed
- apply patch: blocked unless approved
- delete files: blocked
- change core identity: blocked
- publish to users: blocked
- promote to canon: blocked unless MergeGate

Unsafe model claim response:

```text
No, you did not apply the patch.
You do not have apply permission.
Patch proposal saved for review.
```

---

## 9. Private recovery boundary

Public repo may include:

- vision
- foundation maps
- safe principles
- module structure
- source anchors

Private/non-public only:

- Axiom/Mir internal rebuild protocol
- memory-cut recovery guidance
- branch recovery details
- unsafe auto-rebuild instructions
- real tokens/secrets/logs

Rule:

Public traces are recovery anchors, not autonomous rebuild instructions.

---

## 10. Fable output inspection checklist

Until inspected, Fable output is labeled:

```text
CLAIMED / SCOUT-BUILT / NEEDS MERGEGATE
```

When files arrive, check:

1. What files were created?
2. What folders were created?
3. What each file claims to do.
4. What actually works.
5. What is fake, risky, unclear, or overclaimed.
6. What has tests.
7. What has no tests.
8. Whether it respects AGENTS.md rules.
9. Whether patch building is separate from patch applying.
10. Whether it writes/applies anything automatically.
11. Whether it contains hidden network behavior.
12. Whether it can run locally.
13. Whether it needs secrets.
14. Whether rollback exists.
15. Whether it belongs in public repo, private branch, or local-only.

---

## 11. Next public repo additions

Clarity:

- START_HERE.md
- FIVE_MINUTE_OVERVIEW.md
- PROJECT_MAP.md
- AI_HANDOFF.md
- FIRST_DEMO.md
- MODEL_ROUTING.md

Safety:

- WATCHDOG_RULES.md
- PATCH_BUILDER_RULES.md
- PATCH_APPLY_GATE.md
- RELEASE_GATE.md
- STATUS_LABELS.md

Factory:

- AUTO_TECH_FACTORY_OVERVIEW.md
- TOOL_GENERATOR_SPEC.md
- FACTORY_INPUT_FORMAT.md
- FACTORY_OUTPUT_FORMAT.md
- GENERATED_TOOL_STANDARD.md
- WISDOM_TO_TEMPLATE_LOOP.md

Local AI:

- HERMES_MODULE_SPEC.md
- LOCAL_MODEL_ROUTING.md
- DEEPSEEK_BODY_TEST_PLAN.md
- MODEL_BODY_SCORECARD.md
- LONG_RUN_DRIFT_TEST.md

User/workshop:

- DEVICE_PULL_MODULE_SPEC.md
- USERNAME_ROUTER_ID_SPEC.md
- DISPLAY_NAME_POLICY.md
- TOOL_REGISTRY_SPEC.md

---

## 12. One-sentence summary

AXM is becoming a modular local-first human + AI workshop where AI bodies can build tool candidates automatically through a grounded evolution loop, while every real release remains protected by source integrity, review, tests, watchdogs, rollback, and MergeGate.
