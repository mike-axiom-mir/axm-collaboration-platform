from __future__ import annotations
from .contrast import contrast_ratio, required_ratio

PLATFORM_ALIASES = {
    "web":"web", "website":"web", "browser":"web",
    "mobile":"mobile", "android":"mobile", "ios":"mobile", "native_mobile":"mobile",
    "desktop":"desktop", "windows":"desktop", "macos":"desktop", "linux":"desktop",
    "game":"game_pc", "game_pc":"game_pc", "pc_game":"game_pc",
    "game_tv":"game_tv", "console":"game_tv", "tv":"game_tv",
    "handheld":"handheld", "world_space":"world_space", "vr":"world_space"
}

def normalize_platform(value: str) -> str:
    return PLATFORM_ALIASES.get((value or "web").lower(), "web")

def validate_request(request: dict, roles: dict) -> list[dict]:
    warnings = []
    text = str(request.get("text", ""))
    role = request.get("role", "body")
    if not text.strip():
        warnings.append({"code":"EMPTY_TEXT", "severity":"error", "message":"Text is empty."})
    if role not in roles:
        warnings.append({"code":"UNKNOWN_ROLE", "severity":"warning", "message":f"Unknown role {role!r}; body will be used."})
    if len(text) > 80 and role in {"display","h1","game_reward_title","game_hud","label"}:
        warnings.append({"code":"ROLE_TOO_LONG", "severity":"warning", "message":"This role is intended for short text; split or downgrade the role."})
    if text.isupper() and len(text) > 48:
        warnings.append({"code":"LONG_ALL_CAPS", "severity":"warning", "message":"Long all-caps text is harder to scan. Reserve it for short labels or impact titles."})
    if request.get("background") in {"dynamic","image","video"}:
        warnings.append({"code":"DYNAMIC_BACKGROUND", "severity":"info", "message":"Use a local plate/scrim and test against the worst visible frame."})
    if float(request.get("user_scale", 1.0)) >= 2.0:
        warnings.append({"code":"SCALE_STRESS", "severity":"info", "message":"Verify no clipping or two-axis scrolling at 200% scale."})
    return warnings

def contrast_diagnostic(fg: str, bg: str, size_px: float, weight: int, strict: bool=False) -> dict:
    ratio = round(contrast_ratio(fg, bg), 2)
    required = required_ratio(size_px, weight, strict)
    return {"ratio":ratio, "required":required, "passes":ratio >= required}
