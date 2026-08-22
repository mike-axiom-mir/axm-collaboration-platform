#!/usr/bin/env python3
"""Offline, append-evidenced Product Design workflow for local human/AI teams."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path


VERSION = "1.0.0"
PACKAGE_ROOT = Path(__file__).resolve().parents[1]
WORKFLOW_ROOT = PACKAGE_ROOT / "workflows" / "product-design"
TEMPLATE_ROOT = WORKFLOW_ROOT / "templates"
STAGES = ["context", "visual-target", "build", "visual-qa", "handoff"]
ARTIFACTS = {
    "context": "01_BRIEF.md",
    "visual-target": "02_VISUAL_TARGET.md",
    "build": "03_BUILD_PLAN.md",
    "visual-qa": "04_VISUAL_QA.md",
    "handoff": "05_HANDOFF.md",
}


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:72] or "design-run"


def sha256(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def fingerprint(target: Path) -> dict[str, object]:
    if not target.exists():
        return {"exists": False, "target": str(target), "capturedAt": now()}
    if target.is_file():
        return {
            "exists": True,
            "target": str(target),
            "kind": "file",
            "files": 1,
            "bytes": target.stat().st_size,
            "sha256": sha256(target),
            "capturedAt": now(),
        }

    excluded = {".git", "node_modules", "__pycache__", "design_runs"}
    rows: list[tuple[str, int, str]] = []
    for path in sorted(target.rglob("*")):
        if not path.is_file() or path.is_symlink() or any(part in excluded for part in path.parts):
            continue
        relative = path.relative_to(target).as_posix()
        rows.append((relative, path.stat().st_size, sha256(path)))
    aggregate = hashlib.sha256()
    for relative, size, digest in rows:
        aggregate.update(f"{relative}\0{size}\0{digest}\n".encode("utf-8"))
    return {
        "exists": True,
        "target": str(target),
        "kind": "directory",
        "files": len(rows),
        "bytes": sum(row[1] for row in rows),
        "sha256": aggregate.hexdigest(),
        "capturedAt": now(),
    }


def load_state(run: Path) -> dict:
    path = run / "STATE.json"
    if not path.is_file():
        raise ValueError(f"No workflow state found at {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def save_state(run: Path, state: dict) -> None:
    state["updatedAt"] = now()
    (run / "STATE.json").write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


def render_template(name: str, values: dict[str, str]) -> str:
    text = (TEMPLATE_ROOT / name).read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", value)
    return text


def start(args: argparse.Namespace) -> int:
    project = args.project or input("Project or design-run name: ").strip()
    if not project:
        print("A project name is required.", file=sys.stderr)
        return 2
    target_text = args.target
    if target_text is None:
        target_text = input("Target file/folder [demo/index.html]: ").strip() or "demo/index.html"
    target = Path(target_text).expanduser()
    if not target.is_absolute():
        target = (Path.cwd() / target).resolve()

    workspace = Path(args.workspace).expanduser()
    if not workspace.is_absolute():
        workspace = (Path.cwd() / workspace).resolve()
    run = workspace / slugify(project)
    if run.exists():
        print(f"Run already exists: {run}\nUse status, approve, or reopen; nothing was overwritten.", file=sys.stderr)
        return 2

    source = fingerprint(target)
    run.mkdir(parents=True)
    values = {
        "PROJECT_NAME": project,
        "TARGET_PATH": str(target),
        "CREATED_AT": now(),
        "SOURCE_SHA256": str(source.get("sha256", "unavailable")),
    }
    template_map = {
        "01_BRIEF.md": "01_BRIEF_TEMPLATE.md",
        "02_VISUAL_TARGET.md": "02_VISUAL_TARGET_TEMPLATE.md",
        "03_BUILD_PLAN.md": "03_BUILD_PLAN_TEMPLATE.md",
        "04_VISUAL_QA.md": "04_VISUAL_QA_TEMPLATE.md",
        "05_HANDOFF.md": "05_HANDOFF_TEMPLATE.md",
    }
    for output, template in template_map.items():
        (run / output).write_text(render_template(template, values), encoding="utf-8")
    (run / "SOURCE_FINGERPRINT.json").write_text(json.dumps(source, indent=2) + "\n", encoding="utf-8")

    state = {
        "workflow": "axm.local.product-design",
        "workflowVersion": VERSION,
        "project": project,
        "target": str(target),
        "createdAt": now(),
        "updatedAt": now(),
        "localOnly": True,
        "networkAccess": False,
        "automaticRewrite": False,
        "sourceFingerprint": source,
        "stages": {stage: {"status": "ready" if index == 0 else "blocked"} for index, stage in enumerate(STAGES)},
        "history": [{"event": "started", "at": now(), "target": str(target), "sourceSha256": source.get("sha256")}],
    }
    save_state(run, state)
    print(f"Created local design run: {run}")
    print("First gate: complete 01_BRIEF.md, then approve the context stage.")
    print(f"Command: python tools/local_product_design.py approve \"{run}\" context --by \"Your name\" --note \"Brief reviewed\"")
    return 0


def status(args: argparse.Namespace) -> int:
    run = Path(args.run).expanduser().resolve()
    state = load_state(run)
    print(f"{state['project']} — local Product Design workflow {state['workflowVersion']}")
    print(f"Target: {state['target']}")
    for index, stage in enumerate(STAGES, start=1):
        record = state["stages"][stage]
        evidence = f" · evidence: {record.get('evidence')}" if record.get("evidence") else ""
        print(f"{index}. {stage}: {record['status']}{evidence}")
    return 0


def approve(args: argparse.Namespace) -> int:
    run = Path(args.run).expanduser().resolve()
    state = load_state(run)
    stage = args.stage
    index = STAGES.index(stage)
    for prior in STAGES[:index]:
        if state["stages"][prior]["status"] != "approved":
            print(f"Blocked: approve {prior} before {stage}.", file=sys.stderr)
            return 2

    artifact = run / ARTIFACTS[stage]
    if not artifact.is_file() or artifact.stat().st_size < 80:
        print(f"Blocked: complete {ARTIFACTS[stage]} first.", file=sys.stderr)
        return 2
    artifact_text = artifact.read_text(encoding="utf-8")
    if "[REQUIRED" in artifact_text:
        print(f"Blocked: {ARTIFACTS[stage]} still contains unresolved [REQUIRED] markers.", file=sys.stderr)
        return 2
    evidence_record = None
    if stage == "visual-qa":
        if not args.evidence:
            print("Blocked: visual-qa requires --evidence pointing to a local screenshot or comparison file.", file=sys.stderr)
            return 2
        evidence = Path(args.evidence).expanduser().resolve()
        if not evidence.is_file():
            print(f"Evidence file not found: {evidence}", file=sys.stderr)
            return 2
        allowed_evidence = {".png", ".jpg", ".jpeg", ".webp", ".pdf", ".html"}
        if evidence.suffix.lower() not in allowed_evidence or evidence.stat().st_size < 64:
            print("Evidence must be a non-empty local PNG, JPG, WEBP, PDF, or HTML comparison artifact.", file=sys.stderr)
            return 2
        evidence_record = {"path": str(evidence), "sha256": sha256(evidence), "bytes": evidence.stat().st_size}

    event = {
        "event": "approved",
        "stage": stage,
        "at": now(),
        "by": args.by,
        "note": args.note or "",
        "artifact": ARTIFACTS[stage],
        "artifactSha256": sha256(artifact),
    }
    if evidence_record:
        event["evidence"] = evidence_record
    state["history"].append(event)
    state["stages"][stage] = {
        "status": "approved",
        "approvedAt": event["at"],
        "approvedBy": args.by,
        "artifactSha256": event["artifactSha256"],
        **({"evidence": evidence_record} if evidence_record else {}),
    }
    if index + 1 < len(STAGES) and state["stages"][STAGES[index + 1]]["status"] == "blocked":
        state["stages"][STAGES[index + 1]]["status"] = "ready"
    save_state(run, state)
    print(f"Approved {stage}." + (f" Next gate: {STAGES[index + 1]}." if index + 1 < len(STAGES) else " Workflow complete."))
    return 0


def reopen(args: argparse.Namespace) -> int:
    run = Path(args.run).expanduser().resolve()
    state = load_state(run)
    index = STAGES.index(args.stage)
    for offset, stage in enumerate(STAGES[index:]):
        state["stages"][stage] = {"status": "ready" if offset == 0 else "blocked"}
    state["history"].append({"event": "reopened", "stage": args.stage, "at": now(), "by": args.by, "reason": args.reason})
    save_state(run, state)
    print(f"Reopened {args.stage}; downstream approvals were safely invalidated and the history was preserved.")
    return 0


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="AXM offline Product Design workflow")
    sub = root.add_subparsers(dest="command", required=True)

    start_cmd = sub.add_parser("start", help="Create a new local design run")
    start_cmd.add_argument("project", nargs="?")
    start_cmd.add_argument("--target")
    start_cmd.add_argument("--workspace", default="design_runs")
    start_cmd.set_defaults(handler=start)

    status_cmd = sub.add_parser("status", help="Show gate status")
    status_cmd.add_argument("run")
    status_cmd.set_defaults(handler=status)

    approve_cmd = sub.add_parser("approve", help="Approve one completed gate")
    approve_cmd.add_argument("run")
    approve_cmd.add_argument("stage", choices=STAGES)
    approve_cmd.add_argument("--by", required=True)
    approve_cmd.add_argument("--note")
    approve_cmd.add_argument("--evidence")
    approve_cmd.set_defaults(handler=approve)

    reopen_cmd = sub.add_parser("reopen", help="Reopen a gate without deleting history")
    reopen_cmd.add_argument("run")
    reopen_cmd.add_argument("stage", choices=STAGES)
    reopen_cmd.add_argument("--by", required=True)
    reopen_cmd.add_argument("--reason", required=True)
    reopen_cmd.set_defaults(handler=reopen)
    return root


def main() -> int:
    try:
        args = parser().parse_args()
        return int(args.handler(args))
    except (ValueError, OSError, json.JSONDecodeError) as error:
        print(f"Workflow error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
