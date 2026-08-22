"""Detached AXM Falsification and Counterevidence Recorder v0.1.0."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Mapping
import copy
import json

EFFECTS = ("DISPROVE", "WEAKEN")

class FalsificationRecorderError(ValueError):
    """A falsification condition violates the pre-test recording contract."""

class DuplicateConditionError(FalsificationRecorderError):
    """A condition ID already exists and may not be overwritten."""

class CorruptConditionLedgerError(FalsificationRecorderError):
    """Stored falsification events are invalid."""

def _text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise FalsificationRecorderError(f"{field} must be a non-empty string")
    return value.strip()

def validate_condition(condition: Mapping[str, Any]) -> Dict[str, Any]:
    if not isinstance(condition, Mapping):
        raise FalsificationRecorderError("condition must be an object")
    item = copy.deepcopy(dict(condition))
    for field in ("condition_id", "claim_id", "observation", "proof_surface", "owner"):
        item[field] = _text(item.get(field), field)
    effect = _text(item.get("effect"), "effect").upper()
    if effect not in EFFECTS:
        raise FalsificationRecorderError("effect must be DISPROVE or WEAKEN")
    item["effect"] = effect
    if not isinstance(item.get("scope"), Mapping) or not item["scope"]:
        raise FalsificationRecorderError("scope must be a non-empty object")
    item["scope"] = copy.deepcopy(dict(item["scope"]))
    if _text(item.get("recording_phase"), "recording_phase").upper() != "PRE_TEST":
        raise FalsificationRecorderError("only PRE_TEST conditions are accepted")
    if _text(item.get("test_state_at_recording"), "test_state_at_recording").upper() != "NOT_RUN":
        raise FalsificationRecorderError("test_state_at_recording must be NOT_RUN")
    item["recording_phase"] = "PRE_TEST"
    item["test_state_at_recording"] = "NOT_RUN"
    item["observation_status"] = "NOT_OBSERVED"
    item["timing_basis"] = "CALLER_ATTESTED"
    item["schema_version"] = "axm.verify.falsification-condition/0.1"
    return item

@dataclass
class FalsificationConditionRecorder:
    path: Path

    def __init__(self, path: str | Path):
        self.path = Path(path)

    def _load(self) -> Dict[str, Dict[str, Any]]:
        result: Dict[str, Dict[str, Any]] = {}
        if not self.path.exists():
            return result
        with self.path.open("r", encoding="utf-8") as handle:
            for line_number, raw in enumerate(handle, 1):
                if not raw.strip():
                    continue
                try:
                    event = json.loads(raw)
                except json.JSONDecodeError as exc:
                    raise CorruptConditionLedgerError(f"invalid JSON at line {line_number}") from exc
                if event.get("event") != "RECORD_FALSIFICATION_CONDITION":
                    raise CorruptConditionLedgerError(f"unsupported event at line {line_number}")
                item = validate_condition(event.get("condition"))
                cid = item["condition_id"]
                if cid in result:
                    raise CorruptConditionLedgerError(f"duplicate condition_id at line {line_number}: {cid}")
                result[cid] = item
        return result

    def record(self, condition: Mapping[str, Any]) -> Dict[str, Any]:
        item = validate_condition(condition)
        existing = self._load()
        cid = item["condition_id"]
        if cid in existing:
            raise DuplicateConditionError(f"condition_id already recorded: {cid}")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        event = {"event": "RECORD_FALSIFICATION_CONDITION", "condition": item}
        with self.path.open("a", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(event, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")
        return copy.deepcopy(item)

    def snapshot(self) -> Dict[str, Any]:
        items = self._load()
        conditions = [copy.deepcopy(items[key]) for key in sorted(items)]
        return {
            "schema_version": "axm.verify.falsification-inventory/0.1",
            "condition_count": len(conditions),
            "conditions": conditions,
            "observed_counterevidence_count": 0,
            "authority": "NONE",
            "canon": False,
        }
