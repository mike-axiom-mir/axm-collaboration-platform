#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import http.client
import http.server
import json
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PASS = 0
FAIL = 0
SKIP = 0
RESULTS: list[tuple[str, str, str]] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    global PASS, FAIL
    state = "PASS" if ok else "FAIL"
    PASS += int(ok)
    FAIL += int(not ok)
    RESULTS.append((state, name, detail))
    print(f"[{state}] {name}" + (f" — {detail}" if detail else ""))


def skip(name: str, detail: str = "") -> None:
    global SKIP
    SKIP += 1
    RESULTS.append(("SKIP", name, detail))
    print(f"[SKIP] {name}" + (f" — {detail}" if detail else ""))


def read_json(rel: str):
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))


def test_required_files() -> None:
    required = [
        "START_HERE.bat", "start_server.py", "README.md", "QUICK_START.md",
        "ACTION_REPORT.md", "TEST_REPORT.md", "KNOWN_LIMITATIONS.md",
        "SECURITY_AND_PRIVACY.md", "CHANGELOG.md", "FILE_MANIFEST_SHA256.txt",
        "app/index.html", "tests/browser_smoke.html", "tests/browser_smoke.js", "tests/node_smoke.js", "tests/dialog_smoke.js",
        "registry/themes/themes.json", "docs/THEME_SPEC.md",
        "docs/WORKSPACE_AND_COMPARISON.md",
        "docs/FAMILY_PACKAGES.md",
        "docs/LOCAL_EXTENSION_REGISTRY.md",
        "docs/LOCAL_THEME_FOUNDRY.md",
        "docs/EXTENSION_RELEASE_GATE.md",
        "docs/LIBRARY_EXPANSION.md",
        "docs/CARD_LAYOUT_RECIPES.md",
        "LOCAL_INTAKE_HANDOFF.md",
        "docs/PROJECT_COMPOSER.md",
        "docs/DATA_BATCH_BUILDER.md",
        "examples/batch_comma.csv",
        "examples/batch_semicolon.csv",
        "examples/batch_rows.json",
        "app/js/assembly.js",
        "app/js/assembly-ui.js",
        "app/js/recovery.js",
        "app/js/recovery-ui.js",
        "app/js/dialogs.js",
        "docs/RECOVERY_CENTER.md",
        "docs/SAFETY_CAPSULE_RESTORE.md",
        "docs/INTAKE_READINESS_GATE.md",
        "docs/RELEASE_HISTORY.md",
        "RUN_DIAGNOSTICS.bat",
        "OPEN_DIRECT_FALLBACK.bat",
        "FINAL_INTAKE_CHECKLIST.md",
        "RELEASE_SEAL.json",
    ]
    missing = [path for path in required if not (ROOT / path).is_file()]
    record("required files", not missing, ", ".join(missing))


def test_json_and_registries() -> None:
    json_files = list(ROOT.rglob("*.json"))
    errors = []
    for path in json_files:
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append(f"{path.relative_to(ROOT)}: {exc}")
    record("JSON parse", not errors, f"{len(json_files)} files" if not errors else "; ".join(errors))

    tokens = read_json("registry/tokens/tokens.json")["tokens"]
    organs = read_json("registry/organs/organs.json")["organs"]
    molds = read_json("registry/molds/index.json")["molds"]
    presets = read_json("registry/presets/starter-presets.json")["presets"]
    themes = read_json("registry/themes/themes.json")["themes"]
    roots = [m for m in molds if not m.get("lineage", {}).get("parent")]
    derived = [m for m in molds if m.get("lineage", {}).get("parent")]
    breadth_ok = (
        len(tokens) >= 140 and len(organs) >= 55 and len(molds) == 32
        and len(roots) == 3 and len(derived) == 29 and len(themes) == 6
        and len(presets) >= 38
    )
    record(
        "registry breadth",
        breadth_ok,
        f"tokens={len(tokens)}, organs={len(organs)}, molds={len(molds)} "
        f"({len(roots)} root/{len(derived)} derived), themes={len(themes)}, presets={len(presets)}",
    )

    all_items = tokens + organs + molds + presets + themes
    ids = [item.get("id") for item in all_items]
    duplicates = sorted({item_id for item_id in ids if ids.count(item_id) > 1})
    record("duplicate IDs", not duplicates, ", ".join(duplicates))

    organ_ids = {organ["id"] for organ in organs}
    missing_deps = {
        mold["id"]: [organ for organ in mold.get("organs", []) if organ not in organ_ids]
        for mold in molds
    }
    missing_deps = {key: value for key, value in missing_deps.items() if value}
    record("mold organ dependencies", not missing_deps, json.dumps(missing_deps))

    schema = read_json("validation/mold-schema.json")
    missing_fields = {
        mold["id"]: [field for field in schema["required"] if field not in mold]
        for mold in molds
    }
    missing_fields = {key: value for key, value in missing_fields.items() if value}
    record("resolved mold schema fields", not missing_fields, json.dumps(missing_fields))

    bad_organs = [
        organ["id"] for organ in organs
        if any(field not in organ for field in [
            "id", "version", "category", "inputs", "outputs", "dependencies",
            "compatible_runtimes", "performance_cost", "fallback", "validators", "status",
        ])
    ]
    record("organ contract fields", not bad_organs, ", ".join(bad_organs[:10]))


def test_sparse_inheritance() -> None:
    index_molds = {mold["id"]: mold for mold in read_json("registry/molds/index.json")["molds"]}
    source_paths = [
        path for path in (ROOT / "registry" / "molds").glob("*.json")
        if path.name != "index.json"
    ]
    sparse_sources = []
    errors = []
    for path in source_paths:
        source = json.loads(path.read_text(encoding="utf-8"))
        parent = source.get("parent") or source.get("lineage", {}).get("parent")
        if not parent:
            continue
        sparse_sources.append(source)
        allowed = {
            "schema", "id", "name", "version", "category", "description", "parent",
            "lineage", "sparse_overrides", "provenance", "preview",
        }
        extra = sorted(set(source) - allowed)
        resolved = index_molds.get(source.get("id"))
        if extra:
            errors.append(f"{path.name}: non-sparse keys {extra}")
        if not source.get("sparse_overrides"):
            errors.append(f"{path.name}: no sparse_overrides")
        if parent not in index_molds:
            errors.append(f"{path.name}: missing parent {parent}")
        if not resolved or resolved.get("lineage", {}).get("parent") != parent:
            errors.append(f"{path.name}: unresolved lineage")
        elif not all(field in resolved for field in ["inputs", "variants", "organs", "outputs", "renderer"]):
            errors.append(f"{path.name}: inherited fields missing")
    record("sparse child inheritance", len(sparse_sources) == 29 and not errors,
           f"{len(sparse_sources)} children" if not errors else "; ".join(errors))


def test_library_expansion_and_layouts() -> None:
    molds = read_json("registry/molds/index.json")["molds"]
    presets = read_json("registry/presets/starter-presets.json")["presets"]
    categories: dict[str, int] = {}
    for mold in molds:
        categories[mold["category"]] = categories.get(mold["category"], 0) + 1
    marketing = categories.get("marketing", 0) + categories.get("public-explanation", 0) + categories.get("visual-log", 0)
    games = categories.get("game-ui", 0) + categories.get("game-marketing", 0)
    coverage = {
        "marketing/explanation": marketing,
        "software-ui": categories.get("software-ui", 0),
        "game-ui/marketing": games,
        "material": categories.get("material", 0),
        "scene": categories.get("scene", 0),
    }
    record(
        "practical mold family coverage",
        coverage == {"marketing/explanation": 8, "software-ui": 8, "game-ui/marketing": 8, "material": 4, "scene": 4},
        json.dumps(coverage),
    )

    renderers = (ROOT / "app/js/renderers.js").read_text(encoding="utf-8")
    match = re.search(r"const CARD_LAYOUTS=new Set\(\[(.*?)\]\);", renderers, re.S)
    recipes = set(re.findall(r"'([^']+)'", match.group(1))) if match else set()
    card_molds = [mold for mold in molds if mold.get("renderer") == "card"]
    card_layouts = [mold.get("renderer_options", {}).get("layout") for mold in card_molds]
    unknown = sorted(set(card_layouts) - recipes)
    record(
        "card layout recipe coverage",
        len(card_molds) == 24 and len(set(card_layouts)) == 24 and len(recipes) == 24 and not unknown,
        f"card_molds={len(card_molds)}, unique_layouts={len(set(card_layouts))}, recipes={len(recipes)}, unknown={unknown}",
    )

    exporters = (ROOT / "app/js/exporters.js").read_text(encoding="utf-8")
    motif_contract = all(term in exporters for term in [
        "svgLayoutMotif", "data-layout", "dashboard-panel", "mission-brief", "loot-inspect", "hud-status",
    ])
    record("expanded SVG/HTML layout motifs", motif_contract)

    preset_parents = {preset.get("parent") for preset in presets}
    uncovered = sorted(mold["id"] for mold in molds if mold["id"] not in preset_parents)
    record("starter preset coverage for every mold", not uncovered, ", ".join(uncovered))

    required_ids = {
        "axm.mold.product-launch-signal", "axm.mold.operational-dashboard-panel",
        "axm.mold.command-palette-panel", "axm.mold.mission-briefing-panel",
        "axm.mold.character-dossier-card", "axm.mold.neon-street-gate-scene",
        "axm.mold.public-calm-presentation-stage", "axm.mold.frosted-crystal-skin",
        "axm.mold.wet-neon-membrane",
    }
    mold_ids = {mold["id"] for mold in molds}
    record("protected reference mold presence", required_ids.issubset(mold_ids), ", ".join(sorted(required_ids - mold_ids)))


def test_theme_contracts() -> None:
    themes = read_json("registry/themes/themes.json")["themes"]
    molds = read_json("registry/molds/index.json")["molds"]
    theme_ids = {theme["id"] for theme in themes}
    required = {
        "id", "name", "status", "public_scope", "material_language", "surface",
        "surface_2", "panel", "text", "muted", "accent", "accent_2", "line",
        "shadow", "glow_rgb", "contrast_target", "motion_character", "low_power_fallback",
    }
    bad_themes = [theme.get("id", "<missing>") for theme in themes if not required.issubset(theme)]
    bad_refs = {
        mold["id"]: [theme for theme in mold.get("variants", {}).get("theme", []) if theme not in theme_ids]
        for mold in molds
    }
    bad_refs = {key: value for key, value in bad_refs.items() if value}
    public_theme = next((theme for theme in themes if theme["id"] == "public-calm"), {})
    record("theme registry contracts", not bad_themes and not bad_refs,
           json.dumps({"bad_themes": bad_themes, "bad_refs": bad_refs}))
    record("public-safe theme declaration", public_theme.get("public_scope") == "public-safe",
           public_theme.get("public_scope", "missing"))


def test_dom_contract() -> None:
    html = (ROOT / "app" / "index.html").read_text(encoding="utf-8")
    app = (ROOT / "app" / "js" / "app.js").read_text(encoding="utf-8")
    assembly_ui = (ROOT / "app" / "js" / "assembly-ui.js").read_text(encoding="utf-8")
    recovery_ui = (ROOT / "app" / "js" / "recovery-ui.js").read_text(encoding="utf-8")
    ids = re.findall(r'\bid="([A-Za-z0-9_-]+)"', html)
    duplicates = sorted({item_id for item_id in ids if ids.count(item_id) > 1})
    record("HTML unique IDs", not duplicates, ", ".join(duplicates))
    referenced = set(re.findall(r"\$\('#([A-Za-z0-9_-]+)'\)", app + "\n" + assembly_ui + "\n" + recovery_ui))
    missing = sorted(referenced - set(ids))
    record("Studio DOM wiring contract", not missing, ", ".join(missing))
    nav = set(re.findall(r'data-view="([A-Za-z0-9_-]+)"', html))
    panels = set(re.findall(r'data-view-panel="([A-Za-z0-9_-]+)"', html))
    record("navigation/panel contract", nav == panels,
           f"nav-only={sorted(nav-panels)}, panel-only={sorted(panels-nav)}")
    molds = read_json("registry/molds/index.json")["molds"]
    missing_previews = [mold["id"] for mold in molds if not (ROOT / mold.get("preview", "")).is_file()]
    record("mold preview references", not missing_previews, ", ".join(missing_previews))
    required_controls = {
        "snapshotCompareSelect", "compareSnapshotButton", "comparisonSummary",
        "comparisonGrid", "exportWorkspaceButton", "importWorkspaceButton",
        "workspaceFileInput", "importFamilyButton", "familyFileInput",
        "candidatePurpose", "candidateChangeSummary", "candidateTags", "candidatePublicScope",
        "promoteCandidate", "extensionMetrics", "extensionGrid",
        "importExtensionButton", "extensionFileInput",
        "themeBase", "themeName", "themeMaterial", "themePublicScope",
        "themeRenderers", "themeManifest", "themePreview", "themeValidationReport",
        "themeBuildDraft", "themeValidateDraft", "themeSaveDraft",
        "themeImportButton", "themeFileInput", "localThemeMetrics", "localThemeGrid",
        "projectSelect", "projectName", "projectDescription", "projectLayout", "projectTheme",
        "projectNewButton", "projectSaveButton", "projectAddCurrentButton", "projectApproveButton",
        "projectArchiveButton", "projectExportButton", "projectExportHTMLButton", "projectImportButton",
        "projectFileInput", "projectValidation", "projectRevisions", "projectItems",
        "batchSelect", "batchName", "batchMold", "batchSource", "batchParseButton", "batchSaveButton",
        "batchApproveButton", "batchArchiveButton", "batchMapping", "batchPreviewButton",
        "batchToProjectButton", "batchExportButton", "batchExportHTMLButton", "batchImportButton",
        "batchFileInput", "batchSourceFileButton", "batchSourceFileInput", "batchValidation", "batchPreviewGrid",
        "firstRunPanel", "onboardingChecklist", "onboardingCapsuleButton", "onboardingCompleteButton",
        "recoveryAuditButton", "recoveryCapsuleButton", "reopenGuideButton", "recoveryMetrics",
        "recoveryAuditState", "recoveryStorageList", "packageInspectorState", "packageInspectButton",
        "packageInspectFile", "packageImportButton", "packageClearButton", "packageInspectorReport",
        "recoveryIssueCount", "recoveryIssueList", "transactionList",
        "onboardingReadinessButton", "rescuePointButton", "capsuleStageState", "capsuleStageButton",
        "capsuleStageFile", "capsuleMergeButton", "capsuleReplaceButton", "capsuleClearButton",
        "capsuleStageReport", "rescuePointList", "readinessState", "readinessRunButton",
        "readinessExportButton", "handoffExportButton", "browserValidatedButton",
        "readinessMetrics", "readinessReport",
        "actionDialog", "actionDialogForm", "actionDialogTitle", "actionDialogMessage",
        "actionDialogInput", "actionDialogSelect", "actionDialogConfirm", "actionDialogCancel",
    }
    record("v0.9 theme/extension/project/batch/recovery/intake/workspace DOM", required_controls.issubset(ids),
           ", ".join(sorted(required_controls - set(ids))))


def test_lineage_and_protection() -> None:
    molds = read_json("registry/molds/index.json")["molds"]
    presets = read_json("registry/presets/starter-presets.json")["presets"]
    mold_ids = {mold["id"] for mold in molds}
    bad_presets = [
        preset["id"] for preset in presets
        if preset.get("parent") not in mold_ids or "sparse_overrides" not in preset
    ]
    bad_protection = [
        mold["id"] for mold in molds
        if not mold.get("core", {}).get("protected")
        or mold.get("lineage", {}).get("change_policy") != "explicit-approval"
    ]
    record("preset parent/sparse structure", not bad_presets, ", ".join(bad_presets))
    record("derive/rollback protection contract", not bad_protection, ", ".join(bad_protection))
    core_source = (ROOT / "app/js/core.js").read_text(encoding="utf-8")
    validator_source = (ROOT / "app/js/validators.js").read_text(encoding="utf-8")
    guards = all(term in core_source for term in [
        "before-rollback", "compareWithSnapshot", "exportWorkspace", "importWorkspace",
        "exportFamilyPackage", "importFamilyPackage", "promoteCandidate",
        "importExtensionPackage", "coreIntegrityReport", "healthReport",
        "attachPacketIntegrity", "verifyPacketIntegrity", "LEGACY_STORAGES",
        "themeValidation", "importThemePackage", "extensionReleaseGate",
        "active child extension(s) depend on it", "active extension(s) depend on it",
        "projects: 'axm.visual-foundry.projects.v0.9'", "batches: 'axm.visual-foundry.batches.v0.9'",
    ]) and all(term in validator_source for term in ["protected_change_request", "extensionStateCheck", "releaseGateEvidenceCheck", "candidateIntentCheck"])
    record("mutation/migration/theme/extension guards", guards)


def test_static_security_and_links() -> None:
    scan_roots = [ROOT / "app", ROOT / "start_server.py", ROOT / "tools"]
    remote = []
    pattern = re.compile(r"https?://(?!127\.0\.0\.1|localhost)", re.I)
    paths = []
    for item in scan_roots:
        paths.extend(item.rglob("*") if item.is_dir() else [item])
    for path in paths:
        if path.is_file() and path.suffix.lower() in {".html", ".css", ".js", ".py"}:
            text = path.read_text(encoding="utf-8", errors="replace").replace("http://www.w3.org/2000/svg", "")
            if pattern.search(text):
                remote.append(str(path.relative_to(ROOT)))
    record("no-network static reference scan", not remote, ", ".join(remote))

    html = (ROOT / "app/index.html").read_text(encoding="utf-8")
    refs = re.findall(r'(?:src|href)="([^"]+)"', html)
    broken = []
    for ref in refs:
        if ref.startswith(("#", "data:", "http:", "https:")):
            continue
        target = (ROOT / "app" / ref).resolve()
        if ROOT.resolve() not in target.parents and target != ROOT.resolve():
            broken.append(ref + " (outside root)")
        elif not target.exists():
            broken.append(ref)
    record("broken-link scan", not broken, ", ".join(broken))

    browser_smoke = (ROOT / "tests/browser_smoke.html").read_text(encoding="utf-8")
    inline_scripts = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>", html + "\n" + browser_smoke, re.I)
    record("CSP-compatible external scripts", not inline_scripts, str(inline_scripts[:4]))

    dialog_source = (ROOT / "app/js/dialogs.js").read_text(encoding="utf-8")
    interaction_sources = "\n".join((ROOT / rel).read_text(encoding="utf-8") for rel in ["app/js/app.js", "app/js/recovery-ui.js"])
    dialog_wired = all(term in dialog_source for term in ["AXMDialog", "askText", "choose", "confirmPhrase", "showModal"])
    record("accessible in-app action dialog", dialog_wired and "prompt(" not in interaction_sources,
           "native prompt removed from governed actions" if dialog_wired and "prompt(" not in interaction_sources else "dialog wiring incomplete or prompt remains")

    server_source = (ROOT / "start_server.py").read_text(encoding="utf-8")
    local_bind = bool(re.search(
        r'ThreadingHTTPServer\(\(\s*"127\.0\.0\.1"\s*,\s*(?:args\.port|port)\s*\)',
        server_source,
    ))
    record("local-only server bind", local_bind)

    core_source = (ROOT / "app/js/core.js").read_text(encoding="utf-8")
    import_guards = all(term in core_source for term in [
        "16_000_000", "__proto__", "prototype", "constructor", "depth > 32", "value.length > 10000",
    ])
    record("workspace/import hardening present", import_guards)


def test_extension_registry_contract() -> None:
    core = (ROOT / "app/js/core.js").read_text(encoding="utf-8")
    app = (ROOT / "app/js/app.js").read_text(encoding="utf-8")
    exporters = (ROOT / "app/js/exporters.js").read_text(encoding="utf-8")
    validators = (ROOT / "app/js/validators.js").read_text(encoding="utf-8")

    separate_registry = all(term in core for term in [
        "extensions: 'axm.visual-foundry.extensions.v0.9'",
        "const CORE_MOLDS", "getAllMolds", "isMoldUsable",
        "extension_state", "QUARANTINED", "ACTIVE", "ARCHIVED",
    ])
    record("separate local extension registry", separate_registry)

    explicit_gate = all(term in core for term in [
        "Candidate must be saved before promotion",
        "explicit-human-button",
        "Candidate requires explicit recorded approval before promotion",
        "Parent extension is not active",
        "release-gate failures",
        "active child extension(s) depend on it",
    ])
    record("explicit extension promotion/activation gate", explicit_gate)

    packet_integrity = all(term in core + exporters for term in [
        "attachPacketIntegrity", "verifyPacketIntegrity",
        "axm.extension-package/0.5", "extension-package",
        "axm.extension-release-gate/0.5", "parent-baseline comparison",
        "integrity fingerprint does not match",
    ])
    record("portable packet integrity contract", packet_integrity)

    ui_wiring = all(term in app for term in [
        "renderExtensions", "promoteCurrentCandidate",
        "importExtensionPackage", "activateExtension",
        "deprecateExtension", "archiveExtension",
        "prepareExtensionRelease", "approveExtension",
    ])
    validator_wiring = all(term in validators for term in [
        "extensionStateCheck", "Extension registry state",
        "protectedChangeAnalysis", "Candidate intent", "releaseGateEvidenceCheck",
    ])
    record("extension UI/validation wiring", ui_wiring and validator_wiring)


def test_local_theme_foundry_contract() -> None:
    core = (ROOT / "app/js/core.js").read_text(encoding="utf-8")
    app = (ROOT / "app/js/app.js").read_text(encoding="utf-8")
    html = (ROOT / "app/index.html").read_text(encoding="utf-8")
    validators = (ROOT / "app/js/validators.js").read_text(encoding="utf-8")

    registry = all(term in core for term in [
        "themes: 'axm.visual-foundry.themes.v0.9'", "const CORE_THEMES",
        "getLocalThemes", "getAllThemes", "variantValues", "themeCompatibleWithMold",
        "QUARANTINED", "ACTIVE", "DEPRECATED", "ARCHIVED",
    ])
    record("separate local theme registry", registry)

    governance = all(term in core for term in [
        "themeValidation", "buildThemeDraft", "saveThemeDraft", "approveTheme",
        "activateTheme", "deprecateTheme", "archiveTheme",
        "Theme requires explicit approval before activation",
        "active extension(s) depend on it", "active child theme(s) depend on it",
        "Declarative-only boundary", "remote_asset", "font_file",
    ])
    record("theme governance/dependency contract", governance)

    packet = all(term in core for term in [
        "axm.theme-package/0.5", "exportThemePackage", "importThemePackage",
        "Theme package integrity fingerprint does not match",
    ])
    ui = all(term in app + html for term in [
        "renderThemes", "themeBuildDraft", "themeValidateDraft", "themeSaveDraft",
        "themeImportButton", "themeManifest", "localThemeGrid",
    ])
    validator = all(term in validators for term in [
        "themeCompatibleWithMold", "isThemeUsable", "Theme contract",
    ])
    record("theme packet/UI/validator wiring", packet and ui and validator)


def test_project_and_batch_contract() -> None:
    assembly = (ROOT / "app/js/assembly.js").read_text(encoding="utf-8")
    ui = (ROOT / "app/js/assembly-ui.js").read_text(encoding="utf-8")
    html = (ROOT / "app/index.html").read_text(encoding="utf-8")

    project_contract = all(term in assembly for term in [
        "axm.visual-project/0.6", "projectValidation", "projectRevision",
        "approveProject", "archiveProject", "restoreProjectRevision",
        "axm.visual-project-package/0.6", "importProjectPackage",
        "projectHTML", "APPROVED", "ARCHIVED",
    ])
    record("visual project lifecycle/package contract", project_contract)

    batch_contract = all(term in assembly for term in [
        "axm.data-batch/0.6", "parseDelimited", "parseBatchSource",
        "inferBatchMapping", "materializeBatch", "batchValidation",
        "axm.data-batch-package/0.6", "importBatchPackage",
        "projectFromBatch", "Remote or executable-looking values",
        "semicolon", "truncated_count", "Intake transparency",
        "unclosed quoted field", "Mapped columns are missing",
    ])
    record("data batch intake/materialization contract", batch_contract)

    no_silent_loss = all(term in assembly for term in [
        "total_rows", "accepted_rows", "truncated_count", "approval is blocked",
        "MAX_ROWS=100", "MAX_DEPENDENCIES=100", "renamed_headers",
    ])
    record("data batch no-silent-loss contract", no_silent_loss)

    portability = all(term in assembly for term in [
        "verifyPacketIntegrity", "importDependencyRecords", "themeMap",
        "extensionMap", "axm.visual-workspace/0.6", "Workspace assembly import",
        "projects=getProjects", "batches=getBatches",
    ])
    record("project/batch workspace portability", portability)

    ui_contract = all(term in ui + html for term in [
        "Project Composer", "Data Batch Builder", "renderProjects", "renderBatches",
        "projectAddCurrentButton", "projectExportHTMLButton", "batchParseButton",
        "batchToProjectButton", "batchSourceFileButton", "batchSourceFileInput",
        "editorAddToProjectButton",
    ])
    record("project/batch UI wiring", ui_contract)


def test_recovery_center_contract() -> None:
    core = (ROOT / "app/js/core.js").read_text(encoding="utf-8")
    recovery = (ROOT / "app/js/recovery.js").read_text(encoding="utf-8")
    recovery_ui = (ROOT / "app/js/recovery-ui.js").read_text(encoding="utf-8")
    html = (ROOT / "app/index.html").read_text(encoding="utf-8")
    storage_contract = all(term in core for term in [
        "recovery: 'axm.visual-foundry.recovery.v0.9'",
        "transactions: 'axm.visual-foundry.transactions.v0.9'",
        "rescue: 'axm.visual-foundry.rescue.v0.9'",
        "recordStorageIssue", "Original browser storage value remains untouched",
        "version: 'v0.7'",
    ])
    record("recovery storage preservation and v0.7 migration contract", storage_contract)
    transaction_contract = all(term in recovery for term in [
        "withStorageTransaction", "restoreRawSnapshot", "restoreState",
        "status:'ROLLBACK'", "status:'COMMIT'", "transactionNames",
    ])
    record("transactional import rollback contract", transaction_contract)
    inspector_contract = all(term in recovery for term in [
        "inspectPacket", "importInspectedPacket", "axm.package-inspection/0.8",
        "Packet integrity", "Content boundary", "axm.safety-capsule/0.8",
    ])
    record("package inspector and safety capsule contract", inspector_contract)
    restore_contract = all(term in recovery for term in [
        "stageSafetyCapsule", "restoreStagedCapsule", "validateRawEntry",
        "createRescuePoint", "restoreRescuePoint", "RESCUE_LIMIT=5",
        "exact confirmation word RESTORE", "axm.rescue-point/0.8",
    ])
    record("staged capsule and rescue-ring restore contract", restore_contract)
    readiness_contract = all(term in recovery for term in [
        "intakeReadinessReport", "READY_WITH_LOCAL_VALIDATION", "BLOCKED",
        "Active extension release evidence", "Target browser visual check",
        "axm.local-intake-handoff/0.8", "exportIntakeHandoffPacket",
    ])
    record("intake readiness and local handoff contract", readiness_contract)
    ui_contract = all(term in recovery_ui + html for term in [
        "Recovery + Intake", "recoveryStorageList", "packageInspectorReport",
        "onboardingChecklist", "Export safety capsule", "RESET", "RESTORE",
        "capsuleStageReport", "rescuePointList", "readinessReport",
    ])
    record("recovery, restore, intake, and first-run UI wiring", ui_contract)


def test_batch_examples() -> None:
    comma = (ROOT / "examples/batch_comma.csv").read_text(encoding="utf-8")
    semicolon = (ROOT / "examples/batch_semicolon.csv").read_text(encoding="utf-8")
    rows = read_json("examples/batch_rows.json")
    ok = (
        comma.startswith("title,message,badge")
        and semicolon.startswith("title;message;badge")
        and '"Puntkomma-bestand; lokaal verwerkt"' in semicolon
        and isinstance(rows, list) and len(rows) >= 2
        and all(isinstance(row, dict) and row.get("title") for row in rows)
    )
    record("batch example assets", ok,
           f"comma_lines={len(comma.splitlines())}, semicolon_lines={len(semicolon.splitlines())}, json_rows={len(rows) if isinstance(rows, list) else 0}")


def test_adapter_scaffolds() -> None:
    errors = []
    for target in ["blender", "godot", "comfyui", "unity", "unreal", "materialx"]:
        data = read_json(f"registry/adapters/{target}.json")
        if (
            data.get("status") != "LOCAL VALIDATION REQUIRED"
            or data.get("visual_parity_claim") is not False
            or not data.get("maps")
        ):
            errors.append(target)
        if not (ROOT / f"runtimes/{target}/README.md").is_file():
            errors.append(target + "-readme")
    record("adapter scaffolds", not errors, ", ".join(errors))


def test_launch_diagnostics() -> None:
    proc = subprocess.run(
        [sys.executable, str(ROOT / "start_server.py"), "--diagnose"],
        capture_output=True, text=True, timeout=15,
    )
    output = (proc.stdout + proc.stderr).strip()
    ok = proc.returncode == 0 and "Critical files: PASS" in output and "Registry JSON: PASS" in output and "SHA-256 manifest: PASS" in output and "127.0.0.1 only" in output
    record("launch diagnostics", ok, output.replace("\n", " · ")[-500:])


def run_captured_process(command: list[str], timeout: float = 10) -> tuple[int, str, bool]:
    proc = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    timed_out = False
    try:
        output, _ = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        proc.kill()
        output, _ = proc.communicate(timeout=2)
    return proc.returncode, output, timed_out


def stop_process(proc: subprocess.Popen[str]) -> None:
    if proc.poll() is None:
        proc.terminate()
    try:
        proc.wait(timeout=3)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=2)


def test_server_http_smoke() -> None:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    proc = subprocess.Popen(
        [sys.executable, str(ROOT / "start_server.py"), "--no-browser", "--port", str(port)],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    ok = False
    detail = ""
    server_ready = False
    bad_host_ok = False
    bad_host_detail = "primary AXM server did not become ready"
    reuse_ok = False
    reuse_detail = "primary AXM server did not become ready"
    try:
        for _ in range(30):
            time.sleep(0.1)
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/app/index.html", timeout=1.5) as response:
                    text = response.read().decode("utf-8")
                    csp = response.headers.get("Content-Security-Policy", "")
                    permissions = response.headers.get("Permissions-Policy", "")
                    server_ready = response.status == 200
                    ok = (
                        "AXM Visual Mold Foundry v0.9" in text
                        and response.headers.get("X-Content-Type-Options") == "nosniff"
                        and response.headers.get("Cross-Origin-Resource-Policy") == "same-origin"
                        and response.headers.get("Cross-Origin-Opener-Policy") == "same-origin"
                        and "connect-src 'none'" in csp
                        and "camera=()" in permissions
                    )
                    detail = f"HTTP {response.status}, {len(text)} bytes, strict local headers present"
                    break
            except Exception:
                if proc.poll() is not None:
                    detail = (proc.stdout.read() if proc.stdout else "server exited")[-500:]
                    break
        if not ok and not detail:
            detail = "local server did not answer within 3 seconds"

        if server_ready:
            connection = http.client.HTTPConnection("127.0.0.1", port, timeout=2)
            try:
                connection.request(
                    "GET",
                    "/app/index.html",
                    headers={"Host": "non-local.invalid", "Connection": "close"},
                )
                response = connection.getresponse()
                body = response.read().decode("utf-8", errors="replace")
                bad_host_ok = response.status == 421 and "Local Host header required" in body
                bad_host_detail = f"HTTP {response.status}; local-only Host policy enforced"
            except Exception as exc:
                bad_host_detail = f"Host-boundary request failed: {exc}"
            finally:
                connection.close()

            second_code, second_output, second_timed_out = run_captured_process(
                [sys.executable, str(ROOT / "start_server.py"), "--no-browser", "--port", str(port)],
                timeout=10,
            )
            expected_url = f"http://127.0.0.1:{port}/app/index.html"
            reuse_ok = (
                not second_timed_out
                and second_code == 0
                and expected_url in second_output
                and "reusing the same browser-storage origin" in second_output
                and proc.poll() is None
            )
            reuse_detail = (
                f"exit={second_code}; reused {expected_url}"
                if reuse_ok
                else f"exit={second_code}, timeout={second_timed_out}: {second_output[-500:]}"
            )
    finally:
        stop_process(proc)
    record("local server HTTP smoke", ok, detail)
    record("non-local Host rejection", bad_host_ok, bad_host_detail)
    record("same-port AXM reuse", reuse_ok, reuse_detail)


def test_foreign_port_collision_refusal() -> None:
    class ForeignHandler(http.server.BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 - stdlib handler API
            payload = b"foreign listener"
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *args) -> None:
            pass

    foreign = http.server.ThreadingHTTPServer(("127.0.0.1", 0), ForeignHandler)
    foreign.daemon_threads = True
    port = foreign.server_address[1]
    thread = threading.Thread(target=foreign.serve_forever, daemon=True)
    thread.start()
    ok = False
    detail = ""
    try:
        code, output, timed_out = run_captured_process(
            [sys.executable, str(ROOT / "start_server.py"), "--no-browser", "--port", str(port)],
            timeout=10,
        )
        ok = (
            not timed_out
            and code == 3
            and f"port {port} is already in use by another process" in output
            and "did not switch ports" in output
            and "AXM Visual Mold Foundry v0.9.1 — LOCAL ONLY" not in output
            and "Open:" not in output
        )
        detail = (
            f"exit={code}; exact port {port} refused without fallback"
            if ok
            else f"exit={code}, timeout={timed_out}: {output[-500:]}"
        )
    except Exception as exc:
        detail = str(exc)
    finally:
        foreign.shutdown()
        foreign.server_close()
        thread.join(timeout=2)
    record("foreign-port collision refusal", ok, detail)


def test_node_smoke() -> None:
    node = shutil.which("node")
    if not node:
        skip("JavaScript functional smoke", "Node.js unavailable")
        return
    for js_path in sorted((ROOT / "app" / "js").glob("*.js")):
        proc = subprocess.run([node, "--check", str(js_path)], capture_output=True, text=True)
        if proc.returncode != 0:
            record("JavaScript syntax", False, f"{js_path.name}: {proc.stderr[-300:]}")
            return
    record("JavaScript syntax", True, "all app modules")
    proc = subprocess.run(
        [node, str(ROOT / "tests" / "node_smoke.js")],
        capture_output=True, text=True, timeout=30,
    )
    detail = (proc.stdout[-900:] or proc.stderr[-900:]).replace("\n", " ")
    record("JavaScript functional smoke", proc.returncode == 0 and '"status": "PASS"' in proc.stdout, detail)

    dialog_proc = subprocess.run(
        [node, str(ROOT / "tests" / "dialog_smoke.js")],
        capture_output=True, text=True, timeout=15,
    )
    dialog_detail = (dialog_proc.stdout[-600:] or dialog_proc.stderr[-600:]).replace("\n", " ")
    record("action dialog functional smoke", dialog_proc.returncode == 0 and '"status": "PASS"' in dialog_proc.stdout, dialog_detail)


def serve_and_browse() -> None:
    chromium = shutil.which("chromium") or shutil.which("chromium-browser") or shutil.which("google-chrome")
    if not chromium:
        skip("browser functional smoke", "Chromium not installed; run locally on target browser")
        return
    try:
        probe = subprocess.run(
            [chromium, "--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
             "--dump-dom", "data:text/html,<html><body>AXM</body></html>"],
            capture_output=True, text=True, timeout=5,
        )
    except subprocess.TimeoutExpired:
        skip("browser functional smoke", "Installed Chromium cannot start headless in this container; target-browser validation required")
        return
    if probe.returncode != 0 or "AXM" not in probe.stdout:
        skip("browser functional smoke", "Installed Chromium headless probe unavailable; target-browser validation required")
        return

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), partial(Quiet, directory=str(ROOT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        time.sleep(0.15)
        smoke_url = f"http://127.0.0.1:{port}/tests/browser_smoke.html"
        proc = subprocess.run(
            [chromium, "--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
             "--virtual-time-budget=5000", "--dump-dom", smoke_url],
            capture_output=True, text=True, timeout=20,
        )
        passed = 'data-test-status="PASS"' in proc.stdout and '"status": "PASS"' in proc.stdout
        record("browser functional smoke", passed,
               "Read-only browser smoke reported PASS" if passed else (proc.stderr[-700:] or proc.stdout[-700:]))
    except Exception as exc:
        record("browser functional smoke", False, str(exc))
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def test_hash_manifest() -> None:
    path = ROOT / "FILE_MANIFEST_SHA256.txt"
    if not path.is_file():
        record("hash verification", False, "manifest missing")
        return
    errors = []
    checked = 0
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        try:
            expected, rel = line.split("  ", 1)
        except ValueError:
            errors.append(f"bad line: {line}")
            continue
        file_path = ROOT / rel
        if not file_path.is_file():
            errors.append(f"missing {rel}")
            continue
        actual = hashlib.sha256(file_path.read_bytes()).hexdigest()
        checked += 1
        if actual != expected:
            errors.append(f"mismatch {rel}")
    record("hash verification", not errors and checked > 0,
           f"{checked} files" if not errors else "; ".join(errors[:8]))


def main() -> int:
    print("AXM Visual Mold Foundry v0.9.1 — self-check\n")
    test_required_files()
    test_json_and_registries()
    test_sparse_inheritance()
    test_library_expansion_and_layouts()
    test_theme_contracts()
    test_dom_contract()
    test_lineage_and_protection()
    test_static_security_and_links()
    test_extension_registry_contract()
    test_local_theme_foundry_contract()
    test_project_and_batch_contract()
    test_recovery_center_contract()
    test_batch_examples()
    test_adapter_scaffolds()
    test_launch_diagnostics()
    test_server_http_smoke()
    test_foreign_port_collision_refusal()
    test_node_smoke()
    serve_and_browse()
    test_hash_manifest()
    print(f"\nRESULT: {'PASS' if FAIL == 0 else 'FAIL'} — {PASS} passed, {FAIL} failed, {SKIP} skipped")
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
