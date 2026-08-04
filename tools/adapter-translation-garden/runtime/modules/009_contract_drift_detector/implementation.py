from __future__ import annotations
from axm_translation_core import contract_fingerprint, diff_values


def run(reviewed_contract, observed_contract):
    reviewed = contract_fingerprint(reviewed_contract)
    observed = contract_fingerprint(observed_contract)
    changes = diff_values(reviewed_contract, observed_contract)
    return {
        "drifted": reviewed["digest"] != observed["digest"],
        "reviewed_fingerprint": reviewed,
        "observed_fingerprint": observed,
        "changes": changes,
    }
