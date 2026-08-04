from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import difflib
import hashlib
import html
import json
import re
import shutil
from typing import Iterable, Sequence

from .static_assets import write_portable_bundle
from .layout import build_pseudolocale_samples

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
COMPILER_VERSION = "1.0.0"


@dataclass(frozen=True)
class ResolvedTarget:
    target_id: str
    target_kind: str
    source: dict
    plan: dict


def _write_json(path: Path, value: object, pretty: bool = True) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2 if pretty else None, ensure_ascii=False) + "\n", encoding="utf-8")


def _write_text(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value, encoding="utf-8")


def _slug(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", str(value)).strip("_")
    return cleaned or "AXMTextPreset"


def _class_name(value: str) -> str:
    parts = [part for part in re.split(r"[^a-zA-Z0-9]+", str(value)) if part]
    name = "".join(part[:1].upper() + part[1:] for part in parts) or "AXMTextPreset"
    if name[0].isdigit():
        name = "AXM" + name
    return name


def _web_css(variables: dict, class_name: str = ".axm-text-compiled") -> str:
    lines = [f"{class_name} {{"]
    for key, value in variables.items():
        lines.append(f"  {key}: {value};")
    lines.append("}")
    return "\n".join(lines) + "\n"


def _hash_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _hash_files(root: Path, ignored: set[str] | None = None) -> dict[str, str]:
    ignored = ignored or {"bundle_manifest.json", "library_manifest.json"}
    hashes: dict[str, str] = {}
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.name not in ignored:
            hashes[path.relative_to(root).as_posix()] = _hash_file(path)
    return hashes


def _safe_output_root(output_dir: str | Path, force: bool) -> Path:
    root = Path(output_dir)
    if root.exists() and any(root.iterdir()):
        if not force:
            raise FileExistsError(f"Output directory is not empty: {root}")
        shutil.rmtree(root)
    root.mkdir(parents=True, exist_ok=True)
    return root


def _color_rgba(color: str | None, fallback: tuple[float, float, float, float] = (1, 1, 1, 1)) -> tuple[float, float, float, float]:
    raw = str(color or "").strip()
    if re.fullmatch(r"#[0-9a-fA-F]{6}", raw):
        return tuple(int(raw[i:i+2], 16) / 255 for i in (1, 3, 5)) + (1.0,)
    if re.fullmatch(r"#[0-9a-fA-F]{3}", raw):
        return tuple(int(raw[i] * 2, 16) / 255 for i in (1, 2, 3)) + (1.0,)
    match = re.fullmatch(r"rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)", raw, re.I)
    if match:
        r, g, b, a = match.groups()
        return float(r) / 255, float(g) / 255, float(b) / 255, float(a if a is not None else 1)
    return fallback


def _float_literal(value: float) -> str:
    return f"{float(value):.6f}f"


def _unity_color(value: str | None) -> str:
    r, g, b, a = _color_rgba(value)
    return f"new Color({_float_literal(r)}, {_float_literal(g)}, {_float_literal(b)}, {_float_literal(a)})"


def _unreal_color(value: str | None) -> str:
    r, g, b, a = _color_rgba(value)
    return f"FLinearColor({_float_literal(r)}, {_float_literal(g)}, {_float_literal(b)}, {_float_literal(a)})"


def _material_parameters(plan: dict) -> dict:
    resolved = plan["resolved"]
    effects = resolved.get("effects", {})
    gradient = resolved.get("gradient") or [resolved.get("fill", "#FFFFFF")]
    if not isinstance(gradient, list):
        gradient = [resolved.get("fill", "#FFFFFF")]
    top = gradient[0]
    mid = gradient[len(gradient) // 2]
    bottom = gradient[-1]
    return {
        "target_id": plan.get("preset_id") or plan.get("target_id") or resolved.get("recipe"),
        "recipe": resolved.get("recipe"),
        "material": resolved.get("material"),
        "quality_tier": resolved.get("quality_tier"),
        "base_color": resolved.get("fill", "#FFFFFF"),
        "gradient_top": top,
        "gradient_mid": mid,
        "gradient_bottom": bottom,
        "outline_color": effects.get("outline", {}).get("color", "transparent"),
        "outline_width": effects.get("outline", {}).get("width_px", 0),
        "glow_color": effects.get("glow", {}).get("color", "transparent"),
        "glow_power": effects.get("glow", {}).get("opacity", 0),
        "glow_blur_px": effects.get("glow", {}).get("blur_px", 0),
        "bevel_light": effects.get("bevel", {}).get("light", "transparent"),
        "bevel_dark": effects.get("bevel", {}).get("dark", "transparent"),
        "sheen_color": effects.get("sheen", {}).get("color", "transparent"),
        "sheen_opacity": effects.get("sheen", {}).get("intensity_multiplier", 0) if effects.get("sheen", {}).get("enabled") else 0,
        "sheen_angle": effects.get("sheen", {}).get("angle_deg", 0),
        "glitch_red": effects.get("glitch", {}).get("red", "transparent"),
        "glitch_cyan": effects.get("glitch", {}).get("cyan", "transparent"),
        "glitch_offset": effects.get("glitch", {}).get("offset_px", 0),
        "glitch_intensity": effects.get("glitch", {}).get("intensity", 0),
        "scanline_opacity": effects.get("glitch", {}).get("scanline_opacity", 0),
        "motion": resolved.get("motion", "none"),
        "font_size": resolved.get("size_px"),
        "font_weight": resolved.get("weight"),
        "letter_spacing_em": resolved.get("tracking_em"),
        "rendering_strategy": resolved.get("rendering_strategy"),
        "render_budget": resolved.get("render_budget", {}),
    }


def _suggest_target(engine, target_id: str) -> str:
    choices = list(engine.presets) + list(engine.recipes)
    matches = difflib.get_close_matches(target_id, choices, n=5, cutoff=0.35)
    return f" Did you mean: {', '.join(matches)}?" if matches else ""


def resolve_target(engine, target_id: str, overrides: dict | None = None) -> ResolvedTarget:
    overrides = dict(overrides or {})
    if target_id in engine.presets:
        plan = engine.resolve_preset(target_id, overrides or None)
        plan["target_id"] = target_id
        plan["target_kind"] = "preset"
        return ResolvedTarget(target_id, "preset", dict(engine.presets[target_id]), plan)
    if target_id in engine.recipes:
        recipe = dict(engine.recipes[target_id])
        roles = recipe.get("recommended_roles") or ["display"]
        request = {
            "text": recipe.get("label", target_id),
            "role": roles[0],
            "recipe": target_id,
            "platform": "web",
            "background": "dynamic" if recipe.get("plate", {}).get("type") != "solid" else "solid",
            "importance": "high" if roles[0] in {"display", "game_reward_title"} else "normal",
            "quality_tier": "balanced",
        }
        request.update(overrides)
        plan = engine.resolve(request)
        plan["target_id"] = target_id
        plan["target_kind"] = "recipe"
        return ResolvedTarget(target_id, "recipe", recipe, plan)
    raise KeyError(f"Unknown preset or recipe '{target_id}'." + _suggest_target(engine, target_id))


def _copy(path_from: Path, path_to: Path) -> None:
    path_to.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path_from, path_to)


def _write_web_export(platform_dir: Path, plan: dict) -> None:
    adapter = plan.get("adapter", {})
    variables = adapter.get("variables", {})
    _write_text(platform_dir / "axm-text-compiled.css", _web_css(variables))
    _copy(PACKAGE_ROOT / "adapters/web/axm-text.css", platform_dir / "axm-text-runtime.css")
    text = html.escape(str(plan["request"].get("text", "AXM Text")))
    glitch_class = " axm-glitch" if plan["resolved"].get("effects", {}).get("glitch", {}).get("enabled") else ""
    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="axm-text-runtime.css">
<link rel="stylesheet" href="axm-text-compiled.css">
<title>AXM compiled text preview</title>
<style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#05070b;padding:24px}}</style>
</head>
<body>
<span class="axm-text-plate"><span class="axm-text axm-text-compiled{glitch_class}">{text}</span></span>
</body>
</html>
"""
    _write_text(platform_dir / "index.html", page)
    _write_text(platform_dir / "README_IMPORT.md", """# Web import

Copy these three files together:
- `axm-text-runtime.css`
- `axm-text-compiled.css`
- `index.html` as a reference snippet

Use the `axm-text-plate` wrapper so blur and opacity do not soften the glyph core.
""")


def _write_unity_export(platform_dir: Path, plan: dict, params: dict) -> None:
    scripts = platform_dir / "Assets/AXMTextFabric/Scripts"
    for name in ("AXMTextFxProfile.cs", "AXMTextFxApplier.cs", "AXMTextStyleApplier.cs"):
        _copy(PACKAGE_ROOT / "adapters/unity" / name, scripts / name)
    class_name = _class_name(params["target_id"]) + "AXMTextPreset"
    generated = f"""using UnityEngine;
using AXM.TextFabric;

namespace AXM.TextFabric.Generated
{{
    public static class {class_name}
    {{
        public const string TargetId = {json.dumps(str(params['target_id']))};
        public const string Recipe = {json.dumps(str(params['recipe']))};

        public static void Apply(AXMTextFxProfile profile)
        {{
            if (profile == null) return;
            profile.Recipe = Recipe;
            profile.BaseColor = {_unity_color(params['base_color'])};
            profile.GradientTop = {_unity_color(params['gradient_top'])};
            profile.GradientMid = {_unity_color(params['gradient_mid'])};
            profile.GradientBottom = {_unity_color(params['gradient_bottom'])};
            profile.OutlineColor = {_unity_color(params['outline_color'])};
            profile.OutlineWidth = {_float_literal(params['outline_width'])};
            profile.GlowColor = {_unity_color(params['glow_color'])};
            profile.GlowPower = {_float_literal(params['glow_power'])};
            profile.BevelLight = {_unity_color(params['bevel_light'])};
            profile.BevelDark = {_unity_color(params['bevel_dark'])};
            profile.SheenColor = {_unity_color(params['sheen_color'])};
            profile.SheenOpacity = {_float_literal(params['sheen_opacity'])};
            profile.SheenAngle = {_float_literal(params['sheen_angle'])};
            profile.GlitchRed = {_unity_color(params['glitch_red'])};
            profile.GlitchCyan = {_unity_color(params['glitch_cyan'])};
            profile.GlitchOffset = {_float_literal(params['glitch_offset'])};
            profile.GlitchIntensity = {_float_literal(params['glitch_intensity'])};
            profile.ScanlineOpacity = {_float_literal(params['scanline_opacity'])};
        }}
    }}
}}
"""
    _write_text(scripts / f"{class_name}.cs", generated)
    _write_json(platform_dir / "material_parameters.json", params)
    _write_text(platform_dir / "README_IMPORT.md", f"""# Unity import

1. Copy the `Assets` folder into the Unity project.
2. Create an `AXMTextFxProfile` asset through **Create → AXM → Text FX Profile**.
3. Call `{class_name}.Apply(profile)` once in an editor utility or setup script.
4. Attach `AXMTextFxApplier` to a TextMeshPro object and assign the profile.
5. Keep the base TMP face readable when custom shader properties are zero.

The generated C# file contains the resolved parameters for `{params['target_id']}`.
""")


def _write_unreal_export(platform_dir: Path, plan: dict, params: dict) -> None:
    public = platform_dir / "Source/AXMTextFabric/Public"
    for name in ("AXMTextStyle.h", "AXMTextMaterialStyle.h"):
        _copy(PACKAGE_ROOT / "adapters/unreal" / name, public / name)
    struct_name = "FAXM" + _class_name(params["target_id"]) + "Preset"
    header = f"""#pragma once

#include "CoreMinimal.h"
#include "Materials/MaterialInstanceDynamic.h"

struct {struct_name}
{{
    static constexpr const TCHAR* TargetId = TEXT({json.dumps(str(params['target_id']))});
    static constexpr const TCHAR* Recipe = TEXT({json.dumps(str(params['recipe']))});

    static void Apply(UMaterialInstanceDynamic* Material)
    {{
        if (!Material) return;
        Material->SetVectorParameterValue(TEXT("BaseColor"), {_unreal_color(params['base_color'])});
        Material->SetVectorParameterValue(TEXT("GradientTop"), {_unreal_color(params['gradient_top'])});
        Material->SetVectorParameterValue(TEXT("GradientMid"), {_unreal_color(params['gradient_mid'])});
        Material->SetVectorParameterValue(TEXT("GradientBottom"), {_unreal_color(params['gradient_bottom'])});
        Material->SetVectorParameterValue(TEXT("OutlineColor"), {_unreal_color(params['outline_color'])});
        Material->SetScalarParameterValue(TEXT("OutlineWidth"), {_float_literal(params['outline_width'])});
        Material->SetVectorParameterValue(TEXT("GlowColor"), {_unreal_color(params['glow_color'])});
        Material->SetScalarParameterValue(TEXT("GlowPower"), {_float_literal(params['glow_power'])});
        Material->SetScalarParameterValue(TEXT("SheenOpacity"), {_float_literal(params['sheen_opacity'])});
        Material->SetScalarParameterValue(TEXT("SheenAngle"), {_float_literal(params['sheen_angle'])});
        Material->SetVectorParameterValue(TEXT("GlitchRed"), {_unreal_color(params['glitch_red'])});
        Material->SetVectorParameterValue(TEXT("GlitchCyan"), {_unreal_color(params['glitch_cyan'])});
        Material->SetScalarParameterValue(TEXT("GlitchOffset"), {_float_literal(params['glitch_offset'])});
        Material->SetScalarParameterValue(TEXT("GlitchIntensity"), {_float_literal(params['glitch_intensity'])});
        Material->SetScalarParameterValue(TEXT("ScanlineOpacity"), {_float_literal(params['scanline_opacity'])});
    }}
}};
"""
    _write_text(public / f"{struct_name}.h", header)
    _write_json(platform_dir / "material_parameters.json", params)
    _copy(PACKAGE_ROOT / "adapters/unreal/AXM_UMG_MATERIAL_NOTES.md", platform_dir / "AXM_UMG_MATERIAL_NOTES.md")
    _write_text(platform_dir / "README_IMPORT.md", f"""# Unreal import

1. Copy `Source/AXMTextFabric/Public` into an Unreal module or plugin.
2. Create a UI material exposing the parameter names listed in `material_parameters.json`.
3. Create a dynamic material instance.
4. Call `{struct_name}::Apply(MaterialInstance)`.
5. Bind the material to the UMG display-text surface.

The generated header is a parameter application hand, not a full Unreal plugin module.
""")


def _godot_color(value: str | None) -> str:
    r, g, b, a = _color_rgba(value)
    return f"Color({r:.6f}, {g:.6f}, {b:.6f}, {a:.6f})"


def _write_godot_export(platform_dir: Path, plan: dict, params: dict) -> None:
    addon = platform_dir / "addons/axm_text_fabric"
    for name in ("AXMTextFxResource.gd", "AXMTextRole.gd", "axm_text_fx.gdshader"):
        _copy(PACKAGE_ROOT / "adapters/godot" / name, addon / name)
    setup = f"""extends Node

const TARGET_ID := {json.dumps(str(params['target_id']))}
const RECIPE := {json.dumps(str(params['recipe']))}

func apply_to(canvas_item: CanvasItem) -> void:
    if canvas_item == null:
        return
    var shader := load("res://addons/axm_text_fabric/axm_text_fx.gdshader")
    var material := ShaderMaterial.new()
    material.shader = shader
    material.set_shader_parameter("base_color", {_godot_color(params['base_color'])})
    material.set_shader_parameter("glow_color", {_godot_color(params['glow_color'])})
    material.set_shader_parameter("glow_power", {float(params['glow_power']):.6f})
    material.set_shader_parameter("glitch_red", {_godot_color(params['glitch_red'])})
    material.set_shader_parameter("glitch_cyan", {_godot_color(params['glitch_cyan'])})
    material.set_shader_parameter("glitch_offset_px", {float(params['glitch_offset']):.6f})
    material.set_shader_parameter("glitch_intensity", {float(params['glitch_intensity']):.6f})
    material.set_shader_parameter("scanline_opacity", {float(params['scanline_opacity']):.6f})
    canvas_item.material = material
"""
    _write_text(addon / f"apply_{_slug(params['target_id']).lower()}.gd", setup)
    _write_json(platform_dir / "material_parameters.json", params)
    _write_text(platform_dir / "README_IMPORT.md", f"""# Godot import

1. Copy the `addons` folder into the project root.
2. Add the generated `apply_{_slug(params['target_id']).lower()}.gd` script to a setup node or copy its `apply_to` logic.
3. Pass the target Label, RichTextLabel, or other CanvasItem.
4. Keep outline and font fallback configuration in the Theme / Label layer.

The shader provides a restrained premium overlay and leaves the readable glyph core intact.
""")


def _write_generic_export(platform_dir: Path, platform: str, plan: dict, params: dict) -> None:
    _write_json(platform_dir / "material_parameters.json", params)
    _write_text(platform_dir / "README_IMPORT.md", f"""# {platform} import guidance

This target currently uses the generic adapter handoff.
Use `material_parameters.json` as the stable contract and keep dense text on the native text renderer.
Premium effects are intended for headers, banners, rewards, and HUD emphasis.
""")


def _write_source_snapshot(root: Path, target: ResolvedTarget, plan: dict) -> None:
    snapshot = root / "source_snapshot"
    _write_json(snapshot / f"{target.target_kind}.json", target.source)
    recipe_id = plan["resolved"].get("recipe")
    if recipe_id:
        recipe = target.source if target.target_kind == "recipe" else None
        if recipe is None:
            recipe_path = PACKAGE_ROOT / "recipes" / f"{recipe_id}.json"
            if recipe_path.exists():
                recipe = json.loads(recipe_path.read_text(encoding="utf-8"))
        if recipe is not None:
            _write_json(snapshot / "recipe.json", recipe)
    request_snapshot = dict(plan.get("request", {}))
    if request_snapshot.get("font_file"):
        audit = plan.get("resolved", {}).get("font_file_audit") or {}
        font = audit.get("font", {})
        request_snapshot["font_file"] = "<local-font-not-bundled>"
        request_snapshot["font_file_name"] = font.get("file_name")
        request_snapshot["font_file_sha256"] = font.get("sha256")
    if request_snapshot.get("font_registry"):
        stack_plan = plan.get("resolved", {}).get("font_stack_plan") or {}
        request_snapshot["font_registry"] = "<local-font-registry-not-bundled>"
        request_snapshot["font_registry_sha256"] = stack_plan.get("registry_sha256")
    _write_json(snapshot / "request.json", request_snapshot)


def compile_target_bundle(engine, target_id: str, output_dir: str | Path, platforms: Iterable[str], quality_tier: str = "balanced", force: bool = False, pretty: bool = True, overrides: dict | None = None) -> Path:
    root = _safe_output_root(output_dir, force)
    requested: list[str] = []
    for platform in platforms:
        platform = str(platform).strip().lower()
        if platform and platform not in requested:
            requested.append(platform)
    if not requested:
        requested = ["web"]

    base_overrides = dict(overrides or {})
    target = resolve_target(engine, target_id, base_overrides)
    platform_plans: dict[str, dict] = {}

    for platform in requested:
        platform_overrides = dict(base_overrides)
        platform_overrides.update({"platform": platform, "quality_tier": quality_tier})
        current = resolve_target(engine, target_id, platform_overrides)
        plan = current.plan
        platform_plans[platform] = plan
        platform_dir = root / platform
        _write_json(platform_dir / "resolved_plan.json", plan, pretty)
        _write_json(platform_dir / "adapter.json", plan.get("adapter", {}), pretty)
        params = _material_parameters(plan)
        if platform == "web" or plan.get("adapter", {}).get("kind") == "web_css_variables":
            _write_web_export(platform_dir, plan)
        elif platform == "unity":
            _write_unity_export(platform_dir, plan, params)
        elif platform in {"unreal", "ue", "ue5"}:
            _write_unreal_export(platform_dir, plan, params)
        elif platform == "godot":
            _write_godot_export(platform_dir, plan, params)
        else:
            _write_generic_export(platform_dir, platform, plan, params)

    representative = platform_plans[requested[0]]
    _write_source_snapshot(root, target, representative)
    font_audit = representative.get("resolved", {}).get("font_file_audit")
    if font_audit:
        _write_json(root / "font_audit.json", font_audit, True)
    font_stack_plan = representative.get("resolved", {}).get("font_stack_plan")
    if font_stack_plan:
        portable_plan = dict(font_stack_plan)
        if portable_plan.get("registry_source"):
            portable_plan["registry_source"] = "<local-font-registry-not-bundled>"
        _write_json(root / "font_stack_plan.json", portable_plan, True)
    layout_audit = representative.get("resolved", {}).get("layout_audit")
    if layout_audit:
        _write_json(root / "layout_audit.json", layout_audit, True)
        expansion = representative.get("request", {}).get("localization_expansion", 0.35)
        _write_json(root / "pseudolocale_samples.json", build_pseudolocale_samples(representative.get("request", {}).get("text", ""), expansion), True)
    write_portable_bundle(root, representative, target_id)
    source_hashes = _hash_files(root / "source_snapshot", ignored=set())
    lock = {
        "id": "axm.text.bundle_lock",
        "version": COMPILER_VERSION,
        "target_id": target_id,
        "target_kind": target.target_kind,
        "quality_tier": quality_tier,
        "platforms": requested,
        "source_hashes": source_hashes,
    }
    _write_json(root / "AXM_TEXT_LOCK.json", lock, True)
    _write_text(root / "INSTALL.md", """# AXM Text compiled bundle

Open the folder for your target platform and follow `README_IMPORT.md`.
Every platform also includes the resolved plan and adapter contract.

The `portable` directory contains a standalone SVG fallback and preview.

The root `layout_audit.json` and `pseudolocale_samples.json` files document overflow, expansion, RTL, and safe-area stress.

The `source_snapshot` directory preserves the exact preset/recipe and request used for regeneration.
""")
    _write_text(root / "ROLLBACK.md", """# Rollback

This bundle is generated and contains no canonical source mutation.

Rollback options:
1. Delete the compiled bundle and use the prior generated bundle.
2. Recompile from `source_snapshot` or the original AXM Text Fabric package.
3. Verify integrity with `python -m axm_text_fabric.cli verify-bundle <bundle>` before intake.
""")

    manifest = {
        "id": "axm.text.compiled_bundle",
        "version": COMPILER_VERSION,
        "compiler_version": COMPILER_VERSION,
        "target_id": target_id,
        "target_kind": target.target_kind,
        "recipe": representative["resolved"].get("recipe"),
        "quality_tier": quality_tier,
        "platforms": requested,
        "resolved_quality_tiers": {key: value["resolved"].get("quality_tier") for key, value in platform_plans.items()},
        "rollback": "Use ROLLBACK.md and source_snapshot; delete and regenerate without mutating source.",
        "lock_file": "AXM_TEXT_LOCK.json",
        "font_audit": "font_audit.json" if font_audit else None,
        "font_coverage_complete": font_audit.get("complete") if font_audit else None,
        "font_stack_plan": "font_stack_plan.json" if font_stack_plan else None,
        "font_stack_complete": font_stack_plan.get("complete") if font_stack_plan else None,
        "layout_audit": "layout_audit.json" if layout_audit else None,
        "layout_status": layout_audit.get("status") if layout_audit else None,
        "pseudolocale_samples": "pseudolocale_samples.json" if layout_audit else None,
        "files": _hash_files(root),
    }
    _write_json(root / "bundle_manifest.json", manifest, True)
    return root


def compile_preset_bundle(engine, preset_id: str, output_dir: str | Path, platforms: Iterable[str], quality_tier: str = "balanced", force: bool = False, pretty: bool = True, overrides: dict | None = None) -> Path:
    if preset_id not in engine.presets:
        raise KeyError(f"Unknown preset '{preset_id}'." + _suggest_target(engine, preset_id))
    return compile_target_bundle(engine, preset_id, output_dir, platforms, quality_tier, force, pretty, overrides)


def compile_recipe_bundle(engine, recipe_id: str, output_dir: str | Path, platforms: Iterable[str], quality_tier: str = "balanced", force: bool = False, pretty: bool = True, overrides: dict | None = None) -> Path:
    if recipe_id not in engine.recipes:
        raise KeyError(f"Unknown recipe '{recipe_id}'." + _suggest_target(engine, recipe_id))
    return compile_target_bundle(engine, recipe_id, output_dir, platforms, quality_tier, force, pretty, overrides)


def verify_bundle(bundle_dir: str | Path) -> dict:
    root = Path(bundle_dir)
    manifest_path = root / "bundle_manifest.json"
    library_path = root / "library_manifest.json"
    selected = manifest_path if manifest_path.exists() else library_path
    if not selected.exists():
        return {"valid": False, "error": "No bundle_manifest.json or library_manifest.json found.", "missing": [], "modified": [], "untracked": []}
    manifest = json.loads(selected.read_text(encoding="utf-8"))
    expected = manifest.get("files", {})
    missing: list[str] = []
    modified: list[str] = []
    for rel, expected_hash in expected.items():
        path = root / rel
        if not path.exists():
            missing.append(rel)
        elif _hash_file(path) != expected_hash:
            modified.append(rel)
    nested_manifest_modified: list[str] = []
    for entry in manifest.get("presets", []):
        bundle_rel = entry.get("bundle")
        expected_manifest_hash = entry.get("manifest_sha256")
        if bundle_rel and expected_manifest_hash:
            nested = root / bundle_rel / "bundle_manifest.json"
            rel = f"{bundle_rel}/bundle_manifest.json"
            if not nested.exists():
                missing.append(rel)
            elif _hash_file(nested) != expected_manifest_hash:
                nested_manifest_modified.append(rel)
    modified.extend(nested_manifest_modified)
    actual = set(_hash_files(root).keys())
    untracked = sorted(actual - set(expected))
    return {
        "valid": not missing and not modified and not untracked,
        "manifest": selected.name,
        "target_id": manifest.get("target_id"),
        "target_kind": manifest.get("target_kind"),
        "missing": sorted(missing),
        "modified": sorted(modified),
        "untracked": untracked,
        "checked_files": len(expected),
    }


def compile_library_bundle(engine, output_dir: str | Path, platforms: Iterable[str], quality_tier: str = "balanced", target_ids: Sequence[str] | None = None, category: str | None = None, featured_only: bool = False, force: bool = False, overrides: dict | None = None) -> Path:
    root = _safe_output_root(output_dir, force)
    platform_list = list(dict.fromkeys(str(p).lower() for p in platforms if str(p).strip())) or ["web"]
    if target_ids:
        selected = list(dict.fromkeys(target_ids))
    else:
        selected = []
        for preset_id, preset in engine.presets.items():
            if category and str(preset.get("category", "")).lower() != category.lower():
                continue
            if featured_only and not preset.get("featured"):
                continue
            selected.append(preset_id)
    if not selected:
        raise ValueError("No presets matched the requested library selection.")

    entries = []
    presets_root = root / "presets"
    for preset_id in selected:
        bundle = compile_preset_bundle(engine, preset_id, presets_root / preset_id, platform_list, quality_tier, False, True, overrides)
        manifest = json.loads((bundle / "bundle_manifest.json").read_text(encoding="utf-8"))
        preset = engine.presets[preset_id]
        entries.append({
            "id": preset_id,
            "label": preset.get("label", preset_id),
            "category": preset.get("category", "Uncategorized"),
            "recipe": preset.get("recipe"),
            "bundle": f"presets/{preset_id}",
            "manifest_sha256": _hash_file(bundle / "bundle_manifest.json"),
        })

    cards = []
    for entry in entries:
        preview = f"{entry['bundle']}/web/index.html" if "web" in platform_list else entry["bundle"]
        cards.append(f'<li><a href="{html.escape(preview)}">{html.escape(entry["label"])}</a> <small>{html.escape(entry["category"])} · {html.escape(str(entry["recipe"]))}</small></li>')
    index = "<!doctype html><meta charset=\"utf-8\"><title>AXM Text compiled library</title><h1>AXM Text compiled library</h1><ul>" + "".join(cards) + "</ul>"
    _write_text(root / "index.html", index)
    _write_json(root / "library_index.json", {"presets": entries})
    _write_text(root / "ROLLBACK.md", "Delete this generated library and regenerate from the AXM Text Fabric source preset catalog.\n")
    manifest = {
        "id": "axm.text.compiled_library",
        "version": COMPILER_VERSION,
        "compiler_version": COMPILER_VERSION,
        "quality_tier": quality_tier,
        "platforms": platform_list,
        "preset_count": len(entries),
        "presets": entries,
        "files": _hash_files(root),
    }
    _write_json(root / "library_manifest.json", manifest, True)
    return root
