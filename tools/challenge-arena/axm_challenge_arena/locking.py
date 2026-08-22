from __future__ import annotations

import os
import threading
import time
from pathlib import Path
from typing import BinaryIO


class FileLockTimeout(TimeoutError):
    """Raised when a local advisory lock cannot be acquired before its deadline."""


class FileLock:
    """Small re-entrant cross-platform advisory file lock.

    One ``FileLock`` instance is re-entrant for the owning thread, so nested Arena
    helper calls do not accidentally unlock an outer transaction. Other threads in
    the process serialize through an ``RLock``; other processes/instances coordinate
    through the operating system lock.

    This remains a local-filesystem coordination primitive, not a distributed lock.
    """

    def __init__(
        self,
        path: str | Path,
        *,
        timeout: float = 15.0,
        poll_interval: float = 0.05,
    ) -> None:
        self.path = Path(path)
        self.timeout = max(0.0, float(timeout))
        self.poll_interval = max(0.01, float(poll_interval))
        self._handle: BinaryIO | None = None
        self._guard = threading.RLock()
        self._owner_thread: int | None = None
        self._depth = 0

    def _try_os_lock(self, handle: BinaryIO) -> bool:
        if os.name == "nt":
            import msvcrt

            try:
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                return True
            except OSError:
                return False

        import fcntl

        try:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            return True
        except OSError:
            return False

    @staticmethod
    def _unlock_os(handle: BinaryIO) -> None:
        if os.name == "nt":
            import msvcrt

            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            return

        import fcntl

        fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

    def acquire(self) -> "FileLock":
        self._guard.acquire()
        thread_id = threading.get_ident()
        if self._depth:
            # The RLock guarantees that only the owner thread reaches this branch.
            if self._owner_thread != thread_id:
                self._guard.release()
                raise RuntimeError("FileLock ownership state is inconsistent.")
            self._depth += 1
            return self

        self.path.parent.mkdir(parents=True, exist_ok=True)
        handle = self.path.open("a+b")
        try:
            if os.name == "nt":
                handle.seek(0, os.SEEK_END)
                if handle.tell() == 0:
                    handle.write(b"\0")
                    handle.flush()
                    os.fsync(handle.fileno())
                handle.seek(0)

            deadline = time.monotonic() + self.timeout
            while not self._try_os_lock(handle):
                if time.monotonic() >= deadline:
                    raise FileLockTimeout(f"Timed out acquiring local lock: {self.path}")
                time.sleep(self.poll_interval)

            self._handle = handle
            self._owner_thread = thread_id
            self._depth = 1
            return self
        except Exception:
            handle.close()
            self._guard.release()
            raise

    def release(self) -> None:
        if self._depth <= 0 or self._owner_thread != threading.get_ident():
            raise RuntimeError("FileLock release attempted by a non-owner or without acquire().")

        self._depth -= 1
        try:
            if self._depth == 0:
                handle = self._handle
                self._handle = None
                self._owner_thread = None
                if handle is not None:
                    try:
                        self._unlock_os(handle)
                    finally:
                        handle.close()
        finally:
            self._guard.release()

    def __enter__(self) -> "FileLock":
        return self.acquire()

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:
        self.release()
