# Offline Product Design Workflow

The packaged workflow lets a local human or AI improve a product without depending on this chat. It is record-first: the helper creates and guards design decisions, but never edits the product itself.

## Start simply

Windows: double-click `START_LOCAL_PRODUCT_DESIGN_WORKFLOW.bat`.

Any platform with Python 3:

```text
python tools/local_product_design.py start
```

Enter a project name and the file/folder being improved. The helper fingerprints the source before it creates `design_runs/PROJECT/`.

## Generated packet

- `STATE.json`: machine-readable gate state and preserved event history.
- `SOURCE_FINGERPRINT.json`: source path, byte/file count, and SHA-256 identity.
- `01_BRIEF.md`: existing product, human outcome, preserved roots, scope, and risks.
- `02_VISUAL_TARGET.md`: reference evidence, exact state/viewport, and visible acceptance criteria.
- `03_BUILD_PLAN.md`: rollback, planned/actual files, ownership, and verification.
- `04_VISUAL_QA.md`: same-state visual comparison and known misses.
- `05_HANDOFF.md`: outcome, real checks, gaps, rollback, and next action.

## Approval sequence

```text
python tools/local_product_design.py status design_runs/PROJECT
python tools/local_product_design.py approve design_runs/PROJECT context --by "Mike" --note "Brief reviewed"
python tools/local_product_design.py approve design_runs/PROJECT visual-target --by "Mike" --note "Target fixed"
python tools/local_product_design.py approve design_runs/PROJECT build --by "Reviewer" --note "Bounded build verified"
python tools/local_product_design.py approve design_runs/PROJECT visual-qa --by "Reviewer" --evidence path/to/comparison.png
python tools/local_product_design.py approve design_runs/PROJECT handoff --by "Mike" --note "Accepted for intake"
```

The helper blocks out-of-order approval, unfinished `[REQUIRED]` markers, missing QA evidence, and accidental overwrite of an existing run.

## Reopen safely

```text
python tools/local_product_design.py reopen design_runs/PROJECT visual-target --by "Mike" --reason "Target changed"
```

The history remains. The reopened gate becomes ready and every downstream approval becomes blocked until reviewed again.

## Local AI use

Give the local AI the run folder plus `workflows/product-design/AXM_LOCAL_PRODUCT_DESIGN_PROMPT.txt`. The prompt tells the seat to preserve the target, wait for context and target approval, verify rollback, record changed files, use real visual evidence, and state limitations honestly.

## Boundaries

- Standard-library Python only.
- No network, telemetry, AI call, deployment, or publishing.
- No automatic target mutation or approval on the user’s behalf.
- A fingerprint detects source identity; it does not prove authorship or product correctness.
- A screenshot is evidence of one state, not proof of accessibility, performance, or every interaction.
