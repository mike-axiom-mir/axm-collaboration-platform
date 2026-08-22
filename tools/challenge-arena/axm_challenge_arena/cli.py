from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from .arena import ChallengeArena
from .bridge import FileBridge
from .bundle_verify import verify_evidence_bundle
from .demo import run_demo
from .integrations import packet_from_module_job
from .presets import PRESETS, build_preset
from .server import build_server
from .utils import atomic_write_json, read_json
from .version import __version__


def _load_json(path: str | Path) -> dict[str, Any]:
    value = read_json(Path(path), max_bytes=16 * 1024 * 1024)
    if not isinstance(value, dict):
        raise ValueError(f"Expected JSON object in {path}")
    return value


def _print(value: Any) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True))


def _runner_keys(values: list[str]) -> dict[str, str]:
    keys: dict[str, str] = {}
    for value in values:
        if "=" not in value:
            raise ValueError("--trusted-runner-key must be KEY_ID=SECRET or KEY_ID=@FILE")
        key_id, secret = value.split("=", 1)
        key_id = key_id.strip()
        if not key_id:
            raise ValueError("trusted runner key id may not be empty")
        if secret.startswith("@"):
            secret = Path(secret[1:]).read_text(encoding="utf-8").strip()
        if not secret:
            raise ValueError(f"trusted runner key {key_id!r} has an empty secret")
        keys[key_id] = secret
    return keys


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="axm-challenge-arena",
        description="AXM Challenge Arena local-first module",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument("--root", default="./workspace", help="Arena workspace root")
    parser.add_argument(
        "--allow-execution",
        action="store_true",
        help="Enable configured candidate commands. Use only inside a real sandbox.",
    )
    parser.add_argument(
        "--trusted-runner-key",
        action="append",
        default=[],
        metavar="KEY_ID=SECRET",
        help="Trust an HMAC receipt key. Use KEY_ID=@FILE to avoid putting the secret in command history.",
    )
    parser.add_argument(
        "--allow-unsigned-receipts",
        action="store_true",
        help="Accept bound but unsigned external runner receipts. Disabled by default.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("preset", help="Create an editable challenge packet from a built-in preset")
    p.add_argument("kind", choices=sorted(PRESETS))
    p.add_argument("challenge_id")
    p.add_argument("title")
    p.add_argument("goal")
    p.add_argument("--source-module", default="standalone")
    p.add_argument("--source-job-id")
    p.add_argument("--out", required=True)

    p = sub.add_parser("from-job", help="Translate an AXM module-job JSON into a challenge packet")
    p.add_argument("job_json")
    p.add_argument("--out", required=True)

    p = sub.add_parser("create")
    p.add_argument("packet_json")
    p.add_argument("--actor", default="human")

    p = sub.add_parser("seal-input", help="Copy a declared draft input into hash-bound challenge evidence")
    p.add_argument("challenge_id")
    p.add_argument("input_id")
    p.add_argument("source_path")
    p.add_argument("--actor", default="human")

    p = sub.add_parser("register")
    p.add_argument("challenge_id")
    p.add_argument("participant_id")
    p.add_argument("--name")
    p.add_argument("--adapter", default="filesystem")
    p.add_argument("--capability", action="append", default=[])
    p.add_argument("--judge-only", action="store_true")
    p.add_argument("--optional-review", action="store_true")
    p.add_argument("--independence-group")

    p = sub.add_parser("lock")
    p.add_argument("challenge_id")

    p = sub.add_parser("contract", help="Print the locked submission acknowledgement contract")
    p.add_argument("challenge_id")
    p.add_argument("participant_id")

    p = sub.add_parser("submit")
    p.add_argument("challenge_id")
    p.add_argument("participant_id")
    p.add_argument("artifacts_dir")
    p.add_argument("manifest_json")
    p.add_argument("--replace", action="store_true")
    p.add_argument("--expected-previous-submission-id")
    p.add_argument("--task-token")
    p.add_argument("--usage-json")

    p = sub.add_parser("external-job", help="Export a hash-bound job for a specialist deterministic runner")
    p.add_argument("challenge_id")
    p.add_argument("submission_id")
    p.add_argument("--out")

    p = sub.add_parser("attach-receipt", help="Attach a verified external deterministic-runner receipt")
    p.add_argument("challenge_id")
    p.add_argument("submission_id")
    p.add_argument("receipt_json")
    p.add_argument("--actor", default="external-runner-import")

    p = sub.add_parser("close-submissions")
    p.add_argument("challenge_id")

    p = sub.add_parser("run-checks")
    p.add_argument("challenge_id")

    p = sub.add_parser("open-review")
    p.add_argument("challenge_id")

    p = sub.add_parser("review-packet")
    p.add_argument("challenge_id")
    p.add_argument("reviewer_id")
    p.add_argument("--out")

    p = sub.add_parser("submit-review")
    p.add_argument("challenge_id")
    p.add_argument("reviewer_id")
    p.add_argument("review_json")
    p.add_argument("--replace", action="store_true")
    p.add_argument("--expected-previous-review-id")
    p.add_argument("--task-token")
    p.add_argument("--usage-json")

    p = sub.add_parser("tasks", help="List fairness/orchestration seat tasks")
    p.add_argument("challenge_id")
    p.add_argument("--phase", choices=["BUILD", "REVIEW"])
    p.add_argument("--private", action="store_true")

    p = sub.add_parser("claim-task", help="Claim a seat task and receive its one-time bearer token")
    p.add_argument("challenge_id")
    p.add_argument("task_id")
    p.add_argument("--worker", required=True)
    p.add_argument("--lease-seconds", type=int)
    p.add_argument("--actor")

    p = sub.add_parser("heartbeat-task", help="Extend an active seat-task lease within its locked cap")
    p.add_argument("challenge_id")
    p.add_argument("task_id")
    p.add_argument("token")
    p.add_argument("--extend", type=int)
    p.add_argument("--actor", default="seat-worker")

    p = sub.add_parser("fail-task", help="Record a retryable or terminal operational seat failure")
    p.add_argument("challenge_id")
    p.add_argument("task_id")
    p.add_argument("token")
    p.add_argument("--class", dest="failure_class", required=True)
    p.add_argument("--detail", required=True)
    p.add_argument("--no-retry", action="store_true")
    p.add_argument("--actor", default="seat-worker")

    p = sub.add_parser("reap-tasks", help="Expire stale leases without scoring candidates")
    p.add_argument("challenge_id")
    p.add_argument("--actor", default="arena-reaper")

    p = sub.add_parser("cancel-task", help="Explicitly cancel a non-completed seat task")
    p.add_argument("challenge_id")
    p.add_argument("task_id")
    p.add_argument("reason")
    p.add_argument("--actor", default="human")

    p = sub.add_parser("close-voting")
    p.add_argument("challenge_id")
    p.add_argument("--force", action="store_true")

    p = sub.add_parser("synthesize")
    p.add_argument("challenge_id")

    p = sub.add_parser("finalize")
    p.add_argument("challenge_id")
    p.add_argument("decision_json")
    p.add_argument("--actor", default="human")

    p = sub.add_parser("abort")
    p.add_argument("challenge_id")
    p.add_argument("reason")
    p.add_argument("--actor", default="human")

    for name in ("show", "public", "verify", "progress", "lineage"):
        p = sub.add_parser(name)
        p.add_argument("challenge_id")

    p = sub.add_parser("recover", help="Finish only write-ahead commits already recorded on disk")
    p.add_argument("challenge_id", nargs="?")

    p = sub.add_parser("followup", help="Create an explicit new round without rewriting the parent")
    p.add_argument("parent_challenge_id")
    p.add_argument("challenge_id")
    p.add_argument(
        "--mode",
        default="BEAT_WINNER",
        choices=["BEAT_WINNER", "REPAIR_WINNER", "MERGE_CHALLENGE", "FINAL_SHOWDOWN", "RERUN"],
    )
    p.add_argument("--select", action="append", default=[], metavar="BLIND_LABEL")
    p.add_argument("--title")
    p.add_argument("--goal")
    p.add_argument("--no-copy-participants", action="store_true")
    p.add_argument(
        "--no-copy-inputs",
        action="store_true",
        help="Reference parent artifacts in the same workspace instead of sealing portable copies into the child.",
    )
    p.add_argument("--actor", default="human")

    p = sub.add_parser("bundle", help="Export a reproducible complete evidence ZIP")
    p.add_argument("challenge_id")
    p.add_argument("--out")
    p.add_argument("--allow-invalid", action="store_true")

    p = sub.add_parser("verify-bundle", help="Verify an evidence ZIP without extracting or trusting its source workspace")
    p.add_argument("bundle_zip")

    sub.add_parser("list")
    sub.add_parser("validators", help="List installed deterministic validator kinds")
    sub.add_parser("capabilities", help="Describe presets, validators, features, and authority boundaries")

    p = sub.add_parser("export-build")
    p.add_argument("challenge_id")
    p.add_argument("--bridge-root", default="./bridge")

    p = sub.add_parser("import-build")
    p.add_argument("challenge_id")
    p.add_argument("participant_id")
    p.add_argument("--bridge-root", default="./bridge")
    p.add_argument("--replace", action="store_true")

    p = sub.add_parser("export-reviews")
    p.add_argument("challenge_id")
    p.add_argument("--bridge-root", default="./bridge")

    p = sub.add_parser("import-review")
    p.add_argument("challenge_id")
    p.add_argument("participant_id")
    p.add_argument("--bridge-root", default="./bridge")
    p.add_argument("--replace", action="store_true")

    p = sub.add_parser("export-result")
    p.add_argument("challenge_id")
    p.add_argument("--bridge-root", default="./bridge")

    p = sub.add_parser("bridge-status", help="Show incoming folders and challenge readiness")
    p.add_argument("challenge_id")
    p.add_argument("--bridge-root", default="./bridge")

    p = sub.add_parser("sync", help="Idempotently import ready bridge folders and optionally advance safe phases")
    p.add_argument("challenge_id")
    p.add_argument("--bridge-root", default="./bridge")
    p.add_argument("--advance", action="store_true")
    p.add_argument("--allow-revisions", action="store_true")
    p.add_argument("--no-export", action="store_true")

    p = sub.add_parser("demo")
    p.add_argument("--keep", action="store_true", help="Keep an existing demo instead of resetting it")

    p = sub.add_parser("serve")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8765)

    return parser


def _write_or_print(value: dict[str, Any], out: str | None) -> None:
    if out:
        atomic_write_json(Path(out), value)
        _print({"written": str(Path(out).resolve())})
    else:
        _print(value)


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    arena = ChallengeArena(
        args.root,
        allow_execution=args.allow_execution,
        trusted_runner_keys=_runner_keys(args.trusted_runner_key),
        allow_unsigned_receipts=args.allow_unsigned_receipts,
    )
    command = args.command

    if command == "preset":
        packet = build_preset(
            args.kind,
            args.challenge_id,
            args.title,
            args.goal,
            source_module=args.source_module,
            source_job_id=args.source_job_id,
        )
        atomic_write_json(Path(args.out), packet)
        _print({"written": str(Path(args.out).resolve()), "preset": args.kind})
    elif command == "from-job":
        packet = packet_from_module_job(_load_json(args.job_json))
        atomic_write_json(Path(args.out), packet)
        _print({"written": str(Path(args.out).resolve()), "challenge_id": packet["challenge_id"]})
    elif command == "create":
        _print(arena.create_challenge(_load_json(args.packet_json), actor=args.actor))
    elif command == "seal-input":
        _print(
            arena.seal_draft_input(
                args.challenge_id,
                args.input_id,
                args.source_path,
                actor=args.actor,
            )
        )
    elif command == "register":
        _print(
            arena.register_participant(
                args.challenge_id,
                args.participant_id,
                display_name=args.name,
                adapter=args.adapter,
                capabilities=args.capability,
                can_submit=not args.judge_only,
                can_review=True,
                review_required=not args.optional_review,
                independence_group=args.independence_group,
            )
        )
    elif command == "lock":
        _print(arena.lock_challenge(args.challenge_id))
    elif command == "contract":
        _print(arena.submission_contract(args.challenge_id, args.participant_id))
    elif command == "submit":
        _print(
            arena.submit(
                args.challenge_id,
                args.participant_id,
                args.artifacts_dir,
                _load_json(args.manifest_json),
                replace=args.replace,
                expected_previous_submission_id=args.expected_previous_submission_id,
                task_token=args.task_token,
                task_usage=(
                    _load_json(args.usage_json) if args.usage_json else None
                ),
            )
        )
    elif command == "external-job":
        _write_or_print(arena.external_runner_job(args.challenge_id, args.submission_id), args.out)
    elif command == "attach-receipt":
        _print(
            arena.attach_external_receipt(
                args.challenge_id,
                args.submission_id,
                _load_json(args.receipt_json),
                actor=args.actor,
            )
        )
    elif command == "close-submissions":
        _print(arena.close_submissions(args.challenge_id))
    elif command == "run-checks":
        _print(arena.run_deterministic_checks(args.challenge_id))
    elif command == "open-review":
        _print(arena.open_review(args.challenge_id))
    elif command == "review-packet":
        _write_or_print(arena.review_packet(args.challenge_id, args.reviewer_id), args.out)
    elif command == "submit-review":
        _print(
            arena.submit_review(
                args.challenge_id,
                args.reviewer_id,
                _load_json(args.review_json),
                replace=args.replace,
                expected_previous_review_id=args.expected_previous_review_id,
                task_token=args.task_token,
                task_usage=(
                    _load_json(args.usage_json) if args.usage_json else None
                ),
            )
        )
    elif command == "tasks":
        _print(
            arena.list_tasks(
                args.challenge_id,
                phase=args.phase,
                include_private=args.private,
            )
        )
    elif command == "claim-task":
        _print(
            arena.claim_task(
                args.challenge_id,
                args.task_id,
                worker_id=args.worker,
                lease_seconds=args.lease_seconds,
                actor=args.actor,
            )
        )
    elif command == "heartbeat-task":
        _print(
            arena.heartbeat_task(
                args.challenge_id,
                args.task_id,
                args.token,
                extension_seconds=args.extend,
                actor=args.actor,
            )
        )
    elif command == "fail-task":
        _print(
            arena.fail_task(
                args.challenge_id,
                args.task_id,
                args.token,
                failure_class=args.failure_class,
                detail=args.detail,
                retryable=not args.no_retry,
                actor=args.actor,
            )
        )
    elif command == "reap-tasks":
        _print(arena.reap_tasks(args.challenge_id, actor=args.actor))
    elif command == "cancel-task":
        _print(
            arena.cancel_task(
                args.challenge_id,
                args.task_id,
                reason=args.reason,
                actor=args.actor,
            )
        )
    elif command == "close-voting":
        _print(arena.close_voting(args.challenge_id, force=args.force))
    elif command == "synthesize":
        _print(arena.synthesize(args.challenge_id))
    elif command == "finalize":
        _print(arena.finalize(args.challenge_id, _load_json(args.decision_json), actor=args.actor))
    elif command == "abort":
        _print(arena.abort(args.challenge_id, args.reason, actor=args.actor))
    elif command == "show":
        _print(arena.get(args.challenge_id))
    elif command == "public":
        _print(arena.public_view(args.challenge_id))
    elif command == "verify":
        report = arena.verify_integrity(args.challenge_id)
        _print(report)
        if not report.get("valid", False):
            raise SystemExit(1)
    elif command == "progress":
        _print(arena.progress(args.challenge_id))
    elif command == "lineage":
        _print(arena.lineage_view(args.challenge_id))
    elif command == "recover":
        _print(arena.recover(args.challenge_id))
    elif command == "followup":
        _print(
            arena.spawn_followup(
                args.parent_challenge_id,
                args.challenge_id,
                mode=args.mode,
                selected_blind_labels=args.select or None,
                title=args.title,
                goal=args.goal,
                copy_participants=not args.no_copy_participants,
                copy_inputs=not args.no_copy_inputs,
                actor=args.actor,
            )
        )
    elif command == "bundle":
        _print(
            arena.export_evidence_bundle(
                args.challenge_id,
                args.out,
                allow_invalid=args.allow_invalid,
            )
        )
    elif command == "verify-bundle":
        report = verify_evidence_bundle(args.bundle_zip)
        _print(report)
        if not report.get("valid", False):
            raise SystemExit(1)
    elif command == "list":
        _print(arena.list())
    elif command == "validators":
        _print({"arena_version": __version__, "validators": arena.engine.registry.kinds()})
    elif command == "capabilities":
        _print(arena.capabilities())
    elif command in {
        "export-build",
        "import-build",
        "export-reviews",
        "import-review",
        "export-result",
        "bridge-status",
        "sync",
    }:
        bridge = FileBridge(arena, args.bridge_root)
        if command == "export-build":
            _print({"folders": [str(path) for path in bridge.export_build_packets(args.challenge_id)]})
        elif command == "import-build":
            _print(
                bridge.import_build_submission(
                    args.challenge_id, args.participant_id, replace=args.replace
                )
            )
        elif command == "export-reviews":
            _print({"folders": [str(path) for path in bridge.export_review_packets(args.challenge_id)]})
        elif command == "import-review":
            _print(bridge.import_review(args.challenge_id, args.participant_id, replace=args.replace))
        elif command == "export-result":
            _print({"folder": str(bridge.export_result(args.challenge_id))})
        elif command == "bridge-status":
            _print(bridge.status(args.challenge_id))
        elif command == "sync":
            _print(
                bridge.sync_challenge(
                    args.challenge_id,
                    advance=args.advance,
                    allow_revisions=args.allow_revisions,
                    export_packets=not args.no_export,
                )
            )
    elif command == "demo":
        state = run_demo(args.root, reset=not args.keep)
        _print(
            {
                "challenge_id": state["challenge_id"],
                "state": state["state"],
                "provisional_winner": state.get("result", {}).get("provisional_winner"),
                "next": f"python -m axm_challenge_arena --root {args.root} serve",
            }
        )
    elif command == "serve":
        server = build_server(args.root, args.host, args.port)
        print(f"AXM Challenge Arena observer: http://{args.host}:{args.port}")
        print("Read-only observer. Press Ctrl+C to stop.")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()
    else:
        parser.error(f"Unhandled command: {command}")


if __name__ == "__main__":
    main()
