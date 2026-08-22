# AXM capability intelligence trio

This platform seam installs and connects three independently supplied modules:

1. Human Capability Atlas (`0.11.0`) records and explains capabilities.
2. Human Interface Intelligence (`0.6.0`) recommends and assures interface patterns.
3. Grounded Evolution Intelligence (`0.7.0`) retains evidence-led signals and review candidates without promoting them to truth or authority.

The supplier engines remain under `tools/*/engine`. Original intake ZIPs and rollback lineage remain under `intakes/tri-20260809`.

## Operational platform workflow

`pipeline.py` implements `axm.platform.capability-intelligence-pipeline/1.0.0` in `LOCAL_TEST_NO_CANON` mode:

```text
source capability
  → Module 1 Capability Card + quick/practical/deep views + producer receipt
  → explicit Module 1 v0.11 to Module 2 v0.6 adapter + sender/receiver digest receipt
  → Module 2 recommendation + decision receipt + PASS assurance
  → structurally audited interface application
  → exact Module 2 recommendation digest handed to Module 3
  → Module 3 append-only signal report + non-authoritative need candidate
```

Run it with:

```powershell
powershell -ExecutionPolicy Bypass -File shared/capability-intelligence/run-pipeline.ps1
```

Durable outputs are written under `shared/capability-intelligence/generated/verified-workflow/`. The executable replay test runs the same workflow twice and requires the same-path receipt to remain deterministic:

```powershell
runtime/python/capability-intelligence/Scripts/python.exe shared/capability-intelligence/pipeline_selftest.py
```

## Platform-wide human usability

`platform_usability.py` repeats the same bounded chain for every module in the registered Workshop identity set. Module 1 creates a source-bound plain-language record, Module 2 selects and assures a beginner/accessibility-aware interface pattern, and Module 3 retains every ready result or unresolved review need with all authority flags closed.

The generated catalog is used by the Hub Capability Guide and by the `Guide` button that appears around every open registered module. This is one shared usability surface over module-owned interfaces; it does not silently rewrite 214 independent applications or claim that each application has been visually verified.

```powershell
runtime/python/capability-intelligence/Scripts/python.exe shared/capability-intelligence/platform_usability.py
runtime/python/capability-intelligence/Scripts/python.exe shared/capability-intelligence/platform_usability_selftest.py
node shared/capability-intelligence/platform-usability-ui-selftest.js
```

Durable outputs are written under `shared/capability-intelligence/generated/platform-usability/`. `coverage-receipt.json` binds all registered module IDs, recommendation/assurance distributions, Module 3 signals, current-manifest drift, and explicit limits.

## Interface world signals

The world-interface seam observes a small allowlist of official sources: W3C WCAG 2.2, WAI-ARIA 1.2, the ARIA Authoring Practices Guide, the WHATWG HTML forms standard, and contextual guidance from Material, Apple, Fluent, and GOV.UK. Normative standards, implementation guidance, living standards, and ecosystem examples stay visibly distinct.

Only source metadata, normalized content digests, timestamps, and change events are retained. Raw pages are not stored. Universal standards inform every relevant web pattern; ecosystem guidance is held unless the module explicitly declares the matching platform context. A detected source change can open Module 3 review, but it cannot alter a native interface, prove compliance, execute work, or grant CANON.

Refresh the bounded observations and rebuild all 214 module contexts with:

```powershell
powershell -ExecutionPolicy Bypass -File shared/capability-intelligence/refresh-world-interface.ps1
```

Repeated unchanged checks are aggregated in `generated/world-interface/check-summary.json`. Baselines, changes, availability transitions, and explicit acknowledgements form the append-only `change-events.jsonl` chain. A steward can acknowledge only a reviewed source comparison baseline with an explicit reviewer and note; acknowledgement does not approve a module change.

## Native contract hold

Module 1 and Module 2 both label their shared contract `0.1.0`, but the capability and recommendation schema bytes differ. The native Module 2 paired gate therefore remains `BLOCKED`.

The platform does not hide or rename that conflict. `trio.py` instead declares a separate bridge contract, `axm.platform.capability-interface-adapter/1.0.0`, with mapping `module1-v0.11-to-module2-v0.6`. It validates both sides, projects only admitted fields, maps truth states explicitly, retains Module 1-only data in a hashed sidecar, and permits bounded local test consumption. It does not claim native schema identity, Merge Gate passage, execution authority, human approval, or CANON.

## Runtime

The isolated Python runtime lives at `runtime/python/capability-intelligence`. Rebuild it with:

```powershell
powershell -ExecutionPolicy Bypass -File shared/capability-intelligence/bootstrap-runtime.ps1
```

Run the seam and pipeline self-tests:

```powershell
runtime/python/capability-intelligence/Scripts/python.exe shared/capability-intelligence/selftest.py
runtime/python/capability-intelligence/Scripts/python.exe shared/capability-intelligence/pipeline_selftest.py
```
