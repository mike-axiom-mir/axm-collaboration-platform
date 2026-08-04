from __future__ import annotations

from collections import Counter
from pathlib import Path
import hashlib
import json
import struct
import unicodedata

from .glyphs import audit_text, script_of


class FontFormatError(ValueError):
    pass


def _u16(data: bytes, offset: int) -> int:
    if offset < 0 or offset + 2 > len(data):
        raise FontFormatError(f"Unexpected end of font at offset {offset}.")
    return struct.unpack_from(">H", data, offset)[0]


def _s16(data: bytes, offset: int) -> int:
    if offset < 0 or offset + 2 > len(data):
        raise FontFormatError(f"Unexpected end of font at offset {offset}.")
    return struct.unpack_from(">h", data, offset)[0]


def _u32(data: bytes, offset: int) -> int:
    if offset < 0 or offset + 4 > len(data):
        raise FontFormatError(f"Unexpected end of font at offset {offset}.")
    return struct.unpack_from(">I", data, offset)[0]


def _fixed_16_16(data: bytes, offset: int) -> float:
    raw = struct.unpack_from(">i", data, offset)[0]
    return raw / 65536.0


def _decode_name(raw: bytes, platform_id: int, encoding_id: int) -> str:
    try:
        if platform_id in {0, 3}:
            return raw.decode("utf-16-be", errors="replace").strip("\x00")
        if platform_id == 1:
            return raw.decode("mac_roman", errors="replace").strip("\x00")
        return raw.decode("latin-1", errors="replace").strip("\x00")
    except Exception:
        return ""


def _sfnt_offset(data: bytes, index: int) -> tuple[int, str, int]:
    if data[:4] == b"ttcf":
        if len(data) < 12:
            raise FontFormatError("Truncated TrueType collection header.")
        count = _u32(data, 8)
        if index < 0 or index >= count:
            raise FontFormatError(f"Font collection index {index} is outside 0..{count - 1}.")
        offset = _u32(data, 12 + index * 4)
        return offset, "TTC", count
    if index not in {0, None}:
        raise FontFormatError("A non-zero font index is only valid for .ttc collections.")
    return 0, "SFNT", 1


def _table_directory(data: bytes, index: int = 0) -> tuple[dict[str, tuple[int, int]], dict]:
    base, container, face_count = _sfnt_offset(data, index)
    if base + 12 > len(data):
        raise FontFormatError("Truncated SFNT header.")
    signature = data[base:base + 4]
    if signature not in {b"\x00\x01\x00\x00", b"OTTO", b"true", b"typ1"}:
        raise FontFormatError(f"Unsupported SFNT signature {signature!r}.")
    num_tables = _u16(data, base + 4)
    records_end = base + 12 + num_tables * 16
    if records_end > len(data):
        raise FontFormatError("Truncated SFNT table directory.")
    tables: dict[str, tuple[int, int]] = {}
    for i in range(num_tables):
        record = base + 12 + i * 16
        tag = data[record:record + 4].decode("latin-1")
        offset = _u32(data, record + 8)
        length = _u32(data, record + 12)
        if offset + length > len(data):
            raise FontFormatError(f"Table {tag!r} points outside the font file.")
        tables[tag] = (offset, length)
    version = "1.0" if signature == b"\x00\x01\x00\x00" else signature.decode("latin-1")
    return tables, {"container": container, "face_count": face_count, "face_index": index, "sfnt_version": version}


def _parse_names(data: bytes, table: tuple[int, int] | None) -> tuple[dict[int, str], dict]:
    if not table:
        return {}, {}
    offset, length = table
    end = offset + length
    if length < 6:
        return {}, {}
    count = _u16(data, offset + 2)
    storage_offset = _u16(data, offset + 4)
    names: dict[int, str] = {}
    best_rank: dict[int, int] = {}
    for i in range(count):
        rec = offset + 6 + i * 12
        if rec + 12 > end:
            break
        platform_id = _u16(data, rec)
        encoding_id = _u16(data, rec + 2)
        language_id = _u16(data, rec + 4)
        name_id = _u16(data, rec + 6)
        size = _u16(data, rec + 8)
        string_offset = _u16(data, rec + 10)
        start = offset + storage_offset + string_offset
        stop = start + size
        if start < offset or stop > end:
            continue
        value = _decode_name(data[start:stop], platform_id, encoding_id)
        if not value:
            continue
        rank = 0
        if platform_id == 3:
            rank += 100
        elif platform_id == 0:
            rank += 90
        elif platform_id == 1:
            rank += 50
        if language_id in {0x0409, 0}:
            rank += 10
        if rank >= best_rank.get(name_id, -1):
            names[name_id] = value
            best_rank[name_id] = rank
    mapped = {
        "family": names.get(1),
        "subfamily": names.get(2),
        "unique_id": names.get(3),
        "full_name": names.get(4),
        "version": names.get(5),
        "postscript_name": names.get(6),
        "trademark": names.get(7),
        "manufacturer": names.get(8),
        "designer": names.get(9),
        "description": names.get(10),
        "license": names.get(13),
        "license_url": names.get(14),
        "typographic_family": names.get(16),
        "typographic_subfamily": names.get(17),
    }
    compact = {key: value for key, value in mapped.items() if value}
    for key in ("license", "description", "trademark"):
        value = compact.get(key)
        if value and len(value) > 4096:
            compact[f"{key}_character_count"] = len(value)
            compact[f"{key}_truncated"] = True
            compact[key] = value[:4096] + "…"
    return names, compact


def _parse_cmap_format_0(data: bytes, offset: int, end: int) -> set[int]:
    length = _u16(data, offset + 2)
    stop = min(end, offset + length)
    result = set()
    for cp in range(256):
        pos = offset + 6 + cp
        if pos < stop and data[pos] != 0:
            result.add(cp)
    return result


def _parse_cmap_format_4(data: bytes, offset: int, end: int) -> set[int]:
    length = _u16(data, offset + 2)
    stop = min(end, offset + length)
    seg_count = _u16(data, offset + 6) // 2
    end_codes = offset + 14
    start_codes = end_codes + seg_count * 2 + 2
    deltas = start_codes + seg_count * 2
    ranges = deltas + seg_count * 2
    if ranges + seg_count * 2 > stop:
        raise FontFormatError("Truncated cmap format 4 subtable.")
    result = set()
    for i in range(seg_count):
        end_cp = _u16(data, end_codes + i * 2)
        start_cp = _u16(data, start_codes + i * 2)
        delta = _s16(data, deltas + i * 2)
        range_offset = _u16(data, ranges + i * 2)
        if start_cp > end_cp:
            continue
        for cp in range(start_cp, end_cp + 1):
            if cp == 0xFFFF:
                continue
            glyph_id = 0
            if range_offset == 0:
                glyph_id = (cp + delta) & 0xFFFF
            else:
                word_pos = ranges + i * 2
                glyph_pos = word_pos + range_offset + (cp - start_cp) * 2
                if glyph_pos + 2 <= stop:
                    glyph_id = _u16(data, glyph_pos)
                    if glyph_id:
                        glyph_id = (glyph_id + delta) & 0xFFFF
            if glyph_id:
                result.add(cp)
    return result


def _parse_cmap_format_6(data: bytes, offset: int, end: int) -> set[int]:
    length = _u16(data, offset + 2)
    stop = min(end, offset + length)
    first = _u16(data, offset + 6)
    count = _u16(data, offset + 8)
    result = set()
    for i in range(count):
        pos = offset + 10 + i * 2
        if pos + 2 <= stop and _u16(data, pos) != 0:
            result.add(first + i)
    return result


def _parse_cmap_format_12_or_13(data: bytes, offset: int, end: int) -> set[int]:
    length = _u32(data, offset + 4)
    stop = min(end, offset + length)
    groups = _u32(data, offset + 12)
    result = set()
    pos = offset + 16
    for _ in range(groups):
        if pos + 12 > stop:
            raise FontFormatError("Truncated cmap format 12/13 group.")
        start_cp = _u32(data, pos)
        end_cp = _u32(data, pos + 4)
        glyph = _u32(data, pos + 8)
        if glyph and start_cp <= end_cp <= 0x10FFFF:
            result.update(range(start_cp, end_cp + 1))
        pos += 12
    return result


def _parse_cmap(data: bytes, table: tuple[int, int] | None) -> tuple[set[int], list[dict]]:
    if not table:
        return set(), []
    offset, length = table
    end = offset + length
    if length < 4:
        return set(), []
    num_tables = _u16(data, offset + 2)
    candidates = []
    for i in range(num_tables):
        rec = offset + 4 + i * 8
        if rec + 8 > end:
            break
        platform = _u16(data, rec)
        encoding = _u16(data, rec + 2)
        sub_offset = offset + _u32(data, rec + 4)
        if sub_offset + 2 > end:
            continue
        fmt = _u16(data, sub_offset)
        score = 0
        if platform == 0:
            score += 100
        if platform == 3 and encoding == 10:
            score += 95
        elif platform == 3 and encoding in {1, 0}:
            score += 80
        if fmt in {12, 13}:
            score += 30
        elif fmt == 4:
            score += 20
        elif fmt in {0, 6}:
            score += 10
        candidates.append((score, platform, encoding, fmt, sub_offset))
    codepoints: set[int] = set()
    records = []
    for score, platform, encoding, fmt, sub_offset in sorted(candidates, reverse=True):
        try:
            if fmt == 0:
                covered = _parse_cmap_format_0(data, sub_offset, end)
            elif fmt == 4:
                covered = _parse_cmap_format_4(data, sub_offset, end)
            elif fmt == 6:
                covered = _parse_cmap_format_6(data, sub_offset, end)
            elif fmt in {12, 13}:
                covered = _parse_cmap_format_12_or_13(data, sub_offset, end)
            else:
                continue
        except FontFormatError:
            continue
        records.append({"platform_id": platform, "encoding_id": encoding, "format": fmt, "codepoints": len(covered), "score": score})
        codepoints.update(covered)
    return codepoints, records


def _parse_fvar(data: bytes, table: tuple[int, int] | None, name_ids: dict[int, str]) -> list[dict]:
    if not table:
        return []
    offset, length = table
    end = offset + length
    if length < 16:
        return []
    axes_offset = _u16(data, offset + 4)
    axis_count = _u16(data, offset + 8)
    axis_size = _u16(data, offset + 10)
    if axis_size < 20:
        return []
    axes = []
    pos = offset + axes_offset
    for _ in range(axis_count):
        if pos + axis_size > end:
            break
        tag = data[pos:pos + 4].decode("latin-1")
        minimum = _fixed_16_16(data, pos + 4)
        default = _fixed_16_16(data, pos + 8)
        maximum = _fixed_16_16(data, pos + 12)
        flags = _u16(data, pos + 16)
        name_id = _u16(data, pos + 18)
        axes.append({
            "tag": tag,
            "name": name_ids.get(name_id, tag),
            "minimum": minimum,
            "default": default,
            "maximum": maximum,
            "hidden": bool(flags & 0x0001),
        })
        pos += axis_size
    return axes


def _coverage_intervals(codepoints: set[int]) -> list[list[int]]:
    if not codepoints:
        return []
    values = sorted(codepoints)
    intervals = []
    start = previous = values[0]
    for cp in values[1:]:
        if cp == previous + 1:
            previous = cp
            continue
        intervals.append([start, previous])
        start = previous = cp
    intervals.append([start, previous])
    return intervals


def _coverage_ranges(codepoints: set[int], limit: int = 256) -> tuple[list[dict], bool]:
    if not codepoints:
        return [], False
    values = sorted(codepoints)
    ranges = []
    start = previous = values[0]
    for cp in values[1:]:
        if cp == previous + 1:
            previous = cp
            continue
        ranges.append({"start": f"U+{start:04X}", "end": f"U+{previous:04X}", "count": previous - start + 1})
        start = previous = cp
        if len(ranges) >= limit:
            return ranges, True
    ranges.append({"start": f"U+{start:04X}", "end": f"U+{previous:04X}", "count": previous - start + 1})
    return ranges[:limit], len(ranges) > limit


def _script_coverage(codepoints: set[int]) -> dict[str, int]:
    counts = Counter()
    for cp in codepoints:
        if 0 <= cp <= 0x10FFFF:
            counts[script_of(chr(cp))] += 1
    return dict(sorted(counts.items()))


def _compact_font_info(info: dict) -> dict:
    return {
        "file_name": info.get("file_name"),
        "sha256": info.get("sha256"),
        "face_index": info.get("face_index"),
        "names": info.get("names", {}),
        "metrics": info.get("metrics", {}),
        "variable_axes": info.get("variable_axes", []),
        "capabilities": info.get("capabilities", {}),
        "codepoint_count": info.get("codepoint_count", 0),
        "script_coverage": info.get("script_coverage", {}),
    }


def inspect_font(path: str | Path, index: int = 0, include_ranges: bool = True) -> dict:
    source = Path(path)
    if not source.exists() or not source.is_file():
        raise FileNotFoundError(f"Font file not found: {source}")
    data = source.read_bytes()
    tables, container_info = _table_directory(data, index)
    name_ids, names = _parse_names(data, tables.get("name"))
    codepoints, cmap_records = _parse_cmap(data, tables.get("cmap"))
    axes = _parse_fvar(data, tables.get("fvar"), name_ids)
    units_per_em = None
    if "head" in tables and tables["head"][1] >= 20:
        units_per_em = _u16(data, tables["head"][0] + 18)
    glyph_count = None
    if "maxp" in tables and tables["maxp"][1] >= 6:
        glyph_count = _u16(data, tables["maxp"][0] + 4)
    weight_class = width_class = None
    if "OS/2" in tables and tables["OS/2"][1] >= 8:
        os2 = tables["OS/2"][0]
        weight_class = _u16(data, os2 + 4)
        width_class = _u16(data, os2 + 6)
    ranges, ranges_truncated = _coverage_ranges(codepoints) if include_ranges else ([], False)
    capabilities = {
        "variable_font": bool(axes),
        "gsub_shaping": "GSUB" in tables,
        "gpos_positioning": "GPOS" in tables,
        "kerning_table": "kern" in tables,
        "color_colr_cpal": "COLR" in tables and "CPAL" in tables,
        "color_bitmap": any(tag in tables for tag in ("CBDT", "CBLC", "sbix")),
        "svg_glyphs": "SVG " in tables,
        "cff_outlines": "CFF " in tables or "CFF2" in tables,
        "truetype_outlines": "glyf" in tables,
    }
    return {
        **container_info,
        "file_name": source.name,
        "source_path": str(source.resolve()),
        "file_size": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "tables": sorted(tables),
        "names": names,
        "metrics": {key: value for key, value in {
            "units_per_em": units_per_em,
            "glyph_count": glyph_count,
            "weight_class": weight_class,
            "width_class": width_class,
        }.items() if value is not None},
        "variable_axes": axes,
        "capabilities": capabilities,
        "cmap_records": cmap_records,
        "codepoint_count": len(codepoints),
        "script_coverage": _script_coverage(codepoints),
        "coverage_ranges": ranges,
        "coverage_ranges_truncated": ranges_truncated,
        "_codepoints": codepoints,
    }


def audit_font_text(path: str | Path, text: str, index: int = 0) -> dict:
    info = inspect_font(path, index=index, include_ranges=False)
    codepoints = info.pop("_codepoints")
    text_audit = audit_text(text)
    required = []
    seen = set()
    for position, char in enumerate(str(text or "")):
        cp = ord(char)
        category = unicodedata.category(char)
        if char.isspace() or category.startswith("C"):
            continue
        if cp not in seen:
            required.append((cp, char, position))
            seen.add(cp)
    missing = []
    for cp, char, position in required:
        if cp not in codepoints:
            missing.append({
                "codepoint": f"U+{cp:04X}",
                "character": char,
                "name": unicodedata.name(char, "UNNAMED"),
                "first_position": position,
                "script": script_of(char),
            })
    supported = len(required) - len(missing)
    ratio = 1.0 if not required else supported / len(required)
    warnings = []
    if missing:
        warnings.append({
            "code": "FONT_MISSING_GLYPHS",
            "severity": "error",
            "message": f"The selected font is missing {len(missing)} of {len(required)} unique required characters.",
        })
    scripts = set(text_audit.get("significant_scripts", []))
    shaping_scripts = scripts.intersection({"Arabic", "Devanagari", "Thai", "Hebrew"})
    if shaping_scripts and not info.get("capabilities", {}).get("gsub_shaping"):
        warnings.append({
            "code": "FONT_SHAPING_RISK",
            "severity": "warning",
            "message": "The text uses shaping-sensitive scripts but the font exposes no GSUB table.",
        })
    if text_audit.get("combining_mark_count", 0) and not info.get("capabilities", {}).get("gpos_positioning"):
        warnings.append({
            "code": "FONT_MARK_POSITIONING_RISK",
            "severity": "warning",
            "message": "Combining marks are present but the font exposes no GPOS table.",
        })
    return {
        "font": _compact_font_info(info),
        "text_audit": text_audit,
        "unique_required_characters": len(required),
        "supported_characters": supported,
        "missing_character_count": len(missing),
        "coverage_ratio": round(ratio, 6),
        "complete": not missing,
        "missing": missing[:256],
        "missing_truncated": len(missing) > 256,
        "warnings": warnings,
    }


def _font_candidates(paths: list[str | Path], recursive: bool) -> list[Path]:
    result = []
    seen = set()
    for raw in paths:
        path = Path(raw)
        if path.is_file() and path.suffix.lower() in {".ttf", ".otf", ".ttc"}:
            candidates = [path]
        elif path.is_dir():
            pattern = "**/*" if recursive else "*"
            candidates = [p for p in path.glob(pattern) if p.is_file() and p.suffix.lower() in {".ttf", ".otf", ".ttc"}]
        else:
            candidates = []
        for candidate in candidates:
            resolved = str(candidate.resolve())
            if resolved not in seen:
                seen.add(resolved)
                result.append(candidate)
    return sorted(result, key=lambda p: str(p).lower())


def build_font_registry(paths: list[str | Path], recursive: bool = True, redact_paths: bool = False) -> dict:
    fonts = []
    errors = []
    for path in _font_candidates(paths, recursive):
        try:
            raw = path.read_bytes()
            _, container, count = _sfnt_offset(raw, 0)
            face_count = count if container == "TTC" else 1
            for index in range(face_count):
                info = inspect_font(path, index=index, include_ranges=False)
                codepoints = info.pop("_codepoints", set())
                info["coverage_intervals"] = _coverage_intervals(codepoints)
                if redact_paths:
                    info["source_path"] = info["file_name"]
                fonts.append(info)
        except Exception as exc:
            errors.append({"path": path.name if redact_paths else str(path), "error": str(exc)})
    return {
        "id": "axm.text.font_registry",
        "version": "1.0.0",
        "font_count": len(fonts),
        "error_count": len(errors),
        "paths_redacted": redact_paths,
        "fonts": fonts,
        "errors": errors,
    }


def _interval_contains(intervals: list[list[int]], cp: int) -> bool:
    low = 0
    high = len(intervals) - 1
    while low <= high:
        mid = (low + high) // 2
        start, end = intervals[mid]
        if cp < start:
            high = mid - 1
        elif cp > end:
            low = mid + 1
        else:
            return True
    return False


def plan_font_stack(registry: dict | str | Path, text: str) -> dict:
    registry_source = None
    registry_sha256 = None
    if isinstance(registry, (str, Path)):
        registry_path = Path(registry)
        raw = registry_path.read_bytes()
        registry_data = json.loads(raw.decode("utf-8"))
        registry_source = str(registry_path.resolve())
        registry_sha256 = hashlib.sha256(raw).hexdigest()
    else:
        registry_data = dict(registry)
    required = []
    for char in str(text or ""):
        cp = ord(char)
        if char.isspace() or unicodedata.category(char).startswith("C"):
            continue
        if cp not in required:
            required.append(cp)
    uncovered = set(required)
    candidates = []
    for font in registry_data.get("fonts", []):
        intervals = font.get("coverage_intervals", [])
        covered = {cp for cp in required if _interval_contains(intervals, cp)}
        candidates.append((font, covered))
    chosen = []
    remaining = list(candidates)
    while uncovered and remaining:
        best_index = -1
        best_cover = set()
        for index, (_, covered) in enumerate(remaining):
            current = covered.intersection(uncovered)
            if len(current) > len(best_cover):
                best_index = index
                best_cover = current
        if best_index < 0 or not best_cover:
            break
        font, covered = remaining.pop(best_index)
        chosen.append({
            "file_name": font.get("file_name"),
            "source_path": font.get("source_path"),
            "face_index": font.get("face_index", 0),
            "family": font.get("names", {}).get("typographic_family") or font.get("names", {}).get("family"),
            "full_name": font.get("names", {}).get("full_name"),
            "sha256": font.get("sha256"),
            "covers_count": len(best_cover),
            "covers": [f"U+{cp:04X}" for cp in sorted(best_cover)],
            "scripts": sorted({script_of(chr(cp)) for cp in best_cover}),
        })
        uncovered.difference_update(best_cover)
    missing = [{
        "codepoint": f"U+{cp:04X}",
        "character": chr(cp),
        "name": unicodedata.name(chr(cp), "UNNAMED"),
        "script": script_of(chr(cp)),
    } for cp in sorted(uncovered)]
    return {
        "id": "axm.text.font_stack_plan",
        "version": "1.0.0",
        "text_audit": audit_text(text),
        "required_character_count": len(required),
        "selected_font_count": len(chosen),
        "complete": not missing,
        "font_stack": chosen,
        "missing": missing,
        "registry_font_count": len(registry_data.get("fonts", [])),
        "registry_source": registry_source,
        "registry_sha256": registry_sha256,
        "warnings": [] if not missing else [{
            "code": "REGISTRY_CANNOT_COVER_TEXT",
            "severity": "error",
            "message": f"The registry cannot cover {len(missing)} required characters.",
        }],
    }


def save_font_registry(output: str | Path, paths: list[str | Path], recursive: bool = True, redact_paths: bool = False, pretty: bool = True) -> Path:
    target = Path(output)
    target.parent.mkdir(parents=True, exist_ok=True)
    registry = build_font_registry(paths, recursive=recursive, redact_paths=redact_paths)
    target.write_text(json.dumps(registry, indent=2 if pretty else None, ensure_ascii=False) + "\n", encoding="utf-8")
    return target
