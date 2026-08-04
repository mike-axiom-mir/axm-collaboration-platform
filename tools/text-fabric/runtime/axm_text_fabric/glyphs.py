from __future__ import annotations

from collections import Counter
import unicodedata


BIDI_CONTROLS = {
    0x061C, 0x200E, 0x200F,
    0x202A, 0x202B, 0x202C, 0x202D, 0x202E,
    0x2066, 0x2067, 0x2068, 0x2069,
}


def _in(cp: int, start: int, end: int) -> bool:
    return start <= cp <= end


def script_of(char: str) -> str:
    cp = ord(char)
    if char.isspace() or unicodedata.category(char).startswith(("P", "N")):
        return "Common"
    if _in(cp, 0x0041, 0x024F) or _in(cp, 0x1E00, 0x1EFF):
        return "Latin"
    if _in(cp, 0x0370, 0x03FF) or _in(cp, 0x1F00, 0x1FFF):
        return "Greek"
    if _in(cp, 0x0400, 0x052F) or _in(cp, 0x2DE0, 0x2DFF) or _in(cp, 0xA640, 0xA69F):
        return "Cyrillic"
    if _in(cp, 0x0590, 0x05FF):
        return "Hebrew"
    if _in(cp, 0x0600, 0x06FF) or _in(cp, 0x0750, 0x077F) or _in(cp, 0x08A0, 0x08FF) or _in(cp, 0xFB50, 0xFDFF) or _in(cp, 0xFE70, 0xFEFF):
        return "Arabic"
    if _in(cp, 0x0900, 0x097F):
        return "Devanagari"
    if _in(cp, 0x0E00, 0x0E7F):
        return "Thai"
    if _in(cp, 0x3040, 0x309F):
        return "Hiragana"
    if _in(cp, 0x30A0, 0x30FF) or _in(cp, 0x31F0, 0x31FF):
        return "Katakana"
    if _in(cp, 0xAC00, 0xD7AF) or _in(cp, 0x1100, 0x11FF):
        return "Hangul"
    if _in(cp, 0x3400, 0x4DBF) or _in(cp, 0x4E00, 0x9FFF) or _in(cp, 0xF900, 0xFAFF):
        return "Han"
    if _in(cp, 0x1F000, 0x1FAFF) or _in(cp, 0x2600, 0x27BF):
        return "Emoji/Symbol"
    category = unicodedata.category(char)
    if category.startswith("M"):
        return "Combining Mark"
    return "Other"


def _fallback_requirements(scripts: set[str]) -> list[dict]:
    requirements = []
    guidance = {
        "Latin": "system UI or licensed project Latin family",
        "Greek": "Greek-capable project font or global fallback",
        "Cyrillic": "Cyrillic-capable project font or global fallback",
        "Hebrew": "Hebrew-capable project font with RTL shaping",
        "Arabic": "Arabic-capable shaping font and RTL layout path",
        "Devanagari": "Devanagari-capable shaping font",
        "Thai": "Thai-capable font with mark positioning",
        "Hiragana": "Japanese fallback font",
        "Katakana": "Japanese fallback font",
        "Han": "CJK fallback selected for the target locale",
        "Hangul": "Korean fallback font",
        "Emoji/Symbol": "emoji/symbol fallback asset",
        "Other": "global fallback plus missing-glyph QA",
    }
    for script in sorted(scripts):
        if script in {"Common", "Combining Mark"}:
            continue
        requirements.append({"script": script, "guidance": guidance.get(script, guidance["Other"])})
    return requirements


def audit_text(text: str) -> dict:
    value = str(text or "")
    scripts = Counter()
    categories = Counter()
    directions = Counter()
    controls = []
    bidi_controls = []
    private_use = []
    replacement_positions = []
    combining_marks = 0

    for index, char in enumerate(value):
        cp = ord(char)
        script = script_of(char)
        scripts[script] += 1
        category = unicodedata.category(char)
        categories[category] += 1
        bidi = unicodedata.bidirectional(char) or "NONE"
        directions[bidi] += 1
        if category == "Cc" and char not in {"\n", "\r", "\t"}:
            controls.append({"index": index, "codepoint": f"U+{cp:04X}"})
        if cp in BIDI_CONTROLS:
            bidi_controls.append({"index": index, "codepoint": f"U+{cp:04X}", "name": unicodedata.name(char, "BIDI CONTROL")})
        if category == "Co":
            private_use.append({"index": index, "codepoint": f"U+{cp:04X}"})
        if cp == 0xFFFD:
            replacement_positions.append(index)
        if category.startswith("M"):
            combining_marks += 1

    significant_scripts = {name for name, count in scripts.items() if count and name not in {"Common", "Combining Mark"}}
    rtl_count = sum(directions[key] for key in ("R", "AL", "AN"))
    ltr_count = directions["L"]
    mixed_direction = rtl_count > 0 and ltr_count > 0
    warnings = []
    if replacement_positions:
        warnings.append({"code": "REPLACEMENT_CHARACTER", "severity": "error", "message": "Replacement characters were found; source text may already have lost glyph data."})
    if bidi_controls:
        warnings.append({"code": "BIDI_CONTROL", "severity": "warning", "message": "Explicit bidirectional control characters are present; verify they are intentional."})
    if private_use:
        warnings.append({"code": "PRIVATE_USE_GLYPH", "severity": "warning", "message": "Private-use characters require a specific project font or icon mapping."})
    if controls:
        warnings.append({"code": "HIDDEN_CONTROL", "severity": "warning", "message": "Non-printing control characters are present."})
    if mixed_direction:
        warnings.append({"code": "MIXED_DIRECTION", "severity": "info", "message": "Text mixes LTR and RTL direction; test cursor order, alignment, truncation, and channel-split effects."})
    if len(significant_scripts) > 1:
        warnings.append({"code": "MIXED_SCRIPTS", "severity": "info", "message": "Multiple scripts require coordinated fallback metrics and baseline testing."})

    direction = "mixed" if mixed_direction else "rtl" if rtl_count > 0 else "ltr" if ltr_count > 0 else "neutral"
    risk = "high" if replacement_positions or bidi_controls else "moderate" if private_use or controls or len(significant_scripts) > 1 or mixed_direction else "low"
    return {
        "length": len(value),
        "scripts": dict(sorted(scripts.items())),
        "significant_scripts": sorted(significant_scripts),
        "direction": direction,
        "mixed_direction": mixed_direction,
        "combining_mark_count": combining_marks,
        "bidi_controls": bidi_controls,
        "hidden_controls": controls,
        "private_use": private_use,
        "replacement_character_positions": replacement_positions,
        "fallback_requirements": _fallback_requirements(significant_scripts),
        "risk": risk,
        "warnings": warnings,
    }
