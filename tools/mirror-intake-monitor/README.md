# Mirror Intake Monitor

Status: `TEST`

Technical child of Cognitive Resource Meter. It imports an explicit Mirror intake receipt and verifies that the receipt is bound to an exact Workshop draft digest.

It does not connect to Mirror automatically, read private Mirror state, use an absolute Mirror path, write Mirror, certify a receipt, or infer acceptance from export. Import requires `mirror.intake-receipt.import` and an explicit action header.

Verification: `node tools/mirror-intake-monitor/selftest.js`
