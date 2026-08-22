from __future__ import annotations
import base64
import importlib.util
import json
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("visual_handshake", ROOT / "app" / "visual_handshake.py")
VH = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(VH)
PNG = b"\x89PNG\r\n\x1a\n" + b"test-png-data"


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = VH.Store(Path(self.temp.name))
    def tearDown(self):
        self.temp.cleanup()
    def test_packet_roundtrip_and_hash(self):
        packet = self.store.create_packet("to_codex", PNG, "screen.png", "Title", "Note", "mike")
        self.assertEqual(packet["sha256"], VH.sha256_bytes(PNG))
        self.assertEqual(self.store.latest("to_codex")["packet_id"], packet["packet_id"])
        self.assertEqual(self.store.asset_path("to_codex", packet["packet_id"]).read_bytes(), PNG)
    def test_no_silent_overwrite(self):
        a = self.store.create_packet("to_mike", PNG, "a.png")
        b = self.store.create_packet("to_mike", PNG, "a.png")
        self.assertNotEqual(a["packet_id"], b["packet_id"])
        self.assertTrue(self.store.asset_path("to_mike", a["packet_id"]).is_file())
    def test_acknowledgement_is_explicit(self):
        packet = self.store.create_packet("to_mike", PNG, "a.png")
        ack = self.store.acknowledge("to_mike", packet["packet_id"], "mike")
        self.assertTrue(ack["acknowledged"])
        self.assertEqual(ack["acknowledged_by"], "mike")
    def test_invalid_lane_rejected(self):
        with self.assertRaises(ValueError):
            self.store.create_packet("internet", PNG, "a.png")
    def test_traversal_filename_reduced_to_basename(self):
        packet = self.store.create_packet("to_codex", PNG, "../../screen.png")
        self.assertEqual(packet["filename"], "screen.png")
    def test_bad_png_rejected(self):
        with self.assertRaises(ValueError):
            self.store.create_packet("to_codex", b"not png", "screen.png")
    def test_active_svg_rejected(self):
        samples = [
            b'<svg><script>alert(1)</script></svg>',
            b'<svg><image href="https://example.com/x.png"/></svg>',
            b'<svg><rect onload="x()"/></svg>',
        ]
        for sample in samples:
            with self.subTest(sample=sample), self.assertRaises(ValueError):
                self.store.create_packet("to_mike", sample, "x.svg")
    def test_safe_svg_with_internal_gradient_allowed(self):
        data = b'<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"/></defs><rect fill="url(#g)" width="2" height="2"/></svg>'
        packet = self.store.create_packet("to_mike", data, "x.svg")
        self.assertEqual(packet["kind"], "svg")
    def test_active_or_invalid_html_rejected(self):
        samples = [
            b'<script>alert(1)</script>',
            b'<meta http-equiv="refresh" content="0;url=https://example.com">',
            b'<a href="https://example.com">leave</a>',
            b'\xff\xfe\x00bad',
        ]
        for sample in samples:
            with self.subTest(sample=sample), self.assertRaises(ValueError):
                self.store.create_packet("to_mike", sample, "x.html")
    def test_static_html_allowed(self):
        packet = self.store.create_packet("to_mike", b'<!doctype html><style>body{font-family:sans-serif}</style><h1>Preview</h1>', "x.html")
        self.assertEqual(packet["kind"], "html")
    def test_asset_tamper_detected(self):
        packet = self.store.create_packet("to_codex", PNG, "a.png")
        path = self.store.lane_dir("to_codex") / packet["relative_asset"]
        path.write_bytes(PNG + b"tamper")
        with self.assertRaises(ValueError):
            self.store.asset_path("to_codex", packet["packet_id"])
    def test_corrupt_packet_record_rejected(self):
        packet = self.store.create_packet("to_codex", PNG, "a.png")
        metadata = self.store.lane_dir("to_codex") / packet["packet_id"] / "packet.json"
        data = json.loads(metadata.read_text())
        data["relative_asset"] = "../../a.png"
        metadata.write_text(json.dumps(data), encoding="utf-8")
        with self.assertRaises(ValueError):
            self.store.packet("to_codex", packet["packet_id"])
    def test_failed_write_removes_partial_packet_folder(self):
        original = VH.atomic_json
        calls = 0
        def fail_first(*args, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 1:
                raise OSError("simulated metadata failure")
            return original(*args, **kwargs)
        with mock.patch.object(VH, "atomic_json", side_effect=fail_first):
            with self.assertRaises(OSError):
                self.store.create_packet("to_codex", PNG, "a.png")
        packet_dirs = [p for p in self.store.lane_dir("to_codex").iterdir() if p.is_dir()]
        self.assertEqual(packet_dirs, [])
    def test_counts_ignore_uncommitted_directories(self):
        (self.store.lane_dir("to_codex") / "partial").mkdir()
        self.assertEqual(self.store.counts()["to_codex"], 0)


class WrongPingHandler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def do_GET(self):
        raw = json.dumps({"ok": True, "service": "something-else"}).encode()
        self.send_response(200); self.send_header("Content-Length", str(len(raw))); self.end_headers(); self.wfile.write(raw)


class SessionTests(unittest.TestCase):
    def test_wrong_local_service_is_not_reused(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), WrongPingHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        try:
            session = {"host":"127.0.0.1", "port":server.server_address[1], "token":"x"*32}
            self.assertFalse(VH.ping_session(session))
        finally:
            server.shutdown(); server.server_close(); thread.join(timeout=2)
    def test_non_loopback_session_is_rejected_without_contact(self):
        self.assertFalse(VH.ping_session({"host":"0.0.0.0", "port":1234, "token":"x"*32}))
    def test_stale_session_remove_is_idempotent(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/"session.json"; path.write_text("{}")
            self.assertTrue(VH.remove_stale_session(path))
            self.assertFalse(VH.remove_stale_session(path))


class HttpIntegrationTests(unittest.TestCase):
    def test_loopback_server_auth_upload_asset_static_html_and_shutdown(self):
        with tempfile.TemporaryDirectory() as temp:
            command = [sys.executable, str(ROOT / "app" / "visual_handshake.py"), "--data-root", temp, "serve", "--port", "0", "--mode", "home"]
            process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            session_path = Path(temp) / "runtime" / "session.json"
            try:
                deadline = time.time() + 8
                session = None
                while time.time() < deadline:
                    if session_path.is_file():
                        try:
                            session = json.loads(session_path.read_text(encoding="utf-8")); break
                        except json.JSONDecodeError:
                            pass
                    time.sleep(0.05)
                self.assertIsNotNone(session, "session file was not created")
                base = f"http://127.0.0.1:{session['port']}"
                with urllib.request.urlopen(base + "/api/ping", timeout=3) as response:
                    ping = json.loads(response.read())
                self.assertEqual(ping["service"], "axm-visual-handshake")
                with self.assertRaises(urllib.error.HTTPError) as denied:
                    urllib.request.urlopen(base + "/api/status", timeout=3)
                self.assertEqual(denied.exception.code, 403)

                req = urllib.request.Request(base + "/api/status", headers={"X-AXM-Token": session["token"]})
                with urllib.request.urlopen(req, timeout=3) as response:
                    payload = json.loads(response.read())
                self.assertTrue(payload["loopback_only"])
                self.assertEqual(payload["max_upload_bytes"], VH.MAX_UPLOAD_BYTES)

                hostile_origin = urllib.request.Request(base + "/api/status", headers={"X-AXM-Token":session["token"], "Origin":"https://example.com"})
                with self.assertRaises(urllib.error.HTTPError) as origin_denied:
                    urllib.request.urlopen(hostile_origin, timeout=3)
                self.assertEqual(origin_denied.exception.code, 403)

                meta = base64.urlsafe_b64encode(json.dumps({"filename":"screen.png","title":"Integration","note":"Private metadata","actor":"mike"}).encode()).decode().rstrip("=")
                upload = urllib.request.Request(base + "/api/upload?lane=to_codex", data=PNG, method="POST", headers={"X-AXM-Token":session["token"], "X-AXM-Meta":meta, "Content-Type":"image/png"})
                with urllib.request.urlopen(upload, timeout=3) as response:
                    created = json.loads(response.read()); self.assertEqual(response.status, 201)
                packet = created["packet"]

                # Query-token route is required for sandboxed image/HTML frame elements.
                with urllib.request.urlopen(base + f"/api/asset?lane=to_codex&packet_id={packet['packet_id']}&token={session['token']}", timeout=3) as response:
                    self.assertEqual(response.read(), PNG)
                    self.assertEqual(response.headers.get("X-Frame-Options"), "DENY")

                html_meta = base64.urlsafe_b64encode(json.dumps({"filename":"preview.html","title":"Preview","actor":"codex"}).encode()).decode().rstrip("=")
                html_upload = urllib.request.Request(base + "/api/upload?lane=to_mike", data=b"<!doctype html><style>body{font-family:sans-serif}</style><h1>Preview</h1>", method="POST", headers={"X-AXM-Token":session["token"], "X-AXM-Meta":html_meta, "Content-Type":"text/html"})
                with urllib.request.urlopen(html_upload, timeout=3) as response:
                    html_packet = json.loads(response.read())["packet"]
                with urllib.request.urlopen(base + f"/api/asset?lane=to_mike&packet_id={html_packet['packet_id']}&token={session['token']}", timeout=3) as response:
                    self.assertIsNone(response.headers.get("X-Frame-Options"))
                    csp = response.headers.get("Content-Security-Policy", "")
                    self.assertIn("default-src 'none'", csp)
                    self.assertIn("frame-ancestors 'self'", csp)
                    self.assertIn("navigate-to 'none'", csp)

                stop = urllib.request.Request(base + "/api/shutdown", data=b"{}", method="POST", headers={"X-AXM-Token":session["token"], "Content-Type":"application/json"})
                with urllib.request.urlopen(stop, timeout=3) as response:
                    self.assertEqual(response.status, 200)
                process.wait(timeout=5)
                self.assertEqual(process.returncode, 0)
            finally:
                if process.poll() is None:
                    process.kill(); process.wait(timeout=3)
                if process.stdout: process.stdout.close()
                if process.stderr: process.stderr.close()


class PolicyTests(unittest.TestCase):
    def test_local_url_allowed(self):
        self.assertTrue(VH.url_allowed("http://127.0.0.1:3000"))
        self.assertTrue(VH.url_allowed("http://localhost:9000/x"))
        self.assertTrue(VH.url_allowed("file:///tmp/preview.html"))
    def test_remote_url_and_unc_file_blocked_by_default(self):
        self.assertFalse(VH.url_allowed("https://example.com"))
        self.assertTrue(VH.url_allowed("https://example.com", allow_network=True))
        self.assertFalse(VH.url_allowed("file://server/share/preview.html"))
    def test_url_with_credentials_rejected(self):
        self.assertFalse(VH.url_allowed("http://user:password@localhost:3000"))
    def test_snapshot_dimensions_are_bounded(self):
        self.assertEqual(VH.bounded_snapshot_size(1, 9000), (VH.MIN_SNAPSHOT_DIMENSION, VH.MAX_SNAPSHOT_DIMENSION))
    def test_missing_local_file_snapshot_fails_before_browser_lookup(self):
        with tempfile.TemporaryDirectory() as temp:
            missing = Path(temp) / "missing-preview.html"
            output = Path(temp) / "never.png"
            with self.assertRaises(FileNotFoundError):
                VH.snapshot_url(missing.as_uri(), output, 1000, 800, False)
    def test_snapshot_command_uses_isolated_profile_and_network_rule(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / 'preview.html'; source.write_text('<h1>Preview</h1>', encoding='utf-8')
            output = Path(temp) / 'shot.png'
            captured = {}
            def fake_run(command, timeout=45):
                captured['command'] = command; captured['timeout'] = timeout
                output.write_bytes(PNG)
                return 0, '', ''
            with mock.patch.object(VH, 'browser_candidates', return_value=['fake-browser']), mock.patch.object(VH, 'run_browser_command', side_effect=fake_run):
                browser = VH.snapshot_url(source.as_uri(), output, 1000, 800, False)
            self.assertEqual(browser, 'fake-browser')
            joined = '\n'.join(captured['command'])
            self.assertIn('--user-data-dir=', joined)
            self.assertIn('--host-resolver-rules=', joined)
            self.assertEqual(captured['timeout'], 45)
    def test_browser_timeout_is_bounded(self):
        command = [sys.executable, '-c', 'import subprocess,sys,time; subprocess.Popen([sys.executable,"-c","import time; time.sleep(30)"]); time.sleep(30)']
        started = time.monotonic()
        with self.assertRaises(RuntimeError):
            VH.run_browser_command(command, timeout=1)
        self.assertLess(time.monotonic() - started, 8)
    def test_modular_skills_have_required_frontmatter_and_ui_metadata(self):
        names = (
            "axm-visual-handshake",
            "axm-visual-intake",
            "axm-visual-publish",
            "axm-visual-snapshot",
            "axm-visual-runtime",
        )
        for name in names:
            with self.subTest(name=name):
                folder = ROOT / ".agents" / "skills" / name
                text = (folder / "SKILL.md").read_text(encoding="utf-8")
                ui = (folder / "agents" / "openai.yaml").read_text(encoding="utf-8")
                self.assertTrue(text.startswith("---\n"))
                self.assertIn(f"name: {name}", text)
                self.assertIn("description:", text)
                self.assertIn(f"${name}", ui)
                self.assertTrue((folder / "assets" / "visual-handshake.svg").is_file())
    def test_server_source_is_loopback_only(self):
        text = (ROOT / "app" / "visual_handshake.py").read_text(encoding="utf-8")
        self.assertIn('host = "127.0.0.1"', text); self.assertNotIn('host = "0.0.0.0"', text)
    def test_browser_ui_has_both_directions_and_resource_restraint(self):
        html = (ROOT / "app" / "static" / "index.html").read_text(encoding="utf-8")
        js = (ROOT / "app" / "static" / "app.js").read_text(encoding="utf-8")
        self.assertIn("MIKE", html); self.assertIn("CODEX", html); self.assertIn("Show Codex what you see", html); self.assertIn("Codex shows you", html)
        self.assertIn("document.hidden", js); self.assertIn("state.refreshBusy", js); self.assertIn('frame.src = url', js)
    def test_windows_installer_validates_staging_before_replace(self):
        text = (ROOT / "scripts" / "install_windows.ps1").read_text(encoding="utf-8")
        stage = text.index("program.staging-")
        validate = text.index("validate_release.py")
        replace = text.index("Move-Item $Staging $Program")
        self.assertLess(stage, validate); self.assertLess(validate, replace)
    def test_windows_installer_and_restore_treat_skills_as_one_suite(self):
        installer = (ROOT / "scripts" / "install_windows.ps1").read_text(encoding="utf-8")
        restore = (ROOT / "scripts" / "restore_previous_windows.ps1").read_text(encoding="utf-8")
        for name in ("axm-visual-handshake", "axm-visual-intake", "axm-visual-publish", "axm-visual-snapshot", "axm-visual-runtime"):
            self.assertIn(f'"{name}"', installer)
            self.assertIn(f'"{name}"', restore)
        self.assertIn("axm-visual-handshake-suite-", installer)
        self.assertIn("axm-visual-handshake-suite-", restore)
    def test_all_portable_skill_wrappers_resolve_one_program(self):
        names = ("axm-visual-handshake", "axm-visual-intake", "axm-visual-publish", "axm-visual-snapshot", "axm-visual-runtime")
        with tempfile.TemporaryDirectory() as data:
            for name in names:
                with self.subTest(name=name):
                    wrapper = ROOT / ".agents" / "skills" / name / "scripts" / "handshake.py"
                    result = subprocess.run([sys.executable, str(wrapper), "--data-root", data, "status"], cwd=ROOT, capture_output=True, text=True, timeout=10)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    payload = json.loads(result.stdout)
                    self.assertTrue(payload["ok"])
                    self.assertEqual(payload["version"], "0.3.0")


if __name__ == "__main__":
    unittest.main()
