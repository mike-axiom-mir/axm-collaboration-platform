AXM EVIDENCE DESK v0.1
======================

STATUS
TEST / bounded factory trial. Not canon.

WHY THIS MODULE EXISTS
Work Mode and other agents need a compact way to hand evidence back after a
temporary run. The module separates what was observed, what was executed,
what was actually checked, what changed, what remains untested, and what comes
next. It never treats receipt generation as independent verification.

FACTORY PROVENANCE
Agent Tool Forge was inspected first. Its current UI is an honest display/spec
shell and cannot assemble parts yet. This trial therefore followed its written
Forge loop manually:

1. Prepared evidence-receipt skill, task wrapper and template pack as REVIEW.
2. Copied the existing basic-tool Foundation spine.
3. Assembled this module manually from those parts.
4. Added one shared evidence core used by browser and machine adapters.
5. Added direct selftests and Workshop verification.

HUMAN DOOR
index.html builds, saves and exports receipts. Save/export actions pass through
the browser AXMGate. The user supplies the evidence; the module does not inspect
the world by itself.

MACHINE DOOR
machine.js exposes read-only validate/build actions. It refuses direct calls
without an authenticated host-supplied authorize function. A caller-supplied
display name never creates authority.

LIMITS
- No Machine Host is included here.
- No automatic file inspection.
- No automatic truth verification.
- No patch application, deletion, network or canon action.
- The portable fingerprint detects accidental change; it is explicitly not a
  cryptographic security signature.
