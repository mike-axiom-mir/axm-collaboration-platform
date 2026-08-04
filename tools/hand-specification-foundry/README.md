# AXM Hand Specification Foundry

The Foundry is a non-game Workshop tool and machine-usable hand for converting
one typed capability gap into an implementation-neutral specification.

It accepts `axm.capability-gap-report/v1`, selects one proposed contract, and
requires explicit declarations for:

1. capability ID and purpose;
2. inputs and schemas;
3. outputs and schemas;
4. side effects;
5. permissions and consent;
6. resource budget;
7. failure and recovery behavior;
8. compatibility and version contract;
9. verification contract and human promotion gate.

The output is `axm.missing-hand-specification/v1`. Every output remains `DRAFT`
and explicitly records that the hand is not installed, executed, authorized,
promoted, canonized, or closed by a prototype/mock.

The browser surface stores nothing. Download occurs only after an explicit
button action. No dependency, runtime, network, filesystem, permission, or
promotion authority is granted.

## Verify

```powershell
node tools/hand-specification-foundry/selftest.js
node tools/hand-specification-foundry/discovery-seam-review.js
```

Browser rendering and interaction remain a separate verification surface.
