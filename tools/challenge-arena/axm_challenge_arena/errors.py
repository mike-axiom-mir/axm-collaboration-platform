class ArenaError(Exception):
    """Base exception for expected Challenge Arena failures."""


class ValidationError(ArenaError):
    """Raised when a packet, submission, review, or action is invalid."""


class StateError(ArenaError):
    """Raised when an action is attempted in the wrong challenge state."""


class IntegrityError(ArenaError):
    """Raised when an immutable hash or stored artifact no longer matches."""
