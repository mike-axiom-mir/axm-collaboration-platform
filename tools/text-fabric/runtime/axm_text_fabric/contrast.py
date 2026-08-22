from __future__ import annotations
import re

_HEX = re.compile(r"^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$")

def parse_hex(value: str) -> tuple[int, int, int]:
    if not isinstance(value, str) or not _HEX.match(value):
        raise ValueError(f"Expected #RGB or #RRGGBB, got {value!r}")
    raw = value[1:]
    if len(raw) == 3:
        raw = ''.join(ch * 2 for ch in raw)
    return tuple(int(raw[i:i+2], 16) for i in (0, 2, 4))

def _linear(channel: int) -> float:
    c = channel / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def luminance(color: str) -> float:
    r, g, b = parse_hex(color)
    return 0.2126 * _linear(r) + 0.7152 * _linear(g) + 0.0722 * _linear(b)

def contrast_ratio(foreground: str, background: str) -> float:
    a, b = luminance(foreground), luminance(background)
    lighter, darker = max(a, b), min(a, b)
    return (lighter + 0.05) / (darker + 0.05)

def required_ratio(size_px: float, weight: int, strict: bool = False) -> float:
    is_large = size_px >= 24 or (size_px >= 18.66 and weight >= 700)
    if strict:
        return 4.5 if is_large else 7.0
    return 3.0 if is_large else 4.5
