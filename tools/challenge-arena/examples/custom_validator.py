"""Example of adding deterministic evidence without changing Arena core code."""

from axm_challenge_arena import ChallengeArena
from axm_challenge_arena.validators import build_default_registry


def signed_asset_factory_receipt(context):
    receipt_paths = [path for path in context.targets() if path.name.endswith(".receipt.json")]
    if not receipt_paths:
        return {
            "status": "SKIP",
            "score": None,
            "summary": "No signed Asset Factory receipt was supplied.",
            "evidence": {},
        }
    # Production code would verify a signature or trusted local runner hash here.
    return {
        "status": "PASS",
        "score": 100,
        "summary": "Trusted local Asset Factory receipt was present.",
        "evidence": {"receipts": [path.name for path in receipt_paths]},
    }


registry = build_default_registry()
registry.register("asset_factory_signed_receipt", signed_asset_factory_receipt)
arena = ChallengeArena("./workspace", validator_registry=registry)
print("Custom validator registered:", "asset_factory_signed_receipt")
