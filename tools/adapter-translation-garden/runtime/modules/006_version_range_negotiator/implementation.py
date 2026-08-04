from __future__ import annotations
import re
from typing import Any


def _key(version: str) -> tuple[int, ...]:
    nums = re.findall(r"\d+", str(version))
    return tuple(int(x) for x in nums[:4]) or (0,)


def run(local_versions: list[str], remote_versions: list[str], *, minimum: str | None = None, maximum: str | None = None) -> dict[str, Any]:
    common = sorted(set(map(str, local_versions)) & set(map(str, remote_versions)), key=_key, reverse=True)
    if minimum is not None:
        common = [v for v in common if _key(v) >= _key(minimum)]
    if maximum is not None:
        common = [v for v in common if _key(v) <= _key(maximum)]
    if not common:
        return {"ok": False, "selected": None, "reason": "No mutually supported declared version", "candidates": []}
    return {"ok": True, "selected": common[0], "reason": "Highest mutually supported declared version", "candidates": common}
