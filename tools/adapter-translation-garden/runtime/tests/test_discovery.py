from __future__ import annotations
import unittest

from tools.module_loader import load_implementation


class DiscoveryTests(unittest.TestCase):
    def test_harvest_openapi(self):
        mod = load_implementation(1)
        result = mod.run({"openapi": "3.1.0", "paths": {"/things": {"get": {"operationId": "listThings"}}}})
        self.assertEqual(result["descriptor_kind"], "openapi")
        self.assertEqual(result["operations"][0]["operation_id"], "listThings")

    def test_catalog(self):
        mod = load_implementation(2)
        result = mod.run([{"adapter_id": "a", "read": ["x"], "write": []}])
        self.assertEqual(result["by_operation"]["x"], ["a"])

    def test_schema_detector(self):
        mod = load_implementation(4)
        result = mod.run({"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object"})
        self.assertEqual(result["family"], "JSON Schema")

    def test_representation_inspector_json(self):
        mod = load_implementation(5)
        result = mod.run(b'{"a":1}', "sample.json")
        self.assertEqual(result["media_type"], "application/json")

    def test_version_negotiation(self):
        mod = load_implementation(6)
        result = mod.run(["1.0", "2.0"], ["2.0", "3.0"])
        self.assertEqual(result["selected"], "2.0")

    def test_version_refusal(self):
        mod = load_implementation(6)
        self.assertFalse(mod.run(["1"], ["2"])["ok"])

    def test_feature_negotiation(self):
        mod = load_implementation(7)
        result = mod.run(supported=["alpha", "beta"], required=["alpha"], optional=["gamma"])
        self.assertTrue(result["ok"])
        self.assertEqual(result["unsupported_optional"], ["gamma"])

    def test_feature_refusal(self):
        mod = load_implementation(7)
        self.assertFalse(mod.run(supported=[], required=["alpha"])["ok"])

    def test_dependency_extractor(self):
        mod = load_implementation(8)
        result = mod.run({"runtime": "python", "permissions": ["read"]})
        self.assertEqual(result["runtimes"], ["python"])
        self.assertEqual(result["permissions"], ["read"])

    def test_drift_detector(self):
        mod = load_implementation(9)
        result = mod.run({"a": 1}, {"a": 2})
        self.assertTrue(result["drifted"])

    def test_canonical_envelope_preserves_native_identity(self):
        mod = load_implementation(11)
        result = mod.run({"name": "example"}, source_system="local", native_id="n-1")
        self.assertTrue(result["native_ownership_preserved"])
        self.assertEqual(result["native_id"], "n-1")

    def test_suitability_scorer(self):
        mod = load_implementation(10)
        result = mod.run([
            {"adapter_id": "weak", "compatibility": 0.5},
            {"adapter_id": "strong", "compatibility": 1, "trust": 1, "locality": 1, "fidelity": 1, "reversibility": 1, "proof_strength": 1},
        ])
        self.assertEqual(result["winner"], "strong")


if __name__ == "__main__":
    unittest.main()
