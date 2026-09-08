#!/usr/bin/env python3
"""Install the AXM GitHub Floor Manager as a user-scope Codex skill.

Default behavior copies only the skill into ~/.agents/skills so it becomes
available across repositories. Passing --global-agents also installs a small,
marker-bounded block in ~/.codex/AGENTS.md. Existing files are backed up before
replacement. No network calls, GitHub writes, or credential changes occur.
"""

from __future__ import annotations

import argparse
import shutil
from datetime import datetime, timezone
from pathlib import Path

START = "<!-- AXM_GITHUB_FLOOR_MANAGER_START -->"
END = "<!-- AXM_GITHUB_FLOOR_MANAGER_END -->"


def backup(path: Path) -> Path | None:
    if not path.exists():
        return None
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dest = path.with_name(f"{path.name}.bak.{stamp}")
    shutil.copy2(path, dest)
    return dest


def install_skill(repo_root: Path, home: Path) -> Path:
    source = repo_root / ".agents" / "skills" / "axm-github-floor-manager"
    if not (source / "SKILL.md").is_file():
        raise SystemExit(f"Skill source missing: {source / 'SKILL.md'}")

    target = home / ".agents" / "skills" / "axm-github-floor-manager"
    target.parent.mkdir(parents=True, exist_ok=True)
    previous = backup(target / "SKILL.md") if target.exists() else None
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target)
    print(f"installed skill: {target}")
    if previous:
        print(f"previous SKILL.md backup: {previous}")
    return target


def install_global_agents(repo_root: Path, home: Path) -> Path:
    fragment_path = (
        repo_root
        / ".agents"
        / "skills"
        / "axm-github-floor-manager"
        / "references"
        / "GLOBAL_AGENTS_FRAGMENT.md"
    )
    fragment = fragment_path.read_text(encoding="utf-8").strip()

    codex_dir = home / ".codex"
    codex_dir.mkdir(parents=True, exist_ok=True)
    agents_path = codex_dir / "AGENTS.md"
    old = agents_path.read_text(encoding="utf-8") if agents_path.exists() else ""
    backup_path = backup(agents_path)

    block = f"{START}\n{fragment}\n{END}"
    if START in old and END in old:
        before, rest = old.split(START, 1)
        _, after = rest.split(END, 1)
        new = before.rstrip() + "\n\n" + block + after
    else:
        new = old.rstrip()
        if new:
            new += "\n\n"
        new += block + "\n"

    agents_path.write_text(new, encoding="utf-8")
    print(f"installed global AGENTS block: {agents_path}")
    if backup_path:
        print(f"previous AGENTS.md backup: {backup_path}")
    return agents_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--global-agents",
        action="store_true",
        help="also install/update the marker-bounded GitHub rules in ~/.codex/AGENTS.md",
    )
    parser.add_argument(
        "--home",
        type=Path,
        default=Path.home(),
        help="override the target home directory for testing",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    home = args.home.expanduser().resolve()
    install_skill(repo_root, home)
    if args.global_agents:
        install_global_agents(repo_root, home)

    print("done. Restart Codex if the new skill is not detected immediately.")


if __name__ == "__main__":
    main()
