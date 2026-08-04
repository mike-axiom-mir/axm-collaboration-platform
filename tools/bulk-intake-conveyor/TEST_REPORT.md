# Bulk Intake Conveyor verification receipt

Verified on 2026-07-27 against the local Workshop.

## Deterministic behavior

- `node tools\bulk-intake-conveyor\selftest.js`: PASS, 14 checks.
- Synthetic pressure shape: 14 ZIP carriers in one receipt.
- Covered: exact duplicate parking, active-name collision routing, changed-path overlap, malformed ZIP hold, encrypted-entry hold, unclassified structure, bounded batches, identical resume, relationship reclassification, hidden absolute paths, performance evidence boundaries, and promotion/CANON authority holds.
- Adjacent regression tools: Archive Intake Cartographer 25 PASS; Module Lineage Comparator 26 PASS; Detached Candidate Nursery 18 PASS; Modular Intake Gate PASS; Review Inbox 23 assertions PASS.
- Tool readiness run: 82 PASS, 0 not-PASS, four bounded workers.
- Whole Workshop verifier: 0 FAIL, 37 pre-existing warnings.

## Capability-gap receipt

The normalized high-volume intake requirement changed from `BLOCKED` to `READY`. The before/after inventories and reports are preserved in `evidence/`. Constraints remain explicit: candidate identities are structural hints, active-name matches are not equivalence, resume rescans current relationships, and outputs require explicit paths.

## Live visual receipt

```text
claim: The receipt viewer clearly separates deterministic intake work from install, promotion, and CANON authority, and renders a 14-carrier / 1,400-candidate receipt without horizontal clipping.
surface / route: http://127.0.0.1:8788/tools/bulk-intake-conveyor/index.html
visual backend and fallback reason: BROWSER_PRIMARY; no Windows fallback needed
viewport / device / seat: 1265 x 705 desktop browser
baseline evidence: initial page exposed Inventory and Deduplicate evidence as automatic; Install or promote as never automatic; CANON as Mike required.
action: loaded examples/synthetic-receipt.json through the local receipt picker
expected visible change: dashboard appears with 14 carriers, 1,400 candidates, 1 exact duplicate, 2 deeper-review batches, and separate judgment/ready queues
observed sequence: initial viewer -> synthetic receipt loaded -> dashboard visible with the expected four metrics and queue counts
typed observation: final document scroll width equaled viewport width (1265); dashboard was visible; judgment count 3; ready count 3; browser warning/error log empty
verdict: PASS
named seam: VISUAL_SEAM repaired during the loop; the initially hidden file input caused 1428 px document width in a 1265 px viewport. Scoping it inside the visible button removed the overflow.
buffer digest: not applicable; static before/after screenshots only, no rolling buffer created
temporary paths deleted: none created
cleanup complete: yes
next cheapest test: load the first real master receipt when the fourteen supply carriers arrive
```

The visual result proves desktop rendering and local receipt loading. It does not prove archived content quality, install readiness, performance at an undeclared workload, mobile layout, or merge safety.
