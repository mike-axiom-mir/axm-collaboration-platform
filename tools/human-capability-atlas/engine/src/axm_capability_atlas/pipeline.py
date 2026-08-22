from __future__ import annotations

from pathlib import Path

from .io import load_json, save_json, save_text, remove_file_durable
from .validators import (
    validate_source,
    validate_card,
    validate_course,
    validate_producer_receipt,
)
from .atlas import build_card
from .views import quick_view, practical_view, deep_view
from .learning import learning_atoms, course_plan
from .conformance import (
    BUILD_IN_PROGRESS_MARKER,
    build_producer_receipt,
    validate_stable_handoff_card,
)
from .implementation_identity import implementation_fingerprint
from . import __version__, MODULE_ID


def build_from_file(source_path: str | Path, output_dir: str | Path) -> dict:
    source_path = Path(source_path)
    output_dir = Path(output_dir)
    source = load_json(source_path)

    source_errors = validate_source(source)
    if source_errors:
        raise ValueError("Source validation failed:\n" + "\n".join(source_errors))

    card = build_card(source, source_path)
    card_errors = validate_card(card)
    if card_errors:
        raise ValueError("Card validation failed:\n" + "\n".join(card_errors))

    conformance = validate_stable_handoff_card(card)
    if not conformance["valid"]:
        messages = []
        for section in ("shared_schema", "stable_evidence_policy", "stable_provenance_policy"):
            messages.extend(conformance[section]["issues"])
        raise ValueError("Stable handoff conformance failed:\n" + "\n".join(messages))

    course = course_plan(card)
    course_errors = validate_course(course)
    if course_errors:
        raise ValueError("Course validation failed:\n" + "\n".join(course_errors))

    output_dir.mkdir(parents=True, exist_ok=True)

    # Invalidate any earlier completion marker BEFORE touching derived outputs.
    # A crash during a rebuild can therefore never leave an old valid receipt
    # claiming that a partially replaced artifact set is complete.
    remove_file_durable(output_dir / "producer_receipt.json")
    marker_path = output_dir / BUILD_IN_PROGRESS_MARKER
    save_json(marker_path, {
        "build_state_version": "0.1.0",
        "state": "IN_PROGRESS",
        "producer_module_id": MODULE_ID,
        "producer_module_version": __version__,
        "implementation_fingerprint": implementation_fingerprint(),
        "capability_id": card.get("capability_id", ""),
    })

    # Each write is atomic. The producer receipt is the final semantic write and
    # binds every generated artifact, not only capability_card.json.
    save_json(output_dir / "capability_card.json", card)
    save_json(output_dir / "learning_atoms.json", learning_atoms(card))
    save_json(output_dir / "course_plan.json", course)
    save_text(output_dir / "quick_view.md", quick_view(card))
    save_text(output_dir / "practical_view.md", practical_view(card))
    save_text(output_dir / "deep_view.md", deep_view(card))

    receipt = build_producer_receipt(
        normalized_source_path=source_path,
        output_dir=output_dir,
        card=card,
        validation=conformance,
    )
    receipt_errors = validate_producer_receipt(receipt)
    if receipt_errors:
        raise ValueError(
            "Producer receipt validation failed:\n" + "\n".join(receipt_errors)
        )

    # Remove IN_PROGRESS durably, then write receipt LAST.
    remove_file_durable(marker_path)
    save_json(output_dir / "producer_receipt.json", receipt)
    return card
