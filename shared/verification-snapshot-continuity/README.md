# Verification snapshot continuity

Status: `TEST`

This permissionless leaf distinguishes a changed mutable verification report
from changes to the sources that a historical receipt tracked. It verifies the
historical receipt's own declared digest, requires an exact current source set,
and recognizes only `exports/verification-spine-report.json` with schema
`axm.verification-spine-report/v2` as the mutable derived view.

The classifications are deliberately asymmetric. Mutable-derived-view drift
may be isolated only when every other tracked source still matches. Any tracked
source drift remains `TRACKED_SOURCE_DRIFT`; missing evidence, absent historical
self-digests, and unrecognized derived views remain explicit holds. Drift is not
called regression or harmless without review.

Historical derived bytes are not reconstructed from a digest. The module never
rewrites a historical receipt and does not claim that current broad verification
passed. It performs no I/O and grants no write, execution, permission,
installation, promotion, merge, Foundation, or `CANON` authority.

Its exported serialization and clone boundaries use the shared deterministic
JSON core. Unsupported or lossy states are refused instead of being silently
removed, coerced, or emitted as invalid JSON.
