from __future__ import annotations

import argparse
import json
import mimetypes
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from .arena import ChallengeArena
from .version import __version__


class ObserverHandler(BaseHTTPRequestHandler):
    arena: ChallengeArena
    static_root: Path

    def _security_headers(self) -> None:
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; "
            "img-src 'self' data:; connect-src 'self'; object-src 'none'; "
            "base-uri 'none'; frame-ancestors 'none'",
        )
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("X-Permitted-Cross-Domain-Policies", "none")

    def _json(self, value: Any, status: int = 200) -> None:
        payload = json.dumps(value, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self._security_headers()
        self.end_headers()
        self.wfile.write(payload)

    def _file(self, path: Path) -> None:
        if not path.is_file() or not path.resolve().is_relative_to(self.static_root.resolve()):
            self.send_error(404)
            return
        payload = path.read_bytes()
        content_type, _ = mimetypes.guess_type(path.name)
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type or 'application/octet-stream'}; charset=utf-8" if (content_type or "").startswith(("text/", "application/javascript", "application/json")) else content_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-cache")
        self._security_headers()
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        try:
            if path == "/api/health":
                self._json({"ok": True, "module": "AXM Challenge Arena", "version": __version__})
                return
            if path == "/api/challenges":
                self._json({"challenges": self.arena.list()})
                return
            if path == "/api/capabilities":
                self._json(self.arena.capabilities())
                return
            if path.startswith("/api/challenge/"):
                challenge_id = urllib.parse.unquote(path.split("/api/challenge/", 1)[1])
                self._json(self.arena.public_view(challenge_id))
                return
            if path.startswith("/api/integrity/"):
                challenge_id = urllib.parse.unquote(path.split("/api/integrity/", 1)[1])
                self._json(self.arena.public_integrity_view(challenge_id))
                return
            if path.startswith("/api/progress/"):
                challenge_id = urllib.parse.unquote(path.split("/api/progress/", 1)[1])
                self._json(self.arena.public_progress(challenge_id))
                return
            if path.startswith("/api/lineage/"):
                challenge_id = urllib.parse.unquote(path.split("/api/lineage/", 1)[1])
                self._json(self.arena.public_lineage_view(challenge_id))
                return
            requested = "index.html" if path in {"", "/"} else path.lstrip("/")
            candidate = (self.static_root / requested).resolve()
            self._file(candidate)
        except Exception as exc:
            # The observer is an intentionally public-safe surface. Full local
            # exception text can contain participant ids, task ids, artifact
            # paths, or forensic state details, so keep it in the CLI/local API.
            self._json(
                {
                    "error": type(exc).__name__,
                    "message": (
                        "Observer request failed. Use the local CLI or Python API "
                        "for forensic details."
                    ),
                    "details_hidden": True,
                },
                status=400,
            )

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[observer] {self.address_string()} - {fmt % args}")


def build_server(root: str | Path, host: str = "127.0.0.1", port: int = 8765) -> ThreadingHTTPServer:
    arena = ChallengeArena(root)
    static_root = Path(__file__).with_name("static")
    handler = type(
        "BoundObserverHandler",
        (ObserverHandler,),
        {"arena": arena, "static_root": static_root},
    )
    return ThreadingHTTPServer((host, port), handler)


def main() -> None:
    parser = argparse.ArgumentParser(description="Read-only local observer for AXM Challenge Arena.")
    parser.add_argument("--root", default="./workspace", help="Arena workspace root")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host; local-only by default")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = build_server(args.root, args.host, args.port)
    print(f"AXM Challenge Arena observer: http://{args.host}:{args.port}")
    print("Read-only observer. Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
