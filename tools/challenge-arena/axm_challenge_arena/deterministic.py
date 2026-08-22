from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import Any

from .utils import clamp, utc_now
from .version import __version__
from .validators import ValidatorRegistry, build_default_registry


class DeterministicEngine:
    """Runs reproducible checks and maps their evidence into deterministic rubric scores."""

    def __init__(self, registry: ValidatorRegistry | None = None, *, allow_execution: bool = False) -> None:
        self.registry = registry or build_default_registry()
        self.allow_execution = allow_execution

    def run_submission(
        self,
        packet: dict[str, Any],
        submission_dir: Path,
        manifest: dict[str, Any],
        *,
        runtime: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        results = [
            self.registry.run(
                check,
                submission_dir,
                manifest,
                allow_execution=self.allow_execution,
                runtime=runtime or {},
            )
            for check in packet.get("deterministic_checks", [])
        ]
        criterion_buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for result in results:
            criterion_id = result.get("criterion_id")
            if criterion_id:
                criterion_buckets[str(criterion_id)].append(result)

        criterion_scores: dict[str, dict[str, Any]] = {}
        for criterion in packet.get("rubric", []):
            if criterion.get("source") != "deterministic":
                continue
            criterion_id = criterion["id"]
            bucket = criterion_buckets.get(criterion_id, [])
            scored = [item for item in bucket if item.get("score") is not None]
            if not scored:
                criterion_scores[criterion_id] = {
                    "score": None,
                    "coverage": 0,
                    "summary": "No scored deterministic checks mapped to this criterion.",
                }
                continue
            weighted_total = sum(float(item.get("score", 0)) * float(item.get("weight", 1)) for item in scored)
            weight_total = sum(float(item.get("weight", 1)) for item in scored)
            score = clamp(weighted_total / weight_total if weight_total else 0.0)
            criterion_scores[criterion_id] = {
                "score": round(score, 6),
                "coverage": len(scored),
                "summary": f"{len(scored)} deterministic check(s) contributed.",
            }

        required_failures = [
            item for item in results if item.get("required") and item.get("status") in {"FAIL", "ERROR"}
        ]
        passed = sum(1 for item in results if item.get("status") == "PASS")
        failed = sum(1 for item in results if item.get("status") in {"FAIL", "ERROR"})
        skipped = sum(1 for item in results if item.get("status") == "SKIP")
        return {
            "engine_version": __version__,
            "ran_at": utc_now(),
            "allow_execution": self.allow_execution,
            "summary": {
                "total": len(results),
                "passed": passed,
                "failed_or_error": failed,
                "skipped": skipped,
                "required_failures": len(required_failures),
            },
            "eligible": not required_failures,
            "criterion_scores": criterion_scores,
            "checks": results,
        }
