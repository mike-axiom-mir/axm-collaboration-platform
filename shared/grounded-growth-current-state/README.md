# Grounded Growth Current State

Status: `TEST`

This additive leaf converges a verified voluntary-human participation frontier
with a later verified Grounded Growth portfolio. It proves that every earlier
outcome remains byte-identical and in the same order before admitting appended
outcomes as a forward extension.

The leaf preserves the optional human handoff only while no appended outcome
changes a capability protected by that handoff. If such a chain advances, the
result is `HOLD_PARTICIPATION_REBIND_REQUIRED`; older readiness is not silently
presented as current.

The receipt keeps technical evidence and human evidence distinct. Review is
not participation, readiness is not human benefit, and an AI-workflow pass is
not a human pass. The module performs no writes, participation, execution,
installation, permission grant, promotion, merge, `CANON` decision, or
Foundation mutation.

## Portable inspection

The full `verify(receipt, input)` route remains the only route that rebuilds the
deep source graph. A copied receipt can now be inspected without that graph:

```powershell
node shared/grounded-growth-current-state/verify-current-state.js <receipt.json>
```

Detached inspection checks strict structure, self-digest, internal count and
state coherence, and the no-authority boundary. A passing result is explicitly
`PORTABLE_INTEGRITY_PASS_SOURCE_TRUTH_UNKNOWN`: source truth and currentness
remain `UNKNOWN` until the native source receipts are available and rebuilt.
The CLI reads one explicit file and performs no writes or network activity.

Run focused checks with:

```powershell
node shared/grounded-growth-current-state/selftest.js
```
