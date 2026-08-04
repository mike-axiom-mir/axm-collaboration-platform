#!/usr/bin/env python3
"""Reproducible verification for AXM AI Habitat v0.3.0.

The verifier backs up the current runtime, exercises migration and the clean
local server, then restores the user's runtime exactly. It uses only Python's
standard library; Node.js is used for an extra syntax check when available.
"""
from __future__ import annotations

import json
import os
import py_compile
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]

def choose_test_port() -> int:
    configured = os.environ.get("AXM_HABITAT_TEST_PORT")
    if configured:
        return int(configured)
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


PORT = choose_test_port()
BASE = f"http://127.0.0.1:{PORT}"
RUNTIME = ROOT / "runtime"
STATE_PATH = RUNTIME / "state.json"
TOKEN_PATH = RUNTIME / "bridge_token.txt"


def request_json(
    method: str,
    path: str,
    packet: dict[str, Any] | None = None,
    token: str | None = None,
    origin: str | None = None,
    timeout: float = 8.0,
) -> tuple[int, dict[str, Any], Any]:
    headers = {"Accept": "application/json"}
    data = None
    if packet is not None:
        data = json.dumps(packet).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["X-AXM-Bridge-Key"] = token
    if origin:
        headers["Origin"] = origin
    request = urllib.request.Request(BASE + path, method=method, data=data, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw), response.headers
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            body = {"raw": raw}
        return exc.code, body, exc.headers


def get(path: str) -> dict[str, Any]:
    status, body, _ = request_json("GET", path)
    if status != 200:
        raise AssertionError(f"GET {path} returned {status}: {body}")
    return body


def post(path: str, packet: dict[str, Any], token: str | None = None, origin: str | None = None) -> dict[str, Any]:
    status, body, _ = request_json("POST", path, packet, token=token, origin=origin)
    if status not in {200, 201}:
        raise AssertionError(f"POST {path} returned {status}: {body}")
    return body


def wait_for_server(process: subprocess.Popen[bytes], limit: float = 10.0) -> None:
    deadline = time.time() + limit
    while time.time() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"Server exited before becoming ready with code {process.returncode}")
        try:
            health = get("/api/health")
            if health.get("ok") and health.get("version") == "0.3.0":
                return
        except Exception:
            pass
        time.sleep(0.12)
    raise RuntimeError("Server did not become ready")


def wait_for(predicate, description: str, limit: float = 20.0) -> Any:
    deadline = time.time() + limit
    last: Any = None
    while time.time() < deadline:
        last = predicate()
        if last:
            return last
        time.sleep(0.16)
    raise AssertionError(f"Timed out waiting for {description}; last value: {last!r}")


def start_server(log_path: Path, reset: bool) -> subprocess.Popen[bytes]:
    command = [sys.executable, str(ROOT / "server.py"), "--host", "127.0.0.1", "--port", str(PORT)]
    if reset:
        command.append("--reset")
    log_handle = log_path.open("wb")
    process = subprocess.Popen(command, cwd=ROOT, stdout=log_handle, stderr=subprocess.STDOUT)
    process._axm_log_handle = log_handle  # type: ignore[attr-defined]
    try:
        wait_for_server(process)
    except Exception:
        stop_server(process)
        details = log_path.read_text(encoding="utf-8", errors="replace") if log_path.exists() else ""
        raise RuntimeError(f"Server failed to start. Log:\n{details}")
    return process


def stop_server(process: subprocess.Popen[bytes]) -> None:
    process.terminate()
    try:
        process.wait(timeout=4)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=2)
    log_handle = getattr(process, "_axm_log_handle", None)
    if log_handle:
        log_handle.close()


def build_v01_state() -> dict[str, Any]:
    stamp = "2026-07-01T00:00:00+00:00"
    return {
        "version": "0.1.0",
        "mode": "BRIDGE READY",
        "updated_at": stamp,
        "rooms": [
            {"id": "commons", "name": "Commons", "purpose": "Conversation", "symbol": "◎"},
        ],
        "seats": [
            {
                "id": "migration-seat",
                "display_name": "Migration Seat",
                "provider": "Saved provider",
                "connection_type": "saved_bridge",
                "avatar": "MS",
                "location": "commons",
                "status": "idle",
                "connected": True,
                "capabilities": ["create_note"],
                "permissions": ["commons"],
                "carrying": None,
                "last_evidence": "v0.1 state",
                "updated_at": stamp,
            }
        ],
        "actions": [],
        "permissions": [],
        "artifacts": [
            {
                "id": "preserved-artifact",
                "name": "Preserved v0.1 artifact",
                "kind": "note",
                "room": "commons",
                "created_by": "migration-seat",
                "created_at": stamp,
                "summary": "Must survive migration",
                "content": "Preserve me",
                "path": None,
                "action_id": None,
                "provenance": {"mode": "saved", "verified": True},
            }
        ],
        "proof_log": [],
    }


def main() -> int:
    print("AXM AI Habitat v0.3.0 verification")

    print("1. Python syntax")
    for rel in [
        "server.py",
        "adapters/example_bridge_client.py",
        "adapters/drop_folder_adapter.py",
        "tests/verify_build.py",
    ]:
        py_compile.compile(str(ROOT / rel), doraise=True)
        print("   PASS", rel)

    print("2. JSON validity")
    for path in sorted(ROOT.rglob("*.json")):
        if any(part == "__pycache__" for part in path.parts):
            continue
        json.loads(path.read_text(encoding="utf-8"))
        print("   PASS", path.relative_to(ROOT))

    print("3. JavaScript syntax")
    node = shutil.which("node")
    if node:
        subprocess.run([node, "--check", str(ROOT / "web" / "app.js")], check=True)
        print("   PASS web/app.js")
    else:
        print("   SKIP Node.js not installed; browser runtime uses dependency-free plain JavaScript")

    with tempfile.TemporaryDirectory(prefix="axm_habitat_verify_") as temp_name:
        temp = Path(temp_name)
        backup = temp / "runtime_backup"
        migration_log = temp / "migration_server.log"
        clean_log = temp / "clean_server.log"
        if RUNTIME.exists():
            shutil.copytree(RUNTIME, backup)

        try:
            if RUNTIME.exists():
                shutil.rmtree(RUNTIME)
            (RUNTIME / "artifacts").mkdir(parents=True, exist_ok=True)
            STATE_PATH.write_text(json.dumps(build_v01_state(), indent=2), encoding="utf-8")

            print("4. Non-destructive v0.1 → v0.3 migration")
            migration_process = start_server(migration_log, reset=False)
            try:
                migrated = get("/api/state")
                assert migrated["version"] == "0.3.0"
                assert any(seat["id"] == "migration-seat" for seat in migrated["seats"])
                assert any(item["id"] == "preserved-artifact" for item in migrated["artifacts"])
                migrated_seat = next(seat for seat in migrated["seats"] if seat["id"] == "migration-seat")
                assert "previous_location" in migrated_seat and "last_reason" in migrated_seat
                assert "scenarios" in migrated and "games" in migrated
                assert migrated_seat["expression_policy"]["allow_silence"] is True
                assert migrated_seat["expression"] is None
                assert "expression_invitations" in migrated and "expression_history" in migrated
                assert "expression_catalog" in migrated and migrated["expression_catalog"]["version"] == "0.3.0"
                print("   PASS existing seat/artifact preserved; voluntary-signal fields added")
            finally:
                stop_server(migration_process)

            print("5. Clean local server, UI, and security headers")
            clean_process = start_server(clean_log, reset=True)
            try:
                token = TOKEN_PATH.read_text(encoding="utf-8").strip()
                assert len(token) >= 32
                health_status, health, health_headers = request_json("GET", "/api/health")
                assert health_status == 200 and health["ok"] and health["version"] == "0.3.0"
                assert health["bind"].endswith(f":{PORT}")
                assert "default-src 'self'" in health_headers.get("Content-Security-Policy", "")
                assert health_headers.get("X-Content-Type-Options") == "nosniff"

                with urllib.request.urlopen(BASE + "/", timeout=5) as response:
                    html = response.read().decode("utf-8")
                    assert response.status == 200
                    assert "AXM AI Habitat" in html and "Connect Four" in html
                    assert "Funny faces, useful lines, and honest silence" in html
                    assert "default-src 'self'" in response.headers.get("Content-Security-Policy", "")
                state = get("/api/state")
                assert len(state["rooms"]) == 8 and len(state["seats"]) >= 3
                assert len(state["games"]) == 0 and len(state["scenarios"]) == 0
                assert state["expression_catalog"]["state_faces"]["working"]
                assert state["expression_history"] == []
                print("   PASS local UI, 8 rooms, signal lounge, clean state, CSP and hardening headers")

                print("6. Bridge-key enforcement and same-origin UI write")
                status, denied_body, _ = request_json(
                    "POST",
                    "/api/event",
                    {"type": "unauthorized_test", "message": "must not be accepted"},
                )
                assert status == 401 and denied_body.get("error") == "Bridge key required"
                hostile_status, _, _ = request_json(
                    "POST",
                    "/api/event",
                    {"type": "hostile_origin_test", "message": "must not be accepted"},
                    origin=f"http://evil127.0.0.1:{PORT}",
                )
                assert hostile_status == 401
                if os.name != "nt":
                    assert (TOKEN_PATH.stat().st_mode & 0o077) == 0
                origin = f"http://127.0.0.1:{PORT}"
                accepted = post(
                    "/api/event",
                    {"type": "same_origin_test", "message": "UI write accepted", "evidence": "verification:same-origin"},
                    origin=origin,
                )
                assert accepted["type"] == "same_origin_test"
                print("   PASS no-key and lookalike-origin writes rejected; exact same-origin UI write accepted")

                print("7. Provider-neutral external seat and completion packet")
                seat = post(
                    "/api/seat/register",
                    {
                        "id": "verifier-ai",
                        "display_name": "Verifier AI",
                        "provider": "Test adapter",
                        "connection_type": "verification_bridge",
                        "avatar": "VA",
                        "connected": True,
                        "capabilities": ["create_note", "create_art", "play_games", "run_tests"],
                        "permissions": ["commons", "art_studio", "game_room", "test_lab", "merge_gate"],
                        "last_reason": "Verify the provider-neutral contract",
                    },
                    token,
                )
                assert seat["id"] == "verifier-ai" and seat["connection_type"] == "verification_bridge"
                intent = post(
                    "/api/intent",
                    {
                        "seat": "verifier-ai",
                        "action": "create_note",
                        "destination": "commons",
                        "target": "External bridge receipt",
                        "reason": "Prove a real adapter can return its own evidence",
                        "demo_autocomplete": False,
                        "executor": "verification_adapter",
                    },
                    token,
                )
                assert intent["status"] == "active" and intent["executor"] == "verification_adapter"
                completed = post(
                    f"/api/action/{intent['id']}/complete",
                    {
                        "ok": True,
                        "message": "External verifier completed the task",
                        "evidence": "verification-adapter:receipt-1",
                        "artifact": {
                            "name": "External bridge receipt",
                            "kind": "note",
                            "summary": "Created by the external test adapter.",
                            "content": "Provider-neutral completion packet accepted.",
                            "provenance": {"mode": "external_verification", "verified": True},
                        },
                    },
                    token,
                )
                assert completed["status"] == "completed"
                state = get("/api/state")
                receipt = next(item for item in state["artifacts"] if item["name"] == "External bridge receipt")
                assert receipt["provenance"]["mode"] == "external_verification"
                print("   PASS register → visible intent → external result → artifact → proof")

                print("8. Voluntary signal language, external silence, and source labels")
                catalog = get("/api/expressions/catalog")
                assert catalog["version"] == "0.3.0"
                assert {"useful", "permission", "repair", "playful"}.issubset(catalog["categories"])
                assert catalog["state_faces"]["waiting_permission"] == "•_•?"

                # An external seat receives only an open invitation. The Habitat
                # must not invent an answer on its behalf.
                invitation_result = post(
                    "/api/expression/invite",
                    {
                        "seat": "verifier-ai",
                        "category": "useful",
                        "allow_words": True,
                        "reason": "Optional verification invitation",
                        "demo_autorespond": True,
                    },
                    token,
                )
                assert invitation_result["response"] is None
                invitation = invitation_result["invitation"]
                assert invitation["status"] == "open"
                state = get("/api/state")
                verifier = next(item for item in state["seats"] if item["id"] == "verifier-ai")
                assert verifier["expression"] is None

                shared = post(
                    "/api/expression",
                    {
                        "seat": "verifier-ai",
                        "invitation_id": invitation["id"],
                        "mode": "words",
                        "face": "◉‿◉",
                        "phrase": "I may be wrong. Let me verify before we build on it.",
                        "category": "useful",
                        "reason": "External seat voluntarily accepted the invitation",
                        "source": "verification_bridge",
                        "chosen_by": "verifier-ai",
                        "ttl_seconds": 30,
                    },
                    token,
                )
                assert shared["mode"] == "words" and shared["invited"] is True
                assert shared["source"] == "verification_bridge"
                state = get("/api/state")
                verifier = next(item for item in state["seats"] if item["id"] == "verifier-ai")
                assert verifier["expression"]["id"] == shared["id"]
                assert next(item for item in state["expression_invitations"] if item["id"] == invitation["id"])["status"] == "answered"

                # A no-words invitation cannot be turned into words by the bridge.
                face_invitation = post(
                    "/api/expression/invite",
                    {"seat": "verifier-ai", "category": "playful", "allow_words": False},
                    token,
                )["invitation"]
                face_only = post(
                    "/api/expression",
                    {
                        "seat": "verifier-ai",
                        "invitation_id": face_invitation["id"],
                        "mode": "words",
                        "face": "•̀ᴗ•́",
                        "phrase": "This must be removed by invitation policy.",
                        "source": "verification_bridge",
                        "chosen_by": "verifier-ai",
                    },
                    token,
                )
                assert face_only["mode"] == "face_only" and face_only["phrase"] == ""

                # Clearing removes display state without fabricating a silence choice.
                before_clear = len(get("/api/state")["expression_history"])
                cleared = post(f"/api/expression/verifier-ai/clear", {"cleared_by": "verification"}, token)
                assert cleared["ok"] and cleared["previous_expression"]["id"] == face_only["id"]
                after_clear_state = get("/api/state")
                assert len(after_clear_state["expression_history"]) == before_clear
                assert next(item for item in after_clear_state["seats"] if item["id"] == "verifier-ai")["expression"] is None

                # Silence is recorded only when the seat explicitly returns it.
                silence_invitation = post(
                    "/api/expression/invite",
                    {"seat": "verifier-ai", "category": "check_in", "allow_words": True},
                    token,
                )["invitation"]
                silent = post(
                    "/api/expression",
                    {
                        "seat": "verifier-ai",
                        "invitation_id": silence_invitation["id"],
                        "mode": "silent",
                        "reason": "External seat chose not to add words",
                        "source": "verification_bridge",
                        "chosen_by": "verifier-ai",
                    },
                    token,
                )
                assert silent["mode"] == "silent" and silent["phrase"] == "" and silent["face"] == ""
                state = get("/api/state")
                assert state["expression_history"][-1]["mode"] == "silent"
                assert next(item for item in state["seats"] if item["id"] == "verifier-ai")["expression"] is None

                # Unknown invitations are rejected; human-side mute blocks all new
                # voluntary expression packets until re-enabled.
                status, unknown, _ = request_json(
                    "POST",
                    "/api/expression",
                    {"seat": "verifier-ai", "mode": "words", "phrase": "No", "invitation_id": "missing"},
                    token=token,
                )
                assert status == 400 and "Unknown expression invitation" in unknown.get("error", "")
                muted = post(
                    "/api/expression/verifier-ai/policy",
                    {"enabled": False, "allow_words": True, "allow_emoticons": True, "allow_silence": True},
                    token,
                )
                assert muted["enabled"] is False
                status, muted_body, _ = request_json(
                    "POST",
                    "/api/expression",
                    {"seat": "verifier-ai", "mode": "silent"},
                    token=token,
                )
                assert status == 400 and "muted" in muted_body.get("error", "")
                post(
                    "/api/expression/verifier-ai/policy",
                    {"enabled": True, "show_state_face": True, "allow_words": True, "allow_emoticons": True, "allow_silence": True},
                    token,
                )

                # The built-in demo seat may exercise words, face-only, and silence,
                # but every result is labelled as deterministic demonstration output.
                demo_modes = []
                for _ in range(4):
                    result = post(
                        "/api/expression/invite",
                        {"seat": "mirror-local", "category": "playful", "allow_words": True},
                        token,
                    )
                    assert result["response"] is not None
                    assert result["response"]["chosen_by"] == "deterministic_demo_choice_hand"
                    demo_modes.append(result["response"]["mode"])
                assert {"words", "face_only", "silent"}.issubset(set(demo_modes))
                state = get("/api/state")
                expression_events = [item["type"] for item in state["proof_log"] if item["type"].startswith("expression_")]
                assert "expression_invited" in expression_events
                assert "expression_shared" in expression_events
                assert "expression_face_only" in expression_events
                assert "expression_silence" in expression_events
                assert "expression_cleared" in expression_events
                print("   PASS state faces, open external invitation, words, face-only, explicit silence, mute, and proof")

                print("9. Deterministic art hand and generated local file")
                art_action = post(
                    "/api/intent",
                    {
                        "seat": "verifier-ai",
                        "action": "create_art",
                        "destination": "art_studio",
                        "target": "Verification habitat artwork",
                        "reason": "Exercise the layered local SVG hand",
                        "demo_autocomplete": True,
                    },
                    token,
                )

                def art_done() -> dict[str, Any] | None:
                    current = get("/api/state")
                    action = next((item for item in current["actions"] if item["id"] == art_action["id"]), None)
                    return current if action and action["status"] == "completed" else None

                state = wait_for(art_done, "deterministic art action")
                art = next(item for item in state["artifacts"] if item["name"] == "Verification habitat artwork")
                assert art["kind"] == "art" and art["provenance"]["verified"] is True
                artifact_path = ROOT / str(art["path"]).lstrip("/")
                assert artifact_path.is_file() and "<svg" in artifact_path.read_text(encoding="utf-8")
                assert any(item.get("action_id") == art_action["id"] for item in state["proof_log"])
                print("   PASS labelled SVG artifact written under runtime/artifacts with linked evidence")

                print("10. Sensitive-action permission gate and denial repair")
                sensitive = post(
                    "/api/intent",
                    {
                        "seat": "verifier-ai",
                        "action": "publish",
                        "destination": "merge_gate",
                        "target": "Verification release",
                        "reason": "Confirm that consequential work waits for the human",
                        "demo_autocomplete": True,
                    },
                    token,
                )
                assert sensitive["status"] == "waiting_permission" and sensitive["permission_reason"] == "sensitive_action"
                state = get("/api/state")
                permission = next(item for item in state["permissions"] if item["action_id"] == sensitive["id"])
                verifier = next(item for item in state["seats"] if item["id"] == "verifier-ai")
                assert verifier["location"] == "permission_gate" and verifier["status"] == "waiting_permission"
                denied = post(f"/api/permission/{permission['id']}/deny", {}, token)
                assert denied["status"] == "denied"
                state = get("/api/state")
                verifier = next(item for item in state["seats"] if item["id"] == "verifier-ai")
                assert verifier["active_action_id"] is None and verifier["status"] == "idle"
                print("   PASS visible wait, explicit denial, seat released, proof retained")

                print("11. Multi-room Code Forge relay")
                scenario = post("/api/scenario", {"scenario": "code_forge"}, token)

                def scenario_done() -> dict[str, Any] | None:
                    current = get("/api/state")
                    item = next((entry for entry in current["scenarios"] if entry["id"] == scenario["id"]), None)
                    return current if item and item["status"] in {"completed", "failed", "stopped"} else None

                state = wait_for(scenario_done, "Code Forge relay", limit=25)
                finished = next(item for item in state["scenarios"] if item["id"] == scenario["id"])
                assert finished["status"] == "completed"
                relay_actions = [item for item in state["actions"] if item.get("scenario_id") == scenario["id"]]
                assert len(relay_actions) == 3 and all(item["status"] == "completed" for item in relay_actions)
                assert any(item["kind"] == "code" and item.get("action_id") in {a["id"] for a in relay_actions} for item in state["artifacts"])
                assert any(item["kind"] == "test_report" and item.get("action_id") in {a["id"] for a in relay_actions} for item in state["artifacts"])
                print("   PASS inspect → code → test, sequential seat movement and scenario proof")

                print("12. Server-authoritative Connect Four Game School")
                game = post("/api/game/connect4/new", {"seat": "verifier-ai", "first": "human"}, token)
                assert game["status"] == "active" and game["turn"] == "human"
                assert len(game["board"]) == 6 and all(len(row) == 7 for row in game["board"])
                move = post(f"/api/game/connect4/{game['id']}/move", {"column": 3}, token)
                assert len(move["moves"]) == 2
                assert move["moves"][0]["actor"] == "human" and move["moves"][1]["actor"] == "ai"
                assert sum(cell != "." for row in move["board"] for cell in row) == 2
                status, invalid, _ = request_json(
                    "POST",
                    f"/api/game/connect4/{game['id']}/move",
                    {"column": 9},
                    token=token,
                )
                assert status == 400 and "0 to 6" in invalid.get("error", "")
                final_game = post(f"/api/game/connect4/{game['id']}/resign", {}, token)
                assert final_game["status"] == "completed" and final_game["result"] == "human_resigned"
                assert final_game.get("artifact_id")
                state = get("/api/state")
                game_artifact = next(item for item in state["artifacts"] if item["id"] == final_game["artifact_id"])
                record = json.loads(game_artifact["content"])
                assert record["moves"] == final_game["moves"] and record["result"] == "human_resigned"
                game_events = [item for item in state["proof_log"] if item.get("game_id") == game["id"]]
                assert any(item["type"] == "game_move" for item in game_events)
                assert any(item["type"] == "game_completed" for item in game_events)
                print("   PASS canonical board, legal-move rejection, deterministic response, replay artifact, proof")

                print("13. Final state integrity")
                assert all(item.get("id") for item in state["seats"])
                assert all(item.get("id") and item.get("time") for item in state["proof_log"])
                assert not any(seat.get("active_action_id") for seat in state["seats"])
                assert STATE_PATH.is_file() and (RUNTIME / "events.jsonl").is_file()
                json.loads(STATE_PATH.read_text(encoding="utf-8"))
                event_lines = [json.loads(line) for line in (RUNTIME / "events.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
                assert event_lines and event_lines[0]["type"] == "system_start"
                assert any(event["type"] == "game_completed" for event in event_lines)
                assert any(event["type"] == "expression_silence" for event in event_lines)
                assert all("expression_policy" in seat for seat in state["seats"])
                print("   PASS no stuck seats; state snapshot, expressions, and append-only evidence parse correctly")

                print("VERIFICATION RESULT: PASS")
            finally:
                stop_server(clean_process)
        finally:
            if RUNTIME.exists():
                shutil.rmtree(RUNTIME)
            if backup.exists():
                shutil.copytree(backup, RUNTIME)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
