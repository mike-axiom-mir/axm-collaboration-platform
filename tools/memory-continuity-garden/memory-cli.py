from __future__ import annotations

import argparse
import copy
import hashlib
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / "runtime"


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def file_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sealed(value: dict[str, Any]) -> bool:
    body = copy.deepcopy(value)
    seal = body.pop("seal", {})
    return seal.get("algorithm") == "sha256" and seal.get("body_sha256") == hashlib.sha256(canonical(body)).hexdigest()


def validate() -> dict[str, Any]:
    catalog = load(ROOT / "catalog.json")
    errors: list[str] = []
    seen: set[str] = set()
    for row in catalog["candidates"]:
        module_dir = ROOT / row["module_path"]
        candidate_path = module_dir / "candidate.contract.json"
        compiled_path = module_dir / "compiled_contract.json"
        candidate = load(candidate_path)
        compiled = load(compiled_path)
        stable_id = row["stable_id"]
        if stable_id in seen:
            errors.append(f"duplicate stable id: {stable_id}")
        seen.add(stable_id)
        if candidate["identity"]["stable_id"] != stable_id:
            errors.append(f"candidate identity mismatch: {stable_id}")
        if not sealed(candidate):
            errors.append(f"candidate seal mismatch: {stable_id}")
        if not sealed(compiled):
            errors.append(f"compiled seal mismatch: {stable_id}")
        if compiled["source_contract_sha256"] != file_digest(candidate_path):
            errors.append(f"compiled source digest mismatch: {stable_id}")
        if row["semantic_executable"] or row["full_semantics_claimed"]:
            errors.append(f"false semantic implementation claim: {stable_id}")
    return {
        "schema": "axm.memory.reference-validation/v1",
        "status": "PASS" if not errors else "FAIL",
        "candidates": len(catalog["candidates"]),
        "unique_stable_ids": len(seen),
        "semantic_executables": 0,
        "errors": errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--list", action="store_true")
    mode.add_argument("--search")
    mode.add_argument("--describe")
    mode.add_argument("--validate", action="store_true")
    args = parser.parse_args()
    catalog = load(ROOT / "catalog.json")
    if args.validate:
        result = validate()
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if result["status"] == "PASS" else 1
    rows = catalog["candidates"]
    if args.list:
        result: Any = rows
    elif args.search is not None:
        needle = args.search.casefold()
        result = [
            row for row in rows
            if needle in " ".join(
                str(row[key]) for key in ("stable_id", "name", "category", "purpose", "risk", "posture")
            ).casefold()
        ]
    else:
        needle = args.describe.casefold()
        result = next(
            (
                row for row in rows
                if row["stable_id"].casefold() == needle or str(row["number"]) == needle
            ),
            None,
        )
        if result is None:
            print(json.dumps({"error": "candidate not found", "query": args.describe}), file=sys.stderr)
            return 2
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
