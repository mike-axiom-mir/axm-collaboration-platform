# RepairBuddy complete warning delta

Status: **EXPERIMENTAL**

RepairBuddy already routes game and lifecycle warnings toward evidence or repair design. The complete warning delta adds a cheaper orientation layer across every `verify.js` warning, including structural readiness warnings that do not belong to the game queue.

```powershell
node verify.js
node tools/repairbuddy/repairbuddy-cli.js warning-delta
node tools/repairbuddy/repairbuddy-cli.js warning-delta --json
node tools/repairbuddy/repairbuddy-cli.js warning-delta --strict
```

The checked-in baseline is an exact, digest-bound observation of warnings that are already open on its named base commit. `KNOWN_OPEN_NOT_ACKNOWLEDGED` is intentionally not a waiver. Comparison produces four non-overlapping sets:

- unchanged: still open with the same meaning and detail;
- added: new warning identity;
- resolved: absent now, but preserved in the delta rather than silently forgotten;
- changed: the same structured warning subject with different detail, such as a migration count.

Default CLI reporting is read-only and exits successfully even on drift. `--strict` exits `2` on drift for a caller that has explicitly chosen a no-warning-drift gate. Neither mode changes verifier results, rewrites the baseline, applies a repair, promotes a tool, or changes CANON.
