from __future__ import annotations

def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * max(0.0, min(1.0, t))

def fluid_size(min_px: float, max_px: float, viewport: int, vp_min: int, vp_max: int, scale: float = 1.0) -> float:
    if vp_max <= vp_min:
        return round(max_px * scale, 2)
    t = (viewport - vp_min) / (vp_max - vp_min)
    return round(lerp(min_px, max_px, t) * scale, 2)

def css_clamp(min_px: float, max_px: float, vp_min: int, vp_max: int) -> str:
    if vp_max <= vp_min or max_px <= min_px:
        return f"{max_px:.2f}px"
    slope = (max_px - min_px) / (vp_max - vp_min) * 100
    intercept = min_px - slope * vp_min / 100
    return f"clamp({min_px:.2f}px, {intercept:.3f}px + {slope:.4f}vw, {max_px:.2f}px)"
