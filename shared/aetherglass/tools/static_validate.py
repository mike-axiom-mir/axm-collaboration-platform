#!/usr/bin/env python3
"""Standard-library release validator for AXM Aetherglass v7.1."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import zipfile
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
VERSION = "7.1.0"
BEHAVIORAL = 320
V7_0_SHA256 = "047a86a5d3e530220db387d262069c4cd4222f9db4b2fbbefabcb23d16a14dca"


class RefParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.refs: list[str] = []
        self.ids: list[str] = []

    def handle_starttag(self, _tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.append(str(values["id"]))
        for key in ("src", "href"):
            if values.get(key):
                self.refs.append(str(values[key]))


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def read(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def files() -> list[Path]:
    return sorted(
        path for path in ROOT.rglob("*")
        if path.is_file()
        and "__pycache__" not in path.parts
        and not path.name.endswith((".pyc", ".pyo"))
    )


def checksum_rows() -> dict[str, str]:
    rows = {}
    for line in read("CHECKSUMS_SHA256.txt").splitlines():
        match = re.fullmatch(r"([0-9a-f]{64})  (.+)", line)
        if match:
            rows[match.group(2)] = match.group(1)
    return rows


def index_rows() -> dict[str, int]:
    rows = {}
    for line in read("FILE_INDEX.txt").splitlines():
        match = re.fullmatch(r"(.+)\t(\d+) bytes", line)
        if match:
            rows[match.group(1)] = int(match.group(2))
    return rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=ROOT / "validation" / "STATIC_RESULT.json")
    args = parser.parse_args()
    checks: dict[str, bool] = {}
    details: dict[str, object] = {}

    def check(name: str, value: object, detail: object = None) -> None:
        checks[name] = bool(value)
        details[name] = detail

    required = [
        "README.md", "START_HERE.html", "MODULE_MANIFEST.json", "ACTION_REPORT.md",
        "VALIDATION_REPORT.txt", "VALIDATION_RESULT.txt", "CHANGELOG.md", "FILE_INDEX.txt",
        "CHECKSUMS_SHA256.txt", "src/axm-aetherglass.css", "src/axm-aetherglass.js",
        "src/axm-storycraft.css", "src/axm-focus-director.js", "src/axm-capture-studio.js",
        "src/axm-journey-director.js", "src/axm-design-token-forge.js",
        "src/axm-visual-contract.js", "src/axm-composition-workbench.js",
        "src/axm-runtime-supervisor.js", "demo/index.html", "demo/demo.js",
        "src/axm-luminous-layer-forge.js", "src/axm-luminous-layer-forge.css",
        "tests/smoke.html", "tests/authoring.html", "tests/storycraft.html",
        "tools/browser_validate.py", "tools/static_validate.py", "tools/local_product_design.py",
        "docs/MIGRATION_FROM_V6.md", "docs/MIGRATION_FROM_V7.md",
        "docs/AXM_AETHERGLASS_LOCAL_INTAKE_PROMPT.txt", "docs/QUICK_INTAKE.txt",
        "validation/README.txt", "previews/README.txt", "START_LOCAL_PRODUCT_DESIGN_WORKFLOW.bat",
        "docs/LUMINOUS_LAYER_FORGE.md", "docs/LOCAL_PRODUCT_DESIGN_WORKFLOW.md",
        "workflows/product-design/README.md", "workflows/product-design/WORKFLOW.json",
        "workflows/product-design/AXM_LOCAL_PRODUCT_DESIGN_PROMPT.txt",
        "rollback/AXM_AETHERGLASS_VISUAL_ENGINE_v7_0_0_STABLE.zip",
    ]
    missing = [name for name in required if not (ROOT / name).is_file()]
    check("required_files_present", not missing, missing)

    json_results = []
    for path in ROOT.rglob("*.json"):
        if path.resolve() == args.out.resolve():
            continue
        try:
            json.loads(path.read_text(encoding="utf-8"))
            json_results.append((str(path.relative_to(ROOT)), True))
        except Exception as exc:
            json_results.append((str(path.relative_to(ROOT)), False, str(exc)))
    check("json_parses", all(row[1] for row in json_results), json_results)

    js_results = []
    for path in sorted([*(ROOT / "src").glob("*.js"), ROOT / "demo/demo.js"]):
        result = subprocess.run(["node", "--check", str(path)], capture_output=True, text=True, check=False)
        js_results.append((str(path.relative_to(ROOT)), result.returncode == 0, result.stderr.strip()))
    check("javascript_syntax", all(row[1] for row in js_results), js_results)

    py_results = []
    for path in sorted((ROOT / "tools").glob("*.py")):
        try:
            compile(path.read_text(encoding="utf-8"), str(path), "exec")
            py_results.append((str(path.relative_to(ROOT)), True))
        except Exception as exc:
            py_results.append((str(path.relative_to(ROOT)), False, str(exc)))
    check("python_syntax_without_bytecode", all(row[1] for row in py_results), py_results)

    cycle_pattern = re.compile(r"(--[\w-]+)\s*:\s*[^;]*var\(\1(?:[,)]|\s)")
    css_results, cycles, invalid_rgb = [], [], []
    for path in sorted((ROOT / "src").glob("*.css")):
        text = path.read_text(encoding="utf-8")
        css_results.append((str(path.relative_to(ROOT)), text.count("{") == text.count("}") and text.count("/*") == text.count("*/")))
        cycles.extend((str(path.relative_to(ROOT)), match.group(0)) for match in cycle_pattern.finditer(text))
        if "rgba(var(--axm-surface-tint)" in text:
            invalid_rgb.append(str(path.relative_to(ROOT)))
    check("css_structure_balanced", all(row[1] for row in css_results), css_results)
    check("css_custom_properties_acyclic", not cycles, cycles)
    check("css_space_rgb_uses_modern_syntax", not invalid_rgb, invalid_rgb)

    source_versions = []
    for path in sorted([*(ROOT / "src").glob("*.js"), *(ROOT / "src").glob("*.css")]):
        source_versions.append((str(path.relative_to(ROOT)), f"v{VERSION}" in path.read_text(encoding="utf-8")[:600]))
    check("source_version_markers", all(row[1] for row in source_versions), source_versions)

    duplicate_ids, bad_refs, remote_refs, bad_anchors = [], [], [], []
    for path in ROOT.rglob("*.html"):
        parsed = RefParser()
        parsed.feed(path.read_text(encoding="utf-8"))
        known = set()
        for item in parsed.ids:
            if item in known:
                duplicate_ids.append((str(path.relative_to(ROOT)), item))
            known.add(item)
        for value in parsed.refs:
            if value.startswith(("http://", "https://", "//")):
                remote_refs.append((str(path.relative_to(ROOT)), value))
            elif value.startswith("#"):
                if value[1:] and value[1:] not in known:
                    bad_anchors.append((str(path.relative_to(ROOT)), value))
            elif not value.startswith(("data:", "blob:", "javascript:", "mailto:", "tel:")):
                clean = value.split("#", 1)[0].split("?", 1)[0]
                if clean and not (path.parent / clean).resolve().exists():
                    bad_refs.append((str(path.relative_to(ROOT)), value))
    check("local_html_references_exist", not bad_refs, bad_refs)
    check("internal_html_anchors_exist", not bad_anchors, bad_anchors)
    check("no_remote_html_resources", not remote_refs, remote_refs)
    check("no_duplicate_html_ids", not duplicate_ids, duplicate_ids)

    runtime = [*(ROOT / "src").glob("*.js"), ROOT / "demo/demo.js"]
    network_patterns = [r"\bfetch\s*\(", r"\bXMLHttpRequest\b", r"\bWebSocket\b", r"\bEventSource\b", r"\bsendBeacon\b", r"navigator\.serviceWorker"]
    network_hits, dynamic_hits = [], []
    for path in runtime:
        text = path.read_text(encoding="utf-8")
        network_hits.extend((str(path.relative_to(ROOT)), pattern) for pattern in network_patterns if re.search(pattern, text))
        dynamic_hits.extend((str(path.relative_to(ROOT)), pattern) for pattern in (r"\beval\s*\(", r"\bnew\s+Function\s*\(") if re.search(pattern, text))
    check("runtime_has_no_network_primitives", not network_hits, network_hits)
    check("runtime_has_no_dynamic_code_execution", not dynamic_hits, dynamic_hits)

    css_remote = []
    for path in (ROOT / "src").glob("*.css"):
        text = path.read_text(encoding="utf-8")
        if re.search(r"url\s*\(\s*['\"]?(?:https?:)?//", text, re.I) or re.search(r"@import\s+", text, re.I):
            css_remote.append(str(path.relative_to(ROOT)))
    check("css_has_no_remote_resources", not css_remote, css_remote)

    manifest = json.loads(read("MODULE_MANIFEST.json"))
    check("manifest_version", manifest.get("version") == VERSION, manifest.get("version"))
    check("manifest_behavioral_inventory", manifest.get("validation", {}).get("behavioral_assertions") == BEHAVIORAL, manifest.get("validation"))
    check("manifest_safety_boundaries", manifest.get("network_access") is False and manifest.get("telemetry") is False and manifest.get("automatic_rewrite") is False and manifest.get("semantic_inference") is False)

    engine = read("src/axm-aetherglass.js")
    tokens = read("src/axm-design-token-forge.js")
    supervisor = read("src/axm-runtime-supervisor.js")
    workbench = read("src/axm-composition-workbench.js")
    lighting = read("src/axm-lighting-director.js")
    interaction = read("src/axm-interaction-fx.js")
    focus = read("src/axm-focus-director.js")
    journey = read("src/axm-journey-director.js")
    capture = read("src/axm-capture-studio.js")
    light_layers = read("src/axm-luminous-layer-forge.js")
    light_layers_css = read("src/axm-luminous-layer-forge.css")
    design_workflow = read("workflows/product-design/WORKFLOW.json") + "\n" + read("tools/local_product_design.py")
    demo = read("demo/index.html") + "\n" + read("demo/demo.js")

    check("palette_is_first_class", all(token in engine for token in ["getPalette()", "clearPalette()", "paletteState: true", "palette: this.getPalette()"]))
    check("token_fields_route_to_live_variables", all(token in tokens for token in ['textMuted: "--axm-muted"', 'blur: "--axm-blur"', 'shadowDepth: "--axm-depth-strength"', 'spacingScale: "--axm-gap-scale"']))
    check("stress_restore_does_not_self_cancel", "restore(snapshot, { cancelStress: false })" in supervisor and "options.cancelStress !== false" in supervisor)
    check("workbench_builtin_dependencies_exist", '"flare"' not in workbench and "celestial-arrival" not in workbench and "transitionAvailable" in workbench and "cueAvailable" in workbench)
    check("lighting_transients_are_destroyed", all(token in lighting for token in ["_trackTransient", "this._transients.clear()", "this._timers.clear()", "Number.isFinite(Number(options.x))"]))
    check("interaction_effects_honor_motion", all(token in interaction for token in ["attentionskipped", "scanskipped", "!this.options.ripple || !this._motionAllowed()", "this._timers.clear()"]))
    check("focus_has_accessible_live_narration", all(token in focus for token in ["axm-focus-announcer", 'role=\"status\"', "accessibleNarration: true", "pulseskipped"]))
    check("journey_dwell_is_motion_independent", "duration / this.speed" in journey and "motionFactor" not in journey and "schedule: this.playing" in journey)
    check("capture_readiness_requires_still_frame", "(animations === null || animations === 0)" in capture)
    check("luminous_forge_declares_six_planes", all(token in light_layers for token in ['"halo"', '"crown"', '"aurora"', '"prism"', '"caustics"', '"refraction"']) and "AXMLuminousLayerForge" in light_layers)
    check("luminous_forge_is_policy_bounded", all(token in light_layers for token in ["_effectiveLayers", 'quality === "low"', 'transparency === "off"', 'contrast === "high"', 'motion: staticMotion ? "static" : "ambient"']))
    check("luminous_forge_cleans_owned_transients", all(token in light_layers for token in ["this._timers.clear()", "this._transients.clear()", "this.stage?.remove()", "data-axm-owned"]))
    check("luminous_css_has_static_and_capture_routes", all(token in light_layers_css for token in ['data-axm-light-motion="static"', ".axm-capture-freeze", "prefers-reduced-motion", "@media print"]))
    check("demo_exposes_luminous_controls", all(token in demo for token in ["lightLayerPresetSelect", "lightLayerIntensityRange", "lightLayerDepthRange", "lightReactiveToggle", "applyLightLayerPreset", "focusRadiance"]))
    workflow_contract = json.loads(read("workflows/product-design/WORKFLOW.json"))
    check("offline_design_workflow_is_bounded", workflow_contract.get("localOnly") is True and workflow_contract.get("networkAccess") is False and workflow_contract.get("automaticRewrite") is False)
    check("offline_design_workflow_has_five_gates", [stage.get("id") for stage in workflow_contract.get("stages", [])] == ["context", "visual-target", "build", "visual-qa", "handoff"])
    check("offline_design_workflow_requires_evidence", all(token in design_workflow for token in ["visual-qa requires --evidence", "SOURCE_FINGERPRINT.json", "downstream approvals", '"automaticRewrite": false']))
    check("demo_navigation_is_real", all(token in demo for token in ['href="#top"', 'href="#systemsLab"', 'href="#authoringLab"', 'href="#storycraftLab"', 'href="#productionLab"']))
    check("demo_defaults_to_manual_journey", 'id="journeyAutoplay"' in demo and "{ approved: true, autoplay }" in demo)
    check("demo_dynamic_copy_uses_dom_text", "trace.replaceChildren" in demo and "heading.textContent" in demo and "toast.innerHTML" not in demo)

    rollback = ROOT / "rollback/AXM_AETHERGLASS_VISUAL_ENGINE_v7_0_0_STABLE.zip"
    rollback_crc, unsafe = None, []
    if rollback.is_file():
        with zipfile.ZipFile(rollback) as archive:
            unsafe = [name for name in archive.namelist() if PurePosixPath(name).is_absolute() or ".." in PurePosixPath(name).parts]
            rollback_crc = archive.testzip()
    check("v7_rollback_byte_identical", rollback.is_file() and digest(rollback) == V7_0_SHA256, digest(rollback) if rollback.is_file() else None)
    check("v7_rollback_crc_and_paths", rollback.is_file() and rollback_crc is None and not unsafe, {"crc": rollback_crc, "unsafe": unsafe})

    indexed = index_rows()
    expected_index = {str(path.relative_to(ROOT)): path.stat().st_size for path in files() if path.name not in {"FILE_INDEX.txt", "CHECKSUMS_SHA256.txt"}}
    check("file_index_covers_payload", indexed == expected_index, {"listed": len(indexed), "expected": len(expected_index)})

    checksums = checksum_rows()
    expected_checksum_paths = {str(path.relative_to(ROOT)) for path in files() if path.name != "CHECKSUMS_SHA256.txt"}
    mismatches = [name for name, value in checksums.items() if not (ROOT / name).is_file() or digest(ROOT / name) != value]
    check("checksum_map_covers_release", set(checksums) == expected_checksum_paths, {"listed": len(checksums), "expected": len(expected_checksum_paths)})
    check("checksum_map_matches_bytes", not mismatches, mismatches)

    stale = [str(path.relative_to(ROOT)) for path in [*(ROOT / "validation").glob("*.png"), *(ROOT / "validation").glob("*_RESULT.json"), *(ROOT / "previews").glob("*.png")]]
    check("no_stale_visual_evidence_relabelled", not stale, stale)
    check("browser_validation_boundary_documented", "not executed" in read("validation/README.txt").lower() and "playwright" in read("validation/README.txt").lower())
    check("readme_does_not_claim_v7_1_browser_pass", "v7.1 browser validation: not executed" in read("README.md").lower())
    check("intake_prompt_has_stop_conditions", "STOP CONDITIONS" in read("docs/AXM_AETHERGLASS_LOCAL_INTAKE_PROMPT.txt"))

    passed = sum(checks.values())
    failed = len(checks) - passed
    payload = {
        "version": VERSION,
        "checks": checks,
        "details": details,
        "summary": {"passed": passed, "failed": failed, "total": len(checks)},
        "behavioralInventory": BEHAVIORAL,
        "browserValidation": "not-executed-in-this-build-environment",
        "localOnly": True,
        "telemetry": False,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload["summary"], indent=2))
    for name, value in checks.items():
        if not value:
            print("FAIL:", name, details.get(name))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
