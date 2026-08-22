from __future__ import annotations

import tempfile
import threading
import unittest
from pathlib import Path

from axm_challenge_arena import ChallengeArena
from axm_challenge_arena.locking import FileLock
from axm_challenge_arena.presets import generic_packet


class LockingAndReadConsistencyTests(unittest.TestCase):
    def test_reentrant_file_lock_remains_held_until_outer_exit(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "workspace.lock"
            owner = FileLock(path, timeout=2.0, poll_interval=0.01)
            contender = FileLock(path, timeout=2.0, poll_interval=0.01)
            contender_entered = threading.Event()
            contender_release = threading.Event()

            def contend() -> None:
                with contender:
                    contender_entered.set()
                    contender_release.wait(2.0)

            thread = threading.Thread(target=contend, daemon=True)
            with owner:
                with owner:
                    thread.start()
                    self.assertFalse(contender_entered.wait(0.15))
                # Leaving the nested scope must not release the outer OS lock.
                self.assertFalse(contender_entered.wait(0.15))

            self.assertTrue(contender_entered.wait(1.0))
            contender_release.set()
            thread.join(2.0)
            self.assertFalse(thread.is_alive())

    def test_existing_reader_observes_then_recovers_interrupted_commit(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            writer = ChallengeArena(temp)
            writer.create_challenge(
                generic_packet(
                    "read-recovery",
                    "Read recovery",
                    "Prove that existing readers do not return stale state after a crash.",
                )
            )
            reader = ChallengeArena(temp)
            original = writer.store._write_event_file

            def fail_after_journal(*args: object, **kwargs: object) -> None:
                raise OSError("simulated interruption after pending journal write")

            writer.store._write_event_file = fail_after_journal  # type: ignore[method-assign]
            try:
                with self.assertRaises(OSError):
                    writer.register_participant("read-recovery", "one")
            finally:
                writer.store._write_event_file = original  # type: ignore[method-assign]

            pending = reader.store.pending_path("read-recovery")
            self.assertTrue(pending.is_file())

            # Integrity inspection is deliberately observational: it must not repair.
            report_before = reader.verify_integrity("read-recovery")
            self.assertFalse(report_before["valid"])
            self.assertTrue(pending.is_file())

            # A normal coherent read completes the already-recorded transaction.
            state = reader.get("read-recovery")
            self.assertIn("one", state["participants"])
            self.assertFalse(pending.exists())
            report_after = reader.verify_integrity("read-recovery")
            self.assertTrue(report_after["valid"], report_after)


if __name__ == "__main__":
    unittest.main()
