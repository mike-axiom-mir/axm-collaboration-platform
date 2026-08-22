from pathlib import Path
from tempfile import TemporaryDirectory
import struct
import json

from axm_text_fabric.font_inspector import inspect_font, audit_font_text, build_font_registry, plan_font_stack
from axm_text_fabric.engine import TextFabricEngine
from axm_text_fabric.compiler import compile_target_bundle


def _name_table():
    values = {
        1: "AXM Synthetic",
        2: "Regular",
        4: "AXM Synthetic Regular",
        6: "AXMSynthetic-Regular",
        13: "Test-only synthetic font metadata.",
        256: "Weight",
    }
    strings = bytearray()
    records = []
    for name_id, value in values.items():
        raw = value.encode("utf-16-be")
        records.append(struct.pack(">HHHHHH", 3, 1, 0x0409, name_id, len(raw), len(strings)))
        strings.extend(raw)
    return struct.pack(">HHH", 0, len(records), 6 + 12 * len(records)) + b"".join(records) + bytes(strings)


def _cmap_table(groups=None):
    groups = groups or [
        (0x0041, 0x005A, 1),
        (0x1F600, 0x1F600, 100),
    ]
    sub = struct.pack(">HHIII", 12, 0, 16 + 12 * len(groups), 0, len(groups))
    sub += b"".join(struct.pack(">III", *group) for group in groups)
    return struct.pack(">HHHHI", 0, 1, 3, 10, 12) + sub


def _fvar_table():
    header = struct.pack(">IHHHHHH", 0x00010000, 16, 2, 1, 20, 0, 4)
    axis = b"wght" + struct.pack(">iiiHH", 100 << 16, 400 << 16, 900 << 16, 0, 256)
    return header + axis


def _head_table():
    data = bytearray(54)
    struct.pack_into(">H", data, 18, 1000)
    return bytes(data)


def _maxp_table():
    return struct.pack(">IH", 0x00010000, 128)


def _os2_table():
    data = bytearray(8)
    struct.pack_into(">H", data, 4, 400)
    struct.pack_into(">H", data, 6, 5)
    return bytes(data)


def _build_font(path: Path, groups=None):
    tables = {
        "OS/2": _os2_table(),
        "cmap": _cmap_table(groups),
        "fvar": _fvar_table(),
        "head": _head_table(),
        "maxp": _maxp_table(),
        "name": _name_table(),
    }
    num = len(tables)
    header = struct.pack(">IHHHH", 0x00010000, num, 0, 0, 0)
    offset = 12 + 16 * num
    records = []
    payload = bytearray()
    for tag, blob in sorted(tables.items()):
        while offset % 4:
            payload.append(0)
            offset += 1
        records.append(tag.encode("latin-1") + struct.pack(">III", 0, offset, len(blob)))
        payload.extend(blob)
        offset += len(blob)
    path.write_bytes(header + b"".join(records) + bytes(payload))


def run():
    with TemporaryDirectory() as tmp:
        font = Path(tmp) / "synthetic.ttf"
        fallback = Path(tmp) / "fallback.ttf"
        _build_font(font)
        _build_font(fallback, [(0x0416, 0x0416, 1)])
        info = inspect_font(font)
        assert info["names"]["family"] == "AXM Synthetic"
        assert info["metrics"]["units_per_em"] == 1000
        assert info["metrics"]["glyph_count"] == 128
        assert info["variable_axes"][0]["tag"] == "wght"
        assert info["variable_axes"][0]["maximum"] == 900
        assert info["codepoint_count"] == 27
        audit = audit_font_text(font, "AZ😀Ж")
        assert audit["complete"] is False
        assert audit["missing_character_count"] == 1
        assert audit["missing"][0]["codepoint"] == "U+0416"
        good = audit_font_text(font, "AZ😀")
        assert good["complete"] is True
        registry = build_font_registry([tmp], redact_paths=True)
        assert registry["font_count"] == 2
        assert {item["source_path"] for item in registry["fonts"]} == {"synthetic.ttf", "fallback.ttf"}
        stack = plan_font_stack(registry, "AZ😀")
        assert stack["complete"] is True
        assert stack["selected_font_count"] == 1
        cyrillic = plan_font_stack(registry, "Ж")
        assert cyrillic["complete"] is True
        incomplete = plan_font_stack(registry, "日")
        assert incomplete["complete"] is False

        engine = TextFabricEngine()
        plan = engine.resolve({"text":"AZ😀", "role":"display", "platform":"web", "font_file":str(font), "font_coverage_policy":"strict"})
        assert plan["resolved"]["font_file_audit"]["complete"] is True
        registry_path = Path(tmp) / "registry.json"
        registry_path.write_text(json.dumps(registry), encoding="utf-8")
        bundle = compile_target_bundle(engine, "readable_glitch", Path(tmp) / "bundle", ["web"], overrides={
            "text":"AZ😀Ж",
            "font_file":str(font),
            "font_registry":str(registry_path),
            "font_coverage_policy":"strict",
        })
        assert (bundle / "font_audit.json").exists()
        assert (bundle / "font_stack_plan.json").exists()
        snapshot = json.loads((bundle / "source_snapshot" / "request.json").read_text(encoding="utf-8"))
        assert snapshot["font_file"] == "<local-font-not-bundled>"
        assert snapshot["font_registry"] == "<local-font-registry-not-bundled>"
        try:
            engine.resolve({"text":"Ж", "role":"display", "platform":"web", "font_file":str(font), "font_coverage_policy":"strict"})
        except ValueError as exc:
            assert "Strict font coverage failed" in str(exc)
        else:
            raise AssertionError("strict coverage should fail")
