# Grounded Growth Signal Lineage

Status: `TEST`

This pure leaf answers one narrow continuity question: for every accepted
research signal and every rejected or deferred proposal, what exact current
evidence or explicit non-action state carries it now?

It is intentionally not the deferred human-facing “signal-link ledger.” It has
no UI, mutable database, scoring system, daemon, permissions, or action route.
It builds a derived, digest-bound receipt and keeps these states separate:

- current technical evidence;
- waiting for voluntary human-native evidence;
- rejected with no action;
- rejected as redundant with no action;
- deferred with no action.

Native verification rebuilds from the exact research disposition, current
Grounded Growth portfolio, and declared evidence sources. Detached inspection
can verify self-integrity, coverage coherence, and authority boundaries, but it
holds source truth and currentness at `UNKNOWN` without those sources.

Run:

```powershell
node shared/grounded-growth-signal-lineage/selftest.js
```

Nothing here executes research, starts participation, installs, grants
permission, promotes, merges, changes the Foundation, or makes a `CANON`
decision.
