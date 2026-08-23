# Test report

Status: `PASS` for the inert v0.7 binder.

- New binder: 35 adversarial cases PASS.
- Code Capability Fabric continuity: 20/20 selftest scripts PASS.
- Host/game continuity: 6/6 scripts PASS.
- All ten AGENTS.md commands PASS.
- `verify.js`: exit 0, 22 warning lines.
- `hub/verify-plus.js`: exit 0, 22 warning lines.
- Changed JavaScript syntax: PASS.
- Changed JSON parse: PASS.
- Closed-schema/local-reference checks: PASS.
- `git diff --check`: PASS; staging emitted only line-ending conversion notices.

Adversarial coverage includes forged candidate/evaluation/instance/declaration/ledger digests, consent for another candidate, silent candidate ranking/selection, selected-byte length/digest drift, consent/declaration reference drift, machine-seat schema, root evidence schema/order/HOLD drift, scope/authentication/revocation/authority expansion, expired declarations, stale ledger observation, nonce replay, duplicate ledger nonces, forged truth ceilings, hidden holds, and forbidden filesystem/network/process/lifecycle hands.

Browser verification: `NOT_APPLICABLE`; no visual path changed.

Candidate execution and candidate-specific target tests: `NOT_RUN`. Trusted implementation selftests are separate from candidate execution.

The 22 warnings are pre-existing Workshop baseline debt and remain visible. No warning-repair claim is made.
