from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .engine import TextFabricEngine
from .glyphs import audit_text
from .font_inspector import audit_font_text, inspect_font, plan_font_stack, save_font_registry
from .compiler import (
    compile_library_bundle,
    compile_preset_bundle,
    compile_recipe_bundle,
    compile_target_bundle,
    resolve_target,
    verify_bundle,
)
from .static_assets import build_visual_qa_matrix, render_svg_to_png, write_svg
from .layout import build_layout_qa_matrix, build_pseudolocale_samples, pseudo_localize


def read_request(path: str) -> dict:
    if path == "-":
        return json.load(sys.stdin)
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _add_compile_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("output_dir")
    parser.add_argument("--platforms", nargs="+", default=["web", "unity", "unreal", "godot"])
    parser.add_argument("--quality-tier", choices=["auto", "low", "balanced", "high", "cinematic"], default="balanced")
    parser.add_argument("--font-file")
    parser.add_argument("--font-registry")
    parser.add_argument("--font-index", type=int, default=0)
    parser.add_argument("--font-policy", choices=["off", "warn", "strict"], default="warn")
    parser.add_argument("--container-width", type=float)
    parser.add_argument("--max-lines", type=int)
    parser.add_argument("--safe-area-ratio", type=float)
    parser.add_argument("--localization-expansion", type=float, default=0.35)
    parser.add_argument("--layout-policy", choices=["off", "warn", "strict"], default="warn")
    parser.add_argument("--force", action="store_true")


def _compile_overrides(args, extra: dict | None = None) -> dict:
    values = dict(extra or {})
    if getattr(args, "font_file", None):
        values["font_file"] = args.font_file
        values["font_index"] = getattr(args, "font_index", 0)
        values["font_coverage_policy"] = getattr(args, "font_policy", "warn")
    if getattr(args, "font_registry", None):
        values["font_registry"] = args.font_registry
        values["font_coverage_policy"] = getattr(args, "font_policy", "warn")
    if getattr(args, "container_width", None) is not None:
        values["container_width_px"] = args.container_width
    if getattr(args, "max_lines", None) is not None:
        values["max_lines"] = args.max_lines
    if getattr(args, "safe_area_ratio", None) is not None:
        values["safe_area_ratio"] = args.safe_area_ratio
    if getattr(args, "localization_expansion", None) is not None:
        values["localization_expansion"] = args.localization_expansion
    if getattr(args, "layout_policy", None):
        values["layout_policy"] = args.layout_policy
    return values


def _print_error(exc: Exception) -> int:
    message = str(exc)
    if isinstance(exc, KeyError) and len(message) >= 2 and message[0] == message[-1] == '"':
        message = message[1:-1]
    print(f"ERROR: {message}", file=sys.stderr)
    return 2


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="axm-text", description="AXM Text Fabric resolver and compiler")
    sub = parser.add_subparsers(dest="command", required=True)

    resolve = sub.add_parser("resolve", help="Resolve a JSON text request")
    resolve.add_argument("request")
    resolve.add_argument("--pretty", action="store_true")

    resolve_preset = sub.add_parser("resolve-preset", help="Resolve a built-in preset")
    resolve_preset.add_argument("preset_id")
    resolve_preset.add_argument("--platform")
    resolve_preset.add_argument("--text")
    resolve_preset.add_argument("--quality-tier", choices=["auto", "low", "balanced", "high", "cinematic"])
    resolve_preset.add_argument("--font-file")
    resolve_preset.add_argument("--font-registry")
    resolve_preset.add_argument("--font-index", type=int, default=0)
    resolve_preset.add_argument("--font-policy", choices=["off", "warn", "strict"], default="warn")
    resolve_preset.add_argument("--pretty", action="store_true")

    validate = sub.add_parser("validate", help="Validate a JSON request")
    validate.add_argument("request")

    audit = sub.add_parser("audit-text", help="Inspect Unicode scripts, direction, controls, and fallback requirements")
    audit.add_argument("text", nargs="?")
    audit.add_argument("--file")
    audit.add_argument("--pretty", action="store_true")

    stress = sub.add_parser("stress-text", help="Create pseudo-localized text variants while preserving placeholders")
    stress.add_argument("text", nargs="?")
    stress.add_argument("--file")
    stress.add_argument("--mode", choices=["all", "original", "accented", "expanded", "rtl"], default="all")
    stress.add_argument("--expansion", type=float, default=0.35)
    stress.add_argument("--pretty", action="store_true")

    layout_audit = sub.add_parser("layout-audit", help="Resolve a request and return its layout resilience audit")
    layout_audit.add_argument("request")
    layout_audit.add_argument("--pretty", action="store_true")

    font_info = sub.add_parser("font-info", help="Inspect TTF, OTF, or TTC metadata and capabilities")
    font_info.add_argument("font_file")
    font_info.add_argument("--index", type=int, default=0)
    font_info.add_argument("--pretty", action="store_true")

    audit_font = sub.add_parser("audit-font", help="Verify that a font contains the glyphs required by text")
    audit_font.add_argument("font_file")
    audit_font.add_argument("text", nargs="?")
    audit_font.add_argument("--file")
    audit_font.add_argument("--index", type=int, default=0)
    audit_font.add_argument("--pretty", action="store_true")

    registry = sub.add_parser("build-font-registry", help="Build a local metadata registry for font files")
    registry.add_argument("output")
    registry.add_argument("paths", nargs="+")
    registry.add_argument("--no-recursive", action="store_true")
    registry.add_argument("--redact-paths", action="store_true")
    registry.add_argument("--pretty", action="store_true")

    stack_plan = sub.add_parser("plan-font-stack", help="Choose a minimal fallback stack from a font registry")
    stack_plan.add_argument("registry")
    stack_plan.add_argument("text", nargs="?")
    stack_plan.add_argument("--file")
    stack_plan.add_argument("--pretty", action="store_true")

    sub.add_parser("list-recipes")
    sub.add_parser("list-roles")
    sub.add_parser("list-presets")

    compile_preset = sub.add_parser("compile-preset", help="Compile a preset into project handoff folders")
    compile_preset.add_argument("preset_id")
    _add_compile_args(compile_preset)

    compile_recipe = sub.add_parser("compile-recipe", help="Compile a recipe without requiring a preset ID")
    compile_recipe.add_argument("recipe_id")
    _add_compile_args(compile_recipe)
    compile_recipe.add_argument("--text")
    compile_recipe.add_argument("--role")

    compile_target = sub.add_parser("compile-target", help="Auto-detect and compile either a preset or recipe")
    compile_target.add_argument("target_id")
    _add_compile_args(compile_target)
    compile_target.add_argument("--text")
    compile_target.add_argument("--role")

    compile_library = sub.add_parser("compile-library", help="Compile many preset bundles at once")
    _add_compile_args(compile_library)
    compile_library.add_argument("--ids", nargs="+")
    compile_library.add_argument("--category")
    compile_library.add_argument("--featured-only", action="store_true")

    verify = sub.add_parser("verify-bundle", help="Recompute hashes and verify a compiled bundle or library")
    verify.add_argument("bundle_dir")
    verify.add_argument("--pretty", action="store_true")

    export_static = sub.add_parser("export-static", help="Export a portable SVG and optional PNG from a preset or recipe")
    export_static.add_argument("target_id")
    export_static.add_argument("output_svg")
    export_static.add_argument("--quality-tier", choices=["auto", "low", "balanced", "high", "cinematic"], default="balanced")
    export_static.add_argument("--platform", default="web")
    export_static.add_argument("--text")
    export_static.add_argument("--role")
    export_static.add_argument("--font-file")
    export_static.add_argument("--font-registry")
    export_static.add_argument("--font-index", type=int, default=0)
    export_static.add_argument("--font-policy", choices=["off", "warn", "strict"], default="warn")
    export_static.add_argument("--width", type=int, default=1600)
    export_static.add_argument("--height", type=int, default=480)
    export_static.add_argument("--background")
    export_static.add_argument("--png", action="store_true")
    export_static.add_argument("--force", action="store_true")
    export_static.add_argument("--pretty", action="store_true")

    qa_matrix = sub.add_parser("qa-matrix", help="Build SVG/PNG visual QA assets across quality tiers")
    qa_matrix.add_argument("output_dir")
    qa_matrix.add_argument("--ids", nargs="*", default=[])
    qa_matrix.add_argument("--quality-tiers", nargs="+", default=["low", "balanced", "high", "cinematic"])
    qa_matrix.add_argument("--width", type=int, default=1200)
    qa_matrix.add_argument("--height", type=int, default=360)
    qa_matrix.add_argument("--no-png", action="store_true")
    qa_matrix.add_argument("--force", action="store_true")

    layout_qa = sub.add_parser("layout-qa", help="Build an offline pseudo-localization and width stress matrix")
    layout_qa.add_argument("output_dir")
    layout_qa.add_argument("--ids", nargs="*", default=[])
    layout_qa.add_argument("--widths", nargs="+", type=int, default=[320, 768, 1280])
    layout_qa.add_argument("--modes", nargs="+", choices=["original", "accented", "expanded", "rtl"], default=["original", "expanded", "rtl"])
    layout_qa.add_argument("--force", action="store_true")

    args = parser.parse_args(argv)
    engine = TextFabricEngine()

    try:
        if args.command == "audit-text":
            if args.file and args.text is not None:
                raise ValueError("Use either positional text or --file, not both.")
            if args.file:
                value = Path(args.file).read_text(encoding="utf-8")
            elif args.text is not None:
                value = args.text
            else:
                raise ValueError("Provide text or --file for audit-text.")
            print(json.dumps(audit_text(value), indent=2 if args.pretty else None, ensure_ascii=False))
            return 0
        if args.command == "stress-text":
            if args.file and args.text is not None:
                raise ValueError("Use either positional text or --file, not both.")
            if args.file:
                value = Path(args.file).read_text(encoding="utf-8")
            elif args.text is not None:
                value = args.text
            else:
                raise ValueError("Provide text or --file for stress-text.")
            result = build_pseudolocale_samples(value, args.expansion) if args.mode == "all" else {args.mode: pseudo_localize(value, args.mode, args.expansion)}
            print(json.dumps(result, indent=2 if args.pretty else None, ensure_ascii=False))
            return 0
        if args.command == "layout-audit":
            request = read_request(args.request)
            result = engine.resolve(request)["resolved"]["layout_audit"]
            print(json.dumps(result, indent=2 if args.pretty else None, ensure_ascii=False))
            return 1 if result.get("status") == "critical" else 0
        if args.command == "font-info":
            info = inspect_font(args.font_file, index=args.index)
            info.pop("_codepoints", None)
            print(json.dumps(info, indent=2 if args.pretty else None, ensure_ascii=False))
            return 0
        if args.command == "audit-font":
            if args.file and args.text is not None:
                raise ValueError("Use either positional text or --file, not both.")
            if args.file:
                value = Path(args.file).read_text(encoding="utf-8")
            elif args.text is not None:
                value = args.text
            else:
                raise ValueError("Provide text or --file for audit-font.")
            result = audit_font_text(args.font_file, value, index=args.index)
            print(json.dumps(result, indent=2 if args.pretty else None, ensure_ascii=False))
            return 0 if result.get("complete") else 1
        if args.command == "build-font-registry":
            target = save_font_registry(args.output, args.paths, recursive=not args.no_recursive, redact_paths=args.redact_paths, pretty=args.pretty)
            print(str(target))
            return 0
        if args.command == "plan-font-stack":
            if args.file and args.text is not None:
                raise ValueError("Use either positional text or --file, not both.")
            if args.file:
                value = Path(args.file).read_text(encoding="utf-8")
            elif args.text is not None:
                value = args.text
            else:
                raise ValueError("Provide text or --file for plan-font-stack.")
            result = plan_font_stack(args.registry, value)
            print(json.dumps(result, indent=2 if args.pretty else None, ensure_ascii=False))
            return 0 if result.get("complete") else 1
        if args.command == "list-recipes":
            for key, value in engine.recipes.items():
                print(f"{key}: {value.get('label', key)}")
            return 0
        if args.command == "list-roles":
            for key in engine.roles:
                print(key)
            return 0
        if args.command == "list-presets":
            for key, value in engine.presets.items():
                print(f"{key}: {value.get('label', key)} [{value.get('category', 'Uncategorized')}] -> {value.get('recipe')}")
            return 0
        if args.command == "compile-preset":
            root = compile_preset_bundle(engine, args.preset_id, args.output_dir, args.platforms, args.quality_tier, args.force, True, _compile_overrides(args) or None)
            print(str(root))
            return 0
        if args.command == "compile-recipe":
            overrides = _compile_overrides(args, {k: v for k, v in {"text": args.text, "role": args.role}.items() if v is not None})
            root = compile_recipe_bundle(engine, args.recipe_id, args.output_dir, args.platforms, args.quality_tier, args.force, True, overrides or None)
            print(str(root))
            return 0
        if args.command == "compile-target":
            overrides = _compile_overrides(args, {k: v for k, v in {"text": args.text, "role": args.role}.items() if v is not None})
            root = compile_target_bundle(engine, args.target_id, args.output_dir, args.platforms, args.quality_tier, args.force, True, overrides or None)
            print(str(root))
            return 0
        if args.command == "compile-library":
            root = compile_library_bundle(
                engine,
                args.output_dir,
                args.platforms,
                args.quality_tier,
                args.ids,
                args.category,
                args.featured_only,
                args.force,
                _compile_overrides(args) or None,
            )
            print(str(root))
            return 0
        if args.command == "verify-bundle":
            result = verify_bundle(args.bundle_dir)
            print(json.dumps(result, indent=2 if args.pretty else None, ensure_ascii=False))
            return 0 if result.get("valid") else 1
        if args.command == "export-static":
            output_svg = Path(args.output_svg)
            output_png = output_svg.with_suffix(".png")
            existing = [path for path in (output_svg, output_png if args.png else None) if path is not None and path.exists()]
            if existing and not args.force:
                raise FileExistsError("Output already exists: " + ", ".join(str(path) for path in existing))
            overrides = _compile_overrides(args, {"platform": args.platform, "quality_tier": args.quality_tier})
            if args.text is not None:
                overrides["text"] = args.text
            if args.role is not None:
                overrides["role"] = args.role
            target = resolve_target(engine, args.target_id, overrides)
            write_svg(target.plan, output_svg, args.width, args.height, args.background, f"AXM static asset: {args.target_id}")
            result = {"target_id": args.target_id, "svg": str(output_svg), "png": None}
            if args.png:
                result["png"] = render_svg_to_png(output_svg, output_png, width=args.width)
            print(json.dumps(result, indent=2 if args.pretty else None, ensure_ascii=False))
            return 0
        if args.command == "qa-matrix":
            root = build_visual_qa_matrix(
                engine,
                args.ids,
                args.output_dir,
                args.quality_tiers,
                args.width,
                args.height,
                not args.no_png,
                args.force,
            )
            print(str(root))
            return 0
        if args.command == "layout-qa":
            root = build_layout_qa_matrix(engine, args.ids, args.output_dir, args.widths, args.modes, args.force)
            print(str(root))
            return 0
        if args.command == "resolve-preset":
            overrides = {}
            if args.platform:
                overrides["platform"] = args.platform
            if args.text:
                overrides["text"] = args.text
            if args.quality_tier:
                overrides["quality_tier"] = args.quality_tier
            if args.font_file:
                overrides.update({"font_file": args.font_file, "font_index": args.font_index, "font_coverage_policy": args.font_policy})
            if args.font_registry:
                overrides.update({"font_registry": args.font_registry, "font_coverage_policy": args.font_policy})
            plan = engine.resolve_preset(args.preset_id, overrides or None)
            print(json.dumps(plan, indent=2 if args.pretty else None, ensure_ascii=False))
            return 0

        request = read_request(args.request)
        plan = engine.resolve(request)
        if args.command == "validate":
            errors = [w for w in plan["warnings"] if w["severity"] == "error"]
            print(json.dumps({"valid": not errors, "warnings": plan["warnings"], "contrast": plan["resolved"]["contrast"]}, indent=2))
            return 1 if errors else 0
        print(json.dumps(plan, indent=2 if args.pretty else None, ensure_ascii=False))
        return 0
    except (KeyError, FileExistsError, ValueError, RuntimeError, json.JSONDecodeError, OSError) as exc:
        return _print_error(exc)


if __name__ == "__main__":
    raise SystemExit(main())
