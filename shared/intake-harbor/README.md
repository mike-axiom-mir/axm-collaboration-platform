# AXM LEGO City Quarantined Intake Harbor

Status: **EXPERIMENTAL**

The Harbor is the exact fifteen-step intake state machine from the grounded
build map. It records digest-bound receipts from separately authorized tools
and humans. It performs no unpack, scan, install, test execution, promotion,
rejection effect, or rollback effect itself.

Imported bytes remain quarantined, untrusted, uninstalled, and unpromoted even
after all steps. A positive promotion decision ends in
`COMPLETE_EXTERNAL_ACTION_REQUIRED`; Mike’s separate review/action gate remains.
Receipts may store finding categories and counts, never secret values.
