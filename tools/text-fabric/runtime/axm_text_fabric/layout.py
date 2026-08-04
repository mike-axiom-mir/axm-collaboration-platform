from __future__ import annotations

import html
import json
import re
import shutil
import unicodedata
from pathlib import Path
from typing import Iterable

TOKEN_RE = re.compile(r"(\{\{[^{}]+\}\}|\{[^{}]+\}|%\d*\$?[a-zA-Z]|<[^>]+>|https?://\S+|\b\w+@\w+(?:\.\w+)+\b)")
ACCENT_MAP = str.maketrans({
    "a":"á","b":"ƀ","c":"ç","d":"ď","e":"ë","f":"ƒ","g":"ğ","h":"ħ","i":"ï","j":"ĵ","k":"ķ","l":"ľ","m":"ṁ","n":"ñ","o":"ö","p":"þ","q":"ʠ","r":"ř","s":"š","t":"ŧ","u":"ü","v":"ṽ","w":"ŵ","x":"ẋ","y":"ÿ","z":"ž",
    "A":"Á","B":"Ƀ","C":"Ç","D":"Ď","E":"Ë","F":"Ƒ","G":"Ğ","H":"Ħ","I":"Ï","J":"Ĵ","K":"Ķ","L":"Ľ","M":"Ṁ","N":"Ñ","O":"Ö","P":"Þ","Q":"Ɋ","R":"Ř","S":"Š","T":"Ŧ","U":"Ü","V":"Ṽ","W":"Ŵ","X":"Ẋ","Y":"Ÿ","Z":"Ž",
})
MIRROR = str.maketrans({"(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{", "<": ">", ">": "<", "/": "\\", "\\": "/"})

ROLE_DEFAULT_LINES = {
    "display": 2, "h1": 2, "h2": 2, "h3": 3,
    "body_large": 5, "body": 6, "label": 1, "caption": 3,
    "data": 1, "game_reward_title": 2, "game_hud": 1, "subtitle": 2,
}

PLATFORM_SAFE_AREA = {
    "game_tv": 0.10, "console": 0.10, "tv": 0.10,
    "handheld": 0.05, "mobile": 0.05, "android": 0.05, "ios": 0.05,
    "world_space": 0.08, "vr": 0.08,
    "web": 0.03, "desktop": 0.03, "windows": 0.03, "macos": 0.03, "linux": 0.03,
}

PLATFORM_MIN_SIZE = {
    "game_tv": 24.0, "console": 24.0, "tv": 24.0,
    "handheld": 16.0, "mobile": 16.0, "android": 16.0, "ios": 16.0,
    "world_space": 28.0, "vr": 28.0,
    "web": 14.0, "desktop": 14.0,
}


def _protected_transform(text: str, transform) -> str:
    parts = TOKEN_RE.split(text)
    return "".join(part if TOKEN_RE.fullmatch(part or "") else transform(part) for part in parts)


def pseudo_localize(text: str, mode: str = "expanded", expansion: float = 0.35) -> str:
    mode = str(mode or "expanded").lower()
    expansion = max(0.0, min(1.5, float(expansion)))
    if mode in {"original", "none"}:
        return text
    if mode in {"accent", "accented"}:
        return "［" + _protected_transform(text, lambda s: s.translate(ACCENT_MAP)) + "］"
    if mode in {"expand", "expanded"}:
        accented = _protected_transform(text, lambda s: s.translate(ACCENT_MAP))
        visible = [ch for ch in accented if not ch.isspace()]
        target_extra = max(1, round(len(visible) * expansion)) if visible else 0
        return f"［{accented} {'~' * target_extra}］"
    if mode in {"rtl", "pseudo_rtl"}:
        words = re.split(r"(\s+)", text)
        reversed_words = []
        for part in reversed(words):
            if part.isspace() or TOKEN_RE.fullmatch(part or ""):
                reversed_words.append(part)
            else:
                reversed_words.append(part.translate(MIRROR))
        return "⟦ " + "".join(reversed_words).strip() + " ⟧"
    if mode in {"compact", "narrow"}:
        return re.sub(r"\s+", " ", text).strip()
    raise ValueError(f"Unknown pseudo-localization mode '{mode}'.")


def build_pseudolocale_samples(text: str, expansion: float = 0.35) -> dict:
    return {
        "original": text,
        "accented": pseudo_localize(text, "accented", expansion),
        "expanded": pseudo_localize(text, "expanded", expansion),
        "rtl": pseudo_localize(text, "rtl", expansion),
    }


def character_units(text: str) -> float:
    total = 0.0
    for ch in text:
        if ch in "\r\n" or unicodedata.combining(ch):
            continue
        if ch.isspace():
            total += 0.45
            continue
        width = unicodedata.east_asian_width(ch)
        if width in {"W", "F"}:
            total += 1.85
        elif unicodedata.category(ch).startswith("P"):
            total += 0.55
        elif ch.isupper():
            total += 1.02
        elif ch.isdigit():
            total += 0.9
        else:
            total += 0.86
    return total


def _text_width_px(text: str, size_px: float, tracking_em: float = 0.0) -> float:
    glyphs = sum(1 for ch in text if not ch.isspace() and not unicodedata.combining(ch))
    return character_units(text) * size_px * 0.56 + max(0, glyphs - 1) * size_px * tracking_em


def _wrap_lines(text: str, available_width_px: float, size_px: float, tracking_em: float) -> list[str]:
    lines: list[str] = []
    for paragraph in text.splitlines() or [""]:
        if paragraph == "":
            lines.append("")
            continue
        tokens = re.findall(r"\S+|\s+", paragraph)
        current = ""
        for token in tokens:
            candidate = current + token
            if current and not token.isspace() and _text_width_px(candidate.strip(), size_px, tracking_em) > available_width_px:
                lines.append(current.rstrip())
                current = token.lstrip()
                if _text_width_px(current, size_px, tracking_em) > available_width_px:
                    chunk = ""
                    for ch in current:
                        if chunk and _text_width_px(chunk + ch, size_px, tracking_em) > available_width_px:
                            lines.append(chunk)
                            chunk = ch
                        else:
                            chunk += ch
                    current = chunk
            else:
                current = candidate
        lines.append(current.rstrip())
    return lines or [""]


def estimate_layout(text: str, *, size_px: float, line_height: float, tracking_em: float, container_width_px: float, safe_area_ratio: float, max_lines: int) -> dict:
    safe_area_ratio = max(0.0, min(0.25, safe_area_ratio))
    usable = max(1.0, container_width_px * (1.0 - safe_area_ratio * 2.0))
    lines = _wrap_lines(text, usable, size_px, tracking_em)
    widths = [_text_width_px(line, size_px, tracking_em) for line in lines]
    widest = max(widths or [0.0])
    line_count = len(lines)
    height_px = line_count * size_px * line_height
    width_ratio = widest / usable if usable else 999.0
    overflow = line_count > max_lines or width_ratio > 1.02
    severity = "critical" if line_count > max_lines + 1 or width_ratio > 1.20 else "warning" if overflow else "pass"
    return {
        "container_width_px": round(container_width_px, 2),
        "safe_area_ratio": round(safe_area_ratio, 4),
        "usable_width_px": round(usable, 2),
        "estimated_line_count": line_count,
        "max_lines": max_lines,
        "estimated_widest_line_px": round(widest, 2),
        "estimated_height_px": round(height_px, 2),
        "width_utilization": round(width_ratio, 4),
        "overflow_risk": overflow,
        "severity": severity,
        "line_samples": lines[:8],
    }


def audit_layout(request: dict, *, role_name: str, size_px: float, line_height: float, tracking_em: float, max_ch: int, direction: str = "ltr") -> dict:
    text = str(request.get("text", ""))
    platform = str(request.get("platform", "web")).lower()
    viewport_width = float(request.get("viewport_width", 1440))
    explicit_width = request.get("container_width_px")
    max_measure = max_ch * size_px * 0.56
    container_width = float(explicit_width) if explicit_width is not None else min(viewport_width, max_measure + size_px * 2.0)
    safe_area = float(request.get("safe_area_ratio", PLATFORM_SAFE_AREA.get(platform, 0.03)))
    max_lines = int(request.get("max_lines") or ROLE_DEFAULT_LINES.get(role_name, 3))
    expansion = float(request.get("localization_expansion", 0.35))
    min_size = PLATFORM_MIN_SIZE.get(platform, 14.0)
    modes = build_pseudolocale_samples(text, expansion)
    scenarios = {}
    for mode, value in modes.items():
        scenarios[mode] = estimate_layout(value, size_px=size_px, line_height=line_height, tracking_em=tracking_em, container_width_px=container_width, safe_area_ratio=safe_area, max_lines=max_lines)
        scenarios[mode]["text"] = value
        scenarios[mode]["direction"] = "rtl" if mode == "rtl" else direction

    warnings = []
    if scenarios["original"]["overflow_risk"]:
        warnings.append({"code":"LAYOUT_OVERFLOW_RISK", "severity":scenarios["original"]["severity"], "message":f"Original text is estimated to exceed the {max_lines}-line layout budget."})
    for mode in ("accented", "expanded", "rtl"):
        if scenarios[mode]["overflow_risk"]:
            warnings.append({"code":"PSEUDOLOCALIZATION_OVERFLOW", "severity":scenarios[mode]["severity"], "message":f"The {mode} stress case is estimated to exceed the layout budget."})
    if size_px < min_size:
        warnings.append({"code":"VIEWING_DISTANCE_SIZE", "severity":"warning", "message":f"Resolved size {round(size_px,1)}px is below the recommended {min_size}px floor for {platform}."})
    if container_width > viewport_width * (1.0 - safe_area * 2.0) + 1:
        warnings.append({"code":"SAFE_AREA_RISK", "severity":"warning", "message":"Requested container width exceeds the estimated platform safe-area width."})

    severity_rank = {"pass":0, "warning":1, "critical":2}
    worst = max(scenarios.items(), key=lambda item: (severity_rank[item[1]["severity"]], item[1]["width_utilization"], item[1]["estimated_line_count"]))
    status = "critical" if any(s["severity"] == "critical" for s in scenarios.values()) else "warning" if any(s["overflow_risk"] for s in scenarios.values()) or warnings else "pass"
    return {
        "status": status,
        "role": role_name,
        "platform": platform,
        "direction": direction,
        "font_size_px": round(size_px, 2),
        "recommended_min_size_px": min_size,
        "container_width_px": round(container_width, 2),
        "safe_area_ratio": round(safe_area, 4),
        "localization_expansion": round(expansion, 3),
        "max_lines": max_lines,
        "worst_case": worst[0],
        "scenarios": scenarios,
        "warnings": warnings,
        "method": "Deterministic heuristic. Final shaping and exact line breaks must still be verified in the target renderer.",
    }


def build_layout_qa_matrix(engine, target_ids: Iterable[str], output_dir: str | Path, widths: Iterable[int] = (320, 768, 1280), modes: Iterable[str] = ("original", "expanded", "rtl"), force: bool = False) -> Path:
    root = Path(output_dir)
    if root.exists():
        if not force:
            raise FileExistsError(f"Output already exists: {root}")
        shutil.rmtree(root)
    root.mkdir(parents=True, exist_ok=True)
    ids = list(target_ids) or list(engine.presets)[:8]
    widths = [max(240, int(w)) for w in widths]
    modes = [str(m).lower() for m in modes]
    rows = []
    for target_id in ids:
        if target_id in engine.presets:
            base = engine.resolve_preset(target_id)
        elif target_id in engine.recipes:
            base = engine.resolve({"text": engine.recipes[target_id].get("label", target_id), "role":"display", "recipe":target_id, "platform":"web"})
        else:
            raise KeyError(f"Unknown preset or recipe '{target_id}'.")
        source_text = base["request"].get("text", target_id)
        for width in widths:
            for mode in modes:
                text = pseudo_localize(source_text, mode)
                request = dict(base["request"])
                request.update({"text":text, "container_width_px":width, "viewport_width":max(width, 320), "language_direction":"rtl" if mode == "rtl" else "auto"})
                plan = engine.resolve(request)
                audit = plan["resolved"]["layout_audit"]
                rows.append({
                    "target_id": target_id,
                    "label": base.get("preset", {}).get("label", target_id),
                    "width": width,
                    "mode": mode,
                    "text": text,
                    "role": plan["resolved"]["role"],
                    "font_family": plan["resolved"]["font_family"],
                    "font_size_px": plan["resolved"]["size_px"],
                    "status": audit["status"],
                    "scenario": audit["scenarios"]["original"],
                })
    manifest = {"id":"axm.text.layout_qa", "version":"1.0.0", "targets":ids, "widths":widths, "modes":modes, "rows":rows}
    (root / "layout_qa_manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    cards = []
    for row in rows:
        direction = "rtl" if row["mode"] == "rtl" else "ltr"
        scenario = row["scenario"]
        cards.append(
            '<article class="card {status}"><div class="meta"><b>{label}</b><span>{width}px | {mode} | {status}</span></div>'
            '<div class="frame" style="max-width:{width}px" dir="{direction}"><div style="font-family:{font};font-size:{size}px">{text}</div></div>'
            '<small>{lines} lines / max {max_lines} | {use}% widest-line use</small></article>'.format(
                status=html.escape(row["status"]), label=html.escape(row["label"]), width=row["width"],
                mode=html.escape(row["mode"]), direction=direction, font=html.escape(row["font_family"]),
                size=row["font_size_px"], text=html.escape(row["text"]), lines=scenario["estimated_line_count"],
                max_lines=scenario["max_lines"], use=round(scenario["width_utilization"] * 100),
            )
        )
    page = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>AXM Layout QA</title><style>body{margin:0;background:#07101a;color:#eef7ff;font-family:system-ui;padding:24px}h1{margin-top:0}.grid{display:grid;gap:14px}.card{background:#0d1825;border:1px solid #2b4055;border-radius:14px;padding:14px}.card.warning{border-color:#b98b35}.card.critical{border-color:#e45b70}.meta{display:flex;justify-content:space-between;gap:12px;margin-bottom:10px}.frame{border:1px dashed #597087;padding:14px;overflow:hidden;background:#06101a}small{display:block;color:#a9bacb;margin-top:8px}</style></head><body><h1>AXM Text Layout QA</h1><p>Deterministic overflow, pseudo-localization, RTL, and safe-area stress matrix.</p><div class="grid">' + ''.join(cards) + '</div></body></html>'
    (root / "index.html").write_text(page, encoding="utf-8")
    return root
