from __future__ import annotations
import io
import stat
import zipfile
import re
from pathlib import PurePosixPath
from typing import Any


def inspect_zip(data: bytes, *, max_files: int = 1000, max_total_uncompressed: int = 100_000_000, max_ratio: float = 200.0) -> dict[str, Any]:
    findings, entries = [], []
    total = 0
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        return {'schema': 'axm.translation.archive-inspection/v1', 'verdict': 'REFUSE', 'findings': [{'kind': 'invalid_zip', 'severity': 'blocking'}], 'entries': [], 'extracted': False}
    infos = zf.infolist()
    if len(infos) > max_files: findings.append({'kind': 'too_many_files', 'severity': 'blocking', 'count': len(infos)})
    for info in infos:
        name = info.filename.replace('\\', '/')
        p = PurePosixPath(name)
        unsafe_path = p.is_absolute() or '..' in p.parts or bool(re.match(r'^[A-Za-z]:', name))
        mode = (info.external_attr >> 16) & 0xFFFF
        symlink = stat.S_ISLNK(mode)
        encrypted = bool(info.flag_bits & 0x1)
        total += info.file_size
        ratio = info.file_size / max(1, info.compress_size)
        if unsafe_path: findings.append({'kind': 'unsafe_path', 'severity': 'blocking', 'path': name})
        if symlink: findings.append({'kind': 'symlink_entry', 'severity': 'blocking', 'path': name})
        if encrypted: findings.append({'kind': 'encrypted_entry', 'severity': 'high', 'path': name})
        if ratio > max_ratio and info.file_size > 1_000_000: findings.append({'kind': 'suspicious_compression_ratio', 'severity': 'blocking', 'path': name, 'ratio': round(ratio, 2)})
        entries.append({'path': name, 'compressed': info.compress_size, 'uncompressed': info.file_size, 'crc': f'{info.CRC:08x}', 'directory': info.is_dir(), 'unsafe_path': unsafe_path, 'symlink': symlink, 'encrypted': encrypted})
    if total > max_total_uncompressed: findings.append({'kind': 'uncompressed_limit_exceeded', 'severity': 'blocking', 'bytes': total})
    blocking = any(x['severity'] == 'blocking' for x in findings)
    return {'schema': 'axm.translation.archive-inspection/v1', 'verdict': 'REFUSE' if blocking else ('PARTIAL' if findings else 'PASS'), 'entries': entries, 'findings': findings, 'total_uncompressed': total, 'extracted': False, 'content_executed': False}


def plan_translate(report: dict[str, Any], *, target_format: str) -> dict[str, Any]:
    if report.get('verdict') == 'REFUSE': return {'verdict': 'REFUSE', 'reason': 'source package did not pass inspection', 'performed': False}
    if target_format not in {'zip', 'directory-manifest'}: return {'verdict': 'REFUSE', 'reason': 'target format unsupported by prototype', 'performed': False}
    return {'schema': 'axm.translation.archive-plan/v1', 'verdict': 'PLAN_READY', 'target_format': target_format, 'entry_count': len(report.get('entries', [])), 'operations': [{'operation': 'copy_verified_entry', 'path': x['path']} for x in report.get('entries', []) if not x['directory']], 'performed': False}


def run(data: bytes, **kwargs: Any) -> dict[str, Any]:
    return inspect_zip(data, **kwargs)
