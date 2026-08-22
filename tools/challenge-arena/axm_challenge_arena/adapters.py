from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Protocol

from .utils import read_json


class ParticipantAdapter(Protocol):
    """Neutral boundary for any AI, deterministic builder, or human-assisted worker."""

    adapter_id: str

    def prepare_build(self, challenge_packet: dict[str, Any], destination: Path) -> dict[str, Any]:
        """Deliver a locked build packet and return a transport receipt."""
        ...

    def collect_submission(self, source: Path) -> tuple[Path, dict[str, Any]]:
        """Return an artifact directory and submission manifest."""
        ...

    def prepare_review(self, review_packet: dict[str, Any], destination: Path) -> dict[str, Any]:
        """Deliver an anonymous review packet and return a transport receipt."""
        ...

    def collect_review(self, source: Path) -> dict[str, Any]:
        """Return a completed review object."""
        ...


@dataclass
class CallableAdapter:
    """In-process adapter for a local agent, test harness, or AXM courier callback."""

    adapter_id: str
    build_callback: Callable[[dict[str, Any], Path], dict[str, Any]]
    review_callback: Callable[[dict[str, Any], Path], dict[str, Any]]

    def prepare_build(self, challenge_packet: dict[str, Any], destination: Path) -> dict[str, Any]:
        destination.mkdir(parents=True, exist_ok=True)
        return self.build_callback(challenge_packet, destination)

    def collect_submission(self, source: Path) -> tuple[Path, dict[str, Any]]:

        artifacts = source / "artifacts"
        manifest = read_json(source / "submission.json", max_bytes=8 * 1024 * 1024)
        return artifacts, manifest

    def prepare_review(self, review_packet: dict[str, Any], destination: Path) -> dict[str, Any]:
        destination.mkdir(parents=True, exist_ok=True)
        return self.review_callback(review_packet, destination)

    def collect_review(self, source: Path) -> dict[str, Any]:

        return read_json(source / "review.json", max_bytes=8 * 1024 * 1024)
