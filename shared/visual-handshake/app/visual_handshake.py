#!/usr/bin/env python3
"""AXM Visual Handshake: local-only, bidirectional visual exchange.

No external packages are required. The server binds to loopback only and uses a
per-run token for all private API access.
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import http.client
import json
import mimetypes
import os
import re
import secrets
import signal
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

VERSION = "0.3.0"
PACKAGE_ROOT = Path(__file__).resolve().parents[1]
MAX_UPLOAD_BYTES = 24 * 1024 * 1024
MIN_SNAPSHOT_DIMENSION = 240
MAX_SNAPSHOT_DIMENSION = 4096
MAX_TITLE = 180
MAX_NOTE = 5000
LANES = {"to_codex", "to_mike"}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
TEXT_EXTS = {".txt", ".md", ".json", ".log"}
HTML_EXTS = {".html", ".htm"}
SVG_EXTS = {".svg"}
ALLOWED_EXTS = IMAGE_EXTS | TEXT_EXTS | HTML_EXTS | SVG_EXTS
WRITE_LOCK = threading.RLock()


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def packet_id() -> str:
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    return f"{stamp}-{secrets.token_hex(3)}"


def clean_text(value: str | None, limit: int) -> str:
    value = (value or "").replace("\x00", "").strip()
    return value[:limit]


def safe_filename(name: str | None, fallback: str = "visual.png") -> str:
    raw = Path(name or fallback).name
    cleaned = "".join(c if c.isalnum() or c in "._- " else "_" for c in raw).strip(" .")
    cleaned = cleaned[:120] or fallback
    ext = Path(cleaned).suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise ValueError(f"Unsupported file type: {ext or '(none)'}")
    return cleaned


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def atomic_json(path: Path, payload: Any, *, private: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + f".{secrets.token_hex(4)}.tmp")
    try:
        temp.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        os.replace(temp, path)
        if private:
            try:
                os.chmod(path, 0o600)
            except OSError:
                # Windows ACLs are inherited from the user's local app-data folder.
                pass
    finally:
        try:
            temp.unlink()
        except FileNotFoundError:
            pass


def load_json(path: Path, default: Any = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return default


def resolve_data_root() -> Path:
    env = os.environ.get("AXM_VISUAL_HANDSHAKE_DATA")
    if env:
        return Path(env).expanduser().resolve()
    install = load_json(PACKAGE_ROOT / "config" / "install.json", {}) or {}
    configured = install.get("data_root")
    if configured:
        return Path(configured).expanduser().resolve()
    return PACKAGE_ROOT


def kind_for(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext in IMAGE_EXTS:
        return "image"
    if ext in SVG_EXTS:
        return "svg"
    if ext in HTML_EXTS:
        return "html"
    if ext in TEXT_EXTS:
        return "text"
    raise ValueError("Unsupported file type")


def validate_content(filename: str, data: bytes) -> None:
    if not data:
        raise ValueError("Empty files are not accepted")
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValueError(f"File exceeds {MAX_UPLOAD_BYTES} bytes")
    ext = Path(filename).suffix.lower()
    if ext == ".png" and not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("PNG signature is invalid")
    if ext in {".jpg", ".jpeg"} and not data.startswith(b"\xff\xd8\xff"):
        raise ValueError("JPEG signature is invalid")
    if ext == ".gif" and not (data.startswith(b"GIF87a") or data.startswith(b"GIF89a")):
        raise ValueError("GIF signature is invalid")
    if ext == ".webp" and not (len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"):
        raise ValueError("WEBP signature is invalid")

    decoded: str | None = None
    if ext in TEXT_EXTS | HTML_EXTS | SVG_EXTS:
        try:
            decoded = data.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise ValueError("Text, HTML, JSON, and SVG packets must be valid UTF-8") from exc

    if ext == ".svg":
        assert decoded is not None
        lowered = decoded.lower()
        blocked_tokens = (
            "<!doctype", "<!entity", "<script", "<foreignobject", "<iframe",
            "<object", "<embed", "<image", "javascript:", "data:text/html", "@import",
        )
        if "<svg" not in lowered or any(token in lowered for token in blocked_tokens):
            raise ValueError("SVG contains unsupported or active content")
        if re.search(r"\bon[a-z0-9_-]+\s*=", lowered):
            raise ValueError("SVG event handlers are not allowed")
        if re.search(r"(?:xlink:)?href\s*=\s*['\"]\s*(?!#)", lowered):
            raise ValueError("SVG external references are not allowed")
        if re.search(r"url\(\s*['\"]?\s*(?!#)", lowered):
            raise ValueError("SVG external CSS references are not allowed")

    if ext in HTML_EXTS:
        assert decoded is not None
        lowered = decoded.lower()
        blocked_tokens = ("<script", "<iframe", "<object", "<embed", "<base", "<a", "<area", "<form")
        if any(token in lowered for token in blocked_tokens):
            raise ValueError("HTML preview must be static; active or nested content is not allowed")
        if re.search(r"<meta[^>]+http-equiv\s*=\s*['\"]?refresh", lowered):
            raise ValueError("HTML refresh/navigation directives are not allowed")


def validate_packet_record(packet: Any, expected_lane: str | None = None) -> dict[str, Any]:
    if not isinstance(packet, dict):
        raise ValueError("Packet metadata is not an object")
    required = {"schema", "packet_id", "lane", "filename", "relative_asset", "sha256", "size_bytes", "kind"}
    missing = sorted(required - set(packet))
    if missing:
        raise ValueError("Packet metadata is incomplete: " + ", ".join(missing))
    if packet.get("schema") != "axm.visual-handshake.packet.v1":
        raise ValueError("Unknown packet schema")
    lane = str(packet.get("lane", ""))
    if lane not in LANES or (expected_lane and lane != expected_lane):
        raise ValueError("Packet lane does not match its inbox")
    pid = str(packet.get("packet_id", ""))
    if not pid or re.fullmatch(r"[A-Za-z0-9_-]+", pid) is None:
        raise ValueError("Packet ID is invalid")
    filename = safe_filename(str(packet.get("filename", "")))
    if str(packet.get("relative_asset", "")) != f"{pid}/{filename}":
        raise ValueError("Packet asset path is not canonical")
    digest = str(packet.get("sha256", ""))
    if re.fullmatch(r"[0-9a-f]{64}", digest) is None:
        raise ValueError("Packet checksum is invalid")
    try:
        size = int(packet.get("size_bytes"))
    except (TypeError, ValueError) as exc:
        raise ValueError("Packet size is invalid") from exc
    if size <= 0 or size > MAX_UPLOAD_BYTES:
        raise ValueError("Packet size is outside the accepted boundary")
    if str(packet.get("kind")) != kind_for(filename):
        raise ValueError("Packet kind does not match its file")
    return packet


class Store:
    def __init__(self, data_root: Path | None = None):
        self.data_root = (data_root or resolve_data_root()).resolve()
        self.exchange = self.data_root / "exchange"
        self.runtime = self.data_root / "runtime"
        self.archive = self.exchange / "archive"
        for lane in LANES:
            (self.exchange / lane).mkdir(parents=True, exist_ok=True)
        self.archive.mkdir(parents=True, exist_ok=True)
        self.runtime.mkdir(parents=True, exist_ok=True)

    def lane_dir(self, lane: str) -> Path:
        if lane not in LANES:
            raise ValueError("Unknown lane")
        return self.exchange / lane

    def create_packet(
        self,
        lane: str,
        data: bytes,
        filename: str,
        title: str = "",
        note: str = "",
        actor: str = "unknown",
    ) -> dict[str, Any]:
        filename = safe_filename(filename)
        validate_content(filename, data)
        title = clean_text(title, MAX_TITLE) or ("From Mike" if lane == "to_codex" else "From Codex")
        note = clean_text(note, MAX_NOTE)
        pid = packet_id()
        lane_dir = self.lane_dir(lane)
        target_dir = lane_dir / pid
        asset = target_dir / filename
        with WRITE_LOCK:
            target_dir.mkdir(parents=True, exist_ok=False)
            try:
                temp = asset.with_suffix(asset.suffix + ".tmp")
                temp.write_bytes(data)
                os.replace(temp, asset)
                packet = {
                    "schema": "axm.visual-handshake.packet.v1",
                    "packet_id": pid,
                    "lane": lane,
                    "actor": clean_text(actor, 80),
                    "created_at": utc_now(),
                    "title": title,
                    "note": note,
                    "kind": kind_for(filename),
                    "filename": filename,
                    "relative_asset": f"{pid}/{filename}",
                    "size_bytes": len(data),
                    "sha256": sha256_bytes(data),
                    "acknowledged": False,
                    "acknowledged_at": None,
                }
                validate_packet_record(packet, lane)
                atomic_json(target_dir / "packet.json", packet)
                atomic_json(lane_dir / "latest.json", packet)
            except Exception:
                shutil.rmtree(target_dir, ignore_errors=True)
                raise
        return packet

    def create_packet_from_file(self, lane: str, source: Path, title: str = "", note: str = "", actor: str = "unknown") -> dict[str, Any]:
        source = source.expanduser().resolve()
        if not source.is_file():
            raise FileNotFoundError(str(source))
        if source.stat().st_size > MAX_UPLOAD_BYTES:
            raise ValueError(f"File exceeds {MAX_UPLOAD_BYTES} bytes")
        return self.create_packet(lane, source.read_bytes(), source.name, title, note, actor)

    def latest(self, lane: str) -> dict[str, Any] | None:
        record = load_json(self.lane_dir(lane) / "latest.json")
        return validate_packet_record(record, lane) if record is not None else None

    def packet(self, lane: str, pid: str) -> dict[str, Any] | None:
        lane_dir = self.lane_dir(lane)
        if not pid or re.fullmatch(r"[A-Za-z0-9_-]+", pid) is None:
            return None
        record = load_json(lane_dir / pid / "packet.json")
        return validate_packet_record(record, lane) if record is not None else None

    def asset_path(self, lane: str, pid: str) -> Path:
        packet = self.packet(lane, pid)
        if not packet:
            raise FileNotFoundError("Packet not found")
        candidate = (self.lane_dir(lane) / packet["relative_asset"]).resolve()
        base = self.lane_dir(lane).resolve()
        if base not in candidate.parents or not candidate.is_file():
            raise FileNotFoundError("Asset not found")
        if sha256_file(candidate) != packet.get("sha256"):
            raise ValueError("Asset hash no longer matches packet")
        return candidate

    def acknowledge(self, lane: str, pid: str, actor: str = "mike") -> dict[str, Any]:
        with WRITE_LOCK:
            packet = self.packet(lane, pid)
            if not packet:
                raise FileNotFoundError("Packet not found")
            packet["acknowledged"] = True
            packet["acknowledged_at"] = utc_now()
            packet["acknowledged_by"] = clean_text(actor, 80)
            atomic_json(self.lane_dir(lane) / pid / "packet.json", packet)
            latest = self.latest(lane)
            if latest and latest.get("packet_id") == pid:
                atomic_json(self.lane_dir(lane) / "latest.json", packet)
            return packet

    def counts(self) -> dict[str, int]:
        result = {}
        for lane in sorted(LANES):
            result[lane] = sum(
                1 for p in self.lane_dir(lane).iterdir()
                if p.is_dir() and (p / "packet.json").is_file()
            )
        return result


class VisualServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address: tuple[str, int], handler, store: Store, token: str):
        super().__init__(address, handler)
        self.store = store
        self.token = token
        self.started_at = utc_now()


class Handler(BaseHTTPRequestHandler):
    server_version = "AXMVisualHandshake/0.2"

    def log_message(self, fmt: str, *args: Any) -> None:
        # Keep local logs minimal; do not print notes, filenames, or tokens.
        sys.stdout.write(f"[{self.log_date_time_string()}] {self.command} {self.path.split('?')[0]} {args[1] if len(args) > 1 else ''}\n")

    def _security_headers(self, content_type: str = "application/json; charset=utf-8", allow_frame: bool = False) -> None:
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if not allow_frame:
            self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), display-capture=(self), clipboard-read=(self), clipboard-write=(self)")

    def _json(self, status: int, payload: Any) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._security_headers()
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _text(self, status: int, text: str, content_type: str = "text/plain; charset=utf-8") -> None:
        data = text.encode("utf-8")
        self.send_response(status)
        self._security_headers(content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _host_ok(self) -> bool:
        host = (self.headers.get("Host") or "").split(":")[0].strip("[]").lower()
        return host in {"127.0.0.1", "localhost", "::1"}

    def _origin_ok(self) -> bool:
        origin = self.headers.get("Origin")
        if not origin:
            return True
        parsed = urllib.parse.urlparse(origin)
        return parsed.scheme == "http" and (parsed.hostname or "").lower() in {"127.0.0.1", "localhost", "::1"}

    def _token(self) -> str:
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        return self.headers.get("X-AXM-Token") or (query.get("token") or [""])[0]

    def _authorized(self) -> bool:
        return self._host_ok() and self._origin_ok() and secrets.compare_digest(self._token(), self.server.token)

    def _read_json(self, limit: int = 32768) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length < 0 or length > limit:
            raise ValueError("JSON body too large")
        raw = self.rfile.read(length)
        payload = json.loads(raw.decode("utf-8") or "{}")
        if not isinstance(payload, dict):
            raise ValueError("JSON object required")
        return payload

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == "/api/ping":
            self._json(200, {"ok": True, "service": "axm-visual-handshake", "version": VERSION})
            return
        if path in {"/", "/index.html"}:
            self._serve_static("index.html")
            return
        if path.startswith("/static/"):
            self._serve_static(path.removeprefix("/static/"))
            return
        if not self._authorized():
            self._json(403, {"ok": False, "error": "Local session token required"})
            return
        try:
            if path == "/api/status":
                self._json(200, {
                    "ok": True,
                    "version": VERSION,
                    "started_at": self.server.started_at,
                    "counts": self.server.store.counts(),
                    "latest_to_codex": self.server.store.latest("to_codex"),
                    "latest_to_mike": self.server.store.latest("to_mike"),
                    "native_capture_available": os.name == "nt" and (PACKAGE_ROOT / "scripts" / "capture_windows.ps1").is_file(),
                    "max_upload_bytes": MAX_UPLOAD_BYTES,
                    "html_preview_policy": "STATIC_SANDBOXED_NO_SCRIPT_NO_NETWORK",
                    "loopback_only": True,
                })
            elif path == "/api/latest":
                lane = (urllib.parse.parse_qs(parsed.query).get("lane") or [""])[0]
                packet = self.server.store.latest(lane)
                self._json(200, {"ok": True, "packet": packet})
            elif path == "/api/asset":
                query = urllib.parse.parse_qs(parsed.query)
                lane = (query.get("lane") or [""])[0]
                pid = (query.get("packet_id") or [""])[0]
                asset = self.server.store.asset_path(lane, pid)
                data = asset.read_bytes()
                mime = mimetypes.guess_type(asset.name)[0] or "application/octet-stream"
                self.send_response(200)
                self._security_headers(mime, allow_frame=asset.suffix.lower() in HTML_EXTS)
                if asset.suffix.lower() in HTML_EXTS:
                    self.send_header("Content-Security-Policy", "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; form-action 'none'; navigate-to 'none'; frame-ancestors 'self'")
                elif asset.suffix.lower() in SVG_EXTS:
                    self.send_header("Content-Security-Policy", "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:")
                self.send_header("Content-Disposition", f"inline; filename*=UTF-8''{urllib.parse.quote(asset.name)}")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            else:
                self._json(404, {"ok": False, "error": "Not found"})
        except (ValueError, FileNotFoundError, OSError) as exc:
            self._json(400, {"ok": False, "error": str(exc)})

    def _serve_static(self, name: str) -> None:
        static_root = (PACKAGE_ROOT / "app" / "static").resolve()
        candidate = (static_root / name).resolve()
        if static_root not in candidate.parents and candidate != static_root:
            self._text(404, "Not found")
            return
        if not candidate.is_file():
            self._text(404, "Not found")
            return
        data = candidate.read_bytes()
        mime = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        self.send_response(200)
        self._security_headers(f"{mime}; charset=utf-8" if mime.startswith("text/") or mime in {"application/javascript", "application/json"} else mime)
        self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' blob: data:; connect-src 'self'; style-src 'self'; script-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        if not self._authorized():
            self._json(403, {"ok": False, "error": "Local session token required"})
            return
        try:
            if parsed.path == "/api/upload":
                length = int(self.headers.get("Content-Length", "0") or 0)
                if length <= 0 or length > MAX_UPLOAD_BYTES:
                    raise ValueError("Invalid upload size")
                query = urllib.parse.parse_qs(parsed.query)
                lane = (query.get("lane") or [""])[0]
                meta = {}
                encoded_meta = self.headers.get("X-AXM-Meta", "")
                if encoded_meta:
                    padding = "=" * (-len(encoded_meta) % 4)
                    meta = json.loads(base64.urlsafe_b64decode(encoded_meta + padding).decode("utf-8"))
                    if not isinstance(meta, dict):
                        raise ValueError("Upload metadata must be an object")
                filename = str(meta.get("filename") or urllib.parse.unquote((query.get("filename") or ["visual.png"])[0]))
                title = str(meta.get("title") or urllib.parse.unquote((query.get("title") or [""])[0]))
                note = str(meta.get("note") or urllib.parse.unquote((query.get("note") or [""])[0]))
                actor = str(meta.get("actor") or urllib.parse.unquote((query.get("actor") or ["mike"])[0]))
                data = self.rfile.read(length)
                packet = self.server.store.create_packet(lane, data, filename, title, note, actor)
                self._json(201, {"ok": True, "packet": packet})
            elif parsed.path == "/api/note":
                body = self._read_json()
                lane = body.get("lane", "to_mike")
                text = clean_text(str(body.get("text", "")), MAX_NOTE)
                if not text:
                    raise ValueError("Note is empty")
                packet = self.server.store.create_packet(
                    lane,
                    (text + "\n").encode("utf-8"),
                    "note.txt",
                    str(body.get("title", "Note")),
                    str(body.get("note", "")),
                    str(body.get("actor", "unknown")),
                )
                self._json(201, {"ok": True, "packet": packet})
            elif parsed.path == "/api/ack":
                body = self._read_json()
                packet = self.server.store.acknowledge(str(body.get("lane", "")), str(body.get("packet_id", "")), str(body.get("actor", "mike")))
                self._json(200, {"ok": True, "packet": packet})
            elif parsed.path == "/api/open-folder":
                body = self._read_json()
                lane = str(body.get("lane", "to_mike"))
                folder = self.server.store.lane_dir(lane)
                open_folder(folder)
                self._json(200, {"ok": True})
            elif parsed.path == "/api/native-capture":
                if os.name != "nt":
                    raise ValueError("Native capture is available on Windows only")
                body = self._read_json()
                delay = max(0, min(int(body.get("delay", 3)), 10))
                title = str(body.get("title", "Windows screen capture"))
                note = str(body.get("note", ""))
                with tempfile.TemporaryDirectory(prefix="axm-vh-") as tempdir:
                    output = Path(tempdir) / "screen.png"
                    capture_windows(output, delay)
                    packet = self.server.store.create_packet_from_file("to_codex", output, title, note, "mike")
                self._json(201, {"ok": True, "packet": packet})
            elif parsed.path == "/api/shutdown":
                self._json(200, {"ok": True, "message": "Stopping"})
                threading.Thread(target=self.server.shutdown, daemon=True).start()
            else:
                self._json(404, {"ok": False, "error": "Not found"})
        except (ValueError, FileNotFoundError, OSError, json.JSONDecodeError, subprocess.SubprocessError) as exc:
            self._json(400, {"ok": False, "error": str(exc)})


def open_folder(path: Path) -> None:
    if os.name == "nt":
        os.startfile(path)  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])


def capture_windows(output: Path, delay: int) -> None:
    script = PACKAGE_ROOT / "scripts" / "capture_windows.ps1"
    if not script.is_file():
        raise FileNotFoundError(str(script))
    command = [
        "powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
        "-File", str(script), "-OutputPath", str(output), "-Delay", str(delay),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=30)
    if result.returncode != 0 or not output.is_file():
        raise RuntimeError((result.stderr or result.stdout or "Windows capture failed").strip())


def browser_candidates() -> list[str]:
    candidates: list[str] = []
    for name in ("msedge", "msedge.exe", "google-chrome", "google-chrome-stable", "chrome", "chrome.exe", "chromium", "chromium-browser"):
        found = shutil.which(name)
        if found and found not in candidates:
            candidates.append(found)
    if os.name == "nt":
        roots = [os.environ.get("PROGRAMFILES"), os.environ.get("PROGRAMFILES(X86)"), os.environ.get("LOCALAPPDATA")]
        relative = [
            Path("Microsoft/Edge/Application/msedge.exe"),
            Path("Google/Chrome/Application/chrome.exe"),
            Path("Chromium/Application/chrome.exe"),
        ]
        for root in roots:
            if not root:
                continue
            for rel in relative:
                path = Path(root) / rel
                if path.is_file() and str(path) not in candidates:
                    candidates.append(str(path))
    return candidates


def url_allowed(url: str, allow_network: bool = False) -> bool:
    parsed = urllib.parse.urlparse(url)
    if parsed.username or parsed.password:
        return False
    if parsed.scheme == "file":
        # Block UNC/network file locations unless the caller explicitly opens the network gate.
        return allow_network or (parsed.netloc or "").lower() in {"", "localhost"}
    if parsed.scheme not in {"http", "https"}:
        return False
    host = (parsed.hostname or "").lower()
    if host in {"localhost", "127.0.0.1", "::1"}:
        return True
    return allow_network


def bounded_snapshot_size(width: int, height: int) -> tuple[int, int]:
    return (
        max(MIN_SNAPSHOT_DIMENSION, min(int(width), MAX_SNAPSHOT_DIMENSION)),
        max(MIN_SNAPSHOT_DIMENSION, min(int(height), MAX_SNAPSHOT_DIMENSION)),
    )


def run_browser_command(command: list[str], timeout: int = 45) -> tuple[int, str, str]:
    creationflags = 0
    if os.name == "nt":
        creationflags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        start_new_session=os.name != "nt",
        creationflags=creationflags,
    )
    try:
        stdout, stderr = process.communicate(timeout=timeout)
        return int(process.returncode or 0), stdout, stderr
    except subprocess.TimeoutExpired as exc:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
                timeout=8,
            )
        else:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                process.kill()
        try:
            stdout, stderr = process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            stdout, stderr = process.communicate()
        detail = (stderr or stdout or str(exc)).strip()[:500]
        raise RuntimeError(f"Browser snapshot timed out after {timeout} seconds: {detail}") from exc


def snapshot_url(url: str, output: Path, width: int, height: int, allow_network: bool) -> str:
    if not url_allowed(url, allow_network):
        raise ValueError("Remote URLs are blocked by default; only localhost and local file URLs are allowed")
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme == "file":
        local_path = Path(urllib.request.url2pathname(parsed.path))
        if not local_path.is_file():
            raise FileNotFoundError(str(local_path))
    width, height = bounded_snapshot_size(width, height)
    browsers = browser_candidates()
    if not browsers:
        raise RuntimeError("No supported Edge/Chrome/Chromium executable was found")
    output.parent.mkdir(parents=True, exist_ok=True)
    profile = output.parent / "browser-profile"
    profile.mkdir(parents=True, exist_ok=True)
    errors = []
    for browser in browsers:
        command = [
            browser,
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--no-first-run",
            "--disable-background-networking",
            "--disable-component-update",
            "--disable-sync",
            "--disable-extensions",
            "--disable-crash-reporter",
            "--disable-dev-shm-usage",
            "--metrics-recording-only",
            "--run-all-compositor-stages-before-draw",
            "--virtual-time-budget=2500",
            f"--user-data-dir={profile}",
            f"--window-size={width},{height}",
            f"--screenshot={output}",
        ]
        if not allow_network:
            command.append("--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1, EXCLUDE ::1")
        command.append(url)
        try:
            returncode, stdout, stderr = run_browser_command(command, timeout=45)
            if returncode == 0 and output.is_file() and output.stat().st_size > 8:
                return browser
            errors.append((stderr or stdout or f"exit {returncode}").strip()[:500])
        except (OSError, RuntimeError, subprocess.SubprocessError) as exc:
            errors.append(str(exc))
    raise RuntimeError("Browser snapshot failed: " + " | ".join(errors))


def ping_session(session: dict[str, Any]) -> bool:
    try:
        if not isinstance(session, dict) or session.get("host") != "127.0.0.1":
            return False
        port = int(session.get("port", 0))
        token = session.get("token")
        if not (1 <= port <= 65535) or not isinstance(token, str) or len(token) < 24:
            return False
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=1.5)
        conn.request("GET", "/api/ping")
        response = conn.getresponse()
        raw = response.read(4096)
        conn.close()
        payload = json.loads(raw.decode("utf-8"))
        return response.status == 200 and payload.get("ok") is True and payload.get("service") == "axm-visual-handshake"
    except (OSError, ValueError, json.JSONDecodeError, http.client.HTTPException):
        return False


def remove_stale_session(session_file: Path) -> bool:
    try:
        session_file.unlink()
        return True
    except FileNotFoundError:
        return False


def serve(args: argparse.Namespace) -> int:
    store = Store(Path(args.data_root).resolve() if args.data_root else None)
    session_file = store.runtime / "session.json"
    existing = load_json(session_file, {}) or {}
    if existing and ping_session(existing):
        url = existing.get("url") or f"http://127.0.0.1:{existing['port']}/#token={urllib.parse.quote(existing['token'])}"
        if args.mode:
            separator = "&" if "#" in url else ("&" if "?" in url else "?")
            url += f"{separator}mode={urllib.parse.quote(args.mode)}"
        if args.open:
            webbrowser.open(url)
        print(json.dumps({"ok": True, "already_running": True, "url": url}))
        return 0
    if existing:
        remove_stale_session(session_file)

    host = "127.0.0.1"
    token = secrets.token_urlsafe(32)
    server = VisualServer((host, int(args.port)), Handler, store, token)
    actual_port = int(server.server_address[1])
    base_url = f"http://{host}:{actual_port}/#token={urllib.parse.quote(token)}"
    open_url = base_url + (f"&mode={urllib.parse.quote(args.mode)}" if args.mode else "")
    session = {
        "schema": "axm.visual-handshake.session.v1",
        "version": VERSION,
        "host": host,
        "port": actual_port,
        "token": token,
        "pid": os.getpid(),
        "started_at": server.started_at,
        "url": base_url,
        "loopback_only": True,
    }
    atomic_json(session_file, session, private=True)
    if args.open:
        threading.Timer(0.35, lambda: webbrowser.open(open_url)).start()
    print(json.dumps({"ok": True, "url": open_url, "pid": os.getpid()}), flush=True)
    try:
        server.serve_forever(poll_interval=0.4)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        current = load_json(session_file, {}) or {}
        if current.get("pid") == os.getpid():
            try:
                session_file.unlink()
            except FileNotFoundError:
                pass
    return 0


def stop_server(args: argparse.Namespace) -> int:
    store = Store(Path(args.data_root).resolve() if args.data_root else None)
    session_file = store.runtime / "session.json"
    session = load_json(session_file, {}) or {}
    if not session:
        print(json.dumps({"ok": True, "running": False}))
        return 0
    if not ping_session(session):
        removed = remove_stale_session(session_file)
        print(json.dumps({"ok": True, "running": False, "stale_session_removed": removed}))
        return 0
    try:
        conn = http.client.HTTPConnection("127.0.0.1", int(session["port"]), timeout=3)
        conn.request("POST", "/api/shutdown", body=b"{}", headers={"Content-Type": "application/json", "X-AXM-Token": session["token"]})
        response = conn.getresponse()
        response.read()
        conn.close()
        if response.status != 200:
            raise RuntimeError(f"Server returned {response.status}")
        print(json.dumps({"ok": True, "stopping": True}))
        return 0
    except Exception as exc:
        pid = session.get("pid")
        print(json.dumps({"ok": False, "error": str(exc), "pid": pid}))
        return 1


def open_dashboard(args: argparse.Namespace) -> int:
    store = Store(Path(args.data_root).resolve() if args.data_root else None)
    session = load_json(store.runtime / "session.json", {}) or {}
    if not session or not ping_session(session):
        if session:
            remove_stale_session(store.runtime / "session.json")
        print(json.dumps({"ok": False, "error": "Visual Handshake is not running"}))
        return 1
    url = session["url"]
    if args.mode:
        separator = "&" if ("#" in url or "?" in url) else "?"
        url += f"{separator}mode={urllib.parse.quote(args.mode)}"
    webbrowser.open(url)
    print(json.dumps({"ok": True, "url": url}))
    return 0


def cli_send(args: argparse.Namespace, lane: str, actor: str) -> int:
    store = Store(Path(args.data_root).resolve() if args.data_root else None)
    packet = store.create_packet_from_file(lane, Path(args.file), args.title, args.note, actor)
    print(json.dumps({"ok": True, "packet": packet}, indent=2, ensure_ascii=False))
    return 0


def cli_note(args: argparse.Namespace) -> int:
    store = Store(Path(args.data_root).resolve() if args.data_root else None)
    text = args.text
    if args.file:
        text = Path(args.file).expanduser().read_text(encoding="utf-8")
    if not text:
        raise ValueError("Provide --text or --file")
    packet = store.create_packet("to_mike", (text + "\n").encode("utf-8"), "note.txt", args.title, args.note, "codex")
    print(json.dumps({"ok": True, "packet": packet}, indent=2, ensure_ascii=False))
    return 0


def cli_latest(args: argparse.Namespace) -> int:
    store = Store(Path(args.data_root).resolve() if args.data_root else None)
    packet = store.latest(args.lane)
    if not packet:
        print(json.dumps({"ok": True, "packet": None}))
        return 0
    asset = store.asset_path(args.lane, packet["packet_id"])
    payload = {"ok": True, "packet": packet, "absolute_asset": str(asset)}
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0


def cli_status(args: argparse.Namespace) -> int:
    store = Store(Path(args.data_root).resolve() if args.data_root else None)
    session = load_json(store.runtime / "session.json", {}) or {}
    payload = {
        "ok": True,
        "version": VERSION,
        "data_root": str(store.data_root),
        "running": bool(session and ping_session(session)),
        "counts": store.counts(),
        "latest_to_codex": store.latest("to_codex"),
        "latest_to_mike": store.latest("to_mike"),
    }
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0


def cli_snapshot(args: argparse.Namespace) -> int:
    store = Store(Path(args.data_root).resolve() if args.data_root else None)
    url = args.url
    path_candidate = Path(url).expanduser()
    if path_candidate.is_file():
        url = path_candidate.resolve().as_uri()
    with tempfile.TemporaryDirectory(prefix="axm-vh-shot-") as tempdir:
        output = Path(tempdir) / "preview.png"
        browser = snapshot_url(url, output, args.width, args.height, args.allow_network)
        packet = store.create_packet_from_file("to_mike", output, args.title, args.note, "codex")
    print(json.dumps({"ok": True, "browser": browser, "packet": packet}, indent=2, ensure_ascii=False))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="AXM Visual Handshake local visual exchange")
    parser.add_argument("--data-root", help="Override exchange/runtime data root")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("serve", help="Start the loopback dashboard")
    p.add_argument("--port", type=int, default=0)
    p.add_argument("--open", action="store_true")
    p.add_argument("--mode", choices=["capture", "latest", "home"], default="home")
    p.set_defaults(func=serve)

    p = sub.add_parser("stop", help="Stop the current local dashboard")
    p.set_defaults(func=stop_server)

    p = sub.add_parser("open-dashboard", help="Open the running dashboard")
    p.add_argument("--mode", choices=["capture", "latest", "home"], default="home")
    p.set_defaults(func=open_dashboard)

    p = sub.add_parser("send-to-mike", help="Publish an image, HTML, SVG, or text file for Mike")
    p.add_argument("--file", required=True)
    p.add_argument("--title", default="Codex visual")
    p.add_argument("--note", default="")
    p.set_defaults(func=lambda a: cli_send(a, "to_mike", "codex"))

    p = sub.add_parser("send-to-codex", help="Publish a local file for Codex")
    p.add_argument("--file", required=True)
    p.add_argument("--title", default="Mike visual")
    p.add_argument("--note", default="")
    p.set_defaults(func=lambda a: cli_send(a, "to_codex", "mike"))

    p = sub.add_parser("note-to-mike", help="Publish a text note for Mike")
    group = p.add_mutually_exclusive_group(required=True)
    group.add_argument("--text")
    group.add_argument("--file")
    p.add_argument("--title", default="Codex note")
    p.add_argument("--note", default="")
    p.set_defaults(func=cli_note)

    p = sub.add_parser("latest-from-mike", help="Return the newest Mike-to-Codex packet and absolute path")
    p.set_defaults(func=lambda a: cli_latest(argparse.Namespace(**vars(a), lane="to_codex")))

    p = sub.add_parser("latest-to-mike", help="Return the newest Codex-to-Mike packet and absolute path")
    p.set_defaults(func=lambda a: cli_latest(argparse.Namespace(**vars(a), lane="to_mike")))

    p = sub.add_parser("status", help="Machine-readable local status")
    p.set_defaults(func=cli_status)

    p = sub.add_parser("snapshot-url", help="Capture a localhost/file URL through Edge/Chrome and publish it for Mike")
    p.add_argument("url")
    p.add_argument("--title", default="Codex preview")
    p.add_argument("--note", default="")
    p.add_argument("--width", type=int, default=1440)
    p.add_argument("--height", type=int, default=1000)
    p.add_argument("--allow-network", action="store_true", help="Explicitly permit a non-local URL")
    p.set_defaults(func=cli_snapshot)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return int(args.func(args))
    except (ValueError, FileNotFoundError, RuntimeError, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
