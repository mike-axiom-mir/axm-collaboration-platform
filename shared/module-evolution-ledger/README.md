# AXM Module Evolution Ledger

Status: `TEST`

This leaf subsystem records how a Workshop module evolves without taking over any operational authority. It provides immutable semantic-version lineage, an append-only known-good pointer history, bounded patch/rebase evaluation, upgrade-pacing decisions, and interrupted-activation recovery metadata.

It does **not** inspect or quarantine intake packages, write module files, install, promote, verify, snapshot, restore, roll back, research the network, execute a provider, grant permission, or mutate CANON.

## Authority shape

- Neutral Modular Intake remains the inspect, quarantine, family, and compatibility authority.
- Module Installer remains the only module file-write/install authority.
- Verification Spine and specialist verifiers remain verification authorities. A pass only advances an activation record to `AWAITING_MIKE_ACCEPTANCE`.
- Recovery Center remains snapshot/restore/rollback authority. The ledger can emit a review-only handoff with `actionPerformed: false`.
- Evidence Retention remains append-only session-evidence authority.
- Workshop Needs Observatory remains the readiness/gap view.
- Mike's review, permission, exact confirmation, known-good selection, and promotion gates remain outside and above this ledger.

The machine-readable boundary is [module.contract.json](module.contract.json).

## Local storage contract

`local-append-adapter.js` writes only beneath `<workshopRoot>/state/module-evolution-ledger`:

- each completed mutation is one immutable, SHA-256-chained event file;
- a local `writer.lock` serializes writers;
- every append requires and rechecks an exact `expectedRevision` while holding that lock;
- the event file is flushed before an atomic rename from a pending filename;
- an abandoned lock is reported as `LEDGER_BUSY` and is never stolen automatically.

This is an honest local serialized-append contract. It does not claim filesystem-wide ACID, network replication, or SQLite WAL. Node 24's built-in SQLite capability was available during adaptation, but introducing another canonical database would have competed with today's Workshop state systems. The dependency-free event adapter gives the required stale-writer guarantee with a smaller authority surface.

## Version and known-good records

`recordVersion()` requires:

- strict semantic versioning;
- an exact SHA-256 content digest;
- the current module head as `parentRecordId`;
- an exact ledger revision.

Ancestry is derived, never caller-authored. Records have no update method. `selectKnownGood()` appends a pointer selection and requires `MIKE SELECTS KNOWN GOOD`; old selections remain in history. A known-good pointer is a ledger fact, not install or promotion authority.

## Bounded patches

The pure patch evaluator accepts 1-32 object-property operations:

- `set_if_missing`
- `replace`
- `remove`
- `append_unique`
- `add_unique_values`

Each plan stores witnesses from the declared base. When the current document has unrelated newer fields or safe list additions, evaluation returns `REBASE_SAFE` and preserves them. A touched-path conflict returns `REBASE_HOLD` with no output document. The evaluator never writes a file.

## Pacing and hotfixes

Mike can configure autonomous enablement, allowed bump kinds, the minimum proposal interval, and the maximum number of open proposals. Those settings apply only to autonomous proposals. `mikeApprovedHotfixBypass` is fixed `true`; an exact `MIKE APPROVES HOTFIX PROPOSAL` plus an approval reference bypasses pacing, while all lineage and patch bounds still apply.

## Interrupted activation state machine

```text
PREPARED -> ACTIVATING -> AWAITING_VERIFICATION -> AWAITING_MIKE_ACCEPTANCE -> ACCEPTED_AS_OBSERVED
     |           |                  |
     +-----------+-> NOT_APPLIED    +-> VERIFICATION_HOLD -> RECOVERY_HANDOFF_RECORDED
                 +-> RECOVERY_HOLD --------------------------^
```

`PREPARED` and `ACTIVATING` are derived as `INTERRUPTED_HOLD` after a restart. Inspection is read-only. An external digest observation decides whether bytes appear unchanged, match the target, or require Recovery Center review. No inspection or transition calls Module Installer or Recovery Center.

## Module Installer handoff

`module-installer-handoff.js` is a pure adapter. It normalizes current Workshop manifest versions such as `v0.3` to semantic version `0.3.0` and produces typed ledger inputs from Installer candidate, review, and receipt facts. It does not invoke the Installer and is intentionally not wired into the live shared Installer seam in this version. The sequencing handoff is documented in [INTAKE_ADAPTATION_RECEIPT.md](INTAKE_ADAPTATION_RECEIPT.md).

## Verification

```powershell
node shared/module-evolution-ledger/selftest.js
node tools/module-installer/selftest.js
node shared/operations/selftest.js
node shared/verification-spine/selftest.js
node tools/recovery-center/selftest.js
node verify.js
```

The focused selftest includes a real two-process writer race and a fresh-process interrupted-activation inspection.
