# AXM Visual Proof

Status: **TEST**. This service binds an artifact digest, technical receipts,
and native visual observations into one deterministic
`axm.visual-proof-receipt/v1`. It does not render, inspect, approve, promote,
or retain visual material itself.

The receipt keeps four statements separate:

- the artifact identity;
- whether technical validators passed;
- whether an appropriate live or rendered surface supported the visual claim;
- whether any human approved the result (always `false` here).

Appearance, interaction, layout, accessibility, and motion claims remain
`UNKNOWN` without native visual evidence. Motion also remains `UNKNOWN` with
fewer than three ordered frames unless a bounded rolling-buffer digest exists.
Raw images, pixels, frames, video, data URLs, base64, absolute paths, approval,
canon, and automatic promotion are refused.
Visual references without their own digest remain `UNKNOWN`; the receipt cannot
turn an unbound path into evidence. Verification re-derives verdicts, seams,
cleanup state, timestamps, and the receipt digest instead of trusting the stored
verdict fields.

Run `node shared/visual-proof/selftest.js` for Asset Hands, Neural Visual,
motion-ceiling, deterministic sealing, tamper, and raw-material checks.
