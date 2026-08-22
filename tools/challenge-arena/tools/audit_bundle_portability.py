#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import random
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from axm_challenge_arena import ChallengeArena, verify_evidence_bundle
from axm_challenge_arena.demo import run_demo
from axm_challenge_arena.utils import sha256_file


def _repack(source: Path, destination: Path, order: list[int]) -> None:
    with zipfile.ZipFile(source, "r") as src, zipfile.ZipFile(
        destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9
    ) as dst:
        infos = src.infolist()
        for index in order:
            info = infos[index]
            payload = src.read(info)
            copied = zipfile.ZipInfo(info.filename, info.date_time)
            copied.compress_type = info.compress_type
            copied.comment = info.comment
            copied.extra = info.extra
            copied.internal_attr = info.internal_attr
            copied.external_attr = info.external_attr
            copied.create_system = info.create_system
            copied.flag_bits = info.flag_bits & ~0x1
            dst.writestr(copied, payload)


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Repack one valid Arena evidence bundle in deterministic randomized ZIP member "
            "orders and verify that transport ordering does not change semantic validity."
        )
    )
    parser.add_argument("--cases", type=int, default=100)
    parser.add_argument("--seed", type=int, default=20260816)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    if args.cases < 1:
        raise SystemExit("--cases must be >= 1")

    rng = random.Random(args.seed)
    failures: list[dict[str, object]] = []
    with tempfile.TemporaryDirectory(prefix="axm-bundle-portability-") as temp:
        root = Path(temp) / "workspace"
        run_demo(root)
        arena = ChallengeArena(root)
        baseline = Path(temp) / "baseline.zip"
        arena.export_evidence_bundle("arena-demo-001", baseline)
        baseline_report = verify_evidence_bundle(baseline)
        if not baseline_report.get("valid"):
            raise SystemExit(f"baseline evidence bundle is invalid: {baseline_report}")
        with zipfile.ZipFile(baseline, "r") as archive:
            member_count = len(archive.infolist())
        for case in range(1, args.cases + 1):
            order = list(range(member_count))
            rng.shuffle(order)
            candidate = Path(temp) / f"repack-{case:05d}.zip"
            _repack(baseline, candidate, order)
            report = verify_evidence_bundle(candidate)
            if not report.get("valid"):
                failures.append(
                    {
                        "case": case,
                        "errors": report.get("errors", []),
                        "warnings": report.get("warnings", []),
                    }
                )
                if len(failures) >= 10:
                    break

        result = {
            "schema_version": "axm.challenge-bundle-portability-audit/0.6",
            "subject": "zip_member_order_independence",
            "seed": args.seed,
            "cases_requested": args.cases,
            "cases_completed": args.cases if not failures else min(args.cases, case),
            "member_count": member_count,
            "baseline_sha256": sha256_file(baseline),
            "failure_count": len(failures),
            "failures": failures,
            "status": "PASS" if not failures else "FAIL",
            "authority_boundary": (
                "This audit proves ordering independence for the exercised repacks only; "
                "it does not prove archive safety or semantic correctness beyond the verifier."
            ),
        }

    text = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(text, encoding="utf-8")
    print(text, end="")
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
