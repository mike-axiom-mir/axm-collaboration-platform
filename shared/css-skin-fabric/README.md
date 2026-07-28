# AXM CSS Skin Fabric — Organ Pack v0.2.0

A local-first visual workshop for growing professional CSS without losing source integrity, accessibility, rollback or human control.

v0.2 preserves the v0.1 architecture and turns the static gallery into a working laboratory:

- **18 connected organs**, including the Visual Constitution, Compatibility Governor, Contrast Inspector, Theme Laboratory and Change Packet Builder.
- **16 component molds**, including progress, notices, data tables, command surfaces, skeletons and inspectors.
- **11 governed material recipes**, including Aetherglass, Obsidian Ceramic and Signal Weave.
- **8 themes**, including signature Aetherglass and lower-chroma Calm Workshop.
- **15 layout primitives**, including container regions, switchers, dashboards and docks.
- **146 exported token definitions** in `dist/axm-tokens.json`.
- Browser-computed contrast evidence, target-size checks, feature fallbacks and narrow-container previews.
- Candidate-only mold and visual-change generation. Nothing self-promotes or silently overwrites canonical files.

## Start locally

Windows:

```text
START_LOCAL_WINDOWS.bat
```

Linux or macOS:

```text
./start_local.sh
```

Open the printed local address. The workshop itself uses no account, telemetry, external asset, cloud call, package install or build step.

## Use the Theme Laboratory

The browser workshop exposes only allowlisted visual variables. It can tune:

- primary and secondary accents;
- automatically selected readable on-accent text;
- backdrop blur and edge glow;
- control radius and card padding;
- wide, panel and phone container widths.

`Export packet` downloads a `TEST-HOLD-REVIEW` JSON record containing source, purpose, values, diagnostics and rollback context. Canonical CSS remains unchanged.

## Validate the pack

```bash
python tools/validate_pack.py
```

## Audit an existing AXM project

```bash
python tools/audit_css.py /path/to/project --out audit-output
```

The read-only audit creates:

- `AUDIT_REPORT.md`
- `audit-data.json`
- `migration-candidates.json`

Its weighted score is a prioritization signal, not an automatic judgment.

## Generate a component candidate

```bash
python tools/mold_breeder.py examples/mold-request.json
```

The breeder now supports every registered component mold and records the states that still require review.

## Build a traceable visual-change packet

```bash
python tools/visual_change_packet.py examples/visual-change.json
```

The output contains candidate CSS, a manifest, a review checklist and a specimen. Only allowlisted public tokens can be changed.

## Export tokens

```bash
python tools/token_bridge.py export
```

Create a basic token candidate:

```bash
python tools/token_bridge.py candidate examples/token-overrides.json
```

## Optional screenshot smoke test

When Python Playwright and a Chromium executable are available:

```bash
python tools/visual_smoke.py
```

The harness bundles the local HTML, CSS and JavaScript in memory, captures desktop and mobile evidence, and records browser console errors.

## Intake boundary

This pack has not migrated the real AXM platform. The safe intake remains:

1. checkpoint and rollback pointer;
2. source audit;
3. before screenshots;
4. legacy containment;
5. no-visible-change token extraction;
6. one component family at a time;
7. human promotion after evidence.

No automatic canon. No silent rewrite. No generator self-approval.
