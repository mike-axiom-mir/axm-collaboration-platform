# AXM Local Product Design Workflow

This is an original offline workflow for improving an existing product without losing its direction. It can be used by Mike, another human, or a local AI seat. It does not require this chat, an account, a cloud service, or network access.

## What it protects

- The existing product is the source, not disposable scaffolding.
- Context and intended human outcome are fixed before implementation.
- A visible target is approved before a visual build starts.
- Changes stay bounded, reversible, and attributable.
- Visual QA requires real local evidence rather than a claim.
- Reopening a gate preserves history and invalidates downstream approvals.
- The workflow never edits the target automatically.

## Beginner start

On Windows, double-click `START_LOCAL_PRODUCT_DESIGN_WORKFLOW.bat` in the package root.

Or open a terminal in the package folder and run:

```text
python tools/local_product_design.py start
```

The helper asks for a project name and target file/folder, then creates a local `design_runs/` packet with five numbered documents.

## Five gates

1. **Context** — What exists, what must remain, and what the user needs.
2. **Visual target** — The reference, state, viewport, and acceptance criteria.
3. **Build** — Bounded implementation plan, rollback, and changed-file record.
4. **Visual QA** — Reference-versus-result comparison with local screenshot evidence.
5. **Handoff** — Honest status, known gaps, rollback route, and one next action.

Use `python tools/local_product_design.py status PATH_TO_RUN` at any time. See `AXM_LOCAL_PRODUCT_DESIGN_PROMPT.txt` for a copy-paste instruction block for a local AI seat.

## Boundaries

The helper creates workflow records only. It does not inspect content meaning, browse the internet, call AI, rewrite product files, publish, deploy, or claim that a design passed. Approval remains explicit and local.
