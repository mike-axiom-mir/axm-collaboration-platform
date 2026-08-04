from __future__ import annotations
from copy import deepcopy

TIERS = {"low", "balanced", "high", "cinematic"}


def choose_quality_tier(requested: str | None, platform: str) -> str:
    value = str(requested or "auto").lower()
    if value in TIERS:
        return value
    raw = str(platform or "web").lower()
    if raw in {"mobile", "android", "ios", "native_mobile", "handheld"}:
        return "low"
    if raw in {"game_tv", "game_pc", "unity", "unreal", "ue", "ue5", "godot", "desktop", "windows", "macos", "linux"}:
        return "balanced"
    return "balanced"


def estimate_cost(effects: dict, motion: str) -> dict:
    points = 0
    glow = effects.get("glow", {})
    points += int(float(glow.get("blur_px", 0)) / 6)
    points += int(float(glow.get("opacity", 0)) * 5)
    points += len(effects.get("shadow", []))
    plate = effects.get("plate", {})
    points += int(float(plate.get("blur_px", 0)) / 6)
    if effects.get("sheen", {}).get("enabled"):
        points += 2
    if effects.get("bevel", {}).get("enabled"):
        points += 1
    if effects.get("sparkle", {}).get("enabled"):
        points += 2
    if effects.get("glitch", {}).get("enabled"):
        points += 2
        points += int(float(effects["glitch"].get("jitter_px", 0)))
    if motion != "none":
        points += 2
    label = "low" if points <= 4 else "moderate" if points <= 8 else "high" if points <= 12 else "very_high"
    return {"points": points, "label": label}


def apply_render_budget(effects: dict, motion: str, tier: str, role: str, size_px: float) -> tuple[dict, str, dict, list[str]]:
    tier = choose_quality_tier(tier, "")
    out = deepcopy(effects)
    changes: list[str] = []

    glow = out.get("glow", {})
    plate = out.get("plate", {})
    sheen = out.get("sheen", {})
    sparkle = out.get("sparkle", {})
    glitch = out.get("glitch", {})
    shadows = out.get("shadow", [])

    if tier == "low":
        if glow:
            old = float(glow.get("blur_px", 0)); glow["blur_px"] = min(old, 12)
            glow["opacity"] = min(float(glow.get("opacity", 0)), 0.22)
            if glow["blur_px"] != old: changes.append("Glow blur capped for low tier.")
        old_blur = float(plate.get("blur_px", 0)); plate["blur_px"] = min(old_blur, 4)
        if plate["blur_px"] != old_blur: changes.append("Plate blur reduced for low tier.")
        if len(shadows) > 1:
            out["shadow"] = shadows[:1]; changes.append("Shadow stack reduced to one layer.")
        if sheen.get("enabled"):
            sheen["enabled"] = False; changes.append("Animated sheen disabled for low tier.")
        if sparkle.get("enabled"):
            sparkle["enabled"] = False; changes.append("Sparkle disabled for low tier.")
        if glitch.get("enabled"):
            glitch["offset_px"] = min(float(glitch.get("offset_px", 0)), 1)
            glitch["jitter_px"] = 0
            glitch["scanline_opacity"] = min(float(glitch.get("scanline_opacity", 0)), 0.03)
            changes.append("Glitch reduced to a minimal static channel split.")
        if motion != "none":
            motion = "none"; changes.append("Motion disabled for low tier.")
        if size_px < 36 and out.get("bevel", {}).get("enabled"):
            out["bevel"]["enabled"] = False; changes.append("Bevel disabled below hero size on low tier.")

    elif tier == "balanced":
        if glow:
            glow["blur_px"] = min(float(glow.get("blur_px", 0)), 22)
            glow["opacity"] = min(float(glow.get("opacity", 0)), 0.38)
        plate["blur_px"] = min(float(plate.get("blur_px", 0)), 12)
        if len(shadows) > 2:
            out["shadow"] = shadows[:2]; changes.append("Shadow stack capped at two layers.")
        if sheen:
            sheen["intensity_multiplier"] = min(float(sheen.get("intensity_multiplier", 1)), 1.0)
        if glitch.get("enabled"):
            glitch["offset_px"] = min(float(glitch.get("offset_px", 0)), 2)
            glitch["jitter_px"] = min(float(glitch.get("jitter_px", 0)), 1)

    elif tier == "high":
        if glow:
            glow["blur_px"] = min(float(glow.get("blur_px", 0)), 34)
            glow["opacity"] = min(float(glow.get("opacity", 0)), 0.55)
        plate["blur_px"] = min(float(plate.get("blur_px", 0)), 20)
        if glitch.get("enabled"):
            glitch["offset_px"] = min(float(glitch.get("offset_px", 0)), 3)
            glitch["jitter_px"] = min(float(glitch.get("jitter_px", 0)), 2)

    # Cinematic intentionally keeps authored values.
    cost = estimate_cost(out, motion)
    budget = {"quality_tier": tier, "estimated_cost": cost, "degradations": changes}
    return out, motion, budget, changes
