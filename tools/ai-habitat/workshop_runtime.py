#!/usr/bin/env python3
"""AXM Workshop-aware entry point for the AI Habitat sidecar."""
from __future__ import annotations

import os
import sys
import threading

import server as habitat
from adapters.workshop_presence import WorkshopPresenceBridge, normalize_local_base


def argument_value(name: str, fallback: str) -> str:
    try:
        index = sys.argv.index(name)
        return sys.argv[index + 1]
    except (ValueError, IndexError):
        return fallback


def workshop_candidates() -> tuple[str, ...] | None:
    configured = os.environ.get("AXM_WORKSHOP_URL", "").strip()
    if not configured:
        return None
    return (normalize_local_base(configured),)


def main() -> None:
    port = int(argument_value("--port", str(habitat.CONFIG.port)))
    bridge = WorkshopPresenceBridge(
        habitat_base=f"http://127.0.0.1:{port}",
        habitat_token=habitat.STORE.bridge_token,
        workshop_candidates=workshop_candidates(),
    )
    thread = threading.Thread(target=bridge.run_forever, name="axm-workshop-presence", daemon=True)
    thread.start()
    print("AXM Workshop presence bridge enabled (loopback only).")
    habitat.main()


if __name__ == "__main__":
    main()
