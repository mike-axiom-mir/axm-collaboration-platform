from __future__ import annotations

from pathlib import Path
import hashlib
import html
import json
import re
import shutil
import struct
import subprocess
import textwrap as _textwrap
import xml.etree.ElementTree as ET

STATIC_EXPORT_VERSION = "1.0.0"


def _write_text(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value, encoding="utf-8")


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _safe_output_dir(path: str | Path, force: bool = False) -> Path:
    root = Path(path)
    if root.exists() and any(root.iterdir()):
        if not force:
            raise FileExistsError(f"Output directory is not empty: {root}")
        shutil.rmtree(root)
    root.mkdir(parents=True, exist_ok=True)
    return root


def _rgba_parts(value: str | None, fallback=(255, 255, 255, 1.0)) -> tuple[int, int, int, float]:
    raw = str(value or "").strip()
    if re.fullmatch(r"#[0-9a-fA-F]{6}", raw):
        return int(raw[1:3], 16), int(raw[3:5], 16), int(raw[5:7], 16), 1.0
    if re.fullmatch(r"#[0-9a-fA-F]{3}", raw):
        return int(raw[1] * 2, 16), int(raw[2] * 2, 16), int(raw[3] * 2, 16), 1.0
    match = re.fullmatch(
        r"rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)",
        raw,
        re.I,
    )
    if match:
        r, g, b, a = match.groups()
        return int(float(r)), int(float(g)), int(float(b)), float(a if a is not None else 1.0)
    return fallback


def _svg_color(value: str | None, opacity_multiplier: float = 1.0) -> tuple[str, float]:
    r, g, b, a = _rgba_parts(value)
    return f"rgb({r},{g},{b})", max(0.0, min(1.0, a * float(opacity_multiplier)))


def _wrap_text(value: str, max_chars: int) -> list[str]:
    lines: list[str] = []
    raw_lines = str(value or "AXM TEXT").splitlines() or ["AXM TEXT"]
    for raw in raw_lines:
        if not raw:
            lines.append("")
            continue
        wrapped = _textwrap.wrap(
            raw,
            width=max(6, max_chars),
            break_long_words=False,
            break_on_hyphens=False,
        )
        lines.extend(wrapped or [raw])
    return lines[:4]


def _gradient_stops(colors: list[str]) -> str:
    if not colors:
        colors = ["#FFFFFF"]
    if len(colors) == 1:
        colors = [colors[0], colors[0]]
    output = []
    for i, value in enumerate(colors):
        offset = i / (len(colors) - 1)
        color, opacity = _svg_color(value)
        output.append(
            f'<stop offset="{offset:.4f}" stop-color="{color}" stop-opacity="{opacity:.4f}"/>'
        )
    return "".join(output)


def _text_tspans(lines: list[str], x: float, line_height: float) -> str:
    if not lines:
        lines = ["AXM TEXT"]
    start = -((len(lines) - 1) * line_height) / 2
    spans = []
    for index, line in enumerate(lines):
        dy = start if index == 0 else line_height
        spans.append(f'<tspan x="{x:.2f}" dy="{dy:.2f}">{html.escape(line)}</tspan>')
    return "".join(spans)


def svg_from_plan(
    plan: dict,
    width: int = 1600,
    height: int = 480,
    background: str | None = None,
    title: str | None = None,
) -> str:
    width = max(320, int(width))
    height = max(180, int(height))
    resolved = plan["resolved"]
    effects = resolved.get("effects", {})
    request = plan.get("request", {})
    text = str(request.get("text") or resolved.get("recipe") or "AXM TEXT")
    if resolved.get("uppercase"):
        text = text.upper()

    role_size = float(resolved.get("size_px") or 48)
    max_chars = max(10, int(width / max(28.0, role_size * 1.1)))
    lines = _wrap_text(text, max_chars)
    longest = max((len(line) for line in lines), default=8)
    size_from_width = width / max(8.0, longest * 0.68)
    font_size = max(24.0, min(height * 0.31, role_size * 2.0, size_from_width))
    line_height = font_size * float(resolved.get("line_height", 1.1))
    center_x = width / 2
    center_y = height / 2 + font_size * 0.12

    plate = effects.get("plate", {})
    outline = effects.get("outline", {})
    glow = effects.get("glow", {})
    glitch = effects.get("glitch", {})
    sheen = effects.get("sheen", {})

    plate_color, plate_opacity = _svg_color(
        plate.get("color", "rgba(5,8,16,.72)"), plate.get("opacity_multiplier", 1.0)
    )
    plate_border, plate_border_opacity = _svg_color(
        plate.get("border", "rgba(255,255,255,.10)")
    )
    outline_color, outline_opacity = _svg_color(outline.get("color", "transparent"))
    glow_color, glow_opacity = _svg_color(
        glow.get("color", "transparent"), glow.get("opacity", 0.0)
    )
    glitch_red, glitch_red_opacity = _svg_color(
        glitch.get("red", "transparent"), glitch.get("intensity", 0.0)
    )
    glitch_cyan, glitch_cyan_opacity = _svg_color(
        glitch.get("cyan", "transparent"), glitch.get("intensity", 0.0)
    )
    background = background or request.get("background_color") or "#05070B"
    bg_color, bg_opacity = _svg_color(background)

    gradient = resolved.get("gradient") or [resolved.get("fill", "#FFFFFF")]
    if not isinstance(gradient, list):
        gradient = [resolved.get("fill", "#FFFFFF")]

    font_family = html.escape(
        str(resolved.get("font_family", "system-ui, sans-serif")), quote=True
    )
    font_weight = int(resolved.get("weight", 700))
    tracking = float(resolved.get("tracking_em", 0.0)) * font_size
    stroke_width = max(
        0.0,
        float(outline.get("width_px", 0.0)) * max(1.0, font_size / 54.0),
    )
    glow_blur = max(0.0, float(glow.get("blur_px", 0.0)) / 3.2)
    glitch_offset = max(
        0.0,
        float(glitch.get("offset_px", 0.0)) * max(1.0, font_size / 64.0),
    )
    glitch_enabled = (
        bool(glitch.get("enabled"))
        and float(glitch.get("intensity", 0.0)) > 0
        and glitch_offset > 0
    )

    panel_x = width * 0.055
    panel_y = height * 0.14
    panel_w = width * 0.89
    panel_h = height * 0.72
    radius = max(8.0, float(plate.get("radius_px", 16.0)) * 1.2)
    tspans = _text_tspans(lines, center_x, line_height)
    accessible_title = title or str(
        plan.get("preset_id")
        or plan.get("target_id")
        or resolved.get("recipe")
        or "AXM text asset"
    )
    direction = resolved.get("glyph_audit", {}).get("direction", "neutral")
    direction_attr = ' direction="rtl" unicode-bidi="plaintext"' if direction == "rtl" else ""

    glow_filter = ""
    if glow_blur > 0 and glow_opacity > 0:
        glow_filter = f'''<filter id="axmGlow" x="-60%" y="-100%" width="220%" height="300%">
<feGaussianBlur stdDeviation="{glow_blur:.3f}" result="blur"/>
<feFlood flood-color="{glow_color}" flood-opacity="{glow_opacity:.4f}" result="flood"/>
<feComposite in="flood" in2="blur" operator="in" result="colored"/>
<feMerge><feMergeNode in="colored"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>'''

    shadow_nodes = []
    for index, shadow in enumerate(effects.get("shadow", [])[:2]):
        color, opacity = _svg_color(shadow.get("color", "rgba(0,0,0,.5)"))
        blur = max(0.0, float(shadow.get("blur", 0.0)) / 3.0)
        dx = float(shadow.get("x", 0.0))
        dy = float(shadow.get("y", 0.0))
        shadow_nodes.append(
            f'''<filter id="axmShadow{index}" x="-50%" y="-100%" width="200%" height="300%">
<feGaussianBlur stdDeviation="{blur:.3f}" result="blur"/><feOffset dx="{dx:.3f}" dy="{dy:.3f}" result="offset"/>
<feFlood flood-color="{color}" flood-opacity="{opacity:.4f}" result="flood"/><feComposite in="flood" in2="offset" operator="in"/>
</filter>'''
        )

    metadata = html.escape(
        json.dumps(
            {
                "generator": "AXM Text Fabric static asset baker",
                "version": STATIC_EXPORT_VERSION,
                "recipe": resolved.get("recipe"),
                "quality_tier": resolved.get("quality_tier"),
                "rendering_strategy": resolved.get("rendering_strategy"),
                "direction": direction,
            },
            ensure_ascii=False,
        )
    )

    text_style = (
        f"font-family:{font_family};font-size:{font_size:.3f}px;"
        f"font-weight:{font_weight};letter-spacing:{tracking:.3f}px;"
        "text-anchor:middle;dominant-baseline:middle;paint-order:stroke fill;"
        f"stroke:{outline_color};stroke-opacity:{outline_opacity:.4f};"
        f"stroke-width:{stroke_width:.3f}px;stroke-linejoin:round;"
    )
    shadow_layers = []
    for index, _shadow in enumerate(effects.get("shadow", [])[:2]):
        shadow_layers.append(
            f'<text x="{center_x:.2f}" y="{center_y:.2f}" style="{text_style}" '
            f'fill="black" fill-opacity="1" filter="url(#axmShadow{index})"'
            f'{direction_attr}>{tspans}</text>'
        )

    glitch_layers = ""
    if glitch_enabled:
        glitch_layers = f'''<g aria-hidden="true">
<text x="{center_x - glitch_offset:.2f}" y="{center_y:.2f}" style="{text_style}" fill="{glitch_red}" fill-opacity="{glitch_red_opacity:.4f}" stroke="none"{direction_attr}>{tspans}</text>
<text x="{center_x + glitch_offset:.2f}" y="{center_y:.2f}" style="{text_style}" fill="{glitch_cyan}" fill-opacity="{glitch_cyan_opacity:.4f}" stroke="none"{direction_attr}>{tspans}</text>
</g>'''

    sheen_overlay = ""
    if sheen.get("enabled"):
        sheen_color, sheen_opacity = _svg_color(
            sheen.get("color", "rgba(255,255,255,.35)"),
            sheen.get("intensity_multiplier", 1.0),
        )
        sheen_overlay = f'''<linearGradient id="axmSheen" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="{sheen_color}" stop-opacity="0"/>
<stop offset="0.44" stop-color="{sheen_color}" stop-opacity="0"/>
<stop offset="0.52" stop-color="{sheen_color}" stop-opacity="{min(.72, sheen_opacity):.4f}"/>
<stop offset="0.60" stop-color="{sheen_color}" stop-opacity="0"/>
<stop offset="1" stop-color="{sheen_color}" stop-opacity="0"/>
</linearGradient>'''

    scanline_overlay = ""
    scanline_opacity = (
        float(glitch.get("scanline_opacity", 0.0)) if glitch_enabled else 0.0
    )
    if scanline_opacity > 0:
        scanline_overlay = (
            '<pattern id="axmScanlines" width="4" height="4" '
            'patternUnits="userSpaceOnUse">'
            f'<rect width="4" height="1" fill="white" fill-opacity="{min(.22, scanline_opacity):.4f}"/>'
            "</pattern>"
        )

    glow_attr = ' filter="url(#axmGlow)"' if glow_filter else ""
    sheen_text = ""
    if sheen_overlay:
        sheen_text = (
            f'<text x="{center_x:.2f}" y="{center_y:.2f}" style="{text_style}" '
            f'fill="url(#axmSheen)" stroke="none" aria-hidden="true"'
            f'{direction_attr}>{tspans}</text>'
        )
    scan_rect = ""
    if scanline_overlay:
        scan_rect = (
            f'<rect x="{panel_x:.2f}" y="{panel_y:.2f}" width="{panel_w:.2f}" '
            f'height="{panel_h:.2f}" rx="{radius:.2f}" fill="url(#axmScanlines)" '
            'pointer-events="none"/>'
        )

    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="axmTitle axmDesc">
<title id="axmTitle">{html.escape(accessible_title)}</title>
<desc id="axmDesc">Portable AXM text asset. Readable core with optional material, glow, sheen, and restrained glitch layers.</desc>
<metadata>{metadata}</metadata>
<defs>
<linearGradient id="axmBackground" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{bg_color}" stop-opacity="{bg_opacity:.4f}"/><stop offset="1" stop-color="rgb(10,18,31)"/></linearGradient>
<linearGradient id="axmFill" x1="0" y1="0" x2="0" y2="1">{_gradient_stops(gradient)}</linearGradient>
{glow_filter}
{''.join(shadow_nodes)}
{sheen_overlay}
{scanline_overlay}
</defs>
<rect width="100%" height="100%" fill="url(#axmBackground)"/>
<circle cx="{width*.20:.2f}" cy="{height*.10:.2f}" r="{height*.55:.2f}" fill="rgb(65,206,255)" fill-opacity="0.08"/>
<circle cx="{width*.84:.2f}" cy="{height*.82:.2f}" r="{height*.60:.2f}" fill="rgb(150,95,255)" fill-opacity="0.08"/>
<rect x="{panel_x:.2f}" y="{panel_y:.2f}" width="{panel_w:.2f}" height="{panel_h:.2f}" rx="{radius:.2f}" fill="{plate_color}" fill-opacity="{plate_opacity:.4f}" stroke="{plate_border}" stroke-opacity="{plate_border_opacity:.4f}" stroke-width="1.5"/>
{''.join(shadow_layers)}
{glitch_layers}
<text x="{center_x:.2f}" y="{center_y:.2f}" style="{text_style}" fill="url(#axmFill)"{glow_attr}{direction_attr}>{tspans}</text>
{sheen_text}
{scan_rect}
<text x="{width-24}" y="{height-18}" text-anchor="end" fill="white" fill-opacity="0.42" font-family="system-ui,sans-serif" font-size="12">AXM Text Fabric v{STATIC_EXPORT_VERSION} · {html.escape(str(resolved.get('quality_tier','balanced')))}</text>
</svg>
'''
    ET.fromstring(svg)
    return svg


def write_svg(
    plan: dict,
    output_svg: str | Path,
    width: int = 1600,
    height: int = 480,
    background: str | None = None,
    title: str | None = None,
) -> Path:
    output = Path(output_svg)
    _write_text(output, svg_from_plan(plan, width, height, background, title))
    return output


def find_svg_renderer() -> str | None:
    direct = (
        shutil.which("inkscape")
        or shutil.which("rsvg-convert")
        or shutil.which("magick")
    )
    if direct:
        return direct

    # Windows ships System32\convert.exe for filesystem conversion. It is not
    # ImageMagick and accepting it here turns an optional PNG path into a false
    # positive. Legacy ImageMagick installs may still expose `convert`, so
    # identify the executable before returning it.
    legacy = shutil.which("convert")
    if not legacy:
        return None
    try:
        probe = subprocess.run(
            [legacy, "-version"],
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    identity = f"{probe.stdout}\n{probe.stderr}"
    return legacy if probe.returncode == 0 and "ImageMagick" in identity else None


def render_svg_to_png(
    svg_path: str | Path,
    png_path: str | Path,
    width: int | None = None,
    height: int | None = None,
    renderer: str | None = None,
) -> dict:
    source = Path(svg_path)
    output = Path(png_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    renderer = renderer or find_svg_renderer()
    if not renderer:
        raise RuntimeError(
            "No SVG renderer found. Install Inkscape, rsvg-convert, or ImageMagick."
        )
    name = Path(renderer).name.lower()
    if "inkscape" in name:
        command = [renderer, str(source), f"--export-filename={output}"]
        if width:
            command.append(f"--export-width={int(width)}")
        if height and not width:
            command.append(f"--export-height={int(height)}")
    elif "rsvg" in name:
        command = [renderer, str(source), "-o", str(output)]
        if width:
            command.extend(["-w", str(int(width))])
        if height:
            command.extend(["-h", str(int(height))])
    else:
        command = [renderer, str(source), str(output)]
    result = subprocess.run(command, capture_output=True, text=True, timeout=60)
    if result.returncode != 0 or not output.exists():
        message = (result.stderr or result.stdout or "SVG renderer failed").strip()
        raise RuntimeError(message)
    dimensions = png_dimensions(output)
    return {
        "renderer": renderer,
        "command": command,
        "png": str(output),
        "width": dimensions[0],
        "height": dimensions[1],
        "sha256": _sha256(output),
    }


def png_dimensions(path: str | Path) -> tuple[int, int]:
    data = Path(path).read_bytes()[:24]
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Not a PNG file: {path}")
    return struct.unpack(">II", data[16:24])


def write_portable_bundle(root: str | Path, plan: dict, target_id: str) -> Path:
    portable = Path(root) / "portable"
    safe = re.sub(r"[^a-zA-Z0-9_-]+", "_", target_id).strip("_") or "axm_text"
    svg_path = portable / f"{safe}.svg"
    write_svg(plan, svg_path, 1600, 480, title=f"AXM portable asset: {target_id}")
    alt = html.escape(str(plan.get("request", {}).get("text", "AXM text")))
    preview = (
        '<!doctype html><meta charset="utf-8"><meta name="viewport" '
        'content="width=device-width,initial-scale=1"><title>AXM portable asset</title>'
        '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;'
        'background:#05070b}img{max-width:min(96vw,1600px);height:auto}</style>'
        f'<img src="{html.escape(svg_path.name)}" alt="{alt}">'
    )
    _write_text(portable / "index.html", preview)
    _write_text(
        portable / "README_IMPORT.md",
        """# Portable static fallback

This SVG preserves the readable text core, plate, gradient, outline, glow, sheen, and restrained static glitch layers.

Use it for:
- splash screens
- marketing panels
- temporary engine fallbacks
- performance-constrained static labels
- visual review outside the target engine

The SVG references the resolved font-family stack. For identical cross-device metrics, replace it with a project-owned licensed font or bake text to paths using your own font tooling.
""",
    )
    _write_json(
        portable / "asset_manifest.json",
        {
            "id": "axm.text.portable_asset",
            "version": STATIC_EXPORT_VERSION,
            "target_id": target_id,
            "svg": svg_path.name,
            "sha256": _sha256(svg_path),
            "font_policy": "Font binaries and glyph outlines are not bundled.",
        },
    )
    return portable


def _resolve_target_plan(
    engine, target_id: str, quality_tier: str, overrides: dict | None = None
) -> dict:
    overrides = dict(overrides or {})
    overrides["quality_tier"] = quality_tier
    overrides.setdefault("platform", "web")
    if target_id in engine.presets:
        return engine.resolve_preset(target_id, overrides)
    if target_id in engine.recipes:
        recipe = engine.recipes[target_id]
        roles = recipe.get("recommended_roles") or ["display"]
        request = {
            "text": recipe.get("label", target_id),
            "role": roles[0],
            "recipe": target_id,
            "platform": "web",
            "background": "dynamic",
            "importance": "high"
            if roles[0] in {"display", "game_reward_title"}
            else "normal",
            "quality_tier": quality_tier,
        }
        request.update(overrides)
        return engine.resolve(request)
    raise KeyError(f"Unknown preset or recipe '{target_id}'.")


def build_visual_qa_matrix(
    engine,
    target_ids: list[str],
    output_dir: str | Path,
    quality_tiers: list[str] | None = None,
    width: int = 1200,
    height: int = 360,
    render_png: bool = True,
    force: bool = False,
) -> Path:
    root = _safe_output_dir(output_dir, force)
    quality_tiers = quality_tiers or ["low", "balanced", "high", "cinematic"]
    quality_tiers = list(dict.fromkeys(quality_tiers))
    allowed = {"auto", "low", "balanced", "high", "cinematic"}
    invalid = [tier for tier in quality_tiers if tier not in allowed]
    if invalid:
        raise ValueError("Unknown quality tier(s): " + ", ".join(invalid))
    if not target_ids:
        target_ids = [
            key for key, item in engine.presets.items() if item.get("featured")
        ][:6]
        if not target_ids:
            target_ids = list(engine.presets)[:6]

    entries = []
    renderer = find_svg_renderer() if render_png else None
    for target_id in target_ids:
        for tier in quality_tiers:
            plan = _resolve_target_plan(engine, target_id, tier)
            safe = re.sub(r"[^a-zA-Z0-9_-]+", "_", target_id).strip("_")
            stem = f"{safe}_{tier}"
            svg_path = root / "assets" / f"{stem}.svg"
            write_svg(plan, svg_path, width, height, title=f"{target_id} — {tier}")
            entry = {
                "target_id": target_id,
                "quality_tier": tier,
                "recipe": plan["resolved"].get("recipe"),
                "render_budget": plan["resolved"].get("render_budget", {}),
                "svg": svg_path.relative_to(root).as_posix(),
                "svg_sha256": _sha256(svg_path),
            }
            if renderer:
                png_path = root / "assets" / f"{stem}.png"
                rendered = render_svg_to_png(
                    svg_path, png_path, width=width, renderer=renderer
                )
                entry.update(
                    {
                        "png": png_path.relative_to(root).as_posix(),
                        "png_sha256": rendered["sha256"],
                        "png_dimensions": [rendered["width"], rendered["height"]],
                        "renderer": rendered["renderer"],
                    }
                )
            entries.append(entry)

    cards = []
    for entry in entries:
        asset = entry.get("png") or entry["svg"]
        budget = entry.get("render_budget", {}).get("estimated_cost", {})
        cards.append(
            f'<article><img src="{html.escape(asset)}" '
            f'alt="{html.escape(entry["target_id"])} {html.escape(entry["quality_tier"])}">'
            f'<div><b>{html.escape(entry["target_id"])}</b>'
            f'<span>{html.escape(entry["quality_tier"])} · '
            f'{html.escape(str(entry["recipe"]))} · cost '
            f'{html.escape(str(budget.get("label", "unknown")))}</span></div></article>'
        )
    page = (
        '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" '
        'content="width=device-width,initial-scale=1"><title>AXM Text visual QA matrix</title>'
        '<style>*{box-sizing:border-box}body{margin:0;background:#05070b;color:#eef7ff;'
        'font-family:system-ui,sans-serif;padding:24px}h1{margin:0 0 20px}main{display:grid;'
        'grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px}article{border:1px solid '
        'rgba(255,255,255,.12);border-radius:16px;overflow:hidden;background:#0b111b}img{display:block;'
        'width:100%;height:auto}article div{padding:12px;display:flex;justify-content:space-between;'
        'gap:12px;align-items:center}span{font-size:12px;color:#9eb1c6;text-align:right}</style>'
        f'</head><body><h1>AXM Text visual QA matrix</h1><main>{"".join(cards)}</main></body></html>'
    )
    _write_text(root / "index.html", page)
    manifest = {
        "id": "axm.text.visual_qa_matrix",
        "version": STATIC_EXPORT_VERSION,
        "target_count": len({item["target_id"] for item in entries}),
        "quality_tiers": quality_tiers,
        "asset_count": len(entries),
        "png_rendered": bool(renderer),
        "renderer": renderer,
        "entries": entries,
    }
    _write_json(root / "qa_manifest.json", manifest)
    return root
