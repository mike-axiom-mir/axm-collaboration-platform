from __future__ import annotations
from copy import deepcopy
import json
from .catalog import (
    roles as load_roles,
    scales as load_scales,
    recipes as load_recipes,
    font_stacks as load_font_stacks,
    presets as load_presets,
)
from .responsive import fluid_size, css_clamp
from .validation import validate_request, normalize_platform, contrast_diagnostic
from .adapters import route as route_adapter
from .budget import choose_quality_tier, apply_render_budget
from .glyphs import audit_text
from .font_inspector import audit_font_text, plan_font_stack
from .layout import audit_layout

ROLE_RECIPE_DEFAULTS = {
  "game_reward_title":"game_reward",
  "subtitle":"subtitle_protected",
  "data":"dense_data",
  "game_hud":"neon_signal"
}

MOOD_RECIPE = {
  "clean":"clean_software", "professional":"clean_software", "software":"clean_software",
  "luxury":"luxury_glass", "glass":"luxury_glass", "premium":"luxury_glass", "aetherglass":"luxury_glass",
  "neon":"neon_signal", "futuristic":"neon_signal", "night":"neon_signal",
  "paper":"paper_cartoon", "cartoon":"paper_cartoon", "comedy":"paper_cartoon",
  "danger":"danger_alert", "warning":"danger_alert", "critical":"danger_alert",
  "reward":"game_reward", "victory":"game_reward", "celebration":"game_reward",
  "subtitle":"subtitle_protected", "dialogue":"subtitle_protected",
  "data":"dense_data", "dashboard":"dense_data", "technical":"dense_data",
  "gold":"molten_gold", "silver":"silver_chrome", "chrome":"silver_chrome", "metal":"silver_chrome",
  "neon_metal":"neon_metal", "electric":"neon_metal", "special":"neon_metal",
  "holo":"holo_prism", "holographic":"holo_prism", "prism":"holo_prism", "rainbow":"holo_prism",
  "glitch":"readable_glitch", "cyber":"readable_glitch", "futuristic_glitch":"readable_glitch", "software_futuristic":"readable_glitch", "corrupted_signal":"readable_glitch"
}


def _float(value, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


class TextFabricEngine:
    def __init__(self):
        self.roles = load_roles()
        self.scales = load_scales()
        self.recipes = load_recipes()
        self.font_stacks = load_font_stacks()
        self.presets = {item["id"]: item for item in load_presets()}

    def choose_recipe(self, request: dict) -> tuple[str, list[str]]:
        trace = []
        explicit = request.get("recipe")
        if explicit and explicit in self.recipes:
            trace.append(f"Recipe '{explicit}' selected explicitly.")
            return explicit, trace
        mood = str(request.get("mood", "clean")).lower()
        if mood in MOOD_RECIPE:
            recipe = MOOD_RECIPE[mood]
            trace.append(f"Mood '{mood}' routed to recipe '{recipe}'.")
            return recipe, trace
        role = request.get("role", "body")
        if role in ROLE_RECIPE_DEFAULTS:
            recipe = ROLE_RECIPE_DEFAULTS[role]
            trace.append(f"Role '{role}' routed to default recipe '{recipe}'.")
            return recipe, trace
        trace.append("No specialized recipe matched; clean_software selected as safe default.")
        return "clean_software", trace

    def resolve_preset(self, preset_id: str, overrides: dict | None = None) -> dict:
        if preset_id not in self.presets:
            known = ", ".join(sorted(self.presets))
            raise KeyError(f"Unknown preset '{preset_id}'. Known presets: {known}")
        preset = deepcopy(self.presets[preset_id])
        request = {
            "text": preset.get("text", preset.get("label", "AXM Text")),
            "role": preset.get("role", "display"),
            "recipe": preset.get("recipe", "clean_software"),
            "platform": preset.get("platform", "web"),
            "background": preset.get("surface", "solid"),
            "importance": preset.get("importance", "normal"),
            "motion": "auto",
            "accessibility": "protected",
            "quality_tier": preset.get("quality_tier", "balanced"),
            "design_scale": preset.get("scale", 1.0),
            "force_uppercase": preset.get("uppercase"),
            "preset_tuning": {
                "glow": preset.get("glow", 1.0),
                "plate": preset.get("plate", 1.0),
                "sheen": preset.get("sheen", 1.0),
                "glitch": preset.get("glitch", 0.0),
            },
        }
        if overrides:
            request.update(overrides)
        plan = self.resolve(request)
        plan["preset"] = preset
        plan["preset_id"] = preset_id
        plan["decision_trace"].insert(0, f"Preset '{preset_id}' loaded as an explicit starting configuration.")
        return plan

    def resolve(self, request: dict) -> dict:
        request = deepcopy(request)
        request.setdefault("text", "")
        request.setdefault("role", "body")
        request.setdefault("mood", "clean")
        request.setdefault("platform", "web")
        request.setdefault("background", "solid")
        request.setdefault("importance", "normal")
        request.setdefault("motion", "auto")
        request.setdefault("accessibility", "protected")
        request.setdefault("user_scale", 1.0)
        request.setdefault("design_scale", 1.0)
        request.setdefault("viewport_width", 1440)
        request.setdefault("language_direction", "auto")
        request.setdefault("preset_tuning", {})
        request.setdefault("quality_tier", "auto")
        request.setdefault("font_coverage_policy", "warn")
        request.setdefault("font_index", 0)
        request.setdefault("layout_policy", "warn")
        request.setdefault("localization_expansion", 0.35)

        warnings = validate_request(request, self.roles)
        trace = []
        role_name = request["role"] if request["role"] in self.roles else "body"
        role = deepcopy(self.roles[role_name])
        trace.append(f"Semantic role '{role_name}' loaded.")

        recipe_name, recipe_trace = self.choose_recipe(request)
        trace.extend(recipe_trace)
        recipe = deepcopy(self.recipes[recipe_name])

        platform_profile_name = normalize_platform(request["platform"])
        profile = deepcopy(self.scales[platform_profile_name])
        trace.append(f"Platform '{request['platform']}' normalized to scale profile '{platform_profile_name}'.")

        role_min, role_max = role["size"]
        platform_floor = profile["base_min"]
        uplift = profile.get("scale", 1.0)
        min_px = max(role_min, platform_floor if role_name in {"body","body_large","subtitle","game_hud"} else role_min)
        max_px = max(role_max, min_px)
        user_scale = _float(request.get("user_scale"), 1.0)
        design_scale = max(0.5, min(2.5, _float(request.get("design_scale"), 1.0)))
        total_scale = uplift * user_scale * design_scale
        size_px = fluid_size(min_px, max_px, int(request["viewport_width"]), profile["viewport_min"], profile["viewport_max"], total_scale)
        css_size = css_clamp(min_px * total_scale, max_px * total_scale, profile["viewport_min"], profile["viewport_max"])
        trace.append(f"Resolved size {size_px}px from role range, platform uplift, design scale, viewport, and user scale.")

        weight = int(role.get("weight", 500))
        if request["importance"] == "high":
            weight = min(900, weight + 40)
            trace.append("High importance increased weight by 40.")
        elif request["importance"] == "critical":
            weight = min(900, weight + 80)
            trace.append("Critical importance increased weight by 80.")

        effects = {
          "plate": deepcopy(recipe["plate"]),
          "outline": deepcopy(recipe["outline"]),
          "shadow": deepcopy(recipe["shadow"]),
          "glow": deepcopy(recipe["glow"]),
          "inner_glow": deepcopy(recipe.get("inner_glow", {})),
          "bevel": deepcopy(recipe.get("bevel", {})),
          "sheen": deepcopy(recipe.get("sheen", {})),
          "sparkle": deepcopy(recipe.get("sparkle", {})),
          "glitch": deepcopy(recipe.get("glitch", {}))
        }

        tuning = deepcopy(request.get("preset_tuning", {}))
        glow_strength = max(0.0, min(2.5, _float(tuning.get("glow"), 1.0)))
        plate_strength = max(0.0, min(1.5, _float(tuning.get("plate"), 1.0)))
        sheen_strength = max(0.0, min(2.0, _float(tuning.get("sheen"), 1.0)))
        glitch_strength = max(0.0, min(1.5, _float(tuning.get("glitch"), effects.get("glitch", {}).get("intensity", 0.0))))
        if effects.get("glow"):
            effects["glow"]["opacity"] = _float(effects["glow"].get("opacity"), 0.0) * glow_strength
            effects["glow"]["intensity_multiplier"] = glow_strength
            if glow_strength == 0:
                effects["glow"]["blur_px"] = 0
        effects["plate"]["opacity_multiplier"] = plate_strength
        if effects.get("sheen"):
            effects["sheen"]["intensity_multiplier"] = sheen_strength
            effects["sheen"]["enabled"] = bool(effects["sheen"].get("enabled")) and sheen_strength > 0
        if glitch_strength > 0 and not effects.get("glitch"):
            effects["glitch"] = {
                "enabled": True,
                "intensity": glitch_strength,
                "red": "rgba(255,72,140,.55)",
                "cyan": "rgba(45,240,255,.65)",
                "offset_px": 2,
                "jitter_px": 1,
                "scanline_opacity": 0.06,
            }
        elif effects.get("glitch"):
            effects["glitch"]["intensity"] = glitch_strength
            effects["glitch"]["enabled"] = glitch_strength > 0

        if request["background"] in {"dynamic","image","video"}:
            effects["plate"]["color"] = effects["plate"].get("color", "rgba(0,0,0,.65)")
            effects["plate"]["enabled"] = True
            effects["outline"]["width_px"] = max(1.25, float(effects["outline"].get("width_px", 0)))
            trace.append("Dynamic background protection enabled plate and minimum outline.")
        else:
            effects["plate"].setdefault("enabled", True)

        strict = request["accessibility"] == "strict"
        fg = request.get("foreground_color") or recipe.get("fill", "#FFFFFF")
        bg = request.get("background_color") or recipe.get("background", "#111111")
        contrast = contrast_diagnostic(fg, bg, size_px, weight, strict)
        if not contrast["passes"]:
            warnings.append({"code":"LOW_CONTRAST", "severity":"warning", "message":f"Contrast {contrast['ratio']}:1 is below required {contrast['required']}:1; protective plate is mandatory."})
            effects["plate"]["enabled"] = True
            effects["plate"]["color"] = "rgba(0,0,0,.82)" if fg.upper() != "#000000" else "rgba(255,255,255,.88)"
            effects["outline"]["width_px"] = max(1.5, float(effects["outline"].get("width_px", 0)))
            trace.append("Contrast guardian strengthened plate and outline.")

        if size_px < 18:
            rendering = "hinted_native_raster"
        elif role_name in {"display","game_reward_title","game_hud"} or platform_profile_name in {"world_space","game_tv"}:
            rendering = "MSDF" if size_px >= 36 else "SDF"
        else:
            rendering = "native_raster"
        trace.append(f"Rendering strategy '{rendering}' selected from size, role, and transform risk.")

        motion = recipe.get("motion", "none") if request["motion"] == "auto" else request["motion"]
        if request.get("reduced_motion") is True:
            motion = "none"
            if effects.get("sheen"):
                effects["sheen"]["enabled"] = False
            if effects.get("glitch"):
                effects["glitch"]["jitter_px"] = 0
            trace.append("Reduced-motion request disabled animation.")

        glitch = effects.get("glitch", {})
        if glitch:
            if role_name in {"body","body_large","caption","subtitle"} or size_px < 24:
                glitch["enabled"] = False
                glitch["offset_px"] = 0
                glitch["jitter_px"] = 0
                trace.append("Glitch safety reduced effect for small or dense text.")
            elif glitch.get("enabled"):
                glitch["offset_px"] = min(int(glitch.get("offset_px", 2)), 3)
                glitch["jitter_px"] = min(int(glitch.get("jitter_px", 1)), 2)
                trace.append("Glitch safety kept a restrained readable glitch profile.")

        quality_tier = choose_quality_tier(request.get("quality_tier"), request.get("platform", "web"))
        effects, motion, render_budget, budget_trace = apply_render_budget(
            effects, motion, quality_tier, role_name, size_px
        )
        trace.append(f"Render cost budget '{quality_tier}' applied; estimated cost {render_budget['estimated_cost']['label']} ({render_budget['estimated_cost']['points']} points).")
        trace.extend(budget_trace)

        glyph_audit = audit_text(request.get("text", ""))
        warnings.extend(glyph_audit.get("warnings", []))
        if glyph_audit.get("direction") in {"rtl", "mixed"} and effects.get("glitch", {}).get("enabled"):
            effects["glitch"]["jitter_px"] = 0
            effects["glitch"]["offset_px"] = min(float(effects["glitch"].get("offset_px", 0)), 1.5)
            trace.append("Glyph safety reduced animated glitch for RTL or mixed-direction text.")
        if glyph_audit.get("significant_scripts"):
            trace.append("Glyph audit detected scripts: " + ", ".join(glyph_audit["significant_scripts"]) + ".")

        layout_audit = audit_layout(
            request,
            role_name=role_name,
            size_px=size_px,
            line_height=role["line_height"],
            tracking_em=role["tracking_em"],
            max_ch=role["max_ch"],
            direction=glyph_audit.get("direction", "ltr"),
        )
        layout_policy = str(request.get("layout_policy", "warn")).lower()
        if layout_policy != "off":
            warnings.extend(layout_audit.get("warnings", []))
            trace.append(f"Layout resilience audit completed with status '{layout_audit['status']}' and worst case '{layout_audit['worst_case']}'.")
            if layout_policy == "strict" and layout_audit.get("status") == "critical":
                raise ValueError(f"Strict layout policy failed: worst case '{layout_audit.get('worst_case')}' exceeds the configured layout budget.")

        font_file_audit = None
        font_file = request.get("font_file")
        font_policy = str(request.get("font_coverage_policy", "warn")).lower()
        if font_file and font_policy != "off":
            try:
                font_file_audit = audit_font_text(font_file, request.get("text", ""), int(request.get("font_index", 0)))
                warnings.extend(font_file_audit.get("warnings", []))
                font_name = font_file_audit.get("font", {}).get("names", {}).get("full_name") or font_file_audit.get("font", {}).get("file_name")
                trace.append(f"Actual font coverage audited against '{font_name}'.")
                if font_file_audit.get("missing_character_count", 0):
                    trace.append(f"Primary font audit found {font_file_audit['missing_character_count']} missing required characters; fallback planning may still complete coverage.")
            except (OSError, ValueError) as exc:
                if font_policy == "strict":
                    raise
                warnings.append({"code":"FONT_AUDIT_FAILED", "severity":"error", "message":str(exc)})
                trace.append("Actual font coverage audit failed and was recorded as a warning.")

        font_stack_plan = None
        font_registry = request.get("font_registry")
        if font_registry and font_policy != "off":
            try:
                font_stack_plan = plan_font_stack(font_registry, request.get("text", ""))
                warnings.extend(font_stack_plan.get("warnings", []))
                trace.append(f"Fallback planner selected {font_stack_plan.get('selected_font_count', 0)} registered font faces.")
                if font_stack_plan.get("complete") and font_file_audit and font_file_audit.get("missing_character_count", 0):
                    for warning in warnings:
                        if warning.get("code") == "FONT_MISSING_GLYPHS":
                            warning["severity"] = "info"
                            warning["message"] += " The registered fallback stack covers the missing characters."
                    trace.append("Fallback stack completed the primary font's missing glyph coverage.")
                if not font_stack_plan.get("complete") and font_policy == "strict":
                    missing = ", ".join(item["codepoint"] for item in font_stack_plan.get("missing", [])[:12])
                    raise ValueError(f"Strict font registry coverage failed. Missing: {missing}")
            except (OSError, ValueError, json.JSONDecodeError) as exc:
                if font_policy == "strict":
                    raise
                warnings.append({"code":"FONT_REGISTRY_FAILED", "severity":"error", "message":str(exc)})
                trace.append("Font fallback planning failed and was recorded as a warning.")

        if font_policy == "strict" and font_file_audit and font_file_audit.get("missing_character_count", 0) and not (font_stack_plan and font_stack_plan.get("complete")):
            font_name = font_file_audit.get("font", {}).get("names", {}).get("full_name") or font_file_audit.get("font", {}).get("file_name")
            missing = ", ".join(item["codepoint"] for item in font_file_audit.get("missing", [])[:12])
            raise ValueError(f"Strict font coverage failed for '{font_name}'. Missing: {missing}")

        stack_key = request.get("font_stack") or recipe.get("font_stack", "system_ui")
        font_family = self.font_stacks.get(stack_key, stack_key)
        default_uppercase = bool(role.get("uppercase", recipe.get("uppercase", False)))
        force_uppercase = request.get("force_uppercase")
        uppercase = default_uppercase if force_uppercase is None else bool(force_uppercase)

        resolved = {
          "role": role_name,
          "recipe": recipe_name,
          "font_family": font_family,
          "size_px": size_px,
          "css_size": css_size,
          "weight": weight,
          "line_height": role["line_height"],
          "tracking_em": role["tracking_em"],
          "max_ch": role["max_ch"],
          "uppercase": uppercase,
          "numeric": role.get("numeric", recipe.get("numeric", "proportional")),
          "fill": fg,
          "gradient": recipe.get("gradient"),
          "surface": recipe.get("surface", "flat"),
          "material": recipe.get("surface", "flat"),
          "effects": effects,
          "preset_tuning": {
              "glow": glow_strength,
              "plate": plate_strength,
              "sheen": sheen_strength,
              "glitch": glitch_strength,
          },
          "motion": motion,
          "quality_tier": quality_tier,
          "render_budget": render_budget,
          "rendering_strategy": rendering,
          "language_direction": request.get("language_direction", "auto"),
          "contrast": contrast,
          "glyph_audit": glyph_audit,
          "layout_audit": layout_audit,
          "font_file_audit": font_file_audit,
          "font_stack_plan": font_stack_plan,
          "safeguards": {
            "supports_user_scale": True,
            "reserve_localization_expansion": 0.35,
            "avoid_fixed_height_containers": True,
            "fallback_fonts_required": bool(glyph_audit.get("fallback_requirements")) or True,
            "fallback_requirements": glyph_audit.get("fallback_requirements", []),
            "test_worst_background": request["background"] in {"dynamic","image","video"}
          }
        }
        plan = {"request":request, "resolved":resolved, "warnings":warnings, "decision_trace":trace}
        plan["adapter"] = route_adapter(plan)
        return plan
