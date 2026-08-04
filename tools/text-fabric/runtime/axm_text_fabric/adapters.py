from __future__ import annotations
import re


def _color_with_opacity(color: str, opacity: float) -> str:
    opacity = max(0.0, min(1.0, float(opacity)))
    raw = str(color or "transparent").strip()
    rgba = re.fullmatch(r"rgba\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*([0-9.]+)\s*\)", raw, re.I)
    if rgba:
        r, g, b, a = rgba.groups()
        return f"rgba({r},{g},{b},{max(0.0, min(1.0, float(a) * opacity)):.4f})"
    rgb = re.fullmatch(r"rgb\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)", raw, re.I)
    if rgb:
        r, g, b = rgb.groups()
        return f"rgba({r},{g},{b},{opacity:.4f})"
    if re.fullmatch(r"#[0-9a-fA-F]{6}", raw):
        return f"rgba({int(raw[1:3],16)},{int(raw[3:5],16)},{int(raw[5:7],16)},{opacity:.4f})"
    if re.fullmatch(r"#[0-9a-fA-F]{3}", raw):
        r, g, b = (int(ch * 2, 16) for ch in raw[1:])
        return f"rgba({r},{g},{b},{opacity:.4f})"
    if opacity <= 0:
        return "transparent"
    if opacity >= 1:
        return raw
    return f"color-mix(in srgb, {raw} {opacity * 100:.2f}%, transparent)"


def _gradient_css(gradient, fallback):
    if gradient and isinstance(gradient, list):
        if len(gradient) == 1:
            return f"linear-gradient(180deg, {gradient[0]}, {gradient[0]})"
        stops = []
        for i, color in enumerate(gradient):
            pct = round((i / (len(gradient) - 1)) * 100, 2)
            stops.append(f"{color} {pct}%")
        return f"linear-gradient(180deg, {', '.join(stops)})"
    return f"linear-gradient(180deg, {fallback}, {fallback})"


def _glow_shadow(glow: dict) -> str | None:
    if not glow or glow.get("opacity", 0) <= 0 or not glow.get("blur_px", 0):
        return None
    color = _color_with_opacity(glow.get('color', '#FFFFFF'), float(glow.get('opacity', 1)))
    return f"0 0 {glow.get('blur_px', 0)}px {color}"


def _glitch_shadow(glitch: dict) -> str | None:
    if not glitch or not glitch.get("enabled") or glitch.get("intensity", 0) <= 0:
        return None
    offset = glitch.get("offset_px", 2)
    intensity = max(0.0, min(1.0, float(glitch.get('intensity', 1))))
    red = _color_with_opacity(glitch.get("red", "rgba(255,72,140,.55)"), intensity)
    cyan = _color_with_opacity(glitch.get("cyan", "rgba(45,240,255,.65)"), intensity)
    return f"{-offset}px 0 0 {red}, {offset}px 0 0 {cyan}"


def web(plan: dict) -> dict:
    r = plan["resolved"]
    e = r["effects"]
    shadows = [f"{s['x']}px {s['y']}px {s['blur']}px {s['color']}" for s in e.get("shadow", [])]
    for extra in (_glow_shadow(e.get("glow", {})), _glitch_shadow(e.get("glitch", {}))):
        if extra:
            shadows.append(extra)
    sheen = e.get("sheen", {})
    plate = e.get("plate", {})
    glitch = e.get("glitch", {})
    sheen_opacity = 0.85 * float(sheen.get("intensity_multiplier", 1.0)) if sheen.get("enabled") else 0.0
    css = {
      "--axm-font-family": r["font_family"],
      "--axm-font-size": r["css_size"],
      "--axm-font-weight": str(r["weight"]),
      "--axm-line-height": str(r["line_height"]),
      "--axm-letter-spacing": f"{r['tracking_em']}em",
      "--axm-text-fill": r["fill"],
      "--axm-text-gradient": _gradient_css(r.get("gradient"), r["fill"]),
      "--axm-text-shadow": ", ".join(shadows) if shadows else "none",
      "--axm-outline-width": f"{e['outline']['width_px']}px",
      "--axm-outline-color": e["outline"]["color"],
      "--axm-plate-color": _color_with_opacity(plate["color"], float(plate.get("opacity_multiplier", 1.0))),
      "--axm-plate-border": plate.get("border", "rgba(255,255,255,.08)"),
      "--axm-plate-blur": f"{plate.get('blur_px', 0)}px",
      "--axm-plate-radius": f"{plate.get('radius_px', 0)}px",
      "--axm-plate-strength": str(plate.get("opacity_multiplier", 1.0)),
      "--axm-measure": f"{r['max_ch']}ch",
      "--axm-sheen-color": sheen.get("color", "rgba(255,255,255,0)"),
      "--axm-sheen-angle": f"{90 - sheen.get('angle_deg', -18)}deg",
      "--axm-sheen-opacity": f"{min(1.0, sheen_opacity):.2f}",
      "--axm-glitch-red": _color_with_opacity(glitch.get("red", "rgba(255,72,140,0)"), float(glitch.get("intensity", 0))),
      "--axm-glitch-cyan": _color_with_opacity(glitch.get("cyan", "rgba(45,240,255,0)"), float(glitch.get("intensity", 0))),
      "--axm-glitch-offset": f"{glitch.get('offset_px', 0)}px",
      "--axm-glitch-intensity": str(glitch.get("intensity", 0)),
      "--axm-quality-tier": r.get("quality_tier", "balanced")
    }
    return {"kind":"web_css_variables", "variables":css, "class_name":"axm-text", "text_direction": r.get("glyph_audit", {}).get("direction", "neutral"), "fallback_requirements": r.get("glyph_audit", {}).get("fallback_requirements", [])}


def unity(plan: dict) -> dict:
    r = plan["resolved"]
    return {
      "kind":"unity_textmeshpro",
      "font_size": round(r["size_px"], 1),
      "font_weight": r["weight"],
      "character_spacing_em": r["tracking_em"],
      "use_sdf": r["rendering_strategy"] in {"SDF","MSDF"},
      "material_finish": r.get("material", "flat"),
      "quality_tier": r.get("quality_tier", "balanced"),
      "render_budget": r.get("render_budget", {}),
      "effect_tuning": r.get("preset_tuning", {}),
      "text_direction": r.get("glyph_audit", {}).get("direction", "neutral"),
      "fallback_requirements": r.get("glyph_audit", {}).get("fallback_requirements", []),
      "glitch": r["effects"].get("glitch", {}),
      "recommended_overflow":"Ellipsis" if plan["request"].get("max_lines") == 1 else "Overflow",
      "fallback_assets_required": True,
      "notes":["Keep tiny body text on native/hinted raster paths where possible.", "Create a static atlas for known UI strings; add dynamic fallbacks for unknown glyphs.", "Keep the clean TMP face layer intact and implement premium effects as material parameters."]
    }


def unreal(plan: dict) -> dict:
    r = plan["resolved"]
    return {
      "kind":"unreal_umg_slate",
      "font_size": round(r["size_px"], 1),
      "font_weight": r["weight"],
      "rasterization": r["rendering_strategy"],
      "material_finish": r.get("material", "flat"),
      "quality_tier": r.get("quality_tier", "balanced"),
      "render_budget": r.get("render_budget", {}),
      "effect_tuning": r.get("preset_tuning", {}),
      "text_direction": r.get("glyph_audit", {}).get("direction", "neutral"),
      "fallback_requirements": r.get("glyph_audit", {}).get("fallback_requirements", []),
      "glitch": r["effects"].get("glitch", {}),
      "use_composite_font": True,
      "auto_wrap": plan["request"].get("role") not in {"label","game_hud"},
      "notes":["Prefer runtime composite fonts for multilingual UI.", "Use SDF/MSDF mainly for large or heavily scaled text; small text benefits from direct rasterization.", "Drive premium effects with parameterized UI material instances."]
    }


def godot(plan: dict) -> dict:
    r = plan["resolved"]
    return {
      "kind":"godot_theme_override",
      "font_size": round(r["size_px"], 1),
      "outline_size": r["effects"]["outline"]["width_px"],
      "uppercase": r["uppercase"],
      "material_finish": r.get("material", "flat"),
      "quality_tier": r.get("quality_tier", "balanced"),
      "render_budget": r.get("render_budget", {}),
      "effect_tuning": r.get("preset_tuning", {}),
      "text_direction": r.get("glyph_audit", {}).get("direction", "neutral"),
      "fallback_requirements": r.get("glyph_audit", {}).get("fallback_requirements", []),
      "glitch": r["effects"].get("glitch", {}),
      "autowrap_mode":"word_smart",
      "notes":["Use Theme resources for reusable roles.", "Use font fallbacks for supported scripts and avoid fixed-height containers.", "Apply the canvas_item shader only to medium or large emphasis text."]
    }


def native_mobile(plan: dict) -> dict:
    r = plan["resolved"]
    return {
      "kind":"native_mobile",
      "semantic_role": plan["request"].get("role", "body"),
      "base_size": round(r["size_px"], 1),
      "material_finish": r.get("material", "flat"),
      "quality_tier": r.get("quality_tier", "balanced"),
      "render_budget": r.get("render_budget", {}),
      "effect_tuning": r.get("preset_tuning", {}),
      "text_direction": r.get("glyph_audit", {}).get("direction", "neutral"),
      "fallback_requirements": r.get("glyph_audit", {}).get("fallback_requirements", []),
      "dynamic_type_or_sp": True,
      "notes":["iOS: use semantic text styles or UIFontMetrics for custom fonts.", "Android: use sp and test large font scaling.", "Reserve premium effects for headers and banners, not dense controls."]
    }


def desktop(plan: dict) -> dict:
    r = plan["resolved"]
    return {
      "kind":"desktop_ui",
      "font_size": round(r["size_px"], 1),
      "material_finish": r.get("material", "flat"),
      "quality_tier": r.get("quality_tier", "balanced"),
      "render_budget": r.get("render_budget", {}),
      "effect_tuning": r.get("preset_tuning", {}),
      "text_direction": r.get("glyph_audit", {}).get("direction", "neutral"),
      "fallback_requirements": r.get("glyph_audit", {}).get("fallback_requirements", []),
      "use_platform_text_stack": True,
      "notes":["Prefer the native text renderer for small UI text.", "Respect OS text scaling and high-contrast settings.", "Keep premium effects mainly on display surfaces and launcher headers."]
    }


def route(plan: dict) -> dict:
    raw = plan["request"].get("platform", "web").lower()
    if raw in {"unity"}: return unity(plan)
    if raw in {"unreal","ue","ue5"}: return unreal(plan)
    if raw in {"godot"}: return godot(plan)
    if raw in {"android","ios","mobile","native_mobile"}: return native_mobile(plan)
    if raw in {"windows","macos","linux","desktop"}: return desktop(plan)
    if raw in {"game_pc","game_tv","console","handheld","world_space","vr","game"}:
        return {"kind":"generic_game", "unity":unity(plan), "unreal":unreal(plan), "godot":godot(plan)}
    return web(plan)
