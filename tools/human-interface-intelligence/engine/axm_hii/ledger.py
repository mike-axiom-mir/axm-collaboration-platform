from __future__ import annotations

from typing import Any

from .receipts import digest
from .util import stable_id

LEDGER_VERSION = "0.1.0"
DEFAULT_STREAM_ID = "axm.tri-module-intake-signals"


def create_ledger_entry(
    signal_packet: dict[str, Any],
    *,
    sequence: int,
    previous_entry_hash: str = "",
    stream_id: str = DEFAULT_STREAM_ID,
) -> dict[str, Any]:
    if sequence < 1:
        raise ValueError("Ledger sequence must start at 1 or greater.")
    packet_id = str(signal_packet.get("signal_packet_id", ""))
    if not packet_id:
        raise ValueError("Signal packet must have signal_packet_id.")
    producer_module_id = str(signal_packet.get("producer", {}).get("module_id", ""))
    signal_count = int(signal_packet.get("signal_count", 0))
    core = {
        "ledger_version": LEDGER_VERSION,
        "stream_id": stream_id,
        "sequence": sequence,
        "previous_entry_hash": previous_entry_hash,
        "signal_packet_id": packet_id,
        "signal_packet_hash": digest(signal_packet),
        "producer_module_id": producer_module_id,
        "signal_count": signal_count,
    }
    entry_hash = digest(core)
    return {
        **core,
        "entry_id": stable_id("axm.hii.signal-ledger-entry", core),
        "entry_hash": entry_hash,
    }


def verify_ledger_chain(entries: list[dict[str, Any]], *, packets_by_id: dict[str, dict[str, Any]] | None = None) -> dict[str, Any]:
    problems: list[dict[str, Any]] = []
    expected_previous = ""
    expected_sequence = 1
    stream_id = None

    for index, entry in enumerate(entries):
        if entry.get("sequence") != expected_sequence:
            problems.append({"index": index, "kind": "sequence_mismatch", "expected": expected_sequence, "actual": entry.get("sequence")})
        if entry.get("previous_entry_hash", "") != expected_previous:
            problems.append({"index": index, "kind": "previous_hash_mismatch", "expected": expected_previous, "actual": entry.get("previous_entry_hash", "")})
        if stream_id is None:
            stream_id = entry.get("stream_id")
        elif entry.get("stream_id") != stream_id:
            problems.append({"index": index, "kind": "stream_id_changed", "expected": stream_id, "actual": entry.get("stream_id")})

        core = {
            "ledger_version": entry.get("ledger_version"),
            "stream_id": entry.get("stream_id"),
            "sequence": entry.get("sequence"),
            "previous_entry_hash": entry.get("previous_entry_hash", ""),
            "signal_packet_id": entry.get("signal_packet_id"),
            "signal_packet_hash": entry.get("signal_packet_hash"),
            "producer_module_id": entry.get("producer_module_id", ""),
            "signal_count": entry.get("signal_count", 0),
        }
        calculated = digest(core)
        if entry.get("entry_hash") != calculated:
            problems.append({"index": index, "kind": "entry_hash_mismatch", "expected": calculated, "actual": entry.get("entry_hash")})

        if packets_by_id is not None:
            packet = packets_by_id.get(str(entry.get("signal_packet_id", "")))
            if packet is None:
                problems.append({"index": index, "kind": "packet_missing", "packet_id": entry.get("signal_packet_id", "")})
            else:
                packet_hash = digest(packet)
                if packet_hash != entry.get("signal_packet_hash"):
                    problems.append({"index": index, "kind": "packet_hash_mismatch", "expected": packet_hash, "actual": entry.get("signal_packet_hash")})

        expected_previous = str(entry.get("entry_hash", ""))
        expected_sequence += 1

    return {
        "ledger_version": LEDGER_VERSION,
        "stream_id": stream_id or DEFAULT_STREAM_ID,
        "entry_count": len(entries),
        "status": "PASS" if not problems else "CONFLICTED",
        "problems": problems,
    }


def build_ledger_preview(signal_packets: list[dict[str, Any]], *, stream_id: str = DEFAULT_STREAM_ID) -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    previous = ""
    for sequence, packet in enumerate(signal_packets, start=1):
        entry = create_ledger_entry(packet, sequence=sequence, previous_entry_hash=previous, stream_id=stream_id)
        entries.append(entry)
        previous = entry["entry_hash"]
    packets = {str(packet.get("signal_packet_id", "")): packet for packet in signal_packets}
    verification = verify_ledger_chain(entries, packets_by_id=packets)
    return {
        "ledger_version": LEDGER_VERSION,
        "stream_id": stream_id,
        "persistence_state": "NOT_WRITTEN_TO_LOCAL_LEDGER",
        "authority": "integrity_preview_only",
        "entries": entries,
        "verification": verification,
        "note": "This preview demonstrates an append-only hash chain. Local AXM decides whether and where to persist it during intake.",
    }
