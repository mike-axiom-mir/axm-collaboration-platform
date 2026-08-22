CONTRACT_VERSION = "0.1.0"
UNKNOWN_TEXT = "UNKNOWN — insufficient verified information in the source declaration."

DEFAULT_COST_PROFILE = {
    "compute_cost": "unknown",
    "time_cost": "unknown",
    "attention_cost": "unknown",
    "skill_cost": "unknown",
    "setup_cost": "unknown",
    "error_recovery_cost": "unknown",
}

DEFAULT_RISK_PROFILE = {
    "risk_level": "unknown",
    "reversibility": "unknown",
    "privacy_sensitivity": "unknown",
    "failure_modes": [],
    "human_confirmation_required": False,
    "safe_preview_recommended": False,
}

DEFAULT_MATURITY_PROFILE = {
    "availability": "unknown",
    "maturity": "unknown",
    "proof_status": "unverified",
    "known_limitations": [],
}
