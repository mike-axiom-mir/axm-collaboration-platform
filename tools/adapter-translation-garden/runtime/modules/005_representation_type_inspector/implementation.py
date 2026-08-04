from __future__ import annotations
import json
from pathlib import Path
from typing import Any

MAGIC = [
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
    (b"PK\x03\x04", "application/zip"),
    (b"%PDF-", "application/pdf"),
    (b"\x1f\x8b", "application/gzip"),
]


def run(data: bytes, filename: str | None = None) -> dict[str, Any]:
    if not isinstance(data, (bytes, bytearray)):
        raise TypeError("data must be bytes")
    raw = bytes(data)
    for prefix, media_type in MAGIC:
        if raw.startswith(prefix):
            return {"media_type": media_type, "encoding": "binary", "confidence": "magic", "filename": filename}
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return {"media_type": "application/octet-stream", "encoding": "binary", "confidence": "fallback", "filename": filename}
    try:
        json.loads(text)
        return {"media_type": "application/json", "encoding": "utf-8", "confidence": "parsed", "filename": filename}
    except json.JSONDecodeError:
        suffix = Path(filename).suffix.lower() if filename else ""
        media_type = "text/csv" if suffix == ".csv" else "text/plain"
        return {"media_type": media_type, "encoding": "utf-8", "confidence": "decoded", "filename": filename}
