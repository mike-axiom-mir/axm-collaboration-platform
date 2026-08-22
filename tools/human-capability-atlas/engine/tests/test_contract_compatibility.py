from axm_capability_atlas.validators import compatible_contract


def test_exact_contract_version_is_compatible():
    ok, reason = compatible_contract("0.1.0")
    assert ok is True
    assert "Exact supported" in reason


def test_same_major_but_unvalidated_contract_is_not_compatible():
    ok, reason = compatible_contract("0.1.3")
    assert ok is False
    assert "Unvalidated" in reason


def test_different_major_contract_is_incompatible():
    assert compatible_contract("1.0.0")[0] is False


def test_malformed_contract_is_incompatible():
    assert compatible_contract("0.1")[0] is False
