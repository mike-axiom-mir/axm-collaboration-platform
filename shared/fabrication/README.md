# AXM Future Fabrication Lane

Status: **RESEARCH HOLD / DIGITAL FOUNDATION TEST**

This is a vendor-neutral bridge from an approved AXM digital asset to a
bounded external fabrication test package. It is not a printer driver and it
does not execute hardware.

The lane reuses existing Workshop capabilities instead of creating a separate
island:

- Universal Component Protocol for source identity and lineage;
- manufacturing/3MF foundations for structured geometry packages;
- UV/material and colour contracts for surface intent;
- CNC/laser simulation precedent for operator-gated physical candidates;
- Asset Fabric incubation and independent human/machine review;
- Output Engine receipts and Publish & Library inbox behavior.

The advertised HeyGears G1 claims that sparked this lane remain
`UNVERIFIED_ADVERTISING`. The brand and machine do not define the contract.

## Boundary

```text
approved digital source
  -> versioned fabrication adapter
  -> physical metadata
  -> printability and simulation receipts
  -> human visual approval
  -> independent machine cross-check
  -> human operator approval for one bounded external test
  -> export package only
```

The final AXM artifact contains no hardware command, no automatic execution,
and no purchase decision. A real operator and machine-specific workflow remain
outside this research lane until separately integrated and verified.

Run:

```powershell
node shared/fabrication/selftest.js
node tools/fabrication-readiness-lab/selftest.js
```

`TEST` is not canon. Mike remains the promotion gate.
