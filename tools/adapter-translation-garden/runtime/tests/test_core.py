from __future__ import annotations
import unittest

from axm_translation_core import (
    add_loss, allowlist_decision, build_proof_packet, contract_fingerprint,
    diff_values, explain_translation, new_loss_ledger,
)


class CoreTests(unittest.TestCase):
    def test_fingerprint_is_order_independent(self):
        self.assertEqual(contract_fingerprint({"a": 1, "b": 2})["digest"], contract_fingerprint({"b": 2, "a": 1})["digest"])

    def test_fingerprint_changes_with_value(self):
        self.assertNotEqual(contract_fingerprint({"a": 1})["digest"], contract_fingerprint({"a": 2})["digest"])

    def test_loss_ledger_summary(self):
        ledger = new_loss_ledger()
        add_loss(ledger, kind="rounded", path="$.size", source_value=1.25, target_value=1, reason="integer target", severity="low")
        self.assertEqual(ledger["summary"]["count"], 1)
        self.assertEqual(ledger["summary"]["max_severity"], "low")

    def test_allowlist_denies_without_rules(self):
        self.assertFalse(allowlist_decision({"operation": "read"}, {})["allowed"])

    def test_allowlist_allows_exact_match(self):
        decision = allowlist_decision({"operation": "read", "path": "/safe"}, {"operations": ["read"], "paths": ["/safe"]})
        self.assertTrue(decision["allowed"])

    def test_allowlist_denies_mismatch(self):
        decision = allowlist_decision({"operation": "write"}, {"operations": ["read"]})
        self.assertFalse(decision["allowed"])

    def test_diff_reports_nested_change(self):
        changes = diff_values({"a": {"b": 1}}, {"a": {"b": 2}})
        self.assertEqual(changes[0]["path"], "$.a.b")

    def test_blocking_loss_refuses(self):
        ledger = new_loss_ledger()
        add_loss(ledger, kind="unsupported", path="$.feature", reason="cannot preserve", severity="blocking")
        packet = build_proof_packet(request_id="r1", source={"x": 1}, target={"x": 1}, loss_ledger=ledger, authority={"mode": "preview"}, claims=[])
        self.assertEqual(packet["verdict"], "REFUSE")
        self.assertIn("must not proceed", explain_translation(packet))


if __name__ == "__main__":
    unittest.main()
