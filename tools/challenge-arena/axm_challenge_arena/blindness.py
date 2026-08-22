from __future__ import annotations

import hashlib
import hmac
import secrets
from typing import Any

from .errors import IntegrityError
from .utils import sha256_json

BLIND_ORDER_ALGORITHM_V1 = "hmac-sha256-sealed-seed-v1"
BLIND_ORDER_ALGORITHM_V2 = "hmac-sha256-opaque-labels-v2"
BLIND_ORDER_ALGORITHM = BLIND_ORDER_ALGORITHM_V2
SUPPORTED_BLIND_ORDER_ALGORITHMS = {BLIND_ORDER_ALGORITHM_V1, BLIND_ORDER_ALGORITHM_V2}


def new_blind_seed() -> str:
    return secrets.token_hex(32)


def blind_seed_commitment(
    challenge_id: str,
    seed: str,
    *,
    algorithm: str = BLIND_ORDER_ALGORITHM,
) -> str:
    _seed_bytes(seed)
    if algorithm not in SUPPORTED_BLIND_ORDER_ALGORITHMS:
        raise IntegrityError(f"Unsupported blind-order algorithm: {algorithm!r}")
    return sha256_json(
        {
            "algorithm": algorithm,
            "challenge_id": challenge_id,
            "seed": seed,
        }
    )


def _seed_bytes(seed: str) -> bytes:
    if not isinstance(seed, str) or len(seed) != 64:
        raise IntegrityError("Blind seed must be a 32-byte lowercase hexadecimal value.")
    try:
        value = bytes.fromhex(seed)
    except ValueError as exc:
        raise IntegrityError("Blind seed is not valid hexadecimal.") from exc
    if seed != seed.lower() or len(value) != 32:
        raise IntegrityError("Blind seed must be canonical lowercase hexadecimal.")
    return value


def build_blind_map(
    active_submissions: list[dict[str, Any]],
    *,
    challenge_id: str,
    packet_hash: str,
    seed: str,
    algorithm: str = BLIND_ORDER_ALGORITHM,
) -> dict[str, str]:
    key = _seed_bytes(seed)
    if algorithm not in SUPPORTED_BLIND_ORDER_ALGORITHMS:
        raise IntegrityError(f"Unsupported blind-order algorithm: {algorithm!r}")

    def order_key(submission: dict[str, Any]) -> str:
        payload = sha256_json(
            {
                "challenge_id": challenge_id,
                "packet_hash": packet_hash,
                "submission_id": submission.get("submission_id"),
                "content_hash": submission.get("content_hash"),
                "artifact_set_hash": submission.get("artifact_set_hash"),
            }
        ).encode("ascii")
        return hmac.new(key, payload, hashlib.sha256).hexdigest()

    ordered = sorted(
        active_submissions,
        key=lambda submission: (order_key(submission), str(submission.get("submission_id", ""))),
    )
    if algorithm == BLIND_ORDER_ALGORITHM_V1:
        return {
            f"Candidate-{index:02d}": str(submission["submission_id"])
            for index, submission in enumerate(ordered, start=1)
        }

    # v2 deliberately avoids a predictable sequential namespace. A reviewer who
    # does not receive their own candidate can no longer infer its label merely
    # from a missing number. The labels remain reproducible after seed reveal.
    result: dict[str, str] = {}
    for submission in ordered:
        submission_id = str(submission["submission_id"])
        label_digest = hmac.new(
            key,
            (
                "blind-label\0"
                + challenge_id
                + "\0"
                + packet_hash
                + "\0"
                + submission_id
            ).encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        # Start at 64 bits and deterministically extend only in the astronomically
        # unlikely event of a collision. No random retry state is required.
        width = 16
        while True:
            label = f"Candidate-{label_digest[:width]}"
            if label not in result:
                break
            width += 4
            if width > len(label_digest):
                raise IntegrityError("Opaque blind-label digest collision could not be resolved.")
        result[label] = submission_id
    return result
