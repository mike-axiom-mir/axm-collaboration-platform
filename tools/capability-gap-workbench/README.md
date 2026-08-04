# AXM Capability Gap Workbench

This non-game Workshop module gives the existing machine-facing Capability Gap
hand a bounded human interface.

Paste normalized requirements and a declared capability inventory, then inspect:

- the overall `READY`, `DEGRADED`, `UNKNOWN`, or `BLOCKED` route;
- available, degraded, unknown, and missing capability IDs per requirement;
- typed gap categories (`HAND`, `SKILL`, `AUTHORITY`, `SUBSTRATE`, `EVIDENCE`,
  `CONTRACT`, or `UNKNOWN`);
- contract fields still required before a missing capability can be built;
- a human-triggered `axm.capability-gap-report/v1` JSON download.

The comparator uses exact identifiers and declared statuses. It does not prove a
declaration, execute a capability, install anything, grant authority, weaken a
requirement, persist pasted inputs, promote a module, or make a canon decision.

## Input shapes

Requirements can be an array or `{ "requirements": [...] }`:

```json
{
  "requirements": [
    {
      "id": "local-check",
      "capabilities": ["filesystem.read"],
      "required": true,
      "gapType": "HAND"
    }
  ]
}
```

Inventory can be an array or `{ "capabilities": [...] }`:

```json
{
  "capabilities": [
    {
      "id": "filesystem.read",
      "status": "available",
      "constraints": ["explicit paths only"]
    }
  ]
}
```

## Verify

```powershell
node tools/capability-gap-workbench/selftest.js
node tools/capability-gap-workbench/discovery-seam-review.js
```

Browser rendering and interaction remain a separate verification surface.
