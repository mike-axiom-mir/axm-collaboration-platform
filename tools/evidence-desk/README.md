# AXM Evidence Desk v0.2

Status: `TEST`. Evidence Desk is a bounded human-and-machine module. It records
supplied evidence; it does not inspect the world independently and it never
assigns `CANON`.

## What changed in v0.2

- Claims are typed and routed to a fitting proof surface.
- `PASS`, `FAIL`, and `UNKNOWN` are explicit. An incomplete declared verdict
  remains effectively `UNKNOWN`.
- A check declared `PASS` without evidence remains effectively `NOT_RUN`.
- Receipts use canonical SHA-256 content seals that can be recomputed after
  export or handoff.
- Knowledge Canvas handoff has separate preview and placement actions.
- An unread Canvas inbox packet is preserved rather than overwritten.
- Inbox placement is reported separately from receiver acceptance.

The v0.1 input shape remains accepted. Legacy observations become typed `other`
claims with an `UNKNOWN` verdict until a pass condition and evidence route are
supplied.

## Contracts

- Input: `axm.evidence-fields/v2` (v1 input remains accepted)
- Receipt: `axm.evidence-receipt/v2`
- Report: `axm.action-report/v2`
- Handoff receipt: `axm.evidence-handoff-receipt/v1`
- Knowledge packet: `axm.knowledge.research/v1`

The JSON schema files are `evidence-fields.schema.json` and
`evidence-receipt.schema.json`. Browser and machine doors share
`evidence-core.js`.

## Human workflow

1. Name the goal and source checkpoint.
2. Add each claim and choose its kind, risk, and current verdict.
3. Record the pass condition, what was observed, what would show the claim is
   wrong, and the source pointer.
4. Record actions, checks, changed paths, limitations, and next actions.
5. Build and seal the receipt.
6. Export only by explicit action, or preview a Knowledge Canvas packet before
   explicitly placing that exact packet in the inbox.

Draft save, receipt export, report export, and inbox placement pass through the
same local gate used by the existing module. No write is automatic.

## Machine workflow

`machine.js` exposes read-only `validate`, `build`, `verify`, and
`handoff-preview` actions. Every action requires an authenticated host-supplied
authorization decision. Machine calls do not save drafts, download files, or
write the Knowledge Canvas inbox.

## Truth boundaries and known limits

- A SHA-256 match proves that receipt content has not changed under the declared
  canonical scope. It does not prove that supplied observations are true.
- Evidence Desk does not run commands, inspect files, operate a browser, or
  perform an independent review.
- Knowledge Canvas v1 supports a manual inbox review but does not emit a receiver
  acknowledgement. Evidence Desk therefore leaves acceptance `PENDING` even
  after an exact local inbox readback.
- Draft persistence remains browser-local and requires explicit save/resume.
- The module is still `TEST`; promotion requires Mike's human review.

## Verification

```powershell
node tools/evidence-desk/selftest.js
node tools/evidence-desk/discovery-seam-review.js
node verify.js
```
